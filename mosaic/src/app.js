/* Mosaic's UI. Persistence, portable text and transfer logic are the shared IM core. */
const $ = id => document.getElementById(id);
function el(tag, className='', text) {
  const node=document.createElement(tag);if(tag==='input'||tag==='textarea')imPrivateTextField(node);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;
}
function button(label, icon, handler, className='icon-button') {
  const node=el('button',className);node.type='button';node.setAttribute('aria-label',label);node.title=label;
  if(icon)node.append(mosaicIcon(icon));else node.textContent=label;
  if(handler)node.addEventListener('click',event=>{event.stopPropagation();handler(event);});return node;
}
const modal=$('modal'), menu=$('menu'), viewport=$('viewport'), board=$('board');
let active=null, modalState=null, toastTimer, frame=0, layout={items:[],headings:[],height:0,count:0};
let mounted=new Map(), selectionPreferences=Object.create(null);
const viewMemory=new Map(), unfinishedEdits=new Map();
// Only unconfirmed sessions and deferred status intents survive note switches.
// Both are working memory; no text or recovery copy is written to browser storage.
const retainedSessions=new Map(), transferMarks=new Map();
const editKey=(uuid,id)=>JSON.stringify([uuid,id]);
function latestUnfinished(uuid){let latest;for(const entry of unfinishedEdits.values())if(entry.noteId===uuid)latest=entry;return latest;}
const dark=matchMedia('(prefers-color-scheme: dark)');
const pf=new MosaicRelay({targetWindow:window,options:{coallesedSaving:false,acceptsThemes:false},onReady:()=>{
  const saved=pf.getComponentDataValueForKey('mosaicSelectionsV1');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [id,ids] of Object.entries(saved)){
    if(Array.isArray(ids)&&ids.every(imFormat.validId))selectionPreferences[id]=ids;
  }
  pf.streamContextItem(receive);
}});

