/* Local viewport behavior only: no network, persistence, or clipboard access. */
function imBottomThreshold(list){return Math.max(48,Math.min(120,list.clientHeight*.15));}
function imUseMessageViewport({ scroller, composer, noteId, messages,viewKey }) {
  const [awayFromBottom, setAwayFromBottom] = dt.useState(false);
  const [newCount,setNewCount]=dt.useState(0),unread=dt.useRef(new Set()),previous=dt.useRef(null);
  const measure = dt.useRef(() => {});
  dt.useLayoutEffect(() => {
    const list = scroller.current, input = composer.current;
    if (!list || !input) return;
    let frame = 0, animation = 0, gesture = null;
    let lastHeight = list.clientHeight, lastComposerHeight = Math.ceil(input.getBoundingClientRect().height);
    let lastTop = list.scrollTop;
    let opened=false;
    const near=()=>list.scrollHeight-list.clientHeight-list.scrollTop<=imBottomThreshold(list);
    let pinned = near();
    const clearUnread=()=>{if(unread.current.size){unread.current.clear();setNewCount(0)}};
    const controller={following:false,cancel:()=>{cancelAnimationFrame(animation);if(controller.following)list.imVirtual?.releaseFollow();controller.following=false;},follow:()=>{
      controller.cancel();controller.following=true;
      const start=list.scrollTop,started=performance.now();
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tick=now=>{
        const progress=reduced?1:Math.min(1,(now-started)/300),ease=1-Math.pow(1-progress,3);
        list.scrollTop=start+(Math.max(0,list.scrollHeight-list.clientHeight)-start)*ease;
        if(progress<1)animation=requestAnimationFrame(tick);
        else{controller.following=false;pinned=true;clearUnread();schedule();}
      };
      animation=requestAnimationFrame(tick);
    }};
    list.imScroll=controller;
    const update = () => {
      const height = Math.ceil(input.getBoundingClientRect().height);
      const shell = input.closest('.editor-shell');
      const header=shell?.querySelector('.message-tools');
      if(shell&&header)shell.style.setProperty('--toolbar-height',Math.max(62,Math.ceil(header.getBoundingClientRect().height)+6)+'px');
      if (shell && shell.style.getPropertyValue('--composer-height') !== `${height}px`) {
        shell.style.setProperty('--composer-height', `${height}px`);
      }
      if(!opened&&list.querySelector('.message-bubble')){list.scrollTop=list.scrollHeight;opened=true;pinned=true;}
      if (!controller.following && pinned && (Math.abs(list.scrollTop-lastTop)<=2 || near()) && (list.clientHeight !== lastHeight || height !== lastComposerHeight)) list.scrollTop = list.scrollHeight;
      lastHeight = list.clientHeight; lastComposerHeight = height; lastTop = list.scrollTop;
      pinned = near();
      if(pinned&&!controller.following)clearUnread();
      setAwayFromBottom(!pinned&&!controller.following);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    measure.current = schedule;
    const blurInput = () => {
      if (!window.matchMedia('(pointer:coarse) and (hover:none)').matches) return;
      const active = document.activeElement;
      if (active && input.contains(active) && active.matches('textarea,input,[contenteditable=true]')) {
        active.blur();
      }
    };
    const down = event => {
      controller.cancel();
      if (event.pointerType === 'touch' && event.isPrimary !== false) {
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, top: list.scrollTop };
      }
    };
    const move = event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
      if (dy > 10 && dy > dx) blurInput();
    };
    const end = () => { gesture = null; };
    const wheel=()=>controller.cancel();
    const key=event=>{if(['PageUp','PageDown','Home','End','ArrowUp','ArrowDown',' '].includes(event.key))controller.cancel();};
    const scroll = () => {
      // Programmatic scrolling and keyboard-induced viewport changes do not dismiss input.
      if (gesture && Math.abs(list.scrollTop - gesture.top) > 2) blurInput();
      schedule();
    };
    list.addEventListener('pointerdown', down, { passive: true });
    list.addEventListener('pointermove', move, { passive: true });
    list.addEventListener('scroll', scroll, { passive: true });
    list.addEventListener('wheel',wheel,{passive:true});
    list.addEventListener('keydown',key);
    window.addEventListener('pointerup', end, { passive: true });
    window.addEventListener('pointercancel', end, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(list);
    observer.observe(input);
    const header=input.closest('.editor-shell')?.querySelector('.message-tools');if(header)observer.observe(header);
    update();
    return () => {
      cancelAnimationFrame(frame);
      controller.cancel();delete list.imScroll;
      observer.disconnect();
      list.removeEventListener('pointerdown', down);
      list.removeEventListener('pointermove', move);
      list.removeEventListener('scroll', scroll);
      list.removeEventListener('wheel',wheel);
      list.removeEventListener('keydown',key);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      measure.current = () => {};
    };
  }, [noteId]);
  dt.useLayoutEffect(() => {
    const old=previous.current,list=scroller.current,ids=new Set(messages.map(message=>message.id));
    if(!old||old.noteId!==noteId||old.viewKey!==viewKey){unread.current.clear();setNewCount(0);}
    else if(list){
      const last=messages.findIndex(message=>message.id===old.last);
      if(last>=0&&!list.imScroll?.following&&list.scrollHeight-list.clientHeight-list.scrollTop>imBottomThreshold(list)){
        for(let index=last+1;index<messages.length;index++)if(!old.ids.has(messages[index].id))unread.current.add(messages[index].id);
      }
      for(const id of unread.current)if(!ids.has(id))unread.current.delete(id);
      setNewCount(unread.current.size);
    }
    previous.current={noteId,viewKey,ids,last:messages.at(-1)?.id};measure.current();
  }, [messages,noteId,viewKey]);
  const jumpToBottom = () => {
    const list = scroller.current;
    if (!list) return;
    list.imScroll?.follow();
  };
  return { awayFromBottom: awayFromBottom && messages.length > 0, newCount,jumpToBottom };
}

