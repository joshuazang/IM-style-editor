"""Audit regressions: actual UI, held saves/clipboard, host revisions and caches."""
import functools, http.server, json, re, subprocess, threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_engine import chromium_options
from mosaic_helpers import fill_search,click_outside_capture,choose_tag,open_more

ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse']
bundle='mosaic/'+re.search(r'src="\./([^\"]+\.js)"',(ROOT/'mosaic/index.html').read_text()).group(1)
host=(ROOT/'tests/mosaic-host.html').read_text().replace('saves.push(item);','saves.length=0;saves.push(item);window.saveCount=(window.saveCount||0)+1;')
host=host.replace("if(rejectSaves){reply", "if(rejectSaves||(window.enforceContext&&message.data.items[0].uuid!==activeUuid)){reply")
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
    def do_GET(self):
        path=self.path.split('?',1)[0]
        if path=='/__safety':data=host.encode();kind='text/html'
        elif path=='/'+bundle:
            source=(ROOT/bundle).read_text()
            source=source.replace('function parseDocument(text) {','function parseDocument(text) {window.__perf.parses++;')
            needle='    validateMessages(messages);\n    const text=messages.map(bubble)';assert source.count(needle)==1
            source=source.replace(needle,'    window.__perf.joins++;\n'+needle)
            source=source.replace('if (!bubbleText.has(original)) {','if (!bubbleText.has(original)) {window.__perf.encodes++;')
            data=('"use strict";window.__perf={parses:0,joins:0,encodes:0};\n'+source).encode();kind='text/javascript'
        else:return super().do_GET()
        self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)

