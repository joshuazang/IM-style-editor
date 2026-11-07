/* React hosts the same native date-filter panel used by Mosaic. */
function ImDateFilters({value,apply,close}){
 const root=dt.useRef(null),live=dt.useRef(null);live.current={apply,close};
 dt.useLayoutEffect(()=>{const panel=imCreateDateFilterPanel({value,onApply:v=>live.current.apply(v),onClose:()=>live.current.close()});root.current.replaceChildren(panel);return()=>panel.remove();},[]);
 return x.jsx('div',{ref:root});
}
function ImSearchRow({query,change,disabled,dateFilter,setDateFilter,dateOpen,setDateOpen}){
 const range=imDateRange(dateFilter);
 return x.jsxs(x.Fragment,{children:[
  x.jsxs('div',{className:'ui-search-row',children:[x.jsx('input',{value:query,onChange:e=>change(e.target.value),placeholder:'Search this note','aria-label':'Search messages',disabled}),x.jsx('button',{type:'button',className:'ui-search-filters','aria-label':'Date filters',title:'Date filters','aria-expanded':dateOpen,'aria-pressed':range.active,'aria-controls':'date-filters',onClick:()=>setDateOpen(!dateOpen),children:x.jsx(ImToolbarIcon,{name:'filters'})})]}),
  range.active&&x.jsxs('p',{className:'ui-date-summary',children:[x.jsx('span',{children:range.label}),x.jsx('button',{type:'button',className:'ui-date-clear','aria-label':'Clear date filter',title:'Clear date filter',onClick:()=>{setDateFilter({preset:'all'});setDateOpen(false);requestAnimationFrame(()=>document.querySelector('[aria-label="Search messages"]')?.focus({preventScroll:true}))},children:x.jsx(ImToolbarIcon,{name:'cancel'})})]}),
  dateOpen&&x.jsx(ImDateFilters,{value:dateFilter,apply:setDateFilter,close:()=>setDateOpen(false)})
 ]});
}
