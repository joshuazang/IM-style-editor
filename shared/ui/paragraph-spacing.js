/* One saved setting, preset list and control for both interfaces. */
const imParagraphSpacing=(()=>{
  const choices=[{id:'none',name:'None',em:0},{id:'small',name:'Small',em:.5},
    {id:'medium',name:'Medium',em:1},{id:'large',name:'Large',em:1.5}];
  const preset=settings=>choices.find(item=>item.id===settings?.paragraphSpacing)||choices[2];
  const value=settings=>preset(settings).id;
  const style=settings=>({'--paragraph-gap':preset(settings).em+'em'});
  function control(settings,onChange){
    const dom=document.createElement('label'),select=document.createElement('select');
    dom.className='im-paragraph-setting';dom.append('Paragraph spacing');select.setAttribute('aria-label','Paragraph spacing');
    for(const item of choices){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
    select.addEventListener('change',()=>onChange(select.value));dom.append(select);
    const update=(settings,disabled=false)=>{select.value=value(settings);select.disabled=disabled;};update(settings);
    return {dom,update};
  }
  return {choices,value,style,control};
})();
