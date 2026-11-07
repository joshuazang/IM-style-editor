const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const requests=[],timers=[];
const api=vm.runInNewContext(fs.readFileSync('shared/core/host-bridge.js','utf8')+'\n'+fs.readFileSync('shared/core/note-storage.js','utf8')+';({save:imPersistNote,received:imNoteReceived,rebase:imRebaseQueuedNote,cancel:imCancelQueuedNoteSaves,apply:imApplyNoteNative,native:imNoteNativeSignature,unconfirmed:imNoteUnconfirmed})',{
 pf:{jsonObjectForItem:n=>n,postMessage:(action,data,callback)=>requests.push({action,data,callback})},
 setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{}
});
(async()=>{
 const note={uuid:'a',content:{text:'Saved',title:'Old title',preview_plain:'Local preview',references:[{uuid:'old'}]},clientData:{keep:1}};
 api.received(note);note.content.text='First draft';const first=api.save(note);
 note.content.text='Newest draft';const newest=api.save(note);
 const host={uuid:'a',content:{text:'First draft',title:'New host title',preview_plain:'Stale host preview',references:[{uuid:'new'}],appData:{native:{keep:true}}},clientData:{fresh:2}};
 api.apply(note,host);assert.equal(note.content.text,'Newest draft');assert.equal(note.content.title,'New host title');assert.equal(note.content.preview_plain,'Local preview');
 assert.ok(api.rebase('a',host));assert.equal(requests[0].data.items[0].content.title,'Old title','An already sent packet stays immutable');
 requests[0].callback({});await first;assert.equal(requests.length,2);
 assert.equal(requests[1].data.items[0].content.text,'Newest draft');assert.equal(requests[1].data.items[0].content.title,'New host title');assert.equal(requests[1].data.items[0].content.references[0].uuid,'new');
 requests[1].callback({});await newest;
 const before=JSON.stringify(note);api.apply(note,{...host,isMetadataUpdate:true,content:{text:'stale',title:'stale'}});assert.equal(JSON.stringify(note),before);
 api.apply(note,{uuid:'other',content:{text:'other'}});assert.equal(JSON.stringify(note),before);
 api.apply(note,{uuid:'a',content:{text:'host',title:'No client data'},clientData:undefined});assert.ok(!Object.hasOwn(note,'clientData'));
 const start=requests.length;note.content.text='Pending';const pending=api.save(note);note.content.text='Cancelled waiting text';const waiting=api.save(note);const rejected=assert.rejects(waiting,/paused/);
 api.cancel('a');await rejected;requests[start].callback({});await pending;assert.equal(requests.length,start+1,'Conflicting queued content must not be submitted');
 api.unconfirmed(note);const retry=api.save(note);assert.equal(requests.length,start+2,'Restored unconfirmed state requires a real acknowledgment');requests.at(-1).callback({});await retry;
 console.log('PASS: immutable in-flight snapshots, native-field rebase of waiting drafts, metadata-only isolation, cancellation of conflicting queued writes, explicit retry acknowledgment');
})().catch(error=>{console.error(error);process.exitCode=1;});
