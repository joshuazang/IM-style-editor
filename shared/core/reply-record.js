/* Local reply references and SVG controls. Quotes are text, never HTML. */
function imReplySnapshot(message,noteId){
  // Keep the immediate quote and one level of its context. Deeper quoted
  // history is represented by IDs instead of repeatedly copying all its text.
  // Existing records are never rewritten by this constructor.
  const {id,text,createdAt,replyTo,...rest}=message;
  const metadata=JSON.parse(JSON.stringify(rest));
  if(replyTo&&typeof replyTo==='object'){
    const {metadata:priorMetadata,...quote}=replyTo;
    const prior={...priorMetadata};
    if(prior.replyTo&&typeof prior.replyTo==='object'){
      prior.replyToReference={id:prior.replyTo.id,noteId:prior.replyTo.noteId};
      delete prior.replyTo;
    }
    metadata.replyTo={...JSON.parse(JSON.stringify(quote)),...(Object.keys(prior).length?{metadata:JSON.parse(JSON.stringify(prior))}:{})};
  }
  if(!metadata.reactions?.length)delete metadata.reactions;
  return {id,noteId,text,...(createdAt?{createdAt}:{}),...(Object.keys(metadata).length?{metadata}:{})};
}
function imReplyRecord(reply){return {...reply.metadata,id:reply.id,text:reply.text,reactions:reply.metadata?.reactions||[],...(reply.createdAt?{createdAt:reply.createdAt}:{})};}

function imReplyTarget(messages,reply,noteId){
  if(!reply||typeof reply!=='object')return;
  return messages.find(message=>{
    if(message.id===reply.id&&(reply.noteId===noteId||(message.text===reply.text&&message.createdAt===reply.createdAt)))return true;
    const sources=[message,...(Array.isArray(message.mergeSources)?message.mergeSources:[])];
    for(const record of sources){
      if(!record||typeof record!=='object')continue;
      if(record.id===reply.id&&record.noteId===reply.noteId)return true;
      let source=record.forwarding;const seen=new Set();
      while(source&&typeof source==='object'&&!seen.has(source)){seen.add(source);if(source.sourceMessageId===reply.id&&source.sourceNoteId===reply.noteId)return true;source=source.previous;}
    }
    return false;
  });
}
