/* Structural keyboard behavior shared by capture fields and opened cards. */
const imMarkdownCommands=(()=>{
  const {schema}=imMarkdown,{TextSelection}=imRichDeps.state,C=imRichDeps.commands,L=imRichDeps.lists;
  function ancestor(state,type){for(let d=state.selection.$from.depth;d>0;d--)if(state.selection.$from.node(d).type===type)return {node:state.selection.$from.node(d),depth:d,pos:state.selection.$from.before(d)};return null;}
  function transactionChain(state,dispatch,work){
    let current=state,tr=state.tr,changed=false;
    const apply=next=>{for(const step of next.steps)tr.step(step);current=current.apply(next);changed=true;};
    if(!work(()=>current,apply))return false;
    if(dispatch&&changed){tr.setSelection(imRichDeps.state.Selection.fromJSON(tr.doc,current.selection.toJSON()));tr.setStoredMarks(current.storedMarks);dispatch(tr.scrollIntoView());}
    return true;
  }
  function exitFormat(state,dispatch){
    return transactionChain(state,dispatch,(get,apply)=>{
      let current=get();
      if(current.selection instanceof imRichDeps.state.AllSelection){apply(current.tr.setSelection(TextSelection.atEnd(current.doc)));current=get();}
      if(current.selection.$from.depth>1&&current.selection.$from.parent.content.size===0){
        if(!C.liftEmptyBlock(current,apply))C.splitBlockAs(()=>({type:schema.nodes.paragraph}))(current,apply);
      }else if(!C.splitBlockAs(()=>({type:schema.nodes.paragraph}))(current,apply))return false;
      let previous=-1;
      while(get().selection.$from.depth>1&&get().selection.$from.depth!==previous){previous=get().selection.$from.depth;if(!C.lift(get(),apply))break;}
      current=get();
      if(current.selection.$from.parent.type!==schema.nodes.paragraph)C.setBlockType(schema.nodes.paragraph)(current,apply);
      apply(get().tr.setStoredMarks([]));return true;
    });
  }
  function lineBreak(state,dispatch){
    if(dispatch){const marks=state.storedMarks||state.selection.$from.marks();dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create(),false).ensureMarks(marks).scrollIntoView());}return true;
  }
  function enter(state,dispatch){
    const item=ancestor(state,schema.nodes.list_item),marks=state.storedMarks||state.selection.$from.marks();
    const apply=tr=>dispatch?.(tr.ensureMarks(marks));
    if(item&&L.splitListItem(schema.nodes.list_item,{checked:item.node.attrs.checked===null?null:false})(state,apply))return true;
    if(C.liftEmptyBlock(state,apply))return true;
    return C.splitBlockAs(()=>({type:schema.nodes.paragraph}))(state,apply);
  }
  function structural(state){return state.selection.$from.parent.type===schema.nodes.heading||!!ancestor(state,schema.nodes.list_item)||!!ancestor(state,schema.nodes.blockquote);}
  function selectedItems(tr,checked){
    const {from,to}=tr.selection;tr.doc.descendants((node,pos)=>{
      if(node.type===schema.nodes.list_item&&pos<to&&pos+node.nodeSize>from)tr.setNodeMarkup(pos,null,{checked});
    });return tr;
  }
  function toggleList(kind){return (state,dispatch)=>{
    const type=kind==='ordered'?schema.nodes.ordered_list:schema.nodes.bullet_list;
    let list=null;for(let depth=state.selection.$from.depth;depth>0;depth--){const node=state.selection.$from.node(depth);if(node.type===schema.nodes.bullet_list||node.type===schema.nodes.ordered_list){list={node,pos:state.selection.$from.before(depth)};break;}}
    if(!list&&state.selection instanceof imRichDeps.state.AllSelection&&state.doc.childCount===1&&[schema.nodes.bullet_list,schema.nodes.ordered_list].includes(state.doc.firstChild.type))list={node:state.doc.firstChild,pos:0};
    if(list){
      const item=ancestor(state,schema.nodes.list_item);
      if(kind!=='checklist'&&list.node.type===type&&item?.node.attrs.checked===null)return L.liftListItem(schema.nodes.list_item)(state,dispatch);
      if(dispatch){const tr=state.tr;if(list.node.type!==type)tr.setNodeMarkup(list.pos,type,type===schema.nodes.ordered_list?{order:1}:null);dispatch(selectedItems(tr,kind==='checklist'?(item?.node.attrs.checked===null?false:null):null).scrollIntoView());}return true;
    }
    return transactionChain(state,dispatch,(get,apply)=>{
      C.setBlockType(schema.nodes.paragraph)(get(),apply);
      return L.wrapInList(type)(get(),tr=>{if(kind==='checklist')selectedItems(tr,false);apply(tr);});
    });
  };}
  function quote(state,dispatch){return ancestor(state,schema.nodes.blockquote)?C.lift(state,dispatch):C.wrapIn(schema.nodes.blockquote)(state,dispatch);}
  function selectedTextblocks(state,visit){
    const {selection}=state;
    if(selection.empty){if(selection.$from.parent.isTextblock)visit(selection.$from.parent,selection.$from.before());return;}
    state.doc.nodesBetween(selection.from,selection.to,(node,pos)=>{
      if(!node.isTextblock)return;
      const start=pos+1,end=start+node.content.size;
      if(selection.to>start&&(!node.content.size||selection.from<end))visit(node,pos);
      return false;
    });
  }
  function headingLevel(state){
    if(state.selection.empty){const node=state.selection.$from.parent;return node.type===schema.nodes.heading?node.attrs.level:null;}
    let level=null,mixed=false;
    selectedTextblocks(state,node=>{
      if(mixed)return;
      if(node.type!==schema.nodes.heading){mixed=true;return;}
      if(level!==null&&level!==node.attrs.level)mixed=true;else level=node.attrs.level;
    });
    return mixed?null:level;
  }
  function heading(level){return (state,dispatch)=>{
    const type=headingLevel(state)===level?schema.nodes.paragraph:schema.nodes.heading,attrs=type===schema.nodes.heading?{level}:null,changes=[];
    // A pasted plain-text note can be one paragraph containing many hard
    // breaks. Bound the heading to its selected lines before changing type.
    selectedTextblocks(state,(node,pos)=>{
      if(node.type===type&&(type!==schema.nodes.heading||node.attrs.level===level))return;
      const lines=[];let start=0;
      const boundary=(offset,size)=>{lines.push({from:start,to:offset});start=offset+size;};
      node.forEach((child,offset)=>{
        if(child.type===schema.nodes.hard_break)boundary(offset,1);
        else if(child.isText){const breaks=/\r\n?|\n/g;let match;while((match=breaks.exec(child.text)))boundary(offset+match.index,match[0].length);}
      });
      lines.push({from:start,to:node.content.size});
      const firstOffset=Math.max(0,state.selection.from-pos-1),lastOffset=state.selection.empty?firstOffset:Math.min(node.content.size,Math.max(0,state.selection.to-pos-2));
      const lineAt=offset=>{const index=lines.findIndex(line=>offset<=line.to);return index<0?lines.length-1:index;};
      const first=lineAt(firstOffset),last=lineAt(lastOffset),pieces=[];
      const piece=(from,to,selected)=>pieces.push({from,to,node:selected?type.create(attrs,node.content.cut(from,to),node.marks):node.copy(node.content.cut(from,to))});
      const unchanged=(from,to)=>{
        // A leading soft break in a paragraph is stored as an empty Markdown
        // paragraph. Make that boundary explicit so saving/reopening agrees.
        while(node.type===schema.nodes.paragraph&&from<to&&lines[from].from===lines[from].to){piece(lines[from].from,lines[from].to,false);from++;}
        piece(lines[from].from,lines[to].to,false);
      };
      if(first)unchanged(0,first-1);
      for(let i=first;i<=last;i++)piece(lines[i].from,lines[i].to,true);
      if(last<lines.length-1)unchanged(last+1,lines.length-1);
      const $pos=state.doc.resolve(pos),index=$pos.index(),replacement=imRichDeps.model.Fragment.fromArray(pieces.map(piece=>piece.node));
      changes.push({pos,node,pieces,replacement,valid:$pos.parent.canReplace(index,index+1,replacement)});
    });
    if(!changes.length||changes.some(change=>!change.valid))return false;
    if(!dispatch)return true;
    const tr=state.tr;
    for(let i=changes.length-1;i>=0;i--){const change=changes[i];if(change.pieces.length===1)tr.setNodeMarkup(change.pos,type,attrs);else tr.replaceWith(change.pos,change.pos+change.node.nodeSize,change.replacement);}
    const mapPosition=old=>{
      const change=changes.find(change=>old>=change.pos&&old<=change.pos+change.node.nodeSize);
      if(!change)return tr.mapping.map(old);
      const offset=old-change.pos-1;let next=tr.mapping.map(change.pos,-1);
      if(offset<0)return next+1;
      for(const piece of change.pieces){if(offset<=piece.to)return next+1+Math.max(0,offset-piece.from);next+=piece.node.nodeSize;}
      return next-1;
    };
    if(state.selection instanceof imRichDeps.state.AllSelection)tr.setSelection(new imRichDeps.state.AllSelection(tr.doc));
    else tr.setSelection(TextSelection.between(tr.doc.resolve(mapPosition(state.selection.anchor)),tr.doc.resolve(mapPosition(state.selection.head))));
    tr.setStoredMarks(state.storedMarks);dispatch(imRichDeps.history.closeHistory(tr).scrollIntoView());return true;
  };}
  function markActive(state,name){const type=schema.marks[name],{$from,empty,from,to}=state.selection;return empty?!!type.isInSet(state.storedMarks||$from.marks()):state.doc.rangeHasMark(from,to,type);}
  return {ancestor,exitFormat,lineBreak,enter,structural,toggleList,quote,headingLevel,heading,markActive};
})();
