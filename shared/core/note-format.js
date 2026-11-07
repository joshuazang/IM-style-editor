/* Format 3 only. One text representation; immutable decoded records and cached bubble text. */
const imFormat = (() => {
  const header = '#!im-style-editor 3';
  const encoding = '#!encoding utf-8';
  const controls = new Set(['@@IM:SETTINGS', '@@IM:END-SETTINGS', '@@IM:REPLY', '@@IM:END-REPLY', '@@IM:DRAFT', '@@IM:END-DRAFT', '@@IM:BUBBLE', '@@IM:CONTENT', '@@IM:END']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{21}[AQgw]$/.test(value);
  function newId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const newMessage = text => ({ id: newId(), text, reactions: [] });
  function validateReply(reply) {
    if (!object(reply) || !validId(reply.id) || typeof reply.text !== 'string' || typeof reply.noteId !== 'string' || ('createdAt' in reply && typeof reply.createdAt!=='string') || ('metadata' in reply && (!object(reply.metadata)||['id','text','createdAt'].some(key=>Object.hasOwn(reply.metadata,key))))) throw new Error('Invalid reply reference');
    if(reply.metadata)validateMessages([{...reply.metadata,id:reply.id,text:reply.text,reactions:reply.metadata.reactions??[],...(reply.createdAt?{createdAt:reply.createdAt}:{})}]);
  }
  function validateMessages(messages) {
    if (!Array.isArray(messages)) throw new Error('Messages must be an array');
    const ids = new Set();
    for (const message of messages) {
      if (!object(message) || !validId(message.id) || ids.has(message.id) || typeof message.text !== 'string' ||
          !Array.isArray(message.reactions) || !message.reactions.every(tag => typeof tag === 'string') ||
          ('createdAt' in message && typeof message.createdAt !== 'string') ||
          ('separatorAfter' in message && typeof message.separatorAfter !== 'string')) throw new Error('Invalid or duplicate bubble metadata');
      if (Object.hasOwn(message,'replyTo')) validateReply(message.replyTo);
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
  const statuses = ['edited','copied','exported'];
  const normalizeMessage = message => {
    if (!Object.hasOwn(message,'editedAt') && statuses.every(flag => !Object.hasOwn(message,flag) || message[flag]===true)) return message;
    const result = {...message};
    if(Object.hasOwn(result,'editedAt')) result.edited=true;
    delete result.editedAt;
    for(const flag of statuses) if(Object.hasOwn(result,flag)) result[flag]=true;
    return result;
  };
  const editMessage = (message,text) => {
    if(message.text===text)return message;
    const result={...normalizeMessage(message),text,edited:true};
    delete result.copied;delete result.exported;return result;
  };
  const bubbleFields = { id: 'id', createdAt: 'created', edited: 'edited', copied:'copied', exported:'exported', reactions: 'reactions', separatorAfter: 'separator-after', forwarding: 'forwarding', replyTo: 'reply-to' };
  const settingsFields = { bubbleTheme: 'bubble-theme', backgroundTheme: 'background-theme', wallpaper: 'wallpaper', artwork: 'artwork', scale: 'scale', reactionOrder: 'reaction-order', deletedEmojis: 'deleted-emojis' };
  const valueText = value => typeof value === 'string' && /^[A-Za-z0-9_.:+-]+$/.test(value) && !/^(?:true|false|null|[-+]?\d)/.test(value) ? value : JSON.stringify(value);
  function fields(record, mapping, extrasName) {
    const lines = [], extras = Object.create(null);
    for (const [key, label] of Object.entries(mapping)) if (Object.hasOwn(record, key)) {
      // IDs and timestamps are readable bare tokens; string parsing is field-aware.
      const value = record[key];
      if(extrasName==='extra-metadata' && statuses.includes(key)){lines.push(label);continue;}
      if (extrasName === 'extra-metadata' && key === 'reactions' && value.length === 0) continue;
      lines.push(label + ': ' + (typeof value === 'string' && ['id','createdAt'].includes(key) && /^[A-Za-z0-9_.:+-]+$/.test(value) ? value : valueText(value)));
    }
    for (const [key, value] of Object.entries(record)) if (!Object.hasOwn(mapping, key) && !(extrasName === 'extra-metadata' && key === 'text')) extras[key] = value;
    if (Object.keys(extras).length) lines.push(extrasName + ': ' + JSON.stringify(extras));
    return lines;
  }
  const messageText = new WeakMap(), bubbleText = new WeakMap(), settingText = new WeakMap();
  function bubble(original) {
    if (!bubbleText.has(original)) {
      const message=normalizeMessage(original);
      bubbleText.set(original,['@@IM:BUBBLE', ...fields(message,bubbleFields,'extra-metadata'),
        '@@IM:CONTENT','','',encodeBody(message.text),'',''].join('\n')+'\n');
    }
    return bubbleText.get(original);
  }
  function bubbles(messages) {
    if (messageText.has(messages)) return messageText.get(messages);
    validateMessages(messages);
    const text=messages.map(bubble).join('');
    messageText.set(messages,text);return text;
  }
  function settingsText(settings) {
    if (!settingText.has(settings)) {
      validateSettings(settings);
      settingText.set(settings,[header,encoding,'','@@IM:SETTINGS',...fields(settings,settingsFields,'extra-settings'),'@@IM:END-SETTINGS',''].join('\n')+'\n');
    }
    return settingText.get(settings);
  }
  function portable(messages,settings,draft='',reply=null) {
    if(typeof draft!=='string')throw new Error('Draft must be text');
    let prefix=settingsText(settings);
    if(reply!==null){validateReply(reply);prefix+='@@IM:REPLY\n'+JSON.stringify(reply)+'\n@@IM:END-REPLY\n\n';}
    if(draft.length)prefix+=['@@IM:DRAFT','','',encodeBody(draft),'','','@@IM:END-DRAFT',''].join('\n')+'\n';
    return prefix+bubbles(messages)+'@@IM:END\n';
  }
  function parseFields(lines, mapping, extrasName) {
    const inverse = Object.fromEntries(Object.entries(mapping).map(([key, label]) => [label, key]));
    const record = {}, seen = new Set();
    for (const line of lines) {
      if (controls.has(line) || /^@@IM:/.test(line) || /^#!/.test(line)) throw new Error('Unexpected control line in metadata');
      // Optional punctuation is decoration, never the start/end of message text.
      if (decoration(line)) continue;
      const status=extrasName==='extra-metadata' && /^(edited|copied|exported)(?::.*)?$/.exec(line);
      if(status){if(seen.has(status[1]))throw new Error('Duplicate status');seen.add(status[1]);record[status[1]]=true;continue;}
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
          if(extrasName==='extra-metadata'&&(statuses.includes(key)||key==='editedAt')){if(Object.hasOwn(record,key))throw new Error('Duplicate status');record[key]=true;continue;}
          if (Object.hasOwn(mapping,key) || (extrasName === 'extra-metadata' && key === 'text')) throw new Error('Extra metadata shadows a reserved field');
          Object.defineProperty(record, key, { value: item, enumerable: true, writable: true, configurable: true });
        }
      } else record[inverse[label]] = value;
    }
    return record;
  }
  function parseDocument(text) {
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
        if (rows[i++]?.line !== expected) throw new Error('Unsupported format or encoding header; only format 3 is supported; use Archive to export older notes');
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
      let draft='',draftSeen=false,reply=null;
      while (true) {
        // Optional decoration outside records has no structural meaning.
        while (i < rows.length && !controls.has(rows[i].line)) {
          if (!decoration(rows[i].line)) throw new Error('Unexpected text outside records');
          i++;
        }
        if(rows[i]?.line==='@@IM:REPLY'){
          if(reply!==null||draftSeen||messages.length)throw new Error('Reply must appear once, before draft and bubbles');
          i++;reply=JSON.parse(rows[i++]?.line);validateReply(reply);
          if(rows[i++]?.line!=='@@IM:END-REPLY')throw new Error('Missing reply end');continue;
        }
        if(rows[i]?.line==='@@IM:DRAFT'){
          if(draftSeen||messages.length)throw new Error('Draft must appear once, before bubbles');
          draftSeen=true;const marker=rows[i++];
          while(i<rows.length&&rows[i].line!=='@@IM:END-DRAFT'){
            if(controls.has(rows[i].line))throw new Error('Unexpected control inside draft');i++;
          }
          const end=rows[i++];if(!end)throw new Error('Missing draft end');
          const framed=text.slice(marker.next,end.start);
          if(framed.length<5||!framed.startsWith('\n\n')||!framed.endsWith('\n\n\n'))throw new Error('Missing draft framing');
          draft=decodeBody(framed.slice(2,-3));continue;
        }
        if (rows[i]?.line === '@@IM:END') { i++; break; }
        if (rows[i++]?.line !== '@@IM:BUBBLE') throw new Error('Missing bubble or document end');
        const metadata = [];
        while (i < rows.length && rows[i].line !== '@@IM:CONTENT') metadata.push(rows[i++].line);
        const textMarker = rows[i++];
        if (textMarker?.line !== '@@IM:CONTENT' || textMarker.next === text.length) throw new Error('Missing text control line');
        const bodyStart = textMarker.next;
        while (i < rows.length && !['@@IM:BUBBLE','@@IM:END'].includes(rows[i].line)) {
          if (controls.has(rows[i].line)) throw new Error('Unexpected control line inside a message');
          i++;
        }
        const end = rows[i];
        if (!end) throw new Error('Missing next bubble or document end');
        const framed = text.slice(bodyStart, end.start);
        // Two empty lines precede the payload. After it, one line terminator
        // plus two empty lines precede the end marker. Never trim the payload.
        if (framed.length < 5 || !framed.startsWith('\n\n') || !framed.endsWith('\n\n\n')) throw new Error('Missing content framing blank lines');
        const message = parseFields(metadata, bubbleFields, 'extra-metadata');
        if (!Object.hasOwn(message, 'reactions')) message.reactions = [];
        messages.push(normalizeMessage({ ...message, text: decodeBody(framed.slice(2, -3)) }));
      }
      if (rows.slice(i).some(row => !decoration(row.line))) throw new Error('Unexpected data after document end');
      validateMessages(messages);
      return { kind: 'portable', messages, settings, draft, reply };
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
  const preview = messages => {
    let text='';
    for(let i=0;i<messages.length&&text.length<160;i++){
      text+=messages[i].text.slice(0,160-text.length);
      if(i<messages.length-1&&text.length<160)text+=(messages[i].separatorAfter??'\n').slice(0,160-text.length);
    }
    return text||' ';
  };
  // These caches are temporary working memory, never extra fields in the saved note.
  let inspectedText, inspectedResult;
  const notes=new WeakMap();
  function inspect(text) {
    text=typeof text==='string'?text:'';
    if(text!==inspectedText || !inspectedResult){inspectedText=text;inspectedResult=parseDocument(text);}
    return inspectedResult;
  }
  function state(note) {
    const text=note?.content?.text??'', previous=notes.get(note);
    if(previous?.text===text)return previous;
    const parsed=inspect(text), portable=parsed.kind==='portable';
    const result={text,kind:parsed.kind,messages:portable?parsed.messages:parsed.kind==='plain'?fromPlainText(text):[],
      settings:portable?parsed.settings:{},draft:portable?parsed.draft:'',reply:portable?parsed.reply:null};
    notes.set(note,result);return result;
  }
  const readMessages=note=>state(note).messages;
  const readSettings=note=>state(note).settings;
  const readDraft=note=>state(note).draft;
  const readReply=note=>state(note).reply;
  const isCurrent=(note,messages,settings)=>{
    const saved=state(note);
    return saved.kind==='portable' && saved.messages===messages && JSON.stringify(saved.settings)===JSON.stringify(settings);
  };
  function write(note,messages,settings,draft=readDraft(note),reply=readReply(note)) {
    const previous=state(note);
    if(previous.kind==='damaged')throw new Error('Malformed records: original text was not changed');
    if(messages!==previous.messages)messages=messages.map(normalizeMessage);
    const text=portable(messages,settings,draft,reply);
    const content={...note.content,text};
    // Delete only this editor's obsolete mirrors; retain title, references and other editors' data.
    delete content.appendEditorMessageData;delete content.appendEditorMessages;delete content.appendEditorSettings;
    if(note.clientData?.imStyleEditor){const data={...note.clientData};delete data.imStyleEditor;note.clientData=data;}
    if(messages!==previous.messages || !Object.hasOwn(content,'preview_plain'))content.preview_plain=preview(messages);
    content.preview_html=undefined;note.content=content;
    const saved={kind:'portable',messages,settings,draft,reply};
    notes.set(note,{...saved,text});inspectedText=text;inspectedResult=saved;
    return note;
  }
  const recover=()=>null;
  const restore=()=>{throw new Error('Damaged format 3 records require manual repair');};
  return {validateReply,readReply,normalizeMessage,editMessage,readDraft,newId,validId,validateMessages,serialize,portable,inspect,fromPlainText,readMessages,readSettings,isCurrent,write,recover,restore};
})();
