"""Keyboard-sized viewports; no native keyboard emulation."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8001')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390]:
  page=b.new_page(viewport={'width':width,'height':844},is_mobile=True,has_touch=True)
  page.route(BASE+'/__keyboard',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__keyboard');page.evaluate('()=>{notes.original={uuid:"original",content_type:"Note",content:{text:Array(30).fill("A message to read while the keyboard is open.").join("\\n\\n")}};openIM("original")}')
  e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message',exact=True);expect(field).to_be_enabled();field.fill('An unsent draft');field.focus()
  log=e.get_by_role('log');log.evaluate('el=>el.scrollTop=el.scrollHeight');page.wait_for_timeout(150)
  for height in [844,500,650]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(180)
   expect(field).to_be_focused()
   assert log.evaluate('el=>el.scrollHeight-el.clientHeight-el.scrollTop')<=1
   last=e.locator('.message-bubble').last.bounding_box();input_box=field.bounding_box()
   gap=input_box['y']-last['y']-last['height'];assert 0<=gap<=32,(height,gap)
  # Reading earlier messages does not jump back to the bottom on resize.
  log.evaluate('el=>el.scrollTop=0');page.wait_for_timeout(100)
  page.set_viewport_size({'width':width,'height':550});page.wait_for_timeout(180)
  assert log.evaluate('el=>el.scrollTop')<5
  expect(field).to_have_value('An unsent draft');expect(field).to_be_focused()
  # Send remains usable and retains focus for another message.
  e.get_by_role('button',name='Send message',exact=True).click()
  expect(field).to_have_value('');expect(field).to_be_focused()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages.at(-1).text==="An unsent draft"')
  print('PASS',width,'viewport resize preserves focus/bottom position; last bubble clears input; Send works')
  page.close()
 b.close()
