/* Board rendering, filters, selection, and pinning. */
function renderTags() {
  const box = $('tag-filters');
  box.replaceChildren();
  if (!active) return;
  const s = active;
  const add = (tag, label, icon) => {
    const node = button(label, icon, () => {
      s.view.tag = s.view.tag === tag ? '' : tag;
      s.view.scroll = 0;
      viewport.scrollTop = 0;
      searchOpen = false;
      renderAll();
    }, 'tag-chip' + (tag === '__untagged__' ? ' untagged' : ''));
    if (!icon) {
      node.replaceChildren(el('span', '', tag ? label : 'All'));
    }
    node.setAttribute('aria-label', tag === '__untagged__' ? 'Untagged cards' : tag ? 'Filter by ' + tag :
      'All tags');
    node.setAttribute('aria-pressed', String(s.view.tag === tag));
    box.append(node);
  };
  add('', 'All tags');
  const tags = MosaicModel.tags(s.messages, s.settings),
    pos = Number.isInteger(s.settings.untaggedPosition) ? Math.max(0, Math.min(tags.length, s.settings
      .untaggedPosition)) : tags.length;
  tags.splice(pos, 0, '__untagged__');
  for (const tag of tags) add(tag, tag, tag === '__untagged__' ? 'untagged' : null);
}

function renderAll(inserting = false) {
  boardDrag.cancel(false);
  const s = active;
  renderAppearance();
  renderStatus();
  renderNotice();
  renderCapture();
  renderTags();
  $('welcome').hidden = !!s;
  $('more-button').disabled = !s;
  $('search-button').disabled = !s;
  $('pinned-filter').disabled = !s;
  $('search').disabled = !s;
  $('pinned-filter').setAttribute('aria-pressed', String(!!s?.view.pinned));
  renderSearchControls();
  refreshEditorMetadata();
  $('app').classList.toggle('selection-mode', !!s?.view.selecting);
  rebuildLayout(inserting);
  renderSelection();
}

function renderAppearance() {
  const root = document.documentElement,
    {
      palette,
      fontSize
    } = MosaicModel.appearance(active?.settings),
    font = MosaicModel.fontSizes[fontSize];
  const scale = typeof active?.settings.scale === 'number' && Number.isFinite(active.settings.scale) && active
    .settings.scale > 0 ? active.settings.scale : 1.12;
  root.style.setProperty('--scale', String(scale));
  root.style.setProperty('--paragraph-gap', imParagraphSpacing.style(active?.settings)['--paragraph-gap']);
  if (root.dataset.mosaicPalette !== palette) root.dataset.mosaicPalette = palette;
  if (root.dataset.mosaicFontSize !== fontSize) root.dataset.mosaicFontSize = fontSize;
  for (const [key, value] of Object.entries(font))
    if (typeof value === 'number') {
      const name = '--type-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()),
        next = value + 'px';
      if (root.style.getPropertyValue(name) !== next) root.style.setProperty(name, next);
    }
}

function rebuildLayout(inserting = false) {
  const anchor = inserting ? null : findAnchor();
  layout = active ? MosaicModel.layout(active.messages, active.settings, Math.max(1, board.clientWidth), active
      .view.query, active.view.tag, active.view.pinned, active.view.selecting, boardPreviewRatio, boardPinnedRatio
      ) : {
      items: [],
      headings: [],
      height: 0,
      count: 0
    };
  board.style.height = layout.height + 'px';
  board.replaceChildren();
  mounted.clear();
  for (const heading of layout.headings) {
    const node = el('div', 'section-heading', heading.label);
    node.style.top = heading.y + 'px';
    board.append(node);
  }
  const filtered = active && (active.view.query || active.view.tag || active.view.pinned);
  $('empty').hidden = !active || !!layout.count || active.damaged || !filtered;
  if (anchor) {
    const next = layout.byId?.get(anchor.id);
    if (next) viewport.scrollTop += next.y - anchor.y;
  }
  renderWindow();
}

