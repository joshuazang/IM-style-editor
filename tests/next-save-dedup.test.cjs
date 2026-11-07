const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const requests=[],timers=[];const pf={sentMessages:[],jsonObjectForItem:note=>note,postMessage:(action,data,callback)=>{
  const message={action,data,messageId:String(requests.length)};api.track(pf,message,callback);requests.push({data,callback:pf.sentMessages.at(-1)?.callback});
}};
const api=vm.runInNewContext(fs.readFileSync('shared/core/host-bridge.js','utf8')+'\n'+fs.readFileSync('shared/core/note-storage.js','utf8')+';({save:imPersistNote,received:imNoteReceived,pending:imNoteSavePending,track:imTrackHostReply})',{
  pf,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}
});
const note={uuid:'a',content:{text:'Host version',title:'Title',appData:{other:true}}};
(async()=>{
  api.received(note);await api.save(note);assert.equal(requests.length,0,'Known host content needs no identical write');
  note.content.text='New draft';let settled=false;
  const first=api.save(note),same=api.save(note).then(()=>{settled=true;});
  await Promise.resolve();assert.equal(settled,false);assert.equal(requests.length,1);assert.equal(pf.sentMessages.length,1);
  note.content.text='Latest draft';const next=api.save(note),nextSame=api.save(note);
  requests[0].callback({});await Promise.all([first,same]);assert.equal(requests.length,2);
  assert.equal(requests[1].data.items[0].content.text,'Latest draft');requests[1].callback({});await Promise.all([next,nextSame]);
  assert.equal(pf.sentMessages.length,0);await api.save(note);assert.equal(requests.length,2);
  note.content.title='Different title';const title=api.save(note);assert.equal(requests.length,3);requests[2].callback({});await title;
  note.content.text='Unconfirmed';const rejected=api.save(note),check=assert.rejects(rejected);requests[3].callback({error:'denied'});await check;
  const retry=api.save(note);assert.equal(requests.length,5);requests[4].callback({});await retry;
  note.content.text='May have reached host';const lost=api.save(note),timeout=assert.rejects(lost);timers.at(-1)();await timeout;
  assert.equal(pf.sentMessages.length,0,'Timeout must release the SDK callback and its captured snapshot');
  // A late acknowledgment cannot validate a timed-out or different snapshot.
  requests[5].callback({});const again=api.save(note);assert.equal(requests.length,7);requests[6].callback({});await again;
  // Reverting a queued draft to the in-flight value needs only its acknowledgment.
  note.content.text='In flight';const active=api.save(note);note.content.text='Superseded';const superseded=api.save(note);
  note.content.text='In flight';const reverted=api.save(note);requests[7].callback({});await Promise.all([active,superseded,reverted]);assert.equal(requests.length,8);
  // A real host update replaces the baseline; old local content must be written.
  note.content.text='Remote change';api.received(note);note.content.text='In flight';const restore=api.save(note);assert.equal(requests.length,9);requests[8].callback({});await restore;
  // A background note's acknowledgment must not replace the active note baseline.
  note.content.text='Background A';const background=api.save(note);const b={uuid:'b',content:{text:'Saved B'}};api.received(b);
  requests[9].callback({});await background;await api.save(b);assert.equal(requests.length,10);
  assert.equal(pf.sentMessages.length,0);assert.equal(api.pending('a'),false);
  console.log('PASS: identical acknowledged/host/pending saves are skipped; metadata changes, rejection, retries, timeouts, queued reversions, remote changes and note switches preserve acknowledged ordering');
})().catch(error=>{console.error(error);process.exitCode=1});
