const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const f=vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+';imFormat',{crypto,btoa});
const clone=v=>JSON.parse(JSON.stringify(v));
const settings={bubbleTheme:'lime',backgroundTheme:'sand',wallpaper:true,artwork:'classic',scale:1.12,reactionOrder:['✅','⭐'],deletedEmojis:['🦋'],custom:{nested:['中文',null,true]},text:'Keep unknown settings too'};
const make=(text,extras={})=>({id:f.newId(),text,reactions:[],...extras});
function round(messages,config=settings){const text=f.portable(messages,config),parsed=f.inspect(text);assert.equal(parsed.kind,'portable',parsed.error);assert.deepEqual(clone(parsed.messages),messages);assert.deepEqual(clone(parsed.settings),config);assert.equal(f.portable(parsed.messages,parsed.settings),text);return text;}
const ids=new Set();for(let i=0;i<10000;i++){const id=f.newId();assert.match(id,/^[A-Za-z0-9_-]{21}[AQgw]$/);assert.equal(Buffer.from(id,'base64url').length,16);assert.ok(!ids.has(id));ids.add(id);}
// Verify all sixteen bytes, including high bits, reach the output without UUID masks.
for(let n=0;n<256;n++){const bytes=Uint8Array.from({length:16},(_,i)=>(n+i)%256);const custom=vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+';imFormat',{btoa,crypto:{getRandomValues:target=>{target.set(bytes);return target}}});assert.equal(custom.newId(),Buffer.from(bytes).toString('base64url'));}
const bodies=['',' ','\t\t','\n','\n\n','\r','\r\n','\n \t\r\n  ','Chinese 中文：你好！ English punctuation—… “quotes”. 🙂🧑🏽‍💻','A\n\nB\nC\n','='.repeat(80)+'\n'+'-'.repeat(70),'#!im-style-editor 2\n#!encoding utf-8','I saw @@IM:END-BUBBLE today.\n@@ in prose\n@@IM:UNRESERVED','@@IM:END-BUBBLE','@@IM:CONTENT\r\n@@IM:BUBBLE\n@@IM:END\n@@IM:SETTINGS\n@@IM:END-SETTINGS','\\abc\n\\@@IM:END-BUBBLE\n\\\\literal\nC:\\notes\\new.txt','Long line '+ 'mixed 文🙂!'.repeat(100000)];
for(const body of bodies)round([make(body,{createdAt:'2026-10-27T14:12:19.028Z',edited:true,reactions:['⭐'],separatorAfter:'\r\n',custom:{value:'kept'},forwarding:{sourceMessageId:f.newId(),sourceNoteId:'source'}})]);
const messages=[make('First message'),make('Second\n\nintentional paragraph',{createdAt:'2026-01-01T00:00:00Z',reactions:['✅']}),make('第三条消息 🙂')];
const clean=round(messages);
const untagged=make('wanna hangout?',{createdAt:'2026-10-27T14:12:19.028Z'});
const noReactions=round([untagged],{});
assert.ok(!noReactions.includes('reactions') && !noReactions.includes('[]'),'No reactions field or orphan brackets');
assert.ok(noReactions.includes(`id: ${untagged.id}\ncreated: ${untagged.createdAt}\n@@IM:CONTENT`));
assert.ok(!noReactions.includes('edited:'),'Never-edited behavior unchanged');
const explicitEmpty=noReactions.replace('@@IM:CONTENT','reactions: []\n@@IM:CONTENT');
assert.deepEqual(clone(f.inspect(explicitEmpty).messages),[untagged],'Explicit empty arrays are still valid input');
assert.ok(!f.portable(f.inspect(explicitEmpty).messages,{}).includes('reactions'));
const tagged=make('tagged',{createdAt:untagged.createdAt,edited:true,reactions:['⭐','❤️']});
const taggedText=round([tagged],{});
assert.ok(taggedText.includes('reactions: ["⭐","❤️"]') && taggedText.includes('\nedited\n'));
round([make('Literal text: reactions: []\n"reactions":[]\n[]')],{});
const cleared=round([{...tagged,reactions:[]}],{});
assert.ok(!cleared.includes('reactions') && cleared.includes('\nedited\n'));
assert.equal(f.inspect(cleared).messages[0].id,tagged.id);

