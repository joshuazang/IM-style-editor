/* Card commands, transfers, and recovery dialogs. */
function replyTo(id) {
  const s = active,
    message = s.messages.find(m => m.id === id);
  if (!message || !writable(s)) return;
  closeModal(true);
  safeRun(() => update(s, {
    reply: MosaicModel.reply(message, s.note.uuid)
  }, false));
  $('capture-input').focus();
}

function jumpTo(reply) {
  const s = active,
    target = MosaicModel.target(s.messages, reply, s.note.uuid);
  if (!target) {
    notify('The original message is not in this note. The quoted text is still preserved.');
    return;
  }
  s.locatedId = target.id;
  setTimeout(() => {
    if (s.locatedId === target.id) s.locatedId = null;
  }, 2200);
  s.view.query = '';
  s.view.tag = '';
  s.view.pinned = false;
  $('search').value = '';
  renderAll();
  const item = layout.byId?.get(target.id);
  if (!item) return;
  const origin = board.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
  const bounds = viewport.getBoundingClientRect(),
    top = Math.max(bounds.top, document.querySelector('.board-toolbar').getBoundingClientRect().bottom + 12),
    bottom = Math.min(bounds.bottom, $(s.view.selecting ? 'selection-bar' : 'capture-composer')
      .getBoundingClientRect().top - 12);
  viewport.scrollTop = origin + item.y - (top - bounds.top) - Math.max(0, (bottom - top - item.height) / 2);
  renderWindow();
  const node = mounted.get(target.id);
  node?.classList.add('located');
  setTimeout(() => node?.classList.remove('located'), 2100);
}

function deleteCards(s, ids) {
  if (!ids.size || !writable(s)) return;
  confirmAction(`Delete ${ids.size===1?'this card':ids.size+' cards'}?`,
    'This removes the selected text from this note. There is no trash folder in Mosaic.', 'Delete', async () => {
      const next = s.messages.filter(m => !ids.has(m.id));
      const pins = MosaicModel.pins(s.settings).filter(id => !ids.has(id));
      for (const id of ids) s.view.selected.delete(id);
      rememberSelection();
      await update(s, {
        messages: next,
        settings: {
          ...s.settings,
          pinnedMessageIds: pins
        }
      });
    }, true);
}

function applyTransferMarks(s) {
  const intents = transferMarks.get(s?.note.uuid);
  if (!intents || !writable(s) || s.error) return Promise.resolve();
  const next = s.messages.map(message => {
    const intent = intents.get(message.id);
    if (!intent || intent.text !== message.text) return message;
    let result = message;
    for (const flag of intent.flags)
      if (!message[flag]) result = {
        ...result,
        [flag]: true
      };
    return result;
  });
  let pending = Promise.resolve();
  if (next.some((message, i) => message !== s.messages[i])) pending = update(s, {
    messages: next
  });
  transferMarks.delete(s.note.uuid);
  return pending;
}

function mark(s, records, flag) {
  const uuid = s.note.uuid,
    intents = transferMarks.get(uuid) || new Map();
  for (const record of records) {
    const old = intents.get(record.id),
      flags = old?.text === record.text ? old.flags : new Set();
    flags.add(flag);
    intents.set(record.id, {
      text: record.text,
      flags
    });
  }
  transferMarks.set(uuid, intents);
  return active?.note.uuid === uuid ? applyTransferMarks(active) : Promise.resolve();
}
async function copyRecords(s, records) {
  if (!records.length) return;
  const text = records.map(m => m.text).join('\n\n');
  if (await imWriteClipboard(text)) {
    notify('Copied to clipboard.');
    await mark(s, records, 'copied');
  } else manualCopyDialog(s, records, text, 'copied');
}
async function exportRecords(s, records) {
  if (!records.length) {
    notify('There are no cards to export.');
    return;
  }
  const text = imTransfer.create(records.map(m => ({
    ...m,
    exported: true
  })), s.settings, s.note.uuid);
  if (await imWriteClipboard(text)) {
    notify('Export copied. Open another note and choose Import from clipboard.');
    await mark(s, records, 'exported');
  } else manualCopyDialog(s, records, text, 'exported');
}

function manualCopyDialog(s, records, text, flag) {
  if (active !== s) return;
  const d = openModal('copy', flag === 'exported' ? 'Export cards' : 'Copy');
  d.root.append(el('p', 'dialog-help',
    'Automatic copying was blocked. Select and copy the text below, or try the Copy button.'));
  const field = el('textarea', 'transfer-text');
  field.value = text;
  field.readOnly = true;
  field.setAttribute('aria-label', 'Text to copy');
  d.root.append(field);
  let marked = false;
  // Only a successful programmatic clipboard write marks status. A browser's
  // ordinary copy event cannot prove the system clipboard accepted the text.
  actions(d, [button('Close', null, () => closeModal(), 'secondary-button'), button('Copy', null, async () => {
    if (await imWriteClipboard(text)) {
      if (!marked) {
        marked = true;
        safeRun(() => mark(s, records, flag));
      }
      notify('Copied to clipboard.');
    } else dialogError(d,
      'Clipboard access is still blocked. You can select the text and copy it manually.');
  }, 'primary-button')]);
  field.focus();
  field.select();
}

