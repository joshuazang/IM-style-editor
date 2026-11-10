/* Created after the React prefix; props are shared with Mosaic's DOM fields. */
const ImVisualField=dt.forwardRef((props,ref)=>{
  const host=dt.useRef(null),field=dt.useRef(null),latest=dt.useRef(props),pending=dt.useRef(new Set()),context=dt.useRef(null);latest.current=props;
  dt.useLayoutEffect(()=>{
    const control=imRichField.create({id:props.id,capture:true,
      onChange:value=>{pending.current.add(value);latest.current.onChange?.({target:control.dom});},
      onSubmit:()=>latest.current.onRichSubmit?.(),
      onKeyDown:event=>latest.current.onKeyDown?.(event),
      onResize:()=>latest.current.onRichResize?.()});
    field.current=control;host.current.append(control.wrapper);
    if(typeof ref==='function')ref(control.dom);else if(ref)ref.current=control.dom;
    return()=>{if(typeof ref==='function')ref(null);else if(ref)ref.current=null;field.current=null;control.destroy();};
  },[]);
  dt.useLayoutEffect(()=>{
    const control=field.current;if(!control)return;
    control.configure({disabled:props.disabled,label:props['aria-label'],placeholder:props.placeholder});
    const key=props.richContext||'',value=props.value||'';
    if(context.current!==key){context.current=key;pending.current.clear();control.setContext(key,value,!!props.richPlain);}
    else if(value===control.value()){pending.current.clear();}
    else if(!pending.current.has(value)){pending.current.clear();control.setContext(key,value,!!props.richPlain);}
    latest.current.onRichResize?.();
  });
  return x.jsx('div',{ref:host,className:'im-rich-react'});
});
const ImPrivateTextarea=dt.forwardRef((props,ref)=>props.id==='append-text'?x.jsx(ImVisualField,{...props,ref}):x.jsx('textarea',{...props,...imPrivateTextProps,ref}));
const ImPrivateInput=dt.forwardRef((props,ref)=>x.jsx('input',{...props,...imPrivateTextProps,ref}));
const ImMarkdownMessage=dt.memo(function({message,onCheck,selecting,noteId}){
  const node=dt.useRef(null),callback=dt.useRef(onCheck);callback.current=onCheck;
  dt.useLayoutEffect(()=>{imMarkdown.render(node.current,imMarkdown.message(message).doc,index=>callback.current?.(index));},[message.text,noteId]);
  return x.jsx('div',{ref:node,className:'message-body im-rich-display','data-selecting':selecting?'true':undefined});
});
