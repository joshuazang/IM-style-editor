/* Initialize Mosaic and wire the Board, Card view, and host events. */
const $ = id => document.getElementById(id);

function el(tag, className = '', text) {
  const node = document.createElement(tag);
  if (tag === 'input' || tag === 'textarea') imPrivateTextField(node);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, icon, handler, className = 'icon-button') {
  const node = el('button', className);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.title = label;
  if (icon) node.append(mosaicIcon(icon));
  else node.textContent = label;
  if (handler) node.addEventListener('click', event => {
    event.stopPropagation();
    handler(event);
  });
  return node;
}
const cardTimestampFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});
const isIPhone = /\biPhone\b/i.test(navigator.userAgent);
const phoneBoard = navigator.userAgentData?.mobile === true ||
  /\biPhone\b|\biPod\b|Android.*\bMobile\b|Windows Phone/i.test(navigator.userAgent);
const boardPreviewRatio = phoneBoard ? 8 : 14,
  boardPinnedRatio = phoneBoard ? 6 : 8;
document.documentElement.classList.toggle('is-iphone', isIPhone);
document.documentElement.classList.toggle('is-phone', phoneBoard);
const modal = $('modal'),
  menu = $('menu'),
  viewport = $('viewport'),
  board = $('board');
let active = null,
  trashView = null,
  modalState = null,
  cardBackSwipe = null,
  toastTimer, frame = 0,
  searchOpen = false,
  menuFromTouch = false,
  menuPress = false,
  dateOpen = false,
  layout = {
    items: [],
    headings: [],
    height: 0,
    count: 0
  };
let mounted = new Map(),
  selectionPreferences = Object.create(null),
  searchPanelFit = null;
let dragPreview = null;
let captureEditor;
const boardMotion = new MosaicBoardMotion(board, viewport);
const boardDrag = new MosaicBoardDrag({
  board,
  viewport,
  canStart: () => writable() && !active.view.selecting && !modal.open && menu.hidden,
  canContinue: () => !!dragPreview && dragPreview.session === active && writable() && !active.view.selecting &&
    !modal.open && menu.hidden,
  onClearCapture: () => {
    outsideCapture = null;
    window.getSelection()?.removeAllRanges();
  },
  onStart: id => {
    if (!writable()) return false;
    dragPreview = {
      session: active,
      id,
      settings: active.settings,
      pins: new Set(MosaicModel.pins(active.settings))
    };
    return true;
  },
  getLayout: () => layout,
  hitRect: item => mounted.get(item.message.id)?.getBoundingClientRect(),
  candidates: y => {
    const nearby = MosaicModel.visible(layout, y - 400, y + 400),
      seen = new Set(nearby.map(item => item.message.id));
    // A moving card can still be visible far from its final layout position.
    for (const id of mounted.keys()) {
      const item = layout.byId.get(id);
      if (item && !seen.has(id)) {
        nearby.push(item);
        seen.add(id);
      }
    }
    return nearby.length ? nearby : y < 0 ? layout.items.slice(0, 3) : layout.items.slice(-3);
  },
  getBounds: () => {
    const bounds = viewport.getBoundingClientRect();
    return {
      top: bounds.top,
      bottom: Math.min(bounds.bottom, $('capture-composer').getBoundingClientRect().top - 8)
    };
  },
  sameSection: (id, target) => dragPreview.pins.has(id) === dragPreview.pins.has(target),
  getSlot: id => {
    const item = layout.byId?.get(id),
      origin = board.getBoundingClientRect();
    return item ? {
      left: origin.left + item.x,
      top: origin.top + item.y
    } : null;
  },
  onPreview: (id, target, after) => {
    const s = active;
    let settings = MosaicModel.moveCard(s.messages, dragPreview.settings, id, target, after);
    if (settings === dragPreview.settings) settings = MosaicModel.moveCard(s.messages, dragPreview.settings,
      id, target, !after);
    if (settings === dragPreview.settings) return;
    const before = boardMotion.snapshot(mounted);
    dragPreview.settings = settings;
    reflowBoard();
    boardMotion.move(before, mounted);
  },
  onDrop: () => {
    const preview = dragPreview;
    dragPreview = null;
    if (preview?.session !== active || !writable()) return;
    const current = MosaicModel.ordered(active.messages, active.settings),
      next = MosaicModel.ordered(active.messages, preview.settings);
    // Keep the preview's measured geometry on drop instead of rebuilding it
    // from estimates while the lifted card is landing.
    if (next.some((message, i) => message.id !== current[i].id)) safeRun(() => update(active, {
      settings: preview.settings
    }, false));
    else renderWindow();
  },
  onCancel: redraw => {
    const before = redraw ? boardMotion.snapshot(mounted) : null;
    dragPreview = null;
    if (redraw) {
      reflowBoard();
      boardMotion.move(before, mounted);
    }
  },
  onSettled: () => renderWindow()
});
const viewMemory = new Map(),
  unfinishedEdits = new Map();
