from fixture_v2 import fixture_id, fixture_messages, prepare_note
"""Actual clipboard forwarding and save-failure safety across note frames."""
import json,os
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
RECORDS=[{'id':'first','text':'Forward this\n\nwith blank lines\n:::end-bubble and C:\\notes 🙂','createdAt':'2026-10-27T12:00:00.123Z','editedAt':'2026-10-27T12:01:00Z','reactions':['⭐'],'custom':{'keep':'yes'}},
 {'id':'second','text':'Second selected message','createdAt':'2026-10-27T12:03:00Z','reactions':['✅'],'separatorAfter':'\n\n'},
 {'id':'not-selected','text':'PRIVATE UNSELECTED MESSAGE','reactions':[]}]
RECORDS=fixture_messages(RECORDS)
SOURCE={'uuid':'source','content_type':'Note','content':{'title':'Source','text':''.join(m['text']+(m.get('separatorAfter','\n') if i<len(RECORDS)-1 else '') for i,m in enumerate(RECORDS)),'appendEditorMessageData':RECORDS}}
SOURCE=prepare_note(SOURCE)
DEST={'uuid':'dest','content_type':'Note','content':{'title':'Keep destination title','text':'Destination keep me','appendEditorMessageData':[{'id':'first','text':'Destination keep me','reactions':[]}],'appendEditorSettings':{'bubbleTheme':'sky','backgroundTheme':'mist','scale':1.4,'wallpaper':False,'reactionOrder':['❤️']}}}
DEST=prepare_note(DEST)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,permissions=['clipboard-read','clipboard-write'])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__forward',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__forward')
  editor=page.frame_locator('#editor')
  page.evaluate('(source)=>{notes.source=source;openIM("source")}',SOURCE)
  expect(editor.locator('.message-bubble')).to_have_count(3)
  editor.locator('.message-body').first.click(button='right');editor.get_by_role('menuitem',name='Select',exact=True).click()
  editor.locator('.message-wrap').nth(1).click()
  expect(editor.locator('.selection-tools')).to_contain_text('2 selected')
  editor.get_by_role('button',name='Export',exact=True).click()
  expect(editor.locator('.transfer-notice')).to_contain_text('2 messages exported')
  clipboard=page.evaluate('navigator.clipboard.readText()')
  assert clipboard.startswith('#!im-style-forward 2\n')
  payload=json.loads(clipboard.split('\n',1)[1]);assert payload['messages']==RECORDS[:2]
  assert 'PRIVATE UNSELECTED MESSAGE' not in clipboard
  page.evaluate('(note)=>{notes.dest=note;openIM("dest")}',DEST)
  expect(editor.locator('.message-bubble')).to_have_count(1)
  def open_import():
   editor.get_by_role('button',name='More options',exact=True).click()
   action=editor.get_by_role('button',name='Import from clipboard',exact=True)
   if width>=600:
    action.focus();action.press('Enter')
   else:action.click()
  open_import();dialog=editor.get_by_role('dialog')
  expect(dialog.get_by_role('textbox',name='Paste exported messages')).to_have_value(clipboard)
  expect(dialog.locator('.transfer-preview article')).to_have_count(2)
  assert page.evaluate('notes.dest.clientData.imStyleEditor.messages.length')==1,'Preview changed the note'
  if width==390:page.screenshot(path='/tmp/im-forward-preview-280.png')
  dialog.get_by_role('button',name='Import messages',exact=True).click()
  expect(dialog).to_have_count(0)
  expect(editor.locator('.message-bubble')).to_have_count(3)
  expect(editor.locator('.forwarded-label')).to_have_count(2)
  saved=page.evaluate('notes.dest.clientData.imStyleEditor')
  assert saved['messages'][0]['text']=='Destination keep me'
  first=saved['messages'][1];assert first['id']!=fixture_id('first') and first['forwarding']['sourceMessageId']==fixture_id('first')
  assert first['forwarding']['sourceNoteId']=='source'
  for key in ['text','createdAt','editedAt','reactions','custom']:assert first[key]==RECORDS[0][key]
  assert saved['messages'][2]['id']==fixture_id('second')
  for key in ['bubbleTheme','backgroundTheme','wallpaper','scale']:assert saved['settings'][key]==DEST['content']['appendEditorSettings'][key]
  assert saved['settings']['reactionOrder']==['❤️','✅','⭐']
  assert page.evaluate('notes.dest.content.title')=='Keep destination title'
  old_saves=page.evaluate('saves.length');open_import();dialog.get_by_role('button',name='Import messages',exact=True).click()
  expect(dialog).to_have_count(0);expect(editor.locator('.transfer-notice')).to_contain_text('No duplicates')
  assert page.evaluate('saves.length')==old_saves
  page.evaluate('openPlain();openIM()');expect(editor.locator('.forwarded-label')).to_have_count(2)
  page.wait_for_function('notes.dest.clientData?.imStyleEditor?.messages.length===3')
  assert page.evaluate('notes.dest.clientData.imStyleEditor.messages[1].forwarding.sourceMessageId')==fixture_id('first')
  print(f'PASS width={width}: actual clipboard selection transfer preserves complete metadata, collision IDs, destination settings; duplicate import changes nothing')
  # Explicit fallback when the browser denies reading the clipboard.
  frame=page.locator('#editor').content_frame
  frame.locator('body').evaluate('''()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:()=>Promise.reject(new Error('denied')),writeText:()=>Promise.reject(new Error('denied'))}})''')
  open_import();expect(dialog).to_contain_text('Paste the copied messages below')
  field=dialog.get_by_role('textbox',name='Paste exported messages')
  field.fill('Not a complete IM export');expect(dialog.get_by_role('alert')).to_contain_text('Nothing has been changed')
  expect(dialog.get_by_role('button',name='Import messages',exact=True)).to_be_disabled()
  field.fill(clipboard);expect(dialog.locator('.transfer-preview article')).to_have_count(2)
  before=page.evaluate('saves.length');dialog.get_by_role('button',name='Cancel',exact=True).click()
  assert page.evaluate('saves.length')==before
  # Copy fallback remains lossless and explicitly selected for manual copying.
  editor.locator('.message-body').nth(1).click(button='right');editor.get_by_role('menuitem',name='Select',exact=True).click()
  editor.get_by_role('button',name='Export',exact=True).click()
  export_dialog=editor.get_by_role('dialog')
  exported=export_dialog.get_by_role('textbox',name='Message export').input_value()
  assert json.loads(exported.split('\n',1)[1])['messages'][0]==first
  expect(export_dialog.get_by_role('textbox',name='Message export')).to_have_attribute('readonly','')
  export_dialog.get_by_role('button',name='Close',exact=True).click()
  # A delayed clipboard reply must not follow the user into another note.
  frame.locator('body').evaluate('''()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:()=>new Promise(resolve=>window.resolveClipboard=resolve)}})''')
  open_import();expect(dialog).to_contain_text('Reading clipboard')
  page.evaluate('''()=>{notes.other={uuid:'other',content_type:'Note',content:{text:'Keep other note'}};activeUuid='other';editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item:structuredClone(notes.other)}},location.origin)}''')
  expect(editor.locator('.message-body')).to_have_text('Keep other note')
  expect(dialog).to_have_count(0)
  frame.locator('body').evaluate('(el,text)=>window.resolveClipboard(text)',clipboard)
  expect(dialog).to_have_count(0);expect(editor.locator('.message-bubble')).to_have_count(1)
  # A host rejection keeps its original note intact; Retry persists the append.
  page.wait_for_function('notes.other.clientData?.imStyleEditor?.messages.length===1')
  original_other=page.evaluate('notes.other.content.text')
  frame.locator('body').evaluate('(el,text)=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{readText:()=>Promise.resolve(text)}})',clipboard)
  page.evaluate('rejectSaves=true');open_import()
  expect(dialog).to_be_visible()
  dialog.get_by_role('button',name='Import messages',exact=True).click()
  expect(dialog.get_by_role('alert')).to_contain_text('host has not confirmed saving')
  assert page.evaluate('notes.other.content.text')==original_other
  assert page.evaluate('notes.other.clientData.imStyleEditor.messages.length')==1
  dialog.get_by_role('button',name='Cancel',exact=True).click()
  page.evaluate('rejectSaves=false');editor.get_by_role('button',name='Retry save',exact=True).click()
  page.wait_for_function('notes.other.clientData.imStyleEditor.messages.length===3')
  assert page.evaluate('notes.other.clientData.imStyleEditor.messages[0].text')=='Keep other note'
  assert not errors,errors
  print(f'PASS width={width}: denied clipboard has paste/copy fallback, cancel/invalid import makes no changes, delayed read cannot cross notes; rejected imports retain original and support retry')
  context.close()
 browser.close()
