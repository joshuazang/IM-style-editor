"""Trash across both editors, plus the shared Chinese input behavior in IM."""
import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from browser_engine import chromium_options
from composer_chinese import check_chinese_capture

ROOT = Path(__file__).resolve().parents[1]
scope = {'__file__': str(ROOT / 'tests/mosaic-browser.py')}
exec((ROOT / 'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer', 1)[0], scope)
fixture, parse = scope['fixture'], scope['parse']
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(scope['Handler'], directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**chromium_options(), ignore_default_args=['--hide-scrollbars'])
        for width in (390, 1100):
            context = browser.new_context(viewport={'width': width, 'height': 844}, has_touch=width < 600, is_mobile=width < 600)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/__host')
            data = fixture(4)
            page.evaluate('note=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{text:""}}}', data['note'])
            e = page.frame_locator('#editor')
            trash = e.get_by_role('region', name='Trash', exact=True)

            def open_editor(im):
                app = 'next' if im else 'mosaic'
                page.evaluate('([app,mobile])=>openEditor("a","/"+app+"/index.html",mobile)', [app, width < 600])
                field = e.get_by_role('textbox', name='Message' if im else 'Take a note', exact=True)
                expect(field).to_be_visible()
                return field

            def open_trash(im):
                e.get_by_role('button', name='More options', exact=True).click()
                if im:
                    e.get_by_role('button', name='Trash', exact=True).click()
                else:
                    e.get_by_role('menuitem', name='Trash', exact=True).click()
                expect(trash).to_be_visible()
                expect(trash.get_by_role('button',name='Close Trash').locator('svg path')).to_have_count(1)
                expect(e.get_by_role('button', name='Search and tags', exact=True)).not_to_be_visible()
                expect(e.get_by_role('textbox', name='Message' if im else 'Take a note', exact=True)).not_to_be_visible()

            def saved():
                return parse(page.evaluate('notes.a.content.text'))

            def row(message, im):
                attr = 'data-message-id' if im else 'data-id'
                tag = '.message-wrap' if im else '.card'
                return e.locator(f'{tag}[{attr}="{message["id"]}"]')

            def trashed(message):
                return trash.locator(f'[data-id="{message["id"]}"]')

            def move(message, im):
                row(message, im).click(button='right')
                if im:
                    page.once('dialog', lambda dialog: dialog.accept())
                e.get_by_role('menuitem', name='Delete', exact=True).click()
                if not im:
                    e.get_by_role('button', name='Move to Trash', exact=True).click()
                expect(row(message, im)).to_have_count(0)

            first, pinned, third, fourth = data['messages']
            open_editor(False)
            e.get_by_role('button', name='Search and tags', exact=True).click()
            panel = e.locator('#search-tags-panel')
            expect(panel).to_be_visible()
            expect(panel.get_by_text('Trash', exact=True)).to_have_count(0)
            e.get_by_role('button', name='Search and tags', exact=True).click()
            open_trash(False)
            expect(trash.get_by_text('Trash is empty.')).to_be_visible()
            expect(trash.get_by_role('button', name='Restore', exact=True)).not_to_be_visible()
            trash.get_by_role('button', name='Close Trash').click()
            move(pinned, False)
            local_date = page.evaluate('()=>{const d=new Date();return [d.getFullYear(),d.getMonth()+1,d.getDate()].map(n=>String(n).padStart(2,"0")).join("-")}')
            assert saved()['messages'][1] == {**pinned, 'trashedOn': local_date}
            assert saved()['draft'] == data['draft']
            open_trash(False)
            expect(trashed(pinned).locator('time')).to_have_attribute('datetime', local_date)

            # Both UIs read the same note-level Trash after a fresh iframe load.
            open_editor(True)
            expect(row(pinned, True)).to_have_count(0)
            open_trash(True)
            expect(trashed(pinned)).to_be_visible()
            trashed(pinned).get_by_role('button', name='Select Thought 1').click()
            expect(trash.get_by_role('status')).to_have_text('1 selected')
            trashed(pinned).get_by_role('button', name='Select Thought 1').press('Escape')
            expect(trash.get_by_role('button', name='Restore')).not_to_be_visible()
            trashed(pinned).get_by_role('button', name='Select Thought 1').click()
            trash.get_by_role('button', name='Restore', exact=True).click()
            expect(trash.get_by_text('Trash is empty.')).to_be_visible()
            trash.get_by_role('button', name='Close Trash').click()
            expect(row(pinned, True)).to_be_visible()
            assert saved()['messages'] == data['messages']
            assert saved()['settings']['pinnedMessageIds'] == [pinned['id']]

            # IM batch moves, then Mosaic cancels and confirms the permanent action.
            row(third, True).click(button='right')
            e.get_by_role('menuitem', name='Select', exact=True).click()
            row(fourth, True).click()
            page.once('dialog', lambda dialog: dialog.accept())
            e.get_by_role('button', name='Delete selected messages', exact=True).click()
            expect(row(third, True)).to_have_count(0)
            expect(row(fourth, True)).to_have_count(0)
            open_editor(False)
            open_trash(False)
            expect(trash.get_by_role('listitem')).to_have_count(2)
            trashed(third).get_by_role('button', name='Select Thought 2').click()
            trashed(fourth).get_by_role('button', name='Select Thought 3').click()
            expect(trash.get_by_role('status')).to_have_text('2 selected')
            trash.get_by_role('button', name='Delete permanently', exact=True).click()
            confirm = trash.get_by_role('dialog', name='Confirm permanent deletion')
            expect(confirm).to_be_visible()
            confirm.get_by_role('button', name='Cancel', exact=True).click()
            expect(trash.get_by_role('listitem')).to_have_count(2)
            trash.get_by_role('button', name='Delete permanently', exact=True).click()
            page.evaluate('rejectSaves=true')
            confirm.get_by_role('button', name='Delete permanently', exact=True).click()
            expect(e.get_by_role('button', name='Retry save', exact=True)).to_be_visible()
            assert len(saved()['messages']) == 4
            page.evaluate('rejectSaves=false')
            e.get_by_role('button', name='Retry save', exact=True).click()
            expect(e.get_by_role('button', name='Retry save', exact=True)).not_to_be_visible()
            expect(trash.get_by_text('Trash is empty.')).to_be_visible()
            assert saved()['messages'] == [first, pinned]
            assert saved()['draft'] == data['draft']
            page.evaluate('switchNote("b")')
            expect(trash).not_to_be_visible()
            expect(e.get_by_role('textbox', name='Take a note', exact=True)).to_be_visible()
            page.evaluate('switchNote("a")')
            expect(row(first, False)).to_be_visible()

            field = open_editor(True)
            check_chinese_capture(field, context, page)
            assert len(saved()['messages']) == 2, 'Composer keystrokes must not send'
            assert not errors, errors
            context.close()
            print(f'PASS {width}px: shared Trash, date-only marker, restore with pin/reply, batch move, confirmed permanent deletion, note switch and IM Chinese input', flush=True)
        browser.close()
finally:
    server.shutdown()
    server.server_close()
