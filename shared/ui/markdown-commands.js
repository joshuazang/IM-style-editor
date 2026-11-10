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
    const items=new Set();selectedTextblocks({doc:tr.doc,selection:tr.selection},(node,pos)=>{
      const item=ancestor({selection:TextSelection.create(tr.doc,pos+1)},schema.nodes.list_item);if(item)items.add(item.pos);
    });
    for(const pos of items)tr.setNodeMarkup(pos,null,{checked});return tr;
  }
  function textSelection(state,dispatch,command){
    return transactionChain(state,dispatch,(get,apply)=>{
      if(get().selection instanceof imRichDeps.state.AllSelection)apply(get().tr.setSelection(TextSelection.between(TextSelection.atStart(get().doc).$from,TextSelection.atEnd(get().doc).$to)));
      return command(get(),apply);
    });
  }
  function nearestList(state){for(let depth=state.selection.$from.depth;depth>0;depth--){const node=state.selection.$from.node(depth);if([schema.nodes.bullet_list,schema.nodes.ordered_list].includes(node.type))return {node,pos:state.selection.$from.before(depth)};}return null;}
  function listKind(state){
    let kind=null,mixed=false;
    selectedTextblocks(state,(node,pos)=>{
      const selection=TextSelection.create(state.doc,pos+1),current={selection},item=ancestor(current,schema.nodes.list_item),list=nearestList(current);
      const value=!item||!list?null:item.node.attrs.checked!==null?'checklist':list.node.type===schema.nodes.ordered_list?'ordered':'bullet';
      if(value===null||kind!==null&&kind!==value)mixed=true;else kind=value;
    });return mixed?null:kind;
  }
  function quoteActive(state){let count=0,active=true;selectedTextblocks(state,(node,pos)=>{count++;if(!ancestor({selection:TextSelection.create(state.doc,pos+1)},schema.nodes.blockquote))active=false;});return count>0&&active;}
  function toggleList(kind){return (state,dispatch)=>textSelection(state,dispatch?tr=>dispatch(imRichDeps.history.closeHistory(tr)):undefined,(state,dispatch)=>{
    const type=kind==='ordered'?schema.nodes.ordered_list:schema.nodes.bullet_list;
    const list=nearestList(state);
    if(list){
      if(listKind(state)===kind)return transactionChain(state,dispatch,(get,apply)=>{
        while(listKind(get())===kind){
          const current=get();if(L.liftListItem(schema.nodes.list_item)(current,apply))continue;
          const scopes=[];current.doc.nodesBetween(current.selection.from,current.selection.to,(node,pos)=>{if(![schema.nodes.bullet_list,schema.nodes.ordered_list].includes(node.type))return;scopes.push({node,pos});return false;});
          if(!scopes.length)return false;const tr=current.tr;
          for(const {node,pos} of scopes.reverse()){
            const selection=TextSelection.between(tr.doc.resolve(Math.max(current.selection.from,pos+1)),tr.doc.resolve(Math.min(current.selection.to,pos+node.nodeSize-1)));
            const part=imRichDeps.state.EditorState.create({doc:tr.doc,selection});
            if(!L.liftListItem(schema.nodes.list_item)(part,next=>{for(const step of next.steps)tr.step(step);}))return false;
          }
          apply(tr.setSelection(current.selection.map(tr.doc,tr.mapping)));
        }return true;
      });
      if(dispatch){const tr=state.tr;if(list.node.type!==type)tr.setNodeMarkup(list.pos,type,type===schema.nodes.ordered_list?{order:1}:null);dispatch(selectedItems(tr,kind==='checklist'?false:null).scrollIntoView());}return true;
    }
    return transactionChain(state,dispatch,(get,apply)=>{
      lineBlocks(schema.nodes.paragraph,null,true)(get(),apply);
      C.setBlockType(schema.nodes.paragraph)(get(),apply);
      return L.wrapInList(type)(get(),tr=>{if(kind==='checklist')selectedItems(tr,false);apply(tr);});
    });
  });}
  function quote(state,dispatch){
    if(dispatch){const send=dispatch;dispatch=tr=>send(imRichDeps.history.closeHistory(tr));}
    if(!quoteActive(state)){
      const wrap=C.wrapIn(schema.nodes.blockquote);if(wrap(state,dispatch))return true;
      const list=nearestList(state);
      if(!list||state.selection.to>list.pos+list.node.nodeSize)return false;
      const temporary=state.apply(state.tr.setSelection(imRichDeps.state.NodeSelection.create(state.doc,list.pos)));
      return wrap(temporary,dispatch?tr=>dispatch(tr.setSelection(state.selection.map(tr.doc,tr.mapping))):undefined);
    }
    return textSelection(state,dispatch,(state,dispatch)=>transactionChain(state,dispatch,(get,apply)=>{
      while(quoteActive(get()))if(!removeQuoteLayer(get(),apply))return false;return true;
    }));
  }
  function removeQuoteLayer(state,dispatch){
    const ranges=[];
    state.doc.nodesBetween(state.selection.from,state.selection.to,(node,pos)=>{
      if(node.type!==schema.nodes.blockquote)return;
      const from=Math.max(state.selection.from,pos+1),to=Math.min(state.selection.to,pos+node.nodeSize-1);
      const range=state.doc.resolve(from).blockRange(state.doc.resolve(to),parent=>parent.type===schema.nodes.blockquote);
      if(range)ranges.push(range);return false;
    });
    if(!ranges.length){const range=state.selection.$from.blockRange(state.selection.$to,node=>node.type===schema.nodes.blockquote);if(range)ranges.push(range);}
    if(!ranges.length)return false;
    if(dispatch){const tr=state.tr;for(const range of ranges.reverse())tr.lift(range,range.depth-1);dispatch(tr.scrollIntoView());}return true;
  }
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
    const type=headingLevel(state)===level?schema.nodes.paragraph:schema.nodes.heading;
    return lineBlocks(type,type===schema.nodes.heading?{level}:null)(state,dispatch);
  };}
  function lineBlocks(type,attrs,splitSame=false){return (state,dispatch)=>{
    const changes=[];
    // A pasted plain-text note can be one paragraph containing many hard
    // breaks. Bound the heading to its selected lines before changing type.
    selectedTextblocks(state,(node,pos)=>{
      let hasBreak=false;node.forEach(child=>{if(child.type===schema.nodes.hard_break||child.isText&&/[\r\n]/.test(child.text))hasBreak=true;});
      if(node.type===type&&(type!==schema.nodes.heading||node.attrs.level===attrs.level)&&(!splitSame||!hasBreak))return;
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
  return {ancestor,exitFormat,lineBreak,enter,structural,toggleList,listKind,quote,quoteActive,headingLevel,heading,markActive};
})();