assert.ok(!/^[=-]+$/m.test(clean),'No generated decorative separator lines');
assert.ok(clean.includes('@@IM:CONTENT\n\n\nFirst message\n\n\n@@IM:END-BUBBLE'));
// Arbitrary inter-record blank lines never create or split bubbles.
assert.deepEqual(clone(f.inspect(clean.replace(/^@@IM:BUBBLE/gm,'\n\n\n\n@@IM:BUBBLE')).messages),messages);
const inside=round([make('====\n----\nActual content\n======\n------')]);
assert.equal(f.inspect(inside).messages[0].text,'====\n----\nActual content\n======\n------');
for(let leading=0;leading<=20;leading++)for(let trailing=0;trailing<=20;trailing++){
 const body='\n'.repeat(leading)+'wanna hangout?'+'\n'.repeat(trailing);
 const encoded=round([make(body)]);
 assert.ok(encoded.includes('@@IM:CONTENT'+'\n'.repeat(3+leading)+'wanna hangout?'+'\n'.repeat(3+trailing)+'@@IM:END-BUBBLE'));
}
for(const body of ['','\n','\n\n','\n'.repeat(100),' \t\n\r\n\n','\n\nhi\n\n','@@IM:CONTENT','\n@@IM:END-BUBBLE\n'])round([make(body)]);
for(const bad of [clean.replace('@@IM:CONTENT\n\n\n','@@IM:CONTENT\n\n'),clean.replace('First message\n\n\n@@IM:END-BUBBLE','First message\n\n@@IM:END-BUBBLE')]){
 assert.equal(f.inspect(bad).kind,'damaged');
 const note={content:{text:bad}};assert.throws(()=>f.write(note,messages,settings));assert.equal(note.content.text,bad);
}
const blocks=clean.match(/^@@IM:BUBBLE\n[\s\S]*?^@@IM:END-BUBBLE\n/gm);
assert.deepEqual(clone(f.inspect(clean.replace(blocks[1],'')).messages).map(m=>m.id),[messages[0].id,messages[2].id]);
const reordered=clean.replace(blocks[0],'SWAP-BLOCK').replace(blocks[2],blocks[0]).replace('SWAP-BLOCK',blocks[2]);
assert.deepEqual(clone(f.inspect(reordered).messages).map(m=>m.id),[messages[2].id,messages[1].id,messages[0].id]);
const changedSettings=f.inspect(clean.replace('bubble-theme: lime','bubble-theme: sky').replace('scale: 1.12','scale: 1.4'));
assert.equal(changedSettings.settings.bubbleTheme,'sky');assert.equal(changedSettings.settings.scale,1.4);
const originalIds=messages.map(m=>m.id);round([messages[2],{...messages[0],text:'Edited'},messages[1]]);round([messages[2],messages[0]]);assert.deepEqual(messages.map(m=>m.id),originalIds);
const thousands=Array.from({length:5000},(_,i)=>make(`Message ${i}\n中文🙂\n\nmore`,{reactions:i%2?['⭐']:[]}));round(thousands);round([],{});
let seed=123456;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};const chars=[' ','\t','\n','\r','\r\n','文','🙂','@@','\\','=', '-', 'abc', '\u0000','\u2028'];
for(let i=0;i<1500;i++){let body='';for(let j=0,n=random(100);j<n;j++)body+=chars[random(chars.length)];round([make(body)],{...settings,scale:i%2?1.12:1.4});}
for(const bad of [clean+'Unframed user text',clean.replace('@@IM:END-BUBBLE',''),clean.replace('@@IM:CONTENT',''),clean.replace('@@IM:END-SETTINGS',''),clean.replace('@@IM:END\n',''),clean.replace(/id: [^\n]+/,'id: invalid'),clean.replace('reactions: ["✅"]','reactions: null'),clean.replace('wallpaper: true','wallpaper: 123'),clean.replace('scale: 1.12','scale: {bad'),clean.replace('id: ','id : '),clean.replace('reactions: ["✅"]','unknown-field: []'),clean.replace('@@IM:BUBBLE\n',`@@IM:BUBBLE\nid: ${messages[0].id}\n`),clean.replace(messages[1].id,messages[0].id),'#!im-style-editor 1\n:::settings {}\n']){
 assert.equal(f.inspect(bad).kind,'damaged',bad);const note={content:{text:bad}};const before=JSON.stringify(note);assert.throws(()=>f.write(note,messages,settings));assert.equal(JSON.stringify(note),before);assert.equal(f.recover(bad),null);
}
assert.throws(()=>f.portable(messages,{wallpaper:'yes'}));
console.log('PASS: exact v2 text/metadata/settings; 5,000 bubbles; 1,500 Unicode/whitespace fuzz cases; 10,000 IDs + all-byte encoding; exact two-blank-line framing; no generated separators; malformed input protected');
