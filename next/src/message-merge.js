/* Merge immutable records in note order. Text is stored once; source metadata keeps reply destinations. */
function imMergeSelected(messages,settings,selected,noteId){
  const sources=messages.filter(message=>selected.has(message.id));
  if(sources.length<2)throw new Error('Select at least two messages to merge.');
  const first=sources[0],merged={...first,text:sources.map(message=>message.text).join('\n\n'),
    reactions:[...new Set(sources.flatMap(message=>message.reactions))],edited:true};
  delete merged.copied;delete merged.exported;delete merged.editedAt;
  const origins=new Map();
  for(const message of sources){
    const {text,reactions,copied,exported,edited,editedAt,mergeSources,...metadata}=message;
    for(const source of [{...metadata,noteId},...(Array.isArray(mergeSources)?mergeSources:[])]){
      const key=source&&typeof source==='object'?JSON.stringify([source.noteId,source.id]):JSON.stringify(source);
      if(!origins.has(key))origins.set(key,source);
    }
  }
  merged.mergeSources=[...origins.values()];
  const result=messages.flatMap(message=>message.id===first.id?[merged]:selected.has(message.id)?[]:[message]);
  const pins=imPinIds(settings).map(id=>selected.has(id)?first.id:id);
  return {messages:result,settings:imPinSettings({...settings,pinnedMessageIds:[...new Set(pins)]},result),id:first.id};
}

function imMessagesByDay(messages){
  const days=new Map();
  for(const message of messages){const day=Ed(message.createdAt);if(!days.has(day))days.set(day,[]);days.get(day).push(message.id);}
  return days;
}
function ImDayDivider({label,ids,selected,select,continuation}){
  const checked=ids.every(id=>selected.has(id));
  return x.jsx('div',{className:`day-divider${continuation?' day-break':''}`,children:
    x.jsxs('button',{type:'button',className:'day-select','aria-label':`${checked?'Unselect':'Select'} all messages from ${label}`,
      'aria-pressed':checked,title:`${checked?'Unselect':'Select'} this day`,onClick:select,children:[
        x.jsx('span',{children:label}),x.jsxs('svg',{width:16,height:16,viewBox:'0 0 20 20',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true,children:[
          x.jsx('circle',{cx:10,cy:10,r:8}),checked?x.jsx('path',{d:'m6 10 3 3 5-6'}):x.jsx('path',{d:'M6 10h8M10 6v8'})]})]})});
}

function imUseMessageMerge({noteRef,selected,save,select,notify}){
  const [dialog,setDialog]=dt.useState(null),uuid=noteRef.current?.uuid;
  dt.useEffect(()=>setDialog(null),[uuid]);
  return {dialog,close:()=>setDialog(null),open:()=>{
    const sources=imFormat.readMessages(noteRef.current).filter(message=>selected.has(message.id));
    if(sources.length>1)setDialog({uuid,sources,text:sources.map(message=>message.text).join('\n\n')});
  },apply:async()=>{
    if(!dialog||noteRef.current?.uuid!==dialog.uuid)throw new Error('The active note changed.');
    const note=noteRef.current,messages=imFormat.readMessages(note),ids=new Set(dialog.sources.map(message=>message.id));
    const current=messages.filter(message=>ids.has(message.id));
    if(JSON.stringify(current)!==JSON.stringify(dialog.sources))throw new Error('These messages changed. Close this preview and select them again.');
    const result=imMergeSelected(messages,imFormat.readSettings(note),ids,dialog.uuid);
    const pending=save(result.messages,result.settings);
    if(!pending)throw new Error('Saving is paused. Your original messages have been kept.');
    // Once the combined record exists, retain that selection even if the host rejects the save.
    // The normal save warning and Retry save keep the exact combined text available.
    select(new Set([result.id]));
    try{await pending;}catch{throw new Error('Saving was not confirmed. The combined text is still here. Keep this note open and use Retry save.');}
    if(noteRef.current?.uuid===dialog.uuid){setDialog(null);notify(`${dialog.sources.length} messages merged.`);}
  }};
}
function ImMergeDialog({controller}){
  const [busy,setBusy]=dt.useState(false),[error,setError]=dt.useState(''),root=dt.useRef(null);
  dt.useEffect(()=>{const previous=document.activeElement;root.current?.querySelector('button')?.focus();return()=>previous?.isConnected&&previous.focus({preventScroll:true});},[]);
  return x.jsx('div',{className:'transfer-backdrop',onPointerDown:event=>{if(event.target===event.currentTarget&&!busy)controller.close();},children:
    x.jsxs('section',{ref:root,className:'transfer-dialog merge-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'merge-title',onKeyDown:event=>{
      event.stopPropagation();if(event.key==='Escape'&&!busy){event.preventDefault();controller.close();}
      if(event.key==='Tab'){const buttons=[...root.current.querySelectorAll('button:not(:disabled),[tabindex="0"]')],first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    },children:[
      x.jsx('h2',{id:'merge-title',children:`Merge ${controller.dialog.sources.length} messages?`}),
      x.jsx('p',{children:'Combine them in their current order, with a blank line between each. Keep the first message’s position and date, combine tags, and keep pins and reply links. Copied and exported statuses will reset.'}),
      x.jsx('div',{className:'merge-preview',tabIndex:0,'aria-label':'Combined message preview',children:controller.dialog.text}),
      error&&x.jsx('p',{role:'alert',children:error}),
      x.jsxs('div',{className:'transfer-actions',children:[
        x.jsx('button',{type:'button',disabled:busy,onClick:controller.close,children:'Cancel'}),
        x.jsx('button',{type:'button',disabled:busy||!!error,onClick:async()=>{setBusy(true);try{await controller.apply();}catch(reason){setError(reason.message);}finally{setBusy(false);}},children:busy?'Merging…':'Merge selected'})]})]})});
}
