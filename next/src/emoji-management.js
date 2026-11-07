function ImEmojiReplacement({from,to,count,change,save,cancel}){
 return x.jsxs('form',{className:'emoji-replacement',onSubmit:event=>{event.preventDefault();save()},children:[
  x.jsxs('label',{children:['Replace ',from,' with',x.jsx('input',{'aria-label':'Replacement emoji',value:to,maxLength:12,onChange:event=>change(event.target.value),onFocus:event=>event.currentTarget.select(),autoFocus:true})]}),
  x.jsx('p',{children:`Updates the tag on ${count} message${count===1?'':'s'} in this note. Message text and other tags stay unchanged.`}),
  x.jsxs('div',{children:[x.jsx('button',{type:'submit',disabled:!to.trim(),children:'Save emoji change'}),x.jsx('button',{type:'button',onClick:cancel,children:'Cancel emoji change'})]})
 ]});
}
