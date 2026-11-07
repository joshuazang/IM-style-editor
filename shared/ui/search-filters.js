/* Shared, view-only date navigation. Local calendar days include DST changes.
 * This never changes a message, writes storage, or filters the note. */
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
 input.addEventListener('change',apply);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();apply();}});
 const button=document.createElement('button');button.type='button';button.className='ui-date-apply';button.textContent='Jump to date';button.addEventListener('click',apply);
 label.append(input);root.append(label,error,button);
 // Native pickers differ between desktop/mobile hosts; the visible date input
 // remains usable when an embedded host disallows programmatic showPicker().
 root.openPicker=()=>{input.focus({preventScroll:true});try{input.showPicker?.();}catch{}};
 return root;
}
