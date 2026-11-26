/* Portable clipboard forwarding: includes selected records only, never backups. */
const imTransfer = (() => {
  const header = '#!im-style-forward 2';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const stable = value => JSON.stringify(value, function(key, item) {
    if(key==='sourceRefs'&&Array.isArray(item))return item.map(pair=>JSON.stringify(pair)).sort();
    if (!object(item)) return item;
    if(typeof item.id==='string'&&typeof item.text==='string'){item={...item};delete item.copied;delete item.exported;delete item.imported;}
    return Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]]));
  });
  function create(messages, settings, sourceNoteId) {
    const appearance = Object.fromEntries(['bubbleTheme','backgroundTheme','wallpaper','artwork','scale','reactionOrder']
      .filter(key => key in settings).map(key => [key, settings[key]]));
    const records=messages.map(message=>{
      const encoded=imFormat.encodeMessage(message);
      if(!Array.isArray(encoded.reactions)||encoded.reactions.length)return encoded;
      const {reactions,...record}=encoded;
      return record;
    });
    return header + '\n' + JSON.stringify({ format: 'im-style-forward', version: 2,
      sourceNoteId, messages: records, settings: appearance
    }) + '\n';
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
      payload.messages=payload.messages.map(imFormat.normalizeMessage);
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
      return { ok: false, error: 'This is not a complete IM message export. Use Export in the source note, then paste it here. Nothing has been changed.' };
    }
  }
  function merge(existing, payload) {
    if (!payload.ok) throw new Error('Invalid import');
    // Existing format-3 records are immutable; retain their identities so the
    // serializer can reuse their blocks. Only incoming records need cloning.
    const messages = [...existing], added = [], used = new Set(messages.map(message => message.id));
    const byId=new Map(),bySource=new Map(),comparisons=new WeakMap();
    const append=(index,key,message)=>{if(!index.has(key))index.set(key,[]);index.get(key).push(message);};
    const index=message=>{
      append(byId,message.id,message);
      for(const [noteId,id] of imFormat.sourceRefs(message))if(noteId===payload.sourceNoteId)append(bySource,id,message);
    };
    const comparable=message=>{
      if(!comparisons.has(message)){
        const {id,sourceRefs,imported,copied,exported,...content}=imFormat.normalizeMessage(message);
        comparisons.set(message,stable(content));
      }
      return comparisons.get(message);
    };
    const lineage=message=>JSON.stringify(imFormat.sourceRefs(message).map(pair=>JSON.stringify(pair)).sort());
    messages.forEach(index);
    let skipped = 0;
    for (const source of payload.messages) {
      // An origin identifies a possible match. Compare saved content too so an
      // edited copy or an ID collision cannot silently discard an import.
      const duplicate = (byId.get(source.id)||[]).some(candidate=>lineage(candidate)===lineage(source)&&comparable(candidate)===comparable(source)) ||
        (bySource.get(source.id)||[]).some(candidate=>comparable(candidate)===comparable(source));
      if (duplicate) { skipped++; continue; }
      const message = clone(imFormat.normalizeMessage(source));
      delete message.exported;
      if (used.has(message.id)) {
        do { message.id = imFormat.newId(); }
        while (used.has(message.id));
      }
      message.sourceRefs = imFormat.uniqueSourceRefs([...imFormat.sourceRefs(message),[payload.sourceNoteId,source.id]]);
      message.imported = true;
      used.add(message.id);
      messages.push(message); added.push(message);index(message);
    }
    return { messages, added, skipped };
  }
  return { create, read, merge };
})();
