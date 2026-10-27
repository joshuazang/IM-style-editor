/* Inlined into the static bundle by tools/package-release.py. */
const imFormat = (() => {
  const schemaVersion = 2;
  const documentStart = '#!im-style-editor 1';
  const documentEnd = ':::end-im-style-editor';
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  // Text remains human-readable. Escape only backslashes, carriage returns and
  // reserved delimiter lines, so even delimiter-looking messages are unambiguous.
  const encodeBody = text => text.replace(/\\/g, '\\\\').replace(/\r/g, '\\r')
    .split('\n').map(line => line.startsWith(':::') ? '\\' + line : line).join('\n');
  const decodeBody = text => text.split('\n').map(line => {
    if (line.startsWith('\\:::')) line = line.slice(1);
    else if (line.startsWith(':::')) throw new Error('Unexpected record inside a message');
    return line.replace(/\\([\\r])|\\/g, (match, escape) => {
      if (!escape) throw new Error('Unrecognized message escape');
      return escape === 'r' ? '\r' : '\\';
    });
  }).join('\n');
  function portable(messages, settings) {
    const lines = [documentStart, ':::settings ' + JSON.stringify(settings)];
    for (const message of copyMessages(messages)) {
      const { text, ...metadata } = message;
      lines.push(':::bubble ' + JSON.stringify(metadata), encodeBody(text), ':::end-bubble');
    }
    lines.push(documentEnd);
    return lines.join('\n') + '\n';
  }
  function inspect(text) {
    if (typeof text !== 'string') text = '';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const recognizable = lines.some(line => /^#!im-style-editor(?:\s|$)/.test(line)) ||
      lines.some(line => line === documentEnd) || /^:::(?:settings |bubble )/.test(lines[0]);
    if (!recognizable) return { kind: 'plain' };
    try {
      if (lines.shift() !== documentStart) throw new Error('Missing or unsupported document header');
      const settingsLine = lines.shift();
      if (!settingsLine?.startsWith(':::settings ')) throw new Error('Missing settings record');
      const settings = JSON.parse(settingsLine.slice(12));
      if (!object(settings)) throw new Error('Invalid settings record');
      const messages = [], ids = new Set();
      let i = 0;
      while (i < lines.length && lines[i] !== documentEnd) {
        if (!lines[i].startsWith(':::bubble ')) throw new Error('Missing bubble boundary');
        const metadata = JSON.parse(lines[i++].slice(10));
        if (!object(metadata) || typeof metadata.id !== 'string' || !metadata.id || ids.has(metadata.id) ||
            'text' in metadata || !Array.isArray(metadata.reactions) ||
            !metadata.reactions.every(tag => typeof tag === 'string') ||
            ('separatorAfter' in metadata && typeof metadata.separatorAfter !== 'string')) {
          throw new Error('Invalid or duplicate bubble record');
        }
        ids.add(metadata.id);
        const start = i;
        while (i < lines.length && lines[i] !== ':::end-bubble') i++;
        if (i === lines.length || i === start) throw new Error('Unclosed bubble');
        messages.push({ ...metadata, text: decodeBody(lines.slice(start, i).join('\n')) });
        i++;
      }
      if (lines[i++] !== documentEnd || lines.slice(i).some(line => line !== '')) {
        throw new Error('Unclosed document or text outside its boundaries');
      }
      return { kind: 'portable', messages, settings };
    } catch (error) {
      return { kind: 'damaged', error: error.message, text };
    }
  }
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
    const protectedState = [1, schemaVersion].includes(saved?.schemaVersion) && validMessages(saved.messages) ? saved : null;
    const legacy = validMessages(content.appendEditorMessageData) ? {
      messages: content.appendEditorMessageData, settings: content.appendEditorSettings
    } : null;
    // Older versions may have updated the legacy data without updating clientData.
    const candidates = [legacy, protectedState].filter(Boolean);
    const state = candidates.find(candidate => serialize(candidate.messages) === text) || legacy || protectedState;
    return { text, state, protectedState };
  }
  const readMessages = note => {
    const document = inspect(note.content?.text);
    if (document.kind === 'portable') return copyMessages(document.messages);
    if (document.kind === 'damaged') return [];
    const { text, state } = stateFor(note);
    return state ? reconcile(text, state.messages) : fromLegacyRanges(text, note.content?.appendEditorMessages);
  };
  const readSettings = note => {
    const document = inspect(note.content?.text);
    return document.kind === 'portable' ? document.settings :
      stateFor(note).state?.settings || note.content?.appendEditorSettings || {};
  };
  const isCurrent = (note, messages, settings) => {
    const saved = note.clientData?.imStyleEditor;
    return saved?.schemaVersion === schemaVersion && portable(messages, settings) === note.content.text &&
      JSON.stringify(copyMessages(saved.messages)) === JSON.stringify(copyMessages(messages)) &&
      JSON.stringify(saved.settings) === JSON.stringify(settings);
  };
  function write(note, messages, settings) {
    const document = inspect(note.content?.text);
    if (document.kind === 'damaged') throw new Error('Damaged note records: original text was not changed');
    const savedMessages = copyMessages(messages);
    const savedSettings = JSON.parse(JSON.stringify(settings));
    const text = portable(savedMessages, savedSettings);
    // Keep the exact pre-migration text and any recoverable legacy records once.
    // This is additional recovery data; portable text is the primary format.
    const previous = note.clientData?.imStyleEditor;
    const migrationBackup = previous?.migrationBackup ||
      (document.kind === 'plain' ? {
        text: note.content?.text || '',
        messages: readMessages(note), settings: readSettings(note)
      } : undefined);
    // clientData is Standard Notes' per-note, per-editor storage. It is saved
    // in the note's component-data domain, independently of the plain text.
    note.clientData = { ...(note.clientData || {}), imStyleEditor: {
      schemaVersion, messages: savedMessages, settings: savedSettings,
      ...(migrationBackup ? { migrationBackup } : {})
    } };
    note.content = { ...note.content, text,
      appendEditorMessageData: savedMessages,
      appendEditorSettings: savedSettings,
      appendEditorMessages: spansFor(savedMessages).map(({ start, end }) => ({ start, end })),
      preview_plain: serialize(savedMessages).slice(0, 160) || ' ', preview_html: undefined
    };
    return note;
  }
  return { serialize, portable, inspect, fromPlainText, readMessages, readSettings, reconcile, isCurrent, write };
})();
