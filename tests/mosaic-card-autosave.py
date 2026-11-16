"""Open-card edits checkpoint and survive departures without pressing Close."""
import copy,functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse']
data=fixture(3);data['draft']='Unsent capture draft\nKeep this too'
for i,m in enumerate(data['messages']):m.update(text=f'Original card {i}',cardColor='coral',custom={'keep':i})
data['messages'][0]['title']='Existing title'
def encode(messages,draft=data['draft']):
 return subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps({'messages':messages,'settings':data['settings'],'draft':draft}),text=True)
data['note']['content']['text']=encode(data['messages'])
other={'uuid':'b','content_type':'Note','content':{'title':'Other note','text':''}}
host=(ROOT/'tests/mosaic-host.html').read_text().replace('if(rejectSaves){reply','if(rejectSaves||(window.enforceContext&&message.data.items[0].uuid!==activeUuid)){reply')
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
 def do_GET(self):
  if self.path=='/__card-autosave':
   body=host.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for mobile in [False,True]:
   context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':900},is_mobile=mobile,has_touch=mobile,
     user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if mobile else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130 Safari/537.36')
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def start():
    page.goto(f'http://127.0.0.1:{server.server_port}/__card-autosave');page.evaluate('([a,b,mobile])=>{notes.a=a;notes.b=b;openEditor("a","/mosaic/index.html",mobile)}',[data['note'],other,mobile])
    e=page.frame_locator('#editor');expect(e.get_by_role('textbox',name='Take a note',exact=True)).to_be_visible();return e
   def open_card(e,index=0):
    e.locator(f'.card[data-id="{data["messages"][index]["id"]}"]').click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
    body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_editable();return body
   def saved():return parse(page.evaluate('notes.a.content.text'))
   def wait_saved(text):page.wait_for_function('text=>notes.a.content.text.includes(text)',arg=text)
   def verify(text,index=0):
    result=saved();expected=copy.deepcopy(data['messages']);expected[index]['text']=text
    # A genuine edit resets copied/exported flags and marks the body edited.
    expected[index].pop('copied',None);expected[index].pop('exported',None);expected[index]['edited']=True
    assert result['messages']==expected,(result['messages'],expected)
    assert result['draft']==data['draft'];assert result['settings']==data['settings']
    assert page.evaluate('notes.b')==other
   e=start();body=open_card(e);field=body.element_handle();body.evaluate('n=>{window.boardBuilds=0;const f=rebuildLayout;rebuildLayout=(...a)=>{boardBuilds++;return f(...a)}}')
   fill_field(body,'Idle checkpoint **bold** 中文');wait_saved('Idle checkpoint');verify('Idle checkpoint **bold** 中文')
   expect(e.locator('dialog')).to_be_visible();assert body.element_handle()==field or body.evaluate('(n,old)=>n===old',field)
   assert body.evaluate('()=>boardBuilds')==0
   # The last keystroke is submitted before tearing down an open card on switch.
   fill_field(body,'Immediate switch\n- [x] Latest checklist');page.evaluate('switchNote("b")');expect(e.locator('dialog')).not_to_be_visible();wait_saved('Immediate switch')
   page.evaluate('switchNote("a")');expect(e.get_by_role('textbox',name='Take a note',exact=True)).to_have_js_property('value',data['draft']);body=open_card(e);expect(body).to_have_js_property('value','Immediate switch\n- [x] Latest checklist');verify('Immediate switch\n- [x] Latest checklist')
   # A fresh editor reads the saved result, rather than a RAM-only recovery copy.
   page.evaluate('mobile=>openEditor("a","/mosaic/index.html",mobile)',mobile);body=open_card(e);expect(body).to_have_js_property('value','Immediate switch\n- [x] Latest checklist')
   print(f'PASS {mobile=}: idle checkpoint, immediate note switch, exact body/metadata/draft, unchanged other note, no Board rebuild and fresh-frame reload',flush=True)

   # New text while an earlier snapshot waits for acknowledgment must win.
   e=start();body=open_card(e);page.evaluate('holdAck=true');fill_field(body,'First in-flight edit');page.wait_for_function('acks.length===1')
   fill_field(body,'Newest edit before departure');page.evaluate('switchNote("b")');page.evaluate('holdAck=false;releaseAcks()');wait_saved('Newest edit');page.evaluate('switchNote("a")');body=open_card(e);expect(body).to_have_js_property('value','Newest edit before departure');verify('Newest edit before departure')
   page.evaluate('switchNote("b")');page.wait_for_timeout(100);assert e.locator('#board').evaluate('()=>retainedSessions.size')==0
   print(f'PASS {mobile=}: newer queued text after late acknowledgment, rapid switches and released confirmed session',flush=True)

   # Current-note-only hosts may reject a departure save. It stays in the local
   # note session, is visible on return, and retries without needing the old card.
   e=start();body=open_card(e);page.evaluate('enforceContext=true');fill_field(body,'Retained rejected departure');page.evaluate('switchNote("b")');expect(e.locator('dialog')).not_to_be_visible();page.evaluate('switchNote("a")')
   wait_saved('Retained rejected');verify('Retained rejected departure');expect(e.locator('#notice')).not_to_be_visible();body=open_card(e);expect(body).to_have_js_property('value','Retained rejected departure')
   # Deleting all text is also an edit; an empty string must never be dropped.
   fill_field(body,'');page.evaluate('rejectSaves=true;switchNote("b")');page.evaluate('switchNote("a")');expect(e.locator('#notice')).to_be_visible();body=open_card(e);expect(body).to_have_js_property('value','')
   e.get_by_role('button',name='Close',exact=True).last.click();expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_visible()
   page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(e.locator('dialog')).not_to_be_visible();expect(e.locator('#notice')).not_to_be_visible();verify('')
   print(f'PASS {mobile=}: current-note-only rejection, visible retained edits and empty-body deletion, retry after switching',flush=True)

   # Page departure must flush the latest queued edit even before an older ack.
   e=start();body=open_card(e);page.evaluate('holdAck=true');fill_field(body,'Older background save');page.wait_for_function('acks.length===1');fill_field(body,'Newest pagehide edit')
   body.evaluate('()=>window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:false}))');wait_saved('Newest pagehide');verify('Newest pagehide edit')
   print(f'PASS {mobile=}: pagehide submits the newest snapshot behind an in-flight save',flush=True)

   e=start();body=open_card(e);page.evaluate('holdAck=true');fill_field(body,'Cached first save');page.wait_for_function('acks.length===1');fill_field(body,'Cached newest save')
   body.evaluate('()=>window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}))');assert saved()['messages'][0]['text']=='Cached first save'
   page.evaluate('holdAck=false;releaseAcks()');wait_saved('Cached newest');verify('Cached newest save')
   print(f'PASS {mobile=}: cached-page departure preserves acknowledgment ordering',flush=True)

   e=start();body=open_card(e);e.get_by_role('button',name='Card options',exact=True).click();e.get_by_role('menuitem',name='Edit title',exact=True).click()
   fill_field(e.get_by_role('textbox',name='Card title',exact=True),'New title\nSecond line');e.get_by_role('button',name='Card options',exact=True).click();e.get_by_role('button',name='Tag 📍',exact=True).click();page.evaluate('switchNote("b")');wait_saved('New title')
   result=saved();expected=copy.deepcopy(data['messages']);expected[0].update(title='New title\nSecond line',reactions=[*expected[0]['reactions'],'📍']);assert result['messages']==expected;assert result['draft']==data['draft'];assert result['settings']==data['settings'];assert page.evaluate('notes.b')==other
   print(f'PASS {mobile=}: unsaved title and tags survive direct note switching without altering body/statuses',flush=True)

   # A genuine remote body change pauses saving; local text remains available.
   e=start();body=open_card(e);fill_field(body,'Local conflict edit');remote=copy.deepcopy(data['messages']);remote[1]['text']='Remote different card';foreign=encode(remote)
   page.evaluate('text=>{notes.a.content.text=text;stream(notes.a)}',foreign);expect(e.locator('#notice')).to_contain_text('neither version is silently overwritten')
   page.evaluate('switchNote("b")');page.evaluate('switchNote("a")');expect(e.locator('#notice')).to_contain_text('neither version is silently overwritten');assert page.evaluate('notes.a.content.text')==foreign
   e.get_by_role('button',name='Review text',exact=True).click();expect(e.get_by_role('textbox',name='Unfinished card edit',exact=True)).to_have_value('title: "Existing title"\n\nLocal conflict edit')
   print(f'PASS {mobile=}: remote conflict pauses departure saves and keeps both versions',flush=True)
   assert not errors,errors;context.close()

  # Continuous typing checkpoints by six seconds; active IME composition is
  # allowed to finish before an idle checkpoint, without altering selection.
  context=browser.new_context(viewport={'width':1100,'height':900});page=context.new_page();e=start();body=open_card(e)
  for i in range(12):fill_field(body,'Continuous '+str(i));page.wait_for_timeout(500)
  assert page.evaluate('saves.length')>=1
  wait_saved('Continuous 11');verify('Continuous 11');before=page.evaluate('saves.length')
  body.press('Control+a');cdp=context.new_cdp_session(page);cdp.send('Input.imeSetComposition',{'text':'zhongwen','selectionStart':8,'selectionEnd':8});page.wait_for_timeout(900);assert page.evaluate('saves.length')==before
  cdp.send('Input.insertText',{'text':'中文输入尚未结束'});wait_saved('中文输入尚未结束');verify('中文输入尚未结束')
  before=page.evaluate('saves.length');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();assert page.evaluate('saves.length')==before
  print('PASS continuous six-second checkpoint, composition guard, no-op Close after confirmed autosave',flush=True)
  context.close();browser.close()
finally:server.shutdown();server.server_close()
