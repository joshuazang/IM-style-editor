/* Inlined into the static bundle by tools/package-release.py. */
const imFormat = (() => {
  const schemaVersion = 1;
  const newMessage = text => ({ id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`), text, reactions: [] });
  const serialize = messages => messages.map((message, index) => message.text +
    (index < messages.length - 1 ? (typeof message.separatorAfter === 'string' ? message.separatorAfter : '\n') : '')).join('');
  const validMessages = messages => Array.isArray(messages) && messages.every(message =>
    message && typeof message.id === 'string' && typeof message.text === 'string');
  const copyMessages = messages => messages.map(message => ({ ...message,
    reactions: Array.isArray(message.reactions) ? message.reactions.filter(tag => typeof tag === 'string') : [] }));
  const paragraphSpans = text => {
    if (!text) return [];
    const spans = [];
    let start = 0;
    for (const match of text.matchAll(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/g)) {
      const end = match.index + match[0].length;
      // Keep leading and trailing blank lines in the first/last message.
      if (match.index === start || end === text.length) continue;
      spans.push({ start, end: match.index });
      start = end;
    }
    spans.push({ start, end: text.length });
    return spans;
  };
  const fromSpans = (text, spans) => spans.map((span, index) => ({
    ...(span.message || newMessage('')),
    text: text.slice(index === 0 ? 0 : span.start, index === spans.length - 1 ? text.length : span.end),
    separatorAfter: index < spans.length - 1 ? text.slice(span.end, spans[index + 1].start) : ''
  }));
  const fromPlainText = text => fromSpans(text, paragraphSpans(text));
  const spansFor = messages => {
    let offset = 0;
    return messages.map((message, index) => {
      const span = { start: offset, end: offset + message.text.length, message };
      offset = span.end + (index < messages.length - 1 ?
        (typeof message.separatorAfter === 'string' ? message.separatorAfter.length : 1) : 0);
      return span;
    });
  };
  function fromLegacyRanges(text, ranges) {
    if (!Array.isArray(ranges) || !ranges.length) return fromPlainText(text);
    let end = 0;
    const spans = [];
    for (const range of ranges) {
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < end ||
          range.end <= range.start || range.end > text.length) return fromPlainText(text);
      const gap = text.slice(end, range.start);
      if (gap && /[^\r\n]/.test(gap)) spans.push({ start: end, end: range.start });
      spans.push({ start: range.start, end: range.end });
      end = range.end;
    }
    if (end < text.length && /[^\r\n]/.test(text.slice(end))) spans.push({ start: end, end: text.length });
    return fromSpans(text, spans);
  }
  function reconcile(text, previous) {
    const messages = copyMessages(previous);
    const old = serialize(messages);
    if (old === text) return messages;
    if (!text) return [];
    let prefix = 0;
    while (prefix < old.length && prefix < text.length && old[prefix] === text[prefix]) prefix++;
    if (prefix && /[\uD800-\uDBFF]/.test(old[prefix - 1])) prefix--;
    let suffix = 0;
    while (suffix < old.length - prefix && suffix < text.length - prefix &&
           old[old.length - suffix - 1] === text[text.length - suffix - 1]) suffix++;
    if (suffix && /[\uDC00-\uDFFF]/.test(old[old.length - suffix])) suffix--;
    const oldEnd = old.length - suffix;
    const newEnd = text.length - suffix;
    const spans = spansFor(messages);
    // A change inside one bubble keeps that bubble's identity, time and categories.
    const changed = spans.findIndex(span => prefix >= span.start && oldEnd <= span.end);
    if (changed !== -1) {
      const span = spans[changed];
      const localStart = prefix - span.start;
      const localEnd = oldEnd - span.start;
      messages[changed].text = span.message.text.slice(0, localStart) + text.slice(prefix, newEnd) + span.message.text.slice(localEnd);
      if (serialize(messages) === text) return messages;
    }
    // Keep complete unaffected bubbles; re-import only the changed area.
    const delta = text.length - old.length;
    const anchors = spans.flatMap(span => {
      if (span.end <= prefix) return [span];
      if (span.start >= oldEnd) return [{ ...span, start: span.start + delta, end: span.end + delta }];
      return [];
    }).filter(span => text.slice(span.start, span.end) === span.message.text);
    const result = [];
    let cursor = 0;
    const fillGap = (start, end) => {
      const gap = text.slice(start, end);
      const leading = gap.match(/^(?:\r?\n)+/)?.[0].length || 0;
      const trailing = gap.match(/(?:\r?\n)+$/)?.[0].length || 0;
      const lo = start + leading, hi = Math.max(lo, end - trailing);
      for (const span of paragraphSpans(text.slice(lo, hi))) result.push({ start: lo + span.start, end: lo + span.end });
    };
    for (const anchor of anchors) {
      fillGap(cursor, anchor.start);
      result.push(anchor);
      cursor = anchor.end;
    }
    fillGap(cursor, text.length);
    return result.length ? fromSpans(text, result) : fromPlainText(text);
  }
  function stateFor(note) {
    const content = note.content || {};
    const text = typeof content.text === 'string' ? content.text : '';
    const saved = note.clientData?.imStyleEditor;
    const protectedState = saved?.schemaVersion === schemaVersion && validMessages(saved.messages) ? saved : null;
    const legacy = validMessages(content.appendEditorMessageData) ? {
      messages: content.appendEditorMessageData, settings: content.appendEditorSettings
    } : null;
    // Older versions may have updated the legacy data without updating clientData.
    const candidates = [legacy, protectedState].filter(Boolean);
    const state = candidates.find(candidate => serialize(candidate.messages) === text) || legacy || protectedState;
    return { text, state, protectedState };
  }
  const readMessages = note => {
    const { text, state } = stateFor(note);
    return state ? reconcile(text, state.messages) : fromLegacyRanges(text, note.content?.appendEditorMessages);
  };
  const readSettings = note => stateFor(note).state?.settings || note.content?.appendEditorSettings || {};
  const isCurrent = (note, messages, settings) => {
    const saved = stateFor(note).protectedState;
    return !!saved && serialize(saved.messages) === note.content.text &&
      JSON.stringify(copyMessages(saved.messages)) === JSON.stringify(copyMessages(messages)) &&
      JSON.stringify(saved.settings) === JSON.stringify(settings);
  };
  function write(note, messages, settings) {
    const savedMessages = copyMessages(messages);
    const savedSettings = JSON.parse(JSON.stringify(settings));
    const text = serialize(savedMessages);
    // clientData is Standard Notes' per-note, per-editor storage. It is saved
    // in the note's component-data domain, independently of the plain text.
    note.clientData = { ...(note.clientData || {}), imStyleEditor: {
      schemaVersion, messages: savedMessages, settings: savedSettings
    } };
    note.content = { ...note.content, text,
      appendEditorMessageData: savedMessages,
      appendEditorSettings: savedSettings,
      appendEditorMessages: spansFor(savedMessages).map(({ start, end }) => ({ start, end })),
      preview_plain: text.slice(0, 160) || ' ', preview_html: undefined
    };
    return note;
  }
  return { serialize, fromPlainText, readMessages, readSettings, reconcile, isCurrent, write };
})();
