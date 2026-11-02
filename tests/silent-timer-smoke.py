import os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('IM_STYLE_EDITOR_BASE_URL','http://127.0.0.1:8015')
HOST=Path('tests/editor-roundtrip-host.html').read_text().replace("editor.src = '/index.html';","editor.src = '/next/index.html';")
bundle='next/'+re.search(r'src="\./([^"?]+\.js)',Path('next/index.html').read_text())[1]
script=Path(bundle).read_text().replace('function nv(){','function nv(){window.__editorRenders=(window.__editorRenders||0)+1;')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
 for width in [320,1000]:
  page=browser.new_page(viewport={'width':width,'height':844},is_mobile=width<600,has_touch=width<600);errors=[];dialogs=[];requests=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.dismiss()))
  page.on('request',lambda request:requests.append(request.url))
  page.add_init_script("""(()=>{const real=Date.now;Date.now=()=>parent.auditNow??real();window.Audio=window.AudioContext=window.webkitAudioContext=function(){throw new Error('Sound is forbidden')};Object.defineProperty(navigator,'vibrate',{value:()=>{throw new Error('Vibration is forbidden')}})})();""")
  page.route(BASE+'/'+bundle,lambda route:route.fulfill(content_type='text/javascript',body=script))
  page.route(BASE+'/__timer',lambda route:route.fulfill(content_type='text/html',body=HOST));page.goto(BASE+'/__timer')
  page.evaluate('()=>{auditNow=1700000000000;notes.a={uuid:"a",content_type:"Note",content:{text:"Keep this message"}};notes.b={uuid:"b",content_type:"Note",content:{text:"Other note"}};openIM("a")}')
  e=page.frame_locator('#editor');field=e.get_by_role('textbox',name='Message',exact=True);expect(field).to_be_visible()
  field.fill('Keep my exact draft');page.wait_for_function('notes.a.content.text.includes("Keep my exact draft")')
  def controls():
   e.get_by_role('button',name='More options',exact=True).click();e.get_by_role('button',name='Timer',exact=True).click()
   return e.get_by_role('dialog',name='Silent timer',exact=True)
  control=controls();expect(control.locator('.silent-timer-presets > button')).to_have_count(2)
  expect(control.get_by_role('button',name='5 minutes',exact=True)).to_have_attribute('aria-pressed','true')
  assert control.get_by_role('spinbutton').count()==0
  control.get_by_role('button',name='Start timer',exact=True).click();expect(e.locator('.silent-timer-countdown')).to_have_text('05:00')
  page.wait_for_function('pluginPreferences.imSilentTimerV1?.durationMs===300000')
  writes=page.evaluate('preferenceWrites.length');network=len(requests)
  page.wait_for_timeout(200)
  renders=e.locator('body').evaluate('()=>window.__editorRenders')
  page.evaluate('auditNow+=1000');expect(e.locator('.silent-timer-countdown')).to_have_text('04:59')
  assert e.locator('body').evaluate('()=>window.__editorRenders')==renders,'Countdown tick rerendered the editor'
  assert page.evaluate('preferenceWrites.length')==writes
  assert len(requests)==network
  field.focus();field.evaluate('el=>el.setSelectionRange(2,2)')
  before=page.evaluate('notes.a.content.text')
  # Expire before the next interval: the first keystroke must not enter the draft.
  page.evaluate('auditNow+=300001');page.keyboard.type('X')
  finished=e.get_by_role('dialog',name='Timer finished',exact=True);expect(finished).to_be_visible();expect(field).to_be_disabled();expect(e.get_by_role('button',name='Send message',exact=True)).to_be_disabled();expect(field).to_have_value('Keep my exact draft')
  assert page.evaluate('notes.a.content.text')==before
  page.screenshot(path=f'/tmp/im-timer-finished-{width}.png')
  expect(finished.get_by_role('button')).to_have_count(4)
  expect(finished.get_by_role('button',name='2 Add 1 minute',exact=True)).to_be_visible()
  old_deadline=page.evaluate('pluginPreferences.imSilentTimerV1.deadline')
  page.keyboard.press('Enter');expect(finished).to_be_visible()
  page.keyboard.press('2');expect(finished.get_by_role('button',name='2 Add 1 minute',exact=True)).to_be_focused()
  assert page.evaluate('pluginPreferences.imSilentTimerV1.deadline')==old_deadline
  page.keyboard.press('3');expect(finished.get_by_role('button',name='3 Add 3 minutes',exact=True)).to_be_focused()
  page.keyboard.press('2');page.keyboard.press('Enter');expect(finished).to_have_count(0);expect(e.locator('.silent-timer-countdown')).to_have_text('01:00')
  expect(field).to_be_enabled();expect(field).to_be_focused();assert field.evaluate('el=>el.selectionStart')==2
  def expire(ms):
   page.evaluate('(ms)=>auditNow+=ms',ms);e.locator('body').evaluate("()=>document.dispatchEvent(new Event('visibilitychange'))");expect(finished).to_be_visible()
  expire(60001);page.keyboard.press('3');page.keyboard.press('Enter');expect(e.locator('.silent-timer-countdown')).to_have_text('03:00')
  expire(180001);page.keyboard.press('4');expect(finished.get_by_role('button',name='4 Restart 5 minutes',exact=True)).to_be_focused();page.keyboard.press('Enter');expect(e.locator('.silent-timer-countdown')).to_have_text('05:00')
  expire(300001);page.keyboard.press('2');page.keyboard.press('Escape');expect(finished).to_have_count(0);expect(e.locator('.silent-timer-badge')).to_have_count(0);expect(field).to_be_enabled()
  page.wait_for_function('pluginPreferences.imSilentTimerV1===null')
  control=controls();control.get_by_role('button',name='25 minutes',exact=True).click();control.get_by_role('button',name='Start timer',exact=True).click();expect(e.locator('.silent-timer-countdown')).to_have_text('25:00')
  page.wait_for_function('pluginPreferences.imSilentTimerV1?.durationMs===1500000')
  # Timer is global to this editor, not tied to one note or interval callback.
  page.evaluate('openIM("b")');expect(e.locator('.silent-timer-countdown')).to_have_text('25:00')
  page.evaluate('openIM("a")');expect(e.locator('.silent-timer-countdown')).to_have_text('25:00');expect(field).to_have_value('Keep my exact draft')
  expire(1500001)
  expect(finished.get_by_role('button',name='2 Add 5 minutes',exact=True)).to_be_visible();expect(finished.get_by_role('button',name='3 Add 15 minutes',exact=True)).to_be_visible()
  page.keyboard.press('2');page.keyboard.press('Enter');expect(e.locator('.silent-timer-countdown')).to_have_text('05:00')
  expire(300001);page.keyboard.press('3');page.keyboard.press('Enter');expect(e.locator('.silent-timer-countdown')).to_have_text('15:00')
  expire(900001);page.keyboard.press('4');page.keyboard.press('Enter');expect(e.locator('.silent-timer-countdown')).to_have_text('25:00')
  # Reopening an already expired timer must interrupt immediately, without a sound.
  page.evaluate('auditNow+=1500001;openIM("a")');expect(finished).to_be_visible();expect(field).to_have_value('Keep my exact draft')
  finished.get_by_role('button',name='4 Restart 25 minutes',exact=True).click();expect(finished).to_have_count(0)
  e.locator('.message-wrap').first.click(button='right');e.get_by_role('menuitem',name='Select',exact=True).click();expect(e.locator('.selection-status')).to_contain_text('1 / 1 selected')
  expire(1500001);page.keyboard.press('Escape');expect(finished).to_have_count(0);expect(e.locator('.selection-status')).to_contain_text('1 / 1 selected')
  page.wait_for_function('pluginPreferences.imSilentTimerV1===null')
  assert page.evaluate('pluginPreferences.imStyleSelectionV1.notes.a.ids.length')==1
  # A real deadline callback, without typing or a visibility event, must also
  # interrupt the editor. Returning to a suspended app is not the only trigger.
  page.evaluate('()=>{pluginPreferences.imSilentTimerV1={version:1,durationMs:300000,deadline:auditNow+500};openIM("b")}')
  expect(e.locator('.silent-timer-countdown')).to_be_visible()
  page.evaluate('auditNow+=501');expect(finished).to_be_visible();expect(field).to_be_disabled()
  page.keyboard.press('Escape');expect(finished).to_have_count(0)
  assert page.evaluate('localStorage.length')==0
  assert not errors,errors
  assert not dialogs,dialogs
  print('PASS silent timer',width,'5/25 only; typing interruption; 2/3/4 focus + Enter; Esc; scaled extensions; restart; draft/cursor preserved; note switches/reload; no per-tick saves, sound or plaintext storage',flush=True)
  page.close()
 browser.close()
