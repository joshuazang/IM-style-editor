"""Real visual editing, structural Enter, universal format exit and undo."""
import functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options,fill_field
ROOT=Path(__file__).resolve().parents[1]
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [390,1100]:
   context=browser.new_context(viewport={'width':width,'height':900});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/markdown-field-host.html');capture=page.get_by_role('textbox',name='Capture',exact=True);detail=page.get_by_role('textbox',name='Card body',exact=True)
   expect(capture).to_be_editable();fill_field(capture,'ordinary');capture.press('Enter');assert page.evaluate('sends')==['ordinary']
   for source,kind in [('- item','bullet_list'),('- [x] done','bullet_list'),('1. item','ordered_list'),('> quote','blockquote'),('# Heading','heading')]:
    capture.evaluate('(n,s)=>{capture.setContext(s,s);n.setSelectionRange(n.value.length,n.value.length);n.focus()}',source);count=page.evaluate('sends.length');capture.press('Enter');assert page.evaluate('sends.length')==count;capture.press('Control+Enter');assert capture.evaluate('n=>capture.view.state.selection.$from.depth===1&&capture.view.state.selection.$from.parent.type.name==="paragraph"');assert page.evaluate('sends.length')==count
   capture.evaluate('n=>{capture.setContext("bold","text");n.select();n.focus()}');capture.press('Control+b');assert capture.locator('strong').inner_text()=='text';capture.press('Control+Enter');capture.type('normal');assert capture.locator('p').last.inner_text()=='normal';assert capture.locator('p').last.locator('strong').count()==0;capture.press('Control+z');assert 'normal' not in capture.inner_text()
   fill_field(detail,'card text');count=page.evaluate('sends.length');detail.press('Enter');detail.type('second');detail.press('Meta+Enter');detail.type('third');assert detail.locator('p').count()==3;assert page.evaluate('sends.length')==count
   detail.press('Shift+Enter');detail.type('fourth');assert detail.locator('p').count()==3;assert detail.locator('br').count()>=1
   capture.evaluate('n=>{capture.setContext("task","- [ ] task");n.focus()}');capture.get_by_role('checkbox').click();assert '[x]' in capture.evaluate('n=>n.value')
   expect(page.locator('#capture .im-format-toggle,#capture .im-format-toolbar')).to_have_count(0)
   detail.evaluate('n=>{detail.setContext("toolbar","select me");n.select();n.focus()}');page.locator('#detail').get_by_role('button',name='Text formatting',exact=True).click();page.locator('#detail').get_by_role('button',name='Bold',exact=True).click();assert detail.locator('strong').inner_text()=='select me'
   box=page.get_by_role('toolbar',name='Text formatting',exact=True);heading=box.get_by_role('button',name='Normal text',exact=True)
   def choices():
    if not box.is_visible():page.locator('#detail').get_by_role('button',name='Text formatting',exact=True).click()
   expected=['Bold','Quotation block','Strikethrough','Bullet list','Numbered list','Checklist','Heading 1','Heading 2','Normal text','Clear Formatting']
   assert box.get_by_role('button').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("aria-label"))')==expected
   box.screenshot(path='/tmp/format-toolbar-'+str(width)+'.png')
   expect(page.locator('#detail').get_by_role('button',name='Text formatting',exact=True).locator('svg')).to_have_count(1)
   fill_field(detail,'**keep target after**');detail.evaluate('n=>{const v=n.imRich.view;let from;v.state.doc.descendants((node,pos)=>{if(node.isText&&node.text.includes("target"))from=pos+node.text.indexOf("target")});v.dispatch(v.state.tr.setSelection(imRichDeps.state.TextSelection.create(v.state.doc,from,from+6)));n.focus()}');choices();box.get_by_role('button',name='Clear Formatting',exact=True).click()
   expect(detail.locator('p')).to_have_count(1);assert detail.inner_text()=='keep target after';assert [s.strip() for s in detail.locator('strong').all_text_contents()]==['keep','after']
   fill_field(detail,'# Heading\n\n> **quote** ~~strike~~\n\n- [x] task');detail.press('Control+a');choices();box.get_by_role('button',name='Clear Formatting',exact=True).click();expect(detail.locator('h1,h2,blockquote,ul,ol,strong,s')).to_have_count(0);expect(detail.get_by_role('checkbox')).to_have_count(0);detail.press('Control+z');expect(detail.locator('h1')).to_have_text('Heading');expect(detail.get_by_role('checkbox')).to_have_count(1);detail.press('Control+Shift+z');expect(detail.locator('h1,h2,blockquote,ul,ol,strong,s')).to_have_count(0)
   for level in range(1,3):
    fill_field(detail,'Heading candidate');detail.press('Control+a');choices();box.get_by_role('button',name='Heading '+str(level),exact=True).click();expect(detail.locator('h'+str(level))).to_have_text('Heading candidate');choices()
    for choice in range(1,3):expect(box.get_by_role('button',name='Heading '+str(choice),exact=True)).to_have_attribute('aria-pressed',str(choice==level).lower())
    active=box.get_by_role('button',name='Heading '+str(level),exact=True);assert active.evaluate('n=>getComputedStyle(n).backgroundColor') not in ['rgba(0, 0, 0, 0)','transparent'];active.click();expect(detail.locator('h1,h2,h3,h4,h5,h6')).to_have_count(0);expect(detail.locator('p')).to_have_text('Heading candidate');expect(heading).to_have_attribute('aria-pressed','true');assert detail.evaluate('n=>n.value')=='Heading candidate'
   for level in range(3,7):
    fill_field(detail,'#'*level+' Existing heading');detail.press('Control+End');choices()
    active=box.get_by_role('button',name='Heading '+str(level),exact=True);expect(active).to_be_visible();expect(active).to_have_attribute('aria-pressed','true');expect(active).to_have_text('H'+str(level))
    assert box.get_by_role('button').evaluate_all('nodes=>nodes.filter(n=>/^Heading [3-6]$/.test(n.getAttribute("aria-label"))).length')==1
    detail.type('!');expect(active).to_be_visible();expect(active).to_have_attribute('aria-pressed','true')
    active.click();expect(detail.locator('h'+str(level))).to_have_count(0);expect(heading).to_have_attribute('aria-pressed','true');assert box.get_by_role('button').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("aria-label"))')==expected
    detail.press('Control+z');expect(detail.locator('h'+str(level))).to_have_count(1);choices();expect(box.get_by_role('button',name='Heading '+str(level),exact=True)).to_have_attribute('aria-pressed','true')
   fill_field(detail,'###### Sixth\n\n### Third\n\nOrdinary');detail.press('Control+a');choices()
   assert box.get_by_role('button').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("aria-label"))')==expected,'Mixed styles must not claim a single active heading level'
   fill_field(detail,'# First\n\n### Third\n\nOrdinary')
   for selector,level in [('h1',1),('h3',3),('p',0)]:
    detail.locator(selector).click();choices()
    for choice in range(1,3):expect(box.get_by_role('button',name='Heading '+str(choice),exact=True)).to_have_attribute('aria-pressed',str(choice==level).lower())
   # Repeated clicks must toggle every actual format, for a caret and a range.
   for selected in [False,True]:
    for label,selector in [('Bold','strong'),('Strikethrough','s'),('Quotation block','blockquote'),('Bullet list','ul'),('Numbered list','ol'),('Checklist','li[data-checked]')]:
     fill_field(detail,'Toggle candidate')
     if selected:detail.press('Control+a')
     else:detail.press('End')
     button=box.get_by_role('button',name=label,exact=True)
     for cycle in range(3):
      button.click();expect(button).to_have_attribute('aria-pressed','true')
      if selected or label not in ['Bold','Strikethrough']:expect(detail.locator(selector)).to_have_count(1)
      button.click();expect(button).to_have_attribute('aria-pressed','false');expect(detail.locator(selector)).to_have_count(0)
      assert detail.inner_text()=='Toggle candidate'
     detail.type(' clean');assert detail.inner_text().endswith(' clean')
   for label,selector in [('Bold','strong'),('Strikethrough','s')]:
    fill_field(detail,'Seed ');detail.press('End');button=box.get_by_role('button',name=label,exact=True);button.click();detail.type('formatted');expect(button).to_have_attribute('aria-pressed','true');button.click();detail.type(' ordinary');expect(button).to_have_attribute('aria-pressed','false');expect(detail.locator(selector)).to_have_text('formatted');assert detail.inner_text()=='Seed formatted ordinary'
   for first,second in [('Bullet list','Checklist'),('Checklist','Numbered list'),('Numbered list','Bullet list')]:
    fill_field(detail,'List candidate');detail.press('Control+a');box.get_by_role('button',name=first,exact=True).click();other=box.get_by_role('button',name=second,exact=True);other.click();expect(other).to_have_attribute('aria-pressed','true');other.click();expect(detail.locator('ul,ol')).to_have_count(0)
   fill_field(detail,'> - Nested item');detail.locator('li').click();quote=box.get_by_role('button',name='Quotation block',exact=True);expect(quote).to_have_attribute('aria-pressed','true');quote.click();expect(detail.locator('blockquote')).to_have_count(0);expect(detail.locator('ul')).to_have_count(1)
   before=capture.evaluate('n=>n.value');capture.dispatch_event('keydown',{'key':'Enter','keyCode':229,'isComposing':True,'bubbles':True});assert capture.evaluate('n=>n.value')==before
   assert not errors,errors
   print(json.dumps({'PASS':width,'checks':'visual bold/checkboxes; capture Enter; list/quote/heading continuation; Ctrl/Meta+Enter ordinary text; Shift+Enter; undo; no capture toolbar; selection retained in Card toolbar; direct H1/H2/Normal, selected Clear Formatting, active states and removal'}),flush=True);context.close()
  browser.close()
finally:server.shutdown()
