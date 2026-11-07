"""Actual touch release, transparent strips and common selection controls."""
import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
from mosaic_helpers import fill_search
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse'];data=fixture(70)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
 def do_GET(self):
  if self.path.split('?',1)[0]=='/__host':self.path='/tests/mosaic-host.html'
  return super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
   page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE+'/') else None)
   page.goto(BASE+'/__host');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note'])
   e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_be_visible()
   assert e.locator('.board-toolbar').evaluate('n=>getComputedStyle(n).position')=='absolute'
   assert e.locator('#capture-composer').evaluate('n=>getComputedStyle(n).position')=='absolute'
   assert e.locator('.board-toolbar').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgba(0, 0, 0, 0)'
   assert e.locator('#capture-composer').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgb(255, 255, 255)'
   assert e.locator('#capture-composer').evaluate('n=>getComputedStyle(n).backdropFilter')=='none'
   assert e.locator('#search-button').evaluate('n=>getComputedStyle(n).backdropFilter')=='blur(10px)'
   # Cards remain in the scrolling viewport beneath the top and bottom strips.
   viewport=e.locator('#viewport');viewport.evaluate('n=>n.scrollTop=100');page.wait_for_timeout(150)
   assert e.locator('#app').evaluate('n=>{const r=n.getBoundingClientRect(),card=n.querySelector(".card").getBoundingClientRect();return document.elementsFromPoint(card.left+20,r.top+16).some(e=>e.closest(".card"))}')
   # The final card can still stop above the opaque typing box.
   viewport.evaluate('n=>n.scrollTop=n.scrollHeight');page.wait_for_timeout(150)
   last=e.locator('.card').last.bounding_box();capture=e.locator('#capture-composer').bounding_box()
   assert last['y']+last['height']<=capture['y']-8,(last,capture)
   if width<600:
    fill_search(e,'Thought 2');card=e.locator('[data-id="'+data['messages'][2]['id']+'"]');expect(card).to_be_visible()
    card.scroll_into_view_if_needed();page.wait_for_timeout(200)
    body=card.locator('.card-body');rect=body.bounding_box();x=rect['x']+18;y=rect['y']+12
    cdp=context.new_cdp_session(page)
    def touch(kind,x=x,y=y):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind in ['touchEnd','touchCancel'] else [{'x':x,'y':y}]})
    before=page.evaluate('notes.a.content.text');scroll=viewport.evaluate('n=>n.scrollTop')
    touch('touchStart');page.wait_for_timeout(650);expect(e.locator('#menu')).not_to_be_visible()
    body.evaluate('(n,p)=>n.dispatchEvent(new PointerEvent("contextmenu",{bubbles:true,cancelable:true,pointerType:"touch",clientX:p.x,clientY:p.y}))',{'x':x,'y':y})
    expect(e.locator('#menu')).not_to_be_visible();touch('touchEnd');expect(e.locator('#menu')).to_be_visible()
    menu=e.locator('#menu');bounds=menu.bounding_box()
    assert not(bounds['x']<=x<=bounds['x']+bounds['width'] and bounds['y']<=y<=bounds['y']+bounds['height']),(bounds,x,y)
    assert viewport.evaluate('n=>n.scrollTop')==scroll and page.evaluate('notes.a.content.text')==before
    # A synthetic release click never activates Delete. A new intentional tap works.
    menu.get_by_role('menuitem',name='Delete',exact=True).dispatch_event('click',{'detail':1})
    assert not e.locator('dialog').is_visible() and page.evaluate('notes.a.content.text')==before
    menu.get_by_role('menuitem',name='Copy',exact=True).focus();page.keyboard.press('Escape')
    # Cancelled and scrolling gestures leave the menu closed.
    touch('touchStart');page.wait_for_timeout(600);touch('touchMove',x,y+30);touch('touchEnd');expect(menu).not_to_be_visible()
    touch('touchStart');page.wait_for_timeout(600);touch('touchCancel');expect(menu).not_to_be_visible()
    # The touch behavior also leaves an existing focused capture draft unsent.
    e.locator('#capture-input').focus();touch('touchStart');page.wait_for_timeout(600);touch('touchEnd');expect(menu).to_be_visible()
    assert page.evaluate('notes.a.content.text')==before
    menu.get_by_role('menuitem',name='Select',exact=True).tap()
   else:
    fill_search(e,'Thought 2');e.locator('[data-id="'+data['messages'][2]['id']+'"]').click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
   expect(e.locator('#selection-toolbar')).to_be_visible();expect(e.locator('#selection-bar')).to_be_visible()
   assert e.locator('#search-button').is_hidden() and e.locator('#more-button').is_hidden()
   controls=e.locator('#selection-toolbar .ui-selection-action');assert controls.count()==5
   assert controls.evaluate_all('nodes=>nodes.every(n=>!n.textContent.trim())')
   assert not e.locator('#selection-bar .selection-cancel').inner_text().strip()
   assert controls.evaluate_all('nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().height))')==[40]*5
   assert e.locator('#selection-bar .selection-all').evaluate('n=>Math.round(n.getBoundingClientRect().height)')==46
   assert e.locator('#selection-bar .selection-cancel').evaluate('n=>Math.round(n.getBoundingClientRect().height)')==46
   expect(e.locator('.selection-description')).to_have_text('1 / 70 selected')
   assert e.locator('#selection-bar').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgba(0, 0, 0, 0)'
   assert e.locator('#selection-bar .selection-description').evaluate('n=>getComputedStyle(n).backdropFilter')=='blur(10px)'
   mosaic_vectors=controls.locator('svg').evaluate_all('nodes=>nodes.map(n=>n.innerHTML)')
   # Batch tagging affects the selected card only and preserves its content/status.
   e.get_by_role('button',name='Add tags to selected cards',exact=True).click()
   e.get_by_role('button',name='Add 📍 to selected cards',exact=True).click()
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][2]['reactions']==['📍']
   assert saved['messages'][2]['text']==data['messages'][2]['text'] and saved['messages'][3]==data['messages'][3]
   e.get_by_role('button',name='Selection options',exact=True).click()
   merge=e.get_by_role('menuitem',name='Merge selected',exact=True).locator('svg').inner_html()
   clear=e.get_by_role('menuitem',name='Clear message statuses',exact=True).locator('svg').inner_html()
   e.get_by_role('menuitem',name='Merge selected',exact=True).press('Escape');expect(e.locator('#menu')).not_to_be_visible()
   if width==390:page.screenshot(path='/tmp/mosaic-floating-selection.png')
   e.get_by_role('button',name='Cancel selection',exact=True).click();expect(e.locator('#capture-input')).to_be_visible()
   # IM retains its selection functions and uses the same SVGs, dimensions and frost.
   page.evaluate('openEditor("a","/next/index.html",true)');im=page.frame_locator('#editor');expect(im.get_by_role('textbox',name='Message',exact=True)).to_be_visible()
   im.locator('.message-wrap').last.click(button='right');im.get_by_role('menuitem',name='Select',exact=True).click()
   imcontrols=im.locator('.ui-selection-action');assert imcontrols.count()==5
   assert imcontrols.locator('svg').evaluate_all('nodes=>nodes.map(n=>n.innerHTML)')==mosaic_vectors
   assert imcontrols.evaluate_all('nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().height))')==[40]*5
   im.get_by_role('button',name='More selection options',exact=True).click()
   assert im.get_by_role('menuitem',name='Merge selected',exact=True).locator('svg').inner_html()==merge
   assert im.get_by_role('menuitem',name='Clear message statuses…',exact=True).locator('svg').inner_html()==clear
   assert not errors,errors;assert not outside,outside
   print(f'PASS {width}px: release-only touch menus, cancellation/phantom-click protection, transparent floating strips, opaque input, last-card clearance, matching selection controls/icons and scoped batch tags',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
