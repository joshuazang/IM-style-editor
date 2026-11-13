"""Profile real long Markdown card transitions and intrinsic editable layout."""
import functools,http.server,threading,json,subprocess,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')};exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](6);data['settings']['pinnedMessageIds']=[]
for i,m in enumerate(data['messages']):
 m['text']=f'# Markdown card {i}\n\n'+'\n\n'.join(f'## Section {j}\n\n**Bold passage** and ~~struck text~~ with 中文阅读内容 and a thought to revisit.\n\n> A quotation to remember.\n\n- [ ] A task\n- [x] A finished task\n\n1. First item\n2. Second item' for j in range(70));m.pop('replyTo',None)
data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"],cwd=ROOT,input=json.dumps(data),text=True)
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [1100,390]:
   context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card').first).to_be_visible();frame=next(f for f in page.frames if f.parent_frame);cdp=context.new_cdp_session(frame);cdp.send('Performance.enable');cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
   frame.evaluate('''()=>{window.profile={opens:[],frames:[],long:[],heightWrites:0};const open=editorDialog;editorDialog=(...args)=>{const start=performance.now();const result=open(...args);profile.opens.push(performance.now()-start);return result};new MutationObserver(records=>{for(const r of records)if(r.target.matches?.('.editor-body')&&r.attributeName==='style')profile.heightWrites++}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['style']});new PerformanceObserver(list=>profile.long.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask'});}''')
   for i in [0,5,2]:
    frame.evaluate('id=>{const item=layout.byId.get(id);viewport.scrollTop+=board.getBoundingClientRect().top-viewport.getBoundingClientRect().top+item.y;renderWindow();}',data['messages'][i]['id'])
    card=e.locator('[data-id="'+data['messages'][i]['id']+'"]');card.scroll_into_view_if_needed()
    frame.evaluate('''()=>{document.getElementById('board').addEventListener('click',()=>{let last=performance.now();function tick(now){profile.frames.push(now-last);last=now;window.profileFrame=requestAnimationFrame(tick)}window.profileFrame=requestAnimationFrame(tick)},{once:true,capture:true})}''')
    card.click();body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_have_js_property('value',data['messages'][i]['text']);expect(body).to_be_editable();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();frame.evaluate('()=>cancelAnimationFrame(window.profileFrame)')
   assert page.evaluate('saves.length')==0
   target=e.locator('.card').first;target_id=target.get_attribute('data-id');target.click();body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_editable();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');body.press('Control+End');before={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']};body.press('Control+Enter');body.type('typing sample');after={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']};layout_delta=after['LayoutCount']-before['LayoutCount'];stats=frame.evaluate('()=>profile');frames=sorted(stats['frames']);result={'width':width,'opening_ms':stats['opens'],'frame_p95_ms':frames[int(.95*(len(frames)-1))],'worst_frame_ms':max(frames),'long_tasks':len(stats['long']),'longest_task_ms':max(stats['long'],default=0),'typing_layouts':layout_delta,'body_height_writes':stats['heightWrites']};results.append(result);print(json.dumps(result),flush=True)
   if os.environ.get('MOSAIC_PERF_ASSERT','1')=='1':assert layout_delta<=40,'A short typing burst must not repeatedly lay out the whole Markdown document'
   expect(body.get_by_role('checkbox')).to_have_count(140);e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();assert next(m for m in scope['parse'](page.evaluate('notes.a.content.text'))['messages'] if m['id']==target_id)['text'].endswith('typing sample')
   assert not errors,errors;context.close()
  browser.close()
finally:server.shutdown()
if os.environ.get('MOSAIC_PERF_OUTPUT'):Path(os.environ['MOSAIC_PERF_OUTPUT']).write_text(json.dumps(results,indent=2)+'\n')
