/* Host note updates, local session retention, and acknowledged saves. */
function sessionEcho(s, note) {
  const queue = imNoteSaves.get(note.uuid),
    native = imNoteNativeSignature(note),
    text = note.content?.text || '';
  return [queue?.current?.snapshot, queue?.next?.snapshot, s.lastAck].some(snapshot => snapshot && snapshot
    .text === text && (snapshot.native || imNoteNativeSignature(snapshot.item)) === native);
}

function knownSessionText(s, text) {
  const queue = imNoteSaves.get(s.note.uuid);
  return [s.note.content.text, s.lastHostText, s.lastAck?.text, queue?.current?.snapshot.text, queue?.next
    ?.snapshot.text
  ].includes(text);
}

function receiveNativeFields(s, note) {
  const signature = imNoteNativeSignature(s.note),
    incoming = imNoteNativeSignature(note);
  if (s.nativeRepair && incoming !== signature && sessionEcho(s, note)) {
    imNoteMetadataReceived(s.note, {
      ...note,
      isMetadataUpdate: true
    });
    return;
  }
  imApplyNoteNative(s.note, note);
  s.lastHostText = note.content?.text || '';
  s.deleted = !!note.deleted;
  if (s.deleted) {
    imCancelQueuedNoteSaves(note.uuid);
    renderNotice();
    renderCapture();
    return;
  }
  if (signature !== incoming) {
    const rebased = imRebaseQueuedNote(s.note.uuid, note);
    if (s.pending && !s.remote) {
      s.nativeRepair = true;
      if (!rebased && active === s) safeRun(() => persist(s));
    }
  }
  if (!s.dirty && !s.pending && !s.error) imNoteReceived(s.note);
}

function receive(note, force = false) {
  if (!note || !note.uuid) return;
  if (active && active.note.uuid !== note.uuid && !note.isMetadataUpdate) closeTrash(false);
  if (active && (active.note.uuid !== note.uuid || !note.isMetadataUpdate && active.note.content.text !== (note
      .content?.text || '') && !knownSessionText(active, note.content?.text || ''))) {
    boardDrag.reset();
    boardMotion.reset();
  }
  if (note.isMetadataUpdate === true) {
    const s = active?.note.uuid === note.uuid ? active : retainedSessions.get(note.uuid);
    if (s) imNoteMetadataReceived(s.note, note);
    return;
  }
  if (active?.note.uuid === note.uuid && !force) {
    const s = active,
      text = note.content?.text || '';
    if (s.note.content?.text === text || ((s.pending || s.error) && knownSessionText(s, text))) {
      receiveNativeFields(s, note);
      return;
    }
    const editing = modalState?.uuid === note.uuid && cardEditChanged();
    if (s.pending || s.error || s.dirty || s.captureStarted != null || editing || s.titleEntry) {
      s.remote = note;
      imCancelQueuedNoteSaves(note.uuid);
      flushCapture(s);
      retainedSessions.set(note.uuid, s);
      renderNotice();
      return;
    }
  }
  const previous = active;
  if (previous?.titleEntry) retainedSessions.set(previous.note.uuid, previous);
  if (previous) {
    previous.view.scroll = viewport.scrollTop;
    viewMemory.set(previous.note.uuid, previous.view);
    stashEdit();
    if (previous.note.uuid !== note.uuid) {
      flushCapture(previous);
      flushCardEdit();
    }
  }
  closeModal(true);
  if (previous?.note.uuid !== note.uuid) revealedCardSpoilers.clear();
  hideMenu();
  dateOpen = false;
  $('date-panel').replaceChildren();
  if (force) {
    const discarded = retainedSessions.get(note.uuid) || previous;
    if (discarded?.note.uuid === note.uuid) {
      discarded.discarded = true;
      clearTimeout(discarded.captureTimer);
      imCancelQueuedNoteSaves(note.uuid);
      retainedSessions.delete(note.uuid);
    }
    for (const [key, entry] of unfinishedEdits)
      if (entry.noteId === note.uuid) unfinishedEdits.delete(key);
  }
  const retained = !force && retainedSessions.get(note.uuid);
  if (retained) {
    active = retained;
    imNoteUnconfirmed(retained.note);
    const text = note.content?.text || '';
    if (knownSessionText(retained, text)) receiveNativeFields(retained, note);
    else {
      retained.remote = note;
      imCancelQueuedNoteSaves(note.uuid);
    }
    $('search').value = retained.view.query;
    renderAll();
    viewport.scrollTop = retained.view.scroll || 0;
    scheduleWindow();
    if (retained.cardSavePending && writable(retained)) {
      if (retained.pending) retained.retryCardOnReturn = true;
      else safeRun(() => persist(retained));
    }
    safeRun(() => applyTransferMarks(retained));
    return;
  }
  const parsed = imFormat.inspect(note.content?.text);
  const s = {
    note,
    messages: imFormat.readMessages(note),
    settings: imFormat.readSettings(note),
    draft: imFormat.readDraft(note),
    reply: imFormat.readReply(note),
    damaged: parsed.kind === 'damaged',
    plain: parsed.kind === 'plain' && !!note.content?.text,
    deleted: !!note.deleted,
    view: newView(note.uuid),
    pending: 0,
    revision: 0,
    error: '',
    remote: null,
    intents: new Set(),
    demo: !!note.mosaicDemo,
    captureValue: imFormat.readDraft(note),
    captureOriginal: imFormat.readDraft(note),
    captureRevision: 0,
    captureStarted: null,
    captureTimer: 0,
    submission: null,
    composing: false,
    submitAfterComposition: null,
    dirty: false,
    discarded: false,
    lastHostText: note.content?.text || '',
    lastAck: null,
    nativeRepair: false
  };
  const valid = new Set(s.messages.map(m => m.id));
  s.view.selected = new Set([...s.view.selected].filter(id => valid.has(id)));
  if (s.view.selected.size) s.view.selecting = true;
  active = s;
  dateOpen = false;
  $('date-panel').replaceChildren();
  imNoteReceived(note);
  $('search').value = s.view.query;
  viewport.scrollTop = 0;
  renderAll();
  viewport.scrollTop = s.view.scroll || 0;
  scheduleWindow();
  if (force && writable(s) && imNoteSavePending(note.uuid)) safeRun(() => persist(s));
  safeRun(() => applyTransferMarks(s));
}

