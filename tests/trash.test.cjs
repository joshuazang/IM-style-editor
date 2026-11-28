const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const run = vm.runInNewContext(
  ['note-format.js','message-transfer.js'].map(name => readFileSync('shared/core/'+name,'utf8')).join('\n') + '\n;({imFormat,imTransfer})',
  {crypto,btoa}
);
const {imFormat: format, imTransfer: transfer} = run;
const draft = 'Future draft\r\n保持';
const make = (text, extra = {}) => ({id:format.newId(),text,reactions:['📌'],...extra});
const a = make('Retain');
const b = make('**Only one copy of the deleted body**\n- [x] Done', {title:'A useful title',cardColor:'mint',copied:true});
const c = make('Replying to the item', {replyTo:{id:b.id,text:'Existing quoted excerpt',noteId:'a'}});
const order = [b.id,c.id,a.id];
const pins = [b.id,a.id];
const records = [a,b,c];
const settings = {mosaicCardOrder:order,pinnedMessageIds:pins};
const note = {uuid:'a',content:{text:format.portable(records,settings,draft)}};
const plain = value => JSON.parse(JSON.stringify(value));
const compare = (actual, expected) => assert.deepEqual(plain(actual),plain(expected));
const reopen = note => ({uuid:note.uuid,content:{...note.content}});

assert.equal(format.writeTrash(note,new Set([b.id]),'move'),true);
const [deleted] = format.readTrash(note);
assert.match(deleted.trashedOn,/^\d{4}-\d{2}-\d{2}$/);
compare(deleted,{...b,trashedOn:deleted.trashedOn});
compare(format.readMessages(note),[a,c]);
assert(!note.content.preview_plain.includes(b.text));
assert.equal(note.content.text.split(b.text).length,2);
assert.equal(format.writeTrash(note,new Set([b.id]),'move'),false);
assert.equal(format.writeTrash(note,new Set([a.id]),'delete'),false);

const snap = reopen(note);
compare(format.readTrash(snap),[{...b,trashedOn:deleted.trashedOn}]);
const live = format.readMessages(snap);
const trash = format.readTrash(snap);
format.write(snap,live,format.readSettings(snap),draft+'!');
assert.equal(format.readMessages(snap),live);
assert.equal(format.readTrash(snap),trash);
format.write(snap,[...live,make('Appended')],format.readSettings(snap));
assert(format.readSettings(snap).mosaicCardOrder.includes(b.id));
compare(transfer.read(snap.content.text).messages, [...format.readMessages(snap)]);
const imported = transfer.merge(format.readMessages(snap),transfer.read(transfer.create([b],{},'source')),trash);
assert.equal(imported.added.length,1);
assert.notEqual(imported.added[0].id,b.id);
assert.equal(format.writeTrash(snap,new Set([b.id]),'restore'),true);
compare(format.readMessages(reopen(snap)).slice(0,3),records);
assert.equal(format.readDraft(snap),draft+'!');
assert.equal(format.readTrash(snap).length,0);
assert(!snap.content.text.includes('trashedOn'));

assert.equal(format.writeTrash(note,new Set([b.id,c.id]),'move'),true);
assert.equal(format.writeTrash(note,new Set([b.id]),'delete'),true);
compare(format.readTrash(reopen(note)).map(message=>message.id),[c.id]);
compare(format.readSettings(note).mosaicCardOrder,[c.id,a.id]);
compare(format.readSettings(note).pinnedMessageIds,[a.id]);
assert(!note.content.text.includes(b.text));
assert.equal(format.readDraft(note),draft);
assert.throws(()=>format.portable([{...b,trashedOn:'2026-02-31'}],{}),/Invalid/);
console.log('PASS: one recoverable record per item, local date only, drafts, order/pins, exact restore, transfer exclusion/collisions and permanent removal');
