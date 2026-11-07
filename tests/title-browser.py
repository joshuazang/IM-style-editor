"""Optional-title flows and compact cards use synthetic notes only."""
import functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
from mosaic_helpers import fill_search
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse'];data=fixture(20)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
    context.add_init_script('window.__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){__writes.push(k);return set.call(this,k,v)};const open=indexedDB.open.bind(indexedDB);indexedDB.open=(...a)=>{__writes.push(a[0]);return open(...a)}')
    page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE+'/') else None)
    page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;notes.b={...structuredClone(note),uuid:"b"};openEditor("a",path,true)}',[data['note'],path])
    e=page.frame_locator('#editor');mosaic=path.startswith('/mosaic');capture=e.get_by_role('textbox',name='Take a note' if mosaic else 'Message',exact=True);expect(capture).to_be_visible()
    capture.fill('Capture draft that must survive\nSecond line');page.wait_for_function('notes.a.content.text.includes("Capture draft that must survive")')
    target=data['messages'][2]['id']
    def row():
     if mosaic:e.locator('#viewport').evaluate('n=>n.scrollTop=n.scrollHeight');return e.locator('[data-id="'+target+'"]')
     e.locator('.messages').evaluate('n=>n.scrollTop=0');return e.locator('[data-message-id="'+target+'"]')
    def title_menu(name):
     row().click(button='right');e.get_by_role('menuitem',name=name,exact=True).click();return e.get_by_role('textbox',name='Title',exact=True)
    title=title_menu('Add title');expect(title).to_have_value('');expect(e.get_by_role('button',name='Cancel title entry',exact=True)).to_be_visible()
    title.fill('First "title"\nSecond line 🙂');assert 'title: ' not in page.evaluate('notes.a.content.text')
    page.evaluate('holdAck=true');title.press('Enter');page.wait_for_function('acks.length===1');expect(title).to_have_value('First "title"\nSecond line 🙂')
    title.fill('Newer title after submission');page.evaluate('holdAck=false;releaseAcks()');expect(title).to_have_value('Newer title after submission')
    title.press('Enter');expect(capture).to_have_value('Capture draft that must survive\nSecond line')
    saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][2]['title']=='Newer title after submission' and len(saved['messages'])==20
    assert {k:v for k,v in saved['messages'][2].items() if k!='title'}==data['messages'][2]
    assert saved['draft']=='Capture draft that must survive\nSecond line'
    title=title_menu('Edit title');title.fill('Discard this title');e.get_by_role('button',name='Cancel title entry',exact=True).click();expect(capture).to_have_value(saved['draft']);assert parse(page.evaluate('notes.a.content.text'))['messages'][2]['title']=='Newer title after submission'
    title=title_menu('Edit title');title.fill('Retry multiline\nKept after switching');page.evaluate('rejectSaves=true');title.press('Enter');expect(title).to_have_value('Retry multiline\nKept after switching')
    page.evaluate('switchNote("b")');expect(capture).to_be_visible();page.evaluate('switchNote("a")');expect(title).to_have_value('Retry multiline\nKept after switching')
    page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(capture).to_have_value(saved['draft'])
    saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][2]['title']=='Retry multiline\nKept after switching';assert saved['messages'][2]['text']==data['messages'][2]['text'];assert not saved['messages'][2].get('edited')
    other='/next/index.html' if mosaic else '/mosaic/index.html';page.evaluate('(path)=>openEditor("a",path,true)',other);e=page.frame_locator('#editor')
    if mosaic:e.locator('.messages').evaluate('n=>n.scrollTop=0')
    else:fill_search(e,'Retry multiline')
    expect(e.locator('.message-title' if mosaic else '.card-title').filter(has_text='Retry multiline')).to_be_visible()
    assert not errors,errors;assert not outside,outside;assert e.locator('body').evaluate('()=>__writes.length')==0
    print(f'PASS {width}px {path}: explicit multiline title entry, draft retention, late acknowledgment/newer typing, cancel, failure/switch/retry, unchanged body/status/IDs and cross-editor display; no storage/network additions',flush=True)
    if other.startswith('/mosaic'):
     assert e.locator('.card .pin-card,.card .more-card,.card .card-tools').count()==0
     fill_search(e,'Thought 3');card=e.locator('[data-id="'+data['messages'][3]['id']+'"]');card.click();expect(e.get_by_role('textbox',name='Card title',exact=True)).not_to_be_visible();expect(e.get_by_role('textbox',name='Card body',exact=True)).to_have_value(data['messages'][3]['text'])
     expect(e.locator('.detail-pin')).to_be_visible();expect(e.locator('.detail-more')).to_be_visible();e.locator('.detail-more').click();e.get_by_role('menuitem',name='Add title',exact=True).click()
     field=e.get_by_role('textbox',name='Card title',exact=True);expect(field).to_be_focused();field.fill('Opened card title');field.press('End');field.press('Enter');field.type('Second title line')
     expect(field).to_have_value('Opened card title\nSecond title line');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
     final=parse(page.evaluate('notes.a.content.text'));assert final['messages'][3]['title']=='Opened card title\nSecond title line' and final['messages'][3]['text']==data['messages'][3]['text'];assert not final['messages'][3].get('edited')
     card.click();expect(e.get_by_role('textbox',name='Card title',exact=True)).not_to_be_visible();expect(e.locator('.detail-title')).to_have_text(final['messages'][3]['title']);e.get_by_role('button',name='Close',exact=True).click()
     fill_search(e,'');page.wait_for_timeout(200)
     assert e.locator('.card').evaluate_all('ns=>ns.every(n=>{const last=n.lastElementChild,r=n.getBoundingClientRect(),l=last.getBoundingClientRect();return r.bottom-l.bottom<=15})')
     if width==390:page.screenshot(path='/tmp/mosaic-body-first-titles.png')
     print(f'PASS {width}px: opened-card title field requires menu action, multiline editing, preserved detail controls and compact tagged/untagged previews',flush=True)
    context.close()
  browser.close()
finally:server.shutdown()
