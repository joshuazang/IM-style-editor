"""Cards autofocus at the body end except on iPhone; explicit title focus remains."""
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
profiles=[
 ('iPhone Safari','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'),
 ('iPhone WebView','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
 ('Android','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'),
 ('iPad','Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'),
 ('macOS','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15')]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for name,ua in profiles:
   mobile=name not in ['macOS'];context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},user_agent=ua,is_mobile=mobile,has_touch=mobile);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');capture=e.locator('#capture-input');expect(capture).to_be_visible();draft=capture.evaluate('n=>n.value');before=page.evaluate('notes.a.content.text');count=page.evaluate('saves.length')
   card=e.locator('.card').first
   if mobile:card.tap()
   else:card.click()
   dialog=e.locator('dialog');body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_visible();dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
   expect(capture).not_to_be_focused();original=body.evaluate('n=>n.value')
   if name.startswith('iPhone'):
    expect(body).not_to_be_focused();expect(dialog).to_be_focused();page.keyboard.type('Unfocused typing');expect(body).to_have_js_property('value',original)
    page.keyboard.press('Tab');expect(body).to_be_focused();dialog.evaluate('n=>n.focus({preventScroll:true})')
   else:
    expect(body).to_be_focused();assert body.evaluate('n=>n.selectionStart===n.value.length&&n.selectionEnd===n.value.length')
    page.keyboard.type('x');expect(body).to_have_js_property('value',original+'x');page.keyboard.press('Backspace');expect(body).to_have_js_property('value',original)
   expect(capture).to_have_js_property('value',draft)
   assert page.evaluate('saves.length')==count and page.evaluate('notes.a.content.text')==before
   if mobile:body.tap()
   else:body.click()
   expect(body).to_be_focused()
   e.get_by_role('button',name='Text formatting',exact=True).last.click();e.get_by_role('button',name='Heading',exact=True).last.click();expect(e.get_by_role('button',name='Heading 1',exact=True).last).to_be_visible()
   e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();expect(capture).to_have_js_property('value',draft);assert page.evaluate('saves.length')==count
   assert not errors,errors
   print(f'PASS {name}: restored end caret except iPhone, typing appends, explicit title focus, preserved capture draft and zero no-op opening/closing writes',flush=True);context.close()
  browser.close()
finally:server.shutdown()
