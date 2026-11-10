"""Synthetic data only. Opaque sandbox, mobile transport, save failures and IM round trips."""
import functools, http.server, json, os, re, subprocess, threading
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright, expect
from browser_engine import chromium_options,fill_field
from mosaic_helpers import fill_search,click_outside_capture,choose_tag,open_more

ROOT=Path(__file__).resolve().parents[1]
IM=Path(os.environ.get('IM_EDITOR_ROOT','/workspace/IM-style-editor'))
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*')
        super().end_headers()
    def translate_path(self,path):
        raw=unquote(urlparse(path).path)
        if raw=='/__host': return str(ROOT/'tests/mosaic-host.html')
        base=IM if raw.startswith('/im/') else ROOT
        relative=raw[4:] if raw.startswith('/im/') else raw.lstrip('/')
        resolved=(base/relative).resolve()
        return str(resolved if resolved.is_relative_to(base) else ROOT/'missing')

def fixture(count=20):
    script=r"""
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});
const count=Number(process.argv[1]);
const messages=Array.from({length:count},(_,i)=>({id:f.newId(),text:`Thought ${i}\n`+'A thought worth keeping. '.repeat(i%11+1),reactions:i%3===0?['📓']:[],createdAt:'2026-11-06T12:00:00Z'}));
if(count){messages[0]={...messages[0],text:'  A title  \r\n\r\nExact body\r\n@@IM:BUBBLE\r\n',custom:{keep:true},edited:true,copied:true,exported:true};}
if(count>1)messages[1].replyTo={id:messages[0].id,text:messages[0].text,noteId:'a'};
const settings={bubbleTheme:'lime',backgroundTheme:'sand',wallpaper:true,artwork:'classic',scale:1.12,reactionOrder:['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'],deletedEmojis:[],pinnedMessageIds:count>2?[messages[1].id]:[],extra:{keep:true}};
const draft='Unsent draft\r\n\r\n  preserved 🙂\r\n';
console.log(JSON.stringify({messages,settings,draft,note:{uuid:'a',content_type:'Note',content:{title:'Synthetic board',text:f.portable(messages,settings,draft),appData:{unrelated:{keep:true}},references:[{uuid:'other'}]},clientData:{other:{keep:true}}}}));
"""
    return json.loads(subprocess.run(['node','-e',script,str(count)],cwd=ROOT,capture_output=True,text=True,check=True).stdout)

