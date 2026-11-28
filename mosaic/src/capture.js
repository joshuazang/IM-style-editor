/* Board composer, draft checkpoints, and submission. */
function renderCapture() {
  const s = active,
    field = $('capture-input');
  if (s?.captureStarted == null || s.titleEntry) {
    const value = MosaicModel.normalized(s?.titleEntry?.text ?? s?.captureValue ?? '');
    captureEditor?.setContext((s?.note.uuid || '') + ':' + (s?.titleEntry?.id || 'capture'), value, !!s
      ?.titleEntry);
  }
  field.setAttribute('aria-label', s?.titleEntry ? 'Title' : 'Take a note');
  field.placeholder = s?.titleEntry ? 'Write a title…' : 'Take a note…';
  field.disabled = !writable();
  scheduleWindow();
  const quote = $('capture-reply');
  quote.replaceChildren();
  quote.hidden = !s?.reply && !s?.titleEntry;
  if (s?.titleEntry) {
    const source = s.messages.find(m => m.id === s.titleEntry.id);
    quote.append(el('strong', '', 'Title for card'), el('span', 'inline-quote', source ? imMarkdown.message(source)
      .text.slice(0, 160) || 'Card' : 'Card'), button('Cancel title entry', 'close', () => {
      s.titleEntry = null;
      if (!s.dirty && !s.pending) retainedSessions.delete(s.note.uuid);
      renderCapture();
    }, 'icon-button'));
  } else if (s?.reply) {
    const text = button('Show quoted card', null, () => jumpTo(s.reply), 'inline-quote');
    text.textContent = imMarkdown.message(s.reply).text.replace(/\s+/g, ' ').slice(0, 160) || 'Quoted message';
    quote.append(text, button('Cancel reply', 'close', () => safeRun(() => update(s, {
      reply: null
    }, false)), 'icon-button danger'));
  }
}

function inputCapture() {
  const s = active;
  if (!writable(s)) return;
  if (s.titleEntry) {
    s.titleEntry.text = captureEditor.value();
    return;
  }
  s.captureRevision++;
  if (s.captureStarted == null) {
    s.captureStarted = Date.now();
    renderStatus();
  }
  scheduleCaptureSave(s);
}

function scheduleCaptureSave(s) {
  clearTimeout(s.captureTimer);
  if (s.composing) return;
  const delay = Math.min(imDraftIdleMs, s.captureStarted + imDraftCheckpointMs - Date.now());
  s.captureTimer = setTimeout(() => flushCapture(s), Math.max(0, delay));
}

function captureText(s) {
  if (s.captureStarted == null) return s.captureValue;
  const value = captureEditor.value();
  return value === MosaicModel.normalized(s.captureOriginal) ? s.captureOriginal : value;
}

function takeCapture(s) {
  if (s !== active || s?.captureStarted == null) return false;
  s.captureValue = captureText(s);
  clearTimeout(s.captureTimer);
  s.captureStarted = null;
  return true;
}

function flushCapture(s = active) {
  if (!takeCapture(s)) return;
  if (s.captureValue === s.draft) {
    renderStatus();
    return;
  }
  // Keep the latest local draft available in conflict review without sending
  // it over a different host version. Normal checkpoints use the save queue.
  imFormat.write(s.note, s.messages, s.settings, s.captureValue, s.reply);
  s.draft = imFormat.readDraft(s.note);
  if (writable(s)) {
    safeRun(() => persist(s));
    return true;
  } else {
    s.dirty = true;
    retainedSessions.set(s.note.uuid, s);
  }
}

function submitCapture(s = active, tag = s?.view.tag) {
  if (s?.titleEntry) {
    if (s.composing) {
      s.submitAfterComposition = {
        title: true
      };
      return Promise.resolve();
    }
    return submitTitle(s);
  }
  if (!writable(s) || s.submission) return Promise.resolve();
  if (s.composing) {
    s.submitAfterComposition = {
      tag
    };
    return Promise.resolve();
  }
  const text = captureText(s),
    revision = s.captureRevision;
  if (!captureEditor.hasText(MosaicModel.normalized(text))) return Promise.resolve();
  const tags = tag && tag !== '__untagged__' ? [tag] : [];
  const message = {
    id: imFormat.newId(),
    text,
    reactions: tags,
    createdAt: new Date().toISOString(),
    ...(s.reply ? {
      replyTo: s.reply
    } : {})
  };
  s.submission = {
    id: message.id,
    text,
    revision
  };
  s.locatedId = message.id;
  setTimeout(() => {
    if (s.locatedId === message.id) s.locatedId = null;
  }, 2200);
  // Reveal the card just captured, including when a search or pins-only view
  // would otherwise hide it. Its active emoji filter still supplies the label.
  if (s.view.query && !text.toLocaleLowerCase().includes(s.view.query.toLocaleLowerCase())) {
    s.view.query = '';
    $('search').value = '';
  }
  s.view.pinned = false;
  let saving;
  try {
    saving = update(s, {
      messages: [...s.messages, message],
      draft: '',
      reply: null
    });
  } catch (error) {
    s.submission = null;
    throw error;
  }
  const placed = layout.byId?.get(message.id);
  if (placed) {
    const origin = board.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
    viewport.scrollTo({
      top: Math.max(0, origin + placed.y - 64),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
    scheduleWindow();
    requestAnimationFrame(() => mounted.get(message.id)?.classList.add('located'));
  }
  s.intents.add({
    revision: s.revision,
    finish: () => {
      s.submission = null;
      if (s.captureRevision === revision) {
        s.captureValue = '';
        s.captureOriginal = '';
      } else s.captureOriginal = s.captureValue;
      if (active === s) renderCapture();
    }
  });
  return saving;
}

function beginTitle(id) {
  const s = active,
    source = s?.messages.find(m => m.id === id);
  if (!source || !writable(s)) return;
  if (s.titleEntry && s.titleEntry.id !== id) {
    hideMenu();
    notify('Finish or cancel the current title entry first.');
    return;
  }
  flushCapture(s);
  if (!s.titleEntry) s.titleEntry = {
    id,
    text: imFormat.title(source),
    original: imFormat.title(source),
    pending: false
  };
  retainedSessions.set(s.note.uuid, s);
  hideMenu();
  renderCapture();
  $('capture-input').focus();
}

function submitTitle(s) {
  const entry = s.titleEntry;
  if (!writable(s) || !entry || entry.pending) return Promise.resolve();
  const source = s.messages.find(m => m.id === entry.id),
    text = entry.text;
  if (!source || imFormat.title(source) !== entry.original && imFormat.title(source) !== entry.submitted)
  throw new Error('This title changed. Your entry is retained; review before saving.');
  entry.pending = true;
  entry.submitted = text.trim() ? text : '';
  const saving = update(s, {
    messages: s.messages.map(m => m.id === entry.id ? imFormat.editMessage(m, m.text, text) : m)
  });
  s.intents.add({
    revision: s.revision,
    finish: () => {
      entry.pending = false;
      entry.original = text.trim() ? text : '';
      if (s.titleEntry === entry && entry.text === text) s.titleEntry = null;
      if (active === s) renderCapture();
    }
  });
  return saving.catch(error => {
    entry.pending = false;
    throw error;
  });
}
