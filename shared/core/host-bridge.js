/* The SDK needs reply callbacks, not historical copies of outgoing note content. */
function imPreferenceReply(key,callback){callback.imPreferenceKey=key;return callback;}
function imReleaseHostReply(bridge,callback){
  if(bridge.sentMessages)bridge.sentMessages=bridge.sentMessages.filter(record=>record.sourceCallback!==callback);
}
function imTrackHostReply(bridge,message,callback){
  if(typeof callback!=='function')return;
  const preferenceKey=message.action==='set-component-data'?(callback.imPreferenceKey||'component-data'):null;
  if(preferenceKey)bridge.sentMessages=bridge.sentMessages.filter(record=>record.preferenceKey!==preferenceKey);
  const persistent=message.action==='stream-context-item'||message.action==='stream-items';
  const record={messageId:message.messageId,...(preferenceKey?{preferenceKey}:{}),sourceCallback:callback,callback:reply=>{
    if(!persistent)bridge.sentMessages=bridge.sentMessages.filter(entry=>entry!==record);
    callback(reply);
  }};
  bridge.sentMessages.push(record);
}
/* Guard the bundled receiver before its legacy parser/theme dispatch. Native
 * mobile messages may have no source window; when supplied it must be parent. */
function imAcceptHostMessage(bridge,event){
  const target=bridge.contentWindow;
  if(!target||!event||typeof event.origin!=='string'||(event.source&&event.source!==target.parent))return false;
  let message=event.data;
  if(typeof message==='string')try{message=JSON.parse(message);}catch{return false;}
  if(!message||typeof message!=='object'||Array.isArray(message))return false;
  if(target.document.referrer)try{
    if(new URL(target.document.referrer).origin!==new URL(event.origin).origin)return false;
  }catch{return false;}
  const component=bridge.component;
  if(component.origin!==undefined&&event.origin!==component.origin)return false;
  if(message.action==='component-registered')return typeof message.sessionKey==='string'&&!!message.sessionKey&&
    typeof message.data?.uuid==='string'&&!!message.data.uuid&&message.sessionKey!==component.sessionKey;
  if(!component.sessionKey)return false;
  if(message.action==='themes')return false; // Both editors supply their own appearance.
  if(typeof message.original?.messageId!=='string')return false;
  if(message.original.sessionKey&&message.original.sessionKey!==component.sessionKey)return false;
  return bridge.sentMessages.some(record=>record.messageId===message.original.messageId);
}
/* Sync status carries a content snapshot too, but it is not a content change.
 * Preserve the editor's current content/clientData and accept only host dates.
 */
function imApplyNoteMetadata(note,update){
  if(!note||update?.isMetadataUpdate!==true||note.uuid!==update.uuid)return;
  const timestamp=value=>{try{return value==null?NaN:new Date(value).getTime()}catch{return NaN}};
  const incoming=timestamp(update.updated_at),current=timestamp(note.updated_at);
  if(Number.isFinite(incoming)&&(!Number.isFinite(current)||incoming>=current))note.updated_at=update.updated_at;
  if(note.created_at==null&&Number.isFinite(timestamp(update.created_at)))note.created_at=update.created_at;
}
/* Full host items can update native fields without changing editor text. These
 * helpers must never be used for isMetadataUpdate notifications, whose content
 * may be an older snapshot. Derived previews continue to follow local text. */
function imNoteNativeSignature(note){
  const {text,preview_plain,preview_html,...content}=note.content||{};
  return JSON.stringify({content,clientData:note.clientData},function(key,value){
    return value&&typeof value==='object'&&!Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(name=>[name,value[name]])):value;
  });
}
function imApplyNoteNative(note,host){
  if(!note||host?.isMetadataUpdate===true||note.uuid!==host.uuid)return;
  const local=note.content||{},content={...host.content,text:local.text};
  for(const name of ['preview_plain','preview_html'])if(Object.hasOwn(local,name))content[name]=local[name];
  note.content=content;
  if(host.clientData!==undefined)note.clientData=JSON.parse(JSON.stringify(host.clientData));
  else delete note.clientData;
  if(host.deleted)note.deleted=true;else delete note.deleted;
  imApplyNoteMetadata(note,{...host,isMetadataUpdate:true});
}
