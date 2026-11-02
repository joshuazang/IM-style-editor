/* One silent, account-backed timer. A deadline survives suspended/recreated editors.
 * No audio, notifications, browser storage or networking; only the existing host bridge.
 */
const imTimerPreferenceKey='imSilentTimerV1';
const imTimerState={timer:null,bridge:null,ready:false,error:'',listeners:new Set(),revision:0};
function imTimerRemaining(timer,now=Date.now()){return timer?Math.max(0,Math.ceil((timer.deadline-now)/1000)):0;}
function imTimerLabel(seconds){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function imTimerSnapshot(){return {timer:imTimerState.timer,error:imTimerState.error,ready:imTimerState.ready};}
function imTimerNotify(){for(const listener of imTimerState.listeners)listener(imTimerSnapshot());}
function imInitializeSilentTimer(bridge){
  imTimerState.bridge=bridge;
  try{
    const value=bridge.getComponentDataValueForKey(imTimerPreferenceKey);
    if(value!=null&&(value.version!==1||!Number.isSafeInteger(value.deadline)||!Number.isSafeInteger(value.durationMs)||![300000,1500000].includes(value.durationMs)||(value.runMs!==undefined&&(!Number.isSafeInteger(value.runMs)||value.runMs<60000||value.runMs>value.durationMs))))throw new Error('Invalid timer');
    imTimerState.timer=value?{version:1,deadline:value.deadline,durationMs:value.durationMs,...(value.runMs?{runMs:value.runMs}:{})}:null;
    imTimerState.ready=true;imTimerState.error='';
  }catch{imTimerState.timer=null;imTimerState.ready=false;imTimerState.error='Could not read the saved timer. Reopen the editor to try again.';}
  imTimerNotify();
}
function imSaveSilentTimer(){
  const state=imTimerState,revision=state.revision;
  if(!state.ready||!state.bridge)return false;
  try{
    const data={...state.bridge.component.data,[imTimerPreferenceKey]:state.timer};
    state.bridge.component.data=data;state.error='';
    state.bridge.postMessage('set-component-data',{componentData:data},reply=>{
      if(reply?.error&&state.revision===revision){state.error='The timer could not be saved. It continues here; retry saving before leaving the editor.';imTimerNotify();}
    });
    imTimerNotify();return true;
  }catch{state.error='The timer could not be saved. Retry saving before leaving the editor.';imTimerNotify();return false;}
}
function imStartSilentTimer(minutes,now=Date.now()){
  if(!imTimerState.ready||![5,25].includes(minutes))return false;
  imTimerState.timer={version:1,deadline:now+minutes*60000,durationMs:minutes*60000};
  imTimerState.revision++;return imSaveSilentTimer();
}
function imExtendSilentTimer(longer,now=Date.now()){
  const state=imTimerState;if(!state.ready||!state.timer||imTimerRemaining(state.timer,now)>0)return false;
  const runMs=state.timer.durationMs*(longer ? 0.6 : 0.2);
  state.timer={...state.timer,deadline:now+runMs,runMs};state.revision++;return imSaveSilentTimer();
}
function imCancelSilentTimer(){if(!imTimerState.ready)return false;imTimerState.timer=null;imTimerState.revision++;return imSaveSilentTimer();}
function imUseSilentTimer(){
  const [snapshot,setSnapshot]=dt.useState(imTimerSnapshot),[,tick]=dt.useState(0),[open,setOpen]=dt.useState(false);
  const checkExpiry=dt.useCallback(()=>tick(value=>value+1),[]);
  dt.useEffect(()=>{imTimerState.listeners.add(setSnapshot);setSnapshot(imTimerSnapshot());return()=>imTimerState.listeners.delete(setSnapshot);},[]);
  const remaining=imTimerRemaining(snapshot.timer),finished=!!snapshot.timer&&!remaining;
  const previousFocus=dt.useRef(null),wasFinished=dt.useRef(false);
  if(finished&&!wasFinished.current){const element=document.activeElement;previousFocus.current={element,start:element?.selectionStart,end:element?.selectionEnd};}
  wasFinished.current=finished;
  dt.useEffect(()=>{
    if(!snapshot.timer)return;
    // The editor wakes at the deadline, not once per second. Recheck after a
    // suspended tab or clock change; early timer callbacks simply reschedule.
    let timeout;
    const refresh=()=>{
      clearTimeout(timeout);
      const expired=imTimerRemaining(snapshot.timer)===0;
      if(expired!==finished)tick(value=>value+1);
      else if(!expired)timeout=setTimeout(refresh,Math.max(1,snapshot.timer.deadline-Date.now()));
    };
    refresh();
    const stopExpiredInput=event=>{
      if(event.type==='keydown'&&(event.ctrlKey||event.metaKey||event.altKey))return;
      if(imTimerRemaining(imTimerState.timer)>0||!imTimerState.timer)return;
      if(event.target.closest?.('.composer')&&event.target.matches?.('input,textarea,[contenteditable=true]')){event.preventDefault();event.stopPropagation();refresh();}
    };
    window.addEventListener('beforeinput',stopExpiredInput,true);window.addEventListener('keydown',stopExpiredInput,true);
    document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
    return()=>{clearTimeout(timeout);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('beforeinput',stopExpiredInput,true);window.removeEventListener('keydown',stopExpiredInput,true);};
  },[snapshot.timer,finished]);
  return {...snapshot,finished,checkExpiry,restoreFocus:previousFocus.current,open,show:()=>setOpen(true),close:()=>setOpen(false),start:imStartSilentTimer,cancel:imCancelSilentTimer,extend:imExtendSilentTimer};
}
function ImSilentTimerBadge({timer}){
  const [,tick]=dt.useState(0);
  dt.useEffect(()=>{
    if(!timer.timer||timer.finished)return;
    const refresh=()=>tick(value=>value+1),interval=setInterval(refresh,1000);
    document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
    return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
  },[timer.timer,timer.finished]);
  const remaining=imTimerRemaining(timer.timer),finished=!!timer.timer&&remaining===0;
  // A forward system-clock change can finish the badge before the scheduled
  // deadline callback. Notify the editor only for that transition.
  dt.useEffect(()=>{if(finished&&!timer.finished)timer.checkExpiry();},[finished,timer.finished,timer.checkExpiry]);
  if(!timer.timer)return null;
  const progress=Math.max(0,Math.min(1,1-remaining*1000/(timer.timer.runMs||timer.timer.durationMs)));
  return x.jsx('div',{className:'silent-timer-row',children:x.jsxs('button',{type:'button',className:`silent-timer-badge${timer.finished?' is-finished':''}`,
    'aria-label':timer.finished?'Silent timer finished. Open timer':'Open silent timer',onClick:timer.show,children:[
      x.jsxs('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,'aria-hidden':true,children:[
        x.jsx('circle',{cx:12,cy:12,r:9,opacity:.22}),x.jsx('circle',{cx:12,cy:12,r:9,strokeDasharray:56.55,strokeDashoffset:56.55*(1-progress),transform:'rotate(-90 12 12)',strokeLinecap:'round'})]}),
      x.jsx('span',{className:'silent-timer-countdown','aria-live':'off',children:finished?'Finished':imTimerLabel(remaining)}),
      x.jsx('span',{className:'silent-timer-announcement',role:'status',children:timer.finished?'Silent timer finished':''})
    ]})});
}
function ImSilentTimerDialog({timer}){
  const [minutes,setMinutes]=dt.useState(()=>timer.timer?timer.timer.durationMs/60000:5),root=dt.useRef(null);
  dt.useEffect(()=>{const previous=document.activeElement;root.current?.querySelector('button')?.focus();return()=>{if(!imTimerState.timer||imTimerRemaining(imTimerState.timer)>0)previous?.isConnected&&previous.focus({preventScroll:true});};},[]);
  return x.jsx('div',{className:'transfer-backdrop',onPointerDown:event=>{if(event.target===event.currentTarget)timer.close();},children:x.jsxs('section',{
    ref:root,className:'transfer-dialog silent-timer-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'silent-timer-title',onKeyDown:event=>{
      event.stopPropagation();if(event.key==='Escape'){event.preventDefault();timer.close();}
      if(event.key==='Tab'){const controls=[...root.current.querySelectorAll('button:not(:disabled)')],first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    },children:[
      x.jsx('h2',{id:'silent-timer-title',children:'Silent timer'}),x.jsx('p',{children:'When time is up, choose an option before continuing to type. No sound.'}),
      x.jsx('div',{className:'silent-timer-presets',role:'group','aria-label':'Timer duration',children:[5,25].map(value=>x.jsx('button',{
        type:'button','aria-pressed':minutes===value,onClick:()=>setMinutes(value),children:`${value} minutes`
      },value))}),
      timer.error&&x.jsx('p',{role:'alert',children:timer.error}),
      x.jsxs('div',{className:'transfer-actions',children:[
        x.jsx('button',{type:'button',onClick:timer.close,children:'Close'}),
        timer.timer&&x.jsx('button',{type:'button',onClick:()=>{timer.cancel();timer.close();},children:'Cancel timer'}),
        x.jsx('button',{type:'button',disabled:!timer.ready,onClick:()=>{if(timer.start(minutes))timer.close();},children:timer.timer?'Restart timer':'Start timer'})
      ]})
    ]})});
}
/* A number only focuses a choice. Enter confirms it; Escape discards the timer. */
const imTimerFinishShortcuts=['2','3','4'];
function ImTimerFinishedDialog({timer}){
  const root=dt.useRef(null),base=timer.timer.durationMs/60000;
  const actions=[
    {key:'Escape',label:'Cancel timer',run:()=>timer.cancel()},
    {key:imTimerFinishShortcuts[0],label:`Add ${base*.2} minute${base*.2===1?'':'s'}`,run:()=>timer.extend(false)},
    {key:imTimerFinishShortcuts[1],label:`Add ${base*.6} minutes`,run:()=>timer.extend(true)},
    {key:imTimerFinishShortcuts[2],label:`Restart ${base} minutes`,run:()=>timer.start(base)}
  ];
  const choose=index=>{actions[index].run();timer.close();};
  const latest=dt.useRef(choose);latest.current=choose;
  dt.useLayoutEffect(()=>{
    const previous=timer.restoreFocus?.element||document.activeElement,start=timer.restoreFocus?.start,end=timer.restoreFocus?.end;
    if(previous?.matches?.('input,textarea,[contenteditable=true]'))previous.blur();
    root.current?.focus({preventScroll:true});
    const key=event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
      const controls=[...root.current.querySelectorAll('button')];
      if(event.key==='Tab'){
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        event.stopPropagation();return;
      }
      event.preventDefault();event.stopPropagation();
      if(event.repeat)return;
      if(event.key==='Escape'){latest.current(0);return;}
      const index=imTimerFinishShortcuts.indexOf(event.key);
      if(index>=0){controls[index+1].focus({preventScroll:true});return;}
      if(event.key==='Enter'){const active=controls.indexOf(document.activeElement);if(active>=0)latest.current(active);}
    };
    window.addEventListener('keydown',key,true);
    return()=>{
      window.removeEventListener('keydown',key,true);
      requestAnimationFrame(()=>{
        if(document.querySelector('.timer-finished-dialog'))return;
        const target=previous?.isConnected&&previous!==document.body&&previous!==document.documentElement?previous:document.querySelector('.composer textarea,.composer button');
        target?.focus({preventScroll:true});
        if(target===previous&&typeof start==='number'&&target.setSelectionRange)target.setSelectionRange(start,end);
      });
    };
  },[]);
  return x.jsx('div',{className:'transfer-backdrop timer-finished-backdrop',children:x.jsxs('section',{
    ref:root,tabIndex:-1,className:'transfer-dialog timer-finished-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'timer-finished-title',children:[
      x.jsx('h2',{id:'timer-finished-title',children:'Timer finished'}),
      x.jsx('p',{children:`Your ${base}-minute timer is up. Choose an option to continue typing.`}),
      x.jsx('p',{className:'timer-key-help',children:'Press a number to focus its option, then Enter to confirm. Esc cancels.'}),
      x.jsx('div',{className:'timer-finish-actions',children:actions.map((action,index)=>x.jsxs('button',{
        type:'button',onClick:()=>choose(index),children:[x.jsx('kbd',{children:index===0?'Esc':action.key}),x.jsx('span',{children:action.label})]
      },action.key))})
    ]})});
}
