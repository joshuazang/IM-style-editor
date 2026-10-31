"""Changing new-note defaults must not rewrite saved emoji choices or bubble tags."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006');HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for order in [['🛍️','✅','⭐','💡','❤️','📌'],['🐈','📌'],['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📌']]:
  note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorSettings':{'reactionOrder':order},'appendEditorMessageData':[{'id':'saved','text':'Keep my existing pinned tag','createdAt':'2026-10-28T12:00:00Z','reactions':['📌']}]}})
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__defaults',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__defaults');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');expect(e.locator('.message-wrap')).to_have_count(1);page.wait_for_function('!!notes.original.clientData?.imStyleEditor')
  assert page.evaluate('notes.original.clientData.imStyleEditor.settings.reactionOrder')==order
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages')==note['content']['appendEditorMessageData']
  e.get_by_role('button',name='Search and tags').click();chips=e.locator('.tag-control .chip');expect(chips).to_have_count(len(order)+1)
  for i,tag in enumerate(order):assert chips.nth(i).inner_text().startswith(tag)
  expect(e.get_by_role('button',name='Untagged',exact=True)).to_be_visible()
  assert not errors,errors
  page.close()
 b.close()
 print('PASS: legacy defaults, custom emoji choices and saved 📌 bubble tags remain unchanged')
