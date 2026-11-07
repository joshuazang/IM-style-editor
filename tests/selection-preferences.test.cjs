const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('shared/core/host-bridge.js','utf8')+'\n'+fs.readFileSync('next/src/selection-memory.js','utf8');
const id='AAAAAAAAAAAAAAAAAAAAAA',other='BBBBBBBBBBBBBBBBBBBBBA',prefix='im-style-editor.next.selection.v1:';
const legacy=new Map([[prefix+'a',JSON.stringify({ids:[id],height:70})]]);let host={},fail=false,silent=false,callbacksFail=false,writes=0;
function client(){
 const context={queueMicrotask,imFormat:{validId:value=>typeof value==='string'&&/^[A-Za-z0-9_-]{21}[AQgw]$/.test(value)},localStorage:{getItem:key=>legacy.get(key)??null,removeItem:key=>legacy.delete(key),setItem:()=>assert.fail('No plaintext writes allowed')}};
 const api=vm.runInNewContext(source+';({init:imInitializeSelectionPreferences,restore:imRestoreSelection,remember:imRememberSelection,state:imSelectionPreferences,notice:imSelectionNotice,flush:imSaveSelectionPreferences})',context);
 const bridge={component:{data:JSON.parse(JSON.stringify(host))},getComponentDataValueForKey:key=>host[key],postMessage:(action,{componentData},callback)=>{
  assert.equal(action,'set-component-data');writes++;if(fail)throw new Error('host unavailable');if(callbacksFail){callback({error:'rejected'});return;}if(!silent)host=JSON.parse(JSON.stringify(componentData));
 }};api.init(bridge);return api;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 host={unrelated:{keep:true}};let a=client();assert.equal(a.restore('a',[{id}],null).has(id),true);assert.ok(legacy.has(prefix+'a'));await tick();
 assert.ok(legacy.has(prefix+'a'),'submission alone must not delete legacy data');assert.deepEqual(host.unrelated,{keep:true});assert.deepEqual(host.imStyleSelectionV1.notes.a.ids,[id]);
 a=client();assert.ok(!legacy.has(prefix+'a'),'fresh host read-back verifies migration');assert.equal(a.restore('a',[{id}],null).size,1);
 a.remember('b',new Set([other]),null);await tick();assert.deepEqual(host.imStyleSelectionV1.notes.b.ids,[other]);
 a.remember('a',new Set(),null);await tick();assert.ok(!host.imStyleSelectionV1.notes.a);assert.ok(host.imStyleSelectionV1.notes.b);
 console.log('PASS: encrypted preference bridge, read-back-only local cleanup, independent notes, unrelated preferences and sparse cancellation');
 legacy.set(prefix+'a',JSON.stringify({ids:[id]}));host={};fail=true;a=client();a.restore('a',[{id}],null);await tick();assert.ok(a.state.error);assert.ok(legacy.has(prefix+'a'));assert.deepEqual(host,{});
 fail=false;a.flush();await tick();assert.ok(legacy.has(prefix+'a'));a=client();assert.ok(!legacy.has(prefix+'a'));
 callbacksFail=true;a.remember('b',new Set([other]),null);await tick();assert.ok(a.state.error);callbacksFail=false;
 console.log('PASS: thrown and reported save failures are visible, no plaintext fallback, retry retains selections');
 legacy.set(prefix+'a',JSON.stringify({ids:[id]}));host={};silent=true;a=client();a.restore('a',[{id}],null);await tick();a=client();a.restore('a',[{id}],null);await tick();assert.ok(legacy.has(prefix+'a'));assert.ok(a.notice().includes('awaiting verification'));silent=false;
 a.remember('a',new Set(),null);await tick();assert.deepEqual(host.imStyleSelectionV1.notes.a.ids,[]);a=client();await tick();assert.ok(!legacy.has(prefix+'a'));assert.ok(!host.imStyleSelectionV1.notes.a);
 console.log('PASS: silent/unacknowledged writes never count as verification; cancelled migrations cannot resurrect old selections');
 host={imStyleSelectionV1:{version:1,notes:{a:{ids:['invalid']}}}};a=client();const before=writes;a.remember('a',new Set([id]),null);await tick();assert.ok(a.state.error);assert.equal(writes,before);
 console.log('PASS: malformed host preferences cannot be overwritten with a partial snapshot');
})().catch(error=>{console.error(error);process.exitCode=1});
