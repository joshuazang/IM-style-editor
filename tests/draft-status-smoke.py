"""Per-note drafts, statuses, old fields, acknowledged sending and bottom opening."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import fixture_messages,prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
HOST=HOST.replace('window.rejectSaves = false;', '''window.rejectSaves = false;window.holdAck=false;window.acks=[];window.rejectSend=false;
window.releaseAcks=()=>{const callbacks=acks.splice(0);callbacks.forEach(fn=>fn())};''')
HOST=HOST.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, location.origin);", "const reply=data=>{const target=event.source;const send=()=>target.postMessage({action:'reply',original:message,data},location.origin);if(holdAck&&message.action==='save-items')acks.push(send);else send()};")
HOST=HOST.replace('if (rejectSaves) {', "if (rejectSaves||(rejectSend&&message.data.items[0].clientData?.imStyleEditor?.messages.some(m=>m.text==='Failed send text'))) {")
records=fixture_messages([dict(id=str(i),text=f'Message {i}',createdAt='2026-10-27T12:00:00Z',reactions=['⭐'] if i==3 else [],**({'editedAt':'2020-01-01T00:00:00Z'} if i==2 else {})) for i in range(40)])
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':records}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},has_touch=width<600,is_mobile=width<600,permissions=['clipboard-read','clipboard-write'])
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__draft_status',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__draft_status');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');field=e.get_by_role('textbox',name='Message',exact=True)
  expect(rows).to_have_count(40)
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages[2].edited===true')
  page.wait_for_function('()=>{const s=editor.contentDocument.querySelector(".messages");return s.scrollHeight-s.clientHeight-s.scrollTop<2}')
  assert 'editedAt' not in page.evaluate('notes.original.clientData.imStyleEditor.messages[2]')
  assert '\nedited\n' in page.evaluate('notes.original.content.text')
  def menu(index=3):
   rows.nth(index).click(button='right');expect(e.get_by_role('menu')).to_be_visible()
  def saved_draft(text,uuid='original'):
   page.wait_for_function('({text,uuid})=>(notes[uuid].clientData?.imStyleEditor?.draft??"")===text',arg={'text':text,'uuid':uuid})
  def current_message():return page.evaluate('notes.original.clientData.imStyleEditor.messages[3]')
  menu();e.get_by_role('menuitem',name='Copy',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[3].copied===true')
  original=current_message();stored=page.evaluate('notes.original.content.text');before=page.evaluate('saves.length')
  menu();e.get_by_role('menuitem',name='Edit',exact=True).click()
  e.get_by_role('button',name='Save changes',exact=True).click();expect(field).to_be_visible()
  assert current_message()==original and page.evaluate('notes.original.content.text')==stored and page.evaluate('saves.length')==before
  menu();e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Export',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[3].exported===true')
  meta=rows.nth(3).locator('.message-meta');expect(meta).to_contain_text('Copied · Exported ·')
  e.get_by_role('button',name='Cancel',exact=True).click();menu();e.get_by_role('menuitem',name='Edit',exact=True).click()
  edit=e.get_by_role('textbox',name='Edit message',exact=True);edit.fill('Actually revised');e.get_by_role('button',name='Save changes',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[3].edited===true')
  changed=current_message();assert changed['text']=='Actually revised' and changed['createdAt']==original['createdAt']
  assert 'copied' not in changed and 'exported' not in changed and 'editedAt' not in changed
  expect(meta).to_contain_text('edited');expect(meta).not_to_contain_text('Copied')
  # A late clipboard completion must not mark a newer revision.
  e.locator('body').evaluate("""()=>{window.realClipboard=navigator.clipboard;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(resolve=>window.finishCopy=resolve)}})}""")
  menu();e.get_by_role('menuitem',name='Copy',exact=True).click()
  menu();e.get_by_role('menuitem',name='Edit',exact=True).click()
  e.get_by_role('textbox',name='Edit message',exact=True).fill('Changed during clipboard operation')
  e.get_by_role('button',name='Save changes',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[3].text==="Changed during clipboard operation"')
  e.locator('body').evaluate('()=>finishCopy()');expect(e.locator('.transfer-notice')).to_contain_text('Copied')
  assert 'copied' not in current_message()
  # Opening the fallback does not mark Exported; explicit successful manual copy does.
  e.locator('body').evaluate("""()=>{window.realExec=document.execCommand.bind(document);document.execCommand=()=>false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}})}""")
  menu();e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Export',exact=True).click()
  dialog=e.get_by_role('dialog');expect(dialog).to_be_visible();assert 'exported' not in current_message()
  assert 'exportedAt' not in dialog.get_by_role('textbox',name='Message export').input_value()
  e.locator('body').evaluate('()=>document.execCommand=realExec')
  dialog.get_by_role('button',name='Select and copy',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[3].exported===true')
  dialog.get_by_role('button',name='Close',exact=True).click();e.get_by_role('button',name='Cancel',exact=True).click()
  e.locator('body').evaluate("()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:realClipboard})")
  draft='\n\nUnsent 中文 🙂\r\n  spaces\n@@IM:END-DRAFT\n\\literal\n\n'
  field.fill(draft);draft=field.input_value();saved_draft(draft)
  raw=page.evaluate('notes.original.content.text')
  assert raw.index('@@IM:END-SETTINGS')<raw.index('@@IM:DRAFT')<raw.index('@@IM:BUBBLE')
  page.evaluate('openIM()');expect(field).to_have_value(draft);expect(rows).to_have_count(40)
  page.wait_for_function('()=>{const s=editor.contentDocument.querySelector(".messages");return s.scrollHeight-s.clientHeight-s.scrollTop<2}')
  page.evaluate('openPlain()');expect(page.locator('#plain-editor')).to_have_value(raw)
  page.locator('#plain-editor').fill(raw.replace('Unsent 中文','Changed draft 中文'));page.evaluate('openIM()')
  draft=draft.replace('Unsent 中文','Changed draft 中文');expect(field).to_have_value(draft)
  saved_draft(draft)
  # Different notes restore their own drafts. A live switch exercises the same iframe.
  page.evaluate('()=>{notes.other={uuid:"other",content_type:"Note",content:{text:"Another note"}};activeUuid="other";editor.contentWindow.postMessage({action:"reply",original:subscription,data:{item:structuredClone(notes.other)}},location.origin)}')
  expect(field).to_have_value('');field.fill('Other note draft');saved_draft('Other note draft','other')
  page.evaluate('()=>{activeUuid="original";editor.contentWindow.postMessage({action:"reply",original:subscription,data:{item:structuredClone(notes.original)}},location.origin)}')
  expect(field).to_have_value(draft)
  # Rapid writes with delayed acknowledgments must settle to the latest draft.
  page.evaluate('holdAck=true');field.fill('First pending draft');field.fill('Newest pending draft');field.fill('Final pending draft')
  page.wait_for_function('acks.length>0');page.evaluate('holdAck=false;releaseAcks()');saved_draft('Final pending draft')
  page.evaluate('openIM()');expect(field).to_have_value('Final pending draft')
  # Rejecting the send retains the acknowledged draft for a refresh.
  page.evaluate('rejectSend=true');field.fill('Failed send text');saved_draft('Failed send text')
  e.get_by_role('button',name='Send message',exact=True).click()
  expect(e.get_by_role('alert')).to_contain_text('Could not save');expect(field).to_have_value('Failed send text')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages.length')==40
  page.evaluate('openIM()');expect(field).to_have_value('Failed send text');expect(rows).to_have_count(40)
  # Sending is atomic; the input clears only after acknowledgment.
  page.evaluate('rejectSend=false;holdAck=true');e.get_by_role('button',name='Send message',exact=True).click()
  page.wait_for_function('acks.length>0');expect(field).to_have_value('Failed send text')
  page.evaluate('releaseAcks()');page.wait_for_function('notes.original.clientData.imStyleEditor.messages.length===41 && acks.length>0')
  expect(field).to_have_value('Failed send text')
  page.evaluate('holdAck=false;releaseAcks()');expect(field).to_have_value('');saved_draft('')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages.filter(m=>m.text==="Failed send text").length')==1
  assert '@@IM:DRAFT' not in page.evaluate('notes.original.content.text')
  field.fill(' \n\t ');saved_draft(' \n\t ');page.evaluate('openIM()');expect(field).to_have_value(' \n\t ')
  # Retry can complete a failed send without a refresh or a duplicate bubble.
  page.evaluate('()=>{notes.retry={uuid:"retry",content_type:"Note",content:{text:""}};openIM("retry")}')
  expect(field).to_be_enabled();field.fill('Failed send text')
  page.wait_for_function('notes.retry.clientData?.imStyleEditor?.draft==="Failed send text"')
  page.evaluate('rejectSend=true');e.get_by_role('button',name='Send message',exact=True).click()
  expect(e.get_by_role('alert')).to_contain_text('Could not save');expect(field).to_have_value('Failed send text')
  page.evaluate('rejectSend=false');e.get_by_role('button',name='Retry save',exact=True).click()
  page.wait_for_function('notes.retry.clientData?.imStyleEditor?.messages.length===1');expect(field).to_have_value('')
  assert not errors,errors
  print('PASS',width,'old edit field; no-op edit; copied/exported flags and reset; exact drafts through reload/plain conversion/note switches; delayed saves; failed/acknowledged sends; newest messages on open')
  c.close()
 b.close()
