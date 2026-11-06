/* Compatibility copy path for hosts that deny the asynchronous clipboard API. */
function imLegacyCopy(text) {
  const active=document.activeElement;
  const start=active?.selectionStart,end=active?.selectionEnd;
  const ranges=window.getSelection();
  const saved=ranges?[...Array(ranges.rangeCount)].map((_,i)=>ranges.getRangeAt(i).cloneRange()):[];
  const field=document.createElement('textarea');field.value=text;field.readOnly=true;
  field.style.cssText='position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px';
  document.body.append(field);field.select();field.setSelectionRange(0,text.length);
  let copied=false;
  try{copied=document.execCommand('copy')}catch{}finally{
    field.remove();
    if(active?.isConnected){active.focus({preventScroll:true});if(typeof start==='number'&&active.setSelectionRange)active.setSelectionRange(start,end)}
    if(ranges){ranges.removeAllRanges();for(const range of saved)if(range.commonAncestorContainer.isConnected)ranges.addRange(range)}
  }
  return copied;
}
async function imWriteClipboard(text) {
  try{await navigator.clipboard.writeText(text);return true}catch{return imLegacyCopy(text)}
}
/* Run synchronously from the explicit confirmation click. The official sandbox
 * can deny navigator.clipboard even when gesture-driven compatibility copy works.
 * Override the copy event so the clipboard receives empty text, not a placeholder.
 */
