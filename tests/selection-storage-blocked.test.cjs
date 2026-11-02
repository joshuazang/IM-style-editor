const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('next/src/selection-memory.js','utf8');
const id='AAAAAAAAAAAAAAAAAAAAAA',other='BBBBBBBBBBBBBBBBBBBBBA',prefix='im-style-editor.next.selection.v1:';
const copy=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setImmediate(resolve));
function client(saved={},mode='getter',legacy=new Map()){
  let host=copy(saved),reads=0,writes=0,fail=false;
  const context={queueMicrotask,imFormat:{validId:value=>[id,other].includes(value)}};
  const storage={getItem:key=>{reads++;if(mode==='read')throw new Error('Storage access denied');return legacy.get(key)??null;},removeItem:key=>{if(mode==='remove')throw new Error('Removal denied');legacy.delete(key);},setItem:()=>assert.fail('No browser storage writes allowed')};
  Object.defineProperty(context,'localStorage',{get(){if(mode==='getter'){reads++;throw new Error('Storage access denied');}return storage;}});
  const api=vm.runInNewContext(source+';({init:imInitializeSelectionPreferences,restore:imRestoreSelection,remember:imRememberSelection,state:imSelectionPreferences,notice:imSelectionNotice,retry:imSaveSelectionPreferences})',context);
  const bridge={component:{data:copy(host)},getComponentDataValueForKey:key=>host[key],postMessage:(action,{componentData},callback)=>{
    assert.equal(action,'set-component-data');writes++;
    if(fail){callback({error:'rejected'});return;}host=copy(componentData);
  }};
  api.init(bridge);
  return {...api,host:()=>host,reads:()=>reads,writes:()=>writes,reject:value=>{fail=value;}};
}
(async()=>{
  for(const mode of ['getter','read']){
    const a=client({unrelated:{keep:true}},mode);
    for(const uuid of ['a','b','c','a','b'])assert.equal(a.restore(uuid,[{id},{id:other}],null).size,0);
    await tick();assert.equal(a.notice(),'');assert.equal(a.reads(),1);assert.equal(a.writes(),0);
    a.remember('a',new Set([id]),null);await tick();a.remember('b',new Set([other]),null);await tick();
    assert.deepEqual(a.host().imStyleSelectionV1.notes.a.ids,[id]);assert.deepEqual(a.host().imStyleSelectionV1.notes.b.ids,[other]);
    assert.equal(a.restore('a',[{id}],null).has(id),true);assert.equal(a.notice(),'');assert.equal(a.host().unrelated.keep,true);
    const reopened=client(a.host(),mode);assert.equal(reopened.notice(),'');assert.equal(reopened.restore('b',[{id:other}],null).has(other),true);
    reopened.restore('new',[{id}],null);assert.equal(reopened.notice(),'');assert.equal(reopened.reads(),1);
    a.reject(true);a.remember('a',new Set(),null);await tick();assert.match(a.notice(),/Could not confirm/);
    a.restore('c',[],null);assert.match(a.notice(),/Could not confirm/,'Optional legacy reads must not hide real save errors');
    a.reject(false);a.retry();await tick();assert.equal(a.notice(),'');assert.deepEqual(a.host().imStyleSelectionV1.notes.a.ids,[]);
    assert.equal(a.restore('a',[{id}],null).size,0);
  }
  console.log('PASS: denied storage getter/read causes no note-switch warnings or unnecessary writes; encrypted selection saving, restoration and genuine failure/retry remain functional');

  const legacy=new Map([[prefix+'cancelled',JSON.stringify({ids:[id]})]]);
  const saved={imStyleSelectionV1:{version:1,notes:{cancelled:{ids:[]},selected:{ids:[other]}}}};
  const blocked=client(saved,'getter',legacy);await tick();
  assert.equal(blocked.notice(),'');assert.equal(blocked.writes(),0);assert.deepEqual(blocked.host(),saved);
  assert.equal(blocked.restore('cancelled',[{id}],null).size,0);assert.ok(legacy.has(prefix+'cancelled'));
  blocked.remember('cancelled',new Set(),null);await tick();assert.deepEqual(blocked.host().imStyleSelectionV1.notes.cancelled.ids,[]);
  const available=client(blocked.host(),'available',legacy);await tick();
  assert.ok(!legacy.has(prefix+'cancelled'));assert.ok(!available.host().imStyleSelectionV1.notes.cancelled);
  assert.deepEqual(available.host().imStyleSelectionV1.notes.selected.ids,[other]);assert.equal(available.notice(),'');
  const known=client(saved,'remove',new Map([[prefix+'cancelled',JSON.stringify({ids:[id]})]]));
  assert.match(known.notice(),/local cleanup is incomplete/);assert.ok(known.state.notes.cancelled);
  console.log('PASS: inaccessible legacy data stays untouched; cancellation tombstones survive blocked access; verified cleanup resumes on reopening; known removal failures remain visible');
})().catch(error=>{console.error(error);process.exitCode=1});
