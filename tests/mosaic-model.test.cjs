const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const core=fs.readFileSync('shared/core/note-format.js','utf8')+'\n'+fs.readFileSync('shared/core/emoji-tags.js','utf8');
const load=()=>vm.runInNewContext(fs.readFileSync('shared/ui/search-filters.js','utf8')+'\n'+core+'\n'+fs.readFileSync('shared/core/reply-record.js','utf8')+'\n'+fs.readFileSync('mosaic/src/model.js','utf8')+'\n'+fs.readFileSync('shared/core/message-transfer.js','utf8')+';({f:imFormat,m:MosaicModel,t:imTransfer})',{crypto,btoa});
const {f,m,t}=load(),other=load().f,plain=x=>JSON.parse(JSON.stringify(x));
const bodies=['','One line','\nAn empty first line','  Title  \r\n\r\nBody\r\n','标题🙂\n@@IM:BUBBLE\n@@IM:END\n','<img src=x onerror=alert(1)>\n<script>secret()</script>','\r\n','\n\n','\\literal\n\\@@IM:BUBBLE'];
const messages=bodies.map((text,i)=>({id:f.newId(),text,reactions:i%2?['📓']:[],createdAt:'2026-11-06T12:00:00Z',...(i===1?{edited:true,copied:true,exported:true,custom:{keep:true}}:{})}));
messages[2].replyTo=m.reply(messages[1],'fixture');
messages[3].forwarding={sourceMessageId:messages[0].id,sourceNoteId:'source',forwardedAt:'2026-11-01T12:00:00Z'};
messages[1].cardColor='iris';
const settings={bubbleTheme:'iris',reactionOrder:['📓','📍'],pinnedMessageIds:[messages[1].id],untaggedPosition:2,unrelated:{keep:true}};
const draft='  Draft\r\n\r\n🙂\n',reply=m.reply(messages[1],'fixture');
const note={uuid:'fixture',content_type:'Note',content:{text:f.portable(messages,settings,draft,reply),title:'Native title',references:[{uuid:'ref'}],appData:{unrelated:{keep:true}}},clientData:{unrelated:{keep:true}}};
const initial=note.content.text;
for(const message of f.readMessages(note)){const p=m.split(message.text);assert.equal(m.join(message.text,p.title,p.body),message.text);}
assert.equal(note.content.text,initial);
f.write(note,f.readMessages(note),f.readSettings(note));assert.equal(note.content.text,initial);
assert.equal(m.join('Title\r\nBody\r\n','Changed','Body\n'),'Changed\r\nBody\r\n');
assert.equal(m.join('Title','Title','New body'),'Title\nNew body');
assert.equal(m.join('Title\n','Title',''),'Title\n');
const untouched=f.readMessages(note);const next=untouched.map((message,i)=>i===1?f.editMessage(message,'New title\nNew body'):message);
f.write(note,next,f.readSettings(note));
const reopened={...plain(note)},decoded=other.readMessages(reopened);
assert.equal(decoded[1].text,'New title\nNew body');assert.equal(decoded[1].id,messages[1].id);assert.equal(decoded[1].edited,true);
assert.ok(!Object.hasOwn(decoded[1],'copied'));assert.ok(!Object.hasOwn(decoded[1],'exported'));
assert.deepEqual(plain(decoded.filter((_,i)=>i!==1)),plain(messages.filter((_,i)=>i!==1)));
assert.deepEqual(plain(other.readSettings(reopened)),settings);assert.equal(other.readDraft(reopened),draft);assert.deepEqual(plain(other.readReply(reopened)),plain(reply));
assert.equal(reopened.content.title,'Native title');assert.deepEqual(reopened.content.appData,{unrelated:{keep:true}});assert.deepEqual(reopened.clientData,{unrelated:{keep:true}});
assert.equal(f.editMessage(messages[1],messages[1].text),messages[1]);
console.log('PASS: independent editor instances preserve exact title/body text, IDs, metadata, replies, pins, settings, drafts and unrelated host data; only real edits change statuses');

