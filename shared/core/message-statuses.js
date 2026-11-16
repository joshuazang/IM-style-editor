/* One status-clearing operation shared by both interfaces. */
const imClearableStatuses={copied:'Copied',exported:'Exported',imported:'Imported',edited:'Edited',reply:'Reply'};
function imClearStatuses(messages,flags,ids=null){
  const selected=new Set(flags);let changed=false;
  const result=messages.map(message=>{
    if(ids&&!ids.has(message.id))return message;
    let next=message;
    const copy=()=>{if(next===message)next={...message};changed=true;};
    for(const flag of selected){
      if(flag==='imported'){if(next.forwarding&&!next.importedStatusCleared){copy();next.importedStatusCleared=true;}}
      else if(Object.hasOwn(imClearableStatuses,flag)){
        const key=flag==='reply'?'replyTo':flag;if(Object.hasOwn(next,key)){copy();delete next[key];}
      }
    }return next;
  });return changed?result:messages;
}
function imStatusClearHelp(flags){
  const kept='Message text, formatting, timestamps, tags and pins are kept.';
  return kept+(new Set(flags).has('reply')?' Reply links and quoted previews are removed; original messages are kept.':' Reply links are kept.');
}
