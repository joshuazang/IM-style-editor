"""The same full-width band marks located/selected messages; menus follow X only."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':[dict(id=str(i),text=f'Message {i}: an idea to return to.',createdAt='2026-10-28T12:00:00Z',reactions=[]) for i in range(30)]}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__emphasis',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__emphasis');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(30)
  rows.nth(12).click(button='right');expect(rows.nth(12).locator('..')).to_have_class('message-row message-emphasized')
  e.get_by_role('menuitem',name='Reply',exact=True).click();trigger=e.get_by_role('button',name='Reply options',exact=True)
  def open_at(right=False):
   box=trigger.bounding_box();trigger.click(position={'x':box['width']-8 if right else 8,'y':box['height']/2})
   menu=e.get_by_role('menu',name='Reply options',exact=True);expect(menu).to_be_visible();return menu.bounding_box()
  left=open_at();page.keyboard.press('Escape');right=open_at(True)
  assert right['x']>left['x']+30,(width,left,right)
  assert abs(right['y']-left['y'])<1,(left,right)
  for box in [left,right]:assert box['x']>=7 and box['x']+box['width']<=width-7,box
  page.screenshot(path=f'/tmp/reply-position-{width}.png')
  e.get_by_role('menuitem',name='Show in Chat',exact=True).click()
  row=rows.nth(12).locator('..');expect(row).to_have_class('message-row message-emphasized')
  style=row.evaluate('''n=>{const band=getComputedStyle(n,'::before'),s=getComputedStyle(n.querySelector('.message-wrap')),b=getComputedStyle(n.querySelector('.message-bubble'));return {color:band.backgroundColor,left:parseFloat(band.left),right:parseFloat(band.right),outline:s.outlineStyle,shadow:s.boxShadow,animation:b.animationName}}''')
  assert style['color']=='rgba(25, 45, 25, 0.13)' and style['left']==style['right']<0,style
  assert style['outline']=='none' and style['shadow']=='none' and style['animation']=='none',style
  page.wait_for_timeout(900);page.screenshot(path=f'/tmp/message-located-{width}.png')
  expect(row).not_to_have_class('message-row message-emphasized',timeout=4000)
  rows.nth(12).click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  expect(row).to_have_class('message-row message-emphasized');before=rows.nth(12).bounding_box()
  assert row.evaluate("n=>getComputedStyle(n,'::before').backgroundColor")==style['color']
  page.screenshot(path=f'/tmp/message-selected-{width}.png')
  e.get_by_role('button',name='Cancel',exact=True).click();expect(row).not_to_have_class('message-row message-emphasized')
  after=rows.nth(12).bounding_box();assert abs(before['width']-after['width'])<1 and abs(before['height']-after['height'])<1,(before,after)
  # Keyboard opening centers on the preview and stays within viewport bounds.
  trigger.focus();trigger.press('Enter');menu=e.get_by_role('menu',name='Reply options',exact=True);expect(menu).to_be_visible();box=menu.bounding_box();assert box['x']>=7 and box['x']+box['width']<=width-7
  assert not errors,errors
  print('PASS',width,'full-row emphasis for navigation/menu/selection, unchanged bubble shape, horizontal pointer anchoring, fixed menu height and viewport bounds')
  c.close()
 b.close()
