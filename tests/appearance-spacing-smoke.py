"""Check time-based visible gaps, symmetric badges and fresh-note default colors."""
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('editor-roundtrip-host.html').read_text()
TIMES = ['2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z', '2026-01-01T08:05:00Z',
         '2026-01-01T08:10:00.001Z', '2026-01-01T09:10:00.001Z', '2026-01-01T14:10:00.001Z',
         None, None, '2026-01-02T08:00:00Z']
MESSAGES = [dict(id=f'm{i}', text=f'Message {i}', reactions=['⭐'] if i in [0, 1, 4] else [],
                 **({'createdAt': time} if time else {})) for i, time in enumerate(TIMES)]
NOTE = {'uuid': 'original', 'content_type': 'Note', 'content': {
    'text': '\n'.join(m['text'] for m in MESSAGES), 'appendEditorMessageData': MESSAGES}}

def gaps(editor):
    return editor.locator('.message-bubble').evaluate_all('''nodes => nodes.map((node,index)=>{
      const current=node.getBoundingClientRect();
      return index ? current.top-nodes[index-1].getBoundingClientRect().bottom : 0;
    })''')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for width in [390, 1200]:
        context = browser.new_context(viewport={'width': width, 'height': 844},
                                      has_touch=width < 600, is_mobile=width < 600)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route(BASE+'/__groups', lambda r: r.fulfill(content_type='text/html', body=HOST))
        page.goto(BASE+'/__groups')
        page.evaluate('(note)=>{notes.original=note;openIM("original")}', NOTE)
        editor = page.frame_locator('#editor')
        expect(editor.locator('.message-bubble')).to_have_count(len(MESSAGES))
        expect(editor.locator('main')).to_have_class('editor-shell bubble-lime background-sand chat-wallpaper')
        values = gaps(editor)
        for index, expected in [(1, 2), (2, 2), (3, 7), (4, 12), (5, 12), (7, 2)]:
            assert abs(values[index] - expected) < .1, (width, index, values)
        button = editor.get_by_role('button', name='Filter messages by ⭐', exact=True).first
        symmetry = button.evaluate('''el => {const c=getComputedStyle(el),p=getComputedStyle(el,'::after');return {
          padding:c.paddingLeft===c.paddingRight,
          borders:c.borderLeftWidth===c.borderRightWidth,
          corners:c.borderTopLeftRadius===c.borderTopRightRadius && c.borderBottomLeftRadius===c.borderBottomRightRadius,
          centered:c.justifyContent==='center' && c.alignItems==='center', tip:p.display==='none'
        }}''')
        assert all(symmetry.values()), symmetry
        assert page.evaluate('notes.original.content.text') == NOTE['content']['text']
        assert not page.evaluate('notes.original.content.appendEditorMessageData[6].createdAt')
        button.click()
        expect(editor.locator('.message-bubble')).to_have_count(3)
        filtered = gaps(editor)
        assert abs(filtered[1]-2) < .1 and abs(filtered[2]-12) < .1, filtered
        editor.get_by_role('button', name='All', exact=True).click()
        expect(editor.locator('.message-bubble')).to_have_count(len(MESSAGES))
        if width == 390:
            page.keyboard.press('Escape')
            page.screenshot(path='/tmp/im-editor-2.6.10.png')
        assert not errors, errors
        print(f'PASS: width={width}: 2/7/12px grouping, symmetric emoji badges, Fresh Lime/Warm Sand defaults')
        context.close()
    browser.close()
