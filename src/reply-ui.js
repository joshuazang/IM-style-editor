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
function imPinIds(settings){return [...new Set((Array.isArray(settings.pinnedMessageIds)?settings.pinnedMessageIds:settings.pinnedMessageId?[settings.pinnedMessageId]:[]).filter(id=>typeof id==='string'))]}
function imPinSettings(settings,messages){const next={...settings};const ids=imPinIds(settings).filter(id=>!messages||messages.some(message=>message.id===id));delete next.pinnedMessageId;if(ids.length)next.pinnedMessageIds=ids;else delete next.pinnedMessageIds;return next}
/* One upright pushpin path, its slashed counterpart, and the matching list control. */
function ImPinIcon({list=false,unpin=false,filled=false}){
 const pin='M6 3h14c1 0 1.4 1 .7 1.7L17 8v4l3.7 3.3c.7.7.3 1.7-.7 1.7H6c-1 0-1.4-1-.7-1.7L9 12V8L5.3 4.7C4.6 4 5 3 6 3ZM13 17v6';
 return x.jsxs('svg',{width:24,height:24,viewBox:'0 0 26 26',fill:filled?'currentColor':'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,children:[
  list&&x.jsx('path',{d:'M2 9h6M2 14h6M2 19h8'}),
  x.jsx('g',{transform:list?'translate(6 1) scale(.9)':undefined,children:x.jsx('path',{d:pin})}),
  unpin&&x.jsx('path',{d:'M4 3 23 22',strokeWidth:2.1})]})
}
function imFilterOrder(tags,position){const order=tags.filter(tag=>tag!==imUntagged);const index=Number.isInteger(position)?Math.max(0,Math.min(position,order.length)):order.length;return [...order.slice(0,index),imUntagged,...order.slice(index)]}

function ImPinnedPreview({messages,show,openList,unpin}){
 const [index,setIndex]=dt.useState(0);const current=Math.min(index,messages.length-1),message=messages[current];
 dt.useEffect(()=>{setIndex(i=>Math.max(0,Math.min(i,messages.length-1)))},[messages.length]);
 if(!message)return null;
 const cycle=()=>{const next=(current+1)%messages.length;setIndex(next);show(messages[next])};
 return x.jsxs('div',{className:'pinned-preview pinned-carousel',onClick:event=>{if(event.target===event.currentTarget)cycle()},children:[
  x.jsxs('button',{type:'button','aria-label':'Show pinned message',onClick:cycle,children:[
   x.jsx('span',{className:'pin-segments','aria-hidden':true,children:messages.map((item,i)=>x.jsx('i',{className:i===current?'active':'',style:{opacity:i===current?1:.25}},item.id))}),
   x.jsxs('span',{className:'pin-summary',children:[x.jsx('span',{children:message.text})]})]}),
  x.jsx('button',{type:'button',className:'pin-list-button','aria-label':messages.length===1?'Unpin message':`Show all ${messages.length} pinned messages`,onClick:messages.length===1?()=>{if(window.confirm('Unpin this message? The message will stay in this note.'))unpin(message)}:openList,children:messages.length===1?x.jsx(ImSelectionIcon,{kind:'cancel'}):x.jsx(ImPinIcon,{list:true})})]})
}
function ImPinnedHeader({count,back,unpinAll}){
 const [open,setOpen]=dt.useState(false),root=dt.useRef(null);
 dt.useEffect(()=>{if(!open)return;const close=event=>{if(!root.current?.contains(event.target))setOpen(false)};window.addEventListener('pointerdown',close);return()=>window.removeEventListener('pointerdown',close)},[open]);
 return x.jsxs('div',{ref:root,className:'pinned-list-header',children:[x.jsx('button',{type:'button','aria-label':'Back to all messages',onClick:back,children:x.jsx('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,'aria-hidden':true,children:x.jsx('path',{d:'m6 6 12 12M18 6 6 18'})})}),
 x.jsx('strong',{children:`${count} Pinned Message${count===1?'':'s'}`}),
 x.jsx('button',{type:'button','aria-label':'Pinned message options','aria-expanded':open,onClick:()=>setOpen(!open),children:x.jsx('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true,children:[5,12,19].map(cx=>x.jsx('circle',{cx,cy:12,r:1.5},cx))})}),
 open&&x.jsx('div',{className:'pin-options',children:x.jsx('button',{type:'button',onClick:()=>{setOpen(false);unpinAll()},children:[x.jsx(ImPinIcon,{unpin:true}),x.jsx('span',{children:'Unpin all messages'})]})})]})
}
function ImUnpinAll({unpinAll}){return x.jsxs('button',{type:'button',className:'unpin-all','aria-label':'Unpin all messages',onClick:unpinAll,children:[x.jsx(ImPinIcon,{unpin:true}),'Unpin All Messages']})}

/* Two native sibling buttons keep cancel and change-filter actions independent. */
function ImFilterIndicator({tag,open,change,clear}){
 const icon=tag===imUntagged?x.jsx(ImUntaggedIcon,{}):tag?x.jsx('span',{className:'filter-emoji',children:tag}):x.jsxs('svg',{width:19,height:19,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round','aria-hidden':true,children:[x.jsx('circle',{cx:10,cy:10,r:7}),x.jsx('path',{d:'m15 15 6 6'})]});
 return x.jsxs('div',{className:'filter-status',role:'group','aria-label':'Message filter',children:[
  x.jsx('button',{type:'button',className:'filter-change','aria-label':'Change filters','aria-expanded':open,'aria-controls':'search-tags-panel',title:'Change filters',onClick:change,children:x.jsxs('span',{className:'filter-icon-wrap',children:[icon,x.jsx('span',{className:'filter-check','aria-hidden':true,children:x.jsx('svg',{width:11,height:11,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor',strokeWidth:2.3,strokeLinecap:'round',strokeLinejoin:'round',children:x.jsx('path',{d:'m3 8 3 3 7-7'})})})]})}),
  x.jsx('button',{type:'button',className:'filter-clear','aria-label':'Clear all filters',title:'Clear filtering',onClick:event=>{event.stopPropagation();clear()},children:x.jsx(ImSelectionIcon,{kind:'cancel'})})
 ]});
}
