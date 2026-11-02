const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('next/src/note-format.js','utf8');
const context={crypto,btoa,parses:0,encodes:0,bubbleEncodes:0};
const measured=source.replace('function parseDocument(text) {','function parseDocument(text) {parses++;')
  .replace('    const text=messages.map(bubble)', '    encodes++;const text=messages.map(bubble)')
  .replace('if (!bubbleText.has(original)) {','if (!bubbleText.has(original)) {bubbleEncodes++;');
const f=vm.runInNewContext(measured+';imFormat',context),copy=value=>JSON.parse(JSON.stringify(value));
const old=vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+';imFormat',{crypto,btoa});
const bodies=['',' ','\n','\n\n','\r\n','  hello\n\n世界🙂\n','@@IM:BUBBLE\n@@IM:CONTENT\n@@IM:END','@@IM:END-BUBBLE','\\literal\n\\@@IM:BUBBLE'];
const messages=bodies.map((text,index)=>({id:f.newId(),text,reactions:index%2?['⭐']:[],createdAt:'2026-11-01T00:00:00Z',...(index===1?{edited:true,copied:true,exported:true,custom:{keep:'exact'}}:{})}));
const reply={id:messages[1].id,text:messages[1].text,noteId:'test-note'};
messages[2].replyTo=reply;
const settings={bubbleTheme:'iris',reactionOrder:['⭐'],deletedEmojis:[],pinnedMessageIds:[messages[1].id],untaggedPosition:1};
const draft='  My unsent draft\n\n🙂\n';
const text=f.portable(messages,settings,draft,reply),parsed=f.inspect(text);
assert.equal(parsed.kind,'portable');assert.deepEqual(copy(parsed.messages),messages);assert.deepEqual(copy(parsed.settings),settings);
assert.equal(parsed.draft,draft);assert.deepEqual(copy(parsed.reply),reply);
assert.equal((text.match(/^@@IM:BUBBLE$/gm)||[]).length,messages.length);
// A literal old end-marker inside a message is text, not a record boundary.
assert.equal((text.match(/^@@IM:END-BUBBLE$/gm)||[]).length,1);
const plainMessage={id:f.newId(),text:'Example',reactions:[]};
const minimal=f.portable([plainMessage],{});
assert.equal(minimal,`#!im-style-editor 3\n#!encoding utf-8\n\n@@IM:SETTINGS\n@@IM:END-SETTINGS\n\n@@IM:BUBBLE\nid: ${plainMessage.id}\n@@IM:CONTENT\n\n\nExample\n\n\n@@IM:END\n`);
assert.ok(!minimal.includes('reactions:'));assert.ok(!minimal.includes('@@IM:END-BUBBLE'));
assert.equal(f.inspect(old.portable(messages,settings,draft,reply)).kind,'damaged');
assert.equal(old.inspect(text).kind,'damaged');
console.log('PASS: format 3 has next-bubble boundaries, exact text/draft/metadata, and rejects format 2 in both directions');

let seed=20261101;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const tokens=['中文','🙂','a',' ','\t','\n','\r\n','\\','@@IM:BUBBLE','@@IM:END','@@IM:CONTENT','@@IM:DRAFT','@@IM:END-DRAFT'];
for(let i=0;i<500;i++){
 const body=Array.from({length:random(60)},()=>tokens[random(tokens.length)]).join('');
 const records=[{id:f.newId(),text:body,reactions:[]},{id:f.newId(),text:body+'\n',reactions:['📍']}];
 const result=f.inspect(f.portable(records,{},body));
 assert.equal(result.kind,'portable');assert.equal(result.messages[0].text,body);assert.equal(result.messages[1].text,body+'\n');assert.equal(result.draft,body);
}
console.log('PASS: 500 deterministic Unicode, whitespace and reserved-marker round trips with adjacent bubbles and drafts');

