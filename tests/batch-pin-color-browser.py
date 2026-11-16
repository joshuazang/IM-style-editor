"""Selection menu pin/unpin and Mosaic's reused palette preserve scope and data."""
from pathlib import Path
import copy
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
data=scope['fixture'](6);data['draft']='Unsent draft\nSecond line';data['settings']['pinnedMessageIds']=[m['id'] for m in data['messages'][:2]]
for i,message in enumerate(data['messages']):
 message.update(text='Card '+str(i)+' with **bold** text.',cardColor='coral' if i==1 else 'blue' if i==2 else 'sand',copied=True,edited=True,exported=True,custom={'keep':i})
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    im=path.startswith('/next');context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def start(indices):
     page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('([note,path])=>{notes.a=note;openEditor("a",path,true)}',[data['note'],path]);e=page.frame_locator('#editor');expect(e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True)).to_be_visible()
     def row(i):return e.locator(f'[data-message-id="{data["messages"][i]["id"]}"]' if im else f'.card[data-id="{data["messages"][i]["id"]}"]')
     row(indices[0]).click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
     for i in indices[1:]:row(i).click(position={'x':8,'y':8})
     return e
    def more(e):e.get_by_role('button',name='More selection options' if im else 'Selection options',exact=True).click()
    def saved():return scope['parse'](page.evaluate('notes.a.content.text'))
    def verify(pins,messages=None):
     actual=saved();assert set(actual['settings'].get('pinnedMessageIds',[]))=={data['messages'][i]['id'] for i in pins};assert actual['messages']==(messages if messages is not None else data['messages']);assert actual['draft']==data['draft'];assert {k:v for k,v in actual['settings'].items() if k!='pinnedMessageIds'}=={k:v for k,v in data['settings'].items() if k!='pinnedMessageIds'}
    for indices,all_pinned,after,second in [([1,2],False,[0,1,2],[0]),([2,3],False,[0,1,2,3],[0,1]),([0,1],True,[],[0,1]),([1],True,[0],[0,1])]:
     e=start(indices);more(e);item=e.get_by_role('menuitem',name='Unpin selected' if all_pinned else 'Pin selected',exact=True);expect(item.locator('svg')).to_have_count(1)
     if im:expect(e.get_by_role('menuitem',name='Background options',exact=True)).to_have_count(0)
     item.click();more(e);expect(e.get_by_role('menuitem',name='Pin selected' if all_pinned else 'Unpin selected',exact=True)).to_be_visible();verify(after)
     e.get_by_role('menuitem',name='Pin selected' if all_pinned else 'Unpin selected',exact=True).click();more(e);verify(second)
     # Dismiss the menu without leaving selection, then verify persisted state.
     page.keyboard.press('Escape');page.evaluate('path=>openEditor("a",path,true)',path);expect(page.frame_locator('#editor').get_by_role('button',name='More selection options' if im else 'Selection options',exact=True)).to_be_visible();verify(second)
    if not im:
     e=start([1,2]);expected=copy.deepcopy(data['messages'])
     def palette():
      more(e);choice=e.get_by_role('menuitem',name='Background options',exact=True);expect(choice.locator('svg')).to_have_count(1);choice.click();return e.get_by_role('group',name='Selected card background colors',exact=True)
     colors=palette();expect(colors.locator('[aria-pressed=true]')).to_have_count(0)
     colors.get_by_role('button',name='Coral',exact=True).click()
     for i in [1,2]:expected[i]['cardColor']='coral'
     verify([0,1],expected);colors=palette();expect(colors.get_by_role('button',name='Coral',exact=True)).to_have_attribute('aria-pressed','true')
     writes=page.evaluate('saves.length');colors.get_by_role('button',name='Coral',exact=True).click();assert page.evaluate('saves.length')==writes
     # A failed batch save keeps a retryable local edit and the remote note intact.
     colors=palette();page.evaluate('rejectSaves=true');colors.get_by_role('button',name='Default',exact=True).click();expect(e.get_by_role('button',name='Retry save',exact=True).last).to_be_visible();verify([0,1],expected)
     for i in [1,2]:expected[i].pop('cardColor')
     page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click();expect(e.get_by_role('button',name='Retry save',exact=True)).to_have_count(0);verify([0,1],expected)
     colors=palette();expect(colors.get_by_role('button',name='Default',exact=True)).to_have_attribute('aria-pressed','true');page.keyboard.press('Escape')
     # The single-card palette still uses the same presets, and IM preserves colors.
     e.get_by_role('button',name='Cancel selection',exact=True).click();e.locator(f'.card[data-id="{data["messages"][1]["id"]}"]').click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');e.get_by_role('button',name='Background options',exact=True).click();single=e.get_by_role('group',name='Card background colors',exact=True);expect(single.get_by_role('button',name='Default',exact=True)).to_have_attribute('aria-pressed','true');single.get_by_role('button',name='Blue',exact=True).click();e.get_by_role('button',name='Close',exact=True).click();expected[1]['cardColor']='blue';verify([0,1],expected)
     page.evaluate('openEditor("a","/next/index.html",true)');expect(page.frame_locator('#editor').get_by_role('textbox',name='Message',exact=True)).to_be_visible();verify([0,1],expected)
    assert not errors,errors;print(f'PASS {width}px {path}: mixed/all-pinned/all-unpinned/single selections, two-way toggles, existing icons, retained selection/reload, exact unselected data'+(' and reused mixed-color palette, default reset, no-op, failed-save retry/single-card reuse' if not im else ''),flush=True);context.close()
  browser.close()
finally:server.shutdown()
