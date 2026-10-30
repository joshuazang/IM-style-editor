"""Multi-pin carousel, independent list hit target, source navigation and safe unpinning."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note,fixture_id
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':[dict(id=str(i),text=f'Pinned idea {i}',createdAt='2026-10-28T12:00:00Z',reactions=['✅'] if i%2 else []) for i in range(10)],'appendEditorSettings':{'pinnedMessageId':fixture_id('0')}}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__pins',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__pins');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(10);bar=e.get_by_role('button',name='Show pinned message',exact=True);expect(bar).to_contain_text('Pinned idea 0')
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.pinnedMessageIds?.length===1');assert page.evaluate('notes.original.clientData.imStyleEditor.settings.pinnedMessageId') is None
  for i in [2,5]:rows.nth(i).click(button='right');e.get_by_role('menuitem',name='Pin',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.pinnedMessageIds.length===3')
  expect(e.locator('.pin-segments i')).to_have_count(3)
  for index,text in [(2,'Pinned idea 2'),(3,'Pinned idea 5'),(1,'Pinned idea 0')]:
   bar.click();expect(bar).to_contain_text(f'Pinned message #{index}');expect(bar).to_contain_text(text);expect(e.locator('.reply-located')).to_contain_text(text)
   expect(e.locator('.message-emphasized')).to_have_count(1)
  page.screenshot(path=f'/tmp/pins-carousel-{width}.png')
  list_button=e.get_by_role('button',name='Show all 3 pinned messages',exact=True);bounds=list_button.bounding_box();assert bounds['height']==bounds['width']==30
  list_button.click();expect(rows).to_have_count(3);expect(e.locator('.pinned-list-header')).to_contain_text('3 Pinned Messages');expect(e.locator('.pinned-carousel')).to_have_count(0)
  expect(e.get_by_role('textbox',name='Message',exact=True)).to_have_count(0);expect(e.get_by_role('button',name='Unpin all messages',exact=True)).to_be_visible();expect(e.locator('.bubble-pin-marker')).to_have_count(3)
  page.screenshot(path=f'/tmp/pins-list-{width}.png')
  # Selection in the pinned view remains scoped to pins, and Esc only cancels selection.
  rows.first.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Select all visible messages').click();expect(e.locator('.selection-status')).to_contain_text('3 messages selected');page.keyboard.press('Escape');expect(e.locator('.pinned-list-header')).to_be_visible();expect(rows).to_have_count(3)
  # Reply/Edit from the pinned view restore the composer instead of leaving a hidden edit.
  rows.first.click(button='right');e.get_by_role('menuitem',name='Reply',exact=True).click();expect(e.locator('.composer-reply-preview')).to_be_visible();expect(e.get_by_role('textbox',name='Message',exact=True)).to_be_visible();e.get_by_role('button',name='Cancel reply',exact=True).click()
  e.get_by_role('button',name='Show all 3 pinned messages').click();rows.first.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click();expect(e.get_by_role('textbox',name='Edit message',exact=True)).to_be_visible();e.get_by_role('button',name='Cancel editing',exact=True).click();e.get_by_role('button',name='Show all 3 pinned messages').click()
  # Source arrow leaves the list and highlights the original in the full timeline.
  e.get_by_role('button',name='Show pinned message in full note').nth(1).click();expect(rows).to_have_count(10);expect(e.locator('.reply-located')).to_contain_text('Pinned idea 2')
  page.evaluate('openPlain()');raw=page.locator('#plain-editor').input_value();assert 'pinnedMessageIds' in raw and 'pinnedMessageId"' not in raw;page.evaluate('openIM()');expect(e.get_by_role('button',name='Show all 3 pinned messages')).to_be_visible()
  # Pinned view ignores the ordinary tag/search filters, which Back restores.
  e.get_by_role('button',name='Search and tags').click();e.get_by_role('button',name='Untagged',exact=True).click();page.keyboard.press('Escape');expect(rows).to_have_count(5)
  e.get_by_role('button',name='Show all 3 pinned messages').click();expect(rows).to_have_count(3);e.get_by_role('button',name='Back to all messages').click();expect(rows).to_have_count(5)
  e.get_by_role('button',name='Show all 3 pinned messages').click();page.once('dialog',lambda d:d.dismiss());e.get_by_role('button',name='Unpin all messages',exact=True).click();expect(rows).to_have_count(3)
  page.once('dialog',lambda d:d.accept());e.get_by_role('button',name='Unpin all messages',exact=True).click();expect(e.locator('.pinned-list-header')).to_have_count(0);expect(e.locator('.pinned-carousel')).to_have_count(0);expect(rows).to_have_count(5)
  page.wait_for_function('!notes.original.clientData.imStyleEditor.settings.pinnedMessageIds');assert page.evaluate('notes.original.clientData.imStyleEditor.messages.length')==10
  assert not errors,errors
  print('PASS multiple pins',width);c.close()
 b.close()
