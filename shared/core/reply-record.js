/* Local reply references and SVG controls. Quotes are text, never HTML. */
function imReplySnapshot(message,noteId){
  // Keep the immediate quote and one level of its context.
  // Existing records are never rewritten by this constructor.
  const {id,text,createdAt,replyTo,...rest}=imFormat.normalizeMessage(message);
  const metadata=JSON.parse(JSON.stringify(rest));
  if(replyTo&&typeof replyTo==='object'){
    const {metadata:priorMetadata,...quote}=replyTo;
    const {replyTo:earlierQuote,...prior}=priorMetadata??{};
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
    if(message.id===reply.id&&message.noteId===reply.noteId)return true;
    return imFormat.sourceRefs(message).some(([sourceNoteId,id])=>sourceNoteId===reply.noteId&&id===reply.id);
  });
}