// Only unconfirmed sessions and deferred status intents survive note switches.
// Both are working memory; no text or recovery copy is written to browser storage.
const retainedSessions = new Map(),
  transferMarks = new Map();
const editKey = (uuid, id) => JSON.stringify([uuid, id]);

function latestUnfinished(uuid) {
  let latest;
  for (const entry of unfinishedEdits.values())
    if (entry.noteId === uuid) latest = entry;
  return latest;
}
const saveFeedback = new ImSaveFeedback(() => renderStatus());
const pf = new MosaicRelay({
  targetWindow: window,
  options: {
    coallesedSaving: false,
    acceptsThemes: false
  },
  onReady: () => {
    const saved = pf.getComponentDataValueForKey('mosaicSelectionsV1');
    if (saved && typeof saved === 'object' && !Array.isArray(saved))
      for (const [id, ids] of Object.entries(saved)) {
        if (Array.isArray(ids) && ids.every(imFormat.validId)) selectionPreferences[id] = ids;
      }
    pf.streamContextItem(receive);
  }
});

function notify(text) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 5000);
}

function safeRun(action) {
  try {
    Promise.resolve(action()).catch(error => notify(error.message || 'The action could not be completed.'));
  } catch (error) {
    notify(error.message);
  }
}
/* A hold only arms the menu. Release opens it; movement/cancellation never does. */
function bindBoardContextMenu(node, open, canHold) {
  let gesture = null,
    timer = 0,
    suppressUntil = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = 0;
    gesture = null;
  };
  node.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || event.isPrimary === false || event.target.closest(
        'button,input,textarea,select,[contenteditable],#menu') || !canHold()) return;
    cancel();
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scroll: viewport.scrollTop,
      ready: false
    };
    const current = gesture;
    timer = setTimeout(() => {
      if (gesture !== current || !node.isConnected || !canHold()) {
        cancel();
        return;
      }
      window.getSelection()?.removeAllRanges();
      current.ready = true;
      outsideCapture = null;
      timer = 0;
    }, 520);
  });
  node.addEventListener('pointermove', event => {
    if (gesture && event.pointerId === gesture.id && Math.hypot(event.clientX - gesture.x, event.clientY -
        gesture.y) > 10) cancel();
  });
  node.addEventListener('pointerup', event => {
    const held = gesture;
    if (!held || held.id !== event.pointerId) return;
    cancel();
    if (!held.ready || !canHold() || Math.abs(viewport.scrollTop - held.scroll) > 2) return;
    suppressUntil = performance.now() + 800;
    outsideCapture = null;
    open({
      clientX: held.x,
      clientY: held.y,
      currentTarget: node,
      anchor: node.getBoundingClientRect(),
      touch: true
    });
  });
  for (const name of ['pointercancel', 'pointerleave']) node.addEventListener(name, cancel);
  node.addEventListener('click', event => {
    if (performance.now() < suppressUntil && event.detail !== 0 && !event.target.closest('#menu')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  node.addEventListener('contextmenu', event => {
    if (event.target.closest('#menu')) return;
    const touch = !!gesture || event.pointerType === 'touch' || (matchMedia(
      '(pointer:coarse) and (hover:none)').matches && event.pointerType !== 'mouse');
    if (touch && event.target.closest('input,textarea,select,[contenteditable]')) return;
    event.preventDefault();
    if (!touch) open(event);
  });
}
// iOS keyboards may issue beforeinput without a useful keydown. Shift+Enter
// remains a native line break; neither path submits an IME confirmation key.
function bindSubmitField(field, submit, {
  composing = () => false,
  newline
} = {}) {
  let allowLineBreak = false,
    ime = false;
  const allowThisEvent = () => {
    allowLineBreak = true;
    setTimeout(() => allowLineBreak = false, 0);
  };
  field.addEventListener('compositionstart', () => ime = true);
  field.addEventListener('compositionend', () => ime = false);
  field.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    if (event.isComposing || event.keyCode === 229 || ime || composing()) {
      allowThisEvent();
      return;
    }
    if (event.shiftKey) {
      allowThisEvent();
      if (newline) {
        event.preventDefault();
        newline();
      }
      return;
    }
    event.preventDefault();
    if (!event.repeat) submit();
  });
  field.addEventListener('beforeinput', event => {
    if (!['insertLineBreak', 'insertParagraph'].includes(event.inputType) || allowLineBreak || event
      .isComposing || ime || composing()) return;
    event.preventDefault();
    submit();
  });
}

