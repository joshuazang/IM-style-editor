"""Selection overlays preserve bubble/card geometry, wrapping and viewport position."""
import functools,http.server,json,os,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](60)
for i,m in enumerate(data['messages']):
 identity=m['id'];m.clear();m.update(id=identity,text=['Short.',('Long text with ordinary words and punctuation. '*5),'First line\nSecond line\nThird line',('one_very_long_unbroken_word_'*10),''][i%5],reactions=['📓','⭐'] if i%3==0 else [],createdAt='2026-11-'+('06' if i<30 else '07')+'T12:00:00Z')
 if i%7==0:m['title']='An optional heading that can wrap across lines'
data['draft']='';data['settings'].pop('pinnedMessageIds',None)
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
snapshot=r'''mosaic=>{
 const scroller=document.querySelector(mosaic?'#viewport':'.messages'),rect=n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height]},rows={};
 for(const n of document.querySelectorAll(mosaic?'.card':'[data-selection-row]')){
  const body=n.querySelector(mosaic?'.card-body':'.message-body'),title=n.querySelector(mosaic?'.card-title':'.message-title'),wrap=mosaic?n:n.querySelector('.message-wrap');
  const lines=[];if(body){const range=document.createRange();range.selectNodeContents(body);for(const r of range.getClientRects())lines.push([r.x,r.y,r.width,r.height]);}
  rows[mosaic?n.dataset.id:n.dataset.selectionRow]={row:rect(n),wrap:rect(wrap),body:body?rect(body):[],title:title?rect(title):[],lines:lines.flat(),max:getComputedStyle(wrap).maxWidth};
 }
 return {rows,scroll:scroller.scrollTop,height:scroller.scrollHeight};
}'''
def compare(before,after):
 shared=before['rows'].keys()&after['rows'].keys();assert len(shared)>=3,len(shared)
 assert abs(before['scroll']-after['scroll'])<1,('viewport moved',before['scroll'],after['scroll'])
 assert abs(before['height']-after['height'])<1,('scroll extent changed',before['height'],after['height'])
 for identity in shared:
  a,b=before['rows'][identity],after['rows'][identity]
  assert a['max']==b['max'],('maximum width changed',identity,a,b)
  for field in ['row','wrap','body','title','lines']:
   assert len(a[field])==len(b[field]),('wrapping changed',identity,field,a[field],b[field])
   assert all(abs(x-y)<.8 for x,y in zip(a[field],b[field])),('geometry changed',identity,field,a[field],b[field])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [int(value) for value in os.environ.get('SELECTION_LAYOUT_WIDTHS','320,390,1100').split(',')]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   for mosaic in [False,True]:
    page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('({note,path})=>{notes.a=note;openEditor("a",path,true)}',{'note':data['note'],'path':'/mosaic/index.html' if mosaic else '/next/index.html'});e=page.frame_locator('#editor');frame=page.frames[1]
    expect(e.locator('#capture-input' if mosaic else '#append-text')).to_be_visible();page.wait_for_timeout(120)
    for position in ['middle','bottom']:
     if mosaic:e.locator('#viewport').evaluate('(n,pos)=>n.scrollTop=pos==="bottom"?n.scrollHeight:n.scrollHeight*.35',position)
     else:e.locator('.messages').evaluate('(n,{id,pos})=>pos==="bottom"?n.scrollTop=n.scrollHeight:n.imVirtual.reveal(id,()=>{})',{'id':data['messages'][20]['id'],'pos':position})
     page.wait_for_timeout(250)
     # Use a fully visible card/bubble, so the menu does not scroll its target.
     identity=frame.evaluate('''mosaic=>{const top=80,bottom=document.querySelector(mosaic?'#capture-composer':'.composer').getBoundingClientRect().top;for(const n of document.querySelectorAll(mosaic?'.card':'.message-wrap')){const r=n.getBoundingClientRect();if(r.top>top&&r.bottom<bottom-8&&r.height>30)return mosaic?n.dataset.id:n.dataset.messageId;}throw new Error('No visible target')}''',mosaic)
     target=e.locator(('[data-id="' if mosaic else '[data-message-id="')+identity+'"]');before=frame.evaluate(snapshot,mosaic)
     target.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();page.wait_for_timeout(180);compare(before,frame.evaluate(snapshot,mosaic))
     if width==390 and position=='middle':page.screenshot(path='/tmp/selection-layout-selected-'+('mosaic' if mosaic else 'im')+'.png')
     if mosaic:
      check=target.locator('.selection-check');r=check.bounding_box();card=target.bounding_box();assert r['x']<card['x'] and r['y']<card['y'] and r['width']==22
      assert check.evaluate('n=>getComputedStyle(n).backgroundColor')=='rgb(32, 33, 36)'
      assert target.evaluate('n=>getComputedStyle(n).borderTopWidth')=='1px'
      check.click();page.wait_for_timeout(80);compare(before,frame.evaluate(snapshot,mosaic));expect(e.locator('.selection-description')).to_contain_text('0 /')
      e.get_by_role('button',name='Cancel selection',exact=True).click()
     else:
      check=e.locator('[data-selection-row="'+identity+'"]>.selection-check')
      assert check.evaluate('n=>getComputedStyle(n).backgroundColor')=='rgba(0, 0, 0, 0)'
      assert check.evaluate('n=>getComputedStyle(n).boxShadow')=='none'
      assert check.evaluate('n=>getComputedStyle(n,"::before").width')=='20px'
      assert check.evaluate('n=>getComputedStyle(n,"::before").boxShadow')=='none'
      assert check.bounding_box()['x']<target.bounding_box()['x']
      e.get_by_role('button',name='Cancel',exact=True).click()
     page.wait_for_timeout(180);compare(before,frame.evaluate(snapshot,mosaic))
    assert page.evaluate('notes.a.content.text')==data['note']['content']['text'];assert page.evaluate('saves.length')==0
    if width==390:page.screenshot(path='/tmp/selection-layout-'+('mosaic' if mosaic else 'im')+'.png')
    print(f'PASS {width}px {"Mosaic" if mosaic else "IM"}: identical normal/selection/exit geometry and line wraps at middle/bottom; compact overlay markers; no note writes',flush=True)
   assert not errors,errors;context.close()
  browser.close()
finally:server.shutdown()
