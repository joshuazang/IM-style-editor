"""Shared two-slider date controls filter original timestamps without changing notes."""
import functools,http.server,json,subprocess,threading
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](8)
stamps=['2026-11-07T05:00:00Z','2026-11-08T04:59:59.999Z','2026-11-06T17:00:00Z','2026-11-01T04:00:00Z','2026-11-01T03:59:59.999Z','2026-10-09T04:00:00Z','2026-10-09T03:59:59.999Z',None]
for i,m in enumerate(data['messages']):
 identity=m['id'];m.clear();m.update(id=identity,text='Date item '+str(i),reactions=['📓'] if i%2==0 else [])
 if stamps[i]:m['createdAt']=stamps[i]
data['draft']='';data['settings'].pop('pinnedMessageIds',None)
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,timezone_id='America/Toronto');page=context.new_page();page.clock.set_fixed_time(datetime(2026,11,7,17,tzinfo=timezone.utc));errors=[];page.on('pageerror',lambda e:errors.append(str(e)));vectors=[]
   for mosaic in [False,True]:
    page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('({note,path})=>{notes.a=note;notes.b={...structuredClone(note),uuid:"b"};openEditor("a",path,true)}',{'note':data['note'],'path':'/mosaic/index.html' if mosaic else '/next/index.html'});e=page.frame_locator('#editor');expect(e.locator('#capture-input' if mosaic else '#append-text')).to_be_visible()
    def open_search():
     field=e.locator('#search') if mosaic else e.get_by_role('textbox',name='Search messages',exact=True)
     if not field.is_visible():
      control=e.get_by_role('button',name='Change filters',exact=True)
      if not control.is_visible():control=e.get_by_role('button',name='Search and tags',exact=True)
      control.click()
     return field
    def choose(name):
     open_search();e.get_by_role('button',name='Date filters',exact=True).click();e.get_by_role('button',name=name,exact=True).click()
    def ids():return set(e.locator('.card' if mosaic else '.message-wrap').evaluate_all('(ns,key)=>ns.map(n=>n.dataset[key])','id' if mosaic else 'messageId'))
    def expect_ids(indexes):
     expected={data['messages'][i]['id'] for i in indexes}
     page.wait_for_timeout(70);assert ids()==expected,(mosaic,width,indexes,ids(),expected)
    open_search();button=e.get_by_role('button',name='Date filters',exact=True);svg=button.locator('svg');assert svg.locator('circle').count()==2;assert svg.locator('path').count()==1;vectors.append(svg.inner_html())
    row=button.locator('..');assert button.bounding_box()['x']>row.locator('input').bounding_box()['x']+row.locator('input').bounding_box()['width']
    if mosaic:assert e.locator('#search-icon').count()==0
    base=button.evaluate('n=>getComputedStyle(n).backgroundColor');button.hover();assert button.evaluate('n=>getComputedStyle(n).backgroundColor')!=base
    for name,indexes in [('Today',[0,1]),('Yesterday',[2]),('Last 7 days',[0,1,2,3]),('Last 30 days',[0,1,2,3,4,5]),('All dates',list(range(8)))]:choose(name);expect_ids(indexes)
    choose('Custom range');start=e.get_by_label('From date',exact=True);end=e.get_by_label('To date',exact=True);start.fill('2026-11-08');end.fill('2026-11-06');e.get_by_role('button',name='Apply date filter',exact=True).click();expect(e.get_by_role('alert').filter(has_text='From date must')).to_be_visible();expect_ids(range(8))
    start.fill('2026-11-06');end.fill('2026-11-07');e.get_by_role('button',name='Apply date filter',exact=True).click();expect_ids([0,1,2]);expect(e.locator('.ui-date-summary')).to_contain_text('Nov 6')
    open_search().fill('Date item 0');expect_ids([0]);choose('All dates');expect_ids([0])
    e.get_by_role('button',name='Clear all filters',exact=True).click();expect_ids(range(8))
    choose('Today');expect_ids([0,1]);e.get_by_role('button',name='Clear all filters',exact=True).click();expect_ids(range(8))
    open_search();e.get_by_role('button',name='Date filters',exact=True).click();expect(e.get_by_role('group',name='Date filters',exact=True)).to_be_visible()
    if width==390:page.screenshot(path='/tmp/date-filters-'+('mosaic' if mosaic else 'im')+'.png')
    page.evaluate('switchNote("b")');page.wait_for_timeout(100);open_search();expect(e.get_by_role('group',name='Date filters',exact=True)).not_to_be_visible();expect_ids(range(8))
    assert page.evaluate('saves.length')==0;assert page.evaluate('notes.a.content.text')==data['note']['content']['text']
   assert vectors[0]==vectors[1];assert not errors,errors;print(f'PASS {width}px: shared right-edge two-slider SVG/hover, original-date presets, DST week, inclusive custom ranges, invalid-range retention, query intersection, clearing and note isolation; zero note writes',flush=True);context.close()
  browser.close()
finally:server.shutdown()
