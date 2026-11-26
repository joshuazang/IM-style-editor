/* Shared message metadata actions used by both interfaces. */
function imSelectedPinState(messages,settings,ids){
  const targets=messages.filter(message=>ids.has(message.id)).map(message=>message.id);
  const pinned=new Set(Array.isArray(settings.pinnedMessageIds)?settings.pinnedMessageIds:[]);
  return {targets,pinned,count:targets.length,allPinned:targets.length>0&&targets.every(id=>pinned.has(id))};
}
function imToggleSelectedPins(messages,settings,ids){
  const state=imSelectedPinState(messages,settings,ids);if(!state.count)return settings;
  for(const id of state.targets)state.allPinned?state.pinned.delete(id):state.pinned.add(id);
  return {...settings,pinnedMessageIds:[...state.pinned]};
}
const imClearableStatuses={copied:'Copied',exported:'Exported',imported:'Imported',edited:'Edited',reply:'Reply'};
function imClearStatuses(messages,flags,ids=null){
  const selected=new Set(flags);let changed=false;
  const result=messages.map(message=>{
    if(ids&&!ids.has(message.id))return message;
    let next=message;
    const copy=()=>{if(next===message)next={...message};changed=true;};
    for(const flag of selected){
      if(flag==='imported'){if(imFormat.isImported(next)){
        next={...imFormat.normalizeMessage(next)};changed=true;delete next.imported;
      }}
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
