/* React hosts the same native date picker used by Mosaic. */
function ImDatePicker({jump,close}){
 const root=dt.useRef(null),live=dt.useRef(null);live.current={jump,close};
 dt.useLayoutEffect(()=>{const panel=imCreateDateJumpPanel({onJump:v=>live.current.jump(v),onClose:()=>live.current.close()});root.current.replaceChildren(panel);panel.openPicker();return()=>panel.remove();},[]);
 return x.jsx('div',{ref:root});
}
function ImSearchRow({query,change,disabled,jumpToDate,dateOpen,setDateOpen}){
 return x.jsxs(x.Fragment,{children:[
  x.jsxs('div',{className:'ui-search-row',children:[x.jsx('input',{value:query,onChange:e=>change(e.target.value),placeholder:'Search this note','aria-label':'Search messages',disabled}),x.jsx('button',{type:'button',className:'ui-search-filters','aria-label':'Jump to date',title:'Jump to date','aria-expanded':dateOpen,'aria-controls':'date-picker',disabled,onClick:()=>setDateOpen(!dateOpen),children:x.jsx(ImToolbarIcon,{name:'calendarSearch'})})]}),
  dateOpen&&x.jsx(ImDatePicker,{jump:jumpToDate,close:()=>setDateOpen(false)})
 ]});
}