function reflowBoard() {
  const s = active;
  if (!s) return;
  layout = MosaicModel.layout(s.messages, dragPreview?.session === s ? dragPreview.settings : s.settings, Math.max(
      1, board.clientWidth), s.view.query, s.view.tag, s.view.pinned, s.view.selecting, boardPreviewRatio,
    boardPinnedRatio);
  board.style.height = layout.height + 'px';
  for (const [i, node] of [...board.querySelectorAll('.section-heading')].entries())
    if (layout.headings[i]) node.style.top = layout.headings[i].y + 'px';
  renderWindow();
}

function findAnchor() {
  const top = viewport.getBoundingClientRect().top,
    origin = board.getBoundingClientRect().top;
  const item = MosaicModel.visible(layout, top - origin, top - origin + viewport.clientHeight).find(p => p.y +
    origin + p.height > top && p.y + origin < top + viewport.clientHeight);
  return item ? {
    id: item.message.id,
    y: item.y
  } : null;
}

function scheduleWindow() {
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    renderWindow();
  });
}

function renderWindow() {
  const top = viewport.getBoundingClientRect().top - board.getBoundingClientRect().top,
    low = top - 550,
    high = top + viewport.clientHeight + 550,
    fontSize = MosaicModel.appearance(active?.settings).fontSize;
  const visible = new Set(),
    measurements = [];
  for (const item of MosaicModel.visible(layout, low, high)) {
    visible.add(item.message.id);
    let node = mounted.get(item.message.id);
    if (!node) {
      node = cardNode(item.message, item.width);
      mounted.set(item.message.id, node);
      board.append(node);
    }
    node.classList.toggle('is-drag-placeholder', !!boardDrag.placeholder(item.message.id));
    node.classList.toggle('is-compact', item.width < 230);
    const geometry = item.width + ':' + fontSize + ':' + item.previewRatio + ':' + (active?.settings
      .paragraphSpacing ?? 'medium');
    Object.assign(node.style, {
      width: item.width + 'px',
      height: node.dataset.geometry === geometry ? item.height + 'px' : 'auto',
      transform: `translate(${item.x}px,${item.y}px)`
    });
    if (node.dataset.geometry !== geometry) {
      node.dataset.geometry = geometry;
      node.style.removeProperty('--board-title-lines');
      node.style.removeProperty('--board-body-lines');
      measurements.push({
        node,
        item
      });
    }
  }
  for (const [id, node] of mounted)
    if (!visible.has(id)) {
      node.remove();
      mounted.delete(id);
    }
  // Body text owns the standard preview allowance. Titles, replies and tags
  // add height outside it; they never change the body's visible line count.
  const previewLimit = ({
    node,
    item
  }) => {
    const title = node.querySelector('.card-title'),
      body = node.querySelector('.card-body');
    const bounds = MosaicModel.boardBounds(item.width, fontSize, item.previewRatio),
      available = bounds.maximum - bounds.padding;
    const bodyStyle = body && getComputedStyle(body),
      titleStyle = title && getComputedStyle(title);
    const bodyLine = bodyStyle ? parseFloat(bodyStyle.lineHeight) : 0,
      titleLine = titleStyle ? parseFloat(titleStyle.lineHeight) : 0;
    const titleLines = title ? Math.max(1, Math.floor(available / titleLine)) : 0;
    const bodyLines = body ? Math.max(1, Math.floor(available / bodyLine)) : 0;
    return {
      node,
      titleLines,
      bodyLines,
      bodyHeight: bodyLines ? bodyLines * bodyLine : available
    };
  };
  const limits = measurements.map(previewLimit);
  for (const {
      node,
      titleLines,
      bodyLines,
      bodyHeight
    }
    of limits) {
    node.style.setProperty('--board-title-lines', titleLines);
    node.style.setProperty('--board-body-lines', bodyLines);
    node.style.setProperty('--board-body-height', bodyHeight + 'px');
  }
  // Measure only newly mounted/resized previews, in one read batch. Reuse those
  // real heights on future layouts rather than leaving guessed empty space.
  let changed = false;
  const selecting = !!active?.view.selecting;
  const sizes = measurements.map(({
    node,
    item
  }) => {
    const truncated = [...node.querySelectorAll('.card-title,.card-body')].some(field => field.scrollHeight >
      field.clientHeight + 1);
    const body = node.querySelector('.card-body'),
      bodyTruncated = body && body.scrollHeight > body.clientHeight + 1;
    const bounds = MosaicModel.boardBounds(item.width, fontSize, item.previewRatio),
      filler = bodyTruncated ? Math.max(0, bounds.maximum - bounds.padding - body.clientHeight) : 0;
    return {
      node,
      item,
      truncated,
      height: Math.ceil(node.getBoundingClientRect().height + filler)
    };
  });
  for (const {
      node,
      item,
      truncated,
      height
    }
    of sizes) {
    node.classList.toggle('is-truncated', truncated);
    if (truncated) node.style.height = height + 'px';
    const measured = MosaicModel.measure(item.message, item.width, node.classList.contains('is-pinned'), selecting,
      height, fontSize, item.previewRatio, active?.settings.paragraphSpacing ?? 'medium');
    if (measured && (height !== item.height)) changed = true;
  }
  if (changed) {
    const anchor = findAnchor(),
      s = active,
      locatedY = s.locatedId ? layout.byId.get(s.locatedId)?.y : null,
      atBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 4;
    layout = MosaicModel.layout(s.messages, dragPreview?.session === s ? dragPreview.settings : s.settings, Math
      .max(1, board.clientWidth), s.view.query, s.view.tag, s.view.pinned, s.view.selecting, boardPreviewRatio,
      boardPinnedRatio);
    board.style.height = layout.height + 'px';
    for (const [index, heading] of layout.headings.entries()) board.querySelectorAll('.section-heading')[index]
      .style.top = heading.y + 'px';
    for (const [id, node] of mounted) {
      const item = layout.byId.get(id);
      if (item) Object.assign(node.style, {
        height: item.height + 'px',
        transform: `translate(${item.x}px,${item.y}px)`
      });
    }
    if (s.locatedId && !boardDrag.dragging && locatedY != null) {
      const next = layout.byId.get(s.locatedId);
      if (next && Math.abs(next.y - locatedY) > .5) viewport.scrollTop += next.y - locatedY;
    } else if (!s.locatedId && !boardDrag.dragging) {
      if (atBottom) viewport.scrollTop = viewport.scrollHeight;
      else if (anchor) {
        const next = layout.byId.get(anchor.id);
        if (next && Math.abs(next.y - anchor.y) > .5) viewport.scrollTop += next.y - anchor.y;
      }
    }
    scheduleWindow();
  }
  boardMotion.reveal(mounted);
}

