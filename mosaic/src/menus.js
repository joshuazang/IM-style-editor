/* Context menus, emoji management, and appearance controls. */
function showMenu(items, event, {
  message,
  toggleTag
} = {}) {
  hideMenu();
  menu.replaceChildren();
  menu.className = 'menu ui-context-menu';
  menu.setAttribute('role', 'menu');
  menu.removeAttribute('aria-label');
  if (message) {
    const panel = el('section', 'ui-tag-panel'),
      grid = el('div', 'ui-tag-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Emoji picker');
    for (const tag of new Set([...MosaicModel.tags(active.messages, active.settings), ...message.reactions])) {
      const choice = button('Tag ' + tag, null, () => {
        hideMenu();
        toggleTag(tag);
      }, 'ui-tag-choice');
      choice.textContent = tag;
      choice.setAttribute('aria-pressed', String(message.reactions.includes(tag)));
      grid.append(choice);
    }
    panel.append(grid);
    menu.append(panel);
  }
  const panel = el('div', 'ui-action-panel');
  for (const item of items) {
    if (!item) {
      panel.append(el('hr'));
      continue;
    }
    const [label, icon, action, danger] = item;
    const b = button(label, icon, () => {
      hideMenu();
      safeRun(action);
    }, danger ? 'danger' : '');
    b.append(el('span', '', label));
    b.setAttribute('role', 'menuitem');
    panel.append(b);
  }
  menu.append(panel);
  placeMenu(event);
}

function placeMenu(event) {
  (modal.open ? $('modal-content') : document.body).append(menu);
  menu.style.maxHeight = '';
  menu.style.maxWidth = '';
  menuFromTouch = event?.touch === true;
  menuPress = false;
  menu.hidden = false;
  $('more-button').setAttribute('aria-expanded', String(event?.currentTarget === $('more-button')));
  const anchor = (event?.currentTarget || $('more-button')).getBoundingClientRect();
  const x = event?.clientX || anchor.right,
    y = event?.clientY || anchor.bottom;
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(10, Math.min(x - rect.width + 20, innerWidth - rect.width - 10)) + 'px';
  menu.style.top = Math.max(10, Math.min(y + 7, innerHeight - rect.height - 10)) + 'px';
  if (menuFromTouch) {
    const visual = window.visualViewport,
      position = imMenuPosition({
        anchor: event.anchor,
        point: {
          x,
          y
        },
        width: rect.width,
        height: menu.scrollHeight + menu.offsetHeight - menu.clientHeight,
        viewport: {
          left: visual?.offsetLeft || 0,
          top: visual?.offsetTop || 0,
          width: visual?.width || innerWidth,
          height: visual?.height || innerHeight
        },
        touch: true
      });
    Object.assign(menu.style, {
      left: position.x + 'px',
      top: position.y + 'px',
      maxWidth: position.maxWidth + 'px',
      maxHeight: position.maxHeight + 'px'
    });
  }
  menu.tabIndex = -1;
  if (event?.currentTarget !== $('more-button')) menu.focus({
    preventScroll: true
  });
}

function hideMenu() {
  menu.hidden = true;
  $('more-button').setAttribute('aria-expanded', 'false');
  menuFromTouch = false;
  menuPress = false;
  if (menu.parentNode !== document.body) document.body.append(menu);
}

function colorMenu(id, event) {
  settleCardMotion();
  const s = active,
    ids = id instanceof Set ? new Set(id) : new Set([id]),
    records = s?.messages.filter(m => ids.has(m.id));
  if (!records?.length || !writable(s)) return;
  hideMenu();
  menu.replaceChildren();
  menu.className = 'menu color-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', id instanceof Set ? 'Selected card background colors' :
  'Card background colors');
  const grid = el('div', 'color-grid'),
    first = MosaicModel.color(records[0]).id,
    current = records.every(m => MosaicModel.color(m).id === first) ? first : null;
  for (const preset of MosaicModel.colors) {
    const swatch = button(preset.name, preset.id === 'default' ? 'noColor' : null, () => {
      hideMenu();
      if (active !== s || !writable(s)) return;
      const messages = MosaicModel.setCardColor(s.messages, ids, preset.id);
      if (messages !== s.messages) safeRun(() => update(s, {
        messages
      }));
    }, 'color-swatch');
    swatch.setAttribute('aria-pressed', String(preset.id === current));
    swatch.style.setProperty('--swatch', preset.light || 'var(--surface)');
    if (preset.id === current) swatch.append(mosaicIcon('check'));
    grid.append(swatch);
  }
  menu.append(grid);
  placeMenu(event);
}

