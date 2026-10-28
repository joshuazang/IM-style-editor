const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const f=vm.runInNewContext(fs.readFileSync('src/note-format.js','utf8')+';imFormat',{crypto,btoa});
const plain=v=>JSON.parse(JSON.stringify(v));
const message={id:f.newId(),text:'\n\nMessage\n\n',createdAt:'2026-01-01T00:00:00Z',reactions:[],copied:false,exported:null,edited:'anything'};
const text=f.portable([message],{},'\n\nAn unsent draft\r\n\n@@IM:END-DRAFT\n\\literal\n\n');
const parsed=f.inspect(text);assert.equal(parsed.kind,'portable',parsed.error);
assert.equal(parsed.draft,'\n\nAn unsent draft\r\n\n@@IM:END-DRAFT\n\\literal\n\n');
assert.ok(text.indexOf('@@IM:END-SETTINGS')<text.indexOf('@@IM:DRAFT')&&text.indexOf('@@IM:END-DRAFT')<text.indexOf('@@IM:BUBBLE'));
assert.ok(text.includes('\nedited\ncopied\nexported\n'));
assert.ok(!text.includes('edited:')&&!text.includes('copied:')&&!text.includes('exported:'));
assert.equal(parsed.messages[0].edited,true);assert.equal(parsed.messages[0].copied,true);assert.equal(parsed.messages[0].exported,true);
for(const value of ['T','true','false','0','','2020-01-01T00:00:00Z','arbitrary invalid JSON [']){
 const old=text.replace('\nedited\n','\nedited: '+value+'\n');
 assert.equal(f.inspect(old).kind,'portable');assert.equal(f.inspect(old).messages[0].edited,true);
}
const oldMessage={id:f.newId(),text:'old',reactions:[],editedAt:'2020-01-01T00:00:00Z'};
assert.ok(f.portable([oldMessage],{}).includes('\nedited\n'));
assert.ok(!f.portable([oldMessage],{}).includes('2020-01-01'));
assert.equal(f.editMessage(message,message.text),message);
const changed=f.editMessage(message,'Changed');assert.equal(changed.edited,true);assert.ok(!Object.hasOwn(changed,'copied')&&!Object.hasOwn(changed,'exported'));assert.equal(changed.createdAt,message.createdAt);
let note={content:{text}};f.write(note,parsed.messages,parsed.settings);assert.equal(f.readDraft(note),parsed.draft);assert.ok(f.isCurrent(note,parsed.messages,parsed.settings));
f.write(note,parsed.messages,parsed.settings,'');assert.equal(f.readDraft(note),'');assert.ok(!note.content.text.includes('@@IM:DRAFT'));assert.ok(!Object.hasOwn(note.clientData.imStyleEditor,'draft'));
for(const draft of ['', '\n', '\r\n','  \t  ','\n\n', '@@IM:BUBBLE\n@@IM:CONTENT\n@@IM:END-DRAFT', '\\@@IM:END-DRAFT']){
 const encoded=f.portable([],{},draft);assert.equal(f.inspect(encoded).draft,draft);
}
for(const broken of [text.replace(/^@@IM:END-DRAFT$/m,'@@IM:BROKEN'),f.portable([],{},'draft').replace('@@IM:DRAFT\n\n\n','@@IM:DRAFT\n\n'),text.replace('\nedited\n','\nedited\nedited\n'),text.replace('\ncopied\n','\nunknown-status\n')])assert.equal(f.inspect(broken).kind,'damaged');
// Previously legal, unescaped draft-marker words inside a historical bubble remain text.
const oldLiteral=f.portable([{id:f.newId(),text:'@@IM:DRAFT\n@@IM:END-DRAFT',reactions:[]}],{}).replace('\\@@IM:DRAFT','@@IM:DRAFT').replace('\\@@IM:END-DRAFT','@@IM:END-DRAFT');assert.equal(f.inspect(oldLiteral).messages[0].text,'@@IM:DRAFT\n@@IM:END-DRAFT');
console.log('PASS: presence statuses, old edit fields, exact draft framing/escaping, draft omission and unchanged edit semantics');

const unusual=JSON.parse('{"__proto__":{"keep":"yes"},"custom":"safe"}');
const strange={id:f.newId(),text:'Keep metadata',reactions:[],...unusual};
assert.deepEqual(plain(f.inspect(f.portable([strange],unusual)).messages[0]),strange);
assert.deepEqual(plain(f.inspect(f.portable([strange],unusual)).settings),unusual);

const config={edited:'a custom setting',copied:false,exported:123,editedAt:'a settings value'};
assert.deepEqual(plain(f.inspect(f.portable([],config)).settings),config);
