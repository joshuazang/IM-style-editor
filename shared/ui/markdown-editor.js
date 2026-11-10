/* A local ProseMirror field with a small imperative bridge for both interfaces. */
const imRichField=(()=>{
  const {schema}=imMarkdown,{EditorView}=imRichDeps.view,{EditorState,TextSelection}=imRichDeps.state;
  const C=imRichDeps.commands,K=imMarkdownCommands;let live=0;
  function plainDoc(text){const content=[];text.split(/\r\n?|\n/).forEach((part,i)=>{if(i)content.push(schema.nodes.hard_break.create());if(part)content.push(schema.text(part));});return schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,content));}
  function create(options={}){
    const dom=document.createElement('div'),wrapper=document.createElement('div'),main=document.createElement('div'),toolbar=document.createElement('div');
    wrapper.className='im-rich-field';main.className='im-rich-main';toolbar.className='im-format-toolbar';toolbar.hidden=true;toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Text formatting');
    let config={...options},source=String(options.value??'').replace(/\r\n?/g,'\n'),plain=!!options.plain,context=options.context??'',readOnly=!!options.readOnly,disabled=!!options.disabled,destroyed=false,ime=false,lastIME=0,view,focusRunning=false;
    const formatting=!options.capture,controls=new Map(),headingLevels=new Map();let send;
    function action(label,content,command){
      const b=document.createElement('button');b.type='button';b.className='im-format-action';b.title=label;b.setAttribute('aria-label',label);b.textContent=content;
      b.addEventListener('pointerdown',event=>{if(event.button===0)event.preventDefault();});
      b.addEventListener('click',event=>{event.stopPropagation();if(!disabled&&!readOnly){command();view.focus();}});return b;
    }
    const toggle=action('Text formatting','Aa',()=>{toolbar.hidden=!toolbar.hidden;toggle.setAttribute('aria-expanded',String(!toolbar.hidden));config.onResize?.();});toggle.classList.add('im-format-toggle');toggle.setAttribute('aria-expanded','false');
    const execute=command=>command(view.state,view.dispatch,view);
    function refresh(){
      dom.dataset.empty=String(view.state.doc.childCount===1&&view.state.doc.firstChild.type===schema.nodes.paragraph&&!view.state.doc.firstChild.content.size);
      const state=view.state,headingLevel=formatting?K.headingLevel(state):null;
      for(const [key,button] of controls){
        let active=false;
        if(key==='strong'||key==='strike')active=K.markActive(state,key);
        else if(key==='quote')active=!!K.ancestor(state,schema.nodes.blockquote);
        else if(key==='bullet')active=!!K.ancestor(state,schema.nodes.bullet_list)&&K.ancestor(state,schema.nodes.list_item)?.node.attrs.checked===null;
        else if(key==='ordered')active=!!K.ancestor(state,schema.nodes.ordered_list);
        else if(key==='checklist')active=K.ancestor(state,schema.nodes.list_item)?.node.attrs.checked!=null;
        else if(key==='heading')active=headingLevel!==null;
        button.setAttribute('aria-pressed',String(active));button.disabled=disabled||readOnly;
      }
      for(const [level,button] of headingLevels){button.setAttribute('aria-pressed',String(headingLevel===level));button.disabled=disabled||readOnly;}
      toggle.disabled=disabled||readOnly;toggle.hidden=plain||!formatting;
      if(send)send.disabled=disabled||readOnly||!view.state.doc.textContent.trim();
      if(plain){toolbar.hidden=true;toggle.setAttribute('aria-expanded','false');}
    }
    function editableChanged(){view.setProps({editable:()=>!disabled&&!readOnly,attributes:attrs});for(const b of dom.querySelectorAll('.im-md-check'))b.disabled=disabled||readOnly;refresh();}
    function enter(event){
      if(event.isComposing||event.keyCode===229||ime||view.composing){lastIME=performance.now();return false;}
      if(event.key!=='Enter')return false;
      if(disabled||readOnly)return false;
      if(event.metaKey||event.ctrlKey){execute(K.exitFormat);return true;}
      if(event.shiftKey){execute(K.lineBreak);return true;}
      if(config.capture&&!K.structural(view.state)){if(!event.repeat)config.onSubmit?.();return true;}
      execute(K.enter);return true;
    }
    const history=imRichDeps.history;
    const documentEdge=(last,extend=false)=>(state,dispatch)=>{const edge=last?TextSelection.atEnd(state.doc).head:TextSelection.atStart(state.doc).head;if(dispatch)dispatch(state.tr.setSelection(TextSelection.create(state.doc,extend?state.selection.anchor:edge,edge)).scrollIntoView());return true;};
    const shortcuts={
      'Ctrl-b':C.toggleMark(schema.marks.strong),'Meta-b':C.toggleMark(schema.marks.strong),
      'Ctrl-Shift-x':C.toggleMark(schema.marks.strike),'Meta-Shift-x':C.toggleMark(schema.marks.strike),
      'Ctrl-z':history.undo,'Meta-z':history.undo,'Shift-Ctrl-z':history.redo,'Shift-Meta-z':history.redo,'Ctrl-y':history.redo,
      'Tab':imRichDeps.lists.sinkListItem(schema.nodes.list_item),'Shift-Tab':imRichDeps.lists.liftListItem(schema.nodes.list_item)
    };
    for(const modifier of ['Ctrl','Meta'])for(const [key,last] of [['Home',false],['End',true]]){shortcuts[modifier+'-'+key]=documentEdge(last);shortcuts['Shift-'+modifier+'-'+key]=documentEdge(last,true);}
    function typingRules(){
      const R=imRichDeps.inputrules,rules=[
        R.wrappingInputRule(/^\s*>\s$/,schema.nodes.blockquote),
        R.wrappingInputRule(/^\s*([-+*])\s$/,schema.nodes.bullet_list),
        R.wrappingInputRule(/^(\d+)\.\s$/,schema.nodes.ordered_list,m=>({order:Number(m[1])})),
        R.textblockTypeInputRule(/^(#{1,6})\s$/,schema.nodes.heading,m=>({level:m[1].length})),
        new R.InputRule(/^\[([ xX])\]\s$/,(state,match,start,end)=>{
          const item=K.ancestor(state,schema.nodes.list_item);if(!item)return null;
          return state.tr.delete(start,end).setNodeMarkup(item.pos,null,{checked:match[1]!==' '});
        })
      ];
      for(const [pattern,mark] of [[/\*\*([^*]+)\*\*$/,schema.marks.strong],[/~~([^~]+)~~$/,schema.marks.strike]])rules.push(new R.InputRule(pattern,(state,match,start,end)=>state.tr.insertText(match[1],start,end).addMark(start,start+match[1].length,mark.create()).setStoredMarks([mark.create()])));
      return R.inputRules({rules});
    }
    const baseKeys=Object.fromEntries(Object.entries(C.baseKeymap).filter(([key])=>!key.includes('Enter')));
    function newState(value){return EditorState.create({schema,doc:plain?plainDoc(value):imMarkdown.parse(value),plugins:[history.history({depth:100}),...(!plain?[typingRules()]:[]),imRichDeps.keymap.keymap(shortcuts),imRichDeps.keymap.keymap(baseKeys)]});}
    function attrs(){return {id:config.id||'',class:(config.className||'')+' im-rich-input',role:'textbox','aria-label':config.label||'Text','aria-multiline':'true','aria-readonly':String(readOnly),'aria-disabled':String(disabled),tabindex:disabled?'-1':'0',spellcheck:'false',autocorrect:'off',autocapitalize:'off',autocomplete:'off',writingsuggestions:'false',enterkeyhint:config.capture?'send':'enter','data-placeholder':config.placeholder||''};}
    view=new EditorView({mount:dom},{state:newState(source),attributes:attrs,editable:()=>!disabled&&!readOnly,
      dispatchTransaction:transaction=>{
        const before=view.state.doc,result=view.state.applyTransaction(transaction);view.updateState(result.state);refresh();
        if(!before.eq(result.state.doc)){
          source=plain?result.state.doc.textBetween(0,result.state.doc.content.size,'\n','\n'):(transaction.getMeta('im-paste-source')??imMarkdown.serialize(result.state.doc));
          config.onChange?.(source);dom.dispatchEvent(new CustomEvent('im-markdown-change',{bubbles:true}));config.onResize?.();
        }
      },
      handleKeyDown:(v,event)=>{
        if((event.key==='End'||event.key==='Home')&&v.state.selection instanceof imRichDeps.state.AllSelection){v.dispatch(v.state.tr.setSelection(event.key==='End'?TextSelection.atEnd(v.state.doc):TextSelection.atStart(v.state.doc)));return true;}
        if(event.key!=='Enter'){config.onKeyDown?.(event);if(event.defaultPrevented)return true;}return enter(event);
      },
      handlePaste:(v,event)=>{
        if(plain||disabled||readOnly||event.clipboardData?.getData('text/html'))return false;
        const text=event.clipboardData?.getData('text/plain');if(!text)return false;
        const doc=imMarkdown.parse(text),tr=v.state.tr.replaceSelection(new imRichDeps.model.Slice(doc.content,0,0));if(tr.doc.eq(doc))tr.setMeta('im-paste-source',text.replace(/\r\n?/g,'\n'));v.dispatch(tr.scrollIntoView());return true;
      },
      handleDOMEvents:{
        compositionstart:()=>{ime=true;return false;},compositionend:()=>{ime=false;lastIME=performance.now();return false;},
        beforeinput:(v,event)=>{
          if(!['insertParagraph','insertLineBreak'].includes(event.inputType)||event.isComposing||ime||view.composing||performance.now()-lastIME<40)return false;
          if(disabled||readOnly)return false;
          event.preventDefault();if(config.capture&&!K.structural(view.state))config.onSubmit?.();else execute(K.enter);return true;
        }
      },
      nodeViews:{list_item:(initial,v,getPos)=>{
        let node=initial;const li=document.createElement('li'),contentDOM=document.createElement('div'),check=document.createElement('button');contentDOM.className='im-md-item';check.type='button';check.className='im-md-check';check.contentEditable='false';check.setAttribute('role','checkbox');
        const update=next=>{if(next.type!==schema.nodes.list_item)return false;node=next;check.hidden=node.attrs.checked===null;li.toggleAttribute('data-task',!check.hidden);if(check.hidden)delete li.dataset.checked;else li.dataset.checked=String(node.attrs.checked);check.disabled=disabled||readOnly;check.setAttribute('aria-checked',String(!!node.attrs.checked));check.setAttribute('aria-label',node.attrs.checked?'Mark item incomplete':'Mark item complete');check.textContent=node.attrs.checked?'✓':'';return true;};
        const click=event=>{event.preventDefault();event.stopPropagation();const pos=getPos();if(!disabled&&!readOnly&&typeof pos==='number'){v.dispatch(v.state.tr.setNodeMarkup(pos,null,{checked:!node.attrs.checked}));v.focus();}};
        check.addEventListener('pointerdown',e=>e.preventDefault());check.addEventListener('click',click);li.append(check,contentDOM);update(node);
        return {dom:li,contentDOM,update,stopEvent:event=>check.contains(event.target),ignoreMutation:m=>check.contains(m.target),destroy:()=>check.removeEventListener('click',click)};
      }}
    });
    live++;
    const nativeFocus=dom.focus.bind(dom);dom.focus=opts=>{nativeFocus(opts);if(!focusRunning){focusRunning=true;try{view.focus();}finally{focusRunning=false;}}};
    function setValue(value,reset=false){
      value=String(value??'').replace(/\r\n?/g,'\n');if(!reset&&value===source)return;
      source=value;const parsed=plain?plainDoc(value):imMarkdown.parse(value);
      if(reset||!parsed.eq(view.state.doc))view.updateState(newState(value));refresh();
    }
    const start=()=>TextSelection.atStart(view.state.doc).from,end=()=>TextSelection.atEnd(view.state.doc).to;
    const offset=pos=>pos===end()?source.length:pos===start()?0:Math.max(0,pos-1);
    function position(value){return value<=0?start():value>=source.length?end():Math.min(end(),Math.max(start(),value+1));}
    Object.defineProperties(dom,{
      value:{get:()=>source,set:value=>setValue(value)},
      readOnly:{get:()=>readOnly,set:value=>{if(readOnly!==!!value){readOnly=!!value;editableChanged();}}},
      disabled:{get:()=>disabled,set:value=>{if(disabled!==!!value){disabled=!!value;editableChanged();}}},
      placeholder:{get:()=>config.placeholder||'',set:value=>{if(config.placeholder!==String(value)){config.placeholder=String(value);view.setProps({attributes:attrs});}}},
      selectionStart:{get:()=>offset(view.state.selection.from)},selectionEnd:{get:()=>offset(view.state.selection.to)},
      selectionDirection:{get:()=>view.state.selection.anchor>view.state.selection.head?'backward':'forward'}
    });
    dom.setSelectionRange=(from,to,direction)=>{const a=position(from),b=position(to);view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,direction==='backward'?b:a,direction==='backward'?a:b)));};
    dom.select=()=>dom.setSelectionRange(0,source.length);
    function add(key,label,text,command){const b=action(label,text,()=>execute(command));controls.set(key,b);toolbar.append(b);return b;}
    if(formatting){
      add('strong','Bold','B',C.toggleMark(schema.marks.strong)).classList.add('im-format-bold');
      add('strike','Strikethrough','S',C.toggleMark(schema.marks.strike)).classList.add('im-format-strike');
      add('quote','Quotation block','❞',K.quote);
      add('bullet','Bullet list','•',K.toggleList('bullet'));
      add('ordered','Numbered list','1.',K.toggleList('ordered'));
      add('checklist','Checklist','☑',K.toggleList('checklist'));
      const levels=document.createElement('div');levels.className='im-heading-levels';levels.hidden=true;
      const headingButton=action('Heading','H',()=>{levels.hidden=!levels.hidden;headingButton.setAttribute('aria-expanded',String(!levels.hidden));config.onResize?.();});controls.set('heading',headingButton);toolbar.append(headingButton);headingButton.setAttribute('aria-expanded','false');
      for(let level=1;level<=6;level++){const choice=action('Heading '+level,'H'+level,()=>{execute(K.heading(level));levels.hidden=true;headingButton.setAttribute('aria-expanded','false');config.onResize?.();});headingLevels.set(level,choice);levels.append(choice);}
      toolbar.append(action('Start ordinary text','¶',()=>execute(K.exitFormat)),levels);
      main.append(toggle);
    }
    main.append(dom);
    if(options.sendButton){send=action('Send','↑',()=>config.onSubmit?.());send.classList.add('im-rich-send');main.append(send);}
    wrapper.append(main);if(formatting)wrapper.append(toolbar);refresh();
    const controller={dom,wrapper,toggle,toolbar,view,
      setContext:(key,value,plainMode=false)=>{const reset=key!==context||plain!==plainMode;context=key;plain=plainMode;setValue(value,reset);},
      configure:next=>{const before=JSON.stringify(attrs());config={...config,...next};if(next.disabled!==undefined)disabled=!!next.disabled;if(next.readOnly!==undefined)readOnly=!!next.readOnly;if(JSON.stringify(attrs())!==before)editableChanged();else refresh();},
      insertText:text=>{view.dispatch(view.state.tr.insertText(text).scrollIntoView());view.focus();},
      appendText:text=>{const selection=TextSelection.atEnd(view.state.doc),marks=view.state.storedMarks||selection.$from.marks();view.dispatch(view.state.tr.setSelection(selection).setStoredMarks(marks).insertText(text).scrollIntoView());view.focus();},
      backspaceAtEnd:()=>{view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));const state=view.state,from=state.selection.from,before=state.selection.$from.nodeBefore;if(state.selection.$from.parentOffset){const last=before?.isText?Array.from(before.text).at(-1):'';view.dispatch(state.tr.delete(from-(last?.length||1),from).scrollIntoView());}else C.joinBackward(state,view.dispatch,view);view.focus();},
      destroy:()=>{if(destroyed)return;destroyed=true;view.destroy();live--;wrapper.remove();toolbar.remove();toggle.remove();},
      value:()=>source,
      get plain(){return plain;}
    };dom.imRich=controller;return controller;
  }
  return {create,stats:()=>({live})};
})();