function cardMenu(message, event) {
  settleCardMotion();
  const s = active,
    pinned = MosaicModel.pins(s.settings).includes(message.id);
  const editing = modalState?.kind === 'edit' && modalState.uuid === s.note.uuid && modalState.id === message.id ?
    modalState : null;
  const current = () => s.messages.find(m => m.id === message.id);
  const saved = action => async () => {
    if (editing && !(await editing.commit(false))) return;
    return action();
  };
  showMenu([
    ['Edit', 'edit', () => editCard(message.id)], ...(imFormat.title(message) ? [
      ['Edit title', 'textSize', () => {
        if (editing) editing.unlockTitle();
        else beginTitle(message.id);
      }]
    ] : []), ['Reply', 'reply', saved(() => replyTo(message.id))],
    [pinned ? 'Unpin' : 'Pin', pinned ? 'unpin' : 'pin', () => togglePin(s, message.id)],
    ['Copy', 'copy', saved(() => copyRecords(s, [current()]))],
    ['Select', 'select', saved(() => {
      closeModal(true);
      startSelection(message.id);
    })], null, ['Delete', 'trash', saved(() => deleteCards(s, new Set([message.id]))), true]
  ], event, {
    message: editing ? {
      ...message,
      reactions: [...editing.tags]
    } : message,
    toggleTag: tag => {
      if (editing) {
        editing.toggleTag(tag);
        return;
      }
      const source = current();
      if (source) safeRun(() => update(s, {
        messages: s.messages.map(m => m.id === source.id ? {
          ...m,
          reactions: m.reactions.includes(tag) ? m.reactions.filter(value => value !== tag) : [...m
            .reactions, tag
          ]
        } : m)
      }));
    }
  });
}

function mainMenu(event) {
  if (!menu.hidden && $('more-button').getAttribute('aria-expanded') === 'true') {
    hideMenu();
    return;
  }
  if (!active) return;
  const s = active;
  searchOpen = false;
  renderSearchControls();
  showMenu([
    ['Trash', 'trash', openTrash],
    ['Import from clipboard', 'import', () => importDialog()],
    ['Export all cards', 'export', () => exportRecords(s, s.messages)],
    ['Select cards', 'select', () => startSelection()],
    ['Clear message statuses', 'select', () => statusDialog(null)],
    ['Clear clipboard', 'trash', () => clearClipboardDialog()], null,
    ['Color palette', 'palette', () => appearanceDialog('palette')],
    ['Font size', 'textSize', () => appearanceDialog('fontSize')],
    ['Paragraph spacing', 'textSize', () => appearanceDialog('paragraphSpacing')],
    ['Arrange tags', 'tag', () => arrangeTagsDialog()], null,
    ...(Array.isArray(s.settings.mosaicCardOrder) ? [
      ['Reset card order', 'mosaic', () => {
        const before = boardMotion.snapshot(mounted),
          settings = {
            ...s.settings
          };
        delete settings.mosaicCardOrder;
        safeRun(() => update(s, {
          settings
        }));
        boardMotion.move(before, mounted);
      }]
    ] : []),
    ...(latestUnfinished(s.note.uuid) ? [
      ['Resume unfinished edit', 'edit', () => editCard(latestUnfinished(s.note.uuid).id)]
    ] : []), ['About Mosaic', 'info', () => aboutDialog()]
  ], event);
}

