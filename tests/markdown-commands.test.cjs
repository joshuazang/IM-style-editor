const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({});for(const p of ['shared/vendor/markdown-editor.js','shared/ui/markdown-model.js','shared/ui/markdown-commands.js'])vm.runInContext(fs.readFileSync(p,'utf8'),context);
const {m,c,d}=vm.runInContext('({m:imMarkdown,c:imMarkdownCommands,d:imRichDeps})',context),s=m.schema;
function state(text,needle){const doc=m.parse(text);let pos=d.state.TextSelection.atEnd(doc).from;if(needle){doc.descendants((node,p)=>{if(node.isText&&node.text.includes(needle))pos=p+node.text.indexOf(needle)+needle.length;});}return d.state.EditorState.create({doc,selection:d.state.TextSelection.create(doc,pos)});}
function run(start,command){let next=start;assert.ok(command(start,tr=>next=start.apply(tr)));return next;}
for(const text of ['ordinary','**bold**','~~struck~~','# Heading','> quote','- one\n- two','- [x] task','> - nested','- first\n  - deeply nested']){
 const before=state(text),after=run(before,c.exitFormat);assert.equal(after.selection.$from.depth,1,text);assert.equal(after.selection.$from.parent.type.name,'paragraph',text);assert.equal(after.storedMarks.length,0);assert.equal(after.doc.textContent,before.doc.textContent,text);assert.ok(m.parse(m.serialize(after.doc)).eq(after.doc),text);
}
const quote=run(state('> quote','quo'),c.exitFormat);assert.equal(quote.doc.child(0).type.name,'blockquote');assert.equal(quote.doc.child(0).textContent,'quo');assert.equal(quote.doc.child(1).type.name,'paragraph');assert.equal(quote.doc.child(1).textContent,'te');
const heading=run(state('# Heading'),c.enter);assert.equal(heading.doc.lastChild.type.name,'paragraph');
const checked=run(state('- [x] done'),c.enter);assert.equal(checked.doc.firstChild.childCount,2);assert.equal(checked.doc.firstChild.lastChild.attrs.checked,false);
const bold=state('**bold**'),br=run(bold,c.lineBreak);assert.equal(br.doc.lastChild.lastChild.type.name,'hard_break');assert.equal(br.storedMarks[0].type.name,'strong');
assert.equal(c.structural(state('ordinary')),false);assert.equal(c.structural(state('> quote')),true);assert.equal(c.structural(state('- item')),true);assert.equal(c.structural(state('# H')),true);
console.log('PASS: universal format exit preserves text and creates a root paragraph; lists/checked state; heading split; soft line breaks retain inline marks');

const multi=state('one\n\ntwo');
const selected=multi.apply(multi.tr.setSelection(new d.state.AllSelection(multi.doc)));
const allTasks=run(selected,c.toggleList('checklist'));
assert.equal(allTasks.doc.firstChild.childCount,2);
allTasks.doc.firstChild.forEach(item=>assert.equal(item.attrs.checked,false));
const clearTasks=run(allTasks,c.toggleList('bullet'));
clearTasks.doc.firstChild.forEach(item=>assert.equal(item.attrs.checked,null));
const wholeHeading=state('# Whole heading');
const exitAll=run(wholeHeading.apply(wholeHeading.tr.setSelection(new d.state.AllSelection(wholeHeading.doc))),c.exitFormat);
assert.equal(exitAll.doc.firstChild.type.name,'heading');assert.equal(exitAll.doc.lastChild.type.name,'paragraph');
