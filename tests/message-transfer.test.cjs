const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {f,t}=vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+'\n'+fs.readFileSync('src/message-transfer.js','utf8')+';({f:imFormat,t:imTransfer})',{crypto});
const copy=value=>JSON.parse(JSON.stringify(value));
const source=fs.readFileSync('tests/fixtures/collapsed-note.txt','utf8');
assert.equal(f.inspect(source).kind,'damaged');const proposal=f.recover(source);
assert.ok(proposal);assert.equal(proposal.messages.length,20);
assert.equal(proposal.messages[0].text,'示例消息 01');assert.equal(proposal.messages.at(-1).text,'示例消息 20');
assert.equal(proposal.messages[0].id,'example-01');
assert.equal(proposal.messages[0].createdAt,'2026-01-01T12:00:01.000Z');assert.deepEqual(copy(proposal.messages[0].reactions),['⭐']);
const note={uuid:'repair',content:{text:source,title:'Keep title'}};const restored=f.restore(note);
assert.equal(note.content.text,source,'Restore must not mutate the original input object');
assert.equal(f.inspect(restored.content.text).kind,'portable');assert.equal(f.readMessages(restored).length,20);
assert.equal(f.readSettings(restored).recoveryOriginal.text,source);
assert.equal(restored.content.title,'Keep title');
const flattenedAgain=restored.content.text.replace(/\n/g,' ');
assert.equal(f.recover(flattenedAgain).messages.length,20,'A recovery backup inside JSON must not be mistaken for a second document header');
const wrapped='{'+source+' \\\n}';const extra=f.recover(wrapped);
assert.equal(extra.messages.length,22);assert.equal(extra.messages[0].text,'{');assert.equal(extra.messages.at(-1).text,'\n \\\n}');
assert.equal(f.inspect(wrapped).kind,'damaged');
for(const bad of [source.replace(':::end-bubble',''),source.replace('"id":"example-02"','"id":"example-01"'),source.replace('"reactions":["⭐"]','"reactions":[null]'),source.replace(':::settings {',':::settings nope{'),source.replace(':::end-im-style-editor',''),source.replace('#!im-style-editor 1','#!im-style-editor 9')]){
 assert.equal(f.recover(bad),null,bad);assert.throws(()=>f.restore({content:{text:bad}}));
}
const records=[{id:'one',text:'Keep\n\nblank lines\r\nWindows C:\\notes\n:::end-bubble 🙂',createdAt:'2026-10-27T12:00:00Z',editedAt:'2026-10-27T12:01:00Z',reactions:['⭐','✅'],separatorAfter:'\n\n',custom:{retained:true}},
{id:'two',text:'Second',reactions:[],forwarding:{sourceMessageId:'older',sourceNoteId:'older-note',forwardedAt:'2025-01-01T00:00:00Z'}}];
const settings={bubbleTheme:'lime',backgroundTheme:'sand',scale:1.12,reactionOrder:['✅','⭐'],recoveryOriginal:{text:'SECRET OTHER MESSAGES'}};
const exported=t.create(records,settings,'source-note');assert.ok(!exported.includes('SECRET OTHER MESSAGES'));
const payload=t.read(exported);assert.equal(payload.ok,true);assert.deepEqual(copy(payload.messages),records);
assert.deepEqual(copy(t.read(exported.replace(/\n\s*/g,' ')).messages),records,'Whitespace outside JSON strings may be flattened');
let merged=t.merge([],payload,'2026-10-27T13:00:00Z');assert.equal(merged.added.length,2);
assert.deepEqual(copy(merged.added[0]),{...records[0],forwarding:{sourceMessageId:'one',sourceNoteId:'source-note',forwardedAt:'2026-10-27T13:00:00Z'}});
assert.deepEqual(copy(merged.added[1].forwarding.previous),records[1].forwarding);
assert.equal(t.merge(merged.messages,payload).added.length,0);assert.equal(t.merge(merged.messages,payload).skipped,2);
const collision=t.merge([{id:'one',text:'Different existing text',reactions:[]}],payload);assert.notEqual(collision.added[0].id,'one');assert.equal(collision.added[0].forwarding.sourceMessageId,'one');
assert.equal(collision.messages[0].text,'Different existing text');assert.equal(t.merge(collision.messages,payload).added.length,0);
const round={content:{text:''}};f.write(round,collision.messages,settings);assert.deepEqual(copy(f.readMessages({content:{text:round.content.text}})),copy(collision.messages));
const canonical=f.portable(records,settings);assert.equal(t.read(canonical).ok,true);
for(const bad of ['', 'plain text', exported.slice(0,-20), exported.replace('"id": "two"','"id": "one"'), exported.replace('"⭐"','null'), '#!im-style-forward 9\n{}']) assert.equal(t.read(bad).ok,false,bad);
console.log('PASS: 20 flattened records recovered with raw backup; missing/invalid records protected; exact forwarding, collision IDs, duplicates, history and text-only round trips');
