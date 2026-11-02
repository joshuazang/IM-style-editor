import json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8014')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/index.html';")
js="const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('next/src/note-format.js','utf8')+';imFormat',{crypto,btoa});const messages=Array.from({length:10},(_,i)=>({id:f.newId(),text:'Private fixture message '+i,reactions:[]}));console.log(JSON.stringify({messages,text:f.portable(messages,{})}));"
data=json.loads(subprocess.check_output(['node','-e',js],text=True));prefix='im-style-editor.next.selection.v1:'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route(BASE+'/__prefs',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__prefs')
 page.evaluate('({text,id})=>{notes.a={uuid:"a",content_type:"Note",content:{text}};notes.b={uuid:"b",content_type:"Note",content:{text}};localStorage.setItem("im-style-editor.next.selection.v1:a",JSON.stringify({ids:[id],height:46}));localStorage.setItem("im-style-editor.next.selection.v1:b",JSON.stringify({ids:[id]}));pluginPreferences={unrelated:{keep:true}};openIM("a")}',{'text':data['text'],'id':data['messages'][-1]['id']})
 e=page.frame_locator('#editor');expect(e.locator('.selection-status')).to_contain_text('1 / 10 selected')
 page.wait_for_function('pluginPreferences.imStyleSelectionV1?.notes.a?.ids.length===1')
 assert page.evaluate('localStorage.getItem("'+prefix+'a")') is not None
 assert page.evaluate('pluginPreferences.imStyleSelectionV1.notes.b') is None,'unopened note was migrated without verification'
 expect(e.get_by_role('status').filter(has_text='awaiting verification')).to_be_visible()
 page.evaluate('openIM("a")');expect(e.locator('.selection-status')).to_contain_text('1 / 10 selected')
 assert page.evaluate('localStorage.getItem("'+prefix+'a")') is None
 expect(e.get_by_role('status').filter(has_text='awaiting verification')).to_have_count(0)
 assert page.evaluate('pluginPreferences.unrelated.keep') is True
 original=page.evaluate('notes.a.content.text')
 e.get_by_role('button',name='Cancel',exact=True).click();page.wait_for_function('!pluginPreferences.imStyleSelectionV1.notes.a')
 assert page.evaluate('notes.a.content.text')==original
 page.evaluate('rejectPreferences=true;openIM("b")');expect(e.locator('.selection-status')).to_contain_text('1 / 10 selected')
 expect(e.get_by_role('alert')).to_contain_text('Could not confirm saving selection preferences')
 assert page.evaluate('localStorage.getItem("'+prefix+'b")') is not None
 page.evaluate('rejectPreferences=false');e.get_by_role('button',name='Retry selection saving').click()
 page.wait_for_function('pluginPreferences.imStyleSelectionV1.notes.b?.ids.length===1')
 assert page.evaluate('localStorage.getItem("'+prefix+'b")') is not None
 page.evaluate('openIM("b")');expect(e.locator('.selection-status')).to_contain_text('1 / 10 selected')
 assert page.evaluate('localStorage.getItem("'+prefix+'b")') is None
 assert page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("'+prefix+'")).length')==0
 prefs=page.evaluate('pluginPreferences');assert 'Private fixture' not in json.dumps(prefs)
 # Another browser profile has no local preferences: only the account snapshot restores the selection.
 second=browser.new_page(viewport={'width':1000,'height':844});second.route(BASE+'/__prefs',lambda r:r.fulfill(content_type='text/html',body=HOST));second.goto(BASE+'/__prefs')
 second.evaluate('({text,prefs})=>{pluginPreferences=prefs;notes.b={uuid:"b",content_type:"Note",content:{text}};openIM("b")}',{'text':data['text'],'prefs':prefs})
 f=second.frame_locator('#editor');expect(f.locator('.selection-status')).to_contain_text('1 / 10 selected')
 assert second.evaluate('localStorage.length')==0
 assert not errors,errors
 print('PASS: verified migration/deletion, unopened-note isolation, no note-text copies, failed save/retry, sparse Cancel and fresh-device account restore')
 browser.close()
