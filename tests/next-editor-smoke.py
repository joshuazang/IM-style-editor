"""Synthetic notes only: independent plugins, shared message transfer and windowed navigation."""
import json, os, re, statistics, subprocess
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8010').rstrip('/')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace(
    "editor.src = '/index.html';", "editor.src = window.editorPath || '/index.html';"
).replace('saves.push(structuredClone(item));','saves.length=0;saves.push(structuredClone(item));')
JS="""
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const f=vm.runInNewContext(fs.readFileSync(input.source,'utf8')+';imFormat',{crypto,btoa});
const messages=Array.from({length:input.count},(_,i)=>({id:f.newId(),text:`Message ${i}: `+'A thought worth keeping. '.repeat(i%17===0?25:4),createdAt:'2026-11-01T12:00:00Z',reactions:i%3===0?['⭐']:[]}));
const settings={reactionOrder:['⭐','📍'],deletedEmojis:[],pinnedMessageIds:messages.length>50?[messages[50].id,messages.at(-3).id]:[]};
const reply=input.reply?{id:messages[50].id,text:messages[50].text,noteId:'large'}:null;
console.log(JSON.stringify({messages,text:f.portable(messages,settings,'',reply)}));
"""
def fixture(source,count,reply=False):
    return json.loads(subprocess.run(['node','-e',JS],input=json.dumps(dict(source=source,count=count,reply=reply)),capture_output=True,text=True,check=True).stdout)

