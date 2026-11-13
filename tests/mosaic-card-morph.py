"""Exact rectangle morphs, iPhone-only full pages and bounded opening work."""
import functools,http.server,threading,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](5000)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
def same(a,b):
 for k in ['x','y','width','height']:assert abs(a[k]-b[k])<1,(k,a,b)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for name,width,ua in [('iPhone',390,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),('Android',390,'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'),('Mac',1100,'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15')]:
   context=browser.new_context(viewport={'width':width,'height':844},user_agent=ua,is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible()
   e.locator('#board').evaluate('''()=>{window.openTimes=[];window.openParses=0;const open=editorDialog,parse=imFormat.inspect;editorDialog=(...args)=>{const t=performance.now();const value=open(...args);openTimes.push(performance.now()-t);return value};imFormat.inspect=(...args)=>{openParses++;return parse(...args)}}''')
   card=e.locator('.card').first;source=card.bounding_box();card.click();dialog=e.locator('dialog');expect(dialog).to_be_visible()
   dialog.evaluate('n=>{modalState.cardAnimation.pause();modalState.cardAnimation.currentTime=0}')
   same(dialog.bounding_box(),source)
   initial_height=e.locator('.editor-body').evaluate('n=>n.offsetHeight');assert initial_height>0;assert e.locator('.editor-body').evaluate('n=>n.style.height')==''
   dialog.evaluate('n=>modalState.cardAnimation.finish()');page.wait_for_timeout(30)
   assert e.locator('.editor-body').evaluate('n=>n.offsetHeight')==initial_height,'Natural body height must remain stable through the morph';assert e.locator('.editor-body').evaluate('n=>n.style.height')=='','No textarea-style height rewriting'
   end=dialog.bounding_box()
   if name=='iPhone':
    page.screenshot(path='/tmp/mosaic-1.4.12-iphone.png')
    same(end,{'x':0,'y':0,'width':width,'height':844});expect(e.get_by_role('textbox',name='Card body',exact=True)).not_to_be_focused()
    assert e.locator('.card-detail-tags').evaluate('n=>n.parentNode.classList.contains("card-detail-bottom")')
    page.set_viewport_size({'width':width,'height':430});page.wait_for_timeout(80);same(dialog.bounding_box(),{'x':0,'y':0,'width':width,'height':430});expect(e.get_by_role('button',name='Close',exact=True)).to_be_in_viewport()
   else:assert end['width']<width and end['height']<844
   # Compare the closing endpoint with the actual Board card, not a guessed offset.
   expected=card.evaluate('n=>{const r=n.getBoundingClientRect(),v=viewport.getBoundingClientRect(),c=document.querySelector("#capture-composer").getBoundingClientRect();const x=Math.max(r.left,v.left),y=Math.max(r.top,v.top);return {x,y,width:Math.min(r.right,v.right)-x,height:Math.min(r.bottom,v.bottom,c.top)-y}}')
   e.get_by_role('button',name='Close',exact=True).click();dialog.evaluate('n=>{modalState.cardAnimation.pause();modalState.cardAnimation.currentTime=320}');same(dialog.bounding_box(),expected);dialog.evaluate('n=>modalState.cardAnimation.finish()');expect(dialog).not_to_be_visible();expect(card).to_be_visible()
   card.evaluate('n=>{const id=n.dataset.id;for(let i=0;i<5;i++){editorDialog(id);modalState.cardAnimation?.finish();closeModal(true)}}')
   metrics=e.locator('#board').evaluate('()=>({open_ms:openTimes,parses:openParses,rendered:document.querySelectorAll(".card").length})');assert metrics['parses']==0 and metrics['rendered']<100;assert page.evaluate('saves.length')==0;assert dialog.evaluate('n=>!n.style.getPropertyValue("--card-view-height")')
   # An early Close reverses the in-flight expansion without jumping to full size.
   card.click()
   dialog.evaluate('''async n=>{const a=modalState.cardAnimation;a.pause();a.currentTime=160;a.play();const before=n.getBoundingClientRect();finishCard(modalState);const after=n.getBoundingClientRect();if(Math.abs(before.left-after.left)+Math.abs(before.top-after.top)+Math.abs(before.width-after.width)>1)throw Error('Reverse jumped');await a.ready;if(a.playbackRate>=0)throw Error('Not reversed');a.pause();a.currentTime=0;}''')
   same(dialog.bounding_box(),expected);dialog.evaluate('n=>modalState.cardAnimation.finish()');expect(dialog).not_to_be_visible();expect(card).to_be_visible()
   assert not errors,errors
   print(json.dumps({'PASS':name,'metrics':metrics,'checks':'exact source/return rectangles; premeasured body; platform-scoped full page; viewport resize; no saves/reparse; restored source visibility'}),flush=True);context.close()
  browser.close()
finally:server.shutdown()
