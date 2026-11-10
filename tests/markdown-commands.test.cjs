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

for(let level=1;level<=6;level++){
 const before=state('#'.repeat(level)+' Heading');assert.equal(c.headingLevel(before),level);
 const plain=run(before,c.heading(level));assert.equal(c.headingLevel(plain),null);assert.equal(plain.doc.firstChild.type.name,'paragraph');assert.equal(plain.doc.textContent,'Heading');assert.equal(plain.selection.head,before.selection.head);
 const restore=run(plain,c.heading(level));assert.equal(c.headingLevel(restore),level);
 const changed=run(before,c.heading(level===6?1:level+1));assert.equal(c.headingLevel(changed),level===6?1:level+1);
}
const same=state('## One\n\n## Two'),sameAll=same.apply(same.tr.setSelection(new d.state.AllSelection(same.doc)));
assert.equal(c.headingLevel(sameAll),2);const ordinary=run(sameAll,c.heading(2));ordinary.doc.forEach(node=>assert.equal(node.type.name,'paragraph'));assert.equal(ordinary.doc.textContent,same.doc.textContent);
const mixed=state('# One\n\n### Three'),mixedAll=mixed.apply(mixed.tr.setSelection(new d.state.AllSelection(mixed.doc)));
assert.equal(c.headingLevel(mixedAll),null);assert.equal(c.headingLevel(run(mixedAll,c.heading(3))),3);
console.log('PASS: H1–H6 current-level detection, same-level removal, level changes, whole-document and mixed selections preserve text/caret');

function rangeState(text,first,last=first+1,backward=false){
 let current=state(text);const doc=current.doc;
 return current.apply(current.tr.setSelection(d.state.TextSelection.create(doc,backward?last:first,backward?first:last)));
}
const visible=doc=>doc.textBetween(0,doc.content.size,'\n','\n');
for(const level of [1,2,3,4,5,6]){
 for(const [from,to] of [[1,2],[13,14],[25,26],[11,12],[12,23],[13,24]]){
  for(const backward of [false,true]){
   const before=rangeState('First line\nSecond line\nThird line',from,to,backward),after=run(before,c.heading(level));
   assert.equal(visible(after.doc),visible(before.doc),'All lines and line breaks survive');
   const wanted=(from<=11?['First line']:[]).concat(from<=23&&to>12?['Second line']:[]).concat(to>24?['Third line']:[]);
   const headings=[];after.doc.descendants(node=>{if(node.type.name==='heading')headings.push(node.textContent);});
   assert.deepEqual(headings,wanted,JSON.stringify({from,to,backward,headings,wanted}));
   assert.ok(m.parse(m.serialize(after.doc)).eq(after.doc),'Local headings round-trip');
   assert.equal(after.selection.anchor>after.selection.head,backward&&after.selection.from!==after.selection.to,'Selection direction survives');
  }
 }
}
const one=rangeState('First line\nSecond line\nThird line',13,14),oneHeading=run(one,c.heading(2));
assert.deepEqual(Array.from(oneHeading.doc.content.content,n=>n.type.name),['paragraph','heading','paragraph']);
assert.equal(oneHeading.doc.textBetween(oneHeading.selection.from,oneHeading.selection.to),'e');
const off=run(oneHeading,c.heading(2));off.doc.forEach(node=>assert.equal(node.type.name,'paragraph'));assert.equal(visible(off.doc),visible(one.doc));
const cursor=run(state('First line\nSecond line\nThird line','Second'),c.heading(3));assert.equal(cursor.doc.child(1).type.name,'heading');assert.equal(cursor.doc.child(1).textContent,'Second line');
const quoted=run(state('> First\n> Second\n> Third','Second'),c.heading(2));assert.equal(quoted.doc.firstChild.type.name,'blockquote');assert.equal(quoted.doc.firstChild.child(1).type.name,'heading');assert.equal(quoted.doc.firstChild.firstChild.type.name,'paragraph');assert.equal(quoted.doc.firstChild.lastChild.type.name,'paragraph');
const marked=run(state('Before\n**Chosen ~~line~~**\nAfter','Chosen'),c.heading(2));assert.ok(marked.doc.child(1).firstChild.marks.some(mark=>mark.type.name==='strong'));assert.ok(m.parse(m.serialize(marked.doc)).eq(marked.doc));
const emptyLines=run(state('Before<br>\nChosen<br>\nAfter','Chosen'),c.heading(4));assert.equal(visible(emptyLines.doc),'Before\n\nChosen\n\nAfter');assert.ok(m.parse(m.serialize(emptyLines.doc)).eq(emptyLines.doc));
const twoParagraphs=rangeState('One\n\nTwo',1,6),boundary=run(twoParagraphs,c.heading(2));assert.equal(boundary.doc.firstChild.type.name,'heading');assert.equal(boundary.doc.lastChild.type.name,'paragraph');assert.equal(c.headingLevel(boundary),2);
const withHistory=d.state.EditorState.create({doc:one.doc,selection:one.selection,plugins:[d.history.history()]});const changedOnce=run(withHistory,c.heading(2)),undone=run(changedOnce,d.history.undo);assert.ok(undone.doc.eq(one.doc),'One undo restores the original lines');assert.ok(undone.selection.eq(one.selection),'Undo restores the original selection');
console.log('PASS: partial-character and cursor heading changes stay within selected lines; ranges, direction, quotes, marks, blank lines, save/reopen and undo retain surrounding text');
const redone=run(run(run(changedOnce,c.heading(2)),d.history.undo),d.history.redo);assert.equal(c.headingLevel(redone),null);
const toggled=run(changedOnce,c.heading(2)),undoToggle=run(toggled,d.history.undo);assert.ok(undoToggle.doc.eq(changedOnce.doc),'Each heading toggle is a separate undo action');
for(const lineBreak of ['\n','\r\n']){
 const literal=m.schema.node('doc',null,[m.schema.node('paragraph',null,m.schema.text('Before'+lineBreak+'Middle'+lineBreak+'After'))]);let pos=1+'Before'.length+lineBreak.length+2;
 const initial=d.state.EditorState.create({doc:literal,selection:d.state.TextSelection.create(literal,pos,pos+1)}),localized=run(initial,c.heading(5));assert.equal(localized.doc.child(1).textContent,'Middle');assert.equal(localized.doc.firstChild.type.name,'paragraph');assert.equal(localized.doc.lastChild.type.name,'paragraph');
}
const item=run(state('- Before\n  Middle\n  After','Middle'),c.heading(3));assert.equal(item.doc.firstChild.type.name,'bullet_list');assert.equal(item.doc.firstChild.firstChild.child(1).type.name,'heading');assert.ok(m.parse(m.serialize(item.doc)).eq(item.doc));
const unsupported=state('- First item','First');let didDispatch=false;assert.equal(c.heading(2)(unsupported,()=>didDispatch=true),false);assert.equal(didDispatch,false,'Unsupported list boundary cannot partially modify the document');
const nodeSelected=d.state.EditorState.create({doc:one.doc,selection:d.state.NodeSelection.create(one.doc,0)}),nodeChanged=run(nodeSelected,c.heading(1));assert.equal(visible(nodeChanged.doc),visible(one.doc));assert.equal(c.headingLevel(nodeChanged),1);

