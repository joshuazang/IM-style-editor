"""Synthetic-phone selection, shared save feedback, search and safe tag changes."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
from mosaic_helpers import open_more,open_search
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse']
data=fixture(80)
for i,message in enumerate(data['messages']):
 identity=message['id'];message.clear();message.update(id=identity,text=f'Short {i}',reactions=['📓'] if i%4==0 else [])
data['settings'].pop('pinnedMessageIds',None);data['draft']=''
data['note']['content']['text']=json.loads(subprocess.run(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,d.draft)));"],cwd=ROOT,input=json.dumps(data),text=True,capture_output=True,check=True).stdout)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
contrast=r'''n=>{
 const c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=c.height=1;
 const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]};
 const over=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));
 let bg=[255,255,255];for(const node of [...function*(v){for(;v;v=v.parentElement)yield v}(n)].reverse())bg=over(rgba(getComputedStyle(node).backgroundColor),bg);
 const fg=over(rgba(getComputedStyle(n).color),bg),lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),a=lum(fg),b=lum(bg);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
   context.add_init_script('window.__storageWrites=[];const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){__storageWrites.push(k);return put.call(this,k,v)};const open=indexedDB.open.bind(indexedDB);indexedDB.open=(...a)=>{__storageWrites.push(a[0]);return open(...a)}')
   page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE+'/') else None)
   page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;notes.b={...structuredClone(note),uuid:"b"};openEditor("a","/next/index.html",'+str(width<600).lower()+')}',data['note'])
   im=page.frame_locator('#editor');capture=im.get_by_role('textbox',name='Message',exact=True);expect(capture).to_be_visible()
   ids=[m['id'] for m in data['messages']]
   im.locator('.messages').evaluate('(n,id)=>new Promise(resolve=>{n.imScroll?.cancel();n.imVirtual.reveal(id,resolve)})',ids[5]);first=im.locator('[data-message-id="'+ids[1]+'"]');first.click(button='right');im.get_by_role('menuitem',name='Select',exact=True).click()
   expected={ids[1]}
   def selected():return set(im.locator('.message-wrap.selected').evaluate_all('ns=>ns.map(n=>n.dataset.messageId)'))
   assert selected()==expected
   rows=im.locator('.selection-touch-row');geometry=rows.evaluate_all('ns=>ns.slice(0,10).map(n=>{const a=n.getBoundingClientRect(),b=n.querySelector(".selection-check").getBoundingClientRect();return {top:a.top,bottom:a.bottom,height:a.height,checkTop:b.top,checkBottom:b.bottom,checkHeight:b.height}})')
   assert all(v['height']>=44 and v['checkHeight']>=44 and v['checkTop']>=v['top']-.1 and v['checkBottom']<=v['bottom']+.1 for v in geometry),geometry
   assert all(a['checkBottom']<=b['checkTop'] for a,b in zip(geometry,geometry[1:])),geometry
   before=im.locator('[data-selection-row="'+ids[7]+'"]').bounding_box()['y']
   cdp=context.new_cdp_session(page)
   def touch(kind,x,y):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind in ['touchEnd','touchCancel'] else [{'x':x,'y':y}]})
   for i in [2,3,4,5,6,3,2]:
    target=ids[i];part=im.locator('[data-selection-row="'+target+'"] .message-body' if i%2 else '[data-selection-row="'+target+'"] .selection-check');rect=part.bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2
    if width<600:touch('touchStart',x,y);touch('touchEnd',x,y)
    else:part.click()
    if target in expected:expected.remove(target)
    else:expected.add(target)
    assert selected()==expected,(i,selected(),expected)
   assert abs(im.locator('[data-selection-row="'+ids[7]+'"]').bounding_box()['y']-before)<1
   # Some WebViews emit an additional legacy click with detail=0 after touch.
   # It must not retarget selection to a neighboring row or toggle twice.
   if width<600:
    neighbor=im.locator('[data-selection-row="'+ids[7]+'"] .message-body')
    neighbor.dispatch_event('click',{'bubbles':True,'cancelable':True,'detail':0})
    assert selected()==expected,('legacy touch click selected a neighboring message',selected(),expected)
   if width<600:
    # A browser-adjusted target must still select the row under the finger,
    # not the neighboring checkbox to which the browser delivered the click.
    intended=im.locator('[data-selection-row="'+ids[8]+'"] .message-body');r=intended.bounding_box()
    point={'pointerType':'touch','isPrimary':True,'pointerId':912,'clientX':r['x']+r['width']/2,'clientY':r['y']+r['height']/2,'bubbles':True}
    neighbor=im.locator('[data-selection-row="'+ids[7]+'"] .message-body')
    neighbor.dispatch_event('pointerdown',point);neighbor.dispatch_event('pointerup',point)
    assert selected()==expected,'Release alone must not race the compatibility click'
    neighbor.dispatch_event('click',{'bubbles':True,'cancelable':True,'detail':1})
    expected.add(ids[8]);assert selected()==expected
    neighbor.dispatch_event('click',{'bubbles':True,'cancelable':True,'detail':0});assert selected()==expected
   # Keyboard activation remains precise; cancelled and scrolling touch gestures do nothing.
   control=im.locator('[data-selection-row="'+ids[6]+'"] .selection-check');control.focus();control.press('Space');expected.remove(ids[6]);assert selected()==expected
   control.press('Enter');expected.add(ids[6]);assert selected()==expected
   if width<600:
    rect=im.locator('[data-selection-row="'+ids[6]+'"] .message-body').bounding_box();x=rect['x']+10;y=rect['y']+10
    touch('touchStart',x,y);touch('touchCancel',x,y);assert selected()==expected
    touch('touchStart',x,y);touch('touchMove',x,y-40);touch('touchEnd',x,y-40);page.wait_for_timeout(120);assert selected()==expected
    # Cancelled drags cannot be revived by either kind of legacy click.
    neighbor=im.locator('[data-selection-row="'+ids[7]+'"] .message-body')
    for detail in [0,1]:neighbor.dispatch_event('click',{'bubbles':True,'cancelable':True,'detail':detail});assert selected()==expected
   if width<600:
    # The two notes intentionally share message IDs. A pending touch from A
    # must not select a message after B has become the active note.
    page.evaluate('switchNote("b")');expect(im.locator('.selected')).to_have_count(0)
    im.locator('.messages').evaluate('(n,id)=>new Promise(resolve=>{n.imScroll?.cancel();n.imVirtual.reveal(id,resolve)})',ids[5]);im.locator('[data-message-id="'+ids[1]+'"]').click(button='right');im.get_by_role('menuitem',name='Select',exact=True).click();expect(im.locator('.message-wrap.selected')).to_have_count(1)
    page.evaluate('switchNote("a")');expect(im.locator('.selection-status')).to_contain_text(str(len(expected))+' / 80 selected');im.locator('.messages').evaluate('(n,id)=>new Promise(resolve=>{n.imScroll?.cancel();n.imVirtual.reveal(id,resolve)})',ids[5]);expect(im.locator('.message-wrap.selected')).to_have_count(len(expected))
    pending=im.locator('[data-selection-row="'+ids[7]+'"] .message-body');r=pending.bounding_box();point={'pointerType':'touch','isPrimary':True,'pointerId':913,'clientX':r['x']+r['width']/2,'clientY':r['y']+r['height']/2,'bubbles':True}
    pending.dispatch_event('pointerdown',point);pending.dispatch_event('pointerup',point)
    page.evaluate('switchNote("b")');expect(im.locator('.selection-status')).to_contain_text('1 / 80 selected');im.locator('.messages').evaluate('(n,id)=>new Promise(resolve=>{n.imScroll?.cancel();n.imVirtual.reveal(id,resolve)})',ids[5]);expect(im.locator('.message-wrap.selected')).to_have_count(1)
    im.locator('[data-selection-row="'+ids[7]+'"] .message-body').dispatch_event('click',{'bubbles':True,'cancelable':True,'detail':0})
    assert selected()=={ids[1]},'Pending touches must not cross note switches'
    im.get_by_role('button',name='Cancel',exact=True).click();expect(im.locator('.selection-status')).to_have_count(0)
    page.evaluate('switchNote("a")');expect(im.locator('.selection-status')).to_contain_text(str(len(expected))+' / 80 selected');im.locator('.messages').evaluate('(n,id)=>new Promise(resolve=>{n.imScroll?.cancel();n.imVirtual.reveal(id,resolve)})',ids[5]);expect(im.locator('.message-wrap.selected')).to_have_count(len(expected));assert selected()==expected
   im.get_by_role('button',name='Cancel',exact=True).click();expect(capture).to_be_visible()
   print(f'PASS {width}px: separate 44px IM row targets, exact rapid bubble/checkbox taps, stable geometry, keyboard selection and cancelled-scroll gestures',flush=True)

   # Real scrolling never gives Mosaic a sticky hover or opens a card.
   page.evaluate('openEditor("a","/mosaic/index.html",true)');mosaic=page.frame_locator('#editor');expect(mosaic.locator('.card').first).to_be_visible()
   target=mosaic.locator('.card').first;target.scroll_into_view_if_needed();r=target.bounding_box();x=r['x']+r['width']/2;y=max(r['y']+20,100)
   if width<600:
    touch('touchStart',x,y);page.wait_for_timeout(80)
    assert target.evaluate('n=>getComputedStyle(n).boxShadow')=='none'
    touch('touchMove',x,y-65);touch('touchEnd',x,y-65);page.wait_for_timeout(180)
    assert mosaic.locator('.card').evaluate_all('ns=>ns.every(n=>getComputedStyle(n).boxShadow==="none")')
   else:
    page.wait_for_timeout(150);page.mouse.move(x,y);page.wait_for_timeout(200);assert target.evaluate('n=>getComputedStyle(n).boxShadow')!='none'
    page.mouse.wheel(0,240);page.wait_for_timeout(220)
    assert mosaic.locator('.card').evaluate_all('ns=>ns.every(n=>getComputedStyle(n).boxShadow==="none")')
    page.mouse.move(x+8,y);page.wait_for_timeout(200)
    assert mosaic.locator('.card').evaluate_all('ns=>ns.some(n=>n.matches(":hover")&&getComputedStyle(n).boxShadow!=="none")')
   expect(mosaic.locator('#modal')).not_to_be_visible()
   print(f'PASS {width}px: Mosaic touch/scroll has no sticky card hover; deliberate mouse movement restores desktop feedback',flush=True)

   # Both interfaces submit immediately; only the feedback waits 300ms.
   for path in ['/next/index.html','/mosaic/index.html']:
    page.evaluate('(path)=>{holdAck=false;rejectSaves=false;openEditor("a",path,true)}',path)
    e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message' if path.startswith('/next') else 'Take a note',exact=True);expect(field).to_be_visible()
    status=e.locator('.ui-save-feedback');page.evaluate('holdAck=true');fill_field(field,'Slow draft '+path)
    page.wait_for_function('acks.length===1');expect(status).not_to_be_visible();page.wait_for_timeout(350);expect(status).to_have_text('Saving…')
    page.evaluate('holdAck=false;releaseAcks()');expect(status).to_have_text('Saved');expect(status).not_to_be_visible(timeout=2000)
    fill_field(field,'Fast draft '+path);page.wait_for_function('(path)=>notes.a.content.text.includes("Fast draft "+path)',arg=path);page.wait_for_timeout(350);expect(status).not_to_be_visible()
    count=page.evaluate('saves.length');page.wait_for_timeout(500);assert page.evaluate('saves.length')==count
    page.evaluate('rejectSaves=true');fill_field(field,'Retain rejected draft '+path);page.wait_for_timeout(400);expect(status).not_to_be_visible();expect(field).to_have_js_property('value','Retain rejected draft '+path)
    retry=e.get_by_role('button',name='Retry save',exact=True).last;expect(retry).to_be_visible();page.evaluate('rejectSaves=false');retry.click();page.wait_for_function('(path)=>notes.a.content.text.includes("Retain rejected draft "+path)',arg=path)
    page.evaluate('holdAck=true');fill_field(field,'Pending across note switch '+path);page.wait_for_function('acks.length===1');page.evaluate('switchNote("b")');expect(field).to_have_js_property('value','');page.wait_for_timeout(350)
    expect(status).not_to_be_visible()
    page.evaluate('holdAck=false;releaseAcks();switchNote("a")');expect(field).to_have_js_property('value','Pending across note switch '+path)
    assert e.locator('body').evaluate('()=>__storageWrites.length')==0
   print(f'PASS {width}px: both editors save immediately, quiet fast/idle states, delayed saving label, acknowledged success, retained failed draft/retry and isolated note switches',flush=True)

   e=page.frame_locator('#editor');fill_field(e.locator('#capture-input'),'');page.wait_for_timeout(80)
   # Cmd/Ctrl+F uses whole-note search, while an open card keeps its normal editing keys.
   e.locator('.card').first.focus();page.keyboard.press('Control+f');search=e.locator('#search');expect(search).to_be_focused();fill_field(search,'Short 0');page.keyboard.press('Escape')
   e.locator('.card').first.focus();page.keyboard.press('Meta+f');expect(search).to_be_focused();assert search.evaluate('n=>n.selectionStart===0&&n.selectionEnd===n.value.length')
   fill_field(search,'');search.press('Escape');e.locator('.card').first.click();title=e.get_by_role('textbox',name='Card body',exact=True);title.focus();page.keyboard.press('Control+f');expect(title).to_be_focused();e.get_by_role('button',name='Close',exact=True).click()
   open_more(e);e.get_by_role('menuitem',name='Arrange tags',exact=True).click();dialog=e.get_by_role('dialog',name='Arrange tags',exact=True)
   assert dialog.locator('.tag-arrange-row').last.inner_text()=='Untagged'
   add=dialog.get_by_role('textbox',name='Add an emoji category',exact=True);before=page.evaluate('saves.length');fill_field(add,'__untagged__');add.press('Enter');expect(dialog.locator('.dialog-error')).to_contain_text('Choose an emoji');assert page.evaluate('saves.length')==before
   fill_field(add,'⭐');add.press('Enter');expect(dialog.get_by_role('button',name='Edit ⭐',exact=True)).to_be_visible()
   dialog.get_by_role('button',name='Move Untagged earlier',exact=True).click();expect(dialog.get_by_role('button',name='Move Untagged earlier',exact=True)).to_be_enabled()
   dialog.get_by_role('button',name='Edit 📓',exact=True).click();replacement=e.get_by_role('textbox',name='Replacement emoji',exact=True);fill_field(replacement,'⭐');replacement.press('Enter');expect(dialog).to_be_visible();assert dialog.get_by_role('button',name='Edit 📓',exact=True).count()==0
   merged=parse(page.evaluate('notes.a.content.text'));assert sum('⭐' in m['reactions'] for m in merged['messages'])==20
   assert len(merged['messages'])==80 and [m['text'] for m in merged['messages']]==[m['text'] for m in data['messages']]
   assert merged['settings']['extra']=={'keep':True} and merged['settings']['untaggedPosition']==7
   page.once('dialog',lambda d:d.dismiss());dialog.get_by_role('button',name='Delete ⭐',exact=True).click();assert '⭐' in parse(page.evaluate('notes.a.content.text'))['settings']['reactionOrder']
   page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Delete ⭐',exact=True).click();expect(dialog.get_by_role('button',name='Edit ⭐',exact=True)).not_to_be_visible()
   removed=parse(page.evaluate('notes.a.content.text'));assert all(not m['reactions'] for m in removed['messages']) and len(removed['messages'])==80
   # A failed tag change stays retryable through the same note session.
   page.evaluate('rejectSaves=true');fill_field(add,'🔬');add.press('Enter');expect(dialog.locator('.dialog-error')).to_contain_text('retained');dialog.get_by_role('button',name='Done',exact=True).click()
   page.evaluate('switchNote("b")');page.wait_for_timeout(70);page.evaluate('switchNote("a")');page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();page.wait_for_function('notes.a.content.text.includes("🔬")')
   # Menu grid and keyboard focus stay accessible; filter still has no counts.
   open_search(e);tag=e.get_by_role('button',name='Filter by 🔬',exact=True);tag.focus();assert tag.evaluate('n=>n.getBoundingClientRect().height')>=44;tag.press('Enter');expect(e.locator('#filter-pill')).to_be_visible();assert not any(c.isdigit() for c in e.locator('#filter-pill').inner_text())
   e.get_by_role('button',name='Clear all filters',exact=True).click()
   if width==390:
    for scheme in ['light','dark']:
     page.emulate_media(color_scheme=scheme)
     for palette in ['Sage','Paper','Sand']:
      open_more(e);e.get_by_role('menuitem',name='Color palette',exact=True).click();choice=e.get_by_role('dialog').get_by_role('button',name=palette,exact=True);choice.click();expect(choice).to_be_enabled()
      for node in e.locator('dialog .appearance-choice-label,dialog .appearance-choice-label small').all():assert node.evaluate(contrast)>=4.5,(scheme,palette,'palette text',node.evaluate(contrast))
      e.get_by_role('button',name='Done',exact=True).click();open_more(e);e.get_by_role('menuitem',name='Arrange tags',exact=True).click()
      for node in e.locator('dialog h2,dialog .tag-arrange-untagged .tag-arrange-symbol,dialog .secondary-button').all():assert node.evaluate(contrast)>=4.5,(scheme,palette,node.inner_text(),node.evaluate(contrast))
      field=e.get_by_role('textbox',name='Add an emoji category',exact=True);field.focus();assert field.evaluate('n=>getComputedStyle(n).outlineStyle')=='solid'
      e.get_by_role('button',name='Done',exact=True).click();open_search(e);untagged=e.get_by_role('button',name='Untagged cards',exact=True);assert untagged.evaluate(contrast)>=4.5,(scheme,palette,'untagged filter',untagged.evaluate(contrast));e.locator('#search').press('Escape')
      card=e.locator('.card').first;card.click(button='right');copy=e.get_by_role('menuitem',name='Copy',exact=True);copy.press('ArrowDown');copy.focus();assert copy.evaluate(contrast)>=4.5;assert copy.evaluate('n=>getComputedStyle(n).outlineStyle')=='solid'
      assert e.get_by_role('menuitem',name='Delete',exact=True).evaluate(contrast)>=4.5
      e.get_by_role('menuitem',name='Select',exact=True).click();assert e.locator('.selection-description').evaluate(contrast)>=4.5,(scheme,palette,'selection text',e.locator('.selection-description').evaluate(contrast))
      for node in e.locator('.ui-selection-action').all():assert node.evaluate(contrast)>=3,(scheme,palette,'selection icon',node.evaluate(contrast))
      e.get_by_role('button',name='Cancel selection',exact=True).click()
    page.emulate_media(color_scheme='light');print('PASS all three palettes/light/dark: menu, dialog, filter and selection contrast; visible keyboard focus and input focus',flush=True)
   page.evaluate('openEditor("a","/next/index.html",true)');im=page.frame_locator('#editor');expect(im.get_by_role('textbox',name='Message',exact=True)).to_be_visible();im.get_by_role('button',name='Search and tags',exact=True).click();expect(im.locator('.search-tags-panel .chip').filter(has_text='🔬').first).to_be_visible()
   im.get_by_role('button',name='More options',exact=True).click();im.get_by_role('button',name='Arrange tags',exact=True).click();before=page.evaluate('saves.length');fill_field(im.get_by_role('textbox',name='Add an emoji category',exact=True),'__untagged__');im.get_by_role('textbox',name='Add an emoji category',exact=True).press('Enter');expect(im.locator('.transfer-notice')).to_contain_text('Choose an emoji');assert page.evaluate('saves.length')==before
   final=parse(page.evaluate('notes.a.content.text'));assert final['messages']==removed['messages'];assert final['settings']['extra']=={'keep':True}
   assert not errors,errors;assert not outside,outside
   print(f'PASS {width}px: focused full-note search, modal editing keys, shared tag merge/delete confirmations/reorder/Untagged, failure recovery and IM interchange; no storage writes/external requests',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
