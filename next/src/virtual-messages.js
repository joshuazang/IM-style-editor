/* Draw a measured window of immutable message records. All records stay in the note. */
function ImVirtualMessages({messages,scroller,render,revision,scale=1,selecting=false}) {
  const indexAt=(offsets,y)=>{
    let low=0,high=offsets.length-1;
    while(low<high){const middle=(low+high+1)>>1;if(offsets[middle]<=y)low=middle;else high=middle-1;}
    return Math.min(low,Math.max(0,offsets.length-2));
  };
  const measurements=dt.useRef(new Map()),modelRef=dt.useRef(null),anchor=dt.useRef(null);
  const capture=(current,node,bottom,appended=false)=>{
    const top=parseFloat(getComputedStyle(node).paddingTop)||0;
    const visible=indexAt(current.offsets,Math.max(0,node.scrollTop-top));
    return {id:current.messages[visible]?.id,offset:node.scrollTop-top-current.offsets[visible],bottom,appended};
  };
  const frame=dt.useRef(0),observer=dt.useRef(null),renderRef=dt.useRef(render);
  renderRef.current=render;
  const [view,setView]=dt.useState({top:0,height:800,width:390}),[measured,setMeasured]=dt.useState(0);
  const layout=`${view.width}:${scale}`;
  const model=dt.useMemo(()=>{
    const offsets=[0],indices=new Map();
    const chars=Math.max(12,Math.floor((view.width*.82-32)/(8.5*scale)));
    messages.forEach((message,index)=>{
      indices.set(message.id,index);
      const saved=measurements.current.get(message.id),previous=messages[index-1];
      let height;
      if(saved?.message===message && saved.previous===previous && saved.layout===layout)height=saved.height;
      else {
        const lines=message.text.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/chars)),0);
        const day=!previous||Ed(previous.createdAt)!==Ed(message.createdAt);
        height=Math.max(44,lines*23*scale+28+(message.reactions.length?18:0)+(message.replyTo?55:0)+(message.forwarding?18:0)+(day?(previous?66:49):0));
      }
      offsets.push(offsets[index]+height);
    });
    if(modelRef.current?.messages!==messages)for(const [id,saved] of measurements.current){
      const index=indices.get(id);
      if(index===undefined||saved.message!==messages[index]||saved.previous!==messages[index-1])measurements.current.delete(id);
    }
    return {messages,offsets,indices,layout};
  },[messages,layout,measured]);
  const previousModel=modelRef.current,node=scroller.current;
  if(previousModel && previousModel!==model && node && !anchor.current){
    const appended=messages.length>previousModel.messages.length&&previousModel.messages.every((message,index)=>message.id===messages[index].id);
    anchor.current=capture(previousModel,node,node.imScroll?.following||node.scrollHeight-node.clientHeight-node.scrollTop<=imBottomThreshold(node),appended);
  }
  modelRef.current=model;
  const list=scroller.current,padding=list?parseFloat(getComputedStyle(list).paddingTop)||0:0;
  const start=indexAt(model.offsets,Math.max(0,view.top-padding-view.height));
  const end=Math.min(messages.length,indexAt(model.offsets,view.top-padding+view.height*2)+1);
  const update=()=>{
    const node=scroller.current;if(!node)return;
    const next={top:node.scrollTop,height:node.clientHeight,width:node.clientWidth};
    setView(old=>old.top===next.top&&old.height===next.height&&old.width===next.width?old:next);
  };
  const measure=entries=>{
    const node=scroller.current,current=modelRef.current;if(!node||!current)return;
    let changed=false;
    for(const entry of entries){
      const id=entry.target.dataset.virtualMessage,index=current.indices.get(id);
      if(index===undefined)continue;
      const height=entry.borderBoxSize?.[0]?.blockSize??entry.target.getBoundingClientRect().height;
      const saved=measurements.current.get(id);
      if(height>0 && (!saved||Math.abs(saved.height-height)>.5||saved.message!==current.messages[index]||saved.previous!==current.messages[index-1]||saved.layout!==current.layout)){
        if(!anchor.current){
          anchor.current=capture(current,node,node.imScroll?.following||node.scrollHeight-node.clientHeight-node.scrollTop<=imBottomThreshold(node));
        }
        measurements.current.set(id,{message:current.messages[index],previous:current.messages[index-1],layout:current.layout,height});changed=true;
      }
    }
    if(changed)setMeasured(value=>value+1);
  };
  dt.useLayoutEffect(()=>{
    const node=scroller.current;if(!node)return;
    const schedule=()=>{cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(update)};
    const sizes=new ResizeObserver(schedule);sizes.observe(node);
    observer.current=new ResizeObserver(measure);
    node.querySelectorAll('[data-virtual-message]').forEach(row=>observer.current.observe(row));
    node.addEventListener('scroll',schedule,{passive:true});update();
    return()=>{cancelAnimationFrame(frame.current);sizes.disconnect();observer.current.disconnect();node.removeEventListener('scroll',schedule);delete node.imVirtual;};
  },[]);
  dt.useLayoutEffect(()=>{
    const node=scroller.current;if(!node)return;
    const saved=anchor.current;anchor.current=null;
    if(saved){
      // Assigning an unchanged scrollTop can interrupt native iOS momentum.
      // Keep measured anchoring, but only reposition when it actually moves.
      const position=top=>{const bounded=Math.max(0,Math.min(top,node.scrollHeight-node.clientHeight));if(Math.abs(node.scrollTop-bounded)>.5)node.scrollTop=bounded;};
      if(saved.bottom){
        if(!node.imScroll?.following){if(saved.appended&&node.imScroll)node.imScroll.follow();else position(node.scrollHeight);}
      }
      else if(model.indices.has(saved.id))position((parseFloat(getComputedStyle(node).paddingTop)||0)+model.offsets[model.indices.get(saved.id)]+saved.offset);
    }
    node.imVirtual={
      has:id=>modelRef.current.indices.has(id),
      releaseFollow:()=>{
        if(!anchor.current?.bottom)return;
        anchor.current=capture(modelRef.current,node,false);
      },
      reveal:(id,ready)=>{
        const current=modelRef.current,index=current.indices.get(id);if(index===undefined)return false;
        // An explicit jump supersedes a pending measurement anchor.
        anchor.current=null;
        node.imScroll?.cancel();
        const top=parseFloat(getComputedStyle(node).paddingTop)||0;
        node.scrollTop=Math.max(0,top+current.offsets[index]-node.clientHeight/2+(current.offsets[index+1]-current.offsets[index])/2);
        update();
        let attempts=0;
        const locate=()=>{
          if(!node.isConnected)return;
          if([...node.querySelectorAll('[data-message-id]')].some(row=>row.dataset.messageId===id))ready();
          else if(++attempts<10)requestAnimationFrame(locate);
        };
        requestAnimationFrame(()=>requestAnimationFrame(locate));return true;
      }
    };
    update();
  },[model]);
  dt.useLayoutEffect(()=>{
    const active=observer.current;if(!active)return;
    active.disconnect();scroller.current?.querySelectorAll('[data-virtual-message]').forEach(row=>active.observe(row));
  },[start,end,revision,messages]);
  const rows=dt.useMemo(()=>messages.slice(start,end).map((message,offset)=>
    x.jsx('div',{className:'virtual-message', 'data-virtual-message':message.id,children:renderRef.current(message,start+offset)},message.id)
  ),[messages,start,end,revision]);
  return x.jsxs(x.Fragment,{children:[
    x.jsx('div',{'aria-hidden':true,className:'virtual-spacer',style:{height:model.offsets[start]}}),
    ...rows,
    x.jsx('div',{'aria-hidden':true,className:'virtual-spacer',style:{height:model.offsets[messages.length]-model.offsets[end]}})
  ]});
}
