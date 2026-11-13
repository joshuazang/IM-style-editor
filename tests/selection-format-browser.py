"""One shared selection toolbar: native ranges, all editable scopes, no layout jumps."""
import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')};exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   for mode in ['im-capture','im-edit','mosaic-capture','mosaic-card']:
    select_all='Meta+a' if width==1100 else 'Control+a'
    im=mode.startswith('im-');path='/next/index.html' if im else '/mosaic/index.html';context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'} if width==390 else {}))
    if width==1100:context.add_init_script("Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'})")
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a",path,true)}',[scope['fixture'](1)['note'],path]);e=page.frame_locator('#editor')
    if mode=='im-edit':
     e.locator('[data-message-id]').first.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click()
    if mode=='mosaic-card':e.locator('.card').first.click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
    field=e.get_by_role('textbox',name={'im-capture':'Message','im-edit':'Edit message','mosaic-capture':'Take a note','mosaic-card':'Card body'}[mode],exact=True);expect(field).to_be_editable();fill_field(field,'alpha beta gamma');field.press('End');popup=e.locator('.im-format-toolbar.is-selection-format');expect(popup).to_have_count(0)
    before=field.bounding_box();manual=None
    if mode=='mosaic-card':
     e.get_by_role('button',name='Text formatting',exact=True).click();manual=e.get_by_role('toolbar',name='Text formatting',exact=True).element_handle();e.get_by_role('button',name='Text formatting',exact=True).click()
    def point(offset):
     local=field.evaluate('(n,i)=>{const r=document.createRange();r.setStart(n.querySelector("p").firstChild,i);r.collapse(true);const a=r.getBoundingClientRect(),b=n.getBoundingClientRect();return {x:a.left-b.left+.2,y:a.top-b.top+a.height/2}}',offset);box=field.bounding_box();return box['x']+local['x'],box['y']+local['y']
    page.mouse.move(*point(6));page.mouse.down();page.mouse.move(*point(10),steps=5);page.mouse.up()
    if width<600:
     expect(popup).to_have_count(0);assert field.evaluate('()=>getSelection().toString()')=='beta';assert field.bounding_box()==before
     if mode=='mosaic-card':
      toggle=e.get_by_role('button',name='Text formatting',exact=True);toggle.click();tools=e.get_by_role('toolbar',name='Text formatting',exact=True);expect(tools).to_be_visible();expect(popup).to_have_count(0)
      tools.get_by_role('button',name='Bold',exact=True).click();expect(field.locator('strong')).to_have_text('beta');assert field.evaluate('()=>getSelection().toString()')=='beta'
      tools.get_by_role('button',name='Bold',exact=True).click();expect(field.locator('strong')).to_have_count(0)
      for level in [3,6]:
       fill_field(field,'#'*level+' Imported heading');field.press('Control+End');expect(tools.get_by_role('button',name='Heading '+str(level),exact=True)).to_have_attribute('aria-pressed','true');tools.get_by_role('button',name='Heading '+str(level),exact=True).click();expect(field.locator('h'+str(level))).to_have_count(0)
      toggle.click()
     else:expect(e.locator('.im-format-toggle')).to_have_count(0)
     field.press(select_all);expect(popup).to_have_count(0);page.set_viewport_size({'width':width,'height':430});expect(popup).to_have_count(0)
     if mode=='mosaic-card':
      field.press('Escape');expect(e.locator('dialog')).to_be_visible();assert field.evaluate('n=>n.imRich.view.state.selection.empty');field.press('Escape');expect(e.locator('dialog')).not_to_be_visible()
     page.evaluate('switchNote("b")');expect(popup).to_have_count(0);assert not errors,errors
     print(f'PASS {width}px {mode}: phone selection keeps native highlight, no automatic toolbar, manual Card Aa formatting retained, resize and Escape',flush=True);context.close();continue
    expect(popup).to_be_visible();assert field.bounding_box()==before
    box=popup.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1 and box['y']>=-1,(mode,width,box)
    for label in ['Quotation block','Bold','Strikethrough','Bullet list','Numbered list','Checklist','Clear Formatting']:expect(popup.get_by_role('button',name=label,exact=True).locator('svg')).to_have_count(1)
    if manual:assert manual.evaluate('(n)=>n.classList.contains("is-selection-format")')
    assert field.evaluate('()=>getSelection().toString()')=='beta'
    # Formatting may indent/reflow the selection; its popup stays under the
    # user's pointer through on/off actions in every desktop editable scope.
    for label in ['Bullet list','Numbered list','Checklist']:
     position=popup.bounding_box();command=popup.get_by_role('button',name=label,exact=True)
     for _ in range(2):
      command.click();popup.evaluate('n=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');next_position=popup.bounding_box()
      assert abs(position['x']-next_position['x'])<1 and abs(position['y']-next_position['y'])<1,(mode,label,position,next_position)
      assert field.evaluate('()=>getSelection().toString()')=='beta'
    # A deliberate new keyboard selection can anchor a fresh popup normally.
    field.press('ArrowRight');field.press(select_all);expect(popup).to_be_visible()
    field.evaluate('n=>{const text=[...n.querySelectorAll("p")].flatMap(p=>[...p.childNodes]).find(n=>n.nodeType===3&&n.textContent.includes("beta"));const r=document.createRange();const start=text.textContent.indexOf("beta");r.setStart(text,start);r.setEnd(text,start+4);const s=getSelection();s.removeAllRanges();s.addRange(r);}')
    expect(popup).to_be_visible()
    bold=popup.get_by_role('button',name='Bold',exact=True);bold.click();expect(field.locator('strong')).to_have_text('beta');expect(bold).to_have_attribute('aria-pressed','true');bold.click();expect(field.locator('strong')).to_have_count(0);assert field.evaluate('()=>getSelection().toString()')=='beta'
    quote=popup.get_by_role('button',name='Quotation block',exact=True);quote.click();expect(field.locator('blockquote')).to_have_count(1);expect(field.locator('blockquote')).to_have_text('beta')
    style=field.locator('blockquote').evaluate('n=>({bg:getComputedStyle(n).backgroundColor,radius:getComputedStyle(n).borderRadius,mark:getComputedStyle(n,"::after").content})');assert style['bg'] not in ['transparent','rgba(0, 0, 0, 0)'] and style['radius']=='7px' and '”' in style['mark'],style
    quote.click();expect(field.locator('blockquote')).to_have_count(0)
    expect(popup.get_by_role('button',name='Heading 2',exact=True)).to_be_visible();popup.get_by_role('button',name='Heading 2',exact=True).click();expect(field.locator('h2')).to_have_text('beta')
    assert len(scope['parse'](page.evaluate('notes.a.content.text'))['messages'])==1,'Formatting must not send the capture draft'
    if mode!='mosaic-card':
     field.press('Escape');expect(popup).to_have_count(0);expect(field).to_be_focused();assert 'beta' in field.inner_text()
     field.press('ArrowRight');field.press(select_all);expect(popup).to_be_visible();field.press('Alt+F10');expect(popup.get_by_role('button',name='Bold',exact=True)).to_be_focused();page.keyboard.press('ArrowRight');expect(popup.get_by_role('button',name='Quotation block',exact=True)).to_be_focused();page.keyboard.press('Escape');expect(popup).to_have_count(0);expect(field).to_be_focused()
    field.press('ArrowRight');field.press(select_all);expect(popup).to_be_visible();page.set_viewport_size({'width':390,'height':430});expect(popup).to_be_visible();popup.evaluate('n=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');bounds=popup.bounding_box();assert bounds['x']>=-1 and bounds['x']+bounds['width']<=page.viewport_size['width']+1 and bounds['y']>=-1 and bounds['y']+bounds['height']<=431,(mode,width,bounds)
    # The quote glyph is decorative: it must never become stored note text.
    assert '”' not in field.evaluate('n=>n.value')
    if mode!='mosaic-card':
     readonly=e.locator('.message-body' if im else '.card-body').first
     field.evaluate('n=>n.blur()');readonly.evaluate('n=>{const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);}');expect(popup).to_have_count(0)
     field.click();field.press(select_all);expect(popup).to_be_visible()
    for level in range(3,7):
     fill_field(field,'#'*level+' Imported heading');field.press(select_all);expect(popup).to_be_visible();active=popup.get_by_role('button',name='Heading '+str(level),exact=True);expect(active).to_have_attribute('aria-pressed','true')
     assert popup.get_by_role('button').evaluate_all('nodes=>nodes.filter(n=>/^Heading [3-6]$/.test(n.getAttribute("aria-label"))).length')==1
     active.click();expect(field.locator('h'+str(level))).to_have_count(0);expect(popup.get_by_role('button',name='Normal text',exact=True)).to_have_attribute('aria-pressed','true')
    if mode=='mosaic-card':
     field.press('Alt+F10');page.keyboard.press('Escape');expect(e.locator('dialog')).to_be_visible();assert field.evaluate('n=>n.imRich.view.state.selection.empty&&getSelection().isCollapsed');expect(popup).to_have_count(0);page.keyboard.press('Escape');expect(e.locator('dialog')).not_to_be_visible()
    # Context switches destroy the old popup; an ordinary caret never reserves space.
    page.evaluate('switchNote("b")');expect(e.locator('.im-format-toolbar.is-selection-format')).to_have_count(0)
    assert not errors,errors
    print(f'PASS {width}px {mode}: native selection, shared SVG commands, toggles/heading, quote inset, bounded popup, preserved selection, no layout shift, Escape and note cleanup',flush=True);context.close()
  browser.close()
finally:server.shutdown()
