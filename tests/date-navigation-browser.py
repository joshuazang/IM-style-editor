"""Date navigation keeps the full synthetic note scrollable, without writes."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](120)
for i,m in enumerate(data['messages']):
 identity=m['id'];m.clear();m.update(id=identity,text=f'Date item {i}\n'+'A preserved message. '*8,reactions=['📓'] if i%2==0 else [],createdAt=f'2026-{10+i//28:02d}-{i%28+1:02d}T12:00:00Z' if i<84 else f'2027-{1+(i-84)//28:02d}-{(i-84)%28+1:02d}T12:00:00Z')
data['draft']='Unsent capture stays here';data['settings'].pop('pinnedMessageIds',None)
def encode():
 return subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
data['note']['content']['text']=encode()
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,timezone_id='America/Toronto');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));vectors=[]
   for mosaic in [False,True]:
    page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('({note,path})=>{notes.a=note;notes.b={...structuredClone(note),uuid:"b"};openEditor("a",path,true)}',{'note':data['note'],'path':'/mosaic/index.html' if mosaic else '/next/index.html'});e=page.frame_locator('#editor');expect(e.locator('#capture-input' if mosaic else '#append-text')).to_be_visible();page.wait_for_timeout(250)
    def open_search():
     field=e.locator('#search') if mosaic else e.get_by_role('textbox',name='Search messages',exact=True)
     if not field.is_visible():
      control=e.get_by_role('button',name='Change filters',exact=True)
      if not control.is_visible():control=e.get_by_role('button',name='Search and tags',exact=True)
      control.click()
     return field
    def picker():
     open_search();e.get_by_role('button',name='Jump to date',exact=True).click();return e.get_by_label('Date',exact=True)
    def target(index):return e.locator(('.card[data-id="' if mosaic else '.message-wrap[data-message-id="')+data['messages'][index]['id']+'"]')
    def visible_destination(index):
     expect(target(index)).to_be_visible();page.wait_for_timeout(450)
     box=target(index).bounding_box();assert box and box['y']<700 and box['y']+box['height']>70,(mosaic,width,index,box)
     assert e.locator('#search-tags-panel:visible').count()==0
     assert e.get_by_role('button',name='Clear all filters',exact=True).is_hidden()
    e.locator('#capture-input' if mosaic else '#append-text').focus()
    open_search();button=e.get_by_role('button',name='Jump to date',exact=True);vectors.append(button.locator('svg').inner_html());assert button.locator('circle').count()==1
    row=button.locator('..');open_search().focus();assert row.evaluate('n=>getComputedStyle(n).boxShadow')=='rgb(32, 33, 36) 0px 0px 0px 1px';assert row.evaluate('n=>getComputedStyle(n).backdropFilter')==('none' if mosaic else 'blur(10px)')
    assert e.get_by_role('button',name='Date filters',exact=True).count()==0
    # Search would hide this destination. The jump must reveal the full note.
    open_search().fill('Date item 119');date=picker();date.fill('2026-11-01');visible_destination(28)
    if not mosaic:
     assert e.locator('.messages').evaluate('(n,ids)=>ids.every(id=>n.imVirtual.has(id))',[m['id'] for m in data['messages']])
    # Both neighboring dates remain available: navigate through normal scrolling.
    scroll=e.locator('#viewport' if mosaic else '.messages');old=scroll.evaluate('n=>n.scrollTop');scroll.evaluate('n=>n.scrollTop+=300');page.wait_for_timeout(150);assert scroll.evaluate('n=>n.scrollTop')>old
    scroll.evaluate('n=>n.scrollTop-=600');page.wait_for_timeout(150);assert scroll.evaluate('n=>n.scrollTop')<old
    # Missing date falls forward. Beyond the note falls back, never hides data.
    date=picker();date.fill('2026-11-30');visible_destination(56);expect(e.locator('#toast' if mosaic else '.transfer-notice')).to_contain_text('No messages on that date')
    date=picker();date.fill('2030-01-01');visible_destination(119)
    date=picker();date.fill('2020-01-01');visible_destination(0)
    date=picker();e.get_by_role('button',name='Jump to date',exact=True).last.click();expect(e.get_by_role('alert').filter(has_text='Choose a valid date')).to_be_visible()
    if width==390:page.screenshot(path='/tmp/date-jump-'+('mosaic' if mosaic else 'im')+'.png')
    page.evaluate('switchNote("b")');page.wait_for_timeout(150);open_search();expect(e.get_by_role('group',name='Jump to date',exact=True)).not_to_be_visible()
    expect(e.locator('#capture-input' if mosaic else '#append-text')).to_have_value(data['draft']);assert page.evaluate('saves.length')==0;assert page.evaluate('notes.a.content.text')==data['note']['content']['text']
   assert vectors[0]==vectors[1];assert not errors,errors;print(f'PASS {width}px: shared calendar vector, focus/frost, virtual date jumps, neighboring dates scrollable, cleared search, missing-date fallbacks, validation and note isolation; zero note writes',flush=True);context.close()
  browser.close()
finally:server.shutdown()