let seed=20261106;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const tokens=['a','中文','🙂',' ','\t','\n','\r\n','\r','\\','@@IM:BUBBLE','@@IM:CONTENT','@@IM:END'];
for(let i=0;i<500;i++){
  const text=Array.from({length:random(60)},()=>tokens[random(tokens.length)]).join(''),parts=m.split(text);
  assert.equal(m.join(text,parts.title,parts.body),text);
  const records=[{id:f.newId(),text,reactions:[]}],parsed=other.inspect(f.portable(records,{},text));
  assert.equal(parsed.kind,'portable');assert.equal(parsed.messages[0].text,text);assert.equal(parsed.draft,text);
}
console.log('PASS: 500 Unicode, whitespace, CRLF, escaping and literal-marker round trips');
const cleared=m.clearStatuses(messages,['copied','exported','edited','imported'],new Set(messages.map(x=>x.id)));
assert.ok(!cleared[1].copied&&!cleared[1].edited&&!cleared[1].exported);assert.equal(cleared[3].importedStatusCleared,true);assert.deepEqual(cleared[3].forwarding,messages[3].forwarding);
const payload=t.read(t.create(messages,settings,'source'));assert.equal(payload.ok,true);
const imported=t.merge([],payload);assert.equal(imported.added.length,messages.length);assert.ok(!imported.messages[1].exported);assert.ok(m.isImported(imported.messages[1]));
assert.equal(t.merge(imported.messages,payload).added.length,0);
const merged=m.merge(messages,settings,new Set([messages[0].id,messages[1].id]),'fixture');
assert.equal(merged.messages[0].text,messages[0].text+'\n\n'+messages[1].text);assert.ok(merged.messages[0].edited&&!merged.messages[0].copied&&!merged.messages[0].exported);
assert.equal(m.target(merged.messages,{id:messages[1].id,noteId:'fixture'},'fixture').id,messages[0].id);
assert.equal(merged.settings.pinnedMessageIds[0],messages[0].id);
const many=Array.from({length:5000},(_,i)=>({id:f.newId(),text:`Title ${i}\n${'An idea. '.repeat(i%20+1)}`,reactions:i%3?[]:['📓']}));
for(const width of [280,350,700,1300]){
  const before=JSON.stringify(many),grid=m.layout(many,{pinnedMessageIds:[many[10].id]},width);
  assert.equal(grid.items.length,5000);assert.equal(JSON.stringify(many),before);
  for(const item of grid.items){assert.ok(item.width>0&&item.height>0&&item.x>=0&&item.x+item.width<=width+.01);}
  if(width<600)assert.equal(new Set(grid.items.map(item=>item.x)).size,2,'Two masonry columns on phones');
  const visible=grid.items.filter(item=>item.y<1600&&item.y+item.height>0);assert.ok(visible.length<70);
  assert.equal(m.layout(many,{},width,'','📓').count,1667);assert.equal(m.layout(many,{},width,'','__untagged__').count,3333);
}
assert.equal(m.color({cardColor:'iris'}).background,'#919bf5');
assert.equal(m.color({cardColor:'iris'}).ink,'#202124');
assert.deepEqual(plain(m.appearance({})),{palette:'sage',fontSize:'large'});
assert.deepEqual(plain(m.appearance({mosaicPalette:'paper',mosaicFontSize:'medium'})),{palette:'paper',fontSize:'medium'});
for(const invalid of ['url(https://example.invalid)',null,{},[],{toString:'invalid'},'__proto__'])assert.equal(m.appearance({mosaicPalette:invalid,mosaicFontSize:invalid}).fontSize,'large');
const sizedMessage={id:f.newId(),text:'A longer title to wrap\n'+ 'Readable text. '.repeat(15),reactions:['📓']};
m.measure(sizedMessage,170,false,false,111,'medium');
const medium=m.layout([sizedMessage],{mosaicFontSize:'medium'},350).items[0];
assert.equal(medium.width,170);assert.equal(medium.height,111);
assert.equal(m.layout([sizedMessage],{mosaicFontSize:'medium'},350,'','',false,true).items[0].height,111,'Selection reuses the same measured height instead of estimating a different layout');
assert.notEqual(m.layout([sizedMessage],{mosaicFontSize:'extra-large'},350).items[0].height,111,'Font changes must not reuse measured heights from another size');
const appearanceSettings={...settings,mosaicPalette:'sand',mosaicFontSize:'extra-large'};
assert.deepEqual(plain(other.inspect(f.portable(messages,appearanceSettings,draft,reply)).settings),appearanceSettings);
assert.equal(m.color({cardColor:'url(https://example.invalid)'}).id,'default','Only preset IDs can become CSS colors');
for(const preset of m.colors){
  const result=m.color({cardColor:preset.id});assert.ok(result.id===preset.id&&result.background&&result.ink);
}
const damaged={content:{text:initial.replace('@@IM:CONTENT','@@BROKEN')}};
assert.throws(()=>f.write(damaged,[],{}),/Malformed/);assert.equal(damaged.content.text,initial.replace('@@IM:CONTENT','@@BROKEN'));

