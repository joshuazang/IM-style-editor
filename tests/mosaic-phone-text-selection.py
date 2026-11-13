"""Phone text selection owns long presses and handle drags, not card gestures."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')};exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope);globals().update(scope)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for phone,width in [('iPhone',320),('iPhone',390),('Android',390)]:
   ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if phone=='iPhone' else 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
   context=browser.new_context(viewport={'width':width,'height':900},user_agent=ua,is_mobile=True,has_touch=True)
   context.add_init_script('window.selectionViewport=new EventTarget();Object.assign(selectionViewport,{height:900,width:innerWidth,offsetTop:0,offsetLeft:0});Object.defineProperty(window,"visualViewport",{get:()=>selectionViewport})')
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');e.locator('.card').first.click();dialog=e.locator('dialog');dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_editable();body.focus()
   body.evaluate('''n=>{window.selectionBlurs=0;n.addEventListener('blur',()=>selectionBlurs++);const text=n.querySelector('p').firstChild;getSelection().setBaseAndExtent(text,0,text,4);n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:11,clientX:40,clientY:50}));}''');page.wait_for_timeout(600)
   assert body.evaluate('()=>getSelection().toString()')=='Seed','The app long-press menu must not erase a native word selection'
   body.evaluate("n=>n.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:11,clientX:40,clientY:50}))");expect(e.locator('#menu')).not_to_be_visible()
   assert body.evaluate("n=>n.dispatchEvent(new PointerEvent('contextmenu',{bubbles:true,cancelable:true,pointerType:'touch'}))"),'Native Copy/selection menu must remain available'
   # Model the native handle's event ordering: DOM selection changes before
   # ProseMirror synchronizes it. Handles can target the scroller, not the text.
   body.evaluate('''n=>{
    const v=n.imRich.view;v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.atStart(v.state.doc)));const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    const sel=getSelection();sel.setBaseAndExtent(nodes[0],0,nodes[0],4);const scroller=n.closest('.card-detail-scroll');
    scroller.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:12,button:0,clientX:20,clientY:60}));
    const send=(type,y)=>{const t=new Touch({identifier:1,target:scroller,clientX:20,clientY:y});scroller.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:type==='touchend'?[]:[t]}));};
    send('touchstart',60);sel.extend(nodes[6],nodes[6].length);send('touchmove',110);sel.extend(nodes[12],nodes[12].length);send('touchmove',170);
    window.extendedSelection=sel.toString();window.selectionScrollTop=scroller.scrollTop;selectionViewport.height=420;selectionViewport.dispatchEvent(new Event('resize'));send('touchend',170);
   }''')
   body.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');expect(body).to_be_focused();assert body.evaluate('()=>selectionBlurs')==0;assert body.evaluate('()=>getSelection().toString()===extendedSelection&&extendedSelection.length>50');assert body.evaluate('n=>n.closest(".card-detail-scroll").scrollTop===selectionScrollTop');expect(e.locator('.im-format-toolbar.is-selection-format')).to_have_count(0)
   # A long-held caret drag should also keep focus even while collapsed.
   body.press('ArrowRight');body.evaluate('''n=>{const t=new Touch({identifier:2,target:n,clientX:30,clientY:60});window.caretTouch=t;n.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t]}))}''');page.wait_for_timeout(350);body.evaluate('''n=>{const t=new Touch({identifier:2,target:n,clientX:30,clientY:100});n.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,touches:[t]}));n.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}))}''');expect(body).to_be_focused();assert body.evaluate('()=>selectionBlurs')==0
   assert page.evaluate('saves.length')==0;assert not errors,errors;print(f'PASS {phone} {width}px: native long-press menu, DOM-first handle extension, viewport changes and held caret drag retain selection/focus; no writes',flush=True);context.close()
  browser.close()
finally:server.shutdown()
