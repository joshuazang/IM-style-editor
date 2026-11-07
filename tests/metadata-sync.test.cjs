const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const requests=[];const pf={sentMessages:[],jsonObjectForItem:note=>note,postMessage:(action,data,callback)=>requests.push({data,callback})};
const api=vm.runInNewContext(fs.readFileSync('shared/core/host-bridge.js','utf8')+'\n'+fs.readFileSync('shared/core/note-storage.js','utf8')+';({apply:imApplyNoteMetadata,metadata:imNoteMetadataReceived,received:imNoteReceived,save:imPersistNote,pending:imNoteSavePending})',{pf,setTimeout:()=>0,clearTimeout:()=>{}});
(async()=>{
 const content={text:'Latest sent bubble; draft is empty',title:'Keep title'},clientData={other:{keep:true}};
 const note={uuid:'a',content_type:'Note',content,clientData,created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-02T00:00:00Z'};
 api.received(note);
 const older={uuid:'a',isMetadataUpdate:true,content:{text:'Old unfinished draft'},clientData:{stale:true},updated_at:'2026-11-02T01:00:00Z'};
 api.metadata(note,older);assert.equal(note.content,content);assert.equal(note.clientData,clientData);assert.equal(note.updated_at,older.updated_at);
 await api.save(note);assert.equal(requests.length,0,'A metadata-only update must not force another content write');
 api.metadata(note,{...older,updated_at:'2026-11-01T00:00:00Z'});assert.equal(note.updated_at,older.updated_at);
 api.apply(note,{...older,uuid:'b',updated_at:'2026-11-03T00:00:00Z'});assert.equal(note.updated_at,older.updated_at);
 api.apply(note,{...older,isMetadataUpdate:false,updated_at:'2026-11-03T00:00:00Z'});assert.equal(note.updated_at,older.updated_at);
 api.apply(note,{...older,updated_at:{toString:0,valueOf:0}});assert.equal(note.updated_at,older.updated_at);
 api.metadata(undefined,{isMetadataUpdate:true});
 api.apply(note,{...older,updated_at:new Date('2026-11-02T02:00:00.123Z')});assert.equal(note.updated_at.getTime(),new Date('2026-11-02T02:00:00.123Z').getTime());
 // The current draft can be newer than both host metadata and the last acknowledgment.
 note.content={...content,text:'Latest unconfirmed draft'};const pending=api.save(note);let settled=false;pending.then(()=>{settled=true;});
 api.metadata(note,older);await Promise.resolve();assert.equal(settled,false);assert.equal(api.pending('a'),true);
 assert.equal(note.content.text,'Latest unconfirmed draft');assert.equal(requests.length,1);
 requests[0].callback({});await pending;
 console.log('PASS: metadata updates preserve content/clientData, accept monotonic host dates, skip redundant saves, and never acknowledge an unconfirmed draft');
})().catch(error=>{console.error(error);process.exitCode=1});
