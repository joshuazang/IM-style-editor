const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=['shared/vendor/markdown-editor.js','shared/ui/markdown-model.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
const m=vm.runInNewContext(source+';imMarkdown'),s=m.schema;
const manifest=JSON.parse(fs.readFileSync('shared/vendor/markdown-sources.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('shared/vendor/markdown-editor.js')).digest('hex'),manifest.bundle_sha256);
assert.deepEqual(Object.keys(s.marks),['strong','strike']);
assert.deepEqual(Object.keys(s.nodes),['doc','paragraph','heading','blockquote','bullet_list','ordered_list','list_item','text','hard_break']);
const examples=[
 'ordinary text','**bold** and ~~struck~~','# Heading\n\nBody',
 '> Quote\n>\n> Another paragraph','- first\n- second\n  - nested',
 '3. third\n4. fourth','- [ ] waiting\n- [x] complete\n  - [ ] nested',
 '**bold ~~and struck~~ text**','Unicode 中文 🧪🙂\nnext line',
 'escaped \\* and \\# and \\~','literal \\<br> and \\&amp;',
 '#!im-style-editor 3\n@@IM:BUBBLE\n@@IM:CONTENT',
 'first\n\n\nsecond','\nfirst','first\n\n','> first\n>\n> '
];
for(const text of examples){const doc=m.parse(text);assert.ok(m.parse(m.serialize(doc)).eq(doc),text);}
const p=text=>s.node('paragraph',null,text?[s.text(text)]:[]),doc=content=>s.node('doc',null,content);
for(let empty=1;empty<=4;empty++){
 for(const blocks of [[p('before'),...Array.from({length:empty},()=>p()),p('after')],[...Array.from({length:empty},()=>p()),p('after')],[p('before'),...Array.from({length:empty},()=>p())]]){
  const d=doc(blocks);assert.ok(m.parse(m.serialize(d)).eq(d),'Empty paragraphs survive draft serialization');
 }
}
for(const content of [[s.text('end'),s.node('hard_break')],[s.node('hard_break')],[s.text('a'),s.node('hard_break'),s.node('hard_break'),s.text('b')]]){
 const d=doc([s.node('paragraph',null,content),p()]);assert.ok(m.parse(m.serialize(d)).eq(d),'Line breaks survive trailing and empty paragraphs');
}
const tasks='- [ ] parent\n  - [x] child\n- [ ] last',toggled=m.toggleCheck(tasks,1),states=[];
m.parse(toggled).descendants(n=>{if(n.type.name==='list_item'&&n.attrs.checked!==null)states.push(n.attrs.checked)});
assert.deepEqual(states,[false,false,false]);assert.equal(m.toggleCheck(tasks,99),tasks);
for(const unsupported of ['*italic*','[link](https://example.invalid)','![image](https://example.invalid/a.png)','<script>alert(1)</script>','`code`']){
 const d=m.parse(unsupported);assert.equal(d.textContent,unsupported);assert.ok(m.parse(m.serialize(d)).eq(d));
}
for(let i=0;i<1000;i++)m.parse('Unique **message '+i+'**');
assert.ok(m.cacheStats().documents<=128);assert.ok(m.cacheStats().characters<=1048576);
console.log('PASS: selected Markdown schema; pinned vendor checksum; nested formatting/lists/tasks; Unicode/control text; blank paragraphs and line breaks; unsupported syntax stays literal; bounded cache');
// A source ending in a soft line break must survive reopening without an
// additional paragraph. Empty-only prefixes must remain bounded, too.
for(const content of [[s.text('end'),s.node('hard_break')],[s.node('hard_break')],[s.text('a'),s.node('hard_break'),s.node('hard_break'),s.text('b')]]){
 const d=doc([s.node('paragraph',null,content)]);assert.ok(m.parse(m.serialize(d)).eq(d),m.serialize(d));
}
for(const source of ['- [ ] '+('item\n- [x] another\n').repeat(200),'# Heading\n\n'+('long body '.repeat(10000)),('\n'.repeat(500)+'last')]){
 const cut=m.preview(source,12,1024);assert.equal(cut.complete,false);assert.ok(cut.text.length<2048);m.parse(cut.text).check();
}
for(let level=1;level<=6;level++){
 for(const content of [[s.text('one'),s.node('hard_break'),s.text('two')],[s.node('hard_break'),s.text('body')],[s.text('end'),s.node('hard_break')]]){
  const d=doc([s.node('heading',{level},content),p('Ordinary after')]);assert.ok(m.parse(m.serialize(d)).eq(d),'Soft breaks inside headings retain their original scope');
 }
}
