"""Real synthetic clipboard + official-style opaque-origin sandbox; no account access."""
import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_engine import chromium_options

BASE = os.environ.get('IM_STYLE_EDITOR_BASE_URL', 'http://127.0.0.1:8033')
HOST = Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';", "editor.src = '/next/index.html';editor.setAttribute('sandbox','allow-scripts allow-modals allow-forms allow-downloads');")
HOST = HOST.replace('event.origin !== location.origin', "event.origin !== 'null'").replace('}, location.origin)', "}, '*')")
HOST = HOST.replace('window.rejectSaves = false;', 'window.rejectSaves=false;window.holdAck=false;window.acks=[];window.releaseAcks=()=>acks.splice(0).forEach(fn=>fn());')
HOST = HOST.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, location.origin);", "const target=event.source;const reply=data=>{const send=()=>target.postMessage({action:'reply',original:message,data},'*');if(holdAck&&message.action==='save-items'&&!data?.error)acks.push(send);else send()};")
# The original reply string's target origin was replaced above.
HOST = HOST.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, '*');", "const target=event.source;const reply=data=>{const send=()=>target.postMessage({action:'reply',original:message,data},'*');if(holdAck&&message.action==='save-items'&&!data?.error)acks.push(send);else send()};")
HOST += '<button id="host-focus" style="position:fixed;left:0;top:0;width:32px;height:20px;z-index:99999">Host</button>'
JS = """const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const {f,t}=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+'\\n'+fs.readFileSync('shared/core/message-transfer.js','utf8')+';({f:imFormat,t:imTransfer})',{crypto,btoa});const initial=f.portable([{id:f.newId(),text:'Keep this existing bubble',reactions:[],copied:true,exported:true}],{},'Preserve this unsent draft');const cases=Array.from({length:3},(_,i)=>t.create([{id:f.newId(),text:'Imported clipboard case '+i,reactions:[],createdAt:'2026-11-06T12:00:00Z'}],{},'source'));console.log(JSON.stringify({initial,cases}));"""
data = json.loads(subprocess.run(['node', '-e', JS], check=True, capture_output=True, text=True).stdout)

