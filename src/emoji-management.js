/* Category-wide changes touch reactions and menu preferences only. */
function imEmojiChange(messages,settings,from,to=null){
 if(typeof from!=='string'||!from||from===imUntagged)throw new Error('Choose an emoji category');
 if(to!==null&&(typeof to!=='string'||!to.trim()||to.trim()===imUntagged))throw new Error('Choose a replacement emoji');
 if(to!==null)to=to.trim();
 if(from===to)return {messages,settings};
 const nextMessages=messages.map(message=>{
  if(!message.reactions.includes(from))return message;
  let seen=false;
  const reactions=message.reactions.flatMap(tag=>tag===from?(to===null?[]:[to]):[tag]).filter(tag=>{if(tag!==to)return true;if(seen)return false;seen=true;return true});
  return {...message,reactions};
 });
 const order=settings.reactionOrder||[],targetExists=to!==null&&order.includes(to);
 const nextOrder=order.flatMap(tag=>tag===from?(to===null||targetExists?[]:[to]):[tag]);
 if(to!==null&&!nextOrder.includes(to))nextOrder.push(to);
 const nextSettings={...settings,reactionOrder:nextOrder,deletedEmojis:[...new Set([...(settings.deletedEmojis||[]).filter(tag=>tag!==to),from])]};
 if(Number.isInteger(settings.untaggedPosition)){
  const oldVisible=order.filter(tag=>!(settings.deletedEmojis||[]).includes(tag));
  const displayed=imFilterOrder(oldVisible,settings.untaggedPosition);
  const nextDisplayed=displayed.flatMap(tag=>tag===from?(to===null||targetExists?[]:[to]):[tag]);
  nextSettings.untaggedPosition=nextDisplayed.indexOf(imUntagged);
 }
 return {messages:nextMessages,settings:nextSettings};
}
function ImEmojiReplacement({from,to,count,change,save,cancel}){
 return x.jsxs('form',{className:'emoji-replacement',onSubmit:event=>{event.preventDefault();save()},children:[
  x.jsxs('label',{children:['Replace ',from,' with',x.jsx('input',{'aria-label':'Replacement emoji',value:to,maxLength:12,onChange:event=>change(event.target.value),onFocus:event=>event.currentTarget.select(),autoFocus:true})]}),
  x.jsx('p',{children:`Updates the tag on ${count} message${count===1?'':'s'} in this note. Message text and other tags stay unchanged.`}),
  x.jsxs('div',{children:[x.jsx('button',{type:'submit',disabled:!to.trim(),children:'Save emoji change'}),x.jsx('button',{type:'button',onClick:cancel,children:'Cancel emoji change'})]})
 ]});
}
