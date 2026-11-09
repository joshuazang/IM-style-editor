"""Mac cards open without text focus, late body resize or an idle motion layer."""
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
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options());context=browser.new_context(viewport={'width':1100,'height':900});page=context.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible()
  e.locator('#board').evaluate('''()=>{window.focusDuringMotion=[];window.motionFrames=[];document.addEventListener('focusin',e=>{if(e.target.matches('.editor-body'))focusDuringMotion.push(modalState?.cardAnimation?.playState==='running')});window.sampleCard=()=>{const frames=[],heights=[],record=modalState;let last=performance.now();function frame(now){if(modalState!==record){motionFrames.push({frames,heights});return;}frames.push(now-last);last=now;heights.push(modalState?.body?.offsetHeight);if(modal.open&&frames.length<35)requestAnimationFrame(frame);else motionFrames.push({frames,heights})}requestAnimationFrame(frame)}}''')
  for trial in range(5):
   card=e.locator('.card').nth(trial%3);card.click();dialog=e.locator('dialog');body=e.locator('.editor-body');expect(body).not_to_be_focused();e.locator('#board').evaluate('()=>sampleCard()');dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))}')
   expect(body).not_to_be_focused();expect(dialog).to_be_focused()
   assert not e.locator('#board').evaluate('()=>focusDuringMotion'),'Opening must never automatically focus the body, even after motion finishes'
   assert dialog.evaluate('n=>getComputedStyle(n,"::backdrop").backdropFilter==="none"')
   assert dialog.evaluate('n=>!n.classList.contains("card-is-moving")&&getComputedStyle(n).willChange==="auto"')
   e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();expect(card).to_be_visible()
  assert page.evaluate('saves.length')==0
  samples=e.locator('#board').evaluate('()=>motionFrames');assert all(len(set(h for h in sample['heights'] if h))<=1 for sample in samples),'Body height must stay stable during motion';deltas=sorted(v for sample in samples for v in sample['frames'][1:] if v>0)
  print(json.dumps({'PASS':'Mac repeated opening/closing: no text autofocus; stable body; released compositor hint; no saves','median_frame_ms':round(deltas[len(deltas)//2],1),'p95_frame_ms':round(deltas[int(len(deltas)*.95)],1)}),flush=True)
  context.close();browser.close()
finally:server.shutdown()
