const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const requests=[],timers=[];let hide;
const api=vm.runInNewContext(fs.readFileSync('src/note-storage.js','utf8')+';({save:imPersistNote,pending:imNoteSavePending,flush:imFlushNoteSaves})',{
 pf:{jsonObjectForItem:n=>n,postMessage:(action,data,callback)=>requests.push({action,data,callback})},
 setTimeout:fn=>{timers.push(fn);return timers.length-1},clearTimeout:()=>{},window:{addEventListener:(name,fn)=>{hide=fn}}
});
(async()=>{
 const n={uuid:'a',content:{text:'first'}};const first=api.save(n);n.content.text='second';const second=api.save(n);n.content.text='latest';const latest=api.save(n);
 assert.equal(requests.length,1);assert.equal(requests[0].data.items[0].content.text,'first');assert.equal(api.pending('a'),true);
 requests[0].callback({});await first;assert.equal(requests.length,2);assert.equal(requests[1].data.items[0].content.text,'latest');
 requests[1].callback({});await Promise.all([second,latest]);assert.equal(api.pending('a'),false);
 const failed=api.save(n);const check=assert.rejects(failed);requests[2].callback({error:'denied'});await check;assert.equal(api.pending('a'),false);
 const a=api.save(n),b=api.save({uuid:'b',content:{text:'other note'}});assert.equal(requests.length,5);requests[4].callback({});await b;assert.equal(api.pending('a'),true);requests[3].callback({});await a;
 const timed=api.save(n);const timeoutCheck=assert.rejects(timed);timers.at(-1)();await timeoutCheck;requests.at(-1).callback({});assert.equal(api.pending('a'),false);
 const before=requests.length;api.save(n);n.content.text='last draft before leaving';api.save(n);hide({persisted:true});assert.equal(requests.length,before+1);hide({persisted:false});assert.equal(requests.length,before+2);assert.equal(requests.at(-1).data.items[0].content.text,'last draft before leaving');
 console.log('PASS: immutable snapshots, per-note ordering, queued-write coalescing, rejection/timeout handling, final draft submission on pagehide');
})().catch(e=>{console.error(e);process.exitCode=1});
