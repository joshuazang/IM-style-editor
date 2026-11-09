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
const isIPhone=/\biPhone\b/i.test(navigator.userAgent);
document.documentElement.classList.toggle('is-iphone',isIPhone);
const modal=$('modal'), menu=$('menu'), viewport=$('viewport'), board=$('board');
let active=null, modalState=null, toastTimer, frame=0, searchOpen=false, menuFromTouch=false, menuPress=false, dateOpen=false, layout={items:[],headings:[],height:0,count:0};
let mounted=new Map(), selectionPreferences=Object.create(null), searchPanelFit=null;
let dragPreview=null;
const boardMotion=new MosaicBoardMotion(board,viewport);
const boardDrag=new MosaicBoardDrag({board,viewport,
  canStart:()=>writable()&&!active.view.selecting&&!modal.open&&menu.hidden,
  canContinue:()=>!!dragPreview&&dragPreview.session===active&&writable()&&!active.view.selecting&&!modal.open&&menu.hidden,
  onClearCapture:()=>{outsideCapture=null;window.getSelection()?.removeAllRanges();},
  onStart:id=>{if(!writable())return false;dragPreview={session:active,id,settings:active.settings,pins:new Set(MosaicModel.pins(active.settings))};return true;},
  getLayout:()=>layout,
  hitRect:item=>mounted.get(item.message.id)?.getBoundingClientRect(),
  candidates:y=>{
    const nearby=MosaicModel.visible(layout,y-400,y+400),seen=new Set(nearby.map(item=>item.message.id));
    // A moving card can still be visible far from its final layout position.
    for(const id of mounted.keys()){const item=layout.byId.get(id);if(item&&!seen.has(id)){nearby.push(item);seen.add(id);}}
    return nearby.length?nearby:y<0?layout.items.slice(0,3):layout.items.slice(-3);
  },
  getBounds:()=>{const bounds=viewport.getBoundingClientRect();return {top:bounds.top,bottom:Math.min(bounds.bottom,$('capture-composer').getBoundingClientRect().top-8)};},
  sameSection:(id,target)=>dragPreview.pins.has(id)===dragPreview.pins.has(target),
  getSlot:id=>{const item=layout.byId?.get(id),origin=board.getBoundingClientRect();return item?{left:origin.left+item.x,top:origin.top+item.y}:null;},
  onPreview:(id,target,after)=>{
    const s=active;let settings=MosaicModel.moveCard(s.messages,dragPreview.settings,id,target,after);
    if(settings===dragPreview.settings)settings=MosaicModel.moveCard(s.messages,dragPreview.settings,id,target,!after);
    if(settings===dragPreview.settings)return;
    const before=boardMotion.snapshot(mounted);dragPreview.settings=settings;reflowBoard();boardMotion.move(before,mounted);
  },
  onDrop:()=>{
    const preview=dragPreview;dragPreview=null;
    if(preview?.session!==active||!writable())return;
    const current=MosaicModel.ordered(active.messages,active.settings),next=MosaicModel.ordered(active.messages,preview.settings);
    // Keep the preview's measured geometry on drop instead of rebuilding it
    // from estimates while the lifted card is landing.
    if(next.some((message,i)=>message.id!==current[i].id))safeRun(()=>update(active,{settings:preview.settings},false));
    else renderWindow();
  },
  onCancel:redraw=>{const before=redraw?boardMotion.snapshot(mounted):null;dragPreview=null;if(redraw){reflowBoard();boardMotion.move(before,mounted);}},
  onSettled:()=>renderWindow()
});
const viewMemory=new Map(), unfinishedEdits=new Map();
// Only unconfirmed sessions and deferred status intents survive note switches.
// Both are working memory; no text or recovery copy is written to browser storage.
const retainedSessions=new Map(), transferMarks=new Map();
const editKey=(uuid,id)=>JSON.stringify([uuid,id]);
function latestUnfinished(uuid){let latest;for(const entry of unfinishedEdits.values())if(entry.noteId===uuid)latest=entry;return latest;}
const saveFeedback=new ImSaveFeedback(()=>renderStatus());
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
/* A hold only arms the menu. Release opens it; movement/cancellation never does. */
function bindContextMenu(node,open,canHold=()=>true) {
  let gesture=null,timer=0,suppressUntil=0;
  const cancel=()=>{clearTimeout(timer);timer=0;gesture=null;};
  node.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||event.isPrimary===false||event.target.closest('button,input,textarea,select,#menu')||!canHold())return;
    cancel();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,scroll:viewport.scrollTop,ready:false};const current=gesture;
    timer=setTimeout(()=>{
      if(gesture!==current||!node.isConnected||!canHold()){cancel();return;}
      window.getSelection()?.removeAllRanges();current.ready=true;outsideCapture=null;timer=0;
    },520);
  });
  node.addEventListener('pointermove',event=>{if(gesture&&event.pointerId===gesture.id&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>10)cancel();});
  node.addEventListener('pointerup',event=>{
    const held=gesture;
    if(!held||held.id!==event.pointerId)return;
    cancel();if(!held.ready||!canHold()||Math.abs(viewport.scrollTop-held.scroll)>2)return;
    suppressUntil=performance.now()+800;outsideCapture=null;
    open({clientX:held.x,clientY:held.y,currentTarget:node,anchor:node.getBoundingClientRect(),touch:true});
  });
  for(const name of ['pointercancel','pointerleave'])node.addEventListener(name,cancel);
  node.addEventListener('click',event=>{if(performance.now()<suppressUntil&&event.detail!==0&&!event.target.closest('#menu')){event.preventDefault();event.stopImmediatePropagation();}},true);
  node.addEventListener('contextmenu',event=>{
    if(event.target.closest('#menu'))return;
    const touch=!!gesture||event.pointerType==='touch'||(matchMedia('(pointer:coarse) and (hover:none)').matches&&event.pointerType!=='mouse');
    if(touch&&event.target.closest('input,textarea,select'))return;
    event.preventDefault();if(!touch)open(event);
  });
}
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
  if(active&&(active.note.uuid!==note.uuid||!note.isMetadataUpdate&&active.note.content.text!==(note.content?.text||'')&&!knownSessionText(active,note.content?.text||''))){boardDrag.reset();boardMotion.reset();}
  if(note.isMetadataUpdate===true){const s=active?.note.uuid===note.uuid?active:retainedSessions.get(note.uuid);if(s)imNoteMetadataReceived(s.note,note);return;}
  if(active?.note.uuid===note.uuid&&!force){
    const s=active,text=note.content?.text||'';
    if(s.note.content?.text===text||((s.pending||s.error)&&knownSessionText(s,text))){
      receiveNativeFields(s,note);return;
    }
    const editing=modalState?.kind==='edit'&&modalState.uuid===note.uuid&&(modalState.currentText!==modalState.original||modalState.titleValue!==modalState.originalTitle||JSON.stringify([...modalState.tags])!==JSON.stringify(modalState.originalTags));
    if(s.pending||s.error||s.dirty||editing||s.titleEntry){s.remote=note;retainedSessions.set(note.uuid,s);imCancelQueuedNoteSaves(note.uuid);renderNotice();return;}
  }
  const previous=active;if(previous?.titleEntry)retainedSessions.set(previous.note.uuid,previous);
  if(previous){previous.view.scroll=viewport.scrollTop;viewMemory.set(previous.note.uuid,previous.view);stashEdit();}
  closeModal(true);hideMenu();dateOpen=false;$('date-panel').replaceChildren();
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
  active=s;dateOpen=false;$('date-panel').replaceChildren();imNoteReceived(note);
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
    if(revision===s.revision){s.error='';s.dirty=false;s.nativeRepair=false;if(!s.titleEntry)retainedSessions.delete(s.note.uuid);}
    for(const intent of [...s.intents])if(intent.revision<=revision){s.intents.delete(intent);intent.finish();}
    if(active===s)safeRun(()=>applyTransferMarks(s));
  },error=>{
    if(!s.discarded&&revision===s.revision){s.error='Saving was not confirmed. Keep this editor open and retry. Your text is still here.';s.dirty=true;retainedSessions.set(s.note.uuid,s);}
    throw error;
  }).finally(()=>{s.pending--;if(!s.pending&&!s.dirty&&!s.error&&!s.remote&&!s.titleEntry)retainedSessions.delete(s.note.uuid);if(active===s){renderStatus();renderNotice();}});
}
function update(s, change, redraw=true) {
  if(!writable(s))throw new Error('Saving is paused. Your original note is unchanged.');
  boardDrag.cancel(false);
  const previousIds=redraw?new Set(s.messages.map(m=>m.id)):null;
  const added=redraw&&change.messages?change.messages.filter(m=>!previousIds.has(m.id)).map(m=>m.id):[];
  const before=added.length?boardMotion.snapshot(mounted):null;
  if(added.length)boardMotion.queue(added);
  const messages=change.messages??s.messages,settings=change.settings??s.settings;
  const draft=Object.hasOwn(change,'draft')?change.draft:s.draft,reply=Object.hasOwn(change,'reply')?change.reply:s.reply;
  imFormat.write(s.note,messages,settings,draft,reply);
  Object.assign(s,{messages:messages===s.messages?s.messages:imFormat.readMessages(s.note),settings:imFormat.readSettings(s.note),draft:imFormat.readDraft(s.note),reply:imFormat.readReply(s.note)});
  const promise=persist(s);
  if(s===active){if(redraw){renderAll(!!before);if(before)boardMotion.move(before,mounted);}else renderCapture();}
  return promise;
}
function retrySave() {if(active)safeRun(()=>persist(active));}
function renderStatus() {
  const node=$('save-status'),s=active;
  const text=saveFeedback.update(s?.note.uuid,!!s?.pending,!!(s?.error||s?.remote||s?.damaged||s?.deleted||s?.view.selecting));
  node.classList.add('ui-save-feedback');node.classList.toggle('saving',text==='Saving…');
  node.textContent=s?.demo?'Preview · not saved':text;node.hidden=!node.textContent;
  node.title=text==='Saved'?'Accepted by Standard Notes':'';
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
  const s=active,field=$('capture-input'),value=MosaicModel.normalized(s?.titleEntry?.text??s?.captureValue??'');
  field.setAttribute('aria-label',s?.titleEntry?'Title':'Take a note');field.placeholder=s?.titleEntry?'Write a title…':'Take a note…';
  if(field.value!==value)field.value=value;
  field.disabled=!writable();growCapture();
  const quote=$('capture-reply');quote.replaceChildren();quote.hidden=!s?.reply&&!s?.titleEntry;
  if(s?.titleEntry){const source=s.messages.find(m=>m.id===s.titleEntry.id);quote.append(el('strong','','Title for card'),el('span','inline-quote',source?.text.slice(0,160)||'Card'),button('Cancel title entry','close',()=>{s.titleEntry=null;if(!s.dirty&&!s.pending)retainedSessions.delete(s.note.uuid);renderCapture();},'icon-button'));}
  else if(s?.reply){
    const text=button('Show quoted card',null,()=>jumpTo(s.reply),'inline-quote');text.textContent=s.reply.text.replace(/\s+/g,' ').slice(0,160)||'Quoted message';
    quote.append(text,button('Cancel reply','close',()=>safeRun(()=>update(s,{reply:null},false)),'icon-button danger'));
  }
}
function growCapture(){const field=$('capture-input');field.style.height='0px';field.style.height=Math.min(180,Math.max(46,field.scrollHeight))+'px';scheduleWindow();}
function inputCapture(){
  const s=active;if(!writable(s))return;
  const value=$('capture-input').value;
  if(s.titleEntry){s.titleEntry.text=value;return;}
  s.captureValue=value===MosaicModel.normalized(s.captureOriginal)?s.captureOriginal:value;s.captureRevision++;
  safeRun(()=>update(s,{draft:s.captureValue},false));
}
function submitCapture(s=active,tag=s?.view.tag){
  if(s?.titleEntry){if(s.composing){s.submitAfterComposition={title:true};return Promise.resolve();}return submitTitle(s);}
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
  const placed=layout.byId?.get(message.id);
  if(placed){
    const origin=board.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
    viewport.scrollTo({top:Math.max(0,origin+placed.y-64),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
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
function beginTitle(id){
  const s=active,source=s?.messages.find(m=>m.id===id);if(!source||!writable(s))return;
  if(s.titleEntry&&s.titleEntry.id!==id){hideMenu();notify('Finish or cancel the current title entry first.');return;}
  if(!s.titleEntry)s.titleEntry={id,text:imFormat.title(source),original:imFormat.title(source),pending:false};retainedSessions.set(s.note.uuid,s);hideMenu();renderCapture();$('capture-input').focus();
}
function submitTitle(s){
  const entry=s.titleEntry;if(!writable(s)||!entry||entry.pending)return Promise.resolve();
  const source=s.messages.find(m=>m.id===entry.id),text=entry.text;
  if(!source||imFormat.title(source)!==entry.original&&imFormat.title(source)!==entry.submitted)throw new Error('This title changed. Your entry is retained; review before saving.');
  entry.pending=true;entry.submitted=text.trim()?text:'';
  const saving=update(s,{messages:s.messages.map(m=>m.id===entry.id?imFormat.withTitle(m,text):m)});
  s.intents.add({revision:s.revision,finish:()=>{entry.pending=false;entry.original=text.trim()?text:'';if(s.titleEntry===entry&&entry.text===text)s.titleEntry=null;if(active===s)renderCapture();}});
  return saving.catch(error=>{entry.pending=false;throw error;});
}
function renderTags() {
  const box=$('tag-filters');box.replaceChildren();if(!active)return;
  const s=active;
  const add=(tag,label,icon)=>{
    const node=button(label,icon,()=>{s.view.tag=s.view.tag===tag?'':tag;s.view.scroll=0;viewport.scrollTop=0;searchOpen=false;renderAll();},'tag-chip'+(tag==='__untagged__'?' untagged':''));
    if(!icon){node.replaceChildren(el('span','',tag?label:'All'));}
    node.setAttribute('aria-label',tag==='__untagged__'?'Untagged cards':tag?'Filter by '+tag:'All tags');node.setAttribute('aria-pressed',String(s.view.tag===tag));
    box.append(node);
  };
  add('','All tags');
  const tags=MosaicModel.tags(s.messages,s.settings),pos=Number.isInteger(s.settings.untaggedPosition)?Math.max(0,Math.min(tags.length,s.settings.untaggedPosition)):tags.length;
  tags.splice(pos,0,'__untagged__');for(const tag of tags)add(tag,tag,tag==='__untagged__'?'untagged':null);
}
function renderAll(inserting=false) {
  boardDrag.cancel(false);
  const s=active;renderAppearance();renderStatus();renderNotice();renderCapture();renderTags();
  $('welcome').hidden=!!s;$('more-button').disabled=!s;$('search-button').disabled=!s;$('pinned-filter').disabled=!s;$('search').disabled=!s;
  $('pinned-filter').setAttribute('aria-pressed',String(!!s?.view.pinned));
  renderSearchControls();refreshEditorMetadata();
  $('app').classList.toggle('selection-mode',!!s?.view.selecting);
  rebuildLayout(inserting);renderSelection();
}
function renderAppearance() {
  const root=document.documentElement,{palette,fontSize}=MosaicModel.appearance(active?.settings),font=MosaicModel.fontSizes[fontSize];
  const scale=typeof active?.settings.scale==='number'&&Number.isFinite(active.settings.scale)&&active.settings.scale>0?active.settings.scale:1.12;
  root.style.setProperty('--scale',String(scale));
  if(root.dataset.mosaicPalette!==palette)root.dataset.mosaicPalette=palette;
  if(root.dataset.mosaicFontSize!==fontSize)root.dataset.mosaicFontSize=fontSize;
  for(const [key,value] of Object.entries(font))if(typeof value==='number'){
    const name='--type-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),next=value+'px';
    if(root.style.getPropertyValue(name)!==next)root.style.setProperty(name,next);
  }
}
function rebuildLayout(inserting=false) {
  const anchor=inserting?null:findAnchor();
  layout=active?MosaicModel.layout(active.messages,active.settings,Math.max(1,board.clientWidth),active.view.query,active.view.tag,active.view.pinned,active.view.selecting):{items:[],headings:[],height:0,count:0};
  board.style.height=layout.height+'px';board.replaceChildren();mounted.clear();
  for(const heading of layout.headings){const node=el('div','section-heading',heading.label);node.style.top=heading.y+'px';board.append(node);}
  const filtered=active&&(active.view.query||active.view.tag||active.view.pinned);
  $('empty').hidden=!active||!!layout.count||active.damaged||!filtered;
  if(anchor){const next=layout.byId?.get(anchor.id);if(next)viewport.scrollTop+=next.y-anchor.y;}
  renderWindow();
}
function reflowBoard() {
  const s=active;if(!s)return;
  layout=MosaicModel.layout(s.messages,dragPreview?.session===s?dragPreview.settings:s.settings,Math.max(1,board.clientWidth),s.view.query,s.view.tag,s.view.pinned,s.view.selecting);
  board.style.height=layout.height+'px';
  for(const [i,node] of [...board.querySelectorAll('.section-heading')].entries())if(layout.headings[i])node.style.top=layout.headings[i].y+'px';
  renderWindow();
}
function findAnchor() {
  const top=viewport.getBoundingClientRect().top,origin=board.getBoundingClientRect().top;
  const item=MosaicModel.visible(layout,top-origin,top-origin+viewport.clientHeight).find(p=>p.y+origin+p.height>top&&p.y+origin<top+viewport.clientHeight);
  return item?{id:item.message.id,y:item.y}:null;
}
function scheduleWindow() {if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderWindow();});}
function renderWindow() {
  const top=viewport.getBoundingClientRect().top-board.getBoundingClientRect().top,low=top-550,high=top+viewport.clientHeight+550,fontSize=MosaicModel.appearance(active?.settings).fontSize;
  const visible=new Set(),measurements=[];
  for(const item of MosaicModel.visible(layout,low,high)){
    visible.add(item.message.id);
    let node=mounted.get(item.message.id);
    if(!node){node=cardNode(item.message,item.width);mounted.set(item.message.id,node);board.append(node);}
    node.classList.toggle('is-drag-placeholder',!!boardDrag.placeholder(item.message.id));
    node.classList.toggle('is-compact',item.width<230);
    const geometry=item.width+':'+fontSize;
    Object.assign(node.style,{width:item.width+'px',height:node.dataset.geometry===geometry?item.height+'px':'auto',transform:`translate(${item.x}px,${item.y}px)`});
    if(node.dataset.geometry!==geometry){
      node.dataset.geometry=geometry;node.style.removeProperty('--board-title-lines');node.style.removeProperty('--board-body-lines');
      measurements.push({node,item});
    }
  }
  for(const [id,node] of mounted)if(!visible.has(id)){node.remove();mounted.delete(id);}
  // Body text owns the standard preview allowance. Titles, replies and tags
  // add height outside it; they never change the body's visible line count.
  const previewLimit=({node,item})=>{
    const title=node.querySelector('.card-title'),body=node.querySelector('.card-body');
    const bounds=MosaicModel.boardBounds(item.width,fontSize),available=bounds.maximum-bounds.padding;
    const bodyStyle=body&&getComputedStyle(body),titleStyle=title&&getComputedStyle(title);
    const bodyLine=bodyStyle?parseFloat(bodyStyle.lineHeight):0,titleLine=titleStyle?parseFloat(titleStyle.lineHeight):0;
    const titleLines=title?Math.max(1,Math.floor(available/titleLine)):0;
    return {node,titleLines,bodyLines:body?Math.max(1,Math.floor(available/bodyLine)):0};
  };
  const limits=measurements.map(previewLimit);
  for(const {node,titleLines,bodyLines} of limits){node.style.setProperty('--board-title-lines',titleLines);node.style.setProperty('--board-body-lines',bodyLines);}
  // Measure only newly mounted/resized previews, in one read batch. Reuse those
  // real heights on future layouts rather than leaving guessed empty space.
  let changed=false;const selecting=!!active?.view.selecting;
  const sizes=measurements.map(({node,item})=>{
    const truncated=[...node.querySelectorAll('.card-title,.card-body')].some(field=>field.scrollHeight>field.clientHeight+1);
    const body=node.querySelector('.card-body'),bodyTruncated=body&&body.scrollHeight>body.clientHeight+1;
    const bounds=MosaicModel.boardBounds(item.width,fontSize),filler=bodyTruncated?Math.max(0,bounds.maximum-bounds.padding-body.clientHeight):0;
    return {node,item,truncated,height:Math.ceil(node.getBoundingClientRect().height+filler)};
  });
  for(const {node,item,truncated,height} of sizes){
    node.classList.toggle('is-truncated',truncated);
    if(truncated)node.style.height=height+'px';
    const measured=MosaicModel.measure(item.message,item.width,node.classList.contains('is-pinned'),selecting,height,fontSize);
    if(measured&&(height!==item.height))changed=true;
  }
  if(changed){
    const anchor=findAnchor(),s=active,locatedY=s.locatedId?layout.byId.get(s.locatedId)?.y:null,atBottom=viewport.scrollHeight-viewport.clientHeight-viewport.scrollTop<=4;
    layout=MosaicModel.layout(s.messages,dragPreview?.session===s?dragPreview.settings:s.settings,Math.max(1,board.clientWidth),s.view.query,s.view.tag,s.view.pinned,s.view.selecting);
    board.style.height=layout.height+'px';
    for(const [index,heading] of layout.headings.entries())board.querySelectorAll('.section-heading')[index].style.top=heading.y+'px';
    for(const [id,node] of mounted){const item=layout.byId.get(id);if(item)Object.assign(node.style,{height:item.height+'px',transform:`translate(${item.x}px,${item.y}px)`});}
    if(s.locatedId&&!boardDrag.dragging&&locatedY!=null){const next=layout.byId.get(s.locatedId);if(next&&Math.abs(next.y-locatedY)>.5)viewport.scrollTop+=next.y-locatedY;}
    else if(!s.locatedId&&!boardDrag.dragging){
      if(atBottom)viewport.scrollTop=viewport.scrollHeight;
      else if(anchor){const next=layout.byId.get(anchor.id);if(next&&Math.abs(next.y-anchor.y)>.5)viewport.scrollTop+=next.y-anchor.y;}
    }
    scheduleWindow();
  }
  boardMotion.reveal(mounted);
}
function metaText(message) {
  const bits=[];if(message.copied)bits.push('Copied');if(message.exported)bits.push('Exported');if(MosaicModel.isImported(message))bits.push('Imported');
  if(message.createdAt&&!Number.isNaN(new Date(message.createdAt).getTime()))bits.push(new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(message.createdAt)));
  if(message.edited)bits.push('Edited');return bits.join(' · ');
}
function renderSearchControls() {
  renderDateControls();
  const s=active,selecting=!!s?.view.selecting,filtered=!!s&&(s.view.query||s.view.tag||s.view.pinned);
  $('search-tags-panel').hidden=!searchOpen||selecting;$('search-button').setAttribute('aria-expanded',String(searchOpen&&!selecting));$('change-filter').setAttribute('aria-expanded',String(searchOpen&&!selecting));
  if(searchOpen&&!selecting){const header=document.querySelector('.board-toolbar'),panel=$('search-tags-panel');panel.style.top=(header.offsetTop+header.offsetHeight+6)+'px';if(!searchPanelFit)searchPanelFit=imWatchSearchPanel(panel);else searchPanelFit.update();}
  else if(searchPanelFit){searchPanelFit.destroy();searchPanelFit=null;}
  $('search-button').hidden=!!filtered||selecting;$('more-button').hidden=!!filtered||selecting;$('filter-pill').hidden=!filtered||selecting;
  const change=$('change-filter');change.replaceChildren();
  const symbol=el('span','filter-symbol ui-filter-symbol');
  if(s?.view.tag&&s.view.tag!=='__untagged__')symbol.textContent=s.view.tag;
  else symbol.append(s?.view.tag==='__untagged__'?mosaicToolbarIcon('untagged'):s?.view.pinned?mosaicIcon('pin'):mosaicToolbarIcon('searchOnly'));
  const check=el('span','filter-check ui-filter-check');check.append(mosaicToolbarIcon('check'));symbol.append(check);change.append(symbol);
}
function renderDateControls(){
 if(!searchOpen)dateOpen=false;
 $('date-filter-button').setAttribute('aria-expanded',String(dateOpen));
 const holder=$('date-panel');holder.hidden=!dateOpen;
 if(!dateOpen)holder.replaceChildren();
 else if(!holder.firstChild){const session=active;holder.append(imCreateDateJumpPanel({onJump:value=>{
  if(active!==session)return false;
  const target=imDateTarget(session.messages,value);if(!target)return false;
  searchOpen=false;dateOpen=false;
  jumpTo(MosaicModel.reply(target.message,session.note.uuid));
  const notice=imDateJumpNotice(target);if(notice)notify(notice);return true;
 },onClose:()=>{dateOpen=false;renderDateControls();}}));holder.firstChild.openPicker();}
}
$('date-filter-button').append(mosaicToolbarIcon('calendarSearch'));
$('date-filter-button').addEventListener('click',()=>{dateOpen=!dateOpen;renderDateControls();});
function toggleSearch() {searchOpen=!searchOpen;hideMenu();renderSearchControls();if(searchOpen)$('search').focus();}
function fillEmojiTag(badge,tag){
  badge.replaceChildren();
  // The same rounded vector body, pointed tail and transparent hole as IM.
  for(const [className,markup] of [
    ['emoji-tag-body','<rect width="100%" height="100%" rx="6"/><rect x="50%" width="50%" height="100%"/>'],
    ['emoji-tag-tip','<path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H2Q6 0 9 4L18 16Q22 20 18 24L9 36Q6 40 2 40H0ZM13 20a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0Z"/>']]){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class',className);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    if(className==='emoji-tag-tip')svg.setAttribute('viewBox','0 0 20 40');svg.innerHTML=markup;badge.append(svg);
  }
  badge.append(el('span','emoji-tag-emoji',tag));
}
function cardNode(message,width) {
  const s=active,parts=MosaicModel.preview(message),pinned=MosaicModel.pins(s.settings).includes(message.id);
  const node=el('article','card'+(pinned?' is-pinned':'')+(s.view.selected.has(message.id)?' selected':''));
  if(s.locatedId===message.id)node.classList.add('located');
  const color=MosaicModel.color(message);node.style.setProperty('--card-color',color.background);node.style.setProperty('--card-ink',color.ink);
  node.dataset.id=message.id;node.setAttribute('role','listitem');node.tabIndex=0;node.setAttribute('aria-label',MosaicModel.label(message));
  if(s.view.selecting){const check=el('span','selection-check');if(s.view.selected.has(message.id))check.append(mosaicIcon('check'));node.append(check);node.setAttribute('aria-label',(s.view.selected.has(message.id)?'Selected: ':'Select: ')+MosaicModel.label(message));}
  const activate=()=>{if(!menu.hidden)return;s.view.selecting?toggleSelection(message.id):writable(s)?editorDialog(message.id):readCard(message.id);};
  if(parts.title)node.append(el('h2','card-title',parts.title));
  if(message.replyTo)node.append(el('div','card-reply',message.replyTo.text.replace(/\s+/g,' ').slice(0,150)||'Quoted message'));
  if(parts.body)node.append(el('p','card-body',parts.body));
  if(message.reactions.length){
    const tags=el('div','card-tags');
    const tagCount=MosaicModel.boardTagCount(message,width,MosaicModel.appearance(s.settings).fontSize);
    for(const tag of message.reactions.slice(0,tagCount)){
      const badge=button('Filter messages by '+tag,null,()=>{
        if(active!==s)return;
        if(s.view.selecting){toggleSelection(message.id);return;}
        s.view.tag=tag;s.view.scroll=0;viewport.scrollTop=0;searchOpen=false;hideMenu();renderAll();
      },'card-tag');
      fillEmojiTag(badge,tag);tags.append(badge);
    }
    const remaining=message.reactions.length-tagCount;
    if(remaining>0){const more=button('Show '+remaining+' more tag'+(remaining===1?'':'s'),null,activate,'card-tag card-tag-overflow');more.textContent='+'+remaining;tags.append(more);}
    node.append(tags);
  }
  node.addEventListener('click',activate);
  node.addEventListener('keydown',event=>{
    if(event.target!==node)return;
    if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)&&!s.view.selecting&&writable(s)){
      event.preventDefault();
      if(event.repeat)return;
      const pinned=new Set(MosaicModel.pins(s.settings)),items=layout.items.filter(item=>pinned.has(item.message.id)===pinned.has(message.id)),i=items.findIndex(item=>item.message.id===message.id),direction=event.key==='ArrowUp'?-1:1,target=items[i+direction];
      if(target){const before=boardMotion.snapshot(mounted),settings=MosaicModel.moveCard(s.messages,s.settings,message.id,target.message.id,direction>0);safeRun(()=>update(s,{settings}));boardMotion.move(before,mounted);mounted.get(message.id)?.focus({preventScroll:true});}
      return;
    }
    if(event.key==='Enter'||event.key===' '){event.preventDefault();node.click();}
  });
  bindContextMenu(node,event=>{const current=s.messages.find(m=>m.id===message.id);if(current)cardMenu(current,event);},()=>active===s&&!s.view.selecting&&!boardDrag.placeholder(message.id));
  return node;
}
function toggleSelection(id) {const v=active.view,entering=!v.selecting;v.selecting=true;searchOpen=false;v.selected.has(id)?v.selected.delete(id):v.selected.add(id);rememberSelection();if(entering)renderAll();else{refreshSelectionCards();renderSelection();}}
function refreshSelectionCards(){for(const [id,node] of mounted){const selected=active.view.selected.has(id);node.classList.toggle('selected',selected);const check=node.querySelector('.selection-check');if(check){check.replaceChildren();if(selected)check.append(mosaicIcon('check'));}const message=layout.byId?.get(id)?.message;if(message)node.setAttribute('aria-label',(selected?'Selected: ':'Select: ')+MosaicModel.label(message));}}
function startSelection(id) {active.view.selecting=true;searchOpen=false;if(id)active.view.selected.add(id);rememberSelection();renderAll();}
function cancelSelection() {if(!active)return;active.view.selecting=false;active.view.selected.clear();rememberSelection();renderAll();}
function selectedRecords() {return active.messages.filter(m=>active.view.selected.has(m.id));}
function renderSelection() {
  const bar=$('selection-bar'),toolbar=$('selection-toolbar'),s=active;bar.hidden=toolbar.hidden=!s?.view.selecting;bar.replaceChildren();toolbar.replaceChildren();if(bar.hidden)return;
  const count=s.view.selected.size,controls=el('div','ui-selection-actions');controls.setAttribute('aria-label','Selected cards');
  const choices=[['tag','Add tags to selected cards',event=>batchTagMenu(event)],['copy','Copy selected',()=>safeRun(()=>copyRecords(s,selectedRecords()))],
    ['export','Export selected',()=>safeRun(()=>exportRecords(s,selectedRecords()))],['more','Selection options',event=>showMenu([['Merge selected','merge',()=>mergeDialog()],['Clear message statuses','select',()=>statusDialog(new Set(s.view.selected))]],event)],
    ['delete','Delete selected',()=>deleteCards(s,new Set(s.view.selected))]];
  for(const [kind,label,action] of choices){const control=button(label,null,action,'ui-selection-action'+(kind==='delete'?' selection-delete':''));control.replaceChildren(mosaicIcon(kind,true));control.disabled=!count||!writable(s);controls.append(control);}
  toolbar.append(controls);
  const all=button('Select all','selectAll',()=>{for(const item of layout.items)s.view.selected.add(item.message.id);rememberSelection();refreshSelectionCards();renderSelection();},'selection-all');
  const description=el('span','selection-description',`${count} / ${s.messages.length} selected`);description.setAttribute('role','status');
  const cancel=button('Cancel selection',null,cancelSelection,'selection-cancel');cancel.replaceChildren(mosaicIcon('cancel',true));bar.append(all,description,cancel);
  syncOverlayMetrics();
}
function syncOverlayMetrics() {
  const app=$('app'),capture=$('capture-composer');if(!capture)return;
  const height=Math.ceil(capture.getBoundingClientRect().height),bottom=parseFloat(getComputedStyle(capture).bottom)||24;
  const set=(key,value)=>{if(app.style.getPropertyValue(key)!==value)app.style.setProperty(key,value);};
  set('--notice-height',($('notice').hidden?0:$('notice').offsetHeight)+'px');
  set('--capture-clearance',(height+bottom+16)+'px');
  $('selection-bar').style.setProperty('--selection-row-height',Math.max(46,height)+'px');
  if(searchOpen)renderSearchControls();
}
function batchTagMenu(event) {
  const s=active,ids=new Set(s.view.selected);if(!ids.size||!writable(s))return;
  const records=s.messages.filter(m=>ids.has(m.id));hideMenu();menu.replaceChildren();menu.className='menu ui-context-menu';menu.setAttribute('role','group');menu.setAttribute('aria-label','Tags for selected cards');
  const panel=el('section','ui-tag-panel'),grid=el('div','ui-tag-grid');
  for(const tag of MosaicModel.tags(s.messages,s.settings)){
    const choice=button('Add '+tag+' to selected cards',null,()=>{
      hideMenu();if(active!==s||!writable(s))return;
      const messages=s.messages.map(m=>ids.has(m.id)&&!m.reactions.includes(tag)?{...m,reactions:[...m.reactions,tag]}:m);
      if(messages.some((m,i)=>m!==s.messages[i]))safeRun(()=>update(s,{messages}));
    },'ui-tag-choice');choice.textContent=tag;choice.setAttribute('aria-pressed',String(records.every(m=>m.reactions.includes(tag))));grid.append(choice);
  }
  panel.append(grid);menu.append(panel);placeMenu(event);
}
function togglePin(s,id) {
  const ids=MosaicModel.pins(s.settings);const next=ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
  return update(s,{settings:{...s.settings,pinnedMessageIds:next}});
}
function showMenu(items,event,{message,toggleTag}={}) {
  hideMenu();menu.replaceChildren();menu.className='menu ui-context-menu';menu.setAttribute('role','menu');menu.removeAttribute('aria-label');
  if(message){
    const panel=el('section','ui-tag-panel'),grid=el('div','ui-tag-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Emoji picker');
    for(const tag of new Set([...MosaicModel.tags(active.messages,active.settings),...message.reactions])){
      const choice=button('Tag '+tag,null,()=>{hideMenu();toggleTag(tag);},'ui-tag-choice');choice.textContent=tag;choice.setAttribute('aria-pressed',String(message.reactions.includes(tag)));grid.append(choice);
    }
    panel.append(grid);menu.append(panel);
  }
  const panel=el('div','ui-action-panel');
  for(const item of items){if(!item){panel.append(el('hr'));continue;}const [label,icon,action,danger]=item;const b=button(label,icon,()=>{hideMenu();safeRun(action);},danger?'danger':'');b.append(el('span','',label));b.setAttribute('role','menuitem');panel.append(b);}
  menu.append(panel);
  placeMenu(event);
}
function placeMenu(event) {
  (modal.open?$('modal-content'):document.body).append(menu);
  menu.style.maxHeight='';menu.style.maxWidth='';menuFromTouch=event?.touch===true;menuPress=false;
  menu.hidden=false;$('more-button').setAttribute('aria-expanded',String(event?.currentTarget===$('more-button')));
  const anchor=(event?.currentTarget||$('more-button')).getBoundingClientRect();
  const x=event?.clientX||anchor.right,y=event?.clientY||anchor.bottom;
  const rect=menu.getBoundingClientRect();menu.style.left=Math.max(10,Math.min(x-rect.width+20,innerWidth-rect.width-10))+'px';menu.style.top=Math.max(10,Math.min(y+7,innerHeight-rect.height-10))+'px';
  if(menuFromTouch){
    const visual=window.visualViewport,position=imMenuPosition({anchor:event.anchor,point:{x,y},width:rect.width,height:menu.scrollHeight+menu.offsetHeight-menu.clientHeight,viewport:{left:visual?.offsetLeft||0,top:visual?.offsetTop||0,width:visual?.width||innerWidth,height:visual?.height||innerHeight},touch:true});
    Object.assign(menu.style,{left:position.x+'px',top:position.y+'px',maxWidth:position.maxWidth+'px',maxHeight:position.maxHeight+'px'});
  }
  menu.tabIndex=-1;if(event?.currentTarget!==$('more-button'))menu.focus({preventScroll:true});
}
function hideMenu(){menu.hidden=true;$('more-button').setAttribute('aria-expanded','false');menuFromTouch=false;menuPress=false;if(menu.parentNode!==document.body)document.body.append(menu);}
function settleCardMotion(){
  const animation=modalState?.cardAnimation;
  if(animation?.playState==='running'&&!modalState.root.inert){animation.finish();animation.cancel();}
}
function colorMenu(id,event) {
  settleCardMotion();
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  hideMenu();menu.replaceChildren();menu.className='menu color-menu';menu.setAttribute('role','group');menu.setAttribute('aria-label','Card background colors');
  const grid=el('div','color-grid'),current=MosaicModel.color(message).id;
  for(const preset of MosaicModel.colors){
    const swatch=button(preset.name,preset.id==='default'?'noColor':null,()=>{
      hideMenu();if(active!==s||!writable(s))return;
      const source=s.messages.find(m=>m.id===id);if(!source||(preset.id==='default'?!Object.hasOwn(source,'cardColor'):source.cardColor===preset.id))return;
      const next={...source};if(preset.id==='default')delete next.cardColor;else next.cardColor=preset.id;
      safeRun(()=>update(s,{messages:s.messages.map(m=>m.id===id?next:m)}));
    },'color-swatch');
    swatch.setAttribute('aria-pressed',String(preset.id===current));
    swatch.style.setProperty('--swatch',preset.light||'var(--surface)');
    if(preset.id===current)swatch.append(mosaicIcon('check'));grid.append(swatch);
  }
  menu.append(grid);placeMenu(event);
}
function cardMenu(message,event) {
  settleCardMotion();
  const s=active,pinned=MosaicModel.pins(s.settings).includes(message.id);
  const editing=modalState?.kind==='edit'&&modalState.uuid===s.note.uuid&&modalState.id===message.id?modalState:null;
  const current=()=>s.messages.find(m=>m.id===message.id);
  const saved=action=>async()=>{if(editing&&!(await editing.commit(false)))return;return action();};
  showMenu([['Edit','edit',()=>editCard(message.id)],[imFormat.title(message)?'Edit title':'Add title','textSize',()=>{if(editing)editing.unlockTitle();else beginTitle(message.id);}],['Reply','reply',saved(()=>replyTo(message.id))],[pinned?'Unpin':'Pin',pinned?'unpin':'pin',()=>togglePin(s,message.id)],
    ['Copy','copy',saved(()=>copyRecords(s,[current()]))],['Select','select',saved(()=>{closeModal(true);startSelection(message.id);})],null,['Delete','trash',saved(()=>deleteCards(s,new Set([message.id]))),true]],event,{
    message:editing?{...message,reactions:[...editing.tags]}:message,
    toggleTag:tag=>{
      if(editing){editing.toggleTag(tag);return;}
      const source=current();if(source)safeRun(()=>update(s,{messages:s.messages.map(m=>m.id===source.id?{...m,reactions:m.reactions.includes(tag)?m.reactions.filter(value=>value!==tag):[...m.reactions,tag]}:m)}));
    }
  });
}
function mainMenu(event) {
  if(!menu.hidden&&$('more-button').getAttribute('aria-expanded')==='true'){hideMenu();return;}
  if(!active)return;const s=active;searchOpen=false;renderSearchControls();
  showMenu([['Import from clipboard','import',()=>importDialog()],['Export all cards','export',()=>exportRecords(s,s.messages)],['Select cards','select',()=>startSelection()],
    ['Clear message statuses','select',()=>statusDialog(null)],['Clear clipboard','trash',()=>clearClipboardDialog()],null,
    ['Color palette','palette',()=>appearanceDialog('palette')],['Font size','textSize',()=>appearanceDialog('fontSize')],['Arrange tags','tag',()=>arrangeTagsDialog()],null,
    ...(Array.isArray(s.settings.mosaicCardOrder)?[['Reset card order','mosaic',()=>{const before=boardMotion.snapshot(mounted),settings={...s.settings};delete settings.mosaicCardOrder;safeRun(()=>update(s,{settings}));boardMotion.move(before,mounted);}]]:[]),
    ...(latestUnfinished(s.note.uuid)?[['Resume unfinished edit','edit',()=>editCard(latestUnfinished(s.note.uuid).id)]]:[]),['About Mosaic','info',()=>aboutDialog()]],event);
}
function arrangeTagsDialog(){
  const s=active,d=openModal('tags','Arrange tags'),list=el('div','tag-arrange-list');d.root.append(list);
  const form=el('form','tag-add-form'),input=el('input');input.placeholder='Add an emoji';input.maxLength=32;input.required=true;input.setAttribute('aria-label','Add an emoji category');
  const add=button('Add emoji',null,()=>{},'secondary-button');add.type='submit';form.append(input,add);d.root.append(form);
  actions(d,[button('Done',null,()=>closeModal(),'secondary-button')]);
  const valid=()=>active===s&&modalState===d&&writable(s);
  async function save(change,filter){
    if(d.busy||!valid())return;
    const focusLabel=document.activeElement?.getAttribute('aria-label'),focusInput=document.activeElement===input;
    d.busy=true;for(const node of d.root.querySelectorAll('button,input'))node.disabled=true;
    if(filter!==undefined)s.view.tag=filter;
    try{await update(s,change);if(modalState===d){input.value='';if(d.error){d.error.remove();d.error=null;}}}
    catch{dialogError(d,'Saving was not confirmed. Your tag changes are retained; close this panel and use Retry save.');}
    finally{d.busy=false;if(modalState===d){
      for(const node of d.root.querySelectorAll('button,input'))node.disabled=false;render();
      const focused=focusInput&&!input.disabled?input:[...d.root.querySelectorAll('button')].find(node=>!node.disabled&&node.getAttribute('aria-label')===focusLabel);
      (focused||d.root.querySelector('.dialog-actions button'))?.focus({preventScroll:true});
    }}
  }
  function render(){
    list.replaceChildren();const order=imFilterOrder(MosaicModel.tags(s.messages,s.settings),s.settings.untaggedPosition);
    for(const [index,tag] of order.entries()){
      const untagged=tag===imUntagged,label=untagged?'Untagged':tag,row=el('div','tag-arrange-row'+(untagged?' tag-arrange-untagged':''));
      const symbol=el('span','tag-arrange-symbol');if(untagged){symbol.append(mosaicIcon('untagged'),document.createTextNode('Untagged'));}else symbol.textContent=tag;row.append(symbol);
      for(const [delta,name,icon] of [[-1,'earlier','back'],[1,'later','arrow']]){
        const move=button('Move '+label+' '+name,icon,()=>safeRun(()=>save({settings:imEmojiMove(s.messages,s.settings,tag,delta)})),'icon-button');move.disabled=!writable(s)||(delta===-1?index===0:index===order.length-1);row.append(move);
      }
      if(!untagged)row.append(button('Edit '+tag,'edit',()=>replaceEmojiDialog(tag),'icon-button'),button('Delete '+tag,'trash',()=>{
        const count=MosaicModel.index(s.messages).counts.get(tag)||0;
        if(window.confirm(`Remove ${tag} from this note’s menu and ${count} card${count===1?'':'s'}? All cards and their text will be kept.`))safeRun(()=>save(imEmojiChange(s.messages,s.settings,tag),s.view.tag===tag?'':undefined));
      },'icon-button danger'));
      if(!writable(s))for(const control of row.querySelectorAll('button'))control.disabled=true;list.append(row);
    }
    input.disabled=add.disabled=!writable(s);
  }
  form.addEventListener('submit',event=>{event.preventDefault();try{const settings=imEmojiAdd(s.messages,s.settings,input.value);safeRun(()=>save({settings}));}catch(error){dialogError(d,error.message);}});render();
}
function replaceEmojiDialog(from){
  const s=active,d=openModal('replace-tag','Replace emoji'),form=el('form','tag-replace-form'),label=el('label','',`Replace ${from} with`),input=el('input');input.value=from;input.maxLength=32;input.required=true;input.setAttribute('aria-label','Replacement emoji');label.append(input);form.append(label);
  const count=MosaicModel.index(s.messages).counts.get(from)||0;form.append(el('p','dialog-help',`Updates tags on ${count} card${count===1?'':'s'}. All text and other tags stay unchanged.`));d.root.append(form);
  const row=el('div','dialog-actions'),cancel=button('Cancel emoji change',null,()=>arrangeTagsDialog(),'secondary-button'),save=button('Save emoji change',null,()=>{},'primary-button');save.type='submit';row.append(cancel,save);form.append(row);
  form.addEventListener('submit',event=>{event.preventDefault();safeRun(async()=>{
    if(d.busy||active!==s||modalState!==d||!writable(s))return;
    let to,change;try{to=imEmojiValue(input.value);change=imEmojiChange(s.messages,s.settings,from,to);}catch(error){dialogError(d,error.message);return;}d.busy=true;save.disabled=cancel.disabled=input.disabled=true;
    if(s.view.tag===from)s.view.tag=to;
    try{await update(s,change);if(active===s&&modalState===d)arrangeTagsDialog();}
    catch{dialogError(d,'Saving was not confirmed. Your change is retained; close this panel and use Retry save.');}
    finally{d.busy=false;if(modalState===d){cancel.disabled=false;save.disabled=input.disabled=!writable(s);}}
  });});input.focus();input.select();
}
function appearanceDialog(kind) {
  const s=active,key=kind==='palette'?'mosaicPalette':'mosaicFontSize',d=openModal('appearance',kind==='palette'?'Color palette':'Font size');
  d.root.append(el('p','dialog-help','For this note. Saved through Standard Notes.'));
  const choices=el('div','appearance-choices'),items=kind==='palette'?MosaicModel.palettes:Object.entries(MosaicModel.fontSizes).map(([id,value])=>({id,...value}));
  const controls=[];
  for(const item of items){
    const choice=button(item.name,null,async()=>{
      if(d.busy||active!==s||modalState!==d||!writable(s))return;
      if(MosaicModel.appearance(s.settings)[kind]===item.id)return;
      d.busy=true;controls.forEach(control=>control.disabled=true);
      try{await update(s,{settings:{...s.settings,[key]:item.id}});}
      catch(error){dialogError(d,'Saving was not confirmed. Keep this editor open and retry saving.');}
      finally{d.busy=false;if(modalState===d)for(const control of controls){control.disabled=!writable(s);control.setAttribute('aria-pressed',String(MosaicModel.appearance(s.settings)[kind]===control.dataset.value));}}
    },'appearance-choice');
    choice.replaceChildren();choice.dataset.value=item.id;choice.setAttribute('aria-pressed',String(MosaicModel.appearance(s.settings)[kind]===item.id));choice.disabled=!writable(s);
    if(kind==='palette'){const preview=el('span','palette-preview '+item.id);preview.setAttribute('aria-hidden','true');preview.append(el('span'));choice.append(preview);}
    const label=el('span','appearance-choice-label',item.name);if(item.description)label.append(el('small','',item.description));
    if(kind==='fontSize')label.style.fontSize=item.editBody+'px';
    choice.append(label);choices.append(choice);controls.push(choice);
  }
  d.root.append(choices);actions(d,[button('Done',null,()=>closeModal(),'secondary-button')]);
}
function openModal(kind,title) {
  stashEdit();closeModal(true);const root=$('modal-content');root.replaceChildren();modal.classList.toggle('card-edit-dialog',kind==='edit');const heading=el('div','dialog-heading'),h=el('h2','',title);h.id='dialog-title';
  const state={kind,uuid:active?.note.uuid,root,error:null,busy:false};modalState=state;
  heading.append(h,button('Close','close',()=>closeModal()));root.append(heading);modal.showModal();return state;
}
function dialogError(record,text) {
  if(modalState!==record)return;if(!record.error){record.error=el('p','dialog-error');record.error.setAttribute('role','alert');if(record.bottom)record.bottom.insertBefore(record.error,record.footer);else record.root.append(record.error);}record.error.textContent=text;
}
function closeModal(force=false) {
  if(!force&&modalState?.busy)return;
  if(!force&&modalState?.kind==='edit'&&modalState.commit){safeRun(()=>modalState.commit(true));return;}
  if(!force)stashEdit();
  if(modalState?.viewportResize){window.removeEventListener('resize',modalState.viewportResize);window.visualViewport?.removeEventListener('resize',modalState.viewportResize);window.visualViewport?.removeEventListener('scroll',modalState.viewportResize);modal.style.removeProperty('--card-view-height');modal.style.removeProperty('--card-view-top');}
  modalState?.cardAnimation?.cancel();if(modalState?.transitionSource)modalState.transitionSource.style.removeProperty('visibility');$('modal-content').inert=false;
  modalState?.layoutObserver?.disconnect();modalState?.scrollObserver?.disconnect();modalState?.tagObserver?.disconnect();modalState?.tagBadges?.remove();modal.style.removeProperty('--tag-overhang');
  hideMenu();if(modal.open)modal.close();modalState=null;
}
function stashEdit() {
  const d=modalState;if(!d||d.kind!=='edit'||!d.currentText||!active||d.uuid!==active.note.uuid)return;
  if(d.currentText!==d.original||d.titleValue!==d.originalTitle||JSON.stringify([...d.tags])!==JSON.stringify(d.originalTags))unfinishedEdits.set(editKey(d.uuid,d.id),{noteId:d.uuid,id:d.id,original:d.original,text:d.currentText,title:d.titleValue,originalTitle:d.originalTitle,titleUnlocked:d.titleUnlocked,tags:[...d.tags]});
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
function renderEditorTags(d){
  if(!d.tagBadges)return;
  d.tagBadges.replaceChildren();d.tagBadges.hidden=!d.tags.size;
  for(const tag of d.tags){const badge=el('span','card-tag');fillEmojiTag(badge,tag);badge.setAttribute('role','listitem');d.tagBadges.append(badge);}
  positionEditorTags(d);
}
function positionEditorTags(d){
  if(modalState!==d||!d.tagBadges)return;
  const extra=isIPhone||d.tagBadges.hidden?0:Math.max(0,Math.ceil(d.tagBadges.offsetHeight)-13),value=extra+'px';
  if(modal.style.getPropertyValue('--tag-overhang')!==value)modal.style.setProperty('--tag-overhang',value);
}
function refreshEditorMetadata() {
  const d=modalState,s=active;if(d?.kind!=='edit'||d.uuid!==s?.note.uuid||!d.meta)return;
  const message=s.messages.find(m=>m.id===d.id);if(!message)return;
  const color=MosaicModel.color(message);modal.style.setProperty('--edit-card-color',color.background);modal.style.setProperty('--edit-card-ink',color.ink);
  const pinned=MosaicModel.pins(s.settings).includes(message.id);d.pin.setAttribute('aria-label',pinned?'Unpin card':'Pin card');d.pin.title=pinned?'Unpin card':'Pin card';d.pin.setAttribute('aria-pressed',String(pinned));
  d.meta.replaceChildren();
  const add=(text,className='')=>{if(d.meta.childNodes.length)d.meta.append(el('span','metadata-separator',' · '));d.meta.append(el('span',className,text));};
  if(message.copied)add('Copied');if(message.exported)add('Exported');if(MosaicModel.isImported(message))add('Imported');
  if(message.createdAt&&!Number.isNaN(new Date(message.createdAt).getTime())){
    const text=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(message.createdAt));
    add(text,'card-timestamp');d.meta.querySelector('.card-timestamp').title=new Date(message.createdAt).toLocaleString();
  }
  if(message.edited)add('edited','card-edited');
  renderEditorTags(d);
}
function cardTransitionRect(node){
  if(!node?.isConnected)return null;
  const r=node.getBoundingClientRect(),v=viewport.getBoundingClientRect(),bottom=Math.min(v.bottom,$('capture-composer').getBoundingClientRect().top);
  const left=Math.max(r.left,v.left),top=Math.max(r.top,v.top),right=Math.min(r.right,v.right),end=Math.min(r.bottom,bottom);
  return right>left&&end>top?{left,top,width:right-left,height:end-top}:null;
}
function animateCard(d,closing=false){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
  if(closing&&d.cardAnimation?.playState==='running'){
    d.cardAnimation.reverse();return d.cardAnimation;
  }
  const node=mounted.get(d.id),source=closing?cardTransitionRect(node):d.sourceRect;
  const target=modal.getBoundingClientRect();
  if(!source||!target.width||!target.height)return null;
  d.cardAnimation?.cancel();
  if(node){node.style.visibility='hidden';d.transitionSource=node;}
  const small={transform:`translate(${source.left-target.left}px,${source.top-target.top}px) scale(${source.width/target.width},${source.height/target.height})`,borderRadius:'16px'},full={transform:'translate(0,0) scale(1,1)',borderRadius:isIPhone?'0px':'16px'};
  const animation=d.cardAnimation=modal.animate(closing?[full,small]:[small,full],{duration:320,easing:'cubic-bezier(.22,.8,.24,1)',fill:'both'});
  if(!closing)animation.onfinish=()=>{if(d.cardAnimation===animation)animation.cancel();};
  return animation;
}
function finishCard(d){
  if(modalState!==d)return;
  const animation=animateCard(d,true);
  if(!animation){closeModal(true);return;}
  d.busy=true;d.root.inert=true;
  animation.onfinish=()=>{if(modalState===d)closeModal(true);};
}
function editorDialog(id=null) {
  if(!id){$('capture-input').focus();return;}
  if(modalState?.kind==='edit'&&modalState.id===id&&modalState.uuid===active?.note.uuid){modalState.body.focus();return;}
  const s=active;if(s?.titleEntry){notify('Finish or cancel the current title entry first.');return;}if(!writable(s)){notify('This note is read only until the notice above is resolved.');return;}
  const message=s.messages.find(m=>m.id===id);if(!message)return;
  const stashed=unfinishedEdits.get(editKey(s.note.uuid,id));
  const restored=stashed?.id===id&&stashed.original===message.text&&(stashed.originalTitle??imFormat.title(message))===imFormat.title(message)?stashed:null;
  const original=message.text,originalTitle=imFormat.title(message),currentTitle=restored?.title??originalTitle;
  const sourceRect=cardTransitionRect(mounted.get(id));
  const d=openModal('edit','Edit card');d.sourceRect=sourceRect;Object.assign(d,{id,original,originalTitle,titleValue:currentTitle,titleUnlocked:restored?.titleUnlocked||false,currentText:restored?.text??original,tags:new Set(restored?.tags??message.reactions),originalTags:message.reactions,fieldRevision:0,sending:false,wantClose:false});
  const scroller=el('div','card-detail-scroll');d.scroll=scroller;d.root.append(scroller);
  if(stashed&&!restored){
    scroller.append(el('p','dialog-help','This card changed after your unfinished edit. Your earlier edit is available here to copy before you continue.'));
    const earlier=el('textarea','transfer-text');earlier.readOnly=true;earlier.value=stashed.text;earlier.setAttribute('aria-label','Earlier unfinished edit');scroller.append(earlier);
  }
  const title=el('textarea','editor-title');title.rows=1;title.placeholder='Title';title.setAttribute('aria-label','Card title');title.value=currentTitle;title.enterKeyHint='enter';title.hidden=!d.titleUnlocked;
  const titlePreview=el('h3','detail-title',currentTitle);titlePreview.hidden=!currentTitle||d.titleUnlocked;
  const body=el('textarea','editor-body');body.rows=1;body.placeholder='Text';body.setAttribute('aria-label','Card body');body.value=d.currentText;body.enterKeyHint='enter';d.body=body;
  // One scroller owns title, full-height body and trailing metadata. The toolbar
  // stays outside it; the textarea itself never reserves a second scrollbar.
  const revealEnd=()=>{const bottom=body.offsetTop+body.offsetHeight;if(bottom>scroller.scrollTop+scroller.clientHeight)scroller.scrollTop=bottom-scroller.clientHeight+8;};
  const growBody=(typing=false)=>{const top=scroller.scrollTop;body.style.height='0px';body.style.height=body.scrollHeight+'px';body.scrollTop=0;scroller.scrollTop=top;if(typing&&document.activeElement===body&&body.selectionEnd===body.value.length)revealEnd();d.updateScroll?.();};
  let measuredWidth=0;
  d.layoutObserver=new ResizeObserver(()=>{const width=body.clientWidth;if(width!==measuredWidth){measuredWidth=width;growBody();}});
  d.layoutObserver.observe(d.root);
  body.addEventListener('input',()=>growBody(true));
  body.addEventListener('keyup',event=>{if(event.key==='End'&&body.selectionEnd===body.value.length)revealEnd();if(event.key==='Home'&&body.selectionStart===0)scroller.scrollTop=body.offsetTop;});
  const pin=button('Pin card','pin',()=>safeRun(()=>togglePin(s,id)),'icon-button detail-pin');d.pin=pin;
  const header=el('div','card-detail-heading');header.append(titlePreview,title);scroller.append(header,body);
  d.unlockTitle=()=>{d.titleUnlocked=true;title.hidden=false;titlePreview.hidden=true;title.style.height='auto';title.style.height=title.scrollHeight+'px';growBody();hideMenu();title.focus();};
  d.tagBadges=el('div','card-detail-tags');d.tagBadges.setAttribute('role','list');d.tagBadges.setAttribute('aria-label','Emoji tags');modal.append(d.tagBadges);
  d.tagObserver=new ResizeObserver(()=>positionEditorTags(d));d.tagObserver.observe(d.tagBadges);
  d.toggleTag=tag=>{d.tags.has(tag)?d.tags.delete(tag):d.tags.add(tag);d.fieldRevision++;renderEditorTags(d);};
  d.meta=el('div','card-detail-meta');d.meta.setAttribute('aria-label','Card timestamp and statuses');scroller.append(d.meta);
  const footer=el('div','card-detail-tools');
  const palette=button('Background options','palette',event=>colorMenu(id,event));
  const more=button('Card options','more',event=>cardMenu(s.messages.find(m=>m.id===id),event),'icon-button detail-more');
  const close=button('Close',null,()=>safeRun(()=>saveEditor(true)),'detail-close');d.submit=close;
  footer.append(pin,palette,more,close);d.footer=footer;d.bottom=el('div','card-detail-bottom');if(isIPhone)d.bottom.append(d.tagBadges);d.bottom.append(footer);d.root.append(d.bottom);
  d.updateScroll=()=>{if(modalState===d)d.bottom.classList.toggle('has-content-below',scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop>1);};
  scroller.addEventListener('scroll',d.updateScroll,{passive:true});
  d.scrollObserver=new ResizeObserver(d.updateScroll);for(const element of [scroller,body,header,d.meta])d.scrollObserver.observe(element);
  const change=()=>{d.fieldRevision++;d.currentText=MosaicModel.normalized(body.value)===MosaicModel.normalized(original)?original:MosaicModel.normalized(body.value).replace(/\n/g,(/\r\n|\n|\r/.exec(original)||['\n'])[0]);d.titleValue=MosaicModel.normalized(title.value)===MosaicModel.normalized(currentTitle)?currentTitle:title.value;if(!title.hidden){title.style.height='auto';title.style.height=title.scrollHeight+'px';}d.updateScroll();};
  title.addEventListener('input',change);body.addEventListener('input',change);
  // Enter is ordinary multiline editing here; the capture field has its own send keys.
  bindContextMenu(d.root,event=>cardMenu(s.messages.find(m=>m.id===id),event),()=>active===s&&modalState===d);
  bindContextMenu(d.tagBadges,event=>cardMenu(s.messages.find(m=>m.id===id),event),()=>active===s&&modalState===d);
  d.commit=saveEditor;
  async function saveEditor(closeAfter=true) {
    if(active!==s||modalState!==d)return false;
    if(!writable(s)){dialogError(d,'Saving is paused. Your edit is still here; review the saved version before continuing.');return false;}
    d.wantClose=d.wantClose||closeAfter;
    if(d.sending){try{await persist(s);return !d.sending;}catch{return false;}}
    const submitted=d.currentText,submittedTitle=d.titleValue,submittedTags=[...d.tags],revision=d.fieldRevision;
    const source=s.messages.find(m=>m.id===id);if(!source||source.text!==d.original||imFormat.title(source)!==d.originalTitle){dialogError(d,'This card changed since you opened it. Your text is still here; copy it before reopening the card.');return false;}
    const edited=imFormat.withTitle({...imFormat.editMessage(source,submitted),reactions:submittedTags},submittedTitle);
    if(submitted===source.text&&imFormat.title(edited)===imFormat.title(source)&&JSON.stringify(edited.reactions)===JSON.stringify(source.reactions)){
      if(restored)unfinishedEdits.delete(editKey(s.note.uuid,id));if(d.wantClose)finishCard(d);return true;
    }
    const tagOrder=[...new Set([...(s.settings.reactionOrder||MosaicModel.tags(s.messages,s.settings)),...d.tags])];
    d.sending=true;d.busy=true;close.disabled=true;close.textContent='Saving…';
    const saving=update(s,{messages:s.messages.map(m=>m.id===id?edited:m),settings:{...s.settings,reactionOrder:tagOrder,deletedEmojis:(s.settings.deletedEmojis||[]).filter(tag=>!d.tags.has(tag))}});
    s.intents.add({revision:s.revision,finish:()=>{
      const stored=unfinishedEdits.get(editKey(s.note.uuid,id));if(stored?.text===submitted&&(stored.title??originalTitle)===submittedTitle&&JSON.stringify(stored.tags)===JSON.stringify(submittedTags))unfinishedEdits.delete(editKey(s.note.uuid,id));
      if(modalState!==d)return;
      d.sending=false;d.busy=false;close.disabled=false;close.textContent='Close';close.setAttribute('aria-label','Close');
      if(d.error){d.error.remove();d.error=null;}
      d.original=submitted;d.originalTitle=submittedTitle.trim()?submittedTitle:'';d.originalTags=submittedTags;
      if(d.wantClose&&d.fieldRevision===revision){finishCard(d);notify('Card updated.');}
      else{d.wantClose=false;refreshEditorMetadata();}
    }});
    try{await saving;return d.fieldRevision===revision;}catch{
      d.busy=false;close.disabled=false;close.textContent='Retry save';close.setAttribute('aria-label','Retry save');
      dialogError(d,'Saving was not confirmed. Your text is still here. Retry save before closing.');return false;
    }
  }
  if(isIPhone){
    d.viewportResize=()=>{if(modalState!==d)return;const view=window.visualViewport;modal.style.setProperty('--card-view-height',(view?.height||innerHeight)+'px');modal.style.setProperty('--card-view-top',(view?.offsetTop||0)+'px');};
    window.addEventListener('resize',d.viewportResize);window.visualViewport?.addEventListener('resize',d.viewportResize);window.visualViewport?.addEventListener('scroll',d.viewportResize);d.viewportResize();
  }
  refreshEditorMetadata();growBody();measuredWidth=body.clientWidth;animateCard(d);setTimeout(()=>{if(modalState===d){
    // iPhone opens in reading mode. A deliberate tap on the body/title still
    // uses native editing focus; other platforms keep immediate body editing.
    if(isIPhone)modal.focus({preventScroll:true});
    else{body.setSelectionRange(0,0);body.focus({preventScroll:true});}
    scroller.scrollTop=0;d.updateScroll();
  }},0);
}
function editCard(id){editorDialog(id);}
function readCard(id) {
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message)return;
  const d=openModal('read','Card'),parts=MosaicModel.preview(message);
  if(message.replyTo){const quote=button('Show quoted card',null,()=>{closeModal();jumpTo(message.replyTo);},'reply-preview');quote.textContent=message.replyTo.text||'Quoted message';d.root.append(quote);}
  d.root.append(el('h3','reader-title',parts.title),el('div','reader-body',parts.body),el('p','reader-meta',metaText(message)));
  const tags=el('div','reader-tags');for(const tag of message.reactions)tags.append(el('span','card-tag',tag));d.root.append(tags);
  actions(d,[button('Copy','copy',()=>safeRun(()=>copyRecords(s,[message])),'secondary-button'),button('Reply','reply',()=>replyTo(id),'secondary-button'),button('Edit','edit',()=>editCard(id),'primary-button')]);
}
function replyTo(id) {
  const s=active,message=s.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  closeModal(true);safeRun(()=>update(s,{reply:MosaicModel.reply(message,s.note.uuid)},false));$('capture-input').focus();
}
function jumpTo(reply) {
  const s=active,target=MosaicModel.target(s.messages,reply,s.note.uuid);if(!target){notify('The original message is not in this note. The quoted text is still preserved.');return;}
  s.locatedId=target.id;setTimeout(()=>{if(s.locatedId===target.id)s.locatedId=null;},2200);
  s.view.query='';s.view.tag='';s.view.pinned=false;$('search').value='';renderAll();
  const item=layout.byId?.get(target.id);if(!item)return;
  const origin=board.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
  const bounds=viewport.getBoundingClientRect(),top=Math.max(bounds.top,document.querySelector('.board-toolbar').getBoundingClientRect().bottom+12),bottom=Math.min(bounds.bottom,$(s.view.selecting?'selection-bar':'capture-composer').getBoundingClientRect().top-12);
  viewport.scrollTop=origin+item.y-(top-bounds.top)-Math.max(0,(bottom-top-item.height)/2);renderWindow();
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
  const d=openModal('copy',flag==='exported'?'Export cards':'Copy');d.root.append(el('p','dialog-help','Automatic copying was blocked. Select and copy the text below, or try the Copy button.'));
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
  const preview=imFormat.mergeText(records),snapshot=JSON.stringify(records);
  const d=confirmAction(`Merge ${records.length} cards?`,'Text will stay in its original IM order, separated by a blank line. Tags and pins are combined. Copied and Exported reset.','Merge selected',async()=>{
    if(JSON.stringify(s.messages.filter(m=>ids.has(m.id)))!==snapshot)throw new Error('These cards changed. Open a fresh merge preview.');
    const result=MosaicModel.merge(s.messages,s.settings,ids,s.note.uuid);s.view.selected=new Set([result.id]);rememberSelection();await update(s,result);
  });
  const field=el('textarea','transfer-text');field.readOnly=true;field.value=preview;field.setAttribute('aria-label','Merged card preview');d.root.insertBefore(field,d.root.lastChild);
}
function recoveryDialog(s) {
  const d=openModal('recovery','Review your text');d.root.append(el('p','dialog-help','Copy this text somewhere safe before closing the editor. Mosaic will not automatically overwrite a different saved version.'));
  const field=el('textarea','transfer-text');field.readOnly=true;field.value=s.note.content.text||'';field.setAttribute('aria-label','Current local note text');d.root.append(field);
  if(s.titleEntry){const title=el('textarea','transfer-text');title.readOnly=true;title.value=s.titleEntry.text;title.setAttribute('aria-label','Unfinished title');d.root.append(title);}
  for(const entry of unfinishedEdits.values())if(entry.noteId===s.note.uuid){const edit=el('textarea','transfer-text');edit.readOnly=true;edit.value=(entry.title?'title: '+JSON.stringify(entry.title)+'\n\n':'')+entry.text;edit.setAttribute('aria-label','Unfinished card edit');d.root.append(edit);}
  actions(d,[button('Close',null,()=>closeModal(),'secondary-button'),button('Copy local text',null,async()=>{if(await imWriteClipboard(field.value))notify('Local text copied.');else{field.focus();field.select();dialogError(d,'Automatic copying was blocked. Copy the selected text manually.');}},'primary-button')]);
  if(s.remote){d.root.append(el('p','dialog-help','Standard Notes also supplied this saved version:'));const remote=el('textarea','transfer-text');remote.value=s.remote.content?.text||'';remote.readOnly=true;remote.setAttribute('aria-label','Standard Notes version');d.root.append(remote);
    actions(d,[button('Use Standard Notes version',null,()=>confirmAction('Use the saved version?','Copy your local text first. This discards the unconfirmed local changes shown above.','Use saved version',()=>receive(s.remote,true),true),'secondary-button danger')]);}
}
function aboutDialog() {
  const d=openModal('about','Mosaic · '+MOSAIC_VERSION);
  d.root.append(el('p','about-copy','Each card is the same message your IM-style editor reads. All text is body text unless you explicitly add a title from its context menu. There is no separate copy of your notes.'));
  d.root.append(el('p','about-copy','Your note content is saved through Standard Notes. Mosaic has no analytics, independent cloud service, or browser-storage copy. Saving still submits a complete note; very large active notes can reach Standard Notes’ sync limits.'));
  d.root.append(el('p','about-copy','New-card drafts save as you type. Click a card to edit. Enter adds a line; Close saves. Use Close before switching editors. Unfinished edits remain available while this editor stays open.'));
  d.root.append(el('p','about-copy','Drag Board cards to arrange them. On a phone, hold still, then drag; release without moving to open the menu. With a card focused, Alt+Up/Down also changes its position. Pinned cards stay in their section. The arrangement affects Mosaic only and saves once on drop. Reset card order restores newest-first order.'));
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

$('pin-filter-icon').append(mosaicIcon('pin'));$('more-button').append(mosaicToolbarIcon('more'));
$('search-button').append(mosaicToolbarIcon('searchTags'));$('clear-filter').append(mosaicToolbarIcon('cancel'));
$('search-button').addEventListener('click',toggleSearch);$('change-filter').addEventListener('click',toggleSearch);
$('clear-filter').addEventListener('click',()=>{if(!active)return;Object.assign(active.view,{query:'',tag:'',pinned:false});$('search').value='';searchOpen=false;renderAll();});
$('more-button').addEventListener('click',mainMenu);
$('capture-input').addEventListener('input',inputCapture);
$('capture-input').addEventListener('compositionstart',()=>{if(active)active.composing=true;});
$('capture-input').addEventListener('compositionend',()=>{
  const s=active;if(!s)return;s.composing=false;
  // The final input event may follow compositionend in the same browser task.
  setTimeout(()=>{
    if(active!==s)return;
    if($('capture-input').value!==MosaicModel.normalized(s.titleEntry?.text??s.captureValue))inputCapture();
    const request=s.submitAfterComposition;s.submitAfterComposition=null;
    if(request)safeRun(()=>submitCapture(s,request.tag));
  },0);
});
bindSubmitField($('capture-input'),()=>safeRun(()=>submitCapture()),{composing:()=>!!active?.composing});
let outsideCapture=null;
document.addEventListener('pointerdown',event=>{
  outsideCapture=!active?.titleEntry&&document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice,#menu,.card-tag,#search-button,#change-filter,#search-tags-panel')?{session:active,tag:active?.view.tag,x:event.clientX,y:event.clientY}:null;
},true);
document.addEventListener('pointercancel',()=>outsideCapture=null,true);
document.addEventListener('pointermove',event=>{if(outsideCapture&&Math.hypot(event.clientX-outsideCapture.x,event.clientY-outsideCapture.y)>9)outsideCapture=null;},true);
document.addEventListener('pointerup',()=>{const pending=outsideCapture;setTimeout(()=>{if(outsideCapture===pending)outsideCapture=null;},700);},true);
document.addEventListener('click',event=>{
  const pending=outsideCapture;outsideCapture=null;
  if(active?.titleEntry||!menu.hidden||modal.open)return;
  if(pending?.session===active)safeRun(()=>submitCapture(pending.session,pending.tag));
  else if(document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice,#menu,.card-tag,#search-button,#change-filter,#search-tags-panel'))safeRun(()=>submitCapture());
},true);
$('pinned-filter').addEventListener('click',()=>{if(active){active.view.pinned=!active.view.pinned;viewport.scrollTop=0;searchOpen=false;renderAll();}});
$('search').addEventListener('input',event=>{if(active){active.view.query=event.target.value;viewport.scrollTop=0;renderAll();}});
$('search').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();searchOpen=false;renderSearchControls();viewport.focus();}});
$('empty-action').addEventListener('click',()=>{if(!active)return;if(active.view.query||active.view.tag||active.view.pinned){Object.assign(active.view,{query:'',tag:'',pinned:false});$('search').value='';renderAll();}else editorDialog();});
$('preview-button').addEventListener('click',demo);
// Scrolling is navigation, not an intention to hover a card. A fresh mouse
// movement restores hover after scrolling; a stationary cursor never lights up
// whichever card happens to move underneath it. No timers or saves are needed.
let boardScrollAt=0,boardMousePoint=null;
function suppressBoardHover(){boardScrollAt=performance.now();board.classList.add('is-scrolling');}
viewport.addEventListener('scroll',()=>{suppressBoardHover();scheduleWindow();},{passive:true});
viewport.addEventListener('wheel',suppressBoardHover,{passive:true});
viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')suppressBoardHover();},{passive:true});
viewport.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse')return;
  // movementX/Y can both be zero when entering an iframe. Client coordinates
  // distinguish a deliberate move from a stationary pointer during scrolling.
  const moved=!boardMousePoint||event.clientX!==boardMousePoint.x||event.clientY!==boardMousePoint.y;
  boardMousePoint={x:event.clientX,y:event.clientY};
  if(moved&&performance.now()-boardScrollAt>120)board.classList.remove('is-scrolling');
},{passive:true});
let lastWidth=0;const overlayObserver=new ResizeObserver(()=>{if(board.clientWidth!==lastWidth){lastWidth=board.clientWidth;rebuildLayout();}syncOverlayMetrics();});
for(const node of [viewport,$('capture-composer'),$('notice')])overlayObserver.observe(node);
menu.addEventListener('pointerdown',event=>{event.stopPropagation();menuPress=true;});
menu.addEventListener('click',event=>{if(menuFromTouch&&!menuPress&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();return;}menuPress=false;},true);
document.addEventListener('contextmenu',event=>{if(matchMedia('(pointer:coarse)').matches&&event.target.closest('button,[role="button"],.ui-selection-status'))event.preventDefault();},true);
document.addEventListener('pointerdown',event=>{
  if(!menu.hidden&&!menu.contains(event.target)&&!event.target.closest('#more-button,.more-card,.palette-card,.detail-more'))hideMenu();
  if(searchOpen&&!event.target.closest('#search-tags-panel,.board-toolbar')){searchOpen=false;renderSearchControls();}
});
document.addEventListener('keydown',event=>{
  if(!event.defaultPrevented&&!event.isComposing&&active&&!modal.open&&!active.view.selecting&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='f'){
    event.preventDefault();searchOpen=true;hideMenu();renderSearchControls();$('search').focus();$('search').select();return;
  }
  if(event.key==='Escape'){
    if(active?.titleEntry&&menu.hidden&&!modal.open){event.preventDefault();active.titleEntry=null;renderCapture();return;}
    if(!menu.hidden){event.preventDefault();hideMenu();return;}
    if(modal.open)return;
    if(searchOpen){event.preventDefault();searchOpen=false;renderSearchControls();return;}
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
