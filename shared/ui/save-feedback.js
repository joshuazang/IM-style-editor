/* Visual delay only. This controller never schedules or performs a save. */
class ImSaveFeedback {
 constructor(notify=()=>{},timers={setTimeout:(fn,delay)=>setTimeout(fn,delay),clearTimeout:id=>clearTimeout(id)}){this.notify=notify;this.timers=timers;this.key=null;this.pending=false;this.text='';this.timer=null;this.generation=0;}
 clear(){this.generation++;if(this.timer!==null)this.timers.clearTimeout(this.timer);this.timer=null;}
 later(delay,text){const generation=this.generation;this.timer=this.timers.setTimeout(()=>{if(generation!==this.generation)return;this.timer=null;this.text=text;this.notify(text);},delay);}
 update(key,pending,blocked=false){
  if(this.key!==key){this.clear();this.key=key;this.pending=false;this.text='';}
  if(blocked||!key){this.clear();this.pending=false;this.text='';return this.text;}
  pending=!!pending;if(pending===this.pending)return this.text;
  this.clear();this.pending=pending;
  if(pending){this.text='';this.later(300,'Saving…');}
  else if(this.text==='Saving…'){this.text='Saved';this.later(1000,'');}
  else this.text='';
  return this.text;
 }
 dispose(){this.clear();this.notify=()=>{};}
}
function ImSavingFeedback({noteId,pending,blocked}){
 const [text,setText]=dt.useState(''),controller=dt.useRef(null);
 if(!controller.current)controller.current=new ImSaveFeedback(setText);
 dt.useLayoutEffect(()=>setText(controller.current.update(noteId,pending,blocked)),[noteId,pending,blocked]);
 dt.useEffect(()=>()=>controller.current.dispose(),[]);
 return x.jsx('span',{className:'ui-save-feedback',role:'status','aria-live':'polite',hidden:!text,title:text==='Saved'?'Accepted by Standard Notes':undefined,children:text});
}
function ImComposerSurface({composerRef,noteId,pending,blocked,children,...props}){
 return x.jsxs('section',{...props,ref:composerRef,children:[children,x.jsx(ImSavingFeedback,{noteId,pending,blocked})]});
}