function metaText(message) {
  const bits = [];
  if (message.copied) bits.push('Copied');
  if (message.exported) bits.push('Exported');
  if (MosaicModel.isImported(message)) bits.push('Imported');
  if (message.createdAt && !Number.isNaN(new Date(message.createdAt).getTime())) bits.push(cardTimestampFormat
    .format(new Date(message.createdAt)));
  if (message.edited) bits.push('Edited');
  return bits.join(' · ');
}

function renderSearchControls() {
  renderDateControls();
  const s = active,
    selecting = !!s?.view.selecting,
    filtered = !!s && (s.view.query || s.view.tag || s.view.pinned);
  $('search-tags-panel').hidden = !searchOpen || selecting;
  $('search-button').setAttribute('aria-expanded', String(searchOpen && !selecting));
  $('change-filter').setAttribute('aria-expanded', String(searchOpen && !selecting));
  if (searchOpen && !selecting) {
    const header = document.querySelector('.board-toolbar'),
      panel = $('search-tags-panel');
    panel.style.top = (header.offsetTop + header.offsetHeight + 6) + 'px';
    if (!searchPanelFit) searchPanelFit = imWatchSearchPanel(panel);
    else searchPanelFit.update();
  } else if (searchPanelFit) {
    searchPanelFit.destroy();
    searchPanelFit = null;
  }
  $('search-button').hidden = !!filtered || selecting;
  $('more-button').hidden = !!filtered || selecting;
  $('filter-pill').hidden = !filtered || selecting;
  const change = $('change-filter');
  change.replaceChildren();
  const symbol = el('span', 'filter-symbol ui-filter-symbol');
  if (s?.view.tag && s.view.tag !== '__untagged__') symbol.textContent = s.view.tag;
  else symbol.append(s?.view.tag === '__untagged__' ? mosaicToolbarIcon('untagged') : s?.view.pinned ? mosaicIcon(
    'pin') : mosaicToolbarIcon('searchOnly'));
  const check = el('span', 'filter-check ui-filter-check');
  check.append(mosaicToolbarIcon('check'));
  symbol.append(check);
  change.append(symbol);
}

