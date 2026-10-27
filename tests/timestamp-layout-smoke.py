"""Check timestamp wrapping against a running static server using Playwright."""
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('standard-notes-host.html').read_text()
MESSAGES = [
    'Hi',
    'This longer message should wrap across multiple lines using the full bubble width, '
    'including the area above the timestamp instead of leaving an empty column. ' * 2,
    'One line\nAnother line\nLast line',
    '中文长消息应该占满整个气泡的宽度，而不是在右边给时间戳空出一整列。这里再多放一些文字，检查多行换行效果。',
    'https://example.com/' + 'x' * 120,
]


def check_layout(bubble, full_width=False):
    geometry = bubble.evaluate('''el => {
      const b = el.getBoundingClientRect();
      const m = el.querySelector('.message-meta').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el.querySelector('.message-body'));
      const lines = Array.from(range.getClientRects());
      return {
        height: b.height, lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        rightGap: b.right-m.right, bottomGap: b.bottom-m.bottom,
        usesUpperRight: lines.some(r => r.right > m.left+5 && r.bottom <= m.top),
        overlaps: lines.some(r => r.width > 0 && r.left < m.right && r.right > m.left
          && r.top < m.bottom && r.bottom > m.top)
      };
    }''')
    assert 0 <= geometry['rightGap'] <= 10, geometry
    assert 0 <= geometry['bottomGap'] <= 8, geometry
    assert not geometry['overlaps'], geometry
    if full_width:
        assert geometry['usesUpperRight'], geometry
    return geometry


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for width, scale in [(390, '1.12'), (320, '1.4'), (1200, '1.12')]:
        context = browser.new_context(viewport={'width': width, 'height': 844},
                                      has_touch=width < 600, is_mobile=width < 600)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route(BASE+'/__host', lambda r: r.fulfill(content_type='text/html', body=HOST))
        page.goto(BASE+'/__host', wait_until='networkidle')
        editor = page.frame_locator('#editor')
        composer = editor.get_by_role('textbox', name='Message', exact=True)
        expect(composer).to_be_enabled()
        editor.get_by_role('button', name='More options', exact=True).click()
        editor.get_by_role('button', name='Appearance', exact=True).click()
        editor.get_by_label('Text size').select_option(scale)
        page.keyboard.press('Escape')
        for text in MESSAGES:
            composer.fill(text)
            editor.get_by_role('button', name='Send message', exact=True).click()
            bubble = editor.locator('.message-bubble').last
            geometry = check_layout(bubble, full_width=text in [MESSAGES[1], MESSAGES[3], MESSAGES[4]])
            if text == 'Hi':
                assert geometry['height'] <= geometry['lineHeight'] + 17, geometry
        # The edited marker makes the timestamp longer and must still wrap safely.
        bubble.click(button='right')
        editor.get_by_role('menuitem', name='Edit', exact=True).click()
        editor.get_by_role('textbox', name='Edit message', exact=True).fill(MESSAGES[1])
        editor.get_by_role('button', name='Save changes', exact=True).click()
        expect(bubble.locator('.message-meta')).to_contain_text('edited')
        check_layout(bubble, full_width=True)
        # Tagged messages retain their category footer without a reserved text column.
        bubble.click(button='right')
        editor.get_by_label('Add a category', exact=True).get_by_role('button', name='⭐', exact=True).click()
        expect(bubble).to_have_class('message-bubble has-reactions')
        check_layout(bubble, full_width=True)
        assert not errors, errors
        print(f'PASS: width={width}, scale={scale}: short, multiline, Chinese, URL, edited and tagged messages')
        context.close()
    browser.close()