def parse(text):
    script="const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});console.log(JSON.stringify(f.inspect(fs.readFileSync(0,'utf8'))));"
    return json.loads(subprocess.run(['node','-e',script],cwd=ROOT,input=text,capture_output=True,text=True,check=True).stdout)

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE='http://127.0.0.1:'+str(server.server_port)
small=fixture();large=fixture(5000);results=[]
try:
  with sync_playwright() as p:
    browser=p.chromium.launch(**chromium_options())
    def setup(width=1100,mobile=False):
        context=browser.new_context(viewport={'width':width,'height':900 if width>650 else 844},is_mobile=mobile,has_touch=mobile)
        context.add_init_script("""
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
writeText:async text=>{if(window.__denyClipboard)throw Error('denied');window.__copied=text;},
readText:async()=>window.__incomingClipboard||''}});
""")
        page=context.new_page();errors=[];external=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda request:external.append(request.url) if not request.url.startswith(BASE+'/') else None)
        page.goto(BASE+'/__host');return context,page,errors,external
    def open_note(page,data=small,path='/mosaic/index.html',mobile=False):
        page.evaluate('([note,path,mobile])=>{notes.a=note;notes.b={uuid:"b",content_type:"Note",content:{title:"Other note",text:""}};openEditor("a",path,mobile)}',[data['note'],path,mobile])
        e=page.frame_locator('#editor');expect(e.locator('#capture-input') if path=='/mosaic/index.html' else e.get_by_role('textbox',name='Message',exact=True)).to_be_visible();return e
    def frame(page):return page.frames[1]
    for width,mobile in [(1100,False),(390,True),(320,True)]:
        context,page,errors,external=setup(width,mobile);e=open_note(page,mobile=mobile)
        expect(e.locator('.card').first).to_be_visible()
        assert page.evaluate('saves.length')==0
        assert page.evaluate('notes.a.content.text')==small['note']['content']['text']
        # Opening and no-op editing preserve CRLF and every metadata field.
        fill_search(e,'A title')
        e.locator('[data-id="'+small['messages'][0]['id']+'"]').click()
        pass
        expect(e.get_by_role('textbox',name='Card title',exact=True)).not_to_be_visible();expect(e.get_by_role('textbox',name='Card body',exact=True)).to_have_js_property('value',small['messages'][0]['text'].replace('\r\n','\n'))
        e.get_by_role('button',name='Close',exact=True).click()
        expect(e.locator('dialog')).not_to_be_visible()
        assert page.evaluate('saves.length')==0
        assert page.evaluate('notes.a.content.text')==small['note']['content']['text']
        fill_search(e,'')

        capture=e.get_by_role('textbox',name='Take a note',exact=True)
        expect(capture).to_have_js_property('value',small['draft'].replace('\r\n','\n'))
        fill_field(capture,'A new thought\nFirst line\n\nSecond line 🙂')
        page.wait_for_function('notes.a.content.text.includes("Second line")')
        before_idle=page.evaluate('saves.length');page.wait_for_timeout(1600);assert page.evaluate('saves.length')==before_idle
        page.evaluate('holdAck=true')
        click_outside_capture(e)
        page.wait_for_function('(notes.a.content.text.match(/^@@IM:BUBBLE$/gm)||[]).length===21&&acks.length>0')
        expect(capture).to_have_js_property('value','A new thought\nFirst line\n\nSecond line 🙂')
        fill_field(capture,'Newer typing survives')
        page.evaluate('holdAck=false;releaseAcks()')
        expect(capture).to_have_js_property('value','Newer typing survives')
        page.wait_for_function('notes.a.content.text.includes("Newer typing survives")')
        parsed=parse(page.evaluate('notes.a.content.text'))
        assert len(parsed['messages'])==21 and 'Newer typing survives' in parsed['draft']
        assert parsed['settings']['extra']=={'keep':True}
        assert parsed['messages'][0]==small['messages'][0]
        assert page.evaluate('notes.a.content.appData.unrelated.keep&&notes.a.clientData.other.keep')

        # Rejected final submissions keep input; retry saves exactly one card.
        page.evaluate('rejectSaves=true')
        fill_field(capture,'Retain on failure')
        click_outside_capture(e)
        expect(e.locator('#notice')).to_contain_text('Saving was not confirmed')
        expect(capture).to_have_js_property('value','Retain on failure')
        page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).last.click()
        expect(capture).to_have_js_property('value','')
        assert len(parse(page.evaluate('notes.a.content.text'))['messages'])==22

        # Filtering and selection cover all matches, and persist only IDs as preferences.
        choose_tag(e,'Filter by 📓')
        e.locator('.card').first.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
        e.get_by_role('button',name='Select all',exact=True).click()
        expect(e.locator('.selection-description')).to_have_text('7 / 22 selected')
        e.get_by_role('button',name='Export selected',exact=True).click()
        copied=frame(page).evaluate('window.__copied')
        payload=json.loads(copied.split('\n',1)[1]);assert len(payload['messages'])==7
        assert all(m['reactions']==['📓'] for m in payload['messages'])
        assert 'Thought' not in json.dumps(page.evaluate('preferences'))
        page.evaluate('switchNote("b")');expect(e.locator('#selection-bar')).not_to_be_visible()
        page.evaluate('switchNote("a")');expect(e.locator('.selection-description')).to_have_text('7 / 22 selected')
        e.get_by_role('button',name='Cancel selection',exact=True).click()
        choose_tag(e,'All tags')
        assert not errors,errors;assert not external,external
        results.append(f'PASS {width}px opaque sandbox, {"mobile JSON" if mobile else "desktop objects"}: no-op format preservation, drafts, idle, late acknowledgments, failed send/retry, filtered export and selection restoration')
        print(results[-1],flush=True)
        page.screenshot(path='/tmp/mosaic-tested-'+str(width)+'.png')
        context.close()

    # Large-board rendering and actual IM-editor switching use the same saved note.
    context,page,errors,external=setup();e=open_note(page,large)
    expect(e.locator('.card').first).to_be_visible();page.wait_for_timeout(100)
    rendered=e.locator('.card').count();dom=e.locator('*').count();assert rendered<80 and dom<1600,(rendered,dom)
    e.locator('#viewport').evaluate('node=>node.scrollTop=node.scrollHeight/2');page.wait_for_timeout(100);assert e.locator('.card').count()<80
    fill_search(e,'Thought 4999');expect(e.locator('.card')).to_have_count(1)
    e.locator('.card').click();fill_field(e.get_by_role('textbox',name='Card body',exact=True),'Changed from Mosaic\nNew body')
    e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
    shared=parse(page.evaluate('notes.a.content.text'));assert shared['messages'][-1]['text'].startswith('Changed from Mosaic\n')
    assert shared['draft']==large['draft'] and shared['settings']['extra']=={'keep':True}
    if IM.exists():
        page.evaluate('openEditor("a","/im/next/index.html")')
        im=page.frame_locator('#editor');expect(im.get_by_role('textbox',name='Message',exact=True)).to_have_js_property('value',large['draft'].replace('\r\n','\n'))
        expect(im.locator('.message-wrap').last).to_contain_text('Changed from Mosaic')
        fill_field(im.get_by_role('textbox',name='Message',exact=True),'Draft changed in IM\nStill preserved')
        page.wait_for_function('notes.a.content.text.includes("Draft changed in IM")')
        page.evaluate('openEditor("a")');e=page.frame_locator('#editor')
        expect(e.locator('#capture-input')).to_have_js_property('value','Draft changed in IM\nStill preserved')
        back=parse(page.evaluate('notes.a.content.text'));assert back['messages']==shared['messages']
        assert back['settings']['extra']=={'keep':True}
        results.append('PASS: Mosaic → shared IM build → Mosaic, same note, card edits and shared drafts survive with message metadata intact')
    results.append(f'PASS: 5,000-card board mounts {rendered} initial previews / {dom} DOM elements; off-screen search and edit work')
    assert not errors,errors;assert not external,external;context.close()

    # Malformed notes, hostile text, remote-content races and metadata-only events.
    context,page,errors,external=setup();e=open_note(page)
    initial=page.evaluate('notes.a.content.text')
    page.evaluate('(text)=>stream({...notes.a,isMetadataUpdate:true,updated_at:"2030-01-01T00:00:00Z",content:{text}})',initial.replace('Unsent draft','Old stale draft'))
    expect(e.locator('#capture-input')).to_have_js_property('value',small['draft'].replace('\r\n','\n'));assert page.evaluate('saves.length')==0
    page.evaluate('holdAck=true')
    fill_field(e.locator('#capture-input'),'Local pending draft')
    page.evaluate('(text)=>stream({...notes.a,content:{...notes.a.content,text}})',initial.replace('Unsent draft','Remote draft'))
    expect(e.locator('#notice')).to_contain_text('neither version is silently overwritten')
    expect(e.locator('#capture-input')).to_have_js_property('value','Local pending draft')
    page.evaluate('holdAck=false;releaseAcks()')
    e.get_by_role('button',name='Review text',exact=True).click()
    expect(e.get_by_role('textbox',name='Current local note text',exact=True)).to_have_value(re.compile('Local pending draft'))
    expect(e.get_by_role('textbox',name='Standard Notes version',exact=True)).to_have_value(re.compile('Remote draft'))
    page.evaluate('(text)=>{notes.bad={uuid:"bad",content_type:"Note",content:{text}};switchNote("bad")}',initial.replace('@@IM:CONTENT','@@BROKEN'))
    expect(e.locator('#notice')).to_contain_text('not a valid format-3 note');expect(e.locator('#capture-input')).to_be_disabled()
    assert page.evaluate('notes.bad.content.text').find('@@BROKEN')>=0
    # A plain note is never converted merely by viewing; markup is rendered literally.
    hostile='<img src="https://example.invalid/leak" onerror="window.pwned=1">\n<script>window.pwned=1</script>'
    page.evaluate('(text)=>{notes.hostile={uuid:"hostile",content_type:"Note",content:{text}};switchNote("hostile")}',hostile)
    expect(e.locator('.card-body')).to_contain_text('<img')
    assert e.locator('img').count()==0 and frame(page).evaluate('window.pwned') is None
    assert page.evaluate('notes.hostile.content.text')==hostile
    assert not errors,errors;assert not external,external
    results.append('PASS: metadata-only events, conflicting remote content, malformed notes, no automatic plain-text conversion, and literal hostile HTML')
    context.close()

    # Card operations and transfer UI, using the same real sandbox protocol.
    context,page,errors,external=setup();e=open_note(page)
    def find_card(index):
        fill_search(e,'A title' if index==0 else 'Thought '+str(index))
        return e.locator('[data-id="'+small['messages'][index]['id']+'"]')
    find_card(2).click(button='right');e.get_by_role('menuitem',name='Pin',exact=True).click()
    parsed=parse(page.evaluate('notes.a.content.text'));assert small['messages'][2]['id'] in parsed['settings']['pinnedMessageIds']
    find_card(2).click(button='right');e.get_by_role('menuitem',name='Unpin',exact=True).click()
    parsed=parse(page.evaluate('notes.a.content.text'));assert small['messages'][2]['id'] not in parsed['settings']['pinnedMessageIds']
    find_card(2).click();e.get_by_role('textbox',name='Card body',exact=True).click(button='right')
    e.get_by_role('button',name='Tag 📍',exact=True).click();e.get_by_role('button',name='Close',exact=True).click()
    expect(e.locator('dialog')).not_to_be_visible();parsed=parse(page.evaluate('notes.a.content.text'))
    assert parsed['messages'][2]['text']==small['messages'][2]['text'] and parsed['messages'][2]['reactions']==['📍'] and not parsed['messages'][2].get('edited')
    find_card(2).click(button='right');e.get_by_role('menuitem',name='Copy',exact=True).click()
    page.wait_for_function('notes.a.content.text.includes("copied")')
    assert frame(page).evaluate('window.__copied')==small['messages'][2]['text']
    assert parse(page.evaluate('notes.a.content.text'))['messages'][2]['copied']
    find_card(2).click();e.locator('dialog').get_by_role('button',name='Card options',exact=True).click();e.get_by_role('menuitem',name='Reply',exact=True).click()
    expect(e.locator('#capture-reply')).to_be_visible();fill_field(e.locator('#capture-input'),'A reply\nReply body');click_outside_capture(e)
    expect(e.locator('#capture-input')).to_have_js_property('value','')
    parsed=parse(page.evaluate('notes.a.content.text'));assert parsed['messages'][-1]['replyTo']['id']==small['messages'][2]['id'] and not parsed['reply']

    # IM-style selection hides search controls; choose the broad filter first.
    fill_search(e,'Thought')
    e.locator('#viewport').evaluate('n=>n.scrollTop=n.scrollHeight')
    e.locator('[data-id="'+small['messages'][4]['id']+'"]').click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
    e.locator('[data-id="'+small['messages'][5]['id']+'"]').click();e.get_by_role('button',name='Selection options',exact=True).click();e.get_by_role('menuitem',name='Merge selected',exact=True).click()
    expect(e.get_by_role('textbox',name='Merged card preview',exact=True)).to_have_js_property('value',small['messages'][4]['text']+'\n\n'+small['messages'][5]['text'])
    e.get_by_role('button',name='Merge selected',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
    parsed=parse(page.evaluate('notes.a.content.text'));combined=next(m for m in parsed['messages'] if m['id']==small['messages'][4]['id'])
    assert combined['edited'] and combined['text']==small['messages'][4]['text']+'\n\n'+small['messages'][5]['text']
    e.get_by_role('button',name='Copy selected',exact=True).click();e.get_by_role('button',name='Selection options',exact=True).click()
    e.get_by_role('menuitem',name='Clear message statuses',exact=True).click();e.get_by_role('checkbox',name='Copied',exact=True).check()
    e.get_by_role('button',name='Clear selected statuses',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
    parsed=parse(page.evaluate('notes.a.content.text'));assert not next(m for m in parsed['messages'] if m['id']==combined['id']).get('copied')
    e.get_by_role('button',name='Delete selected',exact=True).click();e.get_by_role('button',name='Cancel',exact=True).click()
    assert len(parse(page.evaluate('notes.a.content.text'))['messages'])==20
    e.get_by_role('button',name='Cancel selection',exact=True).click()
    fill_search(e,'');open_more(e);e.get_by_role('menuitem',name='Export all cards',exact=True).click()
    exported=frame(page).evaluate('window.__copied');assert exported.startswith('#!im-style-forward 2')
    page.evaluate('switchNote("b")');open_more(e);e.get_by_role('menuitem',name='Import from clipboard',exact=True).click()
    fill_field(e.get_by_role('textbox',name='Import text',exact=True),exported);e.get_by_role('button',name='Import',exact=True).click();expect(e.locator('dialog')).not_to_be_visible()
    parsed=parse(page.evaluate('notes.b.content.text'));assert len(parsed['messages'])==20 and all(m.get('forwarding') and not m.get('exported') for m in parsed['messages'])
    open_more(e);e.get_by_role('menuitem',name='Import from clipboard',exact=True).click()
    fill_field(e.get_by_role('textbox',name='Import text',exact=True),exported);page.evaluate('holdAck=true')
    e.get_by_role('button',name='Import and clear clipboard',exact=True).click()
    # An identical, previously acknowledged import may skip writing altogether.
    page.evaluate('holdAck=false;releaseAcks()');expect(e.locator('#dialog-title')).to_have_text('Clear your clipboard?')
    e.get_by_role('button',name='Cancel',exact=True).click();assert len(parse(page.evaluate('notes.b.content.text'))['messages'])==20
    frame(page).evaluate('document.execCommand=()=>false;window.__denyClipboard=false')
    open_more(e);e.get_by_role('menuitem',name='Clear clipboard',exact=True).click()
    e.get_by_role('button',name='Clear clipboard',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();assert frame(page).evaluate('window.__copied')==''
    frame(page).evaluate('window.__denyClipboard=true')
    fill_search(e,'Thought 7');e.locator('.card').click(button='right');e.get_by_role('menuitem',name='Copy',exact=True).click()
    expect(e.get_by_role('textbox',name='Text to copy',exact=True)).to_be_visible()
    assert e.get_by_role('textbox',name='Text to copy',exact=True).evaluate('node=>getComputedStyle(node).backdropFilter')=='none'
    assert not next(m for m in parse(page.evaluate('notes.b.content.text'))['messages'] if m['id']==small['messages'][7]['id']).get('copied')
    assert not errors,errors;assert not external,external
    results.append('PASS: pin/unpin, tag-only edits, clipboard-confirmed statuses, replies, merge/status clearing, cancelled deletion, export/import/deduplication, manual clipboard clearing and solid manual-copy fallback')
    context.close()
    context,page,errors,external=setup(390,True);e=open_note(page)
    field=e.locator('#capture-input');field.focus()
    field.evaluate("node=>{node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));node.value='中文未完成';node.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));}")
    click_outside_capture(e);assert len(parse(page.evaluate('notes.a.content.text'))['messages'])==20
    field.evaluate("node=>{node.value='中文已完成';node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'已完成'}));node.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:false}));}")
    expect(field).to_have_js_property('value','');parsed=parse(page.evaluate('notes.a.content.text'))
    assert len(parsed['messages'])==21 and parsed['messages'][-1]['text']=='中文已完成'
    assert not errors,errors;assert not external,external
    results.append('PASS: click-outside waits for completed IME composition, submits once, and preserves the final Chinese text')
    context.close();browser.close()
  print('\n'.join(results))
finally:server.shutdown()
