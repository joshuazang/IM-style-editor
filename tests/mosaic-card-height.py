"""Content-sized opened cards, viewport limits, and edits using synthetic notes."""
import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options

ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](1)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,height in [(1100,900),(390,844),(320,430)]:
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
   page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note'])
   e=page.frame_locator('#editor');e.locator('.card').first.click()
   body=e.get_by_role('textbox',name='Card body',exact=True);dialog=e.locator('dialog')
   body.fill('A short thought.');page.wait_for_timeout(100)
   short=dialog.bounding_box()['height']
   assert short<220,(width,height,short)
   body.fill('\n'.join(['A line of text.']*7));page.wait_for_timeout(100)
   medium=dialog.bounding_box()['height'];assert medium>short+60,(short,medium)
   assert body.evaluate('n=>n.scrollHeight<=n.clientHeight+1')
   long='\n'.join(f'Line {i}: a longer thought.' for i in range(120))
   body.fill(long);page.wait_for_timeout(100)
   bounds=dialog.bounding_box();assert bounds['height']>medium,(bounds,medium)
   assert bounds['y']>=0 and bounds['y']+bounds['height']<=height,(height,bounds)
   assert e.locator('.card-detail-scroll').evaluate('n=>n.scrollHeight>n.clientHeight+100')
   close=e.get_by_role('button',name='Close',exact=True);expect(close).to_be_in_viewport()
   # Reach the final line and edit it without collapsing the scroll position.
   body.press('Control+End');body.press('End');body.type(' END')
   assert e.locator('.card-detail-scroll').evaluate('n=>n.scrollTop>0')
   # Narrowing the viewport rewraps and preserves all text; Close stays reachable.
   page.set_viewport_size({'width':320,'height':430});page.wait_for_timeout(100)
   expect(close).to_be_in_viewport();expect(body).to_have_value(long+' END')
   body.fill('Short again.');page.wait_for_timeout(100)
   assert dialog.bounding_box()['height']<220
   close.click();expect(dialog).not_to_be_visible()
   e.locator('.card').first.click()
   expect(e.get_by_role('textbox',name='Card body',exact=True)).to_have_value('Short again.')
   assert not errors,errors
   print(f'PASS {width}x{height}: compact, growing, capped, scrollable, shrinking and resizing cards',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
