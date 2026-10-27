"""A bottom-screen hold must never release onto an active Delete action."""
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('editor-roundtrip-host.html').read_text()
MESSAGES = [dict(id=f'm{i}', text=f'Message {i}', createdAt=f'2026-01-01T08:{i:02d}:00Z', reactions=[]) for i in range(25)]
NOTE = {'uuid':'original','content_type':'Note','content':{'text':'\n'.join(m['text'] for m in MESSAGES),
        'appendEditorMessageData':MESSAGES}}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page();errors=[];dialogs=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def dialog(d):
        dialogs.append(d.message)
        d.dismiss()
    page.on('dialog',dialog)
    page.route(BASE+'/__placement',lambda r:r.fulfill(content_type='text/html',body=HOST))
    page.goto(BASE+'/__placement')
    page.evaluate('(note)=>{notes.original=note;openIM("original")}',NOTE)
    editor=page.frame_locator('#editor')
    expect(editor.locator('.message-bubble')).to_have_count(25)
    page.wait_for_function('notes.original.clientData?.imStyleEditor?.schemaVersion===1')
    log=editor.get_by_role('log');log.evaluate('el=>el.scrollTop=el.scrollHeight')
    target=editor.locator('.message-body').last
    before=target.bounding_box();scroll=log.evaluate('el=>el.scrollTop')
    x=before['x']+20;y=before['y']+10
    cdp=context.new_cdp_session(page)
    def touch(kind,x=0,y=0):
        cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':y}]})
    touch('touchStart',x,y);page.wait_for_timeout(650)
    expect(editor.get_by_role('menu')).to_have_count(0)
    target.evaluate('(el,p)=>el.dispatchEvent(new PointerEvent("contextmenu",{bubbles:true,cancelable:true,pointerType:"touch",clientX:p.x,clientY:p.y}))',{'x':x,'y':y})
    expect(editor.get_by_role('menu')).to_have_count(0)
    touch('touchEnd')
    menu=editor.get_by_role('menu');expect(menu).to_be_visible()
    mb=menu.bounding_box();after=target.bounding_box()
    assert mb['y']+mb['height']<=before['y']-2,(mb,before)
    assert not (mb['x']<=x<=mb['x']+mb['width'] and mb['y']<=y<=mb['y']+mb['height'])
    assert abs(after['y']-before['y'])<.1,(before,after,scroll,log.evaluate('el=>el.scrollTop'))
    assert log.evaluate('el=>el.scrollTop')==scroll
    editor.get_by_role('menuitem',name='Delete',exact=True).dispatch_event('click',{'detail':1})
    assert not dialogs,dialogs
    assert page.evaluate('notes.original.content.text')==NOTE['content']['text']
    editor.get_by_role('menuitem',name='Edit',exact=True).tap()
    expect(editor.get_by_role('textbox',name='Edit message',exact=True)).to_have_value('Message 24')
    editor.get_by_role('button',name='Cancel',exact=True).tap()
    print('PASS: bottom hold opens above the bubble only after release; phantom Delete is blocked and note does not jump')
    log.evaluate('el=>el.scrollTop=0')
    first=editor.locator('.message-body').first;b=first.bounding_box();x=b['x']+20;y=b['y']+10
    touch('touchStart',x,y);page.wait_for_timeout(650);touch('touchEnd')
    expect(menu).to_be_visible();mb=menu.bounding_box()
    assert mb['y']>=b['y']+b['height'],(mb,b)
    page.set_viewport_size({'width':390,'height':300})
    page.wait_for_timeout(100)
    mb=menu.bounding_box();assert mb['y']>=8 and mb['y']+mb['height']<=292.1,mb
    print('PASS: top bubbles use space below; a smaller keyboard-sized viewport keeps the menu on-screen')
    page.keyboard.press('Escape');expect(menu).to_have_count(0)
    page.set_viewport_size({'width':390,'height':844})
    # A very long category menu scrolls above the hold point rather than covering it.
    large=dict(NOTE);large['content']=dict(NOTE['content'],appendEditorSettings={'reactionOrder':['⭐'+str(i) for i in range(100)]})
    page.evaluate('(note)=>{notes.original=note;openIM("original")}',large)
    expect(editor.locator('.message-bubble')).to_have_count(25)
    log=editor.get_by_role('log');log.evaluate('el=>el.scrollTop=el.scrollHeight')
    target=editor.locator('.message-body').last;b=target.bounding_box();x=b['x']+20;y=b['y']+10
    touch('touchStart',x,y);page.wait_for_timeout(650);touch('touchEnd')
    expect(menu).to_be_visible();mb=menu.bounding_box()
    assert mb['y']>=8 and mb['y']+mb['height']<=y-23.9,(mb,y)
    assert menu.evaluate('el=>el.scrollHeight>el.clientHeight')
    assert not dialogs,dialogs
    assert not errors,errors
    print('PASS: oversized emoji menus scroll outside the finger zone without accidental deletion')
    browser.close()
