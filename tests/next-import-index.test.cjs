const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const clone=value=>JSON.parse(JSON.stringify(value)),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const stable=value=>JSON.stringify(value,function(key,item){
  if(!object(item))return item;
  if(typeof item.id==='string'&&typeof item.text==='string'){item={...item};delete item.copied;delete item.exported;delete item.importedStatusCleared;}
  return Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]]));
});
// The original full scan is the behavioral reference, including ID collisions
// and recursively forwarded metadata. Only its search strategy is being replaced.
function reference(existing,payload,newId){
  const messages=clone(existing),added=[],used=new Set(messages.map(message=>message.id));let skipped=0;
  for(const source of payload.messages){
    if(messages.some(candidate=>{
      if(candidate.id===source.id&&stable(candidate)===stable(source))return true;
      const forwarded=candidate.forwarding;
      if(!object(forwarded)||forwarded.sourceMessageId!==source.id||forwarded.sourceNoteId!==payload.sourceNoteId)return false;
      const original={...candidate,id:forwarded.sourceMessageId};
      if('previous'in forwarded)original.forwarding=forwarded.previous;else delete original.forwarding;
      return stable(original)===stable(source);
    })){skipped++;continue;}
    const message=clone(source);delete message.exported;delete message.importedStatusCleared;
    if(used.has(message.id)){do{message.id=newId();}while(used.has(message.id));}
    message.forwarding={sourceMessageId:source.id,sourceNoteId:payload.sourceNoteId,forwardedAt:'fixed',...('forwarding'in source?{previous:clone(source.forwarding)}:{})};
    used.add(message.id);messages.push(message);added.push(message);
  }
  return {messages,added,skipped};
}
let sequence=0,checks=0;
const source=fs.readFileSync('shared/core/message-transfer.js','utf8');
const context={imFormat:{newId:()=>`generated-${sequence++}`},count:()=>checks++};
const transfer=vm.runInNewContext(source.replace('const forwarded = candidate.forwarding;','count();const forwarded = candidate.forwarding;')+';imTransfer',context);
let seed=4567;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let iteration=0;iteration<150;iteration++){
  const pool=Array.from({length:40},(_,i)=>({id:`message-${i}`,text:`Text ${i} 🙂\n`,reactions:i%3?[]:['📍'],custom:{order:i},...(i%2?{exported:true,copied:true}:{}),...(i%7?{}:{forwarding:{sourceNoteId:'earlier',sourceMessageId:`older-${i}`,previous:{keep:true}}})}));
  const existing=pool.filter(()=>random(2)).map(message=>random(3)?message:{...message,text:message.text+'changed'});
  const payload={ok:true,sourceNoteId:iteration%2?'source':'other',messages:pool.filter(()=>random(2))};
  for(const message of pool.filter(()=>random(3)===0))existing.push({...message,id:`forwarded-${message.id}`,forwarding:{sourceMessageId:message.id,sourceNoteId:'source',forwardedAt:'old',...('forwarding'in message?{previous:message.forwarding}:{})},importedStatusCleared:true});
  const before=JSON.stringify({existing,payload});
  sequence=0;const expected=reference(existing,payload,()=>`generated-${sequence++}`);
  sequence=0;const result=transfer.merge(existing,payload,'fixed');
  assert.deepEqual(clone(result),expected);assert.equal(JSON.stringify({existing,payload}),before);
  assert.equal(transfer.merge(result.messages,payload,'fixed').added.length,0);
}
checks=0;
const large=Array.from({length:5000},(_,i)=>({id:`old-${i}`,text:`Message ${i}`,reactions:[]}));
const incoming={ok:true,sourceNoteId:'source',messages:Array.from({length:1000},(_,i)=>({id:`new-${i}`,text:`New ${i}`,reactions:[]}))};
assert.equal(transfer.merge(large,incoming,'fixed').added.length,1000);assert.equal(checks,0);
console.log('PASS: indexed imports match the original full scan in 150 varied cases; 1,000 new IDs among 5,000 existing bubbles require zero unrelated candidate comparisons');
