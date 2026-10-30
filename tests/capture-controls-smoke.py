"""Capture controls, scoped shortcuts, pin persistence, filters and clipboard states."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':[dict(id=str(i),text=f'Message {i}',createdAt='2026-10-28T12:00:00Z',reactions=['✅'] if i%2 else []) for i in range(8)]}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,permissions=['clipboard-read','clipboard-write'])
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__capture',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__capture');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');field=e.get_by_role('textbox',name='Message',exact=True);expect(rows).to_have_count(8)
  def menu(i=0):rows.nth(i).click(button='right')
  menu();e.get_by_role('menuitem',name='Pin',exact=True).click();expect(e.get_by_role('button',name='Show pinned message')).to_contain_text('Message 0')
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.pinnedMessageIds?.length===1');page.evaluate('openIM()');expect(e.get_by_role('button',name='Show pinned message')).to_contain_text('Message 0');expect(rows).to_have_count(8)
  menu(1);e.get_by_role('menuitem',name='Pin',exact=True).click();expect(e.get_by_role('button',name='Show pinned message')).to_contain_text('Message 0')
  e.get_by_role('button',name='Show pinned message').click();expect(e.locator('.reply-located')).to_contain_text('Message 1')
  menu(1);e.get_by_role('menuitem',name='Unpin',exact=True).click();menu(0);e.get_by_role('menuitem',name='Unpin',exact=True).click();expect(e.locator('.pinned-preview')).to_have_count(0)
  field.focus();field.press('Control+f');search=e.get_by_role('textbox',name='Search messages',exact=True);expect(search).to_be_focused();search.fill('Message');search.press('Escape');expect(search).to_have_count(0)
  e.get_by_role('button',name='Search and tags').click();untagged=e.get_by_role('button',name='Untagged',exact=True);expect(untagged.locator('svg')).to_have_count(1)
  for emoji in ['1️⃣','2️⃣','3️⃣','📓','📚']:expect(e.locator('.tag-control .chip').filter(has_text=emoji)).to_have_count(1)
  for emoji in ['❤️','🛍️','⭐']:expect(e.locator('.tag-control .chip').filter(has_text=emoji)).to_have_count(0)
  untagged.click();expect(rows).to_have_count(4);expect(e.locator('.filter-status')).to_contain_text('4/8');page.keyboard.press('Escape')
  menu();e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Select all visible messages').click();expect(e.locator('.selection-status')).to_contain_text('4 messages selected');expect(e.locator('.selection-check.checked')).to_have_count(4)
  controls=[e.get_by_role('button',name='Select all visible messages'),e.locator('.selection-status>span'),e.get_by_role('button',name='Cancel',exact=True)]
  bounds=[n.bounding_box() for n in controls];assert all(abs(n['height']-46)<.1 for n in bounds),bounds
  assert max(n['y'] for n in bounds)-min(n['y'] for n in bounds)<.1,bounds
  assert bounds[-1]['x']+bounds[-1]['width']<=width-60,bounds
  page.screenshot(path=f'/tmp/capture-selection-{width}.png');page.keyboard.press('Escape');expect(e.locator('.selection-status')).to_have_count(0)
  field.fill('Message untagged capture');field.focus();field.press('Control+a');assert field.evaluate('(n)=>n.selectionStart===0&&n.selectionEnd===n.value.length')
  e.locator('body').evaluate("()=>{window.inputBlurs=0;document.querySelector('#append-text').addEventListener('blur',()=>inputBlurs++)}")
  e.get_by_role('button',name='Send message',exact=True).click();expect(rows).to_have_count(5);expect(field).to_have_value('');expect(field).to_be_focused()
  assert e.locator('body').evaluate('()=>inputBlurs')==0
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages.length===9');assert page.evaluate('notes.original.clientData.imStyleEditor.messages[8].reactions')==[]
  menu();e.get_by_role('menuitem',name='Copy',exact=True).click();notice=e.locator('.transfer-notice');expect(notice).to_contain_text('Copied')
  assert notice.bounding_box()['y']<120;assert notice.evaluate('(n)=>getComputedStyle(n).backdropFilter')=='none'
  expect(notice).to_have_count(0,timeout=6500)
  menu();e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Export',exact=True).click();expect(e.locator('.transfer-notice')).to_contain_text('exported to clipboard');payload=page.evaluate('navigator.clipboard.readText()')
  page.evaluate('()=>{notes.other={uuid:"other",content_type:"Note",content:{text:""}};openIM("other")}');expect(rows).to_have_count(0)
  e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Import from clipboard',exact=True).click();dialog=e.get_by_role('dialog');expect(dialog.get_by_role('textbox',name='Paste exported messages')).to_have_value(payload);dialog.get_by_role('button',name='Import messages',exact=True).click();expect(rows).to_have_count(1);expect(rows.first).to_contain_text('Imported');expect(rows.first).not_to_contain_text('Exported')
  menu();e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Export',exact=True).click();expect(rows.first).to_contain_text('Exported');page.keyboard.press('Escape')
  e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Appearance',exact=True).click();e.locator('select').first.select_option('iris');assert rows.first.locator('.message-bubble').evaluate('(n)=>getComputedStyle(n).backgroundColor')=='rgb(78, 92, 240)'
  page.wait_for_function('notes.other.clientData.imStyleEditor.settings.bubbleTheme==="iris"');page.evaluate('openIM()');assert rows.first.locator('.message-bubble').evaluate('(n)=>getComputedStyle(n).backgroundColor')=='rgb(78, 92, 240)'
  assert not errors,errors
  print('PASS capture controls',width);c.close()
 b.close()
