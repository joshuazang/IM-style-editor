const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const context={crypto,btoa};
const api=vm.runInNewContext(['note-format.js','message-transfer.js','reply-record.js'].map(name=>fs.readFileSync('shared/core/'+name,'utf8')).join('\n')+';({f:imFormat,t:imTransfer,snapshot:imReplySnapshot,target:imReplyTarget,record:imReplyRecord})',context);
const {f,t,snapshot,target,record}=api,plain=value=>JSON.parse(JSON.stringify(value));
const messages=[];
for(let i=0;i<100;i++)messages.push({id:f.newId(),text:'Short thought '+i,reactions:i%2?['📓']:[],createdAt:'2026-11-06T12:00:00Z',...(i?{replyTo:snapshot(messages[i-1],'same-note')}:{})});
const size=Buffer.byteLength(f.portable(messages,{}));assert.ok(size<70000,'New chains must not embed all previous quote history');
for(let i=1;i<messages.length;i++){
 assert.equal(messages[i].replyTo.text,messages[i-1].text);assert.equal(target(messages,messages[i].replyTo,'same-note').id,messages[i-1].id);
 if(i>1)assert.equal(messages[i].replyTo.metadata.replyTo.text,messages[i-2].text);
 if(i>2)assert.ok(!messages[i].replyTo.metadata.replyTo.metadata?.replyTo);
}
const source=JSON.stringify(messages);const quote=snapshot(messages[99],'same-note');assert.equal(JSON.stringify(messages),source);
assert.equal(record(quote).replyTo.text,messages[98].text);
const exported=t.read(t.create(messages,{},'same-note'));assert.ok(exported.ok);const imported=t.merge([],exported);
assert.equal(imported.added.length,100);assert.equal(target(imported.messages,messages[99].replyTo,'other-note').forwarding.sourceMessageId,messages[98].id);
const malformed={id:f.newId(),text:'Preserve extra metadata',reactions:[],mergeSources:'not-an-array',forwarding:{previous:null}};
const match={id:f.newId(),text:'Target',reactions:[]};
assert.equal(target([malformed,null].filter(Boolean),{id:match.id,noteId:'here'},'here'),undefined);
malformed.mergeSources=[null,17,'str',{id:match.id,noteId:'here'}];assert.equal(target([malformed],{id:match.id,noteId:'here'},'here').id,malformed.id);
const legacy={id:f.newId(),text:'Legacy',reactions:[],replyTo:{id:messages[1].id,noteId:'same-note',text:'Old quote',metadata:{replyTo:messages[98].replyTo,unknown:{keep:true}}}};
const text=f.portable([legacy],{}),note={content:{text}},before=plain(f.readMessages(note));snapshot(before[0],'new');f.write(note,f.readMessages(note),f.readSettings(note));
assert.deepEqual(plain(f.readMessages(note)),before,'Existing nested replies must remain intact');
console.log('PASS: bounded new reply snapshots, immediate context and IDs retained, forwarded navigation/import, malformed optional metadata guards, existing nested notes unchanged; 100-message chain '+size+' bytes');
