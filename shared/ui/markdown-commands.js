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
  function heading(level){return C.setBlockType(schema.nodes.heading,{level});}
  function markActive(state,name){const type=schema.marks[name],{$from,empty,from,to}=state.selection;return empty?!!type.isInSet(state.storedMarks||$from.marks()):state.doc.rangeHasMark(from,to,type);}
  return {ancestor,exitFormat,lineBreak,enter,structural,toggleList,quote,heading,markActive};
})();
