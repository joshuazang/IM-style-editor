/* Local viewport behavior only: no network, persistence, or clipboard access. */
function imUseMessageViewport({ scroller, composer, noteId, messages }) {
  const [awayFromBottom, setAwayFromBottom] = dt.useState(false);
  const measure = dt.useRef(() => {});
  dt.useLayoutEffect(() => {
    const list = scroller.current, input = composer.current;
    if (!list || !input) return;
    let frame = 0, gesture = null;
    let lastHeight = list.clientHeight, lastComposerHeight = Math.ceil(input.getBoundingClientRect().height);
    let lastTop = list.scrollTop;
    let opened=false;
    let pinned = list.scrollHeight - list.clientHeight - list.scrollTop <= 48;
    const update = () => {
      const height = Math.ceil(input.getBoundingClientRect().height);
      const shell = input.closest('.editor-shell');
      if (shell && shell.style.getPropertyValue('--composer-height') !== `${height}px`) {
        shell.style.setProperty('--composer-height', `${height}px`);
      }
      if(!opened&&list.querySelector('.message-bubble')){list.scrollTop=list.scrollHeight;opened=true;pinned=true;}
      if (pinned && (Math.abs(list.scrollTop-lastTop)<=2 || list.scrollHeight-list.clientHeight-list.scrollTop<=48) && (list.clientHeight !== lastHeight || height !== lastComposerHeight)) list.scrollTop = list.scrollHeight;
      lastHeight = list.clientHeight; lastComposerHeight = height; lastTop = list.scrollTop;
      pinned = list.scrollHeight - list.clientHeight - list.scrollTop <= 48;
      setAwayFromBottom(!pinned);
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
    const scroll = () => {
      // Programmatic scrolling and keyboard-induced viewport changes do not dismiss input.
      if (gesture && Math.abs(list.scrollTop - gesture.top) > 2) blurInput();
      schedule();
    };
    list.addEventListener('pointerdown', down, { passive: true });
    list.addEventListener('pointermove', move, { passive: true });
    list.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pointerup', end, { passive: true });
    window.addEventListener('pointercancel', end, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(list);
    observer.observe(input);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      list.removeEventListener('pointerdown', down);
      list.removeEventListener('pointermove', move);
      list.removeEventListener('scroll', scroll);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      measure.current = () => {};
    };
  }, [noteId]);
  dt.useLayoutEffect(() => { measure.current(); }, [messages]);
  const jumpToBottom = () => {
    const list = scroller.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return { awayFromBottom: awayFromBottom && messages.length > 0, jumpToBottom };
}

function ImJumpToBottom({ viewport }) {
  if (!viewport.awayFromBottom) return null;
  return x.jsx('button', { type: 'button', className: 'jump-to-bottom',
    'aria-label': 'Scroll to bottom', title: 'Scroll to bottom', onClick: viewport.jumpToBottom,
    children: x.jsx('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, children: x.jsx('path', { d: 'm6 9 6 6 6-6' }) }) });
}

/* Editing and replying share one composer preview and cancel control. */
function ImComposerPreview({message,label,cancel,cancelLabel,action,expanded,menu,previewRef}) {
  const contents=[x.jsx('strong',{children:label}),x.jsx('div',{className:`composer-edit-original${action?' reply-quote-text':''}`,children:message.text||'Empty message'})];
  return x.jsxs('div',{ref:previewRef,className:`composer-edit-preview${action?' composer-reply-preview':''}`,onClick:action?event=>{if(event.target===event.currentTarget)action()}:undefined,children:[
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
      x.jsx('path',{d:paths[kind]}),kind==='tag'&&x.jsx('circle',{cx:17,cy:10,r:1.4,fill:'currentColor',stroke:'none'})]});
}
function ImSelectionToolbar({count,order,messages,selected,save,copy,exportMessages,remove,notice}) {
  const [open,setOpen]=dt.useState(false);
  const panel=dt.useRef(null);
  dt.useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!panel.current?.contains(e.target))setOpen(false)};
    const key=e=>{if(e.key==='Escape')setOpen(false)};
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key)};
  },[open]);
  const add=tag=>{
    const next=messages.map(message=>selected.has(message.id)&&!message.reactions.includes(tag)
      ? {...message,reactions:[...message.reactions,tag]}:message);
    if(next.some((message,i)=>message!==messages[i]))save(next);
    setOpen(false);
  };
  return x.jsxs('div',{className:'selection-toolbar',ref:panel,children:[
    x.jsxs('div',{className:'selection-tools selection-actions','aria-label':'Selected messages',children:[
      ...[['tag','Add tags to selected messages',()=>setOpen(!open)],['copy','Copy',copy],
        ['export','Export',exportMessages],['delete','Delete selected messages',remove]].map(([kind,label,action])=>
        x.jsx('button',{type:'button',className:`selection-action${kind==='delete'?' selection-delete':''}`,'aria-label':label,title:label,
          'aria-expanded':kind==='tag'?open:undefined,onClick:action,children:x.jsx(ImSelectionIcon,{kind})},kind))
    ]}),
    open&&x.jsxs('section',{className:'selection-tag-panel','aria-label':'Batch add emoji tag',children:[
      x.jsx('p',{children:`Add a tag to ${count} selected message${count===1?'':'s'}`}),
      x.jsx('div',{className:'reaction-filter',children:order.map(tag=>x.jsx('button',{type:'button',className:'chip',
        'aria-label':`Add ${tag} to selected messages`,onClick:()=>add(tag),children:tag},tag))}),
      !order.length&&x.jsx('p',{children:'No tags available. Add a category in Arrange tags after canceling selection.'})
    ]}),
    notice&&x.jsx('div',{className:'selection-copy-notice',role:'status',children:notice})
  ]});
}
function ImSelectionStatus({count,cancel}) {
  return x.jsxs('div',{className:'selection-status',children:[
    x.jsx('button',{type:'button',className:'selection-cancel','aria-label':'Cancel',title:'Cancel selection',
      onClick:cancel,children:x.jsx(ImSelectionIcon,{kind:'cancel'})}),
    x.jsx('span',{role:'status',children:`${count} message${count===1?'':'s'} selected`})
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
  const paths={
    reply:'M10 4 2 11l8 7v-5c6 0 10 3 12 7-1-9-5-13-12-13V4Z',
    edit:'m15 4 5 5M4 16 16 4a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L8 20l-5 1 1-5Z',
    copy:'M7 3H5a2 2 0 0 0-2 2v13M9 6h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
    select:'m7 12 4 4 6-9',
    delete:'M4 6h16M9 3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7'
  };
  return x.jsxs(x.Fragment,{children:[
    x.jsxs('svg',{className:'context-action-icon',width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',children:[
      kind==='select'&&x.jsx('circle',{cx:12,cy:12,r:10}),x.jsx('path',{d:paths[kind]})]}),
    x.jsx('span',{children:label})
  ]});
}