small=fixture('src/note-format.js',30)
large=fixture('next/src/note-format.js',5000,True)
html=Path('next/index.html').read_text()
bundle='next/'+re.search(r'src="\./([^"?]+\.js)',html)[1]
script=Path(bundle).read_text().replace('function parseDocument(text) {','function parseDocument(text) {window.__fullParses=(window.__fullParses||0)+1;')
script=script.replace('    validateMessages(messages);\n    const lines=[];','    window.__bubbleEncodes=(window.__bubbleEncodes||0)+1;validateMessages(messages);\n    const lines=[];')
assert json.loads(Path('im-style-editor.ext.json').read_text())['identifier']!=json.loads(Path('im-style-editor-next.ext.json').read_text())['identifier']

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
    page=browser.new_page(viewport={'width':900,'height':850})
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{parent.testClipboard=text},readText:async()=>parent.testClipboard||''}})")
    page.route(BASE+'/__next',lambda route:route.fulfill(content_type='text/html',body=HOST))
    page.route(BASE+'/'+bundle,lambda route:route.fulfill(content_type='text/javascript',body=script))
    page.goto(BASE+'/__next')
    page.evaluate('(text)=>{notes.old={uuid:"old",content_type:"Note",content:{title:"Archive",text}};openIM("old")}',small['text'])
    e=page.frame_locator('#editor')
    expect(e.locator('.message-wrap')).to_have_count(30)
    e.locator('.message-wrap').last.click(button='right')
    e.get_by_role('menuitem',name='Select',exact=True).click()
    e.get_by_role('button',name='Select all visible messages').click()
    expect(e.locator('.selection-status')).to_contain_text('30 messages selected')
    e.get_by_role('button',name='Export',exact=True).click()
    page.wait_for_function('testClipboard?.startsWith("#!im-style-forward 2")')
    original_export=page.evaluate('testClipboard')
    page.evaluate('()=>{editorPath="/next/index.html";notes.new={uuid:"new",content_type:"Note",content:{title:"New",text:""}};openIM("new")}')
    field=e.get_by_role('textbox',name='Message',exact=True)
    expect(field).to_be_visible()
    e.get_by_role('button',name='More options',exact=True).click()
    e.get_by_role('button',name='Import from clipboard',exact=True).click()
    expect(e.get_by_role('dialog')).to_contain_text('30 messages ready to import')
    e.get_by_role('button',name='Import messages',exact=True).click()
    expect(e.get_by_role('dialog')).to_have_count(0)
    page.wait_for_function('notes.new.content.text.includes("Message 29:")')
    assert page.evaluate('notes.new.content.text').startswith('#!im-style-editor 3\n')
    assert not page.evaluate('Object.hasOwn(notes.new.content,"appendEditorMessageData")')
    assert not page.evaluate('!!notes.new.clientData?.imStyleEditor')
    expect(e.locator('.forwarded-label').first).to_have_text('↪ Imported')
    assert not e.locator('.message-meta').filter(has_text='Exported').count()
    field.fill('Unsent draft\n\n  preserved 🙂')
    page.wait_for_function('notes.new.content.text.includes("Unsent draft")')
    page.evaluate('openIM("new")')
    expect(field).to_have_value('Unsent draft\n\n  preserved 🙂')
    print('PASS: separate Archive/new plugins; existing message Export imports; metadata, Imported status and draft refresh work',flush=True)

    page.evaluate('rejectSaves=true')
    field.fill('Keep after failed save')
    expect(e.get_by_role('alert')).to_contain_text('Could not save')
    assert 'Keep after failed save' not in page.evaluate('notes.new.content.text')
    page.evaluate('rejectSaves=false')
    e.get_by_role('button',name='Retry save',exact=True).click()
    page.wait_for_function('notes.new.content.text.includes("Keep after failed save")')
    expect(e.get_by_role('alert')).to_have_count(0)
    print('PASS: rejected save retains draft and retry persists it',flush=True)

    page.evaluate('openIM("old")')
    expect(e.get_by_role('alert')).to_contain_text('Saving is paused')
    old_after=page.evaluate('notes.old.content.text')
    assert old_after.startswith('#!im-style-editor 2\n')
    page.evaluate('()=>{editorPath="/index.html";openIM("new")}')
    expect(e.get_by_role('alert')).to_contain_text('Saving is paused')
    assert page.evaluate('notes.new.content.text').startswith('#!im-style-editor 3\n')
    print('PASS: incompatible note formats stay read-only in the other plugin; source notes remain intact',flush=True)

    page.evaluate('(text)=>{editorPath="/next/index.html";notes.large={uuid:"large",content_type:"Note",content:{text}};openIM("large")}',large['text'])
    expect(field).to_be_visible();expect(e.locator('.message-wrap').last).to_contain_text('Message 4999:')
    page.wait_for_timeout(400)
    assert e.locator('.message-wrap').count()<100
    rows=e.locator('.message-wrap').count();dom=e.locator('*').count()
    # Prime the single cached bubble serialization, then measure repeated draft-only changes.
    field.fill('Prime draft cache');page.wait_for_function('notes.large.content.text.includes("Prime draft cache")')
    samples=[]
    for i in range(5):
        value=f'Measured draft {i}'
        samples.append(field.evaluate('''(el,value)=>new Promise(resolve=>{
          const parses=window.__fullParses||0,encodes=window.__bubbleEncodes||0,start=performance.now();
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);
          el.dispatchEvent(new Event('input',{bubbles:true}));
          requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({ms:performance.now()-start,parses:(window.__fullParses||0)-parses,encodes:(window.__bubbleEncodes||0)-encodes})))
        })''',value))
        page.wait_for_function('(value)=>notes.large.content.text.includes(value)',arg=value)
    assert all(sample['parses']==0 and sample['encodes']==0 for sample in samples),samples
    print(json.dumps({'bubbles':5000,'rendered_bubbles':rows,'elements':dom,'median_input_two_frames_ms':round(statistics.median(s['ms'] for s in samples),1),'samples':samples,'saved_note_KiB':round(page.evaluate('JSON.stringify(notes.large).length/1024'))}),flush=True)
    e.get_by_role('button',name='Reply options',exact=True).click()
    e.get_by_role('menuitem',name='Show in Chat',exact=True).click()
    target=e.locator('[data-message-id="'+large['messages'][50]['id']+'"]')
    expect(target).to_be_visible();expect(target).to_have_class(re.compile('reply-located'))
    page.wait_for_timeout(300)
    # Resize while reading older messages: preserve the visible record, not its obsolete pixel offset.
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(400)
    expect(target).to_be_visible()
    e.get_by_role('button',name='Show pinned message',exact=True).click()
    pinned=e.locator('[data-message-id="'+large['messages'][-3]['id']+'"]')
    expect(pinned).to_be_visible();expect(pinned).to_have_class(re.compile('reply-located'))
    e.get_by_role('button',name='Show all 2 pinned messages',exact=True).click()
    expect(e.locator('.message-wrap')).to_have_count(2)
    e.get_by_role('button',name='Show pinned message in full note').first.click()
    expect(e.locator('[data-message-id="'+large['messages'][50]['id']+'"]')).to_be_visible()
    for _ in range(3):
        e.get_by_role('button',name='Show all 2 pinned messages',exact=True).click()
        expect(e.locator('.message-wrap')).to_have_count(2)
        e.get_by_role('button',name='Show pinned message in full note').first.click()
        expect(e.locator('[data-message-id="'+large['messages'][50]['id']+'"]')).to_be_visible()
    print('PASS: off-screen reply/pin navigation, resize anchoring and pinned-view return',flush=True)

    e.get_by_role('button',name='Search and tags',exact=True).click()
    e.get_by_role('button',name=re.compile('^⭐ ')).click()
    page.wait_for_timeout(300)
    e.locator('.message-wrap').first.click(button='right')
    e.get_by_role('menuitem',name='Select',exact=True).click()
    e.get_by_role('button',name='Select all visible messages',exact=True).click()
    expect(e.locator('.selection-status')).to_contain_text('1667 / 5000 selected')
    assert e.locator('.message-wrap').count()<100
    e.get_by_role('button',name='Export',exact=True).click()
    page.wait_for_function('JSON.parse(testClipboard.slice(testClipboard.indexOf("\\n")+1)).messages.length===1667')
    transferred=json.loads(page.evaluate('testClipboard').split('\n',1)[1])
    assert all(message['reactions']==['⭐'] for message in transferred['messages'])
    e.get_by_role('button',name='Cancel',exact=True).click()
    print('PASS: filtered Select all/Export includes off-screen matching records, never unmatched records',flush=True)
    page.screenshot(path='/tmp/im-next-4.0.0.png')
    assert not errors,errors
    page.close()
    # Touch-sized viewport checks do not emulate the operating system's native keyboard.
    mobile=fixture('next/src/note-format.js',300)
    delayed=HOST.replace('window.rejectSaves = false;', 'window.rejectSaves=false;window.rejectSend=false;window.holdAck=false;window.acks=[];window.releaseAcks=()=>acks.splice(0).forEach(fn=>fn());')
    delayed=delayed.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, location.origin);",
        "const target=event.source;const reply=data=>{const send=()=>target.postMessage({action:'reply',original:message,data},location.origin);if(holdAck&&message.action==='save-items')acks.push(send);else send()};")
    delayed=delayed.replace('if (rejectSaves) {', "if(rejectSaves||(rejectSend&&(message.data.items[0].content.text.match(/^@@IM:BUBBLE$/gm)||[]).length>300)){")
    for width in [320,390]:
        page=browser.new_page(viewport={'width':width,'height':844},is_mobile=True,has_touch=True)
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.route(BASE+'/__mobile_next',lambda route:route.fulfill(content_type='text/html',body=delayed))
        page.goto(BASE+'/__mobile_next')
        page.evaluate('(text)=>{editorPath="/next/index.html";notes.a={uuid:"a",content_type:"Note",content:{text}};notes.b={uuid:"b",content_type:"Note",content:{text:""}};openIM("a")}',mobile['text'])
        e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message',exact=True);log=e.get_by_role('log')
        expect(field).to_be_visible();expect(e.locator('.message-wrap').last).to_contain_text('Message 299:')
        field.fill('Unsent phone draft');field.focus()
        for height in [500,650,844]:
            page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200)
            expect(field).to_be_focused()
            assert log.evaluate('el=>el.scrollHeight-el.clientHeight-el.scrollTop')<2
            last=e.locator('.message-bubble').last.bounding_box();input_box=field.bounding_box()
            assert 0<=input_box['y']-last['y']-last['height']<=32
        page.evaluate('holdAck=true')
        field.fill('First pending A');field.fill('Final pending A')
        page.evaluate('()=>{activeUuid="b";editor.contentWindow.postMessage({action:"reply",original:subscription,data:{item:structuredClone(notes.b)}},location.origin)}')
        expect(field).to_have_value('');field.fill('Pending B')
        page.evaluate('holdAck=false;releaseAcks()')
        page.wait_for_function('notes.a.content.text.includes("Final pending A")&&notes.b.content.text.includes("Pending B")')
        page.evaluate('()=>{activeUuid="a";editor.contentWindow.postMessage({action:"reply",original:subscription,data:{item:structuredClone(notes.a)}},location.origin)}')
        expect(field).to_have_value('Final pending A')
        page.evaluate('rejectSend=true');field.fill('Failed send draft')
        page.wait_for_function('notes.a.content.text.includes("Failed send draft")')
        e.get_by_role('button',name='Send message',exact=True).click()
        expect(e.get_by_role('alert')).to_contain_text('Could not save');expect(field).to_have_value('Failed send draft')
        assert page.evaluate('(notes.a.content.text.match(/^@@IM:BUBBLE$/gm)||[]).length')==300
        page.evaluate('openIM("a")');expect(field).to_have_value('Failed send draft')
        page.evaluate('rejectSend=false;holdAck=true');e.get_by_role('button',name='Send message',exact=True).click()
        page.wait_for_function('acks.length>0');expect(field).to_have_value('Failed send draft')
        page.evaluate('releaseAcks()')
        page.wait_for_function('(notes.a.content.text.match(/^@@IM:BUBBLE$/gm)||[]).length===301&&acks.length>0')
        expect(field).to_have_value('Failed send draft')
        page.evaluate('holdAck=false;releaseAcks()');expect(field).to_have_value('');expect(field).to_be_focused()
        expect(e.locator('.message-wrap').last).to_contain_text('Failed send draft')
        assert not errors,errors
        print(f'PASS touch viewport {width}: latest bubble clears composer, per-note delayed drafts survive switches, failed sends preserve drafts, input clears only after acknowledgment',flush=True)
        page.close()
    browser.close()
