/* Shared Trash filter, selection and confirmation for the two note editors. */
function imCreateTrashView({root = document.createElement('section'), variant, close, change, color}) {
  const make = (tag, style, text) => {
    const node = document.createElement(tag);
    if (style) node.className = style;
    if (text) node.textContent = text;
    return node;
  };
  const button = (label, style, action) => {
    const node = make('button', style, label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const icon = (markup, viewBox = '0 0 24 24') => {
    const node = document.createElementNS('http://www.w3.org/2000/svg','svg');
    node.setAttribute('viewBox',viewBox);
    node.setAttribute('fill','none');
    node.setAttribute('stroke','currentColor');
    node.setAttribute('stroke-width','1.8');
    node.setAttribute('stroke-linecap','round');
    node.setAttribute('stroke-linejoin','round');
    node.setAttribute('aria-hidden','true');
    node.innerHTML = markup;
    return node;
  };
  root.className = 'im-trash-pane im-trash-'+variant;
  root.setAttribute('aria-label','Trash');
  const header = make('header','im-trash-header');
  const pill = make('div','ui-filter-pill im-trash-pill');
  const title = make('h2','im-trash-label','Trash');
  title.prepend(icon(imUiIcons.trash));
  const dismiss = button('', 'ui-filter-clear', close);
  dismiss.setAttribute('aria-label','Close Trash');
  dismiss.title = 'Close Trash';
  dismiss.append(icon(imToolbarIcons.cancel.markup,imToolbarIcons.cancel.viewBox));
  pill.append(title,dismiss);
  header.append(pill);
  const scroller = make('div','im-trash-scroll');
  const list = make('div','im-trash-list');
  list.setAttribute('role','list');
  list.setAttribute('aria-label','Deleted items');
  const empty = make('p','im-trash-empty','Trash is empty.');
  scroller.append(list,empty);
  const footer = make('footer','im-trash-actions');
  const summary = make('span','im-trash-count');
  summary.setAttribute('role','status');
  const restore = button('Restore','',()=>act('restore'));
  const remove = button('Delete permanently','im-trash-danger',()=>{
    question.textContent = selected.size === 1 ? 'Permanently delete this item?' : 'Permanently delete '+selected.size+' items?';
    confirm.showModal();
  });
  footer.append(summary,restore,remove);
  const confirm = make('dialog','im-trash-confirm');
  confirm.setAttribute('aria-label','Confirm permanent deletion');
  const question = make('p','im-trash-question');
  const cancel = button('Cancel','',()=>confirm.close());
  cancel.autofocus = true;
  const proceed = button('Delete permanently','im-trash-danger',()=>{
    confirm.close();
    act('delete');
  });
  const confirmationActions = make('div','im-trash-actions');
  confirmationActions.append(cancel,proceed);
  confirm.append(question,make('p','','This cannot be undone.'),confirmationActions);
  root.append(header,scroller,footer,confirm);
  const selected = new Set();
  const rows = new Map();
  const dateFormat = new Intl.DateTimeFormat(undefined,{dateStyle:'medium'});
  let rendered, busy = false, writable = false;
  function updateActions() {
    footer.hidden = !selected.size;
    summary.textContent = selected.size+' selected';
    restore.disabled = remove.disabled = !writable || busy;
  }
  function pick(row, checked) {
    row.node.classList.toggle('is-selected',checked);
    row.check.setAttribute('aria-pressed',String(checked));
    row.check.textContent = checked ? '✓' : '';
  }
  async function act(action) {
    if (busy || !writable || !selected.size) return;
    busy = true;
    updateActions();
    try {
      await change(action,new Set(selected));
    } catch {
      // The editor's save notice owns the retry and conflict controls.
    } finally {
      busy = false;
      updateActions();
      if (root.isConnected && (document.activeElement === document.body || footer.hidden)) dismiss.focus();
    }
  }
  function update(records, canWrite) {
    writable = canWrite;
    if (records !== rendered) {
      rendered = records;
      const fragment = document.createDocumentFragment();
      const ordered = [...records].reverse().sort((a,b)=>b.trashedOn.localeCompare(a.trashedOn));
      const ids = new Set(records.map(message=>message.id));
      for (const [id] of rows) if (!ids.has(id)) {
        rows.delete(id);
        selected.delete(id);
      }
      for (const message of ordered) {
        const id = message.id;
        let row = rows.get(id);
        if (row?.message !== message) {
          const title = imFormat.title(message);
          const node = make('article','im-trash-item'+(variant==='im'?' message-bubble':''));
          node.setAttribute('role','listitem');
          node.dataset.id = id;
          const preview = make('div','im-trash-preview');
          preview.inert = true;
          if (title) preview.append(make('h3','im-trash-item-title',title));
          const body = make('div','im-trash-body');
          imMarkdown.render(body,imMarkdown.bounded(message));
          preview.append(body);
          const time = make('time','im-trash-date','Deleted '+dateFormat.format(new Date(message.trashedOn+'T12:00:00')));
          time.dateTime = message.trashedOn;
          const check = make('button','im-trash-select');
          check.type = 'button';
          const label = (title || imMarkdown.message(message).text).trim().slice(0,80);
          check.setAttribute('aria-label',label ? 'Select '+label : 'Select item');
          node.append(check,preview,time);
          const background = color?.(message);
          if (background) node.style.backgroundColor = background;
          row = {node,check,message};
          node.addEventListener('click',()=>{
            if (busy) return;
            if (selected.has(id)) selected.delete(id);
            else selected.add(id);
            pick(row,selected.has(id));
            updateActions();
          });
          rows.set(id,row);
        }
        pick(row,selected.has(id));
        fragment.append(row.node);
      }
      list.replaceChildren(fragment);
      empty.hidden = !!records.length;
    }
    updateActions();
  }
  const keydown = event=>{
    if (event.key !== 'Escape' || confirm.open) return;
    event.preventDefault();
    event.stopPropagation();
    if (selected.size) {
      for (const id of selected) pick(rows.get(id),false);
      selected.clear();
      updateActions();
      dismiss.focus();
    } else close();
  };
  root.addEventListener('keydown',keydown);
  return {root, update, focus:()=>dismiss.focus(), destroy:()=>{
    root.removeEventListener('keydown',keydown);
    root.replaceChildren();
  }};
}
