"""Native live Markdown typing, visual re-editing, and Chinese IME scroll stability."""
import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
def check_ime_scroll(page,context,field):
 fill_field(field,'Line\n'*70);field.press('Control+End');field.evaluate('n=>n.scrollTop=n.scrollHeight');before=field.evaluate('n=>n.scrollTop');assert before>1000
 cdp=context.new_cdp_session(page);cdp.send('Input.imeSetComposition',{'text':'zhong','selectionStart':5,'selectionEnd':5});field.dispatch_event('keydown',{'key':' ','code':'Space','keyCode':229,'isComposing':True,'bubbles':True});cdp.send('Input.insertText',{'text':'中文'});page.wait_for_timeout(150)
 assert field.evaluate('n=>n.value.endsWith("中文")');after=field.evaluate('n=>n.scrollTop');assert after>=before-2,(before,after)
 assert field.evaluate('n=>n.lastElementChild.getBoundingClientRect().bottom<=n.getBoundingClientRect().bottom+2'),'IME confirmation must leave the end caret visible'
 cdp.detach()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;openEditor("a",path,true)}',[scope['fixture'](0)['note'],path]);e=page.frame_locator('#editor');im=path.startswith('/next');field=e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True);expect(field).to_be_visible()
    for soft in [False,True]:
     for prefix,selector in [('- ','ul'),('3. ','ol'),('## ','h2'),('> ','blockquote'),('- [ ] ','li[data-task]')]:
      field.click();field.press('Control+a');field.press('Backspace')
      if soft:field.type('Leading text');field.press('Shift+Enter')
      field.type(prefix);expect(field.locator(selector)).to_have_count(1);field.type('Visible item');assert prefix.strip() not in field.locator(selector).inner_text()
      if prefix=='3. ':expect(field.locator('ol')).to_have_attribute('start','3')
      if soft:assert field.locator(':scope>p').first.inner_text()=='Leading text'
    for source,selector in [('**Live bold**','strong'),('~~Live strike~~','s')]:
     field.press('Control+a');field.press('Backspace');field.type(source);expect(field.locator(selector)).to_have_text(source.strip('*~'))
    if im:check_ime_scroll(page,context,field)
    # A sent native list must reopen visually, with no Markdown marker text.
    field.press('Control+a');field.press('Backspace');field.type('- Live item');expect(field.locator('ul')).to_have_count(1);e.get_by_role('button',name='Send message' if im else 'Send',exact=True).click();expect(field).to_have_js_property('value','')
    if im:
     e.locator('[data-message-id]').last.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click();field=e.get_by_role('textbox',name='Edit message',exact=True)
    else:e.locator('.card').last.click();field=e.get_by_role('textbox',name='Card body',exact=True)
    expect(field.locator('li p')).to_have_text('Live item');assert not field.inner_text().lstrip().startswith(('-','*'))
    if im:
     check_ime_scroll(page,context,field);expect(e.get_by_role('textbox',name='Edit message',exact=True)).to_be_visible()
    assert not errors,errors
    print(f'PASS {width}px {path}: native live list/heading/quote/inline typing, soft-line prefixes, visual sent-message editing'+('; Chinese composition retains scroll/caret' if im else ''),flush=True);context.close()
  browser.close()
finally:server.shutdown()
