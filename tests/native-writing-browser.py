"""Native writing hints and accepted word replacements in both actual editors.

Headless browsers cannot display an iPhone keyboard or macOS prediction UI.
Verify the editor opts in and accepts native edits without losing formatting,
undo, saved contents, or composition. OS suggestions still depend on the host.
"""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](2);data['messages'][0].update(text='Original body',title='Existing title');data['draft']=''
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
def writing(field):
 expect(field).to_be_editable()
 assert field.evaluate('n=>n.spellcheck') is True
 for key,value in [('autocomplete','on'),('autocorrect','on'),('autocapitalize','sentences'),('writingsuggestions','true')]:expect(field).to_have_attribute(key,value)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for name,agent,mobile in [
   ('Mac','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130 Safari/537.36',False),
   ('iPhone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',True),
   ('Android','Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',True)]:
   for app in ['next','mosaic']:
    im=app=='next';context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':900},is_mobile=mobile,has_touch=mobile,user_agent=agent)
    context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>'',writeText:async()=>{}}})")
    page=context.new_page();errors=[];outside=[];page.on('pageerror',lambda error:errors.append(str(error)));page.on('request',lambda r:outside.append(r.url) if not r.url.startswith(base+'/') else None)
    page.goto(base+'/tests/mosaic-host.html');page.evaluate('([note,path,mobile])=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}};openEditor("a",path,mobile)}',[data['note'],'/'+app+'/index.html',mobile]);e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True);writing(field)
    cdp=context.new_cdp_session(page)
    def replace_word(field):
     fill_field(field,'**helo** world');writing(field)
     field.evaluate('n=>{n.focus();n.setSelectionRange(0,4)}')
     cdp.send('Input.insertText',{'text':'Hello'});expect(field.locator('strong')).to_have_text('Hello');expect(field).to_have_js_property('value','**Hello** world')
     field.press('Control+z');field.press('Control+Shift+z');expect(field).to_have_js_property('value','**Hello** world');writing(field)
    replace_word(field);e.get_by_role('button',name='Send message' if im else 'Send',exact=True).click();expect(field).to_have_js_property('value','');assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][-1]['text']=='**Hello** world'
    target=data['messages'][0]['id'];row=e.locator(f'[data-message-id="{target}"]' if im else f'.card[data-id="{target}"]')
    if im:row.click(button='right');e.get_by_role('menuitem',name='Edit',exact=True).click()
    else:row.click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
    edit=e.get_by_role('textbox',name='Edit message' if im else 'Card body',exact=True);replace_word(edit)
    if im:edit.press('Control+End');edit.press('Enter');expect(field).to_be_visible()
    else:e.get_by_role('button',name='Close',exact=True).last.click();expect(e.locator('dialog')).not_to_be_visible()
    assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text']=='**Hello** world'
    row.click(button='right');e.get_by_role('menuitem',name='Edit title',exact=True).click();title=e.get_by_role('textbox',name='Title',exact=True);writing(title);fill_field(title,'Native title');title.press('Enter');expect(field).to_be_visible()
    if not im:
     row.click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');e.get_by_role('button',name='Card options',exact=True).click();e.get_by_role('menuitem',name='Edit title',exact=True).click();title=e.get_by_role('textbox',name='Card title',exact=True);writing(title);fill_field(title,'Native opened-card title');e.get_by_role('button',name='Close',exact=True).last.click();expect(e.locator('dialog')).not_to_be_visible()
    # Real IME commits remain ordinary native input, never premature Send.
    writing(field);field.focus();cdp.send('Input.imeSetComposition',{'text':'zhong','selectionStart':5,'selectionEnd':5});cdp.send('Input.insertText',{'text':'中文'});expect(field).to_have_js_property('value','中文');writing(field)
    page.evaluate('switchNote("b")');writing(field);page.evaluate('switchNote("a")');writing(field);expect(field).to_have_js_property('value','中文')
    # Import/recovery fields retain the existing non-writing defaults.
    e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button' if im else 'menuitem',name='Import from clipboard',exact=True).click()
    dialog=e.get_by_role('dialog');expect(dialog).to_be_visible();transfer=dialog.locator('textarea').first;expect(transfer).to_be_visible();assert transfer.evaluate('n=>n.spellcheck') is False;expect(transfer).to_have_attribute('autocomplete','off');expect(transfer).to_have_attribute('writingsuggestions','false')
    result=scope['parse'](page.evaluate('notes.a.content.text'));assert result['messages'][0]['title']==('Native title' if im else 'Native opened-card title');assert result['messages'][1]==data['messages'][1];assert not errors,errors;assert not outside,outside
    print(f'PASS {name} {app}: native writing hints in capture/body/title, word replacement retains bold and undo, exact saved text, IME and note-switch drafts; private import fields and unrelated message preserved',flush=True);context.close()
  browser.close()
finally:server.shutdown();server.server_close()
