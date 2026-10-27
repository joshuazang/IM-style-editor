const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const f = vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+';imFormat',{crypto});
const copy = x => JSON.parse(JSON.stringify(x));
const messages = [
 {id:'first',text:'First line\n\nBlank lines stay inside this bubble\r\nWindows line\rreturn',reactions:['⭐','✅'],createdAt:'2026-01-01T03:20:00.123Z',separatorAfter:'\n\n',custom:{keep:true}},
 {id:'second',text:':::end-bubble\n:::bubble {"id":"fake"}\n\\:::literal\nC:\\notes\\new.txt\n中文🙂 <script>alert(1)</script>\n',reactions:['❤️'],createdAt:'2026-01-02T12:00:00Z',editedAt:'2026-01-03T12:00:00Z'},
 {id:'empty',text:'',reactions:[]},
];
const settings={bubbleTheme:'lime',backgroundTheme:'sand',artwork:'garden',reactionOrder:['❤️','⭐','✅'],scale:1.12};
let note={uuid:'a',clientData:{other:'keep'},content:{text:f.serialize(messages),title:'Keep title',references:[{uuid:'b'}],appendEditorMessageData:copy(messages),appendEditorSettings:copy(settings)}};
const original=copy(note);
f.write(note,messages,settings);
assert.equal(note.clientData.imStyleEditor.schemaVersion,2);
assert.equal(note.clientData.imStyleEditor.migrationBackup.text,original.content.text);
assert.deepEqual(copy(note.clientData.imStyleEditor.migrationBackup.messages),messages);
assert.equal(note.clientData.other,'keep');assert.equal(note.content.title,'Keep title');
assert.deepEqual(copy(note.content.references),[{uuid:'b'}]);
const text=note.content.text;
assert.ok(text.startsWith('#!im-style-editor 1\n:::settings '));
assert.ok(text.includes(':::bubble {"id":"first"'));
assert.equal(f.inspect(text).kind,'portable');
for(let i=0;i<25;i++){
 // Text-only export into a fresh note: no clientData or legacy custom fields survive.
 note={uuid:'copy-'+i,content:{text:note.content.text}};
 assert.deepEqual(copy(f.readMessages(note)),messages);
 assert.deepEqual(copy(f.readSettings(note)),settings);
 f.write(note,f.readMessages(note),f.readSettings(note));
 assert.equal(note.content.text,text);
 assert.ok(f.isCurrent(note,f.readMessages(note),settings));
}
assert.deepEqual(copy(f.readMessages({content:{text:text.replace(/\n/g,'\r\n')}})),messages);
// Broken hidden mirrors cannot prevent restoration from a complete document.
for (const mirror of [{schemaVersion:2}, {schemaVersion:2,messages:null},
  {schemaVersion:2,messages:[null]}, {schemaVersion:2,messages:[{id:'stale',text:'wrong'}]}]) {
  const target={content:{text},clientData:{imStyleEditor:mirror}};
  assert.deepEqual(copy(f.readMessages(target)),messages);
  assert.equal(f.isCurrent(target,messages,settings),false);
  f.write(target,f.readMessages(target),f.readSettings(target));
  assert.equal(target.content.text,text);
  assert.ok(f.isCurrent(target,messages,settings));
}
const edited=text.replace('First line','Edited in the plain editor').replace('Blank lines stay','More\n\nblank lines stay');
const restored=f.readMessages({content:{text:edited},clientData:original.clientData});
assert.equal(restored.length,3);assert.equal(restored[0].id,'first');
assert.equal(restored[0].text,messages[0].text.replace('First line','Edited in the plain editor').replace('Blank lines stay','More\n\nblank lines stay'));
assert.equal(restored[0].createdAt,messages[0].createdAt);assert.deepEqual(copy(restored[0].reactions),messages[0].reactions);
assert.deepEqual(copy(restored[1]),messages[1]);
// Explicit record edits, not stale hidden copies, determine time/category/order.
const changed=text.replace('2026-01-01T03:20:00.123Z','2026-02-01T03:20:00.123Z').replace('"reactions":["⭐","✅"]','"reactions":["💡"]');
assert.equal(f.readMessages({content:{text:changed},clientData:note.clientData})[0].createdAt,'2026-02-01T03:20:00.123Z');
assert.deepEqual(copy(f.readMessages({content:{text:changed}})[0].reactions),['💡']);
const damaged=[text.replace(':::end-bubble',''),text.replace(':::settings {',':::settings nope{'),text.replace('"id":"second"','"id":"first"'),text.replace(':::end-im-style-editor',''),text.replace('#!im-style-editor 1','#!im-style-editor 9'),text+'Appended outside the document',text.slice(text.indexOf(':::settings ')),text.replace('C:\\\\notes','C:\\qnotes')];
for(const value of damaged){
 assert.equal(f.inspect(value).kind,'damaged',value);
 const target={content:{text:value},clientData:copy(note.clientData)};const before=JSON.stringify(target);
 assert.throws(()=>f.write(target,messages,settings),/original text was not changed/);
 assert.equal(JSON.stringify(target),before);
}
let seed=34987;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
const chars=['a','\n','\r','\r\n','\\',':::','🙂','猫',' ','\t','\u2028','"'];
for(let i=0;i<1200;i++){
 let body='';for(let j=0,n=random(100);j<n;j++)body+=chars[random(chars.length)];
 const source=[{id:String(i),text:body,reactions:['⭐'],separatorAfter:'\r\n',createdAt:'2026-01-01T12:00:00Z'},{id:'tail',text:'\n',reactions:[]}];
 const encoded=f.portable(source,settings);const parsed=f.inspect(encoded);
 assert.equal(parsed.kind,'portable',encoded);assert.deepEqual(copy(parsed.messages),source);
 assert.equal(f.portable(parsed.messages,parsed.settings),encoded);
}
console.log('PASS: 1,200 portable-text fuzz cases; 25 text-only transfers preserve boundaries, exact bodies, IDs, times, tags, settings; damaged records never overwritten');
