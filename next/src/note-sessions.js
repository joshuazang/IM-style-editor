/* Unconfirmed changes and unfinished edits live only in this editor's RAM.
 * Acknowledgments release confirmed sessions; foreign text always requires review. */
class ImNoteSessions {
  constructor(notify=()=>{}){this.notify=notify;this.retained=new Map();this.edits=new Map();this.titles=new Map();this.active=null;}
  create(note){return {note,lastHostText:note.content?.text||'',lastAck:null,revision:0,pending:0,dirty:false,error:'',remote:null,comparison:null,nativeRepair:false};}
  record(uuid){return this.active?.note.uuid===uuid?this.active:this.retained.get(uuid);}
  keep(s){if(s.dirty||s.pending||s.remote||this.edits.has(s.note.uuid)||this.titles.has(s.note.uuid))this.retained.set(s.note.uuid,s);else this.retained.delete(s.note.uuid);}
  known(s,text){const queue=imNoteSaves.get(s.note.uuid);return [s.note.content.text,s.lastHostText,s.lastAck?.text,queue?.current?.snapshot.text,queue?.next?.snapshot.text].includes(text);}
  echo(s,host){const queue=imNoteSaves.get(s.note.uuid),native=imNoteNativeSignature(host);return [s.lastAck,queue?.current?.snapshot,queue?.next?.snapshot].some(snapshot=>snapshot?.text===host.content?.text&&(snapshot.native||imNoteNativeSignature(snapshot.item))===native);}
  canWrite(note){const s=this.record(note?.uuid);return !!s&&s.note===note&&!s.remote&&!note.deleted;}
  paused(uuid){return !!this.record(uuid)?.remote;}
  metadata(host){const s=this.record(host.uuid);if(s)imNoteMetadataReceived(s.note,host);}
  native(s,host){
    const current=imNoteNativeSignature(s.note),incoming=imNoteNativeSignature(host);
    if(s.nativeRepair&&incoming!==current&&this.echo(s,host)){imNoteMetadataReceived(s.note,{...host,isMetadataUpdate:true});return;}
    imApplyNoteNative(s.note,host);s.lastHostText=host.content?.text||'';
    if(host.deleted){imCancelQueuedNoteSaves(host.uuid);s.error='This note is deleted. Restore it in Standard Notes before editing.';this.notify();return;}
    if(current!==incoming){
      const rebased=imRebaseQueuedNote(s.note.uuid,host);
      if(s.pending&&!s.remote){s.nativeRepair=true;if(!rebased&&this.active===s)this.persist(s.note).catch(()=>{});}
    }
    if(!s.pending&&!s.dirty&&!s.error)imNoteReceived(s.note);
  }
  receive(host){
    if(!host?.uuid||!host.content)return null;
    let s=this.record(host.uuid);const switching=this.active?.note.uuid!==host.uuid,text=host.content.text||'';
    if(s&&(s.note.content.text===text||((s.pending||s.error||s.dirty||s.remote)&&this.known(s,text)))){
      this.native(s,host);
      if(!switching)return null;
    }else if(s&&(s.pending||s.dirty||s.error||this.edits.has(host.uuid)||this.titles.has(host.uuid))){
      s.remote=host;this.retained.set(host.uuid,s);imCancelQueuedNoteSaves(host.uuid);this.notify();
      if(!switching)return null;
    }else{s=this.create(host);imNoteReceived(host);}
    if(this.active&&this.active!==s)this.keep(this.active);
    this.active=s;this.keep(s);
    if(s.pending||s.dirty||s.error||s.remote)imNoteUnconfirmed(s.note);
    this.notify();return s.note;
  }
  rememberEdit(note,id,text){
    let edit=this.edits.get(note.uuid);
    if(!edit||edit.id!==id)edit={id,text,submittedText:null};else edit.text=text;
    this.edits.set(note.uuid,edit);const s=this.record(note.uuid);if(s)this.keep(s);
  }
  editFor(uuid){return this.edits.get(uuid);}
  cancelEdit(uuid,id){if(this.edits.get(uuid)?.id===id)this.edits.delete(uuid);const s=this.record(uuid);if(s)this.keep(s);}
  submitEdit(uuid,id,text){const edit=this.edits.get(uuid);if(edit?.id===id)edit.submittedText=text;}
  titleFor(uuid){return this.titles.get(uuid);}
  rememberTitle(note,id,text){
    const old=this.titles.get(note.uuid),message=imFormat.readMessages(note).find(m=>m.id===id);if(!message)return;
    this.titles.set(note.uuid,old?.id===id?{...old,text}:{id,text,original:imFormat.title(message),submittedText:null});
    const s=this.record(note.uuid);if(s)this.keep(s);this.notify();
  }
  cancelTitle(uuid){this.titles.delete(uuid);const s=this.record(uuid);if(s)this.keep(s);this.notify();}
  submitTitle(uuid,text){const edit=this.titles.get(uuid);if(edit)edit.submittedText=text;}
  holdDraft(note){const s=this.record(note.uuid);if(s){s.dirty=true;this.keep(s);}}
  persist(note){
    const s=this.record(note.uuid);
    if(!s||s.note!==note||s.remote||note.deleted){const p=Promise.reject(new Error('Saving is paused. Your local changes are retained.'));p.catch(()=>{});return p;}
    const version=++s.revision,submitted={text:note.content.text,native:imNoteNativeSignature(note)};
    const edit=this.edits.get(note.uuid),savedEdit=edit&&imFormat.readMessages(note).find(m=>m.id===edit.id&&m.text===edit.submittedText);
    const heading=this.titles.get(note.uuid),submittedTitleText=heading?.submittedText,savedTitle=heading&&submittedTitleText!==null&&imFormat.readMessages(note).find(m=>m.id===heading.id&&imFormat.title(m)===(submittedTitleText.trim()?submittedTitleText:''));
    s.pending++;s.dirty=true;s.error='';this.keep(s);this.notify();
    const promise=imPersistNote(note).then(()=>{
      s.lastAck=imConfirmedNote?.note===note&&imConfirmedNote.snapshot?imConfirmedNote.snapshot:submitted;
      if(s.remote||note.deleted)return;
      if(version===s.revision){s.error='';s.dirty=false;s.nativeRepair=false;s.comparison=null;}
      const current=this.edits.get(note.uuid);
      if(savedEdit&&current?.id===savedEdit.id&&current.text===savedEdit.text)this.edits.delete(note.uuid);
      const currentTitle=this.titles.get(note.uuid);
      if(savedTitle&&currentTitle?.id===savedTitle.id){
        if(currentTitle.text===submittedTitleText)this.titles.delete(note.uuid);
        else currentTitle.original=imFormat.title(savedTitle);
      }
    },error=>{
      if(version===s.revision){s.error='Could not save your changes. Your changes are retained in this editor; retry saving.';s.dirty=true;}
      throw error;
    }).finally(()=>{s.pending--;this.keep(s);this.notify();});
    promise.catch(()=>{});return promise;
  }
  resolve(uuid,choice){
    const s=this.record(uuid),remote=s?.remote||s?.comparison;if(!s||!remote||s.pending)return null;
    if(choice==='remote'){
      this.edits.delete(uuid);this.titles.delete(uuid);this.retained.delete(uuid);if(this.active===s)this.active=null;return remote;
    }
    if(choice!=='local')return null;
    imApplyNoteNative(s.note,remote);s.lastHostText=remote.content.text;s.comparison=remote;s.remote=null;s.error='';s.dirty=true;
    const edit=this.edits.get(uuid);
    if(edit){
      const messages=imFormat.readMessages(s.note);if(messages.some(m=>m.id===edit.id)){
        imFormat.write(s.note,messages.map(m=>m.id===edit.id?imFormat.editMessage(m,edit.text):m),imFormat.readSettings(s.note));edit.submittedText=edit.text;
      }
    }
    const heading=this.titles.get(uuid);
    if(heading){const messages=imFormat.readMessages(s.note);if(messages.some(m=>m.id===heading.id)){imFormat.write(s.note,messages.map(m=>m.id===heading.id?imFormat.withTitle(m,heading.text):m),imFormat.readSettings(s.note));heading.submittedText=heading.text;}}
    this.keep(s);imNoteUnconfirmed(s.note);this.notify();return s.note;
  }
}

