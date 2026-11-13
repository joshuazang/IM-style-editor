"""Keep a long Card's caret visible as the phone keyboard resizes the viewport."""
from pathlib import Path
scope={'__file__':__file__};exec(Path(__file__).with_name('mosaic-phone-keyboard.py').read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,430]:
   context=browser.new_context(viewport={'width':width,'height':900},user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',is_mobile=True,has_touch=True)
   context.add_init_script("""Object.defineProperty(navigator,'vendor',{get:()=> 'Apple Computer, Inc.'});
     window.keyboardViewport=new EventTarget();Object.assign(keyboardViewport,{height:900,width:innerWidth,offsetTop:0,offsetLeft:0});
     Object.defineProperty(window,'visualViewport',{get:()=>keyboardViewport});""")
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');e.locator('.card').first.click();dialog=e.locator('dialog');dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_editable();expect(body).not_to_be_focused()
   def settle():body.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
   def viewport(height,offset=0):
    body.evaluate('(n,v)=>{Object.assign(keyboardViewport,v);keyboardViewport.dispatchEvent(new Event("resize"));}',{'height':height,'offsetTop':offset});settle()
   def visible():
    result=body.evaluate('n=>{const v=n.imRich.view,c=v.coordsAtPos(v.state.selection.head),s=n.closest(".card-detail-scroll").getBoundingClientRect(),b=keyboardViewport.offsetTop+keyboardViewport.height;return {caret:c,bounds:s.toJSON(),bottom:b,ok:c.top>=s.top+10&&c.bottom<=Math.min(s.bottom,b)-10}}');assert result['ok'],result
   body.focus();body.press('Control+End');settle();body.evaluate('n=>n.blur()');settle()
   point=body.evaluate('n=>{const v=n.imRich.view,c=v.coordsAtPos(v.state.selection.head);return {x:c.left+1,y:(c.top+c.bottom)/2}}')
   framebox=page.locator('#editor').bounding_box();page.touchscreen.tap(framebox['x']+point['x'],framebox['y']+point['y']);expect(body).to_be_focused();settle()
   # The selection is established before the keyboard animation, including
   # intermediate resize/pan events. No document edit is needed to reveal it.
   for height,offset in [(650,0),(420,0),(360,35)]:viewport(height,offset);visible();expect(body).to_be_focused()
   before=body.evaluate('n=>n.imRich.view.state.doc.textContent');body.type(' visible typing');settle();visible();body.press('Enter');body.type('next line');settle();visible()
   assert body.evaluate('n=>n.imRich.view.state.doc.textContent').startswith(before)
   # Tap an earlier low line with the keyboard closed, then reopen it.
   viewport(900);body.evaluate('n=>{const v=n.imRich.view;v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.create(v.state.doc,Math.floor(v.state.doc.content.size*.6))).scrollIntoView());}');settle();viewport(380);visible()
   # Programmatic caret scrolling must not trigger swipe-to-dismiss.
   expect(body).to_be_focused();assert page.evaluate('saves.length')==0
   # Close/reopen cancels listeners and queued work; keyboard changes with no
   # focused body do not move the newly opened card.
   e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();e.locator('.card').first.click();expect(dialog).to_be_visible();viewport(400);expect(body).not_to_be_focused();assert not errors,errors
   print(f'PASS {width}px: keyboard resize/pan, long-note caret and typing visible, focus/draft retained, reopen cleanup',flush=True);context.close()
  browser.close()
finally:server.shutdown()
