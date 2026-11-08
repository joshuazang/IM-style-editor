"""Edge-scroll a 5,000-card note using real touch; keep saves and DOM bounded."""
import functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options

ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](5000);parse=scope['parse']
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options());context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
  page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible()
  # The first group is pinned in this fixture; use an unpinned card lower down.
  e.locator('#viewport').evaluate('n=>n.scrollTop=350');page.wait_for_timeout(80)
  source=e.locator('[data-id="'+data['messages'][-1]['id']+'"]');source.scroll_into_view_if_needed();box=source.bounding_box();x=box['x']+30;y=box['y']+30
  cdp=context.new_cdp_session(page)
  def touch(kind,x=0,y=0):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind in ['touchEnd','touchCancel'] else [{'x':x,'y':y}]})
  count=page.evaluate('saves.length');before=page.evaluate('notes.a.content.text');start=e.locator('#viewport').evaluate('n=>n.scrollTop')
  touch('touchStart',x,y);page.wait_for_timeout(560);touch('touchMove',x+16,y+5);expect(e.locator('.board-drag-ghost')).to_be_visible()
  e.locator('#board').evaluate('n=>{window.dragFrames=[];window.trackDrag=true;let last=performance.now();function sample(now){dragFrames.push(now-last);last=now;if(trackDrag)requestAnimationFrame(sample)}requestAnimationFrame(sample)}')
  bottom=e.locator('#capture-composer').bounding_box()['y']-8;touch('touchMove',x,bottom);page.wait_for_timeout(2200)
  scrolled=e.locator('#viewport').evaluate('n=>n.scrollTop');assert scrolled>start+600,(start,scrolled)
  assert page.evaluate('saves.length')==count and page.evaluate('notes.a.content.text')==before
  assert e.locator('.card').count()<100
  touch('touchEnd');expect(e.locator('.board-drag-ghost')).to_have_count(0)
  e.locator('#board').evaluate('n=>window.trackDrag=false');assert page.evaluate('saves.length')==count+1
  saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages']==data['messages'] and saved['draft']==data['draft']
  assert len(saved['settings']['mosaicCardOrder'])==5000
  page.wait_for_timeout(350);assert e.locator('#board').evaluate('n=>boardDrag.frame===0&&!boardDrag.gesture')
  frames=e.locator('#board').evaluate('n=>dragFrames');frames=sorted(frames);median=frames[len(frames)//2];p95=frames[int(len(frames)*.95)]
  assert median<60 and p95<180,(median,p95)
  assert not errors,errors
  print(json.dumps({'PASS':'5,000-card touch edge-scroll, off-screen source, bounded DOM, one save and exact messages/draft','scroll_pixels':scrolled-start,'rendered_cards':e.locator('.card').count(),'median_frame_ms':round(median,1),'p95_frame_ms':round(p95,1)}),flush=True)
  context.close();browser.close()
finally:server.shutdown()
