"""Phone capture, two-column layout, labels and preset colors; synthetic notes only."""
import functools,http.server,json,re,threading,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
from mosaic_helpers import fill_search,click_outside_capture,choose_tag,open_more
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse']
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
 def do_GET(self):
  if self.path.split('?',1)[0]=='/__host':self.path='/tests/mosaic-host.html'
  return super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
small=fixture(200)
small['messages'][192]['title']='Legacy title'
small['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(small),text=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
   page=context.new_page();errors=[];external=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE+'/') else None)
   page.goto(BASE+'/__host');page.evaluate('(note)=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a","/mosaic/index.html",true)}',small['note'])
   e=page.frame_locator('#editor');field=e.locator('#capture-input');expect(field).to_be_visible()
   if width<600:
    positions=e.locator('.card').evaluate_all('nodes=>[...new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().left)))]')
    assert len(positions)==2,positions
   assert e.locator('body').evaluate('n=>n.scrollWidth<=innerWidth')
   page.wait_for_timeout(100)
   clipped=e.locator('.card').evaluate_all('nodes=>nodes.filter(n=>(n.querySelector(".card-body")||n.querySelector(".card-title")).getBoundingClientRect().bottom>n.getBoundingClientRect().bottom-2).map(n=>n.dataset.id)')
   assert not clipped,clipped
   # Keep focus, send with Enter, reveal the new card even while reading farther down.
   e.locator('#viewport').evaluate('n=>n.scrollTop=n.scrollHeight/2');fill_field(field,'Sent from Enter')
   field.press('Shift+Enter');field.press('Shift+Enter');field.press('End');field.type('Exact second paragraph')
   expect(field).to_have_js_property('value','Sent from Enter<br>\nExact second paragraph');field.press('Enter')
   expect(field).to_have_js_property('value','');assert field.evaluate('n=>document.activeElement===n')
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][-1]['text']=='Sent from Enter<br>\nExact second paragraph'
   card=e.locator('[data-id="'+saved['messages'][-1]['id']+'"]');expect(card).to_be_in_viewport()
   assert len(saved['messages'])==201
   # A soft keyboard beforeinput event also submits, without inserting a newline.
   fill_field(field,'Soft keyboard send')
   prevented=field.evaluate("n=>!n.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertLineBreak'}))")
   assert prevented;expect(field).to_have_js_property('value','');saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][-1]['text']=='Soft keyboard send'
   # An IME confirmation Enter is not a send.
   fill_field(field,'中文输入');field.evaluate("n=>n.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true}))")
   expect(field).to_have_js_property('value','中文输入');assert len(parse(page.evaluate('notes.a.content.text'))['messages'])==202
   fill_field(field,'');page.wait_for_function('!notes.a.content.text.includes("中文输入")')
   # Color and label actions are independent from text and status changes.
   fill_search(e,'Thought 192');card=e.locator('[data-id="'+small['messages'][192]['id']+'"]')
   expect(card).to_be_visible();assert card.get_by_role('button',name='Background options',exact=True).count()==0
   card.click();e.locator('dialog').get_by_role('button',name='Background options',exact=True).click()
   palette=e.get_by_role('group',name='Card background colors',exact=True);expect(palette).to_be_visible()
   bounds=palette.bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=width+1,bounds
   palette.get_by_role('button',name='Iris blue',exact=True).click();e.get_by_role('button',name='Close',exact=True).click()
   page.wait_for_function('notes.a.content.text.includes("cardColor")');saved=parse(page.evaluate('notes.a.content.text'))
   source=saved['messages'][192];assert source['cardColor']=='iris' and source['text']==small['messages'][192]['text'] and not source.get('edited')
   assert card.evaluate('n=>getComputedStyle(n).color')=='rgb(32, 33, 36)'
   assert card.locator('.card-body').evaluate('n=>getComputedStyle(n).color')=='rgb(32, 33, 36)'
   card.click(button='right')
   assert e.get_by_role('button',name='Add label',exact=True).count()==0
   e.get_by_role('button',name='Tag 📍',exact=True).click();saved=parse(page.evaluate('notes.a.content.text'))
   assert saved['messages'][192]['reactions']==['📓','📍'] and saved['messages'][192]['cardColor']=='iris'
   assert saved['messages'][192]['text']==small['messages'][192]['text'] and not saved['messages'][192].get('edited')
   # An opened card uses multiline Enter and saves with Close.
   card.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click()
   e.locator('.detail-more').click();e.get_by_role('menuitem',name='Edit title',exact=True).click()
   title=e.get_by_role('textbox',name='Card title',exact=True);body=e.get_by_role('textbox',name='Card body',exact=True)
   fill_field(title,'Changed title');title.press('End');title.press('Shift+Enter');expect(title).to_have_js_property('value','Changed title\n');body.focus()
   fill_field(body,'Body');body.press('Shift+Enter');body.type('New line');body.press('Enter');expect(body).to_have_js_property('value','Body\nNew line\n\n');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][192]['text']=='Body\nNew line\n\n' and saved['messages'][192]['title']=='Changed title\n' and saved['messages'][192]['cardColor']=='iris'
   # Colors survive editor round trips, including writes performed by IM.
   page.evaluate('openEditor("a","/next/index.html")');im=page.frame_locator('#editor').get_by_role('textbox',name='Message',exact=True)
   fill_field(im,'Draft from IM');page.wait_for_function('notes.a.content.text.includes("Draft from IM")');page.evaluate('openEditor("a")')
   e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_have_js_property('value','Draft from IM')
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][192]['cardColor']=='iris' and saved['messages'][192]['reactions']==['📓','📍']
   # A deliberate failed send keeps text, and retry creates exactly one card.
   page.evaluate('rejectSaves=true');fill_field(e.locator('#capture-input'),'Keep rejected Enter');e.locator('#capture-input').press('Enter')
   expect(e.locator('#notice')).to_contain_text('Saving was not confirmed');expect(e.locator('#capture-input')).to_have_js_property('value','Keep rejected Enter')
   page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click();expect(e.locator('#capture-input')).to_have_js_property('value','')
   assert sum(m['text']=='Keep rejected Enter' for m in parse(page.evaluate('notes.a.content.text'))['messages'])==1
   # Tapping a card tool still works when click-outside captures a draft first.
   fill_search(e,'Changed title');card=e.locator('[data-id="'+small['messages'][192]['id']+'"]')
   fill_field(e.locator('#capture-input'),'Touch outside still sends')
   card.click(button='right')
   expect(e.get_by_role('menuitem',name='Copy',exact=True)).to_be_visible();page.keyboard.press('Escape')
   page.wait_for_function('notes.a.content.text.includes("Touch outside still sends")');assert parse(page.evaluate('notes.a.content.text'))['draft']=='Touch outside still sends'
   fill_search(e,'Changed title');card.click();e.locator('dialog').get_by_role('button',name='Background options',exact=True).click()
   e.get_by_role('group',name='Card background colors',exact=True).get_by_role('button',name='Default',exact=True).click();e.get_by_role('button',name='Close',exact=True).click()
   page.wait_for_function('!notes.a.content.text.includes("cardColor")')
   assert 'cardColor' not in parse(page.evaluate('notes.a.content.text'))['messages'][192]
   assert not errors,errors;assert not external,external
   print(f'PASS {width}px: compact columns, Enter/Shift+Enter and soft-keyboard send, IME, reveal/focus, saved labels/colors, IM interchange and failed-send retry',flush=True)
   if width==390:
    fill_search(e,'');e.locator('#viewport').evaluate('n=>n.scrollTop=0');page.screenshot(path='/tmp/mosaic-mobile-new.png')
   context.close()
  browser.close()
finally:server.shutdown()