function renderDateControls() {
  if (!searchOpen) dateOpen = false;
  $('date-filter-button').setAttribute('aria-expanded', String(dateOpen));
  const holder = $('date-panel');
  holder.hidden = !dateOpen;
  if (!dateOpen) holder.replaceChildren();
  else if (!holder.firstChild) {
    const session = active;
    holder.append(imCreateDateJumpPanel({
      onJump: value => {
        if (active !== session) return false;
        const target = imDateTarget(session.messages, value);
        if (!target) return false;
        searchOpen = false;
        dateOpen = false;
        jumpTo(MosaicModel.reply(target.message, session.note.uuid));
        const notice = imDateJumpNotice(target);
        if (notice) notify(notice);
        return true;
      },
      onClose: () => {
        dateOpen = false;
        renderDateControls();
      }
    }));
    holder.firstChild.openPicker();
  }
}

function toggleSearch() {
  searchOpen = !searchOpen;
  hideMenu();
  renderSearchControls();
  if (searchOpen) $('search').focus();
}

function fillEmojiTag(badge, tag) {
  badge.replaceChildren();
  // The same rounded vector body, pointed tail and transparent hole as IM.
  for (const [className, markup] of [
      ['emoji-tag-body', '<rect width="100%" height="100%" rx="6"/><rect x="50%" width="50%" height="100%"/>'],
      ['emoji-tag-tip',
        '<path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H2Q6 0 9 4L18 16Q22 20 18 24L9 36Q6 40 2 40H0ZM13 20a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0Z"/>'
      ]
    ]) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (className === 'emoji-tag-tip') svg.setAttribute('viewBox', '0 0 20 40');
    svg.innerHTML = markup;
    badge.append(svg);
  }
  badge.append(el('span', 'emoji-tag-emoji', tag));
}

