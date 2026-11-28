"""Browser regression shared by the two bottom composers."""
from playwright.sync_api import expect
from browser_engine import fill_field

def check_chinese_capture(field, context, page):
 settle=lambda:field.evaluate('()=>new Promise(requestAnimationFrame)')
 cdp=context.new_cdp_session(page)
 insert=lambda text:cdp.send('Input.insertText',{'text':text})
 def compose(text):
  cdp.send('Input.imeSetComposition',{'text':text,'selectionStart':len(text),'selectionEnd':len(text)})
  settle()
 def glyph(offset):
  settle()
  return field.evaluate('''(n,i)=>{
   const p=[...n.querySelectorAll('p')].at(-1),walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
   for(let text=walker.nextNode();text;text=walker.nextNode()){
    if(i>=text.length){i-=text.length;continue;}
    const r=new Range();r.setStart(text,i);r.setEnd(text,i+1);
    const box=r.getBoundingClientRect();return [box.x,box.top-p.getBoundingClientRect().top,box.width];
   }
  }''',offset)
 fill_field(field,'字'*120)
 line_length=field.evaluate('''n=>{
  const line=n.querySelector('p').firstChild,r=new Range();r.setStart(line,0);r.setEnd(line,1);
  const top=r.getBoundingClientRect().top;
  for(let i=1;i<line.length;i++){
   r.setStart(line,i);r.setEnd(line,i+1);
   if(r.getBoundingClientRect().top!==top)return i;
  }
  return line.length;
 }''')
 seed='上一段保持原样\n\n'+'字'*(line_length*2)
 fill_field(field,seed);field.press('Control+End')
 offset=line_length*2-1
 before=glyph(offset)
 for _ in range(2):
  insert('。');assert glyph(offset)==before
  assert glyph(offset+1)[1]>before[1], 'The sentence-ending mark should wrap on its own'
  field.press('Backspace');assert glyph(offset)==before
 for pinyin in ['z','zhongwenshuruwenben'*4,'zhong']:
  compose(pinyin);assert glyph(offset)==before
 insert('中文');assert glyph(offset)==before
 expect(field).to_have_js_property('value',seed+'中文')
 field.press('Backspace');field.press('Backspace');assert glyph(offset)==before
 expect(field).to_have_js_property('value',seed)

 fill_field(field,'文字。');field.press('Control+End')
 mark=glyph(2);insert('，');assert glyph(2)==mark
 field.press('Backspace');assert glyph(2)==mark

 fill_field(field,'> 中文引用');field.press('Control+End')
 quote=field.locator('blockquote');width=quote.evaluate('n=>n.getBoundingClientRect().width')
 compose('zhongwenshuruwenben'*4);assert quote.evaluate('n=>n.getBoundingClientRect().width')==width
 insert('中文');insert('。');settle();assert quote.evaluate('n=>n.getBoundingClientRect().width')==width
 field.press('Backspace');assert quote.evaluate('n=>n.getBoundingClientRect().width')==width

 fill_field(field,'English words keep wrapping normally.');assert field.locator('[data-cjk-wrap]').count()==0
 fill_field(field,'字');field.press('Control+End')
 before=field.evaluate('n=>[n.getBoundingClientRect().x,n.clientWidth]')
 insert('字'*(line_length*16));settle()
 assert field.evaluate('n=>n.scrollHeight>n.clientHeight&&n.scrollLeft===0')
 assert field.evaluate('n=>[n.getBoundingClientRect().x,n.clientWidth]')==before
 fill_field(field,'')
 cdp.detach()
