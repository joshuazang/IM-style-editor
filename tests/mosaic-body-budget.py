"""Titles, tags and replies add height without consuming body preview lines."""
import functools,http.server,json,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from browser_engine import chromium_options
ROOT=Path(__file__).resolve().parents[1];scope={'__file__':str(ROOT/'tests/mosaic-browser.py')}
exec((ROOT/'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer',1)[0],scope)
data=scope['fixture'](7);body='\n'.join(['Long line']*100);rows=[];body_heights={}
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):self.send_header('Access-Control-Allow-Origin','*');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(**chromium_options())
  for width in [320,390,1280]:
   for font in ['small','medium','large','extra-large']:
    context=browser.new_context(viewport={'width':width,'height':2400},user_agent=('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' if width<600 else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'),is_mobile=width<600,has_touch=width<600);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    for tags,reply in [(False,False),(True,False),(False,True),(True,True)]:
     for i,m in enumerate(data['messages']):
      m['text']='Short' if i==0 else body;m['reactions']=['📓','✅','💡'] if tags and i else [];m.pop('replyTo',None);m.pop('title',None)
      if i>1:m['title']='\n'.join(['Heading']*[1,2,3,6,12][i-2])
      if reply and i:m['replyTo']={'id':data['messages'][0]['id'],'text':'Quoted text','noteId':'a'}
     data['settings']['pinnedMessageIds']=[];data['settings']['mosaicFontSize']=font
     data['note']['content']['text']=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(f.portable(d.messages,d.settings,'')));"],cwd=ROOT,input=json.dumps(data),text=True))
     page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",true)}',data['note']);e=page.frame_locator('#editor');expect(e.locator('.card')).to_have_count(7);page.wait_for_timeout(60)
     measurements=e.locator('.card').evaluate_all('ns=>ns.map(n=>{const t=n.querySelector(".card-title"),b=n.querySelector(".card-body"),r=n.getBoundingClientRect(),limit=MosaicModel.boardBounds(r.width,MosaicModel.appearance(active.settings).fontSize,boardPreviewRatio).maximum;return {id:n.dataset.id,height:r.height,maximum:limit,unused:limit-r.height,bodyLine:parseFloat(getComputedStyle(b).lineHeight),titleLine:t?parseFloat(getComputedStyle(t).lineHeight):0,titleVisible:t?t.clientHeight:0,bodyVisible:b.clientHeight,extras:[...n.children].filter(c=>c!==b).reduce((sum,c)=>sum+c.getBoundingClientRect().height+parseFloat(getComputedStyle(c).marginTop),0)+parseFloat(getComputedStyle(b).marginTop),bodyLines:getComputedStyle(b).webkitLineClamp,truncated:b.scrollHeight>b.clientHeight}})')
     byid={m['id']:m for m in measurements};baseline=byid[data['messages'][0]['id']]['height'];untitled=byid[data['messages'][1]['id']]
     for i,m in enumerate(data['messages'][1:],1):
      result={**byid[m['id']],'width':width,'font':font,'tags':tags,'reply':reply,'titleLines':0 if i==1 else [1,2,3,6,12][i-2]};result['differenceFromUntitled']=result['height']-untitled['height'];rows.append(result)
      assert abs(result['maximum']-(8 if width<600 else 14)*baseline)<1,result
      key=(width,font);body_heights.setdefault(key,result['bodyVisible']);assert result['bodyVisible']==body_heights[key],result
      assert abs(result['height']-result['maximum']-result['extras'])<1,result
      assert result['truncated'],result
     assert page.evaluate('saves.length')==0
     if width==1280 and font=='large' and not tags and not reply:page.screenshot(path='/tmp/mosaic-titled-height-comparison.png')
    assert not errors,errors;context.close()
  browser.close()
finally:server.shutdown()
Path('/tmp/mosaic-title-height-results.json').write_text(json.dumps(rows,indent=2))
print(f'PASS {len(rows)} cases: identical body preview height/line allowance across titles, tags and replies; added metadata height exactly matches; zero saves.',flush=True)
