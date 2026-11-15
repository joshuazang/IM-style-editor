"""Horizontal rules paste, type, insert, undo and reopen in both real editors."""
from pathlib import Path
from browser_engine import fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   for path in ['/next/index.html','/mosaic/index.html']:
    im=path.startswith('/next');context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
    page.evaluate('([note,path])=>{notes.a=note;openEditor("a",path,true)}',[scope['fixture'](0)['note'],path]);e=page.frame_locator('#editor')
    field=e.get_by_role('textbox',name='Message' if im else 'Take a note',exact=True)
    fill_field(field,'Before\n\n---\n\nAfter');expect(field.locator('hr')).to_have_count(1)
    assert field.locator('hr').evaluate('n=>getComputedStyle(n).borderTopStyle')=='solid'
    e.get_by_role('button',name='Send message' if im else 'Send',exact=True).click()
    target=e.locator('.message-body' if im else '.card-body');expect(target.locator('hr')).to_have_count(1)
    page.evaluate('path=>openEditor("a",path,true)','/mosaic/index.html' if im else '/next/index.html');e=page.frame_locator('#editor')
    expect(e.locator('.card-body hr' if im else '.message-body hr')).to_have_count(1)
    page.evaluate('path=>openEditor("a",path,true)',path);e=page.frame_locator('#editor')
    if im and width==390:
     # Phones intentionally expose no selection popup in IM capture. Typing is
     # still available there; manual toolbar insertion is covered in Card View.
     field=e.get_by_role('textbox',name='Message',exact=True)
    elif im:
     field=e.get_by_role('textbox',name='Message',exact=True);fill_field(field,'Replace me');field.press('Control+a')
     e.get_by_role('toolbar',name='Text formatting',exact=True).get_by_role('button',name='Insert divider',exact=True).click()
     expect(field.locator('hr')).to_have_count(1);field.press('Control+z');expect(field.locator('hr')).to_have_count(0);field.press('Control+Shift+z');expect(field.locator('hr')).to_have_count(1)
    else:
     e.locator('.card').first.click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');field=e.get_by_role('textbox',name='Card body',exact=True)
     fill_field(field,'Body');field.press('Control+End');e.get_by_role('button',name='Text formatting',exact=True).click();e.get_by_role('toolbar',name='Text formatting',exact=True).get_by_role('button',name='Insert divider',exact=True).click()
     expect(field.locator('hr')).to_have_count(1);field.type('After inserted divider');expect(field.locator('p').last).to_have_text('After inserted divider')
    for ending in ['Space','Enter']:
     fill_field(field,'');field.type('---');field.press(ending);expect(field.locator('hr')).to_have_count(1);field.type('After typed divider');expect(field.locator('p').last).to_have_text('After typed divider')
    # Rich HTML clipboard content also preserves a divider.
    field.evaluate('''n=>{n.focus();n.select();const d=new DataTransfer();d.setData('text/html','<p>Above</p><hr><p>Below</p>');d.setData('text/plain','Above\\n\\n---\\n\\nBelow');n.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));}''')
    expect(field.locator('hr')).to_have_count(1);assert field.locator('p').all_text_contents()==['Above','Below']
    assert not errors,errors
    print(f'PASS {width}px {path}: Markdown/HTML paste, display/reopen, typing shortcut and toolbar insertion with continued editing',flush=True)
    context.close()
  browser.close()
finally:server.shutdown()
