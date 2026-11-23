/* Card dialog lifecycle, editing, and keyboard behavior. */
function clearCardMotion(d) {
  if (!d) return;
  cancelAnimationFrame(d.motionFrame);
  d.motionFrame = 0;
  cancelAnimationFrame(d.motionStartFrame);
  d.motionStartFrame = 0;
  d.cardAnimation?.cancel();
  modal.classList.remove('card-is-moving');
}

function settleCardMotion() {
  if (modalState?.kind === 'edit' && !modalState.root.inert) {
    clearCardMotion(modalState);
    modalState.prepareBody?.();
  }
}

function openModal(kind, title) {
  stashEdit();
  flushCardEdit();
  closeModal(true);
  const root = $('modal-content');
  root.replaceChildren();
  modal.classList.toggle('card-edit-dialog', kind === 'edit');
  const heading = el('div', 'dialog-heading'),
    h = el('h2', '', title);
  h.id = 'dialog-title';
  const state = {
    kind,
    uuid: active?.note.uuid,
    root,
    error: null,
    busy: false
  };
  modalState = state;
  heading.append(h, button('Close', 'close', () => closeModal()));
  root.append(heading);
  modal.showModal();
  return state;
}

function dialogError(record, text) {
  if (modalState !== record) return;
  if (!record.error) {
    record.error = el('p', 'dialog-error');
    record.error.setAttribute('role', 'alert');
    if (record.bottom) record.bottom.insertBefore(record.error, record.footer);
    else record.root.append(record.error);
  }
  record.error.textContent = text;
}

function closeModal(force = false) {
  cardBackSwipe = null;
  if (!force && modalState?.busy) return;
  if (!force && modalState?.kind === 'edit' && modalState.commit) {
    safeRun(() => modalState.commit(true));
    return;
  }
  if (!force) stashEdit();
  clearTimeout(modalState?.saveTimer);
  if (modalState?.viewportResize) {
    window.removeEventListener('resize', modalState.viewportResize);
    window.visualViewport?.removeEventListener('resize', modalState.viewportResize);
    window.visualViewport?.removeEventListener('scroll', modalState.viewportResize);
    modal.style.removeProperty('--card-view-height');
    modal.style.removeProperty('--card-view-top');
  }
  cancelAnimationFrame(modalState?.caretFrame);
  if (modalState?.revealCaret) document.removeEventListener('selectionchange', modalState.revealCaret);
  cancelAnimationFrame(modalState?.bodyFrame);
  clearCardMotion(modalState);
  if (modalState?.transitionSource) modalState.transitionSource.style.removeProperty('visibility');
  $('modal-content').inert = false;
  modalState?.scrollObserver?.disconnect();
  modalState?.tagObserver?.disconnect();
  modalState?.tagBadges?.remove();
  modal.style.removeProperty('--tag-overhang');
  modalState?.body?.imRich?.destroy();
  hideMenu();
  if (modal.open) modal.close();
  modalState = null;
}

function stashEdit() {
  const d = modalState;
  if (!d || d.kind !== 'edit' || !active || d.uuid !== active.note.uuid) return;
  if (cardEditChanged(d)) unfinishedEdits.set(editKey(d.uuid, d.id), {
    noteId: d.uuid,
    id: d.id,
    original: d.original,
    text: d.currentText,
    title: d.titleValue,
    originalTitle: d.originalTitle,
    titleUnlocked: d.titleUnlocked,
    tags: [...d.tags]
  });
}

function cardEditChanged(d = modalState) {
  return d?.kind === 'edit' && (d.currentText !== d.original || d.titleValue !== d.originalTitle || JSON.stringify(
    [...d.tags]) !== JSON.stringify(d.originalTags));
}

function flushCardEdit() {
  const d = modalState;
  if (d?.kind === 'edit' && d.commit) safeRun(() => d.commit(false));
}

function actions(record, items) {
  const row = el('div', 'dialog-actions');
  for (const item of items) row.append(item);
  record.root.append(row);
  return row;
}

function confirmAction(title, description, label, action, danger = false) {
  const d = openModal('confirm', title);
  d.root.append(el('p', 'dialog-help', description));
  const confirm = button(label, null, async () => {
    d.busy = true;
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      await action();
      if (modalState === d) closeModal(true);
    } catch (error) {
      dialogError(d, error.message || 'Saving was not confirmed. Use Retry save.');
    } finally {
      d.busy = false;
      confirm.disabled = false;
      cancel.disabled = false;
    }
  }, danger ? 'secondary-button danger' : 'primary-button');
  const cancel = button('Cancel', null, () => closeModal(), 'secondary-button');
  actions(d, [cancel, confirm]);
  cancel.focus();
  return d;
}

