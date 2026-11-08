"""Real mouse/touch Board gestures, animation, one-save drops and cancellation."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
from mosaic_helpers import open_more

ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](12);parse=scope['parse']
data['settings']['pinnedMessageIds']=[]
data['note']['content']['text']=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,'')));"],cwd=ROOT,input=json.dumps(data),text=True))
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();BASE=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width,reduced in [(1100,False),(390,False),(390,True)]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,reduced_motion='reduce' if reduced else 'no-preference')
   page=context.new_page();errors=[];external=[];page.on('pageerror',lambda error:errors.append(str(error)));page.on('request',lambda request:external.append(request.url) if not request.url.startswith(BASE+'/') else None)
   page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a","/mosaic/index.html",true)}',data['note'])
   e=page.frame_locator('#editor');field=e.locator('#capture-input');expect(field).to_be_visible()
   # New cards enter and their neighbors move. Neither effect runs in reduced motion.
   old_ids=[m['id'] for m in data['messages']]
   field.fill('A freshly captured thought');field.press('Enter');expect(field).to_have_value('')
   saved=parse(page.evaluate('notes.a.content.text'));new_id=saved['messages'][-1]['id'];card=e.locator('[data-id="'+new_id+'"]')
   frames=card.evaluate('n=>n.getAnimations().map(a=>a.effect.getKeyframes())')
   assert bool(frames)==(not reduced),(width,reduced,frames)
   if not reduced:
    assert any(frame[0].get('opacity')=='0' for frame in frames),frames
    moving=e.locator('.card').evaluate_all('ns=>ns.filter(n=>n.getAnimations().some(a=>{const f=a.effect.getKeyframes();return f[0].transform!==f[f.length-1].transform})).length')
    assert moving>1,moving
   page.wait_for_timeout(300)
   original_texts=[m['text'] for m in saved['messages']];original_ids=[m['id'] for m in saved['messages']]
   cdp=context.new_cdp_session(page)
   def touch(kind,x=0,y=0):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind in ['touchEnd','touchCancel'] else [{'x':x,'y':y}]})
   def begin(source):
    box=source.bounding_box();x=box['x']+box['width']/2;y=box['y']+min(30,box['height']/2)
    if width<600:
     touch('touchStart',x,y);page.wait_for_timeout(560);touch('touchMove',x+15,y+5)
    else:
     page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+15,y+5)
    expect(e.locator('.board-drag-ghost')).to_be_visible();return x,y
   def move_to(target):
    box=target.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']-10
    if width<600:touch('touchMove',x,y)
    else:page.mouse.move(x,y,steps=6)
    page.wait_for_timeout(80)
   def release():
    if width<600:touch('touchEnd')
    else:page.mouse.up()
   # Reorder without saving each intermediate position; the drop saves once.
   count=page.evaluate('saves.length');before=page.evaluate('notes.a.content.text')
   begin(card);release();expect(e.locator('.board-drag-ghost')).to_have_count(0)
   assert page.evaluate('saves.length')==count and page.evaluate('notes.a.content.text')==before
   begin(card);target=e.locator('[data-id="'+data['messages'][9]['id']+'"]');move_to(target)
   expect(e.locator('.is-drag-placeholder')).to_have_count(1)
   if width==390 and not reduced:page.screenshot(path='/tmp/mosaic-drag-preview.png')
   assert page.evaluate('saves.length')==count
   release();expect(e.locator('.board-drag-ghost')).to_have_count(0);expect(e.locator('dialog')).not_to_be_visible()
   assert page.evaluate('saves.length')==count+1,(width,page.evaluate('saves.length'),count)
   reordered=parse(page.evaluate('notes.a.content.text'))
   assert reordered['settings']['mosaicCardOrder'][0]!=new_id,reordered['settings']['mosaicCardOrder']
   assert [m['id'] for m in reordered['messages']]==original_ids
   assert [m['text'] for m in reordered['messages']]==original_texts
   assert reordered['messages']==saved['messages']
   # Escape cancels a preview and never saves it.
   source=e.locator('[data-id="'+data['messages'][10]['id']+'"]');count=page.evaluate('saves.length');before=page.evaluate('notes.a.content.text')
   begin(source);move_to(e.locator('[data-id="'+new_id+'"]'));page.keyboard.press('Escape');release()
   expect(e.locator('.board-drag-ghost')).to_have_count(0);assert page.evaluate('notes.a.content.text')==before and page.evaluate('saves.length')==count
   # A failed drop retains its arrangement for Retry, without clearing a draft.
   field.fill('Preserve my unsent draft');expect(field).to_have_value('Preserve my unsent draft');page.wait_for_timeout(60)
   page.evaluate('rejectSaves=true');count=page.evaluate('saves.length')
   begin(e.locator('[data-id="'+new_id+'"]'));move_to(e.locator('[data-id="'+data['messages'][11]['id']+'"]'));release()
   expect(e.locator('#notice')).to_contain_text('Saving was not confirmed');expect(field).to_have_value('Preserve my unsent draft')
   assert page.evaluate('saves.length')==count
   page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click();expect(e.locator('#notice')).to_be_hidden()
   final=parse(page.evaluate('notes.a.content.text'));assert final['draft']=='Preserve my unsent draft'
   # An IM edit preserves the arrangement while retaining chronological message order.
   order=final['settings']['mosaicCardOrder'];page.evaluate('openEditor("a","/next/index.html",true)')
   im=page.frame_locator('#editor').get_by_role('textbox',name='Message',exact=True);im.fill('Draft written in IM');page.wait_for_function('notes.a.content.text.includes("Draft written in IM")')
   roundtrip=parse(page.evaluate('notes.a.content.text'));assert roundtrip['settings']['mosaicCardOrder']==order and [m['id'] for m in roundtrip['messages']]==original_ids
   page.evaluate('openEditor("a","/mosaic/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('#capture-input')).to_have_value('Draft written in IM')
   open_more(e);e.get_by_role('menuitem',name='Reset card order',exact=True).click();assert 'mosaicCardOrder' not in parse(page.evaluate('notes.a.content.text'))['settings']
   # Keyboard ordering also uses the same saved view order.
   first=e.locator('[data-id="'+new_id+'"]');first.focus();first.press('Alt+ArrowDown')
   assert parse(page.evaluate('notes.a.content.text'))['settings']['mosaicCardOrder'][0]!=new_id
   count=page.evaluate('saves.length');first.dispatch_event('keydown',{'key':'ArrowDown','altKey':True,'repeat':True});assert page.evaluate('saves.length')==count
   page.wait_for_timeout(300)
   # Fast swipes remain scrolling; a stationary hold still opens on release.
   if width<600:
    e.locator('#viewport').evaluate('n=>n.scrollTop=0');count=page.evaluate('saves.length')
    source=e.locator('[data-id="'+new_id+'"]');box=source.bounding_box();x=box['x']+30;y=box['y']+20
    touch('touchStart',x,y);touch('touchMove',x,y-90);touch('touchEnd');page.wait_for_timeout(100)
    expect(e.locator('.board-drag-ghost')).to_have_count(0);assert page.evaluate('saves.length')==count
    e.locator('#viewport').evaluate('n=>n.scrollTop=0');box=source.bounding_box();x=box['x']+30;y=box['y']+20
    touch('touchStart',x,y);page.wait_for_timeout(560);expect(e.locator('#menu')).to_be_hidden();touch('touchEnd');expect(e.locator('#menu')).to_be_visible();page.keyboard.press('Escape')
   # Incoming host content cancels an active preview; it is never overwritten.
   count=page.evaluate('saves.length');begin(e.locator('[data-id="'+new_id+'"]'))
   page.evaluate('()=>{notes.a.content.text=notes.a.content.text.replace("Thought 2","Incoming changed thought 2");stream(notes.a)}')
   expect(e.locator('.board-drag-ghost')).to_have_count(0);release()
   assert page.evaluate('saves.length')==count and 'Incoming changed thought 2' in page.evaluate('notes.a.content.text')
   # Switching notes also releases the gesture without saving a preview.
   begin(e.locator('[data-id="'+new_id+'"]'));count=page.evaluate('saves.length');page.evaluate('switchNote("b")');expect(e.locator('.board-drag-ghost')).to_have_count(0);release();assert page.evaluate('saves.length')==count
   # A sparse board accepts a drop into its otherwise empty bottom area.
   for text in ['First short card','Second short card']:
    e.locator('#capture-input').fill(text);e.locator('#capture-input').press('Enter');expect(e.locator('#capture-input')).to_have_value('')
   page.wait_for_timeout(300);small=parse(page.evaluate('notes.b.content.text'));small_id=small['messages'][-1]['id'];count=page.evaluate('saves.length')
   begin(e.locator('[data-id="'+small_id+'"]'))
   if width<600:touch('touchMove',60,650)
   else:page.mouse.move(60,650,steps=6)
   page.wait_for_timeout(80);release();expect(e.locator('.board-drag-ghost')).to_have_count(0)
   assert page.evaluate('saves.length')==count+1
   assert parse(page.evaluate('notes.b.content.text'))['settings']['mosaicCardOrder'][-1]==small_id
   assert not errors,errors;assert not external,external
   print(f'PASS {width}px reduced={reduced}: entrance/neighbor motion, actual drag/drop, one save, Escape, failure/retry, draft retention, IM roundtrip, reset/keyboard order, scrolling/hold menus, incoming-content and note-switch cancellation',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
