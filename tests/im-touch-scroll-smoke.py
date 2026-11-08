"""Real touch drags do not paint press/selection feedback or open a hold menu."""
import functools,http.server,json,os,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](180);data['draft']='';data['settings'].pop('pinnedMessageIds',None);data['settings'].update(wallpaper=True,artwork=os.environ.get('IM_TEST_ARTWORK','journal'))
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
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/next/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('#append-text')).to_be_visible()
   ids=[m['id'] for m in data['messages']];list=e.locator('.messages')
   def reveal(index):list.evaluate('(n,id)=>new Promise(resolve=>{n.imVirtual.reveal(id,resolve)})',ids[index]);page.wait_for_timeout(150)
   def wrap(index):return e.locator('[data-message-id="'+ids[index]+'"]')
   def point(index):
    box=wrap(index).bounding_box();return box['x']+box['width']/2,box['y']+min(20,box['height']/2)
   reveal(75);page.wait_for_timeout(200)
   list.evaluate('n=>{const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,"scrollTop");window.noopScrollWrites=0;Object.defineProperty(n,"scrollTop",{configurable:true,get(){return descriptor.get.call(this)},set(value){const bounded=Math.max(0,Math.min(value,this.scrollHeight-this.clientHeight));if(Math.abs(descriptor.get.call(this)-bounded)<=.5)window.noopScrollWrites++;descriptor.set.call(this,value)}})}')
   cdp=context.new_cdp_session(page)
   def touch(kind,x=0,y=0):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind in ['touchEnd','touchCancel'] else [{'x':x,'y':y}]})
   x,y=point(75);top=list.evaluate('n=>n.scrollTop');touch('touchStart',x,y);page.wait_for_timeout(90)
   assert e.locator('.message-emphasized,.message-wrap.pressed,.message-wrap.selected').count()==0,'Touch-down must not look like selection'
   for offset in [18,36,54,72,90]:touch('touchMove',x,y-offset);page.wait_for_timeout(45)
   touch('touchEnd');page.wait_for_timeout(900)
   assert list.evaluate('n=>n.scrollTop')>top+20,'Native vertical scrolling must remain available'
   assert e.locator('.message-emphasized,.message-wrap.pressed,.message-wrap.selected').count()==0
   assert not e.get_by_role('menu').is_visible();assert list.evaluate('()=>window.noopScrollWrites')==0
   # Even a stationary finger cannot open a hold menu if the list moves below it.
   reveal(90);x,y=point(90);node=wrap(90);event={'pointerType':'touch','pointerId':707,'isPrimary':True,'clientX':x,'clientY':y,'bubbles':True}
   node.dispatch_event('pointerdown',event);page.wait_for_timeout(560);assert e.locator('.message-emphasized').count()==0
   list.evaluate('n=>n.scrollTop+=12');page.wait_for_timeout(70);node.dispatch_event('pointerup',event);assert not e.get_by_role('menu').is_visible()
   # Deliberate holds still open on release, and selection taps remain precise.
   reveal(100);x,y=point(100);touch('touchStart',x,y);page.wait_for_timeout(560);assert not e.get_by_role('menu').is_visible();assert e.locator('.message-emphasized').count()==0;touch('touchEnd');expect(e.get_by_role('menu')).to_be_visible()
   e.get_by_role('menuitem',name='Select',exact=True).click();expect(wrap(100)).to_have_class('message-wrap selected selection-mode')
   x,y=point(101);touch('touchStart',x,y);touch('touchEnd');expect(wrap(101)).to_have_class('message-wrap selected selection-mode')
   before={ids[100],ids[101]};x,y=point(102);touch('touchStart',x,y);touch('touchMove',x,y-60);touch('touchEnd');page.wait_for_timeout(400)
   # Momentum can carry selected rows out of the rendered window; check the
   # actual retained IDs rather than treating an unmounted row as deselected.
   assert set(page.evaluate('preferences.imStyleSelectionV1.notes.a.ids'))==before
   expect(e.locator('.selection-status')).to_contain_text('2 / 180 selected')
   assert page.evaluate('saves.length')==0;assert page.evaluate('notes.a.content.text')==data['note']['content']['text'];assert not errors,errors
   print(f'PASS {width}px: no touch-down highlight, native scroll without redundant scrollTop writes, scrolling cancels armed holds, release-only menus, precise taps and drag-safe selection; zero note writes',flush=True);context.close()
  browser.close()
finally:server.shutdown()
