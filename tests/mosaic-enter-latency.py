"""Real desktop Card newline transactions stay immediate and save exact full drafts."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
scope={'__file__':str(ROOT/'tests/mosaic-phone-keyboard.py')};exec(Path(scope['__file__']).read_text().split('try:\n with sync_playwright()',1)[0],scope);globals().update(scope)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(**chromium_options())
  for kind,text in [('paragraphs',('A long paragraph of readable text. '*20+'\n\n')*1200),('structured','# Heading\n\n'+('A long paragraph of readable text. '*20+'\n\n')*400),('softlines',('A long line of readable text. '*10+'\n')*1200),('normal',('A sentence to edit. '*20+'\n\n')*15)]:
   data['messages'][0]['text']=text;data['note']['content']['text']=subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),crypto=require('crypto');const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(f.portable(d.messages,d.settings,''));"],cwd=ROOT,input=json.dumps(data),text=True)
   page=b.new_page(viewport={'width':1100,'height':900},user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 Chrome/130.0.0.0 Electron/33.0.0 Safari/537.36');page.add_init_script("Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'})");page.goto(f'http://127.0.0.1:{server.server_port}/tests/mosaic-host.html');page.evaluate('note=>{notes.a=note;openEditor("a","/mosaic/index.html",false)}',data['note']);e=page.frame_locator('#editor');e.locator('.card').first.click();body=e.get_by_role('textbox',name='Card body',exact=True);expect(body).to_be_editable();e.locator('dialog').evaluate('async n=>{await Promise.all(n.getAnimations().map(a=>a.finished.catch(()=>{})))}');body.press('Control+End');body.evaluate('n=>{window.samples=[];const wrap=(obj,name,label)=>{const fn=obj[name];obj[name]=function(...args){const start=performance.now();try{return fn.apply(this,args)}finally{samples.push({phase:label,ms:performance.now()-start})}}};wrap(imMarkdown,"serialize","serialize");wrap(n.imRich.view,"updateState","view-update");wrap(n.imRich.view,"dispatch","transaction");}')
   body.evaluate('''n=>{
     const setExtent=Selection.prototype.setBaseAndExtent;
     Selection.prototype.setBaseAndExtent=function(...args){
       samples.push({phase:'caret-extent'});
       return setExtent.apply(this,args);
     };
   }''')
   cdp=page.context.new_cdp_session(next(f for f in page.frames if f.parent_frame));cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
   for key in ['Shift+Enter','Shift+Enter','Enter','Enter']:
    before=body.evaluate('''n=>{
      const v=n.imRich.view,at=Math.max(1,Math.floor(v.state.doc.firstChild.content.size*.65));
      v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.create(v.state.doc,at)));
      samples=[];
      return {at,blocks:v.state.doc.childCount};
    }''')
    body.press(key)
    body.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    samples=body.evaluate('()=>samples')
    transactions=[s['ms'] for s in samples if s['phase']=='transaction']
    assert len(transactions)==1,samples
    assert transactions[0]<250,(kind,key,samples)
    after=body.evaluate('''n=>{
      const view=n.imRich.view,{head,$head}=view.state.selection,selection=getSelection();
      return {head,blocks:view.state.doc.childCount,previous:$head.nodeBefore?.type.name,
        nativeHead:view.posAtDOM(selection.focusNode,selection.focusOffset),collapsed:selection.isCollapsed};
    }''')
    assert after['collapsed'] and after['nativeHead']==after['head'],(kind,key,before,after)
    if key=='Shift+Enter':
     assert after['blocks']==before['blocks'] and after['head']==before['at']+1 and after['previous']=='hard_break',after
     assert sum(s['phase']=='caret-extent' for s in samples)==1,(kind,key,samples)
    else:
     assert after['blocks']==before['blocks']+1,after
     assert all(s['phase']!='caret-extent' for s in samples),(kind,key,samples)
    print(kind,key,samples,flush=True)
   value=body.evaluate('n=>n.value');e.get_by_role('button',name='Close',exact=True).click();expect(e.locator('dialog')).not_to_be_visible();assert scope['parse'](page.evaluate('notes.a.content.text'))['messages'][0]['text']==value;page.close()
  b.close()
finally:server.shutdown()
