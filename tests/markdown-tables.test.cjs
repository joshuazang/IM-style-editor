const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({});for(const file of ['shared/vendor/markdown-editor.js','shared/ui/markdown-model.js','shared/ui/markdown-commands.js','shared/ui/markdown-tables.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const {m,c,t,d}=vm.runInContext('({m:imMarkdown,c:imMarkdownCommands,t:imMarkdownTables,d:imRichDeps})',context),s=m.schema;
const samples=[
 '*italic* and _also italic_ and ***both*** and ~~*struck italic*~~',
 '| Value | Expression |\n| --- | --- |\n| Curiosity | Read something new |\n| Connection | Invite someone |',
 '| Type | Example | Assessment |\n| :--- | :---: | ---: |\n| **Bold** | *Italic* | ~~Strike~~ |',
 '| a | b |\n| --- | --- |\n| escaped \\| pipe | slash \\\\ and &amp; |\n| a<br>b<br><br>c | 中文 🙂 |',
 '> | One | Two |\n> | --- | --- |\n> | A | B |',
 '| Only header |\n| --- |'
];
for(const source of samples){const doc=m.parse(source);doc.check();assert.ok(m.parse(m.serialize(doc)).eq(doc),m.serialize(doc));}
function state(text){const doc=m.parse(text);return d.state.EditorState.create({doc,selection:d.state.TextSelection.atEnd(doc),plugins:[d.history.history(),d.tables.tableEditing(),t.plugin()]});}
function run(current,command){let next=current;assert.ok(command(current,tr=>next=current.applyTransaction(tr).state));next.doc.check();assert.ok(m.parse(m.serialize(next.doc)).eq(next.doc),m.serialize(next.doc));return next;}
let current=run(state('Before'),t.insert);assert.ok(t.current(current));assert.equal(t.current(current).node.childCount,3);assert.equal(t.current(current).node.firstChild.childCount,2);
current=run(current,d.tables.addColumnAfter);assert.equal(t.current(current).node.firstChild.childCount,3);
current=run(current,d.tables.addRowAfter);assert.equal(t.current(current).node.childCount,4);
current=run(current,d.tables.deleteRow);assert.equal(t.current(current).node.childCount,3);assert.equal(t.current(current).node.firstChild.firstChild.type.name,'table_header');
current=run(current,d.tables.deleteColumn);assert.equal(t.current(current).node.firstChild.childCount,2);
current=run(current,c.enter);assert.ok(t.current(current));assert.equal(current.selection.$from.parent.lastChild.type.name,'hard_break');
const before=m.serialize(current.doc);current=run(current,c.exitFormat);assert.equal(current.selection.$from.depth,1);assert.equal(current.storedMarks.length,0);assert.equal(current.doc.lastChild.type.name,'paragraph');
assert.equal(m.parse(before).firstChild.type.name,'paragraph');
current=run(state(samples[1]),t.nextCell(1));assert.equal(t.current(current).node.childCount,4,'Tab from last cell adds one row');
current=run(current,d.tables.deleteTable);assert.equal(t.current(current),null);
const cells=[s.nodes.table_header.create({colspan:2},s.nodes.paragraph.create(null,s.text('Merged')))],merged=s.nodes.table.create(null,[s.nodes.table_row.create(null,cells)]);
const normalized=t.transformPasted(new d.model.Slice(d.model.Fragment.from(merged),0,0)).content.firstChild;
assert.equal(normalized.firstChild.childCount,2);assert.equal(normalized.textContent,'Merged');assert.ok(m.parse(m.serialize(s.nodes.doc.create(null,normalized))).eq(s.nodes.doc.create(null,normalized)));
const multi=s.nodes.table.create(null,[...merged.content.content,s.nodes.table_row.create(null,[s.nodes.table_cell.createAndFill(),s.nodes.table_cell.createAndFill()])]);
const expanded=t.transformPasted(new d.model.Slice(d.model.Fragment.from(multi),0,0)).content.firstChild;
expanded.check();assert.equal(expanded.childCount,2);assert.equal(expanded.lastChild.childCount,2);
console.log('PASS: italic and GFM table round trips, alignments, pipes, Unicode, breaks, shared row/column commands, header repair, Enter/Ctrl+Enter, Tab row append and merged HTML normalization');
