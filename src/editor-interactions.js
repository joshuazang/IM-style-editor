/* Local viewport behavior only: no network, persistence, or clipboard access. */
function imUseMessageViewport({ scroller, composer, noteId, messages }) {
  const [awayFromBottom, setAwayFromBottom] = dt.useState(false);
  const measure = dt.useRef(() => {});
  dt.useLayoutEffect(() => {
    const list = scroller.current, input = composer.current;
    if (!list || !input) return;
    let frame = 0, gesture = null;
    const update = () => {
      const height = Math.ceil(input.getBoundingClientRect().height);
      const shell = input.closest('.editor-shell');
      if (shell && shell.style.getPropertyValue('--composer-height') !== `${height}px`) {
        shell.style.setProperty('--composer-height', `${height}px`);
      }
      setAwayFromBottom(list.scrollHeight - list.clientHeight - list.scrollTop > 48);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    measure.current = schedule;
    const blurInput = () => {
      if (!window.matchMedia('(pointer:coarse) and (hover:none)').matches) return;
      const active = document.activeElement;
      if (active && input.contains(active) && active.matches('textarea,input,[contenteditable=true]')) {
        active.blur();
      }
    };
    const down = event => {
      if (event.pointerType === 'touch' && event.isPrimary !== false) {
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, top: list.scrollTop };
      }
    };
    const move = event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
      if (dy > 10 && dy > dx) blurInput();
    };
    const end = () => { gesture = null; };
    const scroll = () => {
      // Programmatic scrolling and keyboard-induced viewport changes do not dismiss input.
      if (gesture && Math.abs(list.scrollTop - gesture.top) > 2) blurInput();
      schedule();
    };
    list.addEventListener('pointerdown', down, { passive: true });
    list.addEventListener('pointermove', move, { passive: true });
    list.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pointerup', end, { passive: true });
    window.addEventListener('pointercancel', end, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(list);
    observer.observe(input);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      list.removeEventListener('pointerdown', down);
      list.removeEventListener('pointermove', move);
      list.removeEventListener('scroll', scroll);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      measure.current = () => {};
    };
  }, [noteId]);
  dt.useLayoutEffect(() => { measure.current(); }, [messages]);
  const jumpToBottom = () => {
    const list = scroller.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return { awayFromBottom: awayFromBottom && messages.length > 0, jumpToBottom };
}

function ImJumpToBottom({ viewport }) {
  if (!viewport.awayFromBottom) return null;
  return x.jsx('button', { type: 'button', className: 'jump-to-bottom',
    'aria-label': 'Scroll to bottom', title: 'Scroll to bottom', onClick: viewport.jumpToBottom,
    children: x.jsx('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, children: x.jsx('path', { d: 'm6 9 6 6 6-6' }) }) });
}

function ImEditPreview({ message, cancel }) {
  if (!message) return null;
  return x.jsxs('div', { className: 'composer-edit-preview', children: [
    x.jsxs('div', { className: 'composer-edit-context', children: [
      x.jsx('strong', { children: 'Edit message' }),
      x.jsx('div', { className: 'composer-edit-original', children: message.text })
    ] }),
    x.jsx('button', { type: 'button', className: 'cancel-edit', 'aria-label': 'Cancel editing',
      onClick: cancel, children: x.jsx('svg', { width: 20, height: 20, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
        'aria-hidden': true, children: x.jsx('path', { d: 'm6 6 12 12M18 6 6 18' }) }) })
  ] });
}
