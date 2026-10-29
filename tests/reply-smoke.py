"""Reply previews, navigation, clipboard, persistence and exact quote rendering."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import fixture_messages,prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
HOST=HOST.replace('window.rejectSaves = false;', 'window.rejectSaves = false;window.holdAck=false;window.acks=[];window.releaseAcks=()=>{acks.splice(0).forEach(fn=>fn())};')
HOST=HOST.replace("const reply = data => editor.contentWindow.postMessage({action: 'reply', original: message, data}, location.origin);", "const reply=data=>{const target=event.source,send=()=>target.postMessage({action:'reply',original:message,data},location.origin);if(holdAck&&message.action==='save-items')acks.push(send);else send()};")

records=fixture_messages([dict(id=str(i),text=f'Message {i} <b>literal</b>',createdAt='2026-10-28T12:00:00Z',reactions=['⭐'] if i==3 else []) for i in range(45)])
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorMessageData':records}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},has_touch=width<600,is_mobile=width<600,permissions=['clipboard-read','clipboard-write'])
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__reply',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__reply');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');field=e.get_by_role('textbox',name='Message',exact=True)
  expect(rows).to_have_count(45)
  def menu(index):
   rows.nth(index).click(button='right');expect(e.locator('.context-menu')).to_be_visible()
  def options():e.get_by_role('button',name='Reply options',exact=True).click();expect(e.locator('.reply-options')).to_be_visible()
  def top():return e.locator('.messages').evaluate('(s)=>s.scrollTop')
  menu(15);e.get_by_role('menuitem',name='Reply',exact=True).click()
  expect(e.locator('.reply-quote-text')).to_have_text(records[15]['text']);expect(field).to_be_focused()
  expect(e.locator('.composer-reply-preview strong')).to_have_text('Reply to message');assert e.locator('.composer-reply-preview>svg').count()==0
  reply_preview_height=e.locator('.composer-reply-preview').bounding_box()['height']
  cancel=e.get_by_role('button',name='Cancel reply',exact=True);assert abs(cancel.bounding_box()['width']-39.6)<.1;assert cancel.locator('svg').get_attribute('width')=='22'
  assert cancel.evaluate('(n)=>getComputedStyle(n).color')=='rgb(217, 80, 73)'
  assert e.locator('.reply-preview-trigger').evaluate('(n)=>getComputedStyle(n).backgroundColor') not in ['transparent','rgba(0, 0, 0, 0)']
  assert e.locator('.reply-quote-text b').count()==0
  field.fill('My draft reply\nsecond line')
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.reply?.id===notes.original.clientData.imStyleEditor.messages[15].id')
  page.evaluate('openPlain()');raw=page.locator('#plain-editor').input_value();assert '@@IM:REPLY' in raw and 'reply-to:' not in raw
  page.evaluate('openIM()');expect(field).to_have_value('My draft reply\nsecond line');expect(e.locator('.reply-quote-text')).to_have_text(records[15]['text'])
  # Visible originals do not cause scrolling; hidden ones center and highlight.
  options();e.get_by_role('menuitem',name='Show in Chat',exact=True).click()
  expect(e.locator('.reply-options')).to_have_count(0);expect(rows.nth(15)).to_have_class(__import__('re').compile('reply-located'))
  page.wait_for_timeout(1000);position=top();options();e.get_by_role('menuitem',name='Show in Chat',exact=True).click();page.wait_for_timeout(1000)
  assert abs(top()-position)<2,(position,top(),rows.nth(15).bounding_box())
  e.get_by_role('button',name='Scroll to bottom',exact=True).click();page.wait_for_timeout(450)
  options();e.get_by_role('menuitem',name='Show in Chat',exact=True).click();page.wait_for_timeout(1100)
  geometry=rows.nth(15).evaluate('(n)=>{const c=document.querySelector(".composer").getBoundingClientRect(),t=document.querySelector(".message-tools").getBoundingClientRect(),r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,center:(r.top+r.bottom)/2,expected:(c.top+t.bottom)/2}}')
  assert abs(geometry['center']-geometry['expected'])<35,geometry
  page.screenshot(path=f'/tmp/reply-preview-{width}.png');options();page.screenshot(path=f'/tmp/reply-options-{width}.png');e.get_by_role('button',name='Reply options',exact=True).click()
  # Entering selection with an active reply keeps the viewport and input-row height.
  before=e.locator('.composer').bounding_box();before_top=top();menu(15);e.get_by_role('menuitem',name='Select',exact=True).click()
  after=e.locator('.composer').bounding_box();assert abs(before['height']-after['height'])<1,(before,after)
  assert abs(top()-before_top)<2,(before_top,top())
  assert e.locator('.selection-status>span').bounding_box()['height']==46
  e.get_by_role('button',name='Cancel',exact=True).click();expect(e.locator('.composer-reply-preview')).to_be_visible();expect(field).to_have_value('My draft reply\nsecond line')
  # Cancel preserves typed draft; menu action also cancels without sending.
  e.get_by_role('button',name='Cancel reply',exact=True).click();expect(e.locator('.composer-reply-preview')).to_have_count(0);expect(field).to_have_value('My draft reply\nsecond line')
  menu(15);e.get_by_role('menuitem',name='Edit',exact=True).click();expect(e.locator('.composer-edit-preview strong')).to_have_text('Edit message')
  assert abs(e.locator('.composer-edit-preview').bounding_box()['height']-reply_preview_height)<1
  e.get_by_role('button',name='Cancel editing',exact=True).click()
  menu(15);e.get_by_role('menuitem',name='Reply',exact=True).click();options();e.get_by_role('menuitem',name='Do Not Reply',exact=True).click();expect(e.locator('.composer-reply-preview')).to_have_count(0)
  # Another-chat action exports the source and immediately marks Exported, no paste required.
  menu(15);e.get_by_role('menuitem',name='Reply',exact=True).click();options();e.get_by_role('menuitem',name='Reply in Another Chat',exact=True).click()
  expect(e.locator('.transfer-notice')).to_contain_text('Open another note')
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[15].exported===true')
  clipboard=page.evaluate('navigator.clipboard.readText()');assert records[15]['id'] in clipboard and records[15]['text'] in clipboard
  # A reply is sent with the quote; the pending reply and draft clear only on success.
  e.get_by_role('button',name='Send message',exact=True).click();expect(rows).to_have_count(46);expect(field).to_have_value('');expect(e.locator('.composer-reply-preview')).to_have_count(0)
  quote=rows.last.get_by_role('button',name='Show quoted message in chat',exact=True);expect(quote).to_contain_text(records[15]['text'])
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages.length===46 && !notes.original.clientData.imStyleEditor.reply')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages[45].replyTo.id')==records[15]['id']
  quote.click();page.wait_for_timeout(450);expect(rows.nth(15)).to_have_class(__import__('re').compile('reply-located'))
  # Filtered source is revealed on navigation.
  e.get_by_role('button',name='Search and tags',exact=True).click();search=e.get_by_role('textbox',name='Search messages',exact=True);search.fill('My draft reply');expect(rows).to_have_count(1);e.get_by_role('button',name='Search and tags',exact=True).click()
  rows.last.get_by_role('button',name='Show quoted message in chat',exact=True).click();expect(rows).to_have_count(46)
  # Delete original: keep quote, explain missing source.
  menu(15);page.once('dialog',lambda dialog:dialog.accept());e.get_by_role('menuitem',name='Delete',exact=True).click();expect(rows).to_have_count(45)
  rows.last.get_by_role('button',name='Show quoted message in chat',exact=True).click();expect(e.locator('.transfer-notice')).to_contain_text('original message is not available')
  page.evaluate('openPlain()');assert 'reply-to:' in page.locator('#plain-editor').input_value();page.evaluate('openIM()')
  expect(rows.last.locator('.bubble-reply-quote')).to_contain_text(records[15]['text'])
  # Export/import a reply with an unavailable original retains quote and references.
  menu(44);e.get_by_role('menuitem',name='Select',exact=True).click();e.get_by_role('button',name='Export',exact=True).click()
  payload=page.evaluate('navigator.clipboard.readText()')
  page.evaluate('()=>{notes.other={uuid:"other",content_type:"Note",content:{text:""}};openIM("other")}')
  expect(rows).to_have_count(0)
  e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Import from clipboard',exact=True).click()
  dialog=e.get_by_role('dialog');expect(dialog.get_by_role('textbox',name='Paste exported messages')).to_have_value(payload)
  dialog.get_by_role('button',name='Import messages',exact=True).click();expect(rows).to_have_count(1);expect(rows.last.locator('.bubble-reply-quote')).to_contain_text(records[15]['text'])
  # Draft reply belongs only to its note, including an empty typed draft.
  menu(0);e.get_by_role('menuitem',name='Reply',exact=True).click();expect(e.locator('.composer-reply-preview')).to_be_visible();page.wait_for_function('!!notes.other.clientData?.imStyleEditor?.reply');page.evaluate('openIM("original")');expect(e.locator('.composer-reply-preview')).to_have_count(0)
  page.evaluate('openIM("other")');expect(e.locator('.composer-reply-preview')).to_be_visible();expect(field).to_have_value('')
  # A send failure retains the reply and typed draft; retry clears only on acknowledgment.
  field.fill('Reply send retry');page.wait_for_function('notes.other.clientData?.imStyleEditor?.draft==="Reply send retry"')
  page.evaluate('rejectSaves=true');e.get_by_role('button',name='Send message',exact=True).click();expect(e.get_by_role('alert')).to_contain_text('Could not save');expect(e.locator('.composer-reply-preview')).to_be_visible();expect(field).to_have_value('Reply send retry')
  page.evaluate('rejectSaves=false;holdAck=true');e.get_by_role('button',name='Send message',exact=True).click();page.wait_for_function('acks.length>0');expect(e.locator('.composer-reply-preview')).to_be_visible();page.evaluate('releaseAcks()')
  page.wait_for_function('notes.other.clientData.imStyleEditor.messages.length===2 && acks.length>0');expect(e.locator('.composer-reply-preview')).to_be_visible();expect(field).to_have_value('Reply send retry')
  page.evaluate('holdAck=false;releaseAcks()');expect(e.locator('.composer-reply-preview')).to_have_count(0);expect(field).to_have_value('');expect(rows).to_have_count(2)
  page.screenshot(path=f'/tmp/reply-{width}.png')
  assert not errors,errors
  print('PASS reply flows',width);c.close()
 b.close()
