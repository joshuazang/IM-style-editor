"""A delayed first render must not consume the visible card transition."""
import functools, http.server, json, subprocess, threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_engine import chromium_options

ROOT = Path(__file__).resolve().parents[1]
scope = {'__file__': str(ROOT / 'tests/mosaic-browser.py')}
exec((ROOT / 'tests/mosaic-browser.py').read_text().split('server=http.server.ThreadingHTTPServer', 1)[0], scope)
data = scope['fixture'](15)
data['settings']['pinnedMessageIds'] = []
paragraph = 'asdfasdfalk;sdjf;lkj;lkasdfasdfalk;sdjf;lkj;lkasdfasdfalk;sdjf;lkj;lk'
for message in data['messages']:
    message['text'] = '\n\n'.join([paragraph, paragraph * 2, paragraph])
    message['reactions'] = []
    message.pop('title', None)
    message.pop('replyTo', None)
data['note']['content']['text'] = subprocess.check_output([
    'node', '-e', "const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,d.draft));"
], cwd=ROOT, input=json.dumps(data), text=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**chromium_options())
        context = browser.new_context(viewport={'width': 1410, 'height': 821}, device_scale_factor=2)
        page = context.new_page()
        page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html')
        page.evaluate('(note)=>{notes.a=note;openEditor("a","/mosaic/index.html",false)}', data['note'])
        editor = page.frame_locator('#editor')
        expect(editor.locator('.card').first).to_be_visible()
        results = editor.locator('#board').evaluate('''async()=>{
          const paint=()=>new Promise(r=>requestAnimationFrame(r));
          // Choose a lower-right card, rather than the first/nearest card.
          const candidates=[...mounted.values()].filter(n=>{const r=n.getBoundingClientRect();return r.top>150&&r.bottom<innerHeight-100});
          const node=candidates.sort((a,b)=>b.getBoundingClientRect().right-a.getBoundingClientRect().right)[0];
          if(!node)throw Error('No lower-row test card');
          const results=[];
          async function sample(d,closing,delay){
            const a=d.cardAnimation,frames=[],start=modal.getBoundingClientRect().width;
            const end=closing?cardTransitionRect(node).width:modal.offsetWidth;
            if(delay)requestAnimationFrame(()=>{const until=performance.now()+delay;while(performance.now()<until){}});
            await new Promise(resolve=>{function tick(){
              frames.push((modal.getBoundingClientRect().width-start)/(end-start));
              if(d.motionStartFrame||a.pending||a.playState==='running')requestAnimationFrame(tick);else resolve();
            }requestAnimationFrame(tick)});
            const moving=frames.filter(v=>v>.001&&v<.999);
            if(moving.length<7)throw Error('Too few intermediate rectangles: '+JSON.stringify(frames));
            if(moving[0]>.4)throw Error('Startup consumed the transition: '+JSON.stringify(frames));
            if(frames.some((v,i)=>i&&v<frames[i-1]-.002))throw Error('Transition reversed unexpectedly');
            return {closing,delay,firstStep:+moving[0].toFixed(3),intermediateFrames:moving.length};
          }
          for(const delay of [0,220,220]){
            await paint();editorDialog(node.dataset.id);const d=modalState;
            results.push(await sample(d,false,delay));
            await paint();await paint();await paint();
            finishCard(d);results.push(await sample(d,true,delay));
            await paint();if(modal.open)throw Error('Close failed');
          }
          editorDialog(node.dataset.id);const early=modalState;finishCard(early);
          await paint();await paint();await paint();
          if(modal.open||early.motionStartFrame||early.cardAnimation.playState!=='idle'||node.style.visibility==='hidden')throw Error('Early close left pending playback');
          editorDialog(node.dataset.id);const interrupted=modalState;closeModal(true);
          await paint();await paint();await paint();
          if(modal.open||interrupted.motionStartFrame||node.style.visibility==='hidden')throw Error('Forced close restarted playback');
          return results;
        }''')
        assert page.evaluate('saves.length') == 0
        print(json.dumps({'PASS': 'delayed first paint: complete visible opening/closing; early/forced close cancellation', 'samples': results}), flush=True)
        context.close()
        browser.close()
finally:
    server.shutdown()