function writable(s = active) {
  return !!s && s === active && !s.discarded && !s.damaged && !s.deleted && !s.plain && !s.remote;
}

function persist(s, options) {
  if (!writable(s)) return Promise.reject(new Error('Saving is paused. The original note has been kept.'));
  const revision = ++s.revision,
    submitted = {
      text: s.note.content.text,
      native: imNoteNativeSignature(s.note)
    };
  s.pending++;
  s.dirty = true;
  s.error = '';
  retainedSessions.set(s.note.uuid, s);
  renderStatus();
  renderNotice();
  const promise = s.demo ? Promise.resolve() : imPersistNote(s.note, options);
  return promise.then(() => {
    if (s.discarded) return;
    const confirmed = imConfirmedNote?.note === s.note ? imConfirmedNote.snapshot : null;
    s.lastAck = confirmed ? {
      text: confirmed.text,
      native: imNoteNativeSignature(confirmed.item)
    } : submitted;
    if (s.remote) return;
    if (revision === s.revision) {
      s.error = '';
      s.dirty = false;
      s.nativeRepair = false;
      s.cardSavePending = false;
      if (!s.titleEntry) retainedSessions.delete(s.note.uuid);
    }
    for (const intent of [...s.intents])
      if (intent.revision <= revision) {
        s.intents.delete(intent);
        intent.finish();
      }
    if (active === s) safeRun(() => applyTransferMarks(s));
  }, error => {
    if (!s.discarded && revision === s.revision) {
      s.error = 'Saving was not confirmed. Keep this editor open and retry. Your text is still here.';
      s.dirty = true;
      retainedSessions.set(s.note.uuid, s);
    }
    throw error;
  }).finally(() => {
    s.pending--;
    if (!s.pending && !s.dirty && !s.error && !s.remote && !s.titleEntry) retainedSessions.delete(s.note.uuid);
    if (active === s) {
      renderStatus();
      renderNotice();
      if (!s.pending && s.retryCardOnReturn) {
        s.retryCardOnReturn = false;
        if (s.cardSavePending && writable(s)) safeRun(() => persist(s));
      }
    }
  });
}

