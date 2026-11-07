/* Shared view-only date filters. Calendar bounds use the device's local zone,
 * including 23/25-hour days. Nothing here writes notes or browser storage. */
const imDatePresets=[['all','All dates'],['today','Today'],['yesterday','Yesterday'],['week','Last 7 days'],['month','Last 30 days'],['custom','Custom range']];
const imDateTimes=new WeakMap();
function imDateInput(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number),date=new Date(0);date.setFullYear(year,month-1,day);date.setHours(0,0,0,0);
 return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date:null;
}
function imDateRange(filter={},now=new Date()){
 const preset=imDatePresets.some(([id])=>id===filter?.preset)?filter.preset:'all',today=new Date(now);today.setHours(0,0,0,0);
 const shift=(date,days)=>{const result=new Date(date);result.setDate(result.getDate()+days);return result;};
 let start=-Infinity,end=Infinity,label=imDatePresets.find(([id])=>id===preset)[1],error='';
 if(preset==='today'){start=+today;end=+shift(today,1);}
 if(preset==='yesterday'){start=+shift(today,-1);end=+today;}
 if(preset==='week'||preset==='month'){start=+shift(today,preset==='week'?-6:-29);end=+shift(today,1);}
 if(preset==='custom'){
  const from=filter.from?imDateInput(filter.from):null,to=filter.to?imDateInput(filter.to):null;
  if((filter.from&&!from)||(filter.to&&!to))error='Choose a valid date.';
  else if(!from&&!to)error='Choose at least one date.';
  else if(from&&to&&from>to)error='From date must be on or before To date.';
  if(from)start=+from;if(to)end=+shift(to,1);
  const format=date=>new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(date);
  label=from&&to?format(from)+' – '+format(to):from?'From '+format(from):to?'Through '+format(to):'Custom range';
 }
 const active=preset!=='all'&&!error;return {active,start,end,error,label,preset,key:active?[preset,start,end].join(':'):'all'};
}
function imDateMatches(message,range){
 if(!range.active)return true;
 let cached=imDateTimes.get(message);
 if(!cached||cached.source!==message.createdAt){cached={source:message.createdAt,time:typeof message.createdAt==='string'?Date.parse(message.createdAt):NaN};imDateTimes.set(message,cached);}
 return Number.isFinite(cached.time)&&cached.time>=range.start&&cached.time<range.end;
}
function imCreateDateFilterPanel({value,onApply,onClose}){
 const make=(tag,css,text)=>{const node=document.createElement(tag);if(css)node.className=css;if(text!==undefined)node.textContent=text;return node;};
 const root=make('section','ui-date-panel');root.id='date-filters';root.setAttribute('role','group');root.setAttribute('aria-label','Date filters');
 let draft={preset:'all',...value};
 const apply=filter=>{const range=imDateRange(filter);if(range.error){error.textContent=range.error;error.hidden=false;return;}onApply(filter);onClose();};
 const presets=make('div','ui-date-presets');presets.setAttribute('role','group');presets.setAttribute('aria-label','Date options');
 for(const [id,label] of imDatePresets){const b=make('button','',label);b.type='button';b.setAttribute('aria-pressed',String(draft.preset===id));b.addEventListener('click',()=>{if(id!=='custom'){apply({preset:id});return;}draft.preset='custom';custom.hidden=false;for(const item of presets.children)item.setAttribute('aria-pressed',String(item===b));from.focus();});presets.append(b);}
 const custom=make('div','ui-date-custom');custom.hidden=draft.preset!=='custom';const fields=make('div','ui-date-fields');
 const field=(text,key)=>{const label=make('label','',text),input=make('input');input.type='date';imPrivateTextField(input);input.setAttribute('aria-label',text);input.value=draft[key]||'';input.addEventListener('input',()=>{draft[key]=input.value;error.hidden=true;});label.append(input);fields.append(label);return input;};
 const from=field('From date','from');field('To date','to');
 const error=make('p','ui-date-error');error.setAttribute('role','alert');error.hidden=true;
 const button=make('button','ui-date-apply','Apply date filter');button.type='button';button.addEventListener('click',()=>apply({...draft,preset:'custom'}));
 custom.append(fields,error,button);root.append(presets,custom);return root;
}