with sync_playwright() as p:
    browser = p.chromium.launch(**chromium_options())
    for width in [320, 390, 1100]:
        context = browser.new_context(viewport={'width': width, 'height': 844})
        context.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("Storage.prototype.setItem=function(){throw new Error('No new browser persistence')}")
        def asset(route):
            response = route.fetch()
            route.fulfill(response=response, headers={**response.headers, 'access-control-allow-origin': '*'})
        page.route(BASE + '/next/**', asset)
        page.route(BASE + '/__clipboard_clear', lambda route: route.fulfill(content_type='text/html', body=HOST))
        page.goto(BASE + '/__clipboard_clear')
        page.evaluate('(text)=>{notes.a={uuid:"a",content_type:"Note",content:{text}};openIM("a")}', data['initial'])
        e = page.frame_locator('#editor')
        field = e.get_by_role('textbox', name='Message', exact=True)
        expect(field).to_have_value('Preserve this unsent draft')
        page.wait_for_timeout(150)
        def clipboard(value=None):
            page.locator('#host-focus').click()
            if value is not None:
                page.evaluate('(value)=>navigator.clipboard.writeText(value)', value)
            return page.evaluate('navigator.clipboard.readText()')
        def more():
            e.get_by_role('button', name='More options', exact=True).click()
        def import_dialog(payload):
            more()
            e.get_by_role('button', name='Import from clipboard', exact=True).click()
            dialog = e.get_by_role('dialog', name='Import from clipboard', exact=True)
            expect(dialog).to_be_visible()
            dialog.get_by_role('textbox', name='Paste exported messages').fill(payload)
            return dialog
        def confirmation():
            dialog = e.get_by_role('dialog', name='Clear clipboard?', exact=True)
            expect(dialog).to_contain_text('Do you want to clear your clipboard?')
            return dialog
        def is_red(button):
            return button.evaluate("el=>{const c=getComputedStyle(el).color.match(/\\d+/g).map(Number);return c[0]>180&&c[1]<130&&c[2]<130}")

        # Both cancellation and confirmed clearing leave the note/draft/statuses untouched.
        original = page.evaluate('notes.a.content.text')
        clipboard('SYNTHETIC PRIVATE TEXT')
        more()
        clear = e.get_by_role('button', name='Clear clipboard', exact=True)
        assert is_red(clear)
        clear.click()
        confirmation().get_by_role('button', name='Cancel', exact=True).click()
        assert clipboard() == 'SYNTHETIC PRIVATE TEXT'
        more()
        e.get_by_role('button', name='Clear clipboard', exact=True).click()
        confirmation().get_by_role('button', name='Yes, clear', exact=True).click()
        expect(e.locator('.transfer-notice>span')).to_have_text('Clipboard cleared')
        assert clipboard() == ''
        assert page.evaluate('notes.a.content.text') == original
        expect(field).to_have_value('Preserve this unsent draft')

        # Regular Import has the requested labels, does not clear, and fits narrow screens.
        clipboard(data['cases'][0])
        dialog = import_dialog('not a valid export')
        expect(dialog.get_by_role('button', name='Import', exact=True)).to_be_disabled()
        expect(dialog.get_by_role('button', name='Import and clear clipboard', exact=True)).to_be_disabled()
        dialog.get_by_role('textbox', name='Paste exported messages').fill(data['cases'][0])
        assert dialog.evaluate('el=>el.scrollWidth<=el.clientWidth+1')
        assert is_red(dialog.get_by_role('button', name='Import and clear clipboard', exact=True))
        dialog.get_by_role('button', name='Import', exact=True).click()
        expect(dialog).to_have_count(0)
        expect(e.locator('.message-body').filter(has_text='Imported clipboard case 0')).to_have_count(1)
        assert clipboard() == data['cases'][0]

        # Import-and-clear waits for the host acknowledgment, then asks separately.
        clipboard(data['cases'][1])
        dialog = import_dialog(data['cases'][1])
        page.evaluate('holdAck=true')
        dialog.get_by_role('button', name='Import and clear clipboard', exact=True).click()
        page.wait_for_function('acks.length>0')
        expect(dialog.get_by_role('button', name='Cancel', exact=True)).to_be_disabled()
        expect(e.get_by_role('dialog', name='Clear clipboard?', exact=True)).to_have_count(0)
        assert clipboard() == data['cases'][1]
        page.evaluate('holdAck=false;releaseAcks()')
        confirmation().get_by_role('button', name='Cancel', exact=True).click()
        assert clipboard() == data['cases'][1]
        expect(e.locator('.message-body').filter(has_text='Imported clipboard case 1')).to_have_count(1)
        # An all-duplicate import can clear after confirming the existing note snapshot.
        dialog = import_dialog(data['cases'][1])
        dialog.get_by_role('button', name='Import and clear clipboard', exact=True).click()
        confirmation().get_by_role('button', name='Yes, clear', exact=True).click()
        assert clipboard() == ''
        expect(e.locator('.message-body').filter(has_text='Imported clipboard case 1')).to_have_count(1)

        # A rejected import never offers clearing or discards the source clipboard.
        clipboard(data['cases'][2])
        dialog = import_dialog(data['cases'][2])
        page.evaluate('rejectSaves=true')
        dialog.get_by_role('button', name='Import and clear clipboard', exact=True).click()
        expect(dialog.get_by_role('alert')).to_contain_text('has not confirmed saving')
        expect(e.get_by_role('dialog', name='Clear clipboard?', exact=True)).to_have_count(0)
        assert clipboard() == data['cases'][2]
        assert 'Imported clipboard case 2' not in page.evaluate('notes.a.content.text')
        page.evaluate('rejectSaves=false')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        e.get_by_role('button', name='Retry save', exact=True).click()
        page.wait_for_function('notes.a.content.text.includes("Imported clipboard case 2")')
        assert clipboard() == data['cases'][2]

        # An actual platform refusal is visible, never announced as cleared.
        more()
        e.get_by_role('button', name='Clear clipboard', exact=True).click()
        e.locator('body').evaluate('()=>{window.originalExec=document.execCommand;document.execCommand=()=>false}')
        confirmation().get_by_role('button', name='Yes, clear', exact=True).click()
        expect(confirmation().get_by_role('alert')).to_contain_text('clearing was blocked')
        assert clipboard() == data['cases'][2]
        e.locator('body').evaluate('()=>document.execCommand=originalExec')
        confirmation().get_by_role('button', name='Yes, clear', exact=True).click()
        assert clipboard() == ''
        expect(field).to_have_value('Preserve this unsent draft')
        assert not errors, errors
        print(f'PASS {width}px: real sandboxed clear/cancel, unchanged drafts/statuses, import labels/red buttons, acknowledged import before confirmation, duplicate handling, rejected import retention and clipboard-denial retry', flush=True)
        context.close()
    browser.close()
