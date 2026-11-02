"""A metadata-only host echo must never restore an older draft after Send."""
import os,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8020')
BASELINE='--baseline' in sys.argv
html=Path('next/index.html').read_text()
if BASELINE:html=re.sub(r'src="\./assets/[^"?]+\.js"','src="./assets/index-d69b897314a8.js"',html)
bundle='next/'+re.search(r'src="\./([^"?]+\.js)',html)[1]
script=Path(bundle).read_text()+'\nwindow.__testPending=imNoteSavePending;window.__testLastHost=()=>pf.lastStreamedItem;window.__testContext=()=>yf;'
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/__metadata_editor.html';")
HOST=HOST.replace('window.rejectSaves = false;','window.rejectSaves=false;window.holdAck=false;window.acks=[];window.releaseAcks=()=>acks.splice(0).forEach(fn=>fn());')
HOST=HOST.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, location.origin);","const target=event.source;const reply=data=>{const send=()=>target.postMessage({action:'reply',original:message,data},location.origin);if(holdAck&&message.action==='save-items')acks.push(send);else send()};")
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1100]:
  page=browser.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.route(BASE+'/__metadata_host',lambda route:route.fulfill(content_type='text/html',body=HOST))
  page.route(BASE+'/next/__metadata_editor.html',lambda route:route.fulfill(content_type='text/html',body=html))
  page.route(BASE+'/'+bundle,lambda route:route.fulfill(content_type='text/javascript',body=script))
  page.goto(BASE+'/__metadata_host')
  page.evaluate("()=>{notes.a={uuid:'a',content_type:'Note',content:{text:'Existing fixture message'}};openIM('a')}")
  e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message',exact=True);expect(field).to_be_visible()
  partial='An unfinished draft at ninety percent'
  complete=partial+'; now the thought is finished.'
  field.fill(partial);page.wait_for_function('(value)=>notes.a.content.text.includes(value)',arg=partial)
  page.wait_for_function('()=>!editor.contentWindow.__testPending("a")')
  page.evaluate('oldDraft=structuredClone(notes.a)')
  field.fill(complete);page.wait_for_function('(value)=>notes.a.content.text.includes(value)',arg=complete)
  e.get_by_role('button',name='Send message',exact=True).click();expect(field).to_have_value('')
  expect(e.locator('.message-body').last).to_have_text(complete)
  page.wait_for_function('()=>!editor.contentWindow.__testPending("a")')
  saved=page.evaluate('notes.a.content.text')
  page.evaluate("()=>editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item:{...structuredClone(oldDraft),isMetadataUpdate:true,updated_at:'2026-11-02T20:00:00.000Z'}}},location.origin)")
  page.wait_for_function('()=>editor.contentWindow.__testLastHost()?.updated_at==="2026-11-02T20:00:00.000Z"')
  if BASELINE:
   expect(field).to_have_value(partial);expect(e.locator('.message-body')).to_have_count(1)
   print('REPRODUCED baseline',width,'same open note; after Send, metadata echo restores incomplete draft and removes the sent bubble from the view',flush=True)
   page.close();continue
  expect(field).to_have_value('');expect(e.locator('.message-body')).to_have_count(2);expect(e.locator('.message-body').last).to_have_text(complete)
  assert page.evaluate('notes.a.content.text')==saved
  assert e.locator('body').evaluate('()=>window.__testContext().content.text')==saved
  # Pending autosaves also retain their latest draft; metadata is never a save acknowledgment.
  page.evaluate('holdAck=true');field.fill('Next unsent draft remains here')
  page.wait_for_function('acks.length>0')
  for stamp in ['2026-11-02T20:00:02.000Z','2026-11-02T19:59:59.000Z']:
   page.evaluate("(stamp)=>editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item:{...structuredClone(oldDraft),isMetadataUpdate:true,updated_at:stamp}}},location.origin)",stamp)
  page.wait_for_function('()=>editor.contentWindow.__testLastHost()?.updated_at==="2026-11-02T19:59:59.000Z"')
  expect(field).to_have_value('Next unsent draft remains here');expect(e.locator('.message-body').last).to_have_text(complete)
  assert e.locator('body').evaluate('()=>window.__testPending("a")') is True
  page.evaluate('holdAck=false;releaseAcks()');page.wait_for_function('()=>!editor.contentWindow.__testPending("a")')
  # Genuine content updates still work; metadata filtering is not blanket update blocking.
  page.evaluate("()=>{notes.a.content.text=notes.a.content.text.replace('Existing fixture message','Updated fixture message');editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item:{...structuredClone(notes.a),isMetadataUpdate:false}}},location.origin)}")
  expect(e.locator('.message-body').first).to_have_text('Updated fixture message');expect(field).to_have_value('Next unsent draft remains here')
  # Metadata for another note must not act as a context switch.
  page.evaluate("()=>editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item:{uuid:'b',isMetadataUpdate:true,content:{text:'Wrong old note'},updated_at:'2026-11-02T20:00:04.000Z'}}},location.origin)")
  page.wait_for_function('()=>editor.contentWindow.__testLastHost()?.uuid==="b"')
  expect(e.locator('.message-body').first).to_have_text('Updated fixture message');expect(field).to_have_value('Next unsent draft remains here')
  assert e.locator('body').evaluate('()=>window.__testContext().uuid')=='a'
  assert not errors,errors
  print('PASS metadata sync',width,'sent bubble retained; no old draft rollback; pending draft/ack preserved; genuine updates accepted; other-note and out-of-order metadata ignored',flush=True)
  page.close()
 browser.close()
