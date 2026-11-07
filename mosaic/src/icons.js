function mosaicIcon(name,selection=false) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:selection?'0 0 28 28':'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':selection?'1.8':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  svg.innerHTML=selection?imSelectionIcons[name]:imUiIcons[name]||imUiIcons.mosaic;
  return svg;
}

function mosaicToolbarIcon(name){
 const icon=imToolbarIcons[name],svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value] of Object.entries({class:'ui-toolbar-icon',width:icon.size,height:icon.size,viewBox:icon.viewBox,fill:'none',stroke:'currentColor','stroke-width':icon.stroke,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
 svg.innerHTML=icon.markup;return svg;
}
