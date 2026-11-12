"""Phone scroll/outside taps dismiss typing without losing the opened card."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')};exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](1);data['messages'][0]['text']='Seed\n'+'A long reading line\n'*150;data['messages'][0].pop('replyTo',None)
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for name,ua,mobile in [('iPhone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',True),('Android','Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',True),('Mac','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',False)]:
   context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':900},user_agent=ua,is_mobile=mobile,has_touch=mobile)
   if name=='iPhone':context.add_init_script("Object.defineProperty(navigator,'vendor',{get:()=> 'Apple Computer, Inc.'})")
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');e.locator('.card').first.click();dialog=e.locator('dialog');dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_editable();body.click();body.press('Control+End');body.press('Enter');page.wait_for_timeout(300);expect(body.locator('p')).to_have_count(2);expect(body).to_be_focused();body.type('keyboard sample')
   pane=e.locator('.card-detail-scroll')
   if mobile:
    e.locator('.card-detail-tools').click(position={'x':60,'y':10});expect(body).not_to_be_focused();expect(dialog).to_be_visible();assert page.evaluate('saves.length')==0
    body.focus();expect(body).to_be_focused();e.get_by_role('button',name='Text formatting',exact=True).click();expect(body).to_be_focused();expect(e.get_by_role('toolbar',name='Text formatting',exact=True)).to_be_visible();e.get_by_role('button',name='Text formatting',exact=True).click()
    rect=pane.bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+100;cdp=context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for distance in [15,35,65]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+distance}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});expect(body).not_to_be_focused();expect(dialog).to_be_visible();assert body.evaluate('n=>n.imRich.view.state.doc.textContent.endsWith("keyboard sample")');assert page.evaluate('saves.length')==0
   else:
    pane.evaluate('n=>n.scrollTop=0');expect(body).to_be_focused()
   e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text'].endswith('keyboard sample');assert not errors,errors;print('PASS '+name+': single Enter, keyboard focus during typing/formatting, scroll/outside dismissal, retained draft and save',flush=True);context.close()
  browser.close()
finally:server.shutdown()