function notify(text) {
  clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,5000);
}
function safeRun(action) {try{Promise.resolve(action()).catch(error=>notify(error.message||'The action could not be completed.'));}catch(error){notify(error.message);}}
// iOS keyboards may issue beforeinput without a useful keydown. Shift+Enter
// remains a native line break; neither path submits an IME confirmation key.
function bindSubmitField(field,submit,{composing=()=>false,newline}={}) {
  let allowLineBreak=false,ime=false;
  const allowThisEvent=()=>{allowLineBreak=true;setTimeout(()=>allowLineBreak=false,0);};
  field.addEventListener('compositionstart',()=>ime=true);
  field.addEventListener('compositionend',()=>ime=false);
  field.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    if(event.isComposing||event.keyCode===229||ime||composing()){allowThisEvent();return;}
    if(event.shiftKey){allowThisEvent();if(newline){event.preventDefault();newline();}return;}
    event.preventDefault();if(!event.repeat)submit();
  });
  field.addEventListener('beforeinput',event=>{
    if(!['insertLineBreak','insertParagraph'].includes(event.inputType)||allowLineBreak||event.isComposing||ime||composing())return;
    event.preventDefault();submit();
  });
}
function newView(uuid) {
  const old=viewMemory.get(uuid);
  return old||{query:'',tag:'',pinned:false,selecting:false,selected:new Set(selectionPreferences[uuid]||[]),scroll:0};
}
function rememberSelection() {
  if(!active)return;
  if(active.view.selected.size)selectionPreferences[active.note.uuid]=[...active.view.selected];else delete selectionPreferences[active.note.uuid];
  if(active.demo)return;
  try{
    const data={...pf.component.data,mosaicSelectionsV1:{...selectionPreferences}};
    pf.component.data=data;
    pf.postMessage('set-component-data',{componentData:data},reply=>{if(reply?.error)notify('Selection preferences could not be saved. Your cards are unchanged.');});
  }catch{notify('Selection preferences could not be saved. Your cards are unchanged.');}
}
function sessionEcho(s,note){
  const queue=imNoteSaves.get(note.uuid),native=imNoteNativeSignature(note),text=note.content?.text||'';
  return [queue?.current?.snapshot,queue?.next?.snapshot,s.lastAck].some(snapshot=>snapshot&&snapshot.text===text&&(snapshot.native||imNoteNativeSignature(snapshot.item))===native);
}
function knownSessionText(s,text){
  const queue=imNoteSaves.get(s.note.uuid);
  return [s.note.content.text,s.lastHostText,s.lastAck?.text,queue?.current?.snapshot.text,queue?.next?.snapshot.text].includes(text);
}
function receiveNativeFields(s,note){
  const signature=imNoteNativeSignature(s.note),incoming=imNoteNativeSignature(note);
  if(s.nativeRepair&&incoming!==signature&&sessionEcho(s,note)){
    imNoteMetadataReceived(s.note,{...note,isMetadataUpdate:true});return;
  }
  imApplyNoteNative(s.note,note);s.lastHostText=note.content?.text||'';s.deleted=!!note.deleted;
  if(s.deleted){imCancelQueuedNoteSaves(note.uuid);renderNotice();renderCapture();return;}
  if(signature!==incoming){
    const rebased=imRebaseQueuedNote(s.note.uuid,note);
    if(s.pending&&!s.remote){s.nativeRepair=true;if(!rebased&&active===s)safeRun(()=>persist(s));}
  }
  if(!s.dirty&&!s.pending&&!s.error)imNoteReceived(s.note);
}
function receive(note, force=false) {
  if(!note||!note.uuid)return;
  if(note.isMetadataUpdate===true){const s=active?.note.uuid===note.uuid?active:retainedSessions.get(note.uuid);if(s)imNoteMetadataReceived(s.note,note);return;}
  if(active?.note.uuid===note.uuid&&!force){
    const s=active,text=note.content?.text||'';
    if(s.note.content?.text===text||((s.pending||s.error)&&knownSessionText(s,text))){
      receiveNativeFields(s,note);return;
    }
    const editing=modalState?.kind==='edit'&&modalState.uuid===note.uuid&&(modalState.currentText!==modalState.original||JSON.stringify([...modalState.tags])!==JSON.stringify(modalState.originalTags));
    if(s.pending||s.error||s.dirty||editing){s.remote=note;retainedSessions.set(note.uuid,s);imCancelQueuedNoteSaves(note.uuid);renderNotice();return;}
  }
  const previous=active;
  if(previous){previous.view.scroll=viewport.scrollTop;viewMemory.set(previous.note.uuid,previous.view);stashEdit();}
  closeModal(true);hideMenu();
  if(force){
    const discarded=retainedSessions.get(note.uuid)||previous;
    if(discarded?.note.uuid===note.uuid){discarded.discarded=true;imCancelQueuedNoteSaves(note.uuid);retainedSessions.delete(note.uuid);}
    for(const [key,entry] of unfinishedEdits)if(entry.noteId===note.uuid)unfinishedEdits.delete(key);
  }
  const retained=!force&&retainedSessions.get(note.uuid);
  if(retained){
    active=retained;imNoteUnconfirmed(retained.note);
    const text=note.content?.text||'';
    if(knownSessionText(retained,text))receiveNativeFields(retained,note);
    else{retained.remote=note;imCancelQueuedNoteSaves(note.uuid);}
    $('search').value=retained.view.query;renderAll();viewport.scrollTop=retained.view.scroll||0;scheduleWindow();
    safeRun(()=>applyTransferMarks(retained));return;
  }
  const parsed=imFormat.inspect(note.content?.text);
  const s={note,messages:imFormat.readMessages(note),settings:imFormat.readSettings(note),draft:imFormat.readDraft(note),reply:imFormat.readReply(note),
    damaged:parsed.kind==='damaged',plain:parsed.kind==='plain'&&!!note.content?.text,deleted:!!note.deleted,
    view:newView(note.uuid),pending:0,revision:0,error:'',remote:null,intents:new Set(),demo:!!note.mosaicDemo,
    captureValue:imFormat.readDraft(note),captureOriginal:imFormat.readDraft(note),captureRevision:0,submission:null,composing:false,submitAfterComposition:null,
    dirty:false,discarded:false,lastHostText:note.content?.text||'',lastAck:null,nativeRepair:false};
  const valid=new Set(s.messages.map(m=>m.id));s.view.selected=new Set([...s.view.selected].filter(id=>valid.has(id)));
  if(s.view.selected.size)s.view.selecting=true;
  active=s;imNoteReceived(note);
  $('search').value=s.view.query;viewport.scrollTop=0;
  renderAll();viewport.scrollTop=s.view.scroll||0;scheduleWindow();
  if(force&&writable(s)&&imNoteSavePending(note.uuid))safeRun(()=>persist(s));
  safeRun(()=>applyTransferMarks(s));
}
function writable(s=active) {return !!s&&s===active&&!s.discarded&&!s.damaged&&!s.deleted&&!s.plain&&!s.remote;}
function persist(s) {
  if(!writable(s))return Promise.reject(new Error('Saving is paused. The original note has been kept.'));
  const revision=++s.revision,submitted={text:s.note.content.text,native:imNoteNativeSignature(s.note)};
  s.pending++;s.dirty=true;s.error='';retainedSessions.set(s.note.uuid,s);renderStatus();renderNotice();
  const promise=s.demo?Promise.resolve():imPersistNote(s.note);
  return promise.then(()=>{
    if(s.discarded)return;
    const confirmed=imConfirmedNote?.note===s.note?imConfirmedNote.snapshot:null;
    s.lastAck=confirmed?{text:confirmed.text,native:imNoteNativeSignature(confirmed.item)}:submitted;
    if(s.remote)return;
    if(revision===s.revision){s.error='';s.dirty=false;s.nativeRepair=false;retainedSessions.delete(s.note.uuid);}
    for(const intent of [...s.intents])if(intent.revision<=revision){s.intents.delete(intent);intent.finish();}
    if(active===s)safeRun(()=>applyTransferMarks(s));
  },error=>{
    if(!s.discarded&&revision===s.revision){s.error='Saving was not confirmed. Keep this editor open and retry. Your text is still here.';s.dirty=true;retainedSessions.set(s.note.uuid,s);}
    throw error;
  }).finally(()=>{s.pending--;if(active===s){renderStatus();renderNotice();}});
}
function update(s, change, redraw=true) {
  if(!writable(s))throw new Error('Saving is paused. Your original note is unchanged.');
  const messages=change.messages??s.messages,settings=change.settings??s.settings;
  const draft=Object.hasOwn(change,'draft')?change.draft:s.draft,reply=Object.hasOwn(change,'reply')?change.reply:s.reply;
  imFormat.write(s.note,messages,settings,draft,reply);
  Object.assign(s,{messages:imFormat.readMessages(s.note),settings:imFormat.readSettings(s.note),draft:imFormat.readDraft(s.note),reply:imFormat.readReply(s.note)});
  const promise=persist(s);
  if(s===active){if(redraw)renderAll();else renderCapture();}
  return promise;
}
function retrySave() {if(active)safeRun(()=>persist(active));}
function renderStatus() {
  const node=$('save-status');node.classList.toggle('saving',!!active?.pending);
  node.textContent=!active?'Open in Standard Notes':active.demo?'Preview · not saved':active.error?'Save needs attention':active.remote?'Review changes':active.pending?'Saving…':active.damaged?'Read only':'Saved';
  node.hidden=!active?.pending&&!active?.error&&!active?.remote&&!active?.demo;
}
function renderNotice() {
  const box=$('notice');box.replaceChildren();const s=active;box.hidden=true;if(!s)return;
  let text='';
  if(s.damaged)text='Saving is paused: this is not a valid format-3 note. The original text is unchanged. Format-2 notes belong in IM-style-editor Archive.';
  else if(s.deleted)text='This note is deleted. Restore it in Standard Notes before editing.';
  else if(s.remote)text='Standard Notes sent a different version while you had unsaved changes. Saving is paused so neither version is silently overwritten.';
  else if(s.plain)text='This is an ordinary plain-text note. Convert it to the shared card format before editing.';
  else if(s.error)text=s.error;
  if(!text)return;box.hidden=false;box.append(el('span','',text));
  if(s.error&&!s.remote)box.append(button('Retry save',null,retrySave,''));
  if(s.plain)box.append(button('Use card format',null,()=>confirmAction('Use the shared card format?','Your existing text will become cards. Mosaic and the current IM editor will both be able to open this note.','Convert note',()=>{s.plain=false;return update(s,{});}),''));
  if(s.damaged||s.remote||s.error)box.append(button('Review text',null,()=>recoveryDialog(s),''));
}
function renderCapture() {
  const s=active,field=$('capture-input'),value=MosaicModel.normalized(s?.captureValue||'');
  if(field.value!==value)field.value=value;
  field.disabled=!writable();growCapture();
  const quote=$('capture-reply');quote.replaceChildren();quote.hidden=!s?.reply;
  if(s?.reply){
    const text=button('Show quoted card',null,()=>jumpTo(s.reply),'inline-quote');text.textContent=s.reply.text.replace(/\s+/g,' ').slice(0,160)||'Quoted message';
    quote.append(text,button('Cancel reply','close',()=>safeRun(()=>update(s,{reply:null},false)),'icon-button danger'));
  }
}
function growCapture(){const field=$('capture-input');field.style.height='0px';field.style.height=Math.min(180,Math.max(56,field.scrollHeight))+'px';scheduleWindow();}
function inputCapture(){
  const s=active;if(!writable(s))return;
  const value=$('capture-input').value;
  s.captureValue=value===MosaicModel.normalized(s.captureOriginal)?s.captureOriginal:value;s.captureRevision++;
  safeRun(()=>update(s,{draft:s.captureValue},false));
}
function submitCapture(s=active,tag=s?.view.tag){
  if(!writable(s)||s.submission||!s.captureValue.trim())return Promise.resolve();
  if(s.composing){s.submitAfterComposition={tag};return Promise.resolve();}
  const text=s.captureValue,revision=s.captureRevision;
  const tags=tag&&tag!=='__untagged__'?[tag]:[];
  const message={id:imFormat.newId(),text,reactions:tags,createdAt:new Date().toISOString(),...(s.reply?{replyTo:s.reply}:{})};
  s.submission={id:message.id,text,revision};
  s.locatedId=message.id;setTimeout(()=>{if(s.locatedId===message.id)s.locatedId=null;},2200);
  // Reveal the card just captured, including when a search or pins-only view
  // would otherwise hide it. Its active emoji filter still supplies the label.
  if(s.view.query&&!text.toLocaleLowerCase().includes(s.view.query.toLocaleLowerCase())){s.view.query='';$('search').value='';}
  s.view.pinned=false;
  let saving;
  try{saving=update(s,{messages:[...s.messages,message],draft:'',reply:null});}
  catch(error){s.submission=null;throw error;}
  const placed=layout.items.find(item=>item.message.id===message.id);
  if(placed){
    viewport.scrollTo({top:Math.max(0,placed.y-10),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    scheduleWindow();requestAnimationFrame(()=>mounted.get(message.id)?.classList.add('located'));
  }
  s.intents.add({revision:s.revision,finish:()=>{
    s.submission=null;
    if(s.captureRevision===revision){s.captureValue='';s.captureOriginal='';}
    else s.captureOriginal=s.captureValue;
    if(active===s)renderCapture();
  }});
  return saving;
}
function renderTags() {
  const box=$('tag-filters');box.replaceChildren();if(!active)return;
  const s=active;
  const add=(tag,label,icon)=>{
    const node=button(label,icon,()=>{s.view.tag=s.view.tag===tag?'':tag;s.view.scroll=0;viewport.scrollTop=0;renderAll();},'tag-chip'+(tag==='__untagged__'?' untagged':''));
    if(!icon){node.replaceChildren(el('span','',tag?label:'All'));}
    node.setAttribute('aria-label',tag==='__untagged__'?'Untagged cards':tag?'Filter by '+tag:'All tags');node.setAttribute('aria-pressed',String(s.view.tag===tag));
    box.append(node);
  };
  add('','All tags');
  const tags=MosaicModel.tags(s.messages,s.settings),pos=Number.isInteger(s.settings.untaggedPosition)?Math.max(0,Math.min(tags.length,s.settings.untaggedPosition)):tags.length;
  tags.splice(pos,0,'__untagged__');for(const tag of tags)add(tag,tag,tag==='__untagged__'?'untagged':null);
}
function renderAll() {
  const s=active;renderStatus();renderNotice();renderCapture();renderTags();
  $('welcome').hidden=!!s;$('more-button').disabled=!s;$('pinned-filter').disabled=!s;$('search').disabled=!s;
  $('pinned-filter').setAttribute('aria-pressed',String(!!s?.view.pinned));
  $('app').classList.toggle('selection-mode',!!s?.view.selecting);
  rebuildLayout();renderSelection();
}
function rebuildLayout() {
  const anchor=findAnchor();
  layout=active?MosaicModel.layout(active.messages,active.settings,Math.max(1,board.clientWidth),active.view.query,active.view.tag,active.view.pinned,active.view.selecting):{items:[],headings:[],height:0,count:0};
  board.style.height=layout.height+'px';board.replaceChildren();mounted.clear();
  for(const heading of layout.headings){const node=el('div','section-heading',heading.label);node.style.top=heading.y+'px';board.append(node);}
  const filtered=active&&(active.view.query||active.view.tag||active.view.pinned);
  $('empty').hidden=!active||!!layout.count||active.damaged||!filtered;
  if(anchor){const next=layout.items.find(p=>p.message.id===anchor.id);if(next)viewport.scrollTop+=next.y-anchor.y;}
  renderWindow();
}
function findAnchor() {
  const top=viewport.getBoundingClientRect().top,origin=board.getBoundingClientRect().top;
  const item=layout.items.find(p=>p.y+origin+p.height>top&&p.y+origin<top+viewport.clientHeight);
  return item?{id:item.message.id,y:item.y}:null;
}
function scheduleWindow() {if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderWindow();});}
function renderWindow() {
  const top=viewport.getBoundingClientRect().top-board.getBoundingClientRect().top,low=top-550,high=top+viewport.clientHeight+550;
  const visible=new Set(),measurements=[];
  for(const item of layout.items){
    if(item.y+item.height<low||item.y>high)continue;
    visible.add(item.message.id);
    let node=mounted.get(item.message.id);
    if(!node){node=cardNode(item.message);mounted.set(item.message.id,node);board.append(node);}
    node.classList.toggle('is-compact',item.width<230);
    const geometry=item.width+':'+!!active?.view.selecting;
    Object.assign(node.style,{width:item.width+'px',height:node.dataset.geometry===geometry?item.height+'px':'auto',transform:`translate(${item.x}px,${item.y}px)`});
    if(node.dataset.geometry!==geometry){node.dataset.geometry=geometry;measurements.push({node,item});}
  }
  for(const [id,node] of mounted)if(!visible.has(id)){node.remove();mounted.delete(id);}
  // Measure only newly mounted/resized previews, in one read batch. Reuse those
  // real heights on future layouts rather than leaving guessed empty space.
  let changed=false;const selecting=!!active?.view.selecting;
  for(const {node,item} of measurements){
    const height=Math.ceil(node.getBoundingClientRect().height);
    const measured=MosaicModel.measure(item.message,item.width,node.classList.contains('is-pinned'),selecting,height);
    if(measured&&height!==item.height)changed=true;
  }
  if(changed){
    const anchor=findAnchor(),s=active;
    layout=MosaicModel.layout(s.messages,s.settings,Math.max(1,board.clientWidth),s.view.query,s.view.tag,s.view.pinned,s.view.selecting);
    board.style.height=layout.height+'px';
    for(const [index,heading] of layout.headings.entries())board.querySelectorAll('.section-heading')[index].style.top=heading.y+'px';
    for(const item of layout.items){const node=mounted.get(item.message.id);if(node)Object.assign(node.style,{height:item.height+'px',transform:`translate(${item.x}px,${item.y}px)`});}
    if(anchor&&!s.locatedId){const next=layout.items.find(item=>item.message.id===anchor.id);if(next&&Math.abs(next.y-anchor.y)>.5)viewport.scrollTop+=next.y-anchor.y;}
    scheduleWindow();
  }
}
function metaText(message) {
  const bits=[];if(message.copied)bits.push('Copied');if(message.exported)bits.push('Exported');if(MosaicModel.isImported(message))bits.push('Imported');
  if(message.createdAt&&!Number.isNaN(new Date(message.createdAt).getTime()))bits.push(new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(message.createdAt)));
  if(message.edited)bits.push('Edited');return bits.join(' · ');
}
function cardNode(message) {
  const s=active,parts=MosaicModel.split(message.text),pinned=MosaicModel.pins(s.settings).includes(message.id);
  const node=el('article','card'+(pinned?' is-pinned':'')+(s.view.selected.has(message.id)?' selected':''));
  if(s.locatedId===message.id)node.classList.add('located');
  const color=MosaicModel.color(message,dark.matches);node.style.setProperty('--card-color',color.background);node.style.setProperty('--card-ink',color.ink);
  node.dataset.id=message.id;node.setAttribute('role','listitem');node.tabIndex=0;node.setAttribute('aria-label',parts.title||parts.body.slice(0,70)||'Empty card');
  if(s.view.selecting){const check=el('span','selection-check');if(s.view.selected.has(message.id))check.append(mosaicIcon('check'));node.append(check);node.setAttribute('aria-label',(s.view.selected.has(message.id)?'Selected: ':'Select: ')+(parts.title||'Untitled card'));}
  node.append(button(pinned?'Unpin card':'Pin card','pin',()=>safeRun(()=>togglePin(s,message.id)),'icon-button pin-card'),
    el('h2','card-title'+(parts.title?'':' empty-title'),parts.title||'Untitled'));
  if(message.replyTo)node.append(el('div','card-reply',message.replyTo.text.replace(/\s+/g,' ').slice(0,150)||'Quoted message'));
  if(parts.body)node.append(el('p','card-body',parts.body));
  if(message.reactions.length){const tags=el('div','card-tags');for(const tag of message.reactions.slice(0,10))tags.append(el('span','card-tag',tag));node.append(tags);}
  const meta=el('div','card-meta');meta.append(el('span','meta-text',metaText(message)),el('span','meta-dot'));node.append(meta);
  const tools=el('div','card-tools');tools.append(
    button('Background options','palette',event=>colorMenu(message.id,event),'icon-button palette-card'),
    button('Card options','more',event=>cardMenu(message,event),'icon-button more-card'));
  node.append(tools);
  let longPressed=false;
  node.addEventListener('click',()=>{if(longPressed){longPressed=false;return;}if(!menu.hidden)return;s.view.selecting?toggleSelection(message.id):readCard(message.id);});
  node.addEventListener('keydown',event=>{if(event.target!==node)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();node.click();}});
  node.addEventListener('contextmenu',event=>{event.preventDefault();cardMenu(message,event);});
  let press=0,start;
  node.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'||event.target.closest('button'))return;longPressed=false;start={x:event.clientX,y:event.clientY};press=setTimeout(()=>{press=0;longPressed=true;cardMenu(message,{clientX:start.x,clientY:start.y});},550);});
  node.addEventListener('pointermove',event=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>9){clearTimeout(press);press=0;}});
  for(const type of ['pointerup','pointercancel','pointerleave'])node.addEventListener(type,()=>{clearTimeout(press);press=0;start=null;});
  return node;
}
function toggleSelection(id) {const v=active.view;v.selecting=true;v.selected.has(id)?v.selected.delete(id):v.selected.add(id);rememberSelection();renderAll();}
function startSelection(id) {active.view.selecting=true;if(id)active.view.selected.add(id);rememberSelection();renderAll();}
function cancelSelection() {if(!active)return;active.view.selecting=false;active.view.selected.clear();rememberSelection();renderAll();}
function selectedRecords() {return active.messages.filter(m=>active.view.selected.has(m.id));}
function renderSelection() {
  const bar=$('selection-bar'),s=active;bar.hidden=!s?.view.selecting;bar.replaceChildren();if(bar.hidden)return;
  const count=s.view.selected.size;bar.append(el('span','selection-description',`${count} / ${s.messages.length} selected`));
  bar.append(button('Select all',null,()=>{const ids=layout.items.map(p=>p.message.id);for(const id of ids)s.view.selected.add(id);rememberSelection();renderAll();},'select-all'));
  const controls=el('div','selection-controls');
  controls.append(button('Copy selected','copy',()=>safeRun(()=>copyRecords(s,selectedRecords()))),button('Export selected','export',()=>safeRun(()=>exportRecords(s,selectedRecords()))),
    button('Selection options','more',event=>showMenu([['Clear message statuses','select',()=>statusDialog(new Set(s.view.selected))],['Merge selected','merge',()=>mergeDialog()]],event)),
    button('Delete selected','trash',()=>deleteCards(s,new Set(s.view.selected)),'icon-button danger'),button('Cancel selection','close',cancelSelection));
  for(const node of [...controls.children].slice(0,4))node.disabled=!count||!writable(s);bar.append(controls);
}
function togglePin(s,id) {
  const ids=MosaicModel.pins(s.settings);const next=ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
  return update(s,{settings:{...s.settings,pinnedMessageIds:next}});
}
function showMenu(items,event) {
  hideMenu();menu.replaceChildren();menu.className='menu';menu.setAttribute('role','menu');menu.removeAttribute('aria-label');
  for(const item of items){if(!item){menu.append(el('hr'));continue;}const [label,icon,action,danger]=item;const b=button(label,icon,()=>{hideMenu();safeRun(action);},danger?'danger':'');b.append(el('span','',label));b.setAttribute('role','menuitem');menu.append(b);}
  placeMenu(event);
}
function placeMenu(event) {
  menu.hidden=false;
  const anchor=(event?.currentTarget||$('more-button')).getBoundingClientRect();
  const x=event?.clientX||anchor.right,y=event?.clientY||anchor.bottom;
  const rect=menu.getBoundingClientRect();menu.style.left=Math.max(10,Math.min(x-rect.width+20,innerWidth-rect.width-10))+'px';menu.style.top=Math.max(10,Math.min(y+7,innerHeight-rect.height-10))+'px';
  menu.querySelector('button')?.focus({preventScroll:true});
}
function hideMenu(){menu.hidden=true;}
function colorMenu(id,event) {
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  hideMenu();menu.replaceChildren();menu.className='menu color-menu';menu.setAttribute('role','group');menu.setAttribute('aria-label','Card background colors');
  const grid=el('div','color-grid'),current=MosaicModel.color(message,dark.matches).id;
  for(const preset of MosaicModel.colors){
    const swatch=button(preset.name,preset.id==='default'?'noColor':null,()=>{
      hideMenu();if(active!==s||!writable(s))return;
      const source=s.messages.find(m=>m.id===id);if(!source||(preset.id==='default'?!Object.hasOwn(source,'cardColor'):source.cardColor===preset.id))return;
      const next={...source};if(preset.id==='default')delete next.cardColor;else next.cardColor=preset.id;
      safeRun(()=>update(s,{messages:s.messages.map(m=>m.id===id?next:m)}));
    },'color-swatch');
    swatch.setAttribute('aria-pressed',String(preset.id===current));
    swatch.style.setProperty('--swatch',preset[dark.matches?'dark':'light']||'var(--surface)');
    if(preset.id===current)swatch.append(mosaicIcon('check'));grid.append(swatch);
  }
  menu.append(grid);placeMenu(event);
}
function labelDialog(id) {
  const s=active;if(!writable(s))return;
  const message=s.messages.find(m=>m.id===id);if(!message)return;
  const d=openModal('labels','Labels');
  const options=el('div','label-options');d.root.append(options);
  function changeLabel(tag,enabled){
    if(active!==s||!writable(s))return;
    const source=s.messages.find(m=>m.id===id);if(!source)return;
    const reactions=enabled?[...new Set([...source.reactions,tag])]:source.reactions.filter(value=>value!==tag);
    const settings={...s.settings,reactionOrder:[...new Set([...MosaicModel.tags(s.messages,s.settings),tag])],deletedEmojis:(s.settings.deletedEmojis||[]).filter(value=>value!==tag)};
    safeRun(()=>update(s,{messages:s.messages.map(m=>m.id===id?{...m,reactions}:m),settings}));
  }
  function option(tag,checked){
    const row=el('label','label-option'),check=el('input');check.type='checkbox';check.checked=checked;
    check.addEventListener('change',()=>changeLabel(tag,check.checked));row.append(check,el('span','',tag));options.append(row);
  }
  for(const tag of new Set([...MosaicModel.tags(s.messages,s.settings),...message.reactions]))option(tag,message.reactions.includes(tag));
  const create=el('form','new-label'),input=el('input');input.type='text';input.maxLength=32;input.placeholder='New label or emoji';input.setAttribute('aria-label','New label');
  const add=button('Add label','plus',null,'secondary-button');add.type='submit';
  create.append(input,add);create.addEventListener('submit',event=>{
    event.preventDefault();const tag=input.value.trim();if(!tag)return;
    const existing=[...options.querySelectorAll('label')].find(row=>row.textContent===tag);
    if(existing)existing.querySelector('input').checked=true;else option(tag,true);
    changeLabel(tag,true);input.value='';input.focus();
  });d.root.append(create);actions(d,[button('Done',null,()=>closeModal(),'primary-button')]);
}
function cardMenu(message,event) {
  const s=active,pinned=MosaicModel.pins(s.settings).includes(message.id);
  showMenu([['Edit','edit',()=>editCard(message.id)],['Add label','tag',()=>labelDialog(message.id)],['Reply','reply',()=>replyTo(message.id)],[pinned?'Unpin':'Pin',pinned?'unpin':'pin',()=>togglePin(s,message.id)],
    ['Copy text','copy',()=>copyRecords(s,[message])],['Export','export',()=>exportRecords(s,[message])],['Select','select',()=>startSelection(message.id)],null,['Delete','trash',()=>deleteCards(s,new Set([message.id])),true]],event);
}
function mainMenu(event) {
  if(!active)return;const s=active;
  showMenu([['Import from clipboard','import',()=>importDialog()],['Export all cards','export',()=>exportRecords(s,s.messages)],['Select cards','select',()=>startSelection()],
    ['Clear message statuses','select',()=>statusDialog(null)],['Clear clipboard','trash',()=>clearClipboardDialog()],null,
    ...(latestUnfinished(s.note.uuid)?[['Resume unfinished edit','edit',()=>editCard(latestUnfinished(s.note.uuid).id)]]:[]),['About Mosaic','info',()=>aboutDialog()]],event);
}
function openModal(kind,title) {
  closeModal(true);const root=$('modal-content');root.replaceChildren();const heading=el('div','dialog-heading'),h=el('h2','',title);h.id='dialog-title';
  const state={kind,uuid:active?.note.uuid,root,error:null,busy:false};modalState=state;
  heading.append(h,button('Close','close',()=>closeModal()));root.append(heading);modal.showModal();return state;
}
function dialogError(record,text) {
  if(modalState!==record)return;if(!record.error){record.error=el('p','dialog-error');record.error.setAttribute('role','alert');record.root.append(record.error);}record.error.textContent=text;
}
function closeModal(force=false) {
  if(!force&&modalState?.busy)return;
  if(!force)stashEdit();
  if(modal.open)modal.close();modalState=null;
}
function stashEdit() {
  const d=modalState;if(!d||d.kind!=='edit'||!d.currentText||!active||d.uuid!==active.note.uuid)return;
  if(d.currentText!==d.original||JSON.stringify([...d.tags])!==JSON.stringify(d.originalTags))unfinishedEdits.set(editKey(d.uuid,d.id),{noteId:d.uuid,id:d.id,original:d.original,text:d.currentText,tags:[...d.tags]});
}
function actions(record,items) {const row=el('div','dialog-actions');for(const item of items)row.append(item);record.root.append(row);return row;}
function confirmAction(title,description,label,action,danger=false) {
  const d=openModal('confirm',title);d.root.append(el('p','dialog-help',description));
  const confirm=button(label,null,async()=>{
    d.busy=true;confirm.disabled=true;cancel.disabled=true;
    try{await action();if(modalState===d)closeModal(true);}catch(error){dialogError(d,error.message||'Saving was not confirmed. Use Retry save.');}
    finally{d.busy=false;confirm.disabled=false;cancel.disabled=false;}
  },danger?'secondary-button danger':'primary-button');
  const cancel=button('Cancel',null,()=>closeModal(),'secondary-button');actions(d,[cancel,confirm]);cancel.focus();return d;
}
function editorDialog(id=null) {
  if(!id){$('capture-input').focus();return;}
  const s=active;if(!writable(s)){notify('This note is read only until the notice above is resolved.');return;}
  const message=s.messages.find(m=>m.id===id);if(!message)return;
  const stashed=unfinishedEdits.get(editKey(s.note.uuid,id));
  const restored=stashed?.id===id&&stashed.original===message?.text?stashed:null;
  const original=message.text,parts=MosaicModel.split(restored?.text??original);
  const d=openModal('edit','Edit card');Object.assign(d,{id,original,currentText:restored?.text??original,tags:new Set(restored?.tags??message.reactions),originalTags:message.reactions,fieldRevision:0,sending:false});
  if(stashed&&!restored){
    d.root.append(el('p','dialog-help','This card changed after your unfinished edit. Your earlier edit is available here to copy before you continue.'));
    const earlier=el('textarea','transfer-text');earlier.readOnly=true;earlier.value=stashed.text;earlier.setAttribute('aria-label','Earlier unfinished edit');d.root.append(earlier);
  }
  const title=el('input','editor-title');title.type='text';title.placeholder='Title';title.setAttribute('aria-label','Card title');title.value=parts.title;title.autocomplete='off';
  const body=el('textarea','editor-body');body.placeholder='Text';body.setAttribute('aria-label','Card body');body.value=parts.body;
  d.root.append(title,body);
  const tags=el('div','editor-tags');
  const tagButton=tag=>{const b=button(tag,null,()=>{d.tags.has(tag)?d.tags.delete(tag):d.tags.add(tag);d.fieldRevision++;b.setAttribute('aria-pressed',String(d.tags.has(tag)));},'editor-tag');b.setAttribute('aria-label','Tag '+tag);b.setAttribute('aria-pressed',String(d.tags.has(tag)));return b;};
  for(const tag of [...new Set([...MosaicModel.tags(s.messages,s.settings),...d.tags])])tags.append(tagButton(tag));
  const custom=el('input','new-tag');custom.placeholder='Add emoji';custom.setAttribute('aria-label','Add emoji tag');custom.maxLength=32;
  custom.addEventListener('keydown',event=>{if(event.key==='Enter'&&custom.value.trim()){event.preventDefault();const tag=custom.value.trim();d.tags.add(tag);tags.insertBefore(tagButton(tag),custom);custom.value='';d.fieldRevision++;}});tags.append(custom);d.root.append(tags);
  const submit=button('Save changes',null,()=>safeRun(saveEditor),'primary-button');d.submit=submit;
  const close=button('Close',null,()=>closeModal(),'secondary-button');actions(d,[close,submit]);
  const change=()=>{
    d.fieldRevision++;d.currentText=MosaicModel.join(original,title.value,body.value);submit.disabled=!d.currentText.trim()||d.sending;
  };
  title.addEventListener('input',change);body.addEventListener('input',change);
  body.enterKeyHint='send';title.enterKeyHint='send';
  bindSubmitField(body,()=>submit.click());
  bindSubmitField(title,()=>submit.click(),{newline:()=>{
    const suffix=title.value.slice(title.selectionEnd);title.value=title.value.slice(0,title.selectionStart);
    body.value=suffix+(body.value?'\n'+body.value:'');change();body.focus();body.setSelectionRange(0,0);
  }});
  async function saveEditor() {
    if(active!==s||modalState!==d)return;
    if(!writable(s)){dialogError(d,'Saving is paused. Your edit is still here; review the saved version before continuing.');return;}
    if(d.sending){await persist(s);return;}
    if(!d.currentText.trim())return;
    const submitted=d.currentText,submittedTags=[...d.tags],revision=d.fieldRevision;
    const source=s.messages.find(m=>m.id===id);if(!source||source.text!==d.original){dialogError(d,'This card changed since you opened it. Your text is still here; copy it before reopening the card.');return;}
      const edited={...imFormat.editMessage(source,submitted),reactions:submittedTags};
      if(submitted===source.text&&JSON.stringify(edited.reactions)===JSON.stringify(source.reactions)){if(restored)unfinishedEdits.delete(editKey(s.note.uuid,id));closeModal(true);return;}
    const next=s.messages.map(m=>m.id===id?edited:m);
    const tagOrder=[...new Set([...(s.settings.reactionOrder||MosaicModel.tags(s.messages,s.settings)),...d.tags])];
    d.sending=true;d.busy=true;submit.disabled=true;
    const saving=update(s,{messages:next,settings:{...s.settings,reactionOrder:tagOrder}});
    s.intents.add({revision:s.revision,finish:()=>{
      const stored=unfinishedEdits.get(editKey(s.note.uuid,id));
      if(stored?.text===submitted&&JSON.stringify(stored.tags)===JSON.stringify(submittedTags))unfinishedEdits.delete(editKey(s.note.uuid,id));
      if(modalState!==d)return;
      d.sending=false;d.busy=false;submit.disabled=false;
      submit.textContent='Save changes';submit.setAttribute('aria-label',submit.textContent);submit.title=submit.textContent;
      if(d.error){d.error.remove();d.error=null;}
      if(d.fieldRevision===revision){closeModal(true);notify('Card updated.');}
      else{d.original=submitted;d.originalTags=submittedTags;notify('Card saved. Your newer typing is still here.');}
    }});
    try{await saving;}catch{
      d.busy=false;submit.disabled=false;submit.textContent='Retry save';
      submit.setAttribute('aria-label','Retry save');submit.title='Retry save';
      dialogError(d,'Saving was not confirmed. Your text is still here. Retry save before closing.');
    }
  }
  submit.disabled=!d.currentText.trim();setTimeout(()=>title.focus(),0);
}
function editCard(id){editorDialog(id);}
function readCard(id) {
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message)return;
  const d=openModal('read','Card'),parts=MosaicModel.split(message.text);
  if(message.replyTo){const quote=button('Show quoted card',null,()=>{closeModal();jumpTo(message.replyTo);},'reply-preview');quote.textContent=message.replyTo.text||'Quoted message';d.root.append(quote);}
  d.root.append(el('h3','reader-title',parts.title),el('div','reader-body',parts.body),el('p','reader-meta',metaText(message)));
  const tags=el('div','reader-tags');for(const tag of message.reactions)tags.append(el('span','card-tag',tag));d.root.append(tags);
  actions(d,[button('Copy text','copy',()=>safeRun(()=>copyRecords(s,[message])),'secondary-button'),button('Reply','reply',()=>replyTo(id),'secondary-button'),button('Edit','edit',()=>editCard(id),'primary-button')]);
}
function replyTo(id) {
  const s=active,message=s.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  closeModal();safeRun(()=>update(s,{reply:MosaicModel.reply(message,s.note.uuid)},false));$('capture-input').focus();
}
function jumpTo(reply) {
  const s=active,target=MosaicModel.target(s.messages,reply,s.note.uuid);if(!target){notify('The original message is not in this note. The quoted text is still preserved.');return;}
  s.view.query='';s.view.tag='';s.view.pinned=false;$('search').value='';renderAll();
  const item=layout.items.find(p=>p.message.id===target.id);if(!item)return;
  const origin=board.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
  viewport.scrollTop=origin+item.y-(viewport.clientHeight-item.height)/2;renderWindow();
  const node=mounted.get(target.id);node?.classList.add('located');setTimeout(()=>node?.classList.remove('located'),2100);
}
function deleteCards(s,ids) {
  if(!ids.size||!writable(s))return;
  confirmAction(`Delete ${ids.size===1?'this card':ids.size+' cards'}?`,'This removes the selected text from this note. There is no trash folder in Mosaic.','Delete',async()=>{
    const next=s.messages.filter(m=>!ids.has(m.id));const pins=MosaicModel.pins(s.settings).filter(id=>!ids.has(id));
    for(const id of ids)s.view.selected.delete(id);rememberSelection();
    await update(s,{messages:next,settings:{...s.settings,pinnedMessageIds:pins}});
  },true);
}
function applyTransferMarks(s){
  const intents=transferMarks.get(s?.note.uuid);
  if(!intents||!writable(s)||s.error)return Promise.resolve();
  const next=s.messages.map(message=>{
    const intent=intents.get(message.id);if(!intent||intent.text!==message.text)return message;
    let result=message;for(const flag of intent.flags)if(!message[flag])result={...result,[flag]:true};return result;
  });
  let pending=Promise.resolve();
  if(next.some((message,i)=>message!==s.messages[i]))pending=update(s,{messages:next});
  transferMarks.delete(s.note.uuid);return pending;
}
function mark(s,records,flag) {
  const uuid=s.note.uuid,intents=transferMarks.get(uuid)||new Map();
  for(const record of records){
    const old=intents.get(record.id),flags=old?.text===record.text?old.flags:new Set();flags.add(flag);
    intents.set(record.id,{text:record.text,flags});
  }
  transferMarks.set(uuid,intents);
  return active?.note.uuid===uuid?applyTransferMarks(active):Promise.resolve();
}
async function copyRecords(s,records) {
  if(!records.length)return;
  const text=records.map(m=>m.text).join('\n\n');
  if(await imWriteClipboard(text)){notify('Copied to clipboard.');await mark(s,records,'copied');}
  else manualCopyDialog(s,records,text,'copied');
}
async function exportRecords(s,records) {
  if(!records.length){notify('There are no cards to export.');return;}
  const text=imTransfer.create(records.map(m=>({...m,exported:true})),s.settings,s.note.uuid);
  if(await imWriteClipboard(text)){notify('Export copied. Open another note and choose Import from clipboard.');await mark(s,records,'exported');}
  else manualCopyDialog(s,records,text,'exported');
}
function manualCopyDialog(s,records,text,flag) {
  if(active!==s)return;
  const d=openModal('copy',flag==='exported'?'Export cards':'Copy text');d.root.append(el('p','dialog-help','Automatic copying was blocked. Select and copy the text below, or try the Copy button.'));
  const field=el('textarea','transfer-text');field.value=text;field.readOnly=true;field.setAttribute('aria-label','Text to copy');d.root.append(field);
  let marked=false;
  // Only a successful programmatic clipboard write marks status. A browser's
  // ordinary copy event cannot prove the system clipboard accepted the text.
  actions(d,[button('Close',null,()=>closeModal(),'secondary-button'),button('Copy',null,async()=>{if(await imWriteClipboard(text)){if(!marked){marked=true;safeRun(()=>mark(s,records,flag));}notify('Copied to clipboard.');}else dialogError(d,'Clipboard access is still blocked. You can select the text and copy it manually.');},'primary-button')]);
  field.focus();field.select();
}
function importDialog() {
  const s=active;if(!writable(s))return;
  const d=openModal('import','Import');d.root.append(el('p','dialog-help','Paste an export from Mosaic or the IM-style editor. Your existing cards will be kept.'));
  const field=el('textarea','transfer-text');field.placeholder='Paste your exported messages here…';field.setAttribute('aria-label','Import text');d.root.append(field);
  const summary=el('p','dialog-help','');d.root.append(summary);
  const apply=async clear=>{
    const payload=imTransfer.read(field.value);if(!payload.ok){dialogError(d,payload.error);return;}
    if(active!==s||modalState!==d)return;
    const merged=imTransfer.merge(s.messages,payload);d.busy=true;normal.disabled=true;combined.disabled=true;
    try{await update(s,{messages:merged.messages});if(modalState===d){closeModal(true);notify(`${merged.added.length} imported${merged.skipped?', '+merged.skipped+' duplicates skipped':''}.`);if(clear)clearClipboardDialog();}}
    catch{dialogError(d,'Import saving was not confirmed. The imported text is still available. Keep this editor open and use Retry save.');}
    finally{d.busy=false;normal.disabled=false;combined.disabled=false;}
  };
  const normal=button('Import',null,()=>safeRun(()=>apply(false)),'primary-button');
  const combined=button('Import and clear clipboard',null,()=>safeRun(()=>apply(true)),'secondary-button danger');
  actions(d,[button('Cancel',null,()=>closeModal(),'secondary-button'),normal,combined]);
  const preview=()=>{const parsed=imTransfer.read(field.value);summary.textContent=parsed.ok?`${parsed.messages.length} cards ready to import.`:field.value?'Paste a complete message export.':'';};field.addEventListener('input',preview);
  // Reading is requested only after the user explicitly opens Import.
  const initial=field.value;try{navigator.clipboard.readText().then(text=>{if(modalState===d&&field.value===initial){field.value=text;preview();}}).catch(()=>{});}catch{}
  field.focus();
}
function clearClipboardDialog() {
  confirmAction('Clear your clipboard?','This empties the current clipboard. Clipboard history and other devices are outside Mosaic’s control.','Clear clipboard',async()=>{if(!await imClearClipboard())throw new Error('Clipboard clearing was blocked by this app. Your clipboard has not been confirmed cleared.');notify('Clipboard cleared.');},true);
}
function statusDialog(ids) {
  const s=active;if(!writable(s))return;const d=openModal('statuses','Clear message statuses');
  d.root.append(el('p','dialog-help',ids?`${ids.size} selected cards. Text, tags, pins and timestamps are kept.`:'All cards in this note, including cards hidden by filters. Text, tags, pins and timestamps are kept.'));
  const options=el('div','status-options'),flags=new Set();
  for(const [key,label] of Object.entries({copied:'Copied',exported:'Exported',imported:'Imported',edited:'Edited'})){
    const row=el('label'),check=el('input');check.type='checkbox';check.addEventListener('change',()=>{check.checked?flags.add(key):flags.delete(key);save.disabled=!flags.size;});row.append(check,document.createTextNode(label));options.append(row);
  }
  d.root.append(options);const save=button('Clear selected statuses',null,async()=>{
    d.busy=true;save.disabled=true;try{await update(s,{messages:MosaicModel.clearStatuses(s.messages,flags,ids)});if(modalState===d)closeModal(true);notify('Statuses cleared.');}
    catch(error){dialogError(d,error.message);}finally{d.busy=false;save.disabled=false;}
  },'primary-button');save.disabled=true;actions(d,[button('Cancel',null,()=>closeModal(),'secondary-button'),save]);
}
function mergeDialog() {
  const s=active,ids=new Set(s.view.selected),records=s.messages.filter(m=>ids.has(m.id));if(records.length<2){notify('Select at least two cards to merge.');return;}
  const preview=records.map(m=>m.text).join('\n\n'),snapshot=JSON.stringify(records);
  const d=confirmAction(`Merge ${records.length} cards?`,'Text will stay in its original IM order, separated by a blank line. Tags and pins are combined. Copied and Exported reset.','Merge selected',async()=>{
    if(JSON.stringify(s.messages.filter(m=>ids.has(m.id)))!==snapshot)throw new Error('These cards changed. Open a fresh merge preview.');
    const result=MosaicModel.merge(s.messages,s.settings,ids,s.note.uuid);s.view.selected=new Set([result.id]);rememberSelection();await update(s,result);
  });
  const field=el('textarea','transfer-text');field.readOnly=true;field.value=preview;field.setAttribute('aria-label','Merged card preview');d.root.insertBefore(field,d.root.lastChild);
}
function recoveryDialog(s) {
  const d=openModal('recovery','Review your text');d.root.append(el('p','dialog-help','Copy this text somewhere safe before closing the editor. Mosaic will not automatically overwrite a different saved version.'));
  const field=el('textarea','transfer-text');field.readOnly=true;field.value=s.note.content.text||'';field.setAttribute('aria-label','Current local note text');d.root.append(field);
  actions(d,[button('Close',null,()=>closeModal(),'secondary-button'),button('Copy local text',null,async()=>{if(await imWriteClipboard(field.value))notify('Local text copied.');else{field.focus();field.select();dialogError(d,'Automatic copying was blocked. Copy the selected text manually.');}},'primary-button')]);
  if(s.remote){d.root.append(el('p','dialog-help','Standard Notes also supplied this saved version:'));const remote=el('textarea','transfer-text');remote.value=s.remote.content?.text||'';remote.readOnly=true;remote.setAttribute('aria-label','Standard Notes version');d.root.append(remote);
    actions(d,[button('Use Standard Notes version',null,()=>confirmAction('Use the saved version?','Copy your local text first. This discards the unconfirmed local changes shown above.','Use saved version',()=>receive(s.remote,true),true),'secondary-button danger')]);}
}
function aboutDialog() {
  const d=openModal('about','Mosaic · '+MOSAIC_VERSION);
  d.root.append(el('p','about-copy','Each card is the same message your IM-style editor reads: first line as the title, everything below as the body. There is no separate copy of your notes.'));
  d.root.append(el('p','about-copy','Your note content is saved through Standard Notes. Mosaic has no analytics, independent cloud service, or browser-storage copy. Saving still submits a complete note; very large active notes can reach Standard Notes’ sync limits.'));
  d.root.append(el('p','about-copy','New-card drafts save as you type. For an existing card edit, choose Save changes before switching editors. Unfinished edits remain available while this editor stays open.'));
  const p=el('p','about-copy'),a=el('a','','Source, installation & privacy details');a.href='https://github.com/joshuazang/IM-style-editor/tree/main/mosaic';a.target='_blank';a.rel='noopener noreferrer';p.append(a);d.root.append(p);
}
function demo() {
  if(pf.component.sessionKey)return;
  const thoughts=[
    ['Reading notes','Start a list of passages to revisit.\nKeep questions alongside the page numbers.',['📓']],
    ['The evidence exam','Start with the problem, not the pile.\n\nToday: revisit the cases on hearsay. Write one clear example for each exception.',['1️⃣','📚']],
    ['A cabinet of curiosities','Deep-sea maps, lost observatories, impossible creatures. A place for the questions that lead somewhere unexpected.',['💡']],
    ['Today','Finish the evidence outline.\nRead the assigned cases.',['📍']],
    ['Weekend, slowly','Find a quiet café.\nBring the book with the folded corner.\nLeave room for nothing in particular.',['📓']],
    ['Project notes','Search above the cards.\nUse emoji to group related notes.',['💡']],
    ['Reading list','The Book of Disquiet\nA Field Guide to Getting Lost\nThe Order of Time',['📚']],
    ['A question for tomorrow','What is the smallest useful next step?',['2️⃣']],
    ['Completed','Reading for this week.\nFirst draft of the case summary.',['✅']],
    ['Ocean, after dark','Lanternfish, silent submarines, a notebook full of half-drawn constellations.',['📓']],
    ['Essay outline','Introduction\nMain argument\nCounterargument\nConclusion',[]],
    ['The idea parking lot','A better desk lamp.\nA short essay about attention.\nA walking route with no destination.',['3️⃣','💡']],
    ['A sentence to keep','“Attention is the beginning of devotion.”',['📍']],
    ['For the next study session','Open the outline. Read one page. Start with ten minutes.',['1️⃣']]
  ];
  const messages=thoughts.map(([title,body,reactions],i)=>({id:imFormat.newId(),text:title+'\n'+body,reactions,createdAt:new Date(Date.now()-(i+1)*36e5).toISOString(),...(i===1?{edited:true}:{})}));
  const settings={reactionOrder:['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'],pinnedMessageIds:[messages[3].id,messages[1].id]};
  receive({uuid:'mosaic-demo',mosaicDemo:true,content_type:'Note',content:{title:'Sample notes',text:imFormat.portable(messages,settings,'')}});
  active.demo=true;renderAll();
}