for(const source of ['','candidate','first\n\nsecond'])for(const kind of ['bullet','ordered','checklist'])for(const all of [false,true]){
 let initial=state(source);if(all)initial=initial.apply(initial.tr.setSelection(new d.state.AllSelection(initial.doc)));
 for(let cycle=0;cycle<3;cycle++){const on=run(initial,c.toggleList(kind));assert.equal(c.listKind(on),kind);initial=run(on,c.toggleList(kind));assert.equal(c.listKind(initial),null);assert.equal(visible(initial.doc),source.replace(/\n\n/g,'\n'));}
}
for(const source of ['','quote','first\n\nsecond','- item']){
 let initial=state(source);initial=initial.apply(initial.tr.setSelection(new d.state.AllSelection(initial.doc)));
 const on=run(initial,c.quote);assert.ok(c.quoteActive(on));const off=run(on,c.quote);assert.equal(c.quoteActive(off),false);assert.ok(off.doc.eq(initial.doc));
}
console.log('PASS: repeated list/checklist/quote toggles, whole-document selection and nested list preservation');

for(const source of ['- outer\n  - inner','1. outer\n   - inner','- first\n\n> - second']){
 let initial=state(source);initial=initial.apply(initial.tr.setSelection(new d.state.AllSelection(initial.doc)));
 if(c.listKind(initial)==='bullet'){const off=run(initial,c.toggleList('bullet'));assert.notEqual(c.listKind(off),'bullet');assert.equal(visible(off.doc),visible(initial.doc));}
}

const parentTask=run(state('- [x] outer\n  - inner','inner'),c.toggleList('checklist'));assert.equal(parentTask.doc.firstChild.firstChild.attrs.checked,true);assert.equal(parentTask.doc.firstChild.firstChild.lastChild.firstChild.attrs.checked,false);

const deepQuote=state('> > deeply quoted');assert.equal(c.quoteActive(run(deepQuote,c.quote)),false);

for(const kind of ['bullet','ordered','checklist']){
 const initial=rangeState('First\nSecond\nThird',1,19),listed=run(initial,c.toggleList(kind));assert.equal(listed.doc.firstChild.childCount,3);assert.equal(visible(listed.doc),visible(initial.doc));assert.ok(m.parse(m.serialize(listed.doc)).eq(listed.doc));
}
const oneTask=run(rangeState('Before\nChosen\nAfter',9,10),c.toggleList('checklist'));assert.equal(oneTask.doc.child(1).firstChild.textContent,'Chosen');assert.equal(oneTask.doc.firstChild.type.name,'paragraph');assert.equal(oneTask.doc.lastChild.type.name,'paragraph');