function imLegacyClearClipboard() {
  let handled=false;
  const clear=event=>{
    event.preventDefault();
    try{
      if(!event.clipboardData)return;
      event.clipboardData.clearData();event.clipboardData.setData('text/plain','');handled=true;
    }catch{}
  };
  document.addEventListener('copy',clear,true);
  try{return imLegacyCopy(' ')&&handled}
  catch{return false}
  finally{document.removeEventListener('copy',clear,true)}
}
async function imClearClipboard() {
  if(imLegacyClearClipboard())return true;
  try{await navigator.clipboard.writeText('');return true}catch{return false}
}
/* Readable React hooks/components, inlined with the existing static runtime. */
function imUseTransfer({ noteRef, messages, settings, save, clearFilters, selected }) {
  const [dialog, setDialog] = dt.useState(null);
  const [notice,setNoticeValue]=dt.useState(''),noticeTimer=dt.useRef(0);
  const setNotice=value=>{clearTimeout(noticeTimer.current);setNoticeValue(value);if(value)noticeTimer.current=setTimeout(()=>setNoticeValue(''),5000)};
  dt.useEffect(()=>()=>clearTimeout(noticeTimer.current),[]);
  const latest = dt.useRef(null);
  latest.current = { messages, settings, save, clearFilters, selected };
  const noteId = noteRef.current?.uuid;
  const request = dt.useRef(0);
  dt.useEffect(() => {
    request.current++; setDialog(null); setNotice('');
  }, [noteId]);
  const mark=(records,flag,uuid)=>{
    const note=noteRef.current;if(!note||note.uuid!==uuid)return;
    const originals=new Map(records.map(message=>[message.id,message.text]));
    const current=imFormat.readMessages(note);
    const next=current.map(message=>originals.get(message.id)===message.text&&!Object.hasOwn(message,flag)
      ? {...message,[flag]:true}:message);
    if(next.some((message,i)=>message!==current[i]))latest.current.save(next)?.catch(()=>{});
  };
  const exportRecords = async (records, replyExport=false, sourceNoteId=null) => {
    const note = noteRef.current;
    if (!note) return;
    if (!records.length) return;
    const text = imTransfer.create(records.map(message=>({...message,exported:true})), latest.current.settings, sourceNoteId??note.uuid);
    const uuid = note.uuid;
    const copied=await imWriteClipboard(text);
    if(noteRef.current?.uuid!==uuid)return;
    if(copied){mark(records,'exported',uuid);setNotice(replyExport?'Copied. Open another note and choose Import from clipboard.':`${records.length} message${records.length === 1 ? '' : 's'} exported to clipboard, with timestamps and tags.`);}
    else setDialog({ kind: 'export', text, uuid, records, replyExport });
  };
  const exportSelected=()=>exportRecords(latest.current.messages.filter(message=>latest.current.selected.has(message.id)));
  const exportReply=reply=>{const original=imReplyTarget(latest.current.messages,reply,noteRef.current?.uuid);return exportRecords([original||imReplyRecord(reply)],true,original?null:reply.noteId);};
  const openImport = async () => {
    const note = noteRef.current;
    if (!note || imFormat.inspect(note.content?.text).kind === 'damaged') return;
    const uuid = note.uuid, ticket = ++request.current;
    setDialog({ kind: 'import', text: '', uuid, reading: true });
    try {
      const text = await navigator.clipboard.readText();
      if (ticket === request.current && noteRef.current?.uuid === uuid) setDialog({ kind: 'import', text, uuid });
    } catch {
      if (ticket === request.current && noteRef.current?.uuid === uuid) setDialog({ kind: 'import', text: '', uuid,
        hint: 'Your browser could not read the clipboard. Paste the copied messages below instead.' });
    }
  };
  const close = () => { request.current++; setDialog(null); };
  const openClearClipboard=()=>{
    request.current++;setDialog({kind:'clear',uuid:noteRef.current?.uuid});
  };
  const clearClipboard=async()=>{
    if(dialog?.kind!=='clear'||dialog.busy)return;
    const ticket=++request.current;
    setDialog(current=>({...current,busy:true,error:''}));
    const cleared=await imClearClipboard();
    if(ticket!==request.current)return;
    if(cleared){setDialog(null);setNotice('Clipboard cleared')}
    else setDialog(current=>({...current,busy:false,error:'Clipboard clearing was blocked. Try again while the editor is open.'}));
  };
  const apply = async (clearAfter=false) => {
    clearAfter=clearAfter===true;
    if (!dialog || dialog.kind !== 'import' || dialog.busy || dialog.reading || noteRef.current?.uuid !== dialog.uuid) return;
    const payload = imTransfer.read(dialog.text);
    if (!payload.ok) { setDialog(current => ({ ...current, error: payload.error })); return; }
    const destination = latest.current;
    const result = imTransfer.merge(destination.messages, payload);
    if (!result.added.length&&!clearAfter) {
      setNotice('These messages are already in this note. No duplicates were added.'); close(); return;
    }
    // Keep the destination appearance and manual order; append unfamiliar tags.
    const usedTags = new Set(result.added.flatMap(message => message.reactions));
    const order = [...new Set([...(destination.settings.reactionOrder || []),
      ...(Array.isArray(payload.settings.reactionOrder) ? payload.settings.reactionOrder.filter(tag => typeof tag === 'string' && usedTags.has(tag)) : []), ...usedTags])];
    setDialog(current => ({ ...current, busy: true, clearAfter }));
    try {
      const saved = destination.save(result.messages, { ...destination.settings, reactionOrder: order });
      if (!saved) throw new Error('Saving is currently paused.');
      await saved;
      if (noteRef.current?.uuid !== dialog.uuid) return;
      destination.clearFilters();
      setNotice(result.added.length?`Imported ${result.added.length} message${result.added.length === 1 ? '' : 's'}${result.skipped ? `; ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped` : ''}.`:'These messages are already in this note. No duplicates were added.');
      if(clearAfter)openClearClipboard();else close();
    } catch {
      if (noteRef.current?.uuid === dialog.uuid) setDialog(current => ({ ...current, busy: false,
        error: 'The host has not confirmed saving. Keep this note open, close this window, and use Retry save above. Your clipboard and the existing messages have not been replaced.' }));
    }
  };
  const copyRecords=async records=>{
    const uuid=noteRef.current?.uuid;if(!uuid||!records.length)return;
    const text=records.map(message=>message.text).join('\n\n');
    const copied=await imWriteClipboard(text);
    if(noteRef.current?.uuid!==uuid)return;
    if(copied){mark(records,'copied',uuid);setNotice('Copied')}
    else setDialog({kind:'copy',text,uuid,records});
  };
  const copyMessage=message=>copyRecords([message]);
  const copySelected=()=>copyRecords(latest.current.messages.filter(message=>latest.current.selected.has(message.id)));
  const manualCopied=()=>{if(dialog){mark(dialog.records||[],dialog.kind==='export'?'exported':'copied',dialog.uuid);setNotice(dialog.replyExport?'Copied. Open another note and choose Import from clipboard.':dialog.kind==='export'?'Exported to clipboard':'Copied')}};
  return { dialog, notice, exportSelected, exportReply, copyMessage, copySelected, manualCopied, openImport, openClearClipboard, clearClipboard, close, apply, dismissNotice: () => setNotice(''), notify:setNotice,
    edit: text => { request.current++; setDialog(current => ({ ...current, text, reading: false, error: '' })); } };
}
function ImTransferDialog({ transfer }) {
  const { dialog } = transfer;
  const box = dt.useRef(null), previouslyFocused = dt.useRef(null);
  dt.useEffect(() => {
    previouslyFocused.current = document.activeElement;
    box.current?.querySelector('textarea')?.focus();
    return () => previouslyFocused.current?.isConnected && previouslyFocused.current.focus();
  }, []);
  const exported = dialog.kind !== 'import', plain = dialog.kind === 'copy';
  const parsed = exported || !dialog.text.trim() ? null : imTransfer.read(dialog.text);
  const error = dialog.error || (parsed && !parsed.ok ? parsed.error : '');
  return x.jsx('div', { className: 'transfer-backdrop', onPointerDown: event => {
    if (event.target === event.currentTarget && !dialog.busy) transfer.close();
  }, children: x.jsxs('section', { ref: box, className: `transfer-dialog${exported?' manual-copy-dialog':''}`, role: 'dialog', 'aria-modal': true,
    'aria-labelledby': 'transfer-title', onKeyDown: event => {
      event.stopPropagation();
      if (event.key === 'Escape' && !dialog.busy) { event.preventDefault(); transfer.close(); }
      if (event.key === 'Tab') {
        const elements = [...box.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];
        const first = elements[0], last = elements.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }, children: [
      x.jsx('h2', { id: 'transfer-title', children: plain ? 'Copy message' : exported ? 'Export messages' : 'Import from clipboard' }),
      x.jsx('p', { children: exported ? (plain?'Automatic copying was unavailable. Select and copy the message below.':'Automatic copying was unavailable. Copy all the text below; it contains the complete selected message records.') :
        'Import an exported message selection or a complete IM note. Your current messages and appearance stay in place. Imported bubbles keep their timestamps and tags and show an Imported label.' }),
      dialog.hint && x.jsx('p', { children: dialog.hint }),
      x.jsx('textarea', { 'aria-label': plain ? 'Message text to copy' : exported ? 'Message export' : 'Paste exported messages', value: dialog.text,
        readOnly: exported, disabled: dialog.busy, onChange: event => transfer.edit(event.target.value),
        onFocus: exported ? event => event.currentTarget.select() : undefined, spellCheck: false }),
      dialog.reading && x.jsx('p', { role: 'status', children: 'Reading clipboard… You can also paste below.' }),
      parsed?.ok && x.jsxs('div', { className: 'transfer-preview', children: [
        x.jsx('p', { children: `${parsed.messages.length} message${parsed.messages.length === 1 ? '' : 's'} ready to import` }),
        ...parsed.messages.map(message => x.jsxs('article', { children: [
          x.jsx('div', { className: 'transfer-preview-body', children: message.text }),
          x.jsx('small', { children: [message.createdAt || 'No timestamp', ' ', message.reactions.join(' ')] })
        ] }, message.id))
      ] }),
      error && x.jsx('p', { role: 'alert', children: error }),
      x.jsxs('div', { className: `transfer-actions${exported?'':' clipboard-import-actions'}`, children: [
        x.jsx('button', { type: 'button', className: 'plain', disabled: dialog.busy, onClick: transfer.close, children: exported ? 'Close' : 'Cancel' }),
        exported ? x.jsx('button', { type: 'button', onClick: () => {
          const field = box.current.querySelector('textarea'); field.focus(); field.select();
          let copied=false;try{copied=document.execCommand('copy')}catch{}
          if(copied)transfer.manualCopied();else field.select();
        }, children: 'Select and copy' }) :
        x.jsx('button', { type: 'button', disabled: !parsed?.ok || dialog.busy || dialog.reading, onClick: ()=>transfer.apply(false),
          children: dialog.busy&&!dialog.clearAfter ? 'Importing…' : 'Import' }),
        !exported&&x.jsx('button', { type:'button',className:'danger',disabled:!parsed?.ok||dialog.busy||dialog.reading,onClick:()=>transfer.apply(true),
          children:dialog.busy&&dialog.clearAfter?'Importing…':'Import and clear clipboard' })
      ] })
    ] }) });
}
function ImClearClipboardDialog({transfer}) {
  const root=dt.useRef(null),dialog=transfer.dialog;
  dt.useEffect(()=>{
    const previous=document.activeElement;root.current?.querySelector('button')?.focus({preventScroll:true});
    return()=>{const target=previous?.isConnected?previous:document.querySelector('.more-button,.composer textarea');target?.focus({preventScroll:true});};
  },[]);
  return x.jsx('div',{className:'transfer-backdrop',onPointerDown:event=>{
    if(event.target===event.currentTarget&&!dialog.busy)transfer.close();
  },children:x.jsxs('section',{
    ref:root,className:'transfer-dialog clipboard-clear-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'clipboard-clear-title',onKeyDown:event=>{
      event.stopPropagation();
      if(event.key==='Escape'&&!dialog.busy){event.preventDefault();transfer.close();}
      if(event.key==='Tab'){
        const buttons=[...root.current.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
        if(!first){event.preventDefault();return;}
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    },children:[
      x.jsx('h2',{id:'clipboard-clear-title',children:'Clear clipboard?'}),
      x.jsx('p',{children:'Do you want to clear your clipboard?'}),
      dialog.error&&x.jsx('p',{role:'alert',children:dialog.error}),
      x.jsxs('div',{className:'transfer-actions',children:[
        x.jsx('button',{type:'button',className:'plain',disabled:dialog.busy,onClick:transfer.close,children:'Cancel'}),
        x.jsx('button',{type:'button',className:'danger',disabled:dialog.busy,onClick:transfer.clearClipboard,children:dialog.busy?'Clearing…':'Yes, clear'})
      ]})
    ]})});
}
function ImRecoveryView({ error, restore }) {
  const proposal = error.proposal;
  return x.jsxs('div', { className: 'format-recovery', children: [
    x.jsx('p', { role: 'alert', children: proposal ?
      'The record separators appear to have changed. Saving is paused. Review the recovered bubbles below, then restore them. The complete original text will be kept in this note as a recovery backup. Line breaks that were already flattened cannot be reconstructed.' :
      'This note’s bubble records are incomplete or damaged. Saving is paused to protect the original. Open the plain-text editor to repair the records, or copy the complete original below.' }),
    proposal && x.jsxs('section', { className: 'recovery-preview', 'aria-label': 'Recovered bubbles preview', children: [
      x.jsx('p', { children: `${proposal.messages.length} bubbles recovered${proposal.extraText ? '; text outside the records is included as additional bubbles' : ''}.` }),
      x.jsx('button', { type: 'button', onClick: restore, children: 'Restore recovered bubbles' }),
      ...proposal.messages.map(message => x.jsxs('article', { children: [
        x.jsx('div', { className: 'transfer-preview-body', children: message.text }),
        x.jsx('small', { children: [message.createdAt || 'No timestamp', ' ', message.reactions.join(' ')] })
      ] }, message.id))
    ] }),
    x.jsxs('details', { open: !proposal, children: [x.jsx('summary', { children: 'Complete original text' }),
      x.jsx('textarea', { 'aria-label': 'Original note text for recovery', readOnly: true, value: error.text })] })
  ] });
}