console.log('PASS: transfer/duplicate detection, selective statuses, merge navigation, nonmutating 5,000-card layout, malformed-note refusal and shared-core checksums');

const untagged={id:f.newId(),text:'Same body',reactions:[]},tagged={...untagged,id:f.newId(),reactions:['📍']};
const pair=m.layout([untagged,tagged],{},350);assert.equal(pair.byId.get(tagged.id).height-pair.byId.get(untagged.id).height,30,'Board tags use a compact internal row');
m.measure(tagged,170,false,false,90,'large');assert.equal(m.layout([tagged],{},350).items[0].height,90);
const packed=Array.from({length:80},(_,i)=>({...untagged,id:f.newId(),reactions:i%2?Array(8).fill('📍'):[]}));
for(const width of [280,350,1100])for(const column of m.layout(packed,{},width).columns)for(let i=1;i<column.length;i++)assert.ok(column[i].y>=column[i-1].y+column[i-1].height+8,'Wrapped tags clear the next card');
console.log('PASS: compact internal Board tags, measured wrapped heights and indexed visibility');

const longPreview={id:f.newId(),text:'Body line\n'.repeat(1000),reactions:[]};
for(const fontSize of Object.keys(m.fontSizes))for(const width of [170,280]){
  for(const ratio of [6,8,14])assert.equal(m.boardBounds(width,fontSize,ratio).maximum,ratio*m.boardBounds(width,fontSize,ratio).minimum);
}
const previewLayout=ratio=>m.layout([longPreview],{},350,'','',false,false,ratio).items[0];
assert.equal(previewLayout(8).height,m.boardBounds(170,'large',8).maximum);
assert.equal(previewLayout(14).height,m.boardBounds(170,'large',14).maximum);
m.measure(longPreview,170,false,false,123,'large',8);
assert.equal(previewLayout(8).height,123);
assert.equal(previewLayout(14).height,m.boardBounds(170,'large',14).maximum,'A desktop estimate must ignore a measured phone height');
m.measure(longPreview,170,false,false,456,'large',14);
assert.equal(previewLayout(14).height,456);
assert.equal(previewLayout(8).height,m.boardBounds(170,'large',8).maximum,'A phone estimate must ignore a measured desktop height');
console.log('PASS: independent 6x/8x/14x body bounds and measurement-cache separation');

for(const [ordinary,pinned] of [[8,6],[14,8]]){
 const card={id:f.newId(),text:'Long line\n'.repeat(1000),reactions:[]},settings={pinnedMessageIds:[card.id]};
 const before=m.layout([card],{},350,'','',false,false,ordinary,pinned).items[0];
 const after=m.layout([card],settings,350,'','',false,false,ordinary,pinned).items[0];
 assert.equal(before.height,m.boardBounds(before.width,'large',ordinary).maximum);assert.equal(after.height,m.boardBounds(after.width,'large',pinned).maximum);assert.equal(after.previewRatio,pinned);
}
