const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const requests=[];let encodedBytes=0;
const api=vm.runInNewContext(fs.readFileSync('next/src/note-storage.js','utf8')+';({save:imPersistNote,snapshot:imNoteSnapshot})',{
  JSON:{parse:JSON.parse,stringify:value=>{const result=JSON.stringify(value);encodedBytes+=Buffer.byteLength(result);return result;}},
  pf:{jsonObjectForItem:note=>({...note,parent:null,children:null}),postMessage:(action,data,callback)=>requests.push({data,callback})},
  imReleaseHostReply:()=>{},setTimeout:()=>0,clearTimeout:()=>{}
});
(async()=>{
  const note={uuid:'large',content_type:'Note',content:{text:'Exact 🙂\n\\@@IM:END\n'.repeat(100000),title:'Title',references:[{uuid:'other'}],appData:{keep:{value:1}}},clientData:{other:{keep:true}}};
  const original=JSON.parse(JSON.stringify(note)),first=api.save(note);
  note.content.text+='draft 1';const second=api.save(note);
  note.content.text+='draft 2';const latestText=note.content.text,latest=api.save(note);
  note.content.text='mutation after saving';note.content.appData.keep.value=99;note.content.references[0].uuid='changed';note.clientData.other.keep=false;
  assert.equal(requests.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].data.items[0])),{...original,parent:null,children:null});
  requests[0].callback({});await first;
  assert.equal(requests.length,2);const submitted=requests[1].data.items[0];
  assert.equal(submitted.content.text,latestText);assert.equal(submitted.content.appData.keep.value,1);
  assert.equal(submitted.content.references[0].uuid,'other');assert.equal(submitted.clientData.other.keep,true);
  requests[1].callback({});await Promise.all([second,latest]);
  assert.ok(encodedBytes<2000,`Snapshot cloning unexpectedly encoded ${encodedBytes} bytes`);
  for(const text of [undefined,null,123]){
    const input={uuid:'fallback',content:{text,title:'Keep'}};
    assert.deepEqual(JSON.parse(JSON.stringify(api.snapshot(input).item)),{...JSON.parse(JSON.stringify(input)),parent:null,children:null});
  }
  console.log(`PASS: immediate submission, superseded queued drafts coalesce, exact captured text and deeply isolated metadata; ${encodedBytes} bytes encoded for snapshot cloning of three ~2 MB drafts`);
})().catch(error=>{console.error(error);process.exitCode=1});
