/* The selected Markdown subset, shared by both visual interfaces. */
const imMarkdown=(()=>{
  const {Schema}=imRichDeps.model;
  const schema=new Schema({nodes:{
    doc:{content:'block+'},
    paragraph:{content:'inline*',group:'block',parseDOM:[{tag:'p'}],toDOM:()=>['p',0]},
    heading:{attrs:{level:{default:1}},content:'inline*',group:'block',defining:true,
      parseDOM:[1,2,3,4,5,6].map(level=>({tag:'h'+level,attrs:{level}})),toDOM:n=>['h'+Math.max(1,Math.min(6,n.attrs.level)),0]},
    blockquote:{content:'block+',group:'block',defining:true,parseDOM:[{tag:'blockquote'}],toDOM:()=>['blockquote',0]},
    bullet_list:{content:'list_item+',group:'block',parseDOM:[{tag:'ul'}],toDOM:()=>['ul',0]},
    ordered_list:{attrs:{order:{default:1}},content:'list_item+',group:'block',parseDOM:[{tag:'ol',getAttrs:n=>({order:Math.max(1,Number(n.getAttribute('start'))||1)})}],toDOM:n=>['ol',{start:n.attrs.order},0]},
    list_item:{attrs:{checked:{default:null}},content:'paragraph block*',defining:true,
      parseDOM:[{tag:'li',getAttrs:n=>{const checked=n.getAttribute('data-checked'),input=n.querySelector('input[type=checkbox]');return {checked:checked!==null?checked==='true':input?input.checked:null};}}],
      toDOM:n=>['li',n.attrs.checked===null?{}:{'data-checked':String(n.attrs.checked)},['div',{class:'im-md-item'},0]]},
    text:{group:'inline'},
    hard_break:{inline:true,group:'inline',selectable:false,parseDOM:[{tag:'br'}],toDOM:()=>['br']}
  },marks:{
    strong:{parseDOM:[{tag:'strong'},{tag:'b',getAttrs:n=>n.style.fontWeight!=='normal'&&null},{style:'font-weight',getAttrs:v=>/^(bold(er)?|[6-9]00)$/.test(v)&&null}],toDOM:()=>['strong',0]},
    strike:{parseDOM:[{tag:'s'},{tag:'del'},{tag:'strike'},{style:'text-decoration',getAttrs:v=>v.includes('line-through')&&null}],toDOM:()=>['s',0]}
  }});
  const base=imRichDeps.serializer.defaultMarkdownSerializer;
  const serializer=new imRichDeps.serializer.MarkdownSerializer({
    paragraph:(s,n)=>{if(!n.content.size)s.write('');s.renderInline(n);s.closeBlock(n);},heading:base.nodes.heading,blockquote:base.nodes.blockquote,
    bullet_list:base.nodes.bullet_list,ordered_list:base.nodes.ordered_list,
    list_item:(s,n)=>{if(n.attrs.checked!==null)s.write(n.attrs.checked?'[x] ':'[ ] ');s.renderContent(n);},
    // Single newlines display as line breaks in both editors. Consecutive or
    // trailing soft breaks need an explicit br so they cannot become paragraphs.
    hard_break:(s,n,parent,index)=>s.write(parent.type===schema.nodes.heading?'<br>':index===parent.childCount-1?(s.options.imLastBlock===parent&&parent.type===schema.nodes.paragraph&&!s.delim&&parent.textContent.trim()?'\n':'<br>'):parent.child(index+1).type===schema.nodes.hard_break?'<br>':'\n'),text:base.nodes.text
  },{strong:base.marks.strong,strike:{open:'~~',close:'~~',mixable:true,expelEnclosingWhitespace:true}},{tightLists:true,escapeExtraCharacters:/[&<]/g});
  const cache=new Map(),records=new WeakMap();let cachedCharacters=0;
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
  const decode=text=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(raw,name)=>{
    if(name[0]!=='#')return entities[name.toLowerCase()]??raw;
    const n=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';
  });
  function inline(tokens,marks=[]){
    const nodes=[];
    for(const token of tokens||[]){
      if(token.type==='strong'||token.type==='del')nodes.push(...inline(token.tokens,[...marks,schema.marks[token.type==='strong'?'strong':'strike'].create()]));
      else if(token.type==='br'||token.type==='html'&&/^<br\s*\/?>$/i.test(token.raw))nodes.push(schema.nodes.hard_break.create());
      else if(token.type==='text'&&token.tokens)nodes.push(...inline(token.tokens,marks));
      else{const text=token.type==='text'?decode(token.text||''):token.type==='escape'?(token.text||''):(token.raw||token.text||'');if(text)nodes.push(schema.text(text,marks));}
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
      else if(token.type==='blockquote')nodes.push(schema.nodes.blockquote.create(null,blocks(token.tokens)));
      else if(token.type==='list'){
        const children=token.items.map(item=>{
          const content=blocks(item.tokens);if(!content.length||content[0].type!==schema.nodes.paragraph)content.unshift(schema.nodes.paragraph.create());
          const check=item.tokens.find(t=>t.type==='checkbox');
          return schema.nodes.list_item.create({checked:item.task?!!(item.checked??check?.checked):null},content);
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
    const simple=!/[*~#<>\[\]`\\&\r\n]/.test(text)&&!/^\s*(?:[-+]|\d+[.)])\s/.test(text);
    const doc=simple?schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,text?schema.text(text):null)):schema.nodes.doc.create(null,blocks(imRichDeps.lexer._Lexer.lex(text.replace(/\r\n?/g,'\n'),{gfm:true,breaks:true})));
    if(text.length<=262144){cache.set(text,doc);cachedCharacters+=text.length;while(cache.size>128||cachedCharacters>1048576){const key=cache.keys().next().value;cachedCharacters-=key.length;cache.delete(key);}}
    return doc;
  }
  function serialize(doc){return serializer.serialize(doc,{imLastBlock:doc.lastChild});}
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
      if(node.isText){let out=document.createTextNode(node.text);for(const mark of node.marks){const wrap=document.createElement(mark.type===schema.marks.strong?'strong':'s');wrap.append(out);out=wrap;}return out;}
      if(node.type===schema.nodes.hard_break)return document.createTextNode('\n');
      const names={paragraph:'p',heading:'h'+node.attrs.level,blockquote:'blockquote',bullet_list:'ul',ordered_list:'ol',list_item:'li'};
      const out=document.createElement(names[node.type.name]||'div');
      if(node.type===schema.nodes.ordered_list&&node.attrs.order!==1)out.start=node.attrs.order;
      if(node.type===schema.nodes.list_item&&node.attrs.checked!==null){
        out.dataset.checked=String(node.attrs.checked);const index=checkbox++,check=document.createElement('button');check.type='button';check.className='im-md-check';check.setAttribute('role','checkbox');check.setAttribute('aria-checked',String(node.attrs.checked));check.setAttribute('aria-label',node.attrs.checked?'Mark item incomplete':'Mark item complete');check.textContent=node.attrs.checked?'✓':'';
        if(onCheck)check.addEventListener('click',event=>{event.stopPropagation();if(check.isConnected)onCheck(index);});else{check.disabled=true;check.tabIndex=-1;}
        out.append(check);
      }
      node.forEach(child=>out.append(nodeDOM(child)));return out;
    }
    const fragment=document.createDocumentFragment();doc.forEach(node=>fragment.append(nodeDOM(node)));target.replaceChildren(fragment);target.classList.add('im-rich-display');
  }
  return {schema,parse,serialize,preview,message,bounded,toggleCheck,render,hasText:text=>!!parse(text).textContent.trim(),cacheStats:()=>({documents:cache.size,characters:cachedCharacters})};
})();
