import json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8010')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/index.html';")
js="""const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('next/src/note-format.js','utf8')+';imFormat',{crypto,btoa});const messages=[0,1,2].map(i=>({id:f.newId(),text:'Keep message '+i,reactions:['⭐'],createdAt:'2026-11-01T12:00:00Z',copied:true,edited:true,exported:true,forwarding:{sourceNoteId:'old',sourceMessageId:f.newId()}}));console.log(JSON.stringify({text:f.portable(messages,{pinnedMessageIds:[messages[0].id]},'Keep draft'),messages}));"""
data=json.loads(subprocess.run(['node','-e',js],capture_output=True,text=True,check=True).stdout)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1000]:
  page=b.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('BROWSER ERROR:',e,flush=True)))
  page.route(BASE+'/__status',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__status')
  page.evaluate('(text)=>{notes.original={uuid:"original",content_type:"Note",content:{text}};openIM("original")}',data['text'])
  e=page.frame_locator('#editor');expect(e.locator('.message-wrap')).to_have_count(3)
  e.locator('.message-wrap').first.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  buttons=e.locator('.selection-actions > button');expect(buttons).to_have_count(5)
  assert [buttons.nth(i).get_attribute('aria-label') for i in range(5)]==['Add tags to selected messages','Copy','Export','More selection options','Delete selected messages']
  boxes=[buttons.nth(i).bounding_box() for i in range(5)];gaps=[boxes[i+1]['x']-boxes[i]['x']-boxes[i]['width'] for i in range(4)];assert max(gaps)-min(gaps)<1
  e.get_by_role('button',name='More selection options').click();dialog=e.get_by_role('dialog');expect(dialog).to_contain_text('1 selected message')
  expect(dialog.get_by_role('checkbox',name='Copied')).not_to_be_checked();expect(dialog.get_by_role('button',name='Clear selected statuses')).to_be_disabled()
  dialog.get_by_role('checkbox',name='Copied').check();page.once('dialog',lambda d:d.dismiss());dialog.get_by_role('button',name='Clear selected statuses').click();expect(dialog).to_be_visible()
  page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Clear selected statuses').click();expect(dialog).to_have_count(0)
  expect(e.locator('.message-wrap').first.locator('.message-meta')).not_to_contain_text('Copied');expect(e.locator('.message-wrap').nth(1).locator('.message-meta')).to_contain_text('Copied')
  e.get_by_role('button',name='Cancel',exact=True).click();e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Clear message statuses…',exact=True).click()
  expect(dialog).to_contain_text('All 3 messages')
  for name in ['Copied','Exported','Imported','Edited']:dialog.get_by_role('checkbox',name=name).check()
  page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Clear selected statuses').click();expect(dialog).to_have_count(0)
  expect(e.locator('.forwarded-label')).to_have_count(0)
  for word in ['Copied','Exported','edited']:expect(e.locator('.message-meta').first).not_to_contain_text(word)
  page.evaluate('openIM()');expect(e.locator('.forwarded-label')).to_have_count(0);expect(e.get_by_role('textbox',name='Message',exact=True)).to_have_value('Keep draft');expect(e.locator('.bubble-pin-marker')).to_have_count(1)
  assert not errors,errors
  print('PASS status clearing',width,'checkboxes, confirmation cancel, selected-only scope, all-message scope, uniform five-button spacing and persisted state',flush=True)
  page.close()
 b.close()
