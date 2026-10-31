const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const c={crypto,btoa};vm.createContext(c);vm.runInContext(['note-format.js','reply-ui.js','emoji-management.js'].map(n=>fs.readFileSync('src/'+n,'utf8')).join('\n')+';globalThis.f=imFormat;',c);
const plain=x=>JSON.parse(JSON.stringify(x)),f=c.f;
const messages=[{id:f.newId(),text:'\nKeep exact text\n\n',createdAt:'2026-10-28T12:00:00Z',reactions:['❤️','✅','✅','⭐'],edited:true,copied:true,exported:true,custom:{keep:true}},{id:f.newId(),text:'Only heart',reactions:['❤️']},{id:f.newId(),text:'Star only',reactions:['⭐']}];
const settings={reactionOrder:['❤️','✅','⭐'],deletedEmojis:['💡'],untaggedPosition:2,pinnedMessageIds:[messages[0].id],custom:{keep:'yes'}};
const before=JSON.stringify({messages,settings});
const merge=c.imEmojiChange(messages,settings,'❤️','⭐');assert.equal(JSON.stringify({messages,settings}),before);assert.deepEqual(plain(merge.messages[0].reactions),['⭐','✅','✅']);assert.deepEqual(plain(merge.settings.reactionOrder),['✅','⭐']);assert.equal(merge.settings.untaggedPosition,1);assert.equal(merge.messages[2],messages[2]);
const rename=c.imEmojiChange(messages,settings,'❤️','📓');assert.deepEqual(plain(rename.settings.reactionOrder),['📓','✅','⭐']);assert.equal(rename.settings.untaggedPosition,2);assert.deepEqual(plain(rename.messages[0].reactions),['📓','✅','✅','⭐']);
const removed=c.imEmojiChange(messages,settings,'❤️');assert.equal(removed.messages.length,messages.length);assert.deepEqual(plain(removed.messages[1].reactions),[]);assert.deepEqual(plain(removed.messages[0].reactions),['✅','✅','⭐']);assert.ok(removed.messages.every(m=>!m.reactions.includes('❤️')));
for(const result of [rename,merge,removed])for(let i=0;i<messages.length;i++){const {reactions,...actual}=result.messages[i],{reactions:old,...expected}=messages[i];assert.deepEqual(plain(actual),expected);assert.deepEqual(plain(result.settings.pinnedMessageIds),settings.pinnedMessageIds);assert.deepEqual(plain(result.settings.custom),settings.custom)}
const same=c.imEmojiChange(messages,settings,'❤️','❤️');assert.equal(same.messages,messages);assert.equal(same.settings,settings);
const note={content:{text:f.portable(messages,settings,'Unsent\n draft')}};f.write(note,removed.messages,removed.settings);assert.equal(f.readDraft(note),'Unsent\n draft');assert.equal(f.readMessages(note).length,3);assert.equal(f.inspect(note.content.text).kind,'portable');
assert.throws(()=>c.imEmojiChange(messages,settings,'❤️','   '));assert.throws(()=>c.imEmojiChange(messages,settings,'❤️',' __im_untagged__ '));
console.log('PASS category rename/merge/delete, exact metadata/statuses, other reactions, order, sparse tags and draft preservation');
