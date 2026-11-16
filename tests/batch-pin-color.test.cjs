const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=['shared/core/note-format.js','shared/core/reply-record.js','shared/core/emoji-tags.js','shared/core/message-statuses.js','shared/ui/search-filters.js','mosaic/src/model.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
const {f,m,pin,state}=vm.runInNewContext(source+';({f:imFormat,m:MosaicModel,pin:imToggleSelectedPins,state:imSelectedPinState})',{crypto,btoa});
const messages=Array.from({length:4},(_,i)=>({id:f.newId(),text:'Exact **text** 中文\r\n'+i,reactions:['📓'],createdAt:'2026-11-01T12:00:00Z',edited:true,copied:true,exported:true,cardColor:i===1?'coral':i===2?'blue':'sand',custom:{keep:true}}));
messages[1].replyTo={id:messages[0].id,noteId:'original',text:messages[0].text};
const ids=indices=>new Set(indices.map(i=>messages[i].id)),plain=x=>JSON.parse(JSON.stringify(x));
const settings={pinnedMessageIds:[messages[0].id,messages[1].id],mosaicCardOrder:messages.map(m=>m.id).reverse(),custom:{keep:true}},snapshot=JSON.stringify({messages,settings});
for(const [indices,unpin,expected] of [[[1,2],false,[0,1,2]],[[2,3],false,[0,1,2,3]],[[0,1],true,[]],[[1],true,[0]]]){
 const selected=ids(indices);assert.equal(state(messages,settings,selected).allPinned,unpin);
 const next=pin(messages,settings,selected);assert.deepEqual(plain(next.pinnedMessageIds),expected.map(i=>messages[i].id));assert.equal(next.custom,settings.custom);assert.equal(next.mosaicCardOrder,settings.mosaicCardOrder);
 assert.equal(JSON.stringify({messages,settings}),snapshot);
}
assert.equal(pin(messages,settings,new Set()),settings);assert.equal(pin(messages,settings,new Set(['missing'])),settings);
for(const preset of m.colors){
 const next=m.setCardColor(messages,ids([1,2]),preset.id);assert.equal(next[0],messages[0]);assert.equal(next[3],messages[3]);
 for(const index of [1,2]){const expected={...messages[index]};if(preset.id==='default')delete expected.cardColor;else expected.cardColor=preset.id;assert.deepEqual(plain(next[index]),plain(expected));}
 assert.equal(m.setCardColor(next,ids([1,2]),preset.id),next);assert.equal(JSON.stringify({messages,settings}),snapshot);
 const draft='Exact unsent draft\r\n',reply={id:messages[0].id,noteId:'original',text:messages[0].text};
 const reopened=f.inspect(f.portable(next,settings,draft,reply));assert.deepEqual(plain(reopened.messages),plain(next));assert.deepEqual(plain(reopened.settings),settings);assert.equal(reopened.draft,draft);assert.deepEqual(plain(reopened.reply),reply);
}
assert.equal(m.setCardColor(messages,ids([1,2]),'invalid'),messages);
console.log('PASS: shared pin/unpin rule for mixed/all/empty/stale selections; every existing palette preset/reset/no-op; unselected records, exact text/metadata, drafts/replies/order and settings retained');
