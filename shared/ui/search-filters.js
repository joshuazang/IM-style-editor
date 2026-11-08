/* Shared, view-only date navigation. Local calendar days include DST changes.
 * This never changes a message, writes storage, or filters the note. */
function imSearchPanelBounds(top,viewport){
 const margin=Math.min(8,viewport.height/2),bottom=viewport.top+viewport.height-margin;
 const start=Math.max(viewport.top+margin,Math.min(top,bottom-Math.min(96,Math.max(0,viewport.height-2*margin))));
 return {shift:start-top,height:Math.max(0,bottom-start)};
}
/* Only open panels observe geometry. Resize work is coalesced into one frame;
 * it never focuses an input, remounts a native picker or changes note data. */
function imWatchSearchPanel(panel){
 let shift=0,frame=0,closed=false;
 const visual=window.visualViewport;
 const update=()=>{
  if(closed||!panel.isConnected||!panel.getClientRects().length)return;
  const rect=panel.getBoundingClientRect(),bounds=imSearchPanelBounds(rect.top-shift,{top:visual?.offsetTop||0,height:visual?.height||innerHeight});
  shift=bounds.shift;
  for(const [name,value] of [['--ui-search-shift',shift+'px'],['--ui-search-height',bounds.height+'px']])if(panel.style.getPropertyValue(name)!==value)panel.style.setProperty(name,value);
 };
 const schedule=()=>{if(!closed&&!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
 const sizes=new ResizeObserver(schedule);sizes.observe(panel);
 const roots=new Set([panel.offsetParent,panel.closest('.editor-shell')].filter(Boolean));
 const changes=new MutationObserver(schedule);
 for(const root of roots){sizes.observe(root);changes.observe(root,{childList:true,attributes:true,attributeFilter:['class','style']});}
 window.addEventListener('resize',schedule,{passive:true});
 visual?.addEventListener('resize',schedule,{passive:true});visual?.addEventListener('scroll',schedule,{passive:true});
 update();
 return {update,destroy(){closed=true;cancelAnimationFrame(frame);sizes.disconnect();changes.disconnect();window.removeEventListener('resize',schedule);visual?.removeEventListener('resize',schedule);visual?.removeEventListener('scroll',schedule);panel.style.removeProperty('--ui-search-shift');panel.style.removeProperty('--ui-search-height');}};
}
function imDateInput(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number),date=new Date(0);date.setFullYear(year,month-1,day);date.setHours(0,0,0,0);
 return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date:null;
}

function imDateTarget(messages,value){
 const start=imDateInput(value);if(!start)return null;
 const end=new Date(start);end.setDate(end.getDate()+1);
 let after=null,before=null,afterTime=Infinity,beforeTime=-Infinity;
 for(const message of messages){
  const time=typeof message.createdAt==='string'?Date.parse(message.createdAt):NaN;
  if(!Number.isFinite(time))continue;
  if(time>=+start&&time<afterTime){after=message;afterTime=time;}
  else if(time<+start&&time>beforeTime){before=message;beforeTime=time;}
 }
 const message=after||before;if(!message)return null;
 return {message,exact:after!==null&&afterTime<+end};
}
function imDateJumpNotice(target){
 return target.exact?'':'No messages on that date. Showing '+new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(target.message.createdAt))+'.';
}
function imCreateDateJumpPanel({onJump,onClose}){
 const root=document.createElement('section');root.className='ui-date-panel';root.id='date-picker';root.setAttribute('role','group');root.setAttribute('aria-label','Jump to date');
 const label=document.createElement('label');label.className='ui-date-field';label.textContent='Date';
 const input=document.createElement('input');input.type='date';imPrivateTextField(input);input.setAttribute('aria-label','Date');
 const error=document.createElement('p');error.className='ui-date-error';error.setAttribute('role','alert');error.hidden=true;
 const apply=()=>{
  if(!imDateInput(input.value)){error.textContent='Choose a valid date.';error.hidden=false;return;}
  if(onJump(input.value)===false){error.textContent='There are no dated messages in this note.';error.hidden=false;return;}
  onClose();
 };
 input.addEventListener('change',()=>{error.hidden=true;});input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();apply();}});
 const button=document.createElement('button');button.type='button';button.className='ui-date-apply';button.textContent='Jump to date';button.addEventListener('click',apply);
 label.append(input);root.append(label,error,button);
 // Let the user's tap open the native picker. Combining focus()/showPicker()
 // with an active text keyboard causes competing UI in iOS embedded editors.
 // Date changes stay local until Jump/Enter; do not unmount a live native picker.
 root.openPicker=()=>{const focused=document.activeElement;if(focused?.matches('input,textarea,[contenteditable="true"]'))focused.blur();};
 return root;
}
