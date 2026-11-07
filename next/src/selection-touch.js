/* One validated click per touch, shared by the mounted rows of this scroller.
 * Native touch clicks can be retargeted or have detail=0 in WebViews. Keep the
 * original hit-tested row until the click, rather than changing layout at up.
 * Gesture state is transient RAM only; keyboard and real mouse input reset it. */
function ImSelectionRow({id,selecting,toggle,scroller,className,style,children}){
 const hit=event=>{
  const row=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-selection-row]');
  return row&&scroller.current?.contains(row)?row:null;
 };
 const cancel=()=>{
  const state=scroller.current?.imSelectionTouch;
  if(state){state.until=performance.now()+800;if(state.gesture){state.gesture.cancelled=true;state.gesture.row=null;}}
 };
 const reset=()=>{if(scroller.current)delete scroller.current.imSelectionTouch;};
 return x.jsx('div',{'data-selection-row':id,className:className+(selecting?' selection-touch-row':''),style,
  onPointerDownCapture:event=>{
   if(event.pointerType==='mouse'){reset();return;}
   if(event.pointerType!=='touch')return;
   if(!selecting){reset();return;}
   if(event.isPrimary===false){cancel();return;}
   const row=hit(event),list=scroller.current;if(!list)return;
   list.imSelectionTouch={until:performance.now()+800,gesture:{pointer:event.pointerId,id:row?.dataset.selectionRow,row,x:event.clientX,y:event.clientY,top:list.scrollTop,phase:'down',cancelled:!row}};
  },
  onPointerMoveCapture:event=>{const g=scroller.current?.imSelectionTouch?.gesture;if(g&&event.pointerId===g.pointer&&Math.hypot(event.clientX-g.x,event.clientY-g.y)>10)cancel();},
  onPointerCancelCapture:cancel,
  onLostPointerCapture:event=>{if(scroller.current?.imSelectionTouch?.gesture?.phase==='down')cancel();},
  onPointerUpCapture:event=>{
   const list=scroller.current,state=list?.imSelectionTouch,g=state?.gesture;
   if(event.pointerType!=='touch'||!g||event.pointerId!==g.pointer)return;
   g.phase='up';g.ended=performance.now();state.until=g.ended+800;
   g.valid=!g.cancelled&&g.row?.isConnected&&hit(event)?.dataset.selectionRow===g.id&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<=10&&Math.abs(list.scrollTop-g.top)<=2;
   if(!g.valid)g.row=null;
   // Let the browser produce its normal click. The capture handler below is
   // the only selection action, so there is no release/click double toggle.
  },
  onKeyDownCapture:event=>{if(event.key==='Enter'||event.key===' ')reset();},
  onClickCapture:event=>{
   const list=scroller.current,state=list?.imSelectionTouch,g=state?.gesture,native=event.nativeEvent;
   const touch=native.pointerType==='touch'||native.sourceCapabilities?.firesTouchEvents,recent=state&&performance.now()<state.until;
   if(touch||recent){
    if(!selecting&&!recent)return;
    event.preventDefault();event.stopPropagation();
    if(selecting&&g?.phase==='up'&&g.valid&&!g.consumed&&g.row?.isConnected&&list.contains(g.row)&&performance.now()-g.ended<800&&Math.abs(list.scrollTop-g.top)<=2){g.consumed=true;g.row=null;toggle(g.id);}
    return;
   }
   if(!selecting)return;
   event.preventDefault();event.stopPropagation();toggle(id);
  },children});
}
