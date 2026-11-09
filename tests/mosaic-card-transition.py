"""Opened-card tag continuity, reduced motion and interruption-safe transitions."""
import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](4)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   for reduced in [False,True]:
    context=browser.new_context(viewport={'width':width,'height':430 if width==320 else 844},reduced_motion='reduce' if reduced else 'no-preference');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');card=e.locator('.card:has(.card-tag)').first;card.click();dialog=e.locator('dialog');expect(dialog).to_be_visible()
    assert dialog.evaluate('n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}')
    assert dialog.evaluate('n=>!!modalState.cardAnimation')== (not reduced)
    dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
    tags=e.locator('.card-detail-tags');expect(tags).to_be_visible();assert tags.locator('.emoji-tag-tip').count()==tags.get_by_role('listitem').count()
    assert tags.locator('.emoji-tag-body').first.evaluate('n=>getComputedStyle(n).fill')==card.locator('.emoji-tag-body').first.evaluate('n=>getComputedStyle(n).fill')
    count=page.evaluate('saves.length');tags.get_by_role('listitem').first.click();assert page.evaluate('saves.length')==count;expect(dialog).to_be_visible()
    e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();assert page.evaluate('saves.length')==count
    card.click();body=e.get_by_role('textbox',name='Card body',exact=True);body.fill('Retain this failed edit');page.evaluate('rejectSaves=true');e.get_by_role('button',name='Close',exact=True).click();expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_visible();expect(body).to_have_value('Retain this failed edit')
    page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(dialog).not_to_be_visible()
    card.click();e.get_by_role('button',name='Close',exact=True).click();page.evaluate('stream({...notes.a,uuid:"replacement-note"})');expect(dialog).not_to_be_visible();assert e.locator('#modal-content').evaluate('n=>!n.inert')
    assert not errors,errors
    print(f'PASS {width}px reduced={reduced}: shaped accent tags, read-only badges, open/close motion, failed-save retention and safe note-switch interruption',flush=True);context.close()
  browser.close()
finally:server.shutdown()