$('search-icon').append(mosaicIcon('search'));$('pin-filter-icon').append(mosaicIcon('pin'));$('more-button').append(mosaicIcon('more'));
$('more-button').addEventListener('click',mainMenu);
$('capture-input').addEventListener('input',inputCapture);
$('capture-input').addEventListener('compositionstart',()=>{if(active)active.composing=true;});
$('capture-input').addEventListener('compositionend',()=>{
  const s=active;if(!s)return;s.composing=false;
  // The final input event may follow compositionend in the same browser task.
  setTimeout(()=>{
    if(active!==s)return;
    if($('capture-input').value!==MosaicModel.normalized(s.captureValue))inputCapture();
    const request=s.submitAfterComposition;s.submitAfterComposition=null;
    if(request)safeRun(()=>submitCapture(s,request.tag));
  },0);
});
bindSubmitField($('capture-input'),()=>safeRun(()=>submitCapture()),{composing:()=>!!active?.composing});
let outsideCapture=null;
document.addEventListener('pointerdown',event=>{
  outsideCapture=document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice')?{session:active,tag:active?.view.tag,x:event.clientX,y:event.clientY}:null;
},true);
document.addEventListener('pointercancel',()=>outsideCapture=null,true);
document.addEventListener('pointermove',event=>{if(outsideCapture&&Math.hypot(event.clientX-outsideCapture.x,event.clientY-outsideCapture.y)>9)outsideCapture=null;},true);
document.addEventListener('pointerup',()=>{const pending=outsideCapture;setTimeout(()=>{if(outsideCapture===pending)outsideCapture=null;},700);},true);
document.addEventListener('click',event=>{
  const pending=outsideCapture;outsideCapture=null;
  if(pending?.session===active)safeRun(()=>submitCapture(pending.session,pending.tag));
  else if(document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice'))safeRun(()=>submitCapture());
},true);
$('pinned-filter').addEventListener('click',()=>{if(active){active.view.pinned=!active.view.pinned;viewport.scrollTop=0;renderAll();}});
$('search').addEventListener('input',event=>{if(active){active.view.query=event.target.value;viewport.scrollTop=0;renderAll();}});
$('empty-action').addEventListener('click',()=>{if(!active)return;if(active.view.query||active.view.tag||active.view.pinned){Object.assign(active.view,{query:'',tag:'',pinned:false});$('search').value='';renderAll();}else editorDialog();});
$('preview-button').addEventListener('click',demo);
viewport.addEventListener('scroll',scheduleWindow,{passive:true});
let lastWidth=0;new ResizeObserver(()=>{if(board.clientWidth!==lastWidth){lastWidth=board.clientWidth;rebuildLayout();}}).observe(viewport);
dark.addEventListener('change',()=>rebuildLayout());
document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!event.target.closest('#more-button,.more-card,.palette-card'))hideMenu();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(!menu.hidden){event.preventDefault();hideMenu();return;}
    if(modal.open)return;
    if(active?.view.selecting){event.preventDefault();cancelSelection();}
  }
  if(!menu.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
  }
});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{if(event.target===modal){const box=modal.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeModal();}});
window.addEventListener('beforeunload',event=>{if(retainedSessions.size||unfinishedEdits.size||(modalState?.kind==='edit'&&modalState.currentText!==modalState.original)){event.preventDefault();event.returnValue='';}});
renderAll();
if(window.parent===window&&new URLSearchParams(location.search).get('preview')==='1')demo();
