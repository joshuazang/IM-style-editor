"""Sending inherits only the current emoji filter; selected filters retain frost."""
import os
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
ORDER=['📌','💡','❤️','⭐','✅','🛍️']
MESSAGES=[dict(id=str(i),text=f'Underlying message {i}',reactions=['⭐'] if i%2==0 else ['❤️'],createdAt='2026-01-01T12:00:00Z') for i in range(18)]
NOTE={'uuid':'original','content_type':'Note','content':{'text':'\n'.join(m['text'] for m in MESSAGES),'appendEditorMessageData':MESSAGES,'appendEditorSettings':{'reactionOrder':ORDER}}}

def material(locator):
 return locator.evaluate('''el=>{const s=getComputedStyle(el),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');c.fillStyle=s.backgroundColor;c.fillRect(0,0,1,1);return {alpha:c.getImageData(0,0,1,1).data[3],blur:s.backdropFilter||s.webkitBackdropFilter,border:parseFloat(s.borderTopWidth),borderColor:s.borderTopColor,before:getComputedStyle(el,'::before').content,color:s.color}}''')

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__send_filter',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__send_filter');page.evaluate('(note)=>{notes.original=note;openIM("original")}',NOTE)
  editor=page.frame_locator('#editor');expect(editor.locator('.message-bubble')).to_have_count(18)
  toggle=editor.get_by_role('button',name='Search and tags',exact=True)
  composer=editor.get_by_role('textbox',name='Message',exact=True)
  send=editor.get_by_role('button',name='Send message',exact=True)
  def select_tag(tag):
   if editor.locator('.search-tags-panel').count()==0:toggle.click()
   editor.locator('.tag-control .chip').filter(has_text=tag).click()
  def assert_last(text,tags):
   page.wait_for_function('(text)=>notes.original.clientData?.imStyleEditor?.messages.at(-1).text===text',arg=text)
   assert page.evaluate('notes.original.clientData.imStyleEditor.messages.at(-1).reactions')==tags
   assert page.evaluate('notes.original.clientData.imStyleEditor.settings.reactionOrder')==ORDER
  # Empty to-do view: the new bubble must appear here immediately with its tag.
  select_tag('✅');expect(editor.locator('.message-bubble')).to_have_count(0)
  composer.fill('A new to-do');send.click();assert_last('A new to-do',['✅'])
  expect(editor.locator('.message-bubble')).to_have_count(1)
  expect(editor.get_by_role('button',name='Filter messages by ✅',exact=True)).to_be_visible()
  expect(editor.locator('.filter-status')).to_contain_text('Filtering ✅ · 1/19')
  # Selecting an existing bubble badge uses the same state as the menu.
  editor.get_by_role('button',name='Filter messages by ✅',exact=True).click()
  selected=editor.locator('.chip[aria-pressed=true]');expect(selected).to_have_text('✅ 1')
  look=material(selected);assert look['border']>=3,look
  assert abs(look['alpha']-round(255*.44))<=3,look
  assert look['before'] in ['none','normal'],look
  assert selected.locator('svg,img').count()==0
  # The selected chip stays neutral; the outline carries the emphasis.
  assert look['borderColor']=='rgb(82, 106, 145)',look
  inactive=material(editor.locator('.tag-control .chip').filter(has_text='⭐'))
  assert inactive['alpha']<look['alpha']<150,(inactive,look)
  page.keyboard.press('Escape')
  status=editor.locator('.filter-status');surface=material(status)
  assert abs(surface['alpha']-round(255*.22))<=3 and surface['blur']=='blur(10px)',surface
  bounds=status.bounding_box()
  for control in [toggle,editor.get_by_role('button',name='More options',exact=True)]:
   box=control.bounding_box();assert abs(box['y']-bounds['y'])<.1 and abs(box['height']-bounds['height'])<.1,(bounds,box)
   assert bounds['x']+bounds['width']<=box['x'],(bounds,box)
  close=status.get_by_role('button',name='Clear all filters',exact=True).bounding_box()
  label=status.locator('span').bounding_box();assert close['x']+close['width']<=label['x'],(close,label)
  # Drafts use the tag at send time, not the tag when typing began.
  composer.fill('Draft sent under another category');select_tag('❤️')
  send.click();assert_last('Draft sent under another category',['❤️'])
  expect(editor.locator('.filter-status')).to_contain_text('Filtering ❤️ · 10/20')
  editor.get_by_role('button',name='Clear all filters',exact=True).click()
  expect(editor.locator('.filter-status')).to_have_count(0)
  composer.fill('No filter, no category');composer.press('Enter');assert_last('No filter, no category',[])
  # Search alone never assigns a category, even if results are filtered.
  toggle.click();search=editor.get_by_role('textbox',name='Search messages',exact=True)
  search.fill('Search-only');composer.fill('Search-only result');send.click();assert_last('Search-only result',[])
  expect(editor.locator('.filter-status')).to_contain_text('Filtering · Search · 1/22')
  # Combined search/tag filtering still assigns only the emoji.
  select_tag('⭐');search.fill('Combined');composer.fill('Combined result');send.click();assert_last('Combined result',['⭐'])
  expect(editor.locator('.filter-status')).to_contain_text('Filtering ⭐ · Search · 1/23')
  if width==390:
   editor.get_by_role('button',name='Filter messages by ⭐',exact=True).click()
   page.screenshot(path='/tmp/im-filter-272.png')
  # The assigned tag belongs to the portable note, not just UI state.
  page.evaluate('openPlain();openIM()')
  expect(editor.locator('.message-bubble')).to_have_count(23)
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===23')
  assert_last('Combined result',['⭐'])
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages.find(m=>m.text==="A new to-do").reactions')==['✅']
  assert not errors,errors
  print(f'PASS width={width}: menu/badge/send-time filters, no-tag/search-only/combined sends, persistence, neutral outlined selection, frosted aligned status with left clear control')
  context.close()
 browser.close()
