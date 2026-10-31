"""Movable Untagged, exact shared pinned frost and separate header controls."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006');HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':[dict(id=str(i),text=f'Thought {i}',createdAt='2026-10-28T12:00:00Z',reactions=[]) for i in range(3)]}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__material',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__material');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(3)
  e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Arrange tags',exact=True).click()
  chips=e.locator('.tag-control');expect(chips.last.get_by_role('button',name='Untagged',exact=True)).to_be_visible()
  e.get_by_role('button',name='Move Untagged earlier',exact=True).click();expect(chips.nth(7).get_by_role('button',name='Untagged',exact=True)).to_be_visible()
  e.get_by_role('button',name='Move Untagged earlier',exact=True).click();expect(chips.nth(6).get_by_role('button',name='Untagged',exact=True)).to_be_visible()
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.untaggedPosition===6')
  page.screenshot(path=f'/tmp/untagged-arrange-{width}.png');page.evaluate('openPlain()');assert 'untaggedPosition' in page.locator('#plain-editor').input_value();page.evaluate('openIM()')
  e.get_by_role('button',name='Search and tags',exact=True).click();expect(e.locator('.tag-control').nth(6).get_by_role('button',name='Untagged',exact=True)).to_be_visible();page.keyboard.press('Escape')
  rows.first.click(button='right');pin=e.get_by_role('menuitem',name='Pin',exact=True);assert pin.locator('svg').get_attribute('viewBox')=='0 0 26 26';pin.click()
  rows.first.click(button='right');unpin=e.get_by_role('menuitem',name='Unpin',exact=True);expect(unpin.locator('svg>path')).to_have_count(1);page.keyboard.press('Escape')
  def material(locator):return locator.evaluate('(n)=>{const s=getComputedStyle(n);return [s.backgroundColor,s.backdropFilter]}')
  shared=material(e.get_by_role('button',name='Search and tags',exact=True));assert shared[1]=='blur(10px)',shared
  assert material(e.locator('.pinned-carousel'))==shared
  one=e.locator('.pinned-carousel');expect(one.locator('strong')).to_have_count(0);expect(one).not_to_contain_text('Pinned message');expect(one.get_by_role('button',name='Unpin message',exact=True)).to_be_visible()
  assert one.get_by_role('button',name='Unpin message',exact=True).evaluate('(n)=>getComputedStyle(n).color')=='rgb(0, 0, 0)'
  top=one.bounding_box();other=e.get_by_role('button',name='More options',exact=True).bounding_box();assert abs(top['height']-other['height'])<.1 and abs(top['y']-other['y'])<.1,(top,other)
  page.screenshot(path=f'/tmp/pins-single-top-{width}.png');one.get_by_role('button',name='Unpin message',exact=True).click();expect(e.locator('.pinned-carousel')).to_have_count(0)
  for i in [0,1]:rows.nth(i).click(button='right');e.get_by_role('menuitem',name='Pin',exact=True).click()
  # Active filters keep pins visible and replace Search/More with the two-part indicator.
  e.get_by_role('button',name='Search and tags',exact=True).click();e.get_by_role('button',name='Untagged',exact=True).click();expect(e.locator('.pinned-carousel')).to_be_visible()
  expect(e.get_by_role('button',name='Search and tags',exact=True)).to_have_count(0);expect(e.get_by_role('button',name='More options',exact=True)).to_have_count(0)
  expect(e.locator('.filter-status')).to_be_visible();assert e.locator('.filter-status').bounding_box()['width']>=78
  page.keyboard.press('Escape');e.get_by_role('button',name='Clear all filters',exact=True).click();expect(e.locator('.pinned-carousel')).to_be_visible()
  e.get_by_role('button',name='Search and tags',exact=True).click();search=e.get_by_role('textbox',name='Search messages',exact=True);search.fill('Thought 0');expect(rows).to_have_count(1);expect(e.locator('.pinned-carousel')).to_be_visible()
  page.keyboard.press('Escape');e.get_by_role('button',name='Clear all filters',exact=True).click();expect(e.locator('.pinned-carousel')).to_be_visible();expect(rows).to_have_count(3)
  assert page.evaluate('notes.original.clientData.imStyleEditor.settings.pinnedMessageIds.length')==2
  summary=e.locator('.pin-summary');expect(summary.locator('strong')).to_have_text('#1');expect(summary).not_to_contain_text('Pinned message')
  label=summary.locator('strong').bounding_box();body=summary.locator('span').bounding_box();assert abs(label['y']-body['y'])<1 and label['x']+label['width']<body['x'],(label,body)
  assert summary.locator('span').evaluate('(n)=>getComputedStyle(n).fontSize')=='16px';assert summary.locator('span').evaluate('(n)=>getComputedStyle(n).fontWeight')=='400'
  page.screenshot(path=f'/tmp/pins-frost-carousel-{width}.png');e.get_by_role('button',name='Show all 2 pinned messages').click()
  header=e.locator('.pinned-list-header');parts=[header.get_by_role('button',name='Back to all messages'),header.locator('strong'),header.get_by_role('button',name='Pinned message options')]
  bounds=[n.bounding_box() for n in parts]
  assert all(abs(n['height']-46)<.1 for n in bounds),bounds
  assert bounds[1]['x']>bounds[0]['x']+bounds[0]['width'] and bounds[2]['x']>bounds[1]['x']+bounds[1]['width'],bounds
  for n in parts:assert material(n)==shared,(material(n),shared)
  assert material(e.get_by_role('button',name='Unpin all messages',exact=True))==shared
  footer=e.get_by_role('button',name='Unpin all messages',exact=True).bounding_box();assert footer['width']<width-40 and abs(footer['x']+footer['width']/2-width/2)<1,footer
  expect(e.get_by_role('button',name='Search and tags',exact=True)).to_have_count(0);expect(e.get_by_role('textbox',name='Search messages',exact=True)).to_have_count(0)
  assert material(e.get_by_role('button',name='Show pinned message in full note').first)==shared
  page.screenshot(path=f'/tmp/pins-frost-view-{width}.png');parts[-1].click();assert material(e.locator('.pin-options'))==shared
  assert not errors,errors
  print('PASS pin material and Untagged order',width);c.close()
 b.close()
