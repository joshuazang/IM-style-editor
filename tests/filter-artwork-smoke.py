from fixture_v2 import fixture_id, fixture_messages, prepare_note
"""Persistent filter state, separated emoji buttons, stable order and vector artwork."""
import os
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
ORDER=['📌','💡','❤️','⭐','✅','🛍️']
MESSAGES=[dict(id=str(i),text=f'Garden thought {i}: a quiet moment to remember.',reactions=['⭐'] if i%2==0 else ['❤️'],createdAt='2026-01-01T12:00:00Z') for i in range(18)]
MESSAGES=fixture_messages(MESSAGES)
NOTE={'uuid':'original','content_type':'Note','content':{'text':'\n'.join(m['text'] for m in MESSAGES),'appendEditorMessageData':MESSAGES,'appendEditorSettings':{'reactionOrder':ORDER}}}
NOTE=prepare_note(NOTE)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__filter',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__filter');page.evaluate('(note)=>{notes.original=note;openIM("original")}',NOTE)
  editor=page.frame_locator('#editor');expect(editor.locator('.message-bubble')).to_have_count(18)
  editor.get_by_role('button',name='Filter messages by ⭐',exact=True).first.click()
  expect(editor.locator('.filter-status')).to_contain_text('Filtering ⭐ · 9/18')
  expect(editor.locator('.filter-check')).to_be_visible()
  expect(editor.locator('.is-filtering')).to_be_visible()
  expect(editor.locator('.chip[aria-pressed=true]')).to_have_text('⭐ 9')
  for chip in editor.locator('.tag-control .chip').all():
   geometry=chip.evaluate('el=>{const c=getComputedStyle(el);return {width:parseFloat(c.borderTopWidth),border:c.borderTopColor,blur:getComputedStyle(el.closest(".search-tags-panel")).backdropFilter}}')
   assert geometry['width']>=1 and geometry['border']!='rgba(0, 0, 0, 0)',geometry
   assert geometry['blur']=='blur(10px)',geometry
  page.keyboard.press('Escape')
  expect(editor.locator('.search-tags-panel')).to_have_count(0)
  expect(editor.locator('.filter-status')).to_be_visible()
  box=editor.locator('.filter-status').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width,box
  editor.get_by_role('button',name='Clear all filters',exact=True).click()
  expect(editor.locator('.filter-status')).to_have_count(0)
  expect(editor.locator('.message-bubble')).to_have_count(18)
  editor.get_by_role('button',name='Search and tags',exact=True).click()
  editor.get_by_role('textbox',name='Search messages',exact=True).fill('thought 1:')
  expect(editor.locator('.filter-status')).to_contain_text('Filtering · Search · 1/18')
  editor.get_by_role('button',name='Clear all filters',exact=True).click()
  page.keyboard.press('Escape')
  editor.locator('.message-body').first.click(button='right')
  assert editor.locator('.reaction-picker button').all_text_contents()==ORDER
  editor.locator('.reaction-picker button').filter(has_text='💡').click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[0].reactions.includes("💡")')
  assert page.evaluate('notes.original.clientData.imStyleEditor.settings.reactionOrder')==ORDER
  editor.locator('.message-body').first.click(button='right')
  assert editor.locator('.reaction-picker button').all_text_contents()==ORDER
  expect(editor.locator('.reaction-picker button').filter(has_text='💡')).to_have_attribute('aria-pressed','true')
  page.keyboard.press('Escape')
  editor.get_by_role('button',name='More options',exact=True).click()
  editor.get_by_role('button',name='Arrange tags',exact=True).click()
  assert editor.locator('.tag-control .chip').all_text_contents()==[f'{tag} '+str(9 if tag in ['⭐','❤️'] else 1 if tag=='💡' else 0) for tag in ORDER]
  # Change an explicit order; context menu must follow exactly.
  editor.get_by_role('button',name='Move 💡 earlier',exact=True).click()
  page.keyboard.press('Escape');editor.locator('.message-body').first.click(button='right')
  assert editor.locator('.reaction-picker button').all_text_contents()==['💡','📌','❤️','⭐','✅','🛍️']
  page.keyboard.press('Escape');editor.get_by_role('button',name='More options',exact=True).click()
  editor.get_by_role('button',name='Appearance',exact=True).click()
  artwork=editor.get_by_label('Artwork',exact=True)
  expect(artwork).to_have_value('classic');artwork.select_option('garden')
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.artwork==="garden"')
  expect(editor.locator('main')).to_have_class('editor-shell bubble-lime background-sand chat-wallpaper artwork-garden')
  assert 'engraved-garden-v1.svg' in editor.locator('.messages').evaluate('el=>getComputedStyle(el).backgroundImage')
  page.keyboard.press('Escape')
  if width==390:
   page.screenshot(path='/tmp/im-garden-preview.png')
   editor.get_by_role('button',name='Filter messages by ⭐',exact=True).first.click()
   page.screenshot(path='/tmp/im-filter-preview.png')
  page.evaluate('openPlain();openIM()')
  expect(editor.locator('main')).to_have_class('editor-shell bubble-lime background-sand chat-wallpaper artwork-garden')
  assert not errors,errors
  print(f'PASS width={width}: persistent filter status, bounded layout, separated chips, stable/context/manual emoji order and artwork survives text-only switch')
  context.close()
 browser.close()
# Ensure both are real SVG drawings, with no raster payload or script.
for name in ['chat-wallpaper-CalFkYM7.svg','engraved-garden-v1.svg']:
 text=(Path('assets')/name).read_text()
 assert '<svg' in text and '<path' in text and '<image' not in text and 'base64' not in text and '<script' not in text
