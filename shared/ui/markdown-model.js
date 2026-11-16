/* The selected Markdown subset, shared by both visual interfaces. */
const imMarkdown=(()=>{
  const {Schema}=imRichDeps.model;
  const schema=new Schema({nodes:{
    doc:{content:'block+'},
    paragraph:{content:'inline*',group:'block',parseDOM:[{tag:'p'}],toDOM:()=>['p',0]},
    heading:{attrs:{level:{default:1}},content:'inline*',group:'block',defining:true,
      parseDOM:[1,2,3,4,5,6].map(level=>({tag:'h'+level,attrs:{level}})),toDOM:n=>['h'+Math.max(1,Math.min(6,n.attrs.level)),0]},
    blockquote:{content:'block+',group:'block',defining:true,parseDOM:[{tag:'blockquote'}],toDOM:()=>['blockquote',0]},
    horizontal_rule:{group:'block',parseDOM:[{tag:'hr'}],toDOM:()=>['hr']},
    ...imRichDeps.tables.tableNodes({tableGroup:'block',cellContent:'paragraph',cellAttributes:{align:{default:null,
      getFromDOM:n=>['left','center','right'].includes(n.style.textAlign||n.getAttribute('align'))?(n.style.textAlign||n.getAttribute('align')):null,
      setDOMAttr:(value,attrs)=>{if(value)attrs.style='text-align:'+value;}}}}),
    bullet_list:{content:'list_item+',group:'block',parseDOM:[{tag:'ul'}],toDOM:()=>['ul',0]},
    ordered_list:{attrs:{order:{default:1}},content:'list_item+',group:'block',parseDOM:[{tag:'ol',getAttrs:n=>({order:Math.max(1,Number(n.getAttribute('start'))||1)})}],toDOM:n=>['ol',{start:n.attrs.order},0]},
    list_item:{attrs:{checked:{default:null}},content:'paragraph block*',defining:true,
      parseDOM:[{tag:'li',getAttrs:n=>{const checked=n.getAttribute('data-checked'),input=n.querySelector('input[type=checkbox]');return {checked:checked!==null?checked==='true':input?input.checked:null};}}],
      toDOM:n=>['li',n.attrs.checked===null?{}:{'data-checked':String(n.attrs.checked)},['div',{class:'im-md-item'},0]]},
    text:{group:'inline'},
    hard_break:{inline:true,group:'inline',selectable:false,parseDOM:[{tag:'br'}],toDOM:()=>['br']}
  },marks:{
    strong:{parseDOM:[{tag:'strong'},{tag:'b',getAttrs:n=>n.style.fontWeight!=='normal'&&null},{style:'font-weight',getAttrs:v=>/^(bold(er)?|[6-9]00)$/.test(v)&&null}],toDOM:()=>['strong',0]},
    em:{parseDOM:[{tag:'em'},{tag:'i'},{style:'font-style',getAttrs:v=>v==='italic'&&null}],toDOM:()=>['em',0]},
    strike:{parseDOM:[{tag:'s'},{tag:'del'},{tag:'strike'},{style:'text-decoration',getAttrs:v=>v.includes('line-through')&&null}],toDOM:()=>['s',0]}
  }});
  const base=imRichDeps.serializer.defaultMarkdownSerializer;
  const htmlInline=new WeakMap();
  function needsHTML(parent){
    if(htmlInline.has(parent))return htmlInline.get(parent);
    let unsafe=false,previous=[];
    parent.forEach(node=>{
      if(node.marks.length&&(!node.isText||node.marks.length>1||/^[\p{P}\p{S}\s]|[\p{P}\p{S}\s]$/u.test(node.text)||previous.length&&!imRichDeps.model.Mark.sameSet(previous,node.marks)))unsafe=true;
      previous=node.marks;
    });htmlInline.set(parent,unsafe);return unsafe;
  }
  const inlineMark=(delimiter,tag)=>({mixable:true,expelEnclosingWhitespace:false,
    open:s=>s.options.imHTMLMarks?'<'+tag+'>':delimiter,close:s=>s.options.imHTMLMarks?'</'+tag+'>':delimiter});
  function renderInline(s,n,preserve){
    const text=s.text,total=n.textContent.length,html=s.options.imHTMLMarks,breakName=s.options.hardBreakNodeName;let offset=0;
    s.options.imHTMLMarks=needsHTML(n);if(s.options.imHTMLMarks)s.options.hardBreakNodeName='im_html_break';
    if(preserve)s.text=function(value,escape=true){
      if(escape===false)return text.call(this,value,escape);
      const start=offset===0?(/^[ \t]+/.exec(value)?.[0].length||0):0;
      const end=offset+value.length===total?Math.max(start,value.length-(/[ \t]+$/.exec(value)?.[0].length||0)):value.length;
      offset+=value.length;
      for(const char of value.slice(0,start))this.write(char===' '?'&#32;':'&#9;');
      text.call(this,value.slice(start,end),escape);
      for(const char of value.slice(end))this.write(char===' '?'&#32;':'&#9;');
    };
    try{s.renderInline(n);}finally{s.text=text;s.options.imHTMLMarks=html;s.options.hardBreakNodeName=breakName;}
  }
  // ProseMirror nodes are immutable: untouched top-level paragraphs can reuse
  // their escaped text across edits. Paragraph-only notes are joined in chunks;
  // structural documents retain the contextual serializer path.
  const paragraphSource=new WeakMap(),tableCellSource=new WeakMap();
  const serializer=new imRichDeps.serializer.MarkdownSerializer({
    paragraph:(s,n)=>{if(!n.content.size)s.write('');renderInline(s,n,s.options.imListDepth||/^[ \t]+$/.test(n.textContent));s.closeBlock(n);},
    heading:(s,n)=>{s.write('#'.repeat(n.attrs.level)+' ');renderInline(s,n,true);s.closeBlock(n);},blockquote:base.nodes.blockquote,
    bullet_list:base.nodes.bullet_list,ordered_list:base.nodes.ordered_list,
    horizontal_rule:base.nodes.horizontal_rule,
    table:(s,n)=>{
      const lines=[],row=values=>lines.push('| '+values.join(' | ')+' |');
      n.forEach((r,index)=>{
        const cells=[];r.forEach(cell=>{
          const paragraph=cell.firstChild;let value=tableCellSource.get(paragraph);
          if(value===undefined){const writer=new imRichDeps.serializer.MarkdownSerializerState(serializer.nodes,serializer.marks,{...serializer.options,imTable:true,escapeExtraCharacters:/[&<|]/g});renderInline(writer,paragraph,true);value=writer.out.trim();tableCellSource.set(paragraph,value);}
          cells.push(value);
        });row(cells);
        if(index===0){const align=[];r.forEach(cell=>align.push(cell.attrs.align==='center'?':---:':cell.attrs.align==='right'?'---:':cell.attrs.align==='left'?':---':'---'));row(align);}
      });s.write(lines.join('\n'+s.delim)+'\n');s.closeBlock(n);
    },
    list_item:(s,n)=>{if(n.attrs.checked!==null)s.write(n.attrs.checked?'[x] ':'[ ] ');s.options.imListDepth=(s.options.imListDepth||0)+1;try{s.renderContent(n);}finally{s.options.imListDepth--;}},
    // Single newlines display as line breaks in both editors. Consecutive or
    // trailing soft breaks need an explicit br so they cannot become paragraphs.
    hard_break:(s,n,parent,index)=>s.write(s.options.imHTMLMarks||s.options.imTable||parent.type===schema.nodes.heading?'<br>':index===parent.childCount-1?(s.options.imLastBlock===parent&&parent.type===schema.nodes.paragraph&&!s.delim&&parent.textContent.trim()?'\n':'<br>'):parent.child(index+1).type===schema.nodes.hard_break?'<br>':'\n'),text:base.nodes.text
  },{strong:inlineMark('**','strong'),em:inlineMark('*','em'),strike:inlineMark('~~','s')},{tightLists:true,escapeExtraCharacters:/[&<]/g});
  const cache=new Map(),records=new WeakMap();let cachedCharacters=0;
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
  const decode=text=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(raw,name)=>{
    if(name[0]!=='#')return entities[name.toLowerCase()]??raw;
    const n=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';
  });
  function inline(tokens,marks=[]){
    const nodes=[],stack=[];let active=marks;
    for(const token of tokens||[]){
      if(token.type==='checkbox')continue;
      const tag=token.type==='html'&&/^<(\/)?(strong|em|s)>$/i.exec(token.raw);
      if(tag&&!tag[1]){stack.push({tag:tag[2].toLowerCase(),marks:active});active=schema.marks[{strong:'strong',em:'em',s:'strike'}[tag[2].toLowerCase()]].create().addToSet(active);continue;}
      if(tag&&tag[1]&&stack.at(-1)?.tag===tag[2].toLowerCase()){active=stack.pop().marks;continue;}
      if(['strong','em','del'].includes(token.type))nodes.push(...inline(token.tokens,schema.marks[token.type==='del'?'strike':token.type].create().addToSet(active)));
      else if(token.type==='br'||token.type==='html'&&/^<br\s*\/?>$/i.test(token.raw))nodes.push(schema.nodes.hard_break.create(null,null,active));
      else if(token.type==='text'&&token.tokens)nodes.push(...inline(token.tokens,active));
      else{const text=token.type==='text'?decode(token.text||''):token.type==='escape'?(token.text||''):(token.raw||token.text||'');if(text)nodes.push(schema.text(text,active));}
    }
    return nodes;
  }
  function blocks(tokens){
    const nodes=[];
    for(let index=0;index<(tokens||[]).length;index++){
      const token=tokens[index];
      if(token.type==='space'){
        const lines=(token.raw.match(/\n/g)||[]).length,last=index===tokens.length-1;
        const count=Math.max(0,nodes.length?lines-(last?1:2):lines+(last?1:0));
        for(let i=0;i<count;i++)nodes.push(schema.nodes.paragraph.create());continue;
      }
      if(token.type==='checkbox')continue;
      if(token.type==='heading')nodes.push(schema.nodes.heading.create({level:token.depth},inline(token.tokens)));
      else if(token.type==='hr')nodes.push(schema.nodes.horizontal_rule.create());
      else if(token.type==='table'){
        const row=(cells,header)=>schema.nodes.table_row.create(null,token.header.map((_,i)=>schema.nodes[header?'table_header':'table_cell'].create({align:token.align[i]||null},schema.nodes.paragraph.create(null,inline(cells[i]?.tokens)))));
        nodes.push(schema.nodes.table.create(null,[row(token.header,true),...token.rows.map(cells=>row(cells,false))]));
      }
      else if(token.type==='blockquote')nodes.push(schema.nodes.blockquote.create(null,blocks(token.tokens)));
      else if(token.type==='list'){
        const children=token.items.map(item=>{
          const emptyTask=/^\[([ xX])\]\s*$/.exec(item.text||'');
          const content=emptyTask?[schema.nodes.paragraph.create()]:blocks(item.tokens);if(!content.length||content[0].type!==schema.nodes.paragraph)content.unshift(schema.nodes.paragraph.create());
          const check=item.tokens.find(t=>t.type==='checkbox');
          return schema.nodes.list_item.create({checked:emptyTask?emptyTask[1]!==' ':item.task?!!(item.checked??check?.checked):null},content);
        });
        nodes.push(schema.nodes[token.ordered?'ordered_list':'bullet_list'].create(token.ordered?{order:Math.max(1,Number(token.start)||1)}:null,children));
      }else if(token.type==='paragraph'||token.type==='text'){
        const content=token.tokens?inline(token.tokens):token.text?[schema.text(decode(token.text))]:[];
        if(token.type==='paragraph'&&index===tokens.length-1&&token.raw.endsWith('\n')&&!token.text.endsWith('\n'))content.push(schema.nodes.hard_break.create());
        nodes.push(schema.nodes.paragraph.create(null,content));
      }
      else if(token.type==='html'&&/^(?:<br\s*\/?>)+\n*$/i.test(token.raw)){
        nodes.push(schema.nodes.paragraph.create(null,(token.raw.match(/<br\s*\/?>/gi)||[]).map(()=>schema.nodes.hard_break.create())));
        const newlines=/\n+$/.exec(token.raw)?.[0];if(newlines)tokens.splice(index+1,0,{type:'space',raw:newlines});
      }
      else if(token.raw)nodes.push(schema.nodes.paragraph.create(null,schema.text(token.raw.replace(/\n+$/,''))));
    }
    return nodes.length?nodes:[schema.nodes.paragraph.create()];
  }
  function parse(value){
    const text=typeof value==='string'?value:'';
    if(cache.has(text)){const doc=cache.get(text);cache.delete(text);cache.set(text,doc);return doc;}
    const simple=!/[*~#<>\[\]`\\&\r\n]/.test(text)&&!/^\s*(?:[-+]|\d+[.)])\s/.test(text)&&!/^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:_\s*){3,}$/.test(text);
    const doc=simple?schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,text?schema.text(text):null)):schema.nodes.doc.create(null,blocks(imRichDeps.lexer._Lexer.lex(text.replace(/\r\n?/g,'\n'),{gfm:true,breaks:true})));
    if(text.length<=262144){cache.set(text,doc);cachedCharacters+=text.length;while(cache.size>128||cachedCharacters>1048576){const key=cache.keys().next().value;cachedCharacters-=key.length;cache.delete(key);}}
    return doc;
  }
  function serialize(doc){
    if(doc.content.content.every(n=>n.type===schema.nodes.paragraph)){
      const parts=[];let blank=true;
      doc.forEach((node,offset,index)=>{
        // Match the serializer's flushClose exactly, including empty blocks
        // and trailing soft breaks, without rescanning the growing prefix.
        if(index){parts.push(blank?'\n':'\n\n');blank=true;}
        let saved=paragraphSource.get(node);if(!saved){saved=[];paragraphSource.set(node,saved);}
        const last=node===doc.lastChild?1:0;
        if(saved[last]===undefined)saved[last]=serializer.serialize(schema.nodes.doc.create(null,node),{imLastBlock:last?node:null});
        const value=saved[last];parts.push(value);if(value)blank=value.endsWith('\n');
      });
      return parts.join('');
    }
    const state=new imRichDeps.serializer.MarkdownSerializerState(serializer.nodes,serializer.marks,{...serializer.options,imLastBlock:doc.lastChild});
    const parts=[];let suffix='';
    const flush=()=>{
      const value=state.out.slice(suffix.length);parts.push(value);
      if(value)suffix=value.endsWith('\n')?'\n':'x';
      state.out=suffix;
    };
    const render=state.render;
    state.render=function(node,parent,index){
      // Flush at nested block boundaries too: a single long list must not
      // rebuild/scan its entire prefix on every item. Keep the writer's
      // delimiter, closing-block and mark state; only output is chunked.
      if(node.isBlock)flush();
      render.call(this,node,parent,index);
    };
    state.renderContent(doc);flush();
    return parts.join('');
  }
  function clip(doc,lines,limit){
    let end=0,stop=false,count=0;
    doc.descendants((node,pos)=>{
      if(stop)return false;
      if(node.isTextblock){if(++count>lines){stop=true;return false;}end=Math.max(end,pos+1);}
      if(node.isText){let size=Math.min(node.text.length,limit-pos);if(size>0){if(size<node.text.length&&/[\uD800-\uDBFF]/.test(node.text[size-1]))size--;end=pos+size;}if(size<node.text.length)stop=true;}
      else if(node.type===schema.nodes.hard_break){end=pos+1;if(++count>=lines)stop=true;}
    });
    if(!stop||!end)return {doc,complete:true};
    const prefix=doc.cut(0,end);prefix.check();return {doc:prefix,complete:false};
  }
  function preview(text,lines,limit=3584){
    const clipped=clip(parse(text),lines,limit);return {text:clipped.complete?text:serialize(clipped.doc),complete:clipped.complete};
  }
  function message(record){
    const old=records.get(record);if(old?.source===record.text)return old;
    const doc=parse(record.text),result={source:record.text,doc,text:doc.textBetween(0,doc.content.size,'\n','\n')};records.set(record,result);return result;
  }
  function bounded(record){const entry=message(record);return entry.preview||(entry.preview=clip(entry.doc,96,16384).doc);}
  function toggleCheck(text,index){
    const doc=parse(text);let at=-1,count=0,checked=false;
    doc.descendants((node,pos)=>{if(node.type===schema.nodes.list_item&&node.attrs.checked!==null){if(count++===index){at=pos;checked=node.attrs.checked;}}});
    if(at<0)return text;
    const state=imRichDeps.state.EditorState.create({doc});return serialize(state.tr.setNodeMarkup(at,null,{checked:!checked}).doc);
  }
  function render(target,doc,onCheck){
    let checkbox=0;const document=target.ownerDocument;
    function nodeDOM(node){
      if(node.isText){let out=document.createTextNode(node.text);for(const mark of node.marks){const wrap=document.createElement(mark.type===schema.marks.strong?'strong':mark.type===schema.marks.em?'em':'s');wrap.append(out);out=wrap;}return out;}
      if(node.type===schema.nodes.horizontal_rule)return document.createElement('hr');
      if(node.type===schema.nodes.hard_break)return document.createTextNode('\n');
      const names={paragraph:'p',heading:'h'+node.attrs.level,blockquote:'blockquote',bullet_list:'ul',ordered_list:'ol',list_item:'li',table:'table',table_row:'tr',table_cell:'td',table_header:'th'};
      const out=document.createElement(names[node.type.name]||'div');
      if(node.type===schema.nodes.table_cell||node.type===schema.nodes.table_header){if(node.attrs.align)out.style.textAlign=node.attrs.align;}
      if(node.type===schema.nodes.ordered_list&&node.attrs.order!==1)out.start=node.attrs.order;
      if(node.type===schema.nodes.list_item&&node.attrs.checked!==null){
        out.dataset.checked=String(node.attrs.checked);const index=checkbox++,check=document.createElement('button');check.type='button';check.className='im-md-check';check.setAttribute('role','checkbox');check.setAttribute('aria-checked',String(node.attrs.checked));check.setAttribute('aria-label',node.attrs.checked?'Mark item incomplete':'Mark item complete');check.textContent=node.attrs.checked?'✓':'';
        if(onCheck)check.addEventListener('click',event=>{event.stopPropagation();if(check.isConnected)onCheck(index);});else{check.disabled=true;check.tabIndex=-1;}
        out.append(check);
      }
      node.forEach(child=>out.append(nodeDOM(child)));
      if(node.type===schema.nodes.table){const wrap=document.createElement('div');wrap.className='im-md-table-wrap';out.style.minWidth=Math.max(280,node.firstChild.childCount*140)+'px';wrap.append(out);return wrap;}return out;
    }
    const fragment=document.createDocumentFragment();doc.forEach(node=>fragment.append(nodeDOM(node)));target.replaceChildren(fragment);target.classList.add('im-rich-display');
  }
  return {schema,parse,serialize,preview,message,bounded,toggleCheck,render,hasText:text=>!!parse(text).textContent.trim(),cacheStats:()=>({documents:cache.size,characters:cachedCharacters})};
})();
