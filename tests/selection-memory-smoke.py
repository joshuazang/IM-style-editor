import json,os,re,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8012')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/index.html';")
js="""const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('next/src/note-format.js','utf8')+';imFormat',{crypto,btoa});const messages=Array.from({length:500},(_,i)=>({id:f.newId(),text:'Message '+i,reactions:i%2?['⭐']:[],createdAt:'2026-11-01T12:00:00Z'}));console.log(JSON.stringify({text:f.portable(messages,{}),messages}));"""
data=json.loads(subprocess.run(['node','-e',js],text=True,capture_output=True,check=True).stdout)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1100]:
  page=b.new_page(viewport={'width':width,'height':844},has_touch=width<600,is_mobile=width<600);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>parent.copied=text},configurable:true})")
  page.route(BASE+'/__selection_memory',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__selection_memory')
  page.evaluate('(text)=>{for(const uuid of ["a","b"])notes[uuid]={uuid,content_type:"Note",content:{text}};openIM("a")}',data['text'])
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows.last).to_contain_text('Message 499')
  aid=rows.last.get_attribute('data-message-id');rows.last.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  expect(e.locator('.selection-status')).to_contain_text('1 out of 500 messages selected')
  e.get_by_role('button',name='Copy',exact=True).click();expect(e.locator('.message-wrap.selected .message-meta')).to_contain_text('Copied')
  def switch(uuid):
   page.evaluate('(uuid)=>{activeUuid=uuid;editor.contentWindow.postMessage({action:"reply",original:subscription,data:{item:structuredClone(notes[uuid])}},location.origin)}',uuid)
  switch('b');expect(e.locator('.selection-status')).to_have_count(0);expect(e.get_by_role('textbox',name='Message',exact=True)).to_be_visible()
  bid=rows.first.get_attribute('data-message-id');assert bid!=aid
  rows.first.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  switch('a');expect(e.locator('.selection-status')).to_contain_text('1 out of 500 messages selected');expect(e.locator('.message-wrap.selected')).to_have_attribute('data-message-id',aid)
  # Recreating the iframe is how some hosts switch editors/notes.
  page.evaluate('openIM("b")');expect(e.locator('.selection-status')).to_contain_text('1 out of 500 messages selected');expect(e.locator('.message-wrap.selected')).to_have_attribute('data-message-id',bid)
  page.evaluate('openIM("a")');expect(e.locator('.selection-status')).to_contain_text('1 out of 500 messages selected');expect(e.locator('.message-wrap.selected')).to_have_attribute('data-message-id',aid)
  e.get_by_role('button',name='Cancel',exact=True).click();page.evaluate('openIM("a")');expect(e.locator('.selection-status')).to_have_count(0)
  page.evaluate('openIM("b")');expect(e.locator('.selection-status')).to_contain_text('1 out of 500 messages selected');e.get_by_role('button',name='Cancel',exact=True).focus();page.keyboard.press('Escape');expect(e.locator('.selection-status')).to_have_count(0);page.evaluate('openIM("b")');expect(e.locator('.selection-status')).to_have_count(0)
  # Delete a selected record externally and reopen: no phantom selection remains.
  rows.last.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
  raw=page.evaluate('notes.b.content.text');raw=re.sub(r'(?ms)^@@IM:BUBBLE\nid: '+re.escape(aid)+r'\n.*?(?=^@@IM:BUBBLE\n|^@@IM:END\n)','',raw)
  page.evaluate('(text)=>{notes.b.content.text=text;openIM("b")}',raw);expect(e.locator('.selection-status')).to_have_count(0)
  # Stored UI state contains IDs/height only, never message bodies or drafts.
  stored=page.evaluate('Object.entries(localStorage).filter(([key])=>key.startsWith("im-style-editor.next.selection."))')
  assert all('Message ' not in value for key,value in stored)
  assert not errors,errors
  print('PASS selection memory',width,'live note switching, iframe recreation, independent scopes, copy persistence, total count, Cancel/Escape and missing-record cleanup',flush=True)
  page.close()
 b.close()
