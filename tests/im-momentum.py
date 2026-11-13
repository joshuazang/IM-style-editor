"""Native IM momentum must survive measurements of new rows above the viewport."""
"""Real touch drags do not paint press/selection feedback or open a hold menu."""
import functools,http.server,json,os,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](180);data['draft']='';data['settings'].pop('pinnedMessageIds',None);data['settings'].update(wallpaper=True,artwork=os.environ.get('IM_TEST_ARTWORK','classic'))
for i,m in enumerate(data['messages']):
 identity=m['id'];m.clear();m.update(id=identity,text=f'Message {i}. '+('Readable text. '*(1+i%6)),reactions=[],createdAt='2026-11-07T12:00:00Z')
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');page=context.new_page();page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/next/index.html",true)}',data['note']);e=page.frame_locator('#editor');lst=e.locator('.messages');expect(e.locator('#append-text')).to_be_visible();lst.evaluate('(n,id)=>new Promise(resolve=>n.imVirtual.reveal(id,resolve))',data['messages'][60]['id']);page.wait_for_timeout(250)
   lst.evaluate('n=>{const d=Object.getOwnPropertyDescriptor(Element.prototype,"scrollTop");window.writes=[];window.lastScroll=performance.now();n.addEventListener("scroll",()=>lastScroll=performance.now(),{passive:true});Object.defineProperty(n,"scrollTop",{get(){return d.get.call(this)},set(v){writes.push({at:performance.now(),from:d.get.call(this),to:v,idle:performance.now()-lastScroll});d.set.call(this,v)}})}');cdp=context.new_cdp_session(page);r=lst.bounding_box();x=r['x']+r['width']/2;y=r['y']+80
   def touch(kind,y):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':y}]})
   touch('touchStart',y)
   for offset in [30,90,170,270,390]:touch('touchMove',y+offset);page.wait_for_timeout(16)
   release=lst.evaluate('n=>n.scrollTop');touch('touchEnd',0);page.wait_for_timeout(120);after=lst.evaluate('n=>n.scrollTop');assert after<release-40,(release,after);assert lst.evaluate('()=>writes.length')==0,'Measurement anchoring must not interrupt the native fling';page.wait_for_timeout(1500);writes=lst.evaluate('()=>writes');assert len(writes)<=2,writes;assert all(w['idle']>=150 for w in writes),writes;assert page.evaluate('saves.length')==0;assert page.evaluate('notes.a.content.text')==data['note']['content']['text'];print(f'PASS {width}px: reverse fling continues after finger release, zero active-scroll writes, bounded settled correction, unchanged note',flush=True);context.close()
  browser.close()
finally:server.shutdown()
