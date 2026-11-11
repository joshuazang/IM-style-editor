const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({});for(const f of ['shared/vendor/markdown-editor.js','shared/ui/markdown-model.js','shared/ui/markdown-commands.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context);
const {m,c,d}=vm.runInContext('({m:imMarkdown,c:imMarkdownCommands,d:imRichDeps})',context);
function run(state,command){let next;assert.ok(command(state,tr=>next=state.apply(tr)));assert.ok(next);next.doc.check();return next;}
const visible=doc=>doc.textBetween(0,doc.content.size,'\n','\n');
for(const kind of ['bullet','checklist','ordered'])for(const backward of [false,true])for(const lines of [
 ['sd','fasdf','as','df','','','dsfaasdf'],['first','','last'],['','first','','','last',''],['  ','first','  ','last','  '],['中文','', '🙂 **marked**','', 'last']
]){
 // A keyboard-created line can be a separate paragraph; pasted/soft lines can
 // instead be hard breaks within one paragraph. Both must have the same result.
 for(const separate of [false,true,'soft']){
  const doc=separate==='soft'?m.schema.node('doc',null,m.schema.node('paragraph',null,lines.flatMap((line,index)=>[...(index?[m.schema.node('hard_break')]:[]),...(line?[m.schema.text(line)]:[])]))):separate?m.schema.node('doc',null,lines.map(line=>m.schema.node('paragraph',null,line?m.schema.text(line):null))):m.parse(lines.join('\n'));
  const first=d.state.TextSelection.atStart(doc).from,last=d.state.TextSelection.atEnd(doc).to;
  const initial=d.state.EditorState.create({doc,selection:d.state.TextSelection.create(doc,backward?last:first,backward?first:last),plugins:[d.history.history()]});
  const on=run(initial,c.toggleList(kind)),items=[];on.doc.descendants(node=>{if(node.type.name==='list_item')items.push(node);});
  assert.equal(items.length,lines.filter(line=>line.trim()).length);assert.ok(items.every(item=>item.textContent.trim()),'No empty markers');
  assert.equal(visible(on.doc),visible(initial.doc),'Blank-line spacing and text survive');assert.equal(c.listKind(on),kind,'Toolbar remains active across gaps');
  assert.ok(m.parse(m.serialize(on.doc)).eq(on.doc),'Saving retains spacing and marker count');
  const undo=run(on,d.history.undo);assert.ok(undo.doc.eq(initial.doc));assert.ok(undo.selection.eq(initial.selection));
  assert.ok(run(undo,d.history.redo).doc.eq(on.doc));
  const off=run(on,c.toggleList(kind));let count=0;off.doc.descendants(node=>{if(node.type.name==='list_item')count++;});assert.equal(count,0);assert.equal(visible(off.doc),visible(initial.doc));
  const other=kind==='ordered'?'checklist':'ordered',converted=run(on,c.toggleList(other));assert.equal(c.listKind(converted),other);assert.equal(visible(converted.doc),visible(initial.doc));
 }
}
const empty=m.parse(''),cursor=d.state.EditorState.create({doc:empty});const started=run(cursor,c.toggleList('checklist'));assert.equal(started.doc.firstChild.firstChild.attrs.checked,false,'A caret can still start an empty task');
console.log('PASS: bullet/task/number conversion skips blank markers, preserves gaps, marks, selection direction, undo/redo, toggles and save/reopen for hard-break and separate-paragraph inputs');
for(const kind of ['bullet','checklist','ordered']){
 const doc=m.parse('a\nsd\nfasdf\nas\ndf<br><br><br>dsfaasdf');let from,to;doc.descendants((node,pos)=>{if(node.isText&&node.text==='sd')from=pos;if(node.isText&&node.text==='dsfaasdf')to=pos+node.text.length;});
 const initial=d.state.EditorState.create({doc,selection:d.state.TextSelection.create(doc,from,to)}),on=run(initial,c.toggleList(kind)),items=[];on.doc.descendants(node=>{if(node.type.name==='list_item')items.push(node.textContent);});
 assert.deepEqual(items,['sd','fasdf','as','df','dsfaasdf']);assert.equal(on.doc.firstChild.type.name,'paragraph');assert.equal(on.doc.firstChild.textContent,'a');assert.equal(on.doc.textContent,doc.textContent);assert.ok(m.parse(m.serialize(on.doc)).eq(on.doc));
}
