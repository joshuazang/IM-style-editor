"""Removed artwork values fall back without automatic note writes or draft loss."""
import functools,http.server,json,subprocess,threading,hashlib,re
from pathlib import Path
from zipfile import ZipFile
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](18);parse=scope['parse']
assert hashlib.sha256((ROOT/'assets/chat-wallpaper-CalFkYM7.svg').read_bytes()).hexdigest()=='f775b9cbc68f9376d4e707a3855f4ad1f94a3d672fce6fadfcd85782b0ca8760'
notes={}
for uuid,removed in [('a','everyday2'),('b','journal')]:
 settings={**data['settings'],'artwork':removed}
 text=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps({**data,'settings':settings}).encode()).decode()
 notes[uuid]={**data['note'],'uuid':uuid,'content':{**data['note']['content'],'text':text}}
version=json.loads((ROOT/'shared/release.json').read_text())['im_version']
with ZipFile(ROOT/f'IM-style-editor-{version}.zip') as package:
 assert not any('occult-field' in name or 'everyday-objects-2' in name for name in package.namelist())
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];retired=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:retired.append(r.url) if 'occult-field' in r.url or 'everyday-objects-2' in r.url else None)
   page.goto(base+'/tests/mosaic-host.html');page.evaluate('items=>{notes=items;openEditor("a","/next/index.html",true)}',notes);e=page.frame_locator('#editor');expect(e.locator('#append-text')).to_be_visible()
   def artwork():
    select=e.get_by_label('Artwork',exact=True)
    if not select.is_visible():
     e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Appearance',exact=True).click()
    return select
   for uuid in ['a','b']:
    page.evaluate('switchNote("'+uuid+'")');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-classic'))
    expect(artwork()).to_have_js_property('value','classic');assert artwork().locator('option').evaluate_all('ns=>ns.map(n=>n.value)')==['classic','garden']
    assert 'chat-wallpaper-CalFkYM7.svg' in e.locator('.messages').evaluate('n=>getComputedStyle(n).backgroundImage')
    expect(e.locator('#append-text')).to_have_js_property('value',data['draft'].replace('\r\n','\n'))
    assert page.evaluate('saves.length')==0,(width,uuid,'Unexpected automatic save')
    assert page.evaluate('notes["'+uuid+'"].content.text')==notes[uuid]['content']['text']
   # The surviving alternative still saves through the normal note channel.
   artwork().select_option('garden');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-garden'));page.wait_for_function('saves.length>0')
   saved=parse(page.evaluate('notes.b.content.text'));assert saved['settings']['artwork']=='garden';assert saved['messages']==data['messages'];assert saved['draft']==data['draft']
   assert page.evaluate('notes.a.content.text')==notes['a']['content']['text']
   page.evaluate('openEditor("b","/next/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-garden'));expect(artwork()).to_have_js_property('value','garden')
   assert not errors,errors;assert not retired,retired
   print(f'PASS {width}px: only original/Garden remain; both retired values display Classic without writes; messages/drafts retained; Garden saves/reloads; no retired-asset requests',flush=True);context.close()
  browser.close()
finally:server.shutdown()
