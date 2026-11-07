const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('shared/core/host-bridge.js','utf8')+'\n'+fs.readFileSync('next/src/silent-timer.js','utf8');
let saved={unrelated:{keep:true},imStyleSelectionV1:{version:1,notes:{a:{ids:['id']}}}},writes=0,fail=false,denied=false;
function client(){
 const api=vm.runInNewContext(source+';({init:imInitializeSilentTimer,start:imStartSilentTimer,cancel:imCancelSilentTimer,extend:imExtendSilentTimer,remaining:imTimerRemaining,label:imTimerLabel,state:imTimerState,retry:imSaveSilentTimer})');
 const bridge={component:{data:JSON.parse(JSON.stringify(saved))},getComponentDataValueForKey:key=>saved[key],postMessage:(action,{componentData},callback)=>{
  assert.equal(action,'set-component-data');writes++;if(fail)throw new Error('denied');if(denied){callback({error:'denied'});return;}saved=JSON.parse(JSON.stringify(componentData));
 }};api.init(bridge);return api;
}
let a=client();assert.equal(a.start(5,1000),true);assert.equal(saved.imSilentTimerV1.deadline,301000);assert.equal(saved.imSilentTimerV1.durationMs,300000);
assert.equal(a.remaining(a.state.timer,1000),300);assert.equal(a.label(300),'05:00');assert.equal(a.label(61),'01:01');assert.equal(a.remaining(a.state.timer,300999),1);assert.equal(a.remaining(a.state.timer,301000),0);
const before=writes;for(let now=1000;now<400000;now+=1000)a.remaining(a.state.timer,now);assert.equal(writes,before);
assert.deepEqual(saved.unrelated,{keep:true});assert.deepEqual(saved.imStyleSelectionV1.notes.a.ids,['id']);
a=client();assert.equal(a.remaining(a.state.timer,121000),180);assert.equal(a.remaining(a.state.timer,400000),0);
assert.equal(a.start(25,400000),true);assert.equal(a.remaining(a.state.timer,400000),1500);
assert.equal(a.cancel(),true);assert.equal(saved.imSilentTimerV1,null);
for(const bad of [0,-1,1,3,10,1.5,NaN,Infinity,1441])assert.equal(a.start(bad),false);
a.start(5,0);assert.equal(a.extend(false,299999),false);assert.equal(a.extend(false,300000),true);assert.equal(a.state.timer.durationMs,300000);assert.equal(a.remaining(a.state.timer,300000),60);
assert.equal(a.extend(true,360000),true);assert.equal(a.remaining(a.state.timer,360000),180);
a.start(25,0);a.extend(false,1500000);assert.equal(a.remaining(a.state.timer,1500000),300);a.extend(true,1800000);assert.equal(a.remaining(a.state.timer,1800000),900);
fail=true;assert.equal(a.start(5,0),false);assert.ok(a.state.error);const deadline=a.state.timer.deadline;fail=false;assert.equal(a.retry(),true);assert.equal(a.state.timer.deadline,deadline);
denied=true;a.start(5,0);assert.ok(a.state.error);denied=false;
saved.imSilentTimerV1={version:2,deadline:1,durationMs:60000};a=client();assert.equal(a.state.ready,false);assert.equal(a.start(5),false);
assert.ok(!/\b(?:AudioContext|Audio|Notification|fetch|localStorage|sessionStorage|vibrate)\s*[.(]/.test(source));
console.log('PASS: deadline-based expiry/restart/cancel, valid durations, reload, no per-tick saves, unrelated preferences retained, failures, and no sound/storage/network APIs');
