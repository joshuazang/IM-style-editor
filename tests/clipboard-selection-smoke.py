"""Clipboard API denial, manual recovery, message copy, and stable selection layout."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note,fixture_messages
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8003')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
messages=fixture_messages([dict(id=str(i),text=f'Message {i}\nwith exact spacing\n\nand a second paragraph.',reactions=['⭐'] if i==3 else [],createdAt='2026-10-27T12:00:00Z') for i in range(14)])
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':messages}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,permissions=['clipboard-read','clipboard-write'])
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__clipboard',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__clipboard');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(14)
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===14')
  original=page.evaluate('notes.original.content.text');field=e.get_by_role('textbox',name='Message',exact=True)
  for draft in ['', 'A multiline unsent draft\nSecond line\nThird line']:
   field.fill(draft);page.wait_for_timeout(100)
   bounds=e.locator('.composer').bounding_box();scroll=e.get_by_role('log').evaluate('el=>el.scrollTop')
   rows.nth(3).click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();page.wait_for_timeout(100)
   selected=e.locator('.composer').bounding_box()
   assert abs(bounds['y']-selected['y'])<.1 and abs(bounds['height']-selected['height'])<.1,(bounds,selected)
   assert abs(scroll-e.get_by_role('log').evaluate('el=>el.scrollTop'))<1
   pill=e.locator('.selection-status>span').bounding_box();cancel=e.get_by_role('button',name='Cancel',exact=True).bounding_box()
   assert pill['height']==cancel['height']==46 and abs(pill['y']-cancel['y'])<.1,(pill,cancel)
   circle=e.locator('.selection-check.checked')
   size=circle.bounding_box();assert size['width']==size['height']==20
   assert circle.evaluate('el=>parseFloat(getComputedStyle(el).borderTopWidth)')==3
   e.get_by_role('button',name='Cancel',exact=True).click();expect(field).to_have_value(draft)
  # Denied modern API, working legacy path: both message Copy and Export must work.
  e.locator('body').evaluate('''()=>{window.realClipboard=navigator.clipboard;window.realExec=document.execCommand.bind(document);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('host restriction')),readText:()=>realClipboard.readText()}})}''')
  rows.nth(3).click(button='right');e.get_by_role('menuitem',name='Copy',exact=True).click()
  expect(e.locator('.transfer-notice')).to_contain_text('Copied')
  assert page.evaluate('navigator.clipboard.readText()')==messages[3]['text']
  rows.nth(3).click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();rows.nth(4).click()
  e.get_by_role('button',name='Export',exact=True).click()
  expect(e.locator('.transfer-notice')).to_contain_text('2 messages exported')
  copied=page.evaluate('navigator.clipboard.readText()');payload=json.loads(copied.split('\n',1)[1])
  assert [m['id'] for m in payload['messages']]==[m['id'] for m in messages[3:5]]
  expect(e.get_by_role('dialog')).to_have_count(0)
  # When both paths are blocked, offer a solid, complete, selectable manual export.
  e.locator('body').evaluate('()=>document.execCommand=()=>false')
  e.get_by_role('button',name='Export',exact=True).click();dialog=e.get_by_role('dialog');expect(dialog).to_be_visible()
  manual=dialog.get_by_role('textbox',name='Message export').input_value()
  manual_payload=json.loads(manual.split('\n',1)[1]);manual_payload.pop('exportedAt');previous_payload=dict(payload);previous_payload.pop('exportedAt');assert manual_payload==previous_payload
  copied=manual
  for target in [dialog,dialog.get_by_role('textbox',name='Message export'),dialog.get_by_role('button',name='Select and copy')]:
   style=target.evaluate('''el=>{const s=getComputedStyle(el),c=document.createElement('canvas').getContext('2d');c.fillStyle=s.backgroundColor;c.fillRect(0,0,1,1);return {alpha:c.getImageData(0,0,1,1).data[3],blur:s.backdropFilter}}''')
   assert style['alpha']==255 and style['blur']=='none',style
  if width==390:page.screenshot(path='/workspace/selection-preview/solid-manual-export.png')
  e.locator('body').evaluate('()=>document.execCommand=realExec')
  dialog.get_by_role('button',name='Select and copy').click();assert page.evaluate('navigator.clipboard.readText()')==copied
  dialog.get_by_role('button',name='Close',exact=True).click()
  if width==390:page.screenshot(path='/workspace/selection-preview/strong-selection-preview.png')
  assert page.evaluate('notes.original.content.text')==original
  assert not errors,errors
  print('PASS',width,'no selection height/scroll shift; unchanged 20px circles with strong contrast; context Copy and Export use compatibility clipboard; solid manual export copies full records')
  c.close()
 b.close()
