/* Readable React hooks/components, inlined with the existing static runtime. */
function imUseTransfer({ noteRef, messages, settings, save, clearFilters, selected }) {
  const [dialog, setDialog] = dt.useState(null);
  const [notice, setNotice] = dt.useState('');
  const latest = dt.useRef(null);
  latest.current = { messages, settings, save, clearFilters, selected };
  const noteId = noteRef.current?.uuid;
  const request = dt.useRef(0);
  dt.useEffect(() => {
    request.current++; setDialog(null); setNotice('');
  }, [noteId]);
  const copyForward = async () => {
    const note = noteRef.current;
    if (!note) return;
    const records = latest.current.messages.filter(message => latest.current.selected.has(message.id));
    if (!records.length) return;
    const text = imTransfer.create(records, latest.current.settings, note.uuid);
    const uuid = note.uuid;
    try {
      await navigator.clipboard.writeText(text);
      if (noteRef.current?.uuid === uuid) setNotice(`${records.length} message${records.length === 1 ? '' : 's'} copied for forwarding, with timestamps and tags.`);
    } catch {
      if (noteRef.current?.uuid === uuid) setDialog({ kind: 'export', text, uuid });
    }
  };
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
  const apply = async () => {
    if (!dialog || dialog.kind !== 'import' || dialog.busy || dialog.reading || noteRef.current?.uuid !== dialog.uuid) return;
    const payload = imTransfer.read(dialog.text);
    if (!payload.ok) { setDialog(current => ({ ...current, error: payload.error })); return; }
    const destination = latest.current;
    const result = imTransfer.merge(destination.messages, payload);
    if (!result.added.length) {
      setNotice('These messages are already in this note. No duplicates were added.'); close(); return;
    }
    // Keep the destination appearance and manual order; append unfamiliar tags.
    const usedTags = new Set(result.added.flatMap(message => message.reactions));
    const order = [...new Set([...(destination.settings.reactionOrder || []),
      ...(Array.isArray(payload.settings.reactionOrder) ? payload.settings.reactionOrder.filter(tag => typeof tag === 'string' && usedTags.has(tag)) : []), ...usedTags])];
    setDialog(current => ({ ...current, busy: true }));
    try {
      const saved = destination.save(result.messages, { ...destination.settings, reactionOrder: order });
      if (!saved) throw new Error('Saving is currently paused.');
      await saved;
      if (noteRef.current?.uuid !== dialog.uuid) return;
      destination.clearFilters();
      setNotice(`Imported ${result.added.length} forwarded message${result.added.length === 1 ? '' : 's'}${result.skipped ? `; ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped` : ''}.`);
      close();
    } catch {
      if (noteRef.current?.uuid === dialog.uuid) setDialog(current => ({ ...current, busy: false,
        error: 'The host has not confirmed saving. Keep this note open, close this window, and use Retry save above. Your clipboard and the existing messages have not been replaced.' }));
    }
  };
  return { dialog, notice, copyForward, openImport, close, apply, dismissNotice: () => setNotice(''),
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
  const exported = dialog.kind === 'export';
  const parsed = exported || !dialog.text.trim() ? null : imTransfer.read(dialog.text);
  const error = dialog.error || (parsed && !parsed.ok ? parsed.error : '');
  return x.jsx('div', { className: 'transfer-backdrop', onPointerDown: event => {
    if (event.target === event.currentTarget && !dialog.busy) transfer.close();
  }, children: x.jsxs('section', { ref: box, className: 'transfer-dialog', role: 'dialog', 'aria-modal': true,
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
      x.jsx('h2', { id: 'transfer-title', children: exported ? 'Copy for forwarding' : 'Import from clipboard' }),
      x.jsx('p', { children: exported ? 'Clipboard access was blocked. Copy all the text below; it contains the complete selected message records.' :
        'Import a Copy for forwarding export or a complete IM note. Your current messages and appearance stay in place. Imported bubbles keep their timestamps and tags and show a Forwarded label.' }),
      dialog.hint && x.jsx('p', { children: dialog.hint }),
      x.jsx('textarea', { 'aria-label': exported ? 'Forwarding export' : 'Paste forwarded messages', value: dialog.text,
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
      x.jsxs('div', { className: 'transfer-actions', children: [
        x.jsx('button', { type: 'button', className: 'plain', disabled: dialog.busy, onClick: transfer.close, children: exported ? 'Close' : 'Cancel' }),
        exported ? x.jsx('button', { type: 'button', onClick: () => {
          const field = box.current.querySelector('textarea'); field.focus(); field.select();
          if (!document.execCommand('copy')) field.select();
        }, children: 'Select and copy' }) :
        x.jsx('button', { type: 'button', disabled: !parsed?.ok || dialog.busy || dialog.reading, onClick: transfer.apply,
          children: dialog.busy ? 'Saving…' : 'Import messages' })
      ] })
    ] }) });
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
