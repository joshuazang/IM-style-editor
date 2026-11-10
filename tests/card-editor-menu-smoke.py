"""Direct card editing and identical modern context-menu presentation."""
import functools,http.server,re,threading,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
from mosaic_helpers import fill_search,open_search,open_more,choose_tag
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse'];data=fixture()
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
  for width in [int(value) for value in os.environ.get('MOSAIC_TEST_WIDTHS','320,390,1100').split(',')]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
   context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied=text,readText:async()=>''}})")
   page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE+'/') else None)
   page.on('dialog',lambda d:d.dismiss())
   page.goto(BASE+'/__host');page.evaluate('(note)=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a","/mosaic/index.html",true)}',data['note'])
   e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_be_visible()
   expect(e.locator('#search')).not_to_be_visible()
   controls=e.locator('.board-toolbar');assert len(controls.locator('button:visible').all())==2
   assert round(e.locator('#search-button').bounding_box()['width'])==46 and round(e.locator('#more-button').bounding_box()['width'])==38
   capture=e.locator('#capture-composer').bounding_box();view=e.locator('#viewport').bounding_box()
   assert view['y']<=capture['y']<view['y']+view['height'] and capture['y']+capture['height']<=view['y']+view['height'],capture
   assert not e.locator('.card-timestamp').count()
   assert e.get_by_role('button',name='Background options',exact=True).count()==0
   assert not any('Nov' in text for text in e.locator('.card-meta').all_text_contents())
   fill_search(e,'A title');card=e.locator('[data-id="'+data['messages'][0]['id']+'"]');card.click()
   dialog=e.get_by_role('dialog',name='Edit card',exact=True);expect(dialog).to_be_visible()
   assert dialog.locator('.editor-tags,.editor-tag,.new-tag').count()==0
   assert dialog.get_by_role('textbox',name='New label',exact=True).count()==0
   expect(dialog.get_by_role('button',name='Background options',exact=True)).to_be_visible()
   body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_focused()
   expect(e.locator('.card-timestamp')).to_have_text(re.compile('Nov'))
   expect(e.locator('.card-edited')).to_have_text('edited')
   expect(e.get_by_role('textbox',name='Card title',exact=True)).not_to_be_visible();title=body.bounding_box();title['height']=44
   assert dialog.locator('.card-detail-tools>button').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("aria-label"))')==['Text formatting','Pin card','Background options','Card options','Close']
   before=page.evaluate('notes.a.content.text');fill_field(body,'Changed body');body.press('End');body.press('Enter');body.type('Next line')
   expect(body).to_have_js_property('value','Changed body\n\nNext line');assert page.evaluate('notes.a.content.text')==before
   page.evaluate('holdAck=true');e.get_by_role('button',name='Close',exact=True).click();expect(dialog).to_be_visible()
   fill_field(body,'New typing during acknowledgment');page.evaluate('holdAck=false;releaseAcks()');expect(body).to_have_js_property('value','New typing during acknowledgment')
   expect(dialog).to_be_visible();e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible()
   saved=parse(page.evaluate('notes.a.content.text'));first=saved['messages'][0]
   assert first['text'].endswith('New typing during acknowledgment') and first['edited'] and not first.get('copied') and not first.get('exported')
   assert first['createdAt']==data['messages'][0]['createdAt'] and 'editedAt' not in first
   fill_search(e,'New typing during acknowledgment')
   # No-op Close never changes text or starts another save.
   before=page.evaluate('notes.a.content.text');count=page.evaluate('saves.length');card.click();e.get_by_role('button',name='Close',exact=True).click()
   assert page.evaluate('notes.a.content.text')==before and page.evaluate('saves.length')==count
   card.click();page.set_viewport_size({'width':width,'height':480})
   expect(e.get_by_role('button',name='Close',exact=True)).to_be_in_viewport()
   e.get_by_role('button',name='Close',exact=True).click();page.set_viewport_size({'width':width,'height':844})
   fill_search(e,'Thought 2');card=e.locator('[data-id="'+data['messages'][2]['id']+'"]');card.click(button='right')
   menu=e.locator('#menu');expect(menu.locator('.ui-tag-panel')).to_be_visible();expect(menu.locator('.ui-action-panel')).to_be_visible()
   assert menu.get_by_role('menuitem',name='Copy',exact=True).evaluate('n=>getComputedStyle(n).fontWeight')=='500'
   assert menu.get_by_role('menuitem').all_text_contents()==['Edit','Reply','Pin','Copy','Select','Delete']
   assert menu.get_by_role('button',name='Add label',exact=True).count()==0
   positions=menu.locator('.ui-tag-choice').evaluate_all('nodes=>nodes.map(n=>({x:Math.round(n.getBoundingClientRect().left),y:Math.round(n.getBoundingClientRect().top)}))')
   assert len(set(point['x'] for point in positions))>1 and len(set(point['y'] for point in positions))<=2,positions
   if width==390:page.screenshot(path='/tmp/mosaic-menu-simple.png')
   assert menu.locator('.ui-action-panel hr').count()==1
   vectors=menu.locator('.ui-action-panel svg').evaluate_all('nodes=>nodes.map(n=>n.innerHTML)')
   menu.get_by_role('button',name='Tag 📍',exact=True).click();expect(menu).not_to_be_visible()
   assert parse(page.evaluate('notes.a.content.text'))['messages'][2]['reactions']==['📍']
   # Context tags and palette are usable inside the native edit dialog.
   card.click();body=e.get_by_role('textbox',name='Card body',exact=True);fill_field(body,'Edited with color and tags')
   body.click(button='right');expect(menu).to_be_visible();menu.get_by_role('button',name='Tag 📓',exact=True).click()
   dialog.get_by_role('button',name='Background options',exact=True).click()
   palette=e.get_by_role('group',name='Card background colors',exact=True);expect(palette).to_be_visible();palette.get_by_role('button',name='Rose',exact=True).click()
   expect(body).to_have_js_property('value','Edited with color and tags');e.get_by_role('button',name='Close',exact=True).click()
   saved=parse(page.evaluate('notes.a.content.text'))['messages'][2];assert saved['text'].endswith('Edited with color and tags') and saved['cardColor']=='rose' and saved['reactions']==['📍','📓']
   fill_search(e,'Edited with color and tags')
   # Failed Close keeps the complete editor open for retry.
   card.click();body=e.get_by_role('textbox',name='Card body',exact=True);fill_field(body,'Retain failed Close');page.evaluate('rejectSaves=true')
   e.get_by_role('button',name='Close',exact=True).click();expect(body).to_have_js_property('value','Retain failed Close');expect(dialog).to_be_visible()
   page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(dialog).not_to_be_visible()
   assert parse(page.evaluate('notes.a.content.text'))['messages'][2]['text'].endswith('Retain failed Close')
   # Filters use the matching 90px pill; the two circular actions stay independent.
   open_search(e);fill_field(e.locator('#search'),'Thought 3');expect(e.locator('#filter-pill')).to_be_visible()
   assert round(e.locator('#filter-pill').bounding_box()['width'])==90
   e.get_by_role('button',name='Clear all filters',exact=True).click();expect(e.locator('#search-button')).to_be_visible()
   # IM uses the identical static vectors and action-panel CSS, with the old functions.
   page.evaluate('openEditor("a","/next/index.html",true)');im=page.frame_locator('#editor');expect(im.get_by_role('textbox',name='Message',exact=True)).to_be_visible()
   im.locator('.message-wrap').last.click(button='right');imenu=im.locator('.context-menu')
   expect(imenu.locator('.ui-tag-panel')).to_be_visible();expect(imenu.locator('.ui-action-panel')).to_be_visible()
   assert imenu.get_by_role('menuitem',name='Copy',exact=True).evaluate('n=>getComputedStyle(n).fontWeight')=='500'
   assert imenu.get_by_role('menuitem').all_text_contents()==['Edit','Reply','Pin','Copy','Select','Delete']
   assert imenu.get_by_role('button',name='Add label',exact=True).count()==0
   positions=imenu.locator('.ui-tag-choice').evaluate_all('nodes=>nodes.map(n=>({x:Math.round(n.getBoundingClientRect().left),y:Math.round(n.getBoundingClientRect().top)}))')
   assert len(set(point['x'] for point in positions))>1 and len(set(point['y'] for point in positions))<=2,positions
   if width==390:page.screenshot(path='/tmp/im-menu-simple.png')
   assert imenu.locator('.ui-action-panel svg').evaluate_all('nodes=>nodes.map(n=>n.innerHTML)')==vectors
   assert imenu.locator('.ui-action-panel hr').count()==1
   assert imenu.get_by_role('menuitem',name='Delete',exact=True).evaluate('n=>getComputedStyle(n).color')=='rgb(191, 69, 71)'
   imenu.get_by_role('menuitem',name='Edit',exact=True).click();expect(im.get_by_role('textbox',name='Edit message',exact=True)).to_have_js_property('value',data['messages'][-1]['text'])
   im.get_by_role('button',name='Cancel editing',exact=True).click()
   im.locator('.message-wrap').last.click(button='right');imenu.get_by_role('button',name='Tag 📍',exact=True).click()
   assert '📍' in parse(page.evaluate('notes.a.content.text'))['messages'][-1]['reactions']
   im.locator('.message-wrap').last.click(button='right');imenu.get_by_role('menuitem',name='Copy',exact=True).click()
   page.wait_for_function('notes.a.content.text.includes("copied")')
   assert parse(page.evaluate('notes.a.content.text'))['messages'][-1]['copied']
   im.locator('.message-wrap').last.click(button='right');imenu.get_by_role('menuitem',name='Select',exact=True).click()
   im.get_by_role('button',name='Export',exact=True).click()
   page.wait_for_function('notes.a.content.text.includes("exported")')
   assert parse(page.evaluate('notes.a.content.text'))['messages'][-1]['exported']
   assert not errors,errors;assert not outside,outside
   print(f'PASS {width}px: direct editing, multiline Enter, bottom Close/metadata, no board timestamps, ack/failure retention, modal palette/tags, bottom capture and identical functional IM/Mosaic menus',flush=True)
   if width==390:page.screenshot(path='/tmp/shared-message-menu.png')
   context.close()
  browser.close()
finally:server.shutdown()