function importDialog() {
  const s = active;
  if (!writable(s)) return;
  const d = openModal('import', 'Import');
  d.root.append(el('p', 'dialog-help',
    'Paste an export from Mosaic or the IM-style editor. Your existing cards will be kept.'));
  const field = el('textarea', 'transfer-text');
  field.placeholder = 'Paste your exported messages here…';
  field.setAttribute('aria-label', 'Import text');
  d.root.append(field);
  const summary = el('p', 'dialog-help', '');
  d.root.append(summary);
  const apply = async clear => {
    const payload = imTransfer.read(field.value);
    if (!payload.ok) {
      dialogError(d, payload.error);
      return;
    }
    if (active !== s || modalState !== d) return;
    const merged = imTransfer.merge(s.messages, payload);
    d.busy = true;
    normal.disabled = true;
    combined.disabled = true;
    try {
      await update(s, {
        messages: merged.messages
      });
      if (modalState === d) {
        closeModal(true);
        notify(
          `${merged.added.length} imported${merged.skipped?', '+merged.skipped+' duplicates skipped':''}.`);
        if (clear) clearClipboardDialog();
      }
    } catch {
      dialogError(d,
        'Import saving was not confirmed. The imported text is still available. Keep this editor open and use Retry save.'
        );
    } finally {
      d.busy = false;
      normal.disabled = false;
      combined.disabled = false;
    }
  };
  const normal = button('Import', null, () => safeRun(() => apply(false)), 'primary-button');
  const combined = button('Import and clear clipboard', null, () => safeRun(() => apply(true)),
    'secondary-button danger');
  actions(d, [button('Cancel', null, () => closeModal(), 'secondary-button'), normal, combined]);
  const preview = () => {
    const parsed = imTransfer.read(field.value);
    summary.textContent = parsed.ok ? `${parsed.messages.length} cards ready to import.` : field.value ?
      'Paste a complete message export.' : '';
  };
  field.addEventListener('input', preview);
  // Reading is requested only after the user explicitly opens Import.
  const initial = field.value;
  try {
    navigator.clipboard.readText().then(text => {
      if (modalState === d && field.value === initial) {
        field.value = text;
        preview();
      }
    }).catch(() => {});
  } catch {}
  field.focus();
}

function clearClipboardDialog() {
  confirmAction('Clear your clipboard?',
    'This empties the current clipboard. Clipboard history and other devices are outside Mosaic’s control.',
    'Clear clipboard', async () => {
      if (!await imClearClipboard()) throw new Error(
        'Clipboard clearing was blocked by this app. Your clipboard has not been confirmed cleared.');
      notify('Clipboard cleared.');
    }, true);
}

function statusDialog(ids) {
  const s = active;
  if (!writable(s)) return;
  const d = openModal('statuses', 'Clear message statuses');
  d.root.append(el('p', 'dialog-help', ids ? `${ids.size} selected cards.` :
    'All cards in this note, including cards hidden by filters.'));
  const options = el('div', 'status-options'),
    flags = new Set(),
    help = el('p', 'dialog-help', imStatusClearHelp(flags));
  for (const [key, label] of Object.entries(imClearableStatuses)) {
    const row = el('label'),
      check = el('input');
    check.type = 'checkbox';
    check.addEventListener('change', () => {
      check.checked ? flags.add(key) : flags.delete(key);
      save.disabled = !flags.size;
      help.textContent = imStatusClearHelp(flags);
    });
    row.append(check, document.createTextNode(label));
    options.append(row);
  }
  d.root.append(options, help);
  const save = button('Clear selected statuses', null, async () => {
    if (d.busy || active !== s || modalState !== d || !writable(s) || !flags.size) return;
    d.busy = true;
    save.disabled = true;
    options.querySelectorAll('input').forEach(input => input.disabled = true);
    try {
      await update(s, {
        messages: MosaicModel.clearStatuses(s.messages, flags, ids)
      });
      if (modalState === d) closeModal(true);
      notify('Statuses cleared.');
    } catch (error) {
      dialogError(d, error.message);
    } finally {
      d.busy = false;
      if (modalState === d) {
        save.disabled = !flags.size || !writable(s);
        options.querySelectorAll('input').forEach(input => input.disabled = !writable(s));
      }
    }
  }, 'primary-button');
  save.disabled = true;
  actions(d, [button('Cancel', null, () => closeModal(), 'secondary-button'), save]);
}

