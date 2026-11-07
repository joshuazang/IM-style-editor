const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
process.env.TZ='America/Toronto';
const api=vm.runInNewContext(fs.readFileSync('shared/ui/search-filters.js','utf8')+';({target:imDateTarget,input:imDateInput,notice:imDateJumpNotice})');
const messages=[
 {id:'before',createdAt:'2026-11-01T03:59:59.999Z'},
 {id:'first',createdAt:'2026-11-01T04:00:00Z'},
 {id:'last',createdAt:'2026-11-02T04:59:59.999Z'},
 {id:'after',createdAt:'2026-11-02T05:00:00Z'},
 {id:'unknown'}, {id:'invalid',createdAt:'not a date'}
];
const snapshot=JSON.stringify(messages);
assert.equal(api.target(messages,'2026-11-01').message.id,'first');
assert.equal(api.target(messages.slice().reverse(),'2026-11-01').message.id,'first');
assert.equal(api.target(messages,'2026-11-02').message.id,'after');
assert.equal(api.target(messages,'2026-11-03').message.id,'after');
assert.equal(api.target(messages,'2026-10-01').message.id,'before');
assert.equal(api.target(messages,'2026-11-03').exact,false);
assert.equal(api.target(messages,'2026-11-01').exact,true);
assert.equal(api.notice(api.target(messages,'2026-11-01')),'');
assert.match(api.notice(api.target(messages,'2026-11-03')),/No messages on that date/);
for(const value of [undefined,'garbage','2026-02-30',0,null]){assert.equal(api.input(value),null);assert.equal(api.target(messages,value),null);}
assert.equal(api.target([],'2026-11-01'),null);
assert.equal(api.target(messages.slice(-2),'2026-11-01'),null);
const spring=[{id:'spring',createdAt:'2026-03-09T03:59:59.999Z'},{id:'tomorrow',createdAt:'2026-03-09T04:00:00Z'}];
assert.equal(api.target(spring,'2026-03-08').message.id,'spring');assert.equal(api.target(spring,'2026-03-09').message.id,'tomorrow');
assert.equal(JSON.stringify(messages),snapshot,'Navigation must not modify messages');
console.log('PASS: local date navigation, DST boundaries, unsorted messages, nearest later/earlier fallback, invalid/missing dates and immutable input');
