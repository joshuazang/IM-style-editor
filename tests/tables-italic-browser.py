"""Editable GFM tables and italic share paste, capture, toolbar and save behavior."""
from pathlib import Path
from browser_engine import fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
sample='| Type | Example | Assessment |\n| :--- | :---: | ---: |\n| Value | *Flexible* | **Useful** |\n| Connection | Invite someone | ~~Postpone~~ |'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    im=path.startswith('/next');context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'} if width<600 else {}))
    if width<600:context.add_init_script("Object.defineProperty(navigator,'vendor',{get:()=> 'Apple Computer, Inc.'})")
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(e.stack or str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
    page.evaluate('([note,path])=>{notes.a=note;openEditor("a",path,true)}',[scope['fixture'](0)['note'],path]);e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True)
    # Live syntax must keep bold intact, and Ctrl+I toggles on and off.
    for source,tag in [('*italic*','em'),('_italic_','em'),('***both***','em'),('**bold**','strong')]:
     fill_field(field,'');field.evaluate('n=>n.imRich.view.dispatch(n.imRich.view.state.tr.setStoredMarks([]))');field.type(source);expect(field.locator(tag)).to_have_count(1)
     if tag=='strong':expect(field.locator('em')).to_have_count(0)
    fill_field(field,'Select italic');field.evaluate('n=>n.imRich.view.dispatch(n.imRich.view.state.tr.setStoredMarks([]))');field.press('Control+a');field.press('Control+i');expect(field.locator('em')).to_have_text('Select italic');field.press('Control+i');expect(field.locator('em')).to_have_count(0)
    fill_field(field,sample);expect(field.locator('table')).to_have_count(1);expect(field.locator('th')).to_have_count(3);expect(field.locator('em')).to_have_text('Flexible')
    # Cell Enter stays inside this draft and never sends it.
    cell=field.locator('td').first;cell.locator('p').click(position={'x':2,'y':10});cell.evaluate('n=>new Promise(r=>requestAnimationFrame(r))');field.press('End');field.press('Enter');field.type('continued');expect(cell).to_contain_text('continued')
    assert len(scope['parse'](page.evaluate('notes.a.content.text'))['messages'])==0
    assert field.evaluate('n=>n.imRich.view.state.selection.$from.parent.type.name')=='paragraph'
    assert '<br>' in field.evaluate('n=>n.value')
    field.press('Control+Enter');field.type('Ordinary after table');assert field.evaluate('n=>n.imRich.view.state.selection.$from.depth')==1
    e.get_by_role('button',name='Send message' if im else 'Send',exact=True).click();expect(field).to_have_js_property('value','')
    display=e.locator('.message-body' if im else '.card-body');expect(display.locator('table')).to_have_count(1);expect(display.locator('em')).to_have_text('Flexible')
    page.evaluate('path=>openEditor("a",path,true)','/mosaic/index.html' if im else '/next/index.html');e=page.frame_locator('#editor');expect(e.locator('.card-body table' if im else '.message-body table')).to_have_count(1)
    # Opened Card View exposes the same commands on phones and desktops.
    page.evaluate('openEditor("a","/mosaic/index.html",true)');e=page.frame_locator('#editor');e.locator('.card').first.click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');field=e.get_by_role('textbox',name='Card body',exact=True)
    fill_field(field,'Start');field.press('Control+End');e.get_by_role('button',name='Text formatting',exact=True).click();tools=e.get_by_role('toolbar',name='Text formatting',exact=True);tools.get_by_role('button',name='Insert table',exact=True).click();expect(field.locator('tr')).to_have_count(3)
    field.type('Header');second=field.locator('th').nth(1);second.click();second.evaluate('n=>new Promise(r=>requestAnimationFrame(r))');field.type('Second header');expect(second).to_have_text('Second header');tools.get_by_role('button',name='Add column right',exact=True).click();expect(field.locator('th')).to_have_count(3)
    tools.get_by_role('button',name='Add row below',exact=True).click();expect(field.locator('tr')).to_have_count(4)
    tools.get_by_role('button',name='Delete row',exact=True).click();expect(field.locator('tr')).to_have_count(3);expect(field.locator('th')).to_have_count(3)
    tools.get_by_role('button',name='Delete column',exact=True).click();expect(field.locator('th')).to_have_count(2)
    field.press('Control+End');field.press('Tab');expect(field.locator('tr')).to_have_count(4);field.type('Last row')
    # Selected cell text uses regular mark toggles and cannot become a list.
    field.press('Home');field.press('Shift+End');tools.get_by_role('button',name='Italic',exact=True).click();expect(field.locator('em')).to_have_text('Last row');expect(tools.get_by_role('button',name='Italic',exact=True)).to_have_attribute('aria-pressed','true')
    tools.get_by_role('button',name='Italic',exact=True).click();expect(field.locator('em')).to_have_count(0);expect(tools.get_by_role('button',name='Bullet list',exact=True)).to_be_disabled()
    tools.get_by_role('button',name='Delete table',exact=True).click();expect(field.locator('table')).to_have_count(0);field.press('Control+z');expect(field.locator('table')).to_have_count(1)
    # Native HTML clipboard tables normalize spans without losing cell text.
    field.evaluate('''n=>{n.focus();n.select();const d=new DataTransfer();d.setData('text/html','<table><tr><th colspan="2">Merged</th><th>Other</th></tr><tr><td><p><em>Italic</em></p><p>continued</p></td><td>Middle</td><td>Right</td></tr></table>');d.setData('text/plain','Merged Other Italic Middle Right');n.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));}''')
    expect(field.locator('th')).to_have_count(3);expect(field.locator('em')).to_have_text('Italic');assert field.locator('th').all_text_contents()==['Merged','','Other']
    assert field.locator('td').all_text_contents()==['Italiccontinued','Middle','Right']
    if width==390:
     wrap=field.locator('.im-md-table-wrap');assert wrap.evaluate('n=>n.scrollWidth>n.clientWidth');wrap.evaluate('n=>n.scrollLeft=80');assert wrap.evaluate('n=>n.scrollLeft')>0
    before=field.evaluate('n=>n.value');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text']==before
    e.locator('.card').first.click();field=e.get_by_role('textbox',name='Card body',exact=True);expect(field.locator('em')).to_have_text('Italic');expect(field.locator('th')).to_have_count(3)
    if width==390:
     e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');page.screenshot(path='/tmp/tables-italic-phone.png')
    assert not errors,errors
    print(f'PASS {width}px {path}: live italic/bold, shortcuts/toggles, GFM/HTML tables, Enter/no-send, format exit, row/column edits, Tab append, undo, phone horizontal scroll and exact save/reopen',flush=True)
    context.close()
  browser.close()
finally:server.shutdown()
