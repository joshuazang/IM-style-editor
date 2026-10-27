from fixture_v2 import fixture_id, fixture_messages, prepare_note
"""Only the top-menu surfaces should blur the content behind them."""
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('editor-roundtrip-host.html').read_text()
messages = [dict(id=str(i),text=f'Underlying message {i}',reactions=['⭐'],createdAt='2026-01-01T08:00:00Z') for i in range(20)]
messages=fixture_messages(messages)
note = {'uuid':'original','content_type':'Note','content':{'text':'\n'.join(m['text'] for m in messages),'appendEditorMessageData':messages}}
note=prepare_note(note)

def surface(element, frosted, alpha=22):
    actual=element.evaluate('''el=>{
      const style=getComputedStyle(el),canvas=document.createElement('canvas');
      canvas.width=canvas.height=1;const c=canvas.getContext('2d');
      c.fillStyle=style.backgroundColor;c.fillRect(0,0,1,1);
      return {alpha:c.getImageData(0,0,1,1).data[3],blur:style.backdropFilter||style.webkitBackdropFilter};
    }''')
    if frosted:
        assert abs(actual['alpha']-round(255*alpha/100)) <= 3,actual
        assert 'blur(10px)' in actual['blur'],actual
    else:
        assert actual['alpha']==255,actual
        assert actual['blur'] in ['none',''],actual

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
    for width in [390,1200]:
        context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600)
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route(BASE+'/__frost',lambda r:r.fulfill(content_type='text/html',body=HOST))
        page.goto(BASE+'/__frost');page.evaluate('(note)=>{notes.original=note;openIM("original")}',note)
        editor=page.frame_locator('#editor');expect(editor.locator('.message-bubble')).to_have_count(20)
        editor.get_by_role('button',name='Search and tags',exact=True).click()
        surface(editor.locator('.search-tags-panel'),True)
        if width==390:page.screenshot(path='/tmp/im-top-search-frost.png')
        editor.get_by_role('button',name='More options',exact=True).click()
        surface(editor.locator('.more-options'),True)
        editor.get_by_role('button',name='Appearance',exact=True).click()
        surface(editor.locator('.appearance'),True)
        surface(editor.get_by_role('button',name='More options',exact=True),True,22)
        search=editor.get_by_role('button',name='Search and tags',exact=True)
        surface(search,True,22)
        expect(search.locator('svg')).to_have_attribute('viewBox','0 0 32 32')
        expect(search.locator('img')).to_have_count(0)
        assert search.inner_text().strip()==''
        size=search.bounding_box();assert size['width']<=46.1 and size['height']<=38.1,size
        page.keyboard.press('Escape')
        editor.locator('.message-body').first.click(button='right')
        surface(editor.get_by_role('menu'),False)
        assert not errors,errors
        print(f'PASS: width={width}: top panels and icon-only controls frosted; context menu opaque')
        context.close()
    browser.close()
