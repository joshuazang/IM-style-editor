"""General category editing/deletion keeps every bubble and all unrelated data."""
import os,copy
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from fixture_v2 import prepare_note,fixture_id
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8006');HOST=Path(__file__).with_name('editor-roundtrip-host.html').read_text()
note=prepare_note({'uuid':'original','content_type':'Note','content':{'text':'','appendEditorSettings':{'reactionOrder':['❤️','✅','⭐'],'untaggedPosition':1,'pinnedMessageIds':[fixture_id('0')]},'appendEditorMessageData':[{'id':str(i),'text':f'Keep exact message {i}\n\n  line','createdAt':'2026-10-28T12:00:00Z','reactions':tags,'edited':True,'copied':True,'exported':True,'custom':{'keep':i}} for i,tags in enumerate([['❤️'],['❤️','⭐','✅'],['⭐'],[]])]}})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1200]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route(BASE+'/__emoji_edit',lambda r:r.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__emoji_edit');page.evaluate('(n)=>{notes.original=n;notes.other=structuredClone(n);notes.other.uuid="other";openIM("original")}',note)
  e=page.frame_locator('#editor');rows=e.locator('.message-wrap');expect(rows).to_have_count(4);page.wait_for_function('!!notes.original.clientData?.imStyleEditor')
  field=e.get_by_role('textbox',name='Message',exact=True);field.fill('Keep unsent draft');page.wait_for_function('notes.original.clientData.imStyleEditor.draft==="Keep unsent draft"')
  original=page.evaluate('notes.original.clientData.imStyleEditor.messages');settings=page.evaluate('notes.original.clientData.imStyleEditor.settings')
  def current():return page.evaluate('notes.original.clientData.imStyleEditor.messages')
  def arrange():
   page.keyboard.press('Escape')
   if e.get_by_role('button',name='Change filters',exact=True).count():e.get_by_role('button',name='Clear all filters').click()
   e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Arrange tags',exact=True).click()
  def edit_tag(source,target):
   e.get_by_role('button',name='Edit emoji',exact=True).click();e.get_by_role('button',name=f'Edit {source}',exact=True).click();expect(e.get_by_role('textbox',name='Replacement emoji')).to_have_value(source)
   e.get_by_role('textbox',name='Replacement emoji').fill(target);e.get_by_role('button',name='Save emoji change').click()
  arrange();before=page.evaluate('saves.length');e.get_by_role('button',name='Edit emoji',exact=True).click();e.get_by_role('button',name='Edit ❤️',exact=True).click();e.get_by_role('textbox',name='Replacement emoji').fill('💡');e.get_by_role('button',name='Cancel emoji change').click();assert page.evaluate('saves.length')==before
  edit_tag('❤️','❤️');assert page.evaluate('saves.length')==before
  # A -> new B keeps its menu slot, all bubbles, statuses and draft.
  edit_tag('❤️','💡');page.wait_for_function('notes.original.clientData.imStyleEditor.settings.reactionOrder[0]==="💡"');expect(e.locator('.search-tags-panel')).to_be_visible();assert current()[0]['reactions']==['💡']
  # New B -> existing C merges categories and duplicate reactions.
  edit_tag('💡','⭐');page.wait_for_function('notes.original.clientData.imStyleEditor.settings.reactionOrder.length===2');assert current()[1]['reactions']==['⭐','✅'];assert page.evaluate('notes.original.clientData.imStyleEditor.settings.reactionOrder')==['✅','⭐']
  for before_m,after_m in zip(original,current()):assert {k:v for k,v in before_m.items() if k!='reactions'}=={k:v for k,v in after_m.items() if k!='reactions'}
  assert page.evaluate('notes.original.clientData.imStyleEditor.settings.pinnedMessageIds')==settings['pinnedMessageIds'];assert page.evaluate('notes.original.clientData.imStyleEditor.draft')=='Keep unsent draft'
  page.evaluate('openPlain()');page.evaluate('openIM()');expect(rows).to_have_count(4);expect(field).to_have_value('Keep unsent draft')
  # Ordinary tag selection closes automatically, including while already filtered.
  e.get_by_role('button',name='Search and tags').click();e.locator('.tag-control .chip').filter(has_text='⭐').click();expect(e.locator('.search-tags-panel')).to_have_count(0);expect(rows).to_have_count(3)
  e.get_by_role('button',name='Change filters').click();e.get_by_role('button',name='Untagged',exact=True).click();expect(e.locator('.search-tags-panel')).to_have_count(0);expect(rows).to_have_count(1)
  arrange();e.locator('.tag-control .chip').filter(has_text='⭐').click();expect(e.locator('.search-tags-panel')).to_be_visible();expect(rows).to_have_count(3)
  # Active filter follows a renamed category and Arrange remains open.
  edit_tag('⭐','📚');expect(e.locator('.filter-status')).to_contain_text('📚');page.wait_for_function('notes.original.clientData.imStyleEditor.messages[0].reactions[0]==="📚"')
  # Delete cancellation does not save; confirmation strips the tag, not messages.
  e.get_by_role('button',name='Delete emoji',exact=True).click();before_delete=copy.deepcopy(current());saves=page.evaluate('saves.length');page.once('dialog',lambda d:d.dismiss());e.get_by_role('button',name='Delete 📚 from emoji menu',exact=True).click();assert current()==before_delete and page.evaluate('saves.length')==saves
  page.once('dialog',lambda d:d.accept());e.get_by_role('button',name='Delete 📚 from emoji menu',exact=True).click();expect(rows).to_have_count(4);expect(e.locator('.filter-status')).to_have_count(0)
  page.wait_for_function('notes.original.clientData.imStyleEditor.messages.every(m=>!m.reactions.includes("📚"))');assert current()[0]['reactions']==[] and current()[1]['reactions']==['✅']
  for before_m,after_m in zip(original,current()):assert {k:v for k,v in before_m.items() if k!='reactions'}=={k:v for k,v in after_m.items() if k!='reactions'}
  page.screenshot(path=f'/tmp/emoji-edit-{width}.png');page.evaluate('openIM()');expect(rows).to_have_count(4);expect(field).to_have_value('Keep unsent draft')
  page.evaluate('openIM("other")');expect(rows).to_have_count(4);page.wait_for_function('!!notes.other.clientData?.imStyleEditor');assert page.evaluate('notes.other.clientData.imStyleEditor.messages')==original
  assert not errors,errors
  print('PASS emoji management',width);c.close()
 b.close()
