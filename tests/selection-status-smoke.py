"""Selection toolbar layout, batch tags, draft safety and confirmed deletion."""
import os,copy
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note,fixture_messages
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8001')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
texts=['A little more room for all my thoughts and reminders. Keep everything comfortable and simple.',
 'Pick up coffee beans on the way home.', 'A slow morning, a walk by the water, and a little time to read.',
 'For the weekend: keep the afternoon open and decide what feels right when the day comes.',
 'Book a table for Saturday evening.', 'Remember to bring the notebook.']
records=fixture_messages([dict(id=str(i),text=texts[i%6],createdAt=f'2026-10-27T13:{i:02d}:00Z',reactions=['⭐'] if i==4 else ['💡'] if i==3 else []) for i in range(16)])
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':records}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},has_touch=width<600,is_mobile=width<600,permissions=['clipboard-read','clipboard-write'])
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__status',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__status');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(16)
  draft=e.get_by_role('textbox',name='Message',exact=True)
  input_width=draft.bounding_box()['width']
  def material(el):
   return el.evaluate("""el=>{const s=getComputedStyle(el);return {blur:s.backdropFilter,background:s.backgroundColor,outline:s.outlineStyle,border:s.borderColor,shadow:s.boxShadow}}""")
  normal=material(draft);draft.focus();focused=material(draft)
  assert normal==focused and normal['blur']=='none' and normal['outline']=='none' and normal['shadow']=='none',(normal,focused)
  draft.fill('Keep my unsent draft')
  if width==390:page.screenshot(path='/workspace/selection-preview/solid-input.png')
  rows.nth(3).click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();rows.nth(4).click()
  status=e.locator('.selection-status');expect(status).to_contain_text('2 messages selected')
  assert abs(status.bounding_box()['width']-input_width)<.1
  cancel_material=material(e.get_by_role('button',name='Cancel',exact=True))
  count_material=material(status.locator('span'))
  assert cancel_material['blur']==count_material['blur']=='blur(10px)'
  assert cancel_material['background']==count_material['background']
  assert material(status)['blur']=='none' 
  expect(draft).to_have_count(0)
  expect(e.get_by_role('button',name='More options',exact=True)).to_have_count(0)
  expect(e.get_by_role('button',name='Search and tags',exact=True)).to_have_count(0)
  buttons=e.locator('.selection-actions>button')
  assert buttons.evaluate_all('els=>els.map(e=>e.getAttribute("aria-label"))')==['Add tags to selected messages','Copy','Export','Delete selected messages']
  boxes=[buttons.nth(i).bounding_box() for i in range(4)]
  gaps=[boxes[i+1]['x']-boxes[i]['x']-boxes[i]['width'] for i in range(3)]
  assert max(gaps)-min(gaps)<.2 and len(set(v['y'] for v in boxes))==1,gaps
  assert all(v['height']==40 and v['width']==40 for v in boxes)
  center=status.locator('span').bounding_box();bar=status.bounding_box()
  assert center['x']>bar['x']+44 and abs(center['x']+center['width']-bar['x']-bar['width'])<1
  e.get_by_role('log').evaluate('el=>el.focus()');page.keyboard.type('Do not capture this');page.keyboard.press('Enter')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages.length')==16
  e.get_by_role('button',name='Add tags to selected messages',exact=True).click()
  expect(e.get_by_role('region',name='Batch add emoji tag')).to_be_visible()
  e.get_by_role('button',name='Add ⭐ to selected messages',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[3].reactions.includes("⭐")')
  saved=page.evaluate('notes.original.clientData.imStyleEditor.messages')
  for i,m in enumerate(saved):
   expected=copy.deepcopy(records[i])
   if i==3:expected['reactions'].append('⭐')
   assert m==expected,(i,m,expected)
  # A repeated add is idempotent.
  before=page.evaluate('saves.length');e.get_by_role('button',name='Add tags to selected messages').click();e.get_by_role('button',name='Add ⭐ to selected messages').click()
  assert page.evaluate('saves.length')==before
  if width==390:
   e.get_by_role('log').evaluate('el=>el.scrollTop=100')
   page.screenshot(path='/workspace/selection-preview/new-selection-layout.png')
   e.get_by_role('button',name='Add tags to selected messages').click()
   page.screenshot(path='/workspace/selection-preview/batch-tag-menu.png')
   e.get_by_role('button',name='Add tags to selected messages').click()
  e.get_by_role('button',name='Copy',exact=True).click()
  expect(e.locator('.transfer-notice')).to_contain_text('Copied')
  assert page.evaluate('navigator.clipboard.readText()')=='\n\n'.join(records[i]['text'] for i in [3,4])
  e.get_by_role('button',name='Cancel',exact=True).click();expect(draft).to_have_value('Keep my unsent draft')
  rows.nth(3).click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();rows.nth(4).click()
  page.once('dialog',lambda d:d.dismiss());e.get_by_role('button',name='Delete selected messages').click()
  expect(rows).to_have_count(16);expect(status).to_contain_text('2 messages selected')
  page.once('dialog',lambda d:d.accept());e.get_by_role('button',name='Delete selected messages').click()
  expect(rows).to_have_count(14);expect(draft).to_have_value('Keep my unsent draft')
  rows.first.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click()
  edit=e.get_by_role('textbox',name='Edit message',exact=True);edit.focus()
  m=material(edit)
  assert m['blur']=='none' and m['outline']=='none' and m['shadow']=='none',m
  assert material(e.locator('.composer-edit-preview'))['blur']=='none'
  e.get_by_role('button',name='Cancel editing',exact=True).click()
  expect(draft).to_have_value('Keep my unsent draft')
  assert not errors,errors
  print('PASS',width,'equally spaced SVG controls; input blocked; draft retained; additive/idempotent batch tags; copy; delete confirmation/cancel')
  c.close()
 b.close()
