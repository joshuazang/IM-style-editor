"""Deletion strips one category retroactively, never bubbles; re-add does not restore tags."""
import os,copy
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006');HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorSettings':{'reactionOrder':['🦋','⭐','❤️']},'appendEditorMessageData':[{'id':'one','text':'Keep this message','createdAt':'2026-01-01T12:00:00Z','reactions':['⭐','🦋']},{'id':'two','text':'Keep this too','reactions':[]}]}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__delete',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__delete');page.evaluate('(n)=>{notes.original=n;openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(2);page.wait_for_function('!!notes.original.clientData?.imStyleEditor');original=page.evaluate('notes.original.clientData.imStyleEditor.messages')
  e.get_by_role('button',name='More options').click();e.get_by_role('button',name='Arrange tags').click();e.locator('.tag-control .chip').filter(has_text='⭐').click();expect(rows).to_have_count(1)
  e.get_by_role('button',name='Delete emoji',exact=True).click();expect(e.get_by_role('button',name='Untagged',exact=True)).to_have_count(0);before=page.evaluate('saves.length');page.once('dialog',lambda d:d.dismiss());e.get_by_role('button',name='Delete ⭐ from emoji menu',exact=True).click();assert page.evaluate('saves.length')==before;expect(rows).to_have_count(1)
  page.once('dialog',lambda d:d.accept());e.get_by_role('button',name='Delete ⭐ from emoji menu',exact=True).click();expect(rows).to_have_count(2);expect(e.locator('.filter-status')).to_have_count(0);page.wait_for_function('notes.original.clientData.imStyleEditor.messages[0].reactions.length===1')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages[0].reactions')==['🦋']
  for tag in ['🦋','❤️']:
   e.get_by_role('button',name='Delete emoji',exact=True).click();page.once('dialog',lambda d:d.accept());e.get_by_role('button',name=f'Delete {tag} from emoji menu',exact=True).click();expect(rows).to_have_count(2)
  expect(e.get_by_role('button',name='Delete emoji',exact=True)).to_be_disabled();expect(e.get_by_role('button',name='Edit emoji',exact=True)).to_be_disabled();expect(e.get_by_role('button',name='Untagged',exact=True)).to_be_visible()
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages.every(m=>m.reactions.length===0)');actual=page.evaluate('notes.original.clientData.imStyleEditor.messages')
  for a,z in zip(original,actual):assert {k:v for k,v in a.items() if k!='reactions'}=={k:v for k,v in z.items() if k!='reactions'}
  page.evaluate('openPlain();openIM()');expect(rows).to_have_count(2);e.get_by_role('button',name='More options').click();e.get_by_role('button',name='Arrange tags').click();expect(e.locator('.tag-control:not(.untagged-control)')).to_have_count(0)
  e.get_by_role('textbox',name='Add an emoji category').fill('⭐');e.get_by_role('button',name='Add emoji',exact=True).click();expect(e.locator('.tag-control .chip').filter(has_text='⭐')).to_have_text('⭐ 0')
  assert page.evaluate('notes.original.clientData.imStyleEditor.messages.every(m=>m.reactions.length===0)')
  assert not errors,errors
  print('PASS retroactive emoji deletion',width);c.close()
 b.close()
