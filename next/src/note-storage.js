/* Per-note acknowledged writes. Coalesce waiting snapshots without reordering saves. */
const imNoteSaves = new Map();
let imConfirmedNote=null;
function imNoteSavePending(uuid) { return imNoteSaves.has(uuid); }
function imNoteSnapshot(note) {
  const item=pf.jsonObjectForItem(note),text=item.content?.text;
  // Strings cannot be mutated. Keep the captured text directly instead of JSON
  // encoding/decoding the entire document for snapshots that may be superseded.
  // All other fields still get independent deep copies at the time of the call.
  const metadataText=JSON.stringify(typeof text==='string'?{...item,content:{...item.content,text:undefined}}:item);
  const snapshot=JSON.parse(metadataText);
  if(typeof text==='string')snapshot.content.text=text;
  return {item:snapshot,text:typeof text==='string'?text:undefined,metadataText};
}
const imSameNoteSnapshot=(a,b)=>!!a&&a.text===b.text&&a.metadataText===b.metadataText;
/* A streamed host note is already persisted. Keep only the current note's baseline. */
function imNoteReceived(note){imConfirmedNote={note,snapshot:imNoteSnapshot(note)};}
function imNoteMetadataReceived(note,update){
  if(!note||update?.isMetadataUpdate!==true||note.uuid!==update.uuid)return;
  imApplyNoteMetadata(note,update);
  if(imConfirmedNote?.note===note&&imConfirmedNote.snapshot){
    const item={...imConfirmedNote.snapshot.item};
    imApplyNoteMetadata(item,{uuid:note.uuid,isMetadataUpdate:true,updated_at:note.updated_at,created_at:note.created_at});
    imConfirmedNote.snapshot=imNoteSnapshot(item);
  }
}
function imPersistNote(note) {
  const uuid=note.uuid;
  const snapshot=imNoteSnapshot(note);
  let state=imNoteSaves.get(uuid);
  const pending=state?.next||state?.current;
  if(pending&&imSameNoteSnapshot(pending.snapshot,snapshot))return new Promise((resolve,reject)=>state.waiters.push({version:pending.version,resolve,reject}));
  if(!state&&imConfirmedNote?.note===note&&imSameNoteSnapshot(imConfirmedNote.snapshot,snapshot))return Promise.resolve();
  if(!imConfirmedNote)imConfirmedNote={note,snapshot:null};
  if(imConfirmedNote.note.uuid===uuid)imConfirmedNote.snapshot=null;
  if(!state){state={version:0,active:false,current:null,next:null,waiters:[]};imNoteSaves.set(uuid,state)}
  const version=++state.version;
  const promise=new Promise((resolve,reject)=>state.waiters.push({version,resolve,reject}));
  state.next={version,snapshot,note};
  const run=()=>{
    if(state.active||!state.next)return;
    state.active=true;const job=state.next;state.current=job;state.next=null;let done=false;
    const reply=result=>finish(result?.error?new Error('The host rejected the note save'):null);
    const finish=error=>{
      if(done)return;done=true;clearTimeout(timeout);
      imReleaseHostReply(pf,reply);
      if(imConfirmedNote?.note===job.note)imConfirmedNote.snapshot=error?null:job.snapshot;
      const completed=state.waiters.filter(w=>w.version<=job.version);
      state.waiters=state.waiters.filter(w=>w.version>job.version);
      for(const waiter of completed)error?waiter.reject(error):waiter.resolve();
      state.active=false;state.current=null;
      if(state.next)run();else imNoteSaves.delete(uuid);
    };
    const timeout=setTimeout(()=>finish(new Error('Save acknowledgment timed out')),8000);
    if(imConfirmedNote?.note===job.note&&imSameNoteSnapshot(imConfirmedNote.snapshot,job.snapshot)){finish(null);return;}
    try{pf.postMessage('save-items',{items:[job.snapshot.item]},reply)}
    catch(error){finish(error)}
  };
  run();return promise;
}
/* A departing frame cannot wait for an acknowledgment to submit its latest draft. */
function imFlushNoteSaves() {
  for(const state of imNoteSaves.values())if(state.next){
    const job=state.next;state.next=null;
    try{pf.postMessage('save-items',{items:[job.snapshot.item]})}catch{}
  }
}
if(typeof window!=='undefined')window.addEventListener('pagehide',event=>{if(!event?.persisted)imFlushNoteSaves()});