def changed(text,script):
    js="const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const s=f.inspect(fs.readFileSync(0,'utf8'));"+script+";console.log(f.portable(s.messages,s.settings,s.draft,s.reply));"
    return subprocess.run(['node','-e',js],cwd=ROOT,input=text,capture_output=True,text=True,check=True).stdout

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
small=fixture()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  def start(data=small,width=1100):
    context=browser.new_context(viewport={'width':width,'height':850},is_mobile=width<600,has_touch=width<600)
    context.add_init_script("""Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>'',writeText:text=>{if(window.__holdClipboard)return new Promise(resolve=>window.__finishClipboard=()=>resolve());return Promise.resolve();}}});""")
    page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE+'/') else None)
    page.goto(BASE+'/__safety');page.evaluate('(note)=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{title:"B",text:""}};openEditor("a")}',data['note'])
    e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_be_visible()
    return context,page,e,errors,outside
  def frame(page):return next(f for f in page.frames if f.parent_frame)
  def finish(context,errors,outside):assert not errors,errors;assert not outside,outside;context.close()

  for width in [1100,390,320]:
    context,page,e,errors,outside=start(width=width);field=e.locator('#capture-input')
    assert field.evaluate('n=>n.spellcheck') is False
    assert field.get_attribute('autocomplete')=='off' and field.get_attribute('writingsuggestions')=='false'
    page.evaluate('rejectSaves=true;enforceContext=true');field.fill('Retained failed draft 🙂\n\nStill unsent')
    expect(e.locator('#notice')).to_contain_text('Saving was not confirmed')
    page.evaluate('switchNote("b")');expect(field).to_have_value('')
    page.evaluate('switchNote("a")');expect(field).to_have_value('Retained failed draft 🙂\n\nStill unsent')
    page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click()
    expect(e.locator('#notice')).not_to_be_visible()
    expect(field).to_have_value('Retained failed draft 🙂\n\nStill unsent')
    saved=parse(page.evaluate('notes.a.content.text'));assert saved['draft']=='Retained failed draft 🙂\n\nStill unsent' and len(saved['messages'])==20
    finish(context,errors,outside);print(f'PASS {width}px: rejected draft survives switches; Retry preserves unsent state; private input defaults',flush=True)

  # A failed final submission survives switching without duplication on retry.
  context,page,e,errors,outside=start();field=e.locator('#capture-input')
  page.evaluate('rejectSaves=true');field.fill('Final message survives failure');click_outside_capture(e)
  expect(e.locator('#notice')).to_contain_text('Saving was not confirmed')
  expect(field).to_have_value('Final message survives failure')
  page.evaluate('switchNote("b")');expect(field).to_have_value('');page.evaluate('switchNote("a")')
  expect(field).to_have_value('Final message survives failure');page.evaluate('rejectSaves=false')
  e.get_by_role('button',name='Retry save',exact=True).click();expect(field).to_have_value('')
  result=parse(page.evaluate('notes.a.content.text'))
  assert len(result['messages'])==21 and sum(m['text']=='Final message survives failure' for m in result['messages'])==1
  finish(context,errors,outside)
  print('PASS: failed final Send survives switches and retries as exactly one message',flush=True)

  # More than one unfinished card edit is retained independently in this frame.
  context,page,e,errors,outside=start()
  for index in [2,3]:
    fill_search(e,'Thought '+str(index));e.locator('.card').click(button='right')
    e.get_by_role('menuitem',name='Edit',exact=True).click()
    field=e.get_by_role('textbox',name='Card title',exact=True)
    assert field.evaluate('n=>n.spellcheck') is False
    field.fill('Unfinished card '+str(index));page.evaluate('switchNote("b")');page.evaluate('switchNote("a")')
  page.evaluate('switchNote("b")');page.evaluate('switchNote("a")')
  for index in [3,2]:
    open_more(e);e.get_by_role('menuitem',name='Resume unfinished edit',exact=True).click()
    expect(e.get_by_role('textbox',name='Card title',exact=True)).to_have_value('Unfinished card '+str(index))
    e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
  result=parse(page.evaluate('notes.a.content.text'))
  assert result['messages'][2]['text'].startswith('Unfinished card 2\n') and result['messages'][3]['text'].startswith('Unfinished card 3\n')
  finish(context,errors,outside);print('PASS: multiple unfinished card edits remain separate across note switches',flush=True)

  # A late Copy or Export result rebases its status against the newest same-note item.
  for action,flag in [('Copy text','copied'),('Export','exported')]:
    context,page,e,errors,outside=start();f=frame(page);f.evaluate('window.__holdClipboard=true')
    fill_search(e,'Thought 2');e.locator('.card').click(button='right');e.get_by_role('menuitem',name=action,exact=True).click();f.wait_for_function('typeof window.__finishClipboard==="function"')
    remote=changed(small['note']['content']['text'],"s.messages[19].text='New remote body';s.draft='New remote draft'")
    page.evaluate('(text)=>{notes.a.content.text=text;notes.a.content.title="New native title";stream(notes.a)}',remote)
    expect(e.locator('#capture-input')).to_have_value('New remote draft');f.evaluate('window.__finishClipboard()')
    page.wait_for_function('(flag)=>notes.a.content.text.includes("\\n"+flag+"\\n")',arg=flag)
    result=parse(page.evaluate('notes.a.content.text'));assert result['messages'][19]['text']=='New remote body' and result['draft']=='New remote draft' and result['messages'][2][flag]
    assert page.evaluate('notes.a.content.title')=='New native title';finish(context,errors,outside)
  print('PASS: delayed Copy and Export preserve newer host messages, draft and native title',flush=True)

  # Inactive notes are not written through the current-note-only host permission.
  context,page,e,errors,outside=start();f=frame(page);f.evaluate('window.__holdClipboard=true')
  fill_search(e,'Thought 2');e.locator('.card').click(button='right');e.get_by_role('menuitem',name='Copy text',exact=True).click();f.wait_for_function('typeof window.__finishClipboard==="function"')
  page.evaluate('enforceContext=true;switchNote("b")');expect(e.locator('#capture-input')).to_have_value('')
  f.evaluate('window.__finishClipboard()');page.wait_for_timeout(80);assert page.evaluate('window.saveCount||0')==0
  page.evaluate('switchNote("a")');page.wait_for_function('(notes.a.content.text.match(/^copied$/gm)||[]).length===2')
  assert parse(page.evaluate('notes.a.content.text'))['messages'][2]['copied'];finish(context,errors,outside)
  print('PASS: clipboard status waits for its original note and never submits inactive-note snapshots',flush=True)

  # A real edit invalidates a delayed copy status for the earlier text.
  context,page,e,errors,outside=start();f=frame(page);f.evaluate('window.__holdClipboard=true')
  fill_search(e,'Thought 2');e.locator('.card').click(button='right');e.get_by_role('menuitem',name='Copy text',exact=True).click();f.wait_for_function('typeof window.__finishClipboard==="function"')
  remote=changed(small['note']['content']['text'],"s.messages[2].text='Changed while copying'")
  page.evaluate('(text)=>{notes.a.content.text=text;stream(notes.a)}',remote);expect(e.locator('.card')).to_have_count(0)
  f.evaluate('window.__finishClipboard()');page.wait_for_timeout(80);result=parse(page.evaluate('notes.a.content.text'))
  assert result['messages'][2]['text']=='Changed while copying' and not result['messages'][2].get('copied');finish(context,errors,outside)

  for queued in [False,True]:
    context,page,e,errors,outside=start();field=e.locator('#capture-input');page.evaluate('holdAck=true');field.fill('First draft')
    page.wait_for_function('acks.length>0')
    if queued:field.fill('Latest queued draft')
    page.evaluate('notes.a.content.title="Host title";notes.a.content.references=[{uuid:"fresh"}];notes.a.content.appData.unrelated.newField="keep";stream(notes.a)')
    page.evaluate('holdAck=false;releaseAcks()')
    page.wait_for_function('acks.length===0&&notes.a.content.title==="Host title"')
    expect(e.locator('#notice')).not_to_be_visible()
    content=page.evaluate('notes.a.content');assert content['references']==[{'uuid':'fresh'}] and content['appData']['unrelated']['newField']=='keep'
    assert parse(content['text'])['draft']==('Latest queued draft' if queued else 'First draft')
    finish(context,errors,outside)
  context,page,e,errors,outside=start();page.evaluate('notes.a.content.title="Idle host title";stream(notes.a)');e.locator('#capture-input').fill('Later write')
  page.wait_for_function('notes.a.content.text.includes("Later write")');assert page.evaluate('notes.a.content.title')=='Idle host title';finish(context,errors,outside)
  print('PASS: idle, in-flight and queued native metadata updates survive later saves',flush=True)

  # New host content cancels a queued local write; review preserves both versions.
  context,page,e,errors,outside=start();field=e.locator('#capture-input');page.evaluate('holdAck=true');field.fill('First pending')
  page.wait_for_function('acks.length>0');field.fill('Latest pending retained')
  remote=changed(small['note']['content']['text'],"s.messages[19].text='Remote saved content';s.draft='Remote saved draft'")
  page.evaluate('(text)=>{notes.a.content.text=text;stream(notes.a)}',remote)
  expect(e.locator('#notice')).to_contain_text('neither version is silently overwritten');page.evaluate('holdAck=false;releaseAcks()');page.wait_for_timeout(100)
  assert parse(page.evaluate('notes.a.content.text'))['draft']=='Remote saved draft'
  e.get_by_role('button',name='Review text',exact=True).click()
  expect(e.get_by_role('textbox',name='Current local note text',exact=True)).to_have_value(re.compile('Latest pending retained'))
  expect(e.get_by_role('textbox',name='Standard Notes version',exact=True)).to_have_value(re.compile('Remote saved content'))
  e.get_by_role('button',name='Use Standard Notes version',exact=True).click();e.get_by_role('button',name='Use saved version',exact=True).click()
  expect(field).to_have_value('Remote saved draft');finish(context,errors,outside)
  print('PASS: conflicting host updates stop waiting writes and retain both versions until explicit review',flush=True)

  # All text-input updates keep the cached message section after changing records.
  large=fixture(5000);large['note']['content']['text']=changed(large['note']['content']['text'],"s.draft=''")
  context,page,e,errors,outside=start(large);field=e.locator('#capture-input');field.fill('Prime cache')
  page.wait_for_function('notes.a.content.text.includes("Prime cache")');click_outside_capture(e);expect(field).to_have_value('')
  f=frame(page);f.evaluate('window.__perf={parses:0,joins:0,encodes:0}')
  for i in range(5):field.fill('Post-send draft '+str(i));page.wait_for_function('(text)=>notes.a.content.text.includes(text)',arg='Post-send draft '+str(i))
  counters=f.evaluate('window.__perf');assert counters=={'parses':0,'joins':0,'encodes':0},counters
  assert e.locator('.card').count()<80
  finish(context,errors,outside);print('PASS: 5,000-message post-send typing performs zero full parses, section joins or unchanged bubble encodes',flush=True)
  browser.close()
finally:server.shutdown()
