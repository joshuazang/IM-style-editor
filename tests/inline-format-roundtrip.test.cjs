const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const m=vm.runInNewContext(['shared/vendor/markdown-editor.js','shared/ui/markdown-model.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n')+';imMarkdown'),s=m.schema;
const texts=['举个例子。有些人越减肥越胖，继续。','word. next','a-b.c,d!e?f:g;h','  spaces around words  ','中文🙂（test）next'];
let count=0;
for(const text of texts)for(let from=0;from<text.length;from++)for(let to=from+1;to<=text.length;to++)for(const name of ['strong','em','strike']){
 const nodes=[];if(from)nodes.push(s.text(text.slice(0,from)));nodes.push(s.text(text.slice(from,to),[s.marks[name].create()]));if(to<text.length)nodes.push(s.text(text.slice(to)));
 const p=s.nodes.paragraph.create(null,nodes);
 for(const wrap of [p=>p,p=>s.nodes.bullet_list.create(null,s.nodes.list_item.create(null,p)),p=>s.nodes.ordered_list.create({order:3},s.nodes.list_item.create(null,p)),p=>s.nodes.bullet_list.create(null,s.nodes.list_item.create({checked:true},p)),p=>s.nodes.blockquote.create(null,p)]){
  const doc=s.nodes.doc.create(null,wrap(p)),saved=m.serialize(doc);assert.ok(m.parse(saved).eq(doc),JSON.stringify({text,from,to,name,saved}));count++;
 }
}
for(const names of [['strong'],['em'],['strike'],['strong','em'],['strong','strike'],['strong','em','strike']]){
 const marks=names.map(name=>s.marks[name].create());
 for(const content of [[s.text('  punctuation。 ',marks)],[s.text('前。',marks),s.nodes.hard_break.create(null,null,marks),s.text('后，',marks)],[s.nodes.hard_break.create(null,null,marks),s.text('text',marks)]]){
  const doc=s.nodes.doc.create(null,s.nodes.bullet_list.create(null,s.nodes.list_item.create(null,s.nodes.paragraph.create(null,content))));assert.ok(m.parse(m.serialize(doc)).eq(doc),m.serialize(doc));
 }
}
for(const html of ['<script>alert(1)</script>','<strong onclick="bad()">literal</strong>'])assert.ok(!m.parse(html).firstChild.firstChild?.marks.length);
console.log('PASS:',count,'partial inline formatting ranges retain exact text and marks across punctuation, whitespace, lists, tasks and quotes; marked line breaks and mixed marks survive; HTML support stays limited to safe mark tags');