function cardNode(message, width) {
  const s = active,
    parts = MosaicModel.preview(message),
    pinned = MosaicModel.pins(s.settings).includes(message.id);
  const node = el('article', 'card' + (pinned ? ' is-pinned' : '') + (s.view.selected.has(message.id) ?
    ' selected' : ''));
  if (s.locatedId === message.id) node.classList.add('located');
  const color = MosaicModel.color(message);
  node.style.setProperty('--card-color', color.background);
  node.style.setProperty('--card-ink', color.ink);
  node.dataset.id = message.id;
  node.setAttribute('role', 'listitem');
  node.tabIndex = 0;
  node.setAttribute('aria-label', MosaicModel.label(message));
  if (s.view.selecting) {
    const check = el('span', 'selection-check');
    if (s.view.selected.has(message.id)) check.append(mosaicIcon('check'));
    node.append(check);
    node.setAttribute('aria-label', (s.view.selected.has(message.id) ? 'Selected: ' : 'Select: ') + MosaicModel
      .label(message));
  }
  const activate = () => {
    if (!menu.hidden) return;
    s.view.selecting ? toggleSelection(message.id) : writable(s) ? editorDialog(message.id) : readCard(message
      .id);
  };
  if (parts.title) node.append(el('h2', 'card-title', parts.title));
  if (message.replyTo) node.append(el('div', 'card-reply', imMarkdown.message(message.replyTo).text.replace(/\s+/g,
    ' ').slice(0, 150) || 'Quoted message'));
  if (parts.body) {
    const body = el('div', 'card-body im-rich-display');
    imMarkdown.render(body, imMarkdown.bounded(message), index => {
      if (active !== s || !writable(s)) return;
      if (s.view.selecting) {
        toggleSelection(message.id);
        return;
      }
      const source = s.messages.find(m => m.id === message.id);
      if (source) safeRun(() => update(s, {
        messages: s.messages.map(m => m === source ? imFormat.editMessage(m, imMarkdown.toggleCheck(m
          .text, index)) : m)
      }));
    });
    node.append(body);
  }
  if (message.reactions.length) {
    const tags = el('div', 'card-tags');
    const tagCount = MosaicModel.boardTagCount(message, width, MosaicModel.appearance(s.settings).fontSize);
    for (const tag of message.reactions.slice(0, tagCount)) {
      const badge = button('Filter messages by ' + tag, null, () => {
        if (active !== s) return;
        if (s.view.selecting) {
          toggleSelection(message.id);
          return;
        }
        s.view.tag = tag;
        s.view.scroll = 0;
        viewport.scrollTop = 0;
        searchOpen = false;
        hideMenu();
        renderAll();
      }, 'card-tag');
      fillEmojiTag(badge, tag);
      tags.append(badge);
    }
    const remaining = message.reactions.length - tagCount;
    if (remaining > 0) {
      const more = button('Show ' + remaining + ' more tag' + (remaining === 1 ? '' : 's'), null, activate,
        'card-tag card-tag-overflow');
      more.textContent = '+' + remaining;
      tags.append(more);
    }
    node.append(tags);
  }
  node.addEventListener('click', activate);
  node.addEventListener('keydown', event => {
    if (event.target !== node) return;
    if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key) && !s.view.selecting && writable(s)) {
      event.preventDefault();
      if (event.repeat) return;
      const pinned = new Set(MosaicModel.pins(s.settings)),
        items = layout.items.filter(item => pinned.has(item.message.id) === pinned.has(message.id)),
        i = items.findIndex(item => item.message.id === message.id),
        direction = event.key === 'ArrowUp' ? -1 : 1,
        target = items[i + direction];
      if (target) {
        const before = boardMotion.snapshot(mounted),
          settings = MosaicModel.moveCard(s.messages, s.settings, message.id, target.message.id, direction >
          0);
        safeRun(() => update(s, {
          settings
        }));
        boardMotion.move(before, mounted);
        mounted.get(message.id)?.focus({
          preventScroll: true
        });
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      node.click();
    }
  });
  bindContextMenu(node, event => {
    const current = s.messages.find(m => m.id === message.id);
    if (current) cardMenu(current, event);
  }, () => active === s && !s.view.selecting && !boardDrag.placeholder(message.id));
  return node;
}

function toggleSelection(id) {
  const v = active.view,
    entering = !v.selecting;
  v.selecting = true;
  searchOpen = false;
  v.selected.has(id) ? v.selected.delete(id) : v.selected.add(id);
  rememberSelection();
  if (entering) renderAll();
  else {
    refreshSelectionCards();
    renderSelection();
  }
}

function refreshSelectionCards() {
  for (const [id, node] of mounted) {
    const selected = active.view.selected.has(id);
    node.classList.toggle('selected', selected);
    const check = node.querySelector('.selection-check');
    if (check) {
      check.replaceChildren();
      if (selected) check.append(mosaicIcon('check'));
    }
    const message = layout.byId?.get(id)?.message;
    if (message) node.setAttribute('aria-label', (selected ? 'Selected: ' : 'Select: ') + MosaicModel.label(
      message));
  }
}

function startSelection(id) {
  active.view.selecting = true;
  searchOpen = false;
  if (id) active.view.selected.add(id);
  rememberSelection();
  renderAll();
}

function cancelSelection() {
  if (!active) return;
  active.view.selecting = false;
  active.view.selected.clear();
  rememberSelection();
  renderAll();
}

function selectedRecords() {
  return active.messages.filter(m => active.view.selected.has(m.id));
}