function arrangeTagsDialog() {
  const s = active,
    d = openModal('tags', 'Arrange tags'),
    list = el('div', 'tag-arrange-list');
  d.root.append(list);
  const form = el('form', 'tag-add-form'),
    input = el('input');
  input.placeholder = 'Add an emoji';
  input.maxLength = 32;
  input.required = true;
  input.setAttribute('aria-label', 'Add an emoji category');
  const add = button('Add emoji', null, () => {}, 'secondary-button');
  add.type = 'submit';
  form.append(input, add);
  d.root.append(form);
  actions(d, [button('Done', null, () => closeModal(), 'secondary-button')]);
  const valid = () => active === s && modalState === d && writable(s);
  async function save(change, filter) {
    if (d.busy || !valid()) return;
    const focusLabel = document.activeElement?.getAttribute('aria-label'),
      focusInput = document.activeElement === input;
    d.busy = true;
    for (const node of d.root.querySelectorAll('button,input')) node.disabled = true;
    if (filter !== undefined) s.view.tag = filter;
    try {
      await update(s, change);
      if (modalState === d) {
        input.value = '';
        if (d.error) {
          d.error.remove();
          d.error = null;
        }
      }
    } catch {
      dialogError(d,
        'Saving was not confirmed. Your tag changes are retained; close this panel and use Retry save.');
    } finally {
      d.busy = false;
      if (modalState === d) {
        for (const node of d.root.querySelectorAll('button,input')) node.disabled = false;
        render();
        const focused = focusInput && !input.disabled ? input : [...d.root.querySelectorAll('button')].find(
          node => !node.disabled && node.getAttribute('aria-label') === focusLabel);
        (focused || d.root.querySelector('.dialog-actions button'))?.focus({
          preventScroll: true
        });
      }
    }
  }

  function render() {
    list.replaceChildren();
    const order = imFilterOrder(MosaicModel.tags(s.messages, s.settings), s.settings.untaggedPosition);
    for (const [index, tag] of order.entries()) {
      const untagged = tag === imUntagged,
        label = untagged ? 'Untagged' : tag,
        row = el('div', 'tag-arrange-row' + (untagged ? ' tag-arrange-untagged' : ''));
      const symbol = el('span', 'tag-arrange-symbol');
      if (untagged) {
        symbol.append(mosaicIcon('untagged'), document.createTextNode('Untagged'));
      } else symbol.textContent = tag;
      row.append(symbol);
      for (const [delta, name, icon] of [
          [-1, 'earlier', 'back'],
          [1, 'later', 'arrow']
        ]) {
        const move = button('Move ' + label + ' ' + name, icon, () => safeRun(() => save({
          settings: imEmojiMove(s.messages, s.settings, tag, delta)
        })), 'icon-button');
        move.disabled = !writable(s) || (delta === -1 ? index === 0 : index === order.length - 1);
        row.append(move);
      }
      if (!untagged) row.append(button('Edit ' + tag, 'edit', () => replaceEmojiDialog(tag), 'icon-button'),
        button('Delete ' + tag, 'trash', () => {
          const count = MosaicModel.index(s.messages).counts.get(tag) || 0;
          if (window.confirm(
              `Remove ${tag} from this note’s menu and ${count} card${count===1?'':'s'}? All cards and their text will be kept.`
              )) safeRun(() => save(imEmojiChange(s.messages, s.settings, tag), s.view.tag === tag ? '' :
            undefined));
        }, 'icon-button danger'));
      if (!writable(s))
        for (const control of row.querySelectorAll('button')) control.disabled = true;
      list.append(row);
    }
    input.disabled = add.disabled = !writable(s);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const settings = imEmojiAdd(s.messages, s.settings, input.value);
      safeRun(() => save({
        settings
      }));
    } catch (error) {
      dialogError(d, error.message);
    }
  });
  render();
}