function newView(uuid) {
  const old = viewMemory.get(uuid);
  return old || {
    query: '',
    tag: '',
    pinned: false,
    selecting: false,
    selected: new Set(selectionPreferences[uuid] || []),
    scroll: 0
  };
}

function rememberSelection() {
  if (!active) return;
  if (active.view.selected.size) selectionPreferences[active.note.uuid] = [...active.view.selected];
  else delete selectionPreferences[active.note.uuid];
  if (active.demo) return;
  try {
    const data = {
      ...pf.component.data,
      mosaicSelectionsV1: {
        ...selectionPreferences
      }
    };
    pf.component.data = data;
    pf.postMessage('set-component-data', {
      componentData: data
    }, reply => {
      if (reply?.error) notify('Selection preferences could not be saved. Your cards are unchanged.');
    });
  } catch {
    notify('Selection preferences could not be saved. Your cards are unchanged.');
  }
}
$('date-filter-button').append(mosaicToolbarIcon('calendarSearch'));
$('date-filter-button').addEventListener('click', () => {
  dateOpen = !dateOpen;
  renderDateControls();
});

function demo() {
  if (pf.component.sessionKey) return;
  const thoughts = [
    ['Reading notes', 'Start a list of passages to revisit.\nKeep questions alongside the page numbers.', [
    '📓']],
    ['The evidence exam',
      'Start with the problem, not the pile.\n\nToday: revisit the cases on hearsay. Write one clear example for each exception.',
      ['1️⃣', '📚']
    ],
    ['A cabinet of curiosities',
      'Deep-sea maps, lost observatories, impossible creatures. A place for the questions that lead somewhere unexpected.',
      ['💡']
    ],
    ['Today', 'Finish the evidence outline.\nRead the assigned cases.', ['📍']],
    ['Weekend, slowly',
      'Find a quiet café.\nBring the book with the folded corner.\nLeave room for nothing in particular.', ['📓']
    ],
    ['Project notes', 'Search above the cards.\nUse emoji to group related notes.', ['💡']],
    ['Reading list', 'The Book of Disquiet\nA Field Guide to Getting Lost\nThe Order of Time', ['📚']],
    ['A question for tomorrow', 'What is the smallest useful next step?', ['2️⃣']],
    ['Completed', 'Reading for this week.\nFirst draft of the case summary.', ['✅']],
    ['Ocean, after dark', 'Lanternfish, silent submarines, a notebook full of half-drawn constellations.', [
      '📓']],
    ['Essay outline', 'Introduction\nMain argument\nCounterargument\nConclusion', []],
    ['The idea parking lot',
      'A better desk lamp.\nA short essay about attention.\nA walking route with no destination.', ['3️⃣', '💡']
    ],
    ['A sentence to keep', '“Attention is the beginning of devotion.”', ['📍']],
    ['For the next study session', 'Open the outline. Read one page. Start with ten minutes.', ['1️⃣']]
  ];
  const messages = thoughts.map(([title, body, reactions], i) => ({
    id: imFormat.newId(),
    text: title + '\n' + body,
    reactions,
    createdAt: new Date(Date.now() - (i + 1) * 36e5).toISOString(),
    ...(i === 1 ? {
      edited: true
    } : {})
  }));
  const settings = {
    reactionOrder: ['1️⃣', '2️⃣', '3️⃣', '📓', '📚', '✅', '💡', '📍'],
    pinnedMessageIds: [messages[3].id, messages[1].id]
  };
  receive({
    uuid: 'mosaic-demo',
    mosaicDemo: true,
    content_type: 'Note',
    content: {
      title: 'Sample notes',
      text: imFormat.portable(messages, settings, '')
    }
  });
  active.demo = true;
  renderAll();
}

