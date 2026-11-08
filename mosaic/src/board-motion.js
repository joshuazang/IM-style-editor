/* Board-only movement. No note text or ordering is persisted by this module. */
class MosaicBoardMotion {
  constructor(board,viewport) {
    this.board=board;this.viewport=viewport;this.entering=new Set();this.animations=new WeakMap();
    this.preference=matchMedia('(prefers-reduced-motion: reduce)');
  }
  snapshot(nodes) {
    const result=new Map();
    if(this.preference.matches)return result;
    for(const [id,node] of nodes)result.set(id,node.getBoundingClientRect());
    for(const node of nodes.values())this.animations.get(node)?.cancel();
    return result;
  }
  queue(ids) {for(const id of ids)this.entering.add(id);while(this.entering.size>100)this.entering.delete(this.entering.values().next().value);}
  reset() {this.entering.clear();}
  play(node,frames,duration) {
    this.animations.get(node)?.cancel();
    const animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
    this.animations.set(node,animation);
    const cleanup=()=>{if(this.animations.get(node)===animation)this.animations.delete(node);};
    animation.onfinish=cleanup;animation.oncancel=cleanup;
  }
  move(before,nodes) {
    if(this.preference.matches)return;
    const moves=[];
    for(const [id,node] of nodes){
      const previous=before.get(id);if(!previous||this.entering.has(id))continue;
      const next=node.getBoundingClientRect(),dx=previous.left-next.left,dy=previous.top-next.top;
      if(Math.abs(dx)+Math.abs(dy)>1)moves.push({node,dx,dy,transform:node.style.transform});
    }
    for(const {node,dx,dy,transform} of moves)this.play(node,[
      {transform:`${transform} translate(${dx}px,${dy}px)`},{transform}
    ],260);
  }
  reveal(nodes) {
    if(!this.entering.size)return;
    if(this.preference.matches){this.entering.clear();return;}
    const bounds=this.viewport.getBoundingClientRect();
    for(const [id,node] of nodes){
      if(!this.entering.has(id))continue;
      const rect=node.getBoundingClientRect();if(rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue;
      this.entering.delete(id);const transform=node.style.transform;
      this.play(node,[{opacity:0,transform:`${transform} translateY(12px) scale(.94)`},{opacity:1,transform}],240);
    }
  }
}

class MosaicBoardDrag {
  constructor(options) {
    Object.assign(this,options);this.gesture=null;this.settlingId=null;this.suppressUntil=0;this.frame=0;
    this.board.addEventListener('pointerdown',event=>this.down(event));
    document.addEventListener('pointerdown',event=>{
      if(this.gesture&&event.pointerId!==this.gesture.pointerId)this.cancel();
      else if(!this.gesture)this.suppressUntil=0;
    },true);
    document.addEventListener('pointermove',event=>this.move(event),true);
    document.addEventListener('pointerup',event=>this.up(event),true);
    document.addEventListener('pointercancel',event=>{if(this.gesture?.pointerId===event.pointerId)this.cancel();},true);
    this.board.addEventListener('lostpointercapture',event=>{if(event.target===this.board&&this.gesture?.pointerId===event.pointerId)this.cancel();});
    // Cancel native scrolling only after a stationary hold, before its first
    // movement. A normal swipe never enters this branch. Touch-action alone
    // cannot be changed retrospectively for an existing iOS touch gesture.
    document.addEventListener('touchmove',event=>{
      if(this.gesture?.ready&&this.canStart(this.gesture.node)&&event.cancelable)event.preventDefault();
    },{passive:false});
    document.addEventListener('click',event=>{
      if(performance.now()<this.suppressUntil&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&this.gesture){event.preventDefault();event.stopImmediatePropagation();this.cancel();}
    },true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset();});
    window.addEventListener('blur',()=>this.reset());
    window.addEventListener('resize',()=>this.reset());
  }
  get dragging() {return !!this.gesture?.dragging;}
  placeholder(id) {return this.gesture?.dragging&&this.gesture.id===id||this.settlingId===id;}
  down(event) {
    if(event.button!==0||event.isPrimary===false||event.target.closest('button,input,textarea,select,a'))return;
    const node=event.target.closest('.card');if(!node||!this.canStart(node)||this.gesture||this.settlingId)return;
    const g={id:node.dataset.id,node,pointerId:event.pointerId,touch:event.pointerType==='touch',
      startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,
      startScroll:this.viewport.scrollTop,ready:event.pointerType!=='touch',dragging:false,lastX:event.clientX,lastY:event.clientY};
    this.gesture=g;
    if(g.touch)g.timer=setTimeout(()=>{
      if(this.gesture===g&&this.canStart(node)&&Math.abs(this.viewport.scrollTop-g.startScroll)<2)g.ready=true;
    },520);
  }
  move(event) {
    const g=this.gesture;if(!g||g.pointerId!==event.pointerId)return;
    g.x=event.clientX;g.y=event.clientY;
    const distance=Math.hypot(g.x-g.startX,g.y-g.startY);
    if(!g.ready){if(distance>10)this.cancel();return;}
    if(!g.dragging&&distance>(g.touch?10:6)){
      if(!this.canStart(g.node)||!this.onStart(g.id)){this.cancel();return;}
      clearTimeout(g.timer);g.dragging=true;this.onClearCapture();
      const rect=g.node.getBoundingClientRect();g.left=rect.left;g.top=rect.top;g.width=rect.width;g.height=rect.height;
      const ghost=g.node.cloneNode(true);ghost.classList.add('board-drag-ghost');ghost.classList.remove('located','selected');
      ghost.removeAttribute('id');ghost.removeAttribute('data-id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
      Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',transform:'scale(1.02)'});
      document.body.append(ghost);g.ghost=ghost;
      this.board.classList.add('is-dragging');g.node.classList.add('is-drag-placeholder');
      try{this.board.setPointerCapture(g.pointerId);}catch{}
      this.tick();
    }
    if(g.dragging&&event.cancelable)event.preventDefault();
  }
  tick() {
    const g=this.gesture;if(!g?.dragging)return;
    if(!this.canContinue()){this.cancel();return;}
    g.ghost.style.transform=`translate3d(${g.x-g.startX}px,${g.y-g.startY}px,0) scale(1.02)`;
    const bounds=this.getBounds(),edge=54;
    let velocity=g.y<bounds.top+edge?-Math.min(16,(bounds.top+edge-g.y)*.24):g.y>bounds.bottom-edge?Math.min(16,(g.y-bounds.bottom+edge)*.24):0;
    const scroll=this.viewport.scrollTop;if(velocity)this.viewport.scrollTop+=velocity;
    const scrolled=this.viewport.scrollTop!==scroll;
    if(scrolled||Math.hypot(g.x-g.lastX,g.y-g.lastY)>8){
      g.lastX=g.x;g.lastY=g.y;this.findTarget(g);
    }
    this.frame=requestAnimationFrame(()=>this.tick());
  }
  findTarget(g) {
    const layout=this.getLayout(),origin=this.board.getBoundingClientRect(),x=g.x-origin.left,y=g.y-origin.top;
    const source=layout.byId.get(g.id);if(!source)return;
    if(x>=source.x&&x<=source.x+source.width&&y>=source.y&&y<=source.y+source.height)return;
    let target=null,best=Infinity;
    // Layout geometry is stable even while neighbors are visually animating.
    for(const item of this.candidates(y)){
      if(item.message.id===g.id||!this.sameSection(g.id,item.message.id))continue;
      const dx=Math.max(item.x-x,0,x-item.x-item.width),dy=Math.max(item.y-y,0,y-item.y-item.height);
      const score=dx*dx+dy*dy+Math.abs(x-item.x-item.width/2)*.02+Math.abs(y-item.y-item.height/2)*.01;
      if(score<best){best=score;target=item;}
    }
    if(!target)return;
    const after=y>target.y+target.height/2;
    const key=target.message.id+':'+after;if(key===g.lastTarget)return;g.lastTarget=key;
    this.onPreview(g.id,target.message.id,after);
  }
  clearGesture() {
    const g=this.gesture;if(!g)return null;
    clearTimeout(g.timer);cancelAnimationFrame(this.frame);this.frame=0;this.gesture=null;
    try{if(this.board.hasPointerCapture(g.pointerId))this.board.releasePointerCapture(g.pointerId);}catch{}
    this.board.classList.remove('is-dragging');
    return g;
  }
  up(event) {
    const g=this.gesture;if(!g||g.pointerId!==event.pointerId)return;
    if(!g.dragging){this.clearGesture();return;}
    if(!this.canContinue()){this.cancel();return;}
    g.x=event.clientX;g.y=event.clientY;
    if(Math.hypot(g.x-g.lastX,g.y-g.lastY)>2)this.findTarget(g);
    this.clearGesture();this.suppressUntil=performance.now()+700;this.settlingId=g.id;this.settlingGhost=g.ghost;
    this.onDrop(g.id);
    const slot=this.getSlot(g.id);
    const finish=()=>{g.ghost.remove();if(this.settlingGhost===g.ghost){this.settlingId=null;this.settlingGhost=null;this.settleAnimation=null;}this.onSettled();};
    if(!slot||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    const animation=this.settleAnimation=g.ghost.animate([
      {transform:g.ghost.style.transform,opacity:1},
      {transform:`translate3d(${slot.left-g.left}px,${slot.top-g.top}px,0) scale(1)`,opacity:1}
    ],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
    animation.onfinish=finish;animation.oncancel=finish;
  }
  cancel(redraw=true) {
    const g=this.clearGesture();if(!g)return;
    if(g.dragging){g.ghost?.remove();this.suppressUntil=performance.now()+700;this.onCancel(redraw);}
  }
  reset() {
    this.cancel();this.settleAnimation?.cancel();this.settlingGhost?.remove();this.settlingId=null;this.settlingGhost=null;
  }
}
