"""Exercise editor switching, legacy migration, external text edits and save failures."""
import json
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
HOST = Path(__file__).with_name('editor-roundtrip-host.html').read_text()
MESSAGES = [
    {'id': 'first', 'text': 'First message\nwith a line\n\nand an intentional blank line',
     'createdAt': '2026-01-01T12:00:00Z', 'reactions': ['⭐']},
    {'id': 'second', 'text': 'Second message', 'createdAt': '2026-01-02T12:00:00Z',
     'editedAt': '2026-01-03T12:00:00Z', 'reactions': ['❤️']},
]
SETTINGS = {'bubbleTheme': 'sky', 'backgroundTheme': 'mist', 'wallpaper': False,
            'scale': 1.4, 'reactionOrder': ['⭐', '❤️']}
TEXT = '\n'.join(m['text'] for m in MESSAGES)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route(BASE+'/__roundtrip', lambda route: route.fulfill(content_type='text/html', body=HOST))
    page.goto(BASE+'/__roundtrip')
    note = {'uuid': 'original', 'content_type': 'Note', 'clientData': {'unrelated': 'keep'},
            'content': {'title': 'Original title', 'text': TEXT, 'references': [{'uuid': 'other', 'content_type': 'Note'}],
                        'appData': {'other-domain': {'keep': True}},
                        'appendEditorMessageData': MESSAGES, 'appendEditorSettings': SETTINGS}}
    page.evaluate('(note) => {notes.original=note; openIM("original")}', note)
    editor = page.frame_locator('#editor')
    expect(editor.locator('.message-bubble')).to_have_count(2)
    page.wait_for_function('notes.original.clientData.imStyleEditor?.schemaVersion===1')
    initial = page.evaluate('notes.original')
    assert initial['content']['text'] == TEXT
    assert initial['clientData']['imStyleEditor']['messages'] == MESSAGES
    assert initial['clientData']['imStyleEditor']['settings'] == SETTINGS
    assert initial['clientData']['unrelated'] == 'keep'
    assert initial['content']['appData']['other-domain']['keep'] is True
    initial_saves = page.evaluate('saves.length')
    page.wait_for_timeout(200)
    assert page.evaluate('saves.length') == initial_saves, 'Metadata echo caused a save loop'
    print('PASS: legacy format migrates once to native per-note clientData without changing text')
    for _ in range(5):
        page.evaluate('openPlain()')
        expect(page.locator('#plain-editor')).to_have_value(TEXT)
        page.evaluate('openIM()')
        expect(editor.locator('.message-bubble')).to_have_count(2)
        assert page.evaluate('notes.original.clientData.imStyleEditor.messages') == MESSAGES
        assert page.evaluate('notes.original.clientData.imStyleEditor.settings') == SETTINGS
        expect(editor.get_by_role('alert')).to_have_count(0)
    print('PASS: five complete editor switches preserve intentional multiline bubbles, times, tags and appearance')
    page.evaluate('openPlain()')
    revised = TEXT.replace('Second message', 'Second revised message')
    page.locator('#plain-editor').fill(revised)
    page.evaluate('openIM()')
    expect(editor.get_by_text('Second revised message', exact=True)).to_be_visible()
    expect(editor.get_by_text('Second message', exact=True)).to_have_count(0)
    page.wait_for_function('notes.original.clientData.imStyleEditor.messages[1].text==="Second revised message"')
    assert page.evaluate('notes.original.content.text') == revised
    assert page.evaluate('notes.original.clientData.imStyleEditor.messages[1].id') == 'second'
    assert page.evaluate('notes.original.clientData.imStyleEditor.messages[1].createdAt') == MESSAGES[1]['createdAt']
    assert page.evaluate('notes.original.clientData.imStyleEditor.messages[0].reactions') == ['⭐']
    editor.get_by_role('textbox', name='Message', exact=True).fill('A new message after switching')
    editor.get_by_role('button', name='Send message', exact=True).click()
    page.wait_for_function('notes.original.content.text.endsWith("A new message after switching")')
    assert page.evaluate('notes.original.content.text') == revised + '\nA new message after switching'
    print('PASS: newer plain-text edits are used; sending never restores stale message text')
    plain = '\n\nParagraph one\nwith a line\r\n\r\nParagraph two\n\nParagraph three\n\n'
    page.evaluate('(text) => {notes.imported={uuid:"imported",content_type:"Note",content:{title:"Plain",text}};openIM("imported")}', plain)
    expect(editor.locator('.message-bubble')).to_have_count(3)
    page.wait_for_function('notes.imported.clientData.imStyleEditor?.messages.length===3')
    assert page.evaluate('notes.imported.content.text') == plain
    assert page.evaluate('notes.imported.clientData.imStyleEditor.settings.bubbleTheme') == 'lime'
    assert page.evaluate('notes.imported.clientData.imStyleEditor.settings.backgroundTheme') == 'sand'
    imported_ids = page.evaluate('notes.imported.clientData.imStyleEditor.messages.map(m=>m.id)')
    page.evaluate('openPlain()');expect(page.locator('#plain-editor')).to_have_value(plain.replace('\r\n', '\n'))
    page.evaluate('openIM()');expect(editor.locator('.message-bubble')).to_have_count(3)
    assert page.evaluate('notes.imported.clientData.imStyleEditor.messages.map(m=>m.id)') == imported_ids
    assert page.evaluate('notes.imported.content.text') == plain
    print('PASS: paragraph import preserves every original newline; a separate note keeps its own state')
    page.evaluate('openIM("original")')
    expect(editor.locator('.message-bubble')).to_have_count(3)
    assert page.evaluate('notes.original.content.title') == 'Original title'
    assert page.evaluate('notes.original.content.references') == note['content']['references']
    # Simulate an iframe being rebuilt for an installed update: storage is in the note, not page memory.
    page.evaluate('openIM("original")')
    expect(editor.get_by_text('Second revised message', exact=True)).to_be_visible()
    print('PASS: rebuilding the editor frame retains saved data across an update')
    page.evaluate('() => {rejectSaves=true;notes.failed={uuid:"failed",content_type:"Note",content:{text:"Keep this text"}};openIM("failed")}')
    expect(editor.get_by_role('alert')).to_contain_text('Could not save')
    assert page.evaluate('notes.failed.content.text') == 'Keep this text'
    assert page.evaluate('notes.failed.clientData') is None
    page.evaluate('rejectSaves=false')
    editor.get_by_role('button', name='Retry save', exact=True).click()
    page.wait_for_function('notes.failed.clientData.imStyleEditor?.schemaVersion===1')
    expect(editor.get_by_role('alert')).to_have_count(0)
    assert page.evaluate('notes.failed.content.text') == 'Keep this text'
    print('PASS: save rejection is visible, leaves host text unchanged, and supports retry')
    assert not errors, errors
    browser.close()
