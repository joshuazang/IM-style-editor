"""Checklist lines, keyboard editing, hit targets, and stable save/reopen codec."""
import functools,http.server,threading
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
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':700},has_touch=width<600,is_mobile=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/markdown-field-host.html');detail=page.get_by_role('textbox',name='Card body',exact=True);box=page.locator('#detail')
   box.get_by_role('button',name='Text formatting',exact=True).click();toggle=box.get_by_role('button',name='Checklist',exact=True)
   # Native typing and native multi-line fill exercise DOM-created paragraphs,
   # unlike the separate Markdown paste path used by the fixtures below.
   for method in ['Enter','Shift+Enter','fill']:
    fill_field(detail,'Reset');detail.press('Control+a');detail.type('First line')
    if method=='fill':detail.fill('First line\nSecond line\nThird line')
    else:
     detail.press(method);detail.type('Second line');detail.press(method);detail.type('Third line')
    detail.press('Control+a');toggle.click();expect(detail.get_by_role('checkbox')).to_have_count(3);assert detail.locator('li p').all_text_contents()==['First line','Second line','Third line']
   fill_field(detail,'First task\nSecond task');detail.press('Control+a');toggle.click();expect(detail.get_by_role('checkbox')).to_have_count(2);expect(detail.locator('li')).to_have_count(2);expect(detail.locator('br')).to_have_count(0)
   # Hit targets end before the text; tapping the first character must not check it.
   for item in detail.locator('li').all():
    target=item.get_by_role('checkbox').bounding_box();text=item.locator('p').first.bounding_box();assert target['x']+target['width']<=text['x']+1
    item.locator('p').click(position={'x':2,'y':10});expect(item.get_by_role('checkbox')).to_have_attribute('aria-checked','false')
   detail.press('Control+End');detail.get_by_role('checkbox').first.click();expect(detail.get_by_role('checkbox').first).to_have_attribute('aria-checked','true');detail.type('!');expect(detail.locator('li').last).to_contain_text('Second task!')
   detail.press('Enter');expect(detail.get_by_role('checkbox')).to_have_count(3);expect(detail.get_by_role('checkbox').last).to_have_attribute('aria-checked','false')
   # An unfinished item must reopen as an empty checkbox, not literal "[ ]" text.
   saved=detail.evaluate('n=>n.value');detail.evaluate('(n,s)=>detail.setContext("reopen",s)',saved);expect(detail.get_by_role('checkbox')).to_have_count(3);assert detail.locator('li').last.inner_text().strip()==''
   detail.press('Control+End');detail.press('Enter');expect(detail.get_by_role('checkbox')).to_have_count(2);assert detail.evaluate('n=>detail.view.state.selection.$from.depth')==1
   fill_field(detail,'- [ ] Task');detail.press('Control+Home');detail.press('Backspace');expect(detail.locator('ul')).to_have_count(0);assert detail.inner_text()=='Task'
   fill_field(detail,'- [ ] Task');detail.press('Control+End');detail.press('Shift+Enter');detail.type('continued');expect(detail.get_by_role('checkbox')).to_have_count(1);detail.press('Enter');detail.type('Next');expect(detail.get_by_role('checkbox')).to_have_count(2)
   fill_field(detail,'- [ ] First\n- [x] Second');detail.press('Control+a');toggle.click();expect(detail.locator('ul,ol')).to_have_count(0);assert detail.locator('p').all_text_contents()==['First','Second'];detail.press('Control+z');expect(detail.get_by_role('checkbox')).to_have_count(2);detail.press('Control+Shift+z');expect(detail.locator('ul,ol')).to_have_count(0)
   capture=page.get_by_role('textbox',name='Capture',exact=True);fill_field(capture,'- [x] Done');capture.press('Control+End');count=page.evaluate('sends.length');capture.press('Enter');expect(capture.get_by_role('checkbox')).to_have_count(2);expect(capture.get_by_role('checkbox').last).to_have_attribute('aria-checked','false');capture.press('Enter');assert capture.evaluate('n=>capture.view.state.selection.$from.depth')==1;assert page.evaluate('sends.length')==count
   if width<600:
    fill_field(detail,'\n'.join('- [ ] Task '+str(i) for i in range(40)));detail.evaluate('n=>n.scrollTop=0');detail.scroll_into_view_if_needed();target=detail.get_by_role('checkbox').first.bounding_box();cdp=context.new_cdp_session(page);x=target['x']+22;y=target['y']+22
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for move in range(1,7):
     cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-move*12}]});page.wait_for_timeout(25)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(180);assert detail.evaluate('n=>n.scrollTop')>10;expect(detail.locator('[role=checkbox][aria-checked=true]')).to_have_count(0);cdp.detach()
   assert not errors,errors
   print(f'PASS {width}px: multiline conversion, distinct checkbox/text taps, caret retention, empty task save/reopen, Enter/Shift+Enter/Backspace, on/off/Undo/Redo and capture no-send',flush=True);context.close()
  browser.close()
finally:server.shutdown()
