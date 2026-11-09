"""Six scrollable cards: bounded startup, full-text editing and cancelled preparation."""
import functools,http.server,threading,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](6);data['settings']['pinnedMessageIds']=[]
for i,m in enumerate(data['messages']):
 m['text']=f'Card {i}\n'+'\n'.join(f'Line {j}: A long thought worth keeping 🙂 and returning to later in this note.' for j in range(600));m.pop('replyTo',None)
 if i%2:m['title']='Optional title'
 else:m.pop('title',None)
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
baseData=json.dumps(data)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for name,width,reduced in [('Mac',1100,False),('iPhone',390,False),('Mac',1100,True),('Mac short lines',1100,False),('Mac medium bodies',1100,False)]:
   data=json.loads(baseData)
   if name in ['Mac short lines','Mac medium bodies']:
    for i,m in enumerate(data['messages']):m['text']=f'Card {i}\n'+('Line\n'*600 if name=='Mac short lines' else 'A paragraph long enough to require native wrapping and preparation before editing.\n'*80)
    data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
   ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if name=='iPhone' else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Safari/605.1.15'
   context=browser.new_context(viewport={'width':width,'height':900},user_agent=ua,reduced_motion='reduce' if reduced else 'no-preference');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible();before=page.evaluate('notes.a.content.text');count=page.evaluate('saves.length')
   e.locator('#board').evaluate('''()=>{window.starts=[];const open=editorDialog;editorDialog=(...args)=>{const t=performance.now();const value=open(...args),d=modalState;starts.push({ready:d.bodyReady,n:d.body.value.length,full:d.currentText.length,w:modal.offsetWidth,h:modal.offsetHeight,ms:performance.now()-t});return value}}''')
   for m in data['messages']:
    card=e.locator('[data-id="'+m['id']+'"]');card.scroll_into_view_if_needed();card.click();body=e.locator('.editor-body');expect(body).to_be_editable();expect(body).to_have_value(m['text']);dialog=e.locator('dialog');dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
    start=e.locator('#board').evaluate('()=>starts.at(-1)');assert start['ready']==reduced
    if not reduced:assert start['n']<=4096 and start['n']<start['full']
    assert dialog.evaluate('(n,s)=>n.offsetWidth===s.w&&n.offsetHeight===s.h',start),'Native preparation must not change the visible destination box'
    assert e.locator('.card-detail-scroll').evaluate('n=>n.scrollHeight>n.clientHeight+1000')
    expect(body).not_to_be_focused()
    e.get_by_role('button',name='Close',exact=True).click();expect(dialog).not_to_be_visible()
   assert page.evaluate('notes.a.content.text')==before and page.evaluate('saves.length')==count
   if not reduced:
    # Escape must close an unchanged peek without materializing the full body.
    e.locator('[data-id="'+data['messages'][0]['id']+'"]').scroll_into_view_if_needed();e.locator('#board').evaluate('(n,id)=>{editorDialog(id);modalState.cardAnimation?.pause();if(modalState.cardAnimation){modalState.cardAnimation.currentTime=160;modalState.cardAnimation.play();}cancelAnimationFrame(modalState.bodyFrame);window.earlyEscape=modalState}',data['messages'][0]['id']);e.locator('.editor-body').press('Escape');expect(e.locator('dialog')).not_to_be_visible();assert e.locator('#board').evaluate('()=>!earlyEscape.bodyReady')
    # Force early keyboard interaction before automatic preparation can run.
    original=data['messages'][0]['text'];e.locator('[data-id="'+data['messages'][0]['id']+'"]').scroll_into_view_if_needed();e.locator('#board').evaluate('(n,id)=>{editorDialog(id);modalState.cardAnimation?.pause();cancelAnimationFrame(modalState.bodyFrame);modalState.body.focus();modalState.body.setSelectionRange(0,0)}',data['messages'][0]['id']);body=e.locator('.editor-body');body.press('x');expect(body).to_have_value('x'+original);body.press('Control+End');body.press('y');expect(body).to_have_value('x'+original+'y');e.locator('#board').evaluate('()=>clearCardMotion(modalState)');page.evaluate('rejectSaves=true');e.get_by_role('button',name='Close',exact=True).click();expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_visible();expect(body).to_have_value('x'+original+'y');page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(e.locator('dialog')).not_to_be_visible();parsed=scope['parse'](page.evaluate('notes.a.content.text'));assert parsed['messages'][0]['text']=='x'+original+'y'
    # Explicit title editing also prepares the entire body before shared input handlers.
    e.locator('[data-id="'+data['messages'][1]['id']+'"]').scroll_into_view_if_needed();e.locator('#board').evaluate('(n,id)=>{editorDialog(id);modalState.cardAnimation?.pause();modalState.unlockTitle()}',data['messages'][1]['id']);title=e.get_by_role('textbox',name='Card title',exact=True);title.fill('Changed title');e.locator('#board').evaluate('()=>clearCardMotion(modalState)');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();parsed=scope['parse'](page.evaluate('notes.a.content.text'));assert parsed['messages'][1]['text']==data['messages'][1]['text'] and parsed['messages'][1]['title']=='Changed title'
    e.locator('[data-id="'+data['messages'][2]['id']+'"]').scroll_into_view_if_needed();e.locator('#board').evaluate('(n,id)=>{editorDialog(id);modalState.cardAnimation?.pause();cancelAnimationFrame(modalState.bodyFrame)}',data['messages'][2]['id']);e.locator('.editor-body').dispatch_event('paste');expect(e.locator('.editor-body')).to_be_editable();expect(e.locator('.editor-body')).to_have_value(data['messages'][2]['text']);e.locator('#board').evaluate('()=>clearCardMotion(modalState)');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
    count=page.evaluate('saves.length');e.locator('[data-id="'+data['messages'][2]['id']+'"]').scroll_into_view_if_needed();e.locator('#board').evaluate('(n,id)=>{editorDialog(id);modalState.cardAnimation?.pause();cancelAnimationFrame(modalState.bodyFrame);window.pendingBody=modalState}',data['messages'][2]['id']);page.evaluate('stream({...notes.a,uuid:"other-long-note"})');expect(e.locator('dialog')).not_to_be_visible();e.locator('#board').evaluate('async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}');assert page.evaluate('saves.length')==count;assert e.locator('#board').evaluate('()=>!pendingBody.bodyReady')
   assert not errors,errors
   print(json.dumps({'PASS':name,'reduced':reduced,'startup_ms':e.locator('#board').evaluate('()=>starts.slice(0,6).map(s=>s.ms)'),'checks':'six long cards; bounded first page; fixed outer geometry; full-text keyboard/title saves; pending note-switch cancellation; no opening writes'}),flush=True);context.close()
  browser.close()
finally:server.shutdown()
