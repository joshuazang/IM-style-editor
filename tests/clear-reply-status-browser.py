"""Reply clearing removes only saved outgoing links, across both scopes/editors."""
from pathlib import Path
import copy
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
data=scope['fixture'](4)
for i,message in enumerate(data['messages']):
 message['text']=['Original **bold** text.','Reply with *italic*.','Another reply.','Standalone.'][i]
 message.update(copied=True,edited=True,exported=True,sourceRefs=[['source',message['id']]],imported=True)
 message.pop('replyTo',None)
for index,target in [(1,0),(2,1)]:
 data['messages'][index]['replyTo']={'id':data['messages'][target]['id'],'noteId':'a','text':data['messages'][target]['text']}
data['reply']={'id':data['messages'][0]['id'],'noteId':'a','text':data['messages'][0]['text']}
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft,d.reply));"],cwd=ROOT,input=json.dumps(data),text=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    im=path.startswith('/next');context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;openEditor("a",path,true)}',[data['note'],path]);e=page.frame_locator('#editor')
    capture=e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True);expect(capture).to_be_visible()
    target_id=data['messages'][1]['id'];row=e.locator(f'[data-message-id="{target_id}"]' if im else f'.card[data-id="{target_id}"]');quote='.bubble-reply-quote' if im else '.card-reply'
    expect(row.locator(quote)).to_have_count(1)
    def open_status(selected):
     if selected:
      row.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
      e.get_by_role('button',name='More selection options' if im else 'Selection options',exact=True).click()
     else:e.get_by_role('button',name='More options',exact=True).click()
     e.get_by_role('menuitem' if not im or selected else 'button',name='Clear message statuses…' if im else 'Clear message statuses',exact=True).click()
     return e.get_by_role('dialog',name='Clear message statuses',exact=True)
    expected=copy.deepcopy(data['messages'])
    dialog=open_status(False);dialog.get_by_role('checkbox',name='Imported',exact=True).check()
    if im:page.once('dialog',lambda d:d.accept())
    dialog.get_by_role('button',name='Clear selected statuses',exact=True).click();expect(dialog).not_to_be_visible()
    for message in expected:message.pop('imported')
    compact_text=page.evaluate('notes.a.content.text')
    assert 'importedStatusCleared' not in compact_text and '"imported"' not in compact_text
    assert scope['parse'](compact_text)['messages']==expected
    expect(row.locator(quote)).to_have_count(1)
    dialog=open_status(True);expect(dialog.get_by_role('checkbox',name='Reply',exact=True)).not_to_be_checked();expect(dialog.get_by_role('button',name='Clear selected statuses',exact=True)).to_be_disabled()
    dialog.get_by_role('checkbox',name='Reply',exact=True).check();expect(dialog).to_contain_text('Reply links and quoted previews are removed')
    before=page.evaluate('notes.a.content.text');baseline=scope['parse'](before);dialog.get_by_role('button',name='Cancel',exact=True).click();assert page.evaluate('notes.a.content.text')==before
    # The selection remains active after cancelling the dialog.
    e.get_by_role('button',name='More selection options' if im else 'Selection options',exact=True).click();e.get_by_role('menuitem',name='Clear message statuses…' if im else 'Clear message statuses',exact=True).click()
    dialog=e.get_by_role('dialog',name='Clear message statuses',exact=True);dialog.get_by_role('checkbox',name='Reply',exact=True).check()
    if im:
     confirmations=[]
     def cancel_confirmation(d):confirmations.append(d.message);d.dismiss()
     page.once('dialog',cancel_confirmation);dialog.get_by_role('button',name='Clear selected statuses',exact=True).click();expect(dialog).to_be_visible();assert 'Reply links and quoted previews are removed' in confirmations[-1];assert page.evaluate('notes.a.content.text')==before
     page.once('dialog',lambda d:d.accept())
    dialog.get_by_role('button',name='Clear selected statuses',exact=True).click();expect(dialog).not_to_be_visible();expect(row.locator(quote)).to_have_count(0)
    selected=scope['parse'](page.evaluate('notes.a.content.text'));expected[1].pop('replyTo')
    assert selected['messages']==expected;assert selected['settings']==data['settings'];assert selected['draft']==baseline['draft'];assert selected['reply']==data['reply']
    # Leave selection using the visible cancel control, then clear the whole note.
    if im:e.locator('.selection-status').get_by_role('button',name='Cancel',exact=True).click()
    else:e.get_by_role('button',name='Cancel selection',exact=True).click()
    dialog=open_status(False);expect(dialog).to_contain_text('All 4' if im else 'All cards');dialog.get_by_role('checkbox',name='Reply',exact=True).check()
    # Failed writes keep the dialog and original stored note available to retry.
    page.evaluate('rejectSaves=true')
    if im:page.once('dialog',lambda d:d.accept())
    dialog.get_by_role('button',name='Clear selected statuses',exact=True).click();expect(dialog.get_by_role('alert') if im else dialog.locator('.dialog-error')).to_be_visible();assert scope['parse'](page.evaluate('notes.a.content.text'))['messages']==expected
    page.evaluate('rejectSaves=false')
    if im:page.once('dialog',lambda d:d.accept())
    dialog.get_by_role('button',name='Clear selected statuses',exact=True).click();expect(dialog).not_to_be_visible();expect(e.locator(quote)).to_have_count(0)
    expected[2].pop('replyTo');saved=scope['parse'](page.evaluate('notes.a.content.text'));assert saved['messages']==expected;assert saved['draft']==baseline['draft'];assert saved['reply']==data['reply'];assert saved['settings']==data['settings']
    for reload_path in [path,'/mosaic/index.html' if im else '/next/index.html']:
     page.evaluate('path=>openEditor("a",path,true)',reload_path);other=page.frame_locator('#editor');expect(other.get_by_role('textbox',name='Take a note' if reload_path.startswith('/mosaic') else 'Message',exact=True)).to_be_visible();expect(other.locator('.card-reply,.bubble-reply-quote')).to_have_count(0)
    assert not errors,errors;print(f'PASS {width}px {path}: Reply choice/cancellation, selected-only and whole-note clearing, exact metadata/text/draft preservation, failed-save retry, quoted preview removal and cross-editor reload',flush=True);context.close()
  browser.close()
finally:server.shutdown()
