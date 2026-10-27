"""Deleting default/custom menu emojis persists without modifying tagged messages."""
import os
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
MESSAGES=[{'id':'one','text':'Keep this tagged message','createdAt':'2026-01-01T12:00:00Z','reactions':['⭐','🦋']},{'id':'two','text':'Another message','reactions':[]}]
NOTE={'uuid':'original','content_type':'Note','content':{'text':'\n'.join(m['text'] for m in MESSAGES),'appendEditorMessageData':MESSAGES,'appendEditorSettings':{'reactionOrder':['🦋','⭐','❤️']}}}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__emoji_delete',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__emoji_delete');page.evaluate('(note)=>{notes.original=note;openIM("original")}',NOTE)
  editor=page.frame_locator('#editor');expect(editor.locator('.message-bubble')).to_have_count(2)
  def arrange():
   page.keyboard.press('Escape')
   editor.get_by_role('button',name='More options',exact=True).click()
   editor.get_by_role('button',name='Arrange tags',exact=True).click()
  def remove(tag):
   action=editor.get_by_role('button',name=f'Delete {tag} from emoji menu',exact=True)
   expect(action.locator('svg')).to_have_count(1)
   action.click()
   expect(editor.locator('.tag-control .chip').filter(has_text=tag)).to_have_count(0)
  # Delete a currently active default tag. A fallback must not recreate it.
  editor.get_by_role('button',name='Filter messages by ⭐',exact=True).click()
  expect(editor.locator('.message-bubble')).to_have_count(1)
  arrange();remove('⭐')
  expect(editor.locator('.filter-status')).to_have_count(0)
  expect(editor.locator('.message-bubble')).to_have_count(2)
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.deletedEmojis.includes("⭐")')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages')==MESSAGES
  remove('🦋')
  page.wait_for_function('notes.original.clientData.imStyleEditor.settings.deletedEmojis.includes("🦋")')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages')==MESSAGES
  # Remaining default fallback entries can still be moved into a chosen order.
  before=editor.locator('.tag-control .chip').all_text_contents()
  editor.get_by_role('button',name='Move ✅ earlier',exact=True).click()
  after=editor.locator('.tag-control .chip').all_text_contents()
  assert before!=after,(before,after)
  if width==390:page.screenshot(path='/tmp/im-emoji-delete-281.png')
  page.keyboard.press('Escape');editor.locator('.message-body').first.click(button='right')
  picker=editor.locator('.reaction-picker button').all_text_contents()
  assert '⭐' not in picker and '🦋' not in picker,picker
  assert picker==[label.rsplit(' ',1)[0] for label in after]
  page.keyboard.press('Escape')
  # Rebuilding the editor and stripping all hidden metadata cannot undo deletion.
  page.evaluate('openPlain();openIM()');expect(editor.locator('.message-bubble')).to_have_count(2)
  arrange()
  expect(editor.get_by_role('button',name='Delete ⭐ from emoji menu',exact=True)).to_have_count(0)
  expect(editor.get_by_role('button',name='Delete 🦋 from emoji menu',exact=True)).to_have_count(0)
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.settings.deletedEmojis.includes("⭐")')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages')==MESSAGES
  # Add the same category to restore it; existing message tags never disappear.
  editor.get_by_role('textbox',name='Add an emoji category',exact=True).fill('⭐')
  editor.get_by_role('button',name='Add emoji',exact=True).click()
  expect(editor.get_by_role('button',name='Delete ⭐ from emoji menu',exact=True)).to_be_visible()
  expect(editor.locator('.tag-control .chip').filter(has_text='⭐')).to_have_text('⭐ 1')
  page.wait_for_function('!notes.original.clientData.imStyleEditor.settings.deletedEmojis.includes("⭐")')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages')==MESSAGES
  # Delete every remaining menu emoji; the empty order must remain intentionally empty.
  while editor.locator('.emoji-delete').count():editor.locator('.emoji-delete').first.click()
  expect(editor.locator('.tag-control')).to_have_count(0)
  page.evaluate('openPlain();openIM()');expect(editor.locator('.message-bubble')).to_have_count(2)
  arrange();expect(editor.locator('.tag-control')).to_have_count(0)
  editor.get_by_role('textbox',name='Add an emoji category',exact=True).fill('💎')
  editor.get_by_role('button',name='Add emoji',exact=True).click()
  expect(editor.locator('.tag-control')).to_have_count(1)
  expect(editor.get_by_role('button',name='Delete 💎 from emoji menu',exact=True)).to_be_visible()
  assert not errors,errors
  print(f'PASS width={width}: default/custom deletion, filter clearing, fallback order, text-only persistence, re-add and empty menu; original message records unchanged')
  context.close()
 browser.close()
