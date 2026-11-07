/* Compatibility copy path for hosts that deny the asynchronous clipboard API. */
function imLegacyCopy(text) {
  const active=document.activeElement;
  const start=active?.selectionStart,end=active?.selectionEnd;
  const ranges=window.getSelection();
  const saved=ranges?[...Array(ranges.rangeCount)].map((_,i)=>ranges.getRangeAt(i).cloneRange()):[];
  const field=imPrivateTextField(document.createElement('textarea'));field.value=text;field.readOnly=true;
  field.style.cssText='position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px';
  document.body.append(field);field.select();field.setSelectionRange(0,text.length);
  let copied=false;
  try{copied=document.execCommand('copy')}catch{}finally{
    field.remove();
    if(active?.isConnected){active.focus({preventScroll:true});if(typeof start==='number'&&active.setSelectionRange)active.setSelectionRange(start,end)}
    if(ranges){ranges.removeAllRanges();for(const range of saved)if(range.commonAncestorContainer.isConnected)ranges.addRange(range)}
  }
  return copied;
}
async function imWriteClipboard(text) {
  try{await navigator.clipboard.writeText(text);return true}catch{return imLegacyCopy(text)}
}
/* Run synchronously from the explicit confirmation click. The official sandbox
 * can deny navigator.clipboard even when gesture-driven compatibility copy works.
 * Override the copy event so the clipboard receives empty text, not a placeholder.
 */
function imLegacyClearClipboard() {
  let handled=false;
  const clear=event=>{
    event.preventDefault();
    try{
      if(!event.clipboardData)return;
      event.clipboardData.clearData();event.clipboardData.setData('text/plain','');handled=true;
    }catch{}
  };
  document.addEventListener('copy',clear,true);
  try{return imLegacyCopy(' ')&&handled}
  catch{return false}
  finally{document.removeEventListener('copy',clear,true)}
}
async function imClearClipboard() {
  if(imLegacyClearClipboard())return true;
  try{await navigator.clipboard.writeText('');return true}catch{return false}
}
