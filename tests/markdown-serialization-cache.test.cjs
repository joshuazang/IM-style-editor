const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const vendor=fs.readFileSync('shared/vendor/markdown-editor.js','utf8'),source=fs.readFileSync('shared/ui/markdown-model.js','utf8');
const fast=vm.runInNewContext(vendor+'\n'+source+';imMarkdown');
const start=source.indexOf('  function serialize(doc)'),end=source.indexOf('  function clip(',start);
const referenceSource=source.slice(0,start)+'function serialize(doc){return serializer.serialize(doc,{imLastBlock:doc.lastChild});}\n'+source.slice(end);
const reference=vm.runInNewContext(vendor+'\n'+referenceSource+';imMarkdown');
const cases=['','a','  ','\t','before\n\n\nend','\n\nfirst\n\n','**bold** and ~~struck~~','a\n<br>\nb','# Heading\n\nbody\n','> Quote\n>\n> text\n\nNext','- [x] Task\n  - [ ] Nested\n\nNormal','1. First\n2. Next','\\# escaped & < > 中文 🧪'];
const cloned=new WeakMap();function clone(n){if(cloned.has(n))return cloned.get(n);const marks=n.marks.map(m=>reference.schema.mark(m.type.name,m.attrs)),out=n.isText?reference.schema.text(n.text,marks):reference.schema.node(n.type.name,n.attrs,n.content.content.map(clone),marks);cloned.set(n,out);return out;}
function same(doc){const expected=reference.serialize(clone(doc));assert.equal(fast.serialize(doc),expected);assert.equal(fast.serialize(doc),expected);}
const s=fast.schema;
for(const text of cases)same(fast.parse(text));
for(const left of cases)for(const right of cases)same(s.node('doc',null,[...fast.parse(left).content.content,...fast.parse(right).content.content]));
// Reuse the same immutable paragraphs in different last-block positions and
// surrounding structural contexts, including empty and trailing soft breaks.
const paragraphs=[...cases.flatMap(t=>fast.parse(t).content.content.filter(n=>n.type===s.nodes.paragraph)),s.node('paragraph',null,[s.text('end'),s.node('hard_break')]),s.node('paragraph',null,[s.node('hard_break'),s.node('hard_break')])];
for(let i=0;i<paragraphs.length;i++)for(let j=0;j<paragraphs.length;j++)same(s.node('doc',null,[paragraphs[i],paragraphs[j]]));
const doc=fast.parse(Array.from({length:500},(_,i)=>`Paragraph ${i} **bold** 中文 and ~~strike~~.`).join('\n\n'));same(doc);
for(const at of [1,Math.floor(doc.content.size/2),doc.content.size-1]){
 const state=vm.runInNewContext(vendor+';imRichDeps').state.EditorState.create({doc});same(state.tr.insertText('edited',at).doc);
}
console.log('PASS: cached serialization exactly matches contextual reference output across edits, marks, whitespace, Unicode, lists and changing last-block soft breaks');
