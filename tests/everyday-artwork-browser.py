"""Both artwork choices remain independent and survive saves/editor round trips."""
import functools,http.server,json,subprocess,threading,hashlib,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](18);parse=scope['parse']
original=(ROOT/'assets/chat-wallpaper-CalFkYM7.svg').read_bytes();assert hashlib.sha256(original).hexdigest()=='f775b9cbc68f9376d4e707a3855f4ad1f94a3d672fce6fadfcd85782b0ca8760'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];external=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if not r.url.startswith(base+'/') else None)
   page.goto(base+'/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/next/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('#append-text')).to_be_visible()
   def artwork():
    select=e.get_by_label('Artwork',exact=True)
    if not select.is_visible():
     e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Appearance',exact=True).click()
    return select
   expect(artwork()).to_have_value('classic');assert page.evaluate('saves.length')==0
   expect(artwork().locator('option[value=classic]')).to_have_text('Classic · Everyday objects');expect(artwork().locator('option[value=everyday2]')).to_have_text('Everyday Objects 2')
   artwork().select_option('everyday2');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-everyday2'))
   page.wait_for_function('saves.length>0');page.wait_for_timeout(80)
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['settings']['artwork']=='everyday2';assert saved['messages']==data['messages'];assert saved['draft']==data['draft']
   for key,value in data['settings'].items():
    if key!='artwork':assert saved['settings'][key]==value,key
   image=e.locator('.messages').evaluate('n=>getComputedStyle(n).backgroundImage');assert 'everyday-objects-2.svg' in image
   assert e.locator('.messages').evaluate('n=>getComputedStyle(n).backgroundSize')=='540px 756px'
   # Explicit reload, then a different editor: neither silently resets the choice.
   page.evaluate('openEditor("a","/next/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-everyday2'));expect(artwork()).to_have_value('everyday2')
   before=page.evaluate('saves.length');page.evaluate('openEditor("a","/mosaic/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_be_visible();page.wait_for_timeout(100);assert page.evaluate('saves.length')==before
   page.evaluate('openEditor("a","/next/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-everyday2'))
   artwork().select_option('classic');expect(e.locator('.editor-shell')).to_have_class(re.compile(r'artwork-classic'));page.wait_for_timeout(100)
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['settings']['artwork']=='classic';assert saved['messages']==data['messages'];assert saved['draft']==data['draft']
   assert 'chat-wallpaper-CalFkYM7.svg' in e.locator('.messages').evaluate('n=>getComputedStyle(n).backgroundImage')
   assert e.locator('.messages').evaluate('n=>getComputedStyle(n).backgroundSize')=='420px 420px'
   assert not errors,errors;assert not external,external
   print(f'PASS {width}px: original remains default and unchanged; V2 saves/reloads, survives Mosaic interchange, and switches back without changing messages/draft; no external requests',flush=True);context.close()
  browser.close()
finally:server.shutdown()
