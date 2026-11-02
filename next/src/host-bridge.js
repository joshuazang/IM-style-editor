/* The SDK needs reply callbacks, not historical copies of outgoing note content.
 * Origin/session checks and the actual message transport remain in the SDK.
 */
function imReleaseHostReply(bridge,callback){
  if(bridge.sentMessages)bridge.sentMessages=bridge.sentMessages.filter(record=>record.sourceCallback!==callback);
}
function imTrackHostReply(bridge,message,callback){
  if(typeof callback!=='function')return;
  const persistent=message.action==='stream-context-item'||message.action==='stream-items';
  const record={messageId:message.messageId,sourceCallback:callback,callback:reply=>{
    if(!persistent)bridge.sentMessages=bridge.sentMessages.filter(entry=>entry!==record);
    callback(reply);
  }};
  bridge.sentMessages.push(record);
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
