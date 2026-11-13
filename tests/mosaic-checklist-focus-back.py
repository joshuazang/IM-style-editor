"""Checkbox taps keep phone keyboards closed; local card-back swipes save safely."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')};exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope);globals().update(scope)
data['messages'][0]['text']='\n'.join('- [ ] Task '+str(i) for i in range(30))
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for phone,width in [('iPhone',320),('iPhone',390),('Android',390),('Mac',1100)]:
   mobile=phone!='Mac';ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if phone=='iPhone' else ('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' if mobile else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130 Safari/537.36')
   context=browser.new_context(viewport={'width':width,'height':900},user_agent=ua,is_mobile=mobile,has_touch=mobile);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');dialog=e.locator('dialog');body=e.get_by_role('textbox',name='Card body',exact=True)
   def open_card():
    e.locator('.card').first.click();dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');expect(body).to_be_editable()
   open_card();body.evaluate('n=>n.blur()');first=body.get_by_role('checkbox').first
   first.tap() if mobile else first.click();expect(first).to_have_attribute('aria-checked','true');(expect(body).not_to_be_focused() if mobile else expect(body).to_be_focused())
   body.focus();first.tap() if mobile else first.click();expect(first).to_have_attribute('aria-checked','false');expect(body).to_be_focused()
   body.evaluate('n=>n.blur()');second=body.get_by_role('checkbox').nth(1);second.tap() if mobile else second.click();expect(second).to_have_attribute('aria-checked','true');(expect(body).not_to_be_focused() if mobile else expect(body).to_be_focused());expected=body.evaluate('n=>n.value')
   if phone=='iPhone':
    # These are gestures delivered inside the plugin iframe. They cannot model
    # a host-owned screen-edge gesture outside the iframe's event boundary.
    def swipe(x=3,dx=145,dy=0):
     return dialog.evaluate('''(n,g)=>{const send=(type,x,y)=>{const t=new Touch({identifier:1,target:n,clientX:x,clientY:y});const e=new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]});n.dispatchEvent(e);return e.defaultPrevented};send('touchstart',g.x,180);const consumed=send('touchmove',g.x+g.dx,180+g.dy);send('touchend',g.x+g.dx,180+g.dy);return consumed}''',{'x':x,'dx':dx,'dy':dy})
    assert not swipe(dx=0,dy=120);expect(dialog).to_be_visible()
    assert not swipe(x=80);expect(dialog).to_be_visible()
    swipe(dx=30);expect(dialog).to_be_visible()
    page.evaluate('rejectSaves=true');assert swipe();expect(e.locator('.card-detail-tools').get_by_role('button',name='Retry save',exact=True)).to_be_visible();expect(dialog).to_be_visible();assert body.evaluate('n=>n.value')==expected
    page.evaluate('rejectSaves=false');assert swipe();expect(dialog).not_to_be_visible()
    assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text']==expected
    # On Board view the modal is gone and no swipe listener consumes a gesture.
    assert e.locator('#board').evaluate('n=>{const t=new Touch({identifier:2,target:n,clientX:3,clientY:180}),e=new TouchEvent("touchstart",{bubbles:true,cancelable:true,touches:[t]});n.dispatchEvent(e);return !e.defaultPrevented}')
    open_card();cdp=context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':3,'y':180}]})
    for x in [35,70,115,165]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':180}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});expect(dialog).not_to_be_visible()
    open_card();body.focus();body.press('Control+a');assert not swipe();expect(dialog).to_be_visible();assert body.evaluate('()=>!getSelection().isCollapsed')
    body.press('ArrowRight');e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible()
   else:
    e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text']==expected
   assert not errors,errors;print(f'PASS {phone} {width}px: checkbox focus policy, retained edits, local back scope/cancellation/selection and acknowledged save',flush=True);context.close()
  browser.close()
finally:server.shutdown()
