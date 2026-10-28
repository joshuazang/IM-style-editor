"""Batch selection suppresses custom/native context menus without blocking clicks."""
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from fixture_v2 import fixture_messages, prepare_note

BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('editor-roundtrip-host.html').read_text()
RECORDS = fixture_messages([
    dict(id=str(i), text=f'Selectable message {i}', createdAt='2026-10-27T12:00:00Z',
         reactions=['⭐'] if i == 1 else []) for i in range(8)
])
NOTE = prepare_note({'uuid': 'original', 'content_type': 'Note', 'content': {
    'text': '', 'appendEditorMessageData': RECORDS}})

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for width in [390, 1200]:
        phone = width < 600
        context = browser.new_context(viewport={'width': width, 'height': 844},
                                      has_touch=phone, is_mobile=phone)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route(BASE + '/__selection', lambda route: route.fulfill(content_type='text/html', body=HOST))
        page.goto(BASE + '/__selection')
        page.evaluate('(note)=>{notes.original=note;openIM("original")}', NOTE)
        editor = page.frame_locator('#editor')
        rows = editor.locator('.message-wrap')
        body = editor.locator('.message-body')
        menu = editor.get_by_role('menu')
        expect(body).to_have_count(8)
        page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===8')
        original_saves = page.evaluate('saves.length')
        if phone:
            cdp = context.new_cdp_session(page)

            def hold(target, during=None):
                box = target.bounding_box()
                x, y = box['x'] + 12, box['y'] + box['height'] / 2
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
                page.wait_for_timeout(650)
                if during:
                    during()
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

            hold(body.nth(4))
        else:
            body.nth(4).click(button='right')
        expect(menu).to_be_visible()
        editor.get_by_role('menuitem', name='Select', exact=True).click()
        expect(editor.locator('.selection-status')).to_contain_text('1 message selected')
        expect(menu).to_have_count(0)

        # Both already-selected and unselected messages ignore mouse context menus.
        for target in [body.nth(4), body.nth(5), editor.locator('.selection-check').nth(4),
                       editor.get_by_role('button', name='Filter messages by ⭐', exact=True)]:
            target.click(button='right')
            expect(menu).to_have_count(0)
            prevented = target.evaluate('''el=>!el.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles:true,cancelable:true,button:2}))''')
            assert prevented, 'The native browser menu was not suppressed'
        expect(editor.locator('.selection-status')).to_contain_text('1 message selected')

        if phone:
            # A hold cannot start press feedback or open a menu, before or after release.
            for target in [body.nth(6), body.nth(4)]:
                def during():
                    expect(menu).to_have_count(0)
                    expect(editor.locator('.message-wrap.pressed')).to_have_count(0)
                hold(target, during)
                expect(menu).to_have_count(0)
                assert body.nth(4).evaluate('()=>window.getSelection().toString()') == ''

        # Reset the selected set explicitly; ordinary taps/clicks still toggle records.
        if editor.locator('.selection-tools').count():
            editor.get_by_role('button', name='Cancel', exact=True).click()
        body.nth(4).click(button='right')
        editor.get_by_role('menuitem', name='Select', exact=True).click()
        rows.nth(5).click()
        expect(editor.locator('.selection-status')).to_contain_text('2 messages selected')
        rows.nth(5).click()
        expect(editor.locator('.selection-status')).to_contain_text('1 message selected')
        editor.locator('.selection-check').nth(6).click()
        expect(editor.locator('.selection-status')).to_contain_text('2 messages selected')
        editor.get_by_role('button', name='Cancel', exact=True).click()
        if phone:
            hold(body.nth(4))
        else:
            body.nth(4).click(button='right')
        expect(menu).to_be_visible()
        page.keyboard.press('Escape')

        # Unchecking the final message also re-enables normal menus.
        body.nth(4).click(button='right')
        editor.get_by_role('menuitem', name='Select', exact=True).click()
        rows.nth(4).click()
        expect(editor.locator('.selection-tools')).to_have_count(0)
        body.nth(4).click(button='right')
        expect(menu).to_be_visible()
        page.keyboard.press('Escape')
        assert page.evaluate('saves.length') == original_saves
        assert page.evaluate('notes.original.clientData.imStyleEditor.messages') == RECORDS
        assert not errors, errors
        print(f'PASS width={width}: batch selection blocks right-click/hold/native menus; '
              'click/check selection works; clearing/final unselect restores menus; no note changes')
        context.close()
    browser.close()