$('pin-filter-icon').append(mosaicIcon('pin'));
$('more-button').append(mosaicToolbarIcon('more'));
$('search-button').append(mosaicToolbarIcon('searchTags'));
$('clear-filter').append(mosaicToolbarIcon('cancel'));
$('search-button').addEventListener('click', toggleSearch);
$('change-filter').addEventListener('click', toggleSearch);
$('clear-filter').addEventListener('click', () => {
  if (!active) return;
  Object.assign(active.view, {
    query: '',
    tag: '',
    pinned: false
  });
  $('search').value = '';
  searchOpen = false;
  renderAll();
});
$('more-button').addEventListener('click', mainMenu);
captureEditor = imRichField.create({
  id: 'capture-input',
  label: 'Take a note',
  placeholder: 'Take a note…',
  capture: true,
  sendButton: true,
  onSubmit: () => safeRun(() => submitCapture())
});
const originalCapture = $('capture-field');
originalCapture.replaceWith(captureEditor.wrapper);
$('capture-input').addEventListener('im-markdown-change', inputCapture);
$('capture-input').addEventListener('blur', () => flushCapture());
$('capture-input').addEventListener('compositionstart', () => {
  if (active) {
    active.composing = true;
    clearTimeout(active.captureTimer);
  }
});
$('capture-input').addEventListener('compositionend', () => {
  const s = active;
  if (!s) return;
  s.composing = false;
  // The final input event may follow compositionend in the same browser task.
  setTimeout(() => {
    if (active !== s) return;
    if ($('capture-input').value !== MosaicModel.normalized(s.titleEntry?.text ?? s.captureValue))
      inputCapture();
    else if (s.captureStarted != null) scheduleCaptureSave(s);
    const request = s.submitAfterComposition;
    s.submitAfterComposition = null;
    if (request) safeRun(() => submitCapture(s, request.tag));
  }, 0);
});
let outsideCapture = null;

function outsideCaptureTarget(target) {
  return !target.closest(
    '#capture-composer,dialog,#notice,#menu,.im-format-toolbar,.card-tag,#search-button,#change-filter,#search-tags-panel'
    );
}