function renderEditorTags(d) {
  if (!d.tagBadges) return;
  d.tagBadges.replaceChildren();
  d.tagBadges.hidden = !d.tags.size;
  for (const tag of d.tags) {
    const badge = el('span', 'card-tag');
    fillEmojiTag(badge, tag);
    badge.setAttribute('role', 'listitem');
    d.tagBadges.append(badge);
  }
  positionEditorTags(d);
}

function positionEditorTags(d) {
  if (modalState !== d || !d.tagBadges) return;
  const extra = isIPhone || d.tagBadges.hidden ? 0 : Math.max(0, Math.ceil(d.tagBadges.offsetHeight) - 13),
    value = extra + 'px';
  if (modal.style.getPropertyValue('--tag-overhang') !== value) modal.style.setProperty('--tag-overhang', value);
}

function refreshEditorMetadata() {
  const d = modalState,
    s = active;
  if (d?.kind !== 'edit' || d.uuid !== s?.note.uuid || !d.meta) return;
  const message = s.messages.find(m => m.id === d.id);
  if (!message) return;
  const color = MosaicModel.color(message);
  modal.style.setProperty('--edit-card-color', color.background);
  modal.style.setProperty('--edit-card-ink', color.ink);
  const pinned = MosaicModel.pins(s.settings).includes(message.id);
  d.pin.setAttribute('aria-label', pinned ? 'Unpin card' : 'Pin card');
  d.pin.title = pinned ? 'Unpin card' : 'Pin card';
  d.pin.setAttribute('aria-pressed', String(pinned));
  d.meta.replaceChildren();
  const add = (text, className = '') => {
    if (d.meta.childNodes.length) d.meta.append(el('span', 'metadata-separator', ' · '));
    d.meta.append(el('span', className, text));
  };
  if (message.copied) add('Copied');
  if (message.exported) add('Exported');
  if (MosaicModel.isImported(message)) add('Imported');
  if (message.createdAt && !Number.isNaN(new Date(message.createdAt).getTime())) {
    const text = cardTimestampFormat.format(new Date(message.createdAt));
    add(text, 'card-timestamp');
    d.meta.querySelector('.card-timestamp').title = new Date(message.createdAt).toLocaleString();
  }
  if (message.edited) add('edited', 'card-edited');
  renderEditorTags(d);
}

function cardTransitionRect(node) {
  if (!node?.isConnected) return null;
  const r = node.getBoundingClientRect(),
    v = viewport.getBoundingClientRect(),
    bottom = Math.min(v.bottom, $('capture-composer').getBoundingClientRect().top);
  const left = Math.max(r.left, v.left),
    top = Math.max(r.top, v.top),
    right = Math.min(r.right, v.right),
    end = Math.min(r.bottom, bottom);
  return right > left && end > top ? {
    left,
    top,
    width: right - left,
    height: end - top
  } : null;
}

