"""Touch checkboxes toggle once without native click focus or editor refocus."""
from pathlib import Path
from browser_engine import fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for phone in ['iPhone','Android']:
   ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if phone=='iPhone' else 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
   context=browser.new_context(viewport={'width':390,'height':900},user_agent=ua,is_mobile=True,has_touch=True)
   if phone=='iPhone':context.add_init_script("Object.defineProperty(navigator,'vendor',{get:()=> 'Apple Computer, Inc.'})")
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   for path in ['/next/index.html','/mosaic/index.html']:
    page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
    page.evaluate('([note,path])=>{notes.a=note;openEditor("a",path,true)}',[data['note'],path])
    e=page.frame_locator('#editor')
    for label in (['Message'] if path.startswith('/next') else ['Take a note','Card body']):
     if label=='Card body':
      e.get_by_role('textbox',name='Take a note',exact=True).evaluate('n=>n.blur()')
      e.locator('.card').first.click()
      e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
     field=e.get_by_role('textbox',name=label,exact=True)
     fill_field(field,'- [ ] First task\n- [ ] Second task')
     field.evaluate('''n=>{
       const v=n.imRich.view,focus=v.focus.bind(v);n.focusRequests=0;n.touchEnds=[];
       v.focus=()=>{n.focusRequests++;return focus()};
       n.addEventListener('touchend',e=>n.touchEnds.push(e.defaultPrevented));
     }''')
     first=field.get_by_role('checkbox').first
     for focused in [False,True]:
      field.evaluate('(n,focused)=>{focused?n.focus():n.blur();n.focusRequests=0;n.touchEnds=[]}',focused)
      first.tap();expect(first).to_have_attribute('aria-checked','true' if not focused else 'false')
      assert field.evaluate('n=>n.focusRequests')==0,(phone,label,'checkbox requested text focus')
      assert field.evaluate('n=>n.touchEnds')==[True],(phone,label,'native touch click was not cancelled')
      (expect(field).to_be_focused() if focused else expect(field).not_to_be_focused())
      first.dispatch_event('click',{'detail':1,'pointerType':'touch'})
      expect(first).to_have_attribute('aria-checked','true' if not focused else 'false')
     # Keyboard/accessibility activation still works without focusing the text.
     field.evaluate('n=>{n.blur();n.focusRequests=0}')
     first.focus();first.press('Space');expect(first).to_have_attribute('aria-checked','true')
     assert field.evaluate('n=>n.focusRequests')==0
     expect(field).not_to_be_focused()
     # Text taps still place the caret; undo/redo includes checkbox changes.
     field.locator('li p').last.tap();expect(field).to_be_focused()
     saved=field.evaluate('n=>n.value')
     field.press('Control+z');assert field.evaluate('n=>n.value')!=saved
     field.press('Control+Shift+z');assert field.evaluate('n=>n.value')==saved
     print(f'PASS {phone} {label}: native touch default cancelled, single toggle, no editor focus calls, keyboard activation, text taps and undo/redo',flush=True)
   assert not errors,errors
   context.close()
  browser.close()
finally:server.shutdown()
