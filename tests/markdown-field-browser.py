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
   expect(page.locator('#capture .im-format-toggle,#capture .im-format-toolbar')).to_have_count(0)
   detail.evaluate('n=>{detail.setContext("toolbar","select me");n.select();n.focus()}');page.locator('#detail').get_by_role('button',name='Text formatting',exact=True).click();page.locator('#detail').get_by_role('button',name='Bold',exact=True).click();assert detail.locator('strong').inner_text()=='select me'
   box=page.locator('#detail');heading=box.get_by_role('button',name='Heading',exact=True)
   def choices():
    if heading.get_attribute('aria-expanded')!='true':heading.click()
   for level in range(1,7):
    fill_field(detail,'Heading candidate');detail.press('Control+a');choices();box.get_by_role('button',name='Heading '+str(level),exact=True).click();expect(detail.locator('h'+str(level))).to_have_text('Heading candidate');choices()
    for choice in range(1,7):expect(box.get_by_role('button',name='Heading '+str(choice),exact=True)).to_have_attribute('aria-pressed',str(choice==level).lower())
    active=box.get_by_role('button',name='Heading '+str(level),exact=True);assert active.evaluate('n=>getComputedStyle(n).backgroundColor') not in ['rgba(0, 0, 0, 0)','transparent'];active.click();expect(detail.locator('h1,h2,h3,h4,h5,h6')).to_have_count(0);expect(detail.locator('p')).to_have_text('Heading candidate');expect(heading).to_have_attribute('aria-pressed','false');assert detail.evaluate('n=>n.value')=='Heading candidate'
   fill_field(detail,'# First\n\n### Third\n\nOrdinary')
   for selector,level in [('h1',1),('h3',3),('p',0)]:
    detail.locator(selector).click();choices()
    for choice in range(1,7):expect(box.get_by_role('button',name='Heading '+str(choice),exact=True)).to_have_attribute('aria-pressed',str(choice==level).lower())
   before=capture.evaluate('n=>n.value');capture.dispatch_event('keydown',{'key':'Enter','keyCode':229,'isComposing':True,'bubbles':True});assert capture.evaluate('n=>n.value')==before
   assert not errors,errors
   print(json.dumps({'PASS':width,'checks':'visual bold/checkboxes; capture Enter; list/quote/heading continuation; Ctrl/Meta+Enter ordinary text; Shift+Enter; undo; no capture toolbar; selection retained in Card toolbar; H1–H6 active states and removal'}),flush=True);context.close()
  browser.close()
finally:server.shutdown()
