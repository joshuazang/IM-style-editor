const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const load=()=>vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});
const f=load(),other=load(),plain=v=>JSON.parse(JSON.stringify(v));
const record={id:f.newId(),text:'First line is body\r\n\r\ntitle: "Literal body"\n@@IM:CONTENT\n',createdAt:'2026-11-07T12:00:00Z',reactions:['📍'],copied:true,exported:true,cardColor:'iris',custom:{keep:true}};
const initial=f.portable([record],{},'Capture draft\r\n');assert.equal(f.inspect(initial).messages[0].title,undefined);
for(const title of ['A heading','123','true','Line one\nLine two','  Exact spaces  ','Quotes " \\ \r\n@@IM:BUBBLE','🙂 中文\u2028\u2029','<script>alert(1)</script>']){
 const changed=f.withTitle(record,title),saved=f.portable([changed],{},'Capture draft\r\n');
 assert.ok(saved.includes('title: "'));
 const parsed=other.inspect(saved);assert.equal(parsed.kind,'portable');assert.equal(parsed.messages[0].title,title);assert.equal(parsed.messages[0].text,record.text);assert.equal(parsed.draft,'Capture draft\r\n');
 assert.deepEqual(plain({...parsed.messages[0],title:undefined}),plain({...record,title:undefined}));
 assert.equal(f.withTitle(changed,title),changed);assert.deepEqual(plain(f.withTitle(changed,'')),record);
}
const titled=f.portable([f.withTitle(record,'Title')],{});
for(const raw of ['Title','true','123','null','{}','[]','"unterminated','"bad\\q"'])assert.equal(f.inspect(titled.replace('title: "Title"','title: '+raw)).kind,'damaged');
assert.equal(f.inspect(titled.replace('title: "Title"','title: "Title"\ntitle: "Duplicate"')).kind,'damaged');
assert.throws(()=>f.withTitle(record,{}),/Title/);assert.throws(()=>f.portable([{...record,title:123}],{}),/metadata/);
const many=Array.from({length:1000},(_,i)=>({...record,id:f.newId(),text:'word '.repeat(50)})),before=f.portable(many,{});
assert.equal(f.portable(many.map(m=>f.withTitle(m,'')),{}),before,'Unused titles add zero stored bytes');
assert.equal(f.withTitle(record,''),record);
const later={...record,id:f.newId(),title:'Later heading',text:'Later body'};assert.equal(f.mergeText([f.withTitle(record,'First heading'),later]),record.text+'\n\nLater heading\nLater body');
console.log('PASS: direct quoted titles, escaped multiline/Unicode/literal controls, exact body/draft/metadata/status preservation, malformed refusal, no-op identity and zero bytes for 1,000 unused titles');
