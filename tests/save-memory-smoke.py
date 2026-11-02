"""Compare real SDK save history and redundant send writes using synthetic notes."""
import json,os,re,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8018')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = window.editorPath;")
HOST=HOST.replace('window.saves = [];','window.saves=[];window.saveCount=0;')
HOST=HOST.replace('saves.push(structuredClone(item));','saveCount++;saves.length=0;saves.push(structuredClone(item));')
HOST=HOST.replace('const message = event.data;',"const message=typeof event.data==='string'?JSON.parse(event.data):event.data;")
js="const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('next/src/note-format.js','utf8')+';imFormat',{crypto,btoa});console.log(JSON.stringify(f.portable(Array.from({length:5000},(_,i)=>({id:f.newId(),text:'Message '+i+': '+'A thought worth keeping. '.repeat(4),reactions:[],createdAt:'2026-11-01T00:00:00Z'})),{})));"
text=json.loads(subprocess.check_output(['node','-e',js],text=True))
new_html=Path('next/index.html').read_text()
# The immutable 4.0.6 asset is retained in the repository; no git-history depth
# or network access is needed to reproduce the before/after comparison.
baseline_html=re.sub(r'src="\./assets/[^"?]+\.js"','src="./assets/index-9aed506f1ed2.js"',new_html)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 results={}
 for label,html,width,mobile_transport in [('before',baseline_html,1000,False),('after',new_html,1000,False),('after_mobile',new_html,390,True)]:
  page=browser.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  bundle='next/'+re.search(r'src="\./([^"?]+\.js)',html)[1]
  script=Path(bundle).read_text().replace('pf=new Fm(','pf=window.__testBridge=new Fm(')+'\nwindow.__testNotePending=imNoteSavePending;'
  page.route(BASE+'/__save_memory',lambda route:route.fulfill(content_type='text/html',body=HOST))
  page.route(BASE+'/next/__save_memory.html',lambda route:route.fulfill(content_type='text/html',body=html))
  page.route(BASE+'/'+bundle,lambda route:route.fulfill(content_type='text/javascript',body=script))
  page.goto(BASE+'/__save_memory')
  page.evaluate('(text)=>{editorPath="/next/__save_memory.html";notes.large={uuid:"large",content_type:"Note",content:{text}};openIM("large")}',text)
  e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message',exact=True);expect(field).to_be_visible()
  if mobile_transport:e.locator('body').evaluate('()=>window.__testBridge.isRunningInMobileApplication=()=>true')
  for i in range(40):
   value=f'Draft {i}'
   field.fill(value)
   page.wait_for_function('(value)=>notes.large.content.text.includes("@@IM:DRAFT\\n\\n\\n"+value+"\\n\\n\\n@@IM:END-DRAFT")',arg=value)
   page.wait_for_function('()=>editor.contentWindow.__testNotePending&&!editor.contentWindow.__testNotePending("large")')
  history=e.locator('body').evaluate('''()=>{
    const records=window.__testBridge.sentMessages;
    return {retained_note_snapshots:records.filter(r=>r.data?.items?.length).length,
      retained_note_text_characters:records.reduce((sum,r)=>sum+(r.data?.items||[]).reduce((n,item)=>n+(item.content?.text?.length||0),0),0),
      reply_records:records.length};
  }''')
  before=page.evaluate('saveCount');e.get_by_role('button',name='Send message',exact=True).click();expect(field).to_have_value('')
  page.wait_for_function('()=>!editor.contentWindow.__testNotePending("large")')
  history['writes_to_send_an_already_saved_draft']=page.evaluate('saveCount')-before
  if label=='before':assert history['retained_note_snapshots']>=40
  else:
   assert history['retained_note_snapshots']==0
   assert history['writes_to_send_an_already_saved_draft']==1
   assert history['reply_records']<=2
  assert not errors,errors
  results[label]=history;print(label,json.dumps(history),flush=True)
  page.close()
 assert results['before']['writes_to_send_an_already_saved_draft']==2
 print('PASS: real SDK retains no past save bodies after the fix; acknowledged send uses one write instead of two; 5,000 bubbles; desktop object and mobile JSON transport',flush=True)
 browser.close()
