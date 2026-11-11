/* A local ProseMirror field with a small imperative bridge for both interfaces. */
const imRichField=(()=>{
  const {schema}=imMarkdown,{EditorView}=imRichDeps.view,{EditorState,TextSelection}=imRichDeps.state;
  const C=imRichDeps.commands,K=imMarkdownCommands;let live=0;
  function plainDoc(text){const content=[];text.split(/\r\n?|\n/).forEach((part,i)=>{if(i)content.push(schema.nodes.hard_break.create());if(part)content.push(schema.text(part));});return schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,content));}
  function create(options={}){
    const dom=document.createElement('div'),wrapper=document.createElement('div'),main=document.createElement('div'),toolbar=document.createElement('div');
    wrapper.className='im-rich-field';main.className='im-rich-main';toolbar.className='im-format-toolbar';toolbar.hidden=true;toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Text formatting');
    let config={...options},source=String(options.value??'').replace(/\r\n?/g,'\n'),plain=!!options.plain,context=options.context??'',readOnly=!!options.readOnly,disabled=!!options.disabled,destroyed=false,ime=false,lastIME=0,view,focusRunning=false;
    const formatting=!options.capture,controls=new Map(),headingLevels=new Map();let send,floating;
    function action(label,content,command){
      const b=document.createElement('button');b.type='button';b.className='im-format-action';b.title=label;b.setAttribute('aria-label',label);b.textContent=content;
      b.addEventListener('pointerdown',event=>{if(event.button===0)event.preventDefault();});
      b.addEventListener('click',event=>{event.stopPropagation();if(!disabled&&!readOnly){command();view.focus();floating?.update();}});return b;
    }
    const toggle=action('Text formatting','Aa',()=>{floating?.toggle();});toggle.classList.add('im-format-toggle');toggle.setAttribute('aria-expanded','false');
    const execute=command=>command(view.state,view.dispatch,view);
    function refresh(){
      dom.dataset.empty=String(view.state.doc.childCount===1&&view.state.doc.firstChild.type===schema.nodes.paragraph&&!view.state.doc.firstChild.content.size);
      const state=view.state,headingLevel=K.headingLevel(state);
      for(const [key,button] of controls){
        let active=false;
        if(key==='strong'||key==='strike')active=K.markActive(state,key);
        else if(key==='quote')active=K.quoteActive(state);
        else if(['bullet','ordered','checklist'].includes(key))active=K.listKind(state)===key;
        else if(key==='normal')active=K.paragraphActive(state);
        button.setAttribute('aria-pressed',String(active));button.disabled=disabled||readOnly;
      }
      for(const [level,button] of headingLevels){button.setAttribute('aria-pressed',String(headingLevel===level));button.disabled=disabled||readOnly;}
      const clear=toolbar.querySelector('.im-format-clear');if(clear)clear.disabled=disabled||readOnly||state.selection.empty;
      toggle.disabled=disabled||readOnly;toggle.hidden=plain||!formatting;
      if(send)send.disabled=disabled||readOnly||!view.state.doc.textContent.trim();
      if(plain){toolbar.hidden=true;toggle.setAttribute('aria-expanded','false');}
      floating?.update();
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
      'Alt-F10':()=>floating?.focus()||false,
      'Mod-a':(state,dispatch,currentView)=>{currentView.focus();return C.selectAll(currentView.state,dispatch);},
      'Ctrl-b':C.toggleMark(schema.marks.strong),'Meta-b':C.toggleMark(schema.marks.strong),
      'Ctrl-Shift-x':C.toggleMark(schema.marks.strike),'Meta-Shift-x':C.toggleMark(schema.marks.strike),
      'Ctrl-z':history.undo,'Meta-z':history.undo,'Shift-Ctrl-z':history.redo,'Shift-Meta-z':history.redo,'Ctrl-y':history.redo,
      'Tab':imRichDeps.lists.sinkListItem(schema.nodes.list_item),'Shift-Tab':imRichDeps.lists.liftListItem(schema.nodes.list_item)
    };
    for(const modifier of ['Ctrl','Meta'])for(const [key,last] of [['Home',false],['End',true]]){shortcuts[modifier+'-'+key]=documentEdge(last);shortcuts['Shift-'+modifier+'-'+key]=documentEdge(last,true);}
    function typingRules(){
      const R=imRichDeps.inputrules;
      const logicalLine=(pattern,command)=>new R.InputRule(pattern,(state,match,start,end)=>{
        if(state.selection.$from.parent.type!==schema.nodes.paragraph||K.ancestor(state,schema.nodes.list_item))return null;
        // The match includes the preceding hard break; leave that boundary intact.
        const tr=state.tr.delete(start+1,end),current=state.apply(tr);
        if(!command(match)(current,next=>{for(const step of next.steps)tr.step(step);tr.setSelection(imRichDeps.state.Selection.fromJSON(tr.doc,next.selection.toJSON()));tr.setStoredMarks(next.storedMarks);}))return null;
        return tr;
      });
      const rules=[
        logicalLine(/\ufffc[ \t]*[-+*][ \t]$/,()=>K.toggleList('bullet')),
        logicalLine(/\ufffc[ \t]*(\d+)\.[ \t]$/,match=>(state,dispatch)=>K.toggleList('ordered')(state,tr=>{
          const list=K.ancestor({selection:tr.selection},schema.nodes.ordered_list);if(list)tr.setNodeMarkup(list.pos,null,{order:Math.max(1,Number(match[1]))});dispatch(tr);
        })),
        logicalLine(/\ufffc[ \t]*(#{1,6})[ \t]$/,match=>K.heading(match[1].length)),
        logicalLine(/\ufffc[ \t]*>[ \t]$/,()=>K.quoteLine),
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
        if(event.key==='Escape'&&!dom.closest('dialog')&&floating?.dismiss()){event.preventDefault();event.stopPropagation();return true;}
        if((event.key==='End'||event.key==='Home')&&v.state.selection instanceof imRichDeps.state.AllSelection){v.dispatch(v.state.tr.setSelection(event.key==='End'?TextSelection.atEnd(v.state.doc):TextSelection.atStart(v.state.doc)).scrollIntoView());return true;}
        if(event.key!=='Enter'){config.onKeyDown?.(event);if(event.defaultPrevented)return true;}return enter(event);
      },
      handlePaste:(v,event)=>{
        if(plain||disabled||readOnly||event.clipboardData?.getData('text/html'))return false;
        const text=event.clipboardData?.getData('text/plain');if(!text)return false;
        const doc=imMarkdown.parse(text),whole=v.state.selection.from<=TextSelection.atStart(v.state.doc).from&&v.state.selection.to>=TextSelection.atEnd(v.state.doc).to,tr=whole?v.state.tr.replaceWith(0,v.state.doc.content.size,doc.content):v.state.tr.replaceSelection(new imRichDeps.model.Slice(doc.content,0,0));if(tr.doc.eq(doc))tr.setMeta('im-paste-source',text.replace(/\r\n?/g,'\n'));v.dispatch(tr.scrollIntoView());return true;
      },
      handleDOMEvents:{
        compositionstart:()=>{ime=true;floating?.update();return false;},compositionend:()=>{ime=false;lastIME=performance.now();return false;},
        beforeinput:(v,event)=>{
          if(!['insertParagraph','insertLineBreak'].includes(event.inputType)||event.isComposing||ime||view.composing||performance.now()-lastIME<40)return false;
          if(disabled||readOnly)return false;
          event.preventDefault();if(config.capture&&!K.structural(view.state))config.onSubmit?.();else execute(K.enter);return true;
        }
      },
      nodeViews:{list_item:(initial,v,getPos)=>{
        let node=initial,check=null;const li=document.createElement('li'),contentDOM=document.createElement('div');contentDOM.className='im-md-item';
        const click=event=>{event.preventDefault();event.stopPropagation();const pos=getPos();if(!disabled&&!readOnly&&typeof pos==='number'){v.dispatch(v.state.tr.setNodeMarkup(pos,null,{checked:!node.attrs.checked}));v.focus();}};
        const update=next=>{
          if(next.type!==schema.nodes.list_item)return false;node=next;
          const task=node.attrs.checked!==null;li.toggleAttribute('data-task',task);
          if(!task){delete li.dataset.checked;check?.remove();check=null;return true;}
          if(!check){check=document.createElement('button');check.type='button';check.className='im-md-check';check.contentEditable='false';check.setAttribute('role','checkbox');check.addEventListener('pointerdown',event=>event.preventDefault());check.addEventListener('click',click);li.prepend(check);}
          li.dataset.checked=String(node.attrs.checked);check.disabled=disabled||readOnly;check.setAttribute('aria-checked',String(node.attrs.checked));check.setAttribute('aria-label',node.attrs.checked?'Mark item incomplete':'Mark item complete');check.textContent=node.attrs.checked?'✓':'';return true;
        };
        li.append(contentDOM);update(node);
        return {dom:li,contentDOM,update,stopEvent:event=>!!check?.contains(event.target),ignoreMutation:m=>!!check?.contains(m.target),destroy:()=>check?.removeEventListener('click',click)};
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
    function icon(button,name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.innerHTML=imUiIcons[name];button.replaceChildren(svg);return button;}
    function add(key,label,text,command){const b=icon(action(label,text,()=>execute(command)),{strong:'formatBold',strike:'formatStrike',quote:'formatQuote',bullet:'formatBullet',ordered:'formatNumber',checklist:'formatChecklist'}[key]);controls.set(key,b);toolbar.append(b);return b;}
    {
      add('strong','Bold','B',C.toggleMark(schema.marks.strong)).classList.add('im-format-bold');
      add('quote','Quotation block','❞',K.quote);
      add('strike','Strikethrough','S',C.toggleMark(schema.marks.strike)).classList.add('im-format-strike');
      add('bullet','Bullet list','•',K.toggleList('bullet'));
      add('ordered','Numbered list','1.',K.toggleList('ordered'));
      add('checklist','Checklist','☑',K.toggleList('checklist'));
      const styles=document.createElement('div');styles.className='im-format-text-styles';
      for(const level of [1,2]){const choice=action('Heading '+level,'H'+level,()=>execute(K.heading(level)));headingLevels.set(level,choice);styles.append(choice);}
      const ordinary=action('Normal text','Aa',()=>execute(K.normal));controls.set('normal',ordinary);styles.append(ordinary);toolbar.append(styles);
      const clear=icon(action('Clear Formatting','',()=>execute(K.clearFormatting)),'formatClear');clear.classList.add('im-format-clear');toolbar.append(clear);
      icon(toggle,'formatText');
      if(formatting)main.append(toggle);
    }
    main.append(dom);
    if(options.sendButton){send=action('Send','↑',()=>config.onSubmit?.());send.classList.add('im-rich-send');main.append(send);}
    wrapper.append(main);if(formatting)wrapper.append(toolbar);floating=imSelectionFormatting({dom,toolbar,toggle,view,manual:formatting,canFormat:()=>!plain&&!disabled&&!readOnly&&!ime&&!view.composing});refresh();
    const controller={dom,wrapper,toggle,toolbar,view,
      setContext:(key,value,plainMode=false)=>{const reset=key!==context||plain!==plainMode;if(reset)floating?.reset();context=key;plain=plainMode;setValue(value,reset);},
      configure:next=>{const before=JSON.stringify(attrs());config={...config,...next};if(next.disabled!==undefined)disabled=!!next.disabled;if(next.readOnly!==undefined)readOnly=!!next.readOnly;if(JSON.stringify(attrs())!==before)editableChanged();else refresh();},
      insertText:text=>{view.dispatch(view.state.tr.insertText(text).scrollIntoView());view.focus();},
      appendText:text=>{const selection=TextSelection.atEnd(view.state.doc),marks=view.state.storedMarks||selection.$from.marks();view.dispatch(view.state.tr.setSelection(selection).setStoredMarks(marks).insertText(text).scrollIntoView());view.focus();},
      backspaceAtEnd:()=>{view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));const state=view.state,from=state.selection.from,before=state.selection.$from.nodeBefore;if(state.selection.$from.parentOffset){const last=before?.isText?Array.from(before.text).at(-1):'';view.dispatch(state.tr.delete(from-(last?.length||1),from).scrollIntoView());}else C.joinBackward(state,view.dispatch,view);view.focus();},
      destroy:()=>{if(destroyed)return;destroyed=true;floating?.destroy();view.destroy();live--;wrapper.remove();toolbar.remove();toggle.remove();},
      value:()=>source,
      get plain(){return plain;}
    };dom.imRich=controller;return controller;
  }
  return {create,stats:()=>({live})};
})();
