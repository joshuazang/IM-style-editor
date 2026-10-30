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
  const [open,setOpen]=dt.useState(false),[anchorX,setAnchorX]=dt.useState(0),[left,setLeft]=dt.useState(8),root=dt.useRef(null),menuRef=dt.useRef(null);
  dt.useLayoutEffect(()=>{
    if(!open)return;
    const place=()=>{
      const panel=menuRef.current,container=root.current;if(!panel||!container)return;
      const viewport=window.visualViewport,width=panel.getBoundingClientRect().width;
      const minimum=(viewport?.offsetLeft||0)+8,maximum=minimum+(viewport?.width||window.innerWidth)-16-width;
      const next=Math.max(minimum,Math.min(anchorX-width/2,maximum))-container.getBoundingClientRect().left;
      setLeft(current=>Math.abs(current-next)>.5?next:current);
    };
    place();window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);
    return()=>{window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place)};
  },[open,anchorX]);
  dt.useEffect(()=>{
    const outside=event=>{if(!root.current?.contains(event.target))setOpen(false)};
    const key=event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false)}};
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key,true)};
  },[open]);
  const menu=open&&x.jsx('div',{ref:menuRef,style:{left},className:'reply-options',role:'menu','aria-label':'Reply options',children:[
    ['show','Show in Chat',show],['another','Reply in Another Chat',()=>exportReply(reply)],['delete','Do Not Reply',cancel]
  ].map(([kind,label,action])=>x.jsxs('button',{type:'button',role:'menuitem',onClick:()=>{setOpen(false);action()},children:[x.jsx(ImReplyIcon,{kind}),x.jsx('span',{children:label})]},kind))});
  return x.jsx(ImComposerPreview,{message:reply,label:'Reply to message',cancel,cancelLabel:'Cancel reply',action:event=>{const rect=event.currentTarget.getBoundingClientRect();setAnchorX(event.detail?event.clientX:(rect.left+rect.right)/2);setOpen(!open)},expanded:open,menu,previewRef:root});
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

/* Untagged is a filter, never a message reaction. */
const imUntagged='__im_untagged__';
function ImUntaggedIcon(){return x.jsxs('svg',{className:'untagged-icon',width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,children:[x.jsx('path',{d:'M4 9V5a2 2 0 0 1 2-2h8l7 7a2 2 0 0 1 0 3l-7 7a2 2 0 0 1-3 0l-4-4M3 3l18 18'}),x.jsx('circle',{cx:10,cy:7,r:1})]})}
function ImPinnedPreview({message,show,unpin}){return x.jsxs('div',{className:'pinned-preview',children:[
 x.jsxs('button',{type:'button','aria-label':'Show pinned message',onClick:show,children:[x.jsx('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true,children:x.jsx('path',{d:'m15 3 6 6-4 1-3 5-3-2-6 8m6-8-3-3 5-3 2-4Z'})}),x.jsxs('span',{children:[x.jsx('strong',{children:'Pinned'}),x.jsx('span',{children:message.text})]})]}),
 x.jsx('button',{type:'button','aria-label':'Unpin message',onClick:unpin,children:x.jsx(ImSelectionIcon,{kind:'cancel'})})]})}
