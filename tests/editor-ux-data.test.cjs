const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=['shared/core/note-format.js','shared/core/reply-record.js','shared/core/emoji-tags.js','mosaic/src/model.js','shared/ui/save-feedback.js'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const stats={bodyPreparations:0};
const api=vm.runInNewContext('const lower=String.prototype.toLocaleLowerCase;String.prototype.toLocaleLowerCase=function(){if(this.includes("\\n"))stats.bodyPreparations++;return lower.call(this);};\n'+source+';({f:imFormat,m:MosaicModel,add:imEmojiAdd,move:imEmojiMove,change:imEmojiChange,order:imEmojiOrder,filterOrder:imFilterOrder,untagged:imUntagged,Feedback:ImSaveFeedback})',{crypto,btoa,setTimeout,clearTimeout,stats});
const {f,m,add,move,change,order,filterOrder,untagged,Feedback}=api,plain=value=>JSON.parse(JSON.stringify(value));
const messages=[{id:f.newId(),text:'Exact\r\n\r\n@@IM:BUBBLE\n🙂',reactions:['A','B','C'],edited:true,copied:true,exported:true,cardColor:'iris',custom:{keep:true}},{id:f.newId(),text:'Keep me',reactions:['A']},{id:f.newId(),text:'No tags',reactions:[]}];
const original=JSON.stringify(messages),settings={reactionOrder:['A','B','C'],untaggedPosition:1,pinnedMessageIds:[messages[0].id],unrelated:{keep:true}};
let result=change(messages,settings,'A','B');
assert.deepEqual(plain(result.messages.map(v=>v.reactions)),[['B','C'],['B'],[]]);
assert.equal(result.messages[2],messages[2]);assert.equal(JSON.stringify(messages),original);
for(let i=0;i<messages.length;i++)assert.deepEqual(plain({...result.messages[i],reactions:[]}),plain({...messages[i],reactions:[]}));
assert.deepEqual(plain(filterOrder(order(result.messages,result.settings),result.settings.untaggedPosition)),[untagged,'B','C']);
result=change(messages,settings,'A','Z');assert.deepEqual(plain(result.settings.reactionOrder),['Z','B','C']);
assert.deepEqual(plain(result.messages[0].reactions),['Z','B','C']);
result=change(messages,settings,'A');assert.equal(result.messages.length,messages.length);assert.deepEqual(plain(result.messages[1].reactions),[]);
assert.deepEqual(result.settings.pinnedMessageIds,settings.pinnedMessageIds);assert.equal(result.settings.unrelated,settings.unrelated);
let next=add(messages,settings,'D');assert.deepEqual(plain(filterOrder(order(messages,next),next.untaggedPosition)),['D','A',untagged,'B','C']);
next=move(messages,next,untagged,1);assert.deepEqual(plain(filterOrder(order(messages,next),next.untaggedPosition)),['D','A','B',untagged,'C']);
assert.equal(move(messages,next,'D',-1),next);assert.equal(move(messages,next,'missing',1),next);
assert.equal(filterOrder(order([],{})).at(-1),untagged);
for(const tag of ['',untagged,'__untagged__',null])assert.throws(()=>add(messages,settings,tag),/emoji/);
assert.equal(change(messages,settings,'A','A').messages,messages);
const encoded=f.portable(messages,settings,'Exact draft\r\n');const parsed=f.inspect(encoded);assert.equal(f.portable(parsed.messages,parsed.settings,parsed.draft),encoded);
console.log('PASS: shared add/replace/merge/delete/reorder commands preserve every message, metadata, exact text, draft format and Untagged order');

let now=0,serial=0;const tasks=new Map(),events=[];
const timers={setTimeout(fn,delay){const id=++serial;tasks.set(id,{fn,at:now+delay});return id;},clearTimeout(id){tasks.delete(id);}};
function advance(ms){const end=now+ms;while(true){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;tasks.delete(next[0]);next[1].fn();}now=end;}
const feedback=new Feedback(text=>events.push(text),timers);
assert.equal(feedback.update('a',true),'');advance(150);assert.equal(feedback.update('a',true),'');advance(149);assert.equal(feedback.text,'');advance(1);assert.equal(feedback.text,'Saving…');
assert.equal(feedback.update('a',false),'Saved');advance(999);assert.equal(feedback.text,'Saved');advance(1);assert.equal(feedback.text,'');
feedback.update('a',true);advance(50);feedback.update('a',false);advance(500);assert.equal(feedback.text,'');
feedback.update('a',true);advance(200);feedback.update('b',false);advance(200);assert.equal(feedback.text,'');
feedback.update('b',true);advance(300);assert.equal(feedback.text,'Saving…');feedback.update('b',false,true);advance(2000);assert.equal(feedback.text,'');
feedback.update('b',true);feedback.dispose();advance(2000);assert.equal(tasks.size,0);assert.deepEqual(events,['Saving…','','Saving…']);
console.log('PASS: 300ms visual delay, immediate fast-save silence, brief acknowledged success, cancellation on failure/note switch/disposal; no save scheduling');

const big=Array.from({length:10000},(_,i)=>({id:f.newId(),text:`Title ${i}\nFind ${i%17} ${'body '.repeat(i%20)}`,reactions:i%3?[]:['A',...(i%2?['A','B']:[])]}));
const grid=m.layout(big,{pinnedMessageIds:[big[2].id,big[9999].id]},1100);
assert.equal(stats.bodyPreparations,10000);
for(const [low,high] of [[0,900],[900,1900],[40000,41000],[grid.height-1000,grid.height],[grid.height+1,grid.height+900]]){
 const expected=grid.items.filter(item=>item.y+item.height+item.overhang>=low&&item.y<=high).map(item=>item.message.id);
 assert.deepEqual(plain(m.visible(grid,low,high).map(item=>item.message.id)),plain(expected));
}
let reads=0;const fast={columns:grid.columns.map(column=>new Proxy(column,{get(target,key){if(/^\d+$/.test(String(key)))reads++;return target[key];}})),get items(){throw Error('Full scan forbidden');}};
assert.ok(m.visible(fast,40000,41000).length<100);assert.ok(reads<200,reads);
const indexed=m.index(big);assert.equal(indexed.counts.get('A'),3334);assert.equal(indexed.counts.get('B'),1667);assert.equal(indexed.untagged,6666);
const pinSettings={pinnedMessageIds:[big[2].id]};
for(const query of ['','TITLE 9','find 3','absent'])for(const tag of ['','A','__untagged__'])for(const pinned of [false,true]){
 const expected=big.filter(v=>(!query||v.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(!tag||(tag==='__untagged__'?!v.reactions.length:v.reactions.includes(tag)))&&(!pinned||pinSettings.pinnedMessageIds.includes(v.id)));
 const actual=m.layout(big,pinSettings,390,query,tag,pinned);assert.equal(actual.count,expected.length);
}
const changed=big.map((v,i)=>i===3?{...v,text:'Unique replacement',reactions:['C']}:v);
assert.equal(m.layout(changed,{},390,'Unique replacement').count,1);assert.equal(m.index(changed).counts.get('C'),1);assert.equal(m.index(changed).untagged,6666);
assert.equal(m.layout(changed,{pinnedMessageIds:[changed[3].id]},700,'','',true).items[0].message.id,changed[3].id);
const deleted=changed.filter(v=>v.id!==changed[3].id);assert.equal(m.layout(deleted,{},390,'Unique replacement').count,0);
assert.equal(m.index(deleted).counts.get('C'),undefined);
assert.equal(stats.bodyPreparations,10000,'Unchanged bodies are not lowercased again');
const statusOnly=deleted.map(v=>({...v,copied:true}));m.layout(statusOnly,{},390);assert.equal(stats.bodyPreparations,10000,'Status-only clones reuse prepared body text');
const newText=statusOnly.map((v,i)=>i===4?{...v,text:'Changed title\nChanged body'}:v);m.layout(newText,{},390);assert.equal(stats.bodyPreparations,10001,'Only the changed body is prepared');
const sizes=m.layout(big,{mosaicFontSize:'extra-large'},320);assert.notEqual(sizes.items[0].height,grid.items[0].height);
console.log(`PASS: 10,000-card indexed ranges match full scans (${reads} column reads); search/tag counts invalidate on edit, retag, pin, delete, resize and font changes`);
