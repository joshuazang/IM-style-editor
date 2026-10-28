"""Selection geometry, composer editing, scroll controls, and phone-only blur.

Uses a synthetic host and synthetic notes, never a real Standard Notes account.
"""
import copy
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from fixture_v2 import fixture_messages, prepare_note

BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('editor-roundtrip-host.html').read_text()
MESSAGES = fixture_messages([
    dict(id=str(i), text=(f'Message {i}: ' + 'A longer message with enough text to wrap naturally. ' * 4
                         if i % 3 == 0 else f'Message {i}'),
         createdAt='2026-10-27T12:00:00.123Z', reactions=['⭐'] if i % 2 == 0 else [],
         custom={'preserve': i}) for i in range(48)
])
NOTE = prepare_note({'uuid': 'original', 'content_type': 'Note', 'content': {
    'text': '', 'appendEditorMessageData': MESSAGES}})


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for width in [320, 390, 1200]:
        phone = width < 600
        context = browser.new_context(viewport={'width': width, 'height': 844},
                                      is_mobile=phone, has_touch=phone)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route(BASE + '/__interactions', lambda route: route.fulfill(content_type='text/html', body=HOST))
        page.goto(BASE + '/__interactions')
        page.evaluate('(note)=>{notes.original=note;openIM("original")}', NOTE)
        editor = page.frame_locator('#editor')
        bubbles = editor.locator('.message-bubble')
        rows = editor.locator('.message-wrap')
        log = editor.get_by_role('log')
        expect(bubbles).to_have_count(len(MESSAGES))
        page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===48')

        # Checking/unchecking cannot reflow text, change bubble geometry, or shift its right edge.
        before = bubbles.evaluate_all('nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return [b.width,b.height,b.right]})')
        rows.first.click(button='right')
        editor.get_by_role('menuitem', name='Select', exact=True).click()
        expect(editor.get_by_role('button', name='Export', exact=True)).to_be_visible()
        expect(editor.get_by_role('button', name='Copy', exact=True)).to_be_visible()
        expect(editor.get_by_role('button', name='Copy for forwarding', exact=True)).to_have_count(0)
        after = bubbles.evaluate_all('nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return [b.width,b.height,b.right]})')
        assert before == after, (width, before[:3], after[:3])
        geometry = editor.locator('.message-row').evaluate_all('''nodes=>nodes.map(el=>{
          const check=el.querySelector('.selection-check').getBoundingClientRect();
          const bubble=el.querySelector('.message-bubble').getBoundingClientRect();
          const row=el.getBoundingClientRect();
          return {x:check.left-row.left,gap:bubble.left-check.right,checkY:check.top+check.height/2,
            bubbleY:bubble.top+bubble.height/2};})''')
        for bounds in geometry:
            assert bounds['x'] == 0 and bounds['gap'] >= 9, (width, bounds)
            assert abs(bounds['checkY'] - bounds['bubbleY']) <= 6.1, (width, bounds)
        rows.nth(1).click()
        expect(editor.locator('.selection-status')).to_contain_text('2 messages selected')
        editor.get_by_role('button', name='Cancel', exact=True).click()
        assert bubbles.evaluate_all('nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return [b.width,b.height,b.right]})') == before
        print(f'PASS width={width}: selection checks stay in the left gutter; bubble geometry is unchanged')

        # The arrow represents hidden messages in the current view and stays above the composer.
        jump = editor.get_by_role('button', name='Scroll to bottom', exact=True)
        expect(jump).to_be_visible()
        expect(jump.locator('svg')).to_have_count(1)
        jump.click()
        expect(jump).to_have_count(0)
        page.wait_for_function('''()=>{const el=editor.contentDocument.querySelector('.messages');
            return el && el.scrollHeight-el.clientHeight-el.scrollTop<=1}''')
        compose = editor.get_by_role('textbox', name='Message', exact=True)
        compose.fill('An unsent draft\nwith a second line')
        compose.focus()
        log.evaluate('el=>el.scrollTop=0')
        expect(jump).to_be_visible()
        expect(compose).to_be_focused()  # A programmatic scroll must not dismiss the keyboard.
        jb = jump.bounding_box()
        cb = editor.locator('.composer').bounding_box()
        assert jb['y'] + jb['height'] <= cb['y'] - 10, (jb, cb)

        # Touch scrolling dismisses the phone keyboard.
        if phone:
            cdp = context.new_cdp_session(page)

            def touch(kind, x=0, y=0):
                cdp.send('Input.dispatchTouchEvent', {'type': kind,
                    'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})

            box = bubbles.nth(1).bounding_box()
            tx, ty = box['x'] + 12, box['y'] + 12
            touch('touchStart', tx, ty)
            touch('touchEnd')
            compose.focus()
            expect(compose).to_be_focused()
            # Start on a bubble as well as the background: both should dismiss on a swipe.
            touch('touchStart', tx, ty)
            touch('touchMove', tx, ty - 35)
            touch('touchMove', tx, ty - 95)
            touch('touchEnd')
            expect(compose).not_to_be_focused()
            expect(editor.get_by_role('menu')).to_have_count(0)
        else:
            bounds = log.bounding_box()
            page.mouse.move(bounds['x'] + 20, bounds['y'] + 280)
            page.mouse.wheel(0, 200)
            expect(compose).to_be_focused()
        print(f'PASS width={width}: bottom arrow and user/programmatic scroll behavior; desktop focus preserved')

        # Editing uses the real composer, leaving the original bubble visible and metadata intact.
        original = copy.deepcopy(MESSAGES[0])
        log.evaluate('el=>el.scrollTop=0')
        rows.first.click(button='right')
        editor.get_by_role('menuitem', name='Edit', exact=True).click()
        edit = editor.get_by_role('textbox', name='Edit message', exact=True)
        expect(edit).to_have_value(original['text'])
        expect(edit).to_be_focused()
        assert edit.evaluate('el=>!!el.closest(".composer")')
        expect(editor.locator('.edit-box')).to_have_count(0)
        expect(bubbles.first.locator('.message-body')).to_have_text(original['text'])
        expect(editor.locator('.composer-edit-original')).to_have_text(original['text'])
        edit.fill('This change will be canceled')
        editor.get_by_role('button', name='Cancel editing', exact=True).click()
        expect(compose).to_have_value('An unsent draft\nwith a second line')
        assert page.evaluate('notes.original.clientData.imStyleEditor.messages[0]') == original

        rows.first.click(button='right')
        editor.get_by_role('menuitem', name='Edit', exact=True).click()
        revised = '\n\nEdited in the composer\n\nwith intentional spacing\n\n'
        edit.fill(revised)
        # A growing edit preview/input must not leave the jump button behind the composer.
        expect(jump).to_be_visible()
        page.wait_for_timeout(100)
        jb, cb = jump.bounding_box(), editor.locator('.composer').bounding_box()
        assert jb['y'] + jb['height'] <= cb['y'] - 10, (width, jb, cb)
        editor.get_by_role('button', name='Save changes', exact=True).click()
        expect(compose).to_have_value('An unsent draft\nwith a second line')
        page.wait_for_function('(text)=>notes.original.clientData.imStyleEditor.messages[0].text===text', arg=revised)
        saved = page.evaluate('notes.original.clientData.imStyleEditor.messages[0]')
        for key, value in original.items():
            if key != 'text':
                assert saved[key] == value, (key, saved)
        assert saved['edited'] and len(page.evaluate('notes.original.clientData.imStyleEditor.messages')) == 48
        page.evaluate('openPlain();openIM()')
        expect(bubbles).to_have_count(48)
        expect(bubbles.first.locator('.message-body')).to_have_text(revised)
        page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages[0].edited')
        assert page.evaluate('notes.original.clientData.imStyleEditor.messages[0]') == saved
        print(f'PASS width={width}: composer edit/cancel preserves drafts, bubble content, whitespace, ID, timestamps, tags and custom fields')

        # Enter saves the edit rather than appending a new message; Escape cancels it.
        rows.first.click(button='right')
        editor.get_by_role('menuitem', name='Edit', exact=True).click()
        edit.fill('Saved with Enter')
        edit.press('Enter')
        expect(compose).to_be_visible()
        page.wait_for_function('notes.original.clientData.imStyleEditor.messages[0].text==="Saved with Enter"')
        assert page.evaluate('notes.original.clientData.imStyleEditor.messages.length') == 48
        rows.first.click(button='right')
        editor.get_by_role('menuitem', name='Edit', exact=True).click()
        edit.fill('Canceled with Escape')
        edit.press('Escape')
        expect(compose).to_be_visible()
        expect(bubbles.first.locator('.message-body')).to_have_text('Saved with Enter')

        # Filters cannot send the bottom arrow to messages outside that view.
        editor.get_by_role('button', name='Search and tags', exact=True).click()
        editor.get_by_role('textbox', name='Search messages', exact=True).fill('Saved with Enter')
        expect(bubbles).to_have_count(1)
        expect(jump).to_have_count(0)
        page.keyboard.press('Escape')
        editor.get_by_role('button', name='More options', exact=True).click()
        expect(editor.get_by_role('button', name='Import from clipboard', exact=True)).to_be_visible()
        assert not errors, errors
        if width == 390:
            page.keyboard.press('Escape')
            editor.get_by_role('button', name='Clear all filters', exact=True).click()
            log.evaluate('el=>el.scrollTop=0')
            rows.first.click(button='right')
            editor.get_by_role('menuitem', name='Edit', exact=True).click()
            edit.fill('Editing directly in the main input box.\nYour unsent draft stays safe.')
            page.screenshot(path='/tmp/im-composer-edit-310.png')
        print(f'PASS width={width}: Enter/Escape, filtered bottom navigation and import/export labels')

        # A live host switch cannot carry an edit into a different note.
        page.keyboard.press('Escape')
        if editor.locator('.filter-status').count():
            editor.get_by_role('button', name='Clear all filters', exact=True).click()
        if not editor.locator('.composer.is-editing').count():
            rows.first.click(button='right')
            editor.get_by_role('menuitem', name='Edit', exact=True).click()
        edit.fill('Do not send this edit into another note')
        before_switch = page.evaluate('notes.original.content.text')
        page.evaluate('''()=>{
          notes.other={uuid:'other',content_type:'Note',content:{text:'Another note'}};
          activeUuid='other';
          editor.contentWindow.postMessage({action:'reply',original:subscription,
            data:{item:structuredClone(notes.other)}},location.origin);
        }''')
        expect(compose).to_have_value('')
        expect(editor.locator('.composer-edit-preview')).to_have_count(0)
        expect(bubbles.first.locator('.message-body')).to_have_text('Another note')
        expect(jump).to_have_count(0)
        assert page.evaluate('notes.original.content.text') == before_switch

        # Removing the message being edited closes the edit session safely.
        rows.first.click(button='right')
        editor.get_by_role('menuitem', name='Edit', exact=True).click()
        edit.fill('An edit whose original will be removed')
        rows.first.click(button='right')
        page.once('dialog', lambda dialog: dialog.accept())
        editor.get_by_role('menuitem', name='Delete', exact=True).click()
        expect(bubbles).to_have_count(0)
        expect(compose).to_have_value('')
        expect(editor.locator('.composer-edit-preview')).to_have_count(0)
        assert not errors, errors
        print(f'PASS width={width}: live note switches and deletion cannot leave a stale edit session')
        context.close()
    browser.close()
