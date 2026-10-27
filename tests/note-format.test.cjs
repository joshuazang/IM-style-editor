const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const format = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/note-format.js'), 'utf8') + ';imFormat', { crypto });
const clone = value => JSON.parse(JSON.stringify(value));
const settings = { bubbleTheme: 'sky', backgroundTheme: 'mist', scale: 1.4, reactionOrder: ['⭐'] };
const messages = [
  { id: 'first', text: 'A multiline message\nwith its own lines', createdAt: '2026-01-01T12:00:00Z', reactions: ['⭐'] },
  { id: 'second', text: 'Second message', createdAt: '2026-01-02T12:00:00Z', editedAt: '2026-01-03T12:00:00Z', reactions: [] },
  { id: 'third', text: '中文 🐈 message', createdAt: '2026-01-04T12:00:00Z', reactions: ['❤️'] }
];
let checks = 0;
function exact(note) {
  assert.equal(format.serialize(format.readMessages(note)), note.content.text);
  checks++;
}
for (const text of ['', 'One paragraph\nwith lines\n\nAnother paragraph', '\n\nLeading\n\n\nMiddle\n\n', 'Windows\r\nlines\r\n\r\nnext\r\n', '  \n\t\nIndented\n \nNext  ', '🙂\n\n🐈中文', '\n', '\r\n\r\n']) {
  assert.equal(format.serialize(format.fromPlainText(text)), text);
  exact({ content: { text } });
}
assert.equal(format.fromPlainText('one\nline\n\ntwo').length, 2);
assert.equal(format.fromPlainText('one\nline\n\ntwo')[0].text, 'one\nline');
let note = { uuid: 'note-a', clientData: { anotherSetting: 42 }, content: { title: 'Unchanged', text: '', appData: { other: { protected: true } } } };
format.write(note, messages, settings);
const plain = note.content.text;
assert.equal(note.content.title, 'Unchanged');
assert.equal(note.clientData.anotherSetting, 42);
assert.deepEqual(clone(note.content.appData), { other: { protected: true } });
// A plain-text editor can remove the legacy custom fields; native clientData survives.
for (let i = 0; i < 10; i++) {
  note.content = { title: note.content.title, text: note.content.text, appData: note.content.appData };
  const restored = format.readMessages(note);
  assert.deepEqual(clone(restored), messages);
  assert.deepEqual(clone(format.readSettings(note)), settings);
  assert.equal(note.content.text, plain);
  format.write(note, restored, format.readSettings(note));
  exact(note);
}
const old = { content: { text: plain, appendEditorMessageData: clone(messages), appendEditorSettings: settings } };
assert.deepEqual(clone(format.readMessages(old)), messages);
const legacyRanges = { content: { text: 'first\nsecond\n\ntrailing', appendEditorMessages: [{ start: 0, end: 5 }, { start: 6, end: 12 }] } };
exact(legacyRanges);
exact({ content: { text: 'keep every character\n\nnext', appendEditorMessages: [{ start: 999, end: 1000 }] } });
const edited = clone(note);
edited.content.text = plain.replace('Second message', 'Second revised message');
const revised = format.readMessages(edited);
assert.equal(format.serialize(revised), edited.content.text);
assert.equal(revised[1].id, 'second');
assert.equal(revised[1].createdAt, messages[1].createdAt);
assert.deepEqual(clone(revised[0].reactions), ['⭐']);
exact(edited);
const cleared = clone(note); cleared.content.text = '';
assert.equal(format.readMessages(cleared).length, 0);
// When an old editor changes categories, its matching legacy data takes priority.
const oldEditor = clone(note); oldEditor.content.appendEditorMessageData[0].reactions = ['✅'];
assert.deepEqual(clone(format.readMessages(oldEditor)[0].reactions), ['✅']);
let seed = 90210;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
const chars = ['a', ' ', '\n', '\r\n', '🙂', '猫', '\t', 'xyz'];
for (let i = 0; i < 1000; i++) {
  const target = clone(note);
  const left = random(plain.length + 1), right = left + random(plain.length - left + 1);
  let replacement = '';
  for (let j = 0, n = random(12); j < n; j++) replacement += chars[random(chars.length)];
  target.content.text = plain.slice(0, left) + replacement + plain.slice(right);
  exact(target);
}
for (let i = 0; i < 300; i++) {
  let text = '';
  for (let j = 0, n = random(40); j < n; j++) text += chars[random(chars.length)];
  assert.equal(format.serialize(format.fromPlainText(text)), text);
  checks++;
}
console.log(`PASS: ${checks} exact-text checks; ten editor round trips preserve IDs, timestamps, categories and settings`);