function replaceEmojiDialog(from) {
  const s = active,
    d = openModal('replace-tag', 'Replace emoji'),
    form = el('form', 'tag-replace-form'),
    label = el('label', '', `Replace ${from} with`),
    input = el('input');
  input.value = from;
  input.maxLength = 32;
  input.required = true;
  input.setAttribute('aria-label', 'Replacement emoji');
  label.append(input);
  form.append(label);
  const count = MosaicModel.index(s.messages).counts.get(from) || 0;
  form.append(el('p', 'dialog-help',
    `Updates tags on ${count} card${count===1?'':'s'}. All text and other tags stay unchanged.`));
  d.root.append(form);
  const row = el('div', 'dialog-actions'),
    cancel = button('Cancel emoji change', null, () => arrangeTagsDialog(), 'secondary-button'),
    save = button('Save emoji change', null, () => {}, 'primary-button');
  save.type = 'submit';
  row.append(cancel, save);
  form.append(row);
  form.addEventListener('submit', event => {
    event.preventDefault();
    safeRun(async () => {
      if (d.busy || active !== s || modalState !== d || !writable(s)) return;
      let to, change;
      try {
        to = imEmojiValue(input.value);
        change = imEmojiChange(s.messages, s.settings, from, to);
      } catch (error) {
        dialogError(d, error.message);
        return;
      }
      d.busy = true;
      save.disabled = cancel.disabled = input.disabled = true;
      if (s.view.tag === from) s.view.tag = to;
      try {
        await update(s, change);
        if (active === s && modalState === d) arrangeTagsDialog();
      } catch {
        dialogError(d,
          'Saving was not confirmed. Your change is retained; close this panel and use Retry save.');
      } finally {
        d.busy = false;
        if (modalState === d) {
          cancel.disabled = false;
          save.disabled = input.disabled = !writable(s);
        }
      }
    });
  });
  input.focus();
  input.select();
}

function appearanceDialog(kind) {
  if (kind === 'paragraphSpacing') {
    paragraphSpacingDialog();
    return;
  }
  const s = active,
    key = kind === 'palette' ? 'mosaicPalette' : 'mosaicFontSize',
    d = openModal('appearance', kind === 'palette' ? 'Color palette' : 'Font size');
  d.root.append(el('p', 'dialog-help', 'For this note. Saved through Standard Notes.'));
  const choices = el('div', 'appearance-choices'),
    items = kind === 'palette' ? MosaicModel.palettes : Object.entries(MosaicModel.fontSizes).map(([id, value]) =>
      ({
        id,
        ...value
      }));
  const controls = [];
  for (const item of items) {
    const choice = button(item.name, null, async () => {
      if (d.busy || active !== s || modalState !== d || !writable(s)) return;
      if (MosaicModel.appearance(s.settings)[kind] === item.id) return;
      d.busy = true;
      controls.forEach(control => control.disabled = true);
      try {
        await update(s, {
          settings: {
            ...s.settings,
            [key]: item.id
          }
        });
      } catch (error) {
        dialogError(d, 'Saving was not confirmed. Keep this editor open and retry saving.');
      } finally {
        d.busy = false;
        if (modalState === d)
          for (const control of controls) {
            control.disabled = !writable(s);
            control.setAttribute('aria-pressed', String(MosaicModel.appearance(s.settings)[kind] === control
              .dataset.value));
          }
      }
    }, 'appearance-choice');
    choice.replaceChildren();
    choice.dataset.value = item.id;
    choice.setAttribute('aria-pressed', String(MosaicModel.appearance(s.settings)[kind] === item.id));
    choice.disabled = !writable(s);
    if (kind === 'palette') {
      const preview = el('span', 'palette-preview ' + item.id);
      preview.setAttribute('aria-hidden', 'true');
      preview.append(el('span'));
      choice.append(preview);
    }
    const label = el('span', 'appearance-choice-label', item.name);
    if (item.description) label.append(el('small', '', item.description));
    if (kind === 'fontSize') label.style.fontSize = item.editBody + 'px';
    choice.append(label);
    choices.append(choice);
    controls.push(choice);
  }
  d.root.append(choices);
  actions(d, [button('Done', null, () => closeModal(), 'secondary-button')]);
}

function paragraphSpacingDialog() {
  const s = active,
    d = openModal('appearance', 'Paragraph spacing');
  d.root.append(el('p', 'dialog-help',
    'For this note in both editors. Medium adds a chat-like paragraph gap; line breaks stay compact.'));
  const control = imParagraphSpacing.control(s.settings, async value => {
    if (d.busy || active !== s || modalState !== d || !writable(s)) return;
    d.busy = true;
    control.update(s.settings, true);
    try {
      await update(s, {
        settings: {
          ...s.settings,
          paragraphSpacing: value
        }
      });
    } catch {
      dialogError(d, 'Saving was not confirmed. Keep this editor open and retry saving.');
    } finally {
      d.busy = false;
      if (modalState === d) control.update(s.settings, !writable(s));
    }
  });
  control.update(s.settings, !writable(s));
  d.root.append(control.dom);
  actions(d, [button('Done', null, () => closeModal(), 'secondary-button')]);
}