function update(s, change, redraw = true) {
  if (!writable(s)) throw new Error('Saving is paused. Your original note is unchanged.');
  boardDrag.cancel(false);
  const previousIds = redraw ? new Set(s.messages.map(m => m.id)) : null;
  const added = redraw && change.messages ? change.messages.filter(m => !previousIds.has(m.id)).map(m => m.id) :
[];
  const before = added.length ? boardMotion.snapshot(mounted) : null;
  if (added.length) boardMotion.queue(added);
  const messages = change.messages ?? s.messages,
    settings = change.settings ?? s.settings;
  const captureChanged = takeCapture(s);
  const draft = Object.hasOwn(change, 'draft') ? change.draft : captureChanged ? s.captureValue : s.draft,
    reply = Object.hasOwn(change, 'reply') ? change.reply : s.reply;
  if (change.trash) {
    if (!imFormat.writeTrash(s.note, change.trash.ids, change.trash.action, draft, reply)) {
      if (!captureChanged) return Promise.resolve();
      imFormat.write(s.note, messages, settings, draft, reply);
    }
  } else imFormat.write(s.note, messages, settings, draft, reply);
  Object.assign(s, {
    messages: change.trash || messages !== s.messages ? imFormat.readMessages(s.note) : s.messages,
    settings: imFormat.readSettings(s.note),
    draft: imFormat.readDraft(s.note),
    reply: imFormat.readReply(s.note)
  });
  const promise = persist(s);
  if (s === active) {
    if (redraw) {
      renderAll(!!before);
      if (before) boardMotion.move(before, mounted);
    } else renderCapture();
  }
  return promise;
}

function retrySave() {
  if (active && !flushCapture()) safeRun(() => persist(active));
}

function renderStatus() {
  const node = $('save-status'),
    s = active;
  const text = saveFeedback.update(s?.note.uuid, !!s?.pending || s?.captureStarted != null, !!(s?.error || s
    ?.remote || s?.damaged || s?.deleted || s?.view.selecting));
  node.classList.add('ui-save-feedback');
  node.classList.toggle('saving', text === 'Saving…');
  node.textContent = s?.demo ? 'Preview · not saved' : text;
  node.hidden = !node.textContent;
  node.title = text === 'Saved' ? 'Accepted by Standard Notes' : '';
}

function renderNotice() {
  const box = $('notice');
  box.replaceChildren();
  const s = active;
  if (trashView && s) trashView.update(imFormat.readTrash(s.note), writable(s));
  box.hidden = true;
  if (!s) return;
  let text = '';
  if (s.damaged) text =
    'Saving is paused: this is not a valid format-3 note. The original text is unchanged. Format-2 notes belong in IM-style-editor Archive.';
  else if (s.deleted) text = 'This note is deleted. Restore it in Standard Notes before editing.';
  else if (s.remote) text =
    'Standard Notes sent a different version while you had unsaved changes. Saving is paused so neither version is silently overwritten.';
  else if (s.plain) text =
    'This is an ordinary plain-text note. Convert it to the shared card format before editing.';
  else if (s.error) text = s.error;
  if (!text) return;
  box.hidden = false;
  box.append(el('span', '', text));
  if (s.error && !s.remote) box.append(button('Retry save', null, retrySave, ''));
  if (s.plain) box.append(button('Use card format', null, () => confirmAction('Use the shared card format?',
    'Your existing text will become cards. Mosaic and the current IM editor will both be able to open this note.',
    'Convert note', () => {
      s.plain = false;
      return update(s, {});
    }), ''));
  if (s.damaged || s.remote || s.error) box.append(button('Review text', null, () => recoveryDialog(s), ''));
}
