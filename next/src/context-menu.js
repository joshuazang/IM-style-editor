function ImToolbarIcon({name}){
 const icon=imToolbarIcons[name];
 return x.jsx('svg',{className:'ui-toolbar-icon',width:icon.size,height:icon.size,viewBox:icon.viewBox,fill:'none',stroke:'currentColor',strokeWidth:icon.stroke,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',dangerouslySetInnerHTML:{__html:icon.markup}});
}
/* Shared static vectors; note text never becomes SVG markup. */
function ImUiIcon({name}) {
  const markup=Object.hasOwn(imUiIcons,name)?imUiIcons[name]:imUiIcons.mosaic;
  return x.jsx('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',dangerouslySetInnerHTML:{__html:markup}});
}
function ImMessageActions({message,tags,actions,onToggle}) {
  if(!message)return null;
  return x.jsxs(x.Fragment,{children:[
    x.jsx('section',{className:'ui-tag-panel','aria-label':'Emoji picker',children:
      x.jsx('div',{className:'ui-tag-grid',role:'group','aria-label':'Emoji picker',children:tags.map(tag=>x.jsx('button',{type:'button',className:'ui-tag-choice','aria-label':'Tag '+tag,'aria-pressed':message.reactions.includes(tag),onClick:()=>onToggle(tag),children:tag},tag))})
    }),
    x.jsx('div',{className:'ui-action-panel',children:actions.map((action,index)=>action?x.jsxs('button',{type:'button',role:'menuitem',className:action[3]?'danger':undefined,onClick:action[2],children:[x.jsx(ImUiIcon,{name:action[1]}),x.jsx('span',{children:action[0]})]},action[0]):x.jsx('hr',{},'separator-'+index))})
  ]});
}
