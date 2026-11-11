"""Device/pin-specific body caps, metadata allowance and live pin transitions."""
import functools,http.server,json,subprocess,threading,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')};exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,phone in [(390,True),(844,True),(1100,False),(390,False)]:
   for font in ['small','large','extra-large']:
    data=scope['fixture'](6)
    for i,m in enumerate(data['messages']):
     m['text']='Short' if i in [1,3] else 'Long line\n'*300;m['reactions']=[];m.pop('title',None);m.pop('replyTo',None)
     if i>=4:m.update(title='Title',reactions=['📍','✅'],replyTo={'id':data['messages'][1]['id'],'text':'Quoted text','noteId':'a'})
    data['settings']['pinnedMessageIds']=[data['messages'][i]['id'] for i in [0,1,4]];data['settings']['mosaicFontSize']=font
    data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
    ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if phone else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
    context=browser.new_context(viewport={'width':width,'height':2600},user_agent=ua,is_mobile=phone,has_touch=phone);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card')).to_have_count(6)
    cards=[e.locator('[data-id="'+m['id']+'"]') for m in data['messages']];minimum=cards[1].bounding_box()['height'];pin_cap,other_cap=(6,8) if phone else (8,14)
    assert abs(cards[3].bounding_box()['height']-minimum)<1
    for index,ratio in [(0,pin_cap),(2,other_cap)]:assert abs(cards[index].bounding_box()['height']-ratio*minimum)<1,(width,font,index,ratio)
    for index,plain in [(4,0),(5,2)]:
     assert cards[index].bounding_box()['height']>cards[plain].bounding_box()['height']
     assert cards[index].locator('.card-body').evaluate('n=>n.clientHeight')==cards[plain].locator('.card-body').evaluate('n=>n.clientHeight')
     assert cards[index].evaluate('n=>Math.abs(n.getBoundingClientRect().bottom-n.querySelector(".card-tags").getBoundingClientRect().bottom-parseFloat(getComputedStyle(n).paddingBottom)-parseFloat(getComputedStyle(n).borderBottomWidth))<1')
    assert page.evaluate('saves.length')==0;before=scope['parse'](page.evaluate('notes.a.content.text'))['messages']
    target=cards[2]
    for label,ratio in [('Pin',pin_cap),('Unpin',other_cap)]:
     target.click(button='right');e.get_by_role('menuitem',name=label,exact=True).click()
     target.evaluate('''(n,height)=>new Promise((resolve,reject)=>{const start=performance.now();function check(){if(Math.abs(n.getBoundingClientRect().height-height)<1)return resolve();if(performance.now()-start>4000)return reject(Error('Pin cap not updated: '+n.style.height));requestAnimationFrame(check)}check()})''',ratio*minimum)
    assert scope['parse'](page.evaluate('notes.a.content.text'))['messages']==before;assert not errors,errors
    print(f'PASS {width}px phone={phone} {font}: pinned {pin_cap}x, unpinned {other_cap}x, additive metadata, tag padding and pin/unpin cache refresh',flush=True);context.close()
  browser.close()
finally:server.shutdown()
