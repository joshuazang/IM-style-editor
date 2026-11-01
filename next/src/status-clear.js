const imClearableStatuses={copied:'Copied',exported:'Exported',imported:'Imported',edited:'Edited'};
function imClearStatuses(messages,flags,ids=null){
  return messages.map(message=>{
    if(ids&&!ids.has(message.id))return message;
    const next={...message};
    for(const flag of flags){
      if(flag==='imported'){if(next.forwarding)next.importedStatusCleared=true;}
      else if(Object.hasOwn(imClearableStatuses,flag))delete next[flag];
    }
    return next;
  });
}
function imUseStatusClear({noteRef,messages,save,notify}){
  const [dialog,setDialog]=dt.useState(null);
  const uuid=noteRef.current?.uuid;
  dt.useEffect(()=>setDialog(null),[uuid]);
  return {dialog,messages,close:()=>setDialog(null),
    open:ids=>setDialog({uuid,ids:ids?new Set(ids):null}),
    apply:async flags=>{
      if(!dialog||noteRef.current?.uuid!==dialog.uuid)return false;
      const targets=messages.filter(message=>!dialog.ids||dialog.ids.has(message.id));
      const scope=dialog.ids?`${targets.length} selected message${targets.length===1?"":"s"}`:`all ${targets.length} messages in this note`;
      if(!window.confirm(`Clear ${flags.map(flag=>imClearableStatuses[flag]).join(', ')} from ${scope}?\n\nMessage text, timestamps, tags, pins, and reply links will be kept.`))return false;
      const pending=save(imClearStatuses(messages,flags,dialog.ids));
      if(!pending)throw new Error('Saving is paused.');
      await pending;
      if(noteRef.current?.uuid===dialog.uuid){setDialog(null);notify('Message statuses cleared.');}
      return true;
    }};
}
function ImClearStatusDialog({controller}){
  const [flags,setFlags]=dt.useState([]),[busy,setBusy]=dt.useState(false),[error,setError]=dt.useState('');
  const root=dt.useRef(null),{dialog,messages}=controller;
  dt.useEffect(()=>{
    const previous=document.activeElement;root.current?.querySelector('input')?.focus();
    return()=>previous?.isConnected&&previous.focus({preventScroll:true});
  },[]);
  const count=messages.filter(message=>!dialog.ids||dialog.ids.has(message.id)).length;
  return x.jsx('div',{className:'transfer-backdrop',onPointerDown:event=>{if(event.target===event.currentTarget&&!busy)controller.close();},children:
    x.jsxs('section',{ref:root,className:'transfer-dialog status-clear-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'status-clear-title',onKeyDown:event=>{
      event.stopPropagation();
      if(event.key==='Escape'&&!busy){event.preventDefault();controller.close();}
      if(event.key==='Tab'){
        const controls=[...root.current.querySelectorAll('input:not(:disabled),button:not(:disabled)')],first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    },children:[
      x.jsx('h2',{id:'status-clear-title',children:'Clear message statuses'}),
      x.jsx('p',{children:dialog.ids?`${count} selected message${count===1?"":"s"}`:`All ${count} messages in this note, including messages hidden by filters.`}),
      x.jsx('div',{className:'status-clear-options',children:Object.entries(imClearableStatuses).map(([flag,label])=>x.jsxs('label',{children:[
        x.jsx('input',{type:'checkbox',checked:flags.includes(flag),disabled:busy,onChange:event=>setFlags(old=>event.target.checked?[...old,flag]:old.filter(value=>value!==flag))}),label
      ]},flag))}),
      error&&x.jsx('p',{role:'alert',children:error}),
      x.jsxs('div',{className:'transfer-actions',children:[
        x.jsx('button',{type:'button',disabled:busy,onClick:controller.close,children:'Cancel'}),
        x.jsx('button',{type:'button',disabled:busy||!flags.length||!count,onClick:async()=>{
          setBusy(true);setError('');try{await controller.apply(flags);}catch{setError('Saving was not confirmed. Keep this note open and use Retry save.');}finally{setBusy(false);}
        },children:busy?'Saving…':'Clear selected statuses'})
      ]})
    ]})});
}