function captureHasSelection() {
  return !captureEditor.view.state.selection.empty || hasDOMSelectionIn(captureEditor.dom);
}
// Send on a deliberate outside click. A selection gesture may emit a click
// outside the input even though its press (or native selection handle) did not.
document.addEventListener('pointerdown', event => {
  outsideCapture = null;
  if (!active || active.titleEntry || event.button !== 0 || !event.isPrimary || event.shiftKey || event
    .ctrlKey || event.metaKey || event.altKey) return;
  if (document.activeElement !== captureEditor.dom || !outsideCaptureTarget(event.target) ||
    captureHasSelection()) return;
  outsideCapture = {
    session: active,
    tag: active.view.tag,
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    released: false
  };
}, true);
document.addEventListener('pointercancel', event => {
  if (outsideCapture?.id === event.pointerId) outsideCapture = null;
}, true);
document.addEventListener('pointermove', event => {
  if (outsideCapture?.id === event.pointerId && Math.hypot(event.clientX - outsideCapture.x, event.clientY -
      outsideCapture.y) > 9) outsideCapture = null;
}, true);
document.addEventListener('pointerup', event => {
  const pending = outsideCapture;
  if (!pending || pending.id !== event.pointerId) return;
  if (!outsideCaptureTarget(event.target) || captureHasSelection()) {
    outsideCapture = null;
    return;
  }
  pending.released = true;
  setTimeout(() => {
    if (outsideCapture === pending) outsideCapture = null;
  }, 700);
}, true);
document.addEventListener('click', event => {
  const pending = outsideCapture;
  outsideCapture = null;
  if (!pending?.released || pending.session !== active || event.detail === 0 || (event.pointerId !==
      undefined && event.pointerId !== pending.id)) return;
  if (active.titleEntry || !menu.hidden || modal.open || !outsideCaptureTarget(event.target) ||
    captureHasSelection()) return;
  safeRun(() => submitCapture(pending.session, pending.tag));
}, true);
$('pinned-filter').addEventListener('click', () => {
  if (active) {
    active.view.pinned = !active.view.pinned;
    viewport.scrollTop = 0;
    searchOpen = false;
    renderAll();
  }
});
$('search').addEventListener('input', event => {
  if (active) {
    active.view.query = event.target.value;
    viewport.scrollTop = 0;
    renderAll();
  }
});
$('search').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    searchOpen = false;
    renderSearchControls();
    viewport.focus();
  }
});
$('empty-action').addEventListener('click', () => {
  if (!active) return;
  if (active.view.query || active.view.tag || active.view.pinned) {
    Object.assign(active.view, {
      query: '',
      tag: '',
      pinned: false
    });
    $('search').value = '';
    renderAll();
  } else editorDialog();
});
$('preview-button').addEventListener('click', demo);
// Scrolling is navigation, not an intention to hover a card. A fresh mouse
// movement restores hover after scrolling; a stationary cursor never lights up
// whichever card happens to move underneath it. No timers or saves are needed.
let boardScrollAt = 0,
  boardMousePoint = null;

