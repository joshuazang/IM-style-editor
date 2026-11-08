"""Both composers share typography; their original shapes remain distinct."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1]
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=context.new_page()
   for scale in [1,1.12,1.25,1.4]:
    for size in ['small','medium','large','extra-large']:
     settings={'bubbleTheme':'lime','backgroundTheme':'sand','wallpaper':True,'artwork':'classic','reactionOrder':['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'],'deletedEmojis':[],'scale':scale,'mosaicFontSize':size}
     text=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});process.stdout.write(JSON.stringify(f.portable([],JSON.parse(fs.readFileSync(0,'utf8')),'')));"],cwd=ROOT,input=json.dumps(settings),text=True))
     page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(text)=>{notes.a={uuid:"a",content_type:"Note",content:{text}};openEditor("a","/next/index.html",true)}',text)
     e=page.frame_locator('#editor');field=e.locator('#append-text');expect(field).to_be_visible()
     measure='n=>{const s=getComputedStyle(n);return {font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,line:s.lineHeight,padding:s.paddingTop,radius:s.borderRadius,height:n.getBoundingClientRect().height}}'
     im=field.evaluate(measure);page.evaluate('openEditor("a","/mosaic/index.html",true)');e=page.frame_locator('#editor');field=e.locator('#capture-input');expect(field).to_be_visible();mosaic=field.evaluate(measure)
     for key in ['font','size','weight','line','padding']:assert mosaic[key]==im[key],(width,settings,key,im,mosaic)
     assert abs(float(mosaic['size'][:-2])-16*scale)<.01
     assert mosaic['padding']=='10px' and im['radius']=='22px'
     assert e.locator('#capture-composer').evaluate('n=>getComputedStyle(n).borderRadius')=='14px'
     assert mosaic['radius']=='0px'
     assert mosaic['height']<=max(46,float(mosaic['line'][:-2])+20)+1
     assert page.evaluate('saves.length')==0
   print(f'PASS {width}px: identical composer family/size/weight/line height at all four scales and all Mosaic card sizes, 10px padding, original shapes and zero saves',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
