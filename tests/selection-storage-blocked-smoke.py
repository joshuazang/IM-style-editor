"""Synthetic host: denied iframe storage must not break encrypted selection preferences."""
import json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8016')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/index.html';")
js="const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('next/src/note-format.js','utf8')+';imFormat',{crypto,btoa});console.log(JSON.stringify(f.portable(Array.from({length:3},(_,i)=>({id:f.newId(),text:'Message '+i,reactions:[]})),{})));"
text=json.loads(subprocess.check_output(['node','-e',js],text=True))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1100]:
  page=browser.new_page(viewport={'width':width,'height':844},has_touch=width<600,is_mobile=width<600);errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.add_init_script("""if(window!==parent){window.__legacyStorageReads=0;Object.defineProperty(window,'localStorage',{get(){window.__legacyStorageReads++;throw new DOMException('Storage access denied in embedded editor','SecurityError');}})}""")
  page.route(BASE+'/__blocked_selections',lambda route:route.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__blocked_selections')
  page.evaluate('(text)=>{notes.a={uuid:"a",content_type:"Note",content:{text}};notes.b={uuid:"b",content_type:"Note",content:{text}};pluginPreferences={unrelated:{keep:true}};openIM("a")}',text)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');field=e.get_by_role('textbox',name='Message',exact=True)
  expect(field).to_be_visible();field.fill('Unsent draft A');page.wait_for_function('notes.a.content.text.includes("Unsent draft A")')
  expect(e.get_by_role('alert')).to_have_count(0);expect(e.get_by_role('button',name='Retry selection saving',exact=True)).to_have_count(0)
  rows.last.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  expect(e.locator('.selection-status')).to_contain_text('1 / 3 selected');aid=rows.last.get_attribute('data-message-id')
  page.wait_for_function('pluginPreferences.imStyleSelectionV1?.notes.a?.ids.length===1')
  def switch(uuid):
   page.evaluate('(uuid)=>{activeUuid=uuid;editor.contentWindow.postMessage({action:"reply",original:subscription,data:{item:structuredClone(notes[uuid])}},location.origin)}',uuid)
  for _ in range(3):
   switch('b');expect(field).to_be_visible();expect(e.locator('.selection-status')).to_have_count(0)
   expect(e.get_by_role('alert')).to_have_count(0)
   switch('a');expect(e.locator('.selection-status')).to_contain_text('1 / 3 selected')
   expect(e.locator('.message-wrap.selected')).to_have_attribute('data-message-id',aid);expect(e.get_by_role('alert')).to_have_count(0)
  assert e.locator('body').evaluate('()=>window.__legacyStorageReads')==1
  switch('b');expect(field).to_be_visible();rows.first.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  page.wait_for_function('pluginPreferences.imStyleSelectionV1?.notes.b?.ids.length===1')
  for uuid in ['a','b','a','b','a']:
   page.evaluate('(uuid)=>openIM(uuid)',uuid);expect(e.locator('.selection-status')).to_contain_text('1 / 3 selected')
   expect(e.get_by_role('alert')).to_have_count(0);expect(e.get_by_role('button',name='Retry selection saving',exact=True)).to_have_count(0)
   assert e.locator('body').evaluate('()=>window.__legacyStorageReads')==1
  page.evaluate('rejectPreferences=true');e.get_by_role('button',name='Cancel',exact=True).click()
  expect(e.get_by_role('alert')).to_contain_text('Could not confirm saving selection preferences')
  page.evaluate('rejectPreferences=false');e.get_by_role('button',name='Retry selection saving',exact=True).click()
  expect(e.get_by_role('alert')).to_have_count(0);page.wait_for_function('pluginPreferences.imStyleSelectionV1.notes.a.ids.length===0')
  expect(field).to_have_value('Unsent draft A');assert page.evaluate('pluginPreferences.imStyleSelectionV1.notes.b.ids.length')==1
  assert page.evaluate('pluginPreferences.unrelated.keep') is True
  assert 'Message ' not in json.dumps(page.evaluate('pluginPreferences'))
  assert not errors,errors
  print('PASS denied iframe storage',width,'repeated live note switches and iframe reloads; no false warning; encrypted selections and drafts preserved; real save failures still shown',flush=True)
  page.close()
 browser.close()
