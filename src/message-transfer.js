/* Portable clipboard forwarding: includes selected records only, never backups. */
const imTransfer = (() => {
  const header = '#!im-style-forward 2';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const stable = value => JSON.stringify(value, function(key, item) {
    if (!object(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]]));
  });
  function create(messages, settings, sourceNoteId) {
    const appearance = Object.fromEntries(['bubbleTheme','backgroundTheme','wallpaper','artwork','scale','reactionOrder']
      .filter(key => key in settings).map(key => [key, settings[key]]));
    const records = clone(messages);
    for (const message of records) if (Array.isArray(message.reactions) && message.reactions.length === 0) delete message.reactions;
    return header + '\n' + JSON.stringify({ format: 'im-style-forward', version: 2,
      sourceNoteId, exportedAt: new Date().toISOString(), messages: records, settings: appearance
    }, null, 2) + '\n';
  }
  function read(text) {
    const raw = typeof text === 'string' ? text : '';
    const normalized = raw.replace(/^\uFEFF/, '').trim();
    try {
      let payload;
      if (normalized.startsWith(header)) {
        payload = JSON.parse(normalized.slice(header.length).trim());
        if (!object(payload) || payload.format !== 'im-style-forward' || payload.version !== 2 ||
            typeof payload.sourceNoteId !== 'string' || !object(payload.settings)) throw new Error('Invalid export');
      } else {
        const parsed = imFormat.inspect(raw);
        if (parsed.kind !== 'portable') throw new Error('Not a complete IM export');
        payload = { messages: parsed.messages, settings: parsed.settings, sourceNoteId: '' };
      }
      if (!Array.isArray(payload.messages) || !payload.messages.length) throw new Error('No messages to import');
      for (const message of payload.messages) if (object(message) && !Object.hasOwn(message, 'reactions')) message.reactions = [];
      imFormat.validateMessages(payload.messages);
      const ids = new Set();
      for (const message of payload.messages) {
        if (!object(message) || typeof message.id !== 'string' || !message.id || ids.has(message.id) ||
            typeof message.text !== 'string' || !Array.isArray(message.reactions) ||
            !message.reactions.every(tag => typeof tag === 'string') ||
            ('separatorAfter' in message && typeof message.separatorAfter !== 'string')) throw new Error('Invalid message');
        ids.add(message.id);
      }
      return { ok: true, messages: clone(payload.messages), settings: clone(payload.settings), sourceNoteId: payload.sourceNoteId };
    } catch {
      return { ok: false, error: 'This is not a complete IM message export. Use Copy for forwarding in the source note, then paste it here. Nothing has been changed.' };
    }
  }
  function merge(existing, payload, now = new Date().toISOString()) {
    if (!payload.ok) throw new Error('Invalid import');
    const messages = clone(existing), added = [], used = new Set(messages.map(message => message.id));
    let skipped = 0;
    for (const source of payload.messages) {
      const duplicate = messages.some(candidate => {
        if (candidate.id === source.id && stable(candidate) === stable(source)) return true;
        const forwarded = candidate.forwarding;
        if (!object(forwarded) || forwarded.sourceMessageId !== source.id ||
            forwarded.sourceNoteId !== payload.sourceNoteId) return false;
        const original = { ...candidate, id: forwarded.sourceMessageId };
        if ('previous' in forwarded) original.forwarding = forwarded.previous;
        else delete original.forwarding;
        return stable(original) === stable(source);
      });
      if (duplicate) { skipped++; continue; }
      const message = clone(source);
      if (used.has(message.id)) {
        do { message.id = imFormat.newId(); }
        while (used.has(message.id));
      }
      message.forwarding = { sourceMessageId: source.id, sourceNoteId: payload.sourceNoteId, forwardedAt: now,
        ...('forwarding' in source ? { previous: clone(source.forwarding) } : {}) };
      used.add(message.id);
      messages.push(message); added.push(message);
    }
    return { messages, added, skipped };
  }
  return { create, read, merge };
})();
