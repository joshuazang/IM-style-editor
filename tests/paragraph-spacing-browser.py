"""Shared paragraph preference, visual gaps, measured cards and editor interchange."""
from pathlib import Path
from browser_engine import fill_field
from mosaic_helpers import open_more
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
data=scope['fixture'](50)
for item in data['messages']:
 item['text']='First paragraph wraps naturally with a little more text.\n\nSecond paragraph.\n\nThird paragraph.'
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
def gap(field):
 return field.locator('p+p').first.evaluate('n=>parseFloat(getComputedStyle(n).marginTop)/parseFloat(getComputedStyle(n).fontSize)')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
   page.evaluate('note=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}}}',data['note'])
   for path in ['/next/index.html','/mosaic/index.html']:
    im=path.startswith('/next');page.evaluate('path=>openEditor("a",path,true)',path);e=page.frame_locator('#editor')
    capture=e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True)
    expect(capture).to_be_editable();body=e.locator('.message-body' if im else '.card-body').first
    def settings():
     e.get_by_role('button',name='More options',exact=True).click()
     e.get_by_role('button' if im else 'menuitem',name='Appearance' if im else 'Paragraph spacing',exact=True).click()
     return e.get_by_role('combobox',name='Paragraph spacing',exact=True)
    choice=settings();expect(choice).to_have_value('medium' if im else 'large')
    assert choice.locator('option').all_text_contents()==['None','Small','Medium','Large']
    for value,em in [('none',0),('small',.5),('medium',1),('large',1.5)]:
     choice.select_option(value)
     page.wait_for_function("value=>notes.a.content.text.includes(JSON.stringify({paragraphSpacing:value}).slice(1,-1))",arg=value)
     assert abs(gap(body)-em)<.01,(width,path,value,gap(body))
     if not im:
      assert e.locator('.card').evaluate_all('nodes=>{const r=nodes.map(n=>n.getBoundingClientRect());return r.every((a,i)=>r.every((b,j)=>i===j||Math.min(a.right,b.right)-Math.max(a.left,b.left)<1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1))}')
    if im:
     e.get_by_role('button',name='More options',exact=True).click()
    else:
     e.get_by_role('button',name='Done',exact=True).click()
    fill_field(capture,'One paragraph\nsoft line\n\nAnother paragraph')
    assert abs(gap(capture)-1.5)<.01
    assert capture.locator('p').count()==2 and 'soft line' in capture.locator('p').first.inner_text()
    # Opening a card uses the same preference without changing note text.
    if not im:
     capture.evaluate('n=>n.blur()');e.locator('.card').first.click();detail=e.get_by_role('textbox',name='Card body',exact=True)
     assert abs(gap(detail)-1.5)<.01
     e.get_by_role('button',name='Close',exact=True).click()
    saved=scope['parse'](page.evaluate('notes.a.content.text'))
    assert saved['messages']==data['messages']
    # Switching away and back preserves saved choice; fresh notes default to Medium.
    page.evaluate('switchNote("b")');choice=settings();expect(choice).to_have_value('medium')
    assert 'paragraphSpacing' not in page.evaluate('notes.b.content.text')
    page.evaluate('switchNote("a")');page.evaluate('path=>openEditor("a",path,true)',path);e=page.frame_locator('#editor');choice=settings();expect(choice).to_have_value('large')
    if not im:
     page.evaluate('rejectSaves=true');choice.select_option('none')
     expect(e.locator('.dialog-error')).to_contain_text('Saving was not confirmed')
     assert scope['parse'](page.evaluate('notes.a.content.text'))['settings']['paragraphSpacing']=='large'
     e.get_by_role('button',name='Done',exact=True).click();page.evaluate('rejectSaves=false')
     e.get_by_role('button',name='Retry save',exact=True).last.click()
     page.wait_for_function("()=>notes.a.content.text.includes(JSON.stringify({paragraphSpacing:'none'}).slice(1,-1))")
     assert gap(e.locator('.card-body').first)==0
    if width==390:page.screenshot(path='/tmp/paragraph-spacing-'+('im' if im else 'mosaic')+'.png')
   assert not errors,errors
   print(f'PASS {width}px: shared presets, Medium default, saved interchange, display/capture/Card gaps, compact soft breaks, no card overlap and unchanged messages',flush=True)
   context.close()
  browser.close()
finally:server.shutdown()
