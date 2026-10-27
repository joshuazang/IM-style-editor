const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const f=vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+';imFormat',{crypto,btoa});const copy=v=>JSON.parse(JSON.stringify(v));
for(const text of ['', '\n','\r\n','One\nline\n\nTwo','\n\nleading\r\n\r\nnext\n\n','  \t \n\n中文🙂'])assert.equal(f.serialize(f.fromPlainText(text)),text);
const messages=f.fromPlainText('One\n\nTwo'),settings={bubbleTheme:'lime',wallpaper:false,deletedEmojis:['⭐']};
let note={uuid:'a',clientData:{other:'keep'},content:{text:'Plain source',title:'Keep title',references:[{uuid:'b'}]}};
f.write(note,messages,settings);assert.equal(note.clientData.other,'keep');assert.equal(note.content.title,'Keep title');assert.equal(note.clientData.imStyleEditor.schemaVersion,3);assert.equal(note.content.references[0].uuid,'b');
for(let i=0;i<25;i++){note={content:{text:note.content.text}};assert.deepEqual(copy(f.readMessages(note)),copy(messages));assert.deepEqual(copy(f.readSettings(note)),settings);f.write(note,f.readMessages(note),f.readSettings(note));assert.ok(f.isCurrent(note,f.readMessages(note),settings));}
const original=note.content.text;note.content.text=original.replace('\nOne\n','\nEdited one\n');assert.equal(f.readMessages(note)[0].id,messages[0].id);assert.equal(f.readMessages(note)[0].text,'Edited one');
const v1={content:{text:'#!im-style-editor 1\n:::settings {}\n'}};assert.equal(f.inspect(v1.content.text).kind,'damaged');assert.throws(()=>f.write(v1,messages,settings));
console.log('PASS: plain import, text-only storage round trips, permanent edit identities, unrelated note data retained, old version protected without migration');