function ImJumpToBottom({ viewport }) {
  if (!viewport.awayFromBottom) return null;
  return x.jsx('button', { type: 'button', className: 'jump-to-bottom',
    'aria-label': viewport.newCount?`Scroll to bottom, ${viewport.newCount} new message${viewport.newCount===1?'':'s'}`:'Scroll to bottom', title: viewport.newCount?`${viewport.newCount} new message${viewport.newCount===1?'':'s'} below`:'Scroll to bottom', onClick: viewport.jumpToBottom,
    children: [x.jsx('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, children: x.jsx('path', { d: 'm6 9 6 6 6-6' }) }),viewport.newCount>0&&x.jsx('span',{className:'new-message-count','aria-hidden':true,children:viewport.newCount>99?'99+':viewport.newCount})] });
}

/* Editing and replying share one composer preview and cancel control. */
function ImComposerPreview({message,label,cancel,cancelLabel,action,expanded,menu,previewRef}) {
  const contents=[x.jsx('strong',{children:label}),x.jsx('div',{className:`composer-edit-original${action?' reply-quote-text':''}`,children:message.text||'Empty message'})];
  return x.jsxs('div',{ref:previewRef,className:`composer-edit-preview${action?' composer-reply-preview':''}`,onClick:action?event=>{if(event.target===event.currentTarget)action(event)}:undefined,children:[
    action?x.jsxs('button',{type:'button',className:'composer-edit-context reply-preview-trigger','aria-label':'Reply options','aria-haspopup':'menu','aria-expanded':expanded,onClick:action,children:contents})
      :x.jsxs('div',{className:'composer-edit-context',children:contents}),
    x.jsx('button',{type:'button',className:'cancel-edit','aria-label':cancelLabel,onClick:cancel,
      children:x.jsx('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round','aria-hidden':true,
        children:x.jsx('path',{d:'m6 6 12 12M18 6 6 18'})})}),menu
  ]});
}
function ImEditPreview({message,cancel}) {
  return message?x.jsx(ImComposerPreview,{message,label:'Edit message',cancel,cancelLabel:'Cancel editing'}):null;
}

/* SVG controls use local paths only. Batch tagging adds without removing existing tags. */
function ImSelectionIcon({kind}) {
  const paths = {
    tag: 'M4 12V6a3 3 0 0 1 3-3h9l6 7a2 2 0 0 1 0 3l-6 6H10M5 16v8M1 20h8',
    copy: 'M9 6V4a2 2 0 0 1 2-2h6l6 6v12a2 2 0 0 1-2 2h-2M17 2v6h6M5 9h9a2 2 0 0 1 2 2v13H3V11a2 2 0 0 1 2-2Z',
    export: 'M3 22c0-10 4-15 12-15V2l10 10-10 9v-6c-5 0-9 2-12 7Z',
    cancel: 'm6 6 14 14M20 6 6 20',
    delete: 'M4 7h18M10 7V4h6v3M6 7l1.5 17h11L20 7M11 11v9M15 11v9'
  };
  return x.jsx('svg',{width:26,height:26,viewBox:'0 0 28 28',fill:'none',stroke:'currentColor',strokeWidth:1.8,
    strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,children:[
      kind==='more'?x.jsx('g',{fill:'currentColor',stroke:'none',children:[6,14,22].map(cx=>x.jsx('circle',{cx,cy:14,r:1.8},cx))}):x.jsx('path',{d:paths[kind]}),kind==='tag'&&x.jsx('circle',{cx:17,cy:10,r:1.4,fill:'currentColor',stroke:'none'})]});
}
function ImSelectionToolbar({count,order,messages,selected,save,copy,exportMessages,remove,notice,more,merge}) {
  const [open,setOpen]=dt.useState(false);
  const [options,setOptions]=dt.useState(false);
  const panel=dt.useRef(null);
  dt.useEffect(()=>{if(options)panel.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus({preventScroll:true});},[options]);
  dt.useEffect(()=>{
    if(!open&&!options)return;
    const outside=e=>{if(!panel.current?.contains(e.target)){setOpen(false);setOptions(false)}};
    const key=e=>{if(e.key==='Escape'){setOpen(false);setOptions(false)}};
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key)};
  },[open,options]);
  const add=tag=>{
    const next=messages.map(message=>selected.has(message.id)&&!message.reactions.includes(tag)
      ? {...message,reactions:[...message.reactions,tag]}:message);
    if(next.some((message,i)=>message!==messages[i]))save(next);
    setOpen(false);
  };
  return x.jsxs('div',{className:'selection-toolbar',ref:panel,children:[
    x.jsxs('div',{className:'selection-tools selection-actions','aria-label':'Selected messages',children:[
      ...[['tag','Add tags to selected messages',()=>{setOptions(false);setOpen(!open)}],['copy','Copy',copy],
        ['export','Export',exportMessages],['more','More selection options',()=>{setOpen(false);setOptions(!options)}],['delete','Delete selected messages',remove]].map(([kind,label,action])=>
        x.jsx('button',{type:'button',className:`selection-action${kind==='delete'?' selection-delete':''}`,'aria-label':label,title:label,
          'aria-expanded':kind==='tag'?open:kind==='more'?options:undefined,'aria-haspopup':kind==='more'?'menu':undefined,onClick:action,children:x.jsx(ImSelectionIcon,{kind})},kind))
    ]}),
    options&&x.jsxs('div',{className:'selection-more-menu',role:'menu','aria-label':'More selection options',onKeyDown:event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOptions(false);panel.current?.querySelector('[aria-label="More selection options"]')?.focus({preventScroll:true});}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();event.stopPropagation();const items=[...event.currentTarget.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus();
      }
    },children:[
      x.jsx('button',{type:'button',role:'menuitem',disabled:count<2,onClick:()=>{setOptions(false);merge()},children:'Merge selected'}),
      x.jsx('button',{type:'button',role:'menuitem',onClick:()=>{setOptions(false);more()},children:'Clear message statuses…'})]}),
    open&&x.jsxs('section',{className:'selection-tag-panel','aria-label':'Batch add emoji tag',children:[
      x.jsx('p',{children:`Add a tag to ${count} selected message${count===1?'':'s'}`}),
      x.jsx('div',{className:'reaction-filter',children:order.map(tag=>x.jsx('button',{type:'button',className:'chip',
        'aria-label':`Add ${tag} to selected messages`,onClick:()=>add(tag),children:tag},tag))}),
      !order.length&&x.jsx('p',{children:'No tags available. Add a category in Arrange tags after canceling selection.'})
    ]}),
    notice&&x.jsx('div',{className:'selection-copy-notice',role:'status',children:notice})
  ]});
}
function ImSelectionStatus({count,total,cancel,selectAll}) {
  return x.jsxs('div',{className:'selection-status',children:[
    x.jsx('button',{type:'button',className:'selection-all','aria-label':'Select all visible messages',title:'Select all visible messages',onClick:selectAll,
      children:x.jsxs('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,children:[x.jsx('rect',{x:3,y:3,width:18,height:18,rx:5}),x.jsx('path',{d:'m7 12 3 3 7-7M7 18h10'})]})}),
    x.jsx('span',{role:'status',children:`${count} / ${total} selected`}),
    x.jsx('button',{type:'button',className:'selection-cancel','aria-label':'Cancel',title:'Cancel selection',onClick:cancel,children:x.jsx(ImSelectionIcon,{kind:'cancel'})})
  ]});
}

/* Keep iOS control holds out of native text selection; editable text stays native. */
function imUseControlTouchProtection() {
  dt.useEffect(()=>{
    const preventControlCallout=event=>{
      if (!(event.pointerType==='touch'||window.matchMedia('(pointer:coarse)').matches)) return;
      if(event.target.closest?.('button,[role="button"],.selection-status'))event.preventDefault();
    };
    document.addEventListener('contextmenu',preventControlCallout,true);
    return()=>document.removeEventListener('contextmenu',preventControlCallout,true);
  },[]);
}

/* Reserve the whole composer when selection temporarily hides an edit/reply preview. */
function imCaptureSelectionHeight(composer){
  if(!composer)return;
  const style=getComputedStyle(composer);
  const height=composer.getBoundingClientRect().height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  composer.style.setProperty('--selection-row-height',`${Math.max(46,height)}px`);
}

/* Outlined menu icons share a fixed column; labels remain the accessible names. */
function ImContextLabel({kind,label}) {
  const shared=['reply','copy','delete'].includes(kind);
  const paths={edit:'m15 4 5 5M4 16 16 4a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L8 20l-5 1 1-5Z',select:'m7 12 4 4 6-9'};
  return x.jsxs(x.Fragment,{children:[
    shared?x.jsx('span',{className:`context-action-icon${kind==='reply'?' context-reply-icon':''}`,'aria-hidden':true,
      children:x.jsx(ImSelectionIcon,{kind:kind==='reply'?'export':kind})})
      :x.jsxs('svg',{className:'context-action-icon',width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',children:[
        kind==='select'&&x.jsx('circle',{cx:12,cy:12,r:10}),x.jsx('path',{d:paths[kind]})]}),
    x.jsx('span',{children:label})
  ]});
}