function suppressBoardHover() {
  boardScrollAt = performance.now();
  board.classList.add('is-scrolling');
}
viewport.addEventListener('scroll', () => {
  suppressBoardHover();
  scheduleWindow();
}, {
  passive: true
});
viewport.addEventListener('wheel', suppressBoardHover, {
  passive: true
});
viewport.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') suppressBoardHover();
}, {
  passive: true
});
viewport.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  // movementX/Y can both be zero when entering an iframe. Client coordinates
  // distinguish a deliberate move from a stationary pointer during scrolling.
  const moved = !boardMousePoint || event.clientX !== boardMousePoint.x || event.clientY !== boardMousePoint.y;
  boardMousePoint = {
    x: event.clientX,
    y: event.clientY
  };
  if (moved && performance.now() - boardScrollAt > 120) board.classList.remove('is-scrolling');
}, {
  passive: true
});
let lastWidth = 0;
const overlayObserver = new ResizeObserver(() => {
  if (trashView) return;
  if (board.clientWidth !== lastWidth) {
    lastWidth = board.clientWidth;
    rebuildLayout();
  }
  syncOverlayMetrics();
});
for (const node of [viewport, $('capture-composer'), $('notice')]) overlayObserver.observe(node);
menu.addEventListener('pointerdown', event => {
  event.stopPropagation();
  menuPress = true;
});
menu.addEventListener('click', event => {
  if (menuFromTouch && !menuPress && event.detail !== 0) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  menuPress = false;
}, true);
document.addEventListener('contextmenu', event => {
  if (event.target.closest('.card-edit-dialog')) return;
  if (matchMedia('(pointer:coarse)').matches && event.target.closest(
      'button,[role="button"],.ui-selection-status')) event.preventDefault();
}, true);
document.addEventListener('pointerdown', event => {
  if (!menu.hidden && !menu.contains(event.target) && !event.target.closest(
      '#more-button,.more-card,.palette-card,.detail-more')) hideMenu();
  if (searchOpen && !event.target.closest('#search-tags-panel,.board-toolbar')) {
    searchOpen = false;
    renderSearchControls();
  }
});
document.addEventListener('keydown', event => {
  if (!event.defaultPrevented && !event.isComposing && active && !trashView && !modal.open && !active.view.selecting && (
      event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    searchOpen = true;
    hideMenu();
    renderSearchControls();
    $('search').focus();
    $('search').select();
    return;
  }
  if (event.key === 'Escape') {
    if (active?.titleEntry && menu.hidden && !modal.open) {
      event.preventDefault();
      active.titleEntry = null;
      renderCapture();
      return;
    }
    if (!menu.hidden) {
      event.preventDefault();
      hideMenu();
      return;
    }
    if (modal.open) return;
    if (searchOpen) {
      event.preventDefault();
      searchOpen = false;
      renderSearchControls();
      return;
    }
    if (active?.view.selecting) {
      event.preventDefault();
      cancelSelection();
    }
  }
  if (!menu.hidden && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const items = [...menu.querySelectorAll('button')],
      i = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (i + (event.key ===
      'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
});
// Escape clears a selection first; a subsequent press follows the same
// guarded save-and-close path as Close. Capture it before ProseMirror prevents
// the browser's native dialog action, while allowing IME cancellation to work.
function clearCardSelection(event) {
  const field = document.activeElement;
  if (modal.contains(field) && field.matches('textarea,input') && field.selectionStart !== null && field
    .selectionStart !== field.selectionEnd) {
    const head = field.selectionDirection === 'backward' ? field.selectionStart : field.selectionEnd;
    field.setSelectionRange(head, head);
    return true;
  }
  const body = modalState.body,
    view = body?.imRich?.view,
    selection = window.getSelection();
  const inBody = selection?.rangeCount && body.contains(selection.anchorNode) && body.contains(selection
  .focusNode);
  if (view && (inBody && !selection.isCollapsed || !view.state.selection.empty && (body.contains(event.target) ||
      event.target.closest('.im-format-toolbar')))) {
    const head = inBody && !selection.isCollapsed ? view.posAtDOM(selection.focusNode, selection.focusOffset) :
      view.state.selection.head;
    view.dispatch(view.state.tr.setSelection(imRichDeps.state.TextSelection.near(view.state.doc.resolve(head))));
    view.focus();
    return true;
  }
  if (selection?.rangeCount && !selection.isCollapsed && modal.contains(selection.anchorNode) && modal.contains(
      selection.focusNode)) {
    selection.collapse(selection.focusNode, selection.focusOffset);
    return true;
  }
  return false;
}
modal.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229 && !event.defaultPrevented &&
    modalState?.kind === 'edit' && !modalState.body?.imRich?.view.composing) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat && !clearCardSelection(event)) closeModal();
  }
}, true);
modal.addEventListener('cancel', event => {
  event.preventDefault();
  closeModal();
});
// Handle only gestures delivered inside Mosaic. The enclosing Standard Notes
// app owns gestures that begin outside this iframe; its navigation is not ours.
modal.addEventListener('touchstart', event => {
  cardBackSwipe = null;
  const d = modalState,
    point = event.touches[0];
  if (!isIPhone || d?.kind !== 'edit' || d.busy || d.motionClosing || event.touches.length !== 1 || !point ||
    point.clientX > 24 || cardHasTextSelection(d) || event.target.closest('.editor-body,.editor-title,button'))
    return;
  cardBackSwipe = {
    dialog: d,
    x: point.clientX,
    y: point.clientY,
    dx: 0,
    dy: 0,
    claimed: false
  };
}, {
  capture: true,
  passive: true
});
modal.addEventListener('touchmove', event => {
  const gesture = cardBackSwipe,
    point = event.touches[0];
  if (!gesture) return;
  if (event.touches.length !== 1 || !point || modalState !== gesture.dialog || cardHasTextSelection(gesture
      .dialog)) {
    cardBackSwipe = null;
    return;
  }
  gesture.dx = point.clientX - gesture.x;
  gesture.dy = point.clientY - gesture.y;
  if (gesture.dx < -12 || (Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx))) {
    cardBackSwipe = null;
    return;
  }
  if (gesture.dx > 20 && Math.abs(gesture.dy) < gesture.dx * .6) gesture.claimed = true;
  if (gesture.claimed) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }
}, {
  capture: true,
  passive: false
});
modal.addEventListener('touchend', event => {
  const gesture = cardBackSwipe;
  cardBackSwipe = null;
  if (!gesture?.claimed || modalState !== gesture.dialog) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  if (gesture.dx >= Math.max(60, Math.min(120, innerWidth * .25)) && Math.abs(gesture.dy) < gesture.dx * .6)
    closeModal();
}, {
  capture: true,
  passive: false
});
modal.addEventListener('touchcancel', () => {
  cardBackSwipe = null;
}, {
  capture: true,
  passive: true
});

