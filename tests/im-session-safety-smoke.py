"""Synthetic failures/foreign versions exercise the actual shipped IM integration."""
import functools,http.server,json,re,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
fixture,parse=scope['fixture'],scope['parse'];data=fixture(20)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();BASE='http://127.0.0.1:'+str(server.server_port)
html=(ROOT/'next/index.html').read_text();asset=re.search(r'src="\./([^"?]+\.js)',html)[1]
script=(ROOT/'next'/asset).read_text()+'''\nwindow.__testBridge=pf;window.__testFormat=imFormat;window.__testRemember=imRememberSelection;window.__testTimer=imStartSilentTimer;'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1100]:
   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
   context.add_init_script('window.__storageWrites=[];const oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){__storageWrites.push(k);return oldSet.call(this,k,v)};const oldOpen=indexedDB.open.bind(indexedDB);indexedDB.open=(...args)=>{__storageWrites.push("db:"+args[0]);return oldOpen(...args)}')
   page=context.new_page();errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE+'/') else None)
   page.route(BASE+'/next/'+asset,lambda route:route.fulfill(body=script,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'}))
   page.goto(BASE+'/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a","/next/index.html",'+str(width<600).lower()+')}',data['note'])
   e=page.frame_locator('#editor');expect(e.get_by_role('textbox',name='Message',exact=True)).to_be_visible();page.wait_for_timeout(100)
   target=data['messages'][0]['id'];row=e.locator('[data-message-id="'+target+'"]')
   def edit():
    e.locator('.messages').evaluate('n=>n.scrollTop=0');row.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click();field=e.get_by_role('textbox',name='Edit message',exact=True);expect(field).to_be_focused();value=field.evaluate('n=>n.value');expect(field).to_have_js_property('selectionStart',len(value));expect(field).to_have_js_property('selectionEnd',len(value));return field
   field=edit()
   text='One line for click editing'
   for offset in [0,4,len(text)]:
    fill_field(field,text)
    point=field.evaluate('(n,offset)=>{const r=document.createRange();r.setStart(n.querySelector("p").firstChild,offset);r.collapse(true);const c=r.getBoundingClientRect(),b=n.getBoundingClientRect();return {x:c.left-b.left+.2,y:c.top-b.top+c.height/2}}',offset)
    field.click(position=point);expect(field).to_be_focused();expect(field).to_have_js_property('selectionStart',offset);field.type('!');expect(field).to_have_js_property('value',text[:offset]+'!'+text[offset:])
   fill_field(field,'First line\nSecond line\nThird line')
   point=field.evaluate('n=>{const text=[...n.querySelector("p").childNodes].find(c=>c.nodeType===3&&c.textContent.includes("Second")),r=document.createRange();r.setStart(text,3);r.collapse(true);const c=r.getBoundingClientRect(),b=n.getBoundingClientRect();return {x:c.left-b.left+.2,y:c.top-b.top+c.height/2}}')
   field.click(position=point);field.type('!');expect(field).to_have_js_property('value','First line\nSec!ond line\nThird line')
   fill_field(field,text)
   def range_point(offset):
    point=field.evaluate('(n,offset)=>{const r=document.createRange();r.setStart(n.querySelector("p").firstChild,offset);r.collapse(true);const c=r.getBoundingClientRect(),b=n.getBoundingClientRect();return {x:c.left-b.left+.2,y:c.top-b.top+c.height/2}}',offset);bounds=field.bounding_box();return (bounds['x']+point['x'],bounds['y']+point['y'])
   page.mouse.move(*range_point(4));page.mouse.down();page.mouse.move(*range_point(8),steps=6);page.mouse.up();expect(field).to_have_js_property('selectionStart',4);expect(field).to_have_js_property('selectionEnd',8);field.type('replacement');expect(field).to_have_js_property('value',text[:4]+'replacement'+text[8:])
   page.evaluate('rejectSaves=true');fill_field(field,'Retained rejected edit');field.press('Enter')
   expect(field).to_have_js_property('value','Retained rejected edit');expect(e.get_by_role('alert')).to_contain_text('Could not save')
   assert parse(page.evaluate('notes.a.content.text'))['messages'][0]['text']==data['messages'][0]['text']
   page.evaluate('switchNote("b")');expect(e.get_by_role('textbox',name='Message',exact=True)).to_be_visible()
   page.evaluate('switchNote("a")');expect(field).to_have_js_property('value','Retained rejected edit')
   page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click();expect(field).not_to_be_visible()
   assert parse(page.evaluate('notes.a.content.text'))['messages'][0]['text']=='Retained rejected edit'
   # New typing during a successful delayed edit acknowledgment stays editable.
   field=edit();page.evaluate('holdAck=true');fill_field(field,'First acknowledged edit');field.press('Enter');page.wait_for_function('acks.length===1')
   expect(field).to_have_js_property('value','First acknowledged edit');fill_field(field,'Newer edit survives acknowledgment')
   page.evaluate('holdAck=false;releaseAcks()');expect(field).to_have_js_property('value','Newer edit survives acknowledgment')
   field.press('Enter');expect(field).not_to_be_visible();saved=parse(page.evaluate('notes.a.content.text'));assert saved['messages'][0]['text']=='Newer edit survives acknowledgment'
   assert saved['messages'][0]['custom']=={'keep':True} and len(saved['messages'])==20
   # Non-text mutations also survive rejection and note switches.
   page.evaluate('rejectSaves=true');e.locator('.messages').evaluate('n=>n.scrollTop=0');row.click(button='right');e.get_by_role('menuitem',name='Pin',exact=True).click()
   expect(e.get_by_role('alert')).to_contain_text('Could not save');page.evaluate('switchNote("b")');page.wait_for_timeout(60);page.evaluate('switchNote("a")')
   expect(e.get_by_role('alert')).to_contain_text('Could not save');page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click();expect(e.get_by_role('alert')).not_to_be_visible()
   assert target in parse(page.evaluate('notes.a.content.text'))['settings']['pinnedMessageIds']
   # A metadata-only event cannot replace text, even when it carries an old body.
   capture=e.get_by_role('textbox',name='Message',exact=True);fill_field(capture,'Before conflict')
   page.wait_for_function('notes.a.content.text.includes("Before conflict")')
   page.evaluate('(old)=>stream({...notes.a,isMetadataUpdate:true,updated_at:"2099-01-01T00:00:00Z",content:{...notes.a.content,text:old}})',data['note']['content']['text'])
   expect(capture).to_have_js_property('value','Before conflict')
   # Pause an actual waiting write for a genuinely different host version.
   page.evaluate('holdAck=true;saves=[]');fill_field(capture,'Local first draft');page.wait_for_function('acks.length===1');fill_field(capture,'Local waiting draft')
   def foreign(marker):
    return e.locator('body').evaluate('(n,[text,marker])=>{const f=__testFormat,d=f.inspect(text);return f.portable([...d.messages,{id:f.newId(),text:marker,reactions:[]}],d.settings,"Remote draft")}',[page.evaluate('notes.a.content.text'),marker])
   remote=foreign('Genuine incoming message');page.evaluate('(text)=>{notes.a={...notes.a,content:{...notes.a.content,text,title:"New native title"}};stream(notes.a)}',remote)
   expect(e.get_by_role('alert')).to_contain_text('different version');e.get_by_role('button',name='Review text',exact=True).click()
   dialog=e.get_by_role('dialog',name='Review note versions',exact=True)
   expect(dialog.get_by_role('textbox',name='Current local note text',exact=True)).to_contain_text('Local waiting draft')
   expect(dialog.get_by_role('textbox',name='Standard Notes version',exact=True)).to_contain_text('Genuine incoming message')
   expect(dialog.get_by_role('button',name='Use Standard Notes version',exact=True)).to_be_disabled()
   page.evaluate('holdAck=false;releaseAcks()');expect(dialog.get_by_role('button',name='Use Standard Notes version',exact=True)).to_be_enabled()
   assert page.evaluate('saves.length')==1 and 'Genuine incoming message' in page.evaluate('notes.a.content.text')
   # Cancel/close never chooses either version or re-enables writing.
   dialog.get_by_role('button',name='Close',exact=True).click();fill_field(capture,'New local draft while paused');capture.press('Enter');assert page.evaluate('saves.length')==1
   e.locator('.messages').evaluate('n=>n.scrollTop=0');row.click(button='right');e.get_by_role('menuitem',name='Unpin',exact=True).click();assert page.evaluate('saves.length')==1
   e.get_by_role('button',name='Review text',exact=True).click();expect(dialog.get_by_role('textbox',name='Current local note text',exact=True)).to_contain_text('New local draft while paused')
   page.once('dialog',lambda d:d.dismiss());dialog.get_by_role('button',name='Use Standard Notes version',exact=True).click();assert 'Genuine incoming message' in page.evaluate('notes.a.content.text')
   page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Use Standard Notes version',exact=True).click();expect(capture).to_have_js_property('value','Remote draft');expect(e.get_by_role('alert')).not_to_be_visible()
   assert page.evaluate('notes.a.content.title')=='New native title'
   # Choosing local is explicit, keeps refreshed native fields, and can be retried.
   page.evaluate('holdAck=true;saves=[]');fill_field(capture,'Local chosen first');page.wait_for_function('acks.length===1');fill_field(capture,'Local chosen latest')
   remote=foreign('Second incoming message');page.evaluate('(text)=>{notes.a={...notes.a,content:{...notes.a.content,text,title:"Latest native title"}};stream(notes.a)}',remote)
   expect(e.get_by_role('alert')).to_contain_text('different version');page.evaluate('holdAck=false;releaseAcks()')
   e.get_by_role('button',name='Review text',exact=True).click();expect(dialog.get_by_role('button',name='Save my local version',exact=True)).to_be_enabled()
   page.evaluate('rejectSaves=true');page.once('dialog',lambda d:d.accept());dialog.get_by_role('button',name='Save my local version',exact=True).click()
   expect(e.get_by_role('alert')).to_contain_text('Could not save');assert 'Second incoming message' in page.evaluate('notes.a.content.text')
   page.evaluate('switchNote("b")');page.wait_for_timeout(60);page.evaluate('switchNote("a")');expect(capture).to_have_js_property('value','Local chosen latest')
   page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click();expect(e.get_by_role('alert')).not_to_be_visible()
   saved=parse(page.evaluate('notes.a.content.text'));assert saved['draft']=='Local chosen latest' and all(m['text']!='Second incoming message' for m in saved['messages'])
   assert page.evaluate('notes.a.content.title')=='Latest native title'
   # Known content with new native fields rebases the waiting snapshot.
   page.evaluate('holdAck=true');fill_field(capture,'Metadata first');page.wait_for_function('acks.length===1');fill_field(capture,'Metadata latest')
   page.evaluate('()=>{notes.a={...notes.a,content:{...notes.a.content,title:"Concurrent title"}};stream(notes.a)}')
   page.evaluate('holdAck=false;releaseAcks()');page.wait_for_function('notes.a.content.text.includes("Metadata latest")&&notes.a.content.title==="Concurrent title"')
   expect(e.get_by_role('alert')).not_to_be_visible();expect(capture).to_have_js_property('value','Metadata latest')
   # Genuine parent updates in source-less mobile JSON form still reach the receiver.
   original=page.evaluate('subscription');item=page.evaluate('notes.a')
   e.locator('body').evaluate('(n,p)=>document.dispatchEvent(new MessageEvent("message",{origin:p.origin,source:null,data:JSON.stringify({action:"reply",original:p.original,data:{item:p.item}})}))',{'origin':BASE,'original':original,'item':item})
   expect(capture).to_have_js_property('value','Metadata latest')
   page.evaluate('([original,item])=>{for(const request of [{...original,sessionKey:"wrong"},{...original,messageId:"unknown"}])editor.contentWindow.postMessage({action:"reply",original:request,data:{item:{...item,content:{...item.content,text:"Untrusted replacement"}}}},"*");editor.contentWindow.postMessage({action:"themes",data:{themes:["/untrusted.css"]}},"*")}',[original,item])
   page.wait_for_timeout(60);expect(capture).to_have_js_property('value','Metadata latest')
   assert e.locator('link[href*="untrusted.css"]').count()==0
   # Same-origin non-parent registration/themes and malformed messages are rejected.
   before=e.locator('body').evaluate('()=>({session:__testBridge.component.sessionKey,callbacks:__testBridge.sentMessages.length,links:document.querySelectorAll("link[rel=stylesheet]").length})')
   page.route(BASE+'/peer',lambda route:route.fulfill(body="<script>for(const data of [{action:'themes',data:{themes:['/untrusted.css']}},{action:'component-registered',sessionKey:'forged',data:{uuid:'forged'}}])parent.editor.contentWindow.postMessage(data,'*');parent.peerDone=true</script>",content_type='text/html'))
   page.evaluate('()=>{const peer=document.createElement("iframe");peer.src="/peer";document.body.append(peer)}');page.wait_for_function('window.peerDone===true')
   e.locator('body').evaluate('()=>{for(const data of ["{bad",null,[],42,{action:"reply",original:{messageId:"unknown"}}])dispatchEvent(new MessageEvent("message",{origin:location.origin,source:window,data}))}')
   assert e.locator('body').evaluate('()=>__testBridge.component.sessionKey')==before['session']
   assert e.locator('body').evaluate('()=>document.querySelectorAll("link[rel=stylesheet]").length')==before['links']
   # Exercise real selection/timer writers without successful preference replies.
   e.locator('body').evaluate('(n,id)=>new Promise(async resolve=>{for(let i=0;i<250;i++){__testRemember("audit-note",new Set([id]));__testTimer(5);await Promise.resolve()}resolve()})',target)
   assert e.locator('body').evaluate('()=>__testBridge.sentMessages.length')<=3
   fill_field(capture,'Still saving after bridge hardening');page.wait_for_function('notes.a.content.text.includes("Still saving after bridge hardening")')
   assert e.locator('body').evaluate('()=>__storageWrites.length')==0
   assert not errors,errors;assert not external,external
   print(f'PASS {width}px: rejected edits/pins retained across switches; acknowledged retry; newer typing; metadata/foreign-version handling and explicit review; sender/session guard; native JSON transport; bounded preference callbacks; no new browser persistence',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
