/* Per-note UI state on this device. Never store message text or change the note. */
const imSelectionFallback=new Map();
const imSelectionKey=uuid=>'im-style-editor.next.selection.v1:'+uuid;
function imRememberSelection(uuid,ids,composer){
  const height=parseFloat(composer?.style.getPropertyValue('--selection-row-height'));
  const value={ids:[...ids],...(Number.isFinite(height)&&height>=46?{height}:{})};
  if(ids.size)imSelectionFallback.set(uuid,value);else imSelectionFallback.delete(uuid);
  try{
    if(ids.size)localStorage.setItem(imSelectionKey(uuid),JSON.stringify(value));
    else localStorage.removeItem(imSelectionKey(uuid));
  }catch{/* In-memory switching still works when the host denies local storage. */}
}
function imRestoreSelection(uuid,messages,composer){
  let value=imSelectionFallback.get(uuid);
  try{const saved=localStorage.getItem(imSelectionKey(uuid));if(saved)value=JSON.parse(saved);}catch{}
  const valid=new Set(messages.map(message=>message.id));
  const ids=new Set((Array.isArray(value?.ids)?value.ids:[]).filter(id=>valid.has(id)));
  if(ids.size&&Number.isFinite(value?.height)&&value.height>=46)composer?.style.setProperty('--selection-row-height',value.height+'px');
  return ids;
}
