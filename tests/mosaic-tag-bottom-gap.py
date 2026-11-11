"""Pinned and unpinned short/truncated cards keep the same bottom tag gap."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')};exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](13)
texts=['Long note\n'*200,'Regards,','**Regards,**','## Regards,','Regards,\n','Regards,\n\n','Regards,<br>','a\nb','> Regards,','- Regards,','- [x] Regards,','','   ']
for i,m in enumerate(data['messages']):m['text']=texts[i];m['reactions']=['📍','✅'];m.pop('replyTo',None);m.pop('title',None)
data['settings']['pinnedMessageIds']=[m['id'] for m in data['messages']];data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,pinned in [(390,False),(390,True),(1100,False),(1100,True)]:
   data['settings']['pinnedMessageIds']=[m['id'] for m in data['messages']] if pinned else []
   data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
   page=browser.new_page(viewport={'width':width,'height':1600});page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('n=>{notes.a=n;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible();e.locator('#board').evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
   values=e.locator('.card').evaluate_all('nodes=>nodes.map(n=>{const style=getComputedStyle(n),tags=n.querySelector(".card-tags");return {gap:n.getBoundingClientRect().bottom-tags.getBoundingClientRect().bottom,expected:parseFloat(style.paddingBottom)+parseFloat(style.borderBottomWidth),truncated:n.classList.contains("is-truncated")}})')
   assert any(v['truncated'] for v in values) and any(not v['truncated'] for v in values)
   for value in values:assert abs(value['gap']-value['expected'])<1,(width,pinned,value)
   assert page.evaluate('saves.length')==0
   print(f'PASS {width}px pinned={pinned}: short/long Markdown, empty text, tags, identical bottom padding, unchanged notes',flush=True)
   page.close()
  browser.close()
finally:server.shutdown()
