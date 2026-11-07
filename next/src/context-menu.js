/* Shared static vectors; note text never becomes SVG markup. */
function ImUiIcon({name}) {
  const markup=Object.hasOwn(imUiIcons,name)?imUiIcons[name]:imUiIcons.mosaic;
  return x.jsx('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',dangerouslySetInnerHTML:{__html:markup}});
}
function ImMessageActions({message,tags,actions,onToggle,onAdd}) {
  const [adding,setAdding]=dt.useState(false),[label,setLabel]=dt.useState(''),input=dt.useRef(null);
  dt.useEffect(()=>{if(adding)input.current?.focus()},[adding]);
  if(!message)return null;
  return x.jsxs(x.Fragment,{children:[
    x.jsxs('section',{className:'ui-tag-panel','aria-label':'Message tags',children:[
      adding?x.jsxs('form',{className:'ui-label-form',onSubmit:event=>{event.preventDefault();if(label.trim())onAdd(label.trim())},onKeyDown:event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();setAdding(false)}},children:[
        x.jsx('input',{ref:input,value:label,maxLength:32,placeholder:'New label or emoji','aria-label':'New label',onChange:event=>setLabel(event.target.value)}),
        x.jsxs('div',{children:[x.jsx('button',{type:'button',onClick:()=>setAdding(false),children:'Cancel'}),x.jsx('button',{type:'submit',children:'Add label'})]})
      ]}):x.jsxs(x.Fragment,{children:[
        x.jsx('div',{className:'ui-tag-grid',role:'group','aria-label':'Tags',children:tags.map(tag=>x.jsx('button',{type:'button',className:'ui-tag-choice','aria-label':'Tag '+tag,'aria-pressed':message.reactions.includes(tag),onClick:()=>onToggle(tag),children:tag},tag))}),
        x.jsxs('button',{type:'button',className:'ui-tag-add',onClick:()=>setAdding(true),children:[x.jsx(ImUiIcon,{name:'plus'}),x.jsx('span',{children:'Add label'})]})
      ]})
    ]}),
    x.jsx('div',{className:'ui-action-panel',children:actions.map((action,index)=>action?x.jsxs('button',{type:'button',role:'menuitem',className:action[3]?'danger':undefined,onClick:action[2],children:[x.jsx(ImUiIcon,{name:action[1]}),x.jsx('span',{children:action[0]})]},action[0]):x.jsx('hr',{},'separator-'+index))})
  ]});
}