function hasDOMSelectionIn(node) {
  const selection = window.getSelection();
  return !!(node && selection && !selection.isCollapsed && (node.contains(selection.anchorNode) || node.contains(
    selection.focusNode)));
}

function cardHasTextSelection(d) {
  if (d?.kind !== 'edit') return false;
  const field = document.activeElement;
  return hasDOMSelectionIn(d.body) ||
    !!(field?.matches('.editor-title') && modal.contains(field) && field.selectionStart !== field.selectionEnd) ||
    !!(d.body?.imRich && !d.body.imRich.view.state.selection.empty);
}

function dismissCardKeyboard() {
  if (!phoneBoard || modalState?.kind !== 'edit') return false;
  const field = document.activeElement;
  if (modal.contains(field) && field.matches('.editor-body,.editor-title')) {
    field.blur();
    return true;
  }
  return false;
}

function isOutsideModal(event) {
  const box = modal.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box
    .bottom;
}
modal.addEventListener('pointerdown', event => {
  if (modalState) modalState.outsidePress = event.isPrimary && event.button === 0 && event.target === modal &&
    isOutsideModal(event) ? {
      pointerId: event.pointerId
    } : null;
  const selecting = event.pointerType === 'touch' && cardHasTextSelection(modalState) && (modalState?.scroll
    ?.contains(event.target) || (event.target === modal && !isOutsideModal(event)));
  if (!selecting && !event.target.closest('.editor-body,.editor-title,.im-format-toolbar,.im-format-toggle') &&
    dismissCardKeyboard()) modalState.outsidePress = null;
}, true);
modal.addEventListener('pointercancel', () => {
  if (modalState) modalState.outsidePress = null;
}, true);
modal.addEventListener('click', event => {
  const d = modalState,
    press = d?.outsidePress;
  if (d) d.outsidePress = null;
  // A selection can start inside the card and produce a click on its backdrop.
  // Dismiss only when this same pointer also began outside this modal session.
  if (press && event.detail > 0 && (event.pointerId === undefined || event.pointerId === press.pointerId) &&
    event.target === modal && isOutsideModal(event)) closeModal();
});
window.addEventListener('beforeunload', event => {
  if (active?.captureStarted != null || retainedSessions.size || unfinishedEdits.size || cardEditChanged()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

function flushEditorChanges() {
  flushCapture();
  flushCardEdit();
}
window.addEventListener('blur', flushEditorChanges);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushEditorChanges();
});
window.addEventListener('pagehide', event => {
  flushEditorChanges();
  if (!event.persisted) imFlushNoteSaves();
});
renderAll();
if (window.parent === window && new URLSearchParams(location.search).get('preview') === '1') demo();
