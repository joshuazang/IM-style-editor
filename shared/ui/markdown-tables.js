/* Shared GFM table editing; rectangular cells and one header row. */
const imMarkdownTables=(()=>{
  const {schema}=imMarkdown,T=imRichDeps.tables,{TextSelection,Plugin}=imRichDeps.state;
  function current(state){const p=state.selection.$from;for(let depth=p.depth;depth>0;depth--)if(p.node(depth).type===schema.nodes.table)return {node:p.node(depth),pos:p.before(depth)};return null;}
  function intersects(state){let found=!!current(state);if(!found&&!state.selection.empty)state.doc.nodesBetween(state.selection.from,state.selection.to,node=>{if(node.type===schema.nodes.table)found=true;return !found;});return found;}
  function insert(state,dispatch){
    if(current(state))return false;
    if(dispatch){
      const row=header=>schema.nodes.table_row.create(null,Array.from({length:2},()=>schema.nodes[header?'table_header':'table_cell'].createAndFill()));
      const table=schema.nodes.table.create(null,[row(true),row(false),row(false)]),tr=state.tr.replaceSelectionWith(table,false);
      // The inserted table precedes the mapped end of the replaced selection.
      let pos=-1;tr.doc.descendants((node,at)=>{if(node===table)pos=at;});
      tr.setSelection(TextSelection.create(tr.doc,pos+3));dispatch(imRichDeps.history.closeHistory(tr).scrollIntoView());
    }return true;
  }
  function nextCell(direction){return (state,dispatch)=>{
    if(!current(state))return false;
    if(T.goToNextCell(direction)(state,dispatch))return true;
    if(direction<0)return true;
    if(dispatch)T.addRowAfter(state,tr=>{const next=state.apply(tr);T.goToNextCell(1)(next,moved=>{for(const step of moved.steps)tr.step(step);tr.setSelection(moved.selection);});dispatch(imRichDeps.history.closeHistory(tr).scrollIntoView());});
    return true;
  };}
  // HTML row/column spans are flattened into ordinary GFM cells. Each original
  // cell's content occurs once; covered slots become empty cells.
  function normalizeTable(table){
    const grid=[];table.forEach((row,_,y)=>{
      const slots=grid[y]||(grid[y]=[]);let x=0;
      row.forEach(cell=>{
        while(slots[x])x++;
        const width=Math.max(1,cell.attrs.colspan||1),height=Math.max(1,cell.attrs.rowspan||1);
        for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++){
          const target=grid[y+dy]||(grid[y+dy]=[]);target[x+dx]={cell,content:dy===0&&dx===0?cell.firstChild:schema.nodes.paragraph.create()};
        }x+=width;
      });
    });
    const width=Math.max(1,...grid.map(row=>row.length)),rows=grid.map((row,y)=>schema.nodes.table_row.create(null,Array.from({length:width},(_,x)=>{
      const entry=row[x],align=grid[0][x]?.cell.attrs.align||null;
      return schema.nodes[y===0?'table_header':'table_cell'].create({align},entry?.content||schema.nodes.paragraph.create());
    })));
    return schema.nodes.table.create(null,rows.length?rows:[schema.nodes.table_row.create(null,schema.nodes.table_header.createAndFill())]);
  }
  function transformPasted(slice){
    const walk=node=>node.type===schema.nodes.table?normalizeTable(node):node.isLeaf?node:node.copy(imRichDeps.model.Fragment.fromArray(node.content.content.map(walk)));
    return new imRichDeps.model.Slice(imRichDeps.model.Fragment.fromArray(slice.content.content.map(walk)),slice.openStart,slice.openEnd);
  }
  function transformHTML(html){
    if(!/<table(?:\s|>)/i.test(html))return html;
    const template=document.createElement('template');template.innerHTML=html;
    for(const cell of template.content.querySelectorAll('th,td')){
      const blocks=[...cell.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,blockquote,pre,ul,ol,li')];
      for(const block of blocks.reverse()){
        for(const n of [...block.parentNode.childNodes])if(n.nodeType===3&&!n.textContent.trim())n.remove();
        if(block.previousSibling&&block.previousSibling.nodeName!=='BR')block.before(document.createElement('br'));
        if(block.nextSibling&&block.nextSibling.nodeName!=='BR')block.after(document.createElement('br'));
        block.replaceWith(...block.childNodes);
      }
    }return template.innerHTML;
  }
  function plugin(){return new Plugin({appendTransaction:(transactions,oldState,state)=>{
    if(!transactions.some(tr=>tr.docChanged))return null;
    const table=current(state);if(!table)return null;
    const before=table.pos<=oldState.doc.content.size?oldState.doc.nodeAt(table.pos):null,header=table.node.firstChild;
    let tr=null,offset=table.pos+1;
    table.node.forEach((row,_,index)=>{
      if(before?.type===schema.nodes.table&&row===before.maybeChild(index)&&header===before.firstChild){offset+=row.nodeSize;return;}
      row.forEach((cell,at,column)=>{
        const type=index===0?schema.nodes.table_header:schema.nodes.table_cell,align=header.maybeChild(column)?.attrs.align||null;
        if(cell.type!==type||cell.attrs.align!==align)(tr||(tr=state.tr)).setNodeMarkup(offset+1+at,type,{...cell.attrs,align});
      });offset+=row.nodeSize;
    });return tr;
  }});}
  return {current,intersects,insert,nextCell,transformPasted,transformHTML,plugin};
})();
