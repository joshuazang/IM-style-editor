"""Synthetic popup bounds, status tap targets and Mosaic card accessibility/tags.

VisualViewport events below simulate keyboard geometry, not native iOS UI.
"""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options

ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](3)
for message,text in zip(data['messages'],['Call the dentist','Buy coffee\nBring a shopping bag','Packing list']):
 message['text']=text;message.pop('replyTo',None)
data['messages'][2]['reactions']=['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍','🌿','⭐','🔬','🌙']
data['settings'].pop('pinnedMessageIds',None);data['settings']['mosaicFontSize']='extra-large';data['draft']='Unsent capture'
data['note']['content']['text']=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,d.draft)));"],cwd=ROOT,input=json.dumps(data),text=True))
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,height in [(320,568),(390,430),(1100,900)]:
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];external=[]
   page.on('pageerror',lambda error:errors.append(str(error)));page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE+'/') else None)
   for mosaic in [False,True]:
    page.set_viewport_size({'width':width,'height':height});page.goto(BASE+'/tests/mosaic-host.html')
    page.evaluate('({note,path})=>{notes.a=note;openEditor("a",path,true)}',{'note':data['note'],'path':'/mosaic/index.html' if mosaic else '/next/index.html'})
    e=page.frame_locator('#editor');capture=e.locator('#capture-input' if mosaic else '#append-text');expect(capture).to_be_visible()
    # Click the empty right side of each label, away from its small checkbox.
    e.get_by_role('button',name='More options',exact=True).click()
    e.get_by_role('menuitem' if mosaic else 'button',name='Clear message statuses' if mosaic else 'Clear message statuses…',exact=True).click()
    dialog=e.get_by_role('dialog');checks=dialog.get_by_role('checkbox')
    rows=checks.evaluate_all('ns=>ns.map(n=>n.parentElement.getBoundingClientRect().toJSON())')
    assert all(r['height']>=44 for r in rows),rows
    assert all(a['bottom']<=b['top'] for a,b in zip(rows,rows[1:])),rows
    for index in range(checks.count()):
     row=checks.nth(index).locator('..');box=row.bounding_box();row.click(position={'x':box['width']-6,'y':box['height']/2})
     assert checks.evaluate_all('ns=>ns.map(n=>n.checked)')==[i==index for i in range(4)]
     row.click(position={'x':box['width']-6,'y':box['height']/2});expect(checks.nth(index)).not_to_be_checked()
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    if mosaic:
     card=e.locator('[data-id="'+data['messages'][2]['id']+'"]');more=card.get_by_role('button',name='Show 2 more tags',exact=True)
     expect(more).to_have_text('+2');assert card.locator('.emoji-tag-emoji').count()==10
     before=e.locator('.card').evaluate_all('ns=>ns.map(n=>({id:n.dataset.id,text:n.querySelector(".card-body").textContent,box:n.getBoundingClientRect().toJSON()}))')
     more.click();expect(e.locator('.card-detail-tags .card-tag')).to_have_count(12);dialog.get_by_role('button',name='Close',exact=True).click()
     card.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
     for message in data['messages']:
      node=e.locator('[data-id="'+message['id']+'"]');name=' '.join(message['text'].split())
      assert node.get_attribute('aria-label')==('Selected: ' if message['id']==data['messages'][2]['id'] else 'Select: ')+name
      expect(node.locator('.card-body')).to_have_text(message['text'])
     other=e.locator('[data-id="'+data['messages'][0]['id']+'"]');other.focus();other.press('Space');expect(other).to_have_attribute('aria-label','Selected: Call the dentist');other.press('Space');expect(other).to_have_attribute('aria-label','Select: Call the dentist')
     more.click();expect(dialog).not_to_be_visible();expect(card).to_have_attribute('aria-label','Select: Packing list')
     after=e.locator('.card').evaluate_all('ns=>ns.map(n=>({id:n.dataset.id,text:n.querySelector(".card-body").textContent,box:n.getBoundingClientRect().toJSON()}))')
     assert before==after,(before,after)
     # Wrapped tags and the overflow badge never overlap the next card.
     for a in after:
      for b in after:
       if a['id']!=b['id']:
        ra,rb=a['box'],b['box'];assert min(ra['right'],rb['right'])-max(ra['left'],rb['left'])<1 or min(ra['bottom'],rb['bottom'])-max(ra['top'],rb['top'])<1
     e.get_by_role('button',name='Cancel selection',exact=True).click()
    # A real rejected save supplies a persistent warning above the toolbar.
    page.evaluate('rejectSaves=true');capture.fill('Unconfirmed draft stays available')
    expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_visible()
    e.get_by_role('button',name='Search and tags',exact=True).click();e.get_by_role('button',name='Jump to date',exact=True).click()
    date=e.get_by_label('Date',exact=True);date.fill('2028-02-29');date.evaluate('n=>n.dataset.preserved="yes"')
    panel=e.locator('#search-tags-panel')
    def fits(top=0,available=None):
     page.wait_for_timeout(80);r=panel.bounding_box();bottom=top+(available if available is not None else page.viewport_size['height'])
     assert r['y']>=top+7 and r['y']+r['height']<=bottom-7,(mosaic,width,top,bottom,r)
     assert panel.evaluate('n=>n.scrollWidth<=n.clientWidth+1')
    fits()
    if mosaic:
     last=e.locator('#pinned-filter');last.scroll_into_view_if_needed();r=last.bounding_box();assert r['y']>=0 and r['y']+r['height']<=height
    # Closing releases listeners. Reopening captures a simulated keyboard viewport.
    page.keyboard.press('Escape')
    capture.evaluate('()=>{window.__nativeViewport=window.visualViewport;const v=new EventTarget();Object.assign(v,{height:innerHeight,offsetTop:0,width:innerWidth,offsetLeft:0});window.__panelHandlers=new Map();window.__panelHandlerCount=()=>[...__panelHandlers.values()].reduce((sum,s)=>sum+s.size,0);const add=v.addEventListener.bind(v),remove=v.removeEventListener.bind(v);v.addEventListener=(n,f,...a)=>{if(!__panelHandlers.has(n))__panelHandlers.set(n,new Set());__panelHandlers.get(n).add(f);add(n,f,...a)};v.removeEventListener=(n,f,...a)=>{__panelHandlers.get(n)?.delete(f);remove(n,f,...a)};Object.defineProperty(window,"visualViewport",{configurable:true,value:v});}')
    for cycle in range(3):
     e.get_by_role('button',name='Search and tags',exact=True).click();assert capture.evaluate('()=>__panelHandlerCount()')==2
     if cycle==0:
      e.get_by_role('button',name='Jump to date',exact=True).click();date=e.get_by_label('Date',exact=True);date.fill('2028-02-29');date.evaluate('n=>n.dataset.preserved="yes"')
      for event,top,available in [('resize',40,220),('scroll',90,240),('resize',0,height)]:
       capture.evaluate('(node,{event,top,height})=>{Object.assign(visualViewport,{offsetTop:top,height});visualViewport.dispatchEvent(new Event(event));}',{'event':event,'top':top,'height':available});fits(top,available)
       expect(date).to_have_value('2028-02-29');expect(date).to_have_attribute('data-preserved','yes')
     page.keyboard.press('Escape');assert capture.evaluate('()=>__panelHandlerCount()')==0
    capture.evaluate('()=>Object.defineProperty(window,"visualViewport",{configurable:true,value:__nativeViewport})')
    e.get_by_role('button',name='Search and tags',exact=True).click();page.set_viewport_size({'width':width,'height':350});fits()
    e.get_by_role('button',name='Jump to date',exact=True).click();fits()
    if width==390:page.screenshot(path='/tmp/ui-followups-'+('mosaic' if mosaic else 'im')+'.png')
    page.keyboard.press('Escape');expect(capture).to_have_value('Unconfirmed draft stays available')
    assert page.evaluate('saves.length')==0;assert page.evaluate('notes.a.content.text')==data['note']['content']['text']
   assert not errors,errors;assert not external,external
   print(f'PASS {width}×{height}: 44px separate status rows, label taps, distinct selection labels and unchanged visible text/layout, complete tags via +N, bounded warning/short/visual viewport search panels, native field preserved, listener cleanup; no note writes or external requests',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
