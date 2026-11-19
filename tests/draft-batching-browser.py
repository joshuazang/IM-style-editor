"""Actual IM/Mosaic typing batches complete-note saves without delaying Send."""
from pathlib import Path
from browser_engine import fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')};exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope);globals().update(scope)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for path,label in [('/next/index.html','Message'),('/mosaic/index.html','Take a note')]:
   page=browser.new_page(viewport={'width':1100,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a",path,false)}',[data['note'],path]);e=page.frame_locator('#editor');field=e.get_by_role('textbox',name=label,exact=True);expect(field).to_be_editable();field.click();page.evaluate('saves=[]');field.type('Regular typing here.',delay=250)
   assert page.evaluate('saves.length')==0,'Ordinary typing must not upload every keystroke'
   page.wait_for_function('saves.length===1');assert scope['parse'](page.evaluate('notes.a.content.text'))['draft']=='Regular typing here.'
   field.type(' More');field.press('Enter');page.wait_for_function('saves.length===2');saved=scope['parse'](page.evaluate('notes.a.content.text'));assert saved['messages'][-1]['text']=='Regular typing here. More' and saved['draft']=='';page.wait_for_timeout(1400);assert page.evaluate('saves.length')==2,'Send must replace an unsent draft checkpoint'
   field.type('Switch-safe draft');page.evaluate('switchNote("b")');page.wait_for_function('saves.some(s=>s.uuid==="a"&&s.content.text.includes("Switch-safe draft"))');assert scope['parse'](page.evaluate('notes.a.content.text'))['draft']=='Switch-safe draft'

   # A large structured draft exercises the shared list writer and live Send
   # validation. Leave before the idle save, reopen, and send that exact draft.
   page.evaluate('switchNote("a")');expect(field).to_have_js_property('value','Switch-safe draft')
   tasks='\n'.join(f'- [ ] Task **bold** 中文 {i}' for i in range(600))
   fill_field(field,tasks);field.press('Control+End');field.press('Shift+Enter');field.type('Soft continuation')
   field.press('Enter');field.type('Last unsent item')
   expect(field.get_by_role('checkbox')).to_have_count(601)
   expect(field.locator('li').nth(599)).to_contain_text('Soft continuation')
   expect(field.locator('li').nth(599).locator('strong')).to_have_text('bold')
   expect(field.locator('li').last).to_contain_text('Last unsent item')
   edited=field.evaluate('n=>n.value');page.evaluate('switchNote("b")')
   page.wait_for_function('()=>notes.a.content.text.includes("Last unsent item")')
   assert scope['parse'](page.evaluate('notes.a.content.text'))['draft']==edited
   page.evaluate('switchNote("a")');expect(field).to_have_js_property('value',edited)
   send=e.get_by_role('button',name='Send message' if path.startswith('/next') else 'Send',exact=True)
   expect(send).to_be_enabled();send.click();expect(field).to_have_js_property('value','')
   sent=scope['parse'](page.evaluate('notes.a.content.text'))
   assert sent['messages'][-1]['text']==edited and sent['draft']==''
   assert not errors,errors
   print('PASS '+path+': batched drafts, immediate Send and exact long checklist after Enter, Shift+Enter, switching and reopening',flush=True);page.close()
  browser.close()
finally:server.shutdown()
