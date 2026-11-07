/* Current-note tag commands. Records stay immutable and message text is untouched. */
const imUntagged='__im_untagged__';
const imDefaultEmojis=['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'];
function imFilterOrder(tags,position){const order=tags.filter(tag=>tag!==imUntagged);const index=Number.isInteger(position)?Math.max(0,Math.min(position,order.length)):order.length;return [...order.slice(0,index),imUntagged,...order.slice(index)];}
function imEmojiOrder(messages,settings,used){
 const removed=new Set(settings.deletedEmojis||[]);
 return [...new Set([...(settings.reactionOrder||imDefaultEmojis),...(used||messages.flatMap(m=>m.reactions))])].filter(tag=>!removed.has(tag));
}
function imEmojiValue(value){
 if(typeof value!=='string'||!value.trim()||[imUntagged,'__untagged__'].includes(value.trim()))throw new Error('Choose an emoji tag');
 return value.trim();
}
function imEmojiAdd(messages,settings,value){
 const tag=imEmojiValue(value),order=imEmojiOrder(messages,settings),next={...settings,reactionOrder:[tag,...order.filter(t=>t!==tag)],deletedEmojis:(settings.deletedEmojis||[]).filter(t=>t!==tag)};
 if(Number.isInteger(settings.untaggedPosition))next.untaggedPosition=[tag,...imFilterOrder(order,settings.untaggedPosition).filter(t=>t!==tag)].indexOf(imUntagged);
 return next;
}
function imEmojiMove(messages,settings,tag,direction){
 const displayed=imFilterOrder(imEmojiOrder(messages,settings),settings.untaggedPosition),index=displayed.indexOf(tag),next=index+direction;
 if(![-1,1].includes(direction)||index<0||next<0||next>=displayed.length)return settings;
 [displayed[index],displayed[next]]=[displayed[next],displayed[index]];
 return {...settings,reactionOrder:displayed.filter(t=>t!==imUntagged),untaggedPosition:displayed.indexOf(imUntagged)};
}
function imEmojiChange(messages,settings,from,to=null){
 from=imEmojiValue(from);if(to!==null)to=imEmojiValue(to);
 if(from===to)return {messages,settings};
 const nextMessages=messages.map(message=>{
  if(!message.reactions.includes(from))return message;
  let seen=false;
  const reactions=message.reactions.flatMap(tag=>tag===from?(to===null?[]:[to]):[tag]).filter(tag=>{if(tag!==to)return true;if(seen)return false;seen=true;return true});
  return {...message,reactions};
 });
 const order=imEmojiOrder(messages,settings),targetExists=to!==null&&order.includes(to);
 const nextOrder=order.flatMap(tag=>tag===from?(to===null||targetExists?[]:[to]):[tag]);
 if(to!==null&&!nextOrder.includes(to))nextOrder.push(to);
 const nextSettings={...settings,reactionOrder:nextOrder,deletedEmojis:[...new Set([...(settings.deletedEmojis||[]).filter(tag=>tag!==to),from])]};
 if(Number.isInteger(settings.untaggedPosition)){
  const displayed=imFilterOrder(order,settings.untaggedPosition);
  nextSettings.untaggedPosition=displayed.flatMap(tag=>tag===from?(to===null||targetExists?[]:[to]):[tag]).indexOf(imUntagged);
 }
 return {messages:nextMessages,settings:nextSettings};
}
