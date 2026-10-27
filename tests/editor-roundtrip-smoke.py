"""Real iframe replacement, text-only conversion, plain edits and safe recovery."""
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
MESSAGES=[{'id':'first','text':'First message\nwith a line\n\nand an intentional blank line','createdAt':'2026-01-01T12:00:00Z','reactions':['⭐']},
 {'id':'second','text':'Second message','createdAt':'2026-01-02T12:00:00Z','editedAt':'2026-01-03T12:00:00Z','reactions':['❤️']}]
SETTINGS={'bubbleTheme':'sky','backgroundTheme':'mist','wallpaper':False,'artwork':'classic','scale':1.4,'reactionOrder':['⭐','❤️']}
TEXT='\n'.join(m['text'] for m in MESSAGES)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route(BASE+'/__roundtrip',lambda r:r.fulfill(content_type='text/html',body=HOST))
 page.goto(BASE+'/__roundtrip')
 note={'uuid':'original','content_type':'Note','clientData':{'unrelated':'keep'},'content':{'title':'Original title','text':TEXT,'references':[{'uuid':'other','content_type':'Note'}],'appData':{'other-domain':{'keep':True}},'appendEditorMessageData':MESSAGES,'appendEditorSettings':SETTINGS}}
 page.evaluate('(note)=>{notes.original=note;openIM("original")}',note)
 editor=page.frame_locator('#editor')
 expect(editor.locator('.message-bubble')).to_have_count(2)
 page.wait_for_function('notes.original.clientData?.imStyleEditor?.schemaVersion===2')
 initial=page.evaluate('notes.original');portable=initial['content']['text']
 assert portable.startswith('#!im-style-editor 1\n')
 assert initial['clientData']['imStyleEditor']['messages']==MESSAGES
 assert initial['clientData']['imStyleEditor']['migrationBackup']['text']==TEXT
 assert initial['clientData']['unrelated']=='keep'
 assert initial['content']['appData']['other-domain']['keep'] is True
 initial_saves=page.evaluate('saves.length');page.wait_for_timeout(200)
 assert page.evaluate('saves.length')==initial_saves,'Save echo loop'
 print('PASS: automatic migration embeds records and keeps exact original recovery snapshot')
 for _ in range(10):
  page.evaluate('openPlain()');expect(page.locator('#plain-editor')).to_have_value(portable)
  assert page.evaluate('notes.original.clientData') is None
  page.evaluate('openIM()');expect(editor.locator('.message-bubble')).to_have_count(2)
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.schemaVersion===2')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages')==MESSAGES
  assert page.evaluate('notes.original.clientData.imStyleEditor.settings')==SETTINGS
  assert page.evaluate('notes.original.content.text')==portable
 print('PASS: ten text-only editor conversions preserve boundaries, intentional blank lines, IDs, time, edited time, tags and appearance')
 page.evaluate('openPlain()')
 revised=portable.replace('Second message','Second revised message\n\nStill the same bubble')
 page.locator('#plain-editor').fill(revised);page.evaluate('openIM()')
 expect(editor.locator('.message-bubble')).to_have_count(2)
 expect(editor.get_by_text('Second revised message\n\nStill the same bubble',exact=True)).to_be_visible()
 page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages[1].text.includes("revised")')
 assert page.evaluate('notes.original.clientData.imStyleEditor.messages[1].id')=='second'
 assert page.evaluate('notes.original.clientData.imStyleEditor.messages[1].createdAt')==MESSAGES[1]['createdAt']
 editor.get_by_role('textbox',name='Message',exact=True).fill('A new message after switching')
 editor.get_by_role('button',name='Send message',exact=True).click()
 page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===3')
 assert 'A new message after switching' in page.evaluate('notes.original.content.text')
 print('PASS: edits inside plain records keep multiline bubble boundaries and metadata; sending retains edited text')
 # A fresh note receives only the portable text, no metadata.
 text_only=page.evaluate('notes.original.content.text')
 page.evaluate('(text)=>{notes.copy={uuid:"copy",content_type:"Note",content:{text}};openIM("copy")}',text_only)
 expect(editor.locator('.message-bubble')).to_have_count(3)
 expect(editor.get_by_text('Second revised message\n\nStill the same bubble',exact=True)).to_be_visible()
 page.wait_for_function('notes.copy.clientData?.imStyleEditor?.messages.length===3')
 assert page.evaluate('notes.copy.clientData.imStyleEditor.messages[0].createdAt')==MESSAGES[0]['createdAt']
 print('PASS: plain-text-only export into another note restores messages and tags')
 page.evaluate('(text)=>{notes.badmirror={uuid:"badmirror",content_type:"Note",content:{text},clientData:{imStyleEditor:{schemaVersion:2,messages:null}}};openIM("badmirror")}',text_only)
 expect(editor.locator('.message-bubble')).to_have_count(3)
 page.wait_for_function('notes.badmirror.clientData?.imStyleEditor?.messages?.length===3')
 assert page.evaluate('notes.badmirror.content.text')==text_only
 print('PASS: incomplete hidden metadata is repaired from intact portable text without losing a bubble')
 plain='\n\nParagraph one\nwith a line\r\n\r\nParagraph two\n\nParagraph three\n\n'
 page.evaluate('(text)=>{notes.imported={uuid:"imported",content_type:"Note",content:{text}};openIM("imported")}',plain)
 expect(editor.locator('.message-bubble')).to_have_count(3)
 page.wait_for_function('notes.imported.clientData?.imStyleEditor?.schemaVersion===2')
 assert page.evaluate('notes.imported.clientData.imStyleEditor.migrationBackup.text')==plain
 assert page.evaluate('notes.imported.clientData.imStyleEditor.messages.map(m=>m.text+(m.separatorAfter||"" )).join("")')==plain
 assert page.evaluate('notes.imported.clientData.imStyleEditor.settings.bubbleTheme')=='lime'
 assert page.evaluate('notes.imported.clientData.imStyleEditor.settings.backgroundTheme')=='sand'
 print('PASS: ordinary text imports at blank lines without losing whitespace or inventing times')
 broken=text_only.replace(':::end-bubble','',1)
 page.evaluate('(text)=>{notes.broken={uuid:"broken",content_type:"Note",content:{text}};openIM("broken")}',broken)
 expect(editor.get_by_role('alert')).to_contain_text('Saving is paused')
 expect(editor.get_by_role('textbox',name='Original note text for recovery')).to_have_value(broken)
 expect(editor.get_by_role('textbox',name='Message',exact=True)).to_be_disabled()
 before=page.evaluate('saves.length');page.wait_for_timeout(300)
 assert page.evaluate('saves.length')==before
 assert page.evaluate('notes.broken.content.text')==broken
 page.screenshot(path='/tmp/im-portable-recovery.png')
 print('PASS: damaged record displays complete original text and disables saves without modifying host data')
 page.evaluate('()=>{rejectSaves=true;notes.failed={uuid:"failed",content_type:"Note",content:{text:"Keep this text"}};openIM("failed")}')
 expect(editor.get_by_role('alert')).to_contain_text('Could not save')
 assert page.evaluate('notes.failed.content.text')=='Keep this text'
 page.evaluate('rejectSaves=false');editor.get_by_role('button',name='Retry save',exact=True).click()
 page.wait_for_function('notes.failed.clientData?.imStyleEditor?.schemaVersion===2')
 expect(editor.get_by_role('alert')).to_have_count(0)
 assert 'Keep this text' in page.evaluate('notes.failed.content.text')
 print('PASS: save rejection leaves host original unchanged and offers a working retry')
 assert not errors,errors
 browser.close()
