"""Touch-menu regression checks using Playwright and system Chromium.

Serve the repository with python3 -m http.server 8000, then run:
    python3 tests/touch-menu-smoke.py
The test supplies a synthetic Standard Notes host and never uses a real account.
"""
import os
from playwright.sync_api import sync_playwright, expect
HOST = '<!doctype html><title>Onboarding host</title>\n<iframe id="editor" src="/index.html" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>\n<script>\nconst editor = document.querySelector(\'#editor\');\nwindow.onboarding = {\n  saved: [],\n  note: {uuid: \'onboarding-note\', content_type: \'Note\',\n         content: {title: \'Onboarding fixture\', text: \'Existing smoke message\'}}\n};\nwindow.addEventListener(\'message\', event => {\n  if (event.source !== editor.contentWindow || event.origin !== location.origin) return;\n  const message = event.data;\n  if (!message || typeof message !== \'object\') return;\n  let data;\n  if (message.action === \'stream-context-item\') {\n    data = {item: structuredClone(onboarding.note)};\n  } else if (message.action === \'save-items\') {\n    onboarding.note = structuredClone(message.data.items[0]);\n    onboarding.saved.push(structuredClone(onboarding.note));\n    data = {items: structuredClone(message.data.items)};\n  } else {\n    return;\n  }\n  editor.contentWindow.postMessage({action: \'reply\', original: message, data}, location.origin);\n});\neditor.addEventListener(\'load\', () => {\n  editor.contentWindow.postMessage({\n    action: \'component-registered\', sessionKey: \'synthetic-onboarding-session\',\n    componentData: {},\n    data: {uuid: \'onboarding-component\', environment: \'web\', platform: \'web\', activeThemeUrls: []}\n  }, location.origin);\n});\n</script>'
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route(BASE+'/__host',lambda r:r.fulfill(content_type='text/html',body=HOST))
 page.goto(BASE+'/__host',wait_until='networkidle')
 editor=page.frame_locator('#editor');body=editor.locator('.message-body').first
 expect(body).to_be_visible()
 assert body.evaluate('el=>getComputedStyle(el).userSelect')=='none'
 cdp=context.new_cdp_session(page)
 def touch(kind,x=0,y=0):
  cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':y}]})
 box=body.bounding_box();x=box['x']+20;y=box['y']+10
 touch('touchStart',x,y);page.wait_for_timeout(650);touch('touchEnd')
 expect(editor.get_by_role('menu')).to_be_visible()
 assert editor.locator('body').evaluate('()=>window.getSelection().toString()')==''
 print('PASS: actual touch hold opens custom menu without selecting text')
 editor.get_by_role('menuitem',name='Edit',exact=True).click()
 field=editor.get_by_role('textbox',name='Edit message',exact=True)
 expect(field).to_be_visible()
 assert field.evaluate('el=>{el.focus();el.select();return el.selectionEnd-el.selectionStart}')>0
 field.fill('Edited after a long press');editor.get_by_role('button',name='Save',exact=True).click()
 page.wait_for_function("onboarding.note.content.text==='Edited after a long press'")
 print('PASS: editing and selecting text inside the edit field still works')
 body=editor.locator('.message-body').first;box=body.bounding_box();x=box['x']+20;y=box['y']+10
 touch('touchStart',x,y);touch('touchMove',x,y+35);page.wait_for_timeout(650);touch('touchEnd')
 expect(editor.get_by_role('menu')).to_have_count(0)
 print('PASS: moving to scroll cancels the long-press menu')
 touch('touchStart',x,y);page.wait_for_timeout(80);touch('touchEnd');page.wait_for_timeout(600)
 expect(editor.get_by_role('menu')).to_have_count(0)
 expect(editor.locator('.bubble-category')).to_have_count(0)
 print('PASS: short taps do not open the menu; no extra emoji button is rendered')
 composer=editor.get_by_role('textbox',name='Message',exact=True)
 messages=editor.get_by_role('log')
 # An empty part of the scroll area, outside bubbles and controls.
 background={'x':20,'y':350}
 composer.tap();expect(composer).to_be_focused()
 messages.tap(position=background);expect(composer).not_to_be_focused()
 messages.tap(position=background);expect(composer).not_to_be_focused()
 page.keyboard.type('do not capture')
 expect(composer).to_have_value('')
 print('PASS: phone background tap blurs the input and never reopens or captures typing')
 composer.tap();composer.fill('A multiline message\nwith a timestamp in the bottom right')
 editor.get_by_role('button',name='Send message',exact=True).tap()
 bubble=editor.locator('.message-bubble').last
 meta=bubble.locator('.message-meta')
 bb=bubble.bounding_box();mb=meta.bounding_box()
 assert 0 <= bb['x']+bb['width']-mb['x']-mb['width'] <= 10
 assert 0 <= bb['y']+bb['height']-mb['y']-mb['height'] <= 8
 expect(editor.locator('.bubble-category')).to_have_count(0)
 print('PASS: timestamp sits at the lower-right corner without an added smiley')
 assert not errors,errors
 desktop=browser.new_context(viewport={'width':1200,'height':900})
 dp=desktop.new_page();dp.route(BASE+'/__host',lambda r:r.fulfill(content_type='text/html',body=HOST))
 dp.goto(BASE+'/__host',wait_until='networkidle');db=dp.frame_locator('#editor').locator('.message-body').first
 expect(db).to_be_visible();assert db.evaluate('el=>getComputedStyle(el).userSelect')=='text'
 db.dblclick();assert db.evaluate('()=>window.getSelection().toString()')
 db.click(button='right');expect(dp.frame_locator('#editor').get_by_role('menu')).to_be_visible()
 print('PASS: desktop text selection and right-click menu remain available')
 dp.keyboard.press('Escape')
 de=dp.frame_locator('#editor');dc=de.get_by_role('textbox',name='Message',exact=True)
 de.get_by_role('log').click(position={'x':20,'y':350})
 expect(dc).to_be_focused();dp.keyboard.type('Desktop background typing')
 expect(dc).to_have_value('Desktop background typing')
 # Typing with focus elsewhere still goes into the desktop composer.
 dc.evaluate('el=>el.blur()');dp.keyboard.type('!')
 expect(dc).to_have_value('Desktop background typing!')
 print('PASS: desktop background click and direct typing still populate the composer')
 browser.close()
