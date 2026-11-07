/* Bind a touch to its original row. Scrolling and compatibility clicks cannot
 * toggle another message. Pointer state is transient and never persisted. */
function ImSelectionRow({id,selecting,toggle,scroller,className,style,children}){
 const gesture=dt.useRef(null);
 const mark=()=>{if(scroller.current)scroller.current.imSelectionTouchUntil=performance.now()+700;};
 const cancel=()=>{if(gesture.current)mark();gesture.current=null;};
 const blockedClick=event=>event.detail!==0&&(event.nativeEvent.pointerType==='touch'||(!event.nativeEvent.pointerType&&performance.now()<(scroller.current?.imSelectionTouchUntil||0)));
 return x.jsx('div',{'data-selection-row':id,className:className+(selecting?' selection-touch-row':''),style,
  onPointerDownCapture:event=>{
   if(!selecting||event.pointerType!=='touch')return;
   if(event.isPrimary===false){cancel();return;}
   mark();gesture.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,top:scroller.current?.scrollTop||0};
  },
  onPointerMoveCapture:event=>{const g=gesture.current;if(g&&event.pointerId===g.pointer&&Math.hypot(event.clientX-g.x,event.clientY-g.y)>10)cancel();},
  onPointerCancelCapture:cancel,
  onPointerUpCapture:event=>{
   if(!selecting||event.pointerType!=='touch')return;
   const g=gesture.current;gesture.current=null;mark();event.preventDefault();event.stopPropagation();
   if(!g||event.pointerId!==g.pointer||Math.hypot(event.clientX-g.x,event.clientY-g.y)>10||Math.abs((scroller.current?.scrollTop||0)-g.top)>2)return;
   const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-selection-row]');
   if(hit?.dataset.selectionRow===id)toggle(id);
  },
  onClickCapture:event=>{
   if(!selecting)return;
   event.preventDefault();event.stopPropagation();if(!blockedClick(event))toggle(id);
  },children});
}
