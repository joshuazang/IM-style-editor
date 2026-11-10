"""Proportional Board previews with phone 8x and computer 11x body preview budgets."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
from mosaic_helpers import fill_search

ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](7)
texts=['Short','Line one\nLine two\nLine three','\n'.join(['Long line']*100)+'\nHidden ending',
       ' '.join(['Long unbroken paragraph.']*100),'Body with title','\n'.join(['Tagged line']*100),'\n'.join(['Custom tagged line']*100)]
for message,text in zip(data['messages'],texts):
 message['text']=text;message['reactions']=[];message.pop('replyTo',None)
data['messages'][4]['title']='\n'.join(['A long title']*50)
data['messages'][5]['title']='A title'
data['messages'][5]['replyTo']={'id':data['messages'][0]['id'],'text':'A quoted thought','noteId':'a'}
data['messages'][5]['reactions']=['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍','🌿','⭐','🔬','🌙']
data['messages'][6].update(title='Title',replyTo=data['messages'][5]['replyTo'],reactions=['Long custom tag '+str(i) for i in range(12)])
data['settings']['pinnedMessageIds']=[]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  android='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
  desktop='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
  for width,ua,ratio in [(320,iphone,8),(390,android,8),(1100,desktop,11),(390,desktop,11),(844,iphone,8)]:
   for font in ['small','medium','large','extra-large']:
    data['settings']['mosaicFontSize']=font
    data['note']['content']['text']=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,'')));"],cwd=ROOT,input=json.dumps(data),text=True))
    context=browser.new_context(viewport={'width':width,'height':2400},user_agent=ua,is_mobile=ratio==8,has_touch=ratio==8);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note'])
    e=page.frame_locator('#editor');expect(e.locator('.card')).to_have_count(7);page.wait_for_timeout(100)
    cards=[e.locator('[data-id="'+m['id']+'"]') for m in data['messages']]
    heights=[card.bounding_box()['height'] for card in cards];minimum=heights[0]
    assert heights[1]>minimum+20,(width,font,heights)
    assert heights[2]>heights[1],(width,font,heights)
    assert heights[2]>(ratio-1)*minimum,(width,font,'Long cards must use the device-specific body budget',heights)
    for index in [2,3]:assert abs(heights[index]-ratio*minimum)<1,(width,font,index,'Plain truncated bodies share the standard maximum',heights)
    for index in [4,5,6]:assert heights[index]>ratio*minimum,(width,font,index,'Titles and tags add height outside the body budget',heights)
    body_heights=[cards[index].locator('.card-body').evaluate('n=>n.clientHeight') for index in [2,3,5,6]]
    assert len(set(body_heights))==1,(width,font,'Metadata must not reduce body text',body_heights)
    for card in cards:
     assert card.evaluate('n=>[...n.children].filter(c=>!c.classList.contains("selection-check")).every(c=>c.getBoundingClientRect().bottom<=n.getBoundingClientRect().bottom-2)'),(width,font,card.inner_text())
    body=cards[2].locator('.card-body');assert body.evaluate('n=>n.scrollHeight>n.clientHeight&&getComputedStyle(n).webkitLineClamp!=="none"')
    assert page.evaluate('saves.length')==0
    cards[2].click();expect(e.get_by_role('textbox',name='Card body',exact=True)).to_have_js_property('value',texts[2]);e.get_by_role('button',name='Close',exact=True).click()
    assert page.evaluate('saves.length')==0
    assert not errors,errors
    if width==390 and font=='large':page.screenshot(path='/tmp/mosaic-board-proportions.png')
    fill_search(e,'Hidden ending');expect(e.locator('.card')).to_have_count(1)
    assert cards[2].bounding_box()['height']<=ratio*minimum+1
    assert page.evaluate('saves.length')==0
    cards[2].click();fill_field(e.get_by_role('textbox',name='Card body',exact=True),'Shortened')
    e.get_by_role('button',name='Close',exact=True).click();fill_search(e,'Shortened');expect(e.locator('.card')).to_have_count(1)
    assert cards[2].bounding_box()['height']<2*minimum,'A shortened card must lose its full-height presentation'
    print(f'PASS {width}px {font}: proportional heights, {ratio}x body allowance, additive titles/tags/replies and intact opened text',flush=True)
    context.close()
  browser.close()
finally:server.shutdown()
