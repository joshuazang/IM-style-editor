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
