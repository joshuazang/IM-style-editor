"""Hanging reaction pills keep their own space and never clip or overlap cards."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
from mosaic_helpers import fill_search
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](80)
tag_sets=[[],['📓'],['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'],['📍','💡']]
for i,message in enumerate(data['messages']):
 message['text']='Card '+str(i);message['reactions']=tag_sets[i%4];message.pop('replyTo',None)
data['settings'].pop('pinnedMessageIds',None);data['draft']=''
data['note']['content']['text']=subprocess.run(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True,capture_output=True,check=True).stdout
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
geometry=r'''()=>{
 const nodes=[...document.querySelectorAll('.card')];if(nodes.length<3)return false;
 const cards=nodes.map(n=>({n,r:n.getBoundingClientRect(),tags:n.querySelector('.card-tags')}));
 for(const {n,r,tags} of cards){
  if(getComputedStyle(n).overflow!=='visible')return false;
  if(!tags)continue;const pills=[...tags.children].map(p=>p.getBoundingClientRect());
  if(!pills.length||!(pills[0].top<r.bottom&&pills[0].bottom>r.bottom))return false;
  if(pills.some(p=>p.left<r.left+3||p.right>r.right-3))return false;
  for(let i=0;i<pills.length;i++)for(let j=i+1;j<pills.length;j++)if(Math.min(pills[i].right,pills[j].right)-Math.max(pills[i].left,pills[j].left)>0&&Math.min(pills[i].bottom,pills[j].bottom)-Math.max(pills[i].top,pills[j].top)>0)return false;
  const next=cards.filter(c=>Math.abs(c.r.left-r.left)<1&&c.r.top>r.top+1).sort((a,b)=>a.r.top-b.r.top)[0];
  if(next&&tags.getBoundingClientRect().bottom+7>next.r.top)return false;
 }
 return true;
}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   for scheme in ['light','dark']:
    context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,color_scheme=scheme);page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE+'/') else None)
    page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_be_visible();frame=page.frames[1]
    frame.wait_for_function(geometry);assert e.locator('.card-body').first.evaluate('n=>getComputedStyle(n).fontSize')=='15px'
    before=page.evaluate('notes.a.content.text');assert page.evaluate('saves.length')==0
    for fraction in [.5,1,0]:e.locator('#viewport').evaluate('(n,f)=>n.scrollTop=(n.scrollHeight-n.clientHeight)*f',fraction);frame.wait_for_function(geometry)
    e.locator('#viewport').evaluate('n=>n.scrollTop=n.scrollHeight');page.wait_for_timeout(150)
    assert e.locator('.card-tags').evaluate_all('ns=>ns.every(n=>n.getBoundingClientRect().bottom<=document.querySelector("#capture-composer").getBoundingClientRect().top-7)')
    fill_search(e,'Card 1');card=e.locator('[data-id="'+data['messages'][1]['id']+'"]');card.click();dialog=e.get_by_role('dialog',name='Edit card',exact=True);tags=e.locator('.card-detail-tags');expect(tags).to_be_visible()
    def check_open():
     expect(dialog.get_by_role('button',name='Close',exact=True)).to_be_in_viewport()
     assert tags.evaluate('n=>{const r=n.closest("dialog").getBoundingClientRect(),p=n.firstElementChild.getBoundingClientRect(),b=n.getBoundingClientRect();return p.top<r.bottom&&p.bottom>r.bottom&&b.bottom<=innerHeight-7&&b.left>=0&&b.right<=innerWidth}')
     assert tags.evaluate('n=>getComputedStyle(n.closest("dialog")).overflow')=='visible'
    check_open();badge=tags.get_by_role('listitem').first
    if width<600:badge.tap()
    else:badge.click()
    expect(dialog).to_be_visible();assert page.evaluate('notes.a.content.text')==before and page.evaluate('saves.length')==0
    e.locator('.detail-more').click();e.get_by_role('button',name='Tag 📍',exact=True).click();expect(tags.get_by_role('listitem')).to_have_count(2);check_open();assert page.evaluate('saves.length')==0
    for emoji in ['📍','📓']:e.locator('.detail-more').click();e.get_by_role('button',name='Tag '+emoji,exact=True).click()
    expect(tags).not_to_be_visible();assert dialog.evaluate('n=>n.style.getPropertyValue("--tag-overhang")')=='0px'
    e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();assert e.locator('.card-detail-tags').count()==0
    fill_search(e,'Card 2');e.locator('[data-id="'+data['messages'][2]['id']+'"]').click();expect(tags.get_by_role('listitem')).to_have_count(8);check_open()
    page.set_viewport_size({'width':width,'height':480});expect(dialog.get_by_role('button',name='Close',exact=True)).to_be_in_viewport();page.wait_for_timeout(100);check_open();page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(100);check_open()
    if width==390 and scheme=='light':page.screenshot(path='/tmp/mosaic-hanging-tags-open.png')
    e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible();fill_search(e,'');frame.wait_for_function(geometry)
    if width==390 and scheme=='light':page.screenshot(path='/tmp/mosaic-hanging-tags-board.png')
    selected_id=e.locator('.card').first.get_attribute('data-id');e.locator('[data-id="'+selected_id+'"]').click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();frame.wait_for_function(geometry)
    e.get_by_role('button',name='Select all',exact=True).click();frame.wait_for_function(geometry)
    e.get_by_role('button',name='Cancel selection',exact=True).click();frame.wait_for_function(geometry)
    assert not errors,errors;assert not outside,outside
    print(f'PASS {width}px {scheme}: separate edge-straddling pills, wrapped clearance, scrolling, composer clearance, read-only modal badges, live tag updates, empty-row cleanup and short-viewport fitting',flush=True);context.close()
  browser.close()
finally:server.shutdown()
