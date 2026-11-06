"""Compare old/new Send while draft saving stays immediate; synthetic notes only."""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8032')
html = Path('next/index.html').read_text()
bundle = 'next/' + re.search(r'src="\./([^"?]+\.js)', html)[1]
source = Path(bundle).read_text()
assert source.count('return saveTracked(note)},J=async()=>') == 1, 'Draft saving must remain immediate'
HOST = Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';", "editor.src = '/next/index.html';")
HOST = HOST.replace('window.saves = [];', 'window.saves=[];window.holdAck=false;window.acks=[];')
HOST = HOST.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, location.origin);", "const target=event.source;const reply=data=>{const send=()=>target.postMessage({action:'reply',original:message,data},location.origin);if(holdAck&&message.action==='save-items')acks.push(send);else send()};")
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    for width in [390, 1100]:
        for old_send in [False, True]:
            script = source
            if old_send:
                target = "const sentReply=imFormat.readReply(note);sending.current.set(note.uuid,{text,id:null,reply:sentReply});\ntry{\n"
                assert script.count(target) == 1
                script = script.replace(target, target + ' await persistDraft(text);\n')
            page = browser.new_page(viewport={'width': width, 'height': 844})
            page.route(BASE + '/__coalescing_host', lambda route: route.fulfill(content_type='text/html', body=HOST))
            page.route(BASE + '/' + bundle, lambda route: route.fulfill(content_type='text/javascript', body=script))
            page.goto(BASE + '/__coalescing_host')
            page.evaluate("()=>{notes.a={uuid:'a',content_type:'Note',content:{text:'Existing message'}};openIM('a')}")
            e = page.frame_locator('#editor')
            field = e.get_by_role('textbox', name='Message', exact=True)
            expect(field).to_be_visible()
            page.wait_for_timeout(100)
            before = page.evaluate('saves.length')
            page.evaluate('holdAck=true')
            field.fill('First draft still being saved')
            page.wait_for_function('acks.length===1')
            field.fill('The complete thought to send')
            e.get_by_role('button', name='Send message', exact=True).click()
            assert page.evaluate('saves.length') == before + 1
            page.evaluate('acks.shift()()')
            page.wait_for_function('(count)=>saves.length===count', arg=before + 2)
            if old_send:
                assert '@@IM:DRAFT' in page.evaluate('saves.at(-1).content.text')
                page.evaluate('acks.shift()()')
                page.wait_for_function('(count)=>saves.length===count', arg=before + 3)
            assert '@@IM:DRAFT' not in page.evaluate('saves.at(-1).content.text')
            expect(field).to_have_value('The complete thought to send')
            page.evaluate('holdAck=false;acks.splice(0).forEach(fn=>fn())')
            expect(field).to_have_value('')
            expect(e.locator('.message-body').filter(has_text='The complete thought to send')).to_have_count(1)
            assert page.evaluate('saves.length') == before + (3 if old_send else 2)
            print(f'PASS {width}px: immediate draft saving, {"old Send: 3" if old_send else "combined Send: 2"} submissions, input retained until final acknowledgment', flush=True)
            if not old_send:
                # Reject the combined write after an older draft reaches the host.
                page.evaluate('holdAck=true')
                field.fill('Saved checkpoint before rejected Send')
                page.wait_for_function('acks.length===1')
                field.fill('Latest text must survive rejected Send')
                e.get_by_role('button', name='Send message', exact=True).click()
                page.evaluate('rejectSaves=true;holdAck=false;acks.shift()()')
                expect(e.get_by_role('alert')).to_contain_text('Could not save')
                expect(field).to_have_value('Latest text must survive rejected Send')
                page.evaluate('rejectSaves=false;holdAck=false')
                e.get_by_role('button', name='Retry save', exact=True).click()
                expect(field).to_have_value('')
                expect(e.locator('.message-body').filter(has_text='Latest text must survive rejected Send')).to_have_count(1)
                assert '@@IM:DRAFT' not in page.evaluate('notes.a.content.text')
                # A late Send acknowledgment must preserve newer typing in the input.
                page.evaluate('holdAck=true')
                field.fill('Message being sent before newer typing')
                page.wait_for_function('acks.length===1')
                e.get_by_role('button', name='Send message', exact=True).click()
                field.fill('New draft written while Send was pending')
                page.evaluate('acks.shift()()')
                page.wait_for_function('acks.length===1')
                page.evaluate('holdAck=false;acks.splice(0).forEach(fn=>fn())')
                expect(field).to_have_value('New draft written while Send was pending')
                page.wait_for_function('notes.a.content.text.includes("New draft written while Send was pending")')
                expect(e.locator('.message-body').filter(has_text='Message being sent before newer typing')).to_have_count(1)
                page.evaluate('openIM("a")')
                expect(field).to_have_value('New draft written while Send was pending')
                print(f'PASS {width}px: rejected combined Send retains text, retry avoids duplicates, and late acknowledgment preserves/reopens newer draft', flush=True)
            page.close()
    browser.close()
