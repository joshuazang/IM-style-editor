/* Local reply references and SVG controls. Quotes are text, never HTML. */
function imReplySnapshot(message,noteId){
  const {id,text,createdAt,...metadata}=JSON.parse(JSON.stringify(message));
  if(!metadata.reactions?.length)delete metadata.reactions;
  return {id,noteId,text,...(createdAt?{createdAt}:{}),...(Object.keys(metadata).length?{metadata}:{})};
}
function imReplyRecord(reply){return {...reply.metadata,id:reply.id,text:reply.text,reactions:reply.metadata?.reactions||[],...(reply.createdAt?{createdAt:reply.createdAt}:{})};}

function imReplyTarget(messages,reply,noteId){
  return messages.find(message=>{
    if(message.id===reply.id&&(reply.noteId===noteId||(message.text===reply.text&&message.createdAt===reply.createdAt)))return true;
    let source=message.forwarding;
    while(source){if(source.sourceMessageId===reply.id&&source.sourceNoteId===reply.noteId)return true;source=source.previous;}
    return false;
  });
}
function ImReplyIcon({kind}){
  const paths={show:'M5 20 2 22l1-5a10 10 0 1 1 4 4M7 12h11m-5-5 5 5-5 5',
    another:'M3 3h7v7H3ZM14 14h7v7h-7ZM14 4h3a3 3 0 0 1 3 3v3m-3-3 3 3 3-3M10 20H7a3 3 0 0 1-3-3v-3m-3 3 3-3 3 3',
    delete:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7'};
  return x.jsx('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',children:x.jsx('path',{d:paths[kind]})});
}
function ImReplyPreview({reply,cancel,show,exportReply}){
  const [open,setOpen]=dt.useState(false),root=dt.useRef(null);
  dt.useEffect(()=>{
    const outside=event=>{if(!root.current?.contains(event.target))setOpen(false)};
    const key=event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false)}};
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key,true)};
  },[open]);
  const menu=open&&x.jsx('div',{className:'reply-options',role:'menu','aria-label':'Reply options',children:[
    ['show','Show in Chat',show],['another','Reply in Another Chat',()=>exportReply(reply)],['delete','Do Not Reply',cancel]
  ].map(([kind,label,action])=>x.jsxs('button',{type:'button',role:'menuitem',onClick:()=>{setOpen(false);action()},children:[x.jsx(ImReplyIcon,{kind}),x.jsx('span',{children:label})]},kind))});
  return x.jsx(ImComposerPreview,{message:reply,label:'Reply to message',cancel,cancelLabel:'Cancel reply',action:()=>setOpen(!open),expanded:open,menu,previewRef:root});
}
function ImBubbleQuote({reply,show,selecting}){
  return x.jsxs('button',{type:'button',className:'bubble-reply-quote','aria-label':'Show quoted message in chat',tabIndex:selecting?-1:0,
    onClick:event=>{if(selecting)return;event.stopPropagation();show(reply)},children:[x.jsx('span',{children:reply.text||'Empty message'})]});
}
function imUseReplyHighlight(noteId){
  const [id,setId]=dt.useState(null),timer=dt.useRef(0);
  dt.useEffect(()=>{setId(null);return()=>clearTimeout(timer.current)},[noteId]);
  return {id,show:value=>{clearTimeout(timer.current);setId(value);timer.current=setTimeout(()=>setId(null),2200)}};
}
function imShowReply({reply,messages,noteId,scroller,composer,clearFilters,notice,highlight}){
  const message=imReplyTarget(messages,reply,noteId);
  if(!message){notice('The original message is not available in this note. The quoted text is preserved.');return;}
  const list=scroller.current;
  const locate=()=>{
    const bubble=[...list.querySelectorAll('[data-message-id]')].find(node=>node.dataset.messageId===message.id);
    if(!bubble)return;
    const shell=list.closest('.editor-shell'),controls=shell.querySelector('.message-tools');
    const bounds=list.getBoundingClientRect(),rect=bubble.getBoundingClientRect();
    const top=Math.max(bounds.top,controls?.getBoundingClientRect().bottom||bounds.top)+10;
    const bottom=Math.min(bounds.bottom,composer.current?.getBoundingClientRect().top||bounds.bottom)-10;
    if(rect.top<top||rect.bottom>bottom){
      const center=(top+bottom)/2;
      list.scrollTo({top:list.scrollTop+(rect.height>bottom-top?rect.top-top:(rect.top+rect.bottom)/2-center),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
    highlight(message.id);
  };
  // Remove filters only if they currently hide the destination.
  if(![...list.querySelectorAll('[data-message-id]')].some(node=>node.dataset.messageId===message.id)){clearFilters();requestAnimationFrame(()=>requestAnimationFrame(locate));}
  else locate();
}
