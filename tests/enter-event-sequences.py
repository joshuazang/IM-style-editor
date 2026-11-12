"""Real iOS fallback and paired native Enter events produce one edit, not two."""
import functools,http.server,threading,time
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
  for ios in [True,False]:
   context=browser.new_context(viewport={'width':390 if ios else 1100,'height':900},is_mobile=ios,has_touch=ios,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if ios else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36')
   context.add_init_script("Object.defineProperty(navigator,'vendor',{get:()=> 'Apple Computer, Inc.'});Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'})")
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/markdown-field-host.html');field=page.get_by_role('textbox',name='Card body',exact=True)
   for source,selector,count in [('Seed','p',2),('# Heading','p',1),('- Item','li',2),('- [x] Task','li',2),('> Quote','blockquote p',2)]:
    fill_field(field,source);field.press('Control+End');field.press('Enter');page.wait_for_timeout(300);expect(field.locator(selector)).to_have_count(count)
   fill_field(field,'Seed');field.press('Control+End');field.press('Shift+Enter');page.wait_for_timeout(300);expect(field.locator('p')).to_have_count(1);assert field.evaluate('n=>n.imRich.view.state.doc.firstChild.childCount')==2
   # A second physical keypress must still work, including rapid repeated use.
   fill_field(field,'Seed');field.press('Control+End');field.press('Enter');field.press('Enter');page.wait_for_timeout(300);expect(field.locator('p')).to_have_count(3)
   if not ios:
    fill_field(field,'Seed');field.press('Control+End');field.evaluate('n=>{n.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:true,cancelable:true}));n.dispatchEvent(new InputEvent("beforeinput",{inputType:"insertParagraph",bubbles:true,cancelable:true}));n.dispatchEvent(new KeyboardEvent("keyup",{key:"Enter",keyCode:13,bubbles:true}))}');expect(field.locator('p')).to_have_count(2)
   # No-keydown virtual keyboards still need each beforeinput to be handled.
   fill_field(field,'Seed');field.press('Control+End')
   for _ in range(2):field.evaluate("n=>n.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true}))")
   expect(field.locator('p')).to_have_count(3)
   capture=page.get_by_role('textbox',name='Capture',exact=True);fill_field(capture,'send once');capture.press('Control+End');before=page.evaluate('sends.length');capture.press('Enter');page.wait_for_timeout(300);assert page.evaluate('sends.length')==before+1
   fill_field(field,'Chinese 中文');field.press('Control+End');field.dispatch_event('compositionstart',{});field.dispatch_event('keydown',{'key':'Enter','keyCode':229,'isComposing':True,'bubbles':True});field.evaluate("n=>n.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',isComposing:true,bubbles:true,cancelable:true}))");expect(field.locator('p')).to_have_count(1);field.dispatch_event('compositionend',{})
   if not ios:
    fill_field(field,'Long line text\n'*3000);field.press('Control+End');page.evaluate('''()=>{window.enterTimes=[];const dispatch=detail.view.dispatch;detail.view.dispatch=tr=>{const start=performance.now();dispatch(tr);enterTimes.push(performance.now()-start)}}''');field.press('Enter');assert len(page.evaluate('enterTimes'))==1;elapsed=page.evaluate('enterTimes[0]');assert elapsed<500,elapsed;print('Desktop Enter transaction ms:',elapsed,flush=True)
   assert not errors,errors;print('PASS iOS branch='+str(ios)+': one Enter, lists/headings/quotes, Shift+Enter, rapid repeats, beforeinput-only, one Send and IME confirmation',flush=True);context.close()
  browser.close()
finally:server.shutdown()
