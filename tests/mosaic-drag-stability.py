"""Adversarial boundary hovering and exact preview-to-drop geometry."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](24);data['settings']['pinnedMessageIds']=[]
for i,m in enumerate(data['messages']):m['text']='Card '+str(i)+'\n'+('Mixed-height text.\n'*(i%9));m.pop('replyTo',None)
data['note']['content']['text']=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,'')));"],cwd=ROOT,input=json.dumps(data),text=True))
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,touch_mode in [(1100,False),(390,True)]:
   context=browser.new_context(viewport={'width':width,'height':1000},is_mobile=touch_mode,has_touch=touch_mode);page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible()
   cdp=context.new_cdp_session(page)
   def touch(kind,x=0,y=0):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':x,'y':y}]})
   def move(x,y):
    if touch_mode:touch('touchMove',x,y)
    else:page.mouse.move(x,y)
   def order():return e.locator('#board').evaluate('n=>MosaicModel.ordered(active.messages,dragPreview?.settings||active.settings).map(m=>m.id)')
   # Hovering the next card must displace it even when "before" would be a no-op.
   initial=order();source=e.locator('[data-id="'+initial[0]+'"]');target=e.locator('[data-id="'+initial[1]+'"]');a=source.bounding_box();b=target.bounding_box();x=a['x']+25;y=a['y']+20;count=page.evaluate('saves.length')
   if touch_mode:touch('touchStart',x,y);page.wait_for_timeout(550)
   else:page.mouse.move(x,y);page.mouse.down()
   move(x+16,y+3);expect(e.locator('.board-drag-ghost')).to_be_visible();move(b['x']+b['width']/2,b['y']+b['height']*.2);page.wait_for_timeout(700)
   assert order()!=initial,'Hovering an adjacent card must offer a different slot'
   assert page.evaluate('saves.length')==count
   if touch_mode:touch('touchEnd')
   else:page.mouse.up()
   expect(e.locator('.board-drag-ghost')).to_have_count(0);assert page.evaluate('saves.length')==count+1
   # Retarget a neighbor while it is visibly between its old and final slots.
   page.wait_for_timeout(450);initial=order();source=e.locator('[data-id="'+initial[0]+'"]');target=e.locator('[data-id="'+initial[1]+'"]');a=source.bounding_box();b=target.bounding_box();x=a['x']+25;y=a['y']+20
   if touch_mode:touch('touchStart',x,y);page.wait_for_timeout(550)
   else:page.mouse.move(x,y);page.mouse.down()
   move(x+16,y+3);move(b['x']+b['width']/2,b['y']+b['height']*.2)
   page.frames[1].wait_for_function('(ids)=>MosaicModel.ordered(active.messages,dragPreview.settings).some((m,i)=>m.id!==ids[i])',arg=initial)
   candidates=e.locator('.card:not(.is-drag-placeholder)').evaluate_all("ns=>{const all=ns.map(n=>({id:n.dataset.id,r:n.getBoundingClientRect().toJSON(),moving:n.getAnimations().some(a=>a.playState==='running')}));return all.filter(v=>{const x=v.r.left+v.r.width/2,y=v.r.top+v.r.height*.2;return v.moving&&y>70&&y<750&&!all.some(o=>o!==v&&x>=o.r.left&&x<=o.r.right&&y>=o.r.top&&y<=o.r.bottom)});}")
   assert candidates,'Fixture must expose an unambiguous moving neighbor'
   destination=candidates[-1];r=destination['r'];tx=r['left']+r['width']/2;ty=r['top']+r['height']*.2
   expected=e.locator('#board').evaluate('(n,p)=>{let next=MosaicModel.moveCard(active.messages,dragPreview.settings,p.id,p.target,false);if(next===dragPreview.settings)next=MosaicModel.moveCard(active.messages,dragPreview.settings,p.id,p.target,true);return MosaicModel.ordered(active.messages,next).map(m=>m.id)}',{'id':initial[0],'target':destination['id']})
   move(tx,ty);page.wait_for_timeout(700);assert order()==expected,'A visually hovered moving neighbor must earn its intended slot'
   if touch_mode:touch('touchEnd')
   else:page.mouse.up()
   expect(e.locator('.board-drag-ghost')).to_have_count(0)
   for trial in range(6):
    e.locator('#viewport').evaluate('n=>n.scrollTop=0');page.wait_for_timeout(450)
    positions=e.locator('.card').evaluate_all('ns=>ns.map(n=>({id:n.dataset.id,r:n.getBoundingClientRect().toJSON()})).filter(v=>v.r.top>=65&&v.r.bottom<820)')
    source=positions[trial%len(positions)];target=positions[(trial+2)%len(positions)];node=e.locator('[data-id="'+source['id']+'"]');r=source['r'];x=r['left']+r['width']/2;y=r['top']+20
    if touch_mode:touch('touchStart',x,y);page.wait_for_timeout(550)
    else:page.mouse.move(x,y);page.mouse.down()
    move(x+16,y+3);expect(e.locator('.board-drag-ghost')).to_be_visible();initial=order();count=page.evaluate('saves.length')
    r=target['r'];tx=r['left']+r['width']/2;ty=r['top']+r['height']*(.49 if trial%2 else .2);move(tx,ty)
    page.wait_for_timeout(60);assert order()==initial,'A passing hover must not immediately reshuffle cards'
    expected=e.locator('#board').evaluate('(n,p)=>(()=>{let next=MosaicModel.moveCard(active.messages,dragPreview.settings,p.id,p.target,false);if(next===dragPreview.settings)next=MosaicModel.moveCard(active.messages,dragPreview.settings,p.id,p.target,true);return MosaicModel.ordered(active.messages,next).map(m=>m.id)})()',{'id':source['id'],'target':target['id']})
    page.wait_for_timeout(260 if trial==5 else 650);settled=order();assert settled==expected,(width,trial,'intended target was not offered')
    # Small noisy movements must not oscillate the preview between two orders.
    seen=[]
    for i in range(0 if trial==5 else 24):
     move(tx+(i%3-1)*2,ty+(i%3-1)*2);page.wait_for_timeout(18);seen.append(order())
    assert all(value==settled for value in seen),(width,trial,'boundary oscillation')
    if trial!=5:page.wait_for_timeout(650);assert order()==settled,(width,trial,'delayed boundary oscillation')
    assert page.evaluate('saves.length')==count
    if trial==0:
     choices=e.locator('.card:not(.is-drag-placeholder)').evaluate_all('ns=>ns.filter(n=>n.dataset.id&&n.getBoundingClientRect().top>=65&&n.getBoundingClientRect().bottom<820).slice(0,2).map(n=>n.dataset.id)')
     for destination in [choices[0],choices[1],choices[0]]:
      box=e.locator('[data-id="'+destination+'"]').bounding_box();tx=box['x']+box['width']/2;ty=box['y']+box['height']*.2
      expected=e.locator('#board').evaluate('(n,p)=>(()=>{let next=MosaicModel.moveCard(active.messages,dragPreview.settings,p.id,p.target,false);if(next===dragPreview.settings)next=MosaicModel.moveCard(active.messages,dragPreview.settings,p.id,p.target,true);return MosaicModel.ordered(active.messages,next).map(m=>m.id)})()',{'id':source['id'],'target':destination})
      move(tx,ty);page.wait_for_timeout(750);assert order()==expected,'A destination must remain reachable after reversing direction'
     settled=order()
    # Observe the actual offered slot, then release over a different card before
    # it could earn a new preview. The displayed slot must win.
    slot=e.locator('.is-drag-placeholder').bounding_box();other=positions[(trial+3)%len(positions)]['r'];move(other['left']+20,other['top']+20)
    if touch_mode:touch('touchEnd')
    else:page.mouse.up()
    expect(e.locator('.board-drag-ghost')).to_have_count(0)
    assert order()==settled,(width,trial,'release selected an unseen destination')
    actual=node.bounding_box();assert abs(actual['x']-slot['x'])<1 and abs(actual['y']-slot['y'])<1,(width,trial,slot,actual)
    assert page.evaluate('saves.length')==count+(settled!=initial)
   assert not errors,errors
   print(f'PASS {width}px: adjacent displacement, moving-neighbor hover, six mixed-height/cross-column drags, reversals, 120 noisy midpoint moves, no delayed oscillation, exact displayed-slot drops including mid-animation release and one-save safety',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