function animateCard(d, closing = false) {
  cancelAnimationFrame(d.motionFrame);
  d.motionFrame = 0;
  cancelAnimationFrame(d.motionStartFrame);
  d.motionStartFrame = 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (closing && !d.motionClosing && ['running', 'paused'].includes(d.cardAnimation?.playState)) {
    // Closing before playback starts should simply reveal the Board card.
    if (!d.cardAnimation.currentTime) {
      clearCardMotion(d);
      return null;
    }
    d.motionClosing = true;
    d.cardAnimation.reverse();
    return d.cardAnimation;
  }
  const node = mounted.get(d.id),
    source = closing ? cardTransitionRect(node) : d.sourceRect;
  const target = modal.getBoundingClientRect();
  if (!source || !target.width || !target.height) return null;
  d.cardAnimation?.cancel();
  modal.classList.add('card-is-moving');
  if (node) {
    node.style.visibility = 'hidden';
    d.transitionSource = node;
  }
  const small = {
      transform: `translate(${source.left-target.left}px,${source.top-target.top}px) scale(${source.width/target.width},${source.height/target.height})`
    },
    full = {
      transform: 'translate(0,0) scale(1,1)'
    };
  if (isIPhone) {
    small.borderRadius = '16px';
    full.borderRadius = '0px';
  }
  d.motionClosing = closing;
  const animation = d.cardAnimation = modal.animate(closing ? [full, small] : [small, full], {
    duration: 320,
    easing: 'cubic-bezier(.22,.8,.24,1)',
    fill: 'both'
  });
  // Do not spend animation time rasterizing the first frame. In particular,
  // a busy first render must not turn the first visible move into an end jump.
  animation.pause();
  animation.currentTime = 0;
  d.motionStartFrame = requestAnimationFrame(() => {
    d.motionStartFrame = requestAnimationFrame(() => {
      d.motionStartFrame = 0;
      if (modalState === d && d.cardAnimation === animation && animation.playState === 'paused' &&
        animation.currentTime === 0) animation.play();
    });
  });
  // Let the final composited frame settle before releasing its layer.
  if (!closing) animation.onfinish = () => {
    if (modalState !== d || d.cardAnimation !== animation) return;
    d.motionFrame = requestAnimationFrame(() => {
      d.motionFrame = requestAnimationFrame(() => {
        if (modalState === d && d.cardAnimation === animation) {
          clearCardMotion(d);
          if (d.deferBodyUntilMotion) d.prepareBody();
        }
      });
    });
  };
  return animation;
}

function finishCard(d) {
  if (modalState !== d) return;
  if (d.boardDirty) {
    renderAll();
    d.boardDirty = false;
  }
  cancelAnimationFrame(d.bodyFrame);
  d.bodyFrame = 0;
  const animation = animateCard(d, true);
  if (!animation) {
    closeModal(true);
    return;
  }
  d.busy = true;
  d.root.inert = true;
  animation.onfinish = () => {
    if (modalState === d) closeModal(true);
  };
}

function cardBodyStart(text, settings) {
  const font = MosaicModel.fontSizes[MosaicModel.appearance(settings).fontSize];
  const firstLines = Math.ceil(innerHeight / (font.editBody * 1.75)) + 4;
  return imMarkdown.preview(text, firstLines);
}

