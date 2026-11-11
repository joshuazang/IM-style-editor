const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({});for(const file of ['shared/vendor/markdown-editor.js','shared/ui/markdown-model.js','shared/ui/markdown-commands.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const {m,c,d}=vm.runInContext('({m:imMarkdown,c:imMarkdownCommands,d:imRichDeps})',context);
const commands={quote:c.quote,bullet:c.toggleList('bullet'),ordered:c.toggleList('ordered'),checklist:c.toggleList('checklist')};
function run(state,command){let next;assert.ok(command(state,tr=>next=state.apply(tr)));assert.ok(next);next.doc.check();return next;}
function selected(source,first,last,backward){
 const doc=m.parse(source);let from,to;doc.descendants((node,pos)=>{if(node.isText){if(node.text.includes(first))from=pos+node.text.indexOf(first);if(node.text.includes(last))to=pos+node.text.indexOf(last)+last.length;}});
 assert.ok(from!==undefined&&to!==undefined);return d.state.EditorState.create({doc,selection:d.state.TextSelection.create(doc,backward?to:from,backward?from:to),plugins:[d.history.history()]});
}
function formatText(doc,kind){const values=[];doc.descendants((node,pos)=>{if(!node.isText)return;const $pos=doc.resolve(pos);for(let depth=$pos.depth;depth>0;depth--){const parent=$pos.node(depth);if(kind==='quote'&&parent.type.name==='blockquote'||kind!=='quote'&&['bullet_list','ordered_list'].includes(parent.type.name)){values.push(node.text);break;}}});return values.join('');}
for(const backward of [false,true])for(const [kind,command] of Object.entries(commands))for(const source of [
 'unselected prefix CHOSEN selected middle LAST unselected suffix',
 'unselected prefix CHOSEN first\nsecond LAST unselected suffix',
 'unselected prefix CHOSEN first\n\nsecond LAST unselected suffix',
 '举个例子。有些人越CHOSEN减肥越胖，因为每次下定决心减肥，都会产生一个奇怪的想法：\n反正明天就开始减肥了，今天LAST再吃顿好的。反正过完年就控制饮食了。',
 'unselected prefix **CHOSEN bold** selected ~~LAST~~ unselected suffix',
]){
 const initial=selected(source,'CHOSEN','LAST',backward),wanted=initial.doc.textBetween(initial.selection.from,initial.selection.to),on=run(initial,command);
 assert.equal(on.doc.textContent,initial.doc.textContent,'No character deleted or duplicated');
 assert.equal(formatText(on.doc,kind),wanted,'Only selected characters gain block formatting');
 assert.equal(on.doc.textBetween(on.selection.from,on.selection.to),wanted,'Highlight survives');
 assert.equal(on.selection.anchor>on.selection.head,backward);
 assert.ok(m.parse(m.serialize(on.doc)).eq(on.doc),'Formatted fragment saves and reopens');
 const undo=run(on,d.history.undo);assert.ok(undo.doc.eq(initial.doc));assert.ok(undo.selection.eq(initial.selection));
 const redo=run(undo,d.history.redo);assert.ok(redo.doc.eq(on.doc));
 const off=run(on,command);assert.equal(formatText(off.doc,kind),'','Second click removes selected formatting');assert.equal(off.doc.textContent,initial.doc.textContent);
 assert.ok(run(off,d.history.undo).doc.eq(on.doc),'Each click is a separate undo');
}
for(const source of ['> before CHOSEN after','- before CHOSEN after','1. before CHOSEN after','- [x] before CHOSEN after']){
 const kind=source.startsWith('>')?'quote':source.startsWith('1')?'ordered':source.includes('[x]')?'checklist':'bullet';
 const initial=selected(source,'CHOSEN','CHOSEN'),off=run(initial,commands[kind]);
 assert.equal(off.doc.textContent,initial.doc.textContent);assert.equal(off.doc.textBetween(off.selection.from,off.selection.to),'CHOSEN');
 assert.equal(formatText(off.doc,kind),'before  after','Unselected fragments keep their original formatting');
 assert.ok(run(off,d.history.undo).doc.eq(initial.doc));
}
for(const kind of ['bullet','ordered','checklist']){
 const initial=selected('> before CHOSEN first\n> second LAST after','CHOSEN','LAST'),on=run(initial,commands[kind]);
 assert.equal(formatText(on.doc,kind),'CHOSEN firstsecond LAST');assert.equal(formatText(on.doc,'quote'),initial.doc.textContent);assert.ok(m.parse(m.serialize(on.doc)).eq(on.doc));
}
// Ending a selection at the next paragraph's first caret excludes that paragraph.
for(const command of Object.values(commands)){
 const initial=selected('CHOSEN\n\nLAST','CHOSEN','LAST');const end=initial.doc.child(0).nodeSize+1;
 const state=initial.apply(initial.tr.setSelection(d.state.TextSelection.create(initial.doc,1,end))),on=run(state,command);
 assert.equal(on.doc.lastChild.type.name,'paragraph');assert.equal(on.doc.lastChild.textContent,'LAST');
}
// Heading deliberately retains the user's whole-logical-line rule.
const heading=run(selected('before CHOSEN after','CHOSEN','CHOSEN'),c.heading(2));assert.equal(heading.doc.firstChild.textContent,'before CHOSEN after');
console.log('PASS: exact forward/backward quote and list highlights, Chinese partial paragraphs, marks, endpoint exclusion, toggles, atomic undo/redo and save/reopen; headings stay line based');
// Changing a nested item must not move its unselected siblings out of their
// parent, or change checked state on an unrelated outer task.
for(const source of ['- outer\n  - before CHOSEN after','- [x] outer\n  - before CHOSEN after'])for(const kind of ['bullet','ordered','checklist']){
 const initial=selected(source,'CHOSEN','CHOSEN'),on=run(initial,commands[kind]),off=run(on,commands[kind]);
 for(const current of [on,off]){
  assert.equal(current.doc.firstChild.firstChild.firstChild.textContent,'outer');assert.equal(current.doc.textContent,initial.doc.textContent);
  assert.equal(current.doc.firstChild.firstChild.attrs.checked,initial.doc.firstChild.firstChild.attrs.checked);
  assert.ok(m.parse(m.serialize(current.doc)).eq(current.doc),'Nested changes save and reopen without changing structure');
 }
 assert.equal(off.doc.textBetween(off.selection.from,off.selection.to),'CHOSEN');
}
const numbered=run(selected('4. before\n5. CHOSEN\n6. after','CHOSEN','CHOSEN'),commands.bullet);
assert.equal(numbered.doc.lastChild.attrs.order,6,'Unselected following items retain their numbering');
const quotedList=run(selected('> before CHOSEN after','CHOSEN','CHOSEN'),commands.bullet);assert.equal(quotedList.doc.childCount,1,'A list change inside a quote does not split the surrounding quote into several boxes');
console.log('PASS: nested list toggles preserve parent position, checked state, surrounding quote grouping and unselected ordered numbering');

// A whitespace-only highlight must survive formatting and saving too.
for(const [source,command] of [['before CHOSEN after',commands.quote],['> before CHOSEN after',commands.quote],['- before CHOSEN after',commands.bullet]]){
 const original=selected(source,'CHOSEN','CHOSEN'),from=original.selection.from-1,state=original.apply(original.tr.setSelection(d.state.TextSelection.create(original.doc,from,from+1))),after=run(state,command);
 assert.equal(after.doc.textContent,original.doc.textContent);assert.ok(m.parse(m.serialize(after.doc)).eq(after.doc));
}
// If the schema cannot split a deeply nested boundary without including
// unselected text, refusal must be atomic rather than formatting extra content.
for(const source of ['> - outer\n>   - before CHOSEN after','- outer\n  - before CHOSEN\n\nLAST after']){
 const initial=selected(source,'CHOSEN',source.includes('LAST')?'LAST':'CHOSEN');let changed=false;
 const ok=commands.quote(initial,()=>changed=true);assert.equal(ok,false);assert.equal(changed,false);
}