const note={uuid:'test-note',clientData:{other:'keep',imStyleEditor:{messages:[]}},content:{text,title:'Keep title',references:[{uuid:'other'}],appData:{unrelated:{keep:true}},appendEditorMessageData:messages,appendEditorSettings:settings}};
const read=f.readMessages(note),prefs=f.readSettings(note);
f.write(note,read,prefs,draft,reply);
assert.equal(note.clientData.other,'keep');assert.ok(!Object.hasOwn(note.clientData,'imStyleEditor'));
assert.ok(!Object.hasOwn(note.content,'appendEditorMessageData'));assert.ok(!Object.hasOwn(note.content,'appendEditorSettings'));
assert.equal(note.content.title,'Keep title');assert.deepEqual(note.content.appData,{unrelated:{keep:true}});
const before={parses:context.parses,encodes:context.encodes};
for(let i=0;i<40;i++){
 f.write(note,f.readMessages(note),f.readSettings(note),`Draft ${i}`);
 assert.equal(f.readDraft(note),`Draft ${i}`);assert.equal(f.readMessages(note),read);
}
assert.equal(context.parses,before.parses);assert.equal(context.encodes,before.encodes);
const independent={content:{text:note.content.text}};assert.deepEqual(copy(old.inspect(independent.content.text).kind),'damaged');
assert.deepEqual(copy(f.readMessages(independent)),messages);assert.equal(f.readDraft(independent),'Draft 39');
console.log('PASS: one saved representation, unrelated data retained, zero full parses or bubble re-encodes across 40 draft updates');

const many=Array.from({length:1000},(_,i)=>Object.freeze({id:f.newId(),text:`Message ${i}\n@@IM:END\n`,reactions:[]}));
f.portable(many,settings);
const count=context.bubbleEncodes;
const changed=many.map((message,i)=>i===510?{...message,text:'Changed 🙂\n\n@@IM:BUBBLE',copied:true,custom:{keep:true}}:message);
const changedText=f.portable(changed,settings);
assert.equal(context.bubbleEncodes-count,1);
const uncached=vm.runInNewContext(source+';imFormat',{crypto,btoa});
assert.equal(changedText,uncached.portable(copy(changed),copy(settings)));
assert.equal(f.inspect(changedText).messages[510].text,changed[510].text);
assert.throws(()=>f.portable([...changed,changed[0]],settings),/duplicate/);
assert.throws(()=>f.portable([...changed,{...changed[0],id:f.newId(),reactions:null}],settings),/metadata/);
console.log('PASS: editing 1 of 1,000 bubbles encodes exactly 1 block; output matches a fresh serializer; full validation remains');
const indexedTransfer=vm.runInNewContext(fs.readFileSync('next/src/message-transfer.js','utf8')+';imTransfer',{imFormat:f});
const incomingMessage={id:f.newId(),text:'Imported text',reactions:[]};
const merged=indexedTransfer.merge(changed,{ok:true,sourceNoteId:'source',messages:[incomingMessage]},'fixed');
assert.equal(merged.messages[0],changed[0]);assert.notEqual(merged.added[0],incomingMessage);
const beforeImport=context.bubbleEncodes;
f.portable(merged.messages,settings);
assert.equal(context.bubbleEncodes-beforeImport,1);
assert.equal(f.inspect(f.portable(merged.messages,settings)).messages.length,1001);
console.log('PASS: importing one message also reuses all 1,000 existing bubble blocks without changing the source records');

const corrupt=text.replace('@@IM:CONTENT',''),bad={content:{text:corrupt}};
assert.equal(f.inspect(corrupt).kind,'damaged');assert.throws(()=>f.write(bad,messages,settings));assert.equal(bad.content.text,corrupt);
for(const broken of [text.replace('@@IM:END\n',''),text.replace('@@IM:BUBBLE\n',''),text.replace('@@IM:END-SETTINGS',''),text.replace(/id: [^\n]+/,'id: invalid')])assert.equal(f.inspect(broken).kind,'damaged');
const current=messages[1];assert.equal(f.editMessage(current,current.text),current);
const edited=f.editMessage(current,'A real change');assert.equal(edited.edited,true);assert.ok(!('copied' in edited));assert.ok(!('exported' in edited));
console.log('PASS: malformed structure still blocks saving; unchanged edits preserve status and genuine edits reset copy/export');

// The clipboard protocol is shared; no format-2 note reader is added to the new plugin.
const transferSource=fs.readFileSync('src/message-transfer.js','utf8');
const legacyTransfer=vm.runInNewContext(transferSource+';imTransfer',{imFormat:old});
const nextTransfer=vm.runInNewContext(transferSource+';imTransfer',{imFormat:f});
const exported=legacyTransfer.create(messages,settings,'old-note'),incoming=nextTransfer.read(exported);
assert.equal(incoming.ok,true);const imported=nextTransfer.merge([],incoming);
assert.equal(imported.messages.length,messages.length);assert.deepEqual(copy(imported.messages.map(m=>m.text)),messages.map(m=>m.text));
assert.equal(nextTransfer.read(old.portable(messages,settings)).ok,false);
assert.equal(nextTransfer.merge(imported.messages,incoming).added.length,0);
console.log('PASS: Archive message Export imports through the existing clipboard protocol; duplicate imports are skipped');