function editorDialog(id = null) {
  if (!id) {
    $('capture-input').focus();
    return;
  }
  if (modalState?.kind === 'edit' && modalState.id === id && modalState.uuid === active?.note.uuid) {
    modalState.body.focus();
    return;
  }
  const s = active;
  if (s?.titleEntry) {
    notify('Finish or cancel the current title entry first.');
    return;
  }
  if (!writable(s)) {
    notify('This note is read only until the notice above is resolved.');
    return;
  }
  const message = s.messages.find(m => m.id === id);
  if (!message) return;
  let stashed = unfinishedEdits.get(editKey(s.note.uuid, id));
  if (stashed?.text === message.text && (stashed.title ?? imFormat.title(message)) === imFormat.title(message) &&
    JSON.stringify(stashed.tags) === JSON.stringify(message.reactions)) {
    unfinishedEdits.delete(editKey(s.note.uuid, id));
    stashed = null;
  }
  const restored = stashed?.id === id && stashed.original === message.text && (stashed.originalTitle ?? imFormat
    .title(message)) === imFormat.title(message) ? stashed : null;
  const original = message.text,
    originalTitle = imFormat.title(message),
    currentTitle = restored?.title ?? originalTitle;
  const originalNormalized = MosaicModel.normalized(original),
    titleNormalized = MosaicModel.normalized(currentTitle),
    originalNewline = (/\r\n|\n|\r/.exec(original) || ['\n'])[0];
  const sourceRect = cardTransitionRect(mounted.get(id));
  const initialText = restored?.text ?? original;
  const d = openModal('edit', 'Edit card');
  d.sourceRect = sourceRect;
  Object.assign(d, {
    id,
    original,
    originalTitle,
    titleValue: currentTitle,
    titleUnlocked: restored?.titleUnlocked || false,
    tags: new Set(restored?.tags ?? message.reactions),
    originalTags: message.reactions,
    fieldRevision: 0,
    saveSequence: 0,
    wantClose: false
  });
  const scroller = el('div', 'card-detail-scroll');
  d.scroll = scroller;
  d.root.append(scroller);
  if (stashed && !restored) {
    scroller.append(el('p', 'dialog-help',
      'This card changed after your unfinished edit. Your earlier edit is available here to copy before you continue.'
      ));
    const earlier = el('textarea', 'transfer-text');
    earlier.readOnly = true;
    earlier.value = stashed.text;
    earlier.setAttribute('aria-label', 'Earlier unfinished edit');
    scroller.append(earlier);
  }
  const title = imWritingTextField(el('textarea', 'editor-title'));
  title.rows = 1;
  title.placeholder = 'Title';
  title.setAttribute('aria-label', 'Card title');
  title.value = currentTitle;
  title.enterKeyHint = 'enter';
  title.hidden = !d.titleUnlocked;
  const titlePreview = el('h3', 'detail-title', currentTitle);
  titlePreview.hidden = !currentTitle || d.titleUnlocked;
  const startBody = cardBodyStart(initialText, s.settings),
    bodyEditor = imRichField.create({
      className: 'editor-body',
      label: 'Card body',
      placeholder: 'Text',
      value: startBody.text,
      readOnly: !startBody.complete,
      focusOnCheck: !phoneBoard,
      preferLineBreakSelectionExtent: true,
      onResize: () => d.updateScroll?.()
    }),
    body = bodyEditor.dom;
  d.body = body;
  d.bodyReady = startBody.complete;
  if (!d.bodyReady) body.setAttribute('aria-busy', 'true');
  let bodyEdited = false;
  Object.defineProperty(d, 'currentText', {
    get() {
      if (!bodyEdited) return initialText;
      const value = body.value;
      if (value === originalNormalized) return original;
      return originalNewline === '\n' ? value : value.replace(/\n/g, originalNewline);
    }
  });
  // One scroller owns title, full-height body and trailing metadata. The toolbar
  // stays outside it; the editor itself never reserves a second scrollbar.
  // The visual editor is a normal contenteditable block, so CSS owns its
  // height. Textarea-style zero-height measurement would relayout the entire
  // Markdown tree repeatedly during opening, typing and width changes.
  // A bounded first page lets compositor motion start before laying out a
  // very long visual document. Never expose a partial value to user edits.
  d.prepareBody = () => {
    if (modalState !== d || d.bodyReady) return;
    cancelAnimationFrame(d.bodyFrame);
    d.bodyFrame = 0;
    const top = scroller.scrollTop,
      start = body.selectionStart,
      end = body.selectionEnd,
      direction = body.selectionDirection;
    // An opening caret at the preview's end means the end of the full body.
    const append = d.pendingEndCaret && start === end && end === body.value.length;
    d.pendingEndCaret = false;
    body.value = d.currentText;
    body.readOnly = false;
    body.removeAttribute('aria-busy');
    d.bodyReady = true;
    d.deferBodyUntilMotion = false;
    if (!isIPhone || document.activeElement === body) body.setSelectionRange(append ? body.value.length : start,
      append ? body.value.length : end, direction);
    scroller.scrollTop = top;
  };
  const prepareForInput = event => {
    if (event.type === 'keydown' && ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))
      return;
    if (!d.bodyReady) {
      if (d.deferBodyUntilMotion) settleCardMotion();
      else d.prepareBody();
    }
  };
  for (const event of ['pointerdown', 'keydown', 'compositionstart', 'beforeinput', 'paste', 'cut', 'drop']) {
    body.addEventListener(event, prepareForInput, true);
    title.addEventListener(event, prepareForInput, true);
  }
  const pin = button('Pin card', 'pin', () => safeRun(() => togglePin(s, id)), 'icon-button detail-pin');
  d.pin = pin;
  const header = el('div', 'card-detail-heading');
  header.append(titlePreview, title);
  scroller.append(header, body);
  d.unlockTitle = () => {
    d.prepareBody();
    d.titleUnlocked = true;
    title.hidden = false;
    titlePreview.hidden = true;
    title.style.height = 'auto';
    title.style.height = title.scrollHeight + 'px';
    hideMenu();
    title.focus();
  };
  d.tagBadges = el('div', 'card-detail-tags');
  d.tagBadges.setAttribute('role', 'list');
  d.tagBadges.setAttribute('aria-label', 'Emoji tags');
  modal.append(d.tagBadges);
  d.tagObserver = new ResizeObserver(() => positionEditorTags(d));
  d.tagObserver.observe(d.tagBadges);
  d.toggleTag = tag => {
    d.tags.has(tag) ? d.tags.delete(tag) : d.tags.add(tag);
    d.fieldRevision++;
    renderEditorTags(d);
    d.scheduleSave();
  };
  d.meta = el('div', 'card-detail-meta');
  d.meta.setAttribute('aria-label', 'Card timestamp and statuses');
  scroller.append(d.meta);
  const footer = el('div', 'card-detail-tools');
  const palette = button('Background options', 'palette', event => colorMenu(id, event));
  const more = button('Card options', 'more', event => cardMenu(s.messages.find(m => m.id === id), event),
    'icon-button detail-more');
  const close = button('Close', null, () => safeRun(() => saveEditor(true)), 'detail-close');
  d.submit = close;
  footer.append(bodyEditor.toggle, pin, palette, more, close);
  d.footer = footer;
  d.bottom = el('div', 'card-detail-bottom');
  if (isIPhone) d.bottom.append(d.tagBadges);
  d.bottom.append(bodyEditor.toolbar, footer);
  d.root.append(d.bottom);
  d.updateScroll = () => {
    if (modalState === d) d.bottom.classList.toggle('has-content-below', scroller.scrollHeight - scroller
      .clientHeight - scroller.scrollTop > 1);
  };
  scroller.addEventListener('scroll', d.updateScroll, {
    passive: true
  });
  if (phoneBoard) {
    let touch = null;
    scroller.addEventListener('touchstart', event => {
      const point = event.touches[0];
      d.selectingText = cardHasTextSelection(d);
      cancelAnimationFrame(d.caretFrame);
      touch = event.touches.length === 1 ? {
        x: point.clientX,
        y: point.clientY,
        at: performance.now(),
        editable: !!event.target.closest('.editor-body,.editor-title')
      } : null;
    }, {
      passive: true
    });
    scroller.addEventListener('touchmove', event => {
      const point = event.touches[0];
      if (!touch || !point) return;
      // Blue handles and long-press caret/selection drags belong to the OS.
      // Native selection may update before ProseMirror's selection state does.
      if (d.selectingText || cardHasTextSelection(d) || (touch.editable && performance.now() - touch.at >
        300)) {
        d.selectingText = true;
        touch = null;
        return;
      }
      if (Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 10) {
        touch = null;
        if (modalState === d) dismissCardKeyboard();
      }
    }, {
      passive: true
    });
    const endTouch = () => {
      touch = null;
      d.selectingText = false;
    };
    scroller.addEventListener('touchend', endTouch, {
      passive: true
    });
    scroller.addEventListener('touchcancel', endTouch, {
      passive: true
    });
  }
  d.scrollObserver = new ResizeObserver(() => {
    d.updateScroll();
    d.revealCaret?.();
  });
  for (const element of [scroller, body, header, d.meta]) d.scrollObserver.observe(element);
  const change = event => {
    d.fieldRevision++;
    if (event.target === body) {
      bodyEdited = true;
      if (!d.bodyReady) {
        cancelAnimationFrame(d.bodyFrame);
        d.bodyFrame = 0;
        d.bodyReady = true;
        body.readOnly = false;
        body.removeAttribute('aria-busy');
        d.deferBodyUntilMotion = false;
      }
    } else {
      d.titleValue = MosaicModel.normalized(title.value) === titleNormalized ? currentTitle : title.value;
      if (!title.hidden) {
        title.style.height = 'auto';
        title.style.height = title.scrollHeight + 'px';
      }
    }
    d.scheduleSave();
  };
  title.addEventListener('input', change);
  body.addEventListener('im-markdown-change', change);
  // Serialize/save only at checkpoints, never rebuild the Board on a keystroke.
  // Keep the same idle and continuous-typing limits as capture drafts.
  d.scheduleSave = () => {
    clearTimeout(d.saveTimer);
    if (modalState !== d || !writable(s) || d.composing) return;
    const now = Date.now();
    if (d.saveStarted == null) d.saveStarted = now;
    d.saveTimer = setTimeout(() => safeRun(() => saveEditor(false)), Math.max(0, Math.min(imDraftIdleMs, d
      .saveStarted + imDraftCheckpointMs - now)));
  };
  for (const field of [title, body]) {
    field.addEventListener('compositionstart', () => {
      d.composing = true;
      clearTimeout(d.saveTimer);
    });
    field.addEventListener('compositionend', () => {
      d.composing = false;
      d.scheduleSave();
    });
  }
  // Enter is ordinary multiline editing here; the capture field has its own send keys.
  const hasSelection = () => cardHasTextSelection(d) || hasDOMSelectionIn(d.root);
  const canHoldCard = () => active === s && modalState === d && !hasSelection();
  bindContextMenu(d.root, event => cardMenu(s.messages.find(m => m.id === id), event), canHoldCard, hasSelection);
  bindContextMenu(d.tagBadges, event => cardMenu(s.messages.find(m => m.id === id), event), canHoldCard,
    hasSelection);
  d.commit = saveEditor;
  async function saveEditor(closeAfter = true) {
    if (active !== s || modalState !== d) return false;
    clearTimeout(d.saveTimer);
    d.saveStarted = null;
    if (!writable(s)) {
      dialogError(d, 'Saving is paused. Your edit is still here; review the saved version before continuing.');
      return false;
    }
    d.wantClose = d.wantClose || closeAfter;
    const submitted = d.currentText,
      submittedTitle = d.titleValue,
      submittedTags = [...d.tags],
      revision = d.fieldRevision;
    const source = s.messages.find(m => m.id === id);
    if (!source || source.text !== d.original || imFormat.title(source) !== d.originalTitle) {
      dialogError(d,
        'This card changed since you opened it. Your text is still here; copy it before reopening the card.');
      return false;
    }
    const edited = imFormat.withTitle({
      ...imFormat.editMessage(source, submitted),
      reactions: submittedTags
    }, submittedTitle);
    const changed = submitted !== source.text || imFormat.title(edited) !== imFormat.title(source) || JSON
      .stringify(edited.reactions) !== JSON.stringify(source.reactions);
    if (!changed && (!d.wantClose || !s.pending && !s.error && !s.dirty)) {
      if (restored) unfinishedEdits.delete(editKey(s.note.uuid, id));
      if (d.wantClose) finishCard(d);
      return true;
    }
    const tagOrder = [...new Set([...(s.settings.reactionOrder || MosaicModel.tags(s.messages, s.settings)), ...d
      .tags
    ])];
    const sequence = ++d.saveSequence;
    d.busy = d.wantClose;
    close.disabled = d.wantClose;
    close.textContent = d.wantClose ? 'Saving…' : 'Close';
    close.setAttribute('aria-label', 'Close');
    if (changed) s.cardSavePending = true;
    const saving = changed ? update(s, {
      messages: s.messages.map(m => m.id === id ? edited : m),
      settings: {
        ...s.settings,
        reactionOrder: tagOrder,
        deletedEmojis: (s.settings.deletedEmojis || []).filter(tag => !d.tags.has(tag))
      }
    }, false) : persist(s);
    // The local session now owns this snapshot, including while its host save
    // waits. A newer edit can replace the queued snapshot before an older ack.
    d.original = submitted;
    d.originalTitle = imFormat.title(edited);
    d.originalTags = submittedTags;
    d.boardDirty = d.boardDirty || changed;
    const stored = unfinishedEdits.get(editKey(s.note.uuid, id));
    if (stored?.text === submitted && (stored.title ?? originalTitle) === submittedTitle && JSON.stringify(stored
        .tags) === JSON.stringify(submittedTags)) unfinishedEdits.delete(editKey(s.note.uuid, id));
    s.intents.add({
      revision: s.revision,
      finish: () => {
        if (modalState !== d || sequence !== d.saveSequence) return;
        d.busy = false;
        close.disabled = false;
        close.textContent = 'Close';
        close.setAttribute('aria-label', 'Close');
        if (d.error) {
          d.error.remove();
          d.error = null;
        }
        if (d.wantClose && d.fieldRevision === revision) {
          finishCard(d);
          notify('Card updated.');
        } else {
          d.wantClose = false;
          refreshEditorMetadata();
        }
      }
    });
    try {
      await saving;
      return d.fieldRevision === revision;
    } catch {
      if (modalState !== d || sequence !== d.saveSequence) return false;
      d.busy = false;
      d.wantClose = false;
      close.disabled = false;
      close.textContent = 'Retry save';
      close.setAttribute('aria-label', 'Retry save');
      dialogError(d, 'Saving was not confirmed. Your text is still here. Retry save before closing.');
      return false;
    }
  }
  if (phoneBoard) {
    const caretSpace = el('div', 'card-caret-space');
    caretSpace.hidden = true;
    caretSpace.setAttribute('aria-hidden', 'true');
    scroller.append(caretSpace);
    d.scrollObserver.observe(bodyEditor.toolbar);
    // Keyboard resizing does not necessarily move a contenteditable's caret
    // into its nested scroller. Measure after layout, without refocusing or
    // changing selection, and never scroll the Board/host document.
    d.revealCaret = () => {
      cancelAnimationFrame(d.caretFrame);
      d.caretFrame = requestAnimationFrame(() => {
        if (modalState !== d || !d.bodyReady) return;
        const view = body.imRich.view;
        const panel = bodyEditor.toolbar.hidden ? null : bodyEditor.toolbar.getBoundingClientRect();
        // Extend only the scrollable overflow, without changing the card's
        // intrinsic height when its floating formatting panel is opened.
        caretSpace.hidden = !panel;
        caretSpace.style.top = (body.offsetTop + body.offsetHeight + (panel?.height || 0) + 18) + 'px';
        if (document.activeElement !== body || d.selectingText || cardHasTextSelection(d)) return;
        const caret = view.coordsAtPos(view.state.selection.head),
          box = scroller.getBoundingClientRect(),
          visual = window.visualViewport;
        const top = Math.max(box.top, visual?.offsetTop || 0) + 12,
          bottom = Math.min(box.bottom, panel?.top ?? Infinity, (visual?.offsetTop || 0) + (visual?.height ||
            innerHeight)) - 12;
        if (bottom <= top) return;
        if (caret.bottom > bottom) scroller.scrollTop += caret.bottom - bottom;
        else if (caret.top < top) scroller.scrollTop += caret.top - top;
      });
    };
    document.addEventListener('selectionchange', d.revealCaret);
    for (const event of ['focus', 'im-markdown-change', 'keyup', 'pointerup']) body.addEventListener(event, d
      .revealCaret);
    d.viewportResize = () => {
      if (modalState !== d) return;
      const view = window.visualViewport;
      modal.style.setProperty('--card-view-height', (view?.height || innerHeight) + 'px');
      modal.style.setProperty('--card-view-top', (view?.offsetTop || 0) + 'px');
      d.revealCaret();
    };
    window.addEventListener('resize', d.viewportResize);
    window.visualViewport?.addEventListener('resize', d.viewportResize);
    window.visualViewport?.addEventListener('scroll', d.viewportResize);
    d.viewportResize();
  }
  refreshEditorMetadata();
  if (!d.bodyReady) {
    const line = parseFloat(getComputedStyle(body).lineHeight);
    // Only defer when the prefix already exceeds the final viewport. Thus
    // replacing it with the full value cannot change the card's outer size.
    if (scroller.scrollHeight <= scroller.clientHeight + 2 * line || matchMedia('(prefers-reduced-motion: reduce)')
      .matches) d.prepareBody();
  }
  // Restore text focus before motion, with new typing appending to the body.
  if (isIPhone) modal.focus({
    preventScroll: true
  });
  else {
    d.pendingEndCaret = !d.bodyReady;
    body.setSelectionRange(body.value.length, body.value.length);
    body.focus({
      preventScroll: true
    });
  }
  scroller.scrollTop = 0;
  d.updateScroll();
  animateCard(d);
  if (!d.bodyReady) {
    if (d.cardAnimation) d.deferBodyUntilMotion = true;
    else d.bodyFrame = requestAnimationFrame(() => {
      d.bodyFrame = requestAnimationFrame(() => d.prepareBody());
    });
  }
}

function editCard(id) {
  editorDialog(id);
}

function readCard(id) {
  const s = active,
    message = s?.messages.find(m => m.id === id);
  if (!message) return;
  const d = openModal('read', 'Card'),
    parts = MosaicModel.preview(message);
  if (message.replyTo) {
    const quote = button('Show quoted card', null, () => {
      closeModal();
      jumpTo(message.replyTo);
    }, 'reply-preview');
    quote.textContent = message.replyTo.text || 'Quoted message';
    d.root.append(quote);
  }
  const body = el('div', 'reader-body im-rich-display');
  imMarkdown.render(body, imMarkdown.message(message).doc);
  d.root.append(el('h3', 'reader-title', parts.title), body, el('p', 'reader-meta', metaText(message)));
  const tags = el('div', 'reader-tags');
  for (const tag of message.reactions) tags.append(el('span', 'card-tag', tag));
  d.root.append(tags);
  actions(d, [button('Copy', 'copy', () => safeRun(() => copyRecords(s, [message])), 'secondary-button'), button(
    'Reply', 'reply', () => replyTo(id), 'secondary-button'), button('Edit', 'edit', () => editCard(id),
    'primary-button')]);
}
