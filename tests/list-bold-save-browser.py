"""Real formatting actions retain partial bold in lists through Card/Board/reload."""
from pathlib import Path
from browser_engine import fill_field
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')}
exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope)
globals().update(scope)
text='举个例子。有些人越减肥越胖，继续学习。'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600,**({'user_agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'} if width<600 else {}))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   for prefix in ['- ','3. ','- [ ] ']:
    for first,last in [(0,5),(4,8),(0,len(text)),(2,14)]:
     data=scope['fixture'](0);page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor')
     capture=e.get_by_role('textbox',name='Take a note',exact=True);fill_field(capture,prefix+text+'\n'+prefix+'Second item');e.get_by_role('button',name='Send',exact=True).click();e.locator('.card').first.click();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');body=e.get_by_role('textbox',name='Card body',exact=True)
     body.evaluate('''(n,r)=>{n.focus();const text=n.querySelector('li p').firstChild,range=document.createRange();range.setStart(text,r[0]);range.setEnd(text,r[1]);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));}''',[first,last])
     if width<600:e.get_by_role('button',name='Text formatting',exact=True).click()
     tools=e.get_by_role('toolbar',name='Text formatting',exact=True);expect(tools).to_be_visible();tools.get_by_role('button',name='Bold',exact=True).click();expect(body.locator('strong')).to_have_text(text[first:last])
     tools.get_by_role('button',name='Bold',exact=True).click();expect(body.locator('strong')).to_have_count(0);tools.get_by_role('button',name='Bold',exact=True).click();expect(body.locator('strong')).to_have_text(text[first:last])
     assert body.locator('li p').first.text_content()==text
     if prefix=='- ':
      tools.get_by_role('button',name='Bullet list',exact=True).click();tools.get_by_role('button',name='Bullet list',exact=True).click();expect(body.locator('strong')).to_have_text(text[first:last])
     e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();board=e.locator('.card-body');expect(board.locator('strong')).to_have_text(text[first:last]);assert ''.join(board.locator('p').all_text_contents())==text+'Second item'
     source=scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text']
     # Reloading clears live visual state/caches; both plugins must parse the save.
     page.evaluate('openEditor("a","/mosaic/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('.card-body strong')).to_have_text(text[first:last]);e.locator('.card').first.click();body=e.get_by_role('textbox',name='Card body',exact=True);expect(body.locator('strong')).to_have_text(text[first:last])
     body.press('Control+End');body.press('Enter');body.type('Another list item');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('.card-body strong')).to_have_text(text[first:last])
     page.evaluate('openEditor("a","/next/index.html",true)');e=page.frame_locator('#editor');expect(e.locator('.message-body strong')).to_have_text(text[first:last]);assert '**' not in e.locator('.message-body').text_content()
   assert not errors,errors;context.close();print(f'PASS {width}px: partial/full bold, Chinese punctuation, bullet/number/task lists, Card save → Board → reload → continued list editing → IM retain formatting',flush=True)
  browser.close()
finally:server.shutdown()
