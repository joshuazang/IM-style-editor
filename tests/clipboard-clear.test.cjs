const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness({legacy=true,modern=false,data=true,throws=false}={}){
  const listeners=new Set(),events=[],writes=[];
  const context={document:{addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)},navigator:{clipboard:{writeText:async text=>{writes.push(text);if(!modern)throw Error('blocked')}}}};
  context.simulate=text=>{
    events.push(['legacy',text]);if(throws)throw Error('copy failed');if(!legacy)return false;
    const event={preventDefault(){this.prevented=true},clipboardData:data?{clearData:()=>events.push(['clearData']),setData:(type,value)=>events.push(['setData',type,value])}:null};
    for(const fn of listeners)fn(event);assert.equal(event.prevented,true);return true;
  };
  const api=vm.runInNewContext(fs.readFileSync('next/src/transfer-ui.js','utf8')+';imLegacyCopy=simulate;({clear:imClearClipboard})',context);
  return {api,listeners,events,writes};
}
(async()=>{
  const accepted=harness();const promise=accepted.api.clear();assert.deepEqual(accepted.events[0],['legacy',' '],'The gesture-driven operation must run before yielding');assert.equal(await promise,true);assert.ok(accepted.events.some(event=>event[0]==='setData'&&event[1]==='text/plain'&&event[2]===''));assert.deepEqual(accepted.writes,[]);assert.equal(accepted.listeners.size,0);
  const blocked=harness({legacy:false});assert.equal(await blocked.api.clear(),false);assert.deepEqual(blocked.writes,['']);assert.equal(blocked.listeners.size,0);
  const fallback=harness({legacy:false,modern:true});assert.equal(await fallback.api.clear(),true);assert.deepEqual(fallback.writes,['']);assert.equal(fallback.listeners.size,0);
  const missing=harness({data:false});assert.equal(await missing.api.clear(),false);assert.equal(missing.listeners.size,0,'No handler remains to intercept a later copy');
  const failed=harness({throws:true});assert.equal(await failed.api.clear(),false);assert.equal(failed.listeners.size,0);
  console.log('PASS: explicit-gesture empty clipboard write, permission denial, modern fallback, no false success and listener cleanup on all paths');
})().catch(error=>{console.error(error);process.exitCode=1});
