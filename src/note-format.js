/* Version 2: line-oriented archival text with exact blank-line content framing. */
const imFormat = (() => {
  const header = '#!im-style-editor 2';
  const encoding = '#!encoding utf-8';
  const controls = new Set(['@@IM:SETTINGS', '@@IM:END-SETTINGS', '@@IM:BUBBLE', '@@IM:CONTENT', '@@IM:END-BUBBLE', '@@IM:END']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{21}[AQgw]$/.test(value);
  function newId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const newMessage = text => ({ id: newId(), text, reactions: [] });
  function validateMessages(messages) {
    if (!Array.isArray(messages)) throw new Error('Messages must be an array');
    const ids = new Set();
    for (const message of messages) {
      if (!object(message) || !validId(message.id) || ids.has(message.id) || typeof message.text !== 'string' ||
          !Array.isArray(message.reactions) || !message.reactions.every(tag => typeof tag === 'string') ||
          ('createdAt' in message && typeof message.createdAt !== 'string') ||
          ('editedAt' in message && typeof message.editedAt !== 'string') ||
          ('separatorAfter' in message && typeof message.separatorAfter !== 'string')) throw new Error('Invalid or duplicate bubble metadata');
      ids.add(message.id);
    }
  }
  function validateSettings(settings) {
    if (!object(settings)) throw new Error('Settings must be an object');
    for (const key of ['bubbleTheme','backgroundTheme','artwork']) if (key in settings && typeof settings[key] !== 'string') throw new Error('Invalid setting ' + key);
    if ('wallpaper' in settings && typeof settings.wallpaper !== 'boolean') throw new Error('Wallpaper must be boolean');
    if ('scale' in settings && (typeof settings.scale !== 'number' || !Number.isFinite(settings.scale) || settings.scale <= 0)) throw new Error('Scale must be positive');
    for (const key of ['reactionOrder','deletedEmojis']) if (key in settings && (!Array.isArray(settings[key]) || !settings[key].every(tag => typeof tag === 'string'))) throw new Error('Invalid emoji settings');
  }
  const logical = line => line.endsWith('\r') ? line.slice(0, -1) : line;
  // Optional ASCII punctuation is accepted as decoration, never as a boundary.
  const decoration = line => /^[\t\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]*$/.test(line);
  const encodeBody = text => text.split('\n').map(line => line.startsWith('\\') || controls.has(logical(line)) ? '\\' + line : line).join('\n');
  const decodeBody = text => text.split('\n').map(line =>
    line.startsWith('\\\\') || (line.startsWith('\\') && controls.has(logical(line.slice(1)))) ? line.slice(1) : line).join('\n');
  const bubbleFields = { id: 'id', createdAt: 'created', editedAt: 'edited', reactions: 'reactions', separatorAfter: 'separator-after', forwarding: 'forwarding' };
  const settingsFields = { bubbleTheme: 'bubble-theme', backgroundTheme: 'background-theme', wallpaper: 'wallpaper', artwork: 'artwork', scale: 'scale', reactionOrder: 'reaction-order', deletedEmojis: 'deleted-emojis' };
  const valueText = value => typeof value === 'string' && /^[A-Za-z0-9_.:+-]+$/.test(value) && !/^(?:true|false|null|[-+]?\d)/.test(value) ? value : JSON.stringify(value);
  function fields(record, mapping, extrasName) {
    const lines = [], extras = {};
    for (const [key, label] of Object.entries(mapping)) if (Object.hasOwn(record, key)) {
      // IDs and timestamps are readable bare tokens; string parsing is field-aware.
      const value = record[key];
      if (extrasName === 'extra-metadata' && key === 'reactions' && value.length === 0) continue;
      lines.push(label + ': ' + (typeof value === 'string' && ['id','createdAt','editedAt'].includes(key) && /^[A-Za-z0-9_.:+-]+$/.test(value) ? value : valueText(value)));
    }
    for (const [key, value] of Object.entries(record)) if (!Object.hasOwn(mapping, key) && !(extrasName === 'extra-metadata' && key === 'text')) extras[key] = value;
    if (Object.keys(extras).length) lines.push(extrasName + ': ' + JSON.stringify(extras));
    return lines;
  }
  function portable(messages, settings) {
    validateMessages(messages);
    validateSettings(settings);
    const lines = [header, encoding, '', '@@IM:SETTINGS', ...fields(settings, settingsFields, 'extra-settings'), '@@IM:END-SETTINGS', ''];
    for (const message of messages) lines.push('@@IM:BUBBLE', ...fields(message, bubbleFields, 'extra-metadata'),
      '@@IM:CONTENT', '', '', encodeBody(message.text), '', '', '@@IM:END-BUBBLE', '');
    lines.push('@@IM:END');
    return lines.join('\n') + '\n';
  }
  function parseFields(lines, mapping, extrasName) {
    const inverse = Object.fromEntries(Object.entries(mapping).map(([key, label]) => [label, key]));
    const record = {}, seen = new Set();
    for (const line of lines) {
      if (controls.has(line) || /^@@IM:/.test(line) || /^#!/.test(line)) throw new Error('Unexpected control line in metadata');
      // Optional punctuation is decoration, never the start/end of message text.
      if (decoration(line)) continue;
      const match = /^([a-z][a-z-]*): (.*)$/.exec(line);
      if (!match) throw new Error('Malformed metadata field or prose outside message text');
      if (!Object.hasOwn(inverse, match[1]) && match[1] !== extrasName) throw new Error('Unknown metadata field; use ' + extrasName);
      if (seen.has(match[1])) throw new Error('Duplicate metadata field');
      const [, label, raw] = match;
      seen.add(label);
      let value;
      if (['id','created','edited'].includes(label) && !raw.startsWith('"')) value = raw;
      else if (/^[A-Za-z][A-Za-z0-9_.+-]*$/.test(raw) && !['true','false','null'].includes(raw)) value = raw;
      else value = JSON.parse(raw);
      if (label === extrasName) {
        if (!object(value)) throw new Error('Extra metadata must be an object');
        for (const [key, item] of Object.entries(value)) {
          if (Object.hasOwn(mapping,key) || (extrasName === 'extra-metadata' && key === 'text')) throw new Error('Extra metadata shadows a reserved field');
          Object.defineProperty(record, key, { value: item, enumerable: true, writable: true, configurable: true });
        }
      } else record[inverse[label]] = value;
    }
    return record;
  }
  function inspect(text) {
    if (typeof text !== 'string') text = '';
    // Recognize unsupported archival documents, but never read/migrate their data.
    if (!/^#!im-style-editor\b/m.test(text) && !/^@@IM:/m.test(text)) return { kind: 'plain' };
    try {
      const rows = [];
      let start = 0;
      for (let i = 0; i < text.length; i++) if (text[i] === '\n') {
        rows.push({ line: logical(text.slice(start, i)), start, next: i + 1 }); start = i + 1;
      }
      if (start < text.length) rows.push({ line: logical(text.slice(start)), start, next: text.length });
      let i = 0;
      const headerLine = expected => {
        while (i < rows.length && decoration(rows[i].line)) i++;
        if (rows[i++]?.line !== expected) throw new Error('Unsupported format or encoding header; only format 2 is supported');
      };
      headerLine(header); headerLine(encoding);
      const seek = expected => {
        while (i < rows.length && !controls.has(rows[i].line)) {
          if (!decoration(rows[i].line)) throw new Error('Unexpected text outside records');
          i++;
        }
        if (rows[i++]?.line !== expected) throw new Error('Missing control line ' + expected);
      };
      seek('@@IM:SETTINGS');
      const settingLines = [];
      while (i < rows.length && rows[i].line !== '@@IM:END-SETTINGS') settingLines.push(rows[i++].line);
      if (rows[i++]?.line !== '@@IM:END-SETTINGS') throw new Error('Unclosed settings');
      const settings = parseFields(settingLines, settingsFields, 'extra-settings');
      validateSettings(settings);
      const messages = [];
      while (true) {
        // Optional decoration outside records has no structural meaning.
        while (i < rows.length && !controls.has(rows[i].line)) {
          if (!decoration(rows[i].line)) throw new Error('Unexpected text outside records');
          i++;
        }
        if (rows[i]?.line === '@@IM:END') { i++; break; }
        if (rows[i++]?.line !== '@@IM:BUBBLE') throw new Error('Missing bubble or document end');
        const metadata = [];
        while (i < rows.length && rows[i].line !== '@@IM:CONTENT') metadata.push(rows[i++].line);
        const textMarker = rows[i++];
        if (textMarker?.line !== '@@IM:CONTENT' || textMarker.next === text.length) throw new Error('Missing text control line');
        const bodyStart = textMarker.next;
        while (i < rows.length && rows[i].line !== '@@IM:END-BUBBLE') {
          if (controls.has(rows[i].line)) throw new Error('Unexpected control line inside a message');
          i++;
        }
        const end = rows[i++];
        if (!end) throw new Error('Missing bubble end');
        const framed = text.slice(bodyStart, end.start);
        // Two empty lines precede the payload. After it, one line terminator
        // plus two empty lines precede the end marker. Never trim the payload.
        if (framed.length < 5 || !framed.startsWith('\n\n') || !framed.endsWith('\n\n\n')) throw new Error('Missing content framing blank lines');
        const message = parseFields(metadata, bubbleFields, 'extra-metadata');
        if (!Object.hasOwn(message, 'reactions')) message.reactions = [];
        messages.push({ ...message, text: decodeBody(framed.slice(2, -3)) });
      }
      if (rows.slice(i).some(row => !decoration(row.line))) throw new Error('Unexpected data after document end');
      validateMessages(messages);
      return { kind: 'portable', messages, settings };
    } catch (error) { return { kind: 'damaged', error: error.message, text }; }
  }
  const fromPlainText = text => {
    if (!text) return [];
    const spans = []; let start = 0;
    for (const match of text.matchAll(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/g)) {
      const end = match.index + match[0].length;
      if (match.index === start || end === text.length) continue;
      spans.push({start,end:match.index}); start = end;
    }
    spans.push({start,end:text.length});
    return spans.map((span,index) => ({...newMessage(text.slice(span.start,span.end)),separatorAfter:index<spans.length-1?text.slice(span.end,spans[index+1].start):''}));
  };
  const serialize = messages => messages.map((message,index) => message.text + (index<messages.length-1 ? message.separatorAfter ?? '\n' : '')).join('');
  const readMessages = note => { const parsed=inspect(note.content?.text); return parsed.kind==='portable'?clone(parsed.messages):parsed.kind==='plain'?fromPlainText(note.content?.text||''):[]; };
  const readSettings = note => {const parsed=inspect(note.content?.text);return parsed.kind==='portable'?clone(parsed.settings):{};};
  const isCurrent = (note,messages,settings) => {
    const saved=note.clientData?.imStyleEditor;
    try { return saved?.schemaVersion===3 && portable(messages,settings)===note.content.text &&
      portable(saved.messages,saved.settings)===note.content.text; } catch { return false; }
  };
  function write(note,messages,settings) {
    if (inspect(note.content?.text).kind==='damaged') throw new Error('Malformed records: original text was not changed');
    const text=portable(messages,settings), savedMessages=clone(messages), savedSettings=clone(settings);
    note.clientData={...note.clientData,imStyleEditor:{schemaVersion:3,messages:savedMessages,settings:savedSettings}};
    note.content={...note.content,text,appendEditorMessageData:savedMessages,appendEditorSettings:savedSettings,
      preview_plain:serialize(messages).slice(0,160)||' ',preview_html:undefined};
    return note;
  }
  // Format 2 never guesses at damaged structure or uses decoration to repair it.
  const recover = () => null;
  const restore = () => {throw new Error('Damaged format 2 records require manual repair');};
  return { newId, validId, validateMessages, serialize, portable, inspect, fromPlainText, readMessages, readSettings, isCurrent, write, recover, restore };
})();