function ImNoteSessionNotice({sessions,note,retry,resolve}){
  const [review,setReview]=dt.useState(false),uuid=note?.uuid,s=sessions.record(uuid);
  dt.useEffect(()=>setReview(false),[uuid]);
  if(!s||(!s.remote&&!s.error))return null;
  const remote=s.remote||s.comparison,edit=sessions.editFor(uuid),heading=sessions.titleFor(uuid);
  return x.jsxs(x.Fragment,{children:[
    x.jsxs('div',{className:'save-notice',role:'alert',children:[s.remote?'Standard Notes sent a different version. Saving is paused; both versions are retained for review.':s.error,
      !s.remote&&!note.deleted&&x.jsx('button',{type:'button',onClick:retry,children:'Retry save'}),
      remote&&x.jsx('button',{type:'button',onClick:()=>setReview(true),children:'Review text'})]}),
    review&&remote&&x.jsx('div',{className:'transfer-backdrop',children:x.jsxs('section',{className:'transfer-dialog',role:'dialog','aria-modal':true,'aria-label':'Review note versions',onKeyDown:event=>{
      if(event.key==='Escape'){event.stopPropagation();setReview(false);}
      if(event.key==='Tab'){const nodes=[...event.currentTarget.querySelectorAll('button:not(:disabled),textarea')],first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    },children:[
      x.jsx('h2',{children:'Review note versions'}),
      x.jsx('p',{children:'Copy either version before choosing. Already-sent saves must finish before a version can be chosen.'}),
      x.jsx(ImPrivateTextarea,{readOnly:true,'aria-label':'Current local note text',value:s.note.content.text,autoFocus:true}),
      edit&&x.jsx(ImPrivateTextarea,{readOnly:true,'aria-label':'Unfinished message edit',value:edit.text}),
      heading&&x.jsx(ImPrivateTextarea,{readOnly:true,'aria-label':'Unfinished title',value:heading.text}),
      x.jsx(ImPrivateTextarea,{readOnly:true,'aria-label':'Standard Notes version',value:remote.content.text}),
      x.jsxs('div',{className:'transfer-actions',children:[
        x.jsx('button',{type:'button',onClick:()=>setReview(false),children:'Close'}),
        x.jsx('button',{type:'button',disabled:!!s.pending,onClick:()=>{if(window.confirm('Use the Standard Notes version and discard the local changes shown here?')){resolve('remote');setReview(false);}},children:'Use Standard Notes version'}),
        x.jsx('button',{type:'button',disabled:!!s.pending,onClick:()=>{if(window.confirm('Save the local version over the Standard Notes version shown here?')){resolve('local');setReview(false);}},children:'Save my local version'})]})]})})]});
}
