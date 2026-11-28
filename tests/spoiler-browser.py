"""Dotted spoilers in both editors, from typing and selection through read-back."""
import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from browser_engine import chromium_options, fill_field

ROOT = Path(__file__).resolve().parents[1]
scope = {'__file__': str(ROOT / 'tests/mosaic-browser.py')}
exec((ROOT / 'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer', 1)[0], scope)
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(scope['Handler'], directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'


def check_long_card(page, e, mobile):
    page.evaluate('mobile=>openEditor("a","/mosaic/index.html",mobile)', mobile)
    field = e.get_by_role('textbox', name='Take a note', exact=True)
    source = ('Visible opening\n\n||short secret|| and ||' + '长文字示例' * 1800 +
              '||\n\n' + 'Unrelated paragraph.\n\n' * 105 + 'End of long card')
    fill_field(field, source)
    e.get_by_role('button', name='Send', exact=True).click()
    expect(field).to_have_js_property('value', '')
    saved = page.evaluate('notes.a.content.text')
    count = page.evaluate('saves.length')
    message = scope['parse'](saved)['messages'][-1]
    assert message['text'] == source
    card = e.locator(f'.card[data-id="{message["id"]}"]')
    covers = card.locator('.im-spoiler')
    dialog = e.locator('dialog')
    editor = dialog.get_by_role('textbox', name='Card body', exact=True)
    edit_covers = editor.locator('.im-spoiler-edit')
    card.evaluate('''()=>{
      const previous=animateCard;
      window.spoilersAtClose=[];
      animateCard=(state,closing)=>{
        if(closing) window.spoilersAtClose.push(state.body.querySelectorAll('.im-spoiler-edit[data-revealed]').length);
        return previous(state,closing);
      };
    }''')
    for close_with_escape in (False, True):
        expect(covers).to_have_count(2)
        expect(card.get_by_role('button', name='Reveal spoiler')).to_have_count(0)
        assert covers.first.evaluate('n=>getComputedStyle(n).cursor===getComputedStyle(n.closest(".card")).cursor')
        cover = covers.first
        (cover.tap if mobile else cover.click)()
        expect(dialog).to_be_visible()
        expect(editor).not_to_have_attribute('aria-busy', 'true')
        expect(editor).to_have_js_property('value', source)
        expect(edit_covers).to_have_count(2)
        expect(edit_covers.first).to_have_css('cursor', 'zoom-in')
        expect(editor.locator('.im-spoiler-edit[data-revealed]')).to_have_count(0)
        (edit_covers.first.tap if mobile else edit_covers.first.click)(position={'x': 10, 'y': 10})
        expect(editor.locator('.im-spoiler-edit[data-revealed]')).to_have_text('short secret')
        if close_with_escape:
            editor.press('Escape')
        else:
            dialog.get_by_role('button', name='Close', exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(card.locator('.im-spoiler[data-revealed]')).to_have_count(0)
        expect(covers.first.locator('[aria-hidden=true]')).to_have_text('short secret')
        expect(covers.nth(1).locator('[aria-hidden=true]')).to_contain_text('长文字示例')
        assert page.evaluate('notes.a.content.text') == saved and page.evaluate('saves.length') == count
    assert card.evaluate('()=>window.spoilersAtClose') == [0, 0]
    cover = covers.first
    (cover.tap if mobile else cover.click)()
    expect(editor).to_have_js_property('value', source)
    editor.press('Control+End')
    page.keyboard.insert_text(' edited')
    expect(editor).to_have_js_property('value', source + ' edited')
    dialog.get_by_role('button', name='Close', exact=True).click()
    expect(dialog).not_to_be_visible()
    saved = scope['parse'](page.evaluate('notes.a.content.text'))['messages'][-1]
    assert saved['text'] == source + ' edited'
    page.evaluate('mobile=>openEditor("a","/mosaic/index.html",mobile)', mobile)
    expect(covers).to_have_count(2)
    expect(card.locator('.im-spoiler[data-revealed]')).to_have_count(0)


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**chromium_options())
        for width in (390, 1100):
            for app in ('next', 'mosaic'):
                im = app == 'next'
                mobile = width < 600
                context = browser.new_context(
                    viewport={'width': width, 'height': 844},
                    has_touch=mobile, is_mobile=mobile)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/__host')
                page.evaluate('([note,app,mobile])=>{notes.a=note;openEditor("a","/"+app+"/index.html",mobile)}',
                              [scope['fixture'](0)['note'], app, mobile])
                e = page.frame_locator('#editor')
                field = e.get_by_role('textbox', name='Message' if im else 'Take a note', exact=True)
                expect(field).to_be_editable()
                body = e.locator('.message-body' if im else '.card-body')
                draft = 'Before ||one **two**|| then ||three||'
                fill_field(field, draft)
                expect(field.locator('.im-spoiler-edit')).not_to_have_count(0)
                e.get_by_role('button', name='Send message' if im else 'Send', exact=True).click()
                expect(field).to_have_js_property('value', '')
                covers = body.locator('.im-spoiler')
                expect(covers).to_have_count(2)
                expect(covers.first.locator('strong')).to_have_text('two')
                assert covers.first.evaluate("""n=>getComputedStyle(n).backgroundImage.includes('radial-gradient')
                    &&getComputedStyle(n.firstElementChild).color==='rgba(0, 0, 0, 0)'""")
                expect(covers.first.locator('[aria-hidden=true]')).to_have_text('one two')
                saved_before_reveal = page.evaluate('notes.a.content.text')
                if im:
                    reveal = body.get_by_role('button', name='Reveal spoiler')
                    (reveal.first.tap if mobile else reveal.first.click)()
                    expect(body.locator('.im-spoiler[data-revealed]')).to_have_text('one two')
                    expect(reveal).to_have_count(1)
                    reveal.first.press('Space')
                    expect(body.locator('.im-spoiler[data-revealed]')).to_have_count(2)
                    assert page.evaluate('notes.a.content.text') == saved_before_reveal

                page.evaluate('([app,mobile])=>openEditor("a","/"+app+"/index.html",mobile)', [app, mobile])
                expect(covers).to_have_count(2)
                if im:
                    e.locator('.message-wrap').click(button='right')
                    e.get_by_role('menuitem', name='Edit', exact=True).click()
                else:
                    e.locator('.card-title,.card-body').first.click(position={'x': 8, 'y': 8})
                    e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
                edit = e.get_by_role('textbox', name='Edit message' if im else 'Card body', exact=True)
                expect(edit.locator('.im-spoiler-edit')).to_have_count(2)
                expect(edit.locator('.im-spoiler-edit').first).to_have_text('one two')
                expect(edit.locator('.im-spoiler-edit[data-revealed]')).to_have_count(0)
                edit.locator('.im-spoiler-edit').first.click(position={'x': 9, 'y': 10})
                expect(edit.locator('.im-spoiler-edit[data-revealed]')).to_have_count(1)
                if not mobile or not im:
                    fill_field(edit, 'selected text')
                    if mobile:
                        e.get_by_role('button', name='Text formatting', exact=True).click()
                    edit.press('Control+a')
                    toolbar = e.get_by_role('toolbar', name='Text formatting')
                    spoiler = toolbar.get_by_role('button', name='Spoiler', exact=True)
                    spoiler.click()
                    expect(edit).to_have_js_property('value', '||selected text||')
                    expect(spoiler).to_have_attribute('aria-pressed', 'true')
                    spoiler.click()
                    expect(edit).to_have_js_property('value', 'selected text')
                fill_field(edit, '')
                edit.press_sequentially('||typing test|| visible')
                expect(edit).to_have_js_property('value', '||typing test|| visible')
                expect(edit.locator('.im-spoiler-edit')).to_have_text('typing test')
                e.get_by_role('button', name='Save changes' if im else 'Close', exact=True).click()
                expect(edit).not_to_be_visible()
                expect(covers).to_have_count(1)
                result = scope['parse'](page.evaluate('notes.a.content.text'))
                assert result['messages'][0]['text'] == '||typing test|| visible'
                other = 'mosaic' if im else 'next'
                page.evaluate('([app,mobile])=>openEditor("a","/"+app+"/index.html",mobile)', [other, mobile])
                expect(e.locator('.message-body .im-spoiler,.card-body .im-spoiler')).to_have_count(1)
                if not im:
                    check_long_card(page, e, mobile)
                assert not errors, errors
                context.close()
                print(f'PASS {width}px {app}: masked Markdown, tap/keyboard reveal, live typing and formatting, save and cross-editor reopening', flush=True)
        browser.close()
finally:
    server.shutdown()
    server.server_close()
