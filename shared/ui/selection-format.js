/* One toolbar, shared between manual Aa use and selected editable text. */
function imSelectionFormatting({dom,toolbar,toggle,view,manual,canFormat}){
  const doc=dom.ownerDocument,win=doc.defaultView;let frame=0,floating=false,manualOpen=false,marker=null,dismissed='',destroyed=false,selecting=false;
  const phone=()=>/\b(?:iPhone|iPod)\b|Android.*Mobile/i.test(win.navigator.userAgent)||(win.matchMedia('(pointer:coarse) and (hover:none)').matches&&Math.min(win.screen.width,win.screen.height)<=600);
  const key=()=>`${view.state.selection.from}:${view.state.selection.to}`;
  function restore(){
    if(!floating)return;
    floating=false;toolbar.classList.remove('is-selection-format');toolbar.removeAttribute('style');
    if(marker?.parentNode)marker.replaceWith(toolbar);else toolbar.remove();marker=null;
  }
  function close(){restore();toolbar.hidden=!manualOpen;toggle.setAttribute('aria-expanded',String(manualOpen));}
  function render(){
    frame=0;if(destroyed)return;
    if(phone()){if(!canFormat()){manualOpen=false;}close();return;}
    const selection=doc.getSelection(),active=doc.activeElement;
    const inside=selection?.rangeCount&&dom.contains(selection.anchorNode)&&dom.contains(selection.focusNode);
    const selected=!view.state.selection.empty&&inside&&!selection.isCollapsed;
    if(!canFormat()||!dom.isConnected){manualOpen=false;close();return;}
    if(selecting||!selected||dismissed===key()||(!view.hasFocus()&&!toolbar.contains(active))){close();return;}
    let clip=dom.getBoundingClientRect();
    let left=clip.left,right=clip.right,top=clip.top,bottom=clip.bottom;
    for(let parent=dom.parentElement;parent&&parent!==doc.body;parent=parent.parentElement){
      const style=win.getComputedStyle(parent);
      if(/auto|scroll|hidden|clip/.test(style.overflowY+style.overflowX)){
        const rect=parent.getBoundingClientRect();left=Math.max(left,rect.left);right=Math.min(right,rect.right);top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);
      }
    }
    const vp=win.visualViewport,vLeft=vp?.offsetLeft||0,vTop=vp?.offsetTop||0,vWidth=vp?.width||win.innerWidth,vHeight=vp?.height||win.innerHeight;
    left=Math.max(left,vLeft);right=Math.min(right,vLeft+vWidth);top=Math.max(top,vTop);bottom=Math.min(bottom,vTop+vHeight);
    const range=selection.getRangeAt(0).getBoundingClientRect();
    if(!range.width||!range.height||range.right<=left||range.left>=right||range.bottom<=top||range.top>=bottom){close();return;}
    const anchor={left:Math.max(range.left,left),right:Math.min(range.right,right),top:Math.max(range.top,top),bottom:Math.min(range.bottom,bottom)};
    if(!floating){
      if(toolbar.parentNode){marker=doc.createComment('format toolbar');toolbar.before(marker);}
      (dom.closest('dialog')||doc.body).append(toolbar);floating=true;toolbar.classList.add('is-selection-format');
    }
    toolbar.hidden=false;
    Object.assign(toolbar.style,{position:'fixed',bottom:'auto',right:'auto',margin:'0',maxWidth:Math.max(0,vWidth-16)+'px',left:vLeft+8+'px',top:vTop+8+'px'});
    const box=toolbar.getBoundingClientRect(),x=Math.max(vLeft+8,Math.min((anchor.left+anchor.right-box.width)/2,vLeft+vWidth-box.width-8));
    const above=anchor.top-box.height-8,y=above>=vTop+8?above:Math.min(anchor.bottom+8,vTop+vHeight-box.height-8);
    toolbar.style.left=x+'px';toolbar.style.top=Math.max(vTop+8,y)+'px';toggle.setAttribute('aria-expanded','true');
  }
  function update(){
    if(destroyed||frame)return;
    if(view.state.selection.empty){dismissed='';if(!floating&&!manualOpen)return;}
    frame=win.requestAnimationFrame(render);
  }
  function dismiss(){if(toolbar.hidden)return false;dismissed=key();manualOpen=false;close();return true;}
  const outside=event=>{if(dom.contains(event.target)){dismissed='';selecting=true;update();return;}if(floating&&!dom.contains(event.target)&&!toolbar.contains(event.target)&&event.target!==toggle){dismissed=key();close();}};
  const selectionIntent=event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)||((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a')){dismissed='';update();}};
  const released=()=>{selecting=false;update();};
  const keys=event=>{
    if(event.key==='Escape'){if(dom.closest('dialog'))return;event.preventDefault();event.stopPropagation();dismiss();view.focus();}
    else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const buttons=[...toolbar.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length),index=buttons.indexOf(doc.activeElement);
      if(index<0)return;event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length]?.focus();
    }
  };
  doc.addEventListener('selectionchange',update);doc.addEventListener('scroll',update,{capture:true,passive:true});doc.addEventListener('pointerdown',outside,true);doc.addEventListener('pointerup',released,true);doc.addEventListener('pointercancel',released,true);win.addEventListener('resize',update);win.visualViewport?.addEventListener('resize',update);win.visualViewport?.addEventListener('scroll',update);dom.addEventListener('blur',update);dom.addEventListener('keydown',selectionIntent);toolbar.addEventListener('keydown',keys);
  return {
    update,dismiss,reset(){dismissed='';manualOpen=false;close();},
    toggle(){manualOpen=manual&&!manualOpen;dismissed=key();close();},
    focus(){if(toolbar.hidden)return false;toolbar.querySelector('button:not(:disabled)')?.focus();return true;},
    destroy(){destroyed=true;if(frame)win.cancelAnimationFrame(frame);doc.removeEventListener('selectionchange',update);doc.removeEventListener('scroll',update,true);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('pointerup',released,true);doc.removeEventListener('pointercancel',released,true);win.removeEventListener('resize',update);win.visualViewport?.removeEventListener('resize',update);win.visualViewport?.removeEventListener('scroll',update);dom.removeEventListener('blur',update);dom.removeEventListener('keydown',selectionIntent);toolbar.removeEventListener('keydown',keys);marker?.remove();toolbar.remove();}
  };
}
