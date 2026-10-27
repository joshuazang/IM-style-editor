"""Empty reaction fields are absent on wire and [] in memory; edit flags stay intact."""
import json,os
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8000').rstrip('/')
HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600,permissions=['clipboard-read','clipboard-write'])
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__reaction_omission',lambda r:r.fulfill(content_type='text/html',body=HOST))
  page.goto(BASE+'/__reaction_omission');page.evaluate('notes.original={uuid:"original",content_type:"Note",content:{text:""}};openIM("original")')
  editor=page.frame_locator('#editor');composer=editor.get_by_role('textbox',name='Message',exact=True)
  expect(composer).to_be_enabled();composer.fill('wanna hangout?');editor.get_by_role('button',name='Send message',exact=True).click()
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===1')
  initial=page.evaluate('notes.original.clientData.imStyleEditor.messages[0]')
  assert initial['reactions']==[] and 'createdAt' in initial and 'editedAt' not in initial
  text=page.evaluate('notes.original.content.text');assert 'reactions:' not in text and 'edited:' not in text
  assert f'id: {initial["id"]}\ncreated: {initial["createdAt"]}\n@@IM:CONTENT' in text
  body=editor.locator('.message-body').first
  cdp=context.new_cdp_session(page)
  def context_menu():
   target=editor.locator('.message-body').first
   if width<600:
    box=target.bounding_box();x=box['x']+10;y=box['y']+8
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    page.wait_for_timeout(650)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   else:target.click(button='right')
   expect(editor.get_by_role('menu')).to_be_visible()
  context_menu();editor.locator('.reaction-picker button').filter(has_text='⭐').click()
  page.wait_for_function('notes.original.content.text.includes(\'reactions: ["⭐"]\')')
  assert 'edited:' not in page.evaluate('notes.original.content.text'),'Category toggling must not mark the text edited'
  context_menu();editor.locator('.reaction-picker button').filter(has_text='⭐').click()
  page.wait_for_function('!notes.original.content.text.includes("reactions:")')
  context_menu();editor.get_by_role('menuitem',name='Edit',exact=True).click()
  editor.get_by_role('textbox',name='Edit message',exact=True).fill('wanna hangout later?')
  editor.get_by_role('button',name='Save changes',exact=True).click()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages[0].editedAt')
  edited=page.evaluate('notes.original.clientData.imStyleEditor.messages[0]')
  assert edited['id']==initial['id'] and edited['createdAt']==initial['createdAt'] and edited['reactions']==[]
  text=page.evaluate('notes.original.content.text');assert 'reactions:' not in text and f'edited: {edited["editedAt"]}' in text
  page.evaluate('openPlain();openIM()');expect(editor.locator('.message-meta')).to_contain_text('edited')
  page.wait_for_function('notes.original.clientData?.imStyleEditor?.messages.length===1')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages[0]')==edited
  context_menu();editor.get_by_role('menuitem',name='Select',exact=True).click()
  editor.get_by_role('button',name='Export',exact=True).click()
  expect(editor.locator('.transfer-notice')).to_contain_text('exported to clipboard')
  clipboard=page.evaluate('navigator.clipboard.readText()');record=json.loads(clipboard.split('\n',1)[1])['messages'][0]
  assert 'reactions' not in record and record['editedAt']==edited['editedAt'] and record['createdAt']==initial['createdAt']
  page.evaluate('notes.target={uuid:"target",content_type:"Note",content:{text:""}};openIM("target")');expect(editor.get_by_role('textbox',name='Message',exact=True)).to_be_enabled()
  editor.get_by_role('button',name='More options',exact=True).click();editor.get_by_role('button',name='Import from clipboard',exact=True).click()
  editor.get_by_role('dialog').get_by_role('button',name='Import messages',exact=True).click()
  expect(editor.get_by_role('dialog')).to_have_count(0)
  imported=page.evaluate('notes.target.clientData.imStyleEditor.messages[0]')
  assert imported['reactions']==[] and imported['editedAt']==edited['editedAt'] and imported['createdAt']==initial['createdAt']
  assert 'reactions:' not in page.evaluate('notes.target.content.text')
  assert not errors,errors
  print(f'PASS width={width}: send/tag/untag/edit round trip and clipboard import omit empty reaction fields, default to [], preserve dates and edit behavior')
  context.close()
 browser.close()
