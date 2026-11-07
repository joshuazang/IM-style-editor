"""Synthetic palette/type persistence, shared hover feedback and compact previews."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
from mosaic_helpers import fill_search,open_search,open_more
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse'];data=fixture(80)
for i in [78,79]:data['messages'][i]['text']='A short title';data['messages'][i]['reactions']=[] if i==78 else ['📓']
data['note']['content']['text']=json.loads(subprocess.run(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,d.draft)));"],cwd=ROOT,input=json.dumps(data),text=True,capture_output=True,check=True).stdout)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
 def do_GET(self):
  if self.path.split('?',1)[0]=='/__host':self.path='/tests/mosaic-host.html'
  return super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
contrast="""n=>{const s=getComputedStyle(n),c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]};const bg=rgba(getComputedStyle(n.closest('.card')||document.documentElement).backgroundColor),fg=rgba(s.color);const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const composed=fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));const a=lum(composed),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}"""
control_contrast="""n=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]};const s=getComputedStyle(n),fg=rgba(s.color),bg=rgba(s.backgroundColor);const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);return [getComputedStyle(document.documentElement).backgroundColor,'#fff','#000','#4e5cf0'].map(color=>{const base=rgba(color),under=bg.slice(0,3).map((v,i)=>v*bg[3]/255+base[i]*(1-bg[3]/255)),ink=fg.slice(0,3).map((v,i)=>v*fg[3]/255+under[i]*(1-fg[3]/255)),a=lum(ink),b=lum(under);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)})}"""
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,color_scheme='light')
   page=context.new_page();errors=[];external=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE+'/') else None)
   page.goto(BASE+'/__host');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note'])
   e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_be_visible()
   assert page.evaluate('saves.length')==0 and page.evaluate('notes.a.content.text')==data['note']['content']['text']
   assert e.locator('html').get_attribute('data-mosaic-font-size')=='large'
   assert e.locator('.card-body').first.evaluate('n=>getComputedStyle(n).fontSize')=='15px'
   assert e.locator('.card-meta').count()==0
   def choose(kind,name):
    open_more(e);e.get_by_role('menuitem',name=kind,exact=True).click()
    choice=e.get_by_role('dialog').get_by_role('button',name=name,exact=True);choice.click();expect(choice).to_have_attribute('aria-pressed','true')
    expect(choice).to_be_enabled();e.get_by_role('button',name='Done',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
   # Medium retains the previous typography; all four choices remeasure previews.
   for name,pixels in [('Medium','13px'),('Small','12px'),('Extra large','18px'),('Large','15px')]:
    choose('Font size',name);assert e.locator('.card-body').first.evaluate('n=>getComputedStyle(n).fontSize')==pixels
    assert e.locator('.card').evaluate_all('nodes=>{const rs=nodes.map(n=>n.getBoundingClientRect());return rs.every((a,i)=>rs.every((b,j)=>i===j||Math.min(a.right,b.right)-Math.max(a.left,b.left)<1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1))}')
   choose('Font size','Medium')
   a=e.locator('[data-id="'+data['messages'][78]['id']+'"]');b=e.locator('[data-id="'+data['messages'][79]['id']+'"]')
   a.scroll_into_view_if_needed();page.wait_for_timeout(100)
   gap=b.bounding_box()['height']-a.bounding_box()['height'];assert 28<=gap<=32,gap
   assert a.evaluate('n=>parseFloat(getComputedStyle(n).paddingTop)')<=14
   tag=b.locator('.card-tag');assert tag.locator('svg').count()==2
   assert tag.locator('.emoji-tag-tip').get_attribute('viewBox')=='0 0 20 40'
   # Filter chip hover is visible, bordered and frosted; selection still filters.
   open_search(e);chip=e.get_by_role('button',name='Filter by 📚',exact=True);before=chip.evaluate('n=>getComputedStyle(n).backgroundColor')
   chip.hover();hover=chip.evaluate('n=>getComputedStyle(n).backgroundColor');assert hover!=before
   assert chip.evaluate('n=>getComputedStyle(n).borderTopStyle')=='solid'
   assert chip.evaluate('n=>getComputedStyle(n).backdropFilter')=='blur(10px)'
   chip.click();expect(e.locator('#search-tags-panel')).not_to_be_visible();expect(e.locator('#filter-pill')).to_be_visible()
   e.get_by_role('button',name='Clear all filters',exact=True).click()
   # Statuses remain in the record and opened card, and pins provide circular feedback.
   fill_search(e,'A title');card=e.locator('[data-id="'+data['messages'][0]['id']+'"]');card.hover()
   assert card.locator('.pin-card,.more-card,.card-tools').count()==0
   card.click();expect(e.locator('.card-detail-meta')).to_contain_text('Copied');expect(e.locator('.card-detail-meta')).to_contain_text('Exported');expect(e.locator('.card-detail-meta')).to_contain_text('edited')
   pin=e.locator('.detail-pin');e.get_by_role('textbox',name='Card body',exact=True).hover();base=pin.evaluate('n=>getComputedStyle(n).backgroundColor');pin.hover();assert pin.evaluate('n=>getComputedStyle(n).backgroundColor')!=base
   e.get_by_role('button',name='Close',exact=True).click();fill_search(e,'')
   # Each palette keeps readable text in both OS appearances and preserves note data.
   for scheme in ['light','dark']:
    page.emulate_media(color_scheme=scheme)
    for name in ['Sage','Paper','Sand']:
     choose('Color palette',name);assert e.locator('.card-body').first.evaluate(contrast)>=4.5
     assert e.locator('.card-body').first.evaluate(contrast)>=4.5
     if scheme=='dark':
      assert e.locator('html').evaluate('n=>getComputedStyle(n).colorScheme')=='light'
      assert e.locator('html').evaluate('n=>getComputedStyle(n).backgroundColor')=={'Sage':'rgb(248, 249, 245)','Paper':'rgb(247, 248, 250)','Sand':'rgb(250, 241, 231)'}[name]
      assert e.locator('.board-toolbar').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgba(0, 0, 0, 0)'
      assert e.locator('#search-button').evaluate('n=>getComputedStyle(n).backdropFilter')=='blur(10px)'
      if width==390 and name=='Sand':page.screenshot(path='/tmp/mosaic-dark-header-fixed.png')
   page.emulate_media(color_scheme='light')
   saved=parse(page.evaluate('notes.a.content.text'))
   assert saved['messages']==data['messages'],[(i,a,b) for i,(a,b) in enumerate(zip(saved['messages'],data['messages'])) if a!=b]
   assert saved['draft']==data['draft'],(repr(saved['draft']),repr(data['draft']))
   assert saved['settings']=={**data['settings'],'mosaicPalette':'sand','mosaicFontSize':'medium'}
   # Different notes keep independent appearance, with no default-write migration.
   page.evaluate('notes.b={uuid:"b",content_type:"Note",content:{text:""}};switchNote("b")');expect(e.locator('html')).to_have_attribute('data-mosaic-palette','sage');expect(e.locator('html')).to_have_attribute('data-mosaic-font-size','large')
   page.evaluate('switchNote("a")');expect(e.locator('html')).to_have_attribute('data-mosaic-palette','sand')
   page.evaluate('openEditor("a","/mosaic/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('html')).to_have_attribute('data-mosaic-font-size','medium')
   # Failed appearance saves use the existing retained queue and visible retry.
   page.evaluate('rejectSaves=true');open_more(e);e.get_by_role('menuitem',name='Color palette',exact=True).click();e.get_by_role('dialog').get_by_role('button',name='Paper',exact=True).click()
   expect(e.locator('.dialog-error')).to_contain_text('Saving was not confirmed');assert parse(page.evaluate('notes.a.content.text'))['settings']['mosaicPalette']=='sand'
   e.get_by_role('button',name='Done',exact=True).click();page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(e.locator('#notice')).not_to_be_visible()
   assert parse(page.evaluate('notes.a.content.text'))['settings']['mosaicPalette']=='paper'
   if width==390:page.screenshot(path='/tmp/mosaic-appearance-1.0.6.png')
   # The IM search menu shares the same unselected hover tint, without losing its border.
   page.evaluate('openEditor("a","/next/index.html",true)');im=page.frame_locator('#editor');expect(im.get_by_role('textbox',name='Message',exact=True)).to_be_visible()
   im.get_by_role('button',name='Search and tags',exact=True).click();imchip=im.locator('.search-tags-panel .chip').filter(has_text='📚').first
   imchip.hover();assert imchip.evaluate('n=>getComputedStyle(n).backgroundColor')==hover
   assert imchip.evaluate('n=>getComputedStyle(n).borderTopStyle')=='solid'
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['settings']['mosaicFontSize']=='medium' and saved['settings']['mosaicPalette']=='paper';assert saved['messages']==data['messages'] and saved['draft']==data['draft']
   assert not errors,errors;assert not external,external
   print(f'PASS {width}px: practical palettes, readable contrast, four measured font sizes, Medium compatibility/Large default, scoped saved settings/retry/IM interchange, compact status-free previews, bounded frosted tags and shared hover feedback',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
