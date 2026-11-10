"""Shared top vectors, equal button states, left check and an expanded Emoji picker."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](20);data['draft']=''
extra=['🌙','☀️','🌿','🌊','🔥','🌈','🎵','🚀','🔑','🌻','🍀','🦉']
data['settings']['reactionOrder']+=extra
for m in data['messages']:m['reactions']=[]
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
style=r'''n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect(),svg=n.querySelector('svg');return {width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,borderRadius:s.borderRadius,padding:s.padding,outline:s.outline,outlineOffset:s.outlineOffset,shadow:s.boxShadow,frost:s.backdropFilter,vector:svg?{viewBox:svg.getAttribute('viewBox'),width:getComputedStyle(svg).width,height:getComputedStyle(svg).height,markup:svg.innerHTML}:null}}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));states=[]
   for mosaic in [False,True]:
    page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('({note,path})=>{notes.a=note;openEditor("a",path,true)}',{'note':data['note'],'path':'/mosaic/index.html' if mosaic else '/next/index.html'});e=page.frame_locator('#editor');frame=page.frames[1]
    expect(e.locator('#capture-input' if mosaic else '#append-text')).to_be_visible()
    search=e.get_by_role('button',name='Search and tags',exact=True);more=e.get_by_role('button',name='More options',exact=True);s={}
    # Keep the pointer away when comparing normal states.
    page.mouse.move(1,800);s['normal']=[search.evaluate(style),more.evaluate(style)];normal_radius=search.locator('svg>circle').first.get_attribute('r')
    search.focus();search.press('Tab');page.keyboard.press('Shift+Tab');s['searchFocus']=search.evaluate(style);assert '2px' in s['searchFocus']['outline']
    search.click()
    field=e.locator('#search') if mosaic else e.get_by_role('textbox',name='Search messages',exact=True);expect(field).to_be_focused();s['searchOpen']=search.evaluate(style);fill_field(field,'Thought');field.press('Escape');change=e.get_by_role('button',name='Change filters',exact=True);clear=e.get_by_role('button',name='Clear all filters',exact=True)
    pill=e.locator('.ui-filter-pill');expect(pill).to_be_visible();s['filter']=[pill.evaluate(style),change.evaluate(style),clear.evaluate(style)]
    icon=change.locator('.ui-filter-symbol>svg');assert icon.locator('circle').count()==1;assert icon.locator('path').count()==1
    assert icon.get_attribute('viewBox')==s['normal'][0]['vector']['viewBox']
    assert icon.evaluate('n=>getComputedStyle(n).width')==s['normal'][0]['vector']['width']=='28px'
    assert icon.locator('circle').get_attribute('r')==normal_radius=='7.5'
    if width==390:page.screenshot(path='/tmp/shared-filter-'+('mosaic' if mosaic else 'im')+'.png')
    badge=change.locator('.ui-filter-check');assert badge.bounding_box()['x']<change.locator('.ui-filter-symbol').bounding_box()['x']
    clear.click();search.click();e.get_by_role('button',name='Untagged cards' if mosaic else 'Untagged',exact=True).click();expect(change).to_be_visible();s['untagged']=change.evaluate(style);clear.click();more.focus();more.press('Shift+Tab');page.keyboard.press('Tab');s['moreFocus']=more.evaluate(style)
    more.click();expect(more).to_have_attribute('aria-expanded','true');s['moreOpen']=more.evaluate(style);page.keyboard.press('Escape')
    # The picker has more than two rows, all visible, with no inner scrollbar.
    if mosaic:
     search.click();fill_field(field,'Thought 2');field.press('Escape');target=e.locator('[data-id="'+data['messages'][2]['id']+'"]')
    else:
     search.click();fill_field(field,'Thought 2');field.press('Escape');target=e.locator('[data-message-id="'+data['messages'][2]['id']+'"]')
    target.click(button='right');picker=e.get_by_role('group',name='Emoji picker',exact=True);expect(picker).to_be_visible();choices=picker.locator('button');assert choices.count()>=20
    assert picker.evaluate('n=>n.scrollHeight<=n.clientHeight+1&&getComputedStyle(n).overflowY==="visible"')
    assert choices.evaluate_all('ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})')
    assert choices.first.get_attribute('aria-pressed')=='false'
    assert picker.evaluate('n=>!n.contains(document.activeElement)'), 'Opening the menu must not focus an unselected emoji'
    if width==390:page.screenshot(path='/tmp/emoji-picker-'+('mosaic' if mosaic else 'im')+'.png')
    page.keyboard.press('Escape');assert page.evaluate('saves.length')==0;assert page.evaluate('notes.a.content.text')==data['note']['content']['text']
    states.append(s)
   assert states[0]==states[1],[(key,states[0][key],states[1][key]) for key in states[0] if states[0][key]!=states[1][key]]
   assert not errors,errors;print(f'PASS {width}px: identical Search/More vectors, normal/open/focus states and filter pill; same-size search glyph; left green check; fully expanded Emoji picker without false focus or note writes',flush=True);context.close()
  browser.close()
finally:server.shutdown()
