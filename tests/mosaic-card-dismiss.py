"""Text selection released outside a card must not become backdrop dismissal."""
import functools, http.server, json, subprocess, threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_engine import chromium_options,fill_field

ROOT = Path(__file__).resolve().parents[1]
scope = {'__file__': str(ROOT / 'tests/mosaic-browser.py')}
exec((ROOT / 'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer', 1)[0], scope)
data = scope['fixture'](1)
text = '\n'.join(['Select a passage and keep reading without closing the card.'] * 8)
data['messages'][0].update(text=text, title='Select part of this title too', reactions=[])
data['note']['content']['text'] = json.loads(subprocess.check_output([
    'node', '-e', "const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,d.draft)));"
], cwd=ROOT, input=json.dumps(data), text=True))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**chromium_options())
        for reduced in [False, True]:
            context = browser.new_context(viewport={'width': 1100, 'height': 900}, reduced_motion='reduce' if reduced else 'no-preference')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
            page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",false)}', data['note'])
            editor = page.frame_locator('#editor')
            card = editor.locator('.card').first
            dialog = editor.locator('dialog')
            body = editor.get_by_role('textbox', name='Card body', exact=True)

            def open_card():
                card.click()
                dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
                expect(body).to_have_js_property('value',text)

            def still_open():
                expect(dialog).to_be_visible()
                assert dialog.evaluate('n=>n.open&&!modalState.root.inert&&!modalState.busy'), 'Selection must not initiate dismissal or saving'

            def outside(side):
                r = dialog.bounding_box()
                x, y = r['x'] + r['width'] / 2, r['y'] + r['height'] / 2
                if side == 'left': x = r['x'] - 25
                if side == 'right': x = r['x'] + r['width'] + 25
                if side == 'top': y = r['y'] - 25
                if side == 'bottom': y = r['y'] + r['height'] + 25
                return x, y

            def drag(field, side):
                r = field.bounding_box()
                page.mouse.move(r['x'] + 12, r['y'] + 14)
                page.mouse.down()
                page.mouse.move(*outside(side), steps=8)
                page.mouse.up()
                still_open()

            # Escape clears highlighted text before closing; without a selection,
            # it closes even when a formatting panel owns focus.
            for toolbar_mode in ['caret','manual','selection','backward-selection','toolbar-focus','title-input','readonly-title']:
                open_card()
                if toolbar_mode in ['manual']:
                    editor.get_by_role('button',name='Text formatting',exact=True).click()
                elif toolbar_mode in ['selection','backward-selection','toolbar-focus']:
                    body.press('Control+a')
                    expect(editor.locator('.im-format-toolbar.is-selection-format')).to_be_visible()
                    if toolbar_mode=='backward-selection':body.press('Control+End');body.press('Control+Shift+Home')
                    if toolbar_mode=='toolbar-focus':body.press('Alt+F10')
                elif toolbar_mode=='title-input':
                    body.press('Control+a')
                    editor.locator('.detail-more').click();editor.get_by_role('menuitem',name='Edit title',exact=True).click()
                    editor.get_by_role('textbox',name='Card title',exact=True).press('Control+a')
                elif toolbar_mode=='readonly-title':
                    editor.locator('.detail-title').evaluate('n=>{n.tabIndex=-1;n.focus();const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r)}')
                else:body.click()
                head=body.evaluate('n=>{const s=getSelection();const v=n.imRich.view;return imRichDeps.state.TextSelection.near(v.state.doc.resolve(v.posAtDOM(s.focusNode,s.focusOffset))).head}') if toolbar_mode in ['selection','backward-selection','toolbar-focus'] else None
                page.keyboard.press('Escape')
                if toolbar_mode in ['selection','backward-selection','toolbar-focus','title-input','readonly-title']:
                    still_open()
                    if toolbar_mode=='title-input':assert editor.get_by_role('textbox',name='Card title',exact=True).evaluate('n=>n.selectionStart===n.selectionEnd')
                    elif toolbar_mode=='readonly-title':assert body.evaluate('()=>getSelection().isCollapsed')
                    else:
                        assert body.evaluate('n=>n.imRich.view.state.selection.empty&&getSelection().isCollapsed')
                        assert body.evaluate('n=>n.imRich.view.state.selection.head')==head,(toolbar_mode,head,body.evaluate('n=>n.imRich.view.state.selection.toJSON()'))
                    expect(editor.locator('.im-format-toolbar.is-selection-format')).to_have_count(0)
                    dialog.dispatch_event('keydown',{'key':'Escape','repeat':True,'bubbles':True});still_open()
                    page.keyboard.press('Escape')
                expect(dialog).not_to_be_visible()
                assert page.evaluate('saves.length')==0
            open_card()
            for side in ['right', 'left', 'top', 'bottom']:
                drag(body, side)
                assert body.evaluate('n=>n.selectionStart!==n.selectionEnd'), 'The regression must exercise actual text selection'
            drag(editor.locator('.detail-title'), 'right')
            editor.locator('.detail-more').click()
            editor.get_by_role('menuitem', name='Edit title', exact=True).click()
            drag(editor.get_by_role('textbox', name='Card title', exact=True), 'left')

            # A press outside that ends inside is not an outside click either.
            page.mouse.move(*outside('left'))
            page.mouse.down()
            r = body.bounding_box()
            page.mouse.move(r['x'] + 30, r['y'] + 20, steps=8)
            page.mouse.up()
            still_open()
            assert page.evaluate('saves.length') == 0

            # Cancelled presses and replaced modal sessions cannot dismiss later.
            page.mouse.move(*outside('right'))
            page.mouse.down()
            dialog.dispatch_event('pointercancel', {'pointerId': 1, 'pointerType': 'mouse', 'isPrimary': True})
            page.mouse.up()
            still_open()
            page.mouse.move(*outside('left'))
            page.mouse.down()
            dialog.evaluate('n=>{const id=modalState.id;closeModal(true);editorDialog(id);modalState.cardAnimation?.finish()}')
            page.mouse.up()
            still_open()

            # Ordinary outside clicks still close and preserve the original note.
            page.mouse.click(*outside('right'))
            expect(dialog).not_to_be_visible()
            assert page.evaluate('saves.length') == 0
            assert page.evaluate('notes.a.content.text') == data['note']['content']['text']

            open_card()
            fill_field(body,text + '\nRetained edit')
            drag(body, 'right')
            assert page.evaluate('saves.length') == 0
            page.evaluate('rejectSaves=true')
            body.press('Control+a');body.press('Escape');still_open()
            body.press('Escape')
            expect(editor.get_by_role('button', name='Retry save', exact=True).last).to_be_visible()
            expect(body).to_have_js_property('value',text + '\nRetained edit')
            page.evaluate('rejectSaves=false')
            editor.get_by_role('button', name='Retry save', exact=True).last.click()
            expect(dialog).not_to_be_visible()
            saved = scope['parse'](page.evaluate('notes.a.content.text'))
            assert saved['messages'][0]['text'] == text + '\nRetained edit'
            assert saved['draft'] == data['draft']
            card.click()
            dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
            fill_field(body,text + '\nWait for acknowledgment')
            page.evaluate('holdAck=true')
            page.mouse.click(*outside('right'))
            expect(dialog).to_be_visible()
            assert dialog.evaluate('n=>modalState.sending&&modalState.busy'), 'Outside dismissal must still wait for acknowledgment'
            page.evaluate('releaseAcks()')
            expect(dialog).not_to_be_visible()
            assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text'] == text + '\nWait for acknowledgment'
            assert not errors, errors
            print(f'PASS reduced={reduced}: real body/title selection in all directions, press origin, cancellation, replaced dialogs, selection-first Escape from body/keyboard toolbars and one-press close without selection, ordinary outside close, acknowledgment and retained Escape failed save/retry', flush=True)
            context.close()
        context = browser.new_context(viewport={'width': 390, 'height': 1200}, user_agent='Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', is_mobile=True, has_touch=True)
        page = context.new_page()
        page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
        page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}', data['note'])
        editor = page.frame_locator('#editor')
        editor.locator('.card').first.tap()
        dialog = editor.locator('dialog')
        dialog.evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}')
        r = dialog.bounding_box()
        # Tap well inside the backdrop, outside touch hit-adjustment near edges.
        assert r['y'] > 40
        page.touchscreen.tap(195, r['y'] / 2)
        expect(dialog).not_to_be_visible()
        assert page.evaluate('saves.length') == 0
        print('PASS Android: ordinary touch backdrop dismissal remains functional', flush=True)
        context.close()
        browser.close()
finally:
    server.shutdown()