function renderSelection() {
  const bar = $('selection-bar'),
    toolbar = $('selection-toolbar'),
    s = active;
  bar.hidden = toolbar.hidden = !s?.view.selecting;
  bar.replaceChildren();
  toolbar.replaceChildren();
  if (bar.hidden) return;
  const count = s.view.selected.size,
    controls = el('div', 'ui-selection-actions');
  controls.setAttribute('aria-label', 'Selected cards');
  const choices = [
    ['tag', 'Add tags to selected cards', event => batchTagMenu(event)],
    ['copy', 'Copy selected', () => safeRun(() => copyRecords(s, selectedRecords()))],
    ['export', 'Export selected', () => safeRun(() => exportRecords(s, selectedRecords()))],
    ['more', 'Selection options', event => selectionMenu(event)],
    ['delete', 'Delete selected', () => deleteCards(s, new Set(s.view.selected))]
  ];
  for (const [kind, label, action] of choices) {
    const control = button(label, null, action, 'ui-selection-action' + (kind === 'delete' ? ' selection-delete' :
      ''));
    control.replaceChildren(mosaicIcon(kind, true));
    control.disabled = !count || !writable(s);
    controls.append(control);
  }
  toolbar.append(controls);
  const all = button('Select all', 'selectAll', () => {
    for (const item of layout.items) s.view.selected.add(item.message.id);
    rememberSelection();
    refreshSelectionCards();
    renderSelection();
  }, 'selection-all');
  const description = el('span', 'selection-description', `${count} / ${s.messages.length} selected`);
  description.setAttribute('role', 'status');
  const cancel = button('Cancel selection', null, cancelSelection, 'selection-cancel');
  cancel.replaceChildren(mosaicIcon('cancel', true));
  bar.append(all, description, cancel);
  syncOverlayMetrics();
}

function selectionMenu(event) {
  const s = active;
  if (!writable(s)) return;
  const ids = new Set(s.view.selected),
    state = imSelectedPinState(s.messages, s.settings, ids);
  if (!state.count) return;
  showMenu([
    [state.allPinned ? 'Unpin selected' : 'Pin selected', state.allPinned ? 'unpin' : 'pin', () => {
      if (active !== s || !writable(s)) return;
      const settings = imToggleSelectedPins(s.messages, s.settings, ids);
      if (settings !== s.settings) return update(s, {
        settings
      });
    }],
    ['Background options', 'palette', () => {
      if (active !== s || !writable(s)) return;
      colorMenu(ids, {
        currentTarget: $('selection-toolbar').querySelector('[aria-label="Selection options"]')
      });
    }], null, ['Merge selected', 'merge', () => mergeDialog()],
    ['Clear message statuses', 'select', () => statusDialog(ids)]
  ], event);
}

function syncOverlayMetrics() {
  const app = $('app'),
    capture = $('capture-composer');
  if (!capture) return;
  const height = Math.ceil(capture.getBoundingClientRect().height),
    bottom = parseFloat(getComputedStyle(capture).bottom) || 24;
  const set = (key, value) => {
    if (app.style.getPropertyValue(key) !== value) app.style.setProperty(key, value);
  };
  set('--notice-height', ($('notice').hidden ? 0 : $('notice').offsetHeight) + 'px');
  set('--capture-clearance', (height + bottom + 16) + 'px');
  $('selection-bar').style.setProperty('--selection-row-height', Math.max(46, height) + 'px');
  if (searchOpen) renderSearchControls();
}

function batchTagMenu(event) {
  const s = active,
    ids = new Set(s.view.selected);
  if (!ids.size || !writable(s)) return;
  const records = s.messages.filter(m => ids.has(m.id));
  hideMenu();
  menu.replaceChildren();
  menu.className = 'menu ui-context-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Tags for selected cards');
  const panel = el('section', 'ui-tag-panel'),
    grid = el('div', 'ui-tag-grid');
  for (const tag of MosaicModel.tags(s.messages, s.settings)) {
    const choice = button('Add ' + tag + ' to selected cards', null, () => {
      hideMenu();
      if (active !== s || !writable(s)) return;
      const messages = s.messages.map(m => ids.has(m.id) && !m.reactions.includes(tag) ? {
        ...m,
        reactions: [...m.reactions, tag]
      } : m);
      if (messages.some((m, i) => m !== s.messages[i])) safeRun(() => update(s, {
        messages
      }));
    }, 'ui-tag-choice');
    choice.textContent = tag;
    choice.setAttribute('aria-pressed', String(records.every(m => m.reactions.includes(tag))));
    grid.append(choice);
  }
  panel.append(grid);
  menu.append(panel);
  placeMenu(event);
}

function togglePin(s, id) {
  const ids = MosaicModel.pins(s.settings);
  const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
  return update(s, {
    settings: {
      ...s.settings,
      pinnedMessageIds: next
    }
  });
}
