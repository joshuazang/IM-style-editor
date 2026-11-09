"""Opened-card edge scroller, trailing metadata, overflow shadow and save safety."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](1);parse=scope['parse'];text='\n'.join(f'Line {i}: text across the usable card width.' for i in range(120));data['messages'][0]['text']=text
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,height in [(320,430),(390,844),(1100,900)]:
   for titled in [False,True]:
    if titled:data['messages'][0]['title']='Optional title'
    else:data['messages'][0].pop('title',None)
    data['note']['content']['text']=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,d.draft)));"],cwd=ROOT,input=json.dumps(data),text=True))
    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note'])
    e=page.frame_locator('#editor');e.locator('.card').first.click();body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_visible();page.wait_for_timeout(100)
    pane=e.locator('.card-detail-scroll');bottom=e.locator('.card-detail-bottom');meta=e.locator('.card-detail-meta');close=e.get_by_role('button',name='Close',exact=True)
    assert pane.evaluate('n=>n.scrollTop')<2
    assert pane.evaluate('n=>n.scrollHeight>n.clientHeight+1000')
    assert body.evaluate('n=>getComputedStyle(n).overflowY==="hidden"&&n.scrollHeight<=n.clientHeight+1')
    rect=pane.bounding_box();card=e.locator('dialog').bounding_box();assert card['x']+card['width']-(rect['x']+rect['width'])<=2
    if width<600:assert card['width']>=width-18,(width,card)
    assert body.bounding_box()['width']>card['width']-50
    assert rect['y']-card['y']<=2 and pane.evaluate('n=>getComputedStyle(n).paddingTop')=='0px'
    pin=e.get_by_role('button',name='Pin card',exact=True);expect(pin).to_be_in_viewport()
    for control in [close,e.get_by_role('button',name='Background options',exact=True),e.get_by_role('button',name='Card options',exact=True)]:
     bounds=control.bounding_box();assert card['y']+card['height']-(bounds['y']+bounds['height'])<=2,(width,card,bounds)
    expect(meta).not_to_be_in_viewport();expect(close).to_be_in_viewport();position=close.bounding_box()
    for fraction in [0,.5,1,.9]:
     pane.evaluate('(n,f)=>n.scrollTop=(n.scrollHeight-n.clientHeight)*f',fraction);page.wait_for_timeout(80)
     assert bottom.evaluate('n=>n.classList.contains("has-content-below")')==(fraction!=1)
     assert (bottom.evaluate('n=>getComputedStyle(n).boxShadow')!='none')==(fraction!=1)
     assert close.bounding_box()==position
     if fraction==1:expect(meta).to_be_in_viewport()
     if fraction==.5:expect(pin).not_to_be_in_viewport()
    assert page.evaluate('saves.length')==0
    pane.evaluate('n=>n.scrollTop=0')
    if width==390 and not titled:page.screenshot(path='/tmp/mosaic-open-card-edge-scroll.png')
    body.press('Control+Home')
    for _ in range(40):body.press('ArrowDown')
    assert pane.evaluate('n=>n.scrollTop>100'),'Keyboard caret navigation must scroll the shared content area'
    body.press('Control+End');body.type('\nEnd edit');expect(body).to_have_value(text+'\nEnd edit');expect(close).to_be_in_viewport()
    assert pane.evaluate('n=>n.scrollTop>0')
    page.evaluate('rejectSaves=true');close.click();expect(e.get_by_role('alert').filter(has_text='Saving was not confirmed').last).to_be_visible();expect(body).to_have_value(text+'\nEnd edit');expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_in_viewport()
    page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(e.locator('dialog')).not_to_be_visible()
    saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][0]['text']==text+'\nEnd edit' and saved['draft']==data['draft']
    assert saved['messages'][0].get('title','')==('Optional title' if titled else '')
    assert not errors,errors
    print(f'PASS {width}x{height} title={titled}: single edge scrollbar, full-width text, scrolling metadata, fixed toolbar, correct shadow states, caret end and failed-save retry',flush=True)
    context.close()
  browser.close()
finally:server.shutdown()