function mergeDialog() {
  const s = active,
    ids = new Set(s.view.selected),
    records = s.messages.filter(m => ids.has(m.id));
  if (records.length < 2) {
    notify('Select at least two cards to merge.');
    return;
  }
  const preview = imFormat.mergeText(records),
    snapshot = JSON.stringify(records);
  const d = confirmAction(`Merge ${records.length} cards?`,
    'Text will stay in its original IM order, separated by a blank line. Tags and pins are combined. Copied and Exported reset.',
    'Merge selected', async () => {
      if (JSON.stringify(s.messages.filter(m => ids.has(m.id))) !== snapshot) throw new Error(
        'These cards changed. Open a fresh merge preview.');
      const result = MosaicModel.merge(s.messages, s.settings, ids, s.note.uuid);
      s.view.selected = new Set([result.id]);
      rememberSelection();
      await update(s, result);
    });
  const field = el('textarea', 'transfer-text');
  field.readOnly = true;
  field.value = preview;
  field.setAttribute('aria-label', 'Merged card preview');
  d.root.insertBefore(field, d.root.lastChild);
}

function recoveryDialog(s) {
  flushCapture(s);
  const d = openModal('recovery', 'Review your text');
  d.root.append(el('p', 'dialog-help',
    'Copy this text somewhere safe before closing the editor. Mosaic will not automatically overwrite a different saved version.'
    ));
  const field = el('textarea', 'transfer-text');
  field.readOnly = true;
  field.value = s.note.content.text || '';
  field.setAttribute('aria-label', 'Current local note text');
  d.root.append(field);
  if (s.titleEntry) {
    const title = el('textarea', 'transfer-text');
    title.readOnly = true;
    title.value = s.titleEntry.text;
    title.setAttribute('aria-label', 'Unfinished title');
    d.root.append(title);
  }
  for (const entry of unfinishedEdits.values())
    if (entry.noteId === s.note.uuid) {
      const edit = el('textarea', 'transfer-text');
      edit.readOnly = true;
      edit.value = (entry.title ? 'title: ' + JSON.stringify(entry.title) + '\n\n' : '') + entry.text;
      edit.setAttribute('aria-label', 'Unfinished card edit');
      d.root.append(edit);
    }
  actions(d, [button('Close', null, () => closeModal(), 'secondary-button'), button('Copy local text', null,
  async () => {
      if (await imWriteClipboard(field.value)) notify('Local text copied.');
      else {
        field.focus();
        field.select();
        dialogError(d, 'Automatic copying was blocked. Copy the selected text manually.');
      }
    }, 'primary-button')]);
  if (s.remote) {
    d.root.append(el('p', 'dialog-help', 'Standard Notes also supplied this saved version:'));
    const remote = el('textarea', 'transfer-text');
    remote.value = s.remote.content?.text || '';
    remote.readOnly = true;
    remote.setAttribute('aria-label', 'Standard Notes version');
    d.root.append(remote);
    actions(d, [button('Use Standard Notes version', null, () => confirmAction('Use the saved version?',
      'Copy your local text first. This discards the unconfirmed local changes shown above.',
      'Use saved version', () => receive(s.remote, true), true), 'secondary-button danger')]);
  }
}

function aboutDialog() {
  const d = openModal('about', 'Mosaic · ' + MOSAIC_VERSION);
  d.root.append(el('p', 'about-copy',
    'Each card is the same message your IM-style editor reads. All text is body text unless you explicitly add a title from its context menu. There is no separate copy of your notes.'
    ));
  d.root.append(el('p', 'about-copy',
    'Your note content is saved through Standard Notes. Mosaic has no analytics, independent cloud service, or browser-storage copy. Saving still submits a complete note; very large active notes can reach Standard Notes’ sync limits.'
    ));
  d.root.append(el('p', 'about-copy',
    'New-card drafts and open-card edits autosave after a 0.7-second typing pause, with checkpoints every 6 seconds of continuous typing. Enter adds a line. Close and leaving the editor submit pending edits immediately. Failed saves remain here for retry; different saved versions require review.'
    ));
  d.root.append(el('p', 'about-copy',
    'Drag Board cards to arrange them. On a phone, hold still, then drag; release without moving to open the menu. With a card focused, Alt+Up/Down also changes its position. Pinned cards stay in their section. The arrangement affects Mosaic only and saves once on drop. Reset card order restores newest-first order.'
    ));
  const p = el('p', 'about-copy'),
    a = el('a', '', 'Source, installation & privacy details');
  a.href = 'https://github.com/joshuazang/IM-style-editor/tree/main/mosaic';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  p.append(a);
  d.root.append(p);
}
