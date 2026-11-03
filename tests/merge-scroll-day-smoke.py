"""Synthetic notes: merges, per-day selection and anchored/smooth scrolling."""
import json, os, re, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8022')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/index.html';")
JS="""const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('next/src/note-format.js','utf8')+';imFormat',{crypto,btoa});
const messages=Array.from({length:180},(_,i)=>({id:f.newId(),text:`Message ${i}: `+'Keep this thought. '.repeat(i%7+1),createdAt:`2026-11-${i<90?'01':'02'}T12:00:00Z`,reactions:i%2?[]:['⭐'],copied:true,exported:true}));
messages[2].replyTo={id:messages[0].id,noteId:'test',text:messages[0].text};
console.log(JSON.stringify({messages,text:f.portable(messages,{bubbleTheme:'iris',reactionOrder:['⭐'],pinnedMessageIds:[messages[178].id]},'Unsent draft')}));"""
data=json.loads(subprocess.run(['node','-e',JS],capture_output=True,text=True,check=True).stdout)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [390,1100]:
  page=browser.new_page(viewport={'width':width,'height':844});errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.route(BASE+'/__merge-scroll',lambda route:route.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__merge-scroll')
  page.evaluate('(text)=>{notes.test={uuid:"test",content_type:"Note",content:{text}};openIM("test")}',data['text'])
  e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message',exact=True);list_=e.get_by_role('log')
  expect(e.locator('.message-wrap').last).to_contain_text('Message 179:');page.wait_for_timeout(400)
  # Find and keep a particular older bubble at the same pixel while sending below it.
  list_.evaluate('(el)=>{el.scrollTop=el.scrollHeight*.35}')
  page.wait_for_timeout(350)
  anchor=list_.evaluate('''el=>{const top=el.getBoundingClientRect().top+100;const row=[...el.querySelectorAll('[data-message-id]')].find(x=>x.getBoundingClientRect().top>=top);return {id:row.dataset.messageId,y:row.getBoundingClientRect().top}}''')
  field.fill('New message below');e.get_by_role('button',name='Send message',exact=True).click()
  badge=e.get_by_role('button',name='Scroll to bottom, 1 new message',exact=True);expect(badge).to_be_visible()
  page.wait_for_timeout(450)
  anchored=e.locator(f'[data-message-id="{anchor["id"]}"]');expect(anchored).to_be_visible();assert abs(anchored.bounding_box()['y']-anchor['y'])<2
  expect(badge.locator('.new-message-count')).to_have_text('1')
  # An edit lower down also leaves this same reading location in place.
  page.evaluate('''()=>{const item=structuredClone(notes.test);item.content.text=item.content.text.replace('New message below','New message below, expanded\\n'.repeat(20));notes.test=item;editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item}},location.origin)}''')
  page.wait_for_timeout(350);assert abs(anchored.bounding_box()['y']-anchor['y'])<2
  badge.click();expect(e.locator('.message-wrap').last).to_contain_text('New message below');page.wait_for_timeout(700)
  assert list_.evaluate('el=>el.scrollHeight-el.clientHeight-el.scrollTop')<3
  expect(e.locator('.new-message-count')).to_have_count(0)
  # At the bottom an append follows over several frames, rather than teleporting.
  samples=list_.evaluate('''el=>{window.__scrollSamples=[];window.__watch=()=>{window.__scrollSamples.push(el.scrollTop);if(window.__scrollSamples.length<40)requestAnimationFrame(window.__watch)};requestAnimationFrame(window.__watch);return el.scrollTop}''')
  field.fill('Follow smoothly\n'*12);e.get_by_role('button',name='Send message',exact=True).click();page.wait_for_timeout(800)
  positions=field.evaluate('()=>window.__scrollSamples')
  unique=sorted(set(round(n,1) for n in positions));assert len(unique)>5,unique
  assert list_.evaluate('el=>el.scrollHeight-el.clientHeight-el.scrollTop')<3
  print('PASS anchored older reading, unseen-message badge, edits below, jump clears badge, smooth follow',width,flush=True)
  # Use a day separator under a filter: select all matching off-screen messages from that day.
  e.get_by_role('button',name='Search and tags',exact=True).click();e.get_by_role('button',name=re.compile('^⭐ ')).click();page.wait_for_timeout(250)
  list_.evaluate('el=>{el.scrollTop=el.scrollHeight}');page.wait_for_timeout(250)
  # The date divider can be off-screen; navigate to the first message of that day using the local virtual API.
  list_.evaluate('(el,id)=>el.imVirtual.reveal(id,()=>{})',data['messages'][90]['id']);page.wait_for_timeout(300)
  day=e.locator(f'[data-virtual-message="{data["messages"][90]["id"]}"] .day-select');expect(day).to_be_visible();day.click()
  expect(e.locator('.selection-status')).to_contain_text('45 / 182 selected')
  expect(day).to_have_attribute('aria-pressed','true')
  margins=e.locator('.day-divider.day-break').evaluate('el=>({top:parseFloat(getComputedStyle(el).marginTop),bottom:parseFloat(getComputedStyle(el).marginBottom)})');assert margins=={'top':14,'bottom':4},margins
  e.get_by_role('button',name='Cancel',exact=True).click()
  e.get_by_role('button',name='Clear all filters',exact=True).click()
  # Merge the last two original messages and check the preview/cancel path first.
  list_.evaluate('el=>{el.scrollTop=el.scrollHeight}');page.wait_for_timeout(300)
  for index in [178,179]:
   row=e.locator(f'[data-message-id="{data["messages"][index]["id"]}"]')
   if index==178:row.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click()
   else:row.click()
  e.get_by_role('button',name='More selection options').click();expect(e.get_by_role('menuitem',name='Merge selected')).to_be_enabled();e.get_by_role('menuitem',name='Merge selected').click()
  dialog=e.get_by_role('dialog');expect(dialog).to_contain_text('Merge 2 messages?')
  exact=data['messages'][178]['text']+'\n\n'+data['messages'][179]['text'];expect(dialog.locator('.merge-preview')).to_have_text(exact)
  dialog.get_by_role('button',name='Cancel',exact=True).click();expect(e.locator('.selection-status')).to_contain_text('2 / 182 selected')
  e.get_by_role('button',name='More selection options').click();e.get_by_role('menuitem',name='Merge selected').click();dialog.get_by_role('button',name='Merge selected').click();expect(dialog).to_have_count(0)
  expect(e.locator('.selection-status')).to_contain_text('1 / 181 selected')
  merged=e.locator(f'[data-message-id="{data["messages"][178]["id"]}"]');expect(merged.locator('.message-body')).to_have_text(exact)
  expect(merged.locator('.message-meta')).to_contain_text('edited');expect(merged.locator('.message-meta')).not_to_contain_text('Copied');expect(merged.locator('.bubble-pin-marker')).to_have_count(1)
  colors=merged.locator('.message-bubble').evaluate('el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})');assert colors=={'background':'rgb(78, 92, 240)','color':'rgb(255, 255, 255)'},colors
  page.evaluate('openIM("test")');expect(e.locator('.selection-status')).to_contain_text('1 / 181 selected');expect(e.locator(f'[data-message-id="{data["messages"][178]["id"]}"] .message-body')).to_have_text(exact)
  print('PASS filtered day selection, doubled date margins, merge preview/cancel, persisted text/pins/statuses, Iris color',width,flush=True)
  # Reduced motion jumps directly. A manual scroll interrupts an active smooth jump.
  e.get_by_role('button',name='Cancel',exact=True).click();list_.evaluate('el=>{el.scrollTop=0}');page.wait_for_timeout(200)
  page.emulate_media(reduced_motion='reduce');e.get_by_role('button',name='Scroll to bottom',exact=True).click();page.wait_for_timeout(100)
  assert list_.evaluate('el=>el.scrollHeight-el.clientHeight-el.scrollTop')<3
  page.emulate_media(reduced_motion='no-preference');list_.evaluate('el=>{el.scrollTop=0}');page.wait_for_timeout(200)
  e.get_by_role('button',name='Scroll to bottom',exact=True).click();page.wait_for_timeout(70)
  interrupted=list_.evaluate('''el=>{el.dispatchEvent(new WheelEvent("wheel",{bubbles:true,deltaY:-100}));const top=el.getBoundingClientRect().top+100;const row=[...el.querySelectorAll('[data-message-id]')].find(x=>x.getBoundingClientRect().top>=top);return {following:el.imScroll.following,id:row?.dataset.messageId,y:row?.getBoundingClientRect().top}}''');page.wait_for_timeout(350)
  assert interrupted['following'] is False
  assert list_.evaluate('el=>!el.imScroll.following && el.scrollHeight-el.clientHeight-el.scrollTop>200')
  settled=list_.evaluate('el=>el.scrollTop');page.wait_for_timeout(150);assert abs(list_.evaluate('el=>el.scrollTop')-settled)<2
  # Rejected merge saves keep the exact text available, and Retry save persists it.
  page.evaluate('(text)=>{notes.failure={uuid:"failure",content_type:"Note",content:{text}};openIM("failure")}',data['text'])
  expect(e.locator('.message-wrap').last).to_contain_text('Message 179:');page.wait_for_timeout(300)
  e.locator('.message-wrap').last.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();e.locator('.message-wrap').nth(-2).click()
  e.get_by_role('button',name='More selection options').click();page.keyboard.press('Escape');expect(e.get_by_role('menu')).to_have_count(0);expect(e.locator('.selection-status')).to_contain_text('2 / 180 selected')
  e.get_by_role('button',name='More selection options').click();e.get_by_role('menuitem',name='Merge selected').click()
  before=page.evaluate('notes.failure.content.text');page.evaluate('rejectSaves=true');e.get_by_role('dialog').get_by_role('button',name='Merge selected').click()
  expect(e.get_by_role('dialog').get_by_role('alert')).to_contain_text('combined text is still here');assert page.evaluate('notes.failure.content.text')==before
  expect(e.locator('.merge-preview')).to_have_text(exact)
  e.get_by_role('dialog').get_by_role('button',name='Cancel',exact=True).click();page.evaluate('rejectSaves=false');e.get_by_role('button',name='Retry save',exact=True).click()
  page.wait_for_function('!document.querySelector("#editor").contentDocument.querySelector(".save-notice")')
  assert page.evaluate('(notes.failure.content.text.match(/@@IM:BUBBLE\\n/g)||[]).length')==179
  e.get_by_role('button',name='Cancel',exact=True).click();expect(field).to_have_value('Unsent draft')
  print('PASS reduced-motion behavior, user interruption, keyboard menu dismissal, rejected merge retains text/draft and retries',width,flush=True)
  # A source changed while the preview was open: preserve the incoming change and refuse the stale merge.
  page.evaluate('(text)=>{notes.stale={uuid:"stale",content_type:"Note",content:{text}};openIM("stale")}',data['text']);expect(e.locator('.message-wrap').last).to_contain_text('Message 179:');page.wait_for_timeout(250)
  e.locator('.message-wrap').last.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();e.locator('.message-wrap').nth(-2).click()
  e.get_by_role('button',name='More selection options').click();e.get_by_role('menuitem',name='Merge selected').click()
  page.evaluate('''()=>{const item=structuredClone(notes.stale);item.content.text=item.content.text.replace('Message 179:','Changed source 179:');notes.stale=item;editor.contentWindow.postMessage({action:'reply',original:subscription,data:{item}},location.origin)}''')
  expect(e.locator('.message-body').last).to_contain_text('Changed source 179:');current=page.evaluate('notes.stale.content.text')
  e.get_by_role('dialog').get_by_role('button',name='Merge selected').click();expect(e.get_by_role('dialog').get_by_role('alert')).to_contain_text('messages changed');assert page.evaluate('notes.stale.content.text')==current
  e.get_by_role('dialog').get_by_role('button',name='Cancel',exact=True).click();e.get_by_role('button',name='Cancel',exact=True).click()
  print('PASS a changed source blocks stale merge without overwriting incoming content',width,flush=True)
  assert not errors,errors
  if width==390:
   list_.evaluate('(el,id)=>el.imVirtual.reveal(id,()=>{})',data['messages'][90]['id']);page.wait_for_timeout(300);page.screenshot(path='/tmp/im-4.1.0-days.png')
  page.close()
 browser.close()
