/* Per-note acknowledged writes. Coalesce waiting snapshots without reordering saves. */
const imNoteSaves = new Map();
function imNoteSavePending(uuid) { return imNoteSaves.has(uuid); }
function imPersistNote(note) {
  const uuid=note.uuid;
  const item=JSON.parse(JSON.stringify(pf.jsonObjectForItem(note)));
  let state=imNoteSaves.get(uuid);
  if(!state){state={version:0,active:false,next:null,waiters:[]};imNoteSaves.set(uuid,state)}
  const version=++state.version;
  const promise=new Promise((resolve,reject)=>state.waiters.push({version,resolve,reject}));
  state.next={version,item};
  const run=()=>{
    if(state.active||!state.next)return;
    state.active=true;const job=state.next;state.next=null;let done=false;
    const finish=error=>{
      if(done)return;done=true;clearTimeout(timeout);
      const completed=state.waiters.filter(w=>w.version<=job.version);
      state.waiters=state.waiters.filter(w=>w.version>job.version);
      for(const waiter of completed)error?waiter.reject(error):waiter.resolve();
      state.active=false;
      if(state.next)run();else imNoteSaves.delete(uuid);
    };
    const timeout=setTimeout(()=>finish(new Error('Save acknowledgment timed out')),8000);
    try{pf.postMessage('save-items',{items:[job.item]},result=>finish(result?.error?new Error('The host rejected the note save'):null))}
    catch(error){finish(error)}
  };
  run();return promise;
}
/* A departing frame cannot wait for an acknowledgment to submit its latest draft. */
function imFlushNoteSaves() {
  for(const state of imNoteSaves.values())if(state.next){
    const job=state.next;state.next=null;
    try{pf.postMessage('save-items',{items:[job.item]},()=>{})}catch{}
  }
}
if(typeof window!=='undefined')window.addEventListener('pagehide',event=>{if(!event?.persisted)imFlushNoteSaves()});
