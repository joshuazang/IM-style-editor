"""The same visual codec in both real plugins, including saves and recovery."""
import functools,http.server,threading,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')};exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse']
def check_floating_formatting(e):
 selectors=['dialog','.card-detail-tools','.card-detail-scroll']
 before=[e.locator(s).bounding_box() for s in selectors]
 toggle=e.get_by_role('button',name='Text formatting',exact=True)
 toggle.click();panel=e.locator('.im-format-toolbar');expect(panel).to_be_visible()
 e.get_by_role('button',name='Heading',exact=True).click()
 assert [e.locator(s).bounding_box() for s in selectors]==before,'Formatting must not resize card, text pane or bottom controls'
 assert panel.bounding_box()['y']+panel.bounding_box()['height']<=before[1]['y']+1
 assert panel.evaluate('n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.left+20,r.top+20))}'),'Floating panel must remain clickable outside the short card'
 e.get_by_role('button',name='Heading',exact=True).click();toggle.click()
 assert [e.locator(s).bounding_box() for s in selectors]==before
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    data=fixture(0);page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;notes.b={...structuredClone(note),uuid:"b"};openEditor("a",path,true)}',[data['note'],path]);e=page.frame_locator('#editor');mosaic=path.startswith('/mosaic');capture=e.get_by_role('textbox',name='Take a note' if mosaic else 'Message',exact=True)
    expect(capture).to_be_visible();print('loaded',width,path,errors,flush=True)
    # Capture stays compact; existing Markdown and keyboard behavior still work.
    expect(e.locator('.im-format-toggle,.im-format-toolbar')).to_have_count(0)
    fill_field(capture,'## My heading');expect(capture.locator('h2')).to_have_text('My heading');capture.press('End');capture.press('Enter');capture.type('Ordinary body');assert capture.locator('p').last.inner_text()=='Ordinary body';assert len(parse(page.evaluate('notes.a.content.text'))['messages'])==0,{'note':parse(page.evaluate('notes.a.content.text')),'field':capture.evaluate('n=>({html:n.innerHTML,value:n.value})'),'errors':errors}
    capture.press('Control+Enter');capture.type('Second paragraph');assert capture.locator('p').last.inner_text()=='Second paragraph';assert len(parse(page.evaluate('notes.a.content.text'))['messages'])==0,{'note':parse(page.evaluate('notes.a.content.text')),'field':capture.evaluate('n=>({html:n.innerHTML,value:n.value})'),'errors':errors}
    e.get_by_role('button',name='Send' if mosaic else 'Send message',exact=True).click();expect(capture).to_have_js_property('value','');saved=parse(page.evaluate('notes.a.content.text'));assert len(saved['messages'])==1,saved;assert saved['messages'][0]['text'].startswith('## My heading');target=saved['messages'][0]['id'];body=e.locator('[data-id="'+target+'"] .card-body' if mosaic else '[data-message-id="'+target+'"] .message-body');expect(body.locator('h2')).to_have_text('My heading')
    # Same raw Markdown travels to the other editor without a viewing save.
    before=page.evaluate('notes.a.content.text');other='/next/index.html' if mosaic else '/mosaic/index.html';page.evaluate('(path)=>openEditor("a",path,true)',other);e=page.frame_locator('#editor');expect(e.locator('.message-body h2' if mosaic else '.card-body h2')).to_have_text('My heading');assert parse(page.evaluate('notes.a.content.text'))['messages']==parse(before)['messages']
    # Opened Mosaic cards are multiline; Ctrl/Meta+Enter never save/close.
    if not mosaic:
     e.locator('.card').first.click();detail=e.get_by_role('textbox',name='Card body',exact=True);expect(detail.locator('h2')).to_have_text('My heading');e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');check_floating_formatting(e);detail.locator('h2').click();e.get_by_role('button',name='Text formatting',exact=True).click();e.get_by_role('button',name='Heading',exact=True).click();expect(e.get_by_role('button',name='Heading 2',exact=True)).to_have_attribute('aria-pressed','true');e.get_by_role('button',name='Heading 2',exact=True).click();expect(detail.locator('h2')).to_have_count(0);e.get_by_role('button',name='Heading',exact=True).click();e.get_by_role('button',name='Heading 2',exact=True).click();expect(detail.locator('h2')).to_have_text('My heading');detail.press('Control+End');detail.press('Meta+Enter');detail.type('Appended in card');expect(e.locator('dialog')).to_be_visible();assert parse(page.evaluate('notes.a.content.text'))['messages']==parse(before)['messages'];e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();assert 'Appended in card' in parse(page.evaluate('notes.a.content.text'))['messages'][0]['text'];assert next(f for f in page.frames if f.parent_frame).evaluate('imRichField.stats().live')==1
     # Select one character in the middle of a plain-text three-line paragraph.
     # A heading belongs to that line, never all lines in the containing block.
     e.locator('.card').first.click();detail=e.get_by_role('textbox',name='Card body',exact=True);fill_field(detail,'Before line\nChosen line\nAfter line');detail.press('Control+Home');detail.press('ArrowDown');detail.press('ArrowRight');detail.press('Shift+ArrowRight');assert detail.evaluate('()=>getSelection().toString()')=='h'
     e.get_by_role('button',name='Text formatting',exact=True).click();e.get_by_role('button',name='Heading',exact=True).click();e.get_by_role('button',name='Heading 3',exact=True).click();expect(detail.locator('h3')).to_have_text('Chosen line');assert detail.locator('p').all_text_contents()==['Before line','After line'];assert detail.evaluate('()=>getSelection().toString()')=='h'
     detail.press('Control+z');expect(detail.locator('h3')).to_have_count(0);assert detail.evaluate(r'n=>n.imRich.view.state.doc.textBetween(0,n.imRich.view.state.doc.content.size,"\n","\n")')=='Before line\nChosen line\nAfter line';detail.press('Control+Shift+z');expect(detail.locator('h3')).to_have_text('Chosen line');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
     e.locator('.card').first.click();detail=e.get_by_role('textbox',name='Card body',exact=True);expect(detail.locator('h3')).to_have_text('Chosen line');assert detail.locator('p').all_text_contents()==['Before line','After line'];detail.locator('h3').click();e.get_by_role('button',name='Text formatting',exact=True).click();e.get_by_role('button',name='Heading',exact=True).click();expect(e.get_by_role('button',name='Heading 3',exact=True)).to_have_attribute('aria-pressed','true');e.get_by_role('button',name='Heading 3',exact=True).click();expect(detail.locator('h3')).to_have_count(0);assert detail.locator('p').all_text_contents()==['Before line','Chosen line','After line'];e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
    # Every selected feature uses the same source/rendering in both plugins.
    page.evaluate('(path)=>openEditor("a",path,true)',path);e=page.frame_locator('#editor');capture=e.get_by_role('textbox',name='Take a note' if mosaic else 'Message',exact=True);expect(capture).to_be_visible()
    rich='## Heading\n\n**Bold** and ~~struck~~\n\n> Quoted\n\n- bullet\n\n3. numbered\n\n- [ ] Todo\n- [x] Done'
    fill_field(capture,rich)
    for selector in ['h2','strong','s','blockquote','ul','ol']:expect(capture.locator(selector).first).to_be_visible()
    expect(capture.get_by_role('checkbox')).to_have_count(2)
    if width==390:page.screenshot(path='/tmp/markdown-capture-'+('mosaic' if mosaic else 'im')+'.png')
    before_ime=capture.evaluate('n=>n.value');capture.dispatch_event('keydown',{'key':'Enter','keyCode':229,'isComposing':True,'bubbles':True});assert capture.evaluate('n=>n.value')==before_ime
    e.get_by_role('button',name='Send' if mosaic else 'Send message',exact=True).click();expect(capture).to_have_js_property('value','');saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][-1]['text']==rich
    identity=saved['messages'][-1]['id'];rendered=e.locator(('[data-id="' if mosaic else '[data-message-id="')+identity+'"] '+('.card-body' if mosaic else '.message-body'))
    rendered.get_by_role('checkbox').first.click();page.wait_for_function('notes.a.content.text.includes("[x] Todo")');assert parse(page.evaluate('notes.a.content.text'))['messages'][-1]['id']==identity
    stale=rendered.get_by_role('checkbox').first.element_handle();page.evaluate('switchNote("b")');expect(capture).to_have_js_property('value',data['draft'].replace('\r\n','\n'));before_b=page.evaluate('notes.b.content.text');stale.evaluate('n=>n.click()');capture.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert page.evaluate('notes.b.content.text')==before_b;page.evaluate('switchNote("a")');expect(capture).to_have_js_property('value','')
    # A formatted failed send survives switches and creates exactly one message.
    fill_field(capture,'**Retain formatted**');page.wait_for_function('notes.a.content.text.includes("**Retain formatted**")');capture.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');page.evaluate('rejectSaves=true');e.get_by_role('button',name='Send' if mosaic else 'Send message',exact=True).click();expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_visible();expect(capture).to_have_js_property('value','**Retain formatted**')
    page.evaluate('switchNote("b")');expect(capture).to_have_js_property('value',data['draft'].replace('\r\n','\n'));page.evaluate('switchNote("a")');expect(capture).to_have_js_property('value','**Retain formatted**');expect(capture.locator('strong')).to_have_text('Retain formatted');page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(capture).to_have_js_property('value','');saved=parse(page.evaluate('notes.a.content.text'));assert sum(m['text']=='**Retain formatted**' for m in saved['messages'])==1
    # A late Send acknowledgment must retain newer text and its formatting.
    fill_field(capture,'**Submitted**');page.wait_for_function('notes.a.content.text.includes("**Submitted**")');page.evaluate('holdAck=true');e.get_by_role('button',name='Send' if mosaic else 'Send message',exact=True).click();page.wait_for_function('acks.length>0');fill_field(capture,'~~Newer draft~~');page.evaluate('holdAck=false;releaseAcks()');expect(capture).to_have_js_property('value','~~Newer draft~~');expect(capture.locator('s')).to_have_text('Newer draft')
    # Re-entering identical text is still a newer draft, not the submitted one.
    fill_field(capture,'**Identical repeat**');page.wait_for_function('notes.a.content.text.includes("**Identical repeat**")');capture.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');page.evaluate('holdAck=true');e.get_by_role('button',name='Send' if mosaic else 'Send message',exact=True).click();page.wait_for_function('acks.length>0');fill_field(capture,'');fill_field(capture,'**Identical repeat**');page.evaluate('holdAck=false;releaseAcks()');expect(capture).to_have_js_property('value','**Identical repeat**');expect(capture.locator('strong')).to_have_text('Identical repeat')
    assert not errors,errors;print(json.dumps({'PASS':width,'editor':path,'checks':'visual heading, root ordinary paragraph, Send, cross-editor rendering, no-op source preservation, Card newlines, view cleanup'}),flush=True);context.close()
  browser.close()
finally:server.shutdown()
