"""Independent cancel/change click regions and persistent pins during filtering."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note,fixture_id
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006');HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorSettings':{'pinnedMessageId':fixture_id('0')},'appendEditorMessageData':[dict(id=str(i),text=f'Message {i}',createdAt='2026-10-28T12:00:00Z',reactions=['✅'] if i%2 else []) for i in range(8)]}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__indicator',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__indicator');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(8);page.wait_for_function('!!notes.original.clientData?.imStyleEditor');saved=page.evaluate('notes.original.content.text')
  def activate():
   e.get_by_role('button',name='Search and tags',exact=True).click();e.locator('.tag-control .chip').filter(has_text='✅').click();page.keyboard.press('Escape');expect(rows).to_have_count(4)
  def filtered():
   expect(e.get_by_role('button',name='Search and tags',exact=True)).to_have_count(0);expect(e.get_by_role('button',name='More options',exact=True)).to_have_count(0);expect(e.locator('.pinned-carousel')).to_be_visible();expect(e.locator('.filter-status')).not_to_contain_text('Filtering');expect(e.locator('.filter-status button')).to_have_count(2)
   buttons=e.locator('.filter-status button');assert buttons.nth(0).get_attribute('aria-label')=='Change filters' and buttons.nth(1).get_attribute('aria-label')=='Clear all filters'
   assert not any(ch.isdigit() for ch in e.locator('.filter-status').inner_text())
   style=e.locator('.filter-status').evaluate('(n)=>{const s=getComputedStyle(n);return {outline:s.outlineColor,width:s.outlineWidth,shadow:s.boxShadow}}');assert style['outline']=='rgb(35, 115, 19)' and style['width']=='2px' and style['shadow']!='none',style
   pin=e.locator('.pinned-carousel').bounding_box();indicator=e.locator('.filter-status').bounding_box();assert abs(pin['height']-indicator['height'])<.1 and abs(pin['y']-indicator['y'])<.1,(pin,indicator);assert indicator['x']+indicator['width']<=width-7
  activate();filtered();expect(e.locator('.filter-status')).to_contain_text('✅');expect(e.locator('.filter-status')).not_to_contain_text('/')
  change=e.get_by_role('button',name='Change filters',exact=True);box=change.bounding_box();change.click(position={'x':box['width']-3,'y':18});expect(e.locator('.search-tags-panel')).to_be_visible();expect(rows).to_have_count(4)
  change.click(position={'x':3,'y':18});expect(e.locator('.search-tags-panel')).to_have_count(0);expect(rows).to_have_count(4)
  clear=e.get_by_role('button',name='Clear all filters',exact=True);clear.click(position={'x':3,'y':18});expect(rows).to_have_count(8);expect(e.locator('.search-tags-panel')).to_have_count(0);expect(e.get_by_role('button',name='Search and tags',exact=True)).to_be_visible();expect(e.get_by_role('button',name='More options',exact=True)).to_be_visible()
  activate();clear=e.get_by_role('button',name='Clear all filters',exact=True);clear.click(position={'x':18,'y':32});expect(rows).to_have_count(8);expect(e.locator('.search-tags-panel')).to_have_count(0)
  # Search-only uses a lens and counts; keyboard activation respects each action.
  e.get_by_role('button',name='Search and tags',exact=True).click();e.get_by_role('textbox',name='Search messages',exact=True).fill('Message 1');page.keyboard.press('Escape');filtered();expect(e.locator('.filter-change svg circle')).to_have_count(1);expect(e.locator('.filter-status')).not_to_contain_text('/')
  change=e.get_by_role('button',name='Change filters',exact=True);change.focus();change.press('Enter');expect(e.locator('.search-tags-panel')).to_be_visible();clear=e.get_by_role('button',name='Clear all filters',exact=True);clear.focus();clear.press('Space');expect(rows).to_have_count(8);expect(e.locator('.search-tags-panel')).to_have_count(0)
  e.get_by_role('button',name='Search and tags',exact=True).click();e.get_by_role('button',name='Untagged',exact=True).click();page.keyboard.press('Escape');filtered();expect(e.locator('.filter-status .untagged-icon')).to_have_count(1);expect(e.locator('.filter-status')).not_to_contain_text('/')
  page.screenshot(path=f'/tmp/filter-indicator-{width}.png')
  assert page.evaluate('notes.original.content.text')==saved
  assert not errors,errors
  print('PASS filter indicator',width,'whole cancel circle, independent change area, keyboard access, pinned preview and unchanged note data');c.close()
 b.close()
