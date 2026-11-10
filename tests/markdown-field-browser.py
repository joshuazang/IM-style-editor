"""Real visual editing, structural Enter, universal format exit and undo."""
import functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   context=browser.new_context(viewport={'width':width,'height':900});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/markdown-field-host.html');capture=page.get_by_role('textbox',name='Capture',exact=True);detail=page.get_by_role('textbox',name='Card body',exact=True)
   expect(capture).to_be_editable();fill_field(capture,'ordinary');capture.press('Enter');assert page.evaluate('sends')==['ordinary']
   for source,kind in [('- item','bullet_list'),('- [x] done','bullet_list'),('1. item','ordered_list'),('> quote','blockquote'),('# Heading','heading')]:
    capture.evaluate('(n,s)=>{capture.setContext(s,s);n.setSelectionRange(n.value.length,n.value.length);n.focus()}',source);count=page.evaluate('sends.length');capture.press('Enter');assert page.evaluate('sends.length')==count;capture.press('Control+Enter');assert capture.evaluate('n=>capture.view.state.selection.$from.depth===1&&capture.view.state.selection.$from.parent.type.name==="paragraph"');assert page.evaluate('sends.length')==count
   capture.evaluate('n=>{capture.setContext("bold","text");n.select();n.focus()}');capture.press('Control+b');assert capture.locator('strong').inner_text()=='text';capture.press('Control+Enter');capture.type('normal');assert capture.locator('p').last.inner_text()=='normal';assert capture.locator('p').last.locator('strong').count()==0;capture.press('Control+z');assert 'normal' not in capture.inner_text()
   fill_field(detail,'card text');count=page.evaluate('sends.length');detail.press('Enter');detail.type('second');detail.press('Meta+Enter');detail.type('third');assert detail.locator('p').count()==3;assert page.evaluate('sends.length')==count
   detail.press('Shift+Enter');detail.type('fourth');assert detail.locator('p').count()==3;assert detail.locator('br').count()>=1
   capture.evaluate('n=>{capture.setContext("task","- [ ] task");n.focus()}');capture.get_by_role('checkbox').click();assert '[x]' in capture.evaluate('n=>n.value')
   capture.evaluate('n=>{capture.setContext("toolbar","select me");n.select();n.focus()}');page.locator('#capture').get_by_role('button',name='Text formatting',exact=True).click();page.locator('#capture').get_by_role('button',name='Bold',exact=True).click();assert capture.locator('strong').inner_text()=='select me'
   before=capture.evaluate('n=>n.value');capture.dispatch_event('keydown',{'key':'Enter','keyCode':229,'isComposing':True,'bubbles':True});assert capture.evaluate('n=>n.value')==before
   assert not errors,errors
   print(json.dumps({'PASS':width,'checks':'visual bold/checkboxes; capture Enter; list/quote/heading continuation; Ctrl/Meta+Enter ordinary text; Shift+Enter; undo; selection retained by toolbar'}),flush=True);context.close()
  browser.close()
finally:server.shutdown()
