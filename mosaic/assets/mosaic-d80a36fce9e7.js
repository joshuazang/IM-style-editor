"use strict";
const MOSAIC_VERSION="1.5.19";
/* IM_SHARED_CORE_BEGIN 2f9b64fc8545947e787c71babafb2dabece1ce38db99b4ab1a8be2141928ea19 */
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
          ('title' in message && typeof message.title !== 'string') ||
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
  const title = message => typeof message?.title==='string'?message.title:'';
  const withTitle = (message,value) => {
    if(typeof value!=='string')throw new Error('Title must be text');
    if(!value.trim()){if(!Object.hasOwn(message,'title'))return message;const next={...message};delete next.title;return next;}
    return message.title===value?message:{...message,title:value};
  };
  const mergeText = messages => messages.map((message,index)=>index&&title(message)?title(message)+'\n'+message.text:message.text).join('\n\n');
  const bubbleFields = { id: 'id', createdAt: 'created', title:'title', edited: 'edited', copied:'copied', exported:'exported', reactions: 'reactions', separatorAfter: 'separator-after', forwarding: 'forwarding', replyTo: 'reply-to' };
  const settingsFields = { bubbleTheme: 'bubble-theme', backgroundTheme: 'background-theme', wallpaper: 'wallpaper', artwork: 'artwork', scale: 'scale', reactionOrder: 'reaction-order', deletedEmojis: 'deleted-emojis' };
  const valueText = value => typeof value === 'string' && /^[A-Za-z0-9_.:+-]+$/.test(value) && !/^(?:true|false|null|[-+]?\d)/.test(value) ? value : JSON.stringify(value);
  function fields(record, mapping, extrasName) {
    const lines = [], extras = Object.create(null);
    for (const [key, label] of Object.entries(mapping)) if (Object.hasOwn(record, key)) {
      // IDs and timestamps are readable bare tokens; string parsing is field-aware.
      const value = record[key];
      if(extrasName==='extra-metadata' && statuses.includes(key)){lines.push(label);continue;}
      if (extrasName === 'extra-metadata' && key === 'reactions' && value.length === 0) continue;
      if (extrasName === 'extra-metadata' && key === 'title') {lines.push('title: '+JSON.stringify(value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'));continue;}
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
      const match = /^([a-z][a-z-]*): ([\s\S]*)$/.exec(line);
      if (!match) throw new Error('Malformed metadata field or prose outside message text');
      if (!Object.hasOwn(inverse, match[1]) && match[1] !== extrasName) throw new Error('Unknown metadata field; use ' + extrasName);
      if (seen.has(match[1])) throw new Error('Duplicate metadata field');
      const [, label, raw] = match;
      seen.add(label);
      let value;
      if(label==='title'&&!raw.startsWith('"'))throw new Error('Title must be a quoted string');
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
  return {validateReply,title,withTitle,mergeText,readReply,normalizeMessage,editMessage,readDraft,newId,validId,validateMessages,serialize,portable,inspect,fromPlainText,readMessages,readSettings,isCurrent,write,recover,restore};
})();

/* The SDK needs reply callbacks, not historical copies of outgoing note content. */
function imPreferenceReply(key,callback){callback.imPreferenceKey=key;return callback;}
function imReleaseHostReply(bridge,callback){
  if(bridge.sentMessages)bridge.sentMessages=bridge.sentMessages.filter(record=>record.sourceCallback!==callback);
}
function imTrackHostReply(bridge,message,callback){
  if(typeof callback!=='function')return;
  const preferenceKey=message.action==='set-component-data'?(callback.imPreferenceKey||'component-data'):null;
  if(preferenceKey)bridge.sentMessages=bridge.sentMessages.filter(record=>record.preferenceKey!==preferenceKey);
  const persistent=message.action==='stream-context-item'||message.action==='stream-items';
  const record={messageId:message.messageId,...(preferenceKey?{preferenceKey}:{}),sourceCallback:callback,callback:reply=>{
    if(!persistent)bridge.sentMessages=bridge.sentMessages.filter(entry=>entry!==record);
    callback(reply);
  }};
  bridge.sentMessages.push(record);
}
/* Guard the bundled receiver before its legacy parser/theme dispatch. Native
 * mobile messages may have no source window; when supplied it must be parent. */
function imAcceptHostMessage(bridge,event){
  const target=bridge.contentWindow;
  if(!target||!event||typeof event.origin!=='string'||(event.source&&event.source!==target.parent))return false;
  let message=event.data;
  if(typeof message==='string')try{message=JSON.parse(message);}catch{return false;}
  if(!message||typeof message!=='object'||Array.isArray(message))return false;
  if(target.document.referrer)try{
    if(new URL(target.document.referrer).origin!==new URL(event.origin).origin)return false;
  }catch{return false;}
  const component=bridge.component;
  if(component.origin!==undefined&&event.origin!==component.origin)return false;
  if(message.action==='component-registered')return typeof message.sessionKey==='string'&&!!message.sessionKey&&
    typeof message.data?.uuid==='string'&&!!message.data.uuid&&message.sessionKey!==component.sessionKey;
  if(!component.sessionKey)return false;
  if(message.action==='themes')return false; // Both editors supply their own appearance.
  if(typeof message.original?.messageId!=='string')return false;
  if(message.original.sessionKey&&message.original.sessionKey!==component.sessionKey)return false;
  return bridge.sentMessages.some(record=>record.messageId===message.original.messageId);
}
/* Sync status carries a content snapshot too, but it is not a content change.
 * Preserve the editor's current content/clientData and accept only host dates.
 */
function imApplyNoteMetadata(note,update){
  if(!note||update?.isMetadataUpdate!==true||note.uuid!==update.uuid)return;
  const timestamp=value=>{try{return value==null?NaN:new Date(value).getTime()}catch{return NaN}};
  const incoming=timestamp(update.updated_at),current=timestamp(note.updated_at);
  if(Number.isFinite(incoming)&&(!Number.isFinite(current)||incoming>=current))note.updated_at=update.updated_at;
  if(note.created_at==null&&Number.isFinite(timestamp(update.created_at)))note.created_at=update.created_at;
}
/* Full host items can update native fields without changing editor text. These
 * helpers must never be used for isMetadataUpdate notifications, whose content
 * may be an older snapshot. Derived previews continue to follow local text. */
function imNoteNativeSignature(note){
  const {text,preview_plain,preview_html,...content}=note.content||{};
  return JSON.stringify({content,clientData:note.clientData},function(key,value){
    return value&&typeof value==='object'&&!Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(name=>[name,value[name]])):value;
  });
}
function imApplyNoteNative(note,host){
  if(!note||host?.isMetadataUpdate===true||note.uuid!==host.uuid)return;
  const local=note.content||{},content={...host.content,text:local.text};
  for(const name of ['preview_plain','preview_html'])if(Object.hasOwn(local,name))content[name]=local[name];
  note.content=content;
  if(host.clientData!==undefined)note.clientData=JSON.parse(JSON.stringify(host.clientData));
  else delete note.clientData;
  if(host.deleted)note.deleted=true;else delete note.deleted;
  imApplyNoteMetadata(note,{...host,isMetadataUpdate:true});
}

/* Per-note acknowledged writes. Coalesce waiting snapshots without reordering saves. */
const imNoteSaves = new Map();
let imConfirmedNote=null;
function imNoteSavePending(uuid) { return imNoteSaves.has(uuid); }
function imNoteSnapshot(note) {
  const item=pf.jsonObjectForItem(note),text=item.content?.text;
  // Strings cannot be mutated. Keep the captured text directly instead of JSON
  // encoding/decoding the entire document for snapshots that may be superseded.
  // All other fields still get independent deep copies at the time of the call.
  const metadataText=JSON.stringify(typeof text==='string'?{...item,content:{...item.content,text:undefined}}:item);
  const snapshot=JSON.parse(metadataText);
  if(typeof text==='string')snapshot.content.text=text;
  return {item:snapshot,text:typeof text==='string'?text:undefined,metadataText};
}
const imSameNoteSnapshot=(a,b)=>!!a&&a.text===b.text&&a.metadataText===b.metadataText;
/* A streamed host note is already persisted. Keep only the current note's baseline. */
function imNoteReceived(note){imConfirmedNote={note,snapshot:imNoteSnapshot(note)};}
function imNoteUnconfirmed(note){imConfirmedNote={note,snapshot:null};}
/* Rebase only the waiting job. A snapshot already sent remains immutable. */
function imRebaseQueuedNote(uuid,host){
  const job=imNoteSaves.get(uuid)?.next;
  if(!job)return false;
  const item={...job.snapshot.item,content:{...job.snapshot.item.content}};
  imApplyNoteNative(item,host);job.snapshot=imNoteSnapshot(item);return true;
}
/* A conflicting host update must stop obsolete waiting writes. The in-flight
 * request cannot be unsent; the UI retains both versions for explicit review. */
function imCancelQueuedNoteSaves(uuid){
  const state=imNoteSaves.get(uuid);if(!state?.next)return;
  state.next=null;const current=state.current?.version||0;
  const cancelled=state.waiters.filter(waiter=>waiter.version>current);
  state.waiters=state.waiters.filter(waiter=>waiter.version<=current);
  for(const waiter of cancelled)waiter.reject(new Error('A newer host version paused queued saving'));
}
function imNoteMetadataReceived(note,update){
  if(!note||update?.isMetadataUpdate!==true||note.uuid!==update.uuid)return;
  imApplyNoteMetadata(note,update);
  if(imConfirmedNote?.note===note&&imConfirmedNote.snapshot){
    const item={...imConfirmedNote.snapshot.item};
    imApplyNoteMetadata(item,{uuid:note.uuid,isMetadataUpdate:true,updated_at:note.updated_at,created_at:note.created_at});
    imConfirmedNote.snapshot=imNoteSnapshot(item);
  }
}
function imPersistNote(note) {
  const uuid=note.uuid;
  const snapshot=imNoteSnapshot(note);
  let state=imNoteSaves.get(uuid);
  const pending=state?.next||state?.current;
  if(pending&&imSameNoteSnapshot(pending.snapshot,snapshot))return new Promise((resolve,reject)=>state.waiters.push({version:pending.version,resolve,reject}));
  if(!state&&imConfirmedNote?.note===note&&imSameNoteSnapshot(imConfirmedNote.snapshot,snapshot))return Promise.resolve();
  if(!imConfirmedNote)imConfirmedNote={note,snapshot:null};
  if(imConfirmedNote.note.uuid===uuid)imConfirmedNote.snapshot=null;
  if(!state){state={version:0,active:false,current:null,next:null,waiters:[]};imNoteSaves.set(uuid,state)}
  const version=++state.version;
  const promise=new Promise((resolve,reject)=>state.waiters.push({version,resolve,reject}));
  state.next={version,snapshot,note};
  const run=()=>{
    if(state.active||!state.next)return;
    state.active=true;const job=state.next;state.current=job;state.next=null;let done=false;
    const reply=result=>finish(result?.error?new Error('The host rejected the note save'):null);
    const finish=error=>{
      if(done)return;done=true;clearTimeout(timeout);
      imReleaseHostReply(pf,reply);
      if(imConfirmedNote?.note===job.note)imConfirmedNote.snapshot=error?null:job.snapshot;
      const completed=state.waiters.filter(w=>w.version<=job.version);
      state.waiters=state.waiters.filter(w=>w.version>job.version);
      for(const waiter of completed)error?waiter.reject(error):waiter.resolve();
      state.active=false;state.current=null;
      if(state.next)run();else imNoteSaves.delete(uuid);
    };
    const timeout=setTimeout(()=>finish(new Error('Save acknowledgment timed out')),8000);
    if(imConfirmedNote?.note===job.note&&imSameNoteSnapshot(imConfirmedNote.snapshot,job.snapshot)){finish(null);return;}
    try{pf.postMessage('save-items',{items:[job.snapshot.item]},reply)}
    catch(error){finish(error)}
  };
  run();return promise;
}
/* A departing frame cannot wait for an acknowledgment to submit its latest draft. */
function imFlushNoteSaves() {
  for(const state of imNoteSaves.values())if(state.next){
    const job=state.next;state.next=null;
    try{pf.postMessage('save-items',{items:[job.snapshot.item]})}catch{}
  }
}
if(typeof window!=='undefined')window.addEventListener('pagehide',event=>{if(!event?.persisted)imFlushNoteSaves()});

/* Portable clipboard forwarding: includes selected records only, never backups. */
const imTransfer = (() => {
  const header = '#!im-style-forward 2';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const stable = value => JSON.stringify(value, function(key, item) {
    if (!object(item)) return item;
    if(typeof item.id==='string'&&typeof item.text==='string'){item={...item};delete item.copied;delete item.exported;delete item.importedStatusCleared;}
    return Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]]));
  });
  function create(messages, settings, sourceNoteId) {
    const appearance = Object.fromEntries(['bubbleTheme','backgroundTheme','wallpaper','artwork','scale','reactionOrder']
      .filter(key => key in settings).map(key => [key, settings[key]]));
    const records = clone(messages).map(imFormat.normalizeMessage);
    for (const message of records) if (Array.isArray(message.reactions) && message.reactions.length === 0) delete message.reactions;
    return header + '\n' + JSON.stringify({ format: 'im-style-forward', version: 2,
      sourceNoteId, messages: records, settings: appearance
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
  function merge(existing, payload, now = new Date().toISOString()) {
    if (!payload.ok) throw new Error('Invalid import');
    // Existing format-3 records are immutable; retain their identities so the
    // serializer can reuse their blocks. Only incoming records need cloning.
    const messages = [...existing], added = [], used = new Set(messages.map(message => message.id));
    const byId=new Map(),bySource=new Map(),comparisons=new WeakMap();
    const append=(index,key,message)=>{if(!index.has(key))index.set(key,[]);index.get(key).push(message);};
    const index=message=>{
      append(byId,message.id,message);
      const forwarded=message.forwarding;
      if(object(forwarded)&&forwarded.sourceNoteId===payload.sourceNoteId)append(bySource,forwarded.sourceMessageId,message);
    };
    const comparable=message=>{
      if(!comparisons.has(message))comparisons.set(message,stable(message));
      return comparisons.get(message);
    };
    messages.forEach(index);
    let skipped = 0;
    for (const source of payload.messages) {
      // IDs only narrow the candidates. Full metadata/content equality is still
      // required, including when the same ID belongs to different message text.
      const candidates=new Set([...(byId.get(source.id)||[]),...(bySource.get(source.id)||[])]);
      const duplicate = [...candidates].some(candidate => {
        if (candidate.id === source.id && comparable(candidate) === comparable(source)) return true;
        const forwarded = candidate.forwarding;
        if (!object(forwarded) || forwarded.sourceMessageId !== source.id ||
            forwarded.sourceNoteId !== payload.sourceNoteId) return false;
        const original = { ...candidate, id: forwarded.sourceMessageId };
        if ('previous' in forwarded) original.forwarding = forwarded.previous;
        else delete original.forwarding;
        return stable(original) === comparable(source);
      });
      if (duplicate) { skipped++; continue; }
      const message = clone(source);
      delete message.exported;delete message.importedStatusCleared;
      if (used.has(message.id)) {
        do { message.id = imFormat.newId(); }
        while (used.has(message.id));
      }
      message.forwarding = { sourceMessageId: source.id, sourceNoteId: payload.sourceNoteId, forwardedAt: now,
        ...('forwarding' in source ? { previous: clone(source.forwarding) } : {}) };
      used.add(message.id);
      messages.push(message); added.push(message);index(message);
    }
    return { messages, added, skipped };
  }
  return { create, read, merge };
})();

/* Privacy defaults are shared by both interfaces and temporary clipboard fields. */
const imPrivateTextProps={spellCheck:false,autoComplete:'off',autoCorrect:'off',autoCapitalize:'off',writingsuggestions:'false'};
function imPrivateTextField(field){
  field.spellcheck=false;
  for(const [name,value] of Object.entries({autocomplete:'off',autocorrect:'off',autocapitalize:'off',writingsuggestions:'false'}))field.setAttribute(name,value);
  return field;
}

/* Compatibility copy path for hosts that deny the asynchronous clipboard API. */
function imLegacyCopy(text) {
  const active=document.activeElement;
  const start=active?.selectionStart,end=active?.selectionEnd;
  const ranges=window.getSelection();
  const saved=ranges?[...Array(ranges.rangeCount)].map((_,i)=>ranges.getRangeAt(i).cloneRange()):[];
  const field=imPrivateTextField(document.createElement('textarea'));field.value=text;field.readOnly=true;
  field.style.cssText='position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px';
  document.body.append(field);field.select();field.setSelectionRange(0,text.length);
  let copied=false;
  try{copied=document.execCommand('copy')}catch{}finally{
    field.remove();
    if(active?.isConnected){active.focus({preventScroll:true});if(typeof start==='number'&&active.setSelectionRange)active.setSelectionRange(start,end)}
    if(ranges){ranges.removeAllRanges();for(const range of saved)if(range.commonAncestorContainer.isConnected)ranges.addRange(range)}
  }
  return copied;
}
async function imWriteClipboard(text) {
  try{await navigator.clipboard.writeText(text);return true}catch{return imLegacyCopy(text)}
}
/* Run synchronously from the explicit confirmation click. The official sandbox
 * can deny navigator.clipboard even when gesture-driven compatibility copy works.
 * Override the copy event so the clipboard receives empty text, not a placeholder.
 */
function imLegacyClearClipboard() {
  let handled=false;
  const clear=event=>{
    event.preventDefault();
    try{
      if(!event.clipboardData)return;
      event.clipboardData.clearData();event.clipboardData.setData('text/plain','');handled=true;
    }catch{}
  };
  document.addEventListener('copy',clear,true);
  try{return imLegacyCopy(' ')&&handled}
  catch{return false}
  finally{document.removeEventListener('copy',clear,true)}
}
async function imClearClipboard() {
  if(imLegacyClearClipboard())return true;
  try{await navigator.clipboard.writeText('');return true}catch{return false}
}

/* Local reply references and SVG controls. Quotes are text, never HTML. */
function imReplySnapshot(message,noteId){
  // Keep the immediate quote and one level of its context. Deeper quoted
  // history is represented by IDs instead of repeatedly copying all its text.
  // Existing records are never rewritten by this constructor.
  const {id,text,createdAt,replyTo,...rest}=message;
  const metadata=JSON.parse(JSON.stringify(rest));
  if(replyTo&&typeof replyTo==='object'){
    const {metadata:priorMetadata,...quote}=replyTo;
    const prior={...priorMetadata};
    if(prior.replyTo&&typeof prior.replyTo==='object'){
      prior.replyToReference={id:prior.replyTo.id,noteId:prior.replyTo.noteId};
      delete prior.replyTo;
    }
    metadata.replyTo={...JSON.parse(JSON.stringify(quote)),...(Object.keys(prior).length?{metadata:JSON.parse(JSON.stringify(prior))}:{})};
  }
  if(!metadata.reactions?.length)delete metadata.reactions;
  return {id,noteId,text,...(createdAt?{createdAt}:{}),...(Object.keys(metadata).length?{metadata}:{})};
}
function imReplyRecord(reply){return {...reply.metadata,id:reply.id,text:reply.text,reactions:reply.metadata?.reactions||[],...(reply.createdAt?{createdAt:reply.createdAt}:{})};}

function imReplyTarget(messages,reply,noteId){
  if(!reply||typeof reply!=='object')return;
  return messages.find(message=>{
    if(message.id===reply.id&&(reply.noteId===noteId||(message.text===reply.text&&message.createdAt===reply.createdAt)))return true;
    const sources=[message,...(Array.isArray(message.mergeSources)?message.mergeSources:[])];
    for(const record of sources){
      if(!record||typeof record!=='object')continue;
      if(record.id===reply.id&&record.noteId===reply.noteId)return true;
      let source=record.forwarding;const seen=new Set();
      while(source&&typeof source==='object'&&!seen.has(source)){seen.add(source);if(source.sourceMessageId===reply.id&&source.sourceNoteId===reply.noteId)return true;source=source.previous;}
    }
    return false;
  });
}

/* Current-note tag commands. Records stay immutable and message text is untouched. */
const imUntagged='__im_untagged__';
const imDefaultEmojis=['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'];
function imFilterOrder(tags,position){const order=tags.filter(tag=>tag!==imUntagged);const index=Number.isInteger(position)?Math.max(0,Math.min(position,order.length)):order.length;return [...order.slice(0,index),imUntagged,...order.slice(index)];}
function imEmojiOrder(messages,settings,used){
 const removed=new Set(settings.deletedEmojis||[]);
 return [...new Set([...(settings.reactionOrder||imDefaultEmojis),...(used||messages.flatMap(m=>m.reactions))])].filter(tag=>!removed.has(tag));
}
function imEmojiValue(value){
 if(typeof value!=='string'||!value.trim()||[imUntagged,'__untagged__'].includes(value.trim()))throw new Error('Choose an emoji tag');
 return value.trim();
}
function imEmojiAdd(messages,settings,value){
 const tag=imEmojiValue(value),order=imEmojiOrder(messages,settings),next={...settings,reactionOrder:[tag,...order.filter(t=>t!==tag)],deletedEmojis:(settings.deletedEmojis||[]).filter(t=>t!==tag)};
 if(Number.isInteger(settings.untaggedPosition))next.untaggedPosition=[tag,...imFilterOrder(order,settings.untaggedPosition).filter(t=>t!==tag)].indexOf(imUntagged);
 return next;
}
function imEmojiMove(messages,settings,tag,direction){
 const displayed=imFilterOrder(imEmojiOrder(messages,settings),settings.untaggedPosition),index=displayed.indexOf(tag),next=index+direction;
 if(![-1,1].includes(direction)||index<0||next<0||next>=displayed.length)return settings;
 [displayed[index],displayed[next]]=[displayed[next],displayed[index]];
 return {...settings,reactionOrder:displayed.filter(t=>t!==imUntagged),untaggedPosition:displayed.indexOf(imUntagged)};
}
function imEmojiChange(messages,settings,from,to=null){
 from=imEmojiValue(from);if(to!==null)to=imEmojiValue(to);
 if(from===to)return {messages,settings};
 const nextMessages=messages.map(message=>{
  if(!message.reactions.includes(from))return message;
  let seen=false;
  const reactions=message.reactions.flatMap(tag=>tag===from?(to===null?[]:[to]):[tag]).filter(tag=>{if(tag!==to)return true;if(seen)return false;seen=true;return true});
  return {...message,reactions};
 });
 const order=imEmojiOrder(messages,settings),targetExists=to!==null&&order.includes(to);
 const nextOrder=order.flatMap(tag=>tag===from?(to===null||targetExists?[]:[to]):[tag]);
 if(to!==null&&!nextOrder.includes(to))nextOrder.push(to);
 const nextSettings={...settings,reactionOrder:nextOrder,deletedEmojis:[...new Set([...(settings.deletedEmojis||[]).filter(tag=>tag!==to),from])]};
 if(Number.isInteger(settings.untaggedPosition)){
  const displayed=imFilterOrder(order,settings.untaggedPosition);
  nextSettings.untaggedPosition=displayed.flatMap(tag=>tag===from?(to===null||targetExists?[]:[to]):[tag]).indexOf(imUntagged);
 }
 return {messages:nextMessages,settings:nextSettings};
}

/* IM_SHARED_CORE_END */
/* IM_SHARED_UI_BEGIN f3df2f08585503b3ff40b745f316ae0f4c655962e216edf585537fc9f0f835e8 */
/* Local editor dependencies; pinned official source and licenses in shared/vendor/markdown-sources.json and THIRD-PARTY-NOTICES.md. */
const imRichDeps=(()=>{
const modules={
"marked/src/defaults.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._defaults = void 0;
exports._getDefaults = _getDefaults;
exports.changeDefaults = changeDefaults;
/**
 * Gets the original marked default options.
 */
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _defaults = exports._defaults = _getDefaults();
function changeDefaults(newDefaults) {
  exports._defaults = _defaults = newDefaults;
}
},
"marked/src/helpers.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.beginEmStrongDelCloserScan = beginEmStrongDelCloserScan;
exports.cachedLastPossibleDelCloserIndex = cachedLastPossibleDelCloserIndex;
exports.cachedLastPossibleEmStrongCloserIndex = cachedLastPossibleEmStrongCloserIndex;
exports.cleanUrl = cleanUrl;
exports.decodeNumericCharacterReferences = decodeNumericCharacterReferences;
exports.endEmStrongDelCloserScan = endEmStrongDelCloserScan;
exports.escapeHtmlEntities = escapeHtmlEntities;
exports.expandTabs = expandTabs;
exports.findClosingBracket = findClosingBracket;
exports.normalizeLabel = normalizeLabel;
exports.rtrim = rtrim;
exports.splitCells = splitCells;
exports.trimTrailingBlankLines = trimTrailingBlankLines;
var _rules = __require("marked/src/rules.ts");
/**
 * Helpers
 */
const escapeReplacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const getEscapeReplacement = ch => escapeReplacements[ch];
function escapeHtmlEntities(html, encode) {
  if (encode) {
    if (_rules.other.escapeTest.test(html)) {
      return html.replace(_rules.other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (_rules.other.escapeTestNoEncode.test(html)) {
      return html.replace(_rules.other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html;
}

/**
 * Numeric character references are recognized outside code and are equivalent to the
 * character they name. Values that are zero, out of range, or a surrogate become the
 * replacement character.
 */
function decodeNumericCharacterReferences(text) {
  if (!_rules.other.numericCharacterReference.test(text)) {
    return text;
  }
  // A decoded character must not join its neighbours into a new reference,
  // so every `&` that is not already one is escaped here.
  return text.replace(_rules.other.numericCharacterReferenceOrAmpersand, (ref, dec, hex) => {
    if (dec === undefined && hex === undefined) {
      return '&amp;';
    }
    const code = dec === undefined ? Number.parseInt(hex, 16) : Number.parseInt(dec, 10);
    if (code === 0 || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff) {
      return '�';
    }
    return code === 38 ? '&amp;' : String.fromCodePoint(code);
  });
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(_rules.other.percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  var _cells$at;
  // ensure that every cell-delimiting pipe has a space
  // before it to distinguish it from an escaped pipe
  const row = tableRow.replace(_rules.other.findPipe, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
      if (escaped) {
        // odd number of slashes means | is escaped
        // so we leave it alone
        return '|';
      } else {
        // add space before unescaped |
        return ' |';
      }
    }),
    cells = row.split(_rules.other.splitPipe);
  let i = 0;

  // First/last cell in a row cannot be empty if it has no leading/trailing pipe
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !((_cells$at = cells.at(-1)) !== null && _cells$at !== void 0 && _cells$at.trim())) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push('');
    }
  }
  for (; i < cells.length; i++) {
    // leading or trailing whitespace is ignored per the gfm spec
    cells[i] = cells[i].trim().replace(_rules.other.slashPipe, '|');
  }
  return cells;
}

/**
 * Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
 * /c*$/ is vulnerable to REDOS.
 *
 * @param str
 * @param c
 * @param invert Remove suffix of non-c chars instead. Default falsey.
 */
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return '';
  }

  // Length of suffix matching the invert condition.
  let suffLen = 0;

  // Step left until we fail to match the invert condition.
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
function trimTrailingBlankLines(str) {
  const lines = str.split('\n');
  let end = lines.length - 1;
  while (end >= 0 && _rules.other.blankLine.test(lines[end])) {
    end--;
  }
  if (lines.length - end <= 2) {
    // we want to keep single trailing blank lines
    return str;
  }
  return lines.slice(0, end + 1).join('\n');
}

/**
 * Normalizes a link label so definitions and references can be matched.
 * CommonMark asks for a Unicode case fold, which `toLowerCase()` does not
 * reach: `ẞ` lowercases to `ß` and so never meets `SS`. Round-tripping
 * through upper case does, as in commonmark.js; the final `toLowerCase()`
 * keeps the folded label lower case, the form `def.tag` has always used.
 */
function normalizeLabel(label) {
  // The spec also asks for leading and trailing spaces, tabs and line endings
  // to be stripped, and for internal runs of them to collapse to one space.
  // Doing it here keeps every call site in agreement: the definition and the
  // reference have to normalize to the same key.
  return label.trim().replace(_rules.other.multipleSpaceGlobal, ' ').toLowerCase().toUpperCase().toLowerCase();
}
function findClosingBracket(str, b) {
  // an opening bracket on its own is still unbalanced, so both have to be absent
  if (str.indexOf(b[0]) === -1 && str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}

/**
 * Closer hints for one inline `maskedSrc`. Held only while that pass runs.
 */

/**
 * Hint stacks for inline passes currently running. Keyed by the tokenizer
 * instance so parses do not share frames. Nested `inlineTokens` calls push
 * a frame. The entry is removed when the outermost pass ends, so
 * `maskedSrc` is not retained once parsing returns (#4099).
 */
const emStrongDelCloserHintStacks = new WeakMap();

/**
 * Last indexes of `*` / `_` runs that can close emphasis or strong, and of
 * a `~` run that can close strikethrough.
 *
 * A run can close only when it is not preceded by ASCII whitespace or the
 * start of the string. The right-delim regexes accept a closer only in
 * groups 1, 2, 5, and 6, and each of those requires that predecessor. When
 * the opener's window has no such run, the regex scan cannot succeed.
 * Finding one only means "keep looking": CommonMark rules 9–10 and mid-run
 * openers are still applied in the loop (#4099).
 */
function scanLastPossibleEmStrongDelClosers(src) {
  const lastPossibleEmStrongCloserIndex = {
    '*': -1,
    _: -1
  };
  let lastPossibleDelCloserIndex = -1;
  const len = src.length;
  for (let i = 0; i < len; i++) {
    const ch = src[i];
    if (ch !== '*' && ch !== '_' && ch !== '~') {
      continue;
    }
    // A leading run has no predecessor, same as one after a line break.
    const prev = i === 0 ? '\n' : src[i - 1];
    let j = i + 1;
    while (j < len && src[j] === ch) {
      j++;
    }
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') {
      if (ch === '~') {
        lastPossibleDelCloserIndex = i;
      } else {
        lastPossibleEmStrongCloserIndex[ch] = i;
      }
    }
    i = j - 1;
  }
  return {
    maskedSrc: src,
    lastPossibleEmStrongCloserIndex,
    lastPossibleDelCloserIndex
  };
}

/**
 * Scan `maskedSrc` once for the last `*` / `_` run that can close emphasis
 * or strong and the last `~` run that can close strikethrough.
 * `endEmStrongDelCloserScan` drops this frame when the inline pass ends.
 */
function beginEmStrongDelCloserScan(tokenizer, maskedSrc) {
  const frame = scanLastPossibleEmStrongDelClosers(maskedSrc);
  const stack = emStrongDelCloserHintStacks.get(tokenizer);
  if (stack) {
    stack.push(frame);
  } else {
    emStrongDelCloserHintStacks.set(tokenizer, [frame]);
  }
}

/**
 * Drop the closer-hint frame for the inline pass that just finished.
 * Removing the last frame drops the tokenizer's `maskedSrc` reference.
 */
function endEmStrongDelCloserScan(tokenizer) {
  const stack = emStrongDelCloserHintStacks.get(tokenizer);
  if (!stack) {
    return;
  }
  stack.pop();
  if (stack.length === 0) {
    emStrongDelCloserHintStacks.delete(tokenizer);
  }
}

/**
 * Index in `maskedSrc` of the last `*` or `_` run that can close emphasis
 * or strong. Uses the active inline-pass scan when `maskedSrc` is that
 * pass's source; otherwise scans this string and discards the result.
 */
function cachedLastPossibleEmStrongCloserIndex(tokenizer, maskedSrc, delim) {
  var _emStrongDelCloserHin;
  const frame = (_emStrongDelCloserHin = emStrongDelCloserHintStacks.get(tokenizer)) === null || _emStrongDelCloserHin === void 0 ? void 0 : _emStrongDelCloserHin.at(-1);
  if (frame && frame.maskedSrc === maskedSrc) {
    return frame.lastPossibleEmStrongCloserIndex[delim];
  }
  return scanLastPossibleEmStrongDelClosers(maskedSrc).lastPossibleEmStrongCloserIndex[delim];
}

/**
 * Index in `maskedSrc` of the last `~` run that can close strikethrough.
 * Uses the active inline-pass scan when `maskedSrc` is that pass's
 * source; otherwise scans this string and discards the result.
 */
function cachedLastPossibleDelCloserIndex(tokenizer, maskedSrc) {
  var _emStrongDelCloserHin2;
  const frame = (_emStrongDelCloserHin2 = emStrongDelCloserHintStacks.get(tokenizer)) === null || _emStrongDelCloserHin2 === void 0 ? void 0 : _emStrongDelCloserHin2.at(-1);
  if (frame && frame.maskedSrc === maskedSrc) {
    return frame.lastPossibleDelCloserIndex;
  }
  return scanLastPossibleEmStrongDelClosers(maskedSrc).lastPossibleDelCloserIndex;
}
function expandTabs(line, indent = 0) {
  let col = indent;
  let expanded = '';
  for (const char of line) {
    if (char === '\t') {
      const added = 4 - col % 4;
      expanded += ' '.repeat(added);
      col += added;
    } else {
      expanded += char;
      col++;
    }
  }
  return expanded;
}
},
"marked/src/Lexer.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._Lexer = void 0;
var _Tokenizer2 = __require("marked/src/Tokenizer.ts");
var _defaults2 = __require("marked/src/defaults.ts");
var _rules = __require("marked/src/rules.ts");
var _helpers = __require("marked/src/helpers.ts");
function _classPrivateMethodInitSpec(e, a) { _checkPrivateRedeclaration(e, a), a.add(e); }
function _checkPrivateRedeclaration(e, t) { if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object"); }
function _assertClassBrand(e, t, n) { if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n; throw new TypeError("Private element is not present on this object"); }
var _Lexer_brand = /*#__PURE__*/new WeakSet();
/**
 * Block Lexer
 */
class _Lexer {
  constructor(options) {
    _classPrivateMethodInitSpec(this, _Lexer_brand);
    this.tokens = void 0;
    this.options = void 0;
    this.state = void 0;
    this.inlineQueue = void 0;
    this.tokenizer = void 0;
    // TokenList cannot be created in one go
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.options = options || _defaults2._defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer2._Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      linkEmitted: false,
      linkParenPossible: true,
      top: true
    };
    const rules = {
      other: _rules.other,
      block: _rules.block.normal,
      inline: _rules.inline.normal
    };
    if (this.options.pedantic) {
      rules.block = _rules.block.pedantic;
      rules.inline = _rules.inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = _rules.block.gfm;
      if (this.options.breaks) {
        rules.inline = _rules.inline.breaks;
      } else {
        rules.inline = _rules.inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }

  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block: _rules.block,
      inline: _rules.inline
    };
  }

  /**
   * Static Lex Method
   */
  static lex(src, options) {
    const lexer = new _Lexer(options);
    return lexer.lex(src);
  }

  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options) {
    const lexer = new _Lexer(options);
    return lexer.inlineTokens(src);
  }

  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(_rules.other.carriageReturn, '\n');
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      // an inline <pre>, <code>, <kbd> or <script> left open ends with the block
      // holding it; carried over, it would stop every later block's text from
      // being escaped
      this.state.inRawBlock = false;
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }

  /**
   * Lexing
   */

  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    this.tokenizer.lexer = this;
    // list items and block quotes lex their contents with a nested call, so
    // restore the outer last token when it returns
    const outerLastToken = this.state.lastToken;
    if (this.options.pedantic) {
      src = src.replace(_rules.other.tabCharGlobal, '    ').replace(_rules.other.spaceLine, '');
    }
    let srcLength = Infinity;
    while (src) {
      var _this$options$extensi, _this$options$extensi2;
      if (src.length < srcLength) {
        srcLength = src.length;
      } else {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }
      this.state.lastToken = tokens.at(-1);
      let token;
      if ((_this$options$extensi = this.options.extensions) !== null && _this$options$extensi !== void 0 && (_this$options$extensi = _this$options$extensi.block) !== null && _this$options$extensi !== void 0 && _this$options$extensi.some(extTokenizer => {
        if (token = extTokenizer.call({
          lexer: this
        }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }

      // newline
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== undefined) {
          // if there's a single \n as a spacer, it's terminating the last line,
          // so move it there so that we don't get unnecessary paragraph tags
          lastToken.raw += '\n';
        } else {
          tokens.push(token);
        }
        continue;
      }

      // code
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        // An indented code block cannot interrupt a paragraph.
        if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'paragraph' || (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }

      // fences
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // heading
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // hr
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // blockquote
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // list
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // html
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // def
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'paragraph' || (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          // The first definition of a label wins, but a later one still consumes its text
          if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = {
              href: token.href,
              title: token.title
            };
          }
          tokens.push(token);
        }
        continue;
      }

      // table (gfm)
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // lheading
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // top-level paragraph
      // prevent paragraph consuming extensions by clipping 'src' to extension start
      let cutSrc = src;
      if ((_this$options$extensi2 = this.options.extensions) !== null && _this$options$extensi2 !== void 0 && _this$options$extensi2.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach(getStartIndex => {
          tempStart = getStartIndex.call({
            lexer: this
          }, tempSrc);
          if (typeof tempStart === 'number' && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'paragraph') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }

      // text
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }
    }
    this.state.top = true;
    this.state.lastToken = outerLastToken;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({
      src,
      tokens
    });
    return tokens;
  }

  /**
   * Does this link text hold a link already? An image does not count: an image
   * may hold a link, a link may not.
   */
  linkInText(text) {
    if (!text.includes('[')) {
      return false;
    }
    const linkRule = this.tokenizer.rules.inline.link;
    for (const match of text.matchAll(this.tokenizer.rules.inline.blockSkip)) {
      // blockSkip also matches code spans and html, and the `!` of an image is
      // left out of the match, so read the character before it.
      if (linkRule.test(match[0]) && text.charAt(match.index - 1) !== '!') {
        return true;
      }
    }
    for (const match of text.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      const match0 = match[0];
      const refStart = match0.lastIndexOf('[');
      if (match0.charAt(0) === '!' || !Object.hasOwn(this.tokens.links, (0, _helpers.normalizeLabel)(match0.slice(refStart + 1, -1)))) {
        continue;
      }
      // a candidate holding a link is not a link either, so it does not count
      if (refStart > 1 && this.linkInText(match0.slice(1, refStart - 1))) {
        continue;
      }
      return true;
    }
    return false;
  }

  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    this.tokenizer.lexer = this;
    // One paren scan per inline run, shared with Tokenizer.link: without a
    // ')' ahead the link regex cannot match, and skipping it avoids its
    // quadratic backtracking over unterminated-link inputs like
    // `'[a](b'.repeat(n)`. A nested run receives a substring of the outer
    // run, so if the outer had no ')' neither does this substring — skip
    // the scan in that case.
    const prevLinkParenPossible = this.state.linkParenPossible;
    this.state.linkParenPossible = prevLinkParenPossible && src.includes(')');
    try {
      return _assertClassBrand(_Lexer_brand, this, _inlineTokensInner).call(this, src, tokens);
    } finally {
      // A nested run (e.g. a link label) anchored on its own substring;
      // restore the outer run's flag for the rest of its loop.
      this.state.linkParenPossible = prevLinkParenPossible;
    }
  }
  infiniteLoopError(byte) {
    const errMsg = 'Infinite loop on byte: ' + byte;
    if (this.options.silent) {
      console.error(errMsg);
    } else {
      throw new Error(errMsg);
    }
  }
}
exports._Lexer = _Lexer;
function _inlineTokensInner(src, tokens) {
  var _this$options$hooks;
  // The masked source is only read by emStrong and del, which need a *, _ or
  // ~ to start. Skip building it for a run without one, unless a custom
  // tokenizer or an emStrongMask hook may read it.
  const maskedSrc = src.includes('*') || src.includes('_') || src.includes('~') || (_this$options$hooks = this.options.hooks) !== null && _this$options$hooks !== void 0 && _this$options$hooks.emStrongMask || this.tokenizer.emStrong !== _Tokenizer2._Tokenizer.prototype.emStrong || this.tokenizer.del !== _Tokenizer2._Tokenizer.prototype.del ? _assertClassBrand(_Lexer_brand, this, _maskSrc).call(this, src) : src;

  // One scan of this maskedSrc for the last emphasis, strong, and
  // strikethrough closers, shared by every opener in the pass. Popped
  // when the pass ends so the source is not retained (#4099).
  (0, _helpers.beginEmStrongDelCloserScan)(this.tokenizer, maskedSrc);
  try {
    return _assertClassBrand(_Lexer_brand, this, _tokenizeInlines).call(this, src, maskedSrc, tokens);
  } finally {
    (0, _helpers.endEmStrongDelCloserScan)(this.tokenizer);
  }
}
function _tokenizeInlines(src, maskedSrc, tokens) {
  let keepPrevChar = false;
  let prevChar = '';
  let srcLength = Infinity;
  while (src) {
    var _this$options$extensi3, _this$options$extensi4;
    if (src.length < srcLength) {
      srcLength = src.length;
    } else {
      this.infiniteLoopError(src.charCodeAt(0));
      break;
    }
    if (!keepPrevChar) {
      prevChar = '';
    }
    keepPrevChar = false;
    let token;

    // extensions
    if ((_this$options$extensi3 = this.options.extensions) !== null && _this$options$extensi3 !== void 0 && (_this$options$extensi3 = _this$options$extensi3.inline) !== null && _this$options$extensi3 !== void 0 && _this$options$extensi3.some(extTokenizer => {
      if (token = extTokenizer.call({
        lexer: this
      }, src, tokens)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        return true;
      }
      return false;
    })) {
      continue;
    }

    // escape
    if (token = this.tokenizer.escape(src)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // tag
    if (token = this.tokenizer.tag(src)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // link
    if (token = this.tokenizer.link(src)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // reflink, nolink
    if (token = this.tokenizer.reflink(src, this.tokens.links)) {
      src = src.substring(token.raw.length);
      const lastToken = tokens.at(-1);
      if (token.type === 'text' && (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'text') {
        lastToken.raw += token.raw;
        lastToken.text += token.text;
      } else {
        tokens.push(token);
      }
      continue;
    }

    // em & strong
    if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // code
    if (token = this.tokenizer.codespan(src)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // br
    if (token = this.tokenizer.br(src)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // del (gfm)
    if (token = this.tokenizer.del(src, maskedSrc, prevChar)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // autolink
    if (token = this.tokenizer.autolink(src)) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // url (gfm)
    if (!this.state.inLink && (token = this.tokenizer.url(src))) {
      src = src.substring(token.raw.length);
      tokens.push(token);
      continue;
    }

    // text
    // prevent inlineText consuming extensions by clipping 'src' to extension start
    let cutSrc = src;
    if ((_this$options$extensi4 = this.options.extensions) !== null && _this$options$extensi4 !== void 0 && _this$options$extensi4.startInline) {
      let startIndex = Infinity;
      const tempSrc = src.slice(1);
      let tempStart;
      this.options.extensions.startInline.forEach(getStartIndex => {
        tempStart = getStartIndex.call({
          lexer: this
        }, tempSrc);
        if (typeof tempStart === 'number' && tempStart >= 0) {
          startIndex = Math.min(startIndex, tempStart);
        }
      });
      if (startIndex < Infinity && startIndex >= 0) {
        cutSrc = src.substring(0, startIndex + 1);
      }
    }
    if (token = this.tokenizer.inlineText(cutSrc)) {
      src = src.substring(token.raw.length);
      if (token.raw.slice(-1) !== '_') {
        // Track prevChar before string of ____ started
        prevChar = token.raw.slice(-1);
      }
      keepPrevChar = true;
      const lastToken = tokens.at(-1);
      if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'text') {
        lastToken.raw += token.raw;
        lastToken.text += token.text;
      } else {
        tokens.push(token);
      }
      continue;
    }
    if (src) {
      this.infiniteLoopError(src.charCodeAt(0));
      break;
    }
  }
  return tokens;
}
/**
 * Mask links, code spans, raw html and autolinks. blockSkip finds every
 * `<...>` run, but only real raw html and autolinks take precedence over
 * emphasis: other text in angle brackets, like `<*name*>`, stays unmasked so
 * emphasis can open and close in it. A tag may also run past the first `>`,
 * as in `<a title=">">`, so mask the whole tag.
 */
function _maskBlocks(src) {
  const {
    blockSkip,
    tag,
    autolink
  } = this.tokenizer.rules.inline;
  let masked = '';
  let last = 0;
  let match;
  blockSkip.lastIndex = 0;
  while (match = blockSkip.exec(src)) {
    const start = match.index + (match[2] ? match[2].length : 0);
    let end = match.index + match[0].length;
    if (src.charAt(start) === '<') {
      const rest = src.slice(start);
      const html = tag.exec(rest) || autolink.exec(rest);
      if (!html) {
        blockSkip.lastIndex = start + 1;
        continue;
      }
      end = start + html[0].length;
      blockSkip.lastIndex = end;
    }
    masked += src.slice(last, start) + '[' + 'a'.repeat(end - start - 2) + ']';
    last = end;
  }
  return masked + src.slice(last);
}
/**
 * Mask links, code, html and escapes so emStrong and del do not see their
 * delimiters inside them.
 */
function _maskSrc(src) {
  var _this$options$hooks$e, _this$options$hooks2;
  // String with links masked to avoid interference with em and strong
  let maskedSrc = src;

  // Mask out reflinks
  if (this.tokens.links && src.includes('[')) {
    const reflinkSearch = this.tokenizer.rules.inline.reflinkSearch;
    const maskReflink = match0 => {
      const refStart = match0.lastIndexOf('[');
      if (!Object.hasOwn(this.tokens.links, (0, _helpers.normalizeLabel)(match0.slice(refStart + 1, -1)))) {
        return match0;
      }
      // CommonMark: "Links may not contain other links, at any level of
      // nesting." A candidate whose text already holds one never becomes a
      // link, so flattening the whole span would hide the emphasis that
      // does still apply inside it. Mask the links it holds instead.
      // Images are exempt: their text is flattened into an alt attribute.
      if (refStart > 1 && match0.charAt(0) !== '!') {
        const text = match0.slice(1, refStart - 1);
        if (this.linkInText(text)) {
          return '[' + text.replace(reflinkSearch, maskReflink) + '][' + 'a'.repeat(match0.length - refStart - 2) + ']';
        }
      }
      return '[' + 'a'.repeat(match0.length - 2) + ']';
    };
    maskedSrc = maskedSrc.replace(reflinkSearch, maskReflink);
  }

  // Mask out escaped characters.
  // Every mask must keep the length it replaces: emStrong and del line
  // maskedSrc up with src by slicing from the end. `anyPunctuation` matches
  // unicode punctuation, so an escaped astral character is 3 code units.
  // A backslash inside a code span is literal, not an escape. Mask the
  // backticks inside the span instead, so blockSkip still skips all of it.
  maskedSrc = maskedSrc.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (match0, code, punct) => {
    if (punct) {
      return '+'.repeat(match0.length);
    }
    if (code) {
      return code + match0.slice(code.length, -code.length).replace(/`/g, '+') + code;
    }
    return match0;
  });

  // Mask out other blocks
  maskedSrc = _assertClassBrand(_Lexer_brand, this, _maskBlocks).call(this, maskedSrc);

  // Mask out blocks from extensions
  maskedSrc = (_this$options$hooks$e = (_this$options$hooks2 = this.options.hooks) === null || _this$options$hooks2 === void 0 || (_this$options$hooks2 = _this$options$hooks2.emStrongMask) === null || _this$options$hooks2 === void 0 ? void 0 : _this$options$hooks2.call({
    lexer: this
  }, maskedSrc)) !== null && _this$options$hooks$e !== void 0 ? _this$options$hooks$e : maskedSrc;
  return maskedSrc;
}
},
"marked/src/rules.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.other = exports.inline = exports.block = void 0;
const noopTest = {
  exec: () => null
};
function cachedIndentRegex(createRegex) {
  const cache = [];
  return indent => {
    const cacheIndex = Math.max(0, Math.min(3, indent - 1));
    let regex = cache[cacheIndex];
    if (!regex) {
      regex = createRegex(cacheIndex);
      cache[cacheIndex] = regex;
    }
    return regex;
  };
}
function edit(regex, opt = '') {
  let source = typeof regex === 'string' ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === 'string' ? val : val.source;
      valSource = valSource.replace(other.caret, '$1');
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}

// use a default variable to ensure the regex is evaluated on client an not removed by minifiers
const supportsLookbehind = ((a = '') => {
  try {
    return !!new RegExp('(?<=1)(?<!1)' + a);
  } catch {
    // See browser support here:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookbehind_assertion
    return false;
  }
})();
const other = exports.other = {
  codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm,
  listInterruptsParagraph: /^ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  endingSpaceTabChar: /[ \t]$/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  leadingSpaceTab: /^[ \t]+/,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  // Neutralize a lazy setext underline, including one with trailing tabs.
  // CommonMark §4.3 allows those tabs on a real underline, so the same class
  // has to be recognized here or a lazy `===\t` becomes a heading.
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\][ \t]+\S/,
  listReplaceTask: /^\[[ xX]\][ \t]+/,
  listTaskCheckbox: /\[[ xX]\]/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/,
  numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: bull => new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`)),
  hrRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`)),
  fencesBeginRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}(?:\`\`\`|~~~)`)),
  // an ATX heading needs a space (or the end of the line) after the hashes, so a line
  // like `#tag` does not end a list item; pedantic mode accepts it as a heading
  headingBeginRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}#{1,6}(?:\\s|$)`)),
  pedanticHeadingBeginRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}#`)),
  // a list item ends where a paragraph would be interrupted, so this mirrors the
  // html start conditions in the paragraph rule below; type 7 is excluded there
  htmlBeginRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}(?:</?(?:${_tag})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i')),
  blockquoteBeginRegex: cachedIndentRegex(indent => new RegExp(`^ {0,${indent}}>`)),
  // list item and blockquote markers that open nested blocks at the start of a line, as in `- > # heading`
  nestedContainerMarkers: /^(?: {0,3}(?:(?:[*+-]|\d{1,9}[.)])[ \t]+|>[ \t]?))+/
};

/**
 * Block-Level Grammar
 */

const newline = /^(?:[ \t]*(?:\n|$))+/;
const blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
const hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const bullet = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
// The underline may end with spaces or tabs (CommonMark §4.3). Internal
// spaces or tabs still fail to match, and more than three spaces of indent
// still do not.
const lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/;
const lheading = edit(lheadingCore).replace(/bull/g, bullet) // lists can interrupt
.replace(/blockCode/g, /(?: {4}| {0,3}\t)/) // indented code can start a block but cannot interrupt a paragraph
.replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/) // fenced code blocks can interrupt
.replace(/blockquote/g, / {0,3}>/) // blockquote can interrupt
.replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/) // ATX heading can interrupt
.replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/) // thematic break can interrupt
.replace(/html/g, / {0,3}<[^\n>]+>\n/) // block html can interrupt
.replace(/\|table/g, '') // table not in commonmark
.getRegex();
const lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet) // lists can interrupt
.replace(/blockCode/g, /(?: {4}| {0,3}\t)/) // indented code can start a block but cannot interrupt a paragraph
.replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/) // fenced code blocks can interrupt
.replace(/blockquote/g, / {0,3}>/) // blockquote can interrupt
.replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/) // ATX heading can interrupt
.replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/) // thematic break can interrupt
.replace(/html/g, / {0,3}<[^\n>]+>\n/) // block html can interrupt
.replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/) // table can interrupt
.getRegex();
const _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
const blockText = /^[^\n]+/;
const _blockLabel = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+/;
const def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace('label', _blockLabel)
// An escaped delimiter is part of the title, so a backslash must consume the
// next character. An optional closer (`\"?`) lets that character backtrack
// into the closing quote (`[foo]: /url "t\"` is not a title).
.replace('title', /(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))/).getRegex();
const list = edit(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
const _tag = 'address|article|aside|base|basefont|blockquote|body|caption' + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption' + '|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe' + '|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option' + '|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title' + '|tr|track|ul';
const _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
const html = edit('^ {0,3}(?:' // optional indentation
+ '<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)' // (1)
+ '|comment[^\\n]*(\\n+|$)' // (2)
+ '|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)' // (3)
+ '|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)' // (4)
+ '|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)' // (5)
+ '|</?(tag)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)' // (6)
+ '|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)' // (7) open tag
+ '|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)' // (7) closing tag
+ ')', 'i').replace('comment', _comment).replace('tag', _tag).replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
const createParagraph = listInterrupt => edit(_paragraph).replace('hr', hr).replace('heading', ' {0,3}#{1,6}(?:\\s|$)').replace('|lheading', '') // setext headings don't interrupt commonmark paragraphs
.replace('|table', '').replace('blockquote', ' {0,3}>').replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)').replace('list', listInterrupt).replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)').replace('tag', _tag) // pars can be interrupted by html blocks of types (1) to (6)
.getRegex();

// only non-empty lists starting from 1 can interrupt paragraphs
const paragraph = createParagraph(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
// inside a blockquote a bare list marker (any number) starts a sibling list,
// so it must not be lazily continued as paragraph text (unlike a top level
// paragraph, where an empty list cannot interrupt)
const blockquoteParagraph = createParagraph(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);

// a line with only whitespace after the marker is blank, so it must not start a
// paragraph that lazily continues onto the next line
const blockquote = edit(/^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(paragraph)|[^\n]*)(?:\n|$))+/).replace('paragraph', blockquoteParagraph).getRegex();

/**
 * Normal Block Grammar
 */

const blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
/**
 * GFM Block Grammar
 */

const gfmTable = edit('^ *([^\\n ].*)\\n' // Header
+ ' {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)' // Align
+ '(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)') // Cells
.replace('hr', hr).replace('heading', ' {0,3}#{1,6}(?:\\s|$)').replace('blockquote', ' {0,3}>').replace('code', '(?: {4}| {0,3}\t)[^\\n]').replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)').replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]') // any bullet ends the table rows
.replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)').replace('tag', _tag) // tables can be interrupted by html blocks of types (1) to (6)
.getRegex();
const blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace('hr', hr).replace('heading', ' {0,3}#{1,6}(?:\\s|$)').replace('|lheading', '') // setext headings don't interrupt commonmark paragraphs
  .replace('table', gfmTable) // interrupt paragraphs with table
  .replace('blockquote', ' {0,3}>').replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)').replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]') // only non-empty lists starting from 1 can interrupt
  .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)').replace('tag', _tag) // pars can be interrupted by html blocks of types (1) to (6)
  .getRegex()
};

/**
 * Pedantic grammar (original John Gruber's loose markdown specification)
 */

const blockPedantic = {
  ...blockNormal,
  html: edit('^ *(?:comment(?: *\\n|\\s*$)' + '|<(tag)[\\s\\S]+?</\\1>(?: *\\n{2,}|\\s*$)' // closed tag
  + '|<tag(?:"[^"]*"|\'[^\']*\'|\\s[^\'"/>\\s]*)*?/?>(?: *\\n{2,}|\\s*$))').replace('comment', _comment).replace(/tag/g, '(?!(?:' + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub' + '|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)' + '\\b)\\w+(?!:|[^\\w\\s@]*@)\\b').getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace('hr', hr).replace('heading', ' *#{1,6} *[^\n]').replace('lheading', lheading).replace('|table', '').replace('blockquote', ' {0,3}>').replace('|fences', '').replace('|list', '').replace('|html', '').replace('|tag', '').getRegex()
};

/**
 * Inline-Level Grammar
 */

const escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const br = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
const inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;

// list of unicode punctuation marks, plus any missing characters from CommonMark spec
const _punctuation = /[\p{P}\p{S}]/u;
const _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
const _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
const punctuation = edit(/^((?![*_])punctSpace)/, 'u').replace(/punctSpace/g, _punctuationOrSpace).getRegex();

/**
 * Opening punct/quotes excluded from pedantic LDelim nextChar so
 * `aa**"A"**bb` / `aa**(A)**bb` can start strong (Pi + Ps + ASCII straight quotes).
 */
const _openQuote = /[\p{Pi}\p{Ps}"']/u;

// GFM allows ~ inside strong and em for strikethrough
const _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
const _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
const _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;

// sequences em should skip over [title](link), `code`, <html>
const blockSkip = edit(/link|precode-code|html/, 'g').replace('link', /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace('precode-', supportsLookbehind ? '(?<!`)()' : '(^^|[^`])').replace('code', /(?<b>`+)[^`]+\k<b>(?!`)/).replace('html', /<(?! )[^<>]*?>/).getRegex();
const emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
const emStrongLDelim = edit(emStrongLDelimCore, 'u').replace(/punct/g, _punctuation).getRegex();
const emStrongLDelimGfm = edit(emStrongLDelimCore, 'u').replace(/punct/g, _punctuationGfmStrongEm).getRegex();

// Pedantic: do not treat opening punct/quotes as left-delim punct (e.g. **( / **").
const emStrongLDelimPedanticCore = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;
const emStrongLDelimPedantic = edit(emStrongLDelimPedanticCore, 'u').replace(/openQuote/g, _openQuote).replace(/punct/g, _punctuation).getRegex();
const emStrongRDelimAstCore = '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)' // Skip orphan inside strong
+ '|[^*]+(?=[^*])' // Consume to delim
+ '|(?!\\*)punct(\\*+)(?=[\\s]|$)' // (1) #*** can only be a Right Delimiter
+ '|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)' // (2) a***#, a*** can only be a Right Delimiter
+ '|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)' // (3) #***a, ***a can only be Left Delimiter
+ '|[\\s](\\*+)(?!\\*)(?=punct)' // (4) ***# can only be Left Delimiter
+ '|(?!\\*)punct(\\*+)(?!\\*)(?=punct)' // (5) #***# can be either Left or Right Delimiter
+ '|notPunctSpace(\\*+)(?=notPunctSpace)'; // (6) a***a can be either Left or Right Delimiter

const emStrongRDelimAst = edit(emStrongRDelimAstCore, 'gu').replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
const emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, 'gu').replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();

// Pedantic: rule 3 requires whitespace before left delim; rule 6 allows punct before close (e.g. `:**bar`).
const emStrongRDelimAstPedanticCore = '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)' // Skip orphan inside strong
+ '|[^*]+(?=[^*])' // Consume to delim
+ '|(?!\\*)punct(\\*+)(?=[\\s]|$)' // (1) #*** can only be a Right Delimiter
+ '|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)' // (2) a***#, a*** can only be a Right Delimiter
+ '|(?!\\*)[\\s](\\*+)(?=notPunctSpace)' // (3) ***a can only be Left Delimiter (whitespace required; not #***a)
+ '|[\\s](\\*+)(?!\\*)(?=punct)' // (4) ***# can only be Left Delimiter
+ '|(?!\\*)punct(\\*+)(?!\\*)(?=punct)' // (5) #***# can be either Left or Right Delimiter
+ '|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)'; // (6) a***a, #***a, and :** (e.g. **foo:**bar)

const emStrongRDelimAstPedantic = edit(emStrongRDelimAstPedanticCore, 'gu').replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();

// Normal: no rule 6 for _ (a___a cannot close as emphasis).
const emStrongRDelimUnd = edit('^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)' // Skip orphan inside strong
+ '|[^_]+(?=[^_])' // Consume to delim
+ '|(?!_)punct(_+)(?=[\\s]|$)' // (1) #___ can only be a Right Delimiter
+ '|notPunctSpace(_+)(?!_)(?=punctSpace|$)' // (2) a___#, a___ can only be a Right Delimiter
+ '|(?!_)punctSpace(_+)(?=notPunctSpace)' // (3) #___a, ___a can only be Left Delimiter
+ '|[\\s](_+)(?!_)(?=punct)' // (4) ___# can only be Left Delimiter
+ '|(?!_)punct(_+)(?!_)(?=punct)', 'gu') // (5) #___# can be either Left or Right Delimiter
.replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();

// Pedantic: same rule 3/6 adjustments as emStrongRDelimAstPedantic (e.g. `_foo:_bar`).
const emStrongRDelimUndPedanticCore = '^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)' // Skip orphan inside strong
+ '|[^_]+(?=[^_])' // Consume to delim
+ '|(?!_)punct(_+)(?=[\\s]|$)' // (1) #___ can only be a Right Delimiter
+ '|notPunctSpace(_+)(?!_)(?=punctSpace|$)' // (2) a___#, a___ can only be a Right Delimiter
+ '|(?!_)[\\s](_+)(?=notPunctSpace)' // (3) ___a can only be Left Delimiter (whitespace required; not #___a)
+ '|[\\s](_+)(?!_)(?=punct)' // (4) ___# can only be Left Delimiter
+ '|(?!_)punct(_+)(?!_)(?=punct)' // (5) #___# can be either Left or Right Delimiter
+ '|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)'; // (6) a___a, #___a, and :__ (e.g. _foo:_bar)

const emStrongRDelimUndPedantic = edit(emStrongRDelimUndPedanticCore, 'gu').replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();

// Tilde left delimiter for strikethrough (similar to emStrongLDelim for asterisk)
const delLDelim = edit(/^~~?(?:((?!~)punct)|[^\s~])/, 'u').replace(/punct/g, _punctuation).getRegex();

// Tilde delimiter patterns for strikethrough (similar to asterisk)
const delRDelimCore = '^[^~]+(?=[^~])' // Consume to delim
+ '|(?!~)punct(~~?)(?=[\\s]|$)' // (1) #~~ can only be a Right Delimiter
+ '|notPunctSpace(~~?)(?!~)(?=punctSpace|$)' // (2) a~~#, a~~ can only be a Right Delimiter
+ '|(?!~)punctSpace(~~?)(?=notPunctSpace)' // (3) #~~a, ~~a can only be Left Delimiter
+ '|[\\s](~~?)(?!~)(?=punct)' // (4) ~~# can only be Left Delimiter
+ '|(?!~)punct(~~?)(?!~)(?=punct)' // (5) #~~# can be either Left or Right Delimiter
+ '|notPunctSpace(~~?)(?=notPunctSpace)'; // (6) a~~a can be either Left or Right Delimiter

const delRDelim = edit(delRDelimCore, 'gu').replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
const anyPunctuation = edit(/\\(punct)/, 'gu').replace(/punct/g, _punctuation).getRegex();

// `anyPunctuation` for the em/strong mask. A backslash is literal inside a code
// span, so a code span (matched like `inline.code`), or a backtick run that
// opens none, is matched whole and kept; only the escapes outside code spans
// are masked.
const anyPunctuationOutsideCode = edit(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, 'gu').replace(/punct/g, _punctuation).getRegex();
const autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace('scheme', /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace('email', /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
const _inlineComment = edit(_comment).replace('(?:-->|$)', '-->').getRegex();
const tag = edit('^comment' + '|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>' // self-closing tag
+ '|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>' // open tag
+ '|^<\\?[\\s\\S]*?\\?>' // processing instruction, e.g. <?php ?>
+ '|^<![a-zA-Z]+\\s[\\s\\S]*?>' // declaration, e.g. <!DOCTYPE html>
+ '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>') // CDATA section
.replace('comment', _inlineComment).replace('attribute', /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();

// One matched pair of brackets, holding no bracket of its own.
const _inlineLabelBrackets = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
// CommonMark lets the brackets in a link label nest to any depth, which a regex
// cannot follow, so it stops at a fixed one. Two levels is what the spec suite
// asks for: a third and a fourth flip no further example.
const _inlineLabel = edit(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace('brackets', _inlineLabelBrackets).getRegex();
const link = edit(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace('label', _inlineLabel).replace('href', /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/)
// Same as the definition title: the escaped character is not the closer.
.replace('title', /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)/).getRegex();
const reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace('label', _inlineLabel).replace('ref', _blockLabel).getRegex();
const nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace('ref', _blockLabel).getRegex();

// `reflink` and `nolink` are anchored, so the tokenizer tries each of them at a
// single position. `reflinkSearch` drops the anchors and runs with the global
// flag, which makes every '[' in the source a start position. A label crosses a
// bracket only by escaping it, and nothing caps how often it does, so a
// candidate that can never match still scans to the end of the source and the
// whole pass costs O(n^2).
//
// The labels below bound that scan. `_boundedInlineLabel` limits how many
// escapes, code spans and nested brackets a link text may hold, leaving runs of
// ordinary characters unbounded so link text of any length is still found.
// `_boundedBlockLabel` limits the label itself to 999 items, which is every
// label CommonMark allows: "A link label can have at most 999 characters
// inside the square brackets."
const _boundedBlockLabel = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/;
const _boundedInlineLabel = edit(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace('brackets', _inlineLabelBrackets).getRegex();
const reflinkSearch = edit('reflink|nolink(?!\\()', 'g').replace('reflink', edit(/^!?\[(label)\]\[(ref)\]/).replace('label', _boundedInlineLabel).replace('ref', _boundedBlockLabel).getRegex()).replace('nolink', edit(/^!?\[(ref)\](?:\[\])?/).replace('ref', _boundedBlockLabel).getRegex()).getRegex();
const _caseInsensitiveProtocol = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
const _extendedEmail = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
const _extendedEmailProtocol = edit(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, _extendedEmail).getRegex();

/**
 * Normal Inline Grammar
 */

const inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  anyPunctuationOutsideCode,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  delLDelim: noopTest,
  delRDelim: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
/**
 * Pedantic Inline Grammar
 */

const inlinePedantic = {
  ...inlineNormal,
  emStrongLDelim: emStrongLDelimPedantic,
  emStrongRDelimAst: emStrongRDelimAstPedantic,
  emStrongRDelimUnd: emStrongRDelimUndPedantic,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace('label', _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace('label', _inlineLabel).getRegex()
};

/**
 * GFM Inline Grammar
 */

const inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  delLDelim,
  delRDelim,
  url: edit(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace('emailProtocol', _extendedEmailProtocol).replace('protocol', _caseInsensitiveProtocol).replace('email', /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
  text: edit(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace('protocol', _caseInsensitiveProtocol).replace(/emailProtocol/g, /(?:mailto|xmpp):/)
  // GFM: a www autolink starts only at the beginning of a line, after whitespace or after
  // `*`, `_`, `~` or `(`. Without lookbehind support, keep stopping at every `www.`.
  .replace('wwwStart', supportsLookbehind ? '(?<![^\\s*_~(])www\\.' : 'www\\.').getRegex()
};

/**
 * GFM + Line Breaks Inline Grammar
 */

const inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace('{2,}', '*').getRegex(),
  text: edit(inlineGfm.text).replace('\\b_', '\\b_| {2,}\\n').replace(/\{2,\}/g, '*').getRegex()
};

/**
 * exports
 */

const block = exports.block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
const inline = exports.inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
},
"marked/src/Tokenizer.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._Tokenizer = void 0;
var _defaults2 = __require("marked/src/defaults.ts");
var _helpers = __require("marked/src/helpers.ts");
function outputLink(cap, link, raw, lexer, rules) {
  const href = link.href;
  const title = link.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, '$1');
  const isImage = cap[0].charAt(0) === '!';
  const outerInLink = lexer.state.inLink;
  const outerLinkEmitted = lexer.state.linkEmitted;
  const outerInRawBlock = lexer.state.inRawBlock;
  lexer.state.inLink = true;
  lexer.state.linkEmitted = false;
  const tokens = lexer.inlineTokens(text);
  const textHasLink = lexer.state.linkEmitted;
  lexer.state.linkEmitted = outerLinkEmitted;
  lexer.state.inLink = outerInLink;
  if (!isImage) {
    // CommonMark: "Links may not contain other links, at any level of nesting."
    // Bail so the caller falls through to text and the inner link is the one kept.
    // Images are exempt: their text is flattened into an alt attribute.
    if (textHasLink) {
      // these tokens are discarded, so undo the raw-block state they opened;
      // leaving it set would suppress escaping for the text that is re-scanned
      lexer.state.inRawBlock = outerInRawBlock;
      return;
    }
    lexer.state.linkEmitted = true;
  }
  return {
    type: isImage ? 'image' : 'link',
    raw,
    href,
    title,
    text,
    tokens
  };
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split('\n').map(node => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;

    // Up to the fence's own indentation is removed from each line, so a line
    // indented less than the fence loses whatever indentation it has.
    return node.slice(Math.min(indentInNode.length, indentToCode.length));
  }).join('\n');
}
function isLabelEndInsideToken(src, label, labelStart, rules) {
  if (!label.includes('<')) {
    return false;
  }
  for (let i = 0; i < label.length; i++) {
    if (label[i] === '\\') {
      i++;
      continue;
    }
    if (label[i] === '`') {
      const code = rules.inline.code.exec(label.slice(i));
      if (code) {
        i += code[0].length - 1;
        continue;
      }
    }
    if (label[i] !== '<') {
      continue;
    }
    const tokenSrc = src.slice(labelStart + i);
    const token = rules.inline.tag.exec(tokenSrc) || rules.inline.autolink.exec(tokenSrc);
    if (!token) {
      continue;
    }
    if (token[0].length > label.length - i) {
      return true;
    }
    i += token[0].length - 1;
  }
  return false;
}

/**
 * Tokenizer
 */
class _Tokenizer {
  // set by the lexer

  constructor(options) {
    this.options = void 0;
    this.rules = void 0;
    // set by the lexer
    this.lexer = void 0;
    this.options = options || _defaults2._defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: 'space',
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const raw = this.options.pedantic ? cap[0] : (0, _helpers.trimTrailingBlankLines)(cap[0]);
      const text = raw.replace(this.rules.other.codeRemoveIndent, '');
      return {
        type: 'code',
        raw,
        codeBlockStyle: 'indented',
        text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || '', this.rules);
      return {
        type: 'code',
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, '$1') : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();

      // remove trailing #s
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = (0, _helpers.rtrim)(text, '#');
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceTabChar.test(trimmed)) {
          // CommonMark requires a space or tab before trailing #s
          text = trimmed.trim();
        }
      }
      return {
        type: 'heading',
        raw: (0, _helpers.rtrim)(cap[0], '\n'),
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: 'hr',
        raw: (0, _helpers.rtrim)(cap[0], '\n')
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = (0, _helpers.rtrim)(cap[0], '\n').split('\n');
      let raw = '';
      let text = '';
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          // get lines up to a continuation
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join('\n');
        const currentText = currentRaw
        // a tab after the block quote marker runs to the next tab stop, and
        // the marker only consumes one space of it; the rest is content
        .replace(this.rules.other.blockquoteMarkerWhitespace, (_, marker, whitespace) => marker + (0, _helpers.expandTabs)(whitespace, marker.length))
        // precede setext continuation with 4 spaces so it isn't a setext
        .replace(this.rules.other.blockquoteSetextReplace, '\n    $1').replace(this.rules.other.blockquoteSetextReplace2, '');
        raw = raw ? `${raw}\n${currentRaw}` : currentRaw;
        text = text ? `${text}\n${currentText}` : currentText;

        // parse blockquote lines as top level tokens
        // merge paragraphs if this is a continuation
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;

        // if there is no continuation then we are done
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'code' || (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'heading' || (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'hr' || (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'html' || (lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'table') {
          // blockquote continuation cannot be preceded by a code block, heading, hr, html block or table
          break;
        } else if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'blockquote') {
          // include continuation in nested blockquote
          const oldToken = lastToken;
          // The continuation lines belong to the same nesting frame as the
          // nested blockquote, which already had one '>' marker stripped, so
          // strip one marker from them too. Otherwise a restated marker after a
          // lazy line is re-parsed as a spurious deeper blockquote.
          const continuation = lines.join('\n');
          const newText = oldToken.raw + '\n' + continuation.replace(this.rules.other.blockquoteSetextReplace2, '');
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;

          // Only include continuation lines the nested blockquote actually
          // consumed. Unconsumed trailing lines must stay out of `raw` so the
          // lexer can still tokenize them (paragraph, next blockquote, etc.).
          const leftover = newText.substring(newToken.raw.length).replace(/^\n/, '');
          const leftoverCount = leftover ? leftover.split('\n').length : 0;
          const consumed = leftoverCount ? lines.slice(0, -leftoverCount) : lines;
          if (consumed.length > 0) {
            raw = `${raw}\n${consumed.join('\n')}`;
          }
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;

          // A leftover line that starts with '>' still belongs to this
          // blockquote; any other leftover line ends it.
          lines = lines.slice(consumed.length);
          if (lines.length > 0 && this.rules.other.blockquoteStart.test(lines[0])) {
            continue;
          }
          break;
        } else if ((lastToken === null || lastToken === void 0 ? void 0 : lastToken.type) === 'list') {
          // include continuation in nested list
          const oldToken = lastToken;
          const newText = oldToken.raw + '\n' + lines.join('\n');
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;

          // The list raw has no '>' markers, so it cannot be cut out of `raw`.
          // Count the continuation lines the list took and add those lines instead.
          const consumedCount = newToken.raw.length > oldToken.raw.length ? newText.slice(oldToken.raw.length + 1, newToken.raw.length).split('\n').length : 0;
          if (consumedCount > 0) {
            const consumed = lines.slice(0, consumedCount).join('\n');
            raw = `${raw}\n${consumed}`;
            text = `${text}\n${consumed}`;
          }
          lines = lines.slice(consumedCount);
          continue;
        }
      }
      return {
        type: 'blockquote',
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      var _this$lexer$state$las;
      // Inside a list item, paragraph lines are lexed as text tokens, so a list after one would
      // interrupt the paragraph. Only a non-empty list starting with a bullet or 1 can do that
      if (!this.options.pedantic && ((_this$lexer$state$las = this.lexer.state.lastToken) === null || _this$lexer$state$las === void 0 ? void 0 : _this$lexer$state$las.type) === 'text' && !this.rules.other.listInterruptsParagraph.test(src)) {
        return;
      }

      // src is only consumed from the front, so every raw below is a slice of
      // listSrc rather than a string built up line by line
      const listSrc = src;
      const taken = () => listSrc.length - src.length;
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list = {
        type: 'list',
        raw: '',
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : '',
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : '[*+-]';
      }

      // Get next list item
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      // Check if current bullet point can start a new List Item
      while (src) {
        let endEarly = false;
        let itemContents = '';
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          // End list if bullet was actually HR (possibly move into itemRegex?)
          break;
        }
        const itemStart = taken();
        src = src.substring(cap[0].length);
        const firstLine = cap[2].split('\n', 1)[0];
        const bulletIndent = cap[1].length;
        let line = this.options.pedantic ? (0, _helpers.expandTabs)(firstLine, bulletIndent) : firstLine.replace(this.rules.other.leadingSpaceTab, whitespace => (0, _helpers.expandTabs)(whitespace, bulletIndent));
        let nextLine = src.split('\n', 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = bulletIndent + 1;
        } else {
          indent = line.search(this.rules.other.nonSpaceChar); // Find first non-space char
          indent = indent > 4 ? 1 : indent; // Treat indented code blocks (> 4 spaces) as having only 1 indent
          itemContents = line.slice(indent);
          indent += bulletIndent;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          // Items begin with at most one blank line
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.options.pedantic ? this.rules.other.pedanticHeadingBeginRegex(indent) : this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          const blockquoteBeginRegex = this.rules.other.blockquoteBeginRegex(indent);

          // A lazy line continues a paragraph, so it is not checked for the start of a block
          let lineIsLazy = false;

          // Check if following lines should be included in List Item
          while (src) {
            const rawLine = src.split('\n', 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;

            // Re-align to follow commonmark nesting rules
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, '  ');
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.leadingSpaceTab, whitespace => (0, _helpers.expandTabs)(whitespace));
            }

            // End list item if found code fences
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }

            // End list item if found start of new heading
            if (headingBeginRegex.test(nextLine)) {
              break;
            }

            // End list item if found start of html block
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }

            // End list item if found start of blockquote
            if (blockquoteBeginRegex.test(nextLine)) {
              break;
            }

            // End list item if found start of new bullet
            if (nextBulletRegex.test(nextLine)) {
              break;
            }

            // Horizontal rule found
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              // Dedent if possible
              itemContents += '\n' + nextLineWithoutTabs.slice(indent);
              lineIsLazy = false;
            } else {
              // not enough indentation
              if (blankLine) {
                break;
              }

              // paragraph continuation unless last line was a different block level element
              if (line.replace(this.rules.other.tabCharGlobal, '    ').search(this.rules.other.nonSpaceChar) >= 4) {
                // indented code block
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (htmlBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              if (!this.options.pedantic && !lineIsLazy) {
                // `line` is relative to the item content, so a block on it can be indented up to 3 spaces whatever
                // the item indent is. A nested list item or blockquote on it, as in `- # heading` or `> ---`, holds
                // a block that a lazy line cannot continue either, so check what follows those markers too.
                const lastBlockLine = line.replace(this.rules.other.nestedContainerMarkers, '');
                if (this.rules.block.fences.test(lastBlockLine) || this.rules.block.heading.test(lastBlockLine) || this.rules.block.hr.test(lastBlockLine)) {
                  break;
                }
              }

              // A lazy continuation can look like a setext underline after
              // list indentation is removed. Keep it in the paragraph.
              const setextContinuation = !this.options.pedantic && /^ {0,3}(?:=+|-+) *$/.test(nextLine) && this.rules.block.lheading.test(`${line}\n${nextLine}`);
              const continuation = setextContinuation ? `    ${nextLineWithoutTabs.replace(/^ {0,3}/, '')}` : nextLine;
              itemContents += '\n' + continuation;
              lineIsLazy = true;
            }
            blankLine = !nextLine.trim();
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }

        // The loops above appended a '\n' the source may not have had. It could
        // only land on the item that exhausts src, whose raw is trimmed below,
        // and after which nothing reads endsWithBlankLine
        const raw = listSrc.slice(itemStart, taken());
        if (!list.loose) {
          // If the previous item ended with a blank line, the list is loose
          if (endsWithBlankLine) {
            list.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        list.items.push({
          type: 'list_item',
          raw,
          task: !!this.options.gfm && this.rules.other.listIsTask.test(itemContents),
          loose: false,
          text: itemContents,
          tokens: []
        });
      }

      // Do not consume newlines at end of final item. Alternatively, make itemRegex *start* with any newlines to simplify/speed up endsWithBlankLine logic
      const lastItem = list.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        // not a list since there were no items
        return;
      }
      list.raw = listSrc.slice(0, taken()).trimEnd();

      // Item child tokens handled here at end because we needed to have the final item to trim it first
      // First pass: tokenize items and finalize list.loose from spacers before placing checkboxes
      for (const item of list.items) {
        this.lexer.state.top = false;
        item.tokens = this.lexer.blockTokens(item.text, []);
        if (!list.loose) {
          // Check if list should be loose
          const spacers = item.tokens.filter(t => t.type === 'space');
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some(t => this.rules.other.anyLine.test(t.raw));
          list.loose = hasMultipleLineBreaks;
        }
      }

      // Second pass: place task checkboxes using the final list.loose
      for (const item of list.items) {
        const itemToken = item.tokens[0];
        if (item.task && ((itemToken === null || itemToken === void 0 ? void 0 : itemToken.type) === 'text' || (itemToken === null || itemToken === void 0 ? void 0 : itemToken.type) === 'paragraph')) {
          // Remove checkbox markdown from item tokens
          item.text = item.text.replace(this.rules.other.listReplaceTask, '');
          itemToken.raw = itemToken.raw.replace(this.rules.other.listReplaceTask, '');
          itemToken.text = itemToken.text.replace(this.rules.other.listReplaceTask, '');
          for (let i = this.lexer.inlineQueue.length - 1; i >= 0; i--) {
            if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[i].src)) {
              this.lexer.inlineQueue[i].src = this.lexer.inlineQueue[i].src.replace(this.rules.other.listReplaceTask, '');
              break;
            }
          }
          const taskRaw = this.rules.other.listTaskCheckbox.exec(item.raw);
          if (taskRaw) {
            const checkboxToken = {
              type: 'checkbox',
              raw: taskRaw[0] + ' ',
              checked: taskRaw[0] !== '[ ]'
            };
            item.checked = checkboxToken.checked;
            if (list.loose) {
              if (item.tokens[0] && ['paragraph', 'text'].includes(item.tokens[0].type) && 'tokens' in item.tokens[0] && item.tokens[0].tokens) {
                item.tokens[0].raw = checkboxToken.raw + item.tokens[0].raw;
                item.tokens[0].text = checkboxToken.raw + item.tokens[0].text;
                item.tokens[0].tokens.unshift(checkboxToken);
              } else {
                item.tokens.unshift({
                  type: 'paragraph',
                  raw: checkboxToken.raw,
                  text: checkboxToken.raw,
                  tokens: [checkboxToken]
                });
              }
            } else {
              item.tokens.unshift(checkboxToken);
            }
          }
        } else if (item.task) {
          item.task = false;
        }
      }

      // Set all items to loose if list is loose
      if (list.loose) {
        for (const item of list.items) {
          item.loose = true;
          for (const token of item.tokens) {
            if (token.type === 'text') {
              token.type = 'paragraph';
            }
          }
        }
      }
      return list;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const raw = (0, _helpers.trimTrailingBlankLines)(cap[0]);
      const token = {
        type: 'html',
        block: true,
        raw,
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: raw
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      // outside angle brackets a link destination holds only balanced parentheses
      if (!this.rules.other.startAngleBracket.test(cap[2]) && (0, _helpers.findClosingBracket)(cap[2], '()') !== -1) {
        return;
      }
      const tag = (0, _helpers.normalizeLabel)(cap[1]);
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, '$1').replace(this.rules.inline.anyPunctuation, '$1') : '';
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, '$1') : cap[3];
      return {
        type: 'def',
        tag,
        raw: (0, _helpers.rtrim)(cap[0], '\n'),
        href,
        title
      };
    }
  }
  table(src) {
    var _cap$;
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      // delimiter row must have a pipe (|) or colon (:) otherwise it is a setext heading
      return;
    }
    const headers = (0, _helpers.splitCells)(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, '').split('|');
    const rows = (_cap$ = cap[3]) !== null && _cap$ !== void 0 && _cap$.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, '').split('\n') : [];
    const item = {
      type: 'table',
      raw: (0, _helpers.rtrim)(cap[0], '\n'),
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      // header and align columns must be equal, rows can be different.
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push('right');
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push('center');
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push('left');
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push((0, _helpers.splitCells)(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      const text = cap[1].trim();
      return {
        type: 'heading',
        raw: (0, _helpers.rtrim)(cap[0], '\n'),
        depth: cap[2].charAt(0) === '=' ? 1 : 2,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1];
      return {
        type: 'paragraph',
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: 'text',
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: 'escape',
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: 'html',
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    // The link regex backtracks quadratically over unterminated-link inputs
    // like '[a](b'.repeat(n): at every '[' its greedy unquoted-href run
    // re-partitions the whole remainder while hunting for a ')' that never
    // comes. inlineTokens anchors one paren scan per run in
    // state.linkParenPossible; when it is false the regex cannot match, so
    // bail out before running it.
    if (this.lexer.state.linkParenPossible === false) {
      return undefined;
    }
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const labelStart = cap[0].charAt(0) === '!' ? 2 : 1;
      if (!this.options.pedantic && isLabelEndInsideToken(src, cap[1], labelStart, this.rules)) {
        return;
      }
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        // commonmark requires matching angle brackets
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }

        // ending angle bracket cannot be escaped
        const rtrimSlash = (0, _helpers.rtrim)(trimmedUrl.slice(0, -1), '\\');
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        // find closing parenthesis
        const lastParenIndex = (0, _helpers.findClosingBracket)(cap[2], '()');
        if (lastParenIndex === -2) {
          // more open parens than closed
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf('!') === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = '';
        }
      }
      // The ')' that ends the match is the link closer only when it is not
      // escaped. `[foo](/url\)` has no closer; that paren is destination text.
      const unescaped = (0, _helpers.rtrim)(cap[0].slice(0, -1), '\\');
      if ((cap[0].length - unescaped.length) % 2 === 0) {
        return;
      }
      let href = cap[2];
      let title = '';
      if (this.options.pedantic) {
        // split pedantic href and title
        const link = this.rules.other.pedanticHrefTitle.exec(href);
        if (link) {
          href = link[1];
          title = link[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : '';
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          // pedantic allows starting angle bracket without ending angle bracket
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, '$1') : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, '$1') : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const labelStart = cap[0].charAt(0) === '!' ? 2 : 1;
      if (!this.options.pedantic && isLabelEndInsideToken(src, cap[1], labelStart, this.rules)) {
        return;
      }
      const link = links[(0, _helpers.normalizeLabel)(cap[2] || cap[1])];
      if (!link) {
        const text = cap[0].charAt(0);
        return {
          type: 'text',
          raw: text,
          text
        };
      }
      return outputLink(cap, link, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = '') {
    var _at;
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (!match[1] && !match[2] && !match[3] && !match[4]) return;
    const delimChar = match[0][0];
    // A mid-run opener (for example the second star of an unmatched `**`) must
    // only pair with a delimiter that can only close, otherwise it steals the
    // opener of a later span (`**a*b*c` must be `**a<em>b</em>c`).
    const midRun = prevChar === delimChar;

    // The start of this delimiter run may already be behind src, either taken
    // as text after the whole run failed to match or used to close an earlier
    // span. Flanking and rules 9-10 are about the whole run, so find its start.
    // Pedantic follows markdown.pl, which has no such rules.
    const srcStart = maskedSrc.length - src.length;
    let runStart = srcStart;
    while (!this.options.pedantic && runStart > 0 && maskedSrc[runStart - 1] === delimChar) {
      runStart--;
    }
    const runPrevChar = (_at = [...maskedSrc.slice(Math.max(0, runStart - 2), runStart)].at(-1)) !== null && _at !== void 0 ? _at : '';
    // The other delimiter character counts as punctuation here (`_**a*`, `*_#_`)
    const runPrevPunct = runPrevChar === '*' || runPrevChar === '_' || !!this.rules.inline.punctuation.exec(runPrevChar);
    if (runStart < srcStart) {
      prevChar = runPrevChar;
    }
    const prevPunct = runStart < srcStart ? runPrevPunct : prevChar === '*' || prevChar === '_' || !!this.rules.inline.punctuation.exec(prevChar);

    // _ can't be between two alphanumerics. \p{L}\p{N} includes non-english alphabet/numbers as well
    if (match[4] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[3] || '';
    if (!nextChar || !prevChar || prevPunct) {
      // unicode Regex counts emoji as 1 char; spread into array for proper count (used multiple times below)
      const lLength = [...match[0]].length - 1;
      let rDelim,
        rLength,
        delimTotal = lLength,
        midDelimTotal = 0;

      // Rules 9-10 count the whole run, and also apply when the opener could
      // close as well (`a*b**`, where `*` is both left- and right-flanking).
      const runLength = srcStart - runStart + lLength;
      const openerCanClose = !this.options.pedantic && !!runPrevChar.trim() && (!!nextChar || delimChar === '*' && !runPrevPunct);
      if (delimChar !== '*' && delimChar !== '_') return;
      const endReg = delimChar === '*' ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      const lastPossibleEmStrongCloserIndex = (0, _helpers.cachedLastPossibleEmStrongCloserIndex)(this, maskedSrc, delimChar);
      const emStrongCloserWindowStart = maskedSrc.length - src.length + lLength;
      if (lastPossibleEmStrongCloserIndex < emStrongCloserWindowStart) return;
      // Clip maskedSrc to same section of string as src (move to lexer?)
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const lastPossibleEmStrongCloserIndexInWindow = lastPossibleEmStrongCloserIndex - emStrongCloserWindowStart;
      endReg.lastIndex = 0;
      while ((match = endReg.exec(maskedSrc)) !== null) {
        if (match.index > lastPossibleEmStrongCloserIndexInWindow) break;
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue; // skip single * in __abc*abc__

        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          // found another Left Delim
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6] || openerCanClose) {
          // either Left or Right Delim
          if (midRun && (match[5] || match[6])) {
            // A mid-run opener cannot close against an ambiguous delimiter that
            // can also open; that delimiter opens its own emphasis span instead.
            break;
          }
          if (runLength % 3 && !((runLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue; // CommonMark Emphasis Rules 9-10
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue; // Haven't found enough closing delimiters

        // Remove extra characters. *a*** -> *a*
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        // char length can be >1 for unicode characters;
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);

        // Create `em` if smallest delimiter has odd char count. *a***
        if (Math.min(lLength, rLength) % 2) {
          const text = raw.slice(1, -1);
          return {
            type: 'em',
            raw,
            text,
            tokens: this.lexer.inlineTokens(text)
          };
        }

        // Create 'strong' if smallest delimiter has even char count. **a***
        const text = raw.slice(2, -2);
        return {
          type: 'strong',
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, ' ');
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: 'codespan',
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: 'br',
        raw: cap[0]
      };
    }
  }
  del(src, maskedSrc, prevChar = '') {
    let match = this.rules.inline.delLDelim.exec(src);
    if (!match) return;
    const nextChar = match[1] || '';
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      // unicode Regex counts emoji as 1 char; spread into array for proper count
      const lLength = [...match[0]].length - 1;
      let rDelim,
        rLength,
        delimTotal = lLength;
      const endReg = this.rules.inline.delRDelim;
      const lastPossibleDelCloserIndex = (0, _helpers.cachedLastPossibleDelCloserIndex)(this, maskedSrc);
      const delCloserWindowStart = maskedSrc.length - src.length + lLength;
      if (lastPossibleDelCloserIndex < delCloserWindowStart) return;
      // Clip maskedSrc to same section of string as src
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const lastPossibleDelCloserIndexInWindow = lastPossibleDelCloserIndex - delCloserWindowStart;
      endReg.lastIndex = 0;
      while ((match = endReg.exec(maskedSrc)) !== null) {
        if (match.index > lastPossibleDelCloserIndexInWindow) break;
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (rLength !== lLength) continue;
        if (match[3] || match[4]) {
          // found another Left Delim
          delimTotal += rLength;
          continue;
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue; // Haven't found enough closing delimiters

        // Remove extra characters
        rLength = Math.min(rLength, rLength + delimTotal);
        // char length can be >1 for unicode characters
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);

        // Create del token - only single ~ or double ~~ supported
        const text = raw.slice(lLength, -lLength);
        return {
          type: 'del',
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[1];
        href = 'mailto:' + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: 'link',
        raw: cap[0],
        text,
        href,
        autolink: true,
        tokens: [{
          type: 'text',
          raw: text,
          text
        }]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[0];
        href = 'mailto:' + text;
      } else {
        // do extended autolink path validation
        let prevCapZero;
        do {
          var _this$rules$inline$_b, _this$rules$inline$_b2;
          prevCapZero = cap[0];
          cap[0] = (_this$rules$inline$_b = (_this$rules$inline$_b2 = this.rules.inline._backpedal.exec(cap[0])) === null || _this$rules$inline$_b2 === void 0 ? void 0 : _this$rules$inline$_b2[0]) !== null && _this$rules$inline$_b !== void 0 ? _this$rules$inline$_b : '';
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === 'www.') {
          href = 'http://' + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: 'link',
        raw: cap[0],
        text,
        href,
        autolink: true,
        tokens: [{
          type: 'text',
          raw: text,
          text
        }]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: 'text',
        raw: cap[0],
        // raw HTML keeps whatever it was written with, everywhere else a numeric
        // character reference stands for the character itself
        text: escaped ? cap[0] : (0, _helpers.decodeNumericCharacterReferences)(cap[0]),
        escaped
      };
    }
  }
}
exports._Tokenizer = _Tokenizer;
},
"orderedmap/index.js":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = OrderedMap;
// ::- Persistent data structure representing an ordered mapping from
// strings to values, with some convenient update methods.
function OrderedMap(content) {
  this.content = content;
}
OrderedMap.prototype = {
  constructor: OrderedMap,
  find: function (key) {
    for (var i = 0; i < this.content.length; i += 2) if (this.content[i] === key) return i;
    return -1;
  },
  // :: (string) → ?any
  // Retrieve the value stored under `key`, or return undefined when
  // no such key exists.
  get: function (key) {
    var found = this.find(key);
    return found == -1 ? undefined : this.content[found + 1];
  },
  // :: (string, any, ?string) → OrderedMap
  // Create a new map by replacing the value of `key` with a new
  // value, or adding a binding to the end of the map. If `newKey` is
  // given, the key of the binding will be replaced with that key.
  update: function (key, value, newKey) {
    var self = newKey && newKey != key ? this.remove(newKey) : this;
    var found = self.find(key),
      content = self.content.slice();
    if (found == -1) {
      content.push(newKey || key, value);
    } else {
      content[found + 1] = value;
      if (newKey) content[found] = newKey;
    }
    return new OrderedMap(content);
  },
  // :: (string) → OrderedMap
  // Return a map with the given key removed, if it existed.
  remove: function (key) {
    var found = this.find(key);
    if (found == -1) return this;
    var content = this.content.slice();
    content.splice(found, 2);
    return new OrderedMap(content);
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the start of the map.
  addToStart: function (key, value) {
    return new OrderedMap([key, value].concat(this.remove(key).content));
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the end of the map.
  addToEnd: function (key, value) {
    var content = this.remove(key).content.slice();
    content.push(key, value);
    return new OrderedMap(content);
  },
  // :: (string, string, any) → OrderedMap
  // Add a key after the given key. If `place` is not found, the new
  // key is added to the end.
  addBefore: function (place, key, value) {
    var without = this.remove(key),
      content = without.content.slice();
    var found = without.find(place);
    content.splice(found == -1 ? content.length : found, 0, key, value);
    return new OrderedMap(content);
  },
  // :: ((key: string, value: any))
  // Call the given function for each key/value pair in the map, in
  // order.
  forEach: function (f) {
    for (var i = 0; i < this.content.length; i += 2) f(this.content[i], this.content[i + 1]);
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by prepending the keys in this map that don't
  // appear in `map` before the keys in `map`.
  prepend: function (map) {
    map = OrderedMap.from(map);
    if (!map.size) return this;
    return new OrderedMap(map.content.concat(this.subtract(map).content));
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by appending the keys in this map that don't
  // appear in `map` after the keys in `map`.
  append: function (map) {
    map = OrderedMap.from(map);
    if (!map.size) return this;
    return new OrderedMap(this.subtract(map).content.concat(map.content));
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a map containing all the keys in this map that don't
  // appear in `map`.
  subtract: function (map) {
    var result = this;
    map = OrderedMap.from(map);
    for (var i = 0; i < map.content.length; i += 2) result = result.remove(map.content[i]);
    return result;
  },
  // :: () → Object
  // Turn ordered map into a plain object.
  toObject: function () {
    var result = {};
    this.forEach(function (key, value) {
      result[key] = value;
    });
    return result;
  },
  // :: number
  // The amount of keys in this map.
  get size() {
    return this.content.length >> 1;
  }
};

// :: (?union<Object, OrderedMap>) → OrderedMap
// Return a map with the given content. If null, create an empty
// map. If given an ordered map, return that map itself. If given an
// object, create a map from the object's properties.
OrderedMap.from = function (value) {
  if (value instanceof OrderedMap) return value;
  var content = [];
  if (value) for (var prop in value) content.push(prop, value[prop]);
  return new OrderedMap(content);
};
},
"prosemirror-commands/src/commands.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.autoJoin = autoJoin;
exports.baseKeymap = void 0;
exports.chainCommands = chainCommands;
exports.selectTextblockStart = exports.selectTextblockEnd = exports.selectParentNode = exports.selectNodeForward = exports.selectNodeBackward = exports.selectAll = exports.pcBaseKeymap = exports.newlineInCode = exports.macBaseKeymap = exports.liftEmptyBlock = exports.lift = exports.joinUp = exports.joinTextblockForward = exports.joinTextblockBackward = exports.joinForward = exports.joinDown = exports.joinBackward = exports.exitCode = exports.deleteSelection = exports.createParagraphNear = void 0;
exports.setBlockType = setBlockType;
exports.splitBlock = void 0;
exports.splitBlockAs = splitBlockAs;
exports.splitBlockKeepMarks = void 0;
exports.toggleMark = toggleMark;
exports.wrapIn = wrapIn;
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
/// Delete the selection, if there is one.
const deleteSelection = (state, dispatch) => {
  if (state.selection.empty) return false;
  if (dispatch) dispatch(state.tr.deleteSelection().scrollIntoView());
  return true;
};
exports.deleteSelection = deleteSelection;
function atBlockStart(state, view) {
  let {
    $cursor
  } = state.selection;
  if (!$cursor || (view ? !view.endOfTextblock("backward", state) : $cursor.parentOffset > 0)) return null;
  return $cursor;
}

/// If the selection is empty and at the start of a textblock, try to
/// reduce the distance between that block and the one before it—if
/// there's a block directly before it that can be joined, join them.
/// If not, try to move the selected block closer to the next one in
/// the document structure by lifting it out of its parent or moving it
/// into a parent of the previous block. Will use the view for accurate
/// (bidi-aware) start-of-textblock detection if given.
const joinBackward = (state, dispatch, view) => {
  let $cursor = atBlockStart(state, view);
  if (!$cursor) return false;
  let $cut = findCutBefore($cursor);

  // If there is no node before this, try to lift
  if (!$cut) {
    let range = $cursor.blockRange(),
      target = range && (0, _prosemirrorTransform.liftTarget)(range);
    if (target == null) return false;
    if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView());
    return true;
  }
  let before = $cut.nodeBefore;
  // Apply the joining algorithm
  if (deleteBarrier(state, $cut, dispatch, -1)) return true;

  // If the node below has no content and the node above is
  // selectable, delete the node below and select the one above.
  if ($cursor.parent.content.size == 0 && (textblockAt(before, "end") || _prosemirrorState.NodeSelection.isSelectable(before))) {
    for (let depth = $cursor.depth;; depth--) {
      let delStep = (0, _prosemirrorTransform.replaceStep)(state.doc, $cursor.before(depth), $cursor.after(depth), _prosemirrorModel.Slice.empty);
      if (delStep && delStep.slice.size < delStep.to - delStep.from) {
        if (dispatch) {
          let tr = state.tr.step(delStep);
          tr.setSelection(textblockAt(before, "end") ? _prosemirrorState.Selection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos, -1)), -1) : _prosemirrorState.NodeSelection.create(tr.doc, $cut.pos - before.nodeSize));
          dispatch(tr.scrollIntoView());
        }
        return true;
      }
      if (depth == 1 || $cursor.node(depth - 1).childCount > 1) break;
    }
  }

  // If the node before is an atom, delete it
  if (before.isAtom && $cut.depth == $cursor.depth - 1) {
    if (dispatch) dispatch(state.tr.delete($cut.pos - before.nodeSize, $cut.pos).scrollIntoView());
    return true;
  }
  return false;
};

/// A more limited form of [`joinBackward`](#commands.joinBackward)
/// that only tries to join the current textblock to the one before
/// it, if the cursor is at the start of a textblock.
exports.joinBackward = joinBackward;
const joinTextblockBackward = (state, dispatch, view) => {
  let $cursor = atBlockStart(state, view);
  if (!$cursor) return false;
  let $cut = findCutBefore($cursor);
  return $cut ? joinTextblocksAround(state, $cut, dispatch) : false;
};

/// A more limited form of [`joinForward`](#commands.joinForward)
/// that only tries to join the current textblock to the one after
/// it, if the cursor is at the end of a textblock.
exports.joinTextblockBackward = joinTextblockBackward;
const joinTextblockForward = (state, dispatch, view) => {
  let $cursor = atBlockEnd(state, view);
  if (!$cursor) return false;
  let $cut = findCutAfter($cursor);
  return $cut ? joinTextblocksAround(state, $cut, dispatch) : false;
};
exports.joinTextblockForward = joinTextblockForward;
function joinTextblocksAround(state, $cut, dispatch) {
  let before = $cut.nodeBefore,
    beforeText = before,
    beforePos = $cut.pos - 1;
  for (; !beforeText.isTextblock; beforePos--) {
    if (beforeText.type.spec.isolating) return false;
    let child = beforeText.lastChild;
    if (!child) return false;
    beforeText = child;
  }
  let after = $cut.nodeAfter,
    afterText = after,
    afterPos = $cut.pos + 1;
  for (; !afterText.isTextblock; afterPos++) {
    if (afterText.type.spec.isolating) return false;
    let child = afterText.firstChild;
    if (!child) return false;
    afterText = child;
  }
  let step = (0, _prosemirrorTransform.replaceStep)(state.doc, beforePos, afterPos, _prosemirrorModel.Slice.empty);
  if (!step || step.from != beforePos || step instanceof _prosemirrorTransform.ReplaceStep && step.slice.size >= afterPos - beforePos) return false;
  if (dispatch) {
    let tr = state.tr.step(step);
    tr.setSelection(_prosemirrorState.TextSelection.create(tr.doc, beforePos));
    dispatch(tr.scrollIntoView());
  }
  return true;
}
function textblockAt(node, side, only = false) {
  for (let scan = node; scan; scan = side == "start" ? scan.firstChild : scan.lastChild) {
    if (scan.isTextblock) return true;
    if (only && scan.childCount != 1) return false;
  }
  return false;
}

/// When the selection is empty and at the start of a textblock, select
/// the node before that textblock, if possible. This is intended to be
/// bound to keys like backspace, after
/// [`joinBackward`](#commands.joinBackward) or other deleting
/// commands, as a fall-back behavior when the schema doesn't allow
/// deletion at the selected point.
const selectNodeBackward = (state, dispatch, view) => {
  let {
      $head,
      empty
    } = state.selection,
    $cut = $head;
  if (!empty) return false;
  if ($head.parent.isTextblock) {
    if (view ? !view.endOfTextblock("backward", state) : $head.parentOffset > 0) return false;
    $cut = findCutBefore($head);
  }
  let node = $cut && $cut.nodeBefore;
  if (!node || !_prosemirrorState.NodeSelection.isSelectable(node)) return false;
  if (dispatch) dispatch(state.tr.setSelection(_prosemirrorState.NodeSelection.create(state.doc, $cut.pos - node.nodeSize)).scrollIntoView());
  return true;
};
exports.selectNodeBackward = selectNodeBackward;
function findCutBefore($pos) {
  if (!$pos.parent.type.spec.isolating) for (let i = $pos.depth - 1; i >= 0; i--) {
    if ($pos.index(i) > 0) return $pos.doc.resolve($pos.before(i + 1));
    if ($pos.node(i).type.spec.isolating) break;
  }
  return null;
}
function atBlockEnd(state, view) {
  let {
    $cursor
  } = state.selection;
  if (!$cursor || (view ? !view.endOfTextblock("forward", state) : $cursor.parentOffset < $cursor.parent.content.size)) return null;
  return $cursor;
}

/// If the selection is empty and the cursor is at the end of a
/// textblock, try to reduce or remove the boundary between that block
/// and the one after it, either by joining them or by moving the other
/// block closer to this one in the tree structure. Will use the view
/// for accurate start-of-textblock detection if given.
const joinForward = (state, dispatch, view) => {
  let $cursor = atBlockEnd(state, view);
  if (!$cursor) return false;
  let $cut = findCutAfter($cursor);
  // If there is no node after this, there's nothing to do
  if (!$cut) return false;
  let after = $cut.nodeAfter;
  // Try the joining algorithm
  if (deleteBarrier(state, $cut, dispatch, 1)) return true;

  // If the node above has no content and the node below is
  // selectable, delete the node above and select the one below.
  if ($cursor.parent.content.size == 0 && (textblockAt(after, "start") || _prosemirrorState.NodeSelection.isSelectable(after))) {
    let delStep = (0, _prosemirrorTransform.replaceStep)(state.doc, $cursor.before(), $cursor.after(), _prosemirrorModel.Slice.empty);
    if (delStep && delStep.slice.size < delStep.to - delStep.from) {
      if (dispatch) {
        let tr = state.tr.step(delStep);
        tr.setSelection(textblockAt(after, "start") ? _prosemirrorState.Selection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos)), 1) : _prosemirrorState.NodeSelection.create(tr.doc, tr.mapping.map($cut.pos)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
  }

  // If the next node is an atom, delete it
  if (after.isAtom && $cut.depth == $cursor.depth - 1) {
    if (dispatch) dispatch(state.tr.delete($cut.pos, $cut.pos + after.nodeSize).scrollIntoView());
    return true;
  }
  return false;
};

/// When the selection is empty and at the end of a textblock, select
/// the node coming after that textblock, if possible. This is intended
/// to be bound to keys like delete, after
/// [`joinForward`](#commands.joinForward) and similar deleting
/// commands, to provide a fall-back behavior when the schema doesn't
/// allow deletion at the selected point.
exports.joinForward = joinForward;
const selectNodeForward = (state, dispatch, view) => {
  let {
      $head,
      empty
    } = state.selection,
    $cut = $head;
  if (!empty) return false;
  if ($head.parent.isTextblock) {
    if (view ? !view.endOfTextblock("forward", state) : $head.parentOffset < $head.parent.content.size) return false;
    $cut = findCutAfter($head);
  }
  let node = $cut && $cut.nodeAfter;
  if (!node || !_prosemirrorState.NodeSelection.isSelectable(node)) return false;
  if (dispatch) dispatch(state.tr.setSelection(_prosemirrorState.NodeSelection.create(state.doc, $cut.pos)).scrollIntoView());
  return true;
};
exports.selectNodeForward = selectNodeForward;
function findCutAfter($pos) {
  if (!$pos.parent.type.spec.isolating) for (let i = $pos.depth - 1; i >= 0; i--) {
    let parent = $pos.node(i);
    if ($pos.index(i) + 1 < parent.childCount) return $pos.doc.resolve($pos.after(i + 1));
    if (parent.type.spec.isolating) break;
  }
  return null;
}

/// Join the selected block or, if there is a text selection, the
/// closest ancestor block of the selection that can be joined, with
/// the sibling above it.
const joinUp = (state, dispatch) => {
  let sel = state.selection,
    nodeSel = sel instanceof _prosemirrorState.NodeSelection,
    point;
  if (nodeSel) {
    if (sel.node.isTextblock || !(0, _prosemirrorTransform.canJoin)(state.doc, sel.from)) return false;
    point = sel.from;
  } else {
    point = (0, _prosemirrorTransform.joinPoint)(state.doc, sel.from, -1);
    if (point == null) return false;
  }
  if (dispatch) {
    let tr = state.tr.join(point);
    if (nodeSel) tr.setSelection(_prosemirrorState.NodeSelection.create(tr.doc, point - state.doc.resolve(point).nodeBefore.nodeSize));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/// Join the selected block, or the closest ancestor of the selection
/// that can be joined, with the sibling after it.
exports.joinUp = joinUp;
const joinDown = (state, dispatch) => {
  let sel = state.selection,
    point;
  if (sel instanceof _prosemirrorState.NodeSelection) {
    if (sel.node.isTextblock || !(0, _prosemirrorTransform.canJoin)(state.doc, sel.to)) return false;
    point = sel.to;
  } else {
    point = (0, _prosemirrorTransform.joinPoint)(state.doc, sel.to, 1);
    if (point == null) return false;
  }
  if (dispatch) dispatch(state.tr.join(point).scrollIntoView());
  return true;
};

/// Lift the selected block, or the closest ancestor block of the
/// selection that can be lifted, out of its parent node.
exports.joinDown = joinDown;
const lift = (state, dispatch) => {
  let {
    $from,
    $to
  } = state.selection;
  let range = $from.blockRange($to),
    target = range && (0, _prosemirrorTransform.liftTarget)(range);
  if (target == null) return false;
  if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView());
  return true;
};

/// If the selection is in a node whose type has a truthy
/// [`code`](#model.NodeSpec.code) property in its spec, replace the
/// selection with a newline character.
exports.lift = lift;
const newlineInCode = (state, dispatch) => {
  let {
    $head,
    $anchor
  } = state.selection;
  if (!$head.parent.type.spec.code || !$head.sameParent($anchor)) return false;
  if (dispatch) dispatch(state.tr.insertText("\n").scrollIntoView());
  return true;
};
exports.newlineInCode = newlineInCode;
function defaultBlockAt(match) {
  for (let i = 0; i < match.edgeCount; i++) {
    let {
      type
    } = match.edge(i);
    if (type.isTextblock && !type.hasRequiredAttrs()) return type;
  }
  return null;
}

/// When the selection is in a node with a truthy
/// [`code`](#model.NodeSpec.code) property in its spec, create a
/// default block after the code block, and move the cursor there.
const exitCode = (state, dispatch) => {
  let {
    $head,
    $anchor
  } = state.selection;
  if (!$head.parent.type.spec.code || !$head.sameParent($anchor)) return false;
  let above = $head.node(-1),
    after = $head.indexAfter(-1),
    type = defaultBlockAt(above.contentMatchAt(after));
  if (!type || !above.canReplaceWith(after, after, type)) return false;
  if (dispatch) {
    let pos = $head.after(),
      tr = state.tr.replaceWith(pos, pos, type.createAndFill());
    tr.setSelection(_prosemirrorState.Selection.near(tr.doc.resolve(pos), 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/// If a block node is selected, create an empty paragraph before (if
/// it is its parent's first child) or after it.
exports.exitCode = exitCode;
const createParagraphNear = (state, dispatch) => {
  let sel = state.selection,
    {
      $from,
      $to
    } = sel;
  if (sel instanceof _prosemirrorState.AllSelection || $from.parent.inlineContent || $to.parent.inlineContent) return false;
  let type = defaultBlockAt($to.parent.contentMatchAt($to.indexAfter()));
  if (!type || !type.isTextblock) return false;
  if (dispatch) {
    let side = (!$from.parentOffset && $to.index() < $to.parent.childCount ? $from : $to).pos;
    let tr = state.tr.insert(side, type.createAndFill());
    tr.setSelection(_prosemirrorState.TextSelection.create(tr.doc, side + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/// If the cursor is in an empty textblock that can be lifted, lift the
/// block.
exports.createParagraphNear = createParagraphNear;
const liftEmptyBlock = (state, dispatch) => {
  let {
    $cursor
  } = state.selection;
  if (!$cursor || $cursor.parent.content.size) return false;
  if ($cursor.depth > 1 && $cursor.after() != $cursor.end(-1)) {
    let before = $cursor.before();
    if ((0, _prosemirrorTransform.canSplit)(state.doc, before)) {
      if (dispatch) dispatch(state.tr.split(before).scrollIntoView());
      return true;
    }
  }
  let range = $cursor.blockRange(),
    target = range && (0, _prosemirrorTransform.liftTarget)(range);
  if (target == null) return false;
  if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView());
  return true;
};

/// Create a variant of [`splitBlock`](#commands.splitBlock) that uses
/// a custom function to determine the type of the newly split off block.
exports.liftEmptyBlock = liftEmptyBlock;
function splitBlockAs(splitNode) {
  return (state, dispatch) => {
    let {
      $from,
      $to
    } = state.selection;
    if (state.selection instanceof _prosemirrorState.NodeSelection && state.selection.node.isBlock) {
      if (!$from.parentOffset || !(0, _prosemirrorTransform.canSplit)(state.doc, $from.pos)) return false;
      if (dispatch) dispatch(state.tr.split($from.pos).scrollIntoView());
      return true;
    }
    if (!$from.depth) return false;
    let types = [];
    let splitDepth,
      deflt,
      atEnd = false,
      atStart = false;
    for (let d = $from.depth;; d--) {
      let node = $from.node(d);
      if (node.isBlock) {
        atEnd = $from.end(d) == $from.pos + ($from.depth - d);
        atStart = $from.start(d) == $from.pos - ($from.depth - d);
        deflt = defaultBlockAt($from.node(d - 1).contentMatchAt($from.indexAfter(d - 1)));
        let splitType = splitNode && splitNode($to.parent, atEnd, $from);
        types.unshift(splitType || (atEnd && deflt ? {
          type: deflt
        } : null));
        splitDepth = d;
        break;
      } else {
        if (d == 1) return false;
        types.unshift(null);
      }
    }
    let tr = state.tr;
    if (state.selection instanceof _prosemirrorState.TextSelection || state.selection instanceof _prosemirrorState.AllSelection) tr.deleteSelection();
    let splitPos = tr.mapping.map($from.pos);
    let can = (0, _prosemirrorTransform.canSplit)(tr.doc, splitPos, types.length, types);
    if (!can) {
      types[0] = deflt ? {
        type: deflt
      } : null;
      can = (0, _prosemirrorTransform.canSplit)(tr.doc, splitPos, types.length, types);
    }
    if (!can) return false;
    tr.split(splitPos, types.length, types);
    if (!atEnd && atStart && $from.node(splitDepth).type != deflt) {
      let first = tr.mapping.map($from.before(splitDepth)),
        $first = tr.doc.resolve(first);
      if (deflt && $from.node(splitDepth - 1).canReplaceWith($first.index(), $first.index() + 1, deflt)) tr.setNodeMarkup(tr.mapping.map($from.before(splitDepth)), deflt);
    }
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

/// Split the parent block of the selection. If the selection is a text
/// selection, also delete its content.
const splitBlock = exports.splitBlock = splitBlockAs();

/// Acts like [`splitBlock`](#commands.splitBlock), but without
/// resetting the set of active marks at the cursor.
const splitBlockKeepMarks = (state, dispatch) => {
  return splitBlock(state, dispatch && (tr => {
    let marks = state.storedMarks || state.selection.$to.parentOffset && state.selection.$from.marks();
    if (marks) tr.ensureMarks(marks);
    dispatch(tr);
  }));
};

/// Move the selection to the node wrapping the current selection, if
/// any. (Will not select the document node.)
exports.splitBlockKeepMarks = splitBlockKeepMarks;
const selectParentNode = (state, dispatch) => {
  let {
      $from,
      to
    } = state.selection,
    pos;
  let same = $from.sharedDepth(to);
  if (same == 0) return false;
  pos = $from.before(same);
  if (dispatch) dispatch(state.tr.setSelection(_prosemirrorState.NodeSelection.create(state.doc, pos)));
  return true;
};

/// Select the whole document.
exports.selectParentNode = selectParentNode;
const selectAll = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.setSelection(new _prosemirrorState.AllSelection(state.doc)));
  return true;
};
exports.selectAll = selectAll;
function joinMaybeClear(state, $pos, dispatch) {
  let before = $pos.nodeBefore,
    after = $pos.nodeAfter,
    index = $pos.index();
  if (!before || !after || !before.type.compatibleContent(after.type)) return false;
  if (!before.content.size && $pos.parent.canReplace(index - 1, index)) {
    if (dispatch) dispatch(state.tr.delete($pos.pos - before.nodeSize, $pos.pos).scrollIntoView());
    return true;
  }
  if (!$pos.parent.canReplace(index, index + 1) || !(after.isTextblock || (0, _prosemirrorTransform.canJoin)(state.doc, $pos.pos))) return false;
  if (dispatch) dispatch(state.tr.join($pos.pos).scrollIntoView());
  return true;
}
function deleteBarrier(state, $cut, dispatch, dir) {
  let before = $cut.nodeBefore,
    after = $cut.nodeAfter,
    conn,
    match;
  let isolated = before.type.spec.isolating || after.type.spec.isolating;
  if (!isolated && joinMaybeClear(state, $cut, dispatch)) return true;
  let canDelAfter = !isolated && $cut.parent.canReplace($cut.index(), $cut.index() + 1);
  if (canDelAfter && (conn = (match = before.contentMatchAt(before.childCount)).findWrapping(after.type)) && match.matchType(conn[0] || after.type).validEnd) {
    if (dispatch) {
      let end = $cut.pos + after.nodeSize,
        wrap = _prosemirrorModel.Fragment.empty;
      for (let i = conn.length - 1; i >= 0; i--) wrap = _prosemirrorModel.Fragment.from(conn[i].create(null, wrap));
      wrap = _prosemirrorModel.Fragment.from(before.copy(wrap));
      let tr = state.tr.step(new _prosemirrorTransform.ReplaceAroundStep($cut.pos - 1, end, $cut.pos, end, new _prosemirrorModel.Slice(wrap, 1, 0), conn.length, true));
      let $joinAt = tr.doc.resolve(end + 2 * conn.length);
      if ($joinAt.nodeAfter && $joinAt.nodeAfter.type == before.type && (0, _prosemirrorTransform.canJoin)(tr.doc, $joinAt.pos)) tr.join($joinAt.pos);
      dispatch(tr.scrollIntoView());
    }
    return true;
  }
  let selAfter = after.type.spec.isolating || dir > 0 && isolated ? null : _prosemirrorState.Selection.findFrom($cut, 1);
  let range = selAfter && selAfter.$from.blockRange(selAfter.$to),
    target = range && (0, _prosemirrorTransform.liftTarget)(range);
  if (target != null && target >= $cut.depth) {
    if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView());
    return true;
  }
  if (canDelAfter && textblockAt(after, "start", true) && textblockAt(before, "end")) {
    let at = before,
      wrap = [];
    for (;;) {
      wrap.push(at);
      if (at.isTextblock) break;
      at = at.lastChild;
    }
    let afterText = after,
      afterDepth = 1;
    for (; !afterText.isTextblock; afterText = afterText.firstChild) afterDepth++;
    if (at.canReplace(at.childCount, at.childCount, afterText.content)) {
      if (dispatch) {
        let end = _prosemirrorModel.Fragment.empty;
        for (let i = wrap.length - 1; i >= 0; i--) end = _prosemirrorModel.Fragment.from(wrap[i].copy(end));
        let tr = state.tr.step(new _prosemirrorTransform.ReplaceAroundStep($cut.pos - wrap.length, $cut.pos + after.nodeSize, $cut.pos + afterDepth, $cut.pos + after.nodeSize - afterDepth, new _prosemirrorModel.Slice(end, wrap.length, 0), 0, true));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
  }
  return false;
}
function selectTextblockSide(side) {
  return function (state, dispatch) {
    let sel = state.selection,
      $pos = side < 0 ? sel.$from : sel.$to;
    let depth = $pos.depth;
    while ($pos.node(depth).isInline) {
      if (!depth) return false;
      depth--;
    }
    if (!$pos.node(depth).isTextblock) return false;
    if (dispatch) dispatch(state.tr.setSelection(_prosemirrorState.TextSelection.create(state.doc, side < 0 ? $pos.start(depth) : $pos.end(depth))));
    return true;
  };
}

/// Moves the cursor to the start of current text block.
const selectTextblockStart = exports.selectTextblockStart = selectTextblockSide(-1);

/// Moves the cursor to the end of current text block.
const selectTextblockEnd = exports.selectTextblockEnd = selectTextblockSide(1);

// Parameterized commands

/// Wrap the selection in a node of the given type with the given
/// attributes.
function wrapIn(nodeType, attrs = null) {
  return function (state, dispatch) {
    let {
      $from,
      $to
    } = state.selection;
    let range = $from.blockRange($to),
      wrapping = range && (0, _prosemirrorTransform.findWrapping)(range, nodeType, attrs);
    if (!wrapping) return false;
    if (dispatch) dispatch(state.tr.wrap(range, wrapping).scrollIntoView());
    return true;
  };
}

/// Returns a command that tries to set the selected textblocks to the
/// given node type with the given attributes.
function setBlockType(nodeType, attrs = null) {
  return function (state, dispatch) {
    let applicable = false;
    for (let i = 0; i < state.selection.ranges.length && !applicable; i++) {
      let {
        $from: {
          pos: from
        },
        $to: {
          pos: to
        }
      } = state.selection.ranges[i];
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (applicable) return false;
        if (!node.isTextblock || node.hasMarkup(nodeType, attrs)) return;
        if (node.type == nodeType) {
          applicable = true;
        } else {
          let $pos = state.doc.resolve(pos),
            index = $pos.index();
          applicable = $pos.parent.canReplaceWith(index, index + 1, nodeType);
        }
      });
    }
    if (!applicable) return false;
    if (dispatch) {
      let tr = state.tr;
      for (let i = 0; i < state.selection.ranges.length; i++) {
        let {
          $from: {
            pos: from
          },
          $to: {
            pos: to
          }
        } = state.selection.ranges[i];
        tr.setBlockType(from, to, nodeType, attrs);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
function markApplies(doc, ranges, type, enterAtoms) {
  for (let i = 0; i < ranges.length; i++) {
    let {
      $from,
      $to
    } = ranges[i];
    let can = $from.depth == 0 ? doc.inlineContent && doc.type.allowsMarkType(type) : false;
    doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (can || !enterAtoms && node.isAtom && node.isInline && pos >= $from.pos && pos + node.nodeSize <= $to.pos) return false;
      can = node.inlineContent && node.type.allowsMarkType(type);
    });
    if (can) return true;
  }
  return false;
}
function removeInlineAtoms(ranges) {
  let result = [];
  for (let i = 0; i < ranges.length; i++) {
    let {
      $from,
      $to
    } = ranges[i];
    $from.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.isAtom && node.content.size && node.isInline && pos >= $from.pos && pos + node.nodeSize <= $to.pos) {
        if (pos + 1 > $from.pos) result.push(new _prosemirrorState.SelectionRange($from, $from.doc.resolve(pos + 1)));
        $from = $from.doc.resolve(pos + 1 + node.content.size);
        return false;
      }
    });
    if ($from.pos < $to.pos) result.push(new _prosemirrorState.SelectionRange($from, $to));
  }
  return result;
}

/// Create a command function that toggles the given mark with the
/// given attributes. Will return `false` when the current selection
/// doesn't support that mark. This will remove the mark if any marks
/// of that type exist in the selection, or add it otherwise. If the
/// selection is empty, this applies to the [stored
/// marks](#state.EditorState.storedMarks) instead of a range of the
/// document.
function toggleMark(markType, attrs = null, options) {
  let removeWhenPresent = (options && options.removeWhenPresent) !== false;
  let enterAtoms = (options && options.enterInlineAtoms) !== false;
  let dropSpace = !(options && options.includeWhitespace);
  return function (state, dispatch) {
    let {
      empty,
      $cursor,
      ranges
    } = state.selection;
    if (empty && !$cursor || !markApplies(state.doc, ranges, markType, enterAtoms)) return false;
    if (dispatch) {
      if ($cursor) {
        if (markType.isInSet(state.storedMarks || $cursor.marks())) dispatch(state.tr.removeStoredMark(markType));else dispatch(state.tr.addStoredMark(markType.create(attrs)));
      } else {
        let add,
          tr = state.tr;
        if (!enterAtoms) ranges = removeInlineAtoms(ranges);
        if (removeWhenPresent) {
          add = !ranges.some(r => state.doc.rangeHasMark(r.$from.pos, r.$to.pos, markType));
        } else {
          add = !ranges.every(r => {
            let missing = false;
            tr.doc.nodesBetween(r.$from.pos, r.$to.pos, (node, pos, parent) => {
              if (missing) return false;
              missing = !markType.isInSet(node.marks) && !!parent && parent.type.allowsMarkType(markType) && !(node.isText && /^\s*$/.test(node.textBetween(Math.max(0, r.$from.pos - pos), Math.min(node.nodeSize, r.$to.pos - pos))));
            });
            return !missing;
          });
        }
        for (let i = 0; i < ranges.length; i++) {
          let {
            $from,
            $to
          } = ranges[i];
          if (!add) {
            tr.removeMark($from.pos, $to.pos, markType);
          } else {
            let from = $from.pos,
              to = $to.pos,
              start = $from.nodeAfter,
              end = $to.nodeBefore;
            let spaceStart = dropSpace && start && start.isText ? /^\s*/.exec(start.text)[0].length : 0;
            let spaceEnd = dropSpace && end && end.isText ? /\s*$/.exec(end.text)[0].length : 0;
            if (from + spaceStart < to) {
              from += spaceStart;
              to -= spaceEnd;
            }
            tr.addMark(from, to, markType.create(attrs));
          }
        }
        dispatch(tr.scrollIntoView());
      }
    }
    return true;
  };
}
function wrapDispatchForJoin(dispatch, isJoinable) {
  return tr => {
    if (!tr.isGeneric) return dispatch(tr);
    let ranges = [];
    for (let i = 0; i < tr.mapping.maps.length; i++) {
      let map = tr.mapping.maps[i];
      for (let j = 0; j < ranges.length; j++) ranges[j] = map.map(ranges[j]);
      map.forEach((_s, _e, from, to) => ranges.push(from, to));
    }

    // Figure out which joinable points exist inside those ranges,
    // by checking all node boundaries in their parent nodes.
    let joinable = [];
    for (let i = 0; i < ranges.length; i += 2) {
      let from = ranges[i],
        to = ranges[i + 1];
      let $from = tr.doc.resolve(from),
        depth = $from.sharedDepth(to),
        parent = $from.node(depth);
      for (let index = $from.indexAfter(depth), pos = $from.after(depth + 1); pos <= to; ++index) {
        let after = parent.maybeChild(index);
        if (!after) break;
        if (index && joinable.indexOf(pos) == -1) {
          let before = parent.child(index - 1);
          if (before.type == after.type && isJoinable(before, after)) joinable.push(pos);
        }
        pos += after.nodeSize;
      }
    }
    // Join the joinable points
    joinable.sort((a, b) => a - b);
    for (let i = joinable.length - 1; i >= 0; i--) {
      if ((0, _prosemirrorTransform.canJoin)(tr.doc, joinable[i])) tr.join(joinable[i]);
    }
    dispatch(tr);
  };
}

/// Wrap a command so that, when it produces a transform that causes
/// two joinable nodes to end up next to each other, those are joined.
/// Nodes are considered joinable when they are of the same type and
/// when the `isJoinable` predicate returns true for them or, if an
/// array of strings was passed, if their node type name is in that
/// array.
function autoJoin(command, isJoinable) {
  let canJoin = Array.isArray(isJoinable) ? node => isJoinable.indexOf(node.type.name) > -1 : isJoinable;
  return (state, dispatch, view) => command(state, dispatch && wrapDispatchForJoin(dispatch, canJoin), view);
}

/// Combine a number of command functions into a single function (which
/// calls them one by one until one returns true).
function chainCommands(...commands) {
  return function (state, dispatch, view) {
    for (let i = 0; i < commands.length; i++) if (commands[i](state, dispatch, view)) return true;
    return false;
  };
}
let backspace = chainCommands(deleteSelection, joinBackward, selectNodeBackward);
let del = chainCommands(deleteSelection, joinForward, selectNodeForward);

/// A basic keymap containing bindings not specific to any schema.
/// Binds the following keys (when multiple commands are listed, they
/// are chained with [`chainCommands`](#commands.chainCommands)):
///
/// * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
/// * **Mod-Enter** to `exitCode`
/// * **Backspace** and **Mod-Backspace** to `deleteSelection`, `joinBackward`, `selectNodeBackward`
/// * **Delete** and **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
/// * **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
/// * **Mod-a** to `selectAll`
const pcBaseKeymap = exports.pcBaseKeymap = {
  "Enter": chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock),
  "Mod-Enter": exitCode,
  "Backspace": backspace,
  "Mod-Backspace": backspace,
  "Shift-Backspace": backspace,
  "Delete": del,
  "Mod-Delete": del,
  "Mod-a": selectAll
};

/// A copy of `pcBaseKeymap` that also binds **Ctrl-h** like Backspace,
/// **Ctrl-d** like Delete, **Alt-Backspace** like Ctrl-Backspace, and
/// **Ctrl-Alt-Backspace**, **Alt-Delete**, and **Alt-d** like
/// Ctrl-Delete.
const macBaseKeymap = exports.macBaseKeymap = {
  "Ctrl-h": pcBaseKeymap["Backspace"],
  "Alt-Backspace": pcBaseKeymap["Mod-Backspace"],
  "Ctrl-d": pcBaseKeymap["Delete"],
  "Ctrl-Alt-Backspace": pcBaseKeymap["Mod-Delete"],
  "Alt-Delete": pcBaseKeymap["Mod-Delete"],
  "Alt-d": pcBaseKeymap["Mod-Delete"],
  "Ctrl-a": selectTextblockStart,
  "Ctrl-e": selectTextblockEnd
};
for (let key in pcBaseKeymap) macBaseKeymap[key] = pcBaseKeymap[key];
const mac = typeof navigator != "undefined" ? /Mac|iP(hone|[oa]d)/.test(navigator.platform)
// @ts-ignore
: typeof os != "undefined" && os.platform ? os.platform() == "darwin" : false;

/// Depending on the detected platform, this will hold
/// [`pcBasekeymap`](#commands.pcBaseKeymap) or
/// [`macBaseKeymap`](#commands.macBaseKeymap).
const baseKeymap = exports.baseKeymap = mac ? macBaseKeymap : pcBaseKeymap;
},
"prosemirror-history/src/history.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.closeHistory = closeHistory;
exports.history = history;
exports.isHistoryTransaction = isHistoryTransaction;
exports.redo = void 0;
exports.redoDepth = redoDepth;
exports.undo = exports.redoNoScroll = void 0;
exports.undoDepth = undoDepth;
exports.undoNoScroll = void 0;
var _ropeSequence = _interopRequireDefault(__require("rope-sequence/index.js"));
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var _Branch;
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// ProseMirror's history isn't simply a way to roll back to a previous
// state, because ProseMirror supports applying changes without adding
// them to the history (for example during collaboration).
//
// To this end, each 'Branch' (one for the undo history and one for
// the redo history) keeps an array of 'Items', which can optionally
// hold a step (an actual undoable change), and always hold a position
// map (which is needed to move changes below them to apply to the
// current document).
//
// An item that has both a step and a selection bookmark is the start
// of an 'event' — a group of changes that will be undone or redone at
// once. (It stores only the bookmark, since that way we don't have to
// provide a document until the selection is actually applied, which
// is useful when compressing.)

// Used to schedule history compression
const max_empty_items = 500;
class Branch {
  constructor(items, eventCount) {
    this.items = items;
    this.eventCount = eventCount;
  }

  // Pop the latest event off the branch's history and apply it
  // to a document transform.
  popEvent(state, preserveItems) {
    if (this.eventCount == 0) return null;
    let end = this.items.length;
    for (;; end--) {
      let next = this.items.get(end - 1);
      if (next.selection) {
        --end;
        break;
      }
    }
    let remap, mapFrom;
    if (preserveItems) {
      remap = this.remapping(end, this.items.length);
      mapFrom = remap.maps.length;
    }
    let transform = state.tr;
    let selection, remaining;
    let addAfter = [],
      addBefore = [];
    this.items.forEach((item, i) => {
      if (!item.step) {
        if (!remap) {
          remap = this.remapping(end, i + 1);
          mapFrom = remap.maps.length;
        }
        mapFrom--;
        addBefore.push(item);
        return;
      }
      if (remap) {
        addBefore.push(new Item(item.map));
        let step = item.step.map(remap.slice(mapFrom)),
          map;
        if (step && transform.maybeStep(step).doc) {
          map = transform.mapping.maps[transform.mapping.maps.length - 1];
          addAfter.push(new Item(map, undefined, undefined, addAfter.length + addBefore.length));
        }
        mapFrom--;
        if (map) remap.appendMap(map, mapFrom);
      } else {
        transform.maybeStep(item.step);
      }
      if (item.selection) {
        selection = remap ? item.selection.map(remap.slice(mapFrom)) : item.selection;
        remaining = new Branch(this.items.slice(0, end).append(addBefore.reverse().concat(addAfter)), this.eventCount - 1);
        return false;
      }
    }, this.items.length, 0);
    return {
      remaining: remaining,
      transform,
      selection: selection
    };
  }

  // Create a new branch with the given transform added.
  addTransform(transform, selection, histOptions, preserveItems) {
    let newItems = [],
      eventCount = this.eventCount;
    let oldItems = this.items,
      lastItem = !preserveItems && oldItems.length ? oldItems.get(oldItems.length - 1) : null;
    for (let i = 0; i < transform.steps.length; i++) {
      let step = transform.steps[i].invert(transform.docs[i]);
      let item = new Item(transform.mapping.maps[i], step, selection),
        merged;
      if (merged = lastItem && lastItem.merge(item)) {
        item = merged;
        if (i) newItems.pop();else oldItems = oldItems.slice(0, oldItems.length - 1);
      }
      newItems.push(item);
      if (selection) {
        eventCount++;
        selection = undefined;
      }
      if (!preserveItems) lastItem = item;
    }
    let overflow = eventCount - histOptions.depth;
    if (overflow > DEPTH_OVERFLOW) {
      oldItems = cutOffEvents(oldItems, overflow);
      eventCount -= overflow;
    }
    return new Branch(oldItems.append(newItems), eventCount);
  }
  remapping(from, to) {
    let maps = new _prosemirrorTransform.Mapping();
    this.items.forEach((item, i) => {
      let mirrorPos = item.mirrorOffset != null && i - item.mirrorOffset >= from ? maps.maps.length - item.mirrorOffset : undefined;
      maps.appendMap(item.map, mirrorPos);
    }, from, to);
    return maps;
  }
  addMaps(array) {
    if (this.eventCount == 0) return this;
    return new Branch(this.items.append(array.map(map => new Item(map))), this.eventCount);
  }

  // When the collab module receives remote changes, the history has
  // to know about those, so that it can adjust the steps that were
  // rebased on top of the remote changes, and include the position
  // maps for the remote changes in its array of items.
  rebased(rebasedTransform, rebasedCount) {
    if (!this.eventCount) return this;
    let rebasedItems = [],
      start = Math.max(0, this.items.length - rebasedCount);
    let mapping = rebasedTransform.mapping;
    let newUntil = rebasedTransform.steps.length;
    let eventCount = this.eventCount;
    this.items.forEach(item => {
      if (item.selection) eventCount--;
    }, start);
    let iRebased = rebasedCount;
    this.items.forEach(item => {
      let pos = mapping.getMirror(--iRebased);
      if (pos == null) return;
      newUntil = Math.min(newUntil, pos);
      let map = mapping.maps[pos];
      if (item.step) {
        let step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos]);
        let selection = item.selection && item.selection.map(mapping.slice(iRebased + 1, pos));
        if (selection) eventCount++;
        rebasedItems.push(new Item(map, step, selection));
      } else {
        rebasedItems.push(new Item(map));
      }
    }, start);
    let newMaps = [];
    for (let i = rebasedCount; i < newUntil; i++) newMaps.push(new Item(mapping.maps[i]));
    let items = this.items.slice(0, start).append(newMaps).append(rebasedItems);
    let branch = new Branch(items, eventCount);
    if (branch.emptyItemCount() > max_empty_items) branch = branch.compress(this.items.length - rebasedItems.length);
    return branch;
  }
  emptyItemCount() {
    let count = 0;
    this.items.forEach(item => {
      if (!item.step) count++;
    });
    return count;
  }

  // Compressing a branch means rewriting it to push the air (map-only
  // items) out. During collaboration, these naturally accumulate
  // because each remote change adds one. The `upto` argument is used
  // to ensure that only the items below a given level are compressed,
  // because `rebased` relies on a clean, untouched set of items in
  // order to associate old items with rebased steps.
  compress(upto = this.items.length) {
    let remap = this.remapping(0, upto),
      mapFrom = remap.maps.length;
    let items = [],
      events = 0;
    this.items.forEach((item, i) => {
      if (i >= upto) {
        items.push(item);
        if (item.selection) events++;
      } else if (item.step) {
        let step = item.step.map(remap.slice(mapFrom)),
          map = step && step.getMap();
        mapFrom--;
        if (map) remap.appendMap(map, mapFrom);
        if (step) {
          let selection = item.selection && item.selection.map(remap.slice(mapFrom));
          if (selection) events++;
          let newItem = new Item(map.invert(), step, selection),
            merged,
            last = items.length - 1;
          if (merged = items.length && items[last].merge(newItem)) items[last] = merged;else items.push(newItem);
        }
      } else if (item.map) {
        mapFrom--;
      }
    }, this.items.length, 0);
    return new Branch(_ropeSequence.default.from(items.reverse()), events);
  }
}
_Branch = Branch;
Branch.empty = new _Branch(_ropeSequence.default.empty, 0);
function cutOffEvents(items, n) {
  let cutPoint;
  items.forEach((item, i) => {
    if (item.selection && n-- == 0) {
      cutPoint = i;
      return false;
    }
  });
  return items.slice(cutPoint);
}
class Item {
  constructor(
  // The (forward) step map for this item.
  map,
  // The inverted step
  step,
  // If this is non-null, this item is the start of a group, and
  // this selection is the starting selection for the group (the one
  // that was active before the first step was applied)
  selection,
  // If this item is the inverse of a previous mapping on the stack,
  // this points at the inverse's offset
  mirrorOffset) {
    this.map = map;
    this.step = step;
    this.selection = selection;
    this.mirrorOffset = mirrorOffset;
  }
  merge(other) {
    if (this.step && other.step && !other.selection) {
      let step = other.step.merge(this.step);
      if (step) return new Item(step.getMap().invert(), step, this.selection);
    }
  }
}

// The value of the state field that tracks undo/redo history for that
// state. Will be stored in the plugin state when the history plugin
// is active.
class HistoryState {
  constructor(done, undone, prevRanges, prevTime, prevComposition) {
    this.done = done;
    this.undone = undone;
    this.prevRanges = prevRanges;
    this.prevTime = prevTime;
    this.prevComposition = prevComposition;
  }
}
const DEPTH_OVERFLOW = 20;

// Record a transformation in undo history.
function applyTransaction(history, state, tr, options) {
  let historyTr = tr.getMeta(historyKey),
    rebased;
  if (historyTr) return historyTr.historyState;
  if (tr.getMeta(closeHistoryKey)) history = new HistoryState(history.done, history.undone, null, 0, -1);
  let appended = tr.getMeta("appendedTransaction");
  if (tr.steps.length == 0) {
    return history;
  } else if (appended && appended.getMeta(historyKey)) {
    if (appended.getMeta(historyKey).redo) return new HistoryState(history.done.addTransform(tr, undefined, options, mustPreserveItems(state)), history.undone, rangesFor(tr.mapping.maps), history.prevTime, history.prevComposition);else return new HistoryState(history.done, history.undone.addTransform(tr, undefined, options, mustPreserveItems(state)), null, history.prevTime, history.prevComposition);
  } else if (tr.getMeta("addToHistory") !== false && !(appended && appended.getMeta("addToHistory") === false)) {
    // Group transforms that occur in quick succession into one event.
    let composition = tr.getMeta("composition");
    let newGroup = history.prevTime == 0 || !appended && history.prevComposition != composition && (history.prevTime < (tr.time || 0) - options.newGroupDelay || !isAdjacentTo(tr, history.prevRanges));
    let prevRanges = appended ? mapRanges(history.prevRanges, tr.mapping) : rangesFor(tr.mapping.maps);
    return new HistoryState(history.done.addTransform(tr, newGroup ? state.selection.getBookmark() : undefined, options, mustPreserveItems(state)), Branch.empty, prevRanges, tr.time, composition == null ? history.prevComposition : composition);
  } else if (rebased = tr.getMeta("rebased")) {
    // Used by the collab module to tell the history that some of its
    // content has been rebased.
    return new HistoryState(history.done.rebased(tr, rebased), history.undone.rebased(tr, rebased), mapRanges(history.prevRanges, tr.mapping), history.prevTime, history.prevComposition);
  } else {
    return new HistoryState(history.done.addMaps(tr.mapping.maps), history.undone.addMaps(tr.mapping.maps), mapRanges(history.prevRanges, tr.mapping), history.prevTime, history.prevComposition);
  }
}
function isAdjacentTo(transform, prevRanges) {
  if (!prevRanges) return false;
  if (!transform.docChanged) return true;
  let adjacent = false;
  transform.mapping.maps[0].forEach((start, end) => {
    for (let i = 0; i < prevRanges.length; i += 2) if (start <= prevRanges[i + 1] && end >= prevRanges[i]) adjacent = true;
  });
  return adjacent;
}
function rangesFor(maps) {
  let result = [];
  for (let i = maps.length - 1; i >= 0 && result.length == 0; i--) maps[i].forEach((_from, _to, from, to) => result.push(from, to));
  return result;
}
function mapRanges(ranges, mapping) {
  if (!ranges) return null;
  let result = [];
  for (let i = 0; i < ranges.length; i += 2) {
    let from = mapping.map(ranges[i], 1),
      to = mapping.map(ranges[i + 1], -1);
    if (from <= to) result.push(from, to);
  }
  return result;
}

// Apply the latest event from one branch to the document and shift the event
// onto the other branch.
function histTransaction(history, state, redo) {
  let preserveItems = mustPreserveItems(state);
  let histOptions = historyKey.get(state).spec.config;
  let pop = (redo ? history.undone : history.done).popEvent(state, preserveItems);
  if (!pop) return null;
  let selection = pop.selection.resolve(pop.transform.doc);
  let added = (redo ? history.done : history.undone).addTransform(pop.transform, state.selection.getBookmark(), histOptions, preserveItems);
  let newHist = new HistoryState(redo ? added : pop.remaining, redo ? pop.remaining : added, null, 0, -1);
  return pop.transform.setSelection(selection).setMeta(historyKey, {
    redo,
    historyState: newHist
  });
}
let cachedPreserveItems = false,
  cachedPreserveItemsPlugins = null;
// Check whether any plugin in the given state has a
// `historyPreserveItems` property in its spec, in which case we must
// preserve steps exactly as they came in, so that they can be
// rebased.
function mustPreserveItems(state) {
  let plugins = state.plugins;
  if (cachedPreserveItemsPlugins != plugins) {
    cachedPreserveItems = false;
    cachedPreserveItemsPlugins = plugins;
    for (let i = 0; i < plugins.length; i++) if (plugins[i].spec.historyPreserveItems) {
      cachedPreserveItems = true;
      break;
    }
  }
  return cachedPreserveItems;
}

/// Set a flag on the given transaction that will prevent further steps
/// from being appended to an existing history event (so that they
/// require a separate undo command to undo).
function closeHistory(tr) {
  return tr.setMeta(closeHistoryKey, true);
}
const historyKey = new _prosemirrorState.PluginKey("history");
const closeHistoryKey = new _prosemirrorState.PluginKey("closeHistory");
/// Returns a plugin that enables the undo history for an editor. The
/// plugin will track undo and redo stacks, which can be used with the
/// [`undo`](#history.undo) and [`redo`](#history.redo) commands.
///
/// You can set an `"addToHistory"` [metadata
/// property](#state.Transaction.setMeta) of `false` on a transaction
/// to prevent it from being rolled back by undo.
function history(config = {}) {
  config = {
    depth: config.depth || 100,
    newGroupDelay: config.newGroupDelay || 500
  };
  return new _prosemirrorState.Plugin({
    key: historyKey,
    state: {
      init() {
        return new HistoryState(Branch.empty, Branch.empty, null, 0, -1);
      },
      apply(tr, hist, state) {
        return applyTransaction(hist, state, tr, config);
      }
    },
    config,
    props: {
      handleDOMEvents: {
        beforeinput(view, e) {
          let inputType = e.inputType;
          let command = inputType == "historyUndo" ? undo : inputType == "historyRedo" ? redo : null;
          if (!command || !view.editable) return false;
          e.preventDefault();
          return command(view.state, view.dispatch);
        }
      }
    }
  });
}
function buildCommand(redo, scroll) {
  return (state, dispatch) => {
    let hist = historyKey.getState(state);
    if (!hist || (redo ? hist.undone : hist.done).eventCount == 0) return false;
    if (dispatch) {
      let tr = histTransaction(hist, state, redo);
      if (tr) dispatch(scroll ? tr.scrollIntoView() : tr);
    }
    return true;
  };
}

/// A command function that undoes the last change, if any.
const undo = exports.undo = buildCommand(false, true);

/// A command function that redoes the last undone change, if any.
const redo = exports.redo = buildCommand(true, true);

/// A command function that undoes the last change. Don't scroll the
/// selection into view.
const undoNoScroll = exports.undoNoScroll = buildCommand(false, false);

/// A command function that redoes the last undone change. Don't
/// scroll the selection into view.
const redoNoScroll = exports.redoNoScroll = buildCommand(true, false);

/// The amount of undoable events available in a given state.
function undoDepth(state) {
  let hist = historyKey.getState(state);
  return hist ? hist.done.eventCount : 0;
}

/// The amount of redoable events available in a given editor state.
function redoDepth(state) {
  let hist = historyKey.getState(state);
  return hist ? hist.undone.eventCount : 0;
}

/// Returns true if the given transaction was generated by the history
/// plugin.
function isHistoryTransaction(tr) {
  return tr.getMeta(historyKey) != null;
}
},
"prosemirror-inputrules/src/index.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "InputRule", {
  enumerable: true,
  get: function () {
    return _inputrules.InputRule;
  }
});
Object.defineProperty(exports, "closeDoubleQuote", {
  enumerable: true,
  get: function () {
    return _rules.closeDoubleQuote;
  }
});
Object.defineProperty(exports, "closeSingleQuote", {
  enumerable: true,
  get: function () {
    return _rules.closeSingleQuote;
  }
});
Object.defineProperty(exports, "ellipsis", {
  enumerable: true,
  get: function () {
    return _rules.ellipsis;
  }
});
Object.defineProperty(exports, "emDash", {
  enumerable: true,
  get: function () {
    return _rules.emDash;
  }
});
Object.defineProperty(exports, "inputRules", {
  enumerable: true,
  get: function () {
    return _inputrules.inputRules;
  }
});
Object.defineProperty(exports, "openDoubleQuote", {
  enumerable: true,
  get: function () {
    return _rules.openDoubleQuote;
  }
});
Object.defineProperty(exports, "openSingleQuote", {
  enumerable: true,
  get: function () {
    return _rules.openSingleQuote;
  }
});
Object.defineProperty(exports, "smartQuotes", {
  enumerable: true,
  get: function () {
    return _rules.smartQuotes;
  }
});
Object.defineProperty(exports, "textblockTypeInputRule", {
  enumerable: true,
  get: function () {
    return _rulebuilders.textblockTypeInputRule;
  }
});
Object.defineProperty(exports, "undoInputRule", {
  enumerable: true,
  get: function () {
    return _inputrules.undoInputRule;
  }
});
Object.defineProperty(exports, "wrappingInputRule", {
  enumerable: true,
  get: function () {
    return _rulebuilders.wrappingInputRule;
  }
});
var _inputrules = __require("prosemirror-inputrules/src/inputrules.ts");
var _rules = __require("prosemirror-inputrules/src/rules.ts");
var _rulebuilders = __require("prosemirror-inputrules/src/rulebuilders.ts");
},
"prosemirror-inputrules/src/inputrules.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InputRule = void 0;
exports.inputRules = inputRules;
exports.undoInputRule = void 0;
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
/// Input rules are regular expressions describing a piece of text
/// that, when typed, causes something to happen. This might be
/// changing two dashes into an emdash, wrapping a paragraph starting
/// with `"> "` into a blockquote, or something entirely different.
class InputRule {
  /// Create an input rule. The rule applies when the user typed
  /// something and the text directly in front of the cursor matches
  /// `match`, which should end with `$`.
  ///
  /// The `handler` can be a string, in which case the matched text, or
  /// the first matched group in the regexp, is replaced by that
  /// string.
  ///
  /// Or a it can be a function, which will be called with the match
  /// array produced by
  /// [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
  /// as well as the start and end of the matched range, and which can
  /// return a [transaction](#state.Transaction) that describes the
  /// rule's effect, or null to indicate the input was not handled.
  constructor(
  /// @internal
  match, handler, options = {}) {
    this.match = match;
    /// @internal
    this.handler = void 0;
    /// @internal
    this.undoable = void 0;
    this.inCode = void 0;
    this.inCodeMark = void 0;
    this.match = match;
    this.handler = typeof handler == "string" ? stringHandler(handler) : handler;
    this.undoable = options.undoable !== false;
    this.inCode = options.inCode || false;
    this.inCodeMark = options.inCodeMark !== false;
  }
}
exports.InputRule = InputRule;
function stringHandler(string) {
  return function (state, match, start, end) {
    let insert = string;
    if (match[1]) {
      let offset = match[0].lastIndexOf(match[1]);
      insert += match[0].slice(offset + match[1].length);
      start += offset;
      let cutOff = start - end;
      if (cutOff > 0) {
        insert = match[0].slice(offset - cutOff, offset) + insert;
        start = end;
      }
    }
    return state.tr.insertText(insert, start, end);
  };
}
const MAX_MATCH = 500;
/// Create an input rules plugin. When enabled, it will cause text
/// input that matches any of the given rules to trigger the rule's
/// action.
function inputRules({
  rules
}) {
  let plugin = new _prosemirrorState.Plugin({
    state: {
      init() {
        return null;
      },
      apply(tr, prev) {
        let stored = tr.getMeta(this);
        if (stored) return stored;
        return tr.selectionSet || tr.docChanged ? null : prev;
      }
    },
    props: {
      handleTextInput(view, from, to, text) {
        return run(view, from, to, text, rules, plugin);
      },
      handleDOMEvents: {
        compositionend: view => {
          setTimeout(() => {
            let {
              $cursor
            } = view.state.selection;
            if ($cursor) run(view, $cursor.pos, $cursor.pos, "", rules, plugin);
          });
        }
      }
    },
    isInputRules: true
  });
  return plugin;
}
function run(view, from, to, text, rules, plugin) {
  if (view.composing) return false;
  let state = view.state,
    $from = state.doc.resolve(from);
  let textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - MAX_MATCH), $from.parentOffset, null, "\ufffc") + text;
  for (let i = 0; i < rules.length; i++) {
    let rule = rules[i];
    if (!rule.inCodeMark && $from.marks().some(m => m.type.spec.code)) continue;
    if ($from.parent.type.spec.code) {
      if (!rule.inCode) continue;
    } else if (rule.inCode === "only") {
      continue;
    }
    let match = rule.match.exec(textBefore);
    if (!match || match[0].length < text.length) continue;
    let startPos = from - (match[0].length - text.length);
    if (!rule.inCodeMark) {
      let hasMark = false;
      state.doc.nodesBetween(startPos, $from.pos, node => {
        if (node.isInline && node.marks.some(m => m.type.spec.code)) hasMark = true;
      });
      if (hasMark) continue;
    }
    let tr = rule.handler(state, match, startPos, to);
    if (!tr) continue;
    if (rule.undoable) tr.setMeta(plugin, {
      transform: tr,
      from,
      to,
      text
    });
    view.dispatch(tr);
    return true;
  }
  return false;
}

/// This is a command that will undo an input rule, if applying such a
/// rule was the last thing that the user did.
const undoInputRule = (state, dispatch) => {
  let plugins = state.plugins;
  for (let i = 0; i < plugins.length; i++) {
    let plugin = plugins[i],
      undoable;
    if (plugin.spec.isInputRules && (undoable = plugin.getState(state))) {
      if (dispatch) {
        let tr = state.tr,
          toUndo = undoable.transform;
        for (let j = toUndo.steps.length - 1; j >= 0; j--) tr.step(toUndo.steps[j].invert(toUndo.docs[j]));
        if (undoable.text) {
          let marks = tr.doc.resolve(undoable.from).marks();
          tr.replaceWith(undoable.from, undoable.to, state.schema.text(undoable.text, marks));
        } else {
          tr.delete(undoable.from, undoable.to);
        }
        dispatch(tr);
      }
      return true;
    }
  }
  return false;
};
exports.undoInputRule = undoInputRule;
},
"prosemirror-inputrules/src/rulebuilders.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.textblockTypeInputRule = textblockTypeInputRule;
exports.wrappingInputRule = wrappingInputRule;
var _inputrules = __require("prosemirror-inputrules/src/inputrules.ts");
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
/// Build an input rule for automatically wrapping a textblock when a
/// given string is typed. The `regexp` argument is
/// directly passed through to the `InputRule` constructor. You'll
/// probably want the regexp to start with `^`, so that the pattern can
/// only occur at the start of a textblock.
///
/// `nodeType` is the type of node to wrap in. If it needs attributes,
/// you can either pass them directly, or pass a function that will
/// compute them from the regular expression match.
///
/// By default, if there's a node with the same type above the newly
/// wrapped node, the rule will try to [join](#transform.Transform.join) those
/// two nodes. You can pass a join predicate, which takes a regular
/// expression match and the node before the wrapped node, and can
/// return a boolean to indicate whether a join should happen.
function wrappingInputRule(regexp, nodeType, getAttrs = null, joinPredicate) {
  return new _inputrules.InputRule(regexp, (state, match, start, end) => {
    let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
    let tr = state.tr.delete(start, end);
    let $start = tr.doc.resolve(start),
      range = $start.blockRange(),
      wrapping = range && (0, _prosemirrorTransform.findWrapping)(range, nodeType, attrs);
    if (!wrapping) return null;
    tr.wrap(range, wrapping);
    let before = tr.doc.resolve(start - 1).nodeBefore;
    if (before && before.type == nodeType && (0, _prosemirrorTransform.canJoin)(tr.doc, start - 1) && (!joinPredicate || joinPredicate(match, before))) tr.join(start - 1);
    return tr;
  });
}

/// Build an input rule that changes the type of a textblock when the
/// matched text is typed into it. You'll usually want to start your
/// regexp with `^` to that it is only matched at the start of a
/// textblock. The optional `getAttrs` parameter can be used to compute
/// the new node's attributes, and works the same as in the
/// `wrappingInputRule` function.
function textblockTypeInputRule(regexp, nodeType, getAttrs = null) {
  return new _inputrules.InputRule(regexp, (state, match, start, end) => {
    let $start = state.doc.resolve(start);
    let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
    if (!$start.node(-1).canReplaceWith($start.index(-1), $start.indexAfter(-1), nodeType)) return null;
    return state.tr.delete(start, end).setBlockType(start, start, nodeType, attrs);
  });
}
},
"prosemirror-inputrules/src/rules.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.smartQuotes = exports.openSingleQuote = exports.openDoubleQuote = exports.emDash = exports.ellipsis = exports.closeSingleQuote = exports.closeDoubleQuote = void 0;
var _inputrules = __require("prosemirror-inputrules/src/inputrules.ts");
/// Converts double dashes to an emdash.
const emDash = exports.emDash = new _inputrules.InputRule(/--$/, "—", {
  inCodeMark: false
});
/// Converts three dots to an ellipsis character.
const ellipsis = exports.ellipsis = new _inputrules.InputRule(/\.\.\.$/, "…", {
  inCodeMark: false
});
/// “Smart” opening double quotes.
const openDoubleQuote = exports.openDoubleQuote = new _inputrules.InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, "“", {
  inCodeMark: false
});
/// “Smart” closing double quotes.
const closeDoubleQuote = exports.closeDoubleQuote = new _inputrules.InputRule(/"$/, "”", {
  inCodeMark: false
});
/// “Smart” opening single quotes.
const openSingleQuote = exports.openSingleQuote = new _inputrules.InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "‘", {
  inCodeMark: false
});
/// “Smart” closing single quotes.
const closeSingleQuote = exports.closeSingleQuote = new _inputrules.InputRule(/'$/, "’", {
  inCodeMark: false
});

/// Smart-quote related input rules.
const smartQuotes = exports.smartQuotes = [openDoubleQuote, closeDoubleQuote, openSingleQuote, closeSingleQuote];
},
"prosemirror-keymap/src/keymap.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.keydownHandler = keydownHandler;
exports.keymap = keymap;
var _w3cKeyname = __require("w3c-keyname/index.js");
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
const mac = typeof navigator != "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
const windows = typeof navigator != "undefined" && /Win/.test(navigator.platform);
function normalizeKeyName(name) {
  let parts = name.split(/-(?!$)/),
    result = parts[parts.length - 1];
  if (result == "Space") result = " ";
  let alt, ctrl, shift, meta;
  for (let i = 0; i < parts.length - 1; i++) {
    let mod = parts[i];
    if (/^(cmd|meta|m)$/i.test(mod)) meta = true;else if (/^a(lt)?$/i.test(mod)) alt = true;else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true;else if (/^s(hift)?$/i.test(mod)) shift = true;else if (/^mod$/i.test(mod)) {
      if (mac) meta = true;else ctrl = true;
    } else throw new Error("Unrecognized modifier name: " + mod);
  }
  if (alt) result = "Alt-" + result;
  if (ctrl) result = "Ctrl-" + result;
  if (meta) result = "Meta-" + result;
  if (shift) result = "Shift-" + result;
  return result;
}
function normalize(map) {
  let copy = Object.create(null);
  for (let prop in map) copy[normalizeKeyName(prop)] = map[prop];
  return copy;
}
function modifiers(name, event, shift = true) {
  if (event.altKey) name = "Alt-" + name;
  if (event.ctrlKey) name = "Ctrl-" + name;
  if (event.metaKey) name = "Meta-" + name;
  if (shift && event.shiftKey) name = "Shift-" + name;
  return name;
}

/// Create a keymap plugin for the given set of bindings.
///
/// Bindings should map key names to [command](#commands)-style
/// functions, which will be called with `(EditorState, dispatch,
/// EditorView)` arguments, and should return true when they've handled
/// the key. Note that the view argument isn't part of the command
/// protocol, but can be used as an escape hatch if a binding needs to
/// directly interact with the UI.
///
/// Key names may be strings like `"Shift-Ctrl-Enter"`—a key
/// identifier prefixed with zero or more modifiers. Key identifiers
/// are based on the strings that can appear in
/// [`KeyEvent.key`](https:///developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).
/// Use lowercase letters to refer to letter keys (or uppercase letters
/// if you want shift to be held). You may use `"Space"` as an alias
/// for the `" "` name.
///
/// Modifiers can be given in any order. `Shift-` (or `s-`), `Alt-` (or
/// `a-`), `Ctrl-` (or `c-` or `Control-`) and `Cmd-` (or `m-` or
/// `Meta-`) are recognized. For characters that are created by holding
/// shift, the `Shift-` prefix is implied, and should not be added
/// explicitly.
///
/// You can use `Mod-` as a shorthand for `Cmd-` on Mac and `Ctrl-` on
/// other platforms.
///
/// You can add multiple keymap plugins to an editor. The order in
/// which they appear determines their precedence (the ones early in
/// the array get to dispatch first).
function keymap(bindings) {
  return new _prosemirrorState.Plugin({
    props: {
      handleKeyDown: keydownHandler(bindings)
    }
  });
}

/// Given a set of bindings (using the same format as
/// [`keymap`](#keymap.keymap)), return a [keydown
/// handler](#view.EditorProps.handleKeyDown) that handles them.
function keydownHandler(bindings) {
  let map = normalize(bindings);
  return function (view, event) {
    let name = (0, _w3cKeyname.keyName)(event),
      baseName,
      direct = map[modifiers(name, event)];
    if (direct && direct(view.state, view.dispatch, view)) return true;
    // A character key
    if (name.length == 1 && name != " ") {
      if (event.shiftKey) {
        // In case the name was already modified by shift, try looking
        // it up without its shift modifier
        let noShift = map[modifiers(name, event, false)];
        if (noShift && noShift(view.state, view.dispatch, view)) return true;
      }
      if ((event.altKey || event.metaKey || event.ctrlKey) &&
      // Ctrl-Alt may be used for AltGr on Windows
      !(windows && event.ctrlKey && event.altKey) && (baseName = _w3cKeyname.base[event.keyCode]) && baseName != name) {
        // Try falling back to the keyCode when there's a modifier
        // active or the character produced isn't ASCII, and our table
        // produces a different name from the the keyCode. See #668,
        // #1060, #1529.
        let fromCode = map[modifiers(baseName, event)];
        if (fromCode && fromCode(view.state, view.dispatch, view)) return true;
      }
    }
    return false;
  };
}
},
"prosemirror-markdown/src/to_markdown.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultMarkdownSerializer = exports.MarkdownSerializerState = exports.MarkdownSerializer = void 0;
const blankMark = {
  open: "",
  close: "",
  mixable: true
};

/// A specification for serializing a ProseMirror document as
/// Markdown/CommonMark text.
class MarkdownSerializer {
  /// Construct a serializer with the given configuration. The `nodes`
  /// object should map node names in a given schema to function that
  /// take a serializer state and such a node, and serialize the node.
  constructor(
  /// The node serializer functions for this serializer.
  nodes,
  /// The mark serializer info.
  marks, options = {}) {
    this.nodes = nodes;
    this.marks = marks;
    this.options = options;
  }

  /// Serialize the content of the given node to
  /// [CommonMark](http://commonmark.org/).
  serialize(content, options = {}) {
    options = Object.assign({}, this.options, options);
    let state = new MarkdownSerializerState(this.nodes, this.marks, options);
    state.renderContent(content);
    return state.out;
  }
}

/// A serializer for the [basic schema](#schema).
exports.MarkdownSerializer = MarkdownSerializer;
const defaultMarkdownSerializer = exports.defaultMarkdownSerializer = new MarkdownSerializer({
  blockquote(state, node) {
    state.wrapBlock("> ", null, node, () => state.renderContent(node));
  },
  code_block(state, node) {
    // Make sure the front matter fences are longer than any dash sequence within it
    const backticks = node.textContent.match(/`{3,}/gm);
    const fence = backticks ? backticks.sort().slice(-1)[0] + "`" : "```";
    state.write(fence + (node.attrs.params || "") + "\n");
    state.text(node.textContent, false);
    // Add a newline to the current content before adding closing marker
    state.write("\n");
    state.write(fence);
    state.closeBlock(node);
  },
  heading(state, node) {
    state.write(state.repeat("#", node.attrs.level) + " ");
    state.renderInline(node, false);
    state.closeBlock(node);
  },
  horizontal_rule(state, node) {
    state.write(node.attrs.markup || "---");
    state.closeBlock(node);
  },
  bullet_list(state, node) {
    state.renderList(node, "  ", () => (node.attrs.bullet || "*") + " ");
  },
  ordered_list(state, node) {
    let start = node.attrs.order || 1;
    let maxW = String(start + node.childCount - 1).length;
    let space = state.repeat(" ", maxW + 2);
    state.renderList(node, space, i => {
      let nStr = String(start + i);
      return state.repeat(" ", maxW - nStr.length) + nStr + ". ";
    });
  },
  list_item(state, node) {
    state.renderContent(node);
  },
  paragraph(state, node) {
    state.renderInline(node);
    state.closeBlock(node);
  },
  image(state, node) {
    state.write("![" + state.esc(node.attrs.alt || "") + "](" + node.attrs.src.replace(/[\(\)]/g, "\\$&") + (node.attrs.title ? ' "' + node.attrs.title.replace(/"/g, '\\"') + '"' : "") + ")");
  },
  hard_break(state, node, parent, index) {
    for (let i = index + 1; i < parent.childCount; i++) if (parent.child(i).type != node.type) {
      state.write("\\\n");
      return;
    }
  },
  text(state, node) {
    state.text(node.text, !state.inAutolink);
  }
}, {
  em: {
    open: "*",
    close: "*",
    mixable: true,
    expelEnclosingWhitespace: true
  },
  strong: {
    open: "**",
    close: "**",
    mixable: true,
    expelEnclosingWhitespace: true
  },
  link: {
    open(state, mark, parent, index) {
      state.inAutolink = isPlainURL(mark, parent, index);
      return state.inAutolink ? "<" : "[";
    },
    close(state, mark, parent, index) {
      let {
        inAutolink
      } = state;
      state.inAutolink = undefined;
      return inAutolink ? ">" : "](" + mark.attrs.href.replace(/[\(\)"]/g, "\\$&") + (mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : "") + ")";
    },
    mixable: true
  },
  code: {
    open(_state, _mark, parent, index) {
      return backticksFor(parent.child(index), -1);
    },
    close(_state, _mark, parent, index) {
      return backticksFor(parent.child(index - 1), 1);
    },
    escape: false
  }
});
function backticksFor(node, side) {
  let ticks = /`+/g,
    m,
    len = 0;
  if (node.isText) while (m = ticks.exec(node.text)) len = Math.max(len, m[0].length);
  let result = len > 0 && side > 0 ? " `" : "`";
  for (let i = 0; i < len; i++) result += "`";
  if (len > 0 && side < 0) result += " ";
  return result;
}
function isPlainURL(link, parent, index) {
  if (link.attrs.title || !/^\w+:/.test(link.attrs.href)) return false;
  let content = parent.child(index);
  if (!content.isText || content.text != link.attrs.href || content.marks[content.marks.length - 1] != link) return false;
  return index == parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks);
}

/// This is an object used to track state and expose
/// methods related to markdown serialization. Instances are passed to
/// node and mark serialization methods (see `toMarkdown`).
class MarkdownSerializerState {
  /// @internal
  constructor(
  /// @internal
  nodes,
  /// @internal
  marks,
  /// The options passed to the serializer.
  options) {
    this.nodes = nodes;
    this.marks = marks;
    this.options = options;
    /// @internal
    this.delim = "";
    /// @internal
    this.out = "";
    /// @internal
    this.closed = null;
    /// @internal
    this.inAutolink = undefined;
    /// @internal
    this.atBlockStart = false;
    /// @internal
    this.inTightList = false;
    if (typeof this.options.tightLists == "undefined") this.options.tightLists = false;
    if (typeof this.options.hardBreakNodeName == "undefined") this.options.hardBreakNodeName = "hard_break";
  }

  /// @internal
  flushClose(size = 2) {
    if (this.closed) {
      if (!this.atBlank()) this.out += "\n";
      if (size > 1) {
        let delimMin = this.delim;
        let trim = /\s+$/.exec(delimMin);
        if (trim) delimMin = delimMin.slice(0, delimMin.length - trim[0].length);
        for (let i = 1; i < size; i++) this.out += delimMin + "\n";
      }
      this.closed = null;
    }
  }

  /// @internal
  getMark(name) {
    let info = this.marks[name];
    if (!info) {
      if (this.options.strict !== false) throw new Error(`Mark type \`${name}\` not supported by Markdown renderer`);
      info = blankMark;
    }
    return info;
  }

  /// Render a block, prefixing each line with `delim`, and the first
  /// line in `firstDelim`. `node` should be the node that is closed at
  /// the end of the block, and `f` is a function that renders the
  /// content of the block.
  wrapBlock(delim, firstDelim, node, f) {
    let old = this.delim;
    this.write(firstDelim != null ? firstDelim : delim);
    this.delim += delim;
    f();
    this.delim = old;
    this.closeBlock(node);
  }

  /// @internal
  atBlank() {
    return /(^|\n)$/.test(this.out);
  }

  /// Ensure the current content ends with a newline.
  ensureNewLine() {
    if (!this.atBlank()) this.out += "\n";
  }

  /// Prepare the state for writing output (closing closed paragraphs,
  /// adding delimiters, and so on), and then optionally add content
  /// (unescaped) to the output.
  write(content) {
    this.flushClose();
    if (this.delim && this.atBlank()) this.out += this.delim;
    if (content) this.out += content;
  }

  /// Close the block for the given node.
  closeBlock(node) {
    this.closed = node;
  }

  /// Add the given text to the document. When escape is not `false`,
  /// it will be escaped.
  text(text, escape = true) {
    let lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      this.write();
      // Escape exclamation marks in front of links
      if (!escape && lines[i][0] == "[" && /(^|[^\\])\!$/.test(this.out)) this.out = this.out.slice(0, this.out.length - 1) + "\\!";
      this.out += escape ? this.esc(lines[i], this.atBlockStart) : lines[i];
      if (i != lines.length - 1) this.out += "\n";
    }
  }

  /// Render the given node as a block.
  render(node, parent, index) {
    if (this.nodes[node.type.name]) {
      this.nodes[node.type.name](this, node, parent, index);
    } else {
      if (this.options.strict !== false) {
        throw new Error("Token type `" + node.type.name + "` not supported by Markdown renderer");
      } else if (!node.type.isLeaf) {
        if (node.type.inlineContent) this.renderInline(node);else this.renderContent(node);
        if (node.isBlock) this.closeBlock(node);
      }
    }
  }

  /// Render the contents of `parent` as block nodes.
  renderContent(parent) {
    parent.forEach((node, _, i) => this.render(node, parent, i));
  }

  /// Render the contents of `parent` as inline content.
  renderInline(parent, fromBlockStart = true) {
    this.atBlockStart = fromBlockStart;
    let active = [],
      trailing = "";
    let progress = (node, offset, index) => {
      var _node;
      let marks = node ? node.marks : [];

      // Remove marks from `hard_break` that are the last node inside
      // that mark to prevent parser edge cases with new lines just
      // before closing marks.
      if (node && node.type.name === this.options.hardBreakNodeName) marks = marks.filter(m => {
        if (index + 1 == parent.childCount) return false;
        let next = parent.child(index + 1);
        return m.isInSet(next.marks) && (!next.isText || /\S/.test(next.text));
      });
      let leading = trailing;
      trailing = "";
      // If whitespace has to be expelled from the node, adjust
      // leading and trailing accordingly.
      if (node && node.isText && marks.some(mark => {
        let info = this.getMark(mark.type.name);
        return info && info.expelEnclosingWhitespace && !mark.isInSet(active);
      })) {
        let [_, lead, rest] = /^(\s*)(.*)$/m.exec(node.text);
        if (lead) {
          leading += lead;
          node = rest ? node.withText(rest) : null;
          if (!node) marks = active;
        }
      }
      if (node && node.isText && marks.some(mark => {
        let info = this.getMark(mark.type.name);
        return info && info.expelEnclosingWhitespace && !this.isMarkAhead(parent, index + 1, mark);
      })) {
        let [_, rest, trail] = /^(.*?)(\s*)$/m.exec(node.text);
        if (trail) {
          trailing = trail;
          node = rest ? node.withText(rest) : null;
          if (!node) marks = active;
        }
      }
      let inner = marks.length ? marks[marks.length - 1] : null;
      let noEsc = inner && this.getMark(inner.type.name).escape === false;
      let len = marks.length - (noEsc ? 1 : 0);

      // Try to reorder 'mixable' marks, such as em and strong, which
      // in Markdown may be opened and closed in different order, so
      // that order of the marks for the token matches the order in
      // active.
      outer: for (let i = 0; i < len; i++) {
        let mark = marks[i];
        if (!this.getMark(mark.type.name).mixable) break;
        for (let j = 0; j < active.length; j++) {
          let other = active[j];
          if (!this.getMark(other.type.name).mixable) break;
          if (mark.eq(other)) {
            if (i > j) marks = marks.slice(0, j).concat(mark).concat(marks.slice(j, i)).concat(marks.slice(i + 1, len));else if (j > i) marks = marks.slice(0, i).concat(marks.slice(i + 1, j)).concat(mark).concat(marks.slice(j, len));
            continue outer;
          }
        }
      }

      // Find the prefix of the mark set that didn't change
      let keep = 0;
      while (keep < Math.min(active.length, len) && marks[keep].eq(active[keep])) ++keep;

      // Close the marks that need to be closed
      while (keep < active.length) this.text(this.markString(active.pop(), false, parent, index), false);

      // Output any previously expelled trailing whitespace outside the marks
      if (leading) this.text(leading);

      // Open the marks that need to be opened
      if (node) {
        while (active.length < len) {
          let add = marks[active.length];
          active.push(add);
          this.text(this.markString(add, true, parent, index), false);
          this.atBlockStart = false;
        }

        // Render the node. Special case code marks, since their content
        // may not be escaped.
        if (noEsc && node.isText) this.text(this.markString(inner, true, parent, index) + node.text + this.markString(inner, false, parent, index + 1), false);else this.render(node, parent, index);
        this.atBlockStart = false;
      }

      // After the first non-empty text node is rendered, the end of output
      // is no longer at block start.
      //
      // FIXME: If a non-text node writes something to the output for this
      // block, the end of output is also no longer at block start. But how
      // can we detect that?
      if ((_node = node) !== null && _node !== void 0 && _node.isText && node.nodeSize > 0) {
        this.atBlockStart = false;
      }
    };
    parent.forEach(progress);
    progress(null, 0, parent.childCount);
    this.atBlockStart = false;
  }

  /// Render a node's content as a list. `delim` should be the extra
  /// indentation added to all lines except the first in an item,
  /// `firstDelim` is a function going from an item index to a
  /// delimiter for the first line of the item.
  renderList(node, delim, firstDelim) {
    if (this.closed && this.closed.type == node.type) this.flushClose(3);else if (this.inTightList) this.flushClose(1);
    let isTight = typeof node.attrs.tight != "undefined" ? node.attrs.tight : this.options.tightLists;
    let prevTight = this.inTightList;
    this.inTightList = isTight;
    node.forEach((child, _, i) => {
      if (i && isTight) this.flushClose(1);
      this.wrapBlock(delim, firstDelim(i), node, () => this.render(child, node, i));
    });
    this.inTightList = prevTight;
  }

  /// Escape the given string so that it can safely appear in Markdown
  /// content. If `startOfLine` is true, also escape characters that
  /// have special meaning only at the start of the line.
  esc(str, startOfLine = false) {
    str = str.replace(/[`*\\~\[\]_]/g, (m, i) => m == "_" && i > 0 && i + 1 < str.length && str[i - 1].match(/\w/) && str[i + 1].match(/\w/) ? m : "\\" + m);
    if (startOfLine) str = str.replace(/^(\+[ ]|[\-*>])/, "\\$&").replace(/^(\s*)(#{1,6})(\s|$)/, '$1\\$2$3').replace(/^(\s*\d+)\.\s/, "$1\\. ");
    if (this.options.escapeExtraCharacters) str = str.replace(this.options.escapeExtraCharacters, "\\$&");
    return str;
  }

  /// @internal
  quote(str) {
    let wrap = str.indexOf('"') == -1 ? '""' : str.indexOf("'") == -1 ? "''" : "()";
    return wrap[0] + str + wrap[1];
  }

  /// Repeat the given string `n` times.
  repeat(str, n) {
    let out = "";
    for (let i = 0; i < n; i++) out += str;
    return out;
  }

  /// Get the markdown string for a given opening or closing mark.
  markString(mark, open, parent, index) {
    let info = this.getMark(mark.type.name);
    let value = open ? info.open : info.close;
    return typeof value == "string" ? value : value(this, mark, parent, index);
  }

  /// Get leading and trailing whitespace from a string. Values of
  /// leading or trailing property of the return object will be undefined
  /// if there is no match.
  getEnclosingWhitespace(text) {
    return {
      leading: (text.match(/^(\s+)/) || [undefined])[0],
      trailing: (text.match(/(\s+)$/) || [undefined])[0]
    };
  }

  /// @internal
  isMarkAhead(parent, index, mark) {
    for (;; index++) {
      if (index >= parent.childCount) return false;
      let next = parent.child(index);
      if (next.type.name != this.options.hardBreakNodeName) return mark.isInSet(next.marks);
      index++;
    }
  }
}
exports.MarkdownSerializerState = MarkdownSerializerState;
},
"prosemirror-model/src/comparedeep.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compareDeep = compareDeep;
function compareDeep(a, b) {
  if (a === b) return true;
  if (!(a && typeof a == "object") || !(b && typeof b == "object")) return false;
  let array = Array.isArray(a);
  if (Array.isArray(b) != array) return false;
  if (array) {
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) if (!compareDeep(a[i], b[i])) return false;
  } else {
    for (let p in a) if (!(p in b) || !compareDeep(a[p], b[p])) return false;
    for (let p in b) if (!(p in a)) return false;
  }
  return true;
}
},
"prosemirror-model/src/content.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ContentMatch = void 0;
var _fragment = __require("prosemirror-model/src/fragment.ts");
var _ContentMatch;
/// Instances of this class represent a match state of a node type's
/// [content expression](#model.NodeSpec.content), and can be used to
/// find out whether further content matches here, and whether a given
/// position is a valid end of the node.
class ContentMatch {
  /// @internal
  constructor(
  /// True when this match state represents a valid end of the node.
  validEnd) {
    this.validEnd = validEnd;
    /// @internal
    this.next = [];
    /// @internal
    this.wrapCache = [];
  }

  /// @internal
  static parse(string, nodeTypes) {
    let stream = new TokenStream(string, nodeTypes);
    if (stream.next == null) return ContentMatch.empty;
    let expr = parseExpr(stream);
    if (stream.next) stream.err("Unexpected trailing text");
    let match = dfa(nfa(expr));
    checkForDeadEnds(match, stream);
    return match;
  }

  /// Match a node type, returning a match after that node if
  /// successful.
  matchType(type) {
    for (let i = 0; i < this.next.length; i++) if (this.next[i].type == type) return this.next[i].next;
    return null;
  }

  /// Try to match a fragment. Returns the resulting match when
  /// successful.
  matchFragment(frag, start = 0, end = frag.childCount) {
    let cur = this;
    for (let i = start; cur && i < end; i++) cur = cur.matchType(frag.child(i).type);
    return cur;
  }

  /// @internal
  get inlineContent() {
    return this.next.length != 0 && this.next[0].type.isInline;
  }

  /// Get the first matching node type at this match position that can
  /// be generated.
  get defaultType() {
    for (let i = 0; i < this.next.length; i++) {
      let {
        type
      } = this.next[i];
      if (!(type.isText || type.hasRequiredAttrs())) return type;
    }
    return null;
  }

  /// @internal
  compatible(other) {
    for (let i = 0; i < this.next.length; i++) for (let j = 0; j < other.next.length; j++) if (this.next[i].type == other.next[j].type) return true;
    return false;
  }

  /// Try to match the given fragment, and if that fails, see if it can
  /// be made to match by inserting nodes in front of it. When
  /// successful, return a fragment of inserted nodes (which may be
  /// empty if nothing had to be inserted). When `toEnd` is true, only
  /// return a fragment if the resulting match goes to the end of the
  /// content expression.
  fillBefore(after, toEnd = false, startIndex = 0) {
    let seen = [this];
    function search(match, types) {
      let finished = match.matchFragment(after, startIndex);
      if (finished && (!toEnd || finished.validEnd)) return _fragment.Fragment.from(types.map(tp => tp.createAndFill()));
      for (let i = 0; i < match.next.length; i++) {
        let {
          type,
          next
        } = match.next[i];
        if (!(type.isText || type.hasRequiredAttrs()) && seen.indexOf(next) == -1) {
          seen.push(next);
          let found = search(next, types.concat(type));
          if (found) return found;
        }
      }
      return null;
    }
    return search(this, []);
  }

  /// Find a set of wrapping node types that would allow a node of the
  /// given type to appear at this position. The result may be empty
  /// (when it fits directly) and will be null when no such wrapping
  /// exists.
  findWrapping(target) {
    for (let i = 0; i < this.wrapCache.length; i += 2) if (this.wrapCache[i] == target) return this.wrapCache[i + 1];
    let computed = this.computeWrapping(target);
    this.wrapCache.push(target, computed);
    return computed;
  }

  /// @internal
  computeWrapping(target) {
    let seen = Object.create(null),
      active = [{
        match: this,
        type: null,
        via: null
      }];
    while (active.length) {
      let current = active.shift(),
        match = current.match;
      if (match.matchType(target)) {
        let result = [];
        for (let obj = current; obj.type; obj = obj.via) result.push(obj.type);
        return result.reverse();
      }
      for (let i = 0; i < match.next.length; i++) {
        let {
          type,
          next
        } = match.next[i];
        if (!type.isLeaf && !type.hasRequiredAttrs() && !(type.name in seen) && (!current.type || next.validEnd)) {
          active.push({
            match: type.contentMatch,
            type,
            via: current
          });
          seen[type.name] = true;
        }
      }
    }
    return null;
  }

  /// The number of outgoing edges this node has in the finite
  /// automaton that describes the content expression.
  get edgeCount() {
    return this.next.length;
  }

  /// Get the _n_​th outgoing edge from this node in the finite
  /// automaton that describes the content expression.
  edge(n) {
    if (n >= this.next.length) throw new RangeError(`There's no ${n}th edge in this content match`);
    return this.next[n];
  }

  /// @internal
  toString() {
    let seen = [];
    function scan(m) {
      seen.push(m);
      for (let i = 0; i < m.next.length; i++) if (seen.indexOf(m.next[i].next) == -1) scan(m.next[i].next);
    }
    scan(this);
    return seen.map((m, i) => {
      let out = i + (m.validEnd ? "*" : " ") + " ";
      for (let i = 0; i < m.next.length; i++) out += (i ? ", " : "") + m.next[i].type.name + "->" + seen.indexOf(m.next[i].next);
      return out;
    }).join("\n");
  }

  /// @internal
}
exports.ContentMatch = ContentMatch;
_ContentMatch = ContentMatch;
ContentMatch.empty = new _ContentMatch(true);
class TokenStream {
  constructor(string, nodeTypes) {
    this.string = string;
    this.nodeTypes = nodeTypes;
    this.inline = null;
    this.pos = 0;
    this.tokens = void 0;
    this.tokens = string.split(/\s*(?=\b|\W|$)/);
    if (this.tokens[this.tokens.length - 1] == "") this.tokens.pop();
    if (this.tokens[0] == "") this.tokens.shift();
  }
  get next() {
    return this.tokens[this.pos];
  }
  eat(tok) {
    return this.next == tok && (this.pos++ || true);
  }
  err(str) {
    throw new SyntaxError(str + " (in content expression '" + this.string + "')");
  }
}
function parseExpr(stream) {
  let exprs = [];
  do {
    exprs.push(parseExprSeq(stream));
  } while (stream.eat("|"));
  return exprs.length == 1 ? exprs[0] : {
    type: "choice",
    exprs
  };
}
function parseExprSeq(stream) {
  let exprs = [];
  do {
    exprs.push(parseExprSubscript(stream));
  } while (stream.next && stream.next != ")" && stream.next != "|");
  return exprs.length == 1 ? exprs[0] : {
    type: "seq",
    exprs
  };
}
function parseExprSubscript(stream) {
  let expr = parseExprAtom(stream);
  for (;;) {
    if (stream.eat("+")) expr = {
      type: "plus",
      expr
    };else if (stream.eat("*")) expr = {
      type: "star",
      expr
    };else if (stream.eat("?")) expr = {
      type: "opt",
      expr
    };else if (stream.eat("{")) expr = parseExprRange(stream, expr);else break;
  }
  return expr;
}
function parseNum(stream) {
  if (/\D/.test(stream.next)) stream.err("Expected number, got '" + stream.next + "'");
  let result = Number(stream.next);
  stream.pos++;
  return result;
}
function parseExprRange(stream, expr) {
  let min = parseNum(stream),
    max = min;
  if (stream.eat(",")) {
    if (stream.next != "}") max = parseNum(stream);else max = -1;
  }
  if (!stream.eat("}")) stream.err("Unclosed braced range");
  return {
    type: "range",
    min,
    max,
    expr
  };
}
function resolveName(stream, name) {
  let types = stream.nodeTypes,
    type = types[name];
  if (type) return [type];
  let result = [];
  for (let typeName in types) {
    let type = types[typeName];
    if (type.isInGroup(name)) result.push(type);
  }
  if (result.length == 0) stream.err("No node type or group '" + name + "' found");
  return result;
}
function parseExprAtom(stream) {
  if (stream.eat("(")) {
    let expr = parseExpr(stream);
    if (!stream.eat(")")) stream.err("Missing closing paren");
    return expr;
  } else if (!/\W/.test(stream.next)) {
    let exprs = resolveName(stream, stream.next).map(type => {
      if (stream.inline == null) stream.inline = type.isInline;else if (stream.inline != type.isInline) stream.err("Mixing inline and block content");
      return {
        type: "name",
        value: type
      };
    });
    stream.pos++;
    return exprs.length == 1 ? exprs[0] : {
      type: "choice",
      exprs
    };
  } else {
    stream.err("Unexpected token '" + stream.next + "'");
  }
}

// The code below helps compile a regular-expression-like language
// into a deterministic finite automaton. For a good introduction to
// these concepts, see https://swtch.com/~rsc/regexp/regexp1.html

// Construct an NFA from an expression as returned by the parser. The
// NFA is represented as an array of states, which are themselves
// arrays of edges, which are `{term, to}` objects. The first state is
// the entry state and the last node is the success state.
//
// Note that unlike typical NFAs, the edge ordering in this one is
// significant, in that it is used to contruct filler content when
// necessary.
function nfa(expr) {
  let nfa = [[]];
  connect(compile(expr, 0), node());
  return nfa;
  function node() {
    return nfa.push([]) - 1;
  }
  function edge(from, to, term) {
    let edge = {
      term,
      to
    };
    nfa[from].push(edge);
    return edge;
  }
  function connect(edges, to) {
    edges.forEach(edge => edge.to = to);
  }
  function compile(expr, from) {
    if (expr.type == "choice") {
      return expr.exprs.reduce((out, expr) => out.concat(compile(expr, from)), []);
    } else if (expr.type == "seq") {
      for (let i = 0;; i++) {
        let next = compile(expr.exprs[i], from);
        if (i == expr.exprs.length - 1) return next;
        connect(next, from = node());
      }
    } else if (expr.type == "star") {
      let loop = node();
      edge(from, loop);
      connect(compile(expr.expr, loop), loop);
      return [edge(loop)];
    } else if (expr.type == "plus") {
      let loop = node();
      connect(compile(expr.expr, from), loop);
      connect(compile(expr.expr, loop), loop);
      return [edge(loop)];
    } else if (expr.type == "opt") {
      return [edge(from)].concat(compile(expr.expr, from));
    } else if (expr.type == "range") {
      let cur = from;
      for (let i = 0; i < expr.min; i++) {
        let next = node();
        connect(compile(expr.expr, cur), next);
        cur = next;
      }
      if (expr.max == -1) {
        connect(compile(expr.expr, cur), cur);
      } else {
        for (let i = expr.min; i < expr.max; i++) {
          let next = node();
          edge(cur, next);
          connect(compile(expr.expr, cur), next);
          cur = next;
        }
      }
      return [edge(cur)];
    } else if (expr.type == "name") {
      return [edge(from, undefined, expr.value)];
    } else {
      throw new Error("Unknown expr type");
    }
  }
}
function cmp(a, b) {
  return b - a;
}

// Get the set of nodes reachable by null edges from `node`. Omit
// nodes with only a single null-out-edge, since they may lead to
// needless duplicated nodes.
function nullFrom(nfa, node) {
  let result = [];
  scan(node);
  return result.sort(cmp);
  function scan(node) {
    let edges = nfa[node];
    if (edges.length == 1 && !edges[0].term) return scan(edges[0].to);
    result.push(node);
    for (let i = 0; i < edges.length; i++) {
      let {
        term,
        to
      } = edges[i];
      if (!term && result.indexOf(to) == -1) scan(to);
    }
  }
}

// Compiles an NFA as produced by `nfa` into a DFA, modeled as a set
// of state objects (`ContentMatch` instances) with transitions
// between them.
function dfa(nfa) {
  let labeled = Object.create(null);
  return explore(nullFrom(nfa, 0));
  function explore(states) {
    let out = [];
    states.forEach(node => {
      nfa[node].forEach(({
        term,
        to
      }) => {
        if (!term) return;
        let set;
        for (let i = 0; i < out.length; i++) if (out[i][0] == term) set = out[i][1];
        nullFrom(nfa, to).forEach(node => {
          if (!set) out.push([term, set = []]);
          if (set.indexOf(node) == -1) set.push(node);
        });
      });
    });
    let state = labeled[states.join(",")] = new ContentMatch(states.indexOf(nfa.length - 1) > -1);
    for (let i = 0; i < out.length; i++) {
      let states = out[i][1].sort(cmp);
      state.next.push({
        type: out[i][0],
        next: labeled[states.join(",")] || explore(states)
      });
    }
    return state;
  }
}
function checkForDeadEnds(match, stream) {
  for (let i = 0, work = [match]; i < work.length; i++) {
    let state = work[i],
      dead = !state.validEnd,
      nodes = [];
    for (let j = 0; j < state.next.length; j++) {
      let {
        type,
        next
      } = state.next[j];
      nodes.push(type.name);
      if (dead && !(type.isText || type.hasRequiredAttrs())) dead = false;
      if (work.indexOf(next) == -1) work.push(next);
    }
    if (dead) stream.err("Only non-generatable nodes (" + nodes.join(", ") + ") in a required position (see https://prosemirror.net/docs/guide/#generatable)");
  }
}
},
"prosemirror-model/src/diff.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findDiffEnd = findDiffEnd;
exports.findDiffStart = findDiffStart;
function findDiffStart(a, b, pos) {
  for (let i = 0;; i++) {
    if (i == a.childCount || i == b.childCount) return a.childCount == b.childCount ? null : pos;
    let childA = a.child(i),
      childB = b.child(i);
    if (childA == childB) {
      pos += childA.nodeSize;
      continue;
    }
    if (!childA.sameMarkup(childB)) return pos;
    if (childA.isText && childA.text != childB.text) {
      for (let j = 0; childA.text[j] == childB.text[j]; j++) pos++;
      return pos;
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffStart(childA.content, childB.content, pos + 1);
      if (inner != null) return inner;
    }
    pos += childA.nodeSize;
  }
}
function findDiffEnd(a, b, posA, posB) {
  for (let iA = a.childCount, iB = b.childCount;;) {
    if (iA == 0 || iB == 0) return iA == iB ? null : {
      a: posA,
      b: posB
    };
    let childA = a.child(--iA),
      childB = b.child(--iB),
      size = childA.nodeSize;
    if (childA == childB) {
      posA -= size;
      posB -= size;
      continue;
    }
    if (!childA.sameMarkup(childB)) return {
      a: posA,
      b: posB
    };
    if (childA.isText && childA.text != childB.text) {
      let same = 0,
        minSize = Math.min(childA.text.length, childB.text.length);
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++;
        posA--;
        posB--;
      }
      return {
        a: posA,
        b: posB
      };
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1);
      if (inner) return inner;
    }
    posA -= size;
    posB -= size;
  }
}
},
"prosemirror-model/src/fragment.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Fragment = void 0;
var _diff = __require("prosemirror-model/src/diff.ts");
var _Fragment;
/// A fragment represents a node's collection of child nodes.
///
/// Like nodes, fragments are persistent data structures, and you
/// should not mutate them or their content. Rather, you create new
/// instances whenever needed. The API tries to make this easy.
class Fragment {
  /// @internal
  constructor(
  /// The child nodes in this fragment.
  content, size) {
    this.content = content;
    /// The size of the fragment, which is the total of the size of
    /// its content nodes.
    this.size = void 0;
    this.size = size || 0;
    if (size == null) for (let i = 0; i < content.length; i++) this.size += content[i].nodeSize;
  }

  /// Invoke a callback for all descendant nodes between the given two
  /// positions (relative to start of this fragment). Doesn't descend
  /// into a node when the callback returns `false`.
  nodesBetween(from, to, f, nodeStart = 0, parent) {
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i],
        end = pos + child.nodeSize;
      if (end > from && f(child, nodeStart + pos, parent || null, i) !== false && child.content.size) {
        let start = pos + 1;
        child.nodesBetween(Math.max(0, from - start), Math.min(child.content.size, to - start), f, nodeStart + start);
      }
      pos = end;
    }
  }

  /// Call the given callback for every descendant node. `pos` will be
  /// relative to the start of the fragment. The callback may return
  /// `false` to prevent traversal of a given node's children.
  descendants(f) {
    this.nodesBetween(0, this.size, f);
  }

  /// Extract the text between `from` and `to`. See the same method on
  /// [`Node`](#model.Node.textBetween).
  textBetween(from, to, blockSeparator, leafText) {
    let text = "",
      first = true;
    this.nodesBetween(from, to, (node, pos) => {
      let nodeText = node.isText ? node.text.slice(Math.max(from, pos) - pos, to - pos) : !node.isLeaf ? "" : leafText ? typeof leafText === "function" ? leafText(node) : leafText : node.type.spec.leafText ? node.type.spec.leafText(node) : "";
      if (node.isBlock && (node.isLeaf && nodeText || node.isTextblock) && blockSeparator) {
        if (first) first = false;else text += blockSeparator;
      }
      text += nodeText;
    }, 0);
    return text;
  }

  /// Create a new fragment containing the combined content of this
  /// fragment and the other.
  append(other) {
    if (!other.size) return this;
    if (!this.size) return other;
    let last = this.lastChild,
      first = other.firstChild,
      content = this.content.slice(),
      i = 0;
    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = last.withText(last.text + first.text);
      i = 1;
    }
    for (; i < other.content.length; i++) content.push(other.content[i]);
    return new Fragment(content, this.size + other.size);
  }

  /// Cut out the sub-fragment between the two given positions.
  cut(from, to = this.size) {
    if (from == 0 && to == this.size) return this;
    let result = [],
      size = 0;
    if (to > from) for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i],
        end = pos + child.nodeSize;
      if (end > from) {
        if (pos < from || end > to) {
          if (child.isText) child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos));else child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1));
        }
        result.push(child);
        size += child.nodeSize;
      }
      pos = end;
    }
    return new Fragment(result, size);
  }

  /// @internal
  cutByIndex(from, to) {
    if (from == to) return Fragment.empty;
    if (from == 0 && to == this.content.length) return this;
    return new Fragment(this.content.slice(from, to));
  }

  /// Create a new fragment in which the node at the given index is
  /// replaced by the given node.
  replaceChild(index, node) {
    let current = this.content[index];
    if (current == node) return this;
    let copy = this.content.slice();
    let size = this.size + node.nodeSize - current.nodeSize;
    copy[index] = node;
    return new Fragment(copy, size);
  }

  /// Create a new fragment by prepending the given node to this
  /// fragment.
  addToStart(node) {
    return new Fragment([node].concat(this.content), this.size + node.nodeSize);
  }

  /// Create a new fragment by appending the given node to this
  /// fragment.
  addToEnd(node) {
    return new Fragment(this.content.concat(node), this.size + node.nodeSize);
  }

  /// Compare this fragment to another one.
  eq(other) {
    if (this.content.length != other.content.length) return false;
    for (let i = 0; i < this.content.length; i++) if (!this.content[i].eq(other.content[i])) return false;
    return true;
  }

  /// The first child of the fragment, or `null` if it is empty.
  get firstChild() {
    return this.content.length ? this.content[0] : null;
  }

  /// The last child of the fragment, or `null` if it is empty.
  get lastChild() {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }

  /// The number of child nodes in this fragment.
  get childCount() {
    return this.content.length;
  }

  /// Get the child node at the given index. Raise an error when the
  /// index is out of range.
  child(index) {
    let found = this.content[index];
    if (!found) throw new RangeError("Index " + index + " out of range for " + this);
    return found;
  }

  /// Get the child node at the given index, if it exists.
  maybeChild(index) {
    return this.content[index] || null;
  }

  /// Call `f` for every child node, passing the node, its offset
  /// into this parent node, and its index.
  forEach(f) {
    for (let i = 0, p = 0; i < this.content.length; i++) {
      let child = this.content[i];
      f(child, p, i);
      p += child.nodeSize;
    }
  }

  /// Find the first position at which this fragment and another
  /// fragment differ, or `null` if they are the same.
  findDiffStart(other, pos = 0) {
    return (0, _diff.findDiffStart)(this, other, pos);
  }

  /// Find the first position, searching from the end, at which this
  /// fragment and the given fragment differ, or `null` if they are
  /// the same. Since this position will not be the same in both
  /// nodes, an object with two separate positions is returned.
  findDiffEnd(other, pos = this.size, otherPos = other.size) {
    return (0, _diff.findDiffEnd)(this, other, pos, otherPos);
  }

  /// Find the index and inner offset corresponding to a given relative
  /// position in this fragment. The result object will be reused
  /// (overwritten) the next time the function is called. @internal
  findIndex(pos) {
    if (pos == 0) return retIndex(0, pos);
    if (pos == this.size) return retIndex(this.content.length, pos);
    if (pos > this.size || pos < 0) throw new RangeError(`Position ${pos} outside of fragment (${this})`);
    for (let i = 0, curPos = 0;; i++) {
      let cur = this.child(i),
        end = curPos + cur.nodeSize;
      if (end >= pos) {
        if (end == pos) return retIndex(i + 1, end);
        return retIndex(i, curPos);
      }
      curPos = end;
    }
  }

  /// Return a debugging string that describes this fragment.
  toString() {
    return "<" + this.toStringInner() + ">";
  }

  /// @internal
  toStringInner() {
    return this.content.join(", ");
  }

  /// Create a JSON-serializeable representation of this fragment.
  toJSON() {
    return this.content.length ? this.content.map(n => n.toJSON()) : null;
  }

  /// Deserialize a fragment from its JSON representation.
  static fromJSON(schema, value) {
    if (!value) return Fragment.empty;
    if (!Array.isArray(value)) throw new RangeError("Invalid input for Fragment.fromJSON");
    return new Fragment(value.map(schema.nodeFromJSON));
  }

  /// Build a fragment from an array of nodes. Ensures that adjacent
  /// text nodes with the same marks are joined together.
  static fromArray(array) {
    if (!array.length) return Fragment.empty;
    let joined,
      size = 0;
    for (let i = 0; i < array.length; i++) {
      let node = array[i];
      size += node.nodeSize;
      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) joined = array.slice(0, i);
        joined[joined.length - 1] = node.withText(joined[joined.length - 1].text + node.text);
      } else if (joined) {
        joined.push(node);
      }
    }
    return new Fragment(joined || array, size);
  }

  /// Create a fragment from something that can be interpreted as a
  /// set of nodes. For `null`, it returns the empty fragment. For a
  /// fragment, the fragment itself. For a node or array of nodes, a
  /// fragment containing those nodes.
  static from(nodes) {
    if (!nodes) return Fragment.empty;
    if (nodes instanceof Fragment) return nodes;
    if (Array.isArray(nodes)) return this.fromArray(nodes);
    if (nodes.attrs) return new Fragment([nodes], nodes.nodeSize);
    throw new RangeError("Can not convert " + nodes + " to a Fragment" + (nodes.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""));
  }

  /// An empty fragment. Intended to be reused whenever a node doesn't
  /// contain anything (rather than allocating a new empty fragment for
  /// each leaf node).
}
exports.Fragment = Fragment;
_Fragment = Fragment;
Fragment.empty = new _Fragment([], 0);
const found = {
  index: 0,
  offset: 0
};
function retIndex(index, offset) {
  found.index = index;
  found.offset = offset;
  return found;
}
},
"prosemirror-model/src/from_dom.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DOMParser = void 0;
var _fragment = __require("prosemirror-model/src/fragment.ts");
var _replace = __require("prosemirror-model/src/replace.ts");
var _mark = __require("prosemirror-model/src/mark.ts");
/// These are the options recognized by the
/// [`parse`](#model.DOMParser.parse) and
/// [`parseSlice`](#model.DOMParser.parseSlice) methods.

/// Fields that may be present in both [tag](#model.TagParseRule) and
/// [style](#model.StyleParseRule) parse rules.

/// Parse rule targeting a DOM element.

/// A parse rule targeting a style property.

/// A value that describes how to parse a given DOM node or inline
/// style as a ProseMirror node or mark.

function isTagRule(rule) {
  return rule.tag != null;
}
function isStyleRule(rule) {
  return rule.style != null;
}

/// A DOM parser represents a strategy for parsing DOM content into a
/// ProseMirror document conforming to a given schema. Its behavior is
/// defined by an array of [rules](#model.ParseRule).
class DOMParser {
  /// Create a parser that targets the given schema, using the given
  /// parsing rules.
  constructor(
  /// The schema into which the parser parses.
  schema,
  /// The set of [parse rules](#model.ParseRule) that the parser
  /// uses, in order of precedence.
  rules) {
    this.schema = schema;
    this.rules = rules;
    /// @internal
    this.tags = [];
    /// @internal
    this.styles = [];
    /// @internal
    this.matchedStyles = void 0;
    /// @internal
    this.normalizeLists = void 0;
    let matchedStyles = this.matchedStyles = [];
    rules.forEach(rule => {
      if (isTagRule(rule)) {
        this.tags.push(rule);
      } else if (isStyleRule(rule)) {
        let prop = /[^=]*/.exec(rule.style)[0];
        if (matchedStyles.indexOf(prop) < 0) matchedStyles.push(prop);
        this.styles.push(rule);
      }
    });

    // Only normalize list elements when lists in the schema can't directly contain themselves
    this.normalizeLists = !this.tags.some(r => {
      if (!/^(ul|ol)\b/.test(r.tag) || !r.node) return false;
      let node = schema.nodes[r.node];
      return node.contentMatch.matchType(node);
    });
  }

  /// Parse a document from the content of a DOM node.
  parse(dom, options = {}) {
    let context = new ParseContext(this, options, false);
    context.addAll(dom, _mark.Mark.none, options.from, options.to);
    return context.finish();
  }

  /// Parses the content of the given DOM node, like
  /// [`parse`](#model.DOMParser.parse), and takes the same set of
  /// options. But unlike that method, which produces a whole node,
  /// this one returns a slice that is open at the sides, meaning that
  /// the schema constraints aren't applied to the start of nodes to
  /// the left of the input and the end of nodes at the end.
  parseSlice(dom, options = {}) {
    let context = new ParseContext(this, options, true);
    context.addAll(dom, _mark.Mark.none, options.from, options.to);
    return _replace.Slice.maxOpen(context.finish());
  }

  /// @internal
  matchTag(dom, context, after) {
    for (let i = after ? this.tags.indexOf(after) + 1 : 0; i < this.tags.length; i++) {
      let rule = this.tags[i];
      if (matches(dom, rule.tag) && (rule.namespace === undefined || dom.namespaceURI == rule.namespace) && (!rule.context || context.matchesContext(rule.context))) {
        if (rule.getAttrs) {
          let result = rule.getAttrs(dom);
          if (result === false) continue;
          rule.attrs = result || undefined;
        }
        return rule;
      }
    }
  }

  /// @internal
  matchStyle(prop, value, context, after) {
    for (let i = after ? this.styles.indexOf(after) + 1 : 0; i < this.styles.length; i++) {
      let rule = this.styles[i],
        style = rule.style;
      if (style.indexOf(prop) != 0 || rule.context && !context.matchesContext(rule.context) ||
      // Test that the style string either precisely matches the prop,
      // or has an '=' sign after the prop, followed by the given
      // value.
      style.length > prop.length && (style.charCodeAt(prop.length) != 61 || style.slice(prop.length + 1) != value)) continue;
      if (rule.getAttrs) {
        let result = rule.getAttrs(value);
        if (result === false) continue;
        rule.attrs = result || undefined;
      }
      return rule;
    }
  }

  /// @internal
  static schemaRules(schema) {
    let result = [];
    function insert(rule) {
      let priority = rule.priority == null ? 50 : rule.priority,
        i = 0;
      for (; i < result.length; i++) {
        let next = result[i],
          nextPriority = next.priority == null ? 50 : next.priority;
        if (nextPriority < priority) break;
      }
      result.splice(i, 0, rule);
    }
    for (let name in schema.marks) {
      let rules = schema.marks[name].spec.parseDOM;
      if (rules) rules.forEach(rule => {
        insert(rule = copy(rule));
        if (!(rule.mark || rule.ignore || rule.clearMark)) rule.mark = name;
      });
    }
    for (let name in schema.nodes) {
      let rules = schema.nodes[name].spec.parseDOM;
      if (rules) rules.forEach(rule => {
        insert(rule = copy(rule));
        if (!(rule.node || rule.ignore || rule.mark)) rule.node = name;
      });
    }
    return result;
  }

  /// Construct a DOM parser using the parsing rules listed in a
  /// schema's [node specs](#model.NodeSpec.parseDOM), reordered by
  /// [priority](#model.GenericParseRule.priority).
  static fromSchema(schema) {
    return schema.cached.domParser || (schema.cached.domParser = new DOMParser(schema, DOMParser.schemaRules(schema)));
  }
}
exports.DOMParser = DOMParser;
const blockTags = {
  address: true,
  article: true,
  aside: true,
  blockquote: true,
  canvas: true,
  dd: true,
  div: true,
  dl: true,
  fieldset: true,
  figcaption: true,
  figure: true,
  footer: true,
  form: true,
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
  header: true,
  hgroup: true,
  hr: true,
  li: true,
  noscript: true,
  ol: true,
  output: true,
  p: true,
  pre: true,
  section: true,
  table: true,
  tfoot: true,
  ul: true
};
const ignoreTags = {
  head: true,
  noscript: true,
  object: true,
  script: true,
  style: true,
  title: true
};
const listTags = {
  ol: true,
  ul: true
};

// Using a bitfield for node context options
const OPT_PRESERVE_WS = 1,
  OPT_PRESERVE_WS_FULL = 2,
  OPT_OPEN_LEFT = 4;
function wsOptionsFor(type, preserveWhitespace, base) {
  if (preserveWhitespace != null) return (preserveWhitespace ? OPT_PRESERVE_WS : 0) | (preserveWhitespace === "full" ? OPT_PRESERVE_WS_FULL : 0);
  return type && type.whitespace == "pre" ? OPT_PRESERVE_WS | OPT_PRESERVE_WS_FULL : base & ~OPT_OPEN_LEFT;
}
class NodeContext {
  constructor(type, attrs, marks, solid, match, options) {
    this.type = type;
    this.attrs = attrs;
    this.marks = marks;
    this.solid = solid;
    this.options = options;
    this.match = void 0;
    this.content = [];
    // Marks applied to the node's children
    this.activeMarks = _mark.Mark.none;
    this.match = match || (options & OPT_OPEN_LEFT ? null : type.contentMatch);
  }
  findWrapping(node) {
    if (!this.match) {
      if (!this.type) return [];
      let fill = this.type.contentMatch.fillBefore(_fragment.Fragment.from(node));
      if (fill) {
        this.match = this.type.contentMatch.matchFragment(fill);
      } else {
        let start = this.type.contentMatch,
          wrap;
        if (wrap = start.findWrapping(node.type)) {
          this.match = start;
          return wrap;
        } else {
          return null;
        }
      }
    }
    return this.match.findWrapping(node.type);
  }
  finish(openEnd) {
    if (!(this.options & OPT_PRESERVE_WS)) {
      // Strip trailing whitespace
      let last = this.content[this.content.length - 1],
        m;
      if (last && last.isText && (m = /[ \t\r\n\u000c]+$/.exec(last.text))) {
        let text = last;
        if (last.text.length == m[0].length) this.content.pop();else this.content[this.content.length - 1] = text.withText(text.text.slice(0, text.text.length - m[0].length));
      }
    }
    let content = _fragment.Fragment.from(this.content);
    if (!openEnd && this.match) content = content.append(this.match.fillBefore(_fragment.Fragment.empty, true));
    return this.type ? this.type.create(this.attrs, content, this.marks) : content;
  }
  inlineContext(node) {
    if (this.type) return this.type.inlineContent;
    if (this.content.length) return this.content[0].isInline;
    return node.parentNode && !blockTags.hasOwnProperty(node.parentNode.nodeName.toLowerCase());
  }
}
class ParseContext {
  constructor(
  // The parser we are using.
  parser,
  // The options passed to this parse.
  options, isOpen) {
    this.parser = parser;
    this.options = options;
    this.isOpen = isOpen;
    this.open = 0;
    this.find = void 0;
    this.needsBlock = void 0;
    this.nodes = void 0;
    this.localPreserveWS = false;
    let topNode = options.topNode,
      topContext;
    let topOptions = wsOptionsFor(null, options.preserveWhitespace, 0) | (isOpen ? OPT_OPEN_LEFT : 0);
    if (topNode) topContext = new NodeContext(topNode.type, topNode.attrs, _mark.Mark.none, true, options.topMatch || topNode.type.contentMatch, topOptions);else if (isOpen) topContext = new NodeContext(null, null, _mark.Mark.none, true, null, topOptions);else topContext = new NodeContext(parser.schema.topNodeType, null, _mark.Mark.none, true, null, topOptions);
    this.nodes = [topContext];
    this.find = options.findPositions;
    this.needsBlock = false;
  }
  get top() {
    return this.nodes[this.open];
  }

  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(dom, marks) {
    if (dom.nodeType == 3) this.addTextNode(dom, marks);else if (dom.nodeType == 1) this.addElement(dom, marks);
  }
  addTextNode(dom, marks) {
    let value = dom.nodeValue;
    let top = this.top,
      preserveWS = top.options & OPT_PRESERVE_WS_FULL ? "full" : this.localPreserveWS || (top.options & OPT_PRESERVE_WS) > 0;
    let {
      schema
    } = this.parser;
    if (preserveWS === "full" || top.inlineContext(dom) || /[^ \t\r\n\u000c]/.test(value)) {
      if (!preserveWS) {
        value = value.replace(/[ \t\r\n\u000c]+/g, " ");
        // If this starts with whitespace, and there is no node before it, or
        // a hard break, or a text node that ends with whitespace, strip the
        // leading space.
        if (/^[ \t\r\n\u000c]/.test(value) && this.open == this.nodes.length - 1) {
          let nodeBefore = top.content[top.content.length - 1];
          let domNodeBefore = dom.previousSibling;
          if (!nodeBefore || domNodeBefore && domNodeBefore.nodeName == 'BR' || nodeBefore.isText && /[ \t\r\n\u000c]$/.test(nodeBefore.text)) value = value.slice(1);
        }
      } else if (preserveWS === "full") {
        value = value.replace(/\r\n?/g, "\n");
      } else if (schema.linebreakReplacement && /[\r\n]/.test(value) && this.top.findWrapping(schema.linebreakReplacement.create())) {
        let lines = value.split(/\r?\n|\r/);
        for (let i = 0; i < lines.length; i++) {
          if (i) this.insertNode(schema.linebreakReplacement.create(), marks, true);
          if (lines[i]) this.insertNode(schema.text(lines[i]), marks, !/\S/.test(lines[i]));
        }
        value = "";
      } else {
        value = value.replace(/\r?\n|\r/g, " ");
      }
      if (value) this.insertNode(schema.text(value), marks, !/\S/.test(value));
      this.findInText(dom);
    } else {
      this.findInside(dom);
    }
  }

  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(dom, marks, matchAfter) {
    let outerWS = this.localPreserveWS,
      top = this.top;
    if (dom.tagName == "PRE" || /pre/.test(dom.style && dom.style.whiteSpace)) this.localPreserveWS = true;
    let name = dom.nodeName.toLowerCase(),
      ruleID;
    if (listTags.hasOwnProperty(name) && this.parser.normalizeLists) normalizeList(dom);
    let rule = this.options.ruleFromNode && this.options.ruleFromNode(dom) || (ruleID = this.parser.matchTag(dom, this, matchAfter));
    out: if (rule ? rule.ignore : ignoreTags.hasOwnProperty(name)) {
      this.findInside(dom);
      this.ignoreFallback(dom, marks);
    } else if (!rule || rule.skip || rule.closeParent) {
      if (rule && rule.closeParent) this.open = Math.max(0, this.open - 1);else if (rule && rule.skip.nodeType) dom = rule.skip;
      let sync,
        oldNeedsBlock = this.needsBlock;
      if (blockTags.hasOwnProperty(name)) {
        if (top.content.length && top.content[0].isInline && this.open) {
          this.open--;
          top = this.top;
        }
        sync = true;
        if (!top.type) this.needsBlock = true;
      } else if (!dom.firstChild) {
        this.leafFallback(dom, marks);
        break out;
      }
      let innerMarks = rule && rule.skip ? marks : this.readStyles(dom, marks);
      if (innerMarks) this.addAll(dom, innerMarks);
      if (sync) this.sync(top);
      this.needsBlock = oldNeedsBlock;
    } else {
      let innerMarks = this.readStyles(dom, marks);
      if (innerMarks) this.addElementByRule(dom, rule, innerMarks, rule.consuming === false ? ruleID : undefined);
    }
    this.localPreserveWS = outerWS;
  }

  // Called for leaf DOM nodes that would otherwise be ignored
  leafFallback(dom, marks) {
    if (dom.nodeName == "BR" && this.top.type && this.top.type.inlineContent) this.addTextNode(dom.ownerDocument.createTextNode("\n"), marks);
  }

  // Called for ignored nodes
  ignoreFallback(dom, marks) {
    // Ignored BR nodes should at least create an inline context
    if (dom.nodeName == "BR" && (!this.top.type || !this.top.type.inlineContent)) this.findPlace(this.parser.schema.text("-"), marks, true);
  }

  // Run any style parser associated with the node's styles. Either
  // return an updated array of marks, or null to indicate some of the
  // styles had a rule with `ignore` set.
  readStyles(dom, marks) {
    let styles = dom.style;
    // Because many properties will only show up in 'normalized' form
    // in `style.item` (i.e. text-decoration becomes
    // text-decoration-line, text-decoration-color, etc), we directly
    // query the styles mentioned in our rules instead of iterating
    // over the items.
    if (styles && styles.length) for (let i = 0; i < this.parser.matchedStyles.length; i++) {
      let name = this.parser.matchedStyles[i],
        value = styles.getPropertyValue(name);
      if (value) for (let after = undefined;;) {
        let rule = this.parser.matchStyle(name, value, this, after);
        if (!rule) break;
        if (rule.ignore) return null;
        if (rule.clearMark) marks = marks.filter(m => !rule.clearMark(m));else marks = marks.concat(this.parser.schema.marks[rule.mark].create(rule.attrs));
        if (rule.consuming === false) after = rule;else break;
      }
    }
    return marks;
  }

  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  addElementByRule(dom, rule, marks, continueAfter) {
    let sync, nodeType;
    if (rule.node) {
      nodeType = this.parser.schema.nodes[rule.node];
      if (!nodeType.isLeaf) {
        let inner = this.enter(nodeType, rule.attrs || null, marks, rule.preserveWhitespace);
        if (inner) {
          sync = true;
          marks = inner;
        }
      } else if (!this.insertNode(nodeType.create(rule.attrs), marks, dom.nodeName == "BR")) {
        this.leafFallback(dom, marks);
      }
    } else {
      let markType = this.parser.schema.marks[rule.mark];
      marks = marks.concat(markType.create(rule.attrs));
    }
    let startIn = this.top;
    if (nodeType && nodeType.isLeaf) {
      this.findInside(dom);
    } else if (continueAfter) {
      this.addElement(dom, marks, continueAfter);
    } else if (rule.getContent) {
      this.findInside(dom);
      rule.getContent(dom, this.parser.schema).forEach(node => this.insertNode(node, marks, false));
    } else {
      let contentDOM = dom;
      if (typeof rule.contentElement == "string") contentDOM = dom.querySelector(rule.contentElement);else if (typeof rule.contentElement == "function") contentDOM = rule.contentElement(dom);else if (rule.contentElement) contentDOM = rule.contentElement;
      this.findAround(dom, contentDOM, true);
      this.addAll(contentDOM, marks);
      this.findAround(dom, contentDOM, false);
    }
    if (sync && this.sync(startIn)) this.open--;
  }

  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(parent, marks, startIndex, endIndex) {
    let index = startIndex || 0;
    for (let dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild, end = endIndex == null ? null : parent.childNodes[endIndex]; dom != end; dom = dom.nextSibling, ++index) {
      this.findAtPoint(parent, index);
      this.addDOM(dom, marks);
    }
    this.findAtPoint(parent, index);
  }

  // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.
  findPlace(node, marks, cautious) {
    let route, sync;
    for (let depth = this.open, penalty = 0; depth >= 0; depth--) {
      let cx = this.nodes[depth];
      let found = cx.findWrapping(node);
      if (found && (!route || route.length > found.length + penalty)) {
        route = found;
        sync = cx;
        if (!found.length) break;
      }
      if (cx.solid) {
        if (cautious) break;
        penalty += 2;
      }
    }
    if (!route) return null;
    this.sync(sync);
    for (let i = 0; i < route.length; i++) marks = this.enterInner(route[i], null, marks, false);
    return marks;
  }

  // Try to insert the given node, adjusting the context when needed.
  insertNode(node, marks, cautious) {
    if (node.isInline && this.needsBlock && !this.top.type) {
      let block = this.textblockFromContext();
      if (block) marks = this.enterInner(block, null, marks);
    }
    let innerMarks = this.findPlace(node, marks, cautious);
    if (innerMarks) {
      this.closeExtra();
      let top = this.top;
      if (top.match) top.match = top.match.matchType(node.type);
      let nodeMarks = _mark.Mark.none;
      for (let m of innerMarks.concat(node.marks)) if (top.type ? top.type.allowsMarkType(m.type) : markMayApply(m.type, node.type)) nodeMarks = m.addToSet(nodeMarks);
      top.content.push(node.mark(nodeMarks));
      return true;
    }
    return false;
  }

  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(type, attrs, marks, preserveWS) {
    let innerMarks = this.findPlace(type.create(attrs), marks, false);
    if (innerMarks) innerMarks = this.enterInner(type, attrs, marks, true, preserveWS);
    return innerMarks;
  }

  // Open a node of the given type
  enterInner(type, attrs, marks, solid = false, preserveWS) {
    this.closeExtra();
    let top = this.top;
    top.match = top.match && top.match.matchType(type);
    let options = wsOptionsFor(type, preserveWS, top.options);
    if (top.options & OPT_OPEN_LEFT && top.content.length == 0) options |= OPT_OPEN_LEFT;
    let applyMarks = _mark.Mark.none;
    marks = marks.filter(m => {
      if (top.type ? top.type.allowsMarkType(m.type) : markMayApply(m.type, type)) {
        applyMarks = m.addToSet(applyMarks);
        return false;
      }
      return true;
    });
    this.nodes.push(new NodeContext(type, attrs, applyMarks, solid, null, options));
    this.open++;
    return marks;
  }

  // Make sure all nodes above this.open are finished and added to
  // their parents
  closeExtra(openEnd = false) {
    let i = this.nodes.length - 1;
    if (i > this.open) {
      for (; i > this.open; i--) this.nodes[i - 1].content.push(this.nodes[i].finish(openEnd));
      this.nodes.length = this.open + 1;
    }
  }
  finish() {
    this.open = 0;
    this.closeExtra(this.isOpen);
    return this.nodes[0].finish(!!(this.isOpen || this.options.topOpen));
  }
  sync(to) {
    for (let i = this.open; i >= 0; i--) {
      if (this.nodes[i] == to) {
        this.open = i;
        return true;
      } else if (this.localPreserveWS) {
        this.nodes[i].options |= OPT_PRESERVE_WS;
      }
    }
    return false;
  }
  get currentPos() {
    this.closeExtra();
    let pos = 0;
    for (let i = this.open; i >= 0; i--) {
      let content = this.nodes[i].content;
      for (let j = content.length - 1; j >= 0; j--) pos += content[j].nodeSize;
      if (i) pos++;
    }
    return pos;
  }
  findAtPoint(parent, offset) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == parent && this.find[i].offset == offset) this.find[i].pos = this.currentPos;
    }
  }
  findInside(parent) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) this.find[i].pos = this.currentPos;
    }
  }
  findAround(parent, content, before) {
    if (parent != content && this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) {
        let pos = content.compareDocumentPosition(this.find[i].node);
        if (pos & (before ? 2 : 4)) this.find[i].pos = this.currentPos;
      }
    }
  }
  findInText(textNode) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == textNode) this.find[i].pos = this.currentPos - (textNode.nodeValue.length - this.find[i].offset);
    }
  }

  // Determines whether the given context string matches this context.
  matchesContext(context) {
    if (context.indexOf("|") > -1) return context.split(/\s*\|\s*/).some(this.matchesContext, this);
    let parts = context.split("/");
    let option = this.options.context;
    let useRoot = !this.isOpen && (!option || option.parent.type == this.nodes[0].type);
    let minDepth = -(option ? option.depth + 1 : 0) + (useRoot ? 0 : 1);
    let match = (i, depth) => {
      for (; i >= 0; i--) {
        let part = parts[i];
        if (part == "") {
          if (i == parts.length - 1 || i == 0) continue;
          for (; depth >= minDepth; depth--) if (match(i - 1, depth)) return true;
          return false;
        } else {
          let next = depth > 0 || depth == 0 && useRoot ? this.nodes[depth].type : option && depth >= minDepth ? option.node(depth - minDepth).type : null;
          if (!next || next.name != part && !next.isInGroup(part)) return false;
          depth--;
        }
      }
      return true;
    };
    return match(parts.length - 1, this.open);
  }
  textblockFromContext() {
    let $context = this.options.context;
    if ($context) for (let d = $context.depth; d >= 0; d--) {
      let deflt = $context.node(d).contentMatchAt($context.indexAfter(d)).defaultType;
      if (deflt && deflt.isTextblock && deflt.defaultAttrs) return deflt;
    }
    for (let name in this.parser.schema.nodes) {
      let type = this.parser.schema.nodes[name];
      if (type.isTextblock && type.defaultAttrs) return type;
    }
  }
}

// Kludge to work around directly nested list nodes produced by some
// tools and allowed by browsers to mean that the nested list is
// actually part of the list item above it.
function normalizeList(dom) {
  for (let child = dom.firstChild, prevItem = null; child; child = child.nextSibling) {
    let name = child.nodeType == 1 ? child.nodeName.toLowerCase() : null;
    if (name && listTags.hasOwnProperty(name) && prevItem) {
      prevItem.appendChild(child);
      child = prevItem;
    } else if (name == "li") {
      prevItem = child;
    } else if (name) {
      prevItem = null;
    }
  }
}

// Apply a CSS selector.
function matches(dom, selector) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector);
}
function copy(obj) {
  let copy = {};
  for (let prop in obj) copy[prop] = obj[prop];
  return copy;
}

// Used when finding a mark at the top level of a fragment parse.
// Checks whether it would be reasonable to apply a given mark type to
// a given node, by looking at the way the mark occurs in the schema.
function markMayApply(markType, nodeType) {
  let nodes = nodeType.schema.nodes;
  for (let name in nodes) {
    let parent = nodes[name];
    if (!parent.allowsMarkType(markType)) continue;
    let seen = [],
      scan = match => {
        seen.push(match);
        for (let i = 0; i < match.edgeCount; i++) {
          let {
            type,
            next
          } = match.edge(i);
          if (type == nodeType) return true;
          if (seen.indexOf(next) < 0 && scan(next)) return true;
        }
      };
    if (scan(parent.contentMatch)) return true;
  }
}
},
"prosemirror-model/src/index.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AttributeSpec", {
  enumerable: true,
  get: function () {
    return _schema.AttributeSpec;
  }
});
Object.defineProperty(exports, "Attrs", {
  enumerable: true,
  get: function () {
    return _schema.Attrs;
  }
});
Object.defineProperty(exports, "ContentMatch", {
  enumerable: true,
  get: function () {
    return _content.ContentMatch;
  }
});
Object.defineProperty(exports, "DOMOutputSpec", {
  enumerable: true,
  get: function () {
    return _to_dom.DOMOutputSpec;
  }
});
Object.defineProperty(exports, "DOMParser", {
  enumerable: true,
  get: function () {
    return _from_dom.DOMParser;
  }
});
Object.defineProperty(exports, "DOMSerializer", {
  enumerable: true,
  get: function () {
    return _to_dom.DOMSerializer;
  }
});
Object.defineProperty(exports, "Fragment", {
  enumerable: true,
  get: function () {
    return _fragment.Fragment;
  }
});
Object.defineProperty(exports, "GenericParseRule", {
  enumerable: true,
  get: function () {
    return _from_dom.GenericParseRule;
  }
});
Object.defineProperty(exports, "Mark", {
  enumerable: true,
  get: function () {
    return _mark.Mark;
  }
});
Object.defineProperty(exports, "MarkSpec", {
  enumerable: true,
  get: function () {
    return _schema.MarkSpec;
  }
});
Object.defineProperty(exports, "MarkType", {
  enumerable: true,
  get: function () {
    return _schema.MarkType;
  }
});
Object.defineProperty(exports, "Node", {
  enumerable: true,
  get: function () {
    return _node.Node;
  }
});
Object.defineProperty(exports, "NodeRange", {
  enumerable: true,
  get: function () {
    return _resolvedpos.NodeRange;
  }
});
Object.defineProperty(exports, "NodeSpec", {
  enumerable: true,
  get: function () {
    return _schema.NodeSpec;
  }
});
Object.defineProperty(exports, "NodeType", {
  enumerable: true,
  get: function () {
    return _schema.NodeType;
  }
});
Object.defineProperty(exports, "ParseOptions", {
  enumerable: true,
  get: function () {
    return _from_dom.ParseOptions;
  }
});
Object.defineProperty(exports, "ParseRule", {
  enumerable: true,
  get: function () {
    return _from_dom.ParseRule;
  }
});
Object.defineProperty(exports, "ReplaceError", {
  enumerable: true,
  get: function () {
    return _replace.ReplaceError;
  }
});
Object.defineProperty(exports, "ResolvedPos", {
  enumerable: true,
  get: function () {
    return _resolvedpos.ResolvedPos;
  }
});
Object.defineProperty(exports, "Schema", {
  enumerable: true,
  get: function () {
    return _schema.Schema;
  }
});
Object.defineProperty(exports, "SchemaSpec", {
  enumerable: true,
  get: function () {
    return _schema.SchemaSpec;
  }
});
Object.defineProperty(exports, "Slice", {
  enumerable: true,
  get: function () {
    return _replace.Slice;
  }
});
Object.defineProperty(exports, "StyleParseRule", {
  enumerable: true,
  get: function () {
    return _from_dom.StyleParseRule;
  }
});
Object.defineProperty(exports, "TagParseRule", {
  enumerable: true,
  get: function () {
    return _from_dom.TagParseRule;
  }
});
var _node = __require("prosemirror-model/src/node.ts");
var _resolvedpos = __require("prosemirror-model/src/resolvedpos.ts");
var _fragment = __require("prosemirror-model/src/fragment.ts");
var _replace = __require("prosemirror-model/src/replace.ts");
var _mark = __require("prosemirror-model/src/mark.ts");
var _schema = __require("prosemirror-model/src/schema.ts");
var _content = __require("prosemirror-model/src/content.ts");
var _from_dom = __require("prosemirror-model/src/from_dom.ts");
var _to_dom = __require("prosemirror-model/src/to_dom.ts");
},
"prosemirror-model/src/mark.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Mark = void 0;
var _comparedeep = __require("prosemirror-model/src/comparedeep.ts");
var _Mark;
/// A mark is a piece of information that can be attached to a node,
/// such as it being emphasized, in code font, or a link. It has a
/// type and optionally a set of attributes that provide further
/// information (such as the target of the link). Marks are created
/// through a `Schema`, which controls which types exist and which
/// attributes they have.
class Mark {
  /// @internal
  constructor(
  /// The type of this mark.
  type,
  /// The attributes associated with this mark.
  attrs) {
    this.type = type;
    this.attrs = attrs;
  }

  /// Given a set of marks, create a new set which contains this one as
  /// well, in the right position. If this mark is already in the set,
  /// the set itself is returned. If any marks that are set to be
  /// [exclusive](#model.MarkSpec.excludes) with this mark are present,
  /// those are replaced by this one.
  addToSet(set) {
    let copy,
      placed = false;
    for (let i = 0; i < set.length; i++) {
      let other = set[i];
      if (this.eq(other)) return set;
      if (this.type.excludes(other.type)) {
        if (!copy) copy = set.slice(0, i);
      } else if (other.type.excludes(this.type)) {
        return set;
      } else {
        if (!placed && other.type.rank > this.type.rank) {
          if (!copy) copy = set.slice(0, i);
          copy.push(this);
          placed = true;
        }
        if (copy) copy.push(other);
      }
    }
    if (!copy) copy = set.slice();
    if (!placed) copy.push(this);
    return copy;
  }

  /// Remove this mark from the given set, returning a new set. If this
  /// mark is not in the set, the set itself is returned.
  removeFromSet(set) {
    for (let i = 0; i < set.length; i++) if (this.eq(set[i])) return set.slice(0, i).concat(set.slice(i + 1));
    return set;
  }

  /// Test whether this mark is in the given set of marks.
  isInSet(set) {
    for (let i = 0; i < set.length; i++) if (this.eq(set[i])) return true;
    return false;
  }

  /// Test whether this mark has the same type and attributes as
  /// another mark.
  eq(other) {
    return this == other || this.type == other.type && (0, _comparedeep.compareDeep)(this.attrs, other.attrs);
  }

  /// Convert this mark to a JSON-serializeable representation.
  toJSON() {
    let obj = {
      type: this.type.name
    };
    for (let _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }
    return obj;
  }

  /// Deserialize a mark from JSON.
  static fromJSON(schema, json) {
    if (!json) throw new RangeError("Invalid input for Mark.fromJSON");
    let type = schema.marks[json.type];
    if (!type) throw new RangeError(`There is no mark type ${json.type} in this schema`);
    let mark = type.create(json.attrs);
    type.checkAttrs(mark.attrs);
    return mark;
  }

  /// Test whether two sets of marks are identical.
  static sameSet(a, b) {
    if (a == b) return true;
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) if (!a[i].eq(b[i])) return false;
    return true;
  }

  /// Create a properly sorted mark set from null, a single mark, or an
  /// unsorted array of marks.
  static setFrom(marks) {
    if (!marks || Array.isArray(marks) && marks.length == 0) return Mark.none;
    if (marks instanceof Mark) return [marks];
    let copy = marks.slice();
    copy.sort((a, b) => a.type.rank - b.type.rank);
    return copy;
  }

  /// The empty set of marks.
}
exports.Mark = Mark;
_Mark = Mark;
Mark.none = [];
},
"prosemirror-model/src/node.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TextNode = exports.Node = void 0;
var _fragment = __require("prosemirror-model/src/fragment.ts");
var _mark = __require("prosemirror-model/src/mark.ts");
var _replace = __require("prosemirror-model/src/replace.ts");
var _resolvedpos = __require("prosemirror-model/src/resolvedpos.ts");
var _comparedeep = __require("prosemirror-model/src/comparedeep.ts");
const emptyAttrs = Object.create(null);

/// This class represents a node in the tree that makes up a
/// ProseMirror document. So a document is an instance of `Node`, with
/// children that are also instances of `Node`.
///
/// Nodes are persistent data structures. Instead of changing them, you
/// create new ones with the content you want. Old ones keep pointing
/// at the old document shape. This is made cheaper by sharing
/// structure between the old and new data as much as possible, which a
/// tree shape like this (without back pointers) makes easy.
///
/// **Do not** directly mutate the properties of a `Node` object. See
/// [the guide](/docs/guide/#doc) for more information.
class Node {
  /// @internal
  constructor(
  /// The type of node that this is.
  type,
  /// An object mapping attribute names to values. The kind of
  /// attributes allowed and required are
  /// [determined](#model.NodeSpec.attrs) by the node type.
  attrs,
  // A fragment holding the node's children.
  content,
  /// The marks (things like whether it is emphasized or part of a
  /// link) applied to this node.
  marks = _mark.Mark.none) {
    this.type = type;
    this.attrs = attrs;
    this.marks = marks;
    /// A container holding the node's children.
    this.content = void 0;
    /// For text nodes, this contains the node's text content.
    this.text = void 0;
    this.content = content || _fragment.Fragment.empty;
  }
  /// The array of this node's child nodes.
  get children() {
    return this.content.content;
  }
  /// The size of this node, as defined by the integer-based [indexing
  /// scheme](/docs/guide/#doc.indexing). For text nodes, this is the
  /// amount of characters. For other leaf nodes, it is one. For
  /// non-leaf nodes, it is the size of the content plus two (the
  /// start and end token).
  get nodeSize() {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }

  /// The number of children that the node has.
  get childCount() {
    return this.content.childCount;
  }

  /// Get the child node at the given index. Raises an error when the
  /// index is out of range.
  child(index) {
    return this.content.child(index);
  }

  /// Get the child node at the given index, if it exists.
  maybeChild(index) {
    return this.content.maybeChild(index);
  }

  /// Call `f` for every child node, passing the node, its offset
  /// into this parent node, and its index.
  forEach(f) {
    this.content.forEach(f);
  }

  /// Invoke a callback for all descendant nodes recursively between
  /// the given two positions that are relative to start of this
  /// node's content. The callback is invoked with the node, its
  /// position relative to the original node (method receiver),
  /// its parent node, and its child index. When the callback returns
  /// false for a given node, that node's children will not be
  /// recursed over. The last parameter can be used to specify a
  /// starting position to count from.
  nodesBetween(from, to, f, startPos = 0) {
    this.content.nodesBetween(from, to, f, startPos, this);
  }

  /// Call the given callback for every descendant node. Doesn't
  /// descend into a node when the callback returns `false`.
  descendants(f) {
    this.nodesBetween(0, this.content.size, f);
  }

  /// Concatenates all the text nodes found in this fragment and its
  /// children.
  get textContent() {
    return this.isLeaf && this.type.spec.leafText ? this.type.spec.leafText(this) : this.textBetween(0, this.content.size, "");
  }

  /// Get all text between positions `from` and `to`. When
  /// `blockSeparator` is given, it will be inserted to separate text
  /// from different block nodes. If `leafText` is given, it'll be
  /// inserted for every non-text leaf node encountered, otherwise
  /// [`leafText`](#model.NodeSpec.leafText) will be used.
  textBetween(from, to, blockSeparator, leafText) {
    return this.content.textBetween(from, to, blockSeparator, leafText);
  }

  /// Returns this node's first child, or `null` if there are no
  /// children.
  get firstChild() {
    return this.content.firstChild;
  }

  /// Returns this node's last child, or `null` if there are no
  /// children.
  get lastChild() {
    return this.content.lastChild;
  }

  /// Test whether two nodes represent the same piece of document.
  eq(other) {
    return this == other || this.sameMarkup(other) && this.content.eq(other.content);
  }

  /// Compare the markup (type, attributes, and marks) of this node to
  /// those of another. Returns `true` if both have the same markup.
  sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks);
  }

  /// Check whether this node's markup correspond to the given type,
  /// attributes, and marks.
  hasMarkup(type, attrs, marks) {
    return this.type == type && (0, _comparedeep.compareDeep)(this.attrs, attrs || type.defaultAttrs || emptyAttrs) && _mark.Mark.sameSet(this.marks, marks || _mark.Mark.none);
  }

  /// Create a new node with the same markup as this node, containing
  /// the given content (or empty, if no content is given).
  copy(content = null) {
    if (content == this.content) return this;
    return new Node(this.type, this.attrs, content, this.marks);
  }

  /// Create a copy of this node, with the given set of marks instead
  /// of the node's own marks.
  mark(marks) {
    return marks == this.marks ? this : new Node(this.type, this.attrs, this.content, marks);
  }

  /// Create a copy of this node with only the content between the
  /// given positions. If `to` is not given, it defaults to the end of
  /// the node.
  cut(from, to = this.content.size) {
    if (from == 0 && to == this.content.size) return this;
    return this.copy(this.content.cut(from, to));
  }

  /// Cut out the part of the document between the given positions, and
  /// return it as a `Slice` object.
  slice(from, to = this.content.size, includeParents = false) {
    if (from == to) return _replace.Slice.empty;
    let $from = this.resolve(from),
      $to = this.resolve(to);
    let depth = includeParents ? 0 : $from.sharedDepth(to);
    let start = $from.start(depth),
      node = $from.node(depth);
    let content = node.content.cut($from.pos - start, $to.pos - start);
    return new _replace.Slice(content, $from.depth - depth, $to.depth - depth);
  }

  /// Replace the part of the document between the given positions with
  /// the given slice. The slice must 'fit', meaning its open sides
  /// must be able to connect to the surrounding content, and its
  /// content nodes must be valid children for the node they are placed
  /// into. If any of this is violated, an error of type
  /// [`ReplaceError`](#model.ReplaceError) is thrown.
  replace(from, to, slice) {
    return (0, _replace.replace)(this.resolve(from), this.resolve(to), slice);
  }

  /// Find the node directly after the given position.
  nodeAt(pos) {
    for (let node = this;;) {
      let {
        index,
        offset
      } = node.content.findIndex(pos);
      node = node.maybeChild(index);
      if (!node) return null;
      if (offset == pos || node.isText) return node;
      pos -= offset + 1;
    }
  }

  /// Find the (direct) child node after the given offset, if any,
  /// and return it along with its index and offset relative to this
  /// node.
  childAfter(pos) {
    let {
      index,
      offset
    } = this.content.findIndex(pos);
    return {
      node: this.content.maybeChild(index),
      index,
      offset
    };
  }

  /// Find the (direct) child node before the given offset, if any,
  /// and return it along with its index and offset relative to this
  /// node.
  childBefore(pos) {
    if (pos == 0) return {
      node: null,
      index: 0,
      offset: 0
    };
    let {
      index,
      offset
    } = this.content.findIndex(pos);
    if (offset < pos) return {
      node: this.content.child(index),
      index,
      offset
    };
    let node = this.content.child(index - 1);
    return {
      node,
      index: index - 1,
      offset: offset - node.nodeSize
    };
  }

  /// Resolve the given position in the document, returning an
  /// [object](#model.ResolvedPos) with information about its context.
  resolve(pos) {
    return _resolvedpos.ResolvedPos.resolveCached(this, pos);
  }

  /// @internal
  resolveNoCache(pos) {
    return _resolvedpos.ResolvedPos.resolve(this, pos);
  }

  /// Test whether a given mark or mark type occurs in this document
  /// between the two given positions.
  rangeHasMark(from, to, type) {
    let found = false;
    if (to > from) this.nodesBetween(from, to, node => {
      if (type.isInSet(node.marks)) found = true;
      return !found;
    });
    return found;
  }

  /// True when this is a block (non-inline node)
  get isBlock() {
    return this.type.isBlock;
  }

  /// True when this is a textblock node, a block node with inline
  /// content.
  get isTextblock() {
    return this.type.isTextblock;
  }

  /// True when this node allows inline content.
  get inlineContent() {
    return this.type.inlineContent;
  }

  /// True when this is an inline node (a text node or a node that can
  /// appear among text).
  get isInline() {
    return this.type.isInline;
  }

  /// True when this is a text node.
  get isText() {
    return this.type.isText;
  }

  /// True when this is a leaf node.
  get isLeaf() {
    return this.type.isLeaf;
  }

  /// True when this is an atom, i.e. when it does not have directly
  /// editable content. This is usually the same as `isLeaf`, but can
  /// be configured with the [`atom` property](#model.NodeSpec.atom)
  /// on a node's spec (typically used when the node is displayed as
  /// an uneditable [node view](#view.NodeView)).
  get isAtom() {
    return this.type.isAtom;
  }

  /// Return a string representation of this node for debugging
  /// purposes.
  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this);
    let name = this.type.name;
    if (this.content.size) name += "(" + this.content.toStringInner() + ")";
    return wrapMarks(this.marks, name);
  }

  /// Get the content match in this node at the given index.
  contentMatchAt(index) {
    let match = this.type.contentMatch.matchFragment(this.content, 0, index);
    if (!match) throw new Error("Called contentMatchAt on a node with invalid content");
    return match;
  }

  /// Test whether replacing the range between `from` and `to` (by
  /// child index) with the given replacement fragment (which defaults
  /// to the empty fragment) would leave the node's content valid. You
  /// can optionally pass `start` and `end` indices into the
  /// replacement fragment.
  canReplace(from, to, replacement = _fragment.Fragment.empty, start = 0, end = replacement.childCount) {
    let one = this.contentMatchAt(from).matchFragment(replacement, start, end);
    let two = one && one.matchFragment(this.content, to);
    if (!two || !two.validEnd) return false;
    for (let i = start; i < end; i++) if (!this.type.allowsMarks(replacement.child(i).marks)) return false;
    return true;
  }

  /// Test whether replacing the range `from` to `to` (by index) with
  /// a node of the given type would leave the node's content valid.
  canReplaceWith(from, to, type, marks) {
    if (marks && !this.type.allowsMarks(marks)) return false;
    let start = this.contentMatchAt(from).matchType(type);
    let end = start && start.matchFragment(this.content, to);
    return end ? end.validEnd : false;
  }

  /// Test whether the given node's content could be appended to this
  /// node. If that node is empty, this will only return true if there
  /// is at least one node type that can appear in both nodes (to avoid
  /// merging completely incompatible nodes).
  canAppend(other) {
    if (other.content.size) return this.canReplace(this.childCount, this.childCount, other.content);else return this.type.compatibleContent(other.type);
  }

  /// Check whether this node and its descendants conform to the
  /// schema, and raise an exception when they do not.
  check() {
    this.type.checkContent(this.content);
    this.type.checkAttrs(this.attrs);
    let copy = _mark.Mark.none;
    for (let i = 0; i < this.marks.length; i++) {
      let mark = this.marks[i];
      mark.type.checkAttrs(mark.attrs);
      copy = mark.addToSet(copy);
    }
    if (!_mark.Mark.sameSet(copy, this.marks)) throw new RangeError(`Invalid collection of marks for node ${this.type.name}: ${this.marks.map(m => m.type.name)}`);
    this.content.forEach(node => node.check());
  }

  /// Return a JSON-serializeable representation of this node.
  toJSON() {
    let obj = {
      type: this.type.name
    };
    for (let _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }
    if (this.content.size) obj.content = this.content.toJSON();
    if (this.marks.length) obj.marks = this.marks.map(n => n.toJSON());
    return obj;
  }

  /// Deserialize a node from its JSON representation.
  static fromJSON(schema, json) {
    if (!json) throw new RangeError("Invalid input for Node.fromJSON");
    let marks = undefined;
    if (json.marks) {
      if (!Array.isArray(json.marks)) throw new RangeError("Invalid mark data for Node.fromJSON");
      marks = json.marks.map(schema.markFromJSON);
    }
    if (json.type == "text") {
      if (typeof json.text != "string") throw new RangeError("Invalid text node in JSON");
      return schema.text(json.text, marks);
    }
    let content = _fragment.Fragment.fromJSON(schema, json.content);
    let node = schema.nodeType(json.type).create(json.attrs, content, marks);
    node.type.checkAttrs(node.attrs);
    return node;
  }
}
exports.Node = Node;
;
Node.prototype.text = undefined;
class TextNode extends Node {
  /// @internal
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks);
    this.text = void 0;
    if (!content) throw new RangeError("Empty text nodes are not allowed");
    this.text = content;
  }
  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this);
    return wrapMarks(this.marks, JSON.stringify(this.text));
  }
  get textContent() {
    return this.text;
  }
  textBetween(from, to) {
    return this.text.slice(from, to);
  }
  get nodeSize() {
    return this.text.length;
  }
  mark(marks) {
    return marks == this.marks ? this : new TextNode(this.type, this.attrs, this.text, marks);
  }
  withText(text) {
    if (text == this.text) return this;
    return new TextNode(this.type, this.attrs, text, this.marks);
  }
  cut(from = 0, to = this.text.length) {
    if (from == 0 && to == this.text.length) return this;
    return this.withText(this.text.slice(from, to));
  }
  eq(other) {
    return this.sameMarkup(other) && this.text == other.text;
  }
  toJSON() {
    let base = super.toJSON();
    base.text = this.text;
    return base;
  }
}
exports.TextNode = TextNode;
function wrapMarks(marks, str) {
  for (let i = marks.length - 1; i >= 0; i--) str = marks[i].type.name + "(" + str + ")";
  return str;
}
},
"prosemirror-model/src/replace.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Slice = exports.ReplaceError = void 0;
exports.replace = replace;
var _fragment = __require("prosemirror-model/src/fragment.ts");
var _Slice;
/// Error type raised by [`Node.replace`](#model.Node.replace) when
/// given an invalid replacement.
class ReplaceError extends Error {}
/*
ReplaceError = function(this: any, message: string) {
  let err = Error.call(this, message)
  ;(err as any).__proto__ = ReplaceError.prototype
  return err
} as any

ReplaceError.prototype = Object.create(Error.prototype)
ReplaceError.prototype.constructor = ReplaceError
ReplaceError.prototype.name = "ReplaceError"
*/

/// A slice represents a piece cut out of a larger document. It
/// stores not only a fragment, but also the depth up to which nodes on
/// both side are ‘open’ (cut through).
exports.ReplaceError = ReplaceError;
class Slice {
  /// Create a slice. When specifying a non-zero open depth, you must
  /// make sure that there are nodes of at least that depth at the
  /// appropriate side of the fragment—i.e. if the fragment is an
  /// empty paragraph node, `openStart` and `openEnd` can't be greater
  /// than 1.
  ///
  /// It is not necessary for the content of open nodes to conform to
  /// the schema's content constraints, though it should be a valid
  /// start/end/middle for such a node, depending on which sides are
  /// open.
  constructor(
  /// The slice's content.
  content,
  /// The open depth at the start of the fragment.
  openStart,
  /// The open depth at the end.
  openEnd) {
    this.content = content;
    this.openStart = openStart;
    this.openEnd = openEnd;
  }

  /// The size this slice would add when inserted into a document.
  get size() {
    return this.content.size - this.openStart - this.openEnd;
  }

  /// @internal
  insertAt(pos, fragment) {
    let content = insertInto(this.content, pos + this.openStart, fragment);
    return content && new Slice(content, this.openStart, this.openEnd);
  }

  /// @internal
  removeBetween(from, to) {
    return new Slice(removeRange(this.content, from + this.openStart, to + this.openStart), this.openStart, this.openEnd);
  }

  /// Tests whether this slice is equal to another slice.
  eq(other) {
    return this.content.eq(other.content) && this.openStart == other.openStart && this.openEnd == other.openEnd;
  }

  /// @internal
  toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")";
  }

  /// Convert a slice to a JSON-serializable representation.
  toJSON() {
    if (!this.content.size) return null;
    let json = {
      content: this.content.toJSON()
    };
    if (this.openStart > 0) json.openStart = this.openStart;
    if (this.openEnd > 0) json.openEnd = this.openEnd;
    return json;
  }

  /// Deserialize a slice from its JSON representation.
  static fromJSON(schema, json) {
    if (!json) return Slice.empty;
    let openStart = json.openStart || 0,
      openEnd = json.openEnd || 0;
    if (typeof openStart != "number" || typeof openEnd != "number") throw new RangeError("Invalid input for Slice.fromJSON");
    return new Slice(_fragment.Fragment.fromJSON(schema, json.content), openStart, openEnd);
  }

  /// Create a slice from a fragment by taking the maximum possible
  /// open value on both side of the fragment.
  static maxOpen(fragment, openIsolating = true) {
    let openStart = 0,
      openEnd = 0;
    for (let n = fragment.firstChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.firstChild) openStart++;
    for (let n = fragment.lastChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.lastChild) openEnd++;
    return new Slice(fragment, openStart, openEnd);
  }

  /// The empty slice.
}
exports.Slice = Slice;
_Slice = Slice;
Slice.empty = new _Slice(_fragment.Fragment.empty, 0, 0);
function removeRange(content, from, to) {
  let {
      index,
      offset
    } = content.findIndex(from),
    child = content.maybeChild(index);
  let {
    index: indexTo,
    offset: offsetTo
  } = content.findIndex(to);
  if (offset == from || child.isText) {
    if (offsetTo != to && !content.child(indexTo).isText) throw new RangeError("Removing non-flat range");
    return content.cut(0, from).append(content.cut(to));
  }
  if (index != indexTo) throw new RangeError("Removing non-flat range");
  return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)));
}
function insertInto(content, dist, insert, parent) {
  let {
      index,
      offset
    } = content.findIndex(dist),
    child = content.maybeChild(index);
  if (offset == dist || child.isText) {
    if (parent && !parent.canReplace(index, index, insert)) return null;
    return content.cut(0, dist).append(insert).append(content.cut(dist));
  }
  let inner = insertInto(child.content, dist - offset - 1, insert, child);
  return inner && content.replaceChild(index, child.copy(inner));
}
function replace($from, $to, slice) {
  if (slice.openStart > $from.depth) throw new ReplaceError("Inserted content deeper than insertion position");
  if ($from.depth - slice.openStart != $to.depth - slice.openEnd) throw new ReplaceError("Inconsistent open depths");
  return replaceOuter($from, $to, slice, 0);
}
function replaceOuter($from, $to, slice, depth) {
  let index = $from.index(depth),
    node = $from.node(depth);
  if (index == $to.index(depth) && depth < $from.depth - slice.openStart) {
    let inner = replaceOuter($from, $to, slice, depth + 1);
    return node.copy(node.content.replaceChild(index, inner));
  } else if (!slice.content.size) {
    return close(node, replaceTwoWay($from, $to, depth));
  } else if (!slice.openStart && !slice.openEnd && $from.depth == depth && $to.depth == depth) {
    // Simple, flat case
    let parent = $from.parent,
      content = parent.content;
    return close(parent, content.cut(0, $from.parentOffset).append(slice.content).append(content.cut($to.parentOffset)));
  } else {
    let {
      start,
      end
    } = prepareSliceForReplace(slice, $from);
    return close(node, replaceThreeWay($from, start, end, $to, depth));
  }
}
function checkJoin(main, sub) {
  if (!sub.type.compatibleContent(main.type)) throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name);
}
function joinable($before, $after, depth) {
  let node = $before.node(depth);
  checkJoin(node, $after.node(depth));
  return node;
}
function addNode(child, target) {
  let last = target.length - 1;
  if (last >= 0 && child.isText && child.sameMarkup(target[last])) target[last] = child.withText(target[last].text + child.text);else target.push(child);
}
function addRange($start, $end, depth, target) {
  let node = ($end || $start).node(depth);
  let startIndex = 0,
    endIndex = $end ? $end.index(depth) : node.childCount;
  if ($start) {
    startIndex = $start.index(depth);
    if ($start.depth > depth) {
      startIndex++;
    } else if ($start.textOffset) {
      addNode($start.nodeAfter, target);
      startIndex++;
    }
  }
  for (let i = startIndex; i < endIndex; i++) addNode(node.child(i), target);
  if ($end && $end.depth == depth && $end.textOffset) addNode($end.nodeBefore, target);
}
function close(node, content) {
  node.type.checkContent(content);
  return node.copy(content);
}
function replaceThreeWay($from, $start, $end, $to, depth) {
  let openStart = $from.depth > depth && joinable($from, $start, depth + 1);
  let openEnd = $to.depth > depth && joinable($end, $to, depth + 1);
  let content = [];
  addRange(null, $from, depth, content);
  if (openStart && openEnd && $start.index(depth) == $end.index(depth)) {
    checkJoin(openStart, openEnd);
    addNode(close(openStart, replaceThreeWay($from, $start, $end, $to, depth + 1)), content);
  } else {
    if (openStart) addNode(close(openStart, replaceTwoWay($from, $start, depth + 1)), content);
    addRange($start, $end, depth, content);
    if (openEnd) addNode(close(openEnd, replaceTwoWay($end, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new _fragment.Fragment(content);
}
function replaceTwoWay($from, $to, depth) {
  let content = [];
  addRange(null, $from, depth, content);
  if ($from.depth > depth) {
    let type = joinable($from, $to, depth + 1);
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new _fragment.Fragment(content);
}
function prepareSliceForReplace(slice, $along) {
  let extra = $along.depth - slice.openStart,
    parent = $along.node(extra);
  let node = parent.copy(slice.content);
  for (let i = extra - 1; i >= 0; i--) node = $along.node(i).copy(_fragment.Fragment.from(node));
  return {
    start: node.resolveNoCache(slice.openStart + extra),
    end: node.resolveNoCache(node.content.size - slice.openEnd - extra)
  };
}
},
"prosemirror-model/src/resolvedpos.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ResolvedPos = exports.NodeRange = void 0;
var _mark = __require("prosemirror-model/src/mark.ts");
/// You can [_resolve_](#model.Node.resolve) a position to get more
/// information about it. Objects of this class represent such a
/// resolved position, providing various pieces of context
/// information, and some helper methods.
///
/// Throughout this interface, methods that take an optional `depth`
/// parameter will interpret undefined as `this.depth` and negative
/// numbers as `this.depth + value`.
class ResolvedPos {
  /// @internal
  constructor(
  /// The position that was resolved.
  pos,
  /// @internal
  path,
  /// The offset this position has into its parent node.
  parentOffset) {
    this.pos = pos;
    this.path = path;
    this.parentOffset = parentOffset;
    /// The number of levels the parent node is from the root. If this
    /// position points directly into the root node, it is 0. If it
    /// points into a top-level paragraph, 1, and so on.
    this.depth = void 0;
    this.depth = path.length / 3 - 1;
  }

  /// @internal
  resolveDepth(val) {
    if (val == null) return this.depth;
    if (val < 0) return this.depth + val;
    return val;
  }

  /// The parent node that the position points into. Note that even if
  /// a position points into a text node, that node is not considered
  /// the parent—text nodes are ‘flat’ in this model, and have no content.
  get parent() {
    return this.node(this.depth);
  }

  /// The root node in which the position was resolved.
  get doc() {
    return this.node(0);
  }

  /// The ancestor node at the given level. `p.node(p.depth)` is the
  /// same as `p.parent`.
  node(depth) {
    return this.path[this.resolveDepth(depth) * 3];
  }

  /// The index into the ancestor at the given level. If this points
  /// at the 3rd node in the 2nd paragraph on the top level, for
  /// example, `p.index(0)` is 1 and `p.index(1)` is 2.
  index(depth) {
    return this.path[this.resolveDepth(depth) * 3 + 1];
  }

  /// The index pointing after this position into the ancestor at the
  /// given level.
  indexAfter(depth) {
    depth = this.resolveDepth(depth);
    return this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1);
  }

  /// The (absolute) position at the start of the node at the given
  /// level.
  start(depth) {
    depth = this.resolveDepth(depth);
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
  }

  /// The (absolute) position at the end of the node at the given
  /// level.
  end(depth) {
    depth = this.resolveDepth(depth);
    return this.start(depth) + this.node(depth).content.size;
  }

  /// The (absolute) position directly before the wrapping node at the
  /// given level, or, when `depth` is `this.depth + 1`, the original
  /// position.
  before(depth) {
    depth = this.resolveDepth(depth);
    if (!depth) throw new RangeError("There is no position before the top-level node");
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1];
  }

  /// The (absolute) position directly after the wrapping node at the
  /// given level, or the original position when `depth` is `this.depth + 1`.
  after(depth) {
    depth = this.resolveDepth(depth);
    if (!depth) throw new RangeError("There is no position after the top-level node");
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize;
  }

  /// When this position points into a text node, this returns the
  /// distance between the position and the start of the text node.
  /// Will be zero for positions that point between nodes.
  get textOffset() {
    return this.pos - this.path[this.path.length - 1];
  }

  /// Get the node directly after the position, if any. If the position
  /// points into a text node, only the part of that node after the
  /// position is returned.
  get nodeAfter() {
    let parent = this.parent,
      index = this.index(this.depth);
    if (index == parent.childCount) return null;
    let dOff = this.pos - this.path[this.path.length - 1],
      child = parent.child(index);
    return dOff ? parent.child(index).cut(dOff) : child;
  }

  /// Get the node directly before the position, if any. If the
  /// position points into a text node, only the part of that node
  /// before the position is returned.
  get nodeBefore() {
    let index = this.index(this.depth);
    let dOff = this.pos - this.path[this.path.length - 1];
    if (dOff) return this.parent.child(index).cut(0, dOff);
    return index == 0 ? null : this.parent.child(index - 1);
  }

  /// Get the position at the given index in the parent node at the
  /// given depth (which defaults to `this.depth`).
  posAtIndex(index, depth) {
    depth = this.resolveDepth(depth);
    let node = this.path[depth * 3],
      pos = depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
    for (let i = 0; i < index; i++) pos += node.child(i).nodeSize;
    return pos;
  }

  /// Get the marks at this position, factoring in the surrounding
  /// marks' [`inclusive`](#model.MarkSpec.inclusive) property. If the
  /// position is at the start of a non-empty node, the marks of the
  /// node after it (if any) are returned.
  marks() {
    let parent = this.parent,
      index = this.index();

    // In an empty parent, return the empty array
    if (parent.content.size == 0) return _mark.Mark.none;

    // When inside a text node, just return the text node's marks
    if (this.textOffset) return parent.child(index).marks;
    let main = parent.maybeChild(index - 1),
      other = parent.maybeChild(index);
    // If the `after` flag is true of there is no node before, make
    // the node after this position the main reference.
    if (!main) {
      let tmp = main;
      main = other;
      other = tmp;
    }

    // Use all marks in the main node, except those that have
    // `inclusive` set to false and are not present in the other node.
    let marks = main.marks;
    for (var i = 0; i < marks.length; i++) if (marks[i].type.spec.inclusive === false && (!other || !marks[i].isInSet(other.marks))) marks = marks[i--].removeFromSet(marks);
    return marks;
  }

  /// Get the marks after the current position, if any, except those
  /// that are non-inclusive and not present at position `$end`. This
  /// is mostly useful for getting the set of marks to preserve after a
  /// deletion. Will return `null` if this position is at the end of
  /// its parent node or its parent node isn't a textblock (in which
  /// case no marks should be preserved).
  marksAcross($end) {
    let after = this.parent.maybeChild(this.index());
    if (!after || !after.isInline) return null;
    let marks = after.marks,
      next = $end.parent.maybeChild($end.index());
    for (var i = 0; i < marks.length; i++) if (marks[i].type.spec.inclusive === false && (!next || !marks[i].isInSet(next.marks))) marks = marks[i--].removeFromSet(marks);
    return marks;
  }

  /// The depth up to which this position and the given (non-resolved)
  /// position share the same parent nodes.
  sharedDepth(pos) {
    for (let depth = this.depth; depth > 0; depth--) if (this.start(depth) <= pos && this.end(depth) >= pos) return depth;
    return 0;
  }

  /// Returns a range based on the place where this position and the
  /// given position diverge around block content. If both point into
  /// the same textblock, for example, a range around that textblock
  /// will be returned. If they point into different blocks, the range
  /// around those blocks in their shared ancestor is returned. You can
  /// pass in an optional predicate that will be called with a parent
  /// node to see if a range into that parent is acceptable.
  blockRange(other = this, pred) {
    if (other.pos < this.pos) return other.blockRange(this);
    for (let d = this.depth - (this.parent.inlineContent || this.pos == other.pos ? 1 : 0); d >= 0; d--) if (other.pos <= this.end(d) && (!pred || pred(this.node(d)))) return new NodeRange(this, other, d);
    return null;
  }

  /// Query whether the given position shares the same parent node.
  sameParent(other) {
    return this.pos - this.parentOffset == other.pos - other.parentOffset;
  }

  /// Return the greater of this and the given position.
  max(other) {
    return other.pos > this.pos ? other : this;
  }

  /// Return the smaller of this and the given position.
  min(other) {
    return other.pos < this.pos ? other : this;
  }

  /// @internal
  toString() {
    let str = "";
    for (let i = 1; i <= this.depth; i++) str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1);
    return str + ":" + this.parentOffset;
  }

  /// @internal
  static resolve(doc, pos) {
    if (!(pos >= 0 && pos <= doc.content.size)) throw new RangeError("Position " + pos + " out of range");
    let path = [];
    let start = 0,
      parentOffset = pos;
    for (let node = doc;;) {
      let {
        index,
        offset
      } = node.content.findIndex(parentOffset);
      let rem = parentOffset - offset;
      path.push(node, index, start + offset);
      if (!rem) break;
      node = node.child(index);
      if (node.isText) break;
      parentOffset = rem - 1;
      start += offset + 1;
    }
    return new ResolvedPos(pos, path, parentOffset);
  }

  /// @internal
  static resolveCached(doc, pos) {
    let cache = resolveCache.get(doc);
    if (cache) {
      for (let i = 0; i < cache.elts.length; i++) {
        let elt = cache.elts[i];
        if (elt.pos == pos) return elt;
      }
    } else {
      resolveCache.set(doc, cache = new ResolveCache());
    }
    let result = cache.elts[cache.i] = ResolvedPos.resolve(doc, pos);
    cache.i = (cache.i + 1) % resolveCacheSize;
    return result;
  }
}
exports.ResolvedPos = ResolvedPos;
class ResolveCache {
  constructor() {
    this.elts = [];
    this.i = 0;
  }
}
const resolveCacheSize = 12,
  resolveCache = new WeakMap();

/// Represents a flat range of content, i.e. one that starts and
/// ends in the same node.
class NodeRange {
  /// Construct a node range. `$from` and `$to` should point into the
  /// same node until at least the given `depth`, since a node range
  /// denotes an adjacent set of nodes in a single parent node.
  constructor(
  /// A resolved position along the start of the content. May have a
  /// `depth` greater than this object's `depth` property, since
  /// these are the positions that were used to compute the range,
  /// not re-resolved positions directly at its boundaries.
  $from,
  /// A position along the end of the content. See
  /// caveat for [`$from`](#model.NodeRange.$from).
  $to,
  /// The depth of the node that this range points into.
  depth) {
    this.$from = $from;
    this.$to = $to;
    this.depth = depth;
  }

  /// The position at the start of the range.
  get start() {
    return this.$from.before(this.depth + 1);
  }
  /// The position at the end of the range.
  get end() {
    return this.$to.after(this.depth + 1);
  }

  /// The parent node that the range points into.
  get parent() {
    return this.$from.node(this.depth);
  }
  /// The start index of the range in the parent node.
  get startIndex() {
    return this.$from.index(this.depth);
  }
  /// The end index of the range in the parent node.
  get endIndex() {
    return this.$to.indexAfter(this.depth);
  }
}
exports.NodeRange = NodeRange;
},
"prosemirror-model/src/schema.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Schema = exports.NodeType = exports.MarkType = void 0;
exports.checkAttrs = checkAttrs;
var _orderedmap = _interopRequireDefault(__require("orderedmap/index.js"));
var _node = __require("prosemirror-model/src/node.ts");
var _fragment = __require("prosemirror-model/src/fragment.ts");
var _mark = __require("prosemirror-model/src/mark.ts");
var _content = __require("prosemirror-model/src/content.ts");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/// An object holding the attributes of a node.

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.
function defaultAttrs(attrs) {
  let defaults = Object.create(null);
  for (let attrName in attrs) {
    let attr = attrs[attrName];
    if (!attr.hasDefault) return null;
    defaults[attrName] = attr.default;
  }
  return defaults;
}
function computeAttrs(attrs, value) {
  let built = Object.create(null);
  for (let name in attrs) {
    let given = value && value[name];
    if (given === undefined) {
      let attr = attrs[name];
      if (attr.hasDefault) given = attr.default;else throw new RangeError("No value supplied for attribute " + name);
    }
    built[name] = given;
  }
  return built;
}
function checkAttrs(attrs, values, type, name) {
  for (let name in values) if (!(name in attrs)) throw new RangeError(`Unsupported attribute ${name} for ${type} of type ${name}`);
  for (let name in attrs) {
    let attr = attrs[name];
    if (attr.validate) attr.validate(values[name]);
  }
}
function initAttrs(typeName, attrs) {
  let result = Object.create(null);
  if (attrs) for (let name in attrs) result[name] = new Attribute(typeName, name, attrs[name]);
  return result;
}

/// Node types are objects allocated once per `Schema` and used to
/// [tag](#model.Node.type) `Node` instances. They contain information
/// about the node type, such as its name and what kind of node it
/// represents.
class NodeType {
  /// @internal
  constructor(
  /// The name the node type has in this schema.
  name,
  /// A link back to the `Schema` the node type belongs to.
  schema,
  /// The spec that this type is based on
  spec) {
    this.name = name;
    this.schema = schema;
    this.spec = spec;
    /// @internal
    this.groups = void 0;
    /// @internal
    this.attrs = void 0;
    /// @internal
    this.defaultAttrs = void 0;
    /// True if this is a block type
    this.isBlock = void 0;
    /// True if this is the text node type.
    this.isText = void 0;
    /// The set of marks allowed in this node. `null` means all marks
    /// are allowed.
    this.markSet = null;
    this.groups = spec.group ? spec.group.split(" ") : [];
    this.attrs = initAttrs(name, spec.attrs);
    this.defaultAttrs = defaultAttrs(this.attrs)

    // Filled in later
;
    this.contentMatch = null;
    this.inlineContent = null;
    this.isBlock = !(spec.inline || name == "text");
    this.isText = name == "text";
  }

  /// True if this node type has inline content.

  /// True if this is an inline type.
  get isInline() {
    return !this.isBlock;
  }

  /// True if this is a textblock type, a block that contains inline
  /// content.
  get isTextblock() {
    return this.isBlock && this.inlineContent;
  }

  /// True for node types that allow no content.
  get isLeaf() {
    return this.contentMatch == _content.ContentMatch.empty;
  }

  /// True when this node is an atom, i.e. when it does not have
  /// directly editable content.
  get isAtom() {
    return this.isLeaf || !!this.spec.atom;
  }

  /// Return true when this node type is part of the given
  /// [group](#model.NodeSpec.group).
  isInGroup(group) {
    return this.groups.indexOf(group) > -1;
  }

  /// The starting match of the node type's content expression.

  /// The node type's [whitespace](#model.NodeSpec.whitespace) option.
  get whitespace() {
    return this.spec.whitespace || (this.spec.code ? "pre" : "normal");
  }

  /// Tells you whether this node type has any required attributes.
  hasRequiredAttrs() {
    for (let n in this.attrs) if (this.attrs[n].isRequired) return true;
    return false;
  }

  /// Indicates whether this node allows some of the same content as
  /// the given node type.
  compatibleContent(other) {
    return this == other || this.contentMatch.compatible(other.contentMatch);
  }

  /// @internal
  computeAttrs(attrs) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs;else return computeAttrs(this.attrs, attrs);
  }

  /// Create a `Node` of this type. The given attributes are
  /// checked and defaulted (you can pass `null` to use the type's
  /// defaults entirely, if no required attributes exist). `content`
  /// may be a `Fragment`, a node, an array of nodes, or
  /// `null`. Similarly `marks` may be `null` to default to the empty
  /// set of marks.
  create(attrs = null, content, marks) {
    if (this.isText) throw new Error("NodeType.create can't construct text nodes");
    return new _node.Node(this, this.computeAttrs(attrs), _fragment.Fragment.from(content), _mark.Mark.setFrom(marks));
  }

  /// Like [`create`](#model.NodeType.create), but check the given content
  /// against the node type's content restrictions, and throw an error
  /// if it doesn't match.
  createChecked(attrs = null, content, marks) {
    content = _fragment.Fragment.from(content);
    this.checkContent(content);
    return new _node.Node(this, this.computeAttrs(attrs), content, _mark.Mark.setFrom(marks));
  }

  /// Like [`create`](#model.NodeType.create), but see if it is
  /// necessary to add nodes to the start or end of the given fragment
  /// to make it fit the node. If no fitting wrapping can be found,
  /// return null. Note that, due to the fact that required nodes can
  /// always be created, this will always succeed if you pass null or
  /// `Fragment.empty` as content.
  createAndFill(attrs = null, content, marks) {
    attrs = this.computeAttrs(attrs);
    content = _fragment.Fragment.from(content);
    if (content.size) {
      let before = this.contentMatch.fillBefore(content);
      if (!before) return null;
      content = before.append(content);
    }
    let matched = this.contentMatch.matchFragment(content);
    let after = matched && matched.fillBefore(_fragment.Fragment.empty, true);
    if (!after) return null;
    return new _node.Node(this, attrs, content.append(after), _mark.Mark.setFrom(marks));
  }

  /// Returns true if the given fragment is valid content for this node
  /// type.
  validContent(content) {
    let result = this.contentMatch.matchFragment(content);
    if (!result || !result.validEnd) return false;
    for (let i = 0; i < content.childCount; i++) if (!this.allowsMarks(content.child(i).marks)) return false;
    return true;
  }

  /// Throws a RangeError if the given fragment is not valid content for this
  /// node type.
  /// @internal
  checkContent(content) {
    if (!this.validContent(content)) throw new RangeError(`Invalid content for node ${this.name}: ${content.toString().slice(0, 50)}`);
  }

  /// @internal
  checkAttrs(attrs) {
    checkAttrs(this.attrs, attrs, "node", this.name);
  }

  /// Check whether the given mark type is allowed in this node.
  allowsMarkType(markType) {
    return this.markSet == null || this.markSet.indexOf(markType) > -1;
  }

  /// Test whether the given set of marks are allowed in this node.
  allowsMarks(marks) {
    if (this.markSet == null) return true;
    for (let i = 0; i < marks.length; i++) if (!this.allowsMarkType(marks[i].type)) return false;
    return true;
  }

  /// Removes the marks that are not allowed in this node from the given set.
  allowedMarks(marks) {
    if (this.markSet == null) return marks;
    let copy;
    for (let i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        if (!copy) copy = marks.slice(0, i);
      } else if (copy) {
        copy.push(marks[i]);
      }
    }
    return !copy ? marks : copy.length ? copy : _mark.Mark.none;
  }

  /// @internal
  static compile(nodes, schema) {
    let result = Object.create(null);
    nodes.forEach((name, spec) => result[name] = new NodeType(name, schema, spec));
    let topType = schema.spec.topNode || "doc";
    if (!result[topType]) throw new RangeError("Schema is missing its top node type ('" + topType + "')");
    if (!result.text) throw new RangeError("Every schema needs a 'text' type");
    for (let _ in result.text.attrs) throw new RangeError("The text node type should not have attributes");
    return result;
  }
}
exports.NodeType = NodeType;
function validateType(typeName, attrName, type) {
  let types = type.split("|");
  return value => {
    let name = value === null ? "null" : typeof value;
    if (types.indexOf(name) < 0) throw new RangeError(`Expected value of type ${types} for attribute ${attrName} on type ${typeName}, got ${name}`);
  };
}

// Attribute descriptors

class Attribute {
  constructor(typeName, attrName, options) {
    this.hasDefault = void 0;
    this.default = void 0;
    this.validate = void 0;
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, "default");
    this.default = options.default;
    this.validate = typeof options.validate == "string" ? validateType(typeName, attrName, options.validate) : options.validate;
  }
  get isRequired() {
    return !this.hasDefault;
  }
}

// Marks

/// Like nodes, marks (which are associated with nodes to signify
/// things like emphasis or being part of a link) are
/// [tagged](#model.Mark.type) with type objects, which are
/// instantiated once per `Schema`.
class MarkType {
  /// @internal
  constructor(
  /// The name of the mark type.
  name,
  /// @internal
  rank,
  /// The schema that this mark type instance is part of.
  schema,
  /// The spec on which the type is based.
  spec) {
    this.name = name;
    this.rank = rank;
    this.schema = schema;
    this.spec = spec;
    /// @internal
    this.attrs = void 0;
    /// @internal
    this.instance = void 0;
    this.attrs = initAttrs(name, spec.attrs);
    this.excluded = null;
    let defaults = defaultAttrs(this.attrs);
    this.instance = defaults ? new _mark.Mark(this, defaults) : null;
  }

  /// Create a mark of this type. `attrs` may be `null` or an object
  /// containing only some of the mark's attributes. The others, if
  /// they have defaults, will be added.
  create(attrs = null) {
    if (!attrs && this.instance) return this.instance;
    return new _mark.Mark(this, computeAttrs(this.attrs, attrs));
  }

  /// @internal
  static compile(marks, schema) {
    let result = Object.create(null),
      rank = 0;
    marks.forEach((name, spec) => result[name] = new MarkType(name, rank++, schema, spec));
    return result;
  }

  /// When there is a mark of this type in the given set, a new set
  /// without it is returned. Otherwise, the input set is returned.
  removeFromSet(set) {
    for (var i = 0; i < set.length; i++) if (set[i].type == this) {
      set = set.slice(0, i).concat(set.slice(i + 1));
      i--;
    }
    return set;
  }

  /// Tests whether there is a mark of this type in the given set.
  isInSet(set) {
    for (let i = 0; i < set.length; i++) if (set[i].type == this) return set[i];
  }

  /// @internal
  checkAttrs(attrs) {
    checkAttrs(this.attrs, attrs, "mark", this.name);
  }

  /// Queries whether a given mark type is
  /// [excluded](#model.MarkSpec.excludes) by this one.
  excludes(other) {
    return this.excluded.indexOf(other) > -1;
  }
}

/// An object describing a schema, as passed to the [`Schema`](#model.Schema)
/// constructor.

/// A description of a node type, used when defining a schema.

/// Used to define marks when creating a schema.

/// Used to [define](#model.NodeSpec.attrs) attributes on nodes or
/// marks.
exports.MarkType = MarkType;
/// A document schema. Holds [node](#model.NodeType) and [mark
/// type](#model.MarkType) objects for the nodes and marks that may
/// occur in conforming documents, and provides functionality for
/// creating and deserializing such documents.
///
/// When given, the type parameters provide the names of the nodes and
/// marks in this schema.
class Schema {
  /// Construct a schema from a schema [specification](#model.SchemaSpec).
  constructor(spec) {
    /// The [spec](#model.SchemaSpec) on which the schema is based,
    /// with the added guarantee that its `nodes` and `marks`
    /// properties are
    /// [`OrderedMap`](https://github.com/marijnh/orderedmap) instances
    /// (not raw objects).
    this.spec = void 0;
    /// An object mapping the schema's node names to node type objects.
    this.nodes = void 0;
    /// A map from mark names to mark type objects.
    this.marks = void 0;
    /// The [linebreak
    /// replacement](#model.NodeSpec.linebreakReplacement) node defined
    /// in this schema, if any.
    this.linebreakReplacement = null;
    /// The type of the [default top node](#model.SchemaSpec.topNode)
    /// for this schema.
    this.topNodeType = void 0;
    /// An object for storing whatever values modules may want to
    /// compute and cache per schema. (If you want to store something
    /// in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null);
    /// Deserialize a node from its JSON representation. This method is
    /// bound.
    this.nodeFromJSON = void 0;
    /// Deserialize a mark from its JSON representation. This method is
    /// bound.
    this.markFromJSON = void 0;
    let instanceSpec = this.spec = {};
    for (let prop in spec) instanceSpec[prop] = spec[prop];
    instanceSpec.nodes = _orderedmap.default.from(spec.nodes), instanceSpec.marks = _orderedmap.default.from(spec.marks || {}), this.nodes = NodeType.compile(this.spec.nodes, this);
    this.marks = MarkType.compile(this.spec.marks, this);
    let contentExprCache = Object.create(null);
    for (let prop in this.nodes) {
      if (prop in this.marks) throw new RangeError(prop + " can not be both a node and a mark");
      let type = this.nodes[prop],
        contentExpr = type.spec.content || "",
        markExpr = type.spec.marks;
      type.contentMatch = contentExprCache[contentExpr] || (contentExprCache[contentExpr] = _content.ContentMatch.parse(contentExpr, this.nodes));
      type.inlineContent = type.contentMatch.inlineContent;
      if (type.spec.linebreakReplacement) {
        if (this.linebreakReplacement) throw new RangeError("Multiple linebreak nodes defined");
        if (!type.isInline || !type.isLeaf) throw new RangeError("Linebreak replacement nodes must be inline leaf nodes");
        this.linebreakReplacement = type;
      }
      type.markSet = markExpr == "_" ? null : markExpr ? gatherMarks(this, markExpr.split(" ")) : markExpr == "" || !type.inlineContent ? [] : null;
    }
    for (let prop in this.marks) {
      let type = this.marks[prop],
        excl = type.spec.excludes;
      type.excluded = excl == null ? [type] : excl == "" ? [] : gatherMarks(this, excl.split(" "));
    }
    this.nodeFromJSON = json => _node.Node.fromJSON(this, json);
    this.markFromJSON = json => _mark.Mark.fromJSON(this, json);
    this.topNodeType = this.nodes[this.spec.topNode || "doc"];
    this.cached.wrappings = Object.create(null);
  }
  /// Create a node in this schema. The `type` may be a string or a
  /// `NodeType` instance. Attributes will be extended with defaults,
  /// `content` may be a `Fragment`, `null`, a `Node`, or an array of
  /// nodes.
  node(type, attrs = null, content, marks) {
    if (typeof type == "string") type = this.nodeType(type);else if (!(type instanceof NodeType)) throw new RangeError("Invalid node type: " + type);else if (type.schema != this) throw new RangeError("Node type from different schema used (" + type.name + ")");
    return type.createChecked(attrs, content, marks);
  }

  /// Create a text node in the schema. Empty text nodes are not
  /// allowed.
  text(text, marks) {
    let type = this.nodes.text;
    return new _node.TextNode(type, type.defaultAttrs, text, _mark.Mark.setFrom(marks));
  }

  /// Create a mark with the given type and attributes.
  mark(type, attrs) {
    if (typeof type == "string") type = this.marks[type];
    return type.create(attrs);
  }
  /// @internal
  nodeType(name) {
    let found = this.nodes[name];
    if (!found) throw new RangeError("Unknown node type: " + name);
    return found;
  }
}
exports.Schema = Schema;
function gatherMarks(schema, marks) {
  let found = [];
  for (let i = 0; i < marks.length; i++) {
    let name = marks[i],
      mark = schema.marks[name],
      ok = mark;
    if (mark) {
      found.push(mark);
    } else {
      for (let prop in schema.marks) {
        let mark = schema.marks[prop];
        if (name == "_" || mark.spec.group && mark.spec.group.split(" ").indexOf(name) > -1) found.push(ok = mark);
      }
    }
    if (!ok) throw new SyntaxError("Unknown mark type: '" + marks[i] + "'");
  }
  return found;
}
},
"prosemirror-model/src/to_dom.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DOMSerializer = void 0;
/// A description of a DOM structure. Can be either a string, which is
/// interpreted as a text node, a DOM node, which is interpreted as
/// itself, a `{dom, contentDOM}` object, or an array.
///
/// An array describes a DOM element. The first value in the array
/// should be a string—the name of the DOM element, optionally prefixed
/// by a namespace URL and a space. If the second element is plain
/// object, it is interpreted as a set of attributes for the element.
/// Any elements after that (including the 2nd if it's not an attribute
/// object) are interpreted as children of the DOM elements, and must
/// either be valid `DOMOutputSpec` values, or the number zero.
///
/// The number zero (pronounced “hole”) is used to indicate the place
/// where a node's child nodes should be inserted. If it occurs in an
/// output spec, it should be the only child element in its parent
/// node.

/// A DOM serializer knows how to convert ProseMirror nodes and
/// marks of various types to DOM nodes.
class DOMSerializer {
  /// Create a serializer. `nodes` should map node names to functions
  /// that take a node and return a description of the corresponding
  /// DOM. `marks` does the same for mark names, but also gets an
  /// argument that tells it whether the mark's content is block or
  /// inline content (for typical use, it'll always be inline). A mark
  /// serializer may be `null` to indicate that marks of that type
  /// should not be serialized.
  constructor(
  /// The node serialization functions.
  nodes,
  /// The mark serialization functions.
  marks) {
    this.nodes = nodes;
    this.marks = marks;
  }

  /// Serialize the content of this fragment to a DOM fragment. When
  /// not in the browser, the `document` option, containing a DOM
  /// document, should be passed so that the serializer can create
  /// nodes.
  serializeFragment(fragment, options = {}, target) {
    if (!target) target = doc(options).createDocumentFragment();
    let top = target,
      active = [];
    fragment.forEach(node => {
      if (active.length || node.marks.length) {
        let keep = 0,
          rendered = 0;
        while (keep < active.length && rendered < node.marks.length) {
          let next = node.marks[rendered];
          if (!this.marks[next.type.name]) {
            rendered++;
            continue;
          }
          if (!next.eq(active[keep][0]) || next.type.spec.spanning === false) break;
          keep++;
          rendered++;
        }
        while (keep < active.length) top = active.pop()[1];
        while (rendered < node.marks.length) {
          let add = node.marks[rendered++];
          let markDOM = this.serializeMark(add, node.isInline, options);
          if (markDOM) {
            active.push([add, top]);
            top.appendChild(markDOM.dom);
            top = markDOM.contentDOM || markDOM.dom;
          }
        }
      }
      top.appendChild(this.serializeNodeInner(node, options));
    });
    return target;
  }

  /// @internal
  serializeNodeInner(node, options) {
    let {
      dom,
      contentDOM
    } = renderSpec(doc(options), this.nodes[node.type.name](node), null, node.attrs);
    if (contentDOM) {
      if (node.isLeaf) throw new RangeError("Content hole not allowed in a leaf node spec");
      this.serializeFragment(node.content, options, contentDOM);
    }
    return dom;
  }

  /// Serialize this node to a DOM node. This can be useful when you
  /// need to serialize a part of a document, as opposed to the whole
  /// document. To serialize a whole document, use
  /// [`serializeFragment`](#model.DOMSerializer.serializeFragment) on
  /// its [content](#model.Node.content).
  serializeNode(node, options = {}) {
    let dom = this.serializeNodeInner(node, options);
    for (let i = node.marks.length - 1; i >= 0; i--) {
      let wrap = this.serializeMark(node.marks[i], node.isInline, options);
      if (wrap) {
        ;
        (wrap.contentDOM || wrap.dom).appendChild(dom);
        dom = wrap.dom;
      }
    }
    return dom;
  }

  /// @internal
  serializeMark(mark, inline, options = {}) {
    let toDOM = this.marks[mark.type.name];
    return toDOM && renderSpec(doc(options), toDOM(mark, inline), null, mark.attrs);
  }

  /// Render an [output spec](#model.DOMOutputSpec) to a DOM node. If
  /// the spec has a hole (zero) in it, `contentDOM` will point at the
  /// node with the hole.

  static renderSpec(doc, structure, xmlNS = null, blockArraysIn) {
    return renderSpec(doc, structure, xmlNS, blockArraysIn);
  }

  /// Build a serializer using the [`toDOM`](#model.NodeSpec.toDOM)
  /// properties in a schema's node and mark specs.
  static fromSchema(schema) {
    return schema.cached.domSerializer || (schema.cached.domSerializer = new DOMSerializer(this.nodesFromSchema(schema), this.marksFromSchema(schema)));
  }

  /// Gather the serializers in a schema's node specs into an object.
  /// This can be useful as a base to build a custom serializer from.
  static nodesFromSchema(schema) {
    let result = gatherToDOM(schema.nodes);
    if (!result.text) result.text = node => node.text;
    return result;
  }

  /// Gather the serializers in a schema's mark specs into an object.
  static marksFromSchema(schema) {
    return gatherToDOM(schema.marks);
  }
}
exports.DOMSerializer = DOMSerializer;
function gatherToDOM(obj) {
  let result = {};
  for (let name in obj) {
    let toDOM = obj[name].spec.toDOM;
    if (toDOM) result[name] = toDOM;
  }
  return result;
}
function doc(options) {
  return options.document || window.document;
}
const suspiciousAttributeCache = new WeakMap();
function suspiciousAttributes(attrs) {
  let value = suspiciousAttributeCache.get(attrs);
  if (value === undefined) suspiciousAttributeCache.set(attrs, value = suspiciousAttributesInner(attrs));
  return value;
}
function suspiciousAttributesInner(attrs) {
  let result = null;
  function scan(value) {
    if (value && typeof value == "object") {
      if (Array.isArray(value)) {
        if (typeof value[0] == "string") {
          if (!result) result = [];
          result.push(value);
        } else {
          for (let i = 0; i < value.length; i++) scan(value[i]);
        }
      } else {
        for (let prop in value) scan(value[prop]);
      }
    }
  }
  scan(attrs);
  return result;
}
function renderSpec(doc, structure, xmlNS, blockArraysIn) {
  if (typeof structure == "string") return {
    dom: doc.createTextNode(structure)
  };
  if (structure.nodeType != null) return {
    dom: structure
  };
  if (structure.dom && structure.dom.nodeType != null) return structure;
  let tagName = structure[0],
    suspicious;
  if (typeof tagName != "string") throw new RangeError("Invalid array passed to renderSpec");
  if (blockArraysIn && (suspicious = suspiciousAttributes(blockArraysIn)) && suspicious.indexOf(structure) > -1) throw new RangeError("Using an array from an attribute object as a DOM spec. This may be an attempted cross site scripting attack.");
  let space = tagName.indexOf(" ");
  if (space > 0) {
    xmlNS = tagName.slice(0, space);
    tagName = tagName.slice(space + 1);
  }
  let contentDOM;
  let dom = xmlNS ? doc.createElementNS(xmlNS, tagName) : doc.createElement(tagName);
  let attrs = structure[1],
    start = 1;
  if (attrs && typeof attrs == "object" && attrs.nodeType == null && !Array.isArray(attrs)) {
    start = 2;
    for (let name in attrs) if (attrs[name] != null) {
      let space = name.indexOf(" ");
      if (space > 0) dom.setAttributeNS(name.slice(0, space), name.slice(space + 1), attrs[name]);else if (name == "style" && dom.style) dom.style.cssText = attrs[name];else dom.setAttribute(name, attrs[name]);
    }
  }
  for (let i = start; i < structure.length; i++) {
    let child = structure[i];
    if (child === 0) {
      if (i < structure.length - 1 || i > start) throw new RangeError("Content hole must be the only child of its parent node");
      return {
        dom,
        contentDOM: dom
      };
    } else {
      let {
        dom: inner,
        contentDOM: innerContent
      } = renderSpec(doc, child, xmlNS, blockArraysIn);
      dom.appendChild(inner);
      if (innerContent) {
        if (contentDOM) throw new RangeError("Multiple content holes");
        contentDOM = innerContent;
      }
    }
  }
  return {
    dom,
    contentDOM
  };
}
},
"prosemirror-schema-list/src/schema-list.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addListNodes = addListNodes;
exports.bulletList = void 0;
exports.liftListItem = liftListItem;
exports.orderedList = exports.listItem = void 0;
exports.sinkListItem = sinkListItem;
exports.splitListItem = splitListItem;
exports.splitListItemKeepMarks = splitListItemKeepMarks;
exports.wrapInList = wrapInList;
exports.wrapRangeInList = wrapRangeInList;
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
const olDOM = ["ol", 0],
  ulDOM = ["ul", 0],
  liDOM = ["li", 0];

/// An ordered list [node spec](#model.NodeSpec). Has a single
/// attribute, `order`, which determines the number at which the list
/// starts counting, and defaults to 1. Represented as an `<ol>`
/// element.
const orderedList = exports.orderedList = {
  attrs: {
    order: {
      default: 1,
      validate: "number"
    }
  },
  parseDOM: [{
    tag: "ol",
    getAttrs(dom) {
      return {
        order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1
      };
    }
  }],
  toDOM(node) {
    return node.attrs.order == 1 ? olDOM : ["ol", {
      start: node.attrs.order
    }, 0];
  }
};

/// A bullet list node spec, represented in the DOM as `<ul>`.
const bulletList = exports.bulletList = {
  parseDOM: [{
    tag: "ul"
  }],
  toDOM() {
    return ulDOM;
  }
};

/// A list item (`<li>`) spec.
const listItem = exports.listItem = {
  parseDOM: [{
    tag: "li"
  }],
  toDOM() {
    return liDOM;
  },
  defining: true
};
function add(obj, props) {
  let copy = {};
  for (let prop in obj) copy[prop] = obj[prop];
  for (let prop in props) copy[prop] = props[prop];
  return copy;
}

/// Convenience function for adding list-related node types to a map
/// specifying the nodes for a schema. Adds
/// [`orderedList`](#schema-list.orderedList) as `"ordered_list"`,
/// [`bulletList`](#schema-list.bulletList) as `"bullet_list"`, and
/// [`listItem`](#schema-list.listItem) as `"list_item"`.
///
/// `itemContent` determines the content expression for the list items.
/// If you want the commands defined in this module to apply to your
/// list structure, it should have a shape like `"paragraph block*"` or
/// `"paragraph (ordered_list | bullet_list)*"`. `listGroup` can be
/// given to assign a group name to the list node types, for example
/// `"block"`.
function addListNodes(nodes, itemContent, listGroup) {
  return nodes.append({
    ordered_list: add(orderedList, {
      content: "list_item+",
      group: listGroup
    }),
    bullet_list: add(bulletList, {
      content: "list_item+",
      group: listGroup
    }),
    list_item: add(listItem, {
      content: itemContent
    })
  });
}

/// Returns a command function that wraps the selection in a list with
/// the given type an attributes. If `dispatch` is null, only return a
/// value to indicate whether this is possible, but don't actually
/// perform the change.
function wrapInList(listType, attrs = null) {
  return function (state, dispatch) {
    let {
      $from,
      $to
    } = state.selection;
    let range = $from.blockRange($to);
    if (!range) return false;
    let tr = dispatch ? state.tr : null;
    if (!wrapRangeInList(tr, range, listType, attrs)) return false;
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

/// Try to wrap the given node range in a list of the given type.
/// Return `true` when this is possible, `false` otherwise. When `tr`
/// is non-null, the wrapping is added to that transaction. When it is
/// `null`, the function only queries whether the wrapping is
/// possible.
function wrapRangeInList(tr, range, listType, attrs = null) {
  let doJoin = false,
    outerRange = range,
    doc = range.$from.doc;
  // This is at the top of an existing list item
  if (range.depth >= 2 && range.$from.node(range.depth - 1).type.compatibleContent(listType) && range.startIndex == 0) {
    // Don't do anything if this is the top of the list
    if (range.$from.index(range.depth - 1) == 0) return false;
    let $insert = doc.resolve(range.start - 2);
    outerRange = new _prosemirrorModel.NodeRange($insert, $insert, range.depth);
    if (range.endIndex < range.parent.childCount) range = new _prosemirrorModel.NodeRange(range.$from, doc.resolve(range.$to.end(range.depth)), range.depth);
    doJoin = true;
  }
  let wrap = (0, _prosemirrorTransform.findWrapping)(outerRange, listType, attrs, range);
  if (!wrap) return false;
  if (tr) doWrapInList(tr, range, wrap, doJoin, listType);
  return true;
}
function doWrapInList(tr, range, wrappers, joinBefore, listType) {
  let content = _prosemirrorModel.Fragment.empty;
  for (let i = wrappers.length - 1; i >= 0; i--) content = _prosemirrorModel.Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  tr.step(new _prosemirrorTransform.ReplaceAroundStep(range.start - (joinBefore ? 2 : 0), range.end, range.start, range.end, new _prosemirrorModel.Slice(content, 0, 0), wrappers.length, true));
  let found = 0;
  for (let i = 0; i < wrappers.length; i++) if (wrappers[i].type == listType) found = i + 1;
  let splitDepth = wrappers.length - found;
  let splitPos = range.start + wrappers.length - (joinBefore ? 2 : 0),
    parent = range.parent;
  for (let i = range.startIndex, e = range.endIndex, first = true; i < e; i++, first = false) {
    if (!first && (0, _prosemirrorTransform.canSplit)(tr.doc, splitPos, splitDepth)) {
      tr.split(splitPos, splitDepth);
      splitPos += 2 * splitDepth;
    }
    splitPos += parent.child(i).nodeSize;
  }
  return tr;
}

/// Build a command that splits a non-empty textblock at the top level
/// of a list item by also splitting that list item.
function splitListItem(itemType, itemAttrs) {
  return function (state, dispatch) {
    let {
      $from,
      $to,
      node
    } = state.selection;
    if (node && node.isBlock || $from.depth < 2 || !$from.sameParent($to)) return false;
    let grandParent = $from.node(-1);
    if (grandParent.type != itemType) return false;
    if ($from.parent.content.size == 0 && $from.node(-1).childCount == $from.indexAfter(-1)) {
      // In an empty block. If this is a nested list, the wrapping
      // list item should be split. Otherwise, bail out and let next
      // command handle lifting.
      if ($from.depth == 3 || $from.node(-3).type != itemType || $from.index(-2) != $from.node(-2).childCount - 1) return false;
      if (dispatch) {
        let wrap = _prosemirrorModel.Fragment.empty;
        let depthBefore = $from.index(-1) ? 1 : $from.index(-2) ? 2 : 3;
        // Build a fragment containing empty versions of the structure
        // from the outer list item to the parent node of the cursor
        for (let d = $from.depth - depthBefore; d >= $from.depth - 3; d--) wrap = _prosemirrorModel.Fragment.from($from.node(d).copy(wrap));
        let depthAfter = $from.indexAfter(-1) < $from.node(-2).childCount ? 1 : $from.indexAfter(-2) < $from.node(-3).childCount ? 2 : 3;
        // Add a second list item with an empty default start node
        wrap = wrap.append(_prosemirrorModel.Fragment.from(itemType.createAndFill()));
        let start = $from.before($from.depth - (depthBefore - 1));
        let tr = state.tr.replace(start, $from.after(-depthAfter), new _prosemirrorModel.Slice(wrap, 4 - depthBefore, 0));
        let sel = -1;
        tr.doc.nodesBetween(start, tr.doc.content.size, (node, pos) => {
          if (sel > -1) return false;
          if (node.isTextblock && node.content.size == 0) sel = pos + 1;
        });
        if (sel > -1) tr.setSelection(_prosemirrorState.Selection.near(tr.doc.resolve(sel)));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    let nextType = $to.pos == $from.end() ? grandParent.contentMatchAt(0).defaultType : null;
    let tr = state.tr.delete($from.pos, $to.pos);
    let types = nextType ? [itemAttrs ? {
      type: itemType,
      attrs: itemAttrs
    } : null, {
      type: nextType
    }] : undefined;
    if (!(0, _prosemirrorTransform.canSplit)(tr.doc, $from.pos, 2, types)) return false;
    if (dispatch) dispatch(tr.split($from.pos, 2, types).scrollIntoView());
    return true;
  };
}

/// Acts like [`splitListItem`](#schema-list.splitListItem), but
/// without resetting the set of active marks at the cursor.
function splitListItemKeepMarks(itemType, itemAttrs) {
  let split = splitListItem(itemType, itemAttrs);
  return (state, dispatch) => {
    return split(state, dispatch && (tr => {
      let marks = state.storedMarks || state.selection.$to.parentOffset && state.selection.$from.marks();
      if (marks) tr.ensureMarks(marks);
      dispatch(tr);
    }));
  };
}

/// Create a command to lift the list item around the selection up into
/// a wrapping list.
function liftListItem(itemType) {
  return function (state, dispatch) {
    let {
      $from,
      $to
    } = state.selection;
    let range = $from.blockRange($to, node => node.childCount > 0 && node.firstChild.type == itemType);
    if (!range) return false;
    if (!dispatch) return true;
    if ($from.node(range.depth - 1).type == itemType)
      // Inside a parent list
      return liftToOuterList(state, dispatch, itemType, range);else
      // Outer list node
      return liftOutOfList(state, dispatch, range);
  };
}
function liftToOuterList(state, dispatch, itemType, range) {
  let tr = state.tr,
    end = range.end,
    endOfList = range.$to.end(range.depth);
  if (end < endOfList) {
    // There are siblings after the lifted items, which must become
    // children of the last item
    tr.step(new _prosemirrorTransform.ReplaceAroundStep(end - 1, endOfList, end, endOfList, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(itemType.create(null, range.parent.copy())), 1, 0), 1, true));
    range = new _prosemirrorModel.NodeRange(tr.doc.resolve(range.$from.pos), tr.doc.resolve(endOfList), range.depth);
  }
  const target = (0, _prosemirrorTransform.liftTarget)(range);
  if (target == null) return false;
  tr.lift(range, target);
  let $after = tr.doc.resolve(tr.mapping.map(end, -1) - 1);
  if ((0, _prosemirrorTransform.canJoin)(tr.doc, $after.pos) && $after.nodeBefore.type == $after.nodeAfter.type) tr.join($after.pos);
  dispatch(tr.scrollIntoView());
  return true;
}
function liftOutOfList(state, dispatch, range) {
  let tr = state.tr,
    list = range.parent;
  // Merge the list items into a single big item
  for (let pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i--) {
    pos -= list.child(i).nodeSize;
    tr.delete(pos - 1, pos + 1);
  }
  let $start = tr.doc.resolve(range.start),
    item = $start.nodeAfter;
  if (tr.mapping.map(range.end) != range.start + $start.nodeAfter.nodeSize) return false;
  let atStart = range.startIndex == 0,
    atEnd = range.endIndex == list.childCount;
  let parent = $start.node(-1),
    indexBefore = $start.index(-1);
  if (!parent.canReplace(indexBefore + (atStart ? 0 : 1), indexBefore + 1, item.content.append(atEnd ? _prosemirrorModel.Fragment.empty : _prosemirrorModel.Fragment.from(list)))) return false;
  let start = $start.pos,
    end = start + item.nodeSize;
  // Strip off the surrounding list. At the sides where we're not at
  // the end of the list, the existing list is closed. At sides where
  // this is the end, it is overwritten to its end.
  tr.step(new _prosemirrorTransform.ReplaceAroundStep(start - (atStart ? 1 : 0), end + (atEnd ? 1 : 0), start + 1, end - 1, new _prosemirrorModel.Slice((atStart ? _prosemirrorModel.Fragment.empty : _prosemirrorModel.Fragment.from(list.copy(_prosemirrorModel.Fragment.empty))).append(atEnd ? _prosemirrorModel.Fragment.empty : _prosemirrorModel.Fragment.from(list.copy(_prosemirrorModel.Fragment.empty))), atStart ? 0 : 1, atEnd ? 0 : 1), atStart ? 0 : 1));
  dispatch(tr.scrollIntoView());
  return true;
}

/// Create a command to sink the list item around the selection down
/// into an inner list.
function sinkListItem(itemType) {
  return function (state, dispatch) {
    let {
      $from,
      $to
    } = state.selection;
    let range = $from.blockRange($to, node => node.childCount > 0 && node.firstChild.type == itemType);
    if (!range) return false;
    let startIndex = range.startIndex;
    if (startIndex == 0) return false;
    let parent = range.parent,
      nodeBefore = parent.child(startIndex - 1);
    if (nodeBefore.type != itemType) return false;
    if (dispatch) {
      let nestedBefore = nodeBefore.lastChild && nodeBefore.lastChild.type == parent.type;
      let inner = _prosemirrorModel.Fragment.from(nestedBefore ? itemType.create() : null);
      let slice = new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(itemType.create(null, _prosemirrorModel.Fragment.from(parent.type.create(null, inner)))), nestedBefore ? 3 : 1, 0);
      let before = range.start,
        after = range.end;
      dispatch(state.tr.step(new _prosemirrorTransform.ReplaceAroundStep(before - (nestedBefore ? 3 : 1), after, before, after, slice, 1, true)).scrollIntoView());
    }
    return true;
  };
}
},
"prosemirror-state/src/index.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AllSelection", {
  enumerable: true,
  get: function () {
    return _selection.AllSelection;
  }
});
Object.defineProperty(exports, "Command", {
  enumerable: true,
  get: function () {
    return _transaction.Command;
  }
});
Object.defineProperty(exports, "EditorState", {
  enumerable: true,
  get: function () {
    return _state.EditorState;
  }
});
Object.defineProperty(exports, "EditorStateConfig", {
  enumerable: true,
  get: function () {
    return _state.EditorStateConfig;
  }
});
Object.defineProperty(exports, "NodeSelection", {
  enumerable: true,
  get: function () {
    return _selection.NodeSelection;
  }
});
Object.defineProperty(exports, "Plugin", {
  enumerable: true,
  get: function () {
    return _plugin.Plugin;
  }
});
Object.defineProperty(exports, "PluginKey", {
  enumerable: true,
  get: function () {
    return _plugin.PluginKey;
  }
});
Object.defineProperty(exports, "PluginSpec", {
  enumerable: true,
  get: function () {
    return _plugin.PluginSpec;
  }
});
Object.defineProperty(exports, "PluginView", {
  enumerable: true,
  get: function () {
    return _plugin.PluginView;
  }
});
Object.defineProperty(exports, "Selection", {
  enumerable: true,
  get: function () {
    return _selection.Selection;
  }
});
Object.defineProperty(exports, "SelectionBookmark", {
  enumerable: true,
  get: function () {
    return _selection.SelectionBookmark;
  }
});
Object.defineProperty(exports, "SelectionRange", {
  enumerable: true,
  get: function () {
    return _selection.SelectionRange;
  }
});
Object.defineProperty(exports, "StateField", {
  enumerable: true,
  get: function () {
    return _plugin.StateField;
  }
});
Object.defineProperty(exports, "TextSelection", {
  enumerable: true,
  get: function () {
    return _selection.TextSelection;
  }
});
Object.defineProperty(exports, "Transaction", {
  enumerable: true,
  get: function () {
    return _transaction.Transaction;
  }
});
var _selection = __require("prosemirror-state/src/selection.ts");
var _transaction = __require("prosemirror-state/src/transaction.ts");
var _state = __require("prosemirror-state/src/state.ts");
var _plugin = __require("prosemirror-state/src/plugin.ts");
},
"prosemirror-state/src/plugin.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PluginKey = exports.Plugin = void 0;
/// This is the type passed to the [`Plugin`](#state.Plugin)
/// constructor. It provides a definition for a plugin.

/// A stateful object that can be installed in an editor by a
/// [plugin](#state.PluginSpec.view).

function bindProps(obj, self, target) {
  for (let prop in obj) {
    let val = obj[prop];
    if (val instanceof Function) val = val.bind(self);else if (prop == "handleDOMEvents") val = bindProps(val, self, {});
    target[prop] = val;
  }
  return target;
}

/// Plugins bundle functionality that can be added to an editor.
/// They are part of the [editor state](#state.EditorState) and
/// may influence that state and the view that contains it.
class Plugin {
  /// Create a plugin.
  constructor(
  /// The plugin's [spec object](#state.PluginSpec).
  spec) {
    this.spec = spec;
    /// The [props](#view.EditorProps) exported by this plugin.
    this.props = {};
    /// @internal
    this.key = void 0;
    if (spec.props) bindProps(spec.props, this, this.props);
    this.key = spec.key ? spec.key.key : createKey("plugin");
  }
  /// Extract the plugin's state field from an editor state.
  getState(state) {
    return state[this.key];
  }
}

/// A plugin spec may provide a state field (under its
/// [`state`](#state.PluginSpec.state) property) of this type, which
/// describes the state it wants to keep. Functions provided here are
/// always called with the plugin instance as their `this` binding.
exports.Plugin = Plugin;
const keys = Object.create(null);
function createKey(name) {
  if (name in keys) return name + "$" + ++keys[name];
  keys[name] = 0;
  return name + "$";
}

/// A key is used to [tag](#state.PluginSpec.key) plugins in a way
/// that makes it possible to find them, given an editor state.
/// Assigning a key does mean only one plugin of that type can be
/// active in a state.
class PluginKey {
  /// Create a plugin key.
  constructor(name = "key") {
    /// @internal
    this.key = void 0;
    this.key = createKey(name);
  }

  /// Get the active plugin with this key, if any, from an editor
  /// state.
  get(state) {
    return state.config.pluginsByKey[this.key];
  }

  /// Get the plugin's state from an editor state.
  getState(state) {
    return state[this.key];
  }
}
exports.PluginKey = PluginKey;
},
"prosemirror-state/src/selection.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TextSelection = exports.SelectionRange = exports.Selection = exports.NodeSelection = exports.AllSelection = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
const classesById = Object.create(null);

/// Superclass for editor selections. Every selection type should
/// extend this. Should not be instantiated directly.
class Selection {
  /// Initialize a selection with the head and anchor and ranges. If no
  /// ranges are given, constructs a single range across `$anchor` and
  /// `$head`.
  constructor(
  /// The resolved anchor of the selection (the side that stays in
  /// place when the selection is modified).
  $anchor,
  /// The resolved head of the selection (the side that moves when
  /// the selection is modified).
  $head, ranges) {
    this.$anchor = $anchor;
    this.$head = $head;
    /// The ranges covered by the selection.
    this.ranges = void 0;
    this.ranges = ranges || [new SelectionRange($anchor.min($head), $anchor.max($head))];
  }
  /// The selection's anchor, as an unresolved position.
  get anchor() {
    return this.$anchor.pos;
  }

  /// The selection's head.
  get head() {
    return this.$head.pos;
  }

  /// The lower bound of the selection's main range.
  get from() {
    return this.$from.pos;
  }

  /// The upper bound of the selection's main range.
  get to() {
    return this.$to.pos;
  }

  /// The resolved lower  bound of the selection's main range.
  get $from() {
    return this.ranges[0].$from;
  }

  /// The resolved upper bound of the selection's main range.
  get $to() {
    return this.ranges[0].$to;
  }

  /// Indicates whether the selection contains any content.
  get empty() {
    let ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) if (ranges[i].$from.pos != ranges[i].$to.pos) return false;
    return true;
  }

  /// Test whether the selection is the same as another selection.

  /// Map this selection through a [mappable](#transform.Mappable)
  /// thing. `doc` should be the new document to which we are mapping.

  /// Get the content of this selection as a slice.
  content() {
    return this.$from.doc.slice(this.from, this.to, true);
  }

  /// Replace the selection with a slice or, if no slice is given,
  /// delete the selection. Will append to the given transaction.
  replace(tr, content = _prosemirrorModel.Slice.empty) {
    // Put the new selection at the position after the inserted
    // content. When that ended in an inline node, search backwards,
    // to get the position after that node. If not, search forward.
    let lastNode = content.content.lastChild,
      lastParent = null;
    for (let i = 0; i < content.openEnd; i++) {
      lastParent = lastNode;
      lastNode = lastNode.lastChild;
    }
    let mapFrom = tr.steps.length,
      ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) {
      let {
          $from,
          $to
        } = ranges[i],
        mapping = tr.mapping.slice(mapFrom);
      tr.replaceRange(mapping.map($from.pos), mapping.map($to.pos), i ? _prosemirrorModel.Slice.empty : content);
      if (i == 0) selectionToInsertionEnd(tr, mapFrom, (lastNode ? lastNode.isInline : lastParent && lastParent.isTextblock) ? -1 : 1);
    }
  }

  /// Replace the selection with the given node, appending the changes
  /// to the given transaction.
  replaceWith(tr, node) {
    let mapFrom = tr.steps.length,
      ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) {
      let {
          $from,
          $to
        } = ranges[i],
        mapping = tr.mapping.slice(mapFrom);
      let from = mapping.map($from.pos),
        to = mapping.map($to.pos);
      if (i) {
        tr.deleteRange(from, to);
      } else {
        tr.replaceRangeWith(from, to, node);
        selectionToInsertionEnd(tr, mapFrom, node.isInline ? -1 : 1);
      }
    }
  }

  /// Convert the selection to a JSON representation. When implementing
  /// this for a custom selection class, make sure to give the object a
  /// `type` property whose value matches the ID under which you
  /// [registered](#state.Selection^jsonID) your class.

  /// Find a valid cursor or leaf node selection starting at the given
  /// position and searching back if `dir` is negative, and forward if
  /// positive. When `textOnly` is true, only consider cursor
  /// selections. Will return null when no valid selection position is
  /// found.
  static findFrom($pos, dir, textOnly = false) {
    let inner = $pos.parent.inlineContent ? new TextSelection($pos) : findSelectionIn($pos.node(0), $pos.parent, $pos.pos, $pos.index(), dir, textOnly);
    if (inner) return inner;
    for (let depth = $pos.depth - 1; depth >= 0; depth--) {
      let found = dir < 0 ? findSelectionIn($pos.node(0), $pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, textOnly) : findSelectionIn($pos.node(0), $pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, textOnly);
      if (found) return found;
    }
    return null;
  }

  /// Find a valid cursor or leaf node selection near the given
  /// position. Searches forward first by default, but if `bias` is
  /// negative, it will search backwards first.
  static near($pos, bias = 1) {
    return this.findFrom($pos, bias) || this.findFrom($pos, -bias) || new AllSelection($pos.node(0));
  }

  /// Find the cursor or leaf node selection closest to the start of
  /// the given document. Will return an
  /// [`AllSelection`](#state.AllSelection) if no valid position
  /// exists.
  static atStart(doc) {
    return findSelectionIn(doc, doc, 0, 0, 1) || new AllSelection(doc);
  }

  /// Find the cursor or leaf node selection closest to the end of the
  /// given document.
  static atEnd(doc) {
    return findSelectionIn(doc, doc, doc.content.size, doc.childCount, -1) || new AllSelection(doc);
  }

  /// Deserialize the JSON representation of a selection. Must be
  /// implemented for custom classes (as a static class method).
  static fromJSON(doc, json) {
    if (!json || !json.type) throw new RangeError("Invalid input for Selection.fromJSON");
    let cls = classesById[json.type];
    if (!cls) throw new RangeError(`No selection type ${json.type} defined`);
    return cls.fromJSON(doc, json);
  }

  /// To be able to deserialize selections from JSON, custom selection
  /// classes must register themselves with an ID string, so that they
  /// can be disambiguated. Try to pick something that's unlikely to
  /// clash with classes from other modules.
  static jsonID(id, selectionClass) {
    if (id in classesById) throw new RangeError("Duplicate use of selection JSON ID " + id);
    classesById[id] = selectionClass;
    selectionClass.prototype.jsonID = id;
    return selectionClass;
  }

  /// Get a [bookmark](#state.SelectionBookmark) for this selection,
  /// which is a value that can be mapped without having access to a
  /// current document, and later resolved to a real selection for a
  /// given document again. (This is used mostly by the history to
  /// track and restore old selections.) The default implementation of
  /// this method just converts the selection to a text selection and
  /// returns the bookmark for that.
  getBookmark() {
    return TextSelection.between(this.$anchor, this.$head).getBookmark();
  }

  /// Controls whether, when a selection of this type is active in the
  /// browser, the selected range should be visible to the user.
  /// Defaults to `true`.
}
exports.Selection = Selection;
Selection.prototype.visible = true;

/// A lightweight, document-independent representation of a selection.
/// You can define a custom bookmark type for a custom selection class
/// to make the history handle it well.

/// Represents a selected range in a document.
class SelectionRange {
  /// Create a range.
  constructor(
  /// The lower bound of the range.
  $from,
  /// The upper bound of the range.
  $to) {
    this.$from = $from;
    this.$to = $to;
  }
}
exports.SelectionRange = SelectionRange;
let warnedAboutTextSelection = false;
function checkTextSelection($pos) {
  if (!warnedAboutTextSelection && !$pos.parent.inlineContent) {
    warnedAboutTextSelection = true;
    console["warn"]("TextSelection endpoint not pointing into a node with inline content (" + $pos.parent.type.name + ")");
  }
}

/// A text selection represents a classical editor selection, with a
/// head (the moving side) and anchor (immobile side), both of which
/// point into textblock nodes. It can be empty (a regular cursor
/// position).
class TextSelection extends Selection {
  /// Construct a text selection between the given points.
  constructor($anchor, $head = $anchor) {
    checkTextSelection($anchor);
    checkTextSelection($head);
    super($anchor, $head);
  }

  /// Returns a resolved position if this is a cursor selection (an
  /// empty text selection), and null otherwise.
  get $cursor() {
    return this.$anchor.pos == this.$head.pos ? this.$head : null;
  }
  map(doc, mapping) {
    let $head = doc.resolve(mapping.map(this.head));
    if (!$head.parent.inlineContent) return Selection.near($head);
    let $anchor = doc.resolve(mapping.map(this.anchor));
    return new TextSelection($anchor.parent.inlineContent ? $anchor : $head, $head);
  }
  replace(tr, content = _prosemirrorModel.Slice.empty) {
    super.replace(tr, content);
    if (content == _prosemirrorModel.Slice.empty) {
      let marks = this.$from.marksAcross(this.$to);
      if (marks) tr.ensureMarks(marks);
    }
  }
  eq(other) {
    return other instanceof TextSelection && other.anchor == this.anchor && other.head == this.head;
  }
  getBookmark() {
    return new TextBookmark(this.anchor, this.head);
  }
  toJSON() {
    return {
      type: "text",
      anchor: this.anchor,
      head: this.head
    };
  }

  /// @internal
  static fromJSON(doc, json) {
    if (typeof json.anchor != "number" || typeof json.head != "number") throw new RangeError("Invalid input for TextSelection.fromJSON");
    return new TextSelection(doc.resolve(json.anchor), doc.resolve(json.head));
  }

  /// Create a text selection from non-resolved positions.
  static create(doc, anchor, head = anchor) {
    let $anchor = doc.resolve(anchor);
    return new this($anchor, head == anchor ? $anchor : doc.resolve(head));
  }

  /// Return a text selection that spans the given positions or, if
  /// they aren't text positions, find a text selection near them.
  /// `bias` determines whether the method searches forward (default)
  /// or backwards (negative number) first. Will fall back to calling
  /// [`Selection.near`](#state.Selection^near) when the document
  /// doesn't contain a valid text position.
  static between($anchor, $head, bias) {
    let dPos = $anchor.pos - $head.pos;
    if (!bias || dPos) bias = dPos >= 0 ? 1 : -1;
    if (!$head.parent.inlineContent) {
      let found = Selection.findFrom($head, bias, true) || Selection.findFrom($head, -bias, true);
      if (found) $head = found.$head;else return Selection.near($head, bias);
    }
    if (!$anchor.parent.inlineContent) {
      if (dPos == 0) {
        $anchor = $head;
      } else {
        $anchor = (Selection.findFrom($anchor, -bias, true) || Selection.findFrom($anchor, bias, true)).$anchor;
        if ($anchor.pos < $head.pos != dPos < 0) $anchor = $head;
      }
    }
    return new TextSelection($anchor, $head);
  }
}
exports.TextSelection = TextSelection;
Selection.jsonID("text", TextSelection);
class TextBookmark {
  constructor(anchor, head) {
    this.anchor = anchor;
    this.head = head;
  }
  map(mapping) {
    return new TextBookmark(mapping.map(this.anchor), mapping.map(this.head));
  }
  resolve(doc) {
    return TextSelection.between(doc.resolve(this.anchor), doc.resolve(this.head));
  }
}

/// A node selection is a selection that points at a single node. All
/// nodes marked [selectable](#model.NodeSpec.selectable) can be the
/// target of a node selection. In such a selection, `from` and `to`
/// point directly before and after the selected node, `anchor` equals
/// `from`, and `head` equals `to`..
class NodeSelection extends Selection {
  /// Create a node selection. Does not verify the validity of its
  /// argument.
  constructor($pos) {
    let node = $pos.nodeAfter;
    let $end = $pos.node(0).resolve($pos.pos + node.nodeSize);
    super($pos, $end);
    /// The selected node.
    this.node = void 0;
    this.node = node;
  }
  map(doc, mapping) {
    let {
      deleted,
      pos
    } = mapping.mapResult(this.anchor);
    let $pos = doc.resolve(pos);
    if (deleted) return Selection.near($pos);
    return new NodeSelection($pos);
  }
  content() {
    return new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(this.node), 0, 0);
  }
  eq(other) {
    return other instanceof NodeSelection && other.anchor == this.anchor;
  }
  toJSON() {
    return {
      type: "node",
      anchor: this.anchor
    };
  }
  getBookmark() {
    return new NodeBookmark(this.anchor);
  }

  /// @internal
  static fromJSON(doc, json) {
    if (typeof json.anchor != "number") throw new RangeError("Invalid input for NodeSelection.fromJSON");
    return new NodeSelection(doc.resolve(json.anchor));
  }

  /// Create a node selection from non-resolved positions.
  static create(doc, from) {
    return new NodeSelection(doc.resolve(from));
  }

  /// Determines whether the given node may be selected as a node
  /// selection.
  static isSelectable(node) {
    return !node.isText && node.type.spec.selectable !== false;
  }
}
exports.NodeSelection = NodeSelection;
NodeSelection.prototype.visible = false;
Selection.jsonID("node", NodeSelection);
class NodeBookmark {
  constructor(anchor) {
    this.anchor = anchor;
  }
  map(mapping) {
    let {
      deleted,
      pos
    } = mapping.mapResult(this.anchor);
    return deleted ? new TextBookmark(pos, pos) : new NodeBookmark(pos);
  }
  resolve(doc) {
    let $pos = doc.resolve(this.anchor),
      node = $pos.nodeAfter;
    if (node && NodeSelection.isSelectable(node)) return new NodeSelection($pos);
    return Selection.near($pos);
  }
}

/// A selection type that represents selecting the whole document
/// (which can not necessarily be expressed with a text selection, when
/// there are for example leaf block nodes at the start or end of the
/// document).
class AllSelection extends Selection {
  /// Create an all-selection over the given document.
  constructor(doc) {
    super(doc.resolve(0), doc.resolve(doc.content.size));
  }
  replace(tr, content = _prosemirrorModel.Slice.empty) {
    if (content == _prosemirrorModel.Slice.empty) {
      tr.delete(0, tr.doc.content.size);
      let sel = Selection.atStart(tr.doc);
      if (!sel.eq(tr.selection)) tr.setSelection(sel);
    } else {
      super.replace(tr, content);
    }
  }
  toJSON() {
    return {
      type: "all"
    };
  }

  /// @internal
  static fromJSON(doc) {
    return new AllSelection(doc);
  }
  map(doc) {
    return new AllSelection(doc);
  }
  eq(other) {
    return other instanceof AllSelection;
  }
  getBookmark() {
    return AllBookmark;
  }
}
exports.AllSelection = AllSelection;
Selection.jsonID("all", AllSelection);
const AllBookmark = {
  map() {
    return this;
  },
  resolve(doc) {
    return new AllSelection(doc);
  }
};

// FIXME we'll need some awareness of text direction when scanning for selections

// Try to find a selection inside the given node. `pos` points at the
// position where the search starts. When `text` is true, only return
// text selections.
function findSelectionIn(doc, node, pos, index, dir, text = false) {
  if (node.inlineContent) return TextSelection.create(doc, pos);
  for (let i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    let child = node.child(i);
    if (!child.isAtom) {
      let inner = findSelectionIn(doc, child, pos + dir, dir < 0 ? child.childCount : 0, dir, text);
      if (inner) return inner;
    } else if (!text && NodeSelection.isSelectable(child)) {
      return NodeSelection.create(doc, pos - (dir < 0 ? child.nodeSize : 0));
    }
    pos += child.nodeSize * dir;
  }
  return null;
}
function selectionToInsertionEnd(tr, startLen, bias) {
  let last = tr.steps.length - 1;
  if (last < startLen) return;
  let step = tr.steps[last];
  if (!(step instanceof _prosemirrorTransform.ReplaceStep || step instanceof _prosemirrorTransform.ReplaceAroundStep)) return;
  let map = tr.mapping.maps[last],
    end;
  map.forEach((_from, _to, _newFrom, newTo) => {
    if (end == null) end = newTo;
  });
  tr.setSelection(Selection.near(tr.doc.resolve(end), bias));
}
},
"prosemirror-state/src/state.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EditorState = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _selection = __require("prosemirror-state/src/selection.ts");
var _transaction = __require("prosemirror-state/src/transaction.ts");
function bind(f, self) {
  return !self || !f ? f : f.bind(self);
}
class FieldDesc {
  constructor(name, desc, self) {
    this.name = name;
    this.init = void 0;
    this.apply = void 0;
    this.init = bind(desc.init, self);
    this.apply = bind(desc.apply, self);
  }
}
const baseFields = [new FieldDesc("doc", {
  init(config) {
    return config.doc || config.schema.topNodeType.createAndFill();
  },
  apply(tr) {
    return tr.doc;
  }
}), new FieldDesc("selection", {
  init(config, instance) {
    return config.selection || _selection.Selection.atStart(instance.doc);
  },
  apply(tr) {
    return tr.selection;
  }
}), new FieldDesc("storedMarks", {
  init(config) {
    return config.storedMarks || null;
  },
  apply(tr, _marks, _old, state) {
    return state.selection.$cursor ? tr.storedMarks : null;
  }
}), new FieldDesc("scrollToSelection", {
  init() {
    return 0;
  },
  apply(tr, prev) {
    return tr.scrolledIntoView ? prev + 1 : prev;
  }
})];

// Object wrapping the part of a state object that stays the same
// across transactions. Stored in the state's `config` property.
class Configuration {
  constructor(schema, plugins) {
    this.schema = schema;
    this.fields = void 0;
    this.plugins = [];
    this.pluginsByKey = Object.create(null);
    this.fields = baseFields.slice();
    if (plugins) plugins.forEach(plugin => {
      if (this.pluginsByKey[plugin.key]) throw new RangeError("Adding different instances of a keyed plugin (" + plugin.key + ")");
      this.plugins.push(plugin);
      this.pluginsByKey[plugin.key] = plugin;
      if (plugin.spec.state) this.fields.push(new FieldDesc(plugin.key, plugin.spec.state, plugin));
    });
  }
}

/// The type of object passed to
/// [`EditorState.create`](#state.EditorState^create).

/// The state of a ProseMirror editor is represented by an object of
/// this type. A state is a persistent data structure—it isn't
/// updated, but rather a new state value is computed from an old one
/// using the [`apply`](#state.EditorState.apply) method.
///
/// A state holds a number of built-in fields, and plugins can
/// [define](#state.PluginSpec.state) additional fields.
class EditorState {
  /// @internal
  constructor(
  /// @internal
  config) {
    this.config = config;
  }

  /// The current document.

  /// The selection.

  /// A set of marks to apply to the next input. Will be null when
  /// no explicit marks have been set.

  /// The schema of the state's document.
  get schema() {
    return this.config.schema;
  }

  /// The plugins that are active in this state.
  get plugins() {
    return this.config.plugins;
  }

  /// Apply the given transaction to produce a new state.
  apply(tr) {
    return this.applyTransaction(tr).state;
  }

  /// @internal
  filterTransaction(tr, ignore = -1) {
    for (let i = 0; i < this.config.plugins.length; i++) if (i != ignore) {
      let plugin = this.config.plugins[i];
      if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction.call(plugin, tr, this)) return false;
    }
    return true;
  }

  /// Verbose variant of [`apply`](#state.EditorState.apply) that
  /// returns the precise transactions that were applied (which might
  /// be influenced by the [transaction
  /// hooks](#state.PluginSpec.filterTransaction) of
  /// plugins) along with the new state.
  applyTransaction(rootTr) {
    if (!this.filterTransaction(rootTr)) return {
      state: this,
      transactions: []
    };
    let trs = [rootTr],
      newState = this.applyInner(rootTr),
      seen = null;
    // This loop repeatedly gives plugins a chance to respond to
    // transactions as new transactions are added, making sure to only
    // pass the transactions the plugin did not see before.
    for (;;) {
      let haveNew = false;
      for (let i = 0; i < this.config.plugins.length; i++) {
        let plugin = this.config.plugins[i];
        if (plugin.spec.appendTransaction) {
          let n = seen ? seen[i].n : 0,
            oldState = seen ? seen[i].state : this;
          let tr = n < trs.length && plugin.spec.appendTransaction.call(plugin, n ? trs.slice(n) : trs, oldState, newState);
          if (tr && newState.filterTransaction(tr, i)) {
            tr.setMeta("appendedTransaction", rootTr);
            if (!seen) {
              seen = [];
              for (let j = 0; j < this.config.plugins.length; j++) seen.push(j < i ? {
                state: newState,
                n: trs.length
              } : {
                state: this,
                n: 0
              });
            }
            trs.push(tr);
            newState = newState.applyInner(tr);
            haveNew = true;
          }
          if (seen) seen[i] = {
            state: newState,
            n: trs.length
          };
        }
      }
      if (!haveNew) return {
        state: newState,
        transactions: trs
      };
    }
  }

  /// @internal
  applyInner(tr) {
    if (!tr.before.eq(this.doc)) throw new RangeError("Applying a mismatched transaction");
    let newInstance = new EditorState(this.config),
      fields = this.config.fields;
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      newInstance[field.name] = field.apply(tr, this[field.name], this, newInstance);
    }
    return newInstance;
  }

  /// Accessor that constructs and returns a new [transaction](#state.Transaction) from this state.
  get tr() {
    return new _transaction.Transaction(this);
  }

  /// Create a new state.
  static create(config) {
    let $config = new Configuration(config.doc ? config.doc.type.schema : config.schema, config.plugins);
    let instance = new EditorState($config);
    for (let i = 0; i < $config.fields.length; i++) instance[$config.fields[i].name] = $config.fields[i].init(config, instance);
    return instance;
  }

  /// Create a new state based on this one, but with an adjusted set
  /// of active plugins. State fields that exist in both sets of
  /// plugins are kept unchanged. Those that no longer exist are
  /// dropped, and those that are new are initialized using their
  /// [`init`](#state.StateField.init) method, passing in the new
  /// configuration object..
  reconfigure(config) {
    let $config = new Configuration(this.schema, config.plugins);
    let fields = $config.fields,
      instance = new EditorState($config);
    for (let i = 0; i < fields.length; i++) {
      let name = fields[i].name;
      instance[name] = this.hasOwnProperty(name) ? this[name] : fields[i].init(config, instance);
    }
    return instance;
  }

  /// Serialize this state to JSON. If you want to serialize the state
  /// of plugins, pass an object mapping property names to use in the
  /// resulting JSON object to plugin objects. The argument may also be
  /// a string or number, in which case it is ignored, to support the
  /// way `JSON.stringify` calls `toString` methods.
  toJSON(pluginFields) {
    let result = {
      doc: this.doc.toJSON(),
      selection: this.selection.toJSON()
    };
    if (this.storedMarks) result.storedMarks = this.storedMarks.map(m => m.toJSON());
    if (pluginFields && typeof pluginFields == 'object') for (let prop in pluginFields) {
      if (prop == "doc" || prop == "selection") throw new RangeError("The JSON fields `doc` and `selection` are reserved");
      let plugin = pluginFields[prop],
        state = plugin.spec.state;
      if (state && state.toJSON) result[prop] = state.toJSON.call(plugin, this[plugin.key]);
    }
    return result;
  }

  /// Deserialize a JSON representation of a state. `config` should
  /// have at least a `schema` field, and should contain array of
  /// plugins to initialize the state with. `pluginFields` can be used
  /// to deserialize the state of plugins, by associating plugin
  /// instances with the property names they use in the JSON object.
  static fromJSON(config, json, pluginFields) {
    if (!json) throw new RangeError("Invalid input for EditorState.fromJSON");
    if (!config.schema) throw new RangeError("Required config field 'schema' missing");
    let $config = new Configuration(config.schema, config.plugins);
    let instance = new EditorState($config);
    $config.fields.forEach(field => {
      if (field.name == "doc") {
        instance.doc = _prosemirrorModel.Node.fromJSON(config.schema, json.doc);
      } else if (field.name == "selection") {
        instance.selection = _selection.Selection.fromJSON(instance.doc, json.selection);
      } else if (field.name == "storedMarks") {
        if (json.storedMarks) instance.storedMarks = json.storedMarks.map(config.schema.markFromJSON);
      } else {
        if (pluginFields) for (let prop in pluginFields) {
          let plugin = pluginFields[prop],
            state = plugin.spec.state;
          if (plugin.key == field.name && state && state.fromJSON && Object.prototype.hasOwnProperty.call(json, prop)) {
            // This field belongs to a plugin mapped to a JSON field, read it from there.
            ;
            instance[field.name] = state.fromJSON.call(plugin, config, json[prop], instance);
            return;
          }
        }
        ;
        instance[field.name] = field.init(config, instance);
      }
    });
    return instance;
  }
}
exports.EditorState = EditorState;
},
"prosemirror-state/src/transaction.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Transaction = void 0;
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _selection = __require("prosemirror-state/src/selection.ts");
/// Commands are functions that take a state and a an optional
/// transaction dispatch function and...
///
///  - determine whether they apply to this state
///  - if not, return false
///  - if `dispatch` was passed, perform their effect, possibly by
///    passing a transaction to `dispatch`
///  - return true
///
/// In some cases, the editor view is passed as a third argument.

const UPDATED_SEL = 1,
  UPDATED_MARKS = 2,
  UPDATED_SCROLL = 4;

/// An editor state transaction, which can be applied to a state to
/// create an updated state. Use
/// [`EditorState.tr`](#state.EditorState.tr) to create an instance.
///
/// Transactions track changes to the document (they are a subclass of
/// [`Transform`](#transform.Transform)), but also other state changes,
/// like selection updates and adjustments of the set of [stored
/// marks](#state.EditorState.storedMarks). In addition, you can store
/// metadata properties in a transaction, which are extra pieces of
/// information that client code or plugins can use to describe what a
/// transaction represents, so that they can update their [own
/// state](#state.StateField) accordingly.
///
/// The [editor view](#view.EditorView) uses a few metadata
/// properties: it will attach a property `"pointer"` with the value
/// `true` to selection transactions directly caused by mouse or touch
/// input, a `"composition"` property holding an ID identifying the
/// composition that caused it to transactions caused by composed DOM
/// input, and a `"uiEvent"` property of that may be `"paste"`,
/// `"cut"`, or `"drop"`.
class Transaction extends _prosemirrorTransform.Transform {
  /// @internal
  constructor(state) {
    super(state.doc);
    /// The timestamp associated with this transaction, in the same
    /// format as `Date.now()`.
    this.time = void 0;
    this.curSelection = void 0;
    // The step count for which the current selection is valid.
    this.curSelectionFor = 0;
    // Bitfield to track which aspects of the state were updated by
    // this transaction.
    this.updated = 0;
    // Object used to store metadata properties for the transaction.
    this.meta = Object.create(null);
    /// The stored marks set by this transaction, if any.
    this.storedMarks = void 0;
    this.time = Date.now();
    this.curSelection = state.selection;
    this.storedMarks = state.storedMarks;
  }

  /// The transaction's current selection. This defaults to the editor
  /// selection [mapped](#state.Selection.map) through the steps in the
  /// transaction, but can be overwritten with
  /// [`setSelection`](#state.Transaction.setSelection).
  get selection() {
    if (this.curSelectionFor < this.steps.length) {
      this.curSelection = this.curSelection.map(this.doc, this.mapping.slice(this.curSelectionFor));
      this.curSelectionFor = this.steps.length;
    }
    return this.curSelection;
  }

  /// Update the transaction's current selection. Will determine the
  /// selection that the editor gets when the transaction is applied.
  setSelection(selection) {
    if (selection.$from.doc != this.doc) throw new RangeError("Selection passed to setSelection must point at the current document");
    this.curSelection = selection;
    this.curSelectionFor = this.steps.length;
    this.updated = (this.updated | UPDATED_SEL) & ~UPDATED_MARKS;
    this.storedMarks = null;
    return this;
  }

  /// Whether the selection was explicitly updated by this transaction.
  get selectionSet() {
    return (this.updated & UPDATED_SEL) > 0;
  }

  /// Set the current stored marks.
  setStoredMarks(marks) {
    this.storedMarks = marks;
    this.updated |= UPDATED_MARKS;
    return this;
  }

  /// Make sure the current stored marks or, if that is null, the marks
  /// at the selection, match the given set of marks. Does nothing if
  /// this is already the case.
  ensureMarks(marks) {
    if (!_prosemirrorModel.Mark.sameSet(this.storedMarks || this.selection.$from.marks(), marks)) this.setStoredMarks(marks);
    return this;
  }

  /// Add a mark to the set of stored marks.
  addStoredMark(mark) {
    return this.ensureMarks(mark.addToSet(this.storedMarks || this.selection.$head.marks()));
  }

  /// Remove a mark or mark type from the set of stored marks.
  removeStoredMark(mark) {
    return this.ensureMarks(mark.removeFromSet(this.storedMarks || this.selection.$head.marks()));
  }

  /// Whether the stored marks were explicitly set for this transaction.
  get storedMarksSet() {
    return (this.updated & UPDATED_MARKS) > 0;
  }

  /// @internal
  addStep(step, doc) {
    super.addStep(step, doc);
    this.updated = this.updated & ~UPDATED_MARKS;
    this.storedMarks = null;
  }

  /// Update the timestamp for the transaction.
  setTime(time) {
    this.time = time;
    return this;
  }

  /// Replace the current selection with the given slice.
  replaceSelection(slice) {
    this.selection.replace(this, slice);
    return this;
  }

  /// Replace the selection with the given node. When `inheritMarks` is
  /// true and the content is inline, it inherits the marks from the
  /// place where it is inserted.
  replaceSelectionWith(node, inheritMarks = true) {
    let selection = this.selection;
    if (inheritMarks) node = node.mark(this.storedMarks || (selection.empty ? selection.$from.marks() : selection.$from.marksAcross(selection.$to) || _prosemirrorModel.Mark.none));
    selection.replaceWith(this, node);
    return this;
  }

  /// Delete the selection.
  deleteSelection() {
    this.selection.replace(this);
    return this;
  }

  /// Replace the given range, or the selection if no range is given,
  /// with a text node containing the given string.
  insertText(text, from, to) {
    let schema = this.doc.type.schema;
    if (from == null) {
      if (!text) return this.deleteSelection();
      return this.replaceSelectionWith(schema.text(text), true);
    } else {
      if (to == null) to = from;
      if (!text) return this.deleteRange(from, to);
      let marks = this.storedMarks;
      if (!marks) {
        let $from = this.doc.resolve(from);
        marks = to == from ? $from.marks() : $from.marksAcross(this.doc.resolve(to));
      }
      this.replaceRangeWith(from, to, schema.text(text, marks));
      if (!this.selection.empty && this.selection.to == from + text.length) this.setSelection(_selection.Selection.near(this.selection.$to));
      return this;
    }
  }

  /// Store a metadata property in this transaction, keyed either by
  /// name or by plugin.
  setMeta(key, value) {
    this.meta[typeof key == "string" ? key : key.key] = value;
    return this;
  }

  /// Retrieve a metadata property for a given name or plugin.
  getMeta(key) {
    return this.meta[typeof key == "string" ? key : key.key];
  }

  /// Returns true if this transaction doesn't contain any metadata,
  /// and can thus safely be extended.
  get isGeneric() {
    for (let _ in this.meta) return false;
    return true;
  }

  /// Indicate that the editor should scroll the selection into view
  /// when updated to the state produced by this transaction.
  scrollIntoView() {
    this.updated |= UPDATED_SCROLL;
    return this;
  }

  /// True when this transaction has had `scrollIntoView` called on it.
  get scrolledIntoView() {
    return (this.updated & UPDATED_SCROLL) > 0;
  }
}
exports.Transaction = Transaction;
},
"prosemirror-transform/src/attr_step.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DocAttrStep = exports.AttrStep = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _step = __require("prosemirror-transform/src/step.ts");
var _map = __require("prosemirror-transform/src/map.ts");
/// Update an attribute in a specific node.
class AttrStep extends _step.Step {
  /// Construct an attribute step.
  constructor(
  /// The position of the target node.
  pos,
  /// The attribute to set.
  attr,
  // The attribute's new value.
  value) {
    super();
    this.pos = pos;
    this.attr = attr;
    this.value = value;
  }
  apply(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node) return _step.StepResult.fail("No node at attribute step's position");
    let attrs = Object.create(null);
    for (let name in node.attrs) attrs[name] = node.attrs[name];
    attrs[this.attr] = this.value;
    let updated = node.type.create(attrs, null, node.marks);
    return _step.StepResult.fromReplace(doc, this.pos, this.pos + 1, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(updated), 0, node.isLeaf ? 0 : 1));
  }
  getMap() {
    return _map.StepMap.empty;
  }
  invert(doc) {
    return new AttrStep(this.pos, this.attr, doc.nodeAt(this.pos).attrs[this.attr]);
  }
  map(mapping) {
    let pos = mapping.mapResult(this.pos, 1);
    return pos.deletedAfter ? null : new AttrStep(pos.pos, this.attr, this.value);
  }
  toJSON() {
    return {
      stepType: "attr",
      pos: this.pos,
      attr: this.attr,
      value: this.value
    };
  }
  static fromJSON(schema, json) {
    if (typeof json.pos != "number" || typeof json.attr != "string") throw new RangeError("Invalid input for AttrStep.fromJSON");
    return new AttrStep(json.pos, json.attr, json.value);
  }
}
exports.AttrStep = AttrStep;
_step.Step.jsonID("attr", AttrStep);

/// Update an attribute in the doc node.
class DocAttrStep extends _step.Step {
  /// Construct an attribute step.
  constructor(
  /// The attribute to set.
  attr,
  // The attribute's new value.
  value) {
    super();
    this.attr = attr;
    this.value = value;
  }
  apply(doc) {
    let attrs = Object.create(null);
    for (let name in doc.attrs) attrs[name] = doc.attrs[name];
    attrs[this.attr] = this.value;
    let updated = doc.type.create(attrs, doc.content, doc.marks);
    return _step.StepResult.ok(updated);
  }
  getMap() {
    return _map.StepMap.empty;
  }
  invert(doc) {
    return new DocAttrStep(this.attr, doc.attrs[this.attr]);
  }
  map(mapping) {
    return this;
  }
  toJSON() {
    return {
      stepType: "docAttr",
      attr: this.attr,
      value: this.value
    };
  }
  static fromJSON(schema, json) {
    if (typeof json.attr != "string") throw new RangeError("Invalid input for DocAttrStep.fromJSON");
    return new DocAttrStep(json.attr, json.value);
  }
}
exports.DocAttrStep = DocAttrStep;
_step.Step.jsonID("docAttr", DocAttrStep);
},
"prosemirror-transform/src/index.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AddMarkStep", {
  enumerable: true,
  get: function () {
    return _mark_step.AddMarkStep;
  }
});
Object.defineProperty(exports, "AddNodeMarkStep", {
  enumerable: true,
  get: function () {
    return _mark_step.AddNodeMarkStep;
  }
});
Object.defineProperty(exports, "AttrStep", {
  enumerable: true,
  get: function () {
    return _attr_step.AttrStep;
  }
});
Object.defineProperty(exports, "DocAttrStep", {
  enumerable: true,
  get: function () {
    return _attr_step.DocAttrStep;
  }
});
Object.defineProperty(exports, "MapResult", {
  enumerable: true,
  get: function () {
    return _map.MapResult;
  }
});
Object.defineProperty(exports, "Mappable", {
  enumerable: true,
  get: function () {
    return _map.Mappable;
  }
});
Object.defineProperty(exports, "Mapping", {
  enumerable: true,
  get: function () {
    return _map.Mapping;
  }
});
Object.defineProperty(exports, "RemoveMarkStep", {
  enumerable: true,
  get: function () {
    return _mark_step.RemoveMarkStep;
  }
});
Object.defineProperty(exports, "RemoveNodeMarkStep", {
  enumerable: true,
  get: function () {
    return _mark_step.RemoveNodeMarkStep;
  }
});
Object.defineProperty(exports, "ReplaceAroundStep", {
  enumerable: true,
  get: function () {
    return _replace_step.ReplaceAroundStep;
  }
});
Object.defineProperty(exports, "ReplaceStep", {
  enumerable: true,
  get: function () {
    return _replace_step.ReplaceStep;
  }
});
Object.defineProperty(exports, "Step", {
  enumerable: true,
  get: function () {
    return _step.Step;
  }
});
Object.defineProperty(exports, "StepMap", {
  enumerable: true,
  get: function () {
    return _map.StepMap;
  }
});
Object.defineProperty(exports, "StepResult", {
  enumerable: true,
  get: function () {
    return _step.StepResult;
  }
});
Object.defineProperty(exports, "Transform", {
  enumerable: true,
  get: function () {
    return _transform.Transform;
  }
});
Object.defineProperty(exports, "TransformError", {
  enumerable: true,
  get: function () {
    return _transform.TransformError;
  }
});
Object.defineProperty(exports, "canJoin", {
  enumerable: true,
  get: function () {
    return _structure.canJoin;
  }
});
Object.defineProperty(exports, "canSplit", {
  enumerable: true,
  get: function () {
    return _structure.canSplit;
  }
});
Object.defineProperty(exports, "dropPoint", {
  enumerable: true,
  get: function () {
    return _structure.dropPoint;
  }
});
Object.defineProperty(exports, "findWrapping", {
  enumerable: true,
  get: function () {
    return _structure.findWrapping;
  }
});
Object.defineProperty(exports, "insertPoint", {
  enumerable: true,
  get: function () {
    return _structure.insertPoint;
  }
});
Object.defineProperty(exports, "joinPoint", {
  enumerable: true,
  get: function () {
    return _structure.joinPoint;
  }
});
Object.defineProperty(exports, "liftTarget", {
  enumerable: true,
  get: function () {
    return _structure.liftTarget;
  }
});
Object.defineProperty(exports, "replaceStep", {
  enumerable: true,
  get: function () {
    return _replace.replaceStep;
  }
});
var _transform = __require("prosemirror-transform/src/transform.ts");
var _step = __require("prosemirror-transform/src/step.ts");
var _structure = __require("prosemirror-transform/src/structure.ts");
var _map = __require("prosemirror-transform/src/map.ts");
var _mark_step = __require("prosemirror-transform/src/mark_step.ts");
var _replace_step = __require("prosemirror-transform/src/replace_step.ts");
var _attr_step = __require("prosemirror-transform/src/attr_step.ts");
__require("prosemirror-transform/src/mark.ts");
var _replace = __require("prosemirror-transform/src/replace.ts");
},
"prosemirror-transform/src/map.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StepMap = exports.Mapping = exports.MapResult = void 0;
var _StepMap;
/// There are several things that positions can be mapped through.
/// Such objects conform to this interface.

// Recovery values encode a range index and an offset. They are
// represented as numbers, because tons of them will be created when
// mapping, for example, a large number of decorations. The number's
// lower 16 bits provide the index, the remaining bits the offset.
//
// Note: We intentionally don't use bit shift operators to en- and
// decode these, since those clip to 32 bits, which we might in rare
// cases want to overflow. A 64-bit float can represent 48-bit
// integers precisely.

const lower16 = 0xffff;
const factor16 = Math.pow(2, 16);
function makeRecover(index, offset) {
  return index + offset * factor16;
}
function recoverIndex(value) {
  return value & lower16;
}
function recoverOffset(value) {
  return (value - (value & lower16)) / factor16;
}
const DEL_BEFORE = 1,
  DEL_AFTER = 2,
  DEL_ACROSS = 4,
  DEL_SIDE = 8;

/// An object representing a mapped position with extra
/// information.
class MapResult {
  /// @internal
  constructor(
  /// The mapped version of the position.
  pos,
  /// @internal
  delInfo,
  /// @internal
  recover) {
    this.pos = pos;
    this.delInfo = delInfo;
    this.recover = recover;
  }

  /// Tells you whether the position was deleted, that is, whether the
  /// step removed the token on the side queried (via the `assoc`)
  /// argument from the document.
  get deleted() {
    return (this.delInfo & DEL_SIDE) > 0;
  }

  /// Tells you whether the token before the mapped position was deleted.
  get deletedBefore() {
    return (this.delInfo & (DEL_BEFORE | DEL_ACROSS)) > 0;
  }

  /// True when the token after the mapped position was deleted.
  get deletedAfter() {
    return (this.delInfo & (DEL_AFTER | DEL_ACROSS)) > 0;
  }

  /// Tells whether any of the steps mapped through deletes across the
  /// position (including both the token before and after the
  /// position).
  get deletedAcross() {
    return (this.delInfo & DEL_ACROSS) > 0;
  }
}

/// A map describing the deletions and insertions made by a step, which
/// can be used to find the correspondence between positions in the
/// pre-step version of a document and the same position in the
/// post-step version.
exports.MapResult = MapResult;
class StepMap {
  /// Create a position map. The modifications to the document are
  /// represented as an array of numbers, in which each group of three
  /// represents a modified chunk as `[start, oldSize, newSize]`.
  constructor(
  /// @internal
  ranges,
  /// @internal
  inverted = false) {
    this.ranges = ranges;
    this.inverted = inverted;
    if (!ranges.length && StepMap.empty) return StepMap.empty;
  }

  /// @internal
  recover(value) {
    let diff = 0,
      index = recoverIndex(value);
    if (!this.inverted) for (let i = 0; i < index; i++) diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[index * 3] + diff + recoverOffset(value);
  }
  mapResult(pos, assoc = 1) {
    return this._map(pos, assoc, false);
  }
  map(pos, assoc = 1) {
    return this._map(pos, assoc, true);
  }

  /// @internal
  _map(pos, assoc, simple) {
    let diff = 0,
      oldIndex = this.inverted ? 2 : 1,
      newIndex = this.inverted ? 1 : 2;
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos) break;
      let oldSize = this.ranges[i + oldIndex],
        newSize = this.ranges[i + newIndex],
        end = start + oldSize;
      if (pos <= end) {
        let side = !oldSize ? assoc : pos == start ? -1 : pos == end ? 1 : assoc;
        let result = start + diff + (side < 0 ? 0 : newSize);
        if (simple) return result;
        let recover = pos == (assoc < 0 ? start : end) ? null : makeRecover(i / 3, pos - start);
        let del = pos == start ? DEL_AFTER : pos == end ? DEL_BEFORE : DEL_ACROSS;
        if (assoc < 0 ? pos != start : pos != end) del |= DEL_SIDE;
        return new MapResult(result, del, recover);
      }
      diff += newSize - oldSize;
    }
    return simple ? pos + diff : new MapResult(pos + diff, 0, null);
  }

  /// @internal
  touches(pos, recover) {
    let diff = 0,
      index = recoverIndex(recover);
    let oldIndex = this.inverted ? 2 : 1,
      newIndex = this.inverted ? 1 : 2;
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos) break;
      let oldSize = this.ranges[i + oldIndex],
        end = start + oldSize;
      if (pos <= end && i == index * 3) return true;
      diff += this.ranges[i + newIndex] - oldSize;
    }
    return false;
  }

  /// Calls the given function on each of the changed ranges included in
  /// this map.
  forEach(f) {
    let oldIndex = this.inverted ? 2 : 1,
      newIndex = this.inverted ? 1 : 2;
    for (let i = 0, diff = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i],
        oldStart = start - (this.inverted ? diff : 0),
        newStart = start + (this.inverted ? 0 : diff);
      let oldSize = this.ranges[i + oldIndex],
        newSize = this.ranges[i + newIndex];
      f(oldStart, oldStart + oldSize, newStart, newStart + newSize);
      diff += newSize - oldSize;
    }
  }

  /// Create an inverted version of this map. The result can be used to
  /// map positions in the post-step document to the pre-step document.
  invert() {
    return new StepMap(this.ranges, !this.inverted);
  }

  /// @internal
  toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
  }

  /// Create a map that moves all positions by offset `n` (which may be
  /// negative). This can be useful when applying steps meant for a
  /// sub-document to a larger document, or vice-versa.
  static offset(n) {
    return n == 0 ? StepMap.empty : new StepMap(n < 0 ? [0, -n, 0] : [0, 0, n]);
  }

  /// A StepMap that contains no changed ranges.
}

/// A mapping represents a pipeline of zero or more [step
/// maps](#transform.StepMap). It has special provisions for losslessly
/// handling mapping positions through a series of steps in which some
/// steps are inverted versions of earlier steps. (This comes up when
/// ‘[rebasing](/docs/guide/#transform.rebasing)’ steps for
/// collaboration or history management.)
exports.StepMap = StepMap;
_StepMap = StepMap;
StepMap.empty = new _StepMap([]);
class Mapping {
  /// Create a new mapping with the given position maps.
  constructor(maps,
  /// @internal
  mirror,
  /// The starting position in the `maps` array, used when `map` or
  /// `mapResult` is called.
  from = 0,
  /// The end position in the `maps` array.
  to = maps ? maps.length : 0) {
    this.mirror = mirror;
    this.from = from;
    this.to = to;
    this._maps = void 0;
    // False if maps/mirror are shared arrays that we shouldn't mutate
    this.ownData = void 0;
    this._maps = maps || [];
    this.ownData = !(maps || mirror);
  }

  /// The step maps in this mapping.
  get maps() {
    return this._maps;
  }
  /// Create a mapping that maps only through a part of this one.
  slice(from = 0, to = this.maps.length) {
    return new Mapping(this._maps, this.mirror, from, to);
  }

  /// Add a step map to the end of this mapping. If `mirrors` is
  /// given, it should be the index of the step map that is the mirror
  /// image of this one.
  appendMap(map, mirrors) {
    if (!this.ownData) {
      this._maps = this._maps.slice();
      this.mirror = this.mirror && this.mirror.slice();
      this.ownData = true;
    }
    this.to = this._maps.push(map);
    if (mirrors != null) this.setMirror(this._maps.length - 1, mirrors);
  }

  /// Add all the step maps in a given mapping to this one (preserving
  /// mirroring information).
  appendMapping(mapping) {
    for (let i = 0, startSize = this._maps.length; i < mapping._maps.length; i++) {
      let mirr = mapping.getMirror(i);
      this.appendMap(mapping._maps[i], mirr != null && mirr < i ? startSize + mirr : undefined);
    }
  }

  /// Finds the offset of the step map that mirrors the map at the
  /// given offset, in this mapping (as per the second argument to
  /// `appendMap`).
  getMirror(n) {
    if (this.mirror) for (let i = 0; i < this.mirror.length; i++) if (this.mirror[i] == n) return this.mirror[i + (i % 2 ? -1 : 1)];
  }

  /// @internal
  setMirror(n, m) {
    if (!this.mirror) this.mirror = [];
    this.mirror.push(n, m);
  }

  /// Append the inverse of the given mapping to this one.
  appendMappingInverted(mapping) {
    for (let i = mapping.maps.length - 1, totalSize = this._maps.length + mapping._maps.length; i >= 0; i--) {
      let mirr = mapping.getMirror(i);
      this.appendMap(mapping._maps[i].invert(), mirr != null && mirr > i ? totalSize - mirr - 1 : undefined);
    }
  }

  /// Create an inverted version of this mapping.
  invert() {
    let inverse = new Mapping();
    inverse.appendMappingInverted(this);
    return inverse;
  }

  /// Map a position through this mapping.
  map(pos, assoc = 1) {
    if (this.mirror) return this._map(pos, assoc, true);
    for (let i = this.from; i < this.to; i++) pos = this._maps[i].map(pos, assoc);
    return pos;
  }

  /// Map a position through this mapping, returning a mapping
  /// result.
  mapResult(pos, assoc = 1) {
    return this._map(pos, assoc, false);
  }

  /// @internal
  _map(pos, assoc, simple) {
    let delInfo = 0;
    for (let i = this.from; i < this.to; i++) {
      let map = this._maps[i],
        result = map.mapResult(pos, assoc);
      if (result.recover != null) {
        let corr = this.getMirror(i);
        if (corr != null && corr > i && corr < this.to) {
          i = corr;
          pos = this._maps[corr].recover(result.recover);
          continue;
        }
      }
      delInfo |= result.delInfo;
      pos = result.pos;
    }
    return simple ? pos : new MapResult(pos, delInfo, null);
  }
}
exports.Mapping = Mapping;
},
"prosemirror-transform/src/mark_step.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RemoveNodeMarkStep = exports.RemoveMarkStep = exports.AddNodeMarkStep = exports.AddMarkStep = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _step = __require("prosemirror-transform/src/step.ts");
function mapFragment(fragment, f, parent) {
  let mapped = [];
  for (let i = 0; i < fragment.childCount; i++) {
    let child = fragment.child(i);
    if (child.content.size) child = child.copy(mapFragment(child.content, f, child));
    if (child.isInline) child = f(child, parent, i);
    mapped.push(child);
  }
  return _prosemirrorModel.Fragment.fromArray(mapped);
}

/// Add a mark to all inline content between two positions.
class AddMarkStep extends _step.Step {
  /// Create a mark step.
  constructor(
  /// The start of the marked range.
  from,
  /// The end of the marked range.
  to,
  /// The mark to add.
  mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }
  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to),
      $from = doc.resolve(this.from);
    let parent = $from.node($from.sharedDepth(this.to));
    let slice = new _prosemirrorModel.Slice(mapFragment(oldSlice.content, (node, parent) => {
      if (!node.isAtom || !parent.type.allowsMarkType(this.mark.type)) return node;
      return node.mark(this.mark.addToSet(node.marks));
    }, parent), oldSlice.openStart, oldSlice.openEnd);
    return _step.StepResult.fromReplace(doc, this.from, this.to, slice);
  }
  invert() {
    return new RemoveMarkStep(this.from, this.to, this.mark);
  }
  map(mapping) {
    let from = mapping.mapResult(this.from, 1),
      to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos) return null;
    return new AddMarkStep(from.pos, to.pos, this.mark);
  }
  merge(other) {
    if (other instanceof AddMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from) return new AddMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark);
    return null;
  }
  toJSON() {
    return {
      stepType: "addMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }

  /// @internal
  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number") throw new RangeError("Invalid input for AddMarkStep.fromJSON");
    return new AddMarkStep(json.from, json.to, schema.markFromJSON(json.mark));
  }
}
exports.AddMarkStep = AddMarkStep;
_step.Step.jsonID("addMark", AddMarkStep);

/// Remove a mark from all inline content between two positions.
class RemoveMarkStep extends _step.Step {
  /// Create a mark-removing step.
  constructor(
  /// The start of the unmarked range.
  from,
  /// The end of the unmarked range.
  to,
  /// The mark to remove.
  mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }
  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to);
    let slice = new _prosemirrorModel.Slice(mapFragment(oldSlice.content, node => {
      return node.mark(this.mark.removeFromSet(node.marks));
    }, doc), oldSlice.openStart, oldSlice.openEnd);
    return _step.StepResult.fromReplace(doc, this.from, this.to, slice);
  }
  invert() {
    return new AddMarkStep(this.from, this.to, this.mark);
  }
  map(mapping) {
    let from = mapping.mapResult(this.from, 1),
      to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos) return null;
    return new RemoveMarkStep(from.pos, to.pos, this.mark);
  }
  merge(other) {
    if (other instanceof RemoveMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from) return new RemoveMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark);
    return null;
  }
  toJSON() {
    return {
      stepType: "removeMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }

  /// @internal
  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number") throw new RangeError("Invalid input for RemoveMarkStep.fromJSON");
    return new RemoveMarkStep(json.from, json.to, schema.markFromJSON(json.mark));
  }
}
exports.RemoveMarkStep = RemoveMarkStep;
_step.Step.jsonID("removeMark", RemoveMarkStep);

/// Add a mark to a specific node.
class AddNodeMarkStep extends _step.Step {
  /// Create a node mark step.
  constructor(
  /// The position of the target node.
  pos,
  /// The mark to add.
  mark) {
    super();
    this.pos = pos;
    this.mark = mark;
  }
  apply(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node) return _step.StepResult.fail("No node at mark step's position");
    let updated = node.type.create(node.attrs, null, this.mark.addToSet(node.marks));
    return _step.StepResult.fromReplace(doc, this.pos, this.pos + 1, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(updated), 0, node.isLeaf ? 0 : 1));
  }
  invert(doc) {
    let node = doc.nodeAt(this.pos);
    if (node) {
      let newSet = this.mark.addToSet(node.marks);
      if (newSet.length == node.marks.length) {
        for (let i = 0; i < node.marks.length; i++) if (!node.marks[i].isInSet(newSet)) return new AddNodeMarkStep(this.pos, node.marks[i]);
        return new AddNodeMarkStep(this.pos, this.mark);
      }
    }
    return new RemoveNodeMarkStep(this.pos, this.mark);
  }
  map(mapping) {
    let pos = mapping.mapResult(this.pos, 1);
    return pos.deletedAfter ? null : new AddNodeMarkStep(pos.pos, this.mark);
  }
  toJSON() {
    return {
      stepType: "addNodeMark",
      pos: this.pos,
      mark: this.mark.toJSON()
    };
  }

  /// @internal
  static fromJSON(schema, json) {
    if (typeof json.pos != "number") throw new RangeError("Invalid input for AddNodeMarkStep.fromJSON");
    return new AddNodeMarkStep(json.pos, schema.markFromJSON(json.mark));
  }
}
exports.AddNodeMarkStep = AddNodeMarkStep;
_step.Step.jsonID("addNodeMark", AddNodeMarkStep);

/// Remove a mark from a specific node.
class RemoveNodeMarkStep extends _step.Step {
  /// Create a mark-removing step.
  constructor(
  /// The position of the target node.
  pos,
  /// The mark to remove.
  mark) {
    super();
    this.pos = pos;
    this.mark = mark;
  }
  apply(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node) return _step.StepResult.fail("No node at mark step's position");
    let updated = node.type.create(node.attrs, null, this.mark.removeFromSet(node.marks));
    return _step.StepResult.fromReplace(doc, this.pos, this.pos + 1, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(updated), 0, node.isLeaf ? 0 : 1));
  }
  invert(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node || !this.mark.isInSet(node.marks)) return this;
    return new AddNodeMarkStep(this.pos, this.mark);
  }
  map(mapping) {
    let pos = mapping.mapResult(this.pos, 1);
    return pos.deletedAfter ? null : new RemoveNodeMarkStep(pos.pos, this.mark);
  }
  toJSON() {
    return {
      stepType: "removeNodeMark",
      pos: this.pos,
      mark: this.mark.toJSON()
    };
  }

  /// @internal
  static fromJSON(schema, json) {
    if (typeof json.pos != "number") throw new RangeError("Invalid input for RemoveNodeMarkStep.fromJSON");
    return new RemoveNodeMarkStep(json.pos, schema.markFromJSON(json.mark));
  }
}
exports.RemoveNodeMarkStep = RemoveNodeMarkStep;
_step.Step.jsonID("removeNodeMark", RemoveNodeMarkStep);
},
"prosemirror-transform/src/mark.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addMark = addMark;
exports.clearIncompatible = clearIncompatible;
exports.removeMark = removeMark;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _mark_step = __require("prosemirror-transform/src/mark_step.ts");
var _replace_step = __require("prosemirror-transform/src/replace_step.ts");
function addMark(tr, from, to, mark) {
  let removed = [],
    added = [];
  let removing, adding;
  tr.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline) return;
    let marks = node.marks;
    if (!mark.isInSet(marks) && parent.type.allowsMarkType(mark.type)) {
      let start = Math.max(pos, from),
        end = Math.min(pos + node.nodeSize, to);
      let newSet = mark.addToSet(marks);
      for (let i = 0; i < marks.length; i++) {
        if (!marks[i].isInSet(newSet)) {
          if (removing && removing.to == start && removing.mark.eq(marks[i])) removing.to = end;else removed.push(removing = new _mark_step.RemoveMarkStep(start, end, marks[i]));
        }
      }
      if (adding && adding.to == start) adding.to = end;else added.push(adding = new _mark_step.AddMarkStep(start, end, mark));
    }
  });
  removed.forEach(s => tr.step(s));
  added.forEach(s => tr.step(s));
}
function removeMark(tr, from, to, mark) {
  let matched = [],
    step = 0;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return;
    step++;
    let toRemove = null;
    if (mark instanceof _prosemirrorModel.MarkType) {
      let set = node.marks,
        found;
      while (found = mark.isInSet(set)) {
        ;
        (toRemove || (toRemove = [])).push(found);
        set = found.removeFromSet(set);
      }
    } else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark];
    } else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      let end = Math.min(pos + node.nodeSize, to);
      for (let i = 0; i < toRemove.length; i++) {
        let style = toRemove[i],
          found;
        for (let j = 0; j < matched.length; j++) {
          let m = matched[j];
          if (m.step == step - 1 && style.eq(matched[j].style)) found = m;
        }
        if (found) {
          found.to = end;
          found.step = step;
        } else {
          matched.push({
            style,
            from: Math.max(pos, from),
            to: end,
            step
          });
        }
      }
    }
  });
  matched.forEach(m => tr.step(new _mark_step.RemoveMarkStep(m.from, m.to, m.style)));
}
function clearIncompatible(tr, pos, parentType, match = parentType.contentMatch, clearNewlines = true) {
  let node = tr.doc.nodeAt(pos);
  let replSteps = [],
    cur = pos + 1;
  for (let i = 0; i < node.childCount; i++) {
    let child = node.child(i),
      end = cur + child.nodeSize;
    let allowed = match.matchType(child.type);
    if (!allowed) {
      replSteps.push(new _replace_step.ReplaceStep(cur, end, _prosemirrorModel.Slice.empty));
    } else {
      match = allowed;
      for (let j = 0; j < child.marks.length; j++) if (!parentType.allowsMarkType(child.marks[j].type)) tr.step(new _mark_step.RemoveMarkStep(cur, end, child.marks[j]));
      if (clearNewlines && child.isText && parentType.whitespace != "pre") {
        let m,
          newline = /\r?\n|\r/g,
          slice;
        while (m = newline.exec(child.text)) {
          if (!slice) slice = new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(parentType.schema.text(" ", parentType.allowedMarks(child.marks))), 0, 0);
          replSteps.push(new _replace_step.ReplaceStep(cur + m.index, cur + m.index + m[0].length, slice));
        }
      }
    }
    cur = end;
  }
  if (!match.validEnd) {
    let fill = match.fillBefore(_prosemirrorModel.Fragment.empty, true);
    tr.replace(cur, cur, new _prosemirrorModel.Slice(fill, 0, 0));
  }
  for (let i = replSteps.length - 1; i >= 0; i--) tr.step(replSteps[i]);
}
},
"prosemirror-transform/src/replace_step.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ReplaceStep = exports.ReplaceAroundStep = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _step = __require("prosemirror-transform/src/step.ts");
var _map = __require("prosemirror-transform/src/map.ts");
/// Replace a part of the document with a slice of new content.
class ReplaceStep extends _step.Step {
  /// The given `slice` should fit the 'gap' between `from` and
  /// `to`—the depths must line up, and the surrounding nodes must be
  /// able to be joined with the open sides of the slice. When
  /// `structure` is true, the step will fail if the content between
  /// from and to is not just a sequence of closing and then opening
  /// tokens (this is to guard against rebased replace steps
  /// overwriting something they weren't supposed to).
  constructor(
  /// The start position of the replaced range.
  from,
  /// The end position of the replaced range.
  to,
  /// The slice to insert.
  slice,
  /// @internal
  structure = false) {
    super();
    this.from = from;
    this.to = to;
    this.slice = slice;
    this.structure = structure;
  }
  apply(doc) {
    if (this.structure && contentBetween(doc, this.from, this.to)) return _step.StepResult.fail("Structure replace would overwrite content");
    return _step.StepResult.fromReplace(doc, this.from, this.to, this.slice);
  }
  getMap() {
    return new _map.StepMap([this.from, this.to - this.from, this.slice.size]);
  }
  invert(doc) {
    return new ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to));
  }
  map(mapping) {
    let to = mapping.mapResult(this.to, -1);
    let from = this.from == this.to && ReplaceStep.MAP_BIAS < 0 ? to : mapping.mapResult(this.from, 1);
    if (from.deletedAcross && to.deletedAcross) return null;
    return new ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice, this.structure);
  }
  merge(other) {
    if (!(other instanceof ReplaceStep) || other.structure || this.structure) return null;
    if (this.from + this.slice.size == other.from && !this.slice.openEnd && !other.slice.openStart) {
      let slice = this.slice.size + other.slice.size == 0 ? _prosemirrorModel.Slice.empty : new _prosemirrorModel.Slice(this.slice.content.append(other.slice.content), this.slice.openStart, other.slice.openEnd);
      return new ReplaceStep(this.from, this.to + (other.to - other.from), slice, this.structure);
    } else if (other.to == this.from && !this.slice.openStart && !other.slice.openEnd) {
      let slice = this.slice.size + other.slice.size == 0 ? _prosemirrorModel.Slice.empty : new _prosemirrorModel.Slice(other.slice.content.append(this.slice.content), other.slice.openStart, this.slice.openEnd);
      return new ReplaceStep(other.from, this.to, slice, this.structure);
    } else {
      return null;
    }
  }
  toJSON() {
    let json = {
      stepType: "replace",
      from: this.from,
      to: this.to
    };
    if (this.slice.size) json.slice = this.slice.toJSON();
    if (this.structure) json.structure = true;
    return json;
  }

  /// @internal
  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number") throw new RangeError("Invalid input for ReplaceStep.fromJSON");
    return new ReplaceStep(json.from, json.to, _prosemirrorModel.Slice.fromJSON(schema, json.slice), !!json.structure);
  }

  /// By default, for backwards compatibility, an inserting step
  /// mapped over an insertion at that same position fill move after
  /// the inserted content. In a collaborative editing situation, that
  /// can make redone insertions appear in unexpected places. You can
  /// set this to -1 to make such mapping keep the step before the
  /// insertion instead.
}
exports.ReplaceStep = ReplaceStep;
ReplaceStep.MAP_BIAS = 1;
_step.Step.jsonID("replace", ReplaceStep);

/// Replace a part of the document with a slice of content, but
/// preserve a range of the replaced content by moving it into the
/// slice.
class ReplaceAroundStep extends _step.Step {
  /// Create a replace-around step with the given range and gap.
  /// `insert` should be the point in the slice into which the content
  /// of the gap should be moved. `structure` has the same meaning as
  /// it has in the [`ReplaceStep`](#transform.ReplaceStep) class.
  constructor(
  /// The start position of the replaced range.
  from,
  /// The end position of the replaced range.
  to,
  /// The start of preserved range.
  gapFrom,
  /// The end of preserved range.
  gapTo,
  /// The slice to insert.
  slice,
  /// The position in the slice where the preserved range should be
  /// inserted.
  insert,
  /// @internal
  structure = false) {
    super();
    this.from = from;
    this.to = to;
    this.gapFrom = gapFrom;
    this.gapTo = gapTo;
    this.slice = slice;
    this.insert = insert;
    this.structure = structure;
  }
  apply(doc) {
    if (this.structure && (contentBetween(doc, this.from, this.gapFrom) || contentBetween(doc, this.gapTo, this.to))) return _step.StepResult.fail("Structure gap-replace would overwrite content");
    let gap = doc.slice(this.gapFrom, this.gapTo);
    if (gap.openStart || gap.openEnd) return _step.StepResult.fail("Gap is not a flat range");
    let inserted = this.slice.insertAt(this.insert, gap.content);
    if (!inserted) return _step.StepResult.fail("Content does not fit in gap");
    return _step.StepResult.fromReplace(doc, this.from, this.to, inserted);
  }
  getMap() {
    return new _map.StepMap([this.from, this.gapFrom - this.from, this.insert, this.gapTo, this.to - this.gapTo, this.slice.size - this.insert]);
  }
  invert(doc) {
    let gap = this.gapTo - this.gapFrom;
    return new ReplaceAroundStep(this.from, this.from + this.slice.size + gap, this.from + this.insert, this.from + this.insert + gap, doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
  }
  map(mapping) {
    let from = mapping.mapResult(this.from, 1),
      to = mapping.mapResult(this.to, -1);
    let gapFrom = this.from == this.gapFrom ? from.pos : mapping.map(this.gapFrom, -1);
    let gapTo = this.to == this.gapTo ? to.pos : mapping.map(this.gapTo, 1);
    if (from.deletedAcross && to.deletedAcross || gapFrom < from.pos || gapTo > to.pos) return null;
    return new ReplaceAroundStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure);
  }
  toJSON() {
    let json = {
      stepType: "replaceAround",
      from: this.from,
      to: this.to,
      gapFrom: this.gapFrom,
      gapTo: this.gapTo,
      insert: this.insert
    };
    if (this.slice.size) json.slice = this.slice.toJSON();
    if (this.structure) json.structure = true;
    return json;
  }

  /// @internal
  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number" || typeof json.gapFrom != "number" || typeof json.gapTo != "number" || typeof json.insert != "number") throw new RangeError("Invalid input for ReplaceAroundStep.fromJSON");
    return new ReplaceAroundStep(json.from, json.to, json.gapFrom, json.gapTo, _prosemirrorModel.Slice.fromJSON(schema, json.slice), json.insert, !!json.structure);
  }
}
exports.ReplaceAroundStep = ReplaceAroundStep;
_step.Step.jsonID("replaceAround", ReplaceAroundStep);
function contentBetween(doc, from, to) {
  let $from = doc.resolve(from),
    dist = to - from,
    depth = $from.depth;
  while (dist > 0 && depth > 0 && $from.indexAfter(depth) == $from.node(depth).childCount) {
    depth--;
    dist--;
  }
  if (dist > 0) {
    let next = $from.node(depth).maybeChild($from.indexAfter(depth));
    while (dist > 0) {
      if (!next || next.isLeaf) return true;
      next = next.firstChild;
      dist--;
    }
  }
  return false;
}
},
"prosemirror-transform/src/replace.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deleteRange = deleteRange;
exports.replaceRange = replaceRange;
exports.replaceRangeWith = replaceRangeWith;
exports.replaceStep = replaceStep;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _replace_step = __require("prosemirror-transform/src/replace_step.ts");
var _structure = __require("prosemirror-transform/src/structure.ts");
/// ‘Fit’ a slice into a given position in the document, producing a
/// [step](#transform.Step) that inserts it. Will return null if
/// there's no meaningful way to insert the slice here, or inserting it
/// would be a no-op (an empty slice over an empty range).
function replaceStep(doc, from, to = from, slice = _prosemirrorModel.Slice.empty) {
  if (from == to && !slice.size) return null;
  let $from = doc.resolve(from),
    $to = doc.resolve(to);
  // Optimization -- avoid work if it's obvious that it's not needed.
  if (fitsTrivially($from, $to, slice)) return new _replace_step.ReplaceStep(from, to, slice);
  return new Fitter($from, $to, slice).fit();
}
function fitsTrivially($from, $to, slice) {
  return !slice.openStart && !slice.openEnd && $from.start() == $to.start() && $from.parent.canReplace($from.index(), $to.index(), slice.content);
}
// Algorithm for 'placing' the elements of a slice into a gap:
//
// We consider the content of each node that is open to the left to be
// independently placeable. I.e. in <p("foo"), p("bar")>, when the
// paragraph on the left is open, "foo" can be placed (somewhere on
// the left side of the replacement gap) independently from p("bar").
//
// This class tracks the state of the placement progress in the
// following properties:
//
//  - `frontier` holds a stack of `{type, match}` objects that
//    represent the open side of the replacement. It starts at
//    `$from`, then moves forward as content is placed, and is finally
//    reconciled with `$to`.
//
//  - `unplaced` is a slice that represents the content that hasn't
//    been placed yet.
//
//  - `placed` is a fragment of placed content. Its open-start value
//    is implicit in `$from`, and its open-end value in `frontier`.
class Fitter {
  constructor($from, $to, unplaced) {
    this.$from = $from;
    this.$to = $to;
    this.unplaced = unplaced;
    this.frontier = [];
    this.placed = _prosemirrorModel.Fragment.empty;
    for (let i = 0; i <= $from.depth; i++) {
      let node = $from.node(i);
      this.frontier.push({
        type: node.type,
        match: node.contentMatchAt($from.indexAfter(i))
      });
    }
    for (let i = $from.depth; i > 0; i--) this.placed = _prosemirrorModel.Fragment.from($from.node(i).copy(this.placed));
  }
  get depth() {
    return this.frontier.length - 1;
  }
  fit() {
    // As long as there's unplaced content, try to place some of it.
    // If that fails, either increase the open score of the unplaced
    // slice, or drop nodes from it, and then try again.
    while (this.unplaced.size) {
      let fit = this.findFittable();
      if (fit) this.placeNodes(fit);else this.openMore() || this.dropNode();
    }
    // When there's inline content directly after the frontier _and_
    // directly after `this.$to`, we must generate a `ReplaceAround`
    // step that pulls that content into the node after the frontier.
    // That means the fitting must be done to the end of the textblock
    // node after `this.$to`, not `this.$to` itself.
    let moveInline = this.mustMoveInline(),
      placedSize = this.placed.size - this.depth - this.$from.depth;
    let $from = this.$from,
      $to = this.close(moveInline < 0 ? this.$to : $from.doc.resolve(moveInline));
    if (!$to) return null;

    // If closing to `$to` succeeded, create a step
    let content = this.placed,
      openStart = $from.depth,
      openEnd = $to.depth;
    while (openStart && openEnd && content.childCount == 1) {
      // Normalize by dropping open parent nodes
      content = content.firstChild.content;
      openStart--;
      openEnd--;
    }
    let slice = new _prosemirrorModel.Slice(content, openStart, openEnd);
    if (moveInline > -1) return new _replace_step.ReplaceAroundStep($from.pos, moveInline, this.$to.pos, this.$to.end(), slice, placedSize);
    if (slice.size || $from.pos != this.$to.pos)
      // Don't generate no-op steps
      return new _replace_step.ReplaceStep($from.pos, $to.pos, slice);
    return null;
  }

  // Find a position on the start spine of `this.unplaced` that has
  // content that can be moved somewhere on the frontier. Returns two
  // depths, one for the slice and one for the frontier.
  findFittable() {
    let startDepth = this.unplaced.openStart;
    for (let cur = this.unplaced.content, d = 0, openEnd = this.unplaced.openEnd; d < startDepth; d++) {
      let node = cur.firstChild;
      if (cur.childCount > 1) openEnd = 0;
      if (node.type.spec.isolating && openEnd <= d) {
        startDepth = d;
        break;
      }
      cur = node.content;
    }

    // Only try wrapping nodes (pass 2) after finding a place without
    // wrapping failed.
    for (let pass = 1; pass <= 2; pass++) {
      for (let sliceDepth = pass == 1 ? startDepth : this.unplaced.openStart; sliceDepth >= 0; sliceDepth--) {
        let fragment,
          parent = null;
        if (sliceDepth) {
          parent = contentAt(this.unplaced.content, sliceDepth - 1).firstChild;
          fragment = parent.content;
        } else {
          fragment = this.unplaced.content;
        }
        let first = fragment.firstChild;
        for (let frontierDepth = this.depth; frontierDepth >= 0; frontierDepth--) {
          let {
              type,
              match
            } = this.frontier[frontierDepth],
            wrap,
            inject = null;
          // In pass 1, if the next node matches, or there is no next
          // node but the parents look compatible, we've found a
          // place.
          if (pass == 1 && (first ? match.matchType(first.type) || (inject = match.fillBefore(_prosemirrorModel.Fragment.from(first), false)) : parent && type.compatibleContent(parent.type))) return {
            sliceDepth,
            frontierDepth,
            parent,
            inject
          };
          // In pass 2, look for a set of wrapping nodes that make
          // `first` fit here.
          else if (pass == 2 && first && (wrap = match.findWrapping(first.type))) return {
            sliceDepth,
            frontierDepth,
            parent,
            wrap
          };
          // Don't continue looking further up if the parent node
          // would fit here.
          if (parent && match.matchType(parent.type)) break;
        }
      }
    }
  }
  openMore() {
    let {
      content,
      openStart,
      openEnd
    } = this.unplaced;
    let inner = contentAt(content, openStart);
    if (!inner.childCount || inner.firstChild.isLeaf) return false;
    this.unplaced = new _prosemirrorModel.Slice(content, openStart + 1, Math.max(openEnd, inner.size + openStart >= content.size - openEnd ? openStart + 1 : 0));
    return true;
  }
  dropNode() {
    let {
      content,
      openStart,
      openEnd
    } = this.unplaced;
    let inner = contentAt(content, openStart);
    if (inner.childCount <= 1 && openStart > 0) {
      let openAtEnd = content.size - openStart <= openStart + inner.size;
      this.unplaced = new _prosemirrorModel.Slice(dropFromFragment(content, openStart - 1, 1), openStart - 1, openAtEnd ? openStart - 1 : openEnd);
    } else {
      this.unplaced = new _prosemirrorModel.Slice(dropFromFragment(content, openStart, 1), openStart, openEnd);
    }
  }

  // Move content from the unplaced slice at `sliceDepth` to the
  // frontier node at `frontierDepth`. Close that frontier node when
  // applicable.
  placeNodes({
    sliceDepth,
    frontierDepth,
    parent,
    inject,
    wrap
  }) {
    while (this.depth > frontierDepth) this.closeFrontierNode();
    if (wrap) for (let i = 0; i < wrap.length; i++) this.openFrontierNode(wrap[i]);
    let slice = this.unplaced,
      fragment = parent ? parent.content : slice.content;
    let openStart = slice.openStart - sliceDepth;
    let taken = 0,
      add = [];
    let {
      match,
      type
    } = this.frontier[frontierDepth];
    if (inject) {
      for (let i = 0; i < inject.childCount; i++) add.push(inject.child(i));
      match = match.matchFragment(inject);
    }
    // Computes the amount of (end) open nodes at the end of the
    // fragment. When 0, the parent is open, but no more. When
    // negative, nothing is open.
    let openEndCount = fragment.size + sliceDepth - (slice.content.size - slice.openEnd);
    // Scan over the fragment, fitting as many child nodes as
    // possible.
    while (taken < fragment.childCount) {
      let next = fragment.child(taken),
        matches = match.matchType(next.type);
      if (!matches) break;
      taken++;
      if (taken > 1 || openStart == 0 || next.content.size) {
        // Drop empty open nodes
        match = matches;
        add.push(closeNodeStart(next.mark(type.allowedMarks(next.marks)), taken == 1 ? openStart : 0, taken == fragment.childCount ? openEndCount : -1));
      }
    }
    let toEnd = taken == fragment.childCount;
    if (!toEnd) openEndCount = -1;
    this.placed = addToFragment(this.placed, frontierDepth, _prosemirrorModel.Fragment.from(add));
    this.frontier[frontierDepth].match = match;

    // If the parent types match, and the entire node was moved, and
    // it's not open, close this frontier node right away.
    if (toEnd && openEndCount < 0 && parent && parent.type == this.frontier[this.depth].type && this.frontier.length > 1) this.closeFrontierNode();

    // Add new frontier nodes for any open nodes at the end.
    for (let i = 0, cur = fragment; i < openEndCount; i++) {
      let node = cur.lastChild;
      this.frontier.push({
        type: node.type,
        match: node.contentMatchAt(node.childCount)
      });
      cur = node.content;
    }

    // Update `this.unplaced`. Drop the entire node from which we
    // placed it we got to its end, otherwise just drop the placed
    // nodes.
    this.unplaced = !toEnd ? new _prosemirrorModel.Slice(dropFromFragment(slice.content, sliceDepth, taken), slice.openStart, slice.openEnd) : sliceDepth == 0 ? _prosemirrorModel.Slice.empty : new _prosemirrorModel.Slice(dropFromFragment(slice.content, sliceDepth - 1, 1), sliceDepth - 1, openEndCount < 0 ? slice.openEnd : sliceDepth - 1);
  }
  mustMoveInline() {
    if (!this.$to.parent.isTextblock) return -1;
    let top = this.frontier[this.depth],
      level;
    if (!top.type.isTextblock || !contentAfterFits(this.$to, this.$to.depth, top.type, top.match, false) || this.$to.depth == this.depth && (level = this.findCloseLevel(this.$to)) && level.depth == this.depth) return -1;
    let {
        depth
      } = this.$to,
      after = this.$to.after(depth);
    while (depth > 1 && after == this.$to.end(--depth)) ++after;
    return after;
  }
  findCloseLevel($to) {
    scan: for (let i = Math.min(this.depth, $to.depth); i >= 0; i--) {
      let {
        match,
        type
      } = this.frontier[i];
      let dropInner = i < $to.depth && $to.end(i + 1) == $to.pos + ($to.depth - (i + 1));
      let fit = contentAfterFits($to, i, type, match, dropInner);
      if (!fit) continue;
      for (let d = i - 1; d >= 0; d--) {
        let {
          match,
          type
        } = this.frontier[d];
        let matches = contentAfterFits($to, d, type, match, true);
        if (!matches || matches.childCount) continue scan;
      }
      return {
        depth: i,
        fit,
        move: dropInner ? $to.doc.resolve($to.after(i + 1)) : $to
      };
    }
  }
  close($to) {
    let close = this.findCloseLevel($to);
    if (!close) return null;
    while (this.depth > close.depth) this.closeFrontierNode();
    if (close.fit.childCount) this.placed = addToFragment(this.placed, close.depth, close.fit);
    $to = close.move;
    for (let d = close.depth + 1; d <= $to.depth; d++) {
      let node = $to.node(d),
        add = node.type.contentMatch.fillBefore(node.content, true, $to.index(d));
      this.openFrontierNode(node.type, node.attrs, add);
    }
    return $to;
  }
  openFrontierNode(type, attrs = null, content) {
    let top = this.frontier[this.depth];
    top.match = top.match.matchType(type);
    this.placed = addToFragment(this.placed, this.depth, _prosemirrorModel.Fragment.from(type.create(attrs, content)));
    this.frontier.push({
      type,
      match: type.contentMatch
    });
  }
  closeFrontierNode() {
    let open = this.frontier.pop();
    let add = open.match.fillBefore(_prosemirrorModel.Fragment.empty, true);
    if (add.childCount) this.placed = addToFragment(this.placed, this.frontier.length, add);
  }
}
function dropFromFragment(fragment, depth, count) {
  if (depth == 0) return fragment.cutByIndex(count, fragment.childCount);
  return fragment.replaceChild(0, fragment.firstChild.copy(dropFromFragment(fragment.firstChild.content, depth - 1, count)));
}
function addToFragment(fragment, depth, content) {
  if (depth == 0) return fragment.append(content);
  return fragment.replaceChild(fragment.childCount - 1, fragment.lastChild.copy(addToFragment(fragment.lastChild.content, depth - 1, content)));
}
function contentAt(fragment, depth) {
  for (let i = 0; i < depth; i++) fragment = fragment.firstChild.content;
  return fragment;
}
function closeNodeStart(node, openStart, openEnd) {
  if (openStart <= 0) return node;
  let frag = node.content;
  if (openStart > 1) frag = frag.replaceChild(0, closeNodeStart(frag.firstChild, openStart - 1, frag.childCount == 1 ? openEnd - 1 : 0));
  if (openStart > 0) {
    frag = node.type.contentMatch.fillBefore(frag).append(frag);
    if (openEnd <= 0) frag = frag.append(node.type.contentMatch.matchFragment(frag).fillBefore(_prosemirrorModel.Fragment.empty, true));
  }
  return node.copy(frag);
}
function contentAfterFits($to, depth, type, match, open) {
  let node = $to.node(depth),
    index = open ? $to.indexAfter(depth) : $to.index(depth);
  if (index == node.childCount && !type.compatibleContent(node.type)) return null;
  let fit = match.fillBefore(node.content, true, index);
  return fit && !invalidMarks(type, node.content, index) ? fit : null;
}
function invalidMarks(type, fragment, start) {
  for (let i = start; i < fragment.childCount; i++) if (!type.allowsMarks(fragment.child(i).marks)) return true;
  return false;
}
function definesContent(type) {
  return type.spec.defining || type.spec.definingForContent;
}
function replaceRange(tr, from, to, slice) {
  if (!slice.size) return tr.deleteRange(from, to);
  let $from = tr.doc.resolve(from),
    $to = tr.doc.resolve(to);
  if (fitsTrivially($from, $to, slice)) return tr.step(new _replace_step.ReplaceStep(from, to, slice));
  let targetDepths = coveredDepths($from, $to);
  // Can't replace the whole document, so remove 0 if it's present
  if (targetDepths[targetDepths.length - 1] == 0) targetDepths.pop();
  // Negative numbers represent not expansion over the whole node at
  // that depth, but replacing from $from.before(-D) to $to.pos.
  let preferredTarget = -($from.depth + 1);
  targetDepths.unshift(preferredTarget);
  // This loop picks a preferred target depth, if one of the covering
  // depths is not outside of a defining node, and adds negative
  // depths for any depth that has $from at its start and does not
  // cross a defining node.
  for (let d = $from.depth, pos = $from.pos - 1; d > 0; d--, pos--) {
    let spec = $from.node(d).type.spec;
    if (spec.defining || spec.definingAsContext || spec.isolating) break;
    if (targetDepths.indexOf(d) > -1) preferredTarget = d;else if ($from.before(d) == pos) targetDepths.splice(1, 0, -d);
  }
  // Try to fit each possible depth of the slice into each possible
  // target depth, starting with the preferred depths.
  let preferredTargetIndex = targetDepths.indexOf(preferredTarget);
  let leftNodes = [],
    preferredDepth = slice.openStart;
  for (let content = slice.content, i = 0;; i++) {
    let node = content.firstChild;
    leftNodes.push(node);
    if (i == slice.openStart) break;
    content = node.content;
  }

  // Back up preferredDepth to cover defining textblocks directly
  // above it, possibly skipping a non-defining textblock.
  for (let d = preferredDepth - 1; d >= 0; d--) {
    let leftNode = leftNodes[d],
      def = definesContent(leftNode.type);
    if (def && !leftNode.sameMarkup($from.node(Math.abs(preferredTarget) - 1))) preferredDepth = d;else if (def || !leftNode.type.isTextblock) break;
  }
  for (let j = slice.openStart; j >= 0; j--) {
    let openDepth = (j + preferredDepth + 1) % (slice.openStart + 1);
    let insert = leftNodes[openDepth];
    if (!insert) continue;
    for (let i = 0; i < targetDepths.length; i++) {
      // Loop over possible expansion levels, starting with the
      // preferred one
      let targetDepth = targetDepths[(i + preferredTargetIndex) % targetDepths.length],
        expand = true;
      if (targetDepth < 0) {
        expand = false;
        targetDepth = -targetDepth;
      }
      let parent = $from.node(targetDepth - 1),
        index = $from.index(targetDepth - 1);
      if (parent.canReplaceWith(index, index, insert.type, insert.marks)) return tr.replace($from.before(targetDepth), expand ? $to.after(targetDepth) : to, new _prosemirrorModel.Slice(closeFragment(slice.content, 0, slice.openStart, openDepth), openDepth, slice.openEnd));
    }
  }
  let startSteps = tr.steps.length;
  for (let i = targetDepths.length - 1; i >= 0; i--) {
    tr.replace(from, to, slice);
    if (tr.steps.length > startSteps) break;
    let depth = targetDepths[i];
    if (depth < 0) continue;
    from = $from.before(depth);
    to = $to.after(depth);
  }
}
function closeFragment(fragment, depth, oldOpen, newOpen, parent) {
  if (depth < oldOpen) {
    let first = fragment.firstChild;
    fragment = fragment.replaceChild(0, first.copy(closeFragment(first.content, depth + 1, oldOpen, newOpen, first)));
  }
  if (depth > newOpen) {
    let match = parent.contentMatchAt(0);
    let start = match.fillBefore(fragment).append(fragment);
    fragment = start.append(match.matchFragment(start).fillBefore(_prosemirrorModel.Fragment.empty, true));
  }
  return fragment;
}
function replaceRangeWith(tr, from, to, node) {
  if (!node.isInline && from == to && tr.doc.resolve(from).parent.content.size) {
    let point = (0, _structure.insertPoint)(tr.doc, from, node.type);
    if (point != null) from = to = point;
  }
  tr.replaceRange(from, to, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(node), 0, 0));
}
function deleteRange(tr, from, to) {
  let $from = tr.doc.resolve(from),
    $to = tr.doc.resolve(to);

  // When the deleted range spans from the start of one textblock to
  // the start of another one, move out of the start of both blocks.
  if ($from.parent.isTextblock && $to.parent.isTextblock && $from.start() != $to.start() && $from.parentOffset == 0 && $to.parentOffset == 0) {
    let shared = $from.sharedDepth(to),
      isolated = false;
    for (let d = $from.depth; d > shared; d--) if ($from.node(d).type.spec.isolating) isolated = true;
    for (let d = $to.depth; d > shared; d--) if ($to.node(d).type.spec.isolating) isolated = true;
    if (!isolated) {
      for (let d = $from.depth; d > 0 && from == $from.start(d); d--) from = $from.before(d);
      for (let d = $to.depth; d > 0 && to == $to.start(d); d--) to = $to.before(d);
      $from = tr.doc.resolve(from);
      $to = tr.doc.resolve(to);
    }
  }
  let covered = coveredDepths($from, $to);
  for (let i = 0; i < covered.length; i++) {
    let depth = covered[i],
      last = i == covered.length - 1;
    if (last && depth == 0 || $from.node(depth).type.contentMatch.validEnd) return tr.delete($from.start(depth), $to.end(depth));
    if (depth > 0 && (last || $from.node(depth - 1).canReplace($from.index(depth - 1), $to.indexAfter(depth - 1)))) return tr.delete($from.before(depth), $to.after(depth));
  }
  for (let d = 1; d <= $from.depth && d <= $to.depth; d++) {
    if (from - $from.start(d) == $from.depth - d && to > $from.end(d) && $to.end(d) - to != $to.depth - d && $from.start(d - 1) == $to.start(d - 1) && $from.node(d - 1).canReplace($from.index(d - 1), $to.index(d - 1))) return tr.delete($from.before(d), to);
  }
  tr.delete(from, to);
}

// Returns an array of all depths for which $from - $to spans the
// whole content of the nodes at that depth.
function coveredDepths($from, $to) {
  let result = [],
    minDepth = Math.min($from.depth, $to.depth);
  for (let d = minDepth; d >= 0; d--) {
    let start = $from.start(d);
    if (start < $from.pos - ($from.depth - d) || $to.end(d) > $to.pos + ($to.depth - d) || $from.node(d).type.spec.isolating || $to.node(d).type.spec.isolating) break;
    if (start == $to.start(d) || d == $from.depth && d == $to.depth && $from.parent.inlineContent && $to.parent.inlineContent && d && $to.start(d - 1) == start - 1) result.push(d);
  }
  return result;
}
},
"prosemirror-transform/src/step.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StepResult = exports.Step = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _map = __require("prosemirror-transform/src/map.ts");
const stepsByID = Object.create(null);

/// A step object represents an atomic change. It generally applies
/// only to the document it was created for, since the positions
/// stored in it will only make sense for that document.
///
/// New steps are defined by creating classes that extend `Step`,
/// overriding the `apply`, `invert`, `map`, `getMap` and `fromJSON`
/// methods, and registering your class with a unique
/// JSON-serialization identifier using
/// [`Step.jsonID`](#transform.Step^jsonID).
class Step {
  /// Applies this step to the given document, returning a result
  /// object that either indicates failure, if the step can not be
  /// applied to this document, or indicates success by containing a
  /// transformed document.

  /// Get the step map that represents the changes made by this step,
  /// and which can be used to transform between positions in the old
  /// and the new document.
  getMap() {
    return _map.StepMap.empty;
  }

  /// Create an inverted version of this step. Needs the document as it
  /// was before the step as argument.

  /// Map this step through a mappable thing, returning either a
  /// version of that step with its positions adjusted, or `null` if
  /// the step was entirely deleted by the mapping.

  /// Try to merge this step with another one, to be applied directly
  /// after it. Returns the merged step when possible, null if the
  /// steps can't be merged.
  merge(other) {
    return null;
  }

  /// Create a JSON-serializeable representation of this step. When
  /// defining this for a custom subclass, make sure the result object
  /// includes the step type's [JSON id](#transform.Step^jsonID) under
  /// the `stepType` property.

  /// Deserialize a step from its JSON representation. Will call
  /// through to the step class' own implementation of this method.
  static fromJSON(schema, json) {
    if (!json || !json.stepType) throw new RangeError("Invalid input for Step.fromJSON");
    let type = stepsByID[json.stepType];
    if (!type) throw new RangeError(`No step type ${json.stepType} defined`);
    return type.fromJSON(schema, json);
  }

  /// To be able to serialize steps to JSON, each step needs a string
  /// ID to attach to its JSON representation. Use this method to
  /// register an ID for your step classes. Try to pick something
  /// that's unlikely to clash with steps from other modules.
  static jsonID(id, stepClass) {
    if (id in stepsByID) throw new RangeError("Duplicate use of step JSON ID " + id);
    stepsByID[id] = stepClass;
    stepClass.prototype.jsonID = id;
    return stepClass;
  }
}

/// The result of [applying](#transform.Step.apply) a step. Contains either a
/// new document or a failure value.
exports.Step = Step;
class StepResult {
  /// @internal
  constructor(
  /// The transformed document, if successful.
  doc,
  /// The failure message, if unsuccessful.
  failed) {
    this.doc = doc;
    this.failed = failed;
  }

  /// Create a successful step result.
  static ok(doc) {
    return new StepResult(doc, null);
  }

  /// Create a failed step result.
  static fail(message) {
    return new StepResult(null, message);
  }

  /// Call [`Node.replace`](#model.Node.replace) with the given
  /// arguments. Create a successful result if it succeeds, and a
  /// failed one if it throws a `ReplaceError`.
  static fromReplace(doc, from, to, slice) {
    try {
      return StepResult.ok(doc.replace(from, to, slice));
    } catch (e) {
      if (e instanceof _prosemirrorModel.ReplaceError) return StepResult.fail(e.message);
      throw e;
    }
  }
}
exports.StepResult = StepResult;
},
"prosemirror-transform/src/structure.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.canJoin = canJoin;
exports.canSplit = canSplit;
exports.dropPoint = dropPoint;
exports.findWrapping = findWrapping;
exports.insertPoint = insertPoint;
exports.join = join;
exports.joinPoint = joinPoint;
exports.lift = lift;
exports.liftTarget = liftTarget;
exports.setBlockType = setBlockType;
exports.setNodeMarkup = setNodeMarkup;
exports.split = split;
exports.wrap = wrap;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _replace_step = __require("prosemirror-transform/src/replace_step.ts");
var _mark = __require("prosemirror-transform/src/mark.ts");
function canCut(node, start, end) {
  return (start == 0 || node.canReplace(start, node.childCount)) && (end == node.childCount || node.canReplace(0, end));
}

/// Try to find a target depth to which the content in the given range
/// can be lifted. Will not go across
/// [isolating](#model.NodeSpec.isolating) parent nodes.
function liftTarget(range) {
  let parent = range.parent;
  let content = parent.content.cutByIndex(range.startIndex, range.endIndex);
  for (let depth = range.depth, contentBefore = 0, contentAfter = 0;; --depth) {
    let node = range.$from.node(depth);
    let index = range.$from.index(depth) + contentBefore,
      endIndex = range.$to.indexAfter(depth) - contentAfter;
    if (depth < range.depth && node.canReplace(index, endIndex, content)) return depth;
    if (depth == 0 || node.type.spec.isolating || !canCut(node, index, endIndex)) break;
    if (index) contentBefore = 1;
    if (endIndex < node.childCount) contentAfter = 1;
  }
  return null;
}
function lift(tr, range, target) {
  let {
    $from,
    $to,
    depth
  } = range;
  let gapStart = $from.before(depth + 1),
    gapEnd = $to.after(depth + 1);
  let start = gapStart,
    end = gapEnd;
  let before = _prosemirrorModel.Fragment.empty,
    openStart = 0;
  for (let d = depth, splitting = false; d > target; d--) if (splitting || $from.index(d) > 0) {
    splitting = true;
    before = _prosemirrorModel.Fragment.from($from.node(d).copy(before));
    openStart++;
  } else {
    start--;
  }
  let after = _prosemirrorModel.Fragment.empty,
    openEnd = 0;
  for (let d = depth, splitting = false; d > target; d--) if (splitting || $to.after(d + 1) < $to.end(d)) {
    splitting = true;
    after = _prosemirrorModel.Fragment.from($to.node(d).copy(after));
    openEnd++;
  } else {
    end++;
  }
  tr.step(new _replace_step.ReplaceAroundStep(start, end, gapStart, gapEnd, new _prosemirrorModel.Slice(before.append(after), openStart, openEnd), before.size - openStart, true));
}

/// Try to find a valid way to wrap the content in the given range in a
/// node of the given type. May introduce extra nodes around and inside
/// the wrapper node, if necessary. Returns null if no valid wrapping
/// could be found. When `innerRange` is given, that range's content is
/// used as the content to fit into the wrapping, instead of the
/// content of `range`.
function findWrapping(range, nodeType, attrs = null, innerRange = range) {
  let around = findWrappingOutside(range, nodeType);
  let inner = around && findWrappingInside(innerRange, nodeType);
  if (!inner) return null;
  return around.map(withAttrs).concat({
    type: nodeType,
    attrs
  }).concat(inner.map(withAttrs));
}
function withAttrs(type) {
  return {
    type,
    attrs: null
  };
}
function findWrappingOutside(range, type) {
  let {
    parent,
    startIndex,
    endIndex
  } = range;
  let around = parent.contentMatchAt(startIndex).findWrapping(type);
  if (!around) return null;
  let outer = around.length ? around[0] : type;
  return parent.canReplaceWith(startIndex, endIndex, outer) ? around : null;
}
function findWrappingInside(range, type) {
  let {
    parent,
    startIndex,
    endIndex
  } = range;
  let inner = parent.child(startIndex);
  let inside = type.contentMatch.findWrapping(inner.type);
  if (!inside) return null;
  let lastType = inside.length ? inside[inside.length - 1] : type;
  let innerMatch = lastType.contentMatch;
  for (let i = startIndex; innerMatch && i < endIndex; i++) innerMatch = innerMatch.matchType(parent.child(i).type);
  if (!innerMatch || !innerMatch.validEnd) return null;
  return inside;
}
function wrap(tr, range, wrappers) {
  let content = _prosemirrorModel.Fragment.empty;
  for (let i = wrappers.length - 1; i >= 0; i--) {
    if (content.size) {
      let match = wrappers[i].type.contentMatch.matchFragment(content);
      if (!match || !match.validEnd) throw new RangeError("Wrapper type given to Transform.wrap does not form valid content of its parent wrapper");
    }
    content = _prosemirrorModel.Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  }
  let start = range.start,
    end = range.end;
  tr.step(new _replace_step.ReplaceAroundStep(start, end, start, end, new _prosemirrorModel.Slice(content, 0, 0), wrappers.length, true));
}
function setBlockType(tr, from, to, type, attrs) {
  if (!type.isTextblock) throw new RangeError("Type given to setBlockType should be a textblock");
  let mapFrom = tr.steps.length;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    let attrsHere = typeof attrs == "function" ? attrs(node) : attrs;
    if (node.isTextblock && !node.hasMarkup(type, attrsHere) && canChangeType(tr.doc, tr.mapping.slice(mapFrom).map(pos), type)) {
      let convertNewlines = null;
      if (type.schema.linebreakReplacement) {
        let pre = type.whitespace == "pre",
          supportLinebreak = !!type.contentMatch.matchType(type.schema.linebreakReplacement);
        if (pre && !supportLinebreak) convertNewlines = false;else if (!pre && supportLinebreak) convertNewlines = true;
      }
      // Ensure all markup that isn't allowed in the new node type is cleared
      if (convertNewlines === false) replaceLinebreaks(tr, node, pos, mapFrom);
      (0, _mark.clearIncompatible)(tr, tr.mapping.slice(mapFrom).map(pos, 1), type, undefined, convertNewlines === null);
      let mapping = tr.mapping.slice(mapFrom);
      let startM = mapping.map(pos, 1),
        endM = mapping.map(pos + node.nodeSize, 1);
      tr.step(new _replace_step.ReplaceAroundStep(startM, endM, startM + 1, endM - 1, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(type.create(attrsHere, null, node.marks)), 0, 0), 1, true));
      if (convertNewlines === true) replaceNewlines(tr, node, pos, mapFrom);
      return false;
    }
  });
}
function replaceNewlines(tr, node, pos, mapFrom) {
  node.forEach((child, offset) => {
    if (child.isText) {
      let m,
        newline = /\r?\n|\r/g;
      while (m = newline.exec(child.text)) {
        let start = tr.mapping.slice(mapFrom).map(pos + 1 + offset + m.index);
        tr.replaceWith(start, start + 1, node.type.schema.linebreakReplacement.create());
      }
    }
  });
}
function replaceLinebreaks(tr, node, pos, mapFrom) {
  node.forEach((child, offset) => {
    if (child.type == child.type.schema.linebreakReplacement) {
      let start = tr.mapping.slice(mapFrom).map(pos + 1 + offset);
      tr.replaceWith(start, start + 1, node.type.schema.text("\n"));
    }
  });
}
function canChangeType(doc, pos, type) {
  let $pos = doc.resolve(pos),
    index = $pos.index();
  return $pos.parent.canReplaceWith(index, index + 1, type);
}

/// Change the type, attributes, and/or marks of the node at `pos`.
/// When `type` isn't given, the existing node type is preserved,
function setNodeMarkup(tr, pos, type, attrs, marks) {
  let node = tr.doc.nodeAt(pos);
  if (!node) throw new RangeError("No node at given position");
  if (!type) type = node.type;
  let newNode = type.create(attrs, null, marks || node.marks);
  if (node.isLeaf) return tr.replaceWith(pos, pos + node.nodeSize, newNode);
  if (!type.validContent(node.content)) throw new RangeError("Invalid content for node type " + type.name);
  tr.step(new _replace_step.ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(newNode), 0, 0), 1, true));
}

/// Check whether splitting at the given position is allowed.
function canSplit(doc, pos, depth = 1, typesAfter) {
  let $pos = doc.resolve(pos),
    base = $pos.depth - depth;
  let innerType = typesAfter && typesAfter[typesAfter.length - 1] || $pos.parent;
  if (base < 0 || $pos.parent.type.spec.isolating || !$pos.parent.canReplace($pos.index(), $pos.parent.childCount) || !innerType.type.validContent($pos.parent.content.cutByIndex($pos.index(), $pos.parent.childCount))) return false;
  for (let d = $pos.depth - 1, i = depth - 2; d > base; d--, i--) {
    let node = $pos.node(d),
      index = $pos.index(d);
    if (node.type.spec.isolating) return false;
    let rest = node.content.cutByIndex(index, node.childCount);
    let overrideChild = typesAfter && typesAfter[i + 1];
    if (overrideChild) rest = rest.replaceChild(0, overrideChild.type.create(overrideChild.attrs));
    let after = typesAfter && typesAfter[i] || node;
    if (!node.canReplace(index + 1, node.childCount) || !after.type.validContent(rest)) return false;
  }
  let index = $pos.indexAfter(base);
  let baseType = typesAfter && typesAfter[0];
  return $pos.node(base).canReplaceWith(index, index, baseType ? baseType.type : $pos.node(base + 1).type);
}
function split(tr, pos, depth = 1, typesAfter) {
  let $pos = tr.doc.resolve(pos),
    before = _prosemirrorModel.Fragment.empty,
    after = _prosemirrorModel.Fragment.empty;
  for (let d = $pos.depth, e = $pos.depth - depth, i = depth - 1; d > e; d--, i--) {
    before = _prosemirrorModel.Fragment.from($pos.node(d).copy(before));
    let typeAfter = typesAfter && typesAfter[i];
    after = _prosemirrorModel.Fragment.from(typeAfter ? typeAfter.type.create(typeAfter.attrs, after) : $pos.node(d).copy(after));
  }
  tr.step(new _replace_step.ReplaceStep(pos, pos, new _prosemirrorModel.Slice(before.append(after), depth, depth), true));
}

/// Test whether the blocks before and after a given position can be
/// joined.
function canJoin(doc, pos) {
  let $pos = doc.resolve(pos),
    index = $pos.index();
  return joinable($pos.nodeBefore, $pos.nodeAfter) && $pos.parent.canReplace(index, index + 1);
}
function canAppendWithSubstitutedLinebreaks(a, b) {
  if (!b.content.size) a.type.compatibleContent(b.type);
  let match = a.contentMatchAt(a.childCount);
  let {
    linebreakReplacement
  } = a.type.schema;
  for (let i = 0; i < b.childCount; i++) {
    let child = b.child(i);
    let type = child.type == linebreakReplacement ? a.type.schema.nodes.text : child.type;
    match = match.matchType(type);
    if (!match) return false;
    if (!a.type.allowsMarks(child.marks)) return false;
  }
  return match.validEnd;
}
function joinable(a, b) {
  return !!(a && b && !a.isLeaf && canAppendWithSubstitutedLinebreaks(a, b));
}

/// Find an ancestor of the given position that can be joined to the
/// block before (or after if `dir` is positive). Returns the joinable
/// point, if any.
function joinPoint(doc, pos, dir = -1) {
  let $pos = doc.resolve(pos);
  for (let d = $pos.depth;; d--) {
    let before,
      after,
      index = $pos.index(d);
    if (d == $pos.depth) {
      before = $pos.nodeBefore;
      after = $pos.nodeAfter;
    } else if (dir > 0) {
      before = $pos.node(d + 1);
      index++;
      after = $pos.node(d).maybeChild(index);
    } else {
      before = $pos.node(d).maybeChild(index - 1);
      after = $pos.node(d + 1);
    }
    if (before && !before.isTextblock && joinable(before, after) && $pos.node(d).canReplace(index, index + 1)) return pos;
    if (d == 0) break;
    pos = dir < 0 ? $pos.before(d) : $pos.after(d);
  }
}
function join(tr, pos, depth) {
  let convertNewlines = null;
  let {
    linebreakReplacement
  } = tr.doc.type.schema;
  let $before = tr.doc.resolve(pos - depth),
    beforeType = $before.node().type;
  if (linebreakReplacement && beforeType.inlineContent) {
    let pre = beforeType.whitespace == "pre";
    let supportLinebreak = !!beforeType.contentMatch.matchType(linebreakReplacement);
    if (pre && !supportLinebreak) convertNewlines = false;else if (!pre && supportLinebreak) convertNewlines = true;
  }
  let mapFrom = tr.steps.length;
  if (convertNewlines === false) {
    let $after = tr.doc.resolve(pos + depth);
    replaceLinebreaks(tr, $after.node(), $after.before(), mapFrom);
  }
  if (beforeType.inlineContent) (0, _mark.clearIncompatible)(tr, pos + depth - 1, beforeType, $before.node().contentMatchAt($before.index()), convertNewlines == null);
  let mapping = tr.mapping.slice(mapFrom),
    start = mapping.map(pos - depth);
  tr.step(new _replace_step.ReplaceStep(start, mapping.map(pos + depth, -1), _prosemirrorModel.Slice.empty, true));
  if (convertNewlines === true) {
    let $full = tr.doc.resolve(start);
    replaceNewlines(tr, $full.node(), $full.before(), tr.steps.length);
  }
  return tr;
}

/// Try to find a point where a node of the given type can be inserted
/// near `pos`, by searching up the node hierarchy when `pos` itself
/// isn't a valid place but is at the start or end of a node. Return
/// null if no position was found.
function insertPoint(doc, pos, nodeType) {
  let $pos = doc.resolve(pos);
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType)) return pos;
  if ($pos.parentOffset == 0) for (let d = $pos.depth - 1; d >= 0; d--) {
    let index = $pos.index(d);
    if ($pos.node(d).canReplaceWith(index, index, nodeType)) return $pos.before(d + 1);
    if (index > 0) return null;
  }
  if ($pos.parentOffset == $pos.parent.content.size) for (let d = $pos.depth - 1; d >= 0; d--) {
    let index = $pos.indexAfter(d);
    if ($pos.node(d).canReplaceWith(index, index, nodeType)) return $pos.after(d + 1);
    if (index < $pos.node(d).childCount) return null;
  }
  return null;
}

/// Finds a position at or around the given position where the given
/// slice can be inserted. Will look at parent nodes' nearest boundary
/// and try there, even if the original position wasn't directly at the
/// start or end of that node. Returns null when no position was found.
function dropPoint(doc, pos, slice) {
  let $pos = doc.resolve(pos);
  if (!slice.content.size) return pos;
  let content = slice.content;
  for (let i = 0; i < slice.openStart; i++) content = content.firstChild.content;
  for (let pass = 1; pass <= (slice.openStart == 0 && slice.size ? 2 : 1); pass++) {
    for (let d = $pos.depth; d >= 0; d--) {
      let bias = d == $pos.depth ? 0 : $pos.pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2 ? -1 : 1;
      let insertPos = $pos.index(d) + (bias > 0 ? 1 : 0);
      let parent = $pos.node(d),
        fits = false;
      if (pass == 1) {
        fits = parent.canReplace(insertPos, insertPos, content);
      } else {
        let wrapping = parent.contentMatchAt(insertPos).findWrapping(content.firstChild.type);
        fits = wrapping && parent.canReplaceWith(insertPos, insertPos, wrapping[0]);
      }
      if (fits) return bias == 0 ? $pos.pos : bias < 0 ? $pos.before(d + 1) : $pos.after(d + 1);
    }
  }
  return null;
}
},
"prosemirror-transform/src/transform.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TransformError = exports.Transform = void 0;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _map = __require("prosemirror-transform/src/map.ts");
var _mark = __require("prosemirror-transform/src/mark.ts");
var _replace = __require("prosemirror-transform/src/replace.ts");
var _structure = __require("prosemirror-transform/src/structure.ts");
var _attr_step = __require("prosemirror-transform/src/attr_step.ts");
var _mark_step = __require("prosemirror-transform/src/mark_step.ts");
/// @internal
let TransformError = class extends Error {};
exports.TransformError = TransformError;
exports.TransformError = TransformError = function TransformError(message) {
  let err = Error.call(this, message);
  err.__proto__ = TransformError.prototype;
  return err;
};
TransformError.prototype = Object.create(Error.prototype);
TransformError.prototype.constructor = TransformError;
TransformError.prototype.name = "TransformError";

/// Abstraction to build up and track an array of
/// [steps](#transform.Step) representing a document transformation.
///
/// Most transforming methods return the `Transform` object itself, so
/// that they can be chained.
class Transform {
  /// Create a transform that starts with the given document.
  constructor(
  /// The current document (the result of applying the steps in the
  /// transform).
  doc) {
    this.doc = doc;
    /// The steps in this transform.
    this.steps = [];
    /// The documents before each of the steps.
    this.docs = [];
    /// A mapping with the maps for each of the steps in this transform.
    this.mapping = new _map.Mapping();
  }

  /// The starting document.
  get before() {
    return this.docs.length ? this.docs[0] : this.doc;
  }

  /// Apply a new step in this transform, saving the result. Throws an
  /// error when the step fails.
  step(step) {
    let result = this.maybeStep(step);
    if (result.failed) throw new TransformError(result.failed);
    return this;
  }

  /// Try to apply a step in this transformation, ignoring it if it
  /// fails. Returns the step result.
  maybeStep(step) {
    let result = step.apply(this.doc);
    if (!result.failed) this.addStep(step, result.doc);
    return result;
  }

  /// True when the document has been changed (when there are any
  /// steps).
  get docChanged() {
    return this.steps.length > 0;
  }

  /// Return a single range, in post-transform document positions,
  /// that covers all content changed by this transform. Returns null
  /// if no replacements are made. Note that this will ignore changes
  /// that add/remove marks without replacing the underlying content.
  changedRange() {
    let from = 1e9,
      to = -1e9;
    for (let i = 0; i < this.mapping.maps.length; i++) {
      let map = this.mapping.maps[i];
      if (i) {
        from = map.map(from, 1);
        to = map.map(to, -1);
      }
      map.forEach((_f, _t, fromB, toB) => {
        from = Math.min(from, fromB);
        to = Math.max(to, toB);
      });
    }
    return from == 1e9 ? null : {
      from,
      to
    };
  }

  /// @internal
  addStep(step, doc) {
    this.docs.push(this.doc);
    this.steps.push(step);
    this.mapping.appendMap(step.getMap());
    this.doc = doc;
  }

  /// Replace the part of the document between `from` and `to` with the
  /// given `slice`.
  replace(from, to = from, slice = _prosemirrorModel.Slice.empty) {
    let step = (0, _replace.replaceStep)(this.doc, from, to, slice);
    if (step) this.step(step);
    return this;
  }

  /// Replace the given range with the given content, which may be a
  /// fragment, node, or array of nodes.
  replaceWith(from, to, content) {
    return this.replace(from, to, new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(content), 0, 0));
  }

  /// Delete the content between the given positions.
  delete(from, to) {
    return this.replace(from, to, _prosemirrorModel.Slice.empty);
  }

  /// Insert the given content at the given position.
  insert(pos, content) {
    return this.replaceWith(pos, pos, content);
  }

  /// Replace a range of the document with a given slice, using
  /// `from`, `to`, and the slice's
  /// [`openStart`](#model.Slice.openStart) property as hints, rather
  /// than fixed start and end points. This method may grow the
  /// replaced area or close open nodes in the slice in order to get a
  /// fit that is more in line with WYSIWYG expectations, by dropping
  /// fully covered parent nodes of the replaced region when they are
  /// marked [non-defining as
  /// context](#model.NodeSpec.definingAsContext), or including an
  /// open parent node from the slice that _is_ marked as [defining
  /// its content](#model.NodeSpec.definingForContent).
  ///
  /// This is the method, for example, to handle paste. The similar
  /// [`replace`](#transform.Transform.replace) method is a more
  /// primitive tool which will _not_ move the start and end of its given
  /// range, and is useful in situations where you need more precise
  /// control over what happens.
  replaceRange(from, to, slice) {
    (0, _replace.replaceRange)(this, from, to, slice);
    return this;
  }

  /// Replace the given range with a node, but use `from` and `to` as
  /// hints, rather than precise positions. When from and to are the same
  /// and are at the start or end of a parent node in which the given
  /// node doesn't fit, this method may _move_ them out towards a parent
  /// that does allow the given node to be placed. When the given range
  /// completely covers a parent node, this method may completely replace
  /// that parent node.
  replaceRangeWith(from, to, node) {
    (0, _replace.replaceRangeWith)(this, from, to, node);
    return this;
  }

  /// Delete the given range, expanding it to cover fully covered
  /// parent nodes until a valid replace is found.
  deleteRange(from, to) {
    (0, _replace.deleteRange)(this, from, to);
    return this;
  }

  /// Split the content in the given range off from its parent, if there
  /// is sibling content before or after it, and move it up the tree to
  /// the depth specified by `target`. You'll probably want to use
  /// [`liftTarget`](#transform.liftTarget) to compute `target`, to make
  /// sure the lift is valid.
  lift(range, target) {
    (0, _structure.lift)(this, range, target);
    return this;
  }

  /// Join the blocks around the given position. If depth is 2, their
  /// last and first siblings are also joined, and so on.
  join(pos, depth = 1) {
    (0, _structure.join)(this, pos, depth);
    return this;
  }

  /// Wrap the given [range](#model.NodeRange) in the given set of wrappers.
  /// The wrappers are assumed to be valid in this position, and should
  /// probably be computed with [`findWrapping`](#transform.findWrapping).
  wrap(range, wrappers) {
    (0, _structure.wrap)(this, range, wrappers);
    return this;
  }

  /// Set the type of all textblocks (partly) between `from` and `to` to
  /// the given node type with the given attributes.
  setBlockType(from, to = from, type, attrs = null) {
    (0, _structure.setBlockType)(this, from, to, type, attrs);
    return this;
  }

  /// Change the type, attributes, and/or marks of the node at `pos`.
  /// When `type` isn't given, the existing node type is preserved,
  setNodeMarkup(pos, type, attrs = null, marks) {
    (0, _structure.setNodeMarkup)(this, pos, type, attrs, marks);
    return this;
  }

  /// Set a single attribute on a given node to a new value.
  /// The `pos` addresses the document content. Use `setDocAttribute`
  /// to set attributes on the document itself.
  setNodeAttribute(pos, attr, value) {
    this.step(new _attr_step.AttrStep(pos, attr, value));
    return this;
  }

  /// Set a single attribute on the document to a new value.
  setDocAttribute(attr, value) {
    this.step(new _attr_step.DocAttrStep(attr, value));
    return this;
  }

  /// Add a mark to the node at position `pos`.
  addNodeMark(pos, mark) {
    this.step(new _mark_step.AddNodeMarkStep(pos, mark));
    return this;
  }

  /// Remove a mark (or all marks of the given type) from the node at
  /// position `pos`.
  removeNodeMark(pos, mark) {
    let node = this.doc.nodeAt(pos);
    if (!node) throw new RangeError("No node at position " + pos);
    if (mark instanceof _prosemirrorModel.Mark) {
      if (mark.isInSet(node.marks)) this.step(new _mark_step.RemoveNodeMarkStep(pos, mark));
    } else {
      let set = node.marks,
        found,
        steps = [];
      while (found = mark.isInSet(set)) {
        steps.push(new _mark_step.RemoveNodeMarkStep(pos, found));
        set = found.removeFromSet(set);
      }
      for (let i = steps.length - 1; i >= 0; i--) this.step(steps[i]);
    }
    return this;
  }

  /// Split the node at the given position, and optionally, if `depth` is
  /// greater than one, any number of nodes above that. By default, the
  /// parts split off will inherit the node type of the original node.
  /// This can be changed by passing an array of types and attributes to
  /// use after the split (with the outermost nodes coming first).
  split(pos, depth = 1, typesAfter) {
    (0, _structure.split)(this, pos, depth, typesAfter);
    return this;
  }

  /// Add the given mark to the inline content between `from` and `to`.
  addMark(from, to, mark) {
    (0, _mark.addMark)(this, from, to, mark);
    return this;
  }

  /// Remove marks from inline nodes between `from` and `to`. When
  /// `mark` is a single mark, remove precisely that mark. When it is
  /// a mark type, remove all marks of that type. When it is null,
  /// remove all marks of any type.
  removeMark(from, to, mark) {
    (0, _mark.removeMark)(this, from, to, mark);
    return this;
  }

  /// Removes all marks and nodes from the content of the node at
  /// `pos` that don't match the given new parent node type. Accepts
  /// an optional starting [content match](#model.ContentMatch) as
  /// third argument.
  clearIncompatible(pos, parentType, match) {
    (0, _mark.clearIncompatible)(this, pos, parentType, match);
    return this;
  }
}
exports.Transform = Transform;
},
"prosemirror-view/src/browser.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.windows = exports.webkit_version = exports.webkit = exports.safari = exports.mac = exports.ios = exports.ie_version = exports.ie = exports.gecko_version = exports.gecko = exports.chrome_version = exports.chrome = exports.android = void 0;
const nav = typeof navigator != "undefined" ? navigator : null;
const doc = typeof document != "undefined" ? document : null;
const agent = nav && nav.userAgent || "";
const ie_edge = /Edge\/(\d+)/.exec(agent);
const ie_upto10 = /MSIE \d/.exec(agent);
const ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(agent);
const ie = exports.ie = !!(ie_upto10 || ie_11up || ie_edge);
const ie_version = exports.ie_version = ie_upto10 ? document.documentMode : ie_11up ? +ie_11up[1] : ie_edge ? +ie_edge[1] : 0;
const gecko = exports.gecko = !ie && /gecko\/(\d+)/i.test(agent);
const gecko_version = exports.gecko_version = gecko && +(/Firefox\/(\d+)/.exec(agent) || [0, 0])[1];
const _chrome = !ie && /Chrome\/(\d+)/.exec(agent);
const chrome = exports.chrome = !!_chrome;
const chrome_version = exports.chrome_version = _chrome ? +_chrome[1] : 0;
const safari = exports.safari = !ie && !!nav && /Apple Computer/.test(nav.vendor);
// Is true for both iOS and iPadOS for convenience
const ios = exports.ios = safari && (/Mobile\/\w+/.test(agent) || !!nav && nav.maxTouchPoints > 2);
const mac = exports.mac = ios || (nav ? /Mac/.test(nav.platform) : false);
const windows = exports.windows = nav ? /Win/.test(nav.platform) : false;
const android = exports.android = /Android \d/.test(agent);
const webkit = exports.webkit = !!doc && "webkitFontSmoothing" in doc.documentElement.style;
const webkit_version = exports.webkit_version = webkit ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1] : 0;
},
"prosemirror-view/src/capturekeys.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.captureKeyDown = captureKeyDown;
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
var _dom = __require("prosemirror-view/src/dom.ts");
var _selection = __require("prosemirror-view/src/selection.ts");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function moveSelectionBlock(state, dir) {
  let {
    $anchor,
    $head
  } = state.selection;
  let $side = dir > 0 ? $anchor.max($head) : $anchor.min($head);
  let $start = !$side.parent.inlineContent ? $side : $side.depth ? state.doc.resolve(dir > 0 ? $side.after() : $side.before()) : null;
  return $start && _prosemirrorState.Selection.findFrom($start, dir);
}
function apply(view, sel) {
  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
  return true;
}
function selectHorizontally(view, dir, mods) {
  let sel = view.state.selection;
  if (sel instanceof _prosemirrorState.TextSelection) {
    if (mods.indexOf("s") > -1) {
      let {
          $head
        } = sel,
        node = $head.textOffset ? null : dir < 0 ? $head.nodeBefore : $head.nodeAfter;
      if (!node || node.isText || !node.isLeaf) return false;
      let $newHead = view.state.doc.resolve($head.pos + node.nodeSize * (dir < 0 ? -1 : 1));
      return apply(view, new _prosemirrorState.TextSelection(sel.$anchor, $newHead));
    } else if (!sel.empty) {
      return false;
    } else if (view.endOfTextblock(dir > 0 ? "forward" : "backward")) {
      let next = moveSelectionBlock(view.state, dir);
      if (next && next instanceof _prosemirrorState.NodeSelection) return apply(view, next);
      return false;
    } else if (!(browser.mac && mods.indexOf("m") > -1)) {
      let $head = sel.$head,
        node = $head.textOffset ? null : dir < 0 ? $head.nodeBefore : $head.nodeAfter,
        desc;
      if (!node || node.isText) return false;
      let nodePos = dir < 0 ? $head.pos - node.nodeSize : $head.pos;
      if (!(node.isAtom || (desc = view.docView.descAt(nodePos)) && !desc.contentDOM)) return false;
      if (_prosemirrorState.NodeSelection.isSelectable(node)) {
        return apply(view, new _prosemirrorState.NodeSelection(dir < 0 ? view.state.doc.resolve($head.pos - node.nodeSize) : $head));
      } else if (browser.webkit) {
        // Chrome and Safari will introduce extra pointless cursor
        // positions around inline uneditable nodes, so we have to
        // take over and move the cursor past them (#937)
        return apply(view, new _prosemirrorState.TextSelection(view.state.doc.resolve(dir < 0 ? nodePos : nodePos + node.nodeSize)));
      } else {
        return false;
      }
    }
  } else if (sel instanceof _prosemirrorState.NodeSelection && sel.node.isInline) {
    return apply(view, new _prosemirrorState.TextSelection(dir > 0 ? sel.$to : sel.$from));
  } else {
    let next = moveSelectionBlock(view.state, dir);
    if (next) return apply(view, next);
    return false;
  }
}
function nodeLen(node) {
  return node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length;
}
function isIgnorable(dom, dir) {
  let desc = dom.pmViewDesc;
  return desc && desc.size == 0 && (dir < 0 || dom.nextSibling || dom.nodeName != "BR");
}
function skipIgnoredNodes(view, dir) {
  return dir < 0 ? skipIgnoredNodesBefore(view) : skipIgnoredNodesAfter(view);
}

// Make sure the cursor isn't directly after one or more ignored
// nodes, which will confuse the browser's cursor motion logic.
function skipIgnoredNodesBefore(view) {
  let sel = view.domSelectionRange();
  let node = sel.focusNode,
    offset = sel.focusOffset;
  if (!node) return;
  let moveNode,
    moveOffset,
    force = false;
  // Gecko will do odd things when the selection is directly in front
  // of a non-editable node, so in that case, move it into the next
  // node if possible. Issue prosemirror/prosemirror#832.
  if (browser.gecko && node.nodeType == 1 && offset < nodeLen(node) && isIgnorable(node.childNodes[offset], -1)) force = true;
  for (;;) {
    if (offset > 0) {
      if (node.nodeType != 1) {
        break;
      } else {
        let before = node.childNodes[offset - 1];
        if (isIgnorable(before, -1)) {
          moveNode = node;
          moveOffset = --offset;
        } else if (before.nodeType == 3) {
          node = before;
          offset = node.nodeValue.length;
        } else break;
      }
    } else if (isBlockNode(node)) {
      break;
    } else {
      let prev = node.previousSibling;
      while (prev && isIgnorable(prev, -1)) {
        moveNode = node.parentNode;
        moveOffset = (0, _dom.domIndex)(prev);
        prev = prev.previousSibling;
      }
      if (!prev) {
        node = node.parentNode;
        if (node == view.dom) break;
        offset = 0;
      } else {
        node = prev;
        offset = nodeLen(node);
      }
    }
  }
  if (force) setSelFocus(view, node, offset);else if (moveNode) setSelFocus(view, moveNode, moveOffset);
}

// Make sure the cursor isn't directly before one or more ignored
// nodes.
function skipIgnoredNodesAfter(view) {
  let sel = view.domSelectionRange();
  let node = sel.focusNode,
    offset = sel.focusOffset;
  if (!node) return;
  let len = nodeLen(node);
  let moveNode, moveOffset;
  for (;;) {
    if (offset < len) {
      if (node.nodeType != 1) break;
      let after = node.childNodes[offset];
      if (isIgnorable(after, 1)) {
        moveNode = node;
        moveOffset = ++offset;
      } else break;
    } else if (isBlockNode(node)) {
      break;
    } else {
      let next = node.nextSibling;
      while (next && isIgnorable(next, 1)) {
        moveNode = next.parentNode;
        moveOffset = (0, _dom.domIndex)(next) + 1;
        next = next.nextSibling;
      }
      if (!next) {
        node = node.parentNode;
        if (node == view.dom) break;
        offset = len = 0;
      } else {
        node = next;
        offset = 0;
        len = nodeLen(node);
      }
    }
  }
  if (moveNode) setSelFocus(view, moveNode, moveOffset);
}
function isBlockNode(dom) {
  let desc = dom.pmViewDesc;
  return desc && desc.node && desc.node.isBlock;
}
function textNodeAfter(node, offset) {
  while (node && offset == node.childNodes.length && !(0, _dom.hasBlockDesc)(node)) {
    offset = (0, _dom.domIndex)(node) + 1;
    node = node.parentNode;
  }
  while (node && offset < node.childNodes.length) {
    let next = node.childNodes[offset];
    if (next.nodeType == 3) return next;
    if (next.nodeType == 1 && next.contentEditable == "false") break;
    node = next;
    offset = 0;
  }
}
function textNodeBefore(node, offset) {
  while (node && !offset && !(0, _dom.hasBlockDesc)(node)) {
    offset = (0, _dom.domIndex)(node);
    node = node.parentNode;
  }
  while (node && offset) {
    let next = node.childNodes[offset - 1];
    if (next.nodeType == 3) return next;
    if (next.nodeType == 1 && next.contentEditable == "false") break;
    node = next;
    offset = node.childNodes.length;
  }
}
function setSelFocus(view, node, offset) {
  if (node.nodeType != 3) {
    let before, after;
    if (after = textNodeAfter(node, offset)) {
      node = after;
      offset = 0;
    } else if (before = textNodeBefore(node, offset)) {
      node = before;
      offset = before.nodeValue.length;
    }
  }
  let sel = view.domSelection();
  if (!sel) return;
  if ((0, _dom.selectionCollapsed)(sel)) {
    let range = document.createRange();
    range.setEnd(node, offset);
    range.setStart(node, offset);
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (sel.extend) {
    sel.extend(node, offset);
  }
  view.domObserver.setCurSelection();
  let {
    state
  } = view;
  // If no state update ends up happening, reset the selection.
  setTimeout(() => {
    if (view.state == state) (0, _selection.selectionToDOM)(view);
  }, 50);
}
function findDirection(view, pos) {
  let $pos = view.state.doc.resolve(pos);
  if (!(browser.chrome || browser.windows) && $pos.parent.inlineContent) {
    let coords = view.coordsAtPos(pos);
    if (pos > $pos.start()) {
      let before = view.coordsAtPos(pos - 1);
      let mid = (before.top + before.bottom) / 2;
      if (mid > coords.top && mid < coords.bottom && Math.abs(before.left - coords.left) > 1) return before.left < coords.left ? "ltr" : "rtl";
    }
    if (pos < $pos.end()) {
      let after = view.coordsAtPos(pos + 1);
      let mid = (after.top + after.bottom) / 2;
      if (mid > coords.top && mid < coords.bottom && Math.abs(after.left - coords.left) > 1) return after.left > coords.left ? "ltr" : "rtl";
    }
  }
  let computed = getComputedStyle(view.dom).direction;
  return computed == "rtl" ? "rtl" : "ltr";
}

// Check whether vertical selection motion would involve node
// selections. If so, apply it (if not, the result is left to the
// browser)
function selectVertically(view, dir, mods) {
  let sel = view.state.selection;
  if (sel instanceof _prosemirrorState.TextSelection && !sel.empty || mods.indexOf("s") > -1) return false;
  if (browser.mac && mods.indexOf("m") > -1) return false;
  let {
    $from,
    $to
  } = sel;
  if (!$from.parent.inlineContent || view.endOfTextblock(dir < 0 ? "up" : "down")) {
    let next = moveSelectionBlock(view.state, dir);
    if (next && next instanceof _prosemirrorState.NodeSelection) return apply(view, next);
  }
  if (!$from.parent.inlineContent) {
    let side = dir < 0 ? $from : $to;
    let beyond = sel instanceof _prosemirrorState.AllSelection ? _prosemirrorState.Selection.near(side, dir) : _prosemirrorState.Selection.findFrom(side, dir);
    return beyond ? apply(view, beyond) : false;
  }
  return false;
}
function stopNativeHorizontalDelete(view, dir) {
  if (!(view.state.selection instanceof _prosemirrorState.TextSelection)) return true;
  let {
    $head,
    $anchor,
    empty
  } = view.state.selection;
  if (!$head.sameParent($anchor)) return true;
  if (!empty) return false;
  if (view.endOfTextblock(dir > 0 ? "forward" : "backward")) return true;
  let nextNode = !$head.textOffset && (dir < 0 ? $head.nodeBefore : $head.nodeAfter);
  if (nextNode && !nextNode.isText) {
    let tr = view.state.tr;
    if (dir < 0) tr.delete($head.pos - nextNode.nodeSize, $head.pos);else tr.delete($head.pos, $head.pos + nextNode.nodeSize);
    view.dispatch(tr);
    return true;
  }
  return false;
}
function switchEditable(view, node, state) {
  view.domObserver.stop();
  node.contentEditable = state;
  view.domObserver.start();
}

// Issue #867 / #1090 / https://bugs.chromium.org/p/chromium/issues/detail?id=903821
// In which Safari (and at some point in the past, Chrome) does really
// wrong things when the down arrow is pressed when the cursor is
// directly at the start of a textblock and has an uneditable node
// after it
function safariDownArrowBug(view) {
  if (!browser.safari || view.state.selection.$head.parentOffset > 0) return false;
  let {
    focusNode,
    focusOffset
  } = view.domSelectionRange();
  if (focusNode && focusNode.nodeType == 1 && focusOffset == 0 && focusNode.firstChild && focusNode.firstChild.contentEditable == "false") {
    let child = focusNode.firstChild;
    switchEditable(view, child, "true");
    setTimeout(() => switchEditable(view, child, "false"), 20);
  }
  return false;
}

// A backdrop key mapping used to make sure we always suppress keys
// that have a dangerous default effect, even if the commands they are
// bound to return false, and to make sure that cursor-motion keys
// find a cursor (as opposed to a node selection) when pressed. For
// cursor-motion keys, the code in the handlers also takes care of
// block selections.

function getMods(event) {
  let result = "";
  if (event.ctrlKey) result += "c";
  if (event.metaKey) result += "m";
  if (event.altKey) result += "a";
  if (event.shiftKey) result += "s";
  return result;
}
function captureKeyDown(view, event) {
  let code = event.keyCode,
    mods = getMods(event);
  if (code == 8 || browser.mac && code == 72 && mods == "c") {
    // Backspace, Ctrl-h on Mac
    return stopNativeHorizontalDelete(view, -1) || skipIgnoredNodes(view, -1);
  } else if (code == 46 && !event.shiftKey || browser.mac && code == 68 && mods == "c") {
    // Delete, Ctrl-d on Mac
    return stopNativeHorizontalDelete(view, 1) || skipIgnoredNodes(view, 1);
  } else if (code == 13 || code == 27) {
    // Enter, Esc
    return true;
  } else if (code == 37 || browser.mac && code == 66 && mods == "c") {
    // Left arrow, Ctrl-b on Mac
    let dir = code == 37 ? findDirection(view, view.state.selection.from) == "ltr" ? -1 : 1 : -1;
    return selectHorizontally(view, dir, mods) || skipIgnoredNodes(view, dir);
  } else if (code == 39 || browser.mac && code == 70 && mods == "c") {
    // Right arrow, Ctrl-f on Mac
    let dir = code == 39 ? findDirection(view, view.state.selection.from) == "ltr" ? 1 : -1 : 1;
    return selectHorizontally(view, dir, mods) || skipIgnoredNodes(view, dir);
  } else if (code == 38 || browser.mac && code == 80 && mods == "c") {
    // Up arrow, Ctrl-p on Mac
    return selectVertically(view, -1, mods) || skipIgnoredNodes(view, -1);
  } else if (code == 40 || browser.mac && code == 78 && mods == "c") {
    // Down arrow, Ctrl-n on Mac
    return safariDownArrowBug(view) || selectVertically(view, 1, mods) || skipIgnoredNodes(view, 1);
  } else if (mods == (browser.mac ? "m" : "c") && (code == 66 || code == 73 || code == 89 || code == 90)) {
    // Mod-[biyz]
    return true;
  }
  return false;
}
},
"prosemirror-view/src/clipboard.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseFromClipboard = parseFromClipboard;
exports.serializeForClipboard = serializeForClipboard;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function serializeForClipboard(view, slice) {
  view.someProp("transformCopied", f => {
    slice = f(slice, view);
  });
  let context = [],
    {
      content,
      openStart,
      openEnd
    } = slice;
  while (openStart > 1 && openEnd > 1 && content.childCount == 1 && content.firstChild.childCount == 1) {
    openStart--;
    openEnd--;
    let node = content.firstChild;
    context.push(node.type.name, node.attrs != node.type.defaultAttrs ? node.attrs : null);
    content = node.content;
  }
  let serializer = view.someProp("clipboardSerializer") || _prosemirrorModel.DOMSerializer.fromSchema(view.state.schema);
  let doc = detachedDoc(),
    wrap = doc.createElement("div");
  wrap.appendChild(serializer.serializeFragment(content, {
    document: doc
  }));
  let firstChild = wrap.firstChild,
    needsWrap,
    wrappers = 0;
  while (firstChild && firstChild.nodeType == 1 && (needsWrap = wrapMap[firstChild.nodeName.toLowerCase()])) {
    for (let i = needsWrap.length - 1; i >= 0; i--) {
      let wrapper = doc.createElement(needsWrap[i]);
      while (wrap.firstChild) wrapper.appendChild(wrap.firstChild);
      wrap.appendChild(wrapper);
      wrappers++;
    }
    firstChild = wrap.firstChild;
  }
  if (firstChild && firstChild.nodeType == 1) firstChild.setAttribute("data-pm-slice", `${openStart} ${openEnd}${wrappers ? ` -${wrappers}` : ""} ${JSON.stringify(context)}`);
  let text = view.someProp("clipboardTextSerializer", f => f(slice, view)) || slice.content.textBetween(0, slice.content.size, "\n\n");
  return {
    dom: wrap,
    text,
    slice
  };
}

// Read a slice of content from the clipboard (or drop data).
function parseFromClipboard(view, text, html, plainText, $context) {
  let inCode = $context.parent.type.spec.code;
  let dom, slice;
  if (!html && !text) return null;
  let asText = !!text && (plainText || inCode || !html);
  if (asText) {
    view.someProp("transformPastedText", f => {
      text = f(text, inCode || plainText, view);
    });
    if (inCode) {
      slice = new _prosemirrorModel.Slice(_prosemirrorModel.Fragment.from(view.state.schema.text(text.replace(/\r\n?/g, "\n"))), 0, 0);
      view.someProp("transformPasted", f => {
        slice = f(slice, view, true);
      });
      return slice;
    }
    let parsed = view.someProp("clipboardTextParser", f => f(text, $context, plainText, view));
    if (parsed) {
      slice = parsed;
    } else {
      let marks = $context.marks();
      let {
          schema
        } = view.state,
        serializer = _prosemirrorModel.DOMSerializer.fromSchema(schema);
      dom = document.createElement("div");
      text.split(/(?:\r\n?|\n)+/).forEach(block => {
        let p = dom.appendChild(document.createElement("p"));
        if (block) p.appendChild(serializer.serializeNode(schema.text(block, marks)));
      });
    }
  } else {
    view.someProp("transformPastedHTML", f => {
      html = f(html, view);
    });
    dom = readHTML(html);
    if (browser.webkit) restoreReplacedSpaces(dom);
  }
  let contextNode = dom && dom.querySelector("[data-pm-slice]");
  let sliceData = contextNode && /^(\d+) (\d+)(?: -(\d+))? (.*)/.exec(contextNode.getAttribute("data-pm-slice") || "");
  if (sliceData && sliceData[3]) for (let i = +sliceData[3]; i > 0; i--) {
    let child = dom.firstChild;
    while (child && child.nodeType != 1) child = child.nextSibling;
    if (!child) break;
    dom = child;
  }
  if (!slice) {
    let parser = view.someProp("clipboardParser") || view.someProp("domParser") || _prosemirrorModel.DOMParser.fromSchema(view.state.schema);
    slice = parser.parseSlice(dom, {
      preserveWhitespace: !!(asText || sliceData),
      context: $context,
      ruleFromNode(dom) {
        if (dom.nodeName == "BR" && !dom.nextSibling && dom.parentNode && !inlineParents.test(dom.parentNode.nodeName)) return {
          ignore: true
        };
        return null;
      }
    });
  }
  if (sliceData) {
    slice = addContext(closeSlice(slice, +sliceData[1], +sliceData[2]), sliceData[4]);
  } else {
    // HTML wasn't created by ProseMirror. Make sure top-level siblings are coherent
    slice = _prosemirrorModel.Slice.maxOpen(normalizeSiblings(slice.content, $context), true);
    if (slice.openStart || slice.openEnd) {
      let openStart = 0,
        openEnd = 0;
      for (let node = slice.content.firstChild; openStart < slice.openStart && !node.type.spec.isolating; openStart++, node = node.firstChild) {}
      for (let node = slice.content.lastChild; openEnd < slice.openEnd && !node.type.spec.isolating; openEnd++, node = node.lastChild) {}
      slice = closeSlice(slice, openStart, openEnd);
    }
  }
  view.someProp("transformPasted", f => {
    slice = f(slice, view, asText);
  });
  return slice;
}
const inlineParents = /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i;

// Takes a slice parsed with parseSlice, which means there hasn't been
// any content-expression checking done on the top nodes, tries to
// find a parent node in the current context that might fit the nodes,
// and if successful, rebuilds the slice so that it fits into that parent.
//
// This addresses the problem that Transform.replace expects a
// coherent slice, and will fail to place a set of siblings that don't
// fit anywhere in the schema.
function normalizeSiblings(fragment, $context) {
  if (fragment.childCount < 2) return fragment;
  for (let d = $context.depth; d >= 0; d--) {
    let parent = $context.node(d);
    let match = parent.contentMatchAt($context.index(d));
    let lastWrap,
      result = [];
    fragment.forEach(node => {
      if (!result) return;
      let wrap = match.findWrapping(node.type),
        inLast;
      if (!wrap) return result = null;
      if (inLast = result.length && lastWrap.length && addToSibling(wrap, lastWrap, node, result[result.length - 1], 0)) {
        result[result.length - 1] = inLast;
      } else {
        if (result.length) result[result.length - 1] = closeRight(result[result.length - 1], lastWrap.length);
        let wrapped = withWrappers(node, wrap);
        result.push(wrapped);
        match = match.matchType(wrapped.type);
        lastWrap = wrap;
      }
    });
    if (result) return _prosemirrorModel.Fragment.from(result);
  }
  return fragment;
}
function withWrappers(node, wrap, from = 0) {
  for (let i = wrap.length - 1; i >= from; i--) node = wrap[i].create(null, _prosemirrorModel.Fragment.from(node));
  return node;
}

// Used to group adjacent nodes wrapped in similar parents by
// normalizeSiblings into the same parent node
function addToSibling(wrap, lastWrap, node, sibling, depth) {
  if (depth < wrap.length && depth < lastWrap.length && wrap[depth] == lastWrap[depth]) {
    let inner = addToSibling(wrap, lastWrap, node, sibling.lastChild, depth + 1);
    if (inner) return sibling.copy(sibling.content.replaceChild(sibling.childCount - 1, inner));
    let match = sibling.contentMatchAt(sibling.childCount);
    if (match.matchType(depth == wrap.length - 1 ? node.type : wrap[depth + 1])) return sibling.copy(sibling.content.append(_prosemirrorModel.Fragment.from(withWrappers(node, wrap, depth + 1))));
  }
}
function closeRight(node, depth) {
  if (depth == 0) return node;
  let fragment = node.content.replaceChild(node.childCount - 1, closeRight(node.lastChild, depth - 1));
  let fill = node.contentMatchAt(node.childCount).fillBefore(_prosemirrorModel.Fragment.empty, true);
  return node.copy(fragment.append(fill));
}
function closeRange(fragment, side, from, to, depth, openEnd) {
  let node = side < 0 ? fragment.firstChild : fragment.lastChild,
    inner = node.content;
  if (fragment.childCount > 1) openEnd = 0;
  if (depth < to - 1) inner = closeRange(inner, side, from, to, depth + 1, openEnd);
  if (depth >= from) inner = side < 0 ? node.contentMatchAt(0).fillBefore(inner, openEnd <= depth).append(inner) : inner.append(node.contentMatchAt(node.childCount).fillBefore(_prosemirrorModel.Fragment.empty, true));
  return fragment.replaceChild(side < 0 ? 0 : fragment.childCount - 1, node.copy(inner));
}
function closeSlice(slice, openStart, openEnd) {
  if (openStart < slice.openStart) slice = new _prosemirrorModel.Slice(closeRange(slice.content, -1, openStart, slice.openStart, 0, slice.openEnd), openStart, slice.openEnd);
  if (openEnd < slice.openEnd) slice = new _prosemirrorModel.Slice(closeRange(slice.content, 1, openEnd, slice.openEnd, 0, 0), slice.openStart, openEnd);
  return slice;
}

// Trick from jQuery -- some elements must be wrapped in other
// elements for innerHTML to work. I.e. if you do `div.innerHTML =
// "<td>..</td>"` the table cells are ignored.
const wrapMap = {
  thead: ["table"],
  tbody: ["table"],
  tfoot: ["table"],
  caption: ["table"],
  colgroup: ["table"],
  col: ["table", "colgroup"],
  tr: ["table", "tbody"],
  td: ["table", "tbody", "tr"],
  th: ["table", "tbody", "tr"]
};
let _detachedDoc = null;
function detachedDoc() {
  return _detachedDoc || (_detachedDoc = document.implementation.createHTMLDocument("title"));
}
let _policy = null;
function maybeWrapTrusted(html) {
  let trustedTypes = window.trustedTypes;
  if (!trustedTypes) return html;
  // With the require-trusted-types-for CSP, Chrome will block
  // innerHTML, even on a detached document. This wraps the string in
  // a way that makes the browser allow us to use its parser again.
  if (!_policy) _policy = trustedTypes.defaultPolicy || trustedTypes.createPolicy("ProseMirrorClipboard", {
    createHTML: s => s
  });
  return _policy.createHTML(html);
}
function readHTML(html) {
  let metas = /^(\s*<meta [^>]*>)*/.exec(html);
  if (metas) html = html.slice(metas[0].length);
  let elt = detachedDoc().createElement("div");
  let firstTag = /<([a-z][^>\s]+)/i.exec(html),
    wrap;
  if (wrap = firstTag && wrapMap[firstTag[1].toLowerCase()]) html = wrap.map(n => "<" + n + ">").join("") + html + wrap.map(n => "</" + n + ">").reverse().join("");
  elt.innerHTML = maybeWrapTrusted(html);
  if (wrap) for (let i = 0; i < wrap.length; i++) elt = elt.querySelector(wrap[i]) || elt;
  return elt;
}

// Webkit browsers do some hard-to-predict replacement of regular
// spaces with non-breaking spaces when putting content on the
// clipboard. This tries to convert such non-breaking spaces (which
// will be wrapped in a plain span on Chrome, a span with class
// Apple-converted-space on Safari) back to regular spaces.
function restoreReplacedSpaces(dom) {
  let nodes = dom.querySelectorAll(browser.chrome ? "span:not([class]):not([style])" : "span.Apple-converted-space");
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (node.childNodes.length == 1 && node.textContent == "\u00a0" && node.parentNode) node.parentNode.replaceChild(dom.ownerDocument.createTextNode(" "), node);
  }
}
function addContext(slice, context) {
  if (!slice.size) return slice;
  let schema = slice.content.firstChild.type.schema,
    array;
  try {
    array = JSON.parse(context);
  } catch (e) {
    return slice;
  }
  let {
    content,
    openStart,
    openEnd
  } = slice;
  for (let i = array.length - 2; i >= 0; i -= 2) {
    let type = schema.nodes[array[i]];
    if (!type || type.hasRequiredAttrs()) break;
    content = _prosemirrorModel.Fragment.from(type.create(array[i + 1], content));
    openStart++;
    openEnd++;
  }
  return new _prosemirrorModel.Slice(content, openStart, openEnd);
}
},
"prosemirror-view/src/decoration.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WidgetType = exports.NodeType = exports.InlineType = exports.DecorationSet = exports.Decoration = void 0;
exports.viewDecorations = viewDecorations;
var _DecorationSet;
function compareObjs(a, b) {
  if (a == b) return true;
  for (let p in a) if (a[p] !== b[p]) return false;
  for (let p in b) if (!(p in a)) return false;
  return true;
}
class WidgetType {
  constructor(toDOM, spec) {
    this.toDOM = toDOM;
    this.spec = void 0;
    this.side = void 0;
    this.spec = spec || noSpec;
    this.side = this.spec.side || 0;
  }
  map(mapping, span, offset, oldOffset) {
    let {
      pos,
      deleted
    } = mapping.mapResult(span.from + oldOffset, this.side < 0 ? -1 : 1);
    return deleted ? null : new Decoration(pos - offset, pos - offset, this);
  }
  valid() {
    return true;
  }
  eq(other) {
    return this == other || other instanceof WidgetType && (this.spec.key && this.spec.key == other.spec.key || this.toDOM == other.toDOM && compareObjs(this.spec, other.spec));
  }
  destroy(node) {
    if (this.spec.destroy) this.spec.destroy(node);
  }
}
exports.WidgetType = WidgetType;
class InlineType {
  constructor(attrs, spec) {
    this.attrs = attrs;
    this.spec = void 0;
    this.spec = spec || noSpec;
  }
  map(mapping, span, offset, oldOffset) {
    let from = mapping.map(span.from + oldOffset, this.spec.inclusiveStart ? -1 : 1) - offset;
    let to = mapping.map(span.to + oldOffset, this.spec.inclusiveEnd ? 1 : -1) - offset;
    return from >= to ? null : new Decoration(from, to, this);
  }
  valid(_, span) {
    return span.from < span.to;
  }
  eq(other) {
    return this == other || other instanceof InlineType && compareObjs(this.attrs, other.attrs) && compareObjs(this.spec, other.spec);
  }
  static is(span) {
    return span.type instanceof InlineType;
  }
  destroy() {}
}
exports.InlineType = InlineType;
class NodeType {
  constructor(attrs, spec) {
    this.attrs = attrs;
    this.spec = void 0;
    this.spec = spec || noSpec;
  }
  map(mapping, span, offset, oldOffset) {
    let from = mapping.mapResult(span.from + oldOffset, 1);
    if (from.deleted) return null;
    let to = mapping.mapResult(span.to + oldOffset, -1);
    if (to.deleted || to.pos <= from.pos) return null;
    return new Decoration(from.pos - offset, to.pos - offset, this);
  }
  valid(node, span) {
    let {
        index,
        offset
      } = node.content.findIndex(span.from),
      child;
    return offset == span.from && !(child = node.child(index)).isText && offset + child.nodeSize == span.to;
  }
  eq(other) {
    return this == other || other instanceof NodeType && compareObjs(this.attrs, other.attrs) && compareObjs(this.spec, other.spec);
  }
  destroy() {}
}

/// Decoration objects can be provided to the view through the
/// [`decorations` prop](#view.EditorProps.decorations). They come in
/// several variants—see the static members of this class for details.
exports.NodeType = NodeType;
class Decoration {
  /// @internal
  constructor(
  /// The start position of the decoration.
  from,
  /// The end position. Will be the same as `from` for [widget
  /// decorations](#view.Decoration^widget).
  to,
  /// @internal
  type) {
    this.from = from;
    this.to = to;
    this.type = type;
  }

  /// @internal
  copy(from, to) {
    return new Decoration(from, to, this.type);
  }

  /// @internal
  eq(other, offset = 0) {
    return this.type.eq(other.type) && this.from + offset == other.from && this.to + offset == other.to;
  }

  /// @internal
  map(mapping, offset, oldOffset) {
    return this.type.map(mapping, this, offset, oldOffset);
  }

  /// Creates a widget decoration, which is a DOM node that's shown in
  /// the document at the given position. It is recommended that you
  /// delay rendering the widget by passing a function that will be
  /// called when the widget is actually drawn in a view, but you can
  /// also directly pass a DOM node. `getPos` can be used to find the
  /// widget's current document position.
  static widget(pos, toDOM, spec) {
    return new Decoration(pos, pos, new WidgetType(toDOM, spec));
  }

  /// Creates an inline decoration, which adds the given attributes to
  /// each inline node between `from` and `to`.
  static inline(from, to, attrs, spec) {
    return new Decoration(from, to, new InlineType(attrs, spec));
  }

  /// Creates a node decoration. `from` and `to` should point precisely
  /// before and after a node in the document. That node, and only that
  /// node, will receive the given attributes.
  static node(from, to, attrs, spec) {
    return new Decoration(from, to, new NodeType(attrs, spec));
  }

  /// The spec provided when creating this decoration. Can be useful
  /// if you've stored extra information in that object.
  get spec() {
    return this.type.spec;
  }

  /// @internal
  get inline() {
    return this.type instanceof InlineType;
  }

  /// @internal
  get widget() {
    return this.type instanceof WidgetType;
  }
}

/// A set of attributes to add to a decorated node. Most properties
/// simply directly correspond to DOM attributes of the same name,
/// which will be set to the property's value. These are exceptions:
exports.Decoration = Decoration;
const none = [],
  noSpec = {};

/// An object that can [provide](#view.EditorProps.decorations)
/// decorations. Implemented by [`DecorationSet`](#view.DecorationSet),
/// and passed to [node views](#view.EditorProps.nodeViews).

/// A collection of [decorations](#view.Decoration), organized in such
/// a way that the drawing algorithm can efficiently use and compare
/// them. This is a persistent data structure—it is not modified,
/// updates create a new value.
class DecorationSet {
  /// @internal
  constructor(local, children) {
    /// @internal
    this.local = void 0;
    /// @internal
    this.children = void 0;
    this.local = local.length ? local : none;
    this.children = children.length ? children : none;
  }

  /// Create a set of decorations, using the structure of the given
  /// document. This will consume (modify) the `decorations` array, so
  /// you must make a copy if you want need to preserve that.
  static create(doc, decorations) {
    return decorations.length ? buildTree(decorations, doc, 0, noSpec) : empty;
  }

  /// Find all decorations in this set which touch the given range
  /// (including decorations that start or end directly at the
  /// boundaries) and match the given predicate on their spec. When
  /// `start` and `end` are omitted, all decorations in the set are
  /// considered. When `predicate` isn't given, all decorations are
  /// assumed to match.
  find(start, end, predicate) {
    let result = [];
    this.findInner(start == null ? 0 : start, end == null ? 1e9 : end, result, 0, predicate);
    return result;
  }
  findInner(start, end, result, offset, predicate) {
    for (let i = 0; i < this.local.length; i++) {
      let span = this.local[i];
      if (span.from <= end && span.to >= start && (!predicate || predicate(span.spec))) result.push(span.copy(span.from + offset, span.to + offset));
    }
    for (let i = 0; i < this.children.length; i += 3) {
      if (this.children[i] < end && this.children[i + 1] > start) {
        let childOff = this.children[i] + 1;
        this.children[i + 2].findInner(start - childOff, end - childOff, result, offset + childOff, predicate);
      }
    }
  }

  /// Map the set of decorations in response to a change in the
  /// document.
  map(mapping, doc, options) {
    if (this == empty || mapping.maps.length == 0) return this;
    return this.mapInner(mapping, doc, 0, 0, options || noSpec);
  }

  /// @internal
  mapInner(mapping, node, offset, oldOffset, options) {
    let newLocal;
    for (let i = 0; i < this.local.length; i++) {
      let mapped = this.local[i].map(mapping, offset, oldOffset);
      if (mapped && mapped.type.valid(node, mapped)) (newLocal || (newLocal = [])).push(mapped);else if (options.onRemove) options.onRemove(this.local[i].spec);
    }
    if (this.children.length) return mapChildren(this.children, newLocal || [], mapping, node, offset, oldOffset, options);else return newLocal ? new DecorationSet(newLocal.sort(byPos), none) : empty;
  }

  /// Add the given array of decorations to the ones in the set,
  /// producing a new set. Consumes the `decorations` array. Needs
  /// access to the current document to create the appropriate tree
  /// structure.
  add(doc, decorations) {
    if (!decorations.length) return this;
    if (this == empty) return DecorationSet.create(doc, decorations);
    return this.addInner(doc, decorations, 0);
  }
  addInner(doc, decorations, offset) {
    let children,
      childIndex = 0;
    doc.forEach((childNode, childOffset) => {
      let baseOffset = childOffset + offset,
        found;
      if (!(found = takeSpansForNode(decorations, childNode, baseOffset))) return;
      if (!children) children = this.children.slice();
      while (childIndex < children.length && children[childIndex] < childOffset) childIndex += 3;
      if (children[childIndex] == childOffset) children[childIndex + 2] = children[childIndex + 2].addInner(childNode, found, baseOffset + 1);else children.splice(childIndex, 0, childOffset, childOffset + childNode.nodeSize, buildTree(found, childNode, baseOffset + 1, noSpec));
      childIndex += 3;
    });
    let local = moveSpans(childIndex ? withoutNulls(decorations) : decorations, -offset);
    for (let i = 0; i < local.length; i++) if (!local[i].type.valid(doc, local[i])) local.splice(i--, 1);
    return new DecorationSet(local.length ? this.local.concat(local).sort(byPos) : this.local, children || this.children);
  }

  /// Create a new set that contains the decorations in this set, minus
  /// the ones in the given array.
  remove(decorations) {
    if (decorations.length == 0 || this == empty) return this;
    return this.removeInner(decorations, 0);
  }
  removeInner(decorations, offset) {
    let children = this.children,
      local = this.local;
    for (let i = 0; i < children.length; i += 3) {
      let found;
      let from = children[i] + offset,
        to = children[i + 1] + offset;
      for (let j = 0, span; j < decorations.length; j++) if (span = decorations[j]) {
        if (span.from > from && span.to < to) {
          decorations[j] = null;
          (found || (found = [])).push(span);
        }
      }
      if (!found) continue;
      if (children == this.children) children = this.children.slice();
      let removed = children[i + 2].removeInner(found, from + 1);
      if (removed != empty) {
        children[i + 2] = removed;
      } else {
        children.splice(i, 3);
        i -= 3;
      }
    }
    if (local.length) for (let i = 0, span; i < decorations.length; i++) if (span = decorations[i]) {
      for (let j = 0; j < local.length; j++) if (local[j].eq(span, offset)) {
        if (local == this.local) local = this.local.slice();
        local.splice(j--, 1);
      }
    }
    if (children == this.children && local == this.local) return this;
    return local.length || children.length ? new DecorationSet(local, children) : empty;
  }
  forChild(offset, node) {
    if (this == empty) return this;
    if (node.isLeaf) return DecorationSet.empty;
    let child, local;
    for (let i = 0; i < this.children.length; i += 3) if (this.children[i] >= offset) {
      if (this.children[i] == offset) child = this.children[i + 2];
      break;
    }
    let start = offset + 1,
      end = start + node.content.size;
    for (let i = 0; i < this.local.length; i++) {
      let dec = this.local[i];
      if (dec.from < end && dec.to > start && dec.type instanceof InlineType) {
        let from = Math.max(start, dec.from) - start,
          to = Math.min(end, dec.to) - start;
        if (from < to) (local || (local = [])).push(dec.copy(from, to));
      }
    }
    if (local) {
      let localSet = new DecorationSet(local.sort(byPos), none);
      return child ? new DecorationGroup([localSet, child]) : localSet;
    }
    return child || empty;
  }

  /// @internal
  eq(other) {
    if (this == other) return true;
    if (!(other instanceof DecorationSet) || this.local.length != other.local.length || this.children.length != other.children.length) return false;
    for (let i = 0; i < this.local.length; i++) if (!this.local[i].eq(other.local[i])) return false;
    for (let i = 0; i < this.children.length; i += 3) if (this.children[i] != other.children[i] || this.children[i + 1] != other.children[i + 1] || !this.children[i + 2].eq(other.children[i + 2])) return false;
    return true;
  }

  /// @internal
  locals(node) {
    return removeOverlap(this.localsInner(node));
  }

  /// @internal
  localsInner(node) {
    if (this == empty) return none;
    if (node.inlineContent || !this.local.some(InlineType.is)) return this.local;
    let result = [];
    for (let i = 0; i < this.local.length; i++) {
      if (!(this.local[i].type instanceof InlineType)) result.push(this.local[i]);
    }
    return result;
  }

  /// The empty set of decorations.

  forEachSet(f) {
    f(this);
  }
}
exports.DecorationSet = DecorationSet;
_DecorationSet = DecorationSet;
DecorationSet.empty = new _DecorationSet([], []);
/// @internal
DecorationSet.removeOverlap = removeOverlap;
const empty = DecorationSet.empty;

// An abstraction that allows the code dealing with decorations to
// treat multiple DecorationSet objects as if it were a single object
// with (a subset of) the same interface.
class DecorationGroup {
  constructor(members) {
    this.members = members;
  }
  map(mapping, doc) {
    const mappedDecos = this.members.map(member => member.map(mapping, doc, noSpec));
    return DecorationGroup.from(mappedDecos);
  }
  forChild(offset, child) {
    if (child.isLeaf) return DecorationSet.empty;
    let found = [];
    for (let i = 0; i < this.members.length; i++) {
      let result = this.members[i].forChild(offset, child);
      if (result == empty) continue;
      if (result instanceof DecorationGroup) found = found.concat(result.members);else found.push(result);
    }
    return DecorationGroup.from(found);
  }
  eq(other) {
    if (!(other instanceof DecorationGroup) || other.members.length != this.members.length) return false;
    for (let i = 0; i < this.members.length; i++) if (!this.members[i].eq(other.members[i])) return false;
    return true;
  }
  locals(node) {
    let result,
      sorted = true;
    for (let i = 0; i < this.members.length; i++) {
      let locals = this.members[i].localsInner(node);
      if (!locals.length) continue;
      if (!result) {
        result = locals;
      } else {
        if (sorted) {
          result = result.slice();
          sorted = false;
        }
        for (let j = 0; j < locals.length; j++) result.push(locals[j]);
      }
    }
    return result ? removeOverlap(sorted ? result : result.sort(byPos)) : none;
  }

  // Create a group for the given array of decoration sets, or return
  // a single set when possible.
  static from(members) {
    switch (members.length) {
      case 0:
        return empty;
      case 1:
        return members[0];
      default:
        return new DecorationGroup(members.every(m => m instanceof DecorationSet) ? members : members.reduce((r, m) => r.concat(m instanceof DecorationSet ? m : m.members), []));
    }
  }
  forEachSet(f) {
    for (let i = 0; i < this.members.length; i++) this.members[i].forEachSet(f);
  }
}
function mapChildren(oldChildren, newLocal, mapping, node, offset, oldOffset, options) {
  let children = oldChildren.slice();

  // Mark the children that are directly touched by changes, and
  // move those that are after the changes.
  for (let i = 0, baseOffset = oldOffset; i < mapping.maps.length; i++) {
    let moved = 0;
    mapping.maps[i].forEach((oldStart, oldEnd, newStart, newEnd) => {
      let dSize = newEnd - newStart - (oldEnd - oldStart);
      for (let i = 0; i < children.length; i += 3) {
        let end = children[i + 1];
        if (end < 0 || oldStart > end + baseOffset - moved) continue;
        let start = children[i] + baseOffset - moved;
        if (oldEnd >= start) {
          children[i + 1] = oldStart <= start ? -2 : -1;
        } else if (oldStart >= baseOffset && dSize) {
          ;
          children[i] += dSize;
          children[i + 1] += dSize;
        }
      }
      moved += dSize;
    });
    baseOffset = mapping.maps[i].map(baseOffset, -1);
  }

  // Find the child nodes that still correspond to a single node,
  // recursively call mapInner on them and update their positions.
  let mustRebuild = false;
  for (let i = 0; i < children.length; i += 3) if (children[i + 1] < 0) {
    // Touched nodes
    if (children[i + 1] == -2) {
      mustRebuild = true;
      children[i + 1] = -1;
      continue;
    }
    let from = mapping.map(oldChildren[i] + oldOffset),
      fromLocal = from - offset;
    if (fromLocal < 0 || fromLocal >= node.content.size) {
      mustRebuild = true;
      continue;
    }
    // Must read oldChildren because children was tagged with -1
    let to = mapping.map(oldChildren[i + 1] + oldOffset, -1),
      toLocal = to - offset;
    let {
      index,
      offset: childOffset
    } = node.content.findIndex(fromLocal);
    let childNode = node.maybeChild(index);
    if (childNode && childOffset == fromLocal && childOffset + childNode.nodeSize == toLocal) {
      let mapped = children[i + 2].mapInner(mapping, childNode, from + 1, oldChildren[i] + oldOffset + 1, options);
      if (mapped != empty) {
        children[i] = fromLocal;
        children[i + 1] = toLocal;
        children[i + 2] = mapped;
      } else {
        children[i + 1] = -2;
        mustRebuild = true;
      }
    } else {
      mustRebuild = true;
    }
  }

  // Remaining children must be collected and rebuilt into the appropriate structure
  if (mustRebuild) {
    let decorations = mapAndGatherRemainingDecorations(children, oldChildren, newLocal, mapping, offset, oldOffset, options);
    let built = buildTree(decorations, node, 0, options);
    newLocal = built.local;
    for (let i = 0; i < children.length; i += 3) if (children[i + 1] < 0) {
      children.splice(i, 3);
      i -= 3;
    }
    for (let i = 0, j = 0; i < built.children.length; i += 3) {
      let from = built.children[i];
      while (j < children.length && children[j] < from) j += 3;
      children.splice(j, 0, built.children[i], built.children[i + 1], built.children[i + 2]);
    }
  }
  return new DecorationSet(newLocal.sort(byPos), children);
}
function moveSpans(spans, offset) {
  if (!offset || !spans.length) return spans;
  let result = [];
  for (let i = 0; i < spans.length; i++) {
    let span = spans[i];
    result.push(new Decoration(span.from + offset, span.to + offset, span.type));
  }
  return result;
}
function mapAndGatherRemainingDecorations(children, oldChildren, decorations, mapping, offset, oldOffset, options) {
  // Gather all decorations from the remaining marked children
  function gather(set, oldOffset) {
    for (let i = 0; i < set.local.length; i++) {
      let mapped = set.local[i].map(mapping, offset, oldOffset);
      if (mapped) decorations.push(mapped);else if (options.onRemove) options.onRemove(set.local[i].spec);
    }
    for (let i = 0; i < set.children.length; i += 3) gather(set.children[i + 2], set.children[i] + oldOffset + 1);
  }
  for (let i = 0; i < children.length; i += 3) if (children[i + 1] == -1) gather(children[i + 2], oldChildren[i] + oldOffset + 1);
  return decorations;
}
function takeSpansForNode(spans, node, offset) {
  if (node.isLeaf) return null;
  let end = offset + node.nodeSize,
    found = null;
  for (let i = 0, span; i < spans.length; i++) {
    if ((span = spans[i]) && span.from > offset && span.to < end) {
      ;
      (found || (found = [])).push(span);
      spans[i] = null;
    }
  }
  return found;
}
function withoutNulls(array) {
  let result = [];
  for (let i = 0; i < array.length; i++) if (array[i] != null) result.push(array[i]);
  return result;
}

// Build up a tree that corresponds to a set of decorations. `offset`
// is a base offset that should be subtracted from the `from` and `to`
// positions in the spans (so that we don't have to allocate new spans
// for recursive calls).
function buildTree(spans, node, offset, options) {
  let children = [],
    hasNulls = false;
  node.forEach((childNode, localStart) => {
    let found = takeSpansForNode(spans, childNode, localStart + offset);
    if (found) {
      hasNulls = true;
      let subtree = buildTree(found, childNode, offset + localStart + 1, options);
      if (subtree != empty) children.push(localStart, localStart + childNode.nodeSize, subtree);
    }
  });
  let locals = moveSpans(hasNulls ? withoutNulls(spans) : spans, -offset).sort(byPos);
  for (let i = 0; i < locals.length; i++) if (!locals[i].type.valid(node, locals[i])) {
    if (options.onRemove) options.onRemove(locals[i].spec);
    locals.splice(i--, 1);
  }
  return locals.length || children.length ? new DecorationSet(locals, children) : empty;
}

// Used to sort decorations so that ones with a low start position
// come first, and within a set with the same start position, those
// with an smaller end position come first.
function byPos(a, b) {
  return a.from - b.from || a.to - b.to;
}

// Scan a sorted array of decorations for partially overlapping spans,
// and split those so that only fully overlapping spans are left (to
// make subsequent rendering easier). Will return the input array if
// no partially overlapping spans are found (the common case).
function removeOverlap(spans) {
  let working = spans;
  for (let i = 0; i < working.length - 1; i++) {
    let span = working[i];
    if (span.from != span.to) for (let j = i + 1; j < working.length; j++) {
      let next = working[j];
      if (next.from == span.from) {
        if (next.to != span.to) {
          if (working == spans) working = spans.slice();
          // Followed by a partially overlapping larger span. Split that
          // span.
          working[j] = next.copy(next.from, span.to);
          insertAhead(working, j + 1, next.copy(span.to, next.to));
        }
        continue;
      } else {
        if (next.from < span.to) {
          if (working == spans) working = spans.slice();
          // The end of this one overlaps with a subsequent span. Split
          // this one.
          working[i] = span.copy(span.from, next.from);
          insertAhead(working, j, span.copy(next.from, span.to));
        }
        break;
      }
    }
  }
  return working;
}
function insertAhead(array, i, deco) {
  while (i < array.length && byPos(deco, array[i]) > 0) i++;
  array.splice(i, 0, deco);
}

// Get the decorations associated with the current props of a view.
function viewDecorations(view) {
  let found = [];
  view.someProp("decorations", f => {
    let result = f(view.state);
    if (result && result != empty) found.push(result);
  });
  if (view.cursorWrapper) found.push(DecorationSet.create(view.state.doc, [view.cursorWrapper.deco]));
  return DecorationGroup.from(found);
}
},
"prosemirror-view/src/dom.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.caretFromPoint = caretFromPoint;
exports.clearReusedRange = void 0;
exports.deepActiveElement = deepActiveElement;
exports.domIndex = void 0;
exports.hasBlockDesc = hasBlockDesc;
exports.isEquivalentPosition = void 0;
exports.isOnEdge = isOnEdge;
exports.keyEvent = keyEvent;
exports.nodeSize = nodeSize;
exports.selectionCollapsed = exports.parentNode = void 0;
exports.textNodeAfter = textNodeAfter;
exports.textNodeBefore = textNodeBefore;
exports.textRange = void 0;
const domIndex = function (node) {
  for (var index = 0;; index++) {
    node = node.previousSibling;
    if (!node) return index;
  }
};
exports.domIndex = domIndex;
const parentNode = function (node) {
  let parent = node.assignedSlot || node.parentNode;
  return parent && parent.nodeType == 11 ? parent.host : parent;
};
exports.parentNode = parentNode;
let reusedRange = null;

// Note that this will always return the same range, because DOM range
// objects are every expensive, and keep slowing down subsequent DOM
// updates, for some reason.
const textRange = function (node, from, to) {
  let range = reusedRange || (reusedRange = document.createRange());
  range.setEnd(node, to == null ? node.nodeValue.length : to);
  range.setStart(node, from || 0);
  return range;
};
exports.textRange = textRange;
const clearReusedRange = function () {
  reusedRange = null;
};

// Scans forward and backward through DOM positions equivalent to the
// given one to see if the two are in the same place (i.e. after a
// text node vs at the end of that text node)
exports.clearReusedRange = clearReusedRange;
const isEquivalentPosition = function (node, off, targetNode, targetOff) {
  return targetNode && (scanFor(node, off, targetNode, targetOff, -1) || scanFor(node, off, targetNode, targetOff, 1));
};
exports.isEquivalentPosition = isEquivalentPosition;
const atomElements = /^(img|br|input|textarea|hr)$/i;
function scanFor(node, off, targetNode, targetOff, dir) {
  for (;;) {
    if (node == targetNode && off == targetOff) return true;
    if (off == (dir < 0 ? 0 : nodeSize(node))) {
      let parent = node.parentNode;
      if (!parent || parent.nodeType != 1 || hasBlockDesc(node) || atomElements.test(node.nodeName) || node.contentEditable == "false") return false;
      off = domIndex(node) + (dir < 0 ? 0 : 1);
      node = parent;
    } else if (node.nodeType == 1) {
      let child = node.childNodes[off + (dir < 0 ? -1 : 0)];
      if (child.nodeType == 1 && child.contentEditable == "false") {
        var _child$pmViewDesc;
        if ((_child$pmViewDesc = child.pmViewDesc) !== null && _child$pmViewDesc !== void 0 && _child$pmViewDesc.ignoreForSelection) off += dir;else return false;
      } else {
        node = child;
        off = dir < 0 ? nodeSize(node) : 0;
      }
    } else {
      return false;
    }
  }
}
function nodeSize(node) {
  return node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length;
}
function textNodeBefore(node, offset) {
  for (;;) {
    if (node.nodeType == 3 && offset) return node;
    if (node.nodeType == 1 && offset > 0) {
      if (node.contentEditable == "false") return null;
      node = node.childNodes[offset - 1];
      offset = nodeSize(node);
    } else if (node.parentNode && !hasBlockDesc(node)) {
      offset = domIndex(node);
      node = node.parentNode;
    } else {
      return null;
    }
  }
}
function textNodeAfter(node, offset) {
  for (;;) {
    if (node.nodeType == 3 && offset < node.nodeValue.length) return node;
    if (node.nodeType == 1 && offset < node.childNodes.length) {
      if (node.contentEditable == "false") return null;
      node = node.childNodes[offset];
      offset = 0;
    } else if (node.parentNode && !hasBlockDesc(node)) {
      offset = domIndex(node) + 1;
      node = node.parentNode;
    } else {
      return null;
    }
  }
}
function isOnEdge(node, offset, parent) {
  for (let atStart = offset == 0, atEnd = offset == nodeSize(node); atStart || atEnd;) {
    if (node == parent) return true;
    let index = domIndex(node);
    node = node.parentNode;
    if (!node) return false;
    atStart = atStart && index == 0;
    atEnd = atEnd && index == nodeSize(node);
  }
}
function hasBlockDesc(dom) {
  let desc;
  for (let cur = dom; cur; cur = cur.parentNode) if (desc = cur.pmViewDesc) break;
  return desc && desc.node && desc.node.isBlock && (desc.dom == dom || desc.contentDOM == dom);
}

// Work around Chrome issue https://bugs.chromium.org/p/chromium/issues/detail?id=447523
// (isCollapsed inappropriately returns true in shadow dom)
const selectionCollapsed = function (domSel) {
  return domSel.focusNode && isEquivalentPosition(domSel.focusNode, domSel.focusOffset, domSel.anchorNode, domSel.anchorOffset);
};
exports.selectionCollapsed = selectionCollapsed;
function keyEvent(keyCode, key) {
  let event = document.createEvent("Event");
  event.initEvent("keydown", true, true);
  event.keyCode = keyCode;
  event.key = event.code = key;
  return event;
}
function deepActiveElement(doc) {
  let elt = doc.activeElement;
  while (elt && elt.shadowRoot) elt = elt.shadowRoot.activeElement;
  return elt;
}
function caretFromPoint(doc, x, y) {
  if (doc.caretPositionFromPoint) {
    try {
      // Firefox throws for this call in hard-to-predict circumstances (#994)
      let pos = doc.caretPositionFromPoint(x, y);
      // Clip the offset, because Chrome will return a text offset
      // into <input> nodes, which can't be treated as a regular DOM
      // offset
      if (pos) return {
        node: pos.offsetNode,
        offset: Math.min(nodeSize(pos.offsetNode), pos.offset)
      };
    } catch (_) {}
  }
  if (doc.caretRangeFromPoint) {
    let range = doc.caretRangeFromPoint(x, y);
    if (range) return {
      node: range.startContainer,
      offset: Math.min(nodeSize(range.startContainer), range.startOffset)
    };
  }
}
},
"prosemirror-view/src/domchange.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readDOMChange = readDOMChange;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var _selection = __require("prosemirror-view/src/selection.ts");
var _dom = __require("prosemirror-view/src/dom.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
// Note that all referencing and parsing is done with the
// start-of-operation selection and document, since that's the one
// that the DOM represents. If any changes came in in the meantime,
// the modification is mapped over those before it is applied, in
// readDOMChange.

function parseBetween(view, from_, to_) {
  let {
    node: parent,
    fromOffset,
    toOffset,
    from,
    to
  } = view.docView.parseRange(from_, to_);
  let domSel = view.domSelectionRange();
  let find;
  let anchor = domSel.anchorNode;
  if (anchor && view.dom.contains(anchor.nodeType == 1 ? anchor : anchor.parentNode)) {
    find = [{
      node: anchor,
      offset: domSel.anchorOffset
    }];
    if (!(0, _dom.selectionCollapsed)(domSel)) find.push({
      node: domSel.focusNode,
      offset: domSel.focusOffset
    });
  }
  // Work around issue in Chrome where backspacing sometimes replaces
  // the deleted content with a random BR node (issues #799, #831)
  if (browser.chrome && view.input.lastKeyCode === 8) {
    for (let off = toOffset; off > fromOffset; off--) {
      let node = parent.childNodes[off - 1],
        desc = node.pmViewDesc;
      if (node.nodeName == "BR" && !desc) {
        toOffset = off;
        break;
      }
      if (!desc || desc.size) break;
    }
  }
  let startDoc = view.state.doc;
  let parser = view.someProp("domParser") || _prosemirrorModel.DOMParser.fromSchema(view.state.schema);
  let $from = startDoc.resolve(from);
  let sel = null,
    doc = parser.parse(parent, {
      topNode: $from.parent,
      topMatch: $from.parent.contentMatchAt($from.index()),
      topOpen: true,
      from: fromOffset,
      to: toOffset,
      preserveWhitespace: $from.parent.type.whitespace == "pre" ? "full" : true,
      findPositions: find,
      ruleFromNode,
      context: $from
    });
  if (find && find[0].pos != null) {
    let anchor = find[0].pos,
      head = find[1] && find[1].pos;
    if (head == null) head = anchor;
    sel = {
      anchor: anchor + from,
      head: head + from
    };
  }
  return {
    doc,
    sel,
    from,
    to
  };
}
function ruleFromNode(dom) {
  let desc = dom.pmViewDesc;
  if (desc) {
    return desc.parseRule();
  } else if (dom.nodeName == "BR" && dom.parentNode) {
    // Safari replaces the list item or table cell with a BR
    // directly in the list node (?!) if you delete the last
    // character in a list item or table cell (#708, #862)
    if (browser.safari && /^(ul|ol)$/i.test(dom.parentNode.nodeName)) {
      let skip = document.createElement("div");
      skip.appendChild(document.createElement("li"));
      return {
        skip
      };
    } else if (dom.parentNode.lastChild == dom || browser.safari && /^(tr|table)$/i.test(dom.parentNode.nodeName)) {
      return {
        ignore: true
      };
    }
  } else if (dom.nodeName == "IMG" && dom.getAttribute("mark-placeholder")) {
    return {
      ignore: true
    };
  }
  return null;
}
const isInline = /^(a|abbr|acronym|b|bd[io]|big|br|button|cite|code|data(list)?|del|dfn|em|i|img|ins|kbd|label|map|mark|meter|output|q|ruby|s|samp|small|span|strong|su[bp]|time|u|tt|var)$/i;
function readDOMChange(view, from, to, typeOver, addedNodes) {
  let compositionID = view.input.compositionPendingChanges || (view.composing ? view.input.compositionID : 0);
  view.input.compositionPendingChanges = 0;
  if (from < 0) {
    let origin = view.input.lastSelectionTime > Date.now() - 50 ? view.input.lastSelectionOrigin : null;
    let newSel = (0, _selection.selectionFromDOM)(view, origin);
    if (newSel && !view.state.selection.eq(newSel)) {
      if (browser.chrome && browser.android && view.input.lastKeyCode === 13 && Date.now() - 100 < view.input.lastKeyCodeTime && view.someProp("handleKeyDown", f => f(view, (0, _dom.keyEvent)(13, "Enter")))) return;
      let tr = view.state.tr.setSelection(newSel);
      if (origin == "pointer") tr.setMeta("pointer", true);else if (origin == "key") tr.scrollIntoView();
      if (compositionID) tr.setMeta("composition", compositionID);
      view.dispatch(tr);
    }
    return;
  }
  let $before = view.state.doc.resolve(from);
  let shared = $before.sharedDepth(to);
  from = $before.before(shared + 1);
  to = view.state.doc.resolve(to).after(shared + 1);
  let sel = view.state.selection;
  let parse = parseBetween(view, from, to);
  let doc = view.state.doc,
    compare = doc.slice(parse.from, parse.to);
  let preferredPos, preferredSide;
  // Prefer anchoring to end when Backspace is pressed
  if (view.input.lastKeyCode === 8 && Date.now() - 100 < view.input.lastKeyCodeTime) {
    preferredPos = view.state.selection.to;
    preferredSide = "end";
  } else {
    preferredPos = view.state.selection.from;
    preferredSide = "start";
  }
  view.input.lastKeyCode = null;
  let change = findDiff(compare.content, parse.doc.content, parse.from, preferredPos, preferredSide);
  if (change) view.input.domChangeCount++;
  if ((browser.ios && view.input.lastIOSEnter > Date.now() - 225 || browser.android) && addedNodes.some(n => n.nodeType == 1 && !isInline.test(n.nodeName)) && (!change || change.endA >= change.endB) && view.someProp("handleKeyDown", f => f(view, (0, _dom.keyEvent)(13, "Enter")))) {
    view.input.lastIOSEnter = 0;
    return;
  }
  if (!change) {
    if (typeOver && sel instanceof _prosemirrorState.TextSelection && !sel.empty && sel.$head.sameParent(sel.$anchor) && !view.composing && !(parse.sel && parse.sel.anchor != parse.sel.head)) {
      change = {
        start: sel.from,
        endA: sel.to,
        endB: sel.to
      };
    } else {
      if (parse.sel) {
        let sel = resolveSelection(view, view.state.doc, parse.sel);
        if (sel && !sel.eq(view.state.selection)) {
          let tr = view.state.tr.setSelection(sel);
          if (compositionID) tr.setMeta("composition", compositionID);
          view.dispatch(tr);
        }
      }
      return;
    }
  }

  // Handle the case where overwriting a selection by typing matches
  // the start or end of the selected content, creating a change
  // that's smaller than what was actually overwritten.
  if (view.state.selection.from < view.state.selection.to && change.start == change.endB && view.state.selection instanceof _prosemirrorState.TextSelection) {
    if (change.start > view.state.selection.from && change.start <= view.state.selection.from + 2 && view.state.selection.from >= parse.from) {
      change.start = view.state.selection.from;
    } else if (change.endA < view.state.selection.to && change.endA >= view.state.selection.to - 2 && view.state.selection.to <= parse.to) {
      change.endB += view.state.selection.to - change.endA;
      change.endA = view.state.selection.to;
    }
  }

  // IE11 will insert a non-breaking space _ahead_ of the space after
  // the cursor space when adding a space before another space. When
  // that happened, adjust the change to cover the space instead.
  if (browser.ie && browser.ie_version <= 11 && change.endB == change.start + 1 && change.endA == change.start && change.start > parse.from && parse.doc.textBetween(change.start - parse.from - 1, change.start - parse.from + 1) == " \u00a0") {
    change.start--;
    change.endA--;
    change.endB--;
  }
  let $from = parse.doc.resolveNoCache(change.start - parse.from);
  let $to = parse.doc.resolveNoCache(change.endB - parse.from);
  let $fromA = doc.resolve(change.start);
  let inlineChange = $from.sameParent($to) && $from.parent.inlineContent && $fromA.end() >= change.endA;
  // If this looks like the effect of pressing Enter (or was recorded
  // as being an iOS enter press), just dispatch an Enter key instead.
  if ((browser.ios && view.input.lastIOSEnter > Date.now() - 225 && (!inlineChange || addedNodes.some(n => n.nodeName == "DIV" || n.nodeName == "P")) || !inlineChange && $from.pos < parse.doc.content.size && (!$from.sameParent($to) || !$from.parent.inlineContent) && $from.pos < $to.pos && !/\S/.test(parse.doc.textBetween($from.pos, $to.pos, "", ""))) && view.someProp("handleKeyDown", f => f(view, (0, _dom.keyEvent)(13, "Enter")))) {
    view.input.lastIOSEnter = 0;
    return;
  }
  // Same for backspace
  if (view.state.selection.anchor > change.start && looksLikeBackspace(doc, change.start, change.endA, $from, $to) && view.someProp("handleKeyDown", f => f(view, (0, _dom.keyEvent)(8, "Backspace")))) {
    if (browser.android && browser.chrome) view.domObserver.suppressSelectionUpdates(); // #820
    return;
  }

  // Chrome will occasionally, during composition, delete the
  // entire composition and then immediately insert it again. This is
  // used to detect that situation.
  if (browser.chrome && change.endB == change.start) view.input.lastChromeDelete = Date.now();

  // This tries to detect Android virtual keyboard
  // enter-and-pick-suggestion action. That sometimes (see issue
  // #1059) first fires a DOM mutation, before moving the selection to
  // the newly created block. And then, because ProseMirror cleans up
  // the DOM selection, it gives up moving the selection entirely,
  // leaving the cursor in the wrong place. When that happens, we drop
  // the new paragraph from the initial change, and fire a simulated
  // enter key afterwards.
  if (browser.android && !inlineChange && $from.start() != $to.start() && $to.parentOffset == 0 && $from.depth == $to.depth && parse.sel && parse.sel.anchor == parse.sel.head && parse.sel.head == change.endA) {
    change.endB -= 2;
    $to = parse.doc.resolveNoCache(change.endB - parse.from);
    setTimeout(() => {
      view.someProp("handleKeyDown", function (f) {
        return f(view, (0, _dom.keyEvent)(13, "Enter"));
      });
    }, 20);
  }
  let chFrom = change.start,
    chTo = change.endA;
  let mkTr = base => {
    let tr = base || view.state.tr.replace(chFrom, chTo, parse.doc.slice(change.start - parse.from, change.endB - parse.from));
    if (parse.sel) {
      let sel = resolveSelection(view, tr.doc, parse.sel);
      // Chrome will sometimes, during composition, report the
      // selection in the wrong place. If it looks like that is
      // happening, don't update the selection.
      // Edge just doesn't move the cursor forward when you start typing
      // in an empty block or between br nodes.
      if (sel && !(browser.chrome && view.composing && sel.empty && (change.start != change.endB || view.input.lastChromeDelete < Date.now() - 100) && (sel.head == chFrom || sel.head == tr.mapping.map(chTo) - 1) || browser.ie && sel.empty && sel.head == chFrom)) tr.setSelection(sel);
    }
    if (compositionID) tr.setMeta("composition", compositionID);
    return tr.scrollIntoView();
  };
  let markChange;
  if (inlineChange) {
    if ($from.pos == $to.pos) {
      // Deletion
      // IE11 sometimes weirdly moves the DOM selection around after
      // backspacing out the first element in a textblock
      if (browser.ie && browser.ie_version <= 11 && $from.parentOffset == 0) {
        view.domObserver.suppressSelectionUpdates();
        setTimeout(() => (0, _selection.selectionToDOM)(view), 20);
      }
      let tr = mkTr(view.state.tr.delete(chFrom, chTo));
      let marks = doc.resolve(change.start).marksAcross(doc.resolve(change.endA));
      if (marks) tr.ensureMarks(marks);
      view.dispatch(tr);
    } else if (
    // Adding or removing a mark
    change.endA == change.endB && (markChange = isMarkChange($from.parent.content.cut($from.parentOffset, $to.parentOffset), $fromA.parent.content.cut($fromA.parentOffset, change.endA - $fromA.start())))) {
      let tr = mkTr(view.state.tr);
      if (markChange.type == "add") tr.addMark(chFrom, chTo, markChange.mark);else tr.removeMark(chFrom, chTo, markChange.mark);
      view.dispatch(tr);
    } else if ($from.parent.child($from.index()).isText && $from.index() == $to.index() - ($to.textOffset ? 0 : 1)) {
      // Both positions in the same text node -- simply insert text
      let text = $from.parent.textBetween($from.parentOffset, $to.parentOffset);
      let deflt = () => mkTr(view.state.tr.insertText(text, chFrom, chTo));
      if (!view.someProp("handleTextInput", f => f(view, chFrom, chTo, text, deflt))) view.dispatch(deflt());
    } else {
      view.dispatch(mkTr());
    }
  } else {
    view.dispatch(mkTr());
  }
}
function resolveSelection(view, doc, parsedSel) {
  if (Math.max(parsedSel.anchor, parsedSel.head) > doc.content.size) return null;
  return (0, _selection.selectionBetween)(view, doc.resolve(parsedSel.anchor), doc.resolve(parsedSel.head));
}

// Given two same-length, non-empty fragments of inline content,
// determine whether the first could be created from the second by
// removing or adding a single mark type.
function isMarkChange(cur, prev) {
  let curMarks = cur.firstChild.marks,
    prevMarks = prev.firstChild.marks;
  let added = curMarks,
    removed = prevMarks,
    type,
    mark,
    update;
  for (let i = 0; i < prevMarks.length; i++) added = prevMarks[i].removeFromSet(added);
  for (let i = 0; i < curMarks.length; i++) removed = curMarks[i].removeFromSet(removed);
  if (added.length == 1 && removed.length == 0) {
    mark = added[0];
    type = "add";
    update = node => node.mark(mark.addToSet(node.marks));
  } else if (added.length == 0 && removed.length == 1) {
    mark = removed[0];
    type = "remove";
    update = node => node.mark(mark.removeFromSet(node.marks));
  } else {
    return null;
  }
  let updated = [];
  for (let i = 0; i < prev.childCount; i++) updated.push(update(prev.child(i)));
  if (_prosemirrorModel.Fragment.from(updated).eq(cur)) return {
    mark,
    type
  };
}
function looksLikeBackspace(old, start, end, $newStart, $newEnd) {
  if (
  // The content must have shrunk
  end - start <= $newEnd.pos - $newStart.pos ||
  // newEnd must point directly at or after the end of the block that newStart points into
  skipClosingAndOpening($newStart, true, false) < $newEnd.pos) return false;
  let $start = old.resolve(start);

  // Handle the case where, rather than joining blocks, the change just removed an entire block
  if (!$newStart.parent.isTextblock) {
    let after = $start.nodeAfter;
    return after != null && end == start + after.nodeSize;
  }

  // Start must be at the end of a block
  if ($start.parentOffset < $start.parent.content.size || !$start.parent.isTextblock) return false;
  let $next = old.resolve(skipClosingAndOpening($start, true, true));
  // The next textblock must start before end and end near it
  if (!$next.parent.isTextblock || $next.pos > end || skipClosingAndOpening($next, true, false) < end) return false;

  // The fragments after the join point must match
  return $newStart.parent.content.cut($newStart.parentOffset).eq($next.parent.content);
}
function skipClosingAndOpening($pos, fromEnd, mayOpen) {
  let depth = $pos.depth,
    end = fromEnd ? $pos.end() : $pos.pos;
  while (depth > 0 && (fromEnd || $pos.indexAfter(depth) == $pos.node(depth).childCount)) {
    depth--;
    end++;
    fromEnd = false;
  }
  if (mayOpen) {
    let next = $pos.node(depth).maybeChild($pos.indexAfter(depth));
    while (next && !next.isLeaf) {
      next = next.firstChild;
      end++;
    }
  }
  return end;
}
function findDiff(a, b, pos, preferredPos, preferredSide) {
  let start = a.findDiffStart(b, pos);
  if (start == null) return null;
  let {
    a: endA,
    b: endB
  } = a.findDiffEnd(b, pos + a.size, pos + b.size);
  if (preferredSide == "end") {
    let adjust = Math.max(0, start - Math.min(endA, endB));
    preferredPos -= endA + adjust - start;
  }
  if (endA < start && a.size < b.size) {
    let move = preferredPos <= start && preferredPos >= endA ? start - preferredPos : 0;
    start -= move;
    if (start && start < b.size && isSurrogatePair(b.textBetween(start - 1, start + 1))) start += move ? 1 : -1;
    endB = start + (endB - endA);
    endA = start;
  } else if (endB < start) {
    let move = preferredPos <= start && preferredPos >= endB ? start - preferredPos : 0;
    start -= move;
    if (start && start < a.size && isSurrogatePair(a.textBetween(start - 1, start + 1))) start += move ? 1 : -1;
    endA = start + (endA - endB);
    endB = start;
  }
  return {
    start,
    endA,
    endB
  };
}
function isSurrogatePair(str) {
  if (str.length != 2) return false;
  let a = str.charCodeAt(0),
    b = str.charCodeAt(1);
  return a >= 0xDC00 && a <= 0xDFFF && b >= 0xD800 && b <= 0xDBFF;
}
},
"prosemirror-view/src/domcoords.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.coordsAtPos = coordsAtPos;
exports.endOfTextblock = endOfTextblock;
exports.focusPreventScroll = focusPreventScroll;
exports.posAtCoords = posAtCoords;
exports.resetScrollPos = resetScrollPos;
exports.scrollRectIntoView = scrollRectIntoView;
exports.storeScrollPos = storeScrollPos;
var _dom = __require("prosemirror-view/src/dom.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function windowRect(doc) {
  let vp = doc.defaultView && doc.defaultView.visualViewport;
  if (vp) return {
    left: 0,
    right: vp.width,
    top: 0,
    bottom: vp.height
  };
  return {
    left: 0,
    right: doc.documentElement.clientWidth,
    top: 0,
    bottom: doc.documentElement.clientHeight
  };
}
function getSide(value, side) {
  return typeof value == "number" ? value : value[side];
}
function clientRect(node) {
  let rect = node.getBoundingClientRect();
  // Adjust for elements with style "transform: scale()"
  let scaleX = rect.width / node.offsetWidth || 1;
  let scaleY = rect.height / node.offsetHeight || 1;
  // Make sure scrollbar width isn't included in the rectangle
  return {
    left: rect.left,
    right: rect.left + node.clientWidth * scaleX,
    top: rect.top,
    bottom: rect.top + node.clientHeight * scaleY
  };
}
function scrollRectIntoView(view, rect, startDOM) {
  let scrollThreshold = view.someProp("scrollThreshold") || 0,
    scrollMargin = view.someProp("scrollMargin") || 5;
  let doc = view.dom.ownerDocument;
  for (let parent = startDOM || view.dom;;) {
    if (!parent) break;
    if (parent.nodeType != 1) {
      parent = (0, _dom.parentNode)(parent);
      continue;
    }
    let elt = parent;
    let atTop = elt == doc.body;
    let bounding = atTop ? windowRect(doc) : clientRect(elt);
    let moveX = 0,
      moveY = 0;
    if (rect.top < bounding.top + getSide(scrollThreshold, "top")) moveY = -(bounding.top - rect.top + getSide(scrollMargin, "top"));else if (rect.bottom > bounding.bottom - getSide(scrollThreshold, "bottom")) moveY = rect.bottom - rect.top > bounding.bottom - bounding.top ? rect.top + getSide(scrollMargin, "top") - bounding.top : rect.bottom - bounding.bottom + getSide(scrollMargin, "bottom");
    if (rect.left < bounding.left + getSide(scrollThreshold, "left")) moveX = -(bounding.left - rect.left + getSide(scrollMargin, "left"));else if (rect.right > bounding.right - getSide(scrollThreshold, "right")) moveX = rect.right - bounding.right + getSide(scrollMargin, "right");
    if (moveX || moveY) {
      if (atTop) {
        doc.defaultView.scrollBy(moveX, moveY);
      } else {
        let startX = elt.scrollLeft,
          startY = elt.scrollTop;
        if (moveY) elt.scrollTop += moveY;
        if (moveX) elt.scrollLeft += moveX;
        let dX = elt.scrollLeft - startX,
          dY = elt.scrollTop - startY;
        rect = {
          left: rect.left - dX,
          top: rect.top - dY,
          right: rect.right - dX,
          bottom: rect.bottom - dY
        };
      }
    }
    let pos = atTop ? "fixed" : getComputedStyle(parent).position;
    if (/^(fixed|sticky)$/.test(pos)) break;
    parent = pos == "absolute" ? parent.offsetParent : (0, _dom.parentNode)(parent);
  }
}

// Store the scroll position of the editor's parent nodes, along with
// the top position of an element near the top of the editor, which
// will be used to make sure the visible viewport remains stable even
// when the size of the content above changes.
function storeScrollPos(view) {
  let rect = view.dom.getBoundingClientRect(),
    startY = Math.max(0, rect.top);
  let refDOM, refTop;
  for (let x = (rect.left + rect.right) / 2, y = startY + 1; y < Math.min(innerHeight, rect.bottom); y += 5) {
    let dom = view.root.elementFromPoint(x, y);
    if (!dom || dom == view.dom || !view.dom.contains(dom)) continue;
    let localRect = dom.getBoundingClientRect();
    if (localRect.top >= startY - 20) {
      refDOM = dom;
      refTop = localRect.top;
      break;
    }
  }
  return {
    refDOM: refDOM,
    refTop: refTop,
    stack: scrollStack(view.dom)
  };
}
function scrollStack(dom) {
  let stack = [],
    doc = dom.ownerDocument;
  for (let cur = dom; cur; cur = (0, _dom.parentNode)(cur)) {
    stack.push({
      dom: cur,
      top: cur.scrollTop,
      left: cur.scrollLeft
    });
    if (dom == doc) break;
  }
  return stack;
}

// Reset the scroll position of the editor's parent nodes to that what
// it was before, when storeScrollPos was called.
function resetScrollPos({
  refDOM,
  refTop,
  stack
}) {
  let newRefTop = refDOM ? refDOM.getBoundingClientRect().top : 0;
  restoreScrollStack(stack, newRefTop == 0 ? 0 : newRefTop - refTop);
}
function restoreScrollStack(stack, dTop) {
  for (let i = 0; i < stack.length; i++) {
    let {
      dom,
      top,
      left
    } = stack[i];
    if (dom.scrollTop != top + dTop) dom.scrollTop = top + dTop;
    if (dom.scrollLeft != left) dom.scrollLeft = left;
  }
}
let preventScrollSupported = null;
// Feature-detects support for .focus({preventScroll: true}), and uses
// a fallback kludge when not supported.
function focusPreventScroll(dom) {
  if (dom.setActive) return dom.setActive(); // in IE
  if (preventScrollSupported) return dom.focus(preventScrollSupported);
  let stored = scrollStack(dom);
  dom.focus(preventScrollSupported == null ? {
    get preventScroll() {
      preventScrollSupported = {
        preventScroll: true
      };
      return true;
    }
  } : undefined);
  if (!preventScrollSupported) {
    preventScrollSupported = false;
    restoreScrollStack(stored, 0);
  }
}
function findOffsetInNode(node, coords) {
  let closest,
    dxClosest = 2e8,
    coordsClosest,
    offset = 0;
  let rowBot = coords.top,
    rowTop = coords.top;
  let firstBelow, coordsBelow;
  for (let child = node.firstChild, childIndex = 0; child; child = child.nextSibling, childIndex++) {
    let rects;
    if (child.nodeType == 1) rects = child.getClientRects();else if (child.nodeType == 3) rects = (0, _dom.textRange)(child).getClientRects();else continue;
    for (let i = 0; i < rects.length; i++) {
      let rect = rects[i];
      if (rect.top <= rowBot && rect.bottom >= rowTop) {
        rowBot = Math.max(rect.bottom, rowBot);
        rowTop = Math.min(rect.top, rowTop);
        let dx = rect.left > coords.left ? rect.left - coords.left : rect.right < coords.left ? coords.left - rect.right : 0;
        if (dx < dxClosest) {
          closest = child;
          dxClosest = dx;
          coordsClosest = dx && closest.nodeType == 3 ? {
            left: rect.right < coords.left ? rect.right : rect.left,
            top: coords.top
          } : coords;
          if (child.nodeType == 1 && dx) offset = childIndex + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0);
          continue;
        }
      } else if (rect.top > coords.top && !firstBelow && rect.left <= coords.left && rect.right >= coords.left) {
        firstBelow = child;
        coordsBelow = {
          left: Math.max(rect.left, Math.min(rect.right, coords.left)),
          top: rect.top
        };
      }
      if (!closest && (coords.left >= rect.right && coords.top >= rect.top || coords.left >= rect.left && coords.top >= rect.bottom)) offset = childIndex + 1;
    }
  }
  if (!closest && firstBelow) {
    closest = firstBelow;
    coordsClosest = coordsBelow;
    dxClosest = 0;
  }
  if (closest && closest.nodeType == 3) return findOffsetInText(closest, coordsClosest);
  if (!closest || dxClosest && closest.nodeType == 1) return {
    node,
    offset
  };
  return findOffsetInNode(closest, coordsClosest);
}
function findOffsetInText(node, coords) {
  let len = node.nodeValue.length;
  let range = document.createRange(),
    result;
  for (let i = 0; i < len; i++) {
    range.setEnd(node, i + 1);
    range.setStart(node, i);
    let rect = singleRect(range, 1);
    if (rect.top == rect.bottom) continue;
    if (inRect(coords, rect)) {
      result = {
        node,
        offset: i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0)
      };
      break;
    }
  }
  range.detach();
  return result || {
    node,
    offset: 0
  };
}
function inRect(coords, rect) {
  return coords.left >= rect.left - 1 && coords.left <= rect.right + 1 && coords.top >= rect.top - 1 && coords.top <= rect.bottom + 1;
}
function targetKludge(dom, coords) {
  let parent = dom.parentNode;
  if (parent && /^li$/i.test(parent.nodeName) && coords.left < dom.getBoundingClientRect().left) return parent;
  return dom;
}
function posFromElement(view, elt, coords) {
  let {
      node,
      offset
    } = findOffsetInNode(elt, coords),
    bias = -1;
  if (node.nodeType == 1 && !node.firstChild) {
    let rect = node.getBoundingClientRect();
    bias = rect.left != rect.right && coords.left > (rect.left + rect.right) / 2 ? 1 : -1;
  }
  return view.docView.posFromDOM(node, offset, bias);
}
function posFromCaret(view, node, offset, coords) {
  // Browser (in caretPosition/RangeFromPoint) will agressively
  // normalize towards nearby inline nodes. Since we are interested in
  // positions between block nodes too, we first walk up the hierarchy
  // of nodes to see if there are block nodes that the coordinates
  // fall outside of. If so, we take the position before/after that
  // block. If not, we call `posFromDOM` on the raw node/offset.
  let outsideBlock = -1;
  for (let cur = node, sawBlock = false;;) {
    if (cur == view.dom) break;
    let desc = view.docView.nearestDesc(cur, true),
      rect;
    if (!desc) return null;
    if (desc.dom.nodeType == 1 && (desc.node.isBlock && desc.parent || !desc.contentDOM) && (
    // Ignore elements with zero-size bounding rectangles
    (rect = desc.dom.getBoundingClientRect()).width || rect.height)) {
      if (desc.node.isBlock && desc.parent && !/^T(R|BODY|HEAD|FOOT)$/.test(desc.dom.nodeName)) {
        // Only apply the horizontal test to the innermost block. Vertical for any parent.
        if (!sawBlock && rect.left > coords.left || rect.top > coords.top) outsideBlock = desc.posBefore;else if (!sawBlock && rect.right < coords.left || rect.bottom < coords.top) outsideBlock = desc.posAfter;
        sawBlock = true;
      }
      if (!desc.contentDOM && outsideBlock < 0 && !desc.node.isText) {
        // If we are inside a leaf, return the side of the leaf closer to the coords
        let before = desc.node.isBlock ? coords.top < (rect.top + rect.bottom) / 2 : coords.left < (rect.left + rect.right) / 2;
        return before ? desc.posBefore : desc.posAfter;
      }
    }
    cur = desc.dom.parentNode;
  }
  return outsideBlock > -1 ? outsideBlock : view.docView.posFromDOM(node, offset, -1);
}
function elementFromPoint(element, coords, box) {
  let len = element.childNodes.length;
  if (len && box.top < box.bottom) {
    for (let startI = Math.max(0, Math.min(len - 1, Math.floor(len * (coords.top - box.top) / (box.bottom - box.top)) - 2)), i = startI;;) {
      let child = element.childNodes[i];
      if (child.nodeType == 1) {
        let rects = child.getClientRects();
        for (let j = 0; j < rects.length; j++) {
          let rect = rects[j];
          if (inRect(coords, rect)) return elementFromPoint(child, coords, rect);
        }
      }
      if ((i = (i + 1) % len) == startI) break;
    }
  }
  return element;
}

// Given an x,y position on the editor, get the position in the document.
function posAtCoords(view, coords) {
  let doc = view.dom.ownerDocument,
    node,
    offset = 0;
  let caret = (0, _dom.caretFromPoint)(doc, coords.left, coords.top);
  if (caret) ({
    node,
    offset
  } = caret);
  let elt = (view.root.elementFromPoint ? view.root : doc).elementFromPoint(coords.left, coords.top);
  let pos;
  if (!elt || !view.dom.contains(elt.nodeType != 1 ? elt.parentNode : elt)) {
    let box = view.dom.getBoundingClientRect();
    if (!inRect(coords, box)) return null;
    elt = elementFromPoint(view.dom, coords, box);
    if (!elt) return null;
  }
  // Safari's caretRangeFromPoint returns nonsense when on a draggable element
  if (browser.safari) {
    for (let p = elt; node && p; p = (0, _dom.parentNode)(p)) if (p.draggable) node = undefined;
  }
  elt = targetKludge(elt, coords);
  if (node) {
    if (browser.gecko && node.nodeType == 1) {
      // Firefox will sometimes return offsets into <input> nodes, which
      // have no actual children, from caretPositionFromPoint (#953)
      offset = Math.min(offset, node.childNodes.length);
      // It'll also move the returned position before image nodes,
      // even if those are behind it.
      if (offset < node.childNodes.length) {
        let next = node.childNodes[offset],
          box;
        if (next.nodeName == "IMG" && (box = next.getBoundingClientRect()).right <= coords.left && box.bottom > coords.top) offset++;
      }
    }
    let prev;
    // When clicking above the right side of an uneditable node, Chrome will report a cursor position after that node.
    if (browser.webkit && offset && node.nodeType == 1 && (prev = node.childNodes[offset - 1]).nodeType == 1 && prev.contentEditable == "false" && prev.getBoundingClientRect().top >= coords.top) offset--;
    // Suspiciously specific kludge to work around caret*FromPoint
    // never returning a position at the end of the document
    if (node == view.dom && offset == node.childNodes.length - 1 && node.lastChild.nodeType == 1 && coords.top > node.lastChild.getBoundingClientRect().bottom) pos = view.state.doc.content.size;
    // Ignore positions directly after a BR, since caret*FromPoint
    // 'round up' positions that would be more accurately placed
    // before the BR node.
    else if (offset == 0 || node.nodeType != 1 || node.childNodes[offset - 1].nodeName != "BR") pos = posFromCaret(view, node, offset, coords);
  }
  if (pos == null) pos = posFromElement(view, elt, coords);
  let desc = view.docView.nearestDesc(elt, true);
  return {
    pos,
    inside: desc ? desc.posAtStart - desc.border : -1
  };
}
function nonZero(rect) {
  return rect.top < rect.bottom || rect.left < rect.right;
}
function singleRect(target, bias) {
  let rects = target.getClientRects();
  if (rects.length) {
    let first = rects[bias < 0 ? 0 : rects.length - 1];
    if (nonZero(first)) return first;
  }
  return Array.prototype.find.call(rects, nonZero) || target.getBoundingClientRect();
}
const BIDI = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;

// Given a position in the document model, get a bounding box of the
// character at that position, relative to the window.
function coordsAtPos(view, pos, side) {
  let {
    node,
    offset,
    atom
  } = view.docView.domFromPos(pos, side < 0 ? -1 : 1);
  let supportEmptyRange = browser.webkit || browser.gecko;
  if (node.nodeType == 3) {
    // These browsers support querying empty text ranges. Prefer that in
    // bidi context or when at the end of a node.
    if (supportEmptyRange && (BIDI.test(node.nodeValue) || (side < 0 ? !offset : offset == node.nodeValue.length))) {
      let rect = singleRect((0, _dom.textRange)(node, offset, offset), side);
      // Firefox returns bad results (the position before the space)
      // when querying a position directly after line-broken
      // whitespace. Detect this situation and and kludge around it
      if (browser.gecko && offset && /\s/.test(node.nodeValue[offset - 1]) && offset < node.nodeValue.length) {
        let rectBefore = singleRect((0, _dom.textRange)(node, offset - 1, offset - 1), -1);
        if (rectBefore.top == rect.top) {
          let rectAfter = singleRect((0, _dom.textRange)(node, offset, offset + 1), -1);
          if (rectAfter.top != rect.top) return flattenV(rectAfter, rectAfter.left < rectBefore.left);
        }
      }
      return rect;
    } else {
      let from = offset,
        to = offset,
        takeSide = side < 0 ? 1 : -1;
      if (side < 0 && !offset) {
        to++;
        takeSide = -1;
      } else if (side >= 0 && offset == node.nodeValue.length) {
        from--;
        takeSide = 1;
      } else if (side < 0) {
        from--;
      } else {
        to++;
      }
      return flattenV(singleRect((0, _dom.textRange)(node, from, to), takeSide), takeSide < 0);
    }
  }
  let $dom = view.state.doc.resolve(pos - (atom || 0));
  // Return a horizontal line in block context
  if (!$dom.parent.inlineContent) {
    if (atom == null && offset && (side < 0 || offset == (0, _dom.nodeSize)(node))) {
      let before = node.childNodes[offset - 1];
      if (before.nodeType == 1) return flattenH(before.getBoundingClientRect(), false);
    }
    if (atom == null && offset < (0, _dom.nodeSize)(node)) {
      let after = node.childNodes[offset];
      if (after.nodeType == 1) return flattenH(after.getBoundingClientRect(), true);
    }
    return flattenH(node.getBoundingClientRect(), side >= 0);
  }

  // Inline, not in text node (this is not Bidi-safe)
  if (atom == null && offset && (side < 0 || offset == (0, _dom.nodeSize)(node))) {
    let before = node.childNodes[offset - 1];
    let target = before.nodeType == 3 ? (0, _dom.textRange)(before, (0, _dom.nodeSize)(before) - (supportEmptyRange ? 0 : 1))
    // BR nodes tend to only return the rectangle before them.
    // Only use them if they are the last element in their parent
    : before.nodeType == 1 && (before.nodeName != "BR" || !before.nextSibling) ? before : null;
    if (target) return flattenV(singleRect(target, 1), false);
  }
  if (atom == null && offset < (0, _dom.nodeSize)(node)) {
    let after = node.childNodes[offset];
    while (after.pmViewDesc && after.pmViewDesc.ignoreForCoords) after = after.nextSibling;
    let target = !after ? null : after.nodeType == 3 ? (0, _dom.textRange)(after, 0, supportEmptyRange ? 0 : 1) : after.nodeType == 1 ? after : null;
    if (target) return flattenV(singleRect(target, -1), true);
  }
  // All else failed, just try to get a rectangle for the target node
  return flattenV(singleRect(node.nodeType == 3 ? (0, _dom.textRange)(node) : node, -side), side >= 0);
}
function flattenV(rect, left) {
  if (rect.width == 0) return rect;
  let x = left ? rect.left : rect.right;
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: x,
    right: x
  };
}
function flattenH(rect, top) {
  if (rect.height == 0) return rect;
  let y = top ? rect.top : rect.bottom;
  return {
    top: y,
    bottom: y,
    left: rect.left,
    right: rect.right
  };
}
function withFlushedState(view, state, f) {
  let viewState = view.state,
    active = view.root.activeElement;
  if (viewState != state) view.updateState(state);
  if (active != view.dom) view.focus();
  try {
    return f();
  } finally {
    if (viewState != state) view.updateState(viewState);
    if (active != view.dom && active) active.focus();
  }
}

// Whether vertical position motion in a given direction
// from a position would leave a text block.
function endOfTextblockVertical(view, state, dir) {
  let sel = state.selection;
  let $pos = dir == "up" ? sel.$from : sel.$to;
  return withFlushedState(view, state, () => {
    let {
      node: dom
    } = view.docView.domFromPos($pos.pos, dir == "up" ? -1 : 1);
    for (;;) {
      let nearest = view.docView.nearestDesc(dom, true);
      if (!nearest) break;
      if (nearest.node.isBlock) {
        dom = nearest.contentDOM || nearest.dom;
        break;
      }
      dom = nearest.dom.parentNode;
    }
    let coords = coordsAtPos(view, $pos.pos, 1);
    for (let child = dom.firstChild; child; child = child.nextSibling) {
      let boxes;
      if (child.nodeType == 1) boxes = child.getClientRects();else if (child.nodeType == 3) boxes = (0, _dom.textRange)(child, 0, child.nodeValue.length).getClientRects();else continue;
      for (let i = 0; i < boxes.length; i++) {
        let box = boxes[i];
        if (box.bottom > box.top + 1 && (dir == "up" ? coords.top - box.top > (box.bottom - coords.top) * 2 : box.bottom - coords.bottom > (coords.bottom - box.top) * 2)) return false;
      }
    }
    return true;
  });
}
const maybeRTL = /[\u0590-\u08ac]/;
function endOfTextblockHorizontal(view, state, dir) {
  let {
    $head
  } = state.selection;
  if (!$head.parent.isTextblock) return false;
  let offset = $head.parentOffset,
    atStart = !offset,
    atEnd = offset == $head.parent.content.size;
  let sel = view.domSelection();
  if (!sel) return $head.pos == $head.start() || $head.pos == $head.end();
  // If the textblock is all LTR, or the browser doesn't support
  // Selection.modify (Edge), fall back to a primitive approach
  if (!maybeRTL.test($head.parent.textContent) || !sel.modify) return dir == "left" || dir == "backward" ? atStart : atEnd;
  return withFlushedState(view, state, () => {
    // This is a huge hack, but appears to be the best we can
    // currently do: use `Selection.modify` to move the selection by
    // one character, and see if that moves the cursor out of the
    // textblock (or doesn't move it at all, when at the start/end of
    // the document).
    let {
      focusNode: oldNode,
      focusOffset: oldOff,
      anchorNode,
      anchorOffset
    } = view.domSelectionRange();
    let oldBidiLevel = sel.caretBidiLevel // Only for Firefox
;
    sel.modify("move", dir, "character");
    let parentDOM = $head.depth ? view.docView.domAfterPos($head.before()) : view.dom;
    let {
      focusNode: newNode,
      focusOffset: newOff
    } = view.domSelectionRange();
    let result = newNode && !parentDOM.contains(newNode.nodeType == 1 ? newNode : newNode.parentNode) || oldNode == newNode && oldOff == newOff;
    // Restore the previous selection
    try {
      sel.collapse(anchorNode, anchorOffset);
      if (oldNode && (oldNode != anchorNode || oldOff != anchorOffset) && sel.extend) sel.extend(oldNode, oldOff);
    } catch (_) {}
    if (oldBidiLevel != null) sel.caretBidiLevel = oldBidiLevel;
    return result;
  });
}
let cachedState = null;
let cachedDir = null;
let cachedResult = false;
function endOfTextblock(view, state, dir) {
  if (cachedState == state && cachedDir == dir) return cachedResult;
  cachedState = state;
  cachedDir = dir;
  return cachedResult = dir == "up" || dir == "down" ? endOfTextblockVertical(view, state, dir) : endOfTextblockHorizontal(view, state, dir);
}
},
"prosemirror-view/src/domobserver.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DOMObserver = void 0;
exports.safariShadowSelectionRange = safariShadowSelectionRange;
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
var _dom = __require("prosemirror-view/src/dom.ts");
var _selection = __require("prosemirror-view/src/selection.ts");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const observeOptions = {
  childList: true,
  characterData: true,
  characterDataOldValue: true,
  attributes: true,
  attributeOldValue: true,
  subtree: true
};
// IE11 has very broken mutation observers, so we also listen to DOMCharacterDataModified
const useCharData = browser.ie && browser.ie_version <= 11;
class SelectionState {
  constructor() {
    this.anchorNode = null;
    this.anchorOffset = 0;
    this.focusNode = null;
    this.focusOffset = 0;
  }
  set(sel) {
    this.anchorNode = sel.anchorNode;
    this.anchorOffset = sel.anchorOffset;
    this.focusNode = sel.focusNode;
    this.focusOffset = sel.focusOffset;
  }
  clear() {
    this.anchorNode = this.focusNode = null;
  }
  eq(sel) {
    return sel.anchorNode == this.anchorNode && sel.anchorOffset == this.anchorOffset && sel.focusNode == this.focusNode && sel.focusOffset == this.focusOffset;
  }
}
class DOMObserver {
  constructor(view, handleDOMChange) {
    this.view = view;
    this.handleDOMChange = handleDOMChange;
    this.queue = [];
    this.flushingSoon = -1;
    this.observer = null;
    this.currentSelection = new SelectionState();
    this.onCharData = null;
    this.suppressingSelectionUpdates = false;
    this.lastChangedTextNode = null;
    this.observer = window.MutationObserver && new window.MutationObserver(mutations => {
      for (let i = 0; i < mutations.length; i++) this.queue.push(mutations[i]);
      if (browser.ie && browser.ie_version <= 11 && mutations.some(m => m.type == "childList" && m.removedNodes.length || m.type == "characterData" && m.oldValue.length > m.target.nodeValue.length)) {
        // IE11 will sometimes (on backspacing out a single character
        // text node after a BR node) call the observer callback
        // before actually updating the DOM, which will cause
        // ProseMirror to miss the change (see #930)
        this.flushSoon();
      } else if (browser.safari && view.composing && mutations.some(m => m.type == "childList" && m.target.nodeName == "TR")) {
        // Safari does weird stuff when finishing a composition in a
        // table cell, which tends to involve inserting inappropriate
        // nodes in the table row.
        view.input.badSafariComposition = true;
        this.flushSoon();
      } else {
        this.flush();
      }
    });
    if (useCharData) {
      this.onCharData = e => {
        this.queue.push({
          target: e.target,
          type: "characterData",
          oldValue: e.prevValue
        });
        this.flushSoon();
      };
    }
    this.onSelectionChange = this.onSelectionChange.bind(this);
  }
  flushSoon() {
    if (this.flushingSoon < 0) this.flushingSoon = window.setTimeout(() => {
      this.flushingSoon = -1;
      this.flush();
    }, 20);
  }
  forceFlush() {
    if (this.flushingSoon > -1) {
      window.clearTimeout(this.flushingSoon);
      this.flushingSoon = -1;
      this.flush();
    }
  }
  start() {
    if (this.observer) {
      this.observer.takeRecords();
      this.observer.observe(this.view.dom, observeOptions);
    }
    if (this.onCharData) this.view.dom.addEventListener("DOMCharacterDataModified", this.onCharData);
    this.connectSelection();
  }
  stop() {
    if (this.observer) {
      let take = this.observer.takeRecords();
      if (take.length) {
        for (let i = 0; i < take.length; i++) this.queue.push(take[i]);
        window.setTimeout(() => this.flush(), 20);
      }
      this.observer.disconnect();
    }
    if (this.onCharData) this.view.dom.removeEventListener("DOMCharacterDataModified", this.onCharData);
    this.disconnectSelection();
  }
  connectSelection() {
    this.view.dom.ownerDocument.addEventListener("selectionchange", this.onSelectionChange);
  }
  disconnectSelection() {
    this.view.dom.ownerDocument.removeEventListener("selectionchange", this.onSelectionChange);
  }
  suppressSelectionUpdates() {
    this.suppressingSelectionUpdates = true;
    setTimeout(() => this.suppressingSelectionUpdates = false, 50);
  }
  onSelectionChange() {
    if (!(0, _selection.hasFocusAndSelection)(this.view)) return;
    if (this.suppressingSelectionUpdates) return (0, _selection.selectionToDOM)(this.view);
    // Deletions on IE11 fire their events in the wrong order, giving
    // us a selection change event before the DOM changes are
    // reported.
    if (browser.ie && browser.ie_version <= 11 && !this.view.state.selection.empty) {
      let sel = this.view.domSelectionRange();
      // Selection.isCollapsed isn't reliable on IE
      if (sel.focusNode && (0, _dom.isEquivalentPosition)(sel.focusNode, sel.focusOffset, sel.anchorNode, sel.anchorOffset)) return this.flushSoon();
    }
    this.flush();
  }
  setCurSelection() {
    this.currentSelection.set(this.view.domSelectionRange());
  }
  ignoreSelectionChange(sel) {
    if (!sel.focusNode) return true;
    let ancestors = new Set(),
      container;
    for (let scan = sel.focusNode; scan; scan = (0, _dom.parentNode)(scan)) ancestors.add(scan);
    for (let scan = sel.anchorNode; scan; scan = (0, _dom.parentNode)(scan)) if (ancestors.has(scan)) {
      container = scan;
      break;
    }
    let desc = container && this.view.docView.nearestDesc(container);
    if (desc && desc.ignoreMutation({
      type: "selection",
      target: container.nodeType == 3 ? container.parentNode : container
    })) {
      this.setCurSelection();
      return true;
    }
  }
  pendingRecords() {
    if (this.observer) for (let mut of this.observer.takeRecords()) this.queue.push(mut);
    return this.queue;
  }
  flush() {
    let {
      view
    } = this;
    if (!view.docView || this.flushingSoon > -1) return;
    let mutations = this.pendingRecords();
    if (mutations.length) this.queue = [];
    let sel = view.domSelectionRange();
    let newSel = !this.suppressingSelectionUpdates && !this.currentSelection.eq(sel) && (0, _selection.hasFocusAndSelection)(view) && !this.ignoreSelectionChange(sel);
    let from = -1,
      to = -1,
      typeOver = false,
      added = [];
    if (view.editable) {
      for (let i = 0; i < mutations.length; i++) {
        let result = this.registerMutation(mutations[i], added);
        if (result) {
          from = from < 0 ? result.from : Math.min(result.from, from);
          to = to < 0 ? result.to : Math.max(result.to, to);
          if (result.typeOver) typeOver = true;
        }
      }
    }
    if (added.some(n => n.nodeName == "BR") && (view.input.lastKeyCode == 8 || view.input.lastKeyCode == 46)) {
      // Browsers sometimes insert a bogus break node if you
      // backspace out the last bit of text before an inline-flex node (#1552)
      for (let node of added) if (node.nodeName == "BR" && node.parentNode) {
        let after = node.nextSibling;
        while (after && after.nodeType == 1) {
          if (after.contentEditable == "false") {
            node.parentNode.removeChild(node);
            break;
          }
          after = after.firstChild;
        }
      }
    } else if (browser.gecko && added.length) {
      let brs = added.filter(n => n.nodeName == "BR");
      if (brs.length == 2) {
        let [a, b] = brs;
        if (a.parentNode && a.parentNode.parentNode == b.parentNode) b.remove();else a.remove();
      } else {
        let {
          focusNode
        } = this.currentSelection;
        for (let br of brs) {
          let parent = br.parentNode;
          if (parent && parent.nodeName == "LI" && (!focusNode || blockParent(view, focusNode) != parent)) br.remove();
        }
      }
    }
    let readSel = null;
    // If it looks like the browser has reset the selection to the
    // start of the document after focus, restore the selection from
    // the state
    if (from < 0 && newSel && view.input.lastFocus > Date.now() - 200 && Math.max(view.input.lastTouch, view.input.lastClick.time) < Date.now() - 300 && (0, _dom.selectionCollapsed)(sel) && (readSel = (0, _selection.selectionFromDOM)(view)) && readSel.eq(_prosemirrorState.Selection.near(view.state.doc.resolve(0), 1))) {
      view.input.lastFocus = 0;
      (0, _selection.selectionToDOM)(view);
      this.currentSelection.set(sel);
      view.scrollToSelection();
    } else if (from > -1 || newSel) {
      if (from > -1) {
        view.docView.markDirty(from, to);
        checkCSS(view);
      }
      if (view.input.badSafariComposition) {
        view.input.badSafariComposition = false;
        fixUpBadSafariComposition(view, added);
      }
      this.handleDOMChange(from, to, typeOver, added);
      if (view.docView && view.docView.dirty) view.updateState(view.state);else if (!this.currentSelection.eq(sel)) (0, _selection.selectionToDOM)(view);
      this.currentSelection.set(sel);
    }
  }
  registerMutation(mut, added) {
    // Ignore mutations inside nodes that were already noted as inserted
    if (added.indexOf(mut.target) > -1) return null;
    let desc = this.view.docView.nearestDesc(mut.target);
    if (mut.type == "attributes" && (desc == this.view.docView || mut.attributeName == "contenteditable" ||
    // Firefox sometimes fires spurious events for null/empty styles
    mut.attributeName == "style" && !mut.oldValue && !mut.target.getAttribute("style"))) return null;
    if (!desc || desc.ignoreMutation(mut)) return null;
    if (mut.type == "childList") {
      for (let i = 0; i < mut.addedNodes.length; i++) {
        let node = mut.addedNodes[i];
        added.push(node);
        if (node.nodeType == 3) this.lastChangedTextNode = node;
      }
      if (desc.contentDOM && desc.contentDOM != desc.dom && !desc.contentDOM.contains(mut.target)) return {
        from: desc.posBefore,
        to: desc.posAfter
      };
      let prev = mut.previousSibling,
        next = mut.nextSibling;
      if (browser.ie && browser.ie_version <= 11 && mut.addedNodes.length) {
        // IE11 gives us incorrect next/prev siblings for some
        // insertions, so if there are added nodes, recompute those
        for (let i = 0; i < mut.addedNodes.length; i++) {
          let {
            previousSibling,
            nextSibling
          } = mut.addedNodes[i];
          if (!previousSibling || Array.prototype.indexOf.call(mut.addedNodes, previousSibling) < 0) prev = previousSibling;
          if (!nextSibling || Array.prototype.indexOf.call(mut.addedNodes, nextSibling) < 0) next = nextSibling;
        }
      }
      let fromOffset = prev && prev.parentNode == mut.target ? (0, _dom.domIndex)(prev) + 1 : 0;
      let from = desc.localPosFromDOM(mut.target, fromOffset, -1);
      let toOffset = next && next.parentNode == mut.target ? (0, _dom.domIndex)(next) : mut.target.childNodes.length;
      let to = desc.localPosFromDOM(mut.target, toOffset, 1);
      return {
        from,
        to
      };
    } else if (mut.type == "attributes") {
      return {
        from: desc.posAtStart - desc.border,
        to: desc.posAtEnd + desc.border
      };
    } else {
      // "characterData"
      this.lastChangedTextNode = mut.target;
      return {
        from: desc.posAtStart,
        to: desc.posAtEnd,
        // An event was generated for a text change that didn't change
        // any text. Mark the dom change to fall back to assuming the
        // selection was typed over with an identical value if it can't
        // find another change.
        typeOver: mut.target.nodeValue == mut.oldValue
      };
    }
  }
}
exports.DOMObserver = DOMObserver;
let cssChecked = new WeakMap();
let cssCheckWarned = false;
function checkCSS(view) {
  if (cssChecked.has(view)) return;
  cssChecked.set(view, null);
  if (['normal', 'nowrap', 'pre-line'].indexOf(getComputedStyle(view.dom).whiteSpace) !== -1) {
    view.requiresGeckoHackNode = browser.gecko;
    if (cssCheckWarned) return;
    console["warn"]("ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package.");
    cssCheckWarned = true;
  }
}
function rangeToSelectionRange(view, range) {
  let anchorNode = range.startContainer,
    anchorOffset = range.startOffset;
  let focusNode = range.endContainer,
    focusOffset = range.endOffset;
  let currentAnchor = view.domAtPos(view.state.selection.anchor);
  // Since such a range doesn't distinguish between anchor and head,
  // use a heuristic that flips it around if its end matches the
  // current anchor.
  if ((0, _dom.isEquivalentPosition)(currentAnchor.node, currentAnchor.offset, focusNode, focusOffset)) [anchorNode, anchorOffset, focusNode, focusOffset] = [focusNode, focusOffset, anchorNode, anchorOffset];
  return {
    anchorNode,
    anchorOffset,
    focusNode,
    focusOffset
  };
}

// Used to work around a Safari Selection/shadow DOM bug
// Based on https://github.com/codemirror/dev/issues/414 fix
function safariShadowSelectionRange(view, selection) {
  if (selection.getComposedRanges) {
    let range = selection.getComposedRanges(view.root)[0];
    if (range) return rangeToSelectionRange(view, range);
  }
  let found;
  function read(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    found = event.getTargetRanges()[0];
  }

  // Because Safari (at least in 2018-2022) doesn't provide regular
  // access to the selection inside a shadowRoot, we have to perform a
  // ridiculous hack to get at it—using `execCommand` to trigger a
  // `beforeInput` event so that we can read the target range from the
  // event.
  view.dom.addEventListener("beforeinput", read, true);
  document.execCommand("indent");
  view.dom.removeEventListener("beforeinput", read, true);
  return found ? rangeToSelectionRange(view, found) : null;
}
function blockParent(view, node) {
  for (let p = node.parentNode; p && p != view.dom; p = p.parentNode) {
    let desc = view.docView.nearestDesc(p, true);
    if (desc && desc.node.isBlock) return p;
  }
  return null;
}

// Kludge for a Safari bug where, on ending a composition in an
// otherwise empty table cell, it randomly moves the composed text
// into the table row around that cell, greatly confusing everything
// (#188).
function fixUpBadSafariComposition(view, addedNodes) {
  let {
    focusNode,
    focusOffset
  } = view.domSelectionRange();
  for (let node of addedNodes) {
    var _node$parentNode;
    if (((_node$parentNode = node.parentNode) === null || _node$parentNode === void 0 ? void 0 : _node$parentNode.nodeName) == "TR") {
      let nextCell = node.nextSibling;
      while (nextCell && nextCell.nodeName != "TD" && nextCell.nodeName != "TH") nextCell = nextCell.nextSibling;
      if (nextCell) {
        let parent = nextCell;
        for (;;) {
          let first = parent.firstChild;
          if (!first || first.nodeType != 1 || first.contentEditable == "false" || /^(BR|IMG)$/.test(first.nodeName)) break;
          parent = first;
        }
        parent.insertBefore(node, parent.firstChild);
        if (focusNode == node) view.domSelection().collapse(node, focusOffset);
      } else {
        node.parentNode.removeChild(node);
      }
    }
  }
}
},
"prosemirror-view/src/index.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Decoration", {
  enumerable: true,
  get: function () {
    return _decoration.Decoration;
  }
});
Object.defineProperty(exports, "DecorationAttrs", {
  enumerable: true,
  get: function () {
    return _decoration.DecorationAttrs;
  }
});
Object.defineProperty(exports, "DecorationSet", {
  enumerable: true,
  get: function () {
    return _decoration.DecorationSet;
  }
});
Object.defineProperty(exports, "DecorationSource", {
  enumerable: true,
  get: function () {
    return _decoration.DecorationSource;
  }
});
exports.EditorView = void 0;
Object.defineProperty(exports, "MarkView", {
  enumerable: true,
  get: function () {
    return _viewdesc.MarkView;
  }
});
Object.defineProperty(exports, "NodeView", {
  enumerable: true,
  get: function () {
    return _viewdesc.NodeView;
  }
});
Object.defineProperty(exports, "ViewMutationRecord", {
  enumerable: true,
  get: function () {
    return _viewdesc.ViewMutationRecord;
  }
});
exports.__parseFromClipboard = exports.__endComposition = void 0;
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var _domcoords = __require("prosemirror-view/src/domcoords.ts");
var _viewdesc = __require("prosemirror-view/src/viewdesc.ts");
var _input = __require("prosemirror-view/src/input.ts");
var _selection = __require("prosemirror-view/src/selection.ts");
var _decoration = __require("prosemirror-view/src/decoration.ts");
var _domobserver = __require("prosemirror-view/src/domobserver.ts");
var _domchange = __require("prosemirror-view/src/domchange.ts");
var _dom = __require("prosemirror-view/src/dom.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
var _clipboard = __require("prosemirror-view/src/clipboard.ts");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
// Exported for testing

/// @internal
const __parseFromClipboard = exports.__parseFromClipboard = _clipboard.parseFromClipboard;
/// @internal
const __endComposition = exports.__endComposition = _input.endComposition;

/// An editor view manages the DOM structure that represents an
/// editable document. Its state and behavior are determined by its
/// [props](#view.DirectEditorProps).
class EditorView {
  /// Create a view. `place` may be a DOM node that the editor should
  /// be appended to, a function that will place it into the document,
  /// or an object whose `mount` property holds the node to use as the
  /// document container. If it is `null`, the editor will not be
  /// added to the document.
  constructor(place, props) {
    /// @internal
    this._props = void 0;
    this.directPlugins = void 0;
    this._root = null;
    /// @internal
    this.focused = false;
    /// Kludge used to work around a Chrome bug @internal
    this.trackWrites = null;
    this.mounted = false;
    /// @internal
    this.markCursor = null;
    /// @internal
    this.cursorWrapper = null;
    /// @internal
    this.nodeViews = void 0;
    /// @internal
    this.lastSelectedViewDesc = undefined;
    /// @internal
    this.docView = void 0;
    /// @internal
    this.input = new _input.InputState();
    this.prevDirectPlugins = [];
    this.pluginViews = [];
    /// Holds `true` when a hack node is needed in Firefox to prevent the
    /// [space is eaten issue](https://github.com/ProseMirror/prosemirror/issues/651)
    /// @internal
    this.requiresGeckoHackNode = false;
    /// The view's current [state](#state.EditorState).
    this.state = void 0;
    /// An editable DOM node containing the document. (You probably
    /// should not directly interfere with its content.)
    this.dom = void 0;
    /// Indicates whether the editor is currently [editable](#view.EditorProps.editable).
    this.editable = void 0;
    /// When editor content is being dragged, this object contains
    /// information about the dragged slice and whether it is being
    /// copied or moved. At any other time, it is null.
    this.dragging = null;
    this._props = props;
    this.state = props.state;
    this.directPlugins = props.plugins || [];
    this.directPlugins.forEach(checkStateComponent);
    this.dispatch = this.dispatch.bind(this);
    this.dom = place && place.mount || document.createElement("div");
    if (place) {
      if (place.appendChild) place.appendChild(this.dom);else if (typeof place == "function") place(this.dom);else if (place.mount) this.mounted = true;
    }
    this.editable = getEditable(this);
    updateCursorWrapper(this);
    this.nodeViews = buildNodeViews(this);
    this.docView = (0, _viewdesc.docViewDesc)(this.state.doc, computeDocDeco(this), (0, _decoration.viewDecorations)(this), this.dom, this);
    this.domObserver = new _domobserver.DOMObserver(this, (from, to, typeOver, added) => (0, _domchange.readDOMChange)(this, from, to, typeOver, added));
    this.domObserver.start();
    (0, _input.initInput)(this);
    this.updatePluginViews();
  }
  /// Holds `true` when a
  /// [composition](https://w3c.github.io/uievents/#events-compositionevents)
  /// is active.
  get composing() {
    return this.input.composing;
  }

  /// The view's current [props](#view.EditorProps).
  get props() {
    if (this._props.state != this.state) {
      let prev = this._props;
      this._props = {};
      for (let name in prev) this._props[name] = prev[name];
      this._props.state = this.state;
    }
    return this._props;
  }

  /// Update the view's props. Will immediately cause an update to
  /// the DOM.
  update(props) {
    if (props.handleDOMEvents != this._props.handleDOMEvents) (0, _input.ensureListeners)(this);
    let prevProps = this._props;
    this._props = props;
    if (props.plugins) {
      props.plugins.forEach(checkStateComponent);
      this.directPlugins = props.plugins;
    }
    this.updateStateInner(props.state, prevProps);
  }

  /// Update the view by updating existing props object with the object
  /// given as argument. Equivalent to `view.update(Object.assign({},
  /// view.props, props))`.
  setProps(props) {
    let updated = {};
    for (let name in this._props) updated[name] = this._props[name];
    updated.state = this.state;
    for (let name in props) updated[name] = props[name];
    this.update(updated);
  }

  /// Update the editor's `state` prop, without touching any of the
  /// other props.
  updateState(state) {
    this.updateStateInner(state, this._props);
  }
  updateStateInner(state, prevProps) {
    var _this$dragging;
    let prev = this.state,
      redraw = false,
      updateSel = false;
    // When stored marks are added, stop composition, so that they can
    // be displayed.
    if (state.storedMarks && this.composing) {
      (0, _input.clearComposition)(this);
      updateSel = true;
    }
    this.state = state;
    let pluginsChanged = prev.plugins != state.plugins || this._props.plugins != prevProps.plugins;
    if (pluginsChanged || this._props.plugins != prevProps.plugins || this._props.nodeViews != prevProps.nodeViews) {
      let nodeViews = buildNodeViews(this);
      if (changedNodeViews(nodeViews, this.nodeViews)) {
        this.nodeViews = nodeViews;
        redraw = true;
      }
    }
    if (pluginsChanged || prevProps.handleDOMEvents != this._props.handleDOMEvents) {
      (0, _input.ensureListeners)(this);
    }
    this.editable = getEditable(this);
    updateCursorWrapper(this);
    let innerDeco = (0, _decoration.viewDecorations)(this),
      outerDeco = computeDocDeco(this);
    let scroll = prev.plugins != state.plugins && !prev.doc.eq(state.doc) ? "reset" : state.scrollToSelection > prev.scrollToSelection ? "to selection" : "preserve";
    let updateDoc = redraw || !this.docView.matchesNode(state.doc, outerDeco, innerDeco);
    if (updateDoc || !state.selection.eq(prev.selection)) updateSel = true;
    let oldScrollPos = scroll == "preserve" && updateSel && this.dom.style.overflowAnchor == null && (0, _domcoords.storeScrollPos)(this);
    if (updateSel) {
      this.domObserver.stop();
      // Work around an issue in Chrome, IE, and Edge where changing
      // the DOM around an active selection puts it into a broken
      // state where the thing the user sees differs from the
      // selection reported by the Selection object (#710, #973,
      // #1011, #1013, #1035).
      let forceSelUpdate = updateDoc && (browser.ie || browser.chrome) && !this.composing && !prev.selection.empty && !state.selection.empty && selectionContextChanged(prev.selection, state.selection);
      if (updateDoc) {
        // If the node that the selection points into is written to,
        // Chrome sometimes starts misreporting the selection, so this
        // tracks that and forces a selection reset when our update
        // did write to the node.
        let chromeKludge = browser.chrome ? this.trackWrites = this.domSelectionRange().focusNode : null;
        if (this.composing) this.input.compositionNode = (0, _input.findCompositionNode)(this);
        if (redraw || !this.docView.update(state.doc, outerDeco, innerDeco, this)) {
          this.docView.updateOuterDeco(outerDeco);
          this.docView.destroy();
          this.docView = (0, _viewdesc.docViewDesc)(state.doc, outerDeco, innerDeco, this.dom, this);
        }
        if (chromeKludge && (!this.trackWrites || !this.dom.contains(this.trackWrites))) forceSelUpdate = true;
      }
      // Work around for an issue where an update arriving right between
      // a DOM selection change and the "selectionchange" event for it
      // can cause a spurious DOM selection update, disrupting mouse
      // drag selection.
      if (forceSelUpdate || !(this.input.mouseDown && this.domObserver.currentSelection.eq(this.domSelectionRange()) && (0, _selection.anchorInRightPlace)(this))) {
        (0, _selection.selectionToDOM)(this, forceSelUpdate);
      } else {
        (0, _selection.syncNodeSelection)(this, state.selection);
        this.domObserver.setCurSelection();
      }
      this.domObserver.start();
    }
    this.updatePluginViews(prev);
    if ((_this$dragging = this.dragging) !== null && _this$dragging !== void 0 && _this$dragging.node && !prev.doc.eq(state.doc)) this.updateDraggedNode(this.dragging, prev);
    if (scroll == "reset") {
      this.dom.scrollTop = 0;
    } else if (scroll == "to selection") {
      this.scrollToSelection();
    } else if (oldScrollPos) {
      (0, _domcoords.resetScrollPos)(oldScrollPos);
    }
  }

  /// @internal
  scrollToSelection() {
    let startDOM = this.domSelectionRange().focusNode;
    if (!startDOM || !this.dom.contains(startDOM.nodeType == 1 ? startDOM : startDOM.parentNode)) {
      // Ignore selections outside the editor
    } else if (this.someProp("handleScrollToSelection", f => f(this))) {
      // Handled
    } else if (this.state.selection instanceof _prosemirrorState.NodeSelection) {
      let target = this.docView.domAfterPos(this.state.selection.from);
      if (target.nodeType == 1) (0, _domcoords.scrollRectIntoView)(this, target.getBoundingClientRect(), startDOM);
    } else {
      (0, _domcoords.scrollRectIntoView)(this, this.coordsAtPos(this.state.selection.head, 1), startDOM);
    }
  }
  destroyPluginViews() {
    let view;
    while (view = this.pluginViews.pop()) if (view.destroy) view.destroy();
  }
  updatePluginViews(prevState) {
    if (!prevState || prevState.plugins != this.state.plugins || this.directPlugins != this.prevDirectPlugins) {
      this.prevDirectPlugins = this.directPlugins;
      this.destroyPluginViews();
      for (let i = 0; i < this.directPlugins.length; i++) {
        let plugin = this.directPlugins[i];
        if (plugin.spec.view) this.pluginViews.push(plugin.spec.view(this));
      }
      for (let i = 0; i < this.state.plugins.length; i++) {
        let plugin = this.state.plugins[i];
        if (plugin.spec.view) this.pluginViews.push(plugin.spec.view(this));
      }
    } else {
      for (let i = 0; i < this.pluginViews.length; i++) {
        let pluginView = this.pluginViews[i];
        if (pluginView.update) pluginView.update(this, prevState);
      }
    }
  }
  updateDraggedNode(dragging, prev) {
    let sel = dragging.node,
      found = -1;
    if (sel.from < this.state.doc.content.size && this.state.doc.nodeAt(sel.from) == sel.node) {
      found = sel.from;
    } else {
      let movedPos = sel.from + (this.state.doc.content.size - prev.doc.content.size);
      let moved = movedPos > 0 && movedPos < this.state.doc.content.size && this.state.doc.nodeAt(movedPos);
      if (moved == sel.node) found = movedPos;
    }
    this.dragging = new _input.Dragging(dragging.slice, dragging.move, found < 0 ? undefined : _prosemirrorState.NodeSelection.create(this.state.doc, found));
  }

  /// Goes over the values of a prop, first those provided directly,
  /// then those from plugins given to the view, then from plugins in
  /// the state (in order), and calls `f` every time a non-undefined
  /// value is found. When `f` returns a truthy value, that is
  /// immediately returned. When `f` isn't provided, it is treated as
  /// the identity function (the prop value is returned directly).

  someProp(propName, f) {
    let prop = this._props && this._props[propName],
      value;
    if (prop != null && (value = f ? f(prop) : prop)) return value;
    for (let i = 0; i < this.directPlugins.length; i++) {
      let prop = this.directPlugins[i].props[propName];
      if (prop != null && (value = f ? f(prop) : prop)) return value;
    }
    let plugins = this.state.plugins;
    if (plugins) for (let i = 0; i < plugins.length; i++) {
      let prop = plugins[i].props[propName];
      if (prop != null && (value = f ? f(prop) : prop)) return value;
    }
  }

  /// Query whether the view has focus.
  hasFocus() {
    // Work around IE not handling focus correctly if resize handles are shown.
    // If the cursor is inside an element with resize handles, activeElement
    // will be that element instead of this.dom.
    if (browser.ie) {
      // If activeElement is within this.dom, and there are no other elements
      // setting `contenteditable` to false in between, treat it as focused.
      let node = this.root.activeElement;
      if (node == this.dom) return true;
      if (!node || !this.dom.contains(node)) return false;
      while (node && this.dom != node && this.dom.contains(node)) {
        if (node.contentEditable == 'false') return false;
        node = node.parentElement;
      }
      return true;
    }
    return this.root.activeElement == this.dom;
  }

  /// Focus the editor.
  focus() {
    this.domObserver.stop();
    if (this.editable) (0, _domcoords.focusPreventScroll)(this.dom);
    (0, _selection.selectionToDOM)(this);
    this.domObserver.start();
  }

  /// Get the document root in which the editor exists. This will
  /// usually be the top-level `document`, but might be a [shadow
  /// DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Shadow_DOM)
  /// root if the editor is inside one.
  get root() {
    let cached = this._root;
    if (cached == null) for (let search = this.dom.parentNode; search; search = search.parentNode) {
      if (search.nodeType == 9 || search.nodeType == 11 && search.host) {
        if (!search.getSelection) Object.getPrototypeOf(search).getSelection = () => search.ownerDocument.getSelection();
        return this._root = search;
      }
    }
    return cached || document;
  }

  /// When an existing editor view is moved to a new document or
  /// shadow tree, call this to make it recompute its root.
  updateRoot() {
    this._root = null;
  }

  /// Given a pair of viewport coordinates, return the document
  /// position that corresponds to them. May return null if the given
  /// coordinates aren't inside of the editor. When an object is
  /// returned, its `pos` property is the position nearest to the
  /// coordinates, and its `inside` property holds the position of the
  /// inner node that the position falls inside of, or -1 if it is at
  /// the top level, not in any node.
  posAtCoords(coords) {
    return (0, _domcoords.posAtCoords)(this, coords);
  }

  /// Returns the viewport rectangle at a given document position.
  /// `left` and `right` will be the same number, as this returns a
  /// flat cursor-ish rectangle. If the position is between two things
  /// that aren't directly adjacent, `side` determines which element
  /// is used. When < 0, the element before the position is used,
  /// otherwise the element after.
  coordsAtPos(pos, side = 1) {
    return (0, _domcoords.coordsAtPos)(this, pos, side);
  }

  /// Find the DOM position that corresponds to the given document
  /// position. When `side` is negative, find the position as close as
  /// possible to the content before the position. When positive,
  /// prefer positions close to the content after the position. When
  /// zero, prefer as shallow a position as possible.
  ///
  /// Note that you should **not** mutate the editor's internal DOM,
  /// only inspect it (and even that is usually not necessary).
  domAtPos(pos, side = 0) {
    return this.docView.domFromPos(pos, side);
  }

  /// Find the DOM node that represents the document node after the
  /// given position. May return `null` when the position doesn't point
  /// in front of a node or if the node is inside an opaque node view.
  ///
  /// This is intended to be able to call things like
  /// `getBoundingClientRect` on that DOM node. Do **not** mutate the
  /// editor DOM directly, or add styling this way, since that will be
  /// immediately overriden by the editor as it redraws the node.
  nodeDOM(pos) {
    let desc = this.docView.descAt(pos);
    return desc ? desc.nodeDOM : null;
  }

  /// Find the document position that corresponds to a given DOM
  /// position. (Whenever possible, it is preferable to inspect the
  /// document structure directly, rather than poking around in the
  /// DOM, but sometimes—for example when interpreting an event
  /// target—you don't have a choice.)
  ///
  /// The `bias` parameter can be used to influence which side of a DOM
  /// node to use when the position is inside a leaf node.
  posAtDOM(node, offset, bias = -1) {
    let pos = this.docView.posFromDOM(node, offset, bias);
    if (pos == null) throw new RangeError("DOM position not inside the editor");
    return pos;
  }

  /// Find out whether the selection is at the end of a textblock when
  /// moving in a given direction. When, for example, given `"left"`,
  /// it will return true if moving left from the current cursor
  /// position would leave that position's parent textblock. Will apply
  /// to the view's current state by default, but it is possible to
  /// pass a different state.
  endOfTextblock(dir, state) {
    return (0, _domcoords.endOfTextblock)(this, state || this.state, dir);
  }

  /// Run the editor's paste logic with the given HTML string. The
  /// `event`, if given, will be passed to the
  /// [`handlePaste`](#view.EditorProps.handlePaste) hook.
  pasteHTML(html, event) {
    return (0, _input.doPaste)(this, "", html, false, event || new ClipboardEvent("paste"));
  }

  /// Run the editor's paste logic with the given plain-text input.
  pasteText(text, event) {
    return (0, _input.doPaste)(this, text, null, true, event || new ClipboardEvent("paste"));
  }

  /// Serialize the given slice as it would be if it was copied from
  /// this editor. Returns a DOM element that contains a
  /// representation of the slice as its children, a textual
  /// representation, and the transformed slice (which can be
  /// different from the given input due to hooks like
  /// [`transformCopied`](#view.EditorProps.transformCopied)).
  serializeForClipboard(slice) {
    return (0, _clipboard.serializeForClipboard)(this, slice);
  }

  /// Removes the editor from the DOM and destroys all [node
  /// views](#view.NodeView).
  destroy() {
    if (!this.docView) return;
    (0, _input.destroyInput)(this);
    this.destroyPluginViews();
    if (this.mounted) {
      this.docView.update(this.state.doc, [], (0, _decoration.viewDecorations)(this), this);
      this.dom.textContent = "";
    } else if (this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }
    this.docView.destroy();
    this.docView = null;
    (0, _dom.clearReusedRange)();
  }

  /// This is true when the view has been
  /// [destroyed](#view.EditorView.destroy) (and thus should not be
  /// used anymore).
  get isDestroyed() {
    return this.docView == null;
  }

  /// Used for testing.
  dispatchEvent(event) {
    return (0, _input.dispatchEvent)(this, event);
  }

  /// Dispatch a transaction. Will call
  /// [`dispatchTransaction`](#view.DirectEditorProps.dispatchTransaction)
  /// when given, and otherwise defaults to applying the transaction to
  /// the current state and calling
  /// [`updateState`](#view.EditorView.updateState) with the result.
  /// This method is bound to the view instance, so that it can be
  /// easily passed around.

  /// @internal
  domSelectionRange() {
    let sel = this.domSelection();
    if (!sel) return {
      focusNode: null,
      focusOffset: 0,
      anchorNode: null,
      anchorOffset: 0
    };
    return browser.safari && this.root.nodeType === 11 && (0, _dom.deepActiveElement)(this.dom.ownerDocument) == this.dom && (0, _domobserver.safariShadowSelectionRange)(this, sel) || sel;
  }

  /// @internal
  domSelection() {
    return this.root.getSelection();
  }
}
exports.EditorView = EditorView;
EditorView.prototype.dispatch = function (tr) {
  let dispatchTransaction = this._props.dispatchTransaction;
  if (dispatchTransaction) dispatchTransaction.call(this, tr);else this.updateState(this.state.apply(tr));
};
function computeDocDeco(view) {
  let attrs = Object.create(null);
  attrs.class = "ProseMirror";
  attrs.contenteditable = String(view.editable);
  view.someProp("attributes", value => {
    if (typeof value == "function") value = value(view.state);
    if (value) for (let attr in value) {
      if (attr == "class") attrs.class += " " + value[attr];else if (attr == "style") attrs.style = (attrs.style ? attrs.style + ";" : "") + value[attr];else if (!attrs[attr] && attr != "contenteditable" && attr != "nodeName") attrs[attr] = String(value[attr]);
    }
  });
  if (!attrs.translate) attrs.translate = "no";
  return [_decoration.Decoration.node(0, view.state.doc.content.size, attrs)];
}
function updateCursorWrapper(view) {
  if (view.markCursor) {
    let dom = document.createElement("img");
    dom.className = "ProseMirror-separator";
    dom.setAttribute("mark-placeholder", "true");
    dom.setAttribute("alt", "");
    view.cursorWrapper = {
      dom,
      deco: _decoration.Decoration.widget(view.state.selection.from, dom, {
        raw: true,
        marks: view.markCursor
      })
    };
  } else {
    view.cursorWrapper = null;
  }
}
function getEditable(view) {
  return !view.someProp("editable", value => value(view.state) === false);
}
function selectionContextChanged(sel1, sel2) {
  let depth = Math.min(sel1.$anchor.sharedDepth(sel1.head), sel2.$anchor.sharedDepth(sel2.head));
  return sel1.$anchor.start(depth) != sel2.$anchor.start(depth);
}
function buildNodeViews(view) {
  let result = Object.create(null);
  function add(obj) {
    for (let prop in obj) if (!Object.prototype.hasOwnProperty.call(result, prop)) result[prop] = obj[prop];
  }
  view.someProp("nodeViews", add);
  view.someProp("markViews", add);
  return result;
}
function changedNodeViews(a, b) {
  let nA = 0,
    nB = 0;
  for (let prop in a) {
    if (a[prop] != b[prop]) return true;
    nA++;
  }
  for (let _ in b) nB++;
  return nA != nB;
}
function checkStateComponent(plugin) {
  if (plugin.spec.state || plugin.spec.filterTransaction || plugin.spec.appendTransaction) throw new RangeError("Plugins passed directly to the view must not have a state component");
}

/// The type of function [provided](#view.EditorProps.nodeViews) to
/// create [node views](#view.NodeView).

/// The function types [used](#view.EditorProps.markViews) to create
/// mark views.

/// Helper type that maps event names to event object types, but
/// includes events that TypeScript's HTMLElementEventMap doesn't know
/// about.

/// Props are configuration values that can be passed to an editor view
/// or included in a plugin. This interface lists the supported props.
///
/// The various event-handling functions may all return `true` to
/// indicate that they handled the given event. The view will then take
/// care to call `preventDefault` on the event, except with
/// `handleDOMEvents`, where the handler itself is responsible for that.
///
/// How a prop is resolved depends on the prop. Handler functions are
/// called one at a time, starting with the base props and then
/// searching through the plugins (in order of appearance) until one of
/// them returns true. For some props, the first plugin that yields a
/// value gets precedence.
///
/// The optional type parameter refers to the type of `this` in prop
/// functions, and is used to pass in the plugin type when defining a
/// [plugin](#state.Plugin).

/// The props object given directly to the editor view supports some
/// fields that can't be used in plugins:
},
"prosemirror-view/src/input.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InputState = exports.Dragging = void 0;
exports.clearComposition = clearComposition;
exports.destroyInput = destroyInput;
exports.dispatchEvent = dispatchEvent;
exports.doPaste = doPaste;
exports.endComposition = endComposition;
exports.ensureListeners = ensureListeners;
exports.findCompositionNode = findCompositionNode;
exports.initInput = initInput;
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var _prosemirrorTransform = __require("prosemirror-transform/src/index.ts");
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
var _capturekeys = __require("prosemirror-view/src/capturekeys.ts");
var _clipboard = __require("prosemirror-view/src/clipboard.ts");
var _selection = __require("prosemirror-view/src/selection.ts");
var _dom = __require("prosemirror-view/src/dom.ts");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
// A collection of DOM events that occur within the editor, and callback functions
// to invoke when the event fires.
const handlers = {};
const editHandlers = {};
const passiveHandlers = {
  touchstart: true,
  touchmove: true
};
class InputState {
  constructor() {
    this.shiftKey = false;
    this.mouseDown = null;
    this.lastKeyCode = null;
    this.lastKeyCodeTime = 0;
    this.lastClick = {
      time: 0,
      x: 0,
      y: 0,
      type: "",
      button: 0
    };
    this.lastSelectionOrigin = null;
    this.lastSelectionTime = 0;
    this.lastIOSEnter = 0;
    this.lastIOSEnterFallbackTimeout = -1;
    this.lastFocus = 0;
    this.lastTouch = 0;
    this.lastChromeDelete = 0;
    this.composing = false;
    this.compositionNode = null;
    this.composingTimeout = -1;
    this.compositionNodes = [];
    this.compositionEndedAt = -2e8;
    this.compositionID = 1;
    this.badSafariComposition = false;
    // Set to a composition ID when there are pending changes at compositionend
    this.compositionPendingChanges = 0;
    this.domChangeCount = 0;
    this.eventHandlers = Object.create(null);
    this.hideSelectionGuard = null;
  }
}
exports.InputState = InputState;
function initInput(view) {
  for (let event in handlers) {
    let handler = handlers[event];
    view.dom.addEventListener(event, view.input.eventHandlers[event] = event => {
      if (eventBelongsToView(view, event) && !runCustomHandler(view, event) && (view.editable || !(event.type in editHandlers))) handler(view, event);
    }, passiveHandlers[event] ? {
      passive: true
    } : undefined);
  }
  // On Safari, for reasons beyond my understanding, adding an input
  // event handler makes an issue where the composition vanishes when
  // you press enter go away.
  if (browser.safari) view.dom.addEventListener("input", () => null);
  ensureListeners(view);
}
function setSelectionOrigin(view, origin) {
  view.input.lastSelectionOrigin = origin;
  view.input.lastSelectionTime = Date.now();
}
function destroyInput(view) {
  view.domObserver.stop();
  for (let type in view.input.eventHandlers) view.dom.removeEventListener(type, view.input.eventHandlers[type]);
  clearTimeout(view.input.composingTimeout);
  clearTimeout(view.input.lastIOSEnterFallbackTimeout);
}
function ensureListeners(view) {
  view.someProp("handleDOMEvents", currentHandlers => {
    for (let type in currentHandlers) if (!view.input.eventHandlers[type]) view.dom.addEventListener(type, view.input.eventHandlers[type] = event => runCustomHandler(view, event));
  });
}
function runCustomHandler(view, event) {
  return view.someProp("handleDOMEvents", handlers => {
    let handler = handlers[event.type];
    return handler ? handler(view, event) || event.defaultPrevented : false;
  });
}
function eventBelongsToView(view, event) {
  if (!event.bubbles) return true;
  if (event.defaultPrevented) return false;
  for (let node = event.target; node != view.dom; node = node.parentNode) if (!node || node.nodeType == 11 || node.pmViewDesc && node.pmViewDesc.stopEvent(event)) return false;
  return true;
}
function dispatchEvent(view, event) {
  if (!runCustomHandler(view, event) && handlers[event.type] && (view.editable || !(event.type in editHandlers))) handlers[event.type](view, event);
}
editHandlers.keydown = (view, _event) => {
  let event = _event;
  view.input.shiftKey = event.keyCode == 16 || event.shiftKey;
  if (inOrNearComposition(view, event)) return;
  view.input.lastKeyCode = event.keyCode;
  view.input.lastKeyCodeTime = Date.now();
  // Suppress enter key events on Chrome Android, because those tend
  // to be part of a confused sequence of composition events fired,
  // and handling them eagerly tends to corrupt the input.
  if (browser.android && browser.chrome && event.keyCode == 13) return;
  if (event.keyCode != 229) view.domObserver.forceFlush();

  // On iOS, if we preventDefault enter key presses, the virtual
  // keyboard gets confused. So the hack here is to set a flag that
  // makes the DOM change code recognize that what just happens should
  // be replaced by whatever the Enter key handlers do.
  if (browser.ios && event.keyCode == 13 && !event.ctrlKey && !event.altKey && !event.metaKey) {
    let now = Date.now();
    view.input.lastIOSEnter = now;
    view.input.lastIOSEnterFallbackTimeout = setTimeout(() => {
      if (view.input.lastIOSEnter == now) {
        view.someProp("handleKeyDown", f => f(view, (0, _dom.keyEvent)(13, "Enter")));
        view.input.lastIOSEnter = 0;
      }
    }, 200);
  } else if (view.someProp("handleKeyDown", f => f(view, event)) || (0, _capturekeys.captureKeyDown)(view, event)) {
    event.preventDefault();
  } else {
    setSelectionOrigin(view, "key");
  }
};
editHandlers.keyup = (view, event) => {
  if (event.keyCode == 16) view.input.shiftKey = false;
};
editHandlers.keypress = (view, _event) => {
  let event = _event;
  if (inOrNearComposition(view, event) || !event.charCode || event.ctrlKey && !event.altKey || browser.mac && event.metaKey) return;
  if (view.someProp("handleKeyPress", f => f(view, event))) {
    event.preventDefault();
    return;
  }
  let sel = view.state.selection;
  if (!(sel instanceof _prosemirrorState.TextSelection) || !sel.$from.sameParent(sel.$to)) {
    let text = String.fromCharCode(event.charCode);
    let deflt = () => view.state.tr.insertText(text).scrollIntoView();
    if (!/[\r\n]/.test(text) && !view.someProp("handleTextInput", f => f(view, sel.$from.pos, sel.$to.pos, text, deflt))) view.dispatch(deflt());
    event.preventDefault();
  }
};
function eventCoords(event) {
  return {
    left: event.clientX,
    top: event.clientY
  };
}
function isNear(event, click) {
  let dx = click.x - event.clientX,
    dy = click.y - event.clientY;
  return dx * dx + dy * dy < 100;
}
function runHandlerOnContext(view, propName, pos, inside, event) {
  if (inside == -1) return false;
  let $pos = view.state.doc.resolve(inside);
  for (let i = $pos.depth + 1; i > 0; i--) {
    if (view.someProp(propName, f => i > $pos.depth ? f(view, pos, $pos.nodeAfter, $pos.before(i), event, true) : f(view, pos, $pos.node(i), $pos.before(i), event, false))) return true;
  }
  return false;
}
function updateSelection(view, selection, origin) {
  if (!view.focused) view.focus();
  if (view.state.selection.eq(selection)) return;
  let tr = view.state.tr.setSelection(selection);
  if (origin == "pointer") tr.setMeta("pointer", true);
  view.dispatch(tr);
}
function selectClickedLeaf(view, inside) {
  if (inside == -1) return false;
  let $pos = view.state.doc.resolve(inside),
    node = $pos.nodeAfter;
  if (node && node.isAtom && _prosemirrorState.NodeSelection.isSelectable(node)) {
    updateSelection(view, new _prosemirrorState.NodeSelection($pos), "pointer");
    return true;
  }
  return false;
}
function selectClickedNode(view, inside) {
  if (inside == -1) return false;
  let sel = view.state.selection,
    selectedNode,
    selectAt;
  if (sel instanceof _prosemirrorState.NodeSelection) selectedNode = sel.node;
  let $pos = view.state.doc.resolve(inside);
  for (let i = $pos.depth + 1; i > 0; i--) {
    let node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i);
    if (_prosemirrorState.NodeSelection.isSelectable(node)) {
      if (selectedNode && sel.$from.depth > 0 && i >= sel.$from.depth && $pos.before(sel.$from.depth + 1) == sel.$from.pos) selectAt = $pos.before(sel.$from.depth);else selectAt = $pos.before(i);
      break;
    }
  }
  if (selectAt != null) {
    updateSelection(view, _prosemirrorState.NodeSelection.create(view.state.doc, selectAt), "pointer");
    return true;
  } else {
    return false;
  }
}
function handleSingleClick(view, pos, inside, event, selectNode) {
  return runHandlerOnContext(view, "handleClickOn", pos, inside, event) || view.someProp("handleClick", f => f(view, pos, event)) || (selectNode ? selectClickedNode(view, inside) : selectClickedLeaf(view, inside));
}
function handleDoubleClick(view, pos, inside, event) {
  return runHandlerOnContext(view, "handleDoubleClickOn", pos, inside, event) || view.someProp("handleDoubleClick", f => f(view, pos, event));
}
function handleTripleClick(view, pos, inside, event) {
  return runHandlerOnContext(view, "handleTripleClickOn", pos, inside, event) || view.someProp("handleTripleClick", f => f(view, pos, event)) || defaultTripleClick(view, inside, event);
}
function defaultTripleClick(view, inside, event) {
  if (event.button != 0) return false;
  let doc = view.state.doc;
  if (inside == -1) {
    if (doc.inlineContent) {
      updateSelection(view, _prosemirrorState.TextSelection.create(doc, 0, doc.content.size), "pointer");
      return true;
    }
    return false;
  }
  let $pos = doc.resolve(inside);
  for (let i = $pos.depth + 1; i > 0; i--) {
    let node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i);
    let nodePos = $pos.before(i);
    if (node.inlineContent) updateSelection(view, _prosemirrorState.TextSelection.create(doc, nodePos + 1, nodePos + 1 + node.content.size), "pointer");else if (_prosemirrorState.NodeSelection.isSelectable(node)) updateSelection(view, _prosemirrorState.NodeSelection.create(doc, nodePos), "pointer");else continue;
    return true;
  }
}
function forceDOMFlush(view) {
  return endComposition(view);
}
const selectNodeModifier = browser.mac ? "metaKey" : "ctrlKey";
handlers.mousedown = (view, _event) => {
  let event = _event;
  view.input.shiftKey = event.shiftKey;
  let flushed = forceDOMFlush(view);
  let now = Date.now(),
    type = "singleClick";
  if (now - view.input.lastClick.time < 500 && isNear(event, view.input.lastClick) && !event[selectNodeModifier] && view.input.lastClick.button == event.button) {
    if (view.input.lastClick.type == "singleClick") type = "doubleClick";else if (view.input.lastClick.type == "doubleClick") type = "tripleClick";
  }
  view.input.lastClick = {
    time: now,
    x: event.clientX,
    y: event.clientY,
    type,
    button: event.button
  };
  let pos = view.posAtCoords(eventCoords(event));
  if (!pos) return;
  if (type == "singleClick") {
    if (view.input.mouseDown) view.input.mouseDown.done();
    view.input.mouseDown = new MouseDown(view, pos, event, !!flushed);
  } else if ((type == "doubleClick" ? handleDoubleClick : handleTripleClick)(view, pos.pos, pos.inside, event)) {
    event.preventDefault();
  } else {
    setSelectionOrigin(view, "pointer");
  }
};
class MouseDown {
  constructor(view, pos, event, flushed) {
    this.view = view;
    this.pos = pos;
    this.event = event;
    this.flushed = flushed;
    this.startDoc = void 0;
    this.selectNode = void 0;
    this.allowDefault = void 0;
    this.delayedSelectionSync = false;
    this.mightDrag = null;
    this.target = void 0;
    this.startDoc = view.state.doc;
    this.selectNode = !!event[selectNodeModifier];
    this.allowDefault = event.shiftKey;
    let targetNode, targetPos;
    if (pos.inside > -1) {
      targetNode = view.state.doc.nodeAt(pos.inside);
      targetPos = pos.inside;
    } else {
      let $pos = view.state.doc.resolve(pos.pos);
      targetNode = $pos.parent;
      targetPos = $pos.depth ? $pos.before() : 0;
    }
    const target = flushed ? null : event.target;
    const targetDesc = target ? view.docView.nearestDesc(target, true) : null;
    this.target = targetDesc && targetDesc.nodeDOM.nodeType == 1 ? targetDesc.nodeDOM : null;
    let {
      selection
    } = view.state;
    if (event.button == 0 && targetNode.type.spec.draggable && targetNode.type.spec.selectable !== false || selection instanceof _prosemirrorState.NodeSelection && selection.from <= targetPos && selection.to > targetPos) this.mightDrag = {
      node: targetNode,
      pos: targetPos,
      addAttr: !!(this.target && !this.target.draggable),
      setUneditable: !!(this.target && browser.gecko && !this.target.hasAttribute("contentEditable"))
    };
    if (this.target && this.mightDrag && (this.mightDrag.addAttr || this.mightDrag.setUneditable)) {
      this.view.domObserver.stop();
      if (this.mightDrag.addAttr) this.target.draggable = true;
      if (this.mightDrag.setUneditable) setTimeout(() => {
        if (this.view.input.mouseDown == this) this.target.setAttribute("contentEditable", "false");
      }, 20);
      this.view.domObserver.start();
    }
    view.root.addEventListener("mouseup", this.up = this.up.bind(this));
    view.root.addEventListener("mousemove", this.move = this.move.bind(this));
    setSelectionOrigin(view, "pointer");
  }
  done() {
    this.view.root.removeEventListener("mouseup", this.up);
    this.view.root.removeEventListener("mousemove", this.move);
    if (this.mightDrag && this.target) {
      this.view.domObserver.stop();
      if (this.mightDrag.addAttr) this.target.removeAttribute("draggable");
      if (this.mightDrag.setUneditable) this.target.removeAttribute("contentEditable");
      this.view.domObserver.start();
    }
    if (this.delayedSelectionSync) setTimeout(() => (0, _selection.selectionToDOM)(this.view));
    this.view.input.mouseDown = null;
  }
  up(event) {
    this.done();
    if (!this.view.dom.contains(event.target)) return;
    let pos = this.pos;
    if (this.view.state.doc != this.startDoc) pos = this.view.posAtCoords(eventCoords(event));
    this.updateAllowDefault(event);
    if (this.allowDefault || !pos) {
      setSelectionOrigin(this.view, "pointer");
    } else if (handleSingleClick(this.view, pos.pos, pos.inside, event, this.selectNode)) {
      event.preventDefault();
    } else if (event.button == 0 && (this.flushed ||
    // Safari ignores clicks on draggable elements
    browser.safari && this.mightDrag && !this.mightDrag.node.isAtom ||
    // Chrome will sometimes treat a node selection as a
    // cursor, but still report that the node is selected
    // when asked through getSelection. You'll then get a
    // situation where clicking at the point where that
    // (hidden) cursor is doesn't change the selection, and
    // thus doesn't get a reaction from ProseMirror. This
    // works around that.
    browser.chrome && !this.view.state.selection.visible && Math.min(Math.abs(pos.pos - this.view.state.selection.from), Math.abs(pos.pos - this.view.state.selection.to)) <= 2)) {
      updateSelection(this.view, _prosemirrorState.Selection.near(this.view.state.doc.resolve(pos.pos)), "pointer");
      event.preventDefault();
    } else {
      setSelectionOrigin(this.view, "pointer");
    }
  }
  move(event) {
    this.updateAllowDefault(event);
    setSelectionOrigin(this.view, "pointer");
    if (event.buttons == 0) this.done();
  }
  updateAllowDefault(event) {
    if (!this.allowDefault && (Math.abs(this.event.x - event.clientX) > 4 || Math.abs(this.event.y - event.clientY) > 4)) this.allowDefault = true;
  }
}
handlers.touchstart = view => {
  view.input.lastTouch = Date.now();
  forceDOMFlush(view);
  setSelectionOrigin(view, "pointer");
};
handlers.touchmove = view => {
  view.input.lastTouch = Date.now();
  setSelectionOrigin(view, "pointer");
};
handlers.contextmenu = view => forceDOMFlush(view);
function inOrNearComposition(view, event) {
  if (view.composing) return true;
  // See https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/.
  // On Japanese input method editors (IMEs), the Enter key is used to confirm character
  // selection. On Safari, when Enter is pressed, compositionend and keydown events are
  // emitted. The keydown event triggers newline insertion, which we don't want.
  // This method returns true if the keydown event should be ignored.
  // We only ignore it once, as pressing Enter a second time *should* insert a newline.
  // Furthermore, the keydown event timestamp must be close to the compositionEndedAt timestamp.
  // This guards against the case where compositionend is triggered without the keyboard
  // (e.g. character confirmation may be done with the mouse), and keydown is triggered
  // afterwards- we wouldn't want to ignore the keydown event in this case.
  if (browser.safari && Math.abs(event.timeStamp - view.input.compositionEndedAt) < 500) {
    view.input.compositionEndedAt = -2e8;
    return true;
  }
  return false;
}

// Drop active composition after 5 seconds of inactivity on Android
const timeoutComposition = browser.android ? 5000 : -1;
editHandlers.compositionstart = editHandlers.compositionupdate = view => {
  if (!view.composing) {
    view.domObserver.flush();
    let {
        state
      } = view,
      $pos = state.selection.$to;
    if (state.selection instanceof _prosemirrorState.TextSelection && (state.storedMarks || !$pos.textOffset && $pos.parentOffset && $pos.nodeBefore.marks.some(m => m.type.spec.inclusive === false) || browser.chrome && browser.windows && selectionBeforeUneditable(view))) {
      // Issue #1500
      // Need to wrap the cursor in mark nodes different from the ones in the DOM context
      view.markCursor = view.state.storedMarks || $pos.marks();
      endComposition(view, true);
      view.markCursor = null;
    } else {
      endComposition(view, !state.selection.empty);
      // In firefox, if the cursor is after but outside a marked node,
      // the inserted text won't inherit the marks. So this moves it
      // inside if necessary.
      if (browser.gecko && state.selection.empty && $pos.parentOffset && !$pos.textOffset && $pos.nodeBefore.marks.length) {
        let sel = view.domSelectionRange();
        for (let node = sel.focusNode, offset = sel.focusOffset; node && node.nodeType == 1 && offset != 0;) {
          let before = offset < 0 ? node.lastChild : node.childNodes[offset - 1];
          if (!before) break;
          if (before.nodeType == 3) {
            let sel = view.domSelection();
            if (sel) sel.collapse(before, before.nodeValue.length);
            break;
          } else {
            node = before;
            offset = -1;
          }
        }
      }
    }
    view.input.composing = true;
  }
  scheduleComposeEnd(view, timeoutComposition);
};
function selectionBeforeUneditable(view) {
  let {
    focusNode,
    focusOffset
  } = view.domSelectionRange();
  if (!focusNode || focusNode.nodeType != 1 || focusOffset >= focusNode.childNodes.length) return false;
  let next = focusNode.childNodes[focusOffset];
  return next.nodeType == 1 && next.contentEditable == "false";
}
editHandlers.compositionend = (view, event) => {
  if (view.composing) {
    view.input.composing = false;
    view.input.compositionEndedAt = event.timeStamp;
    view.input.compositionPendingChanges = view.domObserver.pendingRecords().length ? view.input.compositionID : 0;
    view.input.compositionNode = null;
    if (view.input.badSafariComposition) view.domObserver.forceFlush();else if (view.input.compositionPendingChanges) Promise.resolve().then(() => view.domObserver.flush());
    view.input.compositionID++;
    scheduleComposeEnd(view, 20);
  }
};
function scheduleComposeEnd(view, delay) {
  clearTimeout(view.input.composingTimeout);
  if (delay > -1) view.input.composingTimeout = setTimeout(() => endComposition(view), delay);
}
function clearComposition(view) {
  if (view.composing) {
    view.input.composing = false;
    view.input.compositionEndedAt = timestampFromCustomEvent();
  }
  while (view.input.compositionNodes.length > 0) view.input.compositionNodes.pop().markParentsDirty();
}
function findCompositionNode(view) {
  let sel = view.domSelectionRange();
  if (!sel.focusNode) return null;
  let textBefore = (0, _dom.textNodeBefore)(sel.focusNode, sel.focusOffset);
  let textAfter = (0, _dom.textNodeAfter)(sel.focusNode, sel.focusOffset);
  if (textBefore && textAfter && textBefore != textAfter) {
    let descAfter = textAfter.pmViewDesc,
      lastChanged = view.domObserver.lastChangedTextNode;
    if (textBefore == lastChanged || textAfter == lastChanged) return lastChanged;
    if (!descAfter || !descAfter.isText(textAfter.nodeValue)) {
      return textAfter;
    } else if (view.input.compositionNode == textAfter) {
      let descBefore = textBefore.pmViewDesc;
      if (!(!descBefore || !descBefore.isText(textBefore.nodeValue))) return textAfter;
    }
  }
  return textBefore || textAfter;
}
function timestampFromCustomEvent() {
  let event = document.createEvent("Event");
  event.initEvent("event", true, true);
  return event.timeStamp;
}

/// @internal
function endComposition(view, restarting = false) {
  if (browser.android && view.domObserver.flushingSoon >= 0) return;
  view.domObserver.forceFlush();
  clearComposition(view);
  if (restarting || view.docView && view.docView.dirty) {
    let sel = (0, _selection.selectionFromDOM)(view),
      cur = view.state.selection;
    if (sel && !sel.eq(cur)) view.dispatch(view.state.tr.setSelection(sel));else if ((view.markCursor || restarting) && !cur.$from.node(cur.$from.sharedDepth(cur.to)).inlineContent) view.dispatch(view.state.tr.deleteSelection());else view.updateState(view.state);
    return true;
  }
  return false;
}
function captureCopy(view, dom) {
  // The extra wrapper is somehow necessary on IE/Edge to prevent the
  // content from being mangled when it is put onto the clipboard
  if (!view.dom.parentNode) return;
  let wrap = view.dom.parentNode.appendChild(document.createElement("div"));
  wrap.appendChild(dom);
  wrap.style.cssText = "position: fixed; left: -10000px; top: 10px";
  let sel = getSelection(),
    range = document.createRange();
  range.selectNodeContents(dom);
  // Done because IE will fire a selectionchange moving the selection
  // to its start when removeAllRanges is called and the editor still
  // has focus (which will mess up the editor's selection state).
  view.dom.blur();
  sel.removeAllRanges();
  sel.addRange(range);
  setTimeout(() => {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    view.focus();
  }, 50);
}

// This is very crude, but unfortunately both these browsers _pretend_
// that they have a clipboard API—all the objects and methods are
// there, they just don't work, and they are hard to test.
const brokenClipboardAPI = browser.ie && browser.ie_version < 15 || browser.ios && browser.webkit_version < 604;
handlers.copy = editHandlers.cut = (view, _event) => {
  let event = _event;
  let sel = view.state.selection,
    cut = event.type == "cut";
  if (sel.empty) return;

  // IE and Edge's clipboard interface is completely broken
  let data = brokenClipboardAPI ? null : event.clipboardData;
  let slice = sel.content(),
    {
      dom,
      text
    } = (0, _clipboard.serializeForClipboard)(view, slice);
  if (data) {
    event.preventDefault();
    data.clearData();
    data.setData("text/html", dom.innerHTML);
    data.setData("text/plain", text);
  } else {
    captureCopy(view, dom);
  }
  if (cut) view.dispatch(view.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
};
function sliceSingleNode(slice) {
  return slice.openStart == 0 && slice.openEnd == 0 && slice.content.childCount == 1 ? slice.content.firstChild : null;
}
function capturePaste(view, event) {
  if (!view.dom.parentNode) return;
  let plainText = view.input.shiftKey || view.state.selection.$from.parent.type.spec.code;
  let target = view.dom.parentNode.appendChild(document.createElement(plainText ? "textarea" : "div"));
  if (!plainText) target.contentEditable = "true";
  target.style.cssText = "position: fixed; left: -10000px; top: 10px";
  target.focus();
  let plain = view.input.shiftKey && view.input.lastKeyCode != 45;
  setTimeout(() => {
    view.focus();
    if (target.parentNode) target.parentNode.removeChild(target);
    if (plainText) doPaste(view, target.value, null, plain, event);else doPaste(view, target.textContent, target.innerHTML, plain, event);
  }, 50);
}
function doPaste(view, text, html, preferPlain, event) {
  let slice = (0, _clipboard.parseFromClipboard)(view, text, html, preferPlain, view.state.selection.$from);
  if (view.someProp("handlePaste", f => f(view, event, slice || _prosemirrorModel.Slice.empty))) return true;
  if (!slice) return false;
  let singleNode = sliceSingleNode(slice);
  let tr = singleNode ? view.state.tr.replaceSelectionWith(singleNode, preferPlain) : view.state.tr.replaceSelection(slice);
  view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
  return true;
}
function getText(clipboardData) {
  let text = clipboardData.getData("text/plain") || clipboardData.getData("Text");
  if (text) return text;
  let uris = clipboardData.getData("text/uri-list");
  return uris ? uris.replace(/\r?\n/g, " ") : "";
}
editHandlers.paste = (view, _event) => {
  let event = _event;
  // Handling paste from JavaScript during composition is very poorly
  // handled by browsers, so as a dodgy but preferable kludge, we just
  // let the browser do its native thing there, except on Android,
  // where the editor is almost always composing.
  if (view.composing && !browser.android) return;
  let data = brokenClipboardAPI ? null : event.clipboardData;
  let plain = view.input.shiftKey && view.input.lastKeyCode != 45;
  if (data && doPaste(view, getText(data), data.getData("text/html"), plain, event)) event.preventDefault();else capturePaste(view, event);
};
class Dragging {
  constructor(slice, move, node) {
    this.slice = slice;
    this.move = move;
    this.node = node;
  }
}
exports.Dragging = Dragging;
const dragCopyModifier = browser.mac ? "altKey" : "ctrlKey";
function dragMoves(view, event) {
  let moves = view.someProp("dragCopies", test => !test(event));
  return moves != null ? moves : !event[dragCopyModifier];
}
handlers.dragstart = (view, _event) => {
  let event = _event;
  let mouseDown = view.input.mouseDown;
  if (mouseDown) mouseDown.done();
  if (!event.dataTransfer) return;
  let sel = view.state.selection;
  let pos = sel.empty ? null : view.posAtCoords(eventCoords(event));
  let node;
  if (pos && pos.pos >= sel.from && pos.pos <= (sel instanceof _prosemirrorState.NodeSelection ? sel.to - 1 : sel.to)) {
    // In selection
  } else if (mouseDown && mouseDown.mightDrag) {
    node = _prosemirrorState.NodeSelection.create(view.state.doc, mouseDown.mightDrag.pos);
  } else if (event.target && event.target.nodeType == 1) {
    let desc = view.docView.nearestDesc(event.target, true);
    if (desc && desc.node.type.spec.draggable && desc != view.docView) node = _prosemirrorState.NodeSelection.create(view.state.doc, desc.posBefore);
  }
  let draggedSlice = (node || view.state.selection).content();
  let {
    dom,
    text,
    slice
  } = (0, _clipboard.serializeForClipboard)(view, draggedSlice);
  // Pre-120 Chrome versions clear files when calling `clearData` (#1472)
  if (!event.dataTransfer.files.length || !browser.chrome || browser.chrome_version > 120) event.dataTransfer.clearData();
  event.dataTransfer.setData(brokenClipboardAPI ? "Text" : "text/html", dom.innerHTML);
  // See https://github.com/ProseMirror/prosemirror/issues/1156
  event.dataTransfer.effectAllowed = "copyMove";
  if (!brokenClipboardAPI) event.dataTransfer.setData("text/plain", text);
  view.dragging = new Dragging(slice, dragMoves(view, event), node);
};
handlers.dragend = view => {
  let dragging = view.dragging;
  window.setTimeout(() => {
    if (view.dragging == dragging) view.dragging = null;
  }, 50);
};
editHandlers.dragover = editHandlers.dragenter = (_, e) => e.preventDefault();
editHandlers.drop = (view, event) => {
  try {
    handleDrop(view, event, view.dragging);
  } finally {
    view.dragging = null;
  }
};
function handleDrop(view, event, dragging) {
  if (!event.dataTransfer) return;
  let eventPos = view.posAtCoords(eventCoords(event));
  if (!eventPos) return;
  let $mouse = view.state.doc.resolve(eventPos.pos);
  let slice = dragging && dragging.slice;
  if (slice) {
    view.someProp("transformPasted", f => {
      slice = f(slice, view, false);
    });
  } else {
    slice = (0, _clipboard.parseFromClipboard)(view, getText(event.dataTransfer), brokenClipboardAPI ? null : event.dataTransfer.getData("text/html"), false, $mouse);
  }
  let move = !!(dragging && dragMoves(view, event));
  if (view.someProp("handleDrop", f => f(view, event, slice || _prosemirrorModel.Slice.empty, move))) {
    event.preventDefault();
    return;
  }
  if (!slice) return;
  event.preventDefault();
  let insertPos = slice ? (0, _prosemirrorTransform.dropPoint)(view.state.doc, $mouse.pos, slice) : $mouse.pos;
  if (insertPos == null) insertPos = $mouse.pos;
  let tr = view.state.tr;
  if (move) {
    let {
      node
    } = dragging;
    if (node) node.replace(tr);else tr.deleteSelection();
  }
  let pos = tr.mapping.map(insertPos);
  let isNode = slice.openStart == 0 && slice.openEnd == 0 && slice.content.childCount == 1;
  let beforeInsert = tr.doc;
  if (isNode) tr.replaceRangeWith(pos, pos, slice.content.firstChild);else tr.replaceRange(pos, pos, slice);
  if (tr.doc.eq(beforeInsert)) return;
  let $pos = tr.doc.resolve(pos);
  if (isNode && _prosemirrorState.NodeSelection.isSelectable(slice.content.firstChild) && $pos.nodeAfter && $pos.nodeAfter.sameMarkup(slice.content.firstChild)) {
    tr.setSelection(new _prosemirrorState.NodeSelection($pos));
  } else {
    let end = tr.mapping.map(insertPos);
    tr.mapping.maps[tr.mapping.maps.length - 1].forEach((_from, _to, _newFrom, newTo) => end = newTo);
    tr.setSelection((0, _selection.selectionBetween)(view, $pos, tr.doc.resolve(end)));
  }
  view.focus();
  view.dispatch(tr.setMeta("uiEvent", "drop"));
}
handlers.focus = view => {
  view.input.lastFocus = Date.now();
  if (!view.focused) {
    view.domObserver.stop();
    view.dom.classList.add("ProseMirror-focused");
    view.domObserver.start();
    view.focused = true;
    setTimeout(() => {
      if (view.docView && view.hasFocus() && !view.domObserver.currentSelection.eq(view.domSelectionRange())) (0, _selection.selectionToDOM)(view);
    }, 20);
  }
};
handlers.blur = (view, _event) => {
  let event = _event;
  if (view.focused) {
    view.domObserver.stop();
    view.dom.classList.remove("ProseMirror-focused");
    view.domObserver.start();
    if (event.relatedTarget && view.dom.contains(event.relatedTarget)) view.domObserver.currentSelection.clear();
    view.focused = false;
  }
};
handlers.beforeinput = (view, _event) => {
  let event = _event;
  // We should probably do more with beforeinput events, but support
  // is so spotty that I'm still waiting to see where they are going.

  // Very specific hack to deal with backspace sometimes failing on
  // Chrome Android when after an uneditable node.
  if (browser.chrome && browser.android && event.inputType == "deleteContentBackward") {
    view.domObserver.flushSoon();
    let {
      domChangeCount
    } = view.input;
    setTimeout(() => {
      if (view.input.domChangeCount != domChangeCount) return; // Event already had some effect
      // This bug tends to close the virtual keyboard, so we refocus
      view.dom.blur();
      view.focus();
      if (view.someProp("handleKeyDown", f => f(view, (0, _dom.keyEvent)(8, "Backspace")))) return;
      let {
        $cursor
      } = view.state.selection;
      // Crude approximation of backspace behavior when no command handled it
      if ($cursor && $cursor.pos > 0) view.dispatch(view.state.tr.delete($cursor.pos - 1, $cursor.pos).scrollIntoView());
    }, 50);
  }
};

// Make sure all handlers get registered
for (let prop in editHandlers) handlers[prop] = editHandlers[prop];
},
"prosemirror-view/src/selection.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.anchorInRightPlace = anchorInRightPlace;
exports.hasFocusAndSelection = hasFocusAndSelection;
exports.hasSelection = hasSelection;
exports.selectionBetween = selectionBetween;
exports.selectionFromDOM = selectionFromDOM;
exports.selectionToDOM = selectionToDOM;
exports.syncNodeSelection = syncNodeSelection;
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
var _dom = __require("prosemirror-view/src/dom.ts");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function selectionFromDOM(view, origin = null) {
  let domSel = view.domSelectionRange(),
    doc = view.state.doc;
  if (!domSel.focusNode) return null;
  let nearestDesc = view.docView.nearestDesc(domSel.focusNode),
    inWidget = nearestDesc && nearestDesc.size == 0;
  let head = view.docView.posFromDOM(domSel.focusNode, domSel.focusOffset, 1);
  if (head < 0) return null;
  let $head = doc.resolve(head),
    anchor,
    selection;
  if ((0, _dom.selectionCollapsed)(domSel)) {
    anchor = head;
    while (nearestDesc && !nearestDesc.node) nearestDesc = nearestDesc.parent;
    let nearestDescNode = nearestDesc.node;
    if (nearestDesc && nearestDescNode.isAtom && _prosemirrorState.NodeSelection.isSelectable(nearestDescNode) && nearestDesc.parent && !(nearestDescNode.isInline && (0, _dom.isOnEdge)(domSel.focusNode, domSel.focusOffset, nearestDesc.dom))) {
      let pos = nearestDesc.posBefore;
      selection = new _prosemirrorState.NodeSelection(head == pos ? $head : doc.resolve(pos));
    }
  } else {
    if (domSel instanceof view.dom.ownerDocument.defaultView.Selection && domSel.rangeCount > 1) {
      let min = head,
        max = head;
      for (let i = 0; i < domSel.rangeCount; i++) {
        let range = domSel.getRangeAt(i);
        min = Math.min(min, view.docView.posFromDOM(range.startContainer, range.startOffset, 1));
        max = Math.max(max, view.docView.posFromDOM(range.endContainer, range.endOffset, -1));
      }
      if (min < 0) return null;
      [anchor, head] = max == view.state.selection.anchor ? [max, min] : [min, max];
      $head = doc.resolve(head);
    } else {
      anchor = view.docView.posFromDOM(domSel.anchorNode, domSel.anchorOffset, 1);
    }
    if (anchor < 0) return null;
  }
  let $anchor = doc.resolve(anchor);
  if (!selection) {
    let bias = origin == "pointer" || view.state.selection.head < $head.pos && !inWidget ? 1 : -1;
    selection = selectionBetween(view, $anchor, $head, bias);
  }
  return selection;
}
function editorOwnsSelection(view) {
  return view.editable ? view.hasFocus() : hasSelection(view) && document.activeElement && document.activeElement.contains(view.dom);
}
function selectionToDOM(view, force = false) {
  let sel = view.state.selection;
  syncNodeSelection(view, sel);
  if (!editorOwnsSelection(view)) return;

  // The delayed drag selection causes issues with Cell Selections
  // in Safari. And the drag selection delay is to workarond issues
  // which only present in Chrome.
  if (!force && view.input.mouseDown && view.input.mouseDown.allowDefault && browser.chrome) {
    let domSel = view.domSelectionRange(),
      curSel = view.domObserver.currentSelection;
    if (domSel.anchorNode && curSel.anchorNode && (0, _dom.isEquivalentPosition)(domSel.anchorNode, domSel.anchorOffset, curSel.anchorNode, curSel.anchorOffset)) {
      view.input.mouseDown.delayedSelectionSync = true;
      view.domObserver.setCurSelection();
      return;
    }
  }
  view.domObserver.disconnectSelection();
  if (view.cursorWrapper) {
    selectCursorWrapper(view);
  } else {
    let {
        anchor,
        head
      } = sel,
      resetEditableFrom,
      resetEditableTo;
    if (brokenSelectBetweenUneditable && !(sel instanceof _prosemirrorState.TextSelection)) {
      if (!sel.$from.parent.inlineContent) resetEditableFrom = temporarilyEditableNear(view, sel.from);
      if (!sel.empty && !sel.$from.parent.inlineContent) resetEditableTo = temporarilyEditableNear(view, sel.to);
    }
    view.docView.setSelection(anchor, head, view, force);
    if (brokenSelectBetweenUneditable) {
      if (resetEditableFrom) resetEditable(resetEditableFrom);
      if (resetEditableTo) resetEditable(resetEditableTo);
    }
    if (sel.visible) {
      view.dom.classList.remove("ProseMirror-hideselection");
    } else {
      view.dom.classList.add("ProseMirror-hideselection");
      if ("onselectionchange" in document) removeClassOnSelectionChange(view);
    }
  }
  view.domObserver.setCurSelection();
  view.domObserver.connectSelection();
}

// Kludge to work around Webkit not allowing a selection to start/end
// between non-editable block nodes. We briefly make something
// editable, set the selection, then set it uneditable again.

const brokenSelectBetweenUneditable = browser.safari || browser.chrome && browser.chrome_version < 63;
function temporarilyEditableNear(view, pos) {
  let {
    node,
    offset
  } = view.docView.domFromPos(pos, 0);
  let after = offset < node.childNodes.length ? node.childNodes[offset] : null;
  let before = offset ? node.childNodes[offset - 1] : null;
  if (browser.safari && after && after.contentEditable == "false") return setEditable(after);
  if ((!after || after.contentEditable == "false") && (!before || before.contentEditable == "false")) {
    if (after) return setEditable(after);else if (before) return setEditable(before);
  }
}
function setEditable(element) {
  element.contentEditable = "true";
  if (browser.safari && element.draggable) {
    element.draggable = false;
    element.wasDraggable = true;
  }
  return element;
}
function resetEditable(element) {
  element.contentEditable = "false";
  if (element.wasDraggable) {
    element.draggable = true;
    element.wasDraggable = null;
  }
}
function removeClassOnSelectionChange(view) {
  let doc = view.dom.ownerDocument;
  doc.removeEventListener("selectionchange", view.input.hideSelectionGuard);
  let domSel = view.domSelectionRange();
  let node = domSel.anchorNode,
    offset = domSel.anchorOffset;
  doc.addEventListener("selectionchange", view.input.hideSelectionGuard = () => {
    if (domSel.anchorNode != node || domSel.anchorOffset != offset) {
      doc.removeEventListener("selectionchange", view.input.hideSelectionGuard);
      setTimeout(() => {
        if (!editorOwnsSelection(view) || view.state.selection.visible) view.dom.classList.remove("ProseMirror-hideselection");
      }, 20);
    }
  });
}
function selectCursorWrapper(view) {
  let domSel = view.domSelection();
  if (!domSel) return;
  let node = view.cursorWrapper.dom,
    img = node.nodeName == "IMG";
  if (img) domSel.collapse(node.parentNode, (0, _dom.domIndex)(node) + 1);else domSel.collapse(node, 0);
  // Kludge to kill 'control selection' in IE11 when selecting an
  // invisible cursor wrapper, since that would result in those weird
  // resize handles and a selection that considers the absolutely
  // positioned wrapper, rather than the root editable node, the
  // focused element.
  if (!img && !view.state.selection.visible && browser.ie && browser.ie_version <= 11) {
    ;
    node.disabled = true;
    node.disabled = false;
  }
}
function syncNodeSelection(view, sel) {
  if (sel instanceof _prosemirrorState.NodeSelection) {
    let desc = view.docView.descAt(sel.from);
    if (desc != view.lastSelectedViewDesc) {
      clearNodeSelection(view);
      if (desc) desc.selectNode();
      view.lastSelectedViewDesc = desc;
    }
  } else {
    clearNodeSelection(view);
  }
}

// Clear all DOM statefulness of the last node selection.
function clearNodeSelection(view) {
  if (view.lastSelectedViewDesc) {
    if (view.lastSelectedViewDesc.parent) view.lastSelectedViewDesc.deselectNode();
    view.lastSelectedViewDesc = undefined;
  }
}
function selectionBetween(view, $anchor, $head, bias) {
  return view.someProp("createSelectionBetween", f => f(view, $anchor, $head)) || _prosemirrorState.TextSelection.between($anchor, $head, bias);
}
function hasFocusAndSelection(view) {
  if (view.editable && !view.hasFocus()) return false;
  return hasSelection(view);
}
function hasSelection(view) {
  let sel = view.domSelectionRange();
  if (!sel.anchorNode) return false;
  try {
    // Firefox will raise 'permission denied' errors when accessing
    // properties of `sel.anchorNode` when it's in a generated CSS
    // element.
    return view.dom.contains(sel.anchorNode.nodeType == 3 ? sel.anchorNode.parentNode : sel.anchorNode) && (view.editable || view.dom.contains(sel.focusNode.nodeType == 3 ? sel.focusNode.parentNode : sel.focusNode));
  } catch (_) {
    return false;
  }
}
function anchorInRightPlace(view) {
  let anchorDOM = view.docView.domFromPos(view.state.selection.anchor, 0);
  let domSel = view.domSelectionRange();
  return (0, _dom.isEquivalentPosition)(anchorDOM.node, anchorDOM.offset, domSel.anchorNode, domSel.anchorOffset);
}
},
"prosemirror-view/src/viewdesc.ts":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ViewDesc = exports.NodeViewDesc = void 0;
exports.docViewDesc = docViewDesc;
var _prosemirrorModel = __require("prosemirror-model/src/index.ts");
var _prosemirrorState = __require("prosemirror-state/src/index.ts");
var _dom = __require("prosemirror-view/src/dom.ts");
var browser = _interopRequireWildcard(__require("prosemirror-view/src/browser.ts"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
/// A ViewMutationRecord represents a DOM
/// [mutation](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
/// or a selection change happens within the view. When the change is
/// a selection change, the record will have a `type` property of
/// `"selection"` (which doesn't occur for native mutation records).

/// By default, document nodes are rendered using the result of the
/// [`toDOM`](#model.NodeSpec.toDOM) method of their spec, and managed
/// entirely by the editor. For some use cases, such as embedded
/// node-specific editing interfaces, you want more control over
/// the behavior of a node's in-editor representation, and need to
/// [define](#view.EditorProps.nodeViews) a custom node view.
///
/// Objects returned as node views must conform to this interface.

/// By default, document marks are rendered using the result of the
/// [`toDOM`](#model.MarkSpec.toDOM) method of their spec, and managed entirely
/// by the editor. For some use cases, you want more control over the behavior
/// of a mark's in-editor representation, and need to
/// [define](#view.EditorProps.markViews) a custom mark view.
///
/// Objects returned as mark views must conform to this interface.

// View descriptions are data structures that describe the DOM that is
// used to represent the editor's content. They are used for:
//
// - Incremental redrawing when the document changes
//
// - Figuring out what part of the document a given DOM position
//   corresponds to
//
// - Wiring in custom implementations of the editing interface for a
//   given node
//
// They form a doubly-linked mutable tree, starting at `view.docView`.

const NOT_DIRTY = 0,
  CHILD_DIRTY = 1,
  CONTENT_DIRTY = 2,
  NODE_DIRTY = 3;

// Superclass for the various kinds of descriptions. Defines their
// basic structure and shared methods.
class ViewDesc {
  constructor(parent, children, dom,
  // This is the node that holds the child views. It may be null for
  // descs that don't have children.
  contentDOM) {
    this.parent = parent;
    this.children = children;
    this.dom = dom;
    this.contentDOM = contentDOM;
    this.dirty = NOT_DIRTY;
    // An expando property on the DOM node provides a link back to its
    // description.
    dom.pmViewDesc = this;
  }

  // Used to check whether a given description corresponds to a
  // widget/mark/node.
  matchesWidget(widget) {
    return false;
  }
  matchesMark(mark) {
    return false;
  }
  matchesNode(node, outerDeco, innerDeco) {
    return false;
  }
  matchesHack(nodeName) {
    return false;
  }

  // When parsing in-editor content (in domchange.js), we allow
  // descriptions to determine the parse rules that should be used to
  // parse them.
  parseRule() {
    return null;
  }

  // Used by the editor's event handler to ignore events that come
  // from certain descs.
  stopEvent(event) {
    return false;
  }

  // The size of the content represented by this desc.
  get size() {
    let size = 0;
    for (let i = 0; i < this.children.length; i++) size += this.children[i].size;
    return size;
  }

  // For block nodes, this represents the space taken up by their
  // start/end tokens.
  get border() {
    return 0;
  }
  destroy() {
    this.parent = undefined;
    if (this.dom.pmViewDesc == this) this.dom.pmViewDesc = undefined;
    for (let i = 0; i < this.children.length; i++) this.children[i].destroy();
  }
  posBeforeChild(child) {
    for (let i = 0, pos = this.posAtStart;; i++) {
      let cur = this.children[i];
      if (cur == child) return pos;
      pos += cur.size;
    }
  }
  get posBefore() {
    return this.parent.posBeforeChild(this);
  }
  get posAtStart() {
    return this.parent ? this.parent.posBeforeChild(this) + this.border : 0;
  }
  get posAfter() {
    return this.posBefore + this.size;
  }
  get posAtEnd() {
    return this.posAtStart + this.size - 2 * this.border;
  }
  localPosFromDOM(dom, offset, bias) {
    // If the DOM position is in the content, use the child desc after
    // it to figure out a position.
    if (this.contentDOM && this.contentDOM.contains(dom.nodeType == 1 ? dom : dom.parentNode)) {
      if (bias < 0) {
        let domBefore, desc;
        if (dom == this.contentDOM) {
          domBefore = dom.childNodes[offset - 1];
        } else {
          while (dom.parentNode != this.contentDOM) dom = dom.parentNode;
          domBefore = dom.previousSibling;
        }
        while (domBefore && !((desc = domBefore.pmViewDesc) && desc.parent == this)) domBefore = domBefore.previousSibling;
        return domBefore ? this.posBeforeChild(desc) + desc.size : this.posAtStart;
      } else {
        let domAfter, desc;
        if (dom == this.contentDOM) {
          domAfter = dom.childNodes[offset];
        } else {
          while (dom.parentNode != this.contentDOM) dom = dom.parentNode;
          domAfter = dom.nextSibling;
        }
        while (domAfter && !((desc = domAfter.pmViewDesc) && desc.parent == this)) domAfter = domAfter.nextSibling;
        return domAfter ? this.posBeforeChild(desc) : this.posAtEnd;
      }
    }
    // Otherwise, use various heuristics, falling back on the bias
    // parameter, to determine whether to return the position at the
    // start or at the end of this view desc.
    let atEnd;
    if (dom == this.dom && this.contentDOM) {
      atEnd = offset > (0, _dom.domIndex)(this.contentDOM);
    } else if (this.contentDOM && this.contentDOM != this.dom && this.dom.contains(this.contentDOM)) {
      atEnd = dom.compareDocumentPosition(this.contentDOM) & 2;
    } else if (this.dom.firstChild) {
      if (offset == 0) for (let search = dom;; search = search.parentNode) {
        if (search == this.dom) {
          atEnd = false;
          break;
        }
        if (search.previousSibling) break;
      }
      if (atEnd == null && offset == dom.childNodes.length) for (let search = dom;; search = search.parentNode) {
        if (search == this.dom) {
          atEnd = true;
          break;
        }
        if (search.nextSibling) break;
      }
    }
    return (atEnd == null ? bias > 0 : atEnd) ? this.posAtEnd : this.posAtStart;
  }

  // Scan up the dom finding the first desc that is a descendant of
  // this one.

  nearestDesc(dom, onlyNodes = false) {
    for (let first = true, cur = dom; cur; cur = cur.parentNode) {
      let desc = this.getDesc(cur),
        nodeDOM;
      if (desc && (!onlyNodes || desc.node)) {
        // If dom is outside of this desc's nodeDOM, don't count it.
        if (first && (nodeDOM = desc.nodeDOM) && !(nodeDOM.nodeType == 1 ? nodeDOM.contains(dom.nodeType == 1 ? dom : dom.parentNode) : nodeDOM == dom)) first = false;else return desc;
      }
    }
  }
  getDesc(dom) {
    let desc = dom.pmViewDesc;
    for (let cur = desc; cur; cur = cur.parent) if (cur == this) return desc;
  }
  posFromDOM(dom, offset, bias) {
    for (let scan = dom; scan; scan = scan.parentNode) {
      let desc = this.getDesc(scan);
      if (desc) return desc.localPosFromDOM(dom, offset, bias);
    }
    return -1;
  }

  // Find the desc for the node after the given pos, if any. (When a
  // parent node overrode rendering, there might not be one.)
  descAt(pos) {
    for (let i = 0, offset = 0; i < this.children.length; i++) {
      let child = this.children[i],
        end = offset + child.size;
      if (offset == pos && end != offset) {
        while (!child.border && child.children.length) {
          for (let i = 0; i < child.children.length; i++) {
            let inner = child.children[i];
            if (inner.size) {
              child = inner;
              break;
            }
          }
        }
        return child;
      }
      if (pos < end) return child.descAt(pos - offset - child.border);
      offset = end;
    }
  }
  domFromPos(pos, side) {
    if (!this.contentDOM) return {
      node: this.dom,
      offset: 0,
      atom: pos + 1
    };
    // First find the position in the child array
    let i = 0,
      offset = 0;
    for (let curPos = 0; i < this.children.length; i++) {
      let child = this.children[i],
        end = curPos + child.size;
      if (end > pos || child instanceof TrailingHackViewDesc) {
        offset = pos - curPos;
        break;
      }
      curPos = end;
    }
    // If this points into the middle of a child, call through
    if (offset) return this.children[i].domFromPos(offset - this.children[i].border, side);
    // Go back if there were any zero-length widgets with side >= 0 before this point
    for (let prev; i && !(prev = this.children[i - 1]).size && prev instanceof WidgetViewDesc && prev.side >= 0; i--) {}
    // Scan towards the first useable node
    if (side <= 0) {
      let prev,
        enter = true;
      for (;; i--, enter = false) {
        prev = i ? this.children[i - 1] : null;
        if (!prev || prev.dom.parentNode == this.contentDOM) break;
      }
      if (prev && side && enter && !prev.border && !prev.domAtom) return prev.domFromPos(prev.size, side);
      return {
        node: this.contentDOM,
        offset: prev ? (0, _dom.domIndex)(prev.dom) + 1 : 0
      };
    } else {
      let next,
        enter = true;
      for (;; i++, enter = false) {
        next = i < this.children.length ? this.children[i] : null;
        if (!next || next.dom.parentNode == this.contentDOM) break;
      }
      if (next && enter && !next.border && !next.domAtom) return next.domFromPos(0, side);
      return {
        node: this.contentDOM,
        offset: next ? (0, _dom.domIndex)(next.dom) : this.contentDOM.childNodes.length
      };
    }
  }

  // Used to find a DOM range in a single parent for a given changed
  // range.
  parseRange(from, to, base = 0) {
    if (this.children.length == 0) return {
      node: this.contentDOM,
      from,
      to,
      fromOffset: 0,
      toOffset: this.contentDOM.childNodes.length
    };
    let fromOffset = -1,
      toOffset = -1;
    for (let offset = base, i = 0;; i++) {
      let child = this.children[i],
        end = offset + child.size;
      if (fromOffset == -1 && from <= end) {
        let childBase = offset + child.border;
        // FIXME maybe descend mark views to parse a narrower range?
        if (from >= childBase && to <= end - child.border && child.node && child.contentDOM && this.contentDOM.contains(child.contentDOM)) return child.parseRange(from, to, childBase);
        from = offset;
        for (let j = i; j > 0; j--) {
          let prev = this.children[j - 1];
          if (prev.size && prev.dom.parentNode == this.contentDOM && !prev.emptyChildAt(1)) {
            fromOffset = (0, _dom.domIndex)(prev.dom) + 1;
            break;
          }
          from -= prev.size;
        }
        if (fromOffset == -1) fromOffset = 0;
      }
      if (fromOffset > -1 && (end > to || i == this.children.length - 1)) {
        to = end;
        for (let j = i + 1; j < this.children.length; j++) {
          let next = this.children[j];
          if (next.size && next.dom.parentNode == this.contentDOM && !next.emptyChildAt(-1)) {
            toOffset = (0, _dom.domIndex)(next.dom);
            break;
          }
          to += next.size;
        }
        if (toOffset == -1) toOffset = this.contentDOM.childNodes.length;
        break;
      }
      offset = end;
    }
    return {
      node: this.contentDOM,
      from,
      to,
      fromOffset,
      toOffset
    };
  }
  emptyChildAt(side) {
    if (this.border || !this.contentDOM || !this.children.length) return false;
    let child = this.children[side < 0 ? 0 : this.children.length - 1];
    return child.size == 0 || child.emptyChildAt(side);
  }
  domAfterPos(pos) {
    let {
      node,
      offset
    } = this.domFromPos(pos, 0);
    if (node.nodeType != 1 || offset == node.childNodes.length) throw new RangeError("No node after pos " + pos);
    return node.childNodes[offset];
  }

  // View descs are responsible for setting any selection that falls
  // entirely inside of them, so that custom implementations can do
  // custom things with the selection. Note that this falls apart when
  // a selection starts in such a node and ends in another, in which
  // case we just use whatever domFromPos produces as a best effort.
  setSelection(anchor, head, view, force = false) {
    // If the selection falls entirely in a child, give it to that child
    let from = Math.min(anchor, head),
      to = Math.max(anchor, head);
    for (let i = 0, offset = 0; i < this.children.length; i++) {
      let child = this.children[i],
        end = offset + child.size;
      if (from > offset && to < end) return child.setSelection(anchor - offset - child.border, head - offset - child.border, view, force);
      offset = end;
    }
    let anchorDOM = this.domFromPos(anchor, anchor ? -1 : 1);
    let headDOM = head == anchor ? anchorDOM : this.domFromPos(head, head ? -1 : 1);
    let domSel = view.root.getSelection();
    let selRange = view.domSelectionRange();
    let brKludge = false;
    // On Firefox, using Selection.collapse to put the cursor after a
    // BR node for some reason doesn't always work (#1073). On Safari,
    // the cursor sometimes inexplicable visually lags behind its
    // reported position in such situations (#1092).
    if ((browser.gecko || browser.safari) && anchor == head) {
      let {
        node,
        offset
      } = anchorDOM;
      if (node.nodeType == 3) {
        brKludge = !!(offset && node.nodeValue[offset - 1] == "\n");
        // Issue #1128
        if (brKludge && offset == node.nodeValue.length) {
          for (let scan = node, after; scan; scan = scan.parentNode) {
            if (after = scan.nextSibling) {
              if (after.nodeName == "BR") anchorDOM = headDOM = {
                node: after.parentNode,
                offset: (0, _dom.domIndex)(after) + 1
              };
              break;
            }
            let desc = scan.pmViewDesc;
            if (desc && desc.node && desc.node.isBlock) break;
          }
        }
      } else {
        let prev = node.childNodes[offset - 1];
        brKludge = prev && (prev.nodeName == "BR" || prev.contentEditable == "false");
      }
    }
    // Firefox can act strangely when the selection is in front of an
    // uneditable node. See #1163 and https://bugzilla.mozilla.org/show_bug.cgi?id=1709536
    if (browser.gecko && selRange.focusNode && selRange.focusNode != headDOM.node && selRange.focusNode.nodeType == 1) {
      let after = selRange.focusNode.childNodes[selRange.focusOffset];
      if (after && after.contentEditable == "false") force = true;
    }
    if (!(force || brKludge && browser.safari) && (0, _dom.isEquivalentPosition)(anchorDOM.node, anchorDOM.offset, selRange.anchorNode, selRange.anchorOffset) && (0, _dom.isEquivalentPosition)(headDOM.node, headDOM.offset, selRange.focusNode, selRange.focusOffset)) return;

    // Selection.extend can be used to create an 'inverted' selection
    // (one where the focus is before the anchor), but not all
    // browsers support it yet.
    let domSelExtended = false;
    if ((domSel.extend || anchor == head) && !(brKludge && browser.gecko)) {
      domSel.collapse(anchorDOM.node, anchorDOM.offset);
      try {
        if (anchor != head) domSel.extend(headDOM.node, headDOM.offset);
        domSelExtended = true;
      } catch (_) {
        // In some cases with Chrome the selection is empty after calling
        // collapse, even when it should be valid. This appears to be a bug, but
        // it is difficult to isolate. If this happens fallback to the old path
        // without using extend.
        // Similarly, this could crash on Safari if the editor is hidden, and
        // there was no selection.
      }
    }
    if (!domSelExtended) {
      if (anchor > head) {
        let tmp = anchorDOM;
        anchorDOM = headDOM;
        headDOM = tmp;
      }
      let range = document.createRange();
      range.setEnd(headDOM.node, headDOM.offset);
      range.setStart(anchorDOM.node, anchorDOM.offset);
      domSel.removeAllRanges();
      domSel.addRange(range);
    }
  }
  ignoreMutation(mutation) {
    return !this.contentDOM && mutation.type != "selection";
  }
  get contentLost() {
    return this.contentDOM && this.contentDOM != this.dom && !this.dom.contains(this.contentDOM);
  }

  // Remove a subtree of the element tree that has been touched
  // by a DOM change, so that the next update will redraw it.
  markDirty(from, to) {
    for (let offset = 0, i = 0; i < this.children.length; i++) {
      let child = this.children[i],
        end = offset + child.size;
      if (offset == end ? from <= end && to >= offset : from < end && to > offset) {
        let startInside = offset + child.border,
          endInside = end - child.border;
        if (from >= startInside && to <= endInside) {
          this.dirty = from == offset || to == end ? CONTENT_DIRTY : CHILD_DIRTY;
          if (from == startInside && to == endInside && (child.contentLost || child.dom.parentNode != this.contentDOM)) child.dirty = NODE_DIRTY;else child.markDirty(from - startInside, to - startInside);
          return;
        } else {
          child.dirty = child.dom == child.contentDOM && child.dom.parentNode == this.contentDOM && !child.children.length ? CONTENT_DIRTY : NODE_DIRTY;
        }
      }
      offset = end;
    }
    this.dirty = CONTENT_DIRTY;
  }
  markParentsDirty() {
    let level = 1;
    for (let node = this.parent; node; node = node.parent, level++) {
      let dirty = level == 1 ? CONTENT_DIRTY : CHILD_DIRTY;
      if (node.dirty < dirty) node.dirty = dirty;
    }
  }
  get domAtom() {
    return false;
  }
  get ignoreForCoords() {
    return false;
  }
  get ignoreForSelection() {
    return false;
  }
  isText(text) {
    return false;
  }
}

// A widget desc represents a widget decoration, which is a DOM node
// drawn between the document nodes.
exports.ViewDesc = ViewDesc;
class WidgetViewDesc extends ViewDesc {
  constructor(parent, widget, view, pos) {
    let self,
      dom = widget.type.toDOM;
    if (typeof dom == "function") dom = dom(view, () => {
      if (!self) return pos;
      if (self.parent) return self.parent.posBeforeChild(self);
    });
    if (!widget.type.spec.raw) {
      if (dom.nodeType != 1) {
        let wrap = document.createElement("span");
        wrap.appendChild(dom);
        dom = wrap;
      }
      ;
      dom.contentEditable = "false";
      dom.classList.add("ProseMirror-widget");
    }
    super(parent, [], dom, null);
    this.widget = widget;
    this.widget = widget;
    self = this;
  }
  matchesWidget(widget) {
    return this.dirty == NOT_DIRTY && widget.type.eq(this.widget.type);
  }
  parseRule() {
    return {
      ignore: true
    };
  }
  stopEvent(event) {
    let stop = this.widget.spec.stopEvent;
    return stop ? stop(event) : false;
  }
  ignoreMutation(mutation) {
    return mutation.type != "selection" || this.widget.spec.ignoreSelection;
  }
  destroy() {
    this.widget.type.destroy(this.dom);
    super.destroy();
  }
  get domAtom() {
    return true;
  }
  get ignoreForSelection() {
    return !!this.widget.type.spec.relaxedSide;
  }
  get side() {
    return this.widget.type.side;
  }
}
class CompositionViewDesc extends ViewDesc {
  constructor(parent, dom, textDOM, text) {
    super(parent, [], dom, null);
    this.textDOM = textDOM;
    this.text = text;
  }
  get size() {
    return this.text.length;
  }
  localPosFromDOM(dom, offset) {
    if (dom != this.textDOM) return this.posAtStart + (offset ? this.size : 0);
    return this.posAtStart + offset;
  }
  domFromPos(pos) {
    return {
      node: this.textDOM,
      offset: pos
    };
  }
  ignoreMutation(mut) {
    return mut.type === 'characterData' && mut.target.nodeValue == mut.oldValue;
  }
}

// A mark desc represents a mark. May have multiple children,
// depending on how the mark is split. Note that marks are drawn using
// a fixed nesting order, for simplicity and predictability, so in
// some cases they will be split more often than would appear
// necessary.
class MarkViewDesc extends ViewDesc {
  constructor(parent, mark, dom, contentDOM, spec) {
    super(parent, [], dom, contentDOM);
    this.mark = mark;
    this.spec = spec;
  }
  static create(parent, mark, inline, view) {
    let custom = view.nodeViews[mark.type.name];
    let spec = custom && custom(mark, view, inline);
    if (!spec || !spec.dom) spec = _prosemirrorModel.DOMSerializer.renderSpec(document, mark.type.spec.toDOM(mark, inline), null, mark.attrs);
    return new MarkViewDesc(parent, mark, spec.dom, spec.contentDOM || spec.dom, spec);
  }
  parseRule() {
    if (this.dirty & NODE_DIRTY || this.mark.type.spec.reparseInView) return null;
    return {
      mark: this.mark.type.name,
      attrs: this.mark.attrs,
      contentElement: this.contentDOM
    };
  }
  matchesMark(mark) {
    return this.dirty != NODE_DIRTY && this.mark.eq(mark);
  }
  markDirty(from, to) {
    super.markDirty(from, to);
    // Move dirty info to nearest node view
    if (this.dirty != NOT_DIRTY) {
      let parent = this.parent;
      while (!parent.node) parent = parent.parent;
      if (parent.dirty < this.dirty) parent.dirty = this.dirty;
      this.dirty = NOT_DIRTY;
    }
  }
  slice(from, to, view) {
    let copy = MarkViewDesc.create(this.parent, this.mark, true, view);
    let nodes = this.children,
      size = this.size;
    if (to < size) nodes = replaceNodes(nodes, to, size, view);
    if (from > 0) nodes = replaceNodes(nodes, 0, from, view);
    for (let i = 0; i < nodes.length; i++) nodes[i].parent = copy;
    copy.children = nodes;
    return copy;
  }
  ignoreMutation(mutation) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(mutation) : super.ignoreMutation(mutation);
  }
  destroy() {
    if (this.spec.destroy) this.spec.destroy();
    super.destroy();
  }
}

// Node view descs are the main, most common type of view desc, and
// correspond to an actual node in the document. Unlike mark descs,
// they populate their child array themselves.
class NodeViewDesc extends ViewDesc {
  constructor(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, view, pos) {
    super(parent, [], dom, contentDOM);
    this.node = node;
    this.outerDeco = outerDeco;
    this.innerDeco = innerDeco;
    this.nodeDOM = nodeDOM;
  }

  // By default, a node is rendered using the `toDOM` method from the
  // node type spec. But client code can use the `nodeViews` spec to
  // supply a custom node view, which can influence various aspects of
  // the way the node works.
  //
  // (Using subclassing for this was intentionally decided against,
  // since it'd require exposing a whole slew of finicky
  // implementation details to the user code that they probably will
  // never need.)
  static create(parent, node, outerDeco, innerDeco, view, pos) {
    let custom = view.nodeViews[node.type.name],
      descObj;
    let spec = custom && custom(node, view, () => {
      // (This is a function that allows the custom view to find its
      // own position)
      if (!descObj) return pos;
      if (descObj.parent) return descObj.parent.posBeforeChild(descObj);
    }, outerDeco, innerDeco);
    let dom = spec && spec.dom,
      contentDOM = spec && spec.contentDOM;
    if (node.isText) {
      if (!dom) dom = document.createTextNode(node.text);else if (dom.nodeType != 3) throw new RangeError("Text must be rendered as a DOM text node");
    } else if (!dom) {
      let spec = _prosemirrorModel.DOMSerializer.renderSpec(document, node.type.spec.toDOM(node), null, node.attrs);
      ({
        dom,
        contentDOM
      } = spec);
    }
    if (!contentDOM && !node.isText && dom.nodeName != "BR") {
      // Chrome gets confused by <br contenteditable=false>
      if (!dom.hasAttribute("contenteditable")) dom.contentEditable = "false";
      if (node.type.spec.draggable) dom.draggable = true;
    }
    let nodeDOM = dom;
    dom = applyOuterDeco(dom, outerDeco, node);
    if (spec) return descObj = new CustomNodeViewDesc(parent, node, outerDeco, innerDeco, dom, contentDOM || null, nodeDOM, spec, view, pos + 1);else if (node.isText) return new TextViewDesc(parent, node, outerDeco, innerDeco, dom, nodeDOM, view);else return new NodeViewDesc(parent, node, outerDeco, innerDeco, dom, contentDOM || null, nodeDOM, view, pos + 1);
  }
  parseRule() {
    // Experimental kludge to allow opt-in re-parsing of nodes
    if (this.node.type.spec.reparseInView) return null;
    // FIXME the assumption that this can always return the current
    // attrs means that if the user somehow manages to change the
    // attrs in the dom, that won't be picked up. Not entirely sure
    // whether this is a problem
    let rule = {
      node: this.node.type.name,
      attrs: this.node.attrs
    };
    if (this.node.type.whitespace == "pre") rule.preserveWhitespace = "full";
    if (!this.contentDOM) {
      rule.getContent = () => this.node.content;
    } else if (!this.contentLost) {
      rule.contentElement = this.contentDOM;
    } else {
      // Chrome likes to randomly recreate parent nodes when
      // backspacing things. When that happens, this tries to find the
      // new parent.
      for (let i = this.children.length - 1; i >= 0; i--) {
        let child = this.children[i];
        if (this.dom.contains(child.dom.parentNode)) {
          rule.contentElement = child.dom.parentNode;
          break;
        }
      }
      if (!rule.contentElement) rule.getContent = () => _prosemirrorModel.Fragment.empty;
    }
    return rule;
  }
  matchesNode(node, outerDeco, innerDeco) {
    return this.dirty == NOT_DIRTY && node.eq(this.node) && sameOuterDeco(outerDeco, this.outerDeco) && innerDeco.eq(this.innerDeco);
  }
  get size() {
    return this.node.nodeSize;
  }
  get border() {
    return this.node.isLeaf ? 0 : 1;
  }

  // Syncs `this.children` to match `this.node.content` and the local
  // decorations, possibly introducing nesting for marks. Then, in a
  // separate step, syncs the DOM inside `this.contentDOM` to
  // `this.children`.
  updateChildren(view, pos) {
    let inline = this.node.inlineContent,
      off = pos;
    let composition = view.composing ? this.localCompositionInfo(view, pos) : null;
    let localComposition = composition && composition.pos > -1 ? composition : null;
    let compositionInChild = composition && composition.pos < 0;
    let updater = new ViewTreeUpdater(this, localComposition && localComposition.node, view);
    iterDeco(this.node, this.innerDeco, (widget, i, insideNode) => {
      if (widget.spec.marks) updater.syncToMarks(widget.spec.marks, inline, view, i);else if (widget.type.side >= 0 && !insideNode) updater.syncToMarks(i == this.node.childCount ? _prosemirrorModel.Mark.none : this.node.child(i).marks, inline, view, i);
      // If the next node is a desc matching this widget, reuse it,
      // otherwise insert the widget as a new view desc.
      updater.placeWidget(widget, view, off);
    }, (child, outerDeco, innerDeco, i) => {
      // Make sure the wrapping mark descs match the node's marks.
      updater.syncToMarks(child.marks, inline, view, i);
      // Try several strategies for drawing this node
      let compIndex;
      if (updater.findNodeMatch(child, outerDeco, innerDeco, i)) {
        // Found precise match with existing node view
      } else if (compositionInChild && view.state.selection.from > off && view.state.selection.to < off + child.nodeSize && (compIndex = updater.findIndexWithChild(composition.node)) > -1 && updater.updateNodeAt(child, outerDeco, innerDeco, compIndex, view)) {
        // Updated the specific node that holds the composition
      } else if (updater.updateNextNode(child, outerDeco, innerDeco, view, i, off)) {
        // Could update an existing node to reflect this node
      } else {
        // Add it as a new view
        updater.addNode(child, outerDeco, innerDeco, view, off);
      }
      off += child.nodeSize;
    });
    // Drop all remaining descs after the current position.
    updater.syncToMarks([], inline, view, 0);
    if (this.node.isTextblock) updater.addTextblockHacks();
    updater.destroyRest();

    // Sync the DOM if anything changed
    if (updater.changed || this.dirty == CONTENT_DIRTY) {
      // May have to protect focused DOM from being changed if a composition is active
      if (localComposition) this.protectLocalComposition(view, localComposition);
      renderDescs(this.contentDOM, this.children, view);
      if (browser.ios) iosHacks(this.dom);
    }
  }
  localCompositionInfo(view, pos) {
    // Only do something if both the selection and a focused text node
    // are inside of this node
    let {
      from,
      to
    } = view.state.selection;
    if (!(view.state.selection instanceof _prosemirrorState.TextSelection) || from < pos || to > pos + this.node.content.size) return null;
    let textNode = view.input.compositionNode;
    if (!textNode || !this.dom.contains(textNode.parentNode)) return null;
    if (this.node.inlineContent) {
      // Find the text in the focused node in the node, stop if it's not
      // there (may have been modified through other means, in which
      // case it should overwritten)
      let text = textNode.nodeValue;
      let textPos = findTextInFragment(this.node.content, text, from - pos, to - pos);
      return textPos < 0 ? null : {
        node: textNode,
        pos: textPos,
        text
      };
    } else {
      return {
        node: textNode,
        pos: -1,
        text: ""
      };
    }
  }
  protectLocalComposition(view, {
    node,
    pos,
    text
  }) {
    // The node is already part of a local view desc, leave it there
    if (this.getDesc(node)) return;

    // Create a composition view for the orphaned nodes
    let topNode = node;
    for (;; topNode = topNode.parentNode) {
      if (topNode.parentNode == this.contentDOM) break;
      while (topNode.previousSibling) topNode.parentNode.removeChild(topNode.previousSibling);
      while (topNode.nextSibling) topNode.parentNode.removeChild(topNode.nextSibling);
      if (topNode.pmViewDesc) topNode.pmViewDesc = undefined;
    }
    let desc = new CompositionViewDesc(this, topNode, node, text);
    view.input.compositionNodes.push(desc);

    // Patch up this.children to contain the composition view
    this.children = replaceNodes(this.children, pos, pos + text.length, view, desc);
  }

  // If this desc must be updated to match the given node decoration,
  // do so and return true.
  update(node, outerDeco, innerDeco, view) {
    if (this.dirty == NODE_DIRTY || !node.sameMarkup(this.node)) return false;
    this.updateInner(node, outerDeco, innerDeco, view);
    return true;
  }
  updateInner(node, outerDeco, innerDeco, view) {
    this.updateOuterDeco(outerDeco);
    this.node = node;
    this.innerDeco = innerDeco;
    if (this.contentDOM) this.updateChildren(view, this.posAtStart);
    this.dirty = NOT_DIRTY;
  }
  updateOuterDeco(outerDeco) {
    if (sameOuterDeco(outerDeco, this.outerDeco)) return;
    let needsWrap = this.nodeDOM.nodeType != 1;
    let oldDOM = this.dom;
    this.dom = patchOuterDeco(this.dom, this.nodeDOM, computeOuterDeco(this.outerDeco, this.node, needsWrap), computeOuterDeco(outerDeco, this.node, needsWrap));
    if (this.dom != oldDOM) {
      oldDOM.pmViewDesc = undefined;
      this.dom.pmViewDesc = this;
    }
    this.outerDeco = outerDeco;
  }

  // Mark this node as being the selected node.
  selectNode() {
    if (this.nodeDOM.nodeType == 1) {
      ;
      this.nodeDOM.classList.add("ProseMirror-selectednode");
      if (this.contentDOM || !this.node.type.spec.draggable) this.nodeDOM.draggable = true;
    }
  }

  // Remove selected node marking from this node.
  deselectNode() {
    if (this.nodeDOM.nodeType == 1) {
      ;
      this.nodeDOM.classList.remove("ProseMirror-selectednode");
      if (this.contentDOM || !this.node.type.spec.draggable) this.nodeDOM.removeAttribute("draggable");
    }
  }
  get domAtom() {
    return this.node.isAtom;
  }
}

// Create a view desc for the top-level document node, to be exported
// and used by the view class.
exports.NodeViewDesc = NodeViewDesc;
function docViewDesc(doc, outerDeco, innerDeco, dom, view) {
  applyOuterDeco(dom, outerDeco, doc);
  let docView = new NodeViewDesc(undefined, doc, outerDeco, innerDeco, dom, dom, dom, view, 0);
  if (docView.contentDOM) docView.updateChildren(view, 0);
  return docView;
}
class TextViewDesc extends NodeViewDesc {
  constructor(parent, node, outerDeco, innerDeco, dom, nodeDOM, view) {
    super(parent, node, outerDeco, innerDeco, dom, null, nodeDOM, view, 0);
  }
  parseRule() {
    let skip = this.nodeDOM.parentNode;
    while (skip && skip != this.dom && !skip.pmIsDeco) skip = skip.parentNode;
    return {
      skip: skip || true
    };
  }
  update(node, outerDeco, innerDeco, view) {
    if (this.dirty == NODE_DIRTY || this.dirty != NOT_DIRTY && !this.inParent() || !node.sameMarkup(this.node)) return false;
    this.updateOuterDeco(outerDeco);
    if ((this.dirty != NOT_DIRTY || node.text != this.node.text) && node.text != this.nodeDOM.nodeValue) {
      this.nodeDOM.nodeValue = node.text;
      if (view.trackWrites == this.nodeDOM) view.trackWrites = null;
    }
    this.node = node;
    this.dirty = NOT_DIRTY;
    return true;
  }
  inParent() {
    let parentDOM = this.parent.contentDOM;
    for (let n = this.nodeDOM; n; n = n.parentNode) if (n == parentDOM) return true;
    return false;
  }
  domFromPos(pos) {
    return {
      node: this.nodeDOM,
      offset: pos
    };
  }
  localPosFromDOM(dom, offset, bias) {
    if (dom == this.nodeDOM) return this.posAtStart + Math.min(offset, this.node.text.length);
    return super.localPosFromDOM(dom, offset, bias);
  }
  ignoreMutation(mutation) {
    return mutation.type != "characterData" && mutation.type != "selection";
  }
  slice(from, to, view) {
    let node = this.node.cut(from, to),
      dom = document.createTextNode(node.text);
    return new TextViewDesc(this.parent, node, this.outerDeco, this.innerDeco, dom, dom, view);
  }
  markDirty(from, to) {
    super.markDirty(from, to);
    if (this.dom != this.nodeDOM && (from == 0 || to == this.nodeDOM.nodeValue.length)) this.dirty = NODE_DIRTY;
  }
  get domAtom() {
    return false;
  }
  isText(text) {
    return this.node.text == text;
  }
}

// A dummy desc used to tag trailing BR or IMG nodes created to work
// around contentEditable terribleness.
class TrailingHackViewDesc extends ViewDesc {
  parseRule() {
    return {
      ignore: true
    };
  }
  matchesHack(nodeName) {
    return this.dirty == NOT_DIRTY && this.dom.nodeName == nodeName;
  }
  get domAtom() {
    return true;
  }
  get ignoreForCoords() {
    return this.dom.nodeName == "IMG";
  }
}

// A separate subclass is used for customized node views, so that the
// extra checks only have to be made for nodes that are actually
// customized.
class CustomNodeViewDesc extends NodeViewDesc {
  constructor(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, spec, view, pos) {
    super(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, view, pos);
    this.spec = spec;
  }

  // A custom `update` method gets to decide whether the update goes
  // through. If it does, and there's a `contentDOM` node, our logic
  // updates the children.
  update(node, outerDeco, innerDeco, view) {
    if (this.dirty == NODE_DIRTY) return false;
    if (this.spec.update && (this.node.type == node.type || this.spec.multiType)) {
      let result = this.spec.update(node, outerDeco, innerDeco);
      if (result) this.updateInner(node, outerDeco, innerDeco, view);
      return result;
    } else if (!this.contentDOM && !node.isLeaf) {
      return false;
    } else {
      return super.update(node, outerDeco, innerDeco, view);
    }
  }
  selectNode() {
    this.spec.selectNode ? this.spec.selectNode() : super.selectNode();
  }
  deselectNode() {
    this.spec.deselectNode ? this.spec.deselectNode() : super.deselectNode();
  }
  setSelection(anchor, head, view, force) {
    this.spec.setSelection ? this.spec.setSelection(anchor, head, view.root) : super.setSelection(anchor, head, view, force);
  }
  destroy() {
    if (this.spec.destroy) this.spec.destroy();
    super.destroy();
  }
  stopEvent(event) {
    return this.spec.stopEvent ? this.spec.stopEvent(event) : false;
  }
  ignoreMutation(mutation) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(mutation) : super.ignoreMutation(mutation);
  }
}

// Sync the content of the given DOM node with the nodes associated
// with the given array of view descs, recursing into mark descs
// because this should sync the subtree for a whole node at a time.
function renderDescs(parentDOM, descs, view) {
  let dom = parentDOM.firstChild,
    written = false;
  for (let i = 0; i < descs.length; i++) {
    let desc = descs[i],
      childDOM = desc.dom;
    if (childDOM.parentNode == parentDOM) {
      while (childDOM != dom) {
        dom = rm(dom);
        written = true;
      }
      dom = dom.nextSibling;
    } else {
      written = true;
      parentDOM.insertBefore(childDOM, dom);
    }
    if (desc instanceof MarkViewDesc) {
      let pos = dom ? dom.previousSibling : parentDOM.lastChild;
      renderDescs(desc.contentDOM, desc.children, view);
      dom = pos ? pos.nextSibling : parentDOM.firstChild;
    }
  }
  while (dom) {
    dom = rm(dom);
    written = true;
  }
  if (written && view.trackWrites == parentDOM) view.trackWrites = null;
}
const OuterDecoLevel = function (nodeName) {
  if (nodeName) this.nodeName = nodeName;
};
OuterDecoLevel.prototype = Object.create(null);
const noDeco = [new OuterDecoLevel()];
function computeOuterDeco(outerDeco, node, needsWrap) {
  if (outerDeco.length == 0) return noDeco;
  let top = needsWrap ? noDeco[0] : new OuterDecoLevel(),
    result = [top];
  for (let i = 0; i < outerDeco.length; i++) {
    let attrs = outerDeco[i].type.attrs;
    if (!attrs) continue;
    if (attrs.nodeName) result.push(top = new OuterDecoLevel(attrs.nodeName));
    for (let name in attrs) {
      let val = attrs[name];
      if (val == null) continue;
      if (needsWrap && result.length == 1) result.push(top = new OuterDecoLevel(node.isInline ? "span" : "div"));
      if (name == "class") top.class = (top.class ? top.class + " " : "") + val;else if (name == "style") top.style = (top.style ? top.style + ";" : "") + val;else if (name != "nodeName") top[name] = val;
    }
  }
  return result;
}
function patchOuterDeco(outerDOM, nodeDOM, prevComputed, curComputed) {
  // Shortcut for trivial case
  if (prevComputed == noDeco && curComputed == noDeco) return nodeDOM;
  let curDOM = nodeDOM;
  for (let i = 0; i < curComputed.length; i++) {
    let deco = curComputed[i],
      prev = prevComputed[i];
    if (i) {
      let parent;
      if (prev && prev.nodeName == deco.nodeName && curDOM != outerDOM && (parent = curDOM.parentNode) && parent.nodeName.toLowerCase() == deco.nodeName) {
        curDOM = parent;
      } else {
        parent = document.createElement(deco.nodeName);
        parent.pmIsDeco = true;
        parent.appendChild(curDOM);
        prev = noDeco[0];
        curDOM = parent;
      }
    }
    patchAttributes(curDOM, prev || noDeco[0], deco);
  }
  return curDOM;
}
function patchAttributes(dom, prev, cur) {
  for (let name in prev) if (name != "class" && name != "style" && name != "nodeName" && !(name in cur)) dom.removeAttribute(name);
  for (let name in cur) if (name != "class" && name != "style" && name != "nodeName" && cur[name] != prev[name]) dom.setAttribute(name, cur[name]);
  if (prev.class != cur.class) {
    let prevList = prev.class ? prev.class.split(" ").filter(Boolean) : [];
    let curList = cur.class ? cur.class.split(" ").filter(Boolean) : [];
    for (let i = 0; i < prevList.length; i++) if (curList.indexOf(prevList[i]) == -1) dom.classList.remove(prevList[i]);
    for (let i = 0; i < curList.length; i++) if (prevList.indexOf(curList[i]) == -1) dom.classList.add(curList[i]);
    if (dom.classList.length == 0) dom.removeAttribute("class");
  }
  if (prev.style != cur.style) {
    if (prev.style) {
      let prop = /\s*([\w\-\xa1-\uffff]+)\s*:(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\(.*?\)|[^;])*/g,
        m;
      while (m = prop.exec(prev.style)) dom.style.removeProperty(m[1]);
    }
    if (cur.style) dom.style.cssText += cur.style;
  }
}
function applyOuterDeco(dom, deco, node) {
  return patchOuterDeco(dom, dom, noDeco, computeOuterDeco(deco, node, dom.nodeType != 1));
}
function sameOuterDeco(a, b) {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++) if (!a[i].type.eq(b[i].type)) return false;
  return true;
}

// Remove a DOM node and return its next sibling.
function rm(dom) {
  let next = dom.nextSibling;
  dom.parentNode.removeChild(dom);
  return next;
}

// Helper class for incrementally updating a tree of mark descs and
// the widget and node descs inside of them.
class ViewTreeUpdater {
  constructor(top, lock, view) {
    this.lock = lock;
    this.view = view;
    // Index into `this.top`'s child array, represents the current
    // update position.
    this.index = 0;
    // When entering a mark, the current top and index are pushed
    // onto this.
    this.stack = [];
    // Tracks whether anything was changed
    this.changed = false;
    this.preMatch = void 0;
    this.top = void 0;
    this.top = top;
    this.preMatch = preMatch(top.node.content, top);
  }

  // Destroy and remove the children between the given indices in
  // `this.top`.
  destroyBetween(start, end) {
    if (start == end) return;
    for (let i = start; i < end; i++) this.top.children[i].destroy();
    this.top.children.splice(start, end - start);
    this.changed = true;
  }

  // Destroy all remaining children in `this.top`.
  destroyRest() {
    this.destroyBetween(this.index, this.top.children.length);
  }

  // Sync the current stack of mark descs with the given array of
  // marks, reusing existing mark descs when possible.
  syncToMarks(marks, inline, view, parentIndex) {
    let keep = 0,
      depth = this.stack.length >> 1;
    let maxKeep = Math.min(depth, marks.length);
    while (keep < maxKeep && (keep == depth - 1 ? this.top : this.stack[keep + 1 << 1]).matchesMark(marks[keep]) && marks[keep].type.spec.spanning !== false) keep++;
    while (keep < depth) {
      this.destroyRest();
      this.top.dirty = NOT_DIRTY;
      this.index = this.stack.pop();
      this.top = this.stack.pop();
      depth--;
    }
    while (depth < marks.length) {
      this.stack.push(this.top, this.index + 1);
      let found = -1,
        scanTo = this.top.children.length;
      if (parentIndex < this.preMatch.index) scanTo = Math.min(this.index + 3, scanTo);
      for (let i = this.index; i < scanTo; i++) {
        let next = this.top.children[i];
        if (next.matchesMark(marks[depth]) && !this.isLocked(next.dom)) {
          found = i;
          break;
        }
      }
      if (found > -1) {
        if (found > this.index) {
          this.changed = true;
          this.destroyBetween(this.index, found);
        }
        this.top = this.top.children[this.index];
      } else {
        let markDesc = MarkViewDesc.create(this.top, marks[depth], inline, view);
        this.top.children.splice(this.index, 0, markDesc);
        this.top = markDesc;
        this.changed = true;
      }
      this.index = 0;
      depth++;
    }
  }

  // Try to find a node desc matching the given data. Skip over it and
  // return true when successful.
  findNodeMatch(node, outerDeco, innerDeco, index) {
    let found = -1,
      targetDesc;
    if (index >= this.preMatch.index && (targetDesc = this.preMatch.matches[index - this.preMatch.index]).parent == this.top && targetDesc.matchesNode(node, outerDeco, innerDeco)) {
      found = this.top.children.indexOf(targetDesc, this.index);
    } else {
      for (let i = this.index, e = Math.min(this.top.children.length, i + 5); i < e; i++) {
        let child = this.top.children[i];
        if (child.matchesNode(node, outerDeco, innerDeco) && !this.preMatch.matched.has(child)) {
          found = i;
          break;
        }
      }
    }
    if (found < 0) return false;
    this.destroyBetween(this.index, found);
    this.index++;
    return true;
  }
  updateNodeAt(node, outerDeco, innerDeco, index, view) {
    let child = this.top.children[index];
    if (child.dirty == NODE_DIRTY && child.dom == child.contentDOM) child.dirty = CONTENT_DIRTY;
    if (!child.update(node, outerDeco, innerDeco, view)) return false;
    this.destroyBetween(this.index, index);
    this.index++;
    return true;
  }
  findIndexWithChild(domNode) {
    for (;;) {
      let parent = domNode.parentNode;
      if (!parent) return -1;
      if (parent == this.top.contentDOM) {
        let desc = domNode.pmViewDesc;
        if (desc) for (let i = this.index; i < this.top.children.length; i++) {
          if (this.top.children[i] == desc) return i;
        }
        return -1;
      }
      domNode = parent;
    }
  }

  // Try to update the next node, if any, to the given data. Checks
  // pre-matches to avoid overwriting nodes that could still be used.
  updateNextNode(node, outerDeco, innerDeco, view, index, pos) {
    for (let i = this.index; i < this.top.children.length; i++) {
      let next = this.top.children[i];
      if (next instanceof NodeViewDesc) {
        let preMatch = this.preMatch.matched.get(next);
        if (preMatch != null && preMatch != index) return false;
        let nextDOM = next.dom,
          updated;

        // Can't update if nextDOM is or contains this.lock, except if
        // it's a text node whose content already matches the new text
        // and whose decorations match the new ones.
        let locked = this.isLocked(nextDOM) && !(node.isText && next.node && next.node.isText && next.nodeDOM.nodeValue == node.text && next.dirty != NODE_DIRTY && sameOuterDeco(outerDeco, next.outerDeco));
        if (!locked && next.update(node, outerDeco, innerDeco, view)) {
          this.destroyBetween(this.index, i);
          if (next.dom != nextDOM) this.changed = true;
          this.index++;
          return true;
        } else if (!locked && (updated = this.recreateWrapper(next, node, outerDeco, innerDeco, view, pos))) {
          this.destroyBetween(this.index, i);
          this.top.children[this.index] = updated;
          if (updated.contentDOM) {
            updated.dirty = CONTENT_DIRTY;
            updated.updateChildren(view, pos + 1);
            updated.dirty = NOT_DIRTY;
          }
          this.changed = true;
          this.index++;
          return true;
        }
        break;
      }
    }
    return false;
  }

  // When a node with content is replaced by a different node with
  // identical content, move over its children.
  recreateWrapper(next, node, outerDeco, innerDeco, view, pos) {
    if (next.dirty || node.isAtom || !next.children.length || !next.node.content.eq(node.content) || !sameOuterDeco(outerDeco, next.outerDeco) || !innerDeco.eq(next.innerDeco)) return null;
    let wrapper = NodeViewDesc.create(this.top, node, outerDeco, innerDeco, view, pos);
    if (wrapper.contentDOM) {
      wrapper.children = next.children;
      next.children = [];
      for (let ch of wrapper.children) ch.parent = wrapper;
    }
    next.destroy();
    return wrapper;
  }

  // Insert the node as a newly created node desc.
  addNode(node, outerDeco, innerDeco, view, pos) {
    let desc = NodeViewDesc.create(this.top, node, outerDeco, innerDeco, view, pos);
    if (desc.contentDOM) desc.updateChildren(view, pos + 1);
    this.top.children.splice(this.index++, 0, desc);
    this.changed = true;
  }
  placeWidget(widget, view, pos) {
    let next = this.index < this.top.children.length ? this.top.children[this.index] : null;
    if (next && next.matchesWidget(widget) && (widget == next.widget || !next.widget.type.toDOM.parentNode)) {
      this.index++;
    } else {
      let desc = new WidgetViewDesc(this.top, widget, view, pos);
      this.top.children.splice(this.index++, 0, desc);
      this.changed = true;
    }
  }

  // Make sure a textblock looks and behaves correctly in
  // contentEditable.
  addTextblockHacks() {
    let lastChild = this.top.children[this.index - 1],
      parent = this.top;
    while (lastChild instanceof MarkViewDesc) {
      parent = lastChild;
      lastChild = parent.children[parent.children.length - 1];
    }
    if (!lastChild ||
    // Empty textblock
    !(lastChild instanceof TextViewDesc) || /\n$/.test(lastChild.node.text) || this.view.requiresGeckoHackNode && /\s$/.test(lastChild.node.text)) {
      // Avoid bugs in Safari's cursor drawing (#1165) and Chrome's mouse selection (#1152)
      if ((browser.safari || browser.chrome) && lastChild && lastChild.dom.contentEditable == "false") this.addHackNode("IMG", parent);
      this.addHackNode("BR", this.top);
    }
  }
  addHackNode(nodeName, parent) {
    if (parent == this.top && this.index < parent.children.length && parent.children[this.index].matchesHack(nodeName)) {
      this.index++;
    } else {
      let dom = document.createElement(nodeName);
      if (nodeName == "IMG") {
        dom.className = "ProseMirror-separator";
        dom.alt = "";
      }
      if (nodeName == "BR") dom.className = "ProseMirror-trailingBreak";
      let hack = new TrailingHackViewDesc(this.top, [], dom, null);
      if (parent != this.top) parent.children.push(hack);else parent.children.splice(this.index++, 0, hack);
      this.changed = true;
    }
  }
  isLocked(node) {
    return this.lock && (node == this.lock || node.nodeType == 1 && node.contains(this.lock.parentNode));
  }
}

// Iterate from the end of the fragment and array of descs to find
// directly matching ones, in order to avoid overeagerly reusing those
// for other nodes.
function preMatch(frag, parentDesc) {
  let curDesc = parentDesc,
    descI = curDesc.children.length;
  let fI = frag.childCount,
    matched = new Map(),
    matches = [];
  outer: while (fI > 0) {
    let desc;
    for (;;) {
      if (descI) {
        let next = curDesc.children[descI - 1];
        if (next instanceof MarkViewDesc) {
          curDesc = next;
          descI = next.children.length;
        } else {
          desc = next;
          descI--;
          break;
        }
      } else if (curDesc == parentDesc) {
        break outer;
      } else {
        descI = curDesc.parent.children.indexOf(curDesc);
        curDesc = curDesc.parent;
      }
    }
    let node = desc.node;
    if (!node) continue;
    if (node != frag.child(fI - 1)) break;
    --fI;
    matched.set(desc, fI);
    matches.push(desc);
  }
  return {
    index: fI,
    matched,
    matches: matches.reverse()
  };
}
function compareSide(a, b) {
  return a.type.side - b.type.side;
}

// This function abstracts iterating over the nodes and decorations in
// a fragment. Calls `onNode` for each node, with its local and child
// decorations. Splits text nodes when there is a decoration starting
// or ending inside of them. Calls `onWidget` for each widget.
function iterDeco(parent, deco, onWidget, onNode) {
  let locals = deco.locals(parent),
    offset = 0;
  // Simple, cheap variant for when there are no local decorations
  if (locals.length == 0) {
    for (let i = 0; i < parent.childCount; i++) {
      let child = parent.child(i);
      onNode(child, locals, deco.forChild(offset, child), i);
      offset += child.nodeSize;
    }
    return;
  }
  let decoIndex = 0,
    active = [],
    restNode = null;
  for (let parentIndex = 0;;) {
    let widget, widgets;
    while (decoIndex < locals.length && locals[decoIndex].to == offset) {
      let next = locals[decoIndex++];
      if (next.widget) {
        if (!widget) widget = next;else (widgets || (widgets = [widget])).push(next);
      }
    }
    if (widget) {
      if (widgets) {
        widgets.sort(compareSide);
        for (let i = 0; i < widgets.length; i++) onWidget(widgets[i], parentIndex, !!restNode);
      } else {
        onWidget(widget, parentIndex, !!restNode);
      }
    }
    let child, index;
    if (restNode) {
      index = -1;
      child = restNode;
      restNode = null;
    } else if (parentIndex < parent.childCount) {
      index = parentIndex;
      child = parent.child(parentIndex++);
    } else {
      break;
    }
    for (let i = 0; i < active.length; i++) if (active[i].to <= offset) active.splice(i--, 1);
    while (decoIndex < locals.length && locals[decoIndex].from <= offset && locals[decoIndex].to > offset) active.push(locals[decoIndex++]);
    let end = offset + child.nodeSize;
    if (child.isText) {
      let cutAt = end;
      if (decoIndex < locals.length && locals[decoIndex].from < cutAt) cutAt = locals[decoIndex].from;
      for (let i = 0; i < active.length; i++) if (active[i].to < cutAt) cutAt = active[i].to;
      if (cutAt < end) {
        restNode = child.cut(cutAt - offset);
        child = child.cut(0, cutAt - offset);
        end = cutAt;
        index = -1;
      }
    } else {
      while (decoIndex < locals.length && locals[decoIndex].to < end) decoIndex++;
    }
    let outerDeco = child.isInline && !child.isLeaf ? active.filter(d => !d.inline) : active.slice();
    onNode(child, outerDeco, deco.forChild(offset, child), index);
    offset = end;
  }
}

// List markers in Mobile Safari will mysteriously disappear
// sometimes. This works around that.
function iosHacks(dom) {
  if (dom.nodeName == "UL" || dom.nodeName == "OL") {
    let oldCSS = dom.style.cssText;
    dom.style.cssText = oldCSS + "; list-style: square !important";
    window.getComputedStyle(dom).listStyle;
    dom.style.cssText = oldCSS;
  }
}

// Find a piece of text in an inline fragment, overlapping from-to
function findTextInFragment(frag, text, from, to) {
  for (let i = 0, pos = 0; i < frag.childCount && pos <= to;) {
    let child = frag.child(i++),
      childStart = pos;
    pos += child.nodeSize;
    if (!child.isText) continue;
    let str = child.text;
    while (i < frag.childCount) {
      let next = frag.child(i++);
      pos += next.nodeSize;
      if (!next.isText) break;
      str += next.text;
    }
    if (pos >= from) {
      if (pos >= to && str.slice(to - text.length - childStart, to - childStart) == text) return to - text.length;
      let found = childStart < to ? str.lastIndexOf(text, to - childStart - 1) : -1;
      if (found >= 0 && found + text.length + childStart >= from) return childStart + found;
      if (from == to && str.length >= to + text.length - childStart && str.slice(to - childStart, to - childStart + text.length) == text) return to;
    }
  }
  return -1;
}

// Replace range from-to in an array of view descs with replacement
// (may be null to just delete). This goes very much against the grain
// of the rest of this code, which tends to create nodes with the
// right shape in one go, rather than messing with them after
// creation, but is necessary in the composition hack.
function replaceNodes(nodes, from, to, view, replacement) {
  let result = [];
  for (let i = 0, off = 0; i < nodes.length; i++) {
    let child = nodes[i],
      start = off,
      end = off += child.size;
    if (start >= to || end <= from) {
      result.push(child);
    } else {
      if (start < from) result.push(child.slice(0, from - start, view));
      if (replacement) {
        result.push(replacement);
        replacement = undefined;
      }
      if (end > to) result.push(child.slice(to - start, child.size, view));
    }
  }
  return result;
}
},
"rope-sequence/index.js":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
const GOOD_LEAF_SIZE = 200;

// :: class<T> A rope sequence is a persistent sequence data structure
// that supports appending, prepending, and slicing without doing a
// full copy. It is represented as a mostly-balanced tree.
class RopeSequence {
  // length:: number
  // The length of the rope.

  // :: (union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Append an array or other rope to this one, returning a new rope.
  append(other) {
    if (!other.length) return this;
    other = RopeSequence.from(other);
    return !this.length && other || other.length < GOOD_LEAF_SIZE && this.leafAppend(other) || this.length < GOOD_LEAF_SIZE && other.leafPrepend(this) || this.appendInner(other);
  }

  // :: (union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Prepend an array or other rope to this one, returning a new rope.
  prepend(other) {
    if (!other.length) return this;
    return RopeSequence.from(other).append(this);
  }
  appendInner(other) {
    return new Append(this, other);
  }

  // :: (?number, ?number) → RopeSequence<T>
  // Create a rope repesenting a sub-sequence of this rope.
  slice(from = 0, to = this.length) {
    if (from >= to) return RopeSequence.empty;
    return this.sliceInner(Math.max(0, from), Math.min(this.length, to));
  }

  // :: (number) → T
  // Retrieve the element at the given position from this rope.
  get(i) {
    if (i < 0 || i >= this.length) return undefined;
    return this.getInner(i);
  }

  // :: ((element: T, index: number) → ?bool, ?number, ?number)
  // Call the given function for each element between the given
  // indices. This tends to be more efficient than looping over the
  // indices and calling `get`, because it doesn't have to descend the
  // tree for every element.
  forEach(f, from = 0, to = this.length) {
    if (from <= to) this.forEachInner(f, from, to, 0);else this.forEachInvertedInner(f, from, to, 0);
  }

  // :: ((element: T, index: number) → U, ?number, ?number) → [U]
  // Map the given functions over the elements of the rope, producing
  // a flat array.
  map(f, from = 0, to = this.length) {
    let result = [];
    this.forEach((elt, i) => result.push(f(elt, i)), from, to);
    return result;
  }

  // :: (?union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Create a rope representing the given array, or return the rope
  // itself if a rope was given.
  static from(values) {
    if (values instanceof RopeSequence) return values;
    return values && values.length ? new Leaf(values) : RopeSequence.empty;
  }

  // flatten:: () → [T]
  // Return the content of this rope as an array.
}
class Leaf extends RopeSequence {
  constructor(values) {
    super();
    this.values = values;
  }
  flatten() {
    return this.values;
  }
  sliceInner(from, to) {
    if (from == 0 && to == this.length) return this;
    return new Leaf(this.values.slice(from, to));
  }
  getInner(i) {
    return this.values[i];
  }
  forEachInner(f, from, to, start) {
    for (let i = from; i < to; i++) if (f(this.values[i], start + i) === false) return false;
  }
  forEachInvertedInner(f, from, to, start) {
    for (let i = from - 1; i >= to; i--) if (f(this.values[i], start + i) === false) return false;
  }
  leafAppend(other) {
    if (this.length + other.length <= GOOD_LEAF_SIZE) return new Leaf(this.values.concat(other.flatten()));
  }
  leafPrepend(other) {
    if (this.length + other.length <= GOOD_LEAF_SIZE) return new Leaf(other.flatten().concat(this.values));
  }
  get length() {
    return this.values.length;
  }
  get depth() {
    return 0;
  }
}

// :: RopeSequence
// The empty rope sequence.
RopeSequence.empty = new Leaf([]);
class Append extends RopeSequence {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
    this.length = left.length + right.length;
    this.depth = Math.max(left.depth, right.depth) + 1;
  }
  flatten() {
    return this.left.flatten().concat(this.right.flatten());
  }
  getInner(i) {
    return i < this.left.length ? this.left.get(i) : this.right.get(i - this.left.length);
  }
  forEachInner(f, from, to, start) {
    let leftLen = this.left.length;
    if (from < leftLen && this.left.forEachInner(f, from, Math.min(to, leftLen), start) === false) return false;
    if (to > leftLen && this.right.forEachInner(f, Math.max(from - leftLen, 0), Math.min(this.length, to) - leftLen, start + leftLen) === false) return false;
  }
  forEachInvertedInner(f, from, to, start) {
    let leftLen = this.left.length;
    if (from > leftLen && this.right.forEachInvertedInner(f, from - leftLen, Math.max(to, leftLen) - leftLen, start + leftLen) === false) return false;
    if (to < leftLen && this.left.forEachInvertedInner(f, Math.min(from, leftLen), to, start) === false) return false;
  }
  sliceInner(from, to) {
    if (from == 0 && to == this.length) return this;
    let leftLen = this.left.length;
    if (to <= leftLen) return this.left.slice(from, to);
    if (from >= leftLen) return this.right.slice(from - leftLen, to - leftLen);
    return this.left.slice(from, leftLen).append(this.right.slice(0, to - leftLen));
  }
  leafAppend(other) {
    let inner = this.right.leafAppend(other);
    if (inner) return new Append(this.left, inner);
  }
  leafPrepend(other) {
    let inner = this.left.leafPrepend(other);
    if (inner) return new Append(inner, this.right);
  }
  appendInner(other) {
    if (this.left.depth >= Math.max(this.right.depth, other.depth) + 1) return new Append(this.left, new Append(this.right, other));
    return new Append(this, other);
  }
}
var _default = exports.default = RopeSequence;
},
"w3c-keyname/index.js":function(module,exports,__require){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.base = void 0;
exports.keyName = keyName;
exports.shift = void 0;
var base = exports.base = {
  8: "Backspace",
  9: "Tab",
  10: "Enter",
  12: "NumLock",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  44: "PrintScreen",
  45: "Insert",
  46: "Delete",
  59: ";",
  61: "=",
  91: "Meta",
  92: "Meta",
  106: "*",
  107: "+",
  108: ",",
  109: "-",
  110: ".",
  111: "/",
  144: "NumLock",
  145: "ScrollLock",
  160: "Shift",
  161: "Shift",
  162: "Control",
  163: "Control",
  164: "Alt",
  165: "Alt",
  173: "-",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'"
};
var shift = exports.shift = {
  48: ")",
  49: "!",
  50: "@",
  51: "#",
  52: "$",
  53: "%",
  54: "^",
  55: "&",
  56: "*",
  57: "(",
  59: ":",
  61: "+",
  173: "_",
  186: ":",
  187: "+",
  188: "<",
  189: "_",
  190: ">",
  191: "?",
  192: "~",
  219: "{",
  220: "|",
  221: "}",
  222: "\""
};
var mac = typeof navigator != "undefined" && /Mac/.test(navigator.platform);
var ie = typeof navigator != "undefined" && /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);

// Fill in the digit keys
for (var i = 0; i < 10; i++) base[48 + i] = base[96 + i] = String(i);

// The function keys
for (var i = 1; i <= 24; i++) base[i + 111] = "F" + i;

// And the alphabetic keys
for (var i = 65; i <= 90; i++) {
  base[i] = String.fromCharCode(i + 32);
  shift[i] = String.fromCharCode(i);
}

// For each code that doesn't have a shift-equivalent, copy the base name
for (var code in base) if (!shift.hasOwnProperty(code)) shift[code] = base[code];
function keyName(event) {
  // On macOS, keys held with Shift and Cmd don't reflect the effect of Shift in `.key`.
  // On IE, shift effect is never included in `.key`.
  var ignoreKey = mac && event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey || ie && event.shiftKey && event.key && event.key.length == 1 || event.key == "Unidentified";
  var name = !ignoreKey && event.key || (event.shiftKey ? shift : base)[event.keyCode] || event.key || "Unidentified";
  // Edge sometimes produces wrong names (Issue #3)
  if (name == "Esc") name = "Escape";
  if (name == "Del") name = "Delete";
  // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8860571/
  if (name == "Left") name = "ArrowLeft";
  if (name == "Up") name = "ArrowUp";
  if (name == "Right") name = "ArrowRight";
  if (name == "Down") name = "ArrowDown";
  return name;
}
}
},cache=Object.create(null);function __require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};if(!modules[id])throw Error("Missing editor module "+id);modules[id](module,module.exports,__require);return module.exports;}
return Object.freeze({model:__require("prosemirror-model/src/index.ts"),state:__require("prosemirror-state/src/index.ts"),view:__require("prosemirror-view/src/index.ts"),commands:__require("prosemirror-commands/src/commands.ts"),keymap:__require("prosemirror-keymap/src/keymap.ts"),history:__require("prosemirror-history/src/history.ts"),lists:__require("prosemirror-schema-list/src/schema-list.ts"),inputrules:__require("prosemirror-inputrules/src/index.ts"),serializer:__require("prosemirror-markdown/src/to_markdown.ts"),lexer:__require("marked/src/Lexer.ts")});
})();

/* The selected Markdown subset, shared by both visual interfaces. */
const imMarkdown=(()=>{
  const {Schema}=imRichDeps.model;
  const schema=new Schema({nodes:{
    doc:{content:'block+'},
    paragraph:{content:'inline*',group:'block',parseDOM:[{tag:'p'}],toDOM:()=>['p',0]},
    heading:{attrs:{level:{default:1}},content:'inline*',group:'block',defining:true,
      parseDOM:[1,2,3,4,5,6].map(level=>({tag:'h'+level,attrs:{level}})),toDOM:n=>['h'+Math.max(1,Math.min(6,n.attrs.level)),0]},
    blockquote:{content:'block+',group:'block',defining:true,parseDOM:[{tag:'blockquote'}],toDOM:()=>['blockquote',0]},
    bullet_list:{content:'list_item+',group:'block',parseDOM:[{tag:'ul'}],toDOM:()=>['ul',0]},
    ordered_list:{attrs:{order:{default:1}},content:'list_item+',group:'block',parseDOM:[{tag:'ol',getAttrs:n=>({order:Math.max(1,Number(n.getAttribute('start'))||1)})}],toDOM:n=>['ol',{start:n.attrs.order},0]},
    list_item:{attrs:{checked:{default:null}},content:'paragraph block*',defining:true,
      parseDOM:[{tag:'li',getAttrs:n=>{const checked=n.getAttribute('data-checked'),input=n.querySelector('input[type=checkbox]');return {checked:checked!==null?checked==='true':input?input.checked:null};}}],
      toDOM:n=>['li',n.attrs.checked===null?{}:{'data-checked':String(n.attrs.checked)},['div',{class:'im-md-item'},0]]},
    text:{group:'inline'},
    hard_break:{inline:true,group:'inline',selectable:false,parseDOM:[{tag:'br'}],toDOM:()=>['br']}
  },marks:{
    strong:{parseDOM:[{tag:'strong'},{tag:'b',getAttrs:n=>n.style.fontWeight!=='normal'&&null},{style:'font-weight',getAttrs:v=>/^(bold(er)?|[6-9]00)$/.test(v)&&null}],toDOM:()=>['strong',0]},
    strike:{parseDOM:[{tag:'s'},{tag:'del'},{tag:'strike'},{style:'text-decoration',getAttrs:v=>v.includes('line-through')&&null}],toDOM:()=>['s',0]}
  }});
  const base=imRichDeps.serializer.defaultMarkdownSerializer;
  function renderInline(s,n,preserve){
    const text=s.text,total=n.textContent.length;let offset=0;
    if(preserve)s.text=function(value,escape=true){
      if(escape===false)return text.call(this,value,escape);
      const start=offset===0?(/^[ \t]+/.exec(value)?.[0].length||0):0;
      const end=offset+value.length===total?Math.max(start,value.length-(/[ \t]+$/.exec(value)?.[0].length||0)):value.length;
      offset+=value.length;
      for(const char of value.slice(0,start))this.write(char===' '?'&#32;':'&#9;');
      text.call(this,value.slice(start,end),escape);
      for(const char of value.slice(end))this.write(char===' '?'&#32;':'&#9;');
    };
    try{s.renderInline(n);}finally{s.text=text;}
  }
  const serializer=new imRichDeps.serializer.MarkdownSerializer({
    paragraph:(s,n)=>{if(!n.content.size)s.write('');renderInline(s,n,s.options.imListDepth||/^[ \t]+$/.test(n.textContent));s.closeBlock(n);},
    heading:(s,n)=>{s.write('#'.repeat(n.attrs.level)+' ');renderInline(s,n,true);s.closeBlock(n);},blockquote:base.nodes.blockquote,
    bullet_list:base.nodes.bullet_list,ordered_list:base.nodes.ordered_list,
    list_item:(s,n)=>{if(n.attrs.checked!==null)s.write(n.attrs.checked?'[x] ':'[ ] ');s.options.imListDepth=(s.options.imListDepth||0)+1;try{s.renderContent(n);}finally{s.options.imListDepth--;}},
    // Single newlines display as line breaks in both editors. Consecutive or
    // trailing soft breaks need an explicit br so they cannot become paragraphs.
    hard_break:(s,n,parent,index)=>s.write(parent.type===schema.nodes.heading?'<br>':index===parent.childCount-1?(s.options.imLastBlock===parent&&parent.type===schema.nodes.paragraph&&!s.delim&&parent.textContent.trim()?'\n':'<br>'):parent.child(index+1).type===schema.nodes.hard_break?'<br>':'\n'),text:base.nodes.text
  },{strong:base.marks.strong,strike:{open:'~~',close:'~~',mixable:true,expelEnclosingWhitespace:true}},{tightLists:true,escapeExtraCharacters:/[&<]/g});
  const cache=new Map(),records=new WeakMap();let cachedCharacters=0;
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
  const decode=text=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(raw,name)=>{
    if(name[0]!=='#')return entities[name.toLowerCase()]??raw;
    const n=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';
  });
  function inline(tokens,marks=[]){
    const nodes=[];
    for(const token of tokens||[]){
      if(token.type==='checkbox')continue;
      if(token.type==='strong'||token.type==='del')nodes.push(...inline(token.tokens,[...marks,schema.marks[token.type==='strong'?'strong':'strike'].create()]));
      else if(token.type==='br'||token.type==='html'&&/^<br\s*\/?>$/i.test(token.raw))nodes.push(schema.nodes.hard_break.create());
      else if(token.type==='text'&&token.tokens)nodes.push(...inline(token.tokens,marks));
      else{const text=token.type==='text'?decode(token.text||''):token.type==='escape'?(token.text||''):(token.raw||token.text||'');if(text)nodes.push(schema.text(text,marks));}
    }
    return nodes;
  }
  function blocks(tokens){
    const nodes=[];
    for(let index=0;index<(tokens||[]).length;index++){
      const token=tokens[index];
      if(token.type==='space'){
        const lines=(token.raw.match(/\n/g)||[]).length,last=index===tokens.length-1;
        const count=Math.max(0,nodes.length?lines-(last?1:2):lines+(last?1:0));
        for(let i=0;i<count;i++)nodes.push(schema.nodes.paragraph.create());continue;
      }
      if(token.type==='checkbox')continue;
      if(token.type==='heading')nodes.push(schema.nodes.heading.create({level:token.depth},inline(token.tokens)));
      else if(token.type==='blockquote')nodes.push(schema.nodes.blockquote.create(null,blocks(token.tokens)));
      else if(token.type==='list'){
        const children=token.items.map(item=>{
          const emptyTask=/^\[([ xX])\]\s*$/.exec(item.text||'');
          const content=emptyTask?[schema.nodes.paragraph.create()]:blocks(item.tokens);if(!content.length||content[0].type!==schema.nodes.paragraph)content.unshift(schema.nodes.paragraph.create());
          const check=item.tokens.find(t=>t.type==='checkbox');
          return schema.nodes.list_item.create({checked:emptyTask?emptyTask[1]!==' ':item.task?!!(item.checked??check?.checked):null},content);
        });
        nodes.push(schema.nodes[token.ordered?'ordered_list':'bullet_list'].create(token.ordered?{order:Math.max(1,Number(token.start)||1)}:null,children));
      }else if(token.type==='paragraph'||token.type==='text'){
        const content=token.tokens?inline(token.tokens):token.text?[schema.text(decode(token.text))]:[];
        if(token.type==='paragraph'&&index===tokens.length-1&&token.raw.endsWith('\n')&&!token.text.endsWith('\n'))content.push(schema.nodes.hard_break.create());
        nodes.push(schema.nodes.paragraph.create(null,content));
      }
      else if(token.type==='html'&&/^(?:<br\s*\/?>)+\n*$/i.test(token.raw)){
        nodes.push(schema.nodes.paragraph.create(null,(token.raw.match(/<br\s*\/?>/gi)||[]).map(()=>schema.nodes.hard_break.create())));
        const newlines=/\n+$/.exec(token.raw)?.[0];if(newlines)tokens.splice(index+1,0,{type:'space',raw:newlines});
      }
      else if(token.raw)nodes.push(schema.nodes.paragraph.create(null,schema.text(token.raw.replace(/\n+$/,''))));
    }
    return nodes.length?nodes:[schema.nodes.paragraph.create()];
  }
  function parse(value){
    const text=typeof value==='string'?value:'';
    if(cache.has(text)){const doc=cache.get(text);cache.delete(text);cache.set(text,doc);return doc;}
    const simple=!/[*~#<>\[\]`\\&\r\n]/.test(text)&&!/^\s*(?:[-+]|\d+[.)])\s/.test(text);
    const doc=simple?schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,text?schema.text(text):null)):schema.nodes.doc.create(null,blocks(imRichDeps.lexer._Lexer.lex(text.replace(/\r\n?/g,'\n'),{gfm:true,breaks:true})));
    if(text.length<=262144){cache.set(text,doc);cachedCharacters+=text.length;while(cache.size>128||cachedCharacters>1048576){const key=cache.keys().next().value;cachedCharacters-=key.length;cache.delete(key);}}
    return doc;
  }
  function serialize(doc){return serializer.serialize(doc,{imLastBlock:doc.lastChild});}
  function clip(doc,lines,limit){
    let end=0,stop=false,count=0;
    doc.descendants((node,pos)=>{
      if(stop)return false;
      if(node.isTextblock){if(++count>lines){stop=true;return false;}end=Math.max(end,pos+1);}
      if(node.isText){let size=Math.min(node.text.length,limit-pos);if(size>0){if(size<node.text.length&&/[\uD800-\uDBFF]/.test(node.text[size-1]))size--;end=pos+size;}if(size<node.text.length)stop=true;}
      else if(node.type===schema.nodes.hard_break){end=pos+1;if(++count>=lines)stop=true;}
    });
    if(!stop||!end)return {doc,complete:true};
    const prefix=doc.cut(0,end);prefix.check();return {doc:prefix,complete:false};
  }
  function preview(text,lines,limit=3584){
    const clipped=clip(parse(text),lines,limit);return {text:clipped.complete?text:serialize(clipped.doc),complete:clipped.complete};
  }
  function message(record){
    const old=records.get(record);if(old?.source===record.text)return old;
    const doc=parse(record.text),result={source:record.text,doc,text:doc.textBetween(0,doc.content.size,'\n','\n')};records.set(record,result);return result;
  }
  function bounded(record){const entry=message(record);return entry.preview||(entry.preview=clip(entry.doc,96,16384).doc);}
  function toggleCheck(text,index){
    const doc=parse(text);let at=-1,count=0,checked=false;
    doc.descendants((node,pos)=>{if(node.type===schema.nodes.list_item&&node.attrs.checked!==null){if(count++===index){at=pos;checked=node.attrs.checked;}}});
    if(at<0)return text;
    const state=imRichDeps.state.EditorState.create({doc});return serialize(state.tr.setNodeMarkup(at,null,{checked:!checked}).doc);
  }
  function render(target,doc,onCheck){
    let checkbox=0;const document=target.ownerDocument;
    function nodeDOM(node){
      if(node.isText){let out=document.createTextNode(node.text);for(const mark of node.marks){const wrap=document.createElement(mark.type===schema.marks.strong?'strong':'s');wrap.append(out);out=wrap;}return out;}
      if(node.type===schema.nodes.hard_break)return document.createTextNode('\n');
      const names={paragraph:'p',heading:'h'+node.attrs.level,blockquote:'blockquote',bullet_list:'ul',ordered_list:'ol',list_item:'li'};
      const out=document.createElement(names[node.type.name]||'div');
      if(node.type===schema.nodes.ordered_list&&node.attrs.order!==1)out.start=node.attrs.order;
      if(node.type===schema.nodes.list_item&&node.attrs.checked!==null){
        out.dataset.checked=String(node.attrs.checked);const index=checkbox++,check=document.createElement('button');check.type='button';check.className='im-md-check';check.setAttribute('role','checkbox');check.setAttribute('aria-checked',String(node.attrs.checked));check.setAttribute('aria-label',node.attrs.checked?'Mark item incomplete':'Mark item complete');check.textContent=node.attrs.checked?'✓':'';
        if(onCheck)check.addEventListener('click',event=>{event.stopPropagation();if(check.isConnected)onCheck(index);});else{check.disabled=true;check.tabIndex=-1;}
        out.append(check);
      }
      node.forEach(child=>out.append(nodeDOM(child)));return out;
    }
    const fragment=document.createDocumentFragment();doc.forEach(node=>fragment.append(nodeDOM(node)));target.replaceChildren(fragment);target.classList.add('im-rich-display');
  }
  return {schema,parse,serialize,preview,message,bounded,toggleCheck,render,hasText:text=>!!parse(text).textContent.trim(),cacheStats:()=>({documents:cache.size,characters:cachedCharacters})};
})();

/* Structural keyboard behavior shared by capture fields and opened cards. */
const imMarkdownCommands=(()=>{
  const {schema}=imMarkdown,{TextSelection}=imRichDeps.state,C=imRichDeps.commands,L=imRichDeps.lists;
  function ancestor(state,type){for(let d=state.selection.$from.depth;d>0;d--)if(state.selection.$from.node(d).type===type)return {node:state.selection.$from.node(d),depth:d,pos:state.selection.$from.before(d)};return null;}
  function transactionChain(state,dispatch,work){
    let current=state,tr=state.tr,changed=false;
    const apply=next=>{for(const step of next.steps)tr.step(step);current=current.apply(next);changed=true;};
    if(!work(()=>current,apply))return false;
    if(dispatch&&changed){tr.setSelection(imRichDeps.state.Selection.fromJSON(tr.doc,current.selection.toJSON()));tr.setStoredMarks(current.storedMarks);dispatch(tr.scrollIntoView());}
    return true;
  }
  function exitFormat(state,dispatch){
    return transactionChain(state,dispatch,(get,apply)=>{
      let current=get();
      if(current.selection instanceof imRichDeps.state.AllSelection){apply(current.tr.setSelection(TextSelection.atEnd(current.doc)));current=get();}
      if(current.selection.$from.depth>1&&current.selection.$from.parent.content.size===0){
        if(!C.liftEmptyBlock(current,apply))C.splitBlockAs(()=>({type:schema.nodes.paragraph}))(current,apply);
      }else if(!C.splitBlockAs(()=>({type:schema.nodes.paragraph}))(current,apply))return false;
      let previous=-1;
      while(get().selection.$from.depth>1&&get().selection.$from.depth!==previous){previous=get().selection.$from.depth;if(!C.lift(get(),apply))break;}
      current=get();
      if(current.selection.$from.parent.type!==schema.nodes.paragraph)C.setBlockType(schema.nodes.paragraph)(current,apply);
      apply(get().tr.setStoredMarks([]));return true;
    });
  }
  function lineBreak(state,dispatch){
    if(dispatch){const marks=state.storedMarks||state.selection.$from.marks();dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create(),false).ensureMarks(marks).scrollIntoView());}return true;
  }
  function enter(state,dispatch){
    const item=ancestor(state,schema.nodes.list_item),marks=state.storedMarks||state.selection.$from.marks();
    const apply=tr=>dispatch?.(tr.ensureMarks(marks));
    if(item&&L.splitListItem(schema.nodes.list_item,{checked:item.node.attrs.checked===null?null:false})(state,apply))return true;
    if(C.liftEmptyBlock(state,apply))return true;
    return C.splitBlockAs(()=>({type:schema.nodes.paragraph}))(state,apply);
  }
  function structural(state){return state.selection.$from.parent.type===schema.nodes.heading||!!ancestor(state,schema.nodes.list_item)||!!ancestor(state,schema.nodes.blockquote);}
  function selectedItems(tr,checked){
    const items=new Set();selectedTextblocks({doc:tr.doc,selection:tr.selection},(node,pos)=>{
      const item=ancestor({selection:TextSelection.create(tr.doc,pos+1)},schema.nodes.list_item);if(item)items.add(item.pos);
    });
    for(const pos of items)tr.setNodeMarkup(pos,null,{checked});return tr;
  }
  function textSelection(state,dispatch,command){
    return transactionChain(state,dispatch,(get,apply)=>{
      if(get().selection instanceof imRichDeps.state.AllSelection)apply(get().tr.setSelection(TextSelection.between(TextSelection.atStart(get().doc).$from,TextSelection.atEnd(get().doc).$to)));
      return command(get(),apply);
    });
  }
  // Block commands must not expand a nonempty highlight to its surrounding
  // paragraph. Split the end first, then the start, including wrapper boundaries
  // where the schema allows it. All steps remain one undoable transaction.
  function exactSelection(state,dispatch,command,listMode=false){
    if(state.selection.empty)return command(state,dispatch);
    return transactionChain(state,dispatch,(get,apply)=>{
      const tr=get().tr,{anchor,head}=get().selection;let {from,to,$from,$to}=get().selection;
      // A range ending at the next paragraph's first caret has not selected
      // that paragraph. Native blockRange otherwise includes it anyway.
      if($to.parent.isTextblock&&$to.parentOffset===0&&$to.before()>from)to=TextSelection.findFrom(tr.doc.resolve($to.before()),-1,true)?.from??to;
      if($from.parent.isTextblock&&$from.parentOffset===$from.parent.content.size&&$from.after()<to)from=TextSelection.findFrom(tr.doc.resolve($from.after()),1,true)?.from??from;
      function boundary(original,assoc){
        let pos=tr.mapping.map(original,assoc),$pos=tr.doc.resolve(pos);
        const list=listMode?nearestList({selection:TextSelection.create(tr.doc,pos)}):null;
        // List commands isolate the nearest list, keeping an enclosing quote or
        // parent item intact. A plain paragraph only needs a textblock split.
        const scope=listMode?(list?tr.doc.resolve(list.pos).depth+1:$pos.depth):1;
        while($pos.depth&&($pos.parentOffset===0||$pos.parentOffset===$pos.parent.content.size)){
          pos=$pos.parentOffset===0?$pos.before():$pos.after();$pos=tr.doc.resolve(pos);
        }
        for(let depth=$pos.depth-scope+1;depth>0;depth--){
          // A nested list item must start with a paragraph. Try shallower
          // splits rather than inserting empty parent items or invalid nodes.
          const trial=get().tr;for(const step of tr.steps)trial.step(step);
          const typesAfter=[];
          for(let level=$pos.depth-depth+1;level<=$pos.depth;level++){
            const node=$pos.node(level);typesAfter.push(node.type===schema.nodes.ordered_list?{type:node.type,attrs:{...node.attrs,order:node.attrs.order+$pos.index(level)}}:null);
          }
          try{trial.split(pos,depth,typesAfter);}catch{continue;}
          for(let i=tr.steps.length;i<trial.steps.length;i++)tr.step(trial.steps[i]);return;
        }
      }
      boundary(to,-1);boundary(from,1);
      const first=tr.mapping.map(from,1),last=tr.mapping.map(to,-1);
      tr.setSelection(TextSelection.between(tr.doc.resolve(anchor<=head?first:last),tr.doc.resolve(anchor<=head?last:first)));
      if(tr.steps.length||!tr.selection.eq(get().selection))apply(tr);
      return command(get(),apply);
    });
  }
  const joinFormats=(before,after)=>before.type===after.type&&(before.type===schema.nodes.blockquote||before.type===schema.nodes.bullet_list||before.type===schema.nodes.ordered_list&&before.attrs.order+before.childCount===after.attrs.order);
  function joinSelectedFormats(tr){
    // Joining surrounding quotes can expose another join one level below it.
    // Inspect only boundaries intersecting this highlight and its wrappers.
    for(;;){
      const from=Math.max(0,tr.selection.from-tr.selection.$from.depth),to=Math.min(tr.doc.content.size,tr.selection.to+tr.selection.$to.depth),points=[];
      const scan=(node,start)=>{let previous=null;node.forEach((child,offset)=>{const pos=start+offset;if(previous&&pos>=from&&pos<=to&&joinFormats(previous,child))points.push(pos);previous=child;});};
      scan(tr.doc,0);tr.doc.nodesBetween(from,to,(node,pos)=>{if(!node.isLeaf)scan(node,pos+1);});
      if(!points.length)return tr;
      for(const pos of points.sort((a,b)=>b-a))tr.join(pos);
    }
  }
  function formatCommand(command,listMode=false){
    return (state,dispatch)=>textSelection(state,dispatch?tr=>dispatch(imRichDeps.history.closeHistory(tr.docChanged?joinSelectedFormats(tr):tr)):undefined,(state,dispatch)=>exactSelection(state,dispatch,command,listMode));
  }
  function toggleList(kind){return formatCommand(listCommand(kind),true);}
  function quote(state,dispatch){return formatCommand(quoteCommand)(state,dispatch);}
  function nearestList(state){const item=ancestor(state,schema.nodes.list_item);if(item&&state.selection.$from.before()!==item.pos+1)return null;for(let depth=state.selection.$from.depth;depth>0;depth--){const node=state.selection.$from.node(depth);if([schema.nodes.bullet_list,schema.nodes.ordered_list].includes(node.type))return {node,pos:state.selection.$from.before(depth)};}return null;}
  function listKind(state){
    let kind=null,mixed=false;
    selectedTextblocks(state,(node,pos)=>{
      const selection=TextSelection.create(state.doc,pos+1),current={selection},item=ancestor(current,schema.nodes.list_item),list=nearestList(current);
      if(!state.selection.empty&&!node.textContent.trim()&&!list)return;
      const value=!item||!list?null:item.node.attrs.checked!==null?'checklist':list.node.type===schema.nodes.ordered_list?'ordered':'bullet';
      if(value===null||kind!==null&&kind!==value)mixed=true;else kind=value;
    });return mixed?null:kind;
  }
  function quoteActive(state){let count=0,active=true;selectedTextblocks(state,(node,pos)=>{count++;if(!ancestor({selection:TextSelection.create(state.doc,pos+1)},schema.nodes.blockquote))active=false;});return count>0&&active;}
  function preserveListGaps(tr){
    const list=nearestList({selection:tr.selection});if(!list)return null;
    const items=[],leading=[];let changed=false,invalid=false;
    list.node.forEach(item=>{
      const paragraph=item.firstChild;
      if(item.childCount!==1||paragraph.type!==schema.nodes.paragraph||paragraph.textContent.trim()) {items.push(item);return;}
      changed=true;
      if(!items.length){leading.push(paragraph);return;}
      const previous=items.pop(),body=previous.lastChild;
      if(!body.isTextblock){invalid=true;return;}
      const content=body.content.append(imRichDeps.model.Fragment.from(schema.nodes.hard_break.create())).append(paragraph.content);
      const children=[];previous.forEach((child,offset,index)=>children.push(index===previous.childCount-1?body.copy(content):child));
      items.push(previous.copy(imRichDeps.model.Fragment.fromArray(children)));
    });
    if(invalid)return null;
    if(!changed)return tr;
    // A highlighted blank area does not become an empty list. A caret still
    // starts a new item through the normal wrapping/Enter commands.
    if(!items.length)return null;
    const replacement=imRichDeps.model.Fragment.fromArray([...leading,list.node.copy(imRichDeps.model.Fragment.fromArray(items))]);
    const $pos=tr.doc.resolve(list.pos),index=$pos.index();if(!$pos.parent.canReplace(index,index+1,replacement))return null;
    const backward=tr.selection.anchor>tr.selection.head;
    tr.replaceWith(list.pos,list.pos+list.node.nodeSize,replacement);
    const start=tr.doc.resolve(list.pos),end=tr.doc.resolve(list.pos+replacement.size);
    tr.setSelection(TextSelection.between(backward?end:start,backward?start:end));return tr;
  }
  function listCommand(kind){return (state,dispatch)=>textSelection(state,dispatch?tr=>dispatch(imRichDeps.history.closeHistory(tr)):undefined,(state,dispatch)=>{
    const type=kind==='ordered'?schema.nodes.ordered_list:schema.nodes.bullet_list;
    let list=nearestList(state);
    if(!list&&listKind(state)!==null)selectedTextblocks(state,(node,pos)=>{if(!list)list=nearestList({selection:TextSelection.create(state.doc,pos+1)});});
    if(list){
      if(!state.selection.empty&&listKind(state)===kind&&state.selection.to<=list.pos+list.node.nodeSize&&!state.doc.textBetween(list.pos,state.selection.from)&&!state.doc.textBetween(state.selection.to,list.pos+list.node.nodeSize)){
        const unwrap=node=>{
          if(node.type===schema.nodes.bullet_list||node.type===schema.nodes.ordered_list){const result=[];node.forEach(item=>item.forEach(child=>result.push(...unwrap(child))));return result;}
          if(node.isTextblock)return [node];
          const children=[];node.forEach(child=>children.push(...unwrap(child)));return [node.copy(imRichDeps.model.Fragment.fromArray(children))];
        };
        const replacement=imRichDeps.model.Fragment.fromArray(unwrap(list.node)),$pos=state.doc.resolve(list.pos),index=$pos.index();
        if(!$pos.parent.canReplace(index,index+1,replacement))return false;
        if(dispatch){const tr=state.tr.replaceWith(list.pos,list.pos+list.node.nodeSize,replacement),start=tr.doc.resolve(Math.min(state.selection.from,list.pos)),end=tr.doc.resolve(state.selection.to>list.pos+list.node.nodeSize?tr.mapping.map(state.selection.to):list.pos+replacement.size);
          tr.setSelection(TextSelection.between(state.selection.anchor<=state.selection.head?start:end,state.selection.anchor<=state.selection.head?end:start));dispatch(tr.scrollIntoView());}
        return true;
      }
      if(listKind(state)===kind)return transactionChain(state,dispatch,(get,apply)=>{
        while(listKind(get())===kind){
          const current=get();if(L.liftListItem(schema.nodes.list_item)(current,apply))continue;
          const scopes=[];current.doc.nodesBetween(current.selection.from,current.selection.to,(node,pos)=>{if(![schema.nodes.bullet_list,schema.nodes.ordered_list].includes(node.type))return;scopes.push({node,pos});return false;});
          if(!scopes.length)return false;const tr=current.tr;
          for(const {node,pos} of scopes.reverse()){
            const selection=TextSelection.between(tr.doc.resolve(Math.max(current.selection.from,pos+1)),tr.doc.resolve(Math.min(current.selection.to,pos+node.nodeSize-1)));
            const part=imRichDeps.state.EditorState.create({doc:tr.doc,selection});
            if(!L.liftListItem(schema.nodes.list_item)(part,next=>{for(const step of next.steps)tr.step(step);}))return false;
          }
          apply(tr.setSelection(current.selection.map(tr.doc,tr.mapping)));
        }return true;
      });
      if(state.selection.to>list.pos+list.node.nodeSize)return false;
      if(dispatch){const tr=state.tr;if(list.node.type!==type)tr.setNodeMarkup(list.pos,type,type===schema.nodes.ordered_list?{order:1}:null);dispatch(selectedItems(tr,kind==='checklist'?false:null).scrollIntoView());}return true;
    }
    return transactionChain(state,dispatch,(get,apply)=>{
      lineBlocks(schema.nodes.paragraph,null,true)(get(),apply);
      C.setBlockType(schema.nodes.paragraph)(get(),apply);
      let wrapped=null;
      if(!L.wrapInList(type)(get(),tr=>{if(kind==='checklist')selectedItems(tr,false);wrapped=get().selection.empty?tr:preserveListGaps(tr);} )||!wrapped)return false;
      apply(wrapped);return true;
    });
  });}
  function quoteCommand(state,dispatch){
    if(dispatch){const send=dispatch;dispatch=tr=>send(imRichDeps.history.closeHistory(tr));}
    if(!quoteActive(state)){
      const wrap=C.wrapIn(schema.nodes.blockquote),range=state.selection.$from.blockRange(state.selection.$to);
      const bounded=state.selection.empty||range&&!state.doc.textBetween(range.start,state.selection.from)&&!state.doc.textBetween(state.selection.to,range.end);
      if(bounded&&wrap(state,dispatch))return true;
      const list=nearestList(state);
      if(!list||state.selection.to>list.pos+list.node.nodeSize||!state.selection.empty&&(state.doc.textBetween(list.pos,state.selection.from)||state.doc.textBetween(state.selection.to,list.pos+list.node.nodeSize)))return false;
      const temporary=state.apply(state.tr.setSelection(imRichDeps.state.NodeSelection.create(state.doc,list.pos)));
      return wrap(temporary,dispatch?tr=>dispatch(tr.setSelection(state.selection.map(tr.doc,tr.mapping))):undefined);
    }
    return textSelection(state,dispatch,(state,dispatch)=>transactionChain(state,dispatch,(get,apply)=>{
      while(quoteActive(get()))if(!removeQuoteLayer(get(),apply))return false;return true;
    }));
  }
  function removeQuoteLayer(state,dispatch){
    const ranges=[];
    state.doc.nodesBetween(state.selection.from,state.selection.to,(node,pos)=>{
      if(node.type!==schema.nodes.blockquote)return;
      const from=Math.max(state.selection.from,pos+1),to=Math.min(state.selection.to,pos+node.nodeSize-1);
      const range=state.doc.resolve(from).blockRange(state.doc.resolve(to),parent=>parent.type===schema.nodes.blockquote);
      if(range)ranges.push(range);return false;
    });
    if(!ranges.length){const range=state.selection.$from.blockRange(state.selection.$to,node=>node.type===schema.nodes.blockquote);if(range)ranges.push(range);}
    if(!ranges.length)return false;
    if(!state.selection.empty&&ranges.some(range=>state.doc.textBetween(range.start,state.selection.from)||state.doc.textBetween(state.selection.to,range.end)))return false;
    if(dispatch){const tr=state.tr;for(const range of ranges.reverse())tr.lift(range,range.depth-1);dispatch(tr.scrollIntoView());}return true;
  }
  function selectedTextblocks(state,visit){
    const {selection}=state;
    if(selection.empty){if(selection.$from.parent.isTextblock)visit(selection.$from.parent,selection.$from.before());return;}
    state.doc.nodesBetween(selection.from,selection.to,(node,pos)=>{
      if(!node.isTextblock)return;
      const start=pos+1,end=start+node.content.size;
      if(selection.to>start&&(!node.content.size||selection.from<end))visit(node,pos);
      return false;
    });
  }
  function quoteLine(state,dispatch){return transactionChain(state,dispatch,(get,apply)=>{
    lineBlocks(schema.nodes.paragraph,null,true)(get(),apply);return C.wrapIn(schema.nodes.blockquote)(get(),apply);
  });}
  function headingLevel(state){
    if(state.selection.empty){const node=state.selection.$from.parent;return node.type===schema.nodes.heading?node.attrs.level:null;}
    let level=null,mixed=false;
    selectedTextblocks(state,node=>{
      if(mixed)return;
      if(node.type!==schema.nodes.heading){mixed=true;return;}
      if(level!==null&&level!==node.attrs.level)mixed=true;else level=node.attrs.level;
    });
    return mixed?null:level;
  }
  function heading(level){return (state,dispatch)=>{
    const type=headingLevel(state)===level?schema.nodes.paragraph:schema.nodes.heading;
    return lineBlocks(type,type===schema.nodes.heading?{level}:null)(state,dispatch);
  };}
  function lineBlocks(type,attrs,splitSame=false){return (state,dispatch)=>{
    const changes=[];
    // A pasted plain-text note can be one paragraph containing many hard
    // breaks. Bound the heading to its selected lines before changing type.
    selectedTextblocks(state,(node,pos)=>{
      let hasBreak=false;node.forEach(child=>{if(child.type===schema.nodes.hard_break||child.isText&&/[\r\n]/.test(child.text))hasBreak=true;});
      if(node.type===type&&(type!==schema.nodes.heading||node.attrs.level===attrs.level)&&(!splitSame||!hasBreak))return;
      const lines=[];let start=0;
      const boundary=(offset,size)=>{lines.push({from:start,to:offset});start=offset+size;};
      node.forEach((child,offset)=>{
        if(child.type===schema.nodes.hard_break)boundary(offset,1);
        else if(child.isText){const breaks=/\r\n?|\n/g;let match;while((match=breaks.exec(child.text)))boundary(offset+match.index,match[0].length);}
      });
      lines.push({from:start,to:node.content.size});
      const firstOffset=Math.max(0,state.selection.from-pos-1),lastOffset=state.selection.empty?firstOffset:Math.min(node.content.size,Math.max(0,state.selection.to-pos-2));
      const lineAt=offset=>{const index=lines.findIndex(line=>offset<=line.to);return index<0?lines.length-1:index;};
      const first=lineAt(firstOffset),last=lineAt(lastOffset),pieces=[];
      const piece=(from,to,selected)=>pieces.push({from,to,node:selected?type.create(attrs,node.content.cut(from,to),node.marks):node.copy(node.content.cut(from,to))});
      const unchanged=(from,to)=>{
        // A leading soft break in a paragraph is stored as an empty Markdown
        // paragraph. Make that boundary explicit so saving/reopening agrees.
        while(node.type===schema.nodes.paragraph&&from<to&&lines[from].from===lines[from].to){piece(lines[from].from,lines[from].to,false);from++;}
        piece(lines[from].from,lines[to].to,false);
      };
      if(first)unchanged(0,first-1);
      for(let i=first;i<=last;i++)piece(lines[i].from,lines[i].to,true);
      if(last<lines.length-1)unchanged(last+1,lines.length-1);
      const $pos=state.doc.resolve(pos),index=$pos.index(),replacement=imRichDeps.model.Fragment.fromArray(pieces.map(piece=>piece.node));
      changes.push({pos,node,pieces,replacement,valid:$pos.parent.canReplace(index,index+1,replacement)});
    });
    if(!changes.length||changes.some(change=>!change.valid))return false;
    if(!dispatch)return true;
    const tr=state.tr;
    for(let i=changes.length-1;i>=0;i--){const change=changes[i];if(change.pieces.length===1)tr.setNodeMarkup(change.pos,type,attrs);else tr.replaceWith(change.pos,change.pos+change.node.nodeSize,change.replacement);}
    const mapPosition=old=>{
      const change=changes.find(change=>old>=change.pos&&old<=change.pos+change.node.nodeSize);
      if(!change)return tr.mapping.map(old);
      const offset=old-change.pos-1;let next=tr.mapping.map(change.pos,-1);
      if(offset<0)return next+1;
      for(const piece of change.pieces){if(offset<=piece.to)return next+1+Math.max(0,offset-piece.from);next+=piece.node.nodeSize;}
      return next-1;
    };
    if(state.selection instanceof imRichDeps.state.AllSelection)tr.setSelection(new imRichDeps.state.AllSelection(tr.doc));
    else tr.setSelection(TextSelection.between(tr.doc.resolve(mapPosition(state.selection.anchor)),tr.doc.resolve(mapPosition(state.selection.head))));
    tr.setStoredMarks(state.storedMarks);dispatch(imRichDeps.history.closeHistory(tr).scrollIntoView());return true;
  };}
  function paragraphActive(state){let count=0,active=true;selectedTextblocks(state,node=>{count++;if(node.type!==schema.nodes.paragraph)active=false;});return count>0&&active;}
  function normal(state,dispatch){return lineBlocks(schema.nodes.paragraph,null)(state,dispatch);}
  function clearFormatting(state,dispatch){
    if(state.selection.empty)return false;
    let formatted=false,structural=false;selectedTextblocks(state,(node,pos)=>{const current={selection:TextSelection.create(state.doc,pos+1)};if(node.type!==schema.nodes.paragraph||ancestor(current,schema.nodes.blockquote)||ancestor(current,schema.nodes.list_item))formatted=structural=true;});
    state.doc.nodesBetween(state.selection.from,state.selection.to,node=>{if(node.marks.length)formatted=true;});
    if(!formatted)return false;
    if(!structural){if(dispatch)dispatch(imRichDeps.history.closeHistory(state.tr.removeMark(state.selection.from,state.selection.to).setStoredMarks([])).scrollIntoView());return true;}
    return formatCommand((state,dispatch)=>{
      const {selection,doc}=state,from=selection.$from.before(1),to=selection.$to.after(1),blocks=[];
      if(doc.textBetween(from,selection.from)||doc.textBetween(selection.to,to))return false;
      doc.nodesBetween(from,to,node=>{if(!node.isTextblock)return;const inline=[];node.forEach(child=>inline.push(child.mark([])));blocks.push(schema.nodes.paragraph.create(null,inline));return false;});
      if(!blocks.length)return false;
      if(dispatch){const replacement=imRichDeps.model.Fragment.fromArray(blocks),tr=state.tr.replaceWith(from,to,replacement),start=tr.doc.resolve(from),end=tr.doc.resolve(from+replacement.size),backward=selection.anchor>selection.head;
        tr.setSelection(TextSelection.between(backward?end:start,backward?start:end)).setStoredMarks([]);dispatch(tr.scrollIntoView());}
      return true;
    })(state,dispatch);
  }
  function markActive(state,name){const type=schema.marks[name],{$from,empty,from,to}=state.selection;return empty?!!type.isInSet(state.storedMarks||$from.marks()):state.doc.rangeHasMark(from,to,type);}
  return {ancestor,exitFormat,lineBreak,enter,structural,toggleList,listKind,quote,quoteActive,quoteLine,headingLevel,heading,normal,paragraphActive,clearFormatting,markActive};
})();

/* A local ProseMirror field with a small imperative bridge for both interfaces. */
const imRichField=(()=>{
  const {schema}=imMarkdown,{EditorView}=imRichDeps.view,{EditorState,TextSelection}=imRichDeps.state;
  const C=imRichDeps.commands,K=imMarkdownCommands;let live=0;
  function plainDoc(text){const content=[];text.split(/\r\n?|\n/).forEach((part,i)=>{if(i)content.push(schema.nodes.hard_break.create());if(part)content.push(schema.text(part));});return schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,content));}
  function create(options={}){
    const dom=document.createElement('div'),wrapper=document.createElement('div'),main=document.createElement('div'),toolbar=document.createElement('div');
    wrapper.className='im-rich-field';main.className='im-rich-main';toolbar.className='im-format-toolbar';toolbar.hidden=true;toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Text formatting');
    let config={...options},source=String(options.value??'').replace(/\r\n?/g,'\n'),plain=!!options.plain,context=options.context??'',readOnly=!!options.readOnly,disabled=!!options.disabled,destroyed=false,ime=false,lastIME=0,view,focusRunning=false;
    const formatting=!options.capture,controls=new Map(),headingLevels=new Map();let send,floating,enterKeyActive=false,enterKeyHandled=false,enterModifiers=null,enterPairTimer=0;
    function markEnterHandled(){enterKeyHandled=enterKeyActive;clearTimeout(enterPairTimer);enterPairTimer=setTimeout(()=>{enterKeyHandled=false;},0);}
    function action(label,content,command){
      const b=document.createElement('button');b.type='button';b.className='im-format-action';b.title=label;b.setAttribute('aria-label',label);b.textContent=content;
      b.addEventListener('pointerdown',event=>{if(event.button===0)event.preventDefault();});
      b.addEventListener('click',event=>{event.stopPropagation();if(!disabled&&!readOnly){command();view.focus();floating?.update();}});return b;
    }
    const toggle=action('Text formatting','Aa',()=>{floating?.toggle();});toggle.classList.add('im-format-toggle');toggle.setAttribute('aria-expanded','false');
    const execute=command=>command(view.state,view.dispatch,view);
    function refresh(){
      dom.dataset.empty=String(view.state.doc.childCount===1&&view.state.doc.firstChild.type===schema.nodes.paragraph&&!view.state.doc.firstChild.content.size);
      const state=view.state,headingLevel=K.headingLevel(state);
      for(const [key,button] of controls){
        let active=false;
        if(key==='strong'||key==='strike')active=K.markActive(state,key);
        else if(key==='quote')active=K.quoteActive(state);
        else if(['bullet','ordered','checklist'].includes(key))active=K.listKind(state)===key;
        else if(key==='normal')active=K.paragraphActive(state);
        button.setAttribute('aria-pressed',String(active));button.disabled=disabled||readOnly;
      }
      for(const [level,button] of headingLevels){button.setAttribute('aria-pressed',String(headingLevel===level));button.disabled=disabled||readOnly;}
      const clear=toolbar.querySelector('.im-format-clear');if(clear)clear.disabled=disabled||readOnly||state.selection.empty;
      toggle.disabled=disabled||readOnly;toggle.hidden=plain||!formatting;
      if(send)send.disabled=disabled||readOnly||!view.state.doc.textContent.trim();
      if(plain){toolbar.hidden=true;toggle.setAttribute('aria-expanded','false');}
      floating?.update();
    }
    function editableChanged(){view.setProps({editable:()=>!disabled&&!readOnly,attributes:attrs});for(const b of dom.querySelectorAll('.im-md-check'))b.disabled=disabled||readOnly;refresh();}
    function enter(event){
      if(event.isComposing||event.keyCode===229||ime||view.composing){lastIME=performance.now();return false;}
      if(event.key!=='Enter')return false;
      if(disabled||readOnly)return false;
      if(event.metaKey||event.ctrlKey){execute(K.exitFormat);return true;}
      if(event.shiftKey){execute(K.lineBreak);return true;}
      if(config.capture&&!K.structural(view.state)){if(!event.repeat)config.onSubmit?.();return true;}
      execute(K.enter);return true;
    }
    const history=imRichDeps.history;
    const documentEdge=(last,extend=false)=>(state,dispatch)=>{const edge=last?TextSelection.atEnd(state.doc).head:TextSelection.atStart(state.doc).head;if(dispatch)dispatch(state.tr.setSelection(TextSelection.create(state.doc,extend?state.selection.anchor:edge,edge)).scrollIntoView());return true;};
    const shortcuts={
      'Alt-F10':()=>floating?.focus()||false,
      'Mod-a':(state,dispatch,currentView)=>{currentView.focus();return C.selectAll(currentView.state,dispatch);},
      'Ctrl-b':C.toggleMark(schema.marks.strong),'Meta-b':C.toggleMark(schema.marks.strong),
      'Ctrl-Shift-x':C.toggleMark(schema.marks.strike),'Meta-Shift-x':C.toggleMark(schema.marks.strike),
      'Ctrl-z':history.undo,'Meta-z':history.undo,'Shift-Ctrl-z':history.redo,'Shift-Meta-z':history.redo,'Ctrl-y':history.redo,
      'Tab':imRichDeps.lists.sinkListItem(schema.nodes.list_item),'Shift-Tab':imRichDeps.lists.liftListItem(schema.nodes.list_item)
    };
    for(const modifier of ['Ctrl','Meta'])for(const [key,last] of [['Home',false],['End',true]]){shortcuts[modifier+'-'+key]=documentEdge(last);shortcuts['Shift-'+modifier+'-'+key]=documentEdge(last,true);}
    function typingRules(){
      const R=imRichDeps.inputrules;
      const logicalLine=(pattern,command)=>new R.InputRule(pattern,(state,match,start,end)=>{
        if(state.selection.$from.parent.type!==schema.nodes.paragraph||K.ancestor(state,schema.nodes.list_item))return null;
        // The match includes the preceding hard break; leave that boundary intact.
        const tr=state.tr.delete(start+1,end),current=state.apply(tr);
        if(!command(match)(current,next=>{for(const step of next.steps)tr.step(step);tr.setSelection(imRichDeps.state.Selection.fromJSON(tr.doc,next.selection.toJSON()));tr.setStoredMarks(next.storedMarks);}))return null;
        return tr;
      });
      const rules=[
        logicalLine(/\ufffc[ \t]*[-+*][ \t]$/,()=>K.toggleList('bullet')),
        logicalLine(/\ufffc[ \t]*(\d+)\.[ \t]$/,match=>(state,dispatch)=>K.toggleList('ordered')(state,tr=>{
          const list=K.ancestor({selection:tr.selection},schema.nodes.ordered_list);if(list)tr.setNodeMarkup(list.pos,null,{order:Math.max(1,Number(match[1]))});dispatch(tr);
        })),
        logicalLine(/\ufffc[ \t]*(#{1,6})[ \t]$/,match=>K.heading(match[1].length)),
        logicalLine(/\ufffc[ \t]*>[ \t]$/,()=>K.quoteLine),
        R.wrappingInputRule(/^\s*>\s$/,schema.nodes.blockquote),
        R.wrappingInputRule(/^\s*([-+*])\s$/,schema.nodes.bullet_list),
        R.wrappingInputRule(/^(\d+)\.\s$/,schema.nodes.ordered_list,m=>({order:Number(m[1])})),
        R.textblockTypeInputRule(/^(#{1,6})\s$/,schema.nodes.heading,m=>({level:m[1].length})),
        new R.InputRule(/^\[([ xX])\]\s$/,(state,match,start,end)=>{
          const item=K.ancestor(state,schema.nodes.list_item);if(!item)return null;
          return state.tr.delete(start,end).setNodeMarkup(item.pos,null,{checked:match[1]!==' '});
        })
      ];
      for(const [pattern,mark] of [[/\*\*([^*]+)\*\*$/,schema.marks.strong],[/~~([^~]+)~~$/,schema.marks.strike]])rules.push(new R.InputRule(pattern,(state,match,start,end)=>state.tr.insertText(match[1],start,end).addMark(start,start+match[1].length,mark.create()).setStoredMarks([mark.create()])));
      return R.inputRules({rules});
    }
    const baseKeys=Object.fromEntries(Object.entries(C.baseKeymap).filter(([key])=>!key.includes('Enter')));
    function newState(value){return EditorState.create({schema,doc:plain?plainDoc(value):imMarkdown.parse(value),plugins:[history.history({depth:100}),...(!plain?[typingRules()]:[]),imRichDeps.keymap.keymap(shortcuts),imRichDeps.keymap.keymap(baseKeys)]});}
    function attrs(){return {id:config.id||'',class:(config.className||'')+' im-rich-input',role:'textbox','aria-label':config.label||'Text','aria-multiline':'true','aria-readonly':String(readOnly),'aria-disabled':String(disabled),tabindex:disabled?'-1':'0',spellcheck:'false',autocorrect:'off',autocapitalize:'off',autocomplete:'off',writingsuggestions:'false',enterkeyhint:config.capture?'send':'enter','data-placeholder':config.placeholder||''};}
    view=new EditorView({mount:dom},{state:newState(source),attributes:attrs,editable:()=>!disabled&&!readOnly,
      dispatchTransaction:transaction=>{
        const before=view.state.doc,result=view.state.applyTransaction(transaction);view.updateState(result.state);refresh();
        if(!before.eq(result.state.doc)){
          source=plain?result.state.doc.textBetween(0,result.state.doc.content.size,'\n','\n'):(transaction.getMeta('im-paste-source')??imMarkdown.serialize(result.state.doc));
          config.onChange?.(source);dom.dispatchEvent(new CustomEvent('im-markdown-change',{bubbles:true}));config.onResize?.();
        }
      },
      handleKeyDown:(v,event)=>{
        if(event.key==='Escape'&&!dom.closest('dialog')&&floating?.dismiss()){event.preventDefault();event.stopPropagation();return true;}
        if((event.key==='End'||event.key==='Home')&&v.state.selection instanceof imRichDeps.state.AllSelection){v.dispatch(v.state.tr.setSelection(event.key==='End'?TextSelection.atEnd(v.state.doc):TextSelection.atStart(v.state.doc)).scrollIntoView());return true;}
        if(event.key!=='Enter'){config.onKeyDown?.(event);if(event.defaultPrevented)return true;}const handled=enter(event);if(handled)markEnterHandled();return handled;
      },
      handlePaste:(v,event)=>{
        if(plain||disabled||readOnly||event.clipboardData?.getData('text/html'))return false;
        const text=event.clipboardData?.getData('text/plain');if(!text)return false;
        const doc=imMarkdown.parse(text),whole=v.state.selection.from<=TextSelection.atStart(v.state.doc).from&&v.state.selection.to>=TextSelection.atEnd(v.state.doc).to,tr=whole?v.state.tr.replaceWith(0,v.state.doc.content.size,doc.content):v.state.tr.replaceSelection(new imRichDeps.model.Slice(doc.content,0,0));if(tr.doc.eq(doc))tr.setMeta('im-paste-source',text.replace(/\r\n?/g,'\n'));v.dispatch(tr.scrollIntoView());return true;
      },
      handleDOMEvents:{
        keydown:(v,event)=>{if(event.key==='Enter'){enterKeyActive=true;enterKeyHandled=false;enterModifiers={key:'Enter',shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,repeat:event.repeat};}else{enterKeyActive=false;enterKeyHandled=false;}return false;},
        keyup:(v,event)=>{if(event.key==='Enter'){enterKeyActive=false;enterKeyHandled=false;}return false;},
        blur:()=>{enterKeyActive=false;enterKeyHandled=false;return false;},
        compositionstart:()=>{ime=true;enterKeyActive=false;enterKeyHandled=false;floating?.update();return false;},compositionend:()=>{ime=false;lastIME=performance.now();return false;},
        beforeinput:(v,event)=>{
          if(!['insertParagraph','insertLineBreak'].includes(event.inputType)||event.isComposing||ime||view.composing||performance.now()-lastIME<40)return false;
          if(disabled||readOnly)return false;
          event.preventDefault();
          // The pinned ProseMirror view schedules an iOS Enter fallback on
          // keydown. We handle beforeinput ourselves, so cancel that fallback
          // before it can run the same command again 200ms later.
          view.input.lastIOSEnter=0;clearTimeout(view.input.lastIOSEnterFallbackTimeout);
          if(enterKeyActive&&enterKeyHandled)return true;
          markEnterHandled();
          enter(enterKeyActive?enterModifiers:{key:'Enter'});return true;
        }
      },
      nodeViews:{list_item:(initial,v,getPos)=>{
        let node=initial,check=null;const li=document.createElement('li'),contentDOM=document.createElement('div');contentDOM.className='im-md-item';
        const click=event=>{event.preventDefault();event.stopPropagation();const pos=getPos();if(!disabled&&!readOnly&&typeof pos==='number'){v.dispatch(v.state.tr.setNodeMarkup(pos,null,{checked:!node.attrs.checked}));v.focus();}};
        const update=next=>{
          if(next.type!==schema.nodes.list_item)return false;node=next;
          const task=node.attrs.checked!==null;li.toggleAttribute('data-task',task);
          if(!task){delete li.dataset.checked;check?.remove();check=null;return true;}
          if(!check){check=document.createElement('button');check.type='button';check.className='im-md-check';check.contentEditable='false';check.setAttribute('role','checkbox');check.addEventListener('pointerdown',event=>event.preventDefault());check.addEventListener('click',click);li.prepend(check);}
          li.dataset.checked=String(node.attrs.checked);check.disabled=disabled||readOnly;check.setAttribute('aria-checked',String(node.attrs.checked));check.setAttribute('aria-label',node.attrs.checked?'Mark item incomplete':'Mark item complete');check.textContent=node.attrs.checked?'✓':'';return true;
        };
        li.append(contentDOM);update(node);
        return {dom:li,contentDOM,update,stopEvent:event=>!!check?.contains(event.target),ignoreMutation:m=>!!check?.contains(m.target),destroy:()=>check?.removeEventListener('click',click)};
      }}
    });
    live++;
    const nativeFocus=dom.focus.bind(dom);dom.focus=opts=>{nativeFocus(opts);if(!focusRunning){focusRunning=true;try{view.focus();}finally{focusRunning=false;}}};
    function setValue(value,reset=false){
      value=String(value??'').replace(/\r\n?/g,'\n');if(!reset&&value===source)return;
      source=value;const parsed=plain?plainDoc(value):imMarkdown.parse(value);
      if(reset||!parsed.eq(view.state.doc))view.updateState(newState(value));refresh();
    }
    const start=()=>TextSelection.atStart(view.state.doc).from,end=()=>TextSelection.atEnd(view.state.doc).to;
    const offset=pos=>pos===end()?source.length:pos===start()?0:Math.max(0,pos-1);
    function position(value){return value<=0?start():value>=source.length?end():Math.min(end(),Math.max(start(),value+1));}
    Object.defineProperties(dom,{
      value:{get:()=>source,set:value=>setValue(value)},
      readOnly:{get:()=>readOnly,set:value=>{if(readOnly!==!!value){readOnly=!!value;editableChanged();}}},
      disabled:{get:()=>disabled,set:value=>{if(disabled!==!!value){disabled=!!value;editableChanged();}}},
      placeholder:{get:()=>config.placeholder||'',set:value=>{if(config.placeholder!==String(value)){config.placeholder=String(value);view.setProps({attributes:attrs});}}},
      selectionStart:{get:()=>offset(view.state.selection.from)},selectionEnd:{get:()=>offset(view.state.selection.to)},
      selectionDirection:{get:()=>view.state.selection.anchor>view.state.selection.head?'backward':'forward'}
    });
    dom.setSelectionRange=(from,to,direction)=>{const a=position(from),b=position(to);view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,direction==='backward'?b:a,direction==='backward'?a:b)));};
    dom.select=()=>dom.setSelectionRange(0,source.length);
    function icon(button,name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.innerHTML=imUiIcons[name];button.replaceChildren(svg);return button;}
    function add(key,label,text,command){const b=icon(action(label,text,()=>execute(command)),{strong:'formatBold',strike:'formatStrike',quote:'formatQuote',bullet:'formatBullet',ordered:'formatNumber',checklist:'formatChecklist'}[key]);controls.set(key,b);toolbar.append(b);return b;}
    {
      add('strong','Bold','B',C.toggleMark(schema.marks.strong)).classList.add('im-format-bold');
      add('quote','Quotation block','❞',K.quote);
      add('strike','Strikethrough','S',C.toggleMark(schema.marks.strike)).classList.add('im-format-strike');
      add('bullet','Bullet list','•',K.toggleList('bullet'));
      add('ordered','Numbered list','1.',K.toggleList('ordered'));
      add('checklist','Checklist','☑',K.toggleList('checklist'));
      const styles=document.createElement('div');styles.className='im-format-text-styles';
      for(const level of [1,2]){const choice=action('Heading '+level,'H'+level,()=>execute(K.heading(level)));headingLevels.set(level,choice);styles.append(choice);}
      const ordinary=action('Normal text','Aa',()=>execute(K.normal));controls.set('normal',ordinary);styles.append(ordinary);toolbar.append(styles);
      const clear=icon(action('Clear Formatting','',()=>execute(K.clearFormatting)),'formatClear');clear.classList.add('im-format-clear');toolbar.append(clear);
      icon(toggle,'formatText');
      if(formatting)main.append(toggle);
    }
    main.append(dom);
    if(options.sendButton){send=action('Send','↑',()=>config.onSubmit?.());send.classList.add('im-rich-send');main.append(send);}
    wrapper.append(main);if(formatting)wrapper.append(toolbar);floating=imSelectionFormatting({dom,toolbar,toggle,view,manual:formatting,canFormat:()=>!plain&&!disabled&&!readOnly&&!ime&&!view.composing});refresh();
    const controller={dom,wrapper,toggle,toolbar,view,
      setContext:(key,value,plainMode=false)=>{const reset=key!==context||plain!==plainMode;if(reset){enterKeyActive=false;enterKeyHandled=false;floating?.reset();}context=key;plain=plainMode;setValue(value,reset);},
      configure:next=>{const before=JSON.stringify(attrs());config={...config,...next};if(next.disabled!==undefined)disabled=!!next.disabled;if(next.readOnly!==undefined)readOnly=!!next.readOnly;if(JSON.stringify(attrs())!==before)editableChanged();else refresh();},
      insertText:text=>{view.dispatch(view.state.tr.insertText(text).scrollIntoView());view.focus();},
      appendText:text=>{const selection=TextSelection.atEnd(view.state.doc),marks=view.state.storedMarks||selection.$from.marks();view.dispatch(view.state.tr.setSelection(selection).setStoredMarks(marks).insertText(text).scrollIntoView());view.focus();},
      backspaceAtEnd:()=>{view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));const state=view.state,from=state.selection.from,before=state.selection.$from.nodeBefore;if(state.selection.$from.parentOffset){const last=before?.isText?Array.from(before.text).at(-1):'';view.dispatch(state.tr.delete(from-(last?.length||1),from).scrollIntoView());}else C.joinBackward(state,view.dispatch,view);view.focus();},
      destroy:()=>{if(destroyed)return;destroyed=true;clearTimeout(enterPairTimer);floating?.destroy();view.destroy();live--;wrapper.remove();toolbar.remove();toggle.remove();},
      value:()=>source,
      get plain(){return plain;}
    };dom.imRich=controller;return controller;
  }
  return {create,stats:()=>({live})};
})();

/* Shared original SVG vectors. Only this fixed dictionary becomes markup. */
const imUiIcons = {
  formatQuote:'<path d="M4 4v16M9 6h3v3l-2 2m7-5h3v3l-2 2M9 15h11M9 19h7"/>',
  formatText:'<path d="m6 16 6-13 6 13M8 12h8M4 21h16"/>',
  formatClear:'<path d="m7 16 5-12 5 12M9 12h6M4 3l16 18M4 20h7"/>',
  formatBold:'<path d="M6 4h7a4 4 0 0 1 0 8H6Zm0 8h8a4 4 0 0 1 0 8H6Z" stroke-width="2.6"/>',
  formatStrike:'<path d="M18 7c-1-2-3-3-6-3-3 0-5 1.5-5 4 0 1.7 1 2.5 3 3M7 17c1 2 3 3 6 3 3 0 5-1.5 5-4 0-1.7-1-2.5-3-3M3 12h18"/>',
  formatBullet:'<circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/><path d="M10 6h11M10 12h11M10 18h11"/>',
  formatNumber:'<path d="m3 4 2-1v6M3 9h4M3 14c0-2 4-2 4 0 0 1-4 4-4 5h4M11 6h10M11 12h10M11 18h10"/>',
  formatChecklist:'<rect x="3" y="4" width="17" height="17" rx="3"/><path d="m7 12 3 3 6-7"/>',
  formatHeading:'<path d="M4 4v16M15 4v16M4 12h11M20 15v5"/>',
  formatParagraph:'<path d="M14 4v16M19 4v16M19 4H9a5 5 0 0 0 0 10h5"/>',
  textSize:'<path d="M3 5h12M9 5v14M5 19h8M16 11h6M19 11v8m-2 0h4"/>',
  mosaic:'<rect x="3" y="3" width="7" height="11" rx="2"/><rect x="14" y="3" width="7" height="6" rx="2"/><rect x="3" y="18" width="7" height="3" rx="1.5"/><rect x="14" y="13" width="7" height="8" rx="2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16 16 4.5 4.5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  toolbarMore:'<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></g>',
  pin:'<path d="M7 3h10l-2 5v4l3 4H6l3-4V8L7 3ZM12 16v5"/>',
  unpin:'<path d="M9 3h8l-2 5v2M6 16h12l-3-4M9 10v2l-3 4M12 16v5M3 3l18 18"/>',
  copy:'<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M15 3H5a2 2 0 0 0-2 2v11"/>',
  export:'<path d="M3 19c1-8 5-11 11-11V3l7 8-7 7v-5c-5 0-8 2-11 6Z"/>',
  reply:'<path d="M21 19c-1-8-5-11-11-11V3l-7 8 7 7v-5c5 0 8 2 11 6Z"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-3L4 16l-1 5Z"/>',
  select:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  selectAll:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7M7 18h10"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  import:'<path d="M4 15v5h16v-5M12 3v12m-5-5 5 5 5-5"/>',
  tag:'<path d="m3 4 9-1 9 9-9 9-9-9V4Z"/><circle cx="7.5" cy="7.5" r=".8"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.7-3.8 1.6 1.6 0 0 1 1.2-2.6H18a3 3 0 0 0 3-3A8.7 8.7 0 0 0 12 3Z"/><circle cx="7.5" cy="9" r=".8"/><circle cx="11" cy="6.5" r=".8"/><circle cx="15.5" cy="7.5" r=".8"/><circle cx="6.7" cy="13" r=".8"/>',
  noColor:'<path d="m4 4 16 16M9 4l-4 7a6 6 0 0 0 9 8M13 6l6 7a5 5 0 0 1-1 5"/>',
  untagged:'<path d="M3 9V4l9-1 9 9-5 5M12 21l-4-4M3 3l18 18"/><circle cx="7.5" cy="7.5" r=".7"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  merge:'<path d="M5 3v4c0 4 7 3 7 7v7M19 3v4c0 4-7 3-7 7m-4 3 4 4 4-4"/>',
  shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>'
};
/* Selection controls keep IM's established viewBox and paths in both apps. */
const imSelectionIcons={
  tag:'<path d="M4 12V6a3 3 0 0 1 3-3h9l6 7a2 2 0 0 1 0 3l-6 6H10M5 16v8M1 20h8"/><circle cx="17" cy="10" r="1.4" fill="currentColor" stroke="none"/>',
  copy:'<path d="M9 6V4a2 2 0 0 1 2-2h6l6 6v12a2 2 0 0 1-2 2h-2M17 2v6h6M5 9h9a2 2 0 0 1 2 2v13H3V11a2 2 0 0 1 2-2Z"/>',
  export:'<path d="M3 22c0-10 4-15 12-15V2l10 10-10 9v-6c-5 0-9 2-12 7Z"/>',
  cancel:'<path d="m6 6 14 14M20 6 6 20"/>',
  delete:'<path d="M4 7h18M10 7V4h6v3M6 7l1.5 17h11L20 7M11 11v9M15 11v9"/>',
  more:'<g fill="currentColor" stroke="none"><circle cx="6" cy="14" r="1.8"/><circle cx="14" cy="14" r="1.8"/><circle cx="22" cy="14" r="1.8"/></g>'
};

/* Canonical top-control vectors: both adapters use these exact sizes and paths. */
const imToolbarIcons={
 calendarSearch:{size:22,viewBox:'0 0 24 24',stroke:1.8,markup:'<path d="M11 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v5M7 2v4m9-4v4"/><path d="M3 8h17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16.5" r="4.5"/><path d="m20 20 2.5 2.5"/>'},
 // Archived two-slider vector; reserved for a future filtering control.

 filters:{size:22,viewBox:'0 0 24 24',stroke:1.8,markup:'<path d="M2 7h1m6 0h13M2 17h13m6 0h1"/><circle cx="6" cy="7" r="3"/><circle cx="18" cy="17" r="3"/>'},
 searchTags:{size:28,viewBox:'0 0 32 32',stroke:1.8,markup:'<circle cx="18" cy="11" r="7.5"/><path d="m23.5 16.5 6 6"/><path d="M5 21h7q1.5 0 2.5 1.5L17 25q1 1 0 2l-2.5 2.5Q13.5 31 12 31H5q-3 0-3-3v-4q0-3 3-3Z"/><circle cx="12" cy="26" r="1.2" fill="currentColor" stroke="none"/>'},
 untagged:{size:28,viewBox:'0 0 24 24',stroke:1.8,markup:'<path d="M4 9V5a2 2 0 0 1 2-2h8l7 7a2 2 0 0 1 0 3l-7 7a2 2 0 0 1-3 0l-4-4M3 3l18 18"/><circle cx="10" cy="7" r="1"/>'},
 searchOnly:{size:28,viewBox:'0 0 32 32',stroke:1.8,markup:'<circle cx="18" cy="11" r="7.5"/><path d="m23.5 16.5 6 6"/>'},
 more:{size:20,viewBox:'0 0 24 24',stroke:1.8,markup:imUiIcons.toolbarMore},
 check:{size:11,viewBox:'0 0 16 16',stroke:2.3,markup:'<path d="m3 8 3 3 7-7"/>'},
 cancel:{size:22,viewBox:'0 0 28 28',stroke:1.8,markup:imSelectionIcons.cancel}
};

/* One toolbar, shared between manual Aa use and selected editable text. */
function imSelectionFormatting({dom,toolbar,toggle,view,manual,canFormat}){
  const doc=dom.ownerDocument,win=doc.defaultView;let frame=0,floating=false,manualOpen=false,marker=null,dismissed='',destroyed=false,selecting=false;
  const phone=()=>/\b(?:iPhone|iPod)\b|Android.*Mobile/i.test(win.navigator.userAgent)||(win.matchMedia('(pointer:coarse) and (hover:none)').matches&&Math.min(win.screen.width,win.screen.height)<=600);
  const key=()=>`${view.state.selection.from}:${view.state.selection.to}`;
  function restore(){
    if(!floating)return;
    floating=false;toolbar.classList.remove('is-selection-format');toolbar.removeAttribute('style');
    if(marker?.parentNode)marker.replaceWith(toolbar);else toolbar.remove();marker=null;
  }
  function close(){restore();toolbar.hidden=!manualOpen;toggle.setAttribute('aria-expanded',String(manualOpen));}
  function render(){
    frame=0;if(destroyed)return;
    if(phone()){if(!canFormat()){manualOpen=false;}close();return;}
    const selection=doc.getSelection(),active=doc.activeElement;
    const inside=selection?.rangeCount&&dom.contains(selection.anchorNode)&&dom.contains(selection.focusNode);
    const selected=!view.state.selection.empty&&inside&&!selection.isCollapsed;
    if(!canFormat()||!dom.isConnected){manualOpen=false;close();return;}
    if(selecting||!selected||dismissed===key()||(!view.hasFocus()&&!toolbar.contains(active))){close();return;}
    let clip=dom.getBoundingClientRect();
    let left=clip.left,right=clip.right,top=clip.top,bottom=clip.bottom;
    for(let parent=dom.parentElement;parent&&parent!==doc.body;parent=parent.parentElement){
      const style=win.getComputedStyle(parent);
      if(/auto|scroll|hidden|clip/.test(style.overflowY+style.overflowX)){
        const rect=parent.getBoundingClientRect();left=Math.max(left,rect.left);right=Math.min(right,rect.right);top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);
      }
    }
    const vp=win.visualViewport,vLeft=vp?.offsetLeft||0,vTop=vp?.offsetTop||0,vWidth=vp?.width||win.innerWidth,vHeight=vp?.height||win.innerHeight;
    left=Math.max(left,vLeft);right=Math.min(right,vLeft+vWidth);top=Math.max(top,vTop);bottom=Math.min(bottom,vTop+vHeight);
    const range=selection.getRangeAt(0).getBoundingClientRect();
    if(!range.width||!range.height||range.right<=left||range.left>=right||range.bottom<=top||range.top>=bottom){close();return;}
    const anchor={left:Math.max(range.left,left),right:Math.min(range.right,right),top:Math.max(range.top,top),bottom:Math.min(range.bottom,bottom)};
    if(!floating){
      if(toolbar.parentNode){marker=doc.createComment('format toolbar');toolbar.before(marker);}
      (dom.closest('dialog')||doc.body).append(toolbar);floating=true;toolbar.classList.add('is-selection-format');
    }
    toolbar.hidden=false;
    Object.assign(toolbar.style,{position:'fixed',bottom:'auto',right:'auto',margin:'0',maxWidth:Math.max(0,vWidth-16)+'px',left:vLeft+8+'px',top:vTop+8+'px'});
    const box=toolbar.getBoundingClientRect(),x=Math.max(vLeft+8,Math.min((anchor.left+anchor.right-box.width)/2,vLeft+vWidth-box.width-8));
    const above=anchor.top-box.height-8,y=above>=vTop+8?above:Math.min(anchor.bottom+8,vTop+vHeight-box.height-8);
    toolbar.style.left=x+'px';toolbar.style.top=Math.max(vTop+8,y)+'px';toggle.setAttribute('aria-expanded','true');
  }
  function update(){
    if(destroyed||frame)return;
    if(view.state.selection.empty){dismissed='';if(!floating&&!manualOpen)return;}
    frame=win.requestAnimationFrame(render);
  }
  function dismiss(){if(toolbar.hidden)return false;dismissed=key();manualOpen=false;close();return true;}
  const outside=event=>{if(dom.contains(event.target)){dismissed='';selecting=true;update();return;}if(floating&&!dom.contains(event.target)&&!toolbar.contains(event.target)&&event.target!==toggle){dismissed=key();close();}};
  const selectionIntent=event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)||((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a')){dismissed='';update();}};
  const released=()=>{selecting=false;update();};
  const keys=event=>{
    if(event.key==='Escape'){if(dom.closest('dialog'))return;event.preventDefault();event.stopPropagation();dismiss();view.focus();}
    else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const buttons=[...toolbar.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length),index=buttons.indexOf(doc.activeElement);
      if(index<0)return;event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length]?.focus();
    }
  };
  doc.addEventListener('selectionchange',update);doc.addEventListener('scroll',update,{capture:true,passive:true});doc.addEventListener('pointerdown',outside,true);doc.addEventListener('pointerup',released,true);doc.addEventListener('pointercancel',released,true);win.addEventListener('resize',update);win.visualViewport?.addEventListener('resize',update);win.visualViewport?.addEventListener('scroll',update);dom.addEventListener('blur',update);dom.addEventListener('keydown',selectionIntent);toolbar.addEventListener('keydown',keys);
  return {
    update,dismiss,reset(){dismissed='';manualOpen=false;close();},
    toggle(){manualOpen=manual&&!manualOpen;dismissed=key();close();},
    focus(){if(toolbar.hidden)return false;toolbar.querySelector('button:not(:disabled)')?.focus();return true;},
    destroy(){destroyed=true;if(frame)win.cancelAnimationFrame(frame);doc.removeEventListener('selectionchange',update);doc.removeEventListener('scroll',update,true);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('pointerup',released,true);doc.removeEventListener('pointercancel',released,true);win.removeEventListener('resize',update);win.visualViewport?.removeEventListener('resize',update);win.visualViewport?.removeEventListener('scroll',update);dom.removeEventListener('blur',update);dom.removeEventListener('keydown',selectionIntent);toolbar.removeEventListener('keydown',keys);marker?.remove();toolbar.remove();}
  };
}

/* Place touch menus away from the hold point without scrolling/moving the note. */
function imMenuPosition({ anchor, point, width, height, viewport, touch }) {
  const margin = 8, gap = 12, fingerClearance = 24;
  const left = viewport.left || 0, top = viewport.top || 0;
  const right = left + viewport.width, bottom = top + viewport.height;
  const maxWidth = Math.max(1, Math.min(viewport.width - 2 * margin, 230));
  const w = Math.min(width, maxWidth);
  let maxHeight = Math.max(1, viewport.height - 2 * margin);
  let h = Math.min(height, maxHeight);
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(value, Math.max(lo, hi)));
  let x = clamp(touch ? anchor.right - w : point.x, left + margin, right - margin - w);
  let y;
  if (!touch) {
    y = clamp(point.y, top + margin, bottom - margin - h);
  } else {
    const above = Math.min(anchor.top - gap, point.y - fingerClearance);
    const below = Math.max(anchor.bottom + gap, point.y + fingerClearance);
    if (above - h >= top + margin) y = above - h;
    else if (below + h <= bottom - margin) y = below;
    else {
      const roomAbove = Math.max(0, point.y - fingerClearance - top - margin);
      const roomBelow = Math.max(0, bottom - margin - point.y - fingerClearance);
      if (Math.max(roomAbove, roomBelow) >= 44) {
        maxHeight = Math.min(maxHeight, Math.max(roomAbove, roomBelow));
        h = Math.min(height, maxHeight);
        y = roomAbove >= roomBelow ? point.y - fingerClearance - h : point.y + fingerClearance;
      } else y = clamp(point.y - h - fingerClearance, top + margin, bottom - margin - h);
    }
    y = clamp(y, top + margin, bottom - margin - h);
  }
  return { x, y, maxHeight, maxWidth };
}

/* Visual delay only. This controller never schedules or performs a save. */
class ImSaveFeedback {
 constructor(notify=()=>{},timers={setTimeout:(fn,delay)=>setTimeout(fn,delay),clearTimeout:id=>clearTimeout(id)}){this.notify=notify;this.timers=timers;this.key=null;this.pending=false;this.text='';this.timer=null;this.generation=0;}
 clear(){this.generation++;if(this.timer!==null)this.timers.clearTimeout(this.timer);this.timer=null;}
 later(delay,text){const generation=this.generation;this.timer=this.timers.setTimeout(()=>{if(generation!==this.generation)return;this.timer=null;this.text=text;this.notify(text);},delay);}
 update(key,pending,blocked=false){
  if(this.key!==key){this.clear();this.key=key;this.pending=false;this.text='';}
  if(blocked||!key){this.clear();this.pending=false;this.text='';return this.text;}
  pending=!!pending;if(pending===this.pending)return this.text;
  this.clear();this.pending=pending;
  if(pending){this.text='';this.later(300,'Saving…');}
  else if(this.text==='Saving…'){this.text='Saved';this.later(1000,'');}
  else this.text='';
  return this.text;
 }
 dispose(){this.clear();this.notify=()=>{};}
}
function ImSavingFeedback({noteId,pending,blocked}){
 const [text,setText]=dt.useState(''),controller=dt.useRef(null);
 if(!controller.current)controller.current=new ImSaveFeedback(setText);
 dt.useLayoutEffect(()=>setText(controller.current.update(noteId,pending,blocked)),[noteId,pending,blocked]);
 dt.useEffect(()=>()=>controller.current.dispose(),[]);
 return x.jsx('span',{className:'ui-save-feedback',role:'status','aria-live':'polite',hidden:!text,title:text==='Saved'?'Accepted by Standard Notes':undefined,children:text});
}
function ImComposerSurface({composerRef,noteId,pending,blocked,children,...props}){
 return x.jsxs('section',{...props,ref:composerRef,children:[children,x.jsx(ImSavingFeedback,{noteId,pending,blocked})]});
}

/* Shared, view-only date navigation. Local calendar days include DST changes.
 * This never changes a message, writes storage, or filters the note. */
function imSearchPanelBounds(top,viewport){
 const margin=Math.min(8,viewport.height/2),bottom=viewport.top+viewport.height-margin;
 const start=Math.max(viewport.top+margin,Math.min(top,bottom-Math.min(96,Math.max(0,viewport.height-2*margin))));
 return {shift:start-top,height:Math.max(0,bottom-start)};
}
/* Only open panels observe geometry. Resize work is coalesced into one frame;
 * it never focuses an input, remounts a native picker or changes note data. */
function imWatchSearchPanel(panel){
 let shift=0,frame=0,closed=false;
 const visual=window.visualViewport;
 const update=()=>{
  if(closed||!panel.isConnected||!panel.getClientRects().length)return;
  const rect=panel.getBoundingClientRect(),bounds=imSearchPanelBounds(rect.top-shift,{top:visual?.offsetTop||0,height:visual?.height||innerHeight});
  shift=bounds.shift;
  for(const [name,value] of [['--ui-search-shift',shift+'px'],['--ui-search-height',bounds.height+'px']])if(panel.style.getPropertyValue(name)!==value)panel.style.setProperty(name,value);
 };
 const schedule=()=>{if(!closed&&!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
 const sizes=new ResizeObserver(schedule);sizes.observe(panel);
 const roots=new Set([panel.offsetParent,panel.closest('.editor-shell')].filter(Boolean));
 const changes=new MutationObserver(schedule);
 for(const root of roots){sizes.observe(root);changes.observe(root,{childList:true,attributes:true,attributeFilter:['class','style']});}
 window.addEventListener('resize',schedule,{passive:true});
 visual?.addEventListener('resize',schedule,{passive:true});visual?.addEventListener('scroll',schedule,{passive:true});
 update();
 return {update,destroy(){closed=true;cancelAnimationFrame(frame);sizes.disconnect();changes.disconnect();window.removeEventListener('resize',schedule);visual?.removeEventListener('resize',schedule);visual?.removeEventListener('scroll',schedule);panel.style.removeProperty('--ui-search-shift');panel.style.removeProperty('--ui-search-height');}};
}
function imDateInput(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number),date=new Date(0);date.setFullYear(year,month-1,day);date.setHours(0,0,0,0);
 return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date:null;
}

function imDateTarget(messages,value){
 const start=imDateInput(value);if(!start)return null;
 const end=new Date(start);end.setDate(end.getDate()+1);
 let after=null,before=null,afterTime=Infinity,beforeTime=-Infinity;
 for(const message of messages){
  const time=typeof message.createdAt==='string'?Date.parse(message.createdAt):NaN;
  if(!Number.isFinite(time))continue;
  if(time>=+start&&time<afterTime){after=message;afterTime=time;}
  else if(time<+start&&time>beforeTime){before=message;beforeTime=time;}
 }
 const message=after||before;if(!message)return null;
 return {message,exact:after!==null&&afterTime<+end};
}
function imDateJumpNotice(target){
 return target.exact?'':'No messages on that date. Showing '+new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(target.message.createdAt))+'.';
}
function imCreateDateJumpPanel({onJump,onClose}){
 const root=document.createElement('section');root.className='ui-date-panel';root.id='date-picker';root.setAttribute('role','group');root.setAttribute('aria-label','Jump to date');
 const label=document.createElement('label');label.className='ui-date-field';label.textContent='Date';
 const input=document.createElement('input');input.type='date';imPrivateTextField(input);input.setAttribute('aria-label','Date');
 const error=document.createElement('p');error.className='ui-date-error';error.setAttribute('role','alert');error.hidden=true;
 const apply=()=>{
  if(!imDateInput(input.value)){error.textContent='Choose a valid date.';error.hidden=false;return;}
  if(onJump(input.value)===false){error.textContent='There are no dated messages in this note.';error.hidden=false;return;}
  onClose();
 };
 input.addEventListener('change',()=>{error.hidden=true;});input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();apply();}});
 const button=document.createElement('button');button.type='button';button.className='ui-date-apply';button.textContent='Jump to date';button.addEventListener('click',apply);
 label.append(input);root.append(label,error,button);
 // Let the user's tap open the native picker. Combining focus()/showPicker()
 // with an active text keyboard causes competing UI in iOS embedded editors.
 // Date changes stay local until Jump/Enter; do not unmount a live native picker.
 root.openPicker=()=>{const focused=document.activeElement;if(focused?.matches('input,textarea,[contenteditable="true"]'))focused.blur();};
 return root;
}

/* IM_SHARED_UI_END */

/* A small implementation of the public Standard Notes component protocol.
 * Only current-note streaming, acknowledged saves and component preferences are
 * used by Mosaic. No remote theme loading or application dependency is needed.
 */
class MosaicRelay {
  constructor({targetWindow,onReady}) {
    this.window=targetWindow;this.onReady=onReady;
    this.component={data:{}};this.sentMessages=[];this.messageQueue=[];
    this.seen=new WeakSet();this.preferenceCallback=null;
    this.messageHandler=event=>this.receive(event);
    targetWindow.addEventListener('message',this.messageHandler);
    targetWindow.document.addEventListener('message',this.messageHandler);
    // The host uses these to coordinate focus and application shortcuts. Never
    // forward ordinary typed keys; their text belongs only in the saved note.
    this.clickHandler=()=>this.postMessage('click',{});
    this.keyHandler=event=>{
      const modifier=event.ctrlKey?'Control':event.shiftKey?'Shift':event.metaKey?'Meta':null;
      const key=event.type==='keyup'&&['Control','Shift','Meta'].includes(event.key)?event.key:modifier;
      if(key)this.postMessage(event.type==='keyup'?'key-up':'key-down',{keyboardModifier:key});
    };
    targetWindow.addEventListener('click',this.clickHandler);
    targetWindow.addEventListener('keydown',this.keyHandler);
    targetWindow.addEventListener('keyup',this.keyHandler);
  }
  receive(event) {
    if(this.seen.has(event))return;this.seen.add(event);
    if(event.source&&event.source!==this.window.parent)return;
    let message=event.data;
    if(typeof message==='string'){try{message=JSON.parse(message);}catch{return;}}
    if(!message||typeof message!=='object'||Array.isArray(message)||typeof event.origin!=='string')return;
    const referrer=this.window.document.referrer;
    if(referrer){
      try{if(new URL(referrer).origin!==new URL(event.origin).origin)return;}
      catch{return;}
    }
    if(this.component.origin!==undefined&&event.origin!==this.component.origin)return;
    if(message.action==='component-registered'){
      if(typeof message.sessionKey!=='string'||!message.sessionKey||typeof message.data?.uuid!=='string')return;
      if(this.component.sessionKey===message.sessionKey)return;
      this.component={origin:event.origin,sessionKey:message.sessionKey,uuid:message.data.uuid,
        environment:message.data.environment,platform:message.data.platform,
        data:message.componentData&&typeof message.componentData==='object'?message.componentData:{}};
      const queued=this.messageQueue.splice(0);for(const item of queued)this.postMessage(item.action,item.data,item.callback);
      this.postMessage('themes-activated',{});
      this.onReady?.();return;
    }
    if(!this.component.sessionKey||!message.original||typeof message.original.messageId!=='string')return;
    if(message.original.sessionKey&&message.original.sessionKey!==this.component.sessionKey)return;
    const record=this.sentMessages.find(item=>item.messageId===message.original.messageId);
    record?.callback(message.data);
  }
  postMessage(action,data,callback) {
    if(!this.component.sessionKey){
      // Input cannot be edited before registration. Discard pre-registration
      // focus/modifier events instead of accumulating an idle message queue.
      if(!['click','key-down','key-up'].includes(action))this.messageQueue.push({action,data,callback});
      return;
    }
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const messageId=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    const message={action,data,messageId,sessionKey:this.component.sessionKey,api:'component'};
    // The host sends errors but no successful-write reply for preferences. Keep
    // at most its latest error callback; never retain historic preference data.
    if(action==='set-component-data'){
      if(this.preferenceCallback)imReleaseHostReply(this,this.preferenceCallback);
      this.preferenceCallback=callback;
    }
    imTrackHostReply(this,message,callback);
    try{
      const outgoing=this.component.environment==='mobile'?JSON.stringify(message):message;
      const origin=this.component.origin;
      this.window.parent.postMessage(outgoing,origin&&origin!=='null'?origin:'*');
    }catch(error){imReleaseHostReply(this,callback);throw error;}
  }
  streamContextItem(callback){this.postMessage('stream-context-item',{},data=>{if(data?.item)callback(data.item);});}
  getComponentDataValueForKey(key){return this.component.data?.[key];}
  jsonObjectForItem(item){return {...item,parent:null,children:null};}
  deinit(){
    this.window.removeEventListener('message',this.messageHandler);this.window.document.removeEventListener('message',this.messageHandler);
    this.window.removeEventListener('click',this.clickHandler);this.window.removeEventListener('keydown',this.keyHandler);this.window.removeEventListener('keyup',this.keyHandler);
    this.sentMessages=[];this.messageQueue=[];this.onReady=null;
  }
}

/* Presentation helpers. A card is still one format-3 message, never a second copy. */
const MosaicModel = (() => {
  const heights=new WeakMap(),measured=new WeakMap(),prepared=new WeakMap(),indexes=new WeakMap(),pinCache=new WeakMap(),orderCache=new WeakMap();
  let latestIndex=null;
  const palettes=[{id:'sage',name:'Sage',description:'Soft green and clear white'},
    {id:'paper',name:'Paper',description:'Clean white and charcoal'},
    {id:'sand',name:'Sand',description:'Warm cream and dark brown'}];
  // Medium keeps the previous type sizes; Large is the default for readability.
  const fontSizes={
    small:{name:'Small',title:15,compactTitle:14,titleLine:22,compactTitleLine:20,body:12,bodyLine:20,compactBodyLine:18,editTitle:22,compactEditTitle:20,editBody:14},
    medium:{name:'Medium',title:17,compactTitle:16,titleLine:25,compactTitleLine:22,body:13,bodyLine:23,compactBodyLine:20,editTitle:24,compactEditTitle:22,editBody:16},
    large:{name:'Large',title:19,compactTitle:18,titleLine:28,compactTitleLine:25,body:15,bodyLine:26,compactBodyLine:23,editTitle:26,compactEditTitle:24,editBody:18},
    'extra-large':{name:'Extra large',title:22,compactTitle:21,titleLine:32,compactTitleLine:29,body:18,bodyLine:30,compactBodyLine:27,editTitle:29,compactEditTitle:27,editBody:21}
  };
  const appearance=(settings={})=>({palette:palettes.some(p=>p.id===settings.mosaicPalette)?settings.mosaicPalette:'sage',
    fontSize:typeof settings.mosaicFontSize==='string'&&Object.hasOwn(fontSizes,settings.mosaicFontSize)?settings.mosaicFontSize:'large'});
  // Preset IDs are the only saved color values; unknown metadata is preserved.
  const colors=[
    {id:'default',name:'Default'},
    {id:'coral',name:'Coral',light:'#f7b2ae'},
    {id:'peach',name:'Peach',light:'#f6b18a'},
    {id:'lemon',name:'Lemon',light:'#fff6b3'},
    {id:'sage',name:'Sage',light:'#e2f3ce'},
    {id:'seafoam',name:'Seafoam',light:'#b9ded5'},
    {id:'ice',name:'Ice',light:'#d4e5ed'},
    {id:'blue',name:'Blue',light:'#aecfdf'},
    {id:'lavender',name:'Lavender',light:'#d7c2df'},
    {id:'rose',name:'Rose',light:'#f5dfd9'},
    {id:'sand',name:'Sand',light:'#e9e3d1'},
    {id:'stone',name:'Stone',light:'#eeeef0'},
    {id:'iris',name:'Iris blue',light:'#919bf5'}
  ];
  const color = (message) => {
    const preset=colors.find(item=>item.id===message.cardColor)||colors[0];
    return {id:preset.id,background:preset.light||'var(--surface)',ink:'#202124'};
  };
  const normalized = text => text.replace(/\r\n?/g, '\n');
  function split(text) {
    const match = /\r\n|\n|\r/.exec(text);
    return match ? {text, title:text.slice(0,match.index), body:text.slice(match.index+match[0].length), separator:match[0]}
      : {text, title:text, body:'', separator:''};
  }
  function join(original, title, body) {
    const parts = split(original);
    const sameBody = normalized(parts.body) === normalized(body);
    if (parts.title === title && sameBody) return original;
    const separator = parts.separator || '\n';
    const nextBody = sameBody ? parts.body : normalized(body).replace(/\n/g, separator);
    return title + (nextBody || parts.separator ? separator + nextBody : '');
  }
  const pins = settings => {if(!pinCache.has(settings))pinCache.set(settings,[...new Set(Array.isArray(settings.pinnedMessageIds)?settings.pinnedMessageIds:[])]);return pinCache.get(settings);};
  const isImported = message => !!message.forwarding && !message.importedStatusCleared;
  function prepare(message,previous){
    if(prepared.has(message))return prepared.get(message);
    const sameText=previous?.message.text===message.text&&imFormat.title(previous.message)===imFormat.title(message);
    const readable=()=>typeof imMarkdown==='undefined'?message.text:imMarkdown.message(message).text;
    const value={message,search:sameText?previous.search:(imFormat.title(message)?imFormat.title(message)+'\n'+readable():readable()).toLocaleLowerCase(),parts:sameText?previous.parts:{title:imFormat.title(message),body:message.text},tags:previous?.message.reactions===message.reactions?previous.tags:new Set(message.reactions)};
    prepared.set(message,value);return value;
  }
  function index(messages){
    if(indexes.has(messages))return indexes.get(messages);
    const byId=new Map(),counts=new Map(),tags=new Set();let untagged=0;
    for(const message of messages){
      const entry=prepare(message,latestIndex?.byId.get(message.id));byId.set(message.id,entry);
      if(!entry.tags.size)untagged++;
      for(const tag of entry.tags){tags.add(tag);counts.set(tag,(counts.get(tag)||0)+1);}
    }
    const value={byId,counts,tags,untagged,lastQuery:null};indexes.set(messages,value);latestIndex=value;return value;
  }
  const preview = message => prepare(message).parts;
  const label = message => {const {title,body}=preview(message);return title||(typeof imMarkdown==='undefined'?body:imMarkdown.message(message).text).slice(0,70).replace(/\s+/g,' ').trim()||'Empty card';};
  const boardTagLimit=10;
  const matches = (message, query, tag, pinned, pinIds) =>
    (!query || prepare(message).search.includes(query.toLocaleLowerCase())) &&
    (!tag || (tag==='__untagged__' ? prepare(message).tags.size===0 : prepare(message).tags.has(tag))) &&
    (!pinned || pinIds.has(message.id));
  function tags(messages, settings) {
    return imEmojiOrder(messages,settings,index(messages).tags);
  }
  function filtered(messages,settings,query,tag,pinnedOnly){
    const data=index(messages),pinIds=pins(settings),normalized=query.toLocaleLowerCase(),last=data.lastQuery;
    if(last&&last.query===normalized&&last.tag===tag&&last.pinnedOnly===pinnedOnly&&(!pinnedOnly||last.pinIds===pinIds))return last.result;
    const pinned=new Set(pinIds),result=[];
    for(const entry of data.byId.values())if((!normalized||entry.search.includes(normalized))&&(!tag||(tag==='__untagged__'?!entry.tags.size:entry.tags.has(tag)))&&(!pinnedOnly||pinned.has(entry.message.id)))result.push(entry.message);
    data.lastQuery={query:normalized,tag,pinnedOnly,pinIds,result};return result;
  }
  function clearStatuses(messages, flags, ids) {
    return messages.map(message => {
      if (ids && !ids.has(message.id)) return message;
      const next = {...message};
      for (const flag of flags) {
        if (flag==='imported') { if (next.forwarding) next.importedStatusCleared=true; }
        else if (['edited','copied','exported'].includes(flag)) delete next[flag];
      }
      return next;
    });
  }
  function reply(message, noteId) {
    return imReplySnapshot(message,noteId);
  }
  function target(messages, reply, noteId) {
    return imReplyTarget(messages,reply,noteId)||null;
  }
  function merge(messages, settings, ids, noteId) {
    const sources=messages.filter(m=>ids.has(m.id));
    if(sources.length<2)throw new Error('Select at least two cards.');
    const first=sources[0],combined={...first,text:imFormat.mergeText(sources),reactions:[...new Set(sources.flatMap(m=>m.reactions))],edited:true};
    delete combined.copied;delete combined.exported;delete combined.editedAt;
    const origins=new Map();
    for(const m of sources){
      const {text,reactions,copied,exported,edited,editedAt,mergeSources,...metadata}=m;
      for(const origin of [{...metadata,noteId},...(Array.isArray(mergeSources)?mergeSources:[])]) {
        const key=JSON.stringify([origin?.noteId,origin?.id]);
        if(!origins.has(key))origins.set(key,origin);
      }
    }
    combined.mergeSources=[...origins.values()];
    return {messages:messages.flatMap(m=>m.id===first.id?[combined]:ids.has(m.id)?[]:[m]),
      settings:{...settings,pinnedMessageIds:[...new Set(pins(settings).map(id=>ids.has(id)?first.id:id))]},id:first.id};
  }
  // Fixed preview bounds make masonry windowing cheap and stable. Full text is
  // available in the reader; estimating a preview never truncates saved content.
  function previewLines(text,columns,limit) {
    let lines=1,width=0,previous='';
    for(const char of text){
      if(char==='\n'&&previous==='\r'){previous=char;continue;}
      if(char==='\n'||char==='\r'){lines++;width=0;}
      else{width+=/[^\x00-\xff]/.test(char)?1.65:1;if(width>columns){lines++;width=0;}}
      if(lines>=limit)return limit;
      previous=char;
    }
    return lines;
  }
  const heightKey=(width,pinned,selecting,fontSize,previewRatio)=>width+':'+pinned+':'+fontSize+':'+previewRatio;
  function boardBounds(width,fontSize='large',previewRatio=8) {
    const compact=width<230,font=fontSizes[fontSize],padding=compact?22:28;
    const bodyLine=compact?font.compactBodyLine:font.bodyLine;
    return {minimum:padding+bodyLine,maximum:previewRatio*(padding+bodyLine),bodyLine,padding};
  }
  const boardTagCount=message=>Math.min(boardTagLimit,message.reactions.length);
  function measure(message,width,pinned,selecting,height,fontSize='large',previewRatio=8) {
    const key=heightKey(width,pinned,selecting,fontSize,previewRatio),previous=measured.get(message);
    if(previous?.key===key&&previous.height===height)return false;
    measured.set(message,{key,height});return true;
  }
  function cardHeight(message,width,pinned,selecting,fontSize,previewRatio) {
    const compact=width<230,font=fontSizes[fontSize],key=heightKey(width,pinned,selecting,fontSize,previewRatio),actual=measured.get(message),cached=heights.get(message);
    if(actual?.key===key)return actual.height;
    if(cached?.key===key)return cached.height;
    const padding=compact?22:28,columns=Math.max(8,Math.floor((width-padding)/(font.body*.53)));
    const bounds=boardBounds(width,fontSize,previewRatio),bodyArea=bounds.maximum-bounds.padding,bodyLimit=Math.floor(bodyArea/bounds.bodyLine),titleLine=compact?font.compactTitleLine:font.titleLine;
    const parts=preview(message),titleLines=parts.title?previewLines(parts.title,columns,Math.max(1,Math.floor(bodyArea/titleLine))):0,bodyLines=parts.body?previewLines(parts.body,columns,bodyLimit+1):0;
    const tagCount=boardTagCount(message,width,fontSize),tagSlots=tagCount+(message.reactions.length>tagCount?1:0);
    const tagRows=Math.ceil(tagSlots/Math.max(1,Math.floor((width-padding+6)/37)));
    const height=bounds.padding+titleLines*titleLine+(bodyLines>bodyLimit?bodyArea:bodyLines*bounds.bodyLine)+(bodyLines&&titleLines?8:0)+(message.replyTo?36:0)+(tagRows?8+tagRows*22+(tagRows-1)*6:0);
    heights.set(message,{key,height});return height;
  }
  function ordered(messages,settings) {
    const cached=orderCache.get(settings);if(cached?.messages===messages)return cached.result;
    const byId=index(messages).byId,seen=new Set(),saved=[];
    if(Array.isArray(settings.mosaicCardOrder))for(const id of settings.mosaicCardOrder){
      if(typeof id==='string'&&byId.has(id)&&!seen.has(id)){saved.push(byId.get(id).message);seen.add(id);}
    }
    // Captures made since the last arrangement appear first, newest first.
    const result=messages.filter(m=>!seen.has(m.id)).reverse().concat(saved);
    orderCache.set(settings,{messages,result});return result;
  }
  function moveCard(messages,settings,id,targetId,after=false) {
    if(id===targetId)return settings;
    const order=ordered(messages,settings).map(m=>m.id),from=order.indexOf(id),target=order.indexOf(targetId);
    if(from<0||target<0)return settings;
    const pinned=new Set(pins(settings));if(pinned.has(id)!==pinned.has(targetId))return settings;
    const next=order.filter(value=>value!==id);next.splice(next.indexOf(targetId)+(after?1:0),0,id);
    return next.every((value,i)=>value===order[i])?settings:{...settings,mosaicCardOrder:next};
  }
  function layout(messages, settings, width, query='', tag='', pinnedOnly=false,selecting=false,previewRatio=8,pinnedPreviewRatio=6) {
    const gap=width<600?10:16, columns=width<600?2:Math.max(2,Math.floor((width+gap)/276)), cardWidth=(width-gap*(columns-1))/columns;
    const pinIds=new Set(pins(settings)),fontSize=appearance(settings).fontSize;
    const allowed=new Set(filtered(messages,settings,query,tag,pinnedOnly).map(m=>m.id));
    const matching=ordered(messages,settings).filter(m=>allowed.has(m.id));
    const groups=[['Pinned',matching.filter(m=>pinIds.has(m.id))],['Other cards',matching.filter(m=>!pinIds.has(m.id))]];
    const items=[],headings=[],byId=new Map(),columnItems=Array.from({length:columns},()=>[]);let base=0;
    for(const [name,group] of groups){
      if(!group.length)continue;
      if(name==='Pinned'||headings.length){headings.push({label:name,y:base});base+=36;}
      const heights=Array(columns).fill(base);
      for(const message of group){
        const ratio=pinIds.has(message.id)?pinnedPreviewRatio:previewRatio;
        const height=cardHeight(message,cardWidth,pinIds.has(message.id),selecting,fontSize,ratio);
        const column=heights.indexOf(Math.min(...heights));
        const item={message,x:column*(cardWidth+gap),y:heights[column],width:cardWidth,height,previewRatio:ratio,order:items.length};
        items.push(item);columnItems[column].push(item);byId.set(message.id,item);
        heights[column]+=height+gap;
      }
      base=Math.max(...heights)+12;
    }
    return {items,headings,byId,columns:columnItems,height:base,count:matching.length};
  }
  function visible(layout,low,high){
    const result=[];
    for(const column of layout.columns||[]){
      let a=0,b=column.length;
      while(a<b){const middle=(a+b)>>1,item=column[middle];if(item.y+item.height<low)a=middle+1;else b=middle;}
      for(let i=a;i<column.length&&column[i].y<=high;i++)result.push(column[i]);
    }
    return result.sort((a,b)=>a.order-b.order);
  }
  return {split,join,normalized,pins,tags,index,preview,label,boardTagLimit,boardBounds,boardTagCount,ordered,moveCard,visible,isImported,matches,clearStatuses,reply,target,merge,layout,measure,colors,color,palettes,fontSizes,appearance};
})();

function mosaicIcon(name,selection=false) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:selection?'0 0 28 28':'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':selection?'1.8':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  svg.innerHTML=selection?imSelectionIcons[name]:imUiIcons[name]||imUiIcons.mosaic;
  return svg;
}

function mosaicToolbarIcon(name){
 const icon=imToolbarIcons[name],svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value] of Object.entries({class:'ui-toolbar-icon',width:icon.size,height:icon.size,viewBox:icon.viewBox,fill:'none',stroke:'currentColor','stroke-width':icon.stroke,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
 svg.innerHTML=icon.markup;return svg;
}

/* Board-only movement. No note text or ordering is persisted by this module. */
class MosaicBoardMotion {
  constructor(board,viewport) {
    this.board=board;this.viewport=viewport;this.entering=new Set();this.animations=new WeakMap();
    this.preference=matchMedia('(prefers-reduced-motion: reduce)');
  }
  snapshot(nodes) {
    const result=new Map();
    if(this.preference.matches)return result;
    for(const [id,node] of nodes)result.set(id,node.getBoundingClientRect());
    for(const node of nodes.values())this.animations.get(node)?.cancel();
    return result;
  }
  queue(ids) {for(const id of ids)this.entering.add(id);while(this.entering.size>100)this.entering.delete(this.entering.values().next().value);}
  reset() {this.entering.clear();}
  play(node,frames,duration) {
    this.animations.get(node)?.cancel();
    const animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
    this.animations.set(node,animation);
    const cleanup=()=>{if(this.animations.get(node)===animation)this.animations.delete(node);};
    animation.onfinish=cleanup;animation.oncancel=cleanup;
  }
  move(before,nodes) {
    if(this.preference.matches)return;
    const moves=[];
    for(const [id,node] of nodes){
      if(node.classList.contains('is-drag-placeholder'))continue;
      const previous=before.get(id);if(!previous||this.entering.has(id))continue;
      const next=node.getBoundingClientRect(),dx=previous.left-next.left,dy=previous.top-next.top;
      if(Math.abs(dx)+Math.abs(dy)>1)moves.push({node,dx,dy,transform:node.style.transform});
    }
    for(const {node,dx,dy,transform} of moves)this.play(node,[
      {transform:`${transform} translate(${dx}px,${dy}px)`},{transform}
    ],400);
  }
  reveal(nodes) {
    if(!this.entering.size)return;
    if(this.preference.matches){this.entering.clear();return;}
    const bounds=this.viewport.getBoundingClientRect();
    for(const [id,node] of nodes){
      if(!this.entering.has(id))continue;
      const rect=node.getBoundingClientRect();if(rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue;
      this.entering.delete(id);const transform=node.style.transform;
      this.play(node,[{opacity:0,transform:`${transform} translateY(12px) scale(.94)`},{opacity:1,transform}],240);
    }
  }
}

class MosaicBoardDrag {
  constructor(options) {
    Object.assign(this,options);this.gesture=null;this.settlingId=null;this.suppressUntil=0;this.frame=0;
    this.board.addEventListener('pointerdown',event=>this.down(event));
    document.addEventListener('pointerdown',event=>{
      if(this.gesture&&event.pointerId!==this.gesture.pointerId)this.cancel();
      else if(!this.gesture)this.suppressUntil=0;
    },true);
    document.addEventListener('pointermove',event=>this.move(event),true);
    document.addEventListener('pointerup',event=>this.up(event),true);
    document.addEventListener('pointercancel',event=>{if(this.gesture?.pointerId===event.pointerId)this.cancel();},true);
    this.board.addEventListener('lostpointercapture',event=>{if(event.target===this.board&&this.gesture?.pointerId===event.pointerId)this.cancel();});
    // Cancel native scrolling only after a stationary hold, before its first
    // movement. A normal swipe never enters this branch. Touch-action alone
    // cannot be changed retrospectively for an existing iOS touch gesture.
    document.addEventListener('touchmove',event=>{
      if(this.gesture?.ready&&this.canStart(this.gesture.node)&&event.cancelable)event.preventDefault();
    },{passive:false});
    document.addEventListener('click',event=>{
      if(performance.now()<this.suppressUntil&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&this.gesture){event.preventDefault();event.stopImmediatePropagation();this.cancel();}
    },true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset();});
    window.addEventListener('blur',()=>this.reset());
    window.addEventListener('resize',()=>this.reset());
  }
  get dragging() {return !!this.gesture?.dragging;}
  placeholder(id) {return this.gesture?.dragging&&this.gesture.id===id||this.settlingId===id;}
  down(event) {
    if(event.button!==0||event.isPrimary===false||event.target.closest('button,input,textarea,select,a'))return;
    const node=event.target.closest('.card');if(!node||!this.canStart(node)||this.gesture||this.settlingId)return;
    const g={id:node.dataset.id,node,pointerId:event.pointerId,touch:event.pointerType==='touch',
      startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,
      startScroll:this.viewport.scrollTop,ready:event.pointerType!=='touch',dragging:false,lastX:event.clientX,lastY:event.clientY};
    this.gesture=g;
    if(g.touch)g.timer=setTimeout(()=>{
      if(this.gesture===g&&this.canStart(node)&&Math.abs(this.viewport.scrollTop-g.startScroll)<2)g.ready=true;
    },520);
  }
  move(event) {
    const g=this.gesture;if(!g||g.pointerId!==event.pointerId)return;
    g.x=event.clientX;g.y=event.clientY;
    const distance=Math.hypot(g.x-g.startX,g.y-g.startY);
    if(!g.ready){if(distance>10)this.cancel();return;}
    if(!g.dragging&&distance>(g.touch?10:6)){
      if(!this.canStart(g.node)||!this.onStart(g.id)){this.cancel();return;}
      clearTimeout(g.timer);g.dragging=true;this.onClearCapture();
      const rect=g.node.getBoundingClientRect();g.left=rect.left;g.top=rect.top;g.width=rect.width;g.height=rect.height;
      const ghost=g.node.cloneNode(true);ghost.classList.add('board-drag-ghost');ghost.classList.remove('located','selected');
      ghost.removeAttribute('id');ghost.removeAttribute('data-id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
      Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',transform:'scale(1.02)'});
      document.body.append(ghost);g.ghost=ghost;
      this.board.classList.add('is-dragging');g.node.classList.add('is-drag-placeholder');
      try{this.board.setPointerCapture(g.pointerId);}catch{}
      this.tick();
    }
    if(g.dragging&&event.cancelable)event.preventDefault();
  }
  tick() {
    const g=this.gesture;if(!g?.dragging)return;
    if(!this.canContinue()){this.cancel();return;}
    g.ghost.style.transform=`translate3d(${g.x-g.startX}px,${g.y-g.startY}px,0) scale(1.02)`;
    const bounds=this.getBounds(),edge=54;
    let velocity=g.y<bounds.top+edge?-Math.min(16,(bounds.top+edge-g.y)*.24):g.y>bounds.bottom-edge?Math.min(16,(g.y-bounds.bottom+edge)*.24):0;
    const scroll=this.viewport.scrollTop;if(velocity)this.viewport.scrollTop+=velocity;
    const scrolled=this.viewport.scrollTop!==scroll;
    if(scrolled||Math.hypot(g.x-g.lastX,g.y-g.lastY)>3){g.dirty=true;g.lastX=g.x;g.lastY=g.y;}
    if(g.dirty||g.pending)this.findTarget(g);
    this.frame=requestAnimationFrame(()=>this.tick());
  }
  findTarget(g) {
    const now=performance.now();
    // Let a placement settle before its moving neighbors become new targets.
    // Remember movement during this interval, so a new hover is not ignored.
    if(now<(g.cooldownUntil||0)&&!g.dirty&&!g.pending)return;
    const moved=g.dirty;g.dirty=false;
    const layout=this.getLayout(),origin=this.board.getBoundingClientRect(),x=g.x-origin.left,y=g.y-origin.top;
    const source=layout.byId.get(g.id);if(!source)return;
    // Reflow can move a different card under a nearly stationary finger. It
    // must not count as a new placement request without deliberate movement.
    if(g.anchor&&Math.hypot(x-g.anchor.x,y-g.anchor.y)<18){g.pending=null;return;}
    // Keep an earned hover attached to its card while that card animates.
    if(g.pending&&!moved){
      if(now-g.pending.since<150||now<(g.cooldownUntil||0))return;
      const pending=g.pending;g.pending=null;g.cooldownUntil=now+280;g.anchor={x,y};
      this.onPreview(g.id,pending.id,pending.after);return;
    }
    const margin=4;
    const insideSource=x>=source.x-margin&&x<=source.x+source.width+margin&&y>=source.y-margin&&y<=source.y+source.height+margin;
    let target=null,targetRect=null,targetInside=false,best=Infinity;
    // Prefer the card the user actually sees beneath the pointer during motion.
    for(const item of this.candidates(y)){
      if(item.message.id===g.id||!this.sameSection(g.id,item.message.id))continue;
      const visual=this.hitRect?.(item),r=visual?{x:visual.left-origin.left,y:visual.top-origin.top,width:visual.width,height:visual.height}:item;
      const dx=Math.max(r.x-x,0,x-r.x-r.width),dy=Math.max(r.y-y,0,y-r.y-r.height);
      const score=dx*dx+dy*dy+Math.abs(x-r.x-r.width/2)*.02+Math.abs(y-r.y-r.height/2)*.01;
      if(score<best){best=score;target=item;targetRect=r;targetInside=dx===0&&dy===0;}
    }
    if(!target||(insideSource&&!targetInside)){g.pending=null;return;}
    const middle=targetRect.y+targetRect.height/2;
    // A dead band around the midpoint prevents tiny finger movements from
    // alternating between the two sides of the same card.
    let after=y>middle;
    if(g.pending?.id===target.message.id&&Math.abs(y-middle)<14)after=g.pending.after;
    const key=target.message.id+':'+after;
    if(g.pending?.key!==key){g.pending={key,id:target.message.id,after,since:now};return;}
    if(now-g.pending.since<150||now<(g.cooldownUntil||0))return;
    g.pending=null;g.cooldownUntil=now+280;g.anchor={x,y};
    this.onPreview(g.id,target.message.id,after);
  }
  clearGesture() {
    const g=this.gesture;if(!g)return null;
    clearTimeout(g.timer);cancelAnimationFrame(this.frame);this.frame=0;this.gesture=null;
    try{if(this.board.hasPointerCapture(g.pointerId))this.board.releasePointerCapture(g.pointerId);}catch{}
    this.board.classList.remove('is-dragging');
    return g;
  }
  up(event) {
    const g=this.gesture;if(!g||g.pointerId!==event.pointerId)return;
    if(!g.dragging){this.clearGesture();return;}
    if(!this.canContinue()){this.cancel();return;}
    // Release commits the placeholder already shown, never an unseen new
    // target picked from the pointer-up coordinates.
    this.clearGesture();this.suppressUntil=performance.now()+700;this.settlingId=g.id;this.settlingGhost=g.ghost;
    this.onDrop(g.id);
    const slot=this.getSlot(g.id);
    const finish=()=>{g.ghost.remove();if(this.settlingGhost===g.ghost){this.settlingId=null;this.settlingGhost=null;this.settleAnimation=null;}this.onSettled();};
    if(!slot||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    const animation=this.settleAnimation=g.ghost.animate([
      {transform:g.ghost.style.transform,opacity:1},
      {transform:`translate3d(${slot.left-g.left}px,${slot.top-g.top}px,0) scale(1)`,opacity:1}
    ],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
    animation.onfinish=finish;animation.oncancel=finish;
  }
  cancel(redraw=true) {
    const g=this.clearGesture();if(!g)return;
    if(g.dragging){g.ghost?.remove();this.suppressUntil=performance.now()+700;this.onCancel(redraw);}
  }
  reset() {
    this.cancel();this.settleAnimation?.cancel();this.settlingGhost?.remove();this.settlingId=null;this.settlingGhost=null;
  }
}

/* Mosaic's UI. Persistence, portable text and transfer logic are the shared IM core. */
const $ = id => document.getElementById(id);
function el(tag, className='', text) {
  const node=document.createElement(tag);if(tag==='input'||tag==='textarea')imPrivateTextField(node);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;
}
function button(label, icon, handler, className='icon-button') {
  const node=el('button',className);node.type='button';node.setAttribute('aria-label',label);node.title=label;
  if(icon)node.append(mosaicIcon(icon));else node.textContent=label;
  if(handler)node.addEventListener('click',event=>{event.stopPropagation();handler(event);});return node;
}
const cardTimestampFormat=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const isIPhone=/\biPhone\b/i.test(navigator.userAgent);
const phoneBoard=navigator.userAgentData?.mobile===true||/\biPhone\b|\biPod\b|Android.*\bMobile\b|Windows Phone/i.test(navigator.userAgent);
const boardPreviewRatio=phoneBoard?8:14,boardPinnedRatio=phoneBoard?6:8;
document.documentElement.classList.toggle('is-iphone',isIPhone);
document.documentElement.classList.toggle('is-phone',phoneBoard);
const modal=$('modal'), menu=$('menu'), viewport=$('viewport'), board=$('board');
let active=null, modalState=null, toastTimer, frame=0, searchOpen=false, menuFromTouch=false, menuPress=false, dateOpen=false, layout={items:[],headings:[],height:0,count:0};
let mounted=new Map(), selectionPreferences=Object.create(null), searchPanelFit=null;
let dragPreview=null;
let captureEditor;
const boardMotion=new MosaicBoardMotion(board,viewport);
const boardDrag=new MosaicBoardDrag({board,viewport,
  canStart:()=>writable()&&!active.view.selecting&&!modal.open&&menu.hidden,
  canContinue:()=>!!dragPreview&&dragPreview.session===active&&writable()&&!active.view.selecting&&!modal.open&&menu.hidden,
  onClearCapture:()=>{outsideCapture=null;window.getSelection()?.removeAllRanges();},
  onStart:id=>{if(!writable())return false;dragPreview={session:active,id,settings:active.settings,pins:new Set(MosaicModel.pins(active.settings))};return true;},
  getLayout:()=>layout,
  hitRect:item=>mounted.get(item.message.id)?.getBoundingClientRect(),
  candidates:y=>{
    const nearby=MosaicModel.visible(layout,y-400,y+400),seen=new Set(nearby.map(item=>item.message.id));
    // A moving card can still be visible far from its final layout position.
    for(const id of mounted.keys()){const item=layout.byId.get(id);if(item&&!seen.has(id)){nearby.push(item);seen.add(id);}}
    return nearby.length?nearby:y<0?layout.items.slice(0,3):layout.items.slice(-3);
  },
  getBounds:()=>{const bounds=viewport.getBoundingClientRect();return {top:bounds.top,bottom:Math.min(bounds.bottom,$('capture-composer').getBoundingClientRect().top-8)};},
  sameSection:(id,target)=>dragPreview.pins.has(id)===dragPreview.pins.has(target),
  getSlot:id=>{const item=layout.byId?.get(id),origin=board.getBoundingClientRect();return item?{left:origin.left+item.x,top:origin.top+item.y}:null;},
  onPreview:(id,target,after)=>{
    const s=active;let settings=MosaicModel.moveCard(s.messages,dragPreview.settings,id,target,after);
    if(settings===dragPreview.settings)settings=MosaicModel.moveCard(s.messages,dragPreview.settings,id,target,!after);
    if(settings===dragPreview.settings)return;
    const before=boardMotion.snapshot(mounted);dragPreview.settings=settings;reflowBoard();boardMotion.move(before,mounted);
  },
  onDrop:()=>{
    const preview=dragPreview;dragPreview=null;
    if(preview?.session!==active||!writable())return;
    const current=MosaicModel.ordered(active.messages,active.settings),next=MosaicModel.ordered(active.messages,preview.settings);
    // Keep the preview's measured geometry on drop instead of rebuilding it
    // from estimates while the lifted card is landing.
    if(next.some((message,i)=>message.id!==current[i].id))safeRun(()=>update(active,{settings:preview.settings},false));
    else renderWindow();
  },
  onCancel:redraw=>{const before=redraw?boardMotion.snapshot(mounted):null;dragPreview=null;if(redraw){reflowBoard();boardMotion.move(before,mounted);}},
  onSettled:()=>renderWindow()
});
const viewMemory=new Map(), unfinishedEdits=new Map();
// Only unconfirmed sessions and deferred status intents survive note switches.
// Both are working memory; no text or recovery copy is written to browser storage.
const retainedSessions=new Map(), transferMarks=new Map();
const editKey=(uuid,id)=>JSON.stringify([uuid,id]);
function latestUnfinished(uuid){let latest;for(const entry of unfinishedEdits.values())if(entry.noteId===uuid)latest=entry;return latest;}
const saveFeedback=new ImSaveFeedback(()=>renderStatus());
const pf=new MosaicRelay({targetWindow:window,options:{coallesedSaving:false,acceptsThemes:false},onReady:()=>{
  const saved=pf.getComponentDataValueForKey('mosaicSelectionsV1');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [id,ids] of Object.entries(saved)){
    if(Array.isArray(ids)&&ids.every(imFormat.validId))selectionPreferences[id]=ids;
  }
  pf.streamContextItem(receive);
}});

function notify(text) {
  clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,5000);
}
function safeRun(action) {try{Promise.resolve(action()).catch(error=>notify(error.message||'The action could not be completed.'));}catch(error){notify(error.message);}}
/* A hold only arms the menu. Release opens it; movement/cancellation never does. */
function bindContextMenu(node,open,canHold=()=>true) {
  let gesture=null,timer=0,suppressUntil=0;
  const cancel=()=>{clearTimeout(timer);timer=0;gesture=null;};
  node.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||event.isPrimary===false||event.target.closest('button,input,textarea,select,#menu')||!canHold())return;
    cancel();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,scroll:viewport.scrollTop,ready:false};const current=gesture;
    timer=setTimeout(()=>{
      if(gesture!==current||!node.isConnected||!canHold()){cancel();return;}
      window.getSelection()?.removeAllRanges();current.ready=true;outsideCapture=null;timer=0;
    },520);
  });
  node.addEventListener('pointermove',event=>{if(gesture&&event.pointerId===gesture.id&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>10)cancel();});
  node.addEventListener('pointerup',event=>{
    const held=gesture;
    if(!held||held.id!==event.pointerId)return;
    cancel();if(!held.ready||!canHold()||Math.abs(viewport.scrollTop-held.scroll)>2)return;
    suppressUntil=performance.now()+800;outsideCapture=null;
    open({clientX:held.x,clientY:held.y,currentTarget:node,anchor:node.getBoundingClientRect(),touch:true});
  });
  for(const name of ['pointercancel','pointerleave'])node.addEventListener(name,cancel);
  node.addEventListener('click',event=>{if(performance.now()<suppressUntil&&event.detail!==0&&!event.target.closest('#menu')){event.preventDefault();event.stopImmediatePropagation();}},true);
  node.addEventListener('contextmenu',event=>{
    if(event.target.closest('#menu'))return;
    const touch=!!gesture||event.pointerType==='touch'||(matchMedia('(pointer:coarse) and (hover:none)').matches&&event.pointerType!=='mouse');
    if(touch&&event.target.closest('input,textarea,select'))return;
    event.preventDefault();if(!touch)open(event);
  });
}
// iOS keyboards may issue beforeinput without a useful keydown. Shift+Enter
// remains a native line break; neither path submits an IME confirmation key.
function bindSubmitField(field,submit,{composing=()=>false,newline}={}) {
  let allowLineBreak=false,ime=false;
  const allowThisEvent=()=>{allowLineBreak=true;setTimeout(()=>allowLineBreak=false,0);};
  field.addEventListener('compositionstart',()=>ime=true);
  field.addEventListener('compositionend',()=>ime=false);
  field.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    if(event.isComposing||event.keyCode===229||ime||composing()){allowThisEvent();return;}
    if(event.shiftKey){allowThisEvent();if(newline){event.preventDefault();newline();}return;}
    event.preventDefault();if(!event.repeat)submit();
  });
  field.addEventListener('beforeinput',event=>{
    if(!['insertLineBreak','insertParagraph'].includes(event.inputType)||allowLineBreak||event.isComposing||ime||composing())return;
    event.preventDefault();submit();
  });
}
function newView(uuid) {
  const old=viewMemory.get(uuid);
  return old||{query:'',tag:'',pinned:false,selecting:false,selected:new Set(selectionPreferences[uuid]||[]),scroll:0};
}
function rememberSelection() {
  if(!active)return;
  if(active.view.selected.size)selectionPreferences[active.note.uuid]=[...active.view.selected];else delete selectionPreferences[active.note.uuid];
  if(active.demo)return;
  try{
    const data={...pf.component.data,mosaicSelectionsV1:{...selectionPreferences}};
    pf.component.data=data;
    pf.postMessage('set-component-data',{componentData:data},reply=>{if(reply?.error)notify('Selection preferences could not be saved. Your cards are unchanged.');});
  }catch{notify('Selection preferences could not be saved. Your cards are unchanged.');}
}
function sessionEcho(s,note){
  const queue=imNoteSaves.get(note.uuid),native=imNoteNativeSignature(note),text=note.content?.text||'';
  return [queue?.current?.snapshot,queue?.next?.snapshot,s.lastAck].some(snapshot=>snapshot&&snapshot.text===text&&(snapshot.native||imNoteNativeSignature(snapshot.item))===native);
}
function knownSessionText(s,text){
  const queue=imNoteSaves.get(s.note.uuid);
  return [s.note.content.text,s.lastHostText,s.lastAck?.text,queue?.current?.snapshot.text,queue?.next?.snapshot.text].includes(text);
}
function receiveNativeFields(s,note){
  const signature=imNoteNativeSignature(s.note),incoming=imNoteNativeSignature(note);
  if(s.nativeRepair&&incoming!==signature&&sessionEcho(s,note)){
    imNoteMetadataReceived(s.note,{...note,isMetadataUpdate:true});return;
  }
  imApplyNoteNative(s.note,note);s.lastHostText=note.content?.text||'';s.deleted=!!note.deleted;
  if(s.deleted){imCancelQueuedNoteSaves(note.uuid);renderNotice();renderCapture();return;}
  if(signature!==incoming){
    const rebased=imRebaseQueuedNote(s.note.uuid,note);
    if(s.pending&&!s.remote){s.nativeRepair=true;if(!rebased&&active===s)safeRun(()=>persist(s));}
  }
  if(!s.dirty&&!s.pending&&!s.error)imNoteReceived(s.note);
}
function receive(note, force=false) {
  if(!note||!note.uuid)return;
  if(active&&(active.note.uuid!==note.uuid||!note.isMetadataUpdate&&active.note.content.text!==(note.content?.text||'')&&!knownSessionText(active,note.content?.text||''))){boardDrag.reset();boardMotion.reset();}
  if(note.isMetadataUpdate===true){const s=active?.note.uuid===note.uuid?active:retainedSessions.get(note.uuid);if(s)imNoteMetadataReceived(s.note,note);return;}
  if(active?.note.uuid===note.uuid&&!force){
    const s=active,text=note.content?.text||'';
    if(s.note.content?.text===text||((s.pending||s.error)&&knownSessionText(s,text))){
      receiveNativeFields(s,note);return;
    }
    const editing=modalState?.kind==='edit'&&modalState.uuid===note.uuid&&(modalState.currentText!==modalState.original||modalState.titleValue!==modalState.originalTitle||JSON.stringify([...modalState.tags])!==JSON.stringify(modalState.originalTags));
    if(s.pending||s.error||s.dirty||editing||s.titleEntry){s.remote=note;retainedSessions.set(note.uuid,s);imCancelQueuedNoteSaves(note.uuid);renderNotice();return;}
  }
  const previous=active;if(previous?.titleEntry)retainedSessions.set(previous.note.uuid,previous);
  if(previous){previous.view.scroll=viewport.scrollTop;viewMemory.set(previous.note.uuid,previous.view);stashEdit();}
  closeModal(true);hideMenu();dateOpen=false;$('date-panel').replaceChildren();
  if(force){
    const discarded=retainedSessions.get(note.uuid)||previous;
    if(discarded?.note.uuid===note.uuid){discarded.discarded=true;imCancelQueuedNoteSaves(note.uuid);retainedSessions.delete(note.uuid);}
    for(const [key,entry] of unfinishedEdits)if(entry.noteId===note.uuid)unfinishedEdits.delete(key);
  }
  const retained=!force&&retainedSessions.get(note.uuid);
  if(retained){
    active=retained;imNoteUnconfirmed(retained.note);
    const text=note.content?.text||'';
    if(knownSessionText(retained,text))receiveNativeFields(retained,note);
    else{retained.remote=note;imCancelQueuedNoteSaves(note.uuid);}
    $('search').value=retained.view.query;renderAll();viewport.scrollTop=retained.view.scroll||0;scheduleWindow();
    safeRun(()=>applyTransferMarks(retained));return;
  }
  const parsed=imFormat.inspect(note.content?.text);
  const s={note,messages:imFormat.readMessages(note),settings:imFormat.readSettings(note),draft:imFormat.readDraft(note),reply:imFormat.readReply(note),
    damaged:parsed.kind==='damaged',plain:parsed.kind==='plain'&&!!note.content?.text,deleted:!!note.deleted,
    view:newView(note.uuid),pending:0,revision:0,error:'',remote:null,intents:new Set(),demo:!!note.mosaicDemo,
    captureValue:imFormat.readDraft(note),captureOriginal:imFormat.readDraft(note),captureRevision:0,submission:null,composing:false,submitAfterComposition:null,
    dirty:false,discarded:false,lastHostText:note.content?.text||'',lastAck:null,nativeRepair:false};
  const valid=new Set(s.messages.map(m=>m.id));s.view.selected=new Set([...s.view.selected].filter(id=>valid.has(id)));
  if(s.view.selected.size)s.view.selecting=true;
  active=s;dateOpen=false;$('date-panel').replaceChildren();imNoteReceived(note);
  $('search').value=s.view.query;viewport.scrollTop=0;
  renderAll();viewport.scrollTop=s.view.scroll||0;scheduleWindow();
  if(force&&writable(s)&&imNoteSavePending(note.uuid))safeRun(()=>persist(s));
  safeRun(()=>applyTransferMarks(s));
}
function writable(s=active) {return !!s&&s===active&&!s.discarded&&!s.damaged&&!s.deleted&&!s.plain&&!s.remote;}
function persist(s) {
  if(!writable(s))return Promise.reject(new Error('Saving is paused. The original note has been kept.'));
  const revision=++s.revision,submitted={text:s.note.content.text,native:imNoteNativeSignature(s.note)};
  s.pending++;s.dirty=true;s.error='';retainedSessions.set(s.note.uuid,s);renderStatus();renderNotice();
  const promise=s.demo?Promise.resolve():imPersistNote(s.note);
  return promise.then(()=>{
    if(s.discarded)return;
    const confirmed=imConfirmedNote?.note===s.note?imConfirmedNote.snapshot:null;
    s.lastAck=confirmed?{text:confirmed.text,native:imNoteNativeSignature(confirmed.item)}:submitted;
    if(s.remote)return;
    if(revision===s.revision){s.error='';s.dirty=false;s.nativeRepair=false;if(!s.titleEntry)retainedSessions.delete(s.note.uuid);}
    for(const intent of [...s.intents])if(intent.revision<=revision){s.intents.delete(intent);intent.finish();}
    if(active===s)safeRun(()=>applyTransferMarks(s));
  },error=>{
    if(!s.discarded&&revision===s.revision){s.error='Saving was not confirmed. Keep this editor open and retry. Your text is still here.';s.dirty=true;retainedSessions.set(s.note.uuid,s);}
    throw error;
  }).finally(()=>{s.pending--;if(!s.pending&&!s.dirty&&!s.error&&!s.remote&&!s.titleEntry)retainedSessions.delete(s.note.uuid);if(active===s){renderStatus();renderNotice();}});
}
function update(s, change, redraw=true) {
  if(!writable(s))throw new Error('Saving is paused. Your original note is unchanged.');
  boardDrag.cancel(false);
  const previousIds=redraw?new Set(s.messages.map(m=>m.id)):null;
  const added=redraw&&change.messages?change.messages.filter(m=>!previousIds.has(m.id)).map(m=>m.id):[];
  const before=added.length?boardMotion.snapshot(mounted):null;
  if(added.length)boardMotion.queue(added);
  const messages=change.messages??s.messages,settings=change.settings??s.settings;
  const draft=Object.hasOwn(change,'draft')?change.draft:s.draft,reply=Object.hasOwn(change,'reply')?change.reply:s.reply;
  imFormat.write(s.note,messages,settings,draft,reply);
  Object.assign(s,{messages:messages===s.messages?s.messages:imFormat.readMessages(s.note),settings:imFormat.readSettings(s.note),draft:imFormat.readDraft(s.note),reply:imFormat.readReply(s.note)});
  const promise=persist(s);
  if(s===active){if(redraw){renderAll(!!before);if(before)boardMotion.move(before,mounted);}else renderCapture();}
  return promise;
}
function retrySave() {if(active)safeRun(()=>persist(active));}
function renderStatus() {
  const node=$('save-status'),s=active;
  const text=saveFeedback.update(s?.note.uuid,!!s?.pending,!!(s?.error||s?.remote||s?.damaged||s?.deleted||s?.view.selecting));
  node.classList.add('ui-save-feedback');node.classList.toggle('saving',text==='Saving…');
  node.textContent=s?.demo?'Preview · not saved':text;node.hidden=!node.textContent;
  node.title=text==='Saved'?'Accepted by Standard Notes':'';
}
function renderNotice() {
  const box=$('notice');box.replaceChildren();const s=active;box.hidden=true;if(!s)return;
  let text='';
  if(s.damaged)text='Saving is paused: this is not a valid format-3 note. The original text is unchanged. Format-2 notes belong in IM-style-editor Archive.';
  else if(s.deleted)text='This note is deleted. Restore it in Standard Notes before editing.';
  else if(s.remote)text='Standard Notes sent a different version while you had unsaved changes. Saving is paused so neither version is silently overwritten.';
  else if(s.plain)text='This is an ordinary plain-text note. Convert it to the shared card format before editing.';
  else if(s.error)text=s.error;
  if(!text)return;box.hidden=false;box.append(el('span','',text));
  if(s.error&&!s.remote)box.append(button('Retry save',null,retrySave,''));
  if(s.plain)box.append(button('Use card format',null,()=>confirmAction('Use the shared card format?','Your existing text will become cards. Mosaic and the current IM editor will both be able to open this note.','Convert note',()=>{s.plain=false;return update(s,{});}),''));
  if(s.damaged||s.remote||s.error)box.append(button('Review text',null,()=>recoveryDialog(s),''));
}
function renderCapture() {
  const s=active,field=$('capture-input'),value=MosaicModel.normalized(s?.titleEntry?.text??s?.captureValue??'');
  captureEditor?.setContext((s?.note.uuid||'')+':'+(s?.titleEntry?.id||'capture'),value,!!s?.titleEntry);
  field.setAttribute('aria-label',s?.titleEntry?'Title':'Take a note');field.placeholder=s?.titleEntry?'Write a title…':'Take a note…';
  if(field.value!==value)field.value=value;
  field.disabled=!writable();scheduleWindow();
  const quote=$('capture-reply');quote.replaceChildren();quote.hidden=!s?.reply&&!s?.titleEntry;
  if(s?.titleEntry){const source=s.messages.find(m=>m.id===s.titleEntry.id);quote.append(el('strong','','Title for card'),el('span','inline-quote',source?imMarkdown.message(source).text.slice(0,160)||'Card':'Card'),button('Cancel title entry','close',()=>{s.titleEntry=null;if(!s.dirty&&!s.pending)retainedSessions.delete(s.note.uuid);renderCapture();},'icon-button'));}
  else if(s?.reply){
    const text=button('Show quoted card',null,()=>jumpTo(s.reply),'inline-quote');text.textContent=imMarkdown.message(s.reply).text.replace(/\s+/g,' ').slice(0,160)||'Quoted message';
    quote.append(text,button('Cancel reply','close',()=>safeRun(()=>update(s,{reply:null},false)),'icon-button danger'));
  }
}
function inputCapture(){
  const s=active;if(!writable(s))return;
  const value=$('capture-input').value;
  if(s.titleEntry){s.titleEntry.text=value;return;}
  s.captureValue=value===MosaicModel.normalized(s.captureOriginal)?s.captureOriginal:value;s.captureRevision++;
  safeRun(()=>update(s,{draft:s.captureValue},false));
}
function submitCapture(s=active,tag=s?.view.tag){
  if(s?.titleEntry){if(s.composing){s.submitAfterComposition={title:true};return Promise.resolve();}return submitTitle(s);}
  if(!writable(s)||s.submission||!imMarkdown.hasText(s.captureValue))return Promise.resolve();
  if(s.composing){s.submitAfterComposition={tag};return Promise.resolve();}
  const text=s.captureValue,revision=s.captureRevision;
  const tags=tag&&tag!=='__untagged__'?[tag]:[];
  const message={id:imFormat.newId(),text,reactions:tags,createdAt:new Date().toISOString(),...(s.reply?{replyTo:s.reply}:{})};
  s.submission={id:message.id,text,revision};
  s.locatedId=message.id;setTimeout(()=>{if(s.locatedId===message.id)s.locatedId=null;},2200);
  // Reveal the card just captured, including when a search or pins-only view
  // would otherwise hide it. Its active emoji filter still supplies the label.
  if(s.view.query&&!text.toLocaleLowerCase().includes(s.view.query.toLocaleLowerCase())){s.view.query='';$('search').value='';}
  s.view.pinned=false;
  let saving;
  try{saving=update(s,{messages:[...s.messages,message],draft:'',reply:null});}
  catch(error){s.submission=null;throw error;}
  const placed=layout.byId?.get(message.id);
  if(placed){
    const origin=board.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
    viewport.scrollTo({top:Math.max(0,origin+placed.y-64),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    scheduleWindow();requestAnimationFrame(()=>mounted.get(message.id)?.classList.add('located'));
  }
  s.intents.add({revision:s.revision,finish:()=>{
    s.submission=null;
    if(s.captureRevision===revision){s.captureValue='';s.captureOriginal='';}
    else s.captureOriginal=s.captureValue;
    if(active===s)renderCapture();
  }});
  return saving;
}
function beginTitle(id){
  const s=active,source=s?.messages.find(m=>m.id===id);if(!source||!writable(s))return;
  if(s.titleEntry&&s.titleEntry.id!==id){hideMenu();notify('Finish or cancel the current title entry first.');return;}
  if(!s.titleEntry)s.titleEntry={id,text:imFormat.title(source),original:imFormat.title(source),pending:false};retainedSessions.set(s.note.uuid,s);hideMenu();renderCapture();$('capture-input').focus();
}
function submitTitle(s){
  const entry=s.titleEntry;if(!writable(s)||!entry||entry.pending)return Promise.resolve();
  const source=s.messages.find(m=>m.id===entry.id),text=entry.text;
  if(!source||imFormat.title(source)!==entry.original&&imFormat.title(source)!==entry.submitted)throw new Error('This title changed. Your entry is retained; review before saving.');
  entry.pending=true;entry.submitted=text.trim()?text:'';
  const saving=update(s,{messages:s.messages.map(m=>m.id===entry.id?imFormat.withTitle(m,text):m)});
  s.intents.add({revision:s.revision,finish:()=>{entry.pending=false;entry.original=text.trim()?text:'';if(s.titleEntry===entry&&entry.text===text)s.titleEntry=null;if(active===s)renderCapture();}});
  return saving.catch(error=>{entry.pending=false;throw error;});
}
function renderTags() {
  const box=$('tag-filters');box.replaceChildren();if(!active)return;
  const s=active;
  const add=(tag,label,icon)=>{
    const node=button(label,icon,()=>{s.view.tag=s.view.tag===tag?'':tag;s.view.scroll=0;viewport.scrollTop=0;searchOpen=false;renderAll();},'tag-chip'+(tag==='__untagged__'?' untagged':''));
    if(!icon){node.replaceChildren(el('span','',tag?label:'All'));}
    node.setAttribute('aria-label',tag==='__untagged__'?'Untagged cards':tag?'Filter by '+tag:'All tags');node.setAttribute('aria-pressed',String(s.view.tag===tag));
    box.append(node);
  };
  add('','All tags');
  const tags=MosaicModel.tags(s.messages,s.settings),pos=Number.isInteger(s.settings.untaggedPosition)?Math.max(0,Math.min(tags.length,s.settings.untaggedPosition)):tags.length;
  tags.splice(pos,0,'__untagged__');for(const tag of tags)add(tag,tag,tag==='__untagged__'?'untagged':null);
}
function renderAll(inserting=false) {
  boardDrag.cancel(false);
  const s=active;renderAppearance();renderStatus();renderNotice();renderCapture();renderTags();
  $('welcome').hidden=!!s;$('more-button').disabled=!s;$('search-button').disabled=!s;$('pinned-filter').disabled=!s;$('search').disabled=!s;
  $('pinned-filter').setAttribute('aria-pressed',String(!!s?.view.pinned));
  renderSearchControls();refreshEditorMetadata();
  $('app').classList.toggle('selection-mode',!!s?.view.selecting);
  rebuildLayout(inserting);renderSelection();
}
function renderAppearance() {
  const root=document.documentElement,{palette,fontSize}=MosaicModel.appearance(active?.settings),font=MosaicModel.fontSizes[fontSize];
  const scale=typeof active?.settings.scale==='number'&&Number.isFinite(active.settings.scale)&&active.settings.scale>0?active.settings.scale:1.12;
  root.style.setProperty('--scale',String(scale));
  if(root.dataset.mosaicPalette!==palette)root.dataset.mosaicPalette=palette;
  if(root.dataset.mosaicFontSize!==fontSize)root.dataset.mosaicFontSize=fontSize;
  for(const [key,value] of Object.entries(font))if(typeof value==='number'){
    const name='--type-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),next=value+'px';
    if(root.style.getPropertyValue(name)!==next)root.style.setProperty(name,next);
  }
}
function rebuildLayout(inserting=false) {
  const anchor=inserting?null:findAnchor();
  layout=active?MosaicModel.layout(active.messages,active.settings,Math.max(1,board.clientWidth),active.view.query,active.view.tag,active.view.pinned,active.view.selecting,boardPreviewRatio,boardPinnedRatio):{items:[],headings:[],height:0,count:0};
  board.style.height=layout.height+'px';board.replaceChildren();mounted.clear();
  for(const heading of layout.headings){const node=el('div','section-heading',heading.label);node.style.top=heading.y+'px';board.append(node);}
  const filtered=active&&(active.view.query||active.view.tag||active.view.pinned);
  $('empty').hidden=!active||!!layout.count||active.damaged||!filtered;
  if(anchor){const next=layout.byId?.get(anchor.id);if(next)viewport.scrollTop+=next.y-anchor.y;}
  renderWindow();
}
function reflowBoard() {
  const s=active;if(!s)return;
  layout=MosaicModel.layout(s.messages,dragPreview?.session===s?dragPreview.settings:s.settings,Math.max(1,board.clientWidth),s.view.query,s.view.tag,s.view.pinned,s.view.selecting,boardPreviewRatio,boardPinnedRatio);
  board.style.height=layout.height+'px';
  for(const [i,node] of [...board.querySelectorAll('.section-heading')].entries())if(layout.headings[i])node.style.top=layout.headings[i].y+'px';
  renderWindow();
}
function findAnchor() {
  const top=viewport.getBoundingClientRect().top,origin=board.getBoundingClientRect().top;
  const item=MosaicModel.visible(layout,top-origin,top-origin+viewport.clientHeight).find(p=>p.y+origin+p.height>top&&p.y+origin<top+viewport.clientHeight);
  return item?{id:item.message.id,y:item.y}:null;
}
function scheduleWindow() {if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderWindow();});}
function renderWindow() {
  const top=viewport.getBoundingClientRect().top-board.getBoundingClientRect().top,low=top-550,high=top+viewport.clientHeight+550,fontSize=MosaicModel.appearance(active?.settings).fontSize;
  const visible=new Set(),measurements=[];
  for(const item of MosaicModel.visible(layout,low,high)){
    visible.add(item.message.id);
    let node=mounted.get(item.message.id);
    if(!node){node=cardNode(item.message,item.width);mounted.set(item.message.id,node);board.append(node);}
    node.classList.toggle('is-drag-placeholder',!!boardDrag.placeholder(item.message.id));
    node.classList.toggle('is-compact',item.width<230);
    const geometry=item.width+':'+fontSize+':'+item.previewRatio;
    Object.assign(node.style,{width:item.width+'px',height:node.dataset.geometry===geometry?item.height+'px':'auto',transform:`translate(${item.x}px,${item.y}px)`});
    if(node.dataset.geometry!==geometry){
      node.dataset.geometry=geometry;node.style.removeProperty('--board-title-lines');node.style.removeProperty('--board-body-lines');
      measurements.push({node,item});
    }
  }
  for(const [id,node] of mounted)if(!visible.has(id)){node.remove();mounted.delete(id);}
  // Body text owns the standard preview allowance. Titles, replies and tags
  // add height outside it; they never change the body's visible line count.
  const previewLimit=({node,item})=>{
    const title=node.querySelector('.card-title'),body=node.querySelector('.card-body');
    const bounds=MosaicModel.boardBounds(item.width,fontSize,item.previewRatio),available=bounds.maximum-bounds.padding;
    const bodyStyle=body&&getComputedStyle(body),titleStyle=title&&getComputedStyle(title);
    const bodyLine=bodyStyle?parseFloat(bodyStyle.lineHeight):0,titleLine=titleStyle?parseFloat(titleStyle.lineHeight):0;
    const titleLines=title?Math.max(1,Math.floor(available/titleLine)):0;
    const bodyLines=body?Math.max(1,Math.floor(available/bodyLine)):0;
    return {node,titleLines,bodyLines,bodyHeight:bodyLines?bodyLines*bodyLine:available};
  };
  const limits=measurements.map(previewLimit);
  for(const {node,titleLines,bodyLines,bodyHeight} of limits){node.style.setProperty('--board-title-lines',titleLines);node.style.setProperty('--board-body-lines',bodyLines);node.style.setProperty('--board-body-height',bodyHeight+'px');}
  // Measure only newly mounted/resized previews, in one read batch. Reuse those
  // real heights on future layouts rather than leaving guessed empty space.
  let changed=false;const selecting=!!active?.view.selecting;
  const sizes=measurements.map(({node,item})=>{
    const truncated=[...node.querySelectorAll('.card-title,.card-body')].some(field=>field.scrollHeight>field.clientHeight+1);
    const body=node.querySelector('.card-body'),bodyTruncated=body&&body.scrollHeight>body.clientHeight+1;
    const bounds=MosaicModel.boardBounds(item.width,fontSize,item.previewRatio),filler=bodyTruncated?Math.max(0,bounds.maximum-bounds.padding-body.clientHeight):0;
    return {node,item,truncated,height:Math.ceil(node.getBoundingClientRect().height+filler)};
  });
  for(const {node,item,truncated,height} of sizes){
    node.classList.toggle('is-truncated',truncated);
    if(truncated)node.style.height=height+'px';
    const measured=MosaicModel.measure(item.message,item.width,node.classList.contains('is-pinned'),selecting,height,fontSize,item.previewRatio);
    if(measured&&(height!==item.height))changed=true;
  }
  if(changed){
    const anchor=findAnchor(),s=active,locatedY=s.locatedId?layout.byId.get(s.locatedId)?.y:null,atBottom=viewport.scrollHeight-viewport.clientHeight-viewport.scrollTop<=4;
    layout=MosaicModel.layout(s.messages,dragPreview?.session===s?dragPreview.settings:s.settings,Math.max(1,board.clientWidth),s.view.query,s.view.tag,s.view.pinned,s.view.selecting,boardPreviewRatio,boardPinnedRatio);
    board.style.height=layout.height+'px';
    for(const [index,heading] of layout.headings.entries())board.querySelectorAll('.section-heading')[index].style.top=heading.y+'px';
    for(const [id,node] of mounted){const item=layout.byId.get(id);if(item)Object.assign(node.style,{height:item.height+'px',transform:`translate(${item.x}px,${item.y}px)`});}
    if(s.locatedId&&!boardDrag.dragging&&locatedY!=null){const next=layout.byId.get(s.locatedId);if(next&&Math.abs(next.y-locatedY)>.5)viewport.scrollTop+=next.y-locatedY;}
    else if(!s.locatedId&&!boardDrag.dragging){
      if(atBottom)viewport.scrollTop=viewport.scrollHeight;
      else if(anchor){const next=layout.byId.get(anchor.id);if(next&&Math.abs(next.y-anchor.y)>.5)viewport.scrollTop+=next.y-anchor.y;}
    }
    scheduleWindow();
  }
  boardMotion.reveal(mounted);
}
function metaText(message) {
  const bits=[];if(message.copied)bits.push('Copied');if(message.exported)bits.push('Exported');if(MosaicModel.isImported(message))bits.push('Imported');
  if(message.createdAt&&!Number.isNaN(new Date(message.createdAt).getTime()))bits.push(cardTimestampFormat.format(new Date(message.createdAt)));
  if(message.edited)bits.push('Edited');return bits.join(' · ');
}
function renderSearchControls() {
  renderDateControls();
  const s=active,selecting=!!s?.view.selecting,filtered=!!s&&(s.view.query||s.view.tag||s.view.pinned);
  $('search-tags-panel').hidden=!searchOpen||selecting;$('search-button').setAttribute('aria-expanded',String(searchOpen&&!selecting));$('change-filter').setAttribute('aria-expanded',String(searchOpen&&!selecting));
  if(searchOpen&&!selecting){const header=document.querySelector('.board-toolbar'),panel=$('search-tags-panel');panel.style.top=(header.offsetTop+header.offsetHeight+6)+'px';if(!searchPanelFit)searchPanelFit=imWatchSearchPanel(panel);else searchPanelFit.update();}
  else if(searchPanelFit){searchPanelFit.destroy();searchPanelFit=null;}
  $('search-button').hidden=!!filtered||selecting;$('more-button').hidden=!!filtered||selecting;$('filter-pill').hidden=!filtered||selecting;
  const change=$('change-filter');change.replaceChildren();
  const symbol=el('span','filter-symbol ui-filter-symbol');
  if(s?.view.tag&&s.view.tag!=='__untagged__')symbol.textContent=s.view.tag;
  else symbol.append(s?.view.tag==='__untagged__'?mosaicToolbarIcon('untagged'):s?.view.pinned?mosaicIcon('pin'):mosaicToolbarIcon('searchOnly'));
  const check=el('span','filter-check ui-filter-check');check.append(mosaicToolbarIcon('check'));symbol.append(check);change.append(symbol);
}
function renderDateControls(){
 if(!searchOpen)dateOpen=false;
 $('date-filter-button').setAttribute('aria-expanded',String(dateOpen));
 const holder=$('date-panel');holder.hidden=!dateOpen;
 if(!dateOpen)holder.replaceChildren();
 else if(!holder.firstChild){const session=active;holder.append(imCreateDateJumpPanel({onJump:value=>{
  if(active!==session)return false;
  const target=imDateTarget(session.messages,value);if(!target)return false;
  searchOpen=false;dateOpen=false;
  jumpTo(MosaicModel.reply(target.message,session.note.uuid));
  const notice=imDateJumpNotice(target);if(notice)notify(notice);return true;
 },onClose:()=>{dateOpen=false;renderDateControls();}}));holder.firstChild.openPicker();}
}
$('date-filter-button').append(mosaicToolbarIcon('calendarSearch'));
$('date-filter-button').addEventListener('click',()=>{dateOpen=!dateOpen;renderDateControls();});
function toggleSearch() {searchOpen=!searchOpen;hideMenu();renderSearchControls();if(searchOpen)$('search').focus();}
function fillEmojiTag(badge,tag){
  badge.replaceChildren();
  // The same rounded vector body, pointed tail and transparent hole as IM.
  for(const [className,markup] of [
    ['emoji-tag-body','<rect width="100%" height="100%" rx="6"/><rect x="50%" width="50%" height="100%"/>'],
    ['emoji-tag-tip','<path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H2Q6 0 9 4L18 16Q22 20 18 24L9 36Q6 40 2 40H0ZM13 20a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0Z"/>']]){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class',className);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    if(className==='emoji-tag-tip')svg.setAttribute('viewBox','0 0 20 40');svg.innerHTML=markup;badge.append(svg);
  }
  badge.append(el('span','emoji-tag-emoji',tag));
}
function cardNode(message,width) {
  const s=active,parts=MosaicModel.preview(message),pinned=MosaicModel.pins(s.settings).includes(message.id);
  const node=el('article','card'+(pinned?' is-pinned':'')+(s.view.selected.has(message.id)?' selected':''));
  if(s.locatedId===message.id)node.classList.add('located');
  const color=MosaicModel.color(message);node.style.setProperty('--card-color',color.background);node.style.setProperty('--card-ink',color.ink);
  node.dataset.id=message.id;node.setAttribute('role','listitem');node.tabIndex=0;node.setAttribute('aria-label',MosaicModel.label(message));
  if(s.view.selecting){const check=el('span','selection-check');if(s.view.selected.has(message.id))check.append(mosaicIcon('check'));node.append(check);node.setAttribute('aria-label',(s.view.selected.has(message.id)?'Selected: ':'Select: ')+MosaicModel.label(message));}
  const activate=()=>{if(!menu.hidden)return;s.view.selecting?toggleSelection(message.id):writable(s)?editorDialog(message.id):readCard(message.id);};
  if(parts.title)node.append(el('h2','card-title',parts.title));
  if(message.replyTo)node.append(el('div','card-reply',imMarkdown.message(message.replyTo).text.replace(/\s+/g,' ').slice(0,150)||'Quoted message'));
  if(parts.body){const body=el('div','card-body im-rich-display');imMarkdown.render(body,imMarkdown.bounded(message),index=>{
    if(active!==s||!writable(s))return;
    if(s.view.selecting){toggleSelection(message.id);return;}
    const source=s.messages.find(m=>m.id===message.id);if(source)safeRun(()=>update(s,{messages:s.messages.map(m=>m===source?imFormat.editMessage(m,imMarkdown.toggleCheck(m.text,index)):m)}));
  });node.append(body);}
  if(message.reactions.length){
    const tags=el('div','card-tags');
    const tagCount=MosaicModel.boardTagCount(message,width,MosaicModel.appearance(s.settings).fontSize);
    for(const tag of message.reactions.slice(0,tagCount)){
      const badge=button('Filter messages by '+tag,null,()=>{
        if(active!==s)return;
        if(s.view.selecting){toggleSelection(message.id);return;}
        s.view.tag=tag;s.view.scroll=0;viewport.scrollTop=0;searchOpen=false;hideMenu();renderAll();
      },'card-tag');
      fillEmojiTag(badge,tag);tags.append(badge);
    }
    const remaining=message.reactions.length-tagCount;
    if(remaining>0){const more=button('Show '+remaining+' more tag'+(remaining===1?'':'s'),null,activate,'card-tag card-tag-overflow');more.textContent='+'+remaining;tags.append(more);}
    node.append(tags);
  }
  node.addEventListener('click',activate);
  node.addEventListener('keydown',event=>{
    if(event.target!==node)return;
    if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)&&!s.view.selecting&&writable(s)){
      event.preventDefault();
      if(event.repeat)return;
      const pinned=new Set(MosaicModel.pins(s.settings)),items=layout.items.filter(item=>pinned.has(item.message.id)===pinned.has(message.id)),i=items.findIndex(item=>item.message.id===message.id),direction=event.key==='ArrowUp'?-1:1,target=items[i+direction];
      if(target){const before=boardMotion.snapshot(mounted),settings=MosaicModel.moveCard(s.messages,s.settings,message.id,target.message.id,direction>0);safeRun(()=>update(s,{settings}));boardMotion.move(before,mounted);mounted.get(message.id)?.focus({preventScroll:true});}
      return;
    }
    if(event.key==='Enter'||event.key===' '){event.preventDefault();node.click();}
  });
  bindContextMenu(node,event=>{const current=s.messages.find(m=>m.id===message.id);if(current)cardMenu(current,event);},()=>active===s&&!s.view.selecting&&!boardDrag.placeholder(message.id));
  return node;
}
function toggleSelection(id) {const v=active.view,entering=!v.selecting;v.selecting=true;searchOpen=false;v.selected.has(id)?v.selected.delete(id):v.selected.add(id);rememberSelection();if(entering)renderAll();else{refreshSelectionCards();renderSelection();}}
function refreshSelectionCards(){for(const [id,node] of mounted){const selected=active.view.selected.has(id);node.classList.toggle('selected',selected);const check=node.querySelector('.selection-check');if(check){check.replaceChildren();if(selected)check.append(mosaicIcon('check'));}const message=layout.byId?.get(id)?.message;if(message)node.setAttribute('aria-label',(selected?'Selected: ':'Select: ')+MosaicModel.label(message));}}
function startSelection(id) {active.view.selecting=true;searchOpen=false;if(id)active.view.selected.add(id);rememberSelection();renderAll();}
function cancelSelection() {if(!active)return;active.view.selecting=false;active.view.selected.clear();rememberSelection();renderAll();}
function selectedRecords() {return active.messages.filter(m=>active.view.selected.has(m.id));}
function renderSelection() {
  const bar=$('selection-bar'),toolbar=$('selection-toolbar'),s=active;bar.hidden=toolbar.hidden=!s?.view.selecting;bar.replaceChildren();toolbar.replaceChildren();if(bar.hidden)return;
  const count=s.view.selected.size,controls=el('div','ui-selection-actions');controls.setAttribute('aria-label','Selected cards');
  const choices=[['tag','Add tags to selected cards',event=>batchTagMenu(event)],['copy','Copy selected',()=>safeRun(()=>copyRecords(s,selectedRecords()))],
    ['export','Export selected',()=>safeRun(()=>exportRecords(s,selectedRecords()))],['more','Selection options',event=>showMenu([['Merge selected','merge',()=>mergeDialog()],['Clear message statuses','select',()=>statusDialog(new Set(s.view.selected))]],event)],
    ['delete','Delete selected',()=>deleteCards(s,new Set(s.view.selected))]];
  for(const [kind,label,action] of choices){const control=button(label,null,action,'ui-selection-action'+(kind==='delete'?' selection-delete':''));control.replaceChildren(mosaicIcon(kind,true));control.disabled=!count||!writable(s);controls.append(control);}
  toolbar.append(controls);
  const all=button('Select all','selectAll',()=>{for(const item of layout.items)s.view.selected.add(item.message.id);rememberSelection();refreshSelectionCards();renderSelection();},'selection-all');
  const description=el('span','selection-description',`${count} / ${s.messages.length} selected`);description.setAttribute('role','status');
  const cancel=button('Cancel selection',null,cancelSelection,'selection-cancel');cancel.replaceChildren(mosaicIcon('cancel',true));bar.append(all,description,cancel);
  syncOverlayMetrics();
}
function syncOverlayMetrics() {
  const app=$('app'),capture=$('capture-composer');if(!capture)return;
  const height=Math.ceil(capture.getBoundingClientRect().height),bottom=parseFloat(getComputedStyle(capture).bottom)||24;
  const set=(key,value)=>{if(app.style.getPropertyValue(key)!==value)app.style.setProperty(key,value);};
  set('--notice-height',($('notice').hidden?0:$('notice').offsetHeight)+'px');
  set('--capture-clearance',(height+bottom+16)+'px');
  $('selection-bar').style.setProperty('--selection-row-height',Math.max(46,height)+'px');
  if(searchOpen)renderSearchControls();
}
function batchTagMenu(event) {
  const s=active,ids=new Set(s.view.selected);if(!ids.size||!writable(s))return;
  const records=s.messages.filter(m=>ids.has(m.id));hideMenu();menu.replaceChildren();menu.className='menu ui-context-menu';menu.setAttribute('role','group');menu.setAttribute('aria-label','Tags for selected cards');
  const panel=el('section','ui-tag-panel'),grid=el('div','ui-tag-grid');
  for(const tag of MosaicModel.tags(s.messages,s.settings)){
    const choice=button('Add '+tag+' to selected cards',null,()=>{
      hideMenu();if(active!==s||!writable(s))return;
      const messages=s.messages.map(m=>ids.has(m.id)&&!m.reactions.includes(tag)?{...m,reactions:[...m.reactions,tag]}:m);
      if(messages.some((m,i)=>m!==s.messages[i]))safeRun(()=>update(s,{messages}));
    },'ui-tag-choice');choice.textContent=tag;choice.setAttribute('aria-pressed',String(records.every(m=>m.reactions.includes(tag))));grid.append(choice);
  }
  panel.append(grid);menu.append(panel);placeMenu(event);
}
function togglePin(s,id) {
  const ids=MosaicModel.pins(s.settings);const next=ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
  return update(s,{settings:{...s.settings,pinnedMessageIds:next}});
}
function showMenu(items,event,{message,toggleTag}={}) {
  hideMenu();menu.replaceChildren();menu.className='menu ui-context-menu';menu.setAttribute('role','menu');menu.removeAttribute('aria-label');
  if(message){
    const panel=el('section','ui-tag-panel'),grid=el('div','ui-tag-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Emoji picker');
    for(const tag of new Set([...MosaicModel.tags(active.messages,active.settings),...message.reactions])){
      const choice=button('Tag '+tag,null,()=>{hideMenu();toggleTag(tag);},'ui-tag-choice');choice.textContent=tag;choice.setAttribute('aria-pressed',String(message.reactions.includes(tag)));grid.append(choice);
    }
    panel.append(grid);menu.append(panel);
  }
  const panel=el('div','ui-action-panel');
  for(const item of items){if(!item){panel.append(el('hr'));continue;}const [label,icon,action,danger]=item;const b=button(label,icon,()=>{hideMenu();safeRun(action);},danger?'danger':'');b.append(el('span','',label));b.setAttribute('role','menuitem');panel.append(b);}
  menu.append(panel);
  placeMenu(event);
}
function placeMenu(event) {
  (modal.open?$('modal-content'):document.body).append(menu);
  menu.style.maxHeight='';menu.style.maxWidth='';menuFromTouch=event?.touch===true;menuPress=false;
  menu.hidden=false;$('more-button').setAttribute('aria-expanded',String(event?.currentTarget===$('more-button')));
  const anchor=(event?.currentTarget||$('more-button')).getBoundingClientRect();
  const x=event?.clientX||anchor.right,y=event?.clientY||anchor.bottom;
  const rect=menu.getBoundingClientRect();menu.style.left=Math.max(10,Math.min(x-rect.width+20,innerWidth-rect.width-10))+'px';menu.style.top=Math.max(10,Math.min(y+7,innerHeight-rect.height-10))+'px';
  if(menuFromTouch){
    const visual=window.visualViewport,position=imMenuPosition({anchor:event.anchor,point:{x,y},width:rect.width,height:menu.scrollHeight+menu.offsetHeight-menu.clientHeight,viewport:{left:visual?.offsetLeft||0,top:visual?.offsetTop||0,width:visual?.width||innerWidth,height:visual?.height||innerHeight},touch:true});
    Object.assign(menu.style,{left:position.x+'px',top:position.y+'px',maxWidth:position.maxWidth+'px',maxHeight:position.maxHeight+'px'});
  }
  menu.tabIndex=-1;if(event?.currentTarget!==$('more-button'))menu.focus({preventScroll:true});
}
function hideMenu(){menu.hidden=true;$('more-button').setAttribute('aria-expanded','false');menuFromTouch=false;menuPress=false;if(menu.parentNode!==document.body)document.body.append(menu);}
function clearCardMotion(d){
  if(!d)return;cancelAnimationFrame(d.motionFrame);d.motionFrame=0;
  cancelAnimationFrame(d.motionStartFrame);d.motionStartFrame=0;
  d.cardAnimation?.cancel();modal.classList.remove('card-is-moving');
}
function settleCardMotion(){
  if(modalState?.kind==='edit'&&!modalState.root.inert){clearCardMotion(modalState);modalState.prepareBody?.();}
}
function colorMenu(id,event) {
  settleCardMotion();
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  hideMenu();menu.replaceChildren();menu.className='menu color-menu';menu.setAttribute('role','group');menu.setAttribute('aria-label','Card background colors');
  const grid=el('div','color-grid'),current=MosaicModel.color(message).id;
  for(const preset of MosaicModel.colors){
    const swatch=button(preset.name,preset.id==='default'?'noColor':null,()=>{
      hideMenu();if(active!==s||!writable(s))return;
      const source=s.messages.find(m=>m.id===id);if(!source||(preset.id==='default'?!Object.hasOwn(source,'cardColor'):source.cardColor===preset.id))return;
      const next={...source};if(preset.id==='default')delete next.cardColor;else next.cardColor=preset.id;
      safeRun(()=>update(s,{messages:s.messages.map(m=>m.id===id?next:m)}));
    },'color-swatch');
    swatch.setAttribute('aria-pressed',String(preset.id===current));
    swatch.style.setProperty('--swatch',preset.light||'var(--surface)');
    if(preset.id===current)swatch.append(mosaicIcon('check'));grid.append(swatch);
  }
  menu.append(grid);placeMenu(event);
}
function cardMenu(message,event) {
  settleCardMotion();
  const s=active,pinned=MosaicModel.pins(s.settings).includes(message.id);
  const editing=modalState?.kind==='edit'&&modalState.uuid===s.note.uuid&&modalState.id===message.id?modalState:null;
  const current=()=>s.messages.find(m=>m.id===message.id);
  const saved=action=>async()=>{if(editing&&!(await editing.commit(false)))return;return action();};
  showMenu([['Edit','edit',()=>editCard(message.id)],...(imFormat.title(message)?[['Edit title','textSize',()=>{if(editing)editing.unlockTitle();else beginTitle(message.id);}]]:[]),['Reply','reply',saved(()=>replyTo(message.id))],[pinned?'Unpin':'Pin',pinned?'unpin':'pin',()=>togglePin(s,message.id)],
    ['Copy','copy',saved(()=>copyRecords(s,[current()]))],['Select','select',saved(()=>{closeModal(true);startSelection(message.id);})],null,['Delete','trash',saved(()=>deleteCards(s,new Set([message.id]))),true]],event,{
    message:editing?{...message,reactions:[...editing.tags]}:message,
    toggleTag:tag=>{
      if(editing){editing.toggleTag(tag);return;}
      const source=current();if(source)safeRun(()=>update(s,{messages:s.messages.map(m=>m.id===source.id?{...m,reactions:m.reactions.includes(tag)?m.reactions.filter(value=>value!==tag):[...m.reactions,tag]}:m)}));
    }
  });
}
function mainMenu(event) {
  if(!menu.hidden&&$('more-button').getAttribute('aria-expanded')==='true'){hideMenu();return;}
  if(!active)return;const s=active;searchOpen=false;renderSearchControls();
  showMenu([['Import from clipboard','import',()=>importDialog()],['Export all cards','export',()=>exportRecords(s,s.messages)],['Select cards','select',()=>startSelection()],
    ['Clear message statuses','select',()=>statusDialog(null)],['Clear clipboard','trash',()=>clearClipboardDialog()],null,
    ['Color palette','palette',()=>appearanceDialog('palette')],['Font size','textSize',()=>appearanceDialog('fontSize')],['Arrange tags','tag',()=>arrangeTagsDialog()],null,
    ...(Array.isArray(s.settings.mosaicCardOrder)?[['Reset card order','mosaic',()=>{const before=boardMotion.snapshot(mounted),settings={...s.settings};delete settings.mosaicCardOrder;safeRun(()=>update(s,{settings}));boardMotion.move(before,mounted);}]]:[]),
    ...(latestUnfinished(s.note.uuid)?[['Resume unfinished edit','edit',()=>editCard(latestUnfinished(s.note.uuid).id)]]:[]),['About Mosaic','info',()=>aboutDialog()]],event);
}
function arrangeTagsDialog(){
  const s=active,d=openModal('tags','Arrange tags'),list=el('div','tag-arrange-list');d.root.append(list);
  const form=el('form','tag-add-form'),input=el('input');input.placeholder='Add an emoji';input.maxLength=32;input.required=true;input.setAttribute('aria-label','Add an emoji category');
  const add=button('Add emoji',null,()=>{},'secondary-button');add.type='submit';form.append(input,add);d.root.append(form);
  actions(d,[button('Done',null,()=>closeModal(),'secondary-button')]);
  const valid=()=>active===s&&modalState===d&&writable(s);
  async function save(change,filter){
    if(d.busy||!valid())return;
    const focusLabel=document.activeElement?.getAttribute('aria-label'),focusInput=document.activeElement===input;
    d.busy=true;for(const node of d.root.querySelectorAll('button,input'))node.disabled=true;
    if(filter!==undefined)s.view.tag=filter;
    try{await update(s,change);if(modalState===d){input.value='';if(d.error){d.error.remove();d.error=null;}}}
    catch{dialogError(d,'Saving was not confirmed. Your tag changes are retained; close this panel and use Retry save.');}
    finally{d.busy=false;if(modalState===d){
      for(const node of d.root.querySelectorAll('button,input'))node.disabled=false;render();
      const focused=focusInput&&!input.disabled?input:[...d.root.querySelectorAll('button')].find(node=>!node.disabled&&node.getAttribute('aria-label')===focusLabel);
      (focused||d.root.querySelector('.dialog-actions button'))?.focus({preventScroll:true});
    }}
  }
  function render(){
    list.replaceChildren();const order=imFilterOrder(MosaicModel.tags(s.messages,s.settings),s.settings.untaggedPosition);
    for(const [index,tag] of order.entries()){
      const untagged=tag===imUntagged,label=untagged?'Untagged':tag,row=el('div','tag-arrange-row'+(untagged?' tag-arrange-untagged':''));
      const symbol=el('span','tag-arrange-symbol');if(untagged){symbol.append(mosaicIcon('untagged'),document.createTextNode('Untagged'));}else symbol.textContent=tag;row.append(symbol);
      for(const [delta,name,icon] of [[-1,'earlier','back'],[1,'later','arrow']]){
        const move=button('Move '+label+' '+name,icon,()=>safeRun(()=>save({settings:imEmojiMove(s.messages,s.settings,tag,delta)})),'icon-button');move.disabled=!writable(s)||(delta===-1?index===0:index===order.length-1);row.append(move);
      }
      if(!untagged)row.append(button('Edit '+tag,'edit',()=>replaceEmojiDialog(tag),'icon-button'),button('Delete '+tag,'trash',()=>{
        const count=MosaicModel.index(s.messages).counts.get(tag)||0;
        if(window.confirm(`Remove ${tag} from this note’s menu and ${count} card${count===1?'':'s'}? All cards and their text will be kept.`))safeRun(()=>save(imEmojiChange(s.messages,s.settings,tag),s.view.tag===tag?'':undefined));
      },'icon-button danger'));
      if(!writable(s))for(const control of row.querySelectorAll('button'))control.disabled=true;list.append(row);
    }
    input.disabled=add.disabled=!writable(s);
  }
  form.addEventListener('submit',event=>{event.preventDefault();try{const settings=imEmojiAdd(s.messages,s.settings,input.value);safeRun(()=>save({settings}));}catch(error){dialogError(d,error.message);}});render();
}
function replaceEmojiDialog(from){
  const s=active,d=openModal('replace-tag','Replace emoji'),form=el('form','tag-replace-form'),label=el('label','',`Replace ${from} with`),input=el('input');input.value=from;input.maxLength=32;input.required=true;input.setAttribute('aria-label','Replacement emoji');label.append(input);form.append(label);
  const count=MosaicModel.index(s.messages).counts.get(from)||0;form.append(el('p','dialog-help',`Updates tags on ${count} card${count===1?'':'s'}. All text and other tags stay unchanged.`));d.root.append(form);
  const row=el('div','dialog-actions'),cancel=button('Cancel emoji change',null,()=>arrangeTagsDialog(),'secondary-button'),save=button('Save emoji change',null,()=>{},'primary-button');save.type='submit';row.append(cancel,save);form.append(row);
  form.addEventListener('submit',event=>{event.preventDefault();safeRun(async()=>{
    if(d.busy||active!==s||modalState!==d||!writable(s))return;
    let to,change;try{to=imEmojiValue(input.value);change=imEmojiChange(s.messages,s.settings,from,to);}catch(error){dialogError(d,error.message);return;}d.busy=true;save.disabled=cancel.disabled=input.disabled=true;
    if(s.view.tag===from)s.view.tag=to;
    try{await update(s,change);if(active===s&&modalState===d)arrangeTagsDialog();}
    catch{dialogError(d,'Saving was not confirmed. Your change is retained; close this panel and use Retry save.');}
    finally{d.busy=false;if(modalState===d){cancel.disabled=false;save.disabled=input.disabled=!writable(s);}}
  });});input.focus();input.select();
}
function appearanceDialog(kind) {
  const s=active,key=kind==='palette'?'mosaicPalette':'mosaicFontSize',d=openModal('appearance',kind==='palette'?'Color palette':'Font size');
  d.root.append(el('p','dialog-help','For this note. Saved through Standard Notes.'));
  const choices=el('div','appearance-choices'),items=kind==='palette'?MosaicModel.palettes:Object.entries(MosaicModel.fontSizes).map(([id,value])=>({id,...value}));
  const controls=[];
  for(const item of items){
    const choice=button(item.name,null,async()=>{
      if(d.busy||active!==s||modalState!==d||!writable(s))return;
      if(MosaicModel.appearance(s.settings)[kind]===item.id)return;
      d.busy=true;controls.forEach(control=>control.disabled=true);
      try{await update(s,{settings:{...s.settings,[key]:item.id}});}
      catch(error){dialogError(d,'Saving was not confirmed. Keep this editor open and retry saving.');}
      finally{d.busy=false;if(modalState===d)for(const control of controls){control.disabled=!writable(s);control.setAttribute('aria-pressed',String(MosaicModel.appearance(s.settings)[kind]===control.dataset.value));}}
    },'appearance-choice');
    choice.replaceChildren();choice.dataset.value=item.id;choice.setAttribute('aria-pressed',String(MosaicModel.appearance(s.settings)[kind]===item.id));choice.disabled=!writable(s);
    if(kind==='palette'){const preview=el('span','palette-preview '+item.id);preview.setAttribute('aria-hidden','true');preview.append(el('span'));choice.append(preview);}
    const label=el('span','appearance-choice-label',item.name);if(item.description)label.append(el('small','',item.description));
    if(kind==='fontSize')label.style.fontSize=item.editBody+'px';
    choice.append(label);choices.append(choice);controls.push(choice);
  }
  d.root.append(choices);actions(d,[button('Done',null,()=>closeModal(),'secondary-button')]);
}
function openModal(kind,title) {
  stashEdit();closeModal(true);const root=$('modal-content');root.replaceChildren();modal.classList.toggle('card-edit-dialog',kind==='edit');const heading=el('div','dialog-heading'),h=el('h2','',title);h.id='dialog-title';
  const state={kind,uuid:active?.note.uuid,root,error:null,busy:false};modalState=state;
  heading.append(h,button('Close','close',()=>closeModal()));root.append(heading);modal.showModal();return state;
}
function dialogError(record,text) {
  if(modalState!==record)return;if(!record.error){record.error=el('p','dialog-error');record.error.setAttribute('role','alert');if(record.bottom)record.bottom.insertBefore(record.error,record.footer);else record.root.append(record.error);}record.error.textContent=text;
}
function closeModal(force=false) {
  if(!force&&modalState?.busy)return;
  if(!force&&modalState?.kind==='edit'&&modalState.commit){safeRun(()=>modalState.commit(true));return;}
  if(!force)stashEdit();
  if(modalState?.viewportResize){window.removeEventListener('resize',modalState.viewportResize);window.visualViewport?.removeEventListener('resize',modalState.viewportResize);window.visualViewport?.removeEventListener('scroll',modalState.viewportResize);modal.style.removeProperty('--card-view-height');modal.style.removeProperty('--card-view-top');}
  cancelAnimationFrame(modalState?.caretFrame);if(modalState?.revealCaret)document.removeEventListener('selectionchange',modalState.revealCaret);
  cancelAnimationFrame(modalState?.bodyFrame);
  clearCardMotion(modalState);if(modalState?.transitionSource)modalState.transitionSource.style.removeProperty('visibility');$('modal-content').inert=false;
  modalState?.scrollObserver?.disconnect();modalState?.tagObserver?.disconnect();modalState?.tagBadges?.remove();modal.style.removeProperty('--tag-overhang');
  modalState?.body?.imRich?.destroy();
  hideMenu();if(modal.open)modal.close();modalState=null;
}
function stashEdit() {
  const d=modalState;if(!d||d.kind!=='edit'||!d.currentText||!active||d.uuid!==active.note.uuid)return;
  if(d.currentText!==d.original||d.titleValue!==d.originalTitle||JSON.stringify([...d.tags])!==JSON.stringify(d.originalTags))unfinishedEdits.set(editKey(d.uuid,d.id),{noteId:d.uuid,id:d.id,original:d.original,text:d.currentText,title:d.titleValue,originalTitle:d.originalTitle,titleUnlocked:d.titleUnlocked,tags:[...d.tags]});
}
function actions(record,items) {const row=el('div','dialog-actions');for(const item of items)row.append(item);record.root.append(row);return row;}
function confirmAction(title,description,label,action,danger=false) {
  const d=openModal('confirm',title);d.root.append(el('p','dialog-help',description));
  const confirm=button(label,null,async()=>{
    d.busy=true;confirm.disabled=true;cancel.disabled=true;
    try{await action();if(modalState===d)closeModal(true);}catch(error){dialogError(d,error.message||'Saving was not confirmed. Use Retry save.');}
    finally{d.busy=false;confirm.disabled=false;cancel.disabled=false;}
  },danger?'secondary-button danger':'primary-button');
  const cancel=button('Cancel',null,()=>closeModal(),'secondary-button');actions(d,[cancel,confirm]);cancel.focus();return d;
}
function renderEditorTags(d){
  if(!d.tagBadges)return;
  d.tagBadges.replaceChildren();d.tagBadges.hidden=!d.tags.size;
  for(const tag of d.tags){const badge=el('span','card-tag');fillEmojiTag(badge,tag);badge.setAttribute('role','listitem');d.tagBadges.append(badge);}
  positionEditorTags(d);
}
function positionEditorTags(d){
  if(modalState!==d||!d.tagBadges)return;
  const extra=isIPhone||d.tagBadges.hidden?0:Math.max(0,Math.ceil(d.tagBadges.offsetHeight)-13),value=extra+'px';
  if(modal.style.getPropertyValue('--tag-overhang')!==value)modal.style.setProperty('--tag-overhang',value);
}
function refreshEditorMetadata() {
  const d=modalState,s=active;if(d?.kind!=='edit'||d.uuid!==s?.note.uuid||!d.meta)return;
  const message=s.messages.find(m=>m.id===d.id);if(!message)return;
  const color=MosaicModel.color(message);modal.style.setProperty('--edit-card-color',color.background);modal.style.setProperty('--edit-card-ink',color.ink);
  const pinned=MosaicModel.pins(s.settings).includes(message.id);d.pin.setAttribute('aria-label',pinned?'Unpin card':'Pin card');d.pin.title=pinned?'Unpin card':'Pin card';d.pin.setAttribute('aria-pressed',String(pinned));
  d.meta.replaceChildren();
  const add=(text,className='')=>{if(d.meta.childNodes.length)d.meta.append(el('span','metadata-separator',' · '));d.meta.append(el('span',className,text));};
  if(message.copied)add('Copied');if(message.exported)add('Exported');if(MosaicModel.isImported(message))add('Imported');
  if(message.createdAt&&!Number.isNaN(new Date(message.createdAt).getTime())){
    const text=cardTimestampFormat.format(new Date(message.createdAt));
    add(text,'card-timestamp');d.meta.querySelector('.card-timestamp').title=new Date(message.createdAt).toLocaleString();
  }
  if(message.edited)add('edited','card-edited');
  renderEditorTags(d);
}
function cardTransitionRect(node){
  if(!node?.isConnected)return null;
  const r=node.getBoundingClientRect(),v=viewport.getBoundingClientRect(),bottom=Math.min(v.bottom,$('capture-composer').getBoundingClientRect().top);
  const left=Math.max(r.left,v.left),top=Math.max(r.top,v.top),right=Math.min(r.right,v.right),end=Math.min(r.bottom,bottom);
  return right>left&&end>top?{left,top,width:right-left,height:end-top}:null;
}
function animateCard(d,closing=false){
  cancelAnimationFrame(d.motionFrame);d.motionFrame=0;
  cancelAnimationFrame(d.motionStartFrame);d.motionStartFrame=0;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
  if(closing&&!d.motionClosing&&['running','paused'].includes(d.cardAnimation?.playState)){
    // Closing before playback starts should simply reveal the Board card.
    if(!d.cardAnimation.currentTime){clearCardMotion(d);return null;}
    d.motionClosing=true;
    d.cardAnimation.reverse();return d.cardAnimation;
  }
  const node=mounted.get(d.id),source=closing?cardTransitionRect(node):d.sourceRect;
  const target=modal.getBoundingClientRect();
  if(!source||!target.width||!target.height)return null;
  d.cardAnimation?.cancel();modal.classList.add('card-is-moving');
  if(node){node.style.visibility='hidden';d.transitionSource=node;}
  const small={transform:`translate(${source.left-target.left}px,${source.top-target.top}px) scale(${source.width/target.width},${source.height/target.height})`},full={transform:'translate(0,0) scale(1,1)'};
  if(isIPhone){small.borderRadius='16px';full.borderRadius='0px';}
  d.motionClosing=closing;
  const animation=d.cardAnimation=modal.animate(closing?[full,small]:[small,full],{duration:320,easing:'cubic-bezier(.22,.8,.24,1)',fill:'both'});
  // Do not spend animation time rasterizing the first frame. In particular,
  // a busy first render must not turn the first visible move into an end jump.
  animation.pause();animation.currentTime=0;
  d.motionStartFrame=requestAnimationFrame(()=>{d.motionStartFrame=requestAnimationFrame(()=>{
    d.motionStartFrame=0;
    if(modalState===d&&d.cardAnimation===animation&&animation.playState==='paused'&&animation.currentTime===0)animation.play();
  });});
  // Let the final composited frame settle before releasing its layer.
  if(!closing)animation.onfinish=()=>{if(modalState!==d||d.cardAnimation!==animation)return;d.motionFrame=requestAnimationFrame(()=>{d.motionFrame=requestAnimationFrame(()=>{if(modalState===d&&d.cardAnimation===animation){clearCardMotion(d);if(d.deferBodyUntilMotion)d.prepareBody();}});});};
  return animation;
}
function finishCard(d){
  if(modalState!==d)return;
  cancelAnimationFrame(d.bodyFrame);d.bodyFrame=0;
  const animation=animateCard(d,true);
  if(!animation){closeModal(true);return;}
  d.busy=true;d.root.inert=true;
  animation.onfinish=()=>{if(modalState===d)closeModal(true);};
}
function cardBodyStart(text,settings){
  const font=MosaicModel.fontSizes[MosaicModel.appearance(settings).fontSize];
  const firstLines=Math.ceil(innerHeight/(font.editBody*1.75))+4;
  return imMarkdown.preview(text,firstLines);
}
function editorDialog(id=null) {
  if(!id){$('capture-input').focus();return;}
  if(modalState?.kind==='edit'&&modalState.id===id&&modalState.uuid===active?.note.uuid){modalState.body.focus();return;}
  const s=active;if(s?.titleEntry){notify('Finish or cancel the current title entry first.');return;}if(!writable(s)){notify('This note is read only until the notice above is resolved.');return;}
  const message=s.messages.find(m=>m.id===id);if(!message)return;
  const stashed=unfinishedEdits.get(editKey(s.note.uuid,id));
  const restored=stashed?.id===id&&stashed.original===message.text&&(stashed.originalTitle??imFormat.title(message))===imFormat.title(message)?stashed:null;
  const original=message.text,originalTitle=imFormat.title(message),currentTitle=restored?.title??originalTitle;
  const originalNormalized=MosaicModel.normalized(original),titleNormalized=MosaicModel.normalized(currentTitle),originalNewline=(/\r\n|\n|\r/.exec(original)||['\n'])[0];
  const sourceRect=cardTransitionRect(mounted.get(id));
  const d=openModal('edit','Edit card');d.sourceRect=sourceRect;Object.assign(d,{id,original,originalTitle,titleValue:currentTitle,titleUnlocked:restored?.titleUnlocked||false,currentText:restored?.text??original,tags:new Set(restored?.tags??message.reactions),originalTags:message.reactions,fieldRevision:0,sending:false,wantClose:false});
  const scroller=el('div','card-detail-scroll');d.scroll=scroller;d.root.append(scroller);
  if(stashed&&!restored){
    scroller.append(el('p','dialog-help','This card changed after your unfinished edit. Your earlier edit is available here to copy before you continue.'));
    const earlier=el('textarea','transfer-text');earlier.readOnly=true;earlier.value=stashed.text;earlier.setAttribute('aria-label','Earlier unfinished edit');scroller.append(earlier);
  }
  const title=el('textarea','editor-title');title.rows=1;title.placeholder='Title';title.setAttribute('aria-label','Card title');title.value=currentTitle;title.enterKeyHint='enter';title.hidden=!d.titleUnlocked;
  const titlePreview=el('h3','detail-title',currentTitle);titlePreview.hidden=!currentTitle||d.titleUnlocked;
  const startBody=cardBodyStart(d.currentText,s.settings),bodyEditor=imRichField.create({className:'editor-body',label:'Card body',placeholder:'Text',value:startBody.text,readOnly:!startBody.complete,onResize:()=>d.updateScroll?.()}),body=bodyEditor.dom;d.body=body;d.bodyReady=startBody.complete;if(!d.bodyReady)body.setAttribute('aria-busy','true');
  // One scroller owns title, full-height body and trailing metadata. The toolbar
  // stays outside it; the editor itself never reserves a second scrollbar.
  // The visual editor is a normal contenteditable block, so CSS owns its
  // height. Textarea-style zero-height measurement would relayout the entire
  // Markdown tree repeatedly during opening, typing and width changes.
  // A bounded first page lets compositor motion start before laying out a
  // very long visual document. Never expose a partial value to user edits.
  d.prepareBody=()=>{
    if(modalState!==d||d.bodyReady)return;
    cancelAnimationFrame(d.bodyFrame);d.bodyFrame=0;
    const top=scroller.scrollTop,start=body.selectionStart,end=body.selectionEnd,direction=body.selectionDirection;
    // An opening caret at the preview's end means the end of the full body.
    const append=d.pendingEndCaret&&start===end&&end===body.value.length;d.pendingEndCaret=false;
    body.value=d.currentText;body.readOnly=false;body.removeAttribute('aria-busy');d.bodyReady=true;d.deferBodyUntilMotion=false;
    if(!isIPhone||document.activeElement===body)body.setSelectionRange(append?body.value.length:start,append?body.value.length:end,direction);
    scroller.scrollTop=top;
  };
  const prepareForInput=event=>{if(event.type==='keydown'&&['Escape','Tab','Shift','Control','Alt','Meta'].includes(event.key))return;if(!d.bodyReady){if(d.deferBodyUntilMotion)settleCardMotion();else d.prepareBody();}};
  for(const event of ['pointerdown','keydown','compositionstart','beforeinput','paste','cut','drop']){body.addEventListener(event,prepareForInput,true);title.addEventListener(event,prepareForInput,true);}
  const pin=button('Pin card','pin',()=>safeRun(()=>togglePin(s,id)),'icon-button detail-pin');d.pin=pin;
  const header=el('div','card-detail-heading');header.append(titlePreview,title);scroller.append(header,body);
  d.unlockTitle=()=>{d.prepareBody();d.titleUnlocked=true;title.hidden=false;titlePreview.hidden=true;title.style.height='auto';title.style.height=title.scrollHeight+'px';hideMenu();title.focus();};
  d.tagBadges=el('div','card-detail-tags');d.tagBadges.setAttribute('role','list');d.tagBadges.setAttribute('aria-label','Emoji tags');modal.append(d.tagBadges);
  d.tagObserver=new ResizeObserver(()=>positionEditorTags(d));d.tagObserver.observe(d.tagBadges);
  d.toggleTag=tag=>{d.tags.has(tag)?d.tags.delete(tag):d.tags.add(tag);d.fieldRevision++;renderEditorTags(d);};
  d.meta=el('div','card-detail-meta');d.meta.setAttribute('aria-label','Card timestamp and statuses');scroller.append(d.meta);
  const footer=el('div','card-detail-tools');
  const palette=button('Background options','palette',event=>colorMenu(id,event));
  const more=button('Card options','more',event=>cardMenu(s.messages.find(m=>m.id===id),event),'icon-button detail-more');
  const close=button('Close',null,()=>safeRun(()=>saveEditor(true)),'detail-close');d.submit=close;
  footer.append(bodyEditor.toggle,pin,palette,more,close);d.footer=footer;d.bottom=el('div','card-detail-bottom');if(isIPhone)d.bottom.append(d.tagBadges);d.bottom.append(bodyEditor.toolbar,footer);d.root.append(d.bottom);
  d.updateScroll=()=>{if(modalState===d)d.bottom.classList.toggle('has-content-below',scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop>1);};
  scroller.addEventListener('scroll',d.updateScroll,{passive:true});
  if(phoneBoard){
    let touch=null;
    scroller.addEventListener('touchstart',event=>{const point=event.touches[0];touch=event.touches.length===1?{x:point.clientX,y:point.clientY}:null;},{passive:true});
    scroller.addEventListener('touchmove',event=>{const point=event.touches[0];if(touch&&point&&Math.hypot(point.clientX-touch.x,point.clientY-touch.y)>10){touch=null;if(modalState===d)dismissCardKeyboard();}},{passive:true});
    scroller.addEventListener('touchend',()=>{touch=null;},{passive:true});scroller.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  }
  d.scrollObserver=new ResizeObserver(()=>{d.updateScroll();d.revealCaret?.();});for(const element of [scroller,body,header,d.meta])d.scrollObserver.observe(element);
  const change=event=>{
    d.fieldRevision++;
    if(event.target===body&&!d.bodyReady){cancelAnimationFrame(d.bodyFrame);d.bodyFrame=0;d.bodyReady=true;body.readOnly=false;body.removeAttribute('aria-busy');d.deferBodyUntilMotion=false;}
    if(d.bodyReady){const value=MosaicModel.normalized(body.value);d.currentText=value===originalNormalized?original:value.replace(/\n/g,originalNewline);}
    d.titleValue=MosaicModel.normalized(title.value)===titleNormalized?currentTitle:title.value;
    if(event.target===title&&!title.hidden){title.style.height='auto';title.style.height=title.scrollHeight+'px';}
  };
  title.addEventListener('input',change);body.addEventListener('im-markdown-change',change);
  // Enter is ordinary multiline editing here; the capture field has its own send keys.
  bindContextMenu(d.root,event=>cardMenu(s.messages.find(m=>m.id===id),event),()=>active===s&&modalState===d);
  bindContextMenu(d.tagBadges,event=>cardMenu(s.messages.find(m=>m.id===id),event),()=>active===s&&modalState===d);
  d.commit=saveEditor;
  async function saveEditor(closeAfter=true) {
    if(active!==s||modalState!==d)return false;
    if(!writable(s)){dialogError(d,'Saving is paused. Your edit is still here; review the saved version before continuing.');return false;}
    d.wantClose=d.wantClose||closeAfter;
    if(d.sending){try{await persist(s);return !d.sending;}catch{return false;}}
    const submitted=d.currentText,submittedTitle=d.titleValue,submittedTags=[...d.tags],revision=d.fieldRevision;
    const source=s.messages.find(m=>m.id===id);if(!source||source.text!==d.original||imFormat.title(source)!==d.originalTitle){dialogError(d,'This card changed since you opened it. Your text is still here; copy it before reopening the card.');return false;}
    const edited=imFormat.withTitle({...imFormat.editMessage(source,submitted),reactions:submittedTags},submittedTitle);
    if(submitted===source.text&&imFormat.title(edited)===imFormat.title(source)&&JSON.stringify(edited.reactions)===JSON.stringify(source.reactions)){
      if(restored)unfinishedEdits.delete(editKey(s.note.uuid,id));if(d.wantClose)finishCard(d);return true;
    }
    const tagOrder=[...new Set([...(s.settings.reactionOrder||MosaicModel.tags(s.messages,s.settings)),...d.tags])];
    d.sending=true;d.busy=true;close.disabled=true;close.textContent='Saving…';
    const saving=update(s,{messages:s.messages.map(m=>m.id===id?edited:m),settings:{...s.settings,reactionOrder:tagOrder,deletedEmojis:(s.settings.deletedEmojis||[]).filter(tag=>!d.tags.has(tag))}});
    s.intents.add({revision:s.revision,finish:()=>{
      const stored=unfinishedEdits.get(editKey(s.note.uuid,id));if(stored?.text===submitted&&(stored.title??originalTitle)===submittedTitle&&JSON.stringify(stored.tags)===JSON.stringify(submittedTags))unfinishedEdits.delete(editKey(s.note.uuid,id));
      if(modalState!==d)return;
      d.sending=false;d.busy=false;close.disabled=false;close.textContent='Close';close.setAttribute('aria-label','Close');
      if(d.error){d.error.remove();d.error=null;}
      d.original=submitted;d.originalTitle=submittedTitle.trim()?submittedTitle:'';d.originalTags=submittedTags;
      if(d.wantClose&&d.fieldRevision===revision){finishCard(d);notify('Card updated.');}
      else{d.wantClose=false;refreshEditorMetadata();}
    }});
    try{await saving;return d.fieldRevision===revision;}catch{
      d.busy=false;close.disabled=false;close.textContent='Retry save';close.setAttribute('aria-label','Retry save');
      dialogError(d,'Saving was not confirmed. Your text is still here. Retry save before closing.');return false;
    }
  }
  if(phoneBoard){
    const caretSpace=el('div','card-caret-space');caretSpace.hidden=true;caretSpace.setAttribute('aria-hidden','true');scroller.append(caretSpace);
    d.scrollObserver.observe(bodyEditor.toolbar);
    // Keyboard resizing does not necessarily move a contenteditable's caret
    // into its nested scroller. Measure after layout, without refocusing or
    // changing selection, and never scroll the Board/host document.
    d.revealCaret=()=>{
      cancelAnimationFrame(d.caretFrame);d.caretFrame=requestAnimationFrame(()=>{
        if(modalState!==d||!d.bodyReady)return;
        const view=body.imRich.view;
        const panel=bodyEditor.toolbar.hidden?null:bodyEditor.toolbar.getBoundingClientRect();
        // Extend only the scrollable overflow, without changing the card's
        // intrinsic height when its floating formatting panel is opened.
        caretSpace.hidden=!panel;caretSpace.style.top=(body.offsetTop+body.offsetHeight+(panel?.height||0)+18)+'px';
        if(document.activeElement!==body||!view.state.selection.empty)return;
        const caret=view.coordsAtPos(view.state.selection.head),box=scroller.getBoundingClientRect(),visual=window.visualViewport;
        const top=Math.max(box.top,visual?.offsetTop||0)+12,bottom=Math.min(box.bottom,panel?.top??Infinity,(visual?.offsetTop||0)+(visual?.height||innerHeight))-12;
        if(bottom<=top)return;
        if(caret.bottom>bottom)scroller.scrollTop+=caret.bottom-bottom;
        else if(caret.top<top)scroller.scrollTop+=caret.top-top;
      });
    };
    document.addEventListener('selectionchange',d.revealCaret);
    for(const event of ['focus','im-markdown-change','keyup','pointerup'])body.addEventListener(event,d.revealCaret);
    d.viewportResize=()=>{if(modalState!==d)return;const view=window.visualViewport;modal.style.setProperty('--card-view-height',(view?.height||innerHeight)+'px');modal.style.setProperty('--card-view-top',(view?.offsetTop||0)+'px');d.revealCaret();};
    window.addEventListener('resize',d.viewportResize);window.visualViewport?.addEventListener('resize',d.viewportResize);window.visualViewport?.addEventListener('scroll',d.viewportResize);d.viewportResize();
  }
  refreshEditorMetadata();
  if(!d.bodyReady){
    const line=parseFloat(getComputedStyle(body).lineHeight);
    // Only defer when the prefix already exceeds the final viewport. Thus
    // replacing it with the full value cannot change the card's outer size.
    if(scroller.scrollHeight<=scroller.clientHeight+2*line||matchMedia('(prefers-reduced-motion: reduce)').matches)d.prepareBody();
  }
  // Restore text focus before motion, with new typing appending to the body.
  if(isIPhone)modal.focus({preventScroll:true});
  else{d.pendingEndCaret=!d.bodyReady;body.setSelectionRange(body.value.length,body.value.length);body.focus({preventScroll:true});}
  scroller.scrollTop=0;d.updateScroll();animateCard(d);
  if(!d.bodyReady){
    if(d.cardAnimation)d.deferBodyUntilMotion=true;
    else d.bodyFrame=requestAnimationFrame(()=>{d.bodyFrame=requestAnimationFrame(()=>d.prepareBody());});
  }
}
function editCard(id){editorDialog(id);}
function readCard(id) {
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message)return;
  const d=openModal('read','Card'),parts=MosaicModel.preview(message);
  if(message.replyTo){const quote=button('Show quoted card',null,()=>{closeModal();jumpTo(message.replyTo);},'reply-preview');quote.textContent=message.replyTo.text||'Quoted message';d.root.append(quote);}
  const body=el('div','reader-body im-rich-display');imMarkdown.render(body,imMarkdown.message(message).doc);d.root.append(el('h3','reader-title',parts.title),body,el('p','reader-meta',metaText(message)));
  const tags=el('div','reader-tags');for(const tag of message.reactions)tags.append(el('span','card-tag',tag));d.root.append(tags);
  actions(d,[button('Copy','copy',()=>safeRun(()=>copyRecords(s,[message])),'secondary-button'),button('Reply','reply',()=>replyTo(id),'secondary-button'),button('Edit','edit',()=>editCard(id),'primary-button')]);
}
function replyTo(id) {
  const s=active,message=s.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  closeModal(true);safeRun(()=>update(s,{reply:MosaicModel.reply(message,s.note.uuid)},false));$('capture-input').focus();
}
function jumpTo(reply) {
  const s=active,target=MosaicModel.target(s.messages,reply,s.note.uuid);if(!target){notify('The original message is not in this note. The quoted text is still preserved.');return;}
  s.locatedId=target.id;setTimeout(()=>{if(s.locatedId===target.id)s.locatedId=null;},2200);
  s.view.query='';s.view.tag='';s.view.pinned=false;$('search').value='';renderAll();
  const item=layout.byId?.get(target.id);if(!item)return;
  const origin=board.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
  const bounds=viewport.getBoundingClientRect(),top=Math.max(bounds.top,document.querySelector('.board-toolbar').getBoundingClientRect().bottom+12),bottom=Math.min(bounds.bottom,$(s.view.selecting?'selection-bar':'capture-composer').getBoundingClientRect().top-12);
  viewport.scrollTop=origin+item.y-(top-bounds.top)-Math.max(0,(bottom-top-item.height)/2);renderWindow();
  const node=mounted.get(target.id);node?.classList.add('located');setTimeout(()=>node?.classList.remove('located'),2100);
}
function deleteCards(s,ids) {
  if(!ids.size||!writable(s))return;
  confirmAction(`Delete ${ids.size===1?'this card':ids.size+' cards'}?`,'This removes the selected text from this note. There is no trash folder in Mosaic.','Delete',async()=>{
    const next=s.messages.filter(m=>!ids.has(m.id));const pins=MosaicModel.pins(s.settings).filter(id=>!ids.has(id));
    for(const id of ids)s.view.selected.delete(id);rememberSelection();
    await update(s,{messages:next,settings:{...s.settings,pinnedMessageIds:pins}});
  },true);
}
function applyTransferMarks(s){
  const intents=transferMarks.get(s?.note.uuid);
  if(!intents||!writable(s)||s.error)return Promise.resolve();
  const next=s.messages.map(message=>{
    const intent=intents.get(message.id);if(!intent||intent.text!==message.text)return message;
    let result=message;for(const flag of intent.flags)if(!message[flag])result={...result,[flag]:true};return result;
  });
  let pending=Promise.resolve();
  if(next.some((message,i)=>message!==s.messages[i]))pending=update(s,{messages:next});
  transferMarks.delete(s.note.uuid);return pending;
}
function mark(s,records,flag) {
  const uuid=s.note.uuid,intents=transferMarks.get(uuid)||new Map();
  for(const record of records){
    const old=intents.get(record.id),flags=old?.text===record.text?old.flags:new Set();flags.add(flag);
    intents.set(record.id,{text:record.text,flags});
  }
  transferMarks.set(uuid,intents);
  return active?.note.uuid===uuid?applyTransferMarks(active):Promise.resolve();
}
async function copyRecords(s,records) {
  if(!records.length)return;
  const text=records.map(m=>m.text).join('\n\n');
  if(await imWriteClipboard(text)){notify('Copied to clipboard.');await mark(s,records,'copied');}
  else manualCopyDialog(s,records,text,'copied');
}
async function exportRecords(s,records) {
  if(!records.length){notify('There are no cards to export.');return;}
  const text=imTransfer.create(records.map(m=>({...m,exported:true})),s.settings,s.note.uuid);
  if(await imWriteClipboard(text)){notify('Export copied. Open another note and choose Import from clipboard.');await mark(s,records,'exported');}
  else manualCopyDialog(s,records,text,'exported');
}
function manualCopyDialog(s,records,text,flag) {
  if(active!==s)return;
  const d=openModal('copy',flag==='exported'?'Export cards':'Copy');d.root.append(el('p','dialog-help','Automatic copying was blocked. Select and copy the text below, or try the Copy button.'));
  const field=el('textarea','transfer-text');field.value=text;field.readOnly=true;field.setAttribute('aria-label','Text to copy');d.root.append(field);
  let marked=false;
  // Only a successful programmatic clipboard write marks status. A browser's
  // ordinary copy event cannot prove the system clipboard accepted the text.
  actions(d,[button('Close',null,()=>closeModal(),'secondary-button'),button('Copy',null,async()=>{if(await imWriteClipboard(text)){if(!marked){marked=true;safeRun(()=>mark(s,records,flag));}notify('Copied to clipboard.');}else dialogError(d,'Clipboard access is still blocked. You can select the text and copy it manually.');},'primary-button')]);
  field.focus();field.select();
}
function importDialog() {
  const s=active;if(!writable(s))return;
  const d=openModal('import','Import');d.root.append(el('p','dialog-help','Paste an export from Mosaic or the IM-style editor. Your existing cards will be kept.'));
  const field=el('textarea','transfer-text');field.placeholder='Paste your exported messages here…';field.setAttribute('aria-label','Import text');d.root.append(field);
  const summary=el('p','dialog-help','');d.root.append(summary);
  const apply=async clear=>{
    const payload=imTransfer.read(field.value);if(!payload.ok){dialogError(d,payload.error);return;}
    if(active!==s||modalState!==d)return;
    const merged=imTransfer.merge(s.messages,payload);d.busy=true;normal.disabled=true;combined.disabled=true;
    try{await update(s,{messages:merged.messages});if(modalState===d){closeModal(true);notify(`${merged.added.length} imported${merged.skipped?', '+merged.skipped+' duplicates skipped':''}.`);if(clear)clearClipboardDialog();}}
    catch{dialogError(d,'Import saving was not confirmed. The imported text is still available. Keep this editor open and use Retry save.');}
    finally{d.busy=false;normal.disabled=false;combined.disabled=false;}
  };
  const normal=button('Import',null,()=>safeRun(()=>apply(false)),'primary-button');
  const combined=button('Import and clear clipboard',null,()=>safeRun(()=>apply(true)),'secondary-button danger');
  actions(d,[button('Cancel',null,()=>closeModal(),'secondary-button'),normal,combined]);
  const preview=()=>{const parsed=imTransfer.read(field.value);summary.textContent=parsed.ok?`${parsed.messages.length} cards ready to import.`:field.value?'Paste a complete message export.':'';};field.addEventListener('input',preview);
  // Reading is requested only after the user explicitly opens Import.
  const initial=field.value;try{navigator.clipboard.readText().then(text=>{if(modalState===d&&field.value===initial){field.value=text;preview();}}).catch(()=>{});}catch{}
  field.focus();
}
function clearClipboardDialog() {
  confirmAction('Clear your clipboard?','This empties the current clipboard. Clipboard history and other devices are outside Mosaic’s control.','Clear clipboard',async()=>{if(!await imClearClipboard())throw new Error('Clipboard clearing was blocked by this app. Your clipboard has not been confirmed cleared.');notify('Clipboard cleared.');},true);
}
function statusDialog(ids) {
  const s=active;if(!writable(s))return;const d=openModal('statuses','Clear message statuses');
  d.root.append(el('p','dialog-help',ids?`${ids.size} selected cards. Text, tags, pins and timestamps are kept.`:'All cards in this note, including cards hidden by filters. Text, tags, pins and timestamps are kept.'));
  const options=el('div','status-options'),flags=new Set();
  for(const [key,label] of Object.entries({copied:'Copied',exported:'Exported',imported:'Imported',edited:'Edited'})){
    const row=el('label'),check=el('input');check.type='checkbox';check.addEventListener('change',()=>{check.checked?flags.add(key):flags.delete(key);save.disabled=!flags.size;});row.append(check,document.createTextNode(label));options.append(row);
  }
  d.root.append(options);const save=button('Clear selected statuses',null,async()=>{
    d.busy=true;save.disabled=true;try{await update(s,{messages:MosaicModel.clearStatuses(s.messages,flags,ids)});if(modalState===d)closeModal(true);notify('Statuses cleared.');}
    catch(error){dialogError(d,error.message);}finally{d.busy=false;save.disabled=false;}
  },'primary-button');save.disabled=true;actions(d,[button('Cancel',null,()=>closeModal(),'secondary-button'),save]);
}
function mergeDialog() {
  const s=active,ids=new Set(s.view.selected),records=s.messages.filter(m=>ids.has(m.id));if(records.length<2){notify('Select at least two cards to merge.');return;}
  const preview=imFormat.mergeText(records),snapshot=JSON.stringify(records);
  const d=confirmAction(`Merge ${records.length} cards?`,'Text will stay in its original IM order, separated by a blank line. Tags and pins are combined. Copied and Exported reset.','Merge selected',async()=>{
    if(JSON.stringify(s.messages.filter(m=>ids.has(m.id)))!==snapshot)throw new Error('These cards changed. Open a fresh merge preview.');
    const result=MosaicModel.merge(s.messages,s.settings,ids,s.note.uuid);s.view.selected=new Set([result.id]);rememberSelection();await update(s,result);
  });
  const field=el('textarea','transfer-text');field.readOnly=true;field.value=preview;field.setAttribute('aria-label','Merged card preview');d.root.insertBefore(field,d.root.lastChild);
}
function recoveryDialog(s) {
  const d=openModal('recovery','Review your text');d.root.append(el('p','dialog-help','Copy this text somewhere safe before closing the editor. Mosaic will not automatically overwrite a different saved version.'));
  const field=el('textarea','transfer-text');field.readOnly=true;field.value=s.note.content.text||'';field.setAttribute('aria-label','Current local note text');d.root.append(field);
  if(s.titleEntry){const title=el('textarea','transfer-text');title.readOnly=true;title.value=s.titleEntry.text;title.setAttribute('aria-label','Unfinished title');d.root.append(title);}
  for(const entry of unfinishedEdits.values())if(entry.noteId===s.note.uuid){const edit=el('textarea','transfer-text');edit.readOnly=true;edit.value=(entry.title?'title: '+JSON.stringify(entry.title)+'\n\n':'')+entry.text;edit.setAttribute('aria-label','Unfinished card edit');d.root.append(edit);}
  actions(d,[button('Close',null,()=>closeModal(),'secondary-button'),button('Copy local text',null,async()=>{if(await imWriteClipboard(field.value))notify('Local text copied.');else{field.focus();field.select();dialogError(d,'Automatic copying was blocked. Copy the selected text manually.');}},'primary-button')]);
  if(s.remote){d.root.append(el('p','dialog-help','Standard Notes also supplied this saved version:'));const remote=el('textarea','transfer-text');remote.value=s.remote.content?.text||'';remote.readOnly=true;remote.setAttribute('aria-label','Standard Notes version');d.root.append(remote);
    actions(d,[button('Use Standard Notes version',null,()=>confirmAction('Use the saved version?','Copy your local text first. This discards the unconfirmed local changes shown above.','Use saved version',()=>receive(s.remote,true),true),'secondary-button danger')]);}
}
function aboutDialog() {
  const d=openModal('about','Mosaic · '+MOSAIC_VERSION);
  d.root.append(el('p','about-copy','Each card is the same message your IM-style editor reads. All text is body text unless you explicitly add a title from its context menu. There is no separate copy of your notes.'));
  d.root.append(el('p','about-copy','Your note content is saved through Standard Notes. Mosaic has no analytics, independent cloud service, or browser-storage copy. Saving still submits a complete note; very large active notes can reach Standard Notes’ sync limits.'));
  d.root.append(el('p','about-copy','New-card drafts save as you type. Click a card to edit. Enter adds a line; Close saves. Use Close before switching editors. Unfinished edits remain available while this editor stays open.'));
  d.root.append(el('p','about-copy','Drag Board cards to arrange them. On a phone, hold still, then drag; release without moving to open the menu. With a card focused, Alt+Up/Down also changes its position. Pinned cards stay in their section. The arrangement affects Mosaic only and saves once on drop. Reset card order restores newest-first order.'));
  const p=el('p','about-copy'),a=el('a','','Source, installation & privacy details');a.href='https://github.com/joshuazang/IM-style-editor/tree/main/mosaic';a.target='_blank';a.rel='noopener noreferrer';p.append(a);d.root.append(p);
}
function demo() {
  if(pf.component.sessionKey)return;
  const thoughts=[
    ['Reading notes','Start a list of passages to revisit.\nKeep questions alongside the page numbers.',['📓']],
    ['The evidence exam','Start with the problem, not the pile.\n\nToday: revisit the cases on hearsay. Write one clear example for each exception.',['1️⃣','📚']],
    ['A cabinet of curiosities','Deep-sea maps, lost observatories, impossible creatures. A place for the questions that lead somewhere unexpected.',['💡']],
    ['Today','Finish the evidence outline.\nRead the assigned cases.',['📍']],
    ['Weekend, slowly','Find a quiet café.\nBring the book with the folded corner.\nLeave room for nothing in particular.',['📓']],
    ['Project notes','Search above the cards.\nUse emoji to group related notes.',['💡']],
    ['Reading list','The Book of Disquiet\nA Field Guide to Getting Lost\nThe Order of Time',['📚']],
    ['A question for tomorrow','What is the smallest useful next step?',['2️⃣']],
    ['Completed','Reading for this week.\nFirst draft of the case summary.',['✅']],
    ['Ocean, after dark','Lanternfish, silent submarines, a notebook full of half-drawn constellations.',['📓']],
    ['Essay outline','Introduction\nMain argument\nCounterargument\nConclusion',[]],
    ['The idea parking lot','A better desk lamp.\nA short essay about attention.\nA walking route with no destination.',['3️⃣','💡']],
    ['A sentence to keep','“Attention is the beginning of devotion.”',['📍']],
    ['For the next study session','Open the outline. Read one page. Start with ten minutes.',['1️⃣']]
  ];
  const messages=thoughts.map(([title,body,reactions],i)=>({id:imFormat.newId(),text:title+'\n'+body,reactions,createdAt:new Date(Date.now()-(i+1)*36e5).toISOString(),...(i===1?{edited:true}:{})}));
  const settings={reactionOrder:['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍'],pinnedMessageIds:[messages[3].id,messages[1].id]};
  receive({uuid:'mosaic-demo',mosaicDemo:true,content_type:'Note',content:{title:'Sample notes',text:imFormat.portable(messages,settings,'')}});
  active.demo=true;renderAll();
}

$('pin-filter-icon').append(mosaicIcon('pin'));$('more-button').append(mosaicToolbarIcon('more'));
$('search-button').append(mosaicToolbarIcon('searchTags'));$('clear-filter').append(mosaicToolbarIcon('cancel'));
$('search-button').addEventListener('click',toggleSearch);$('change-filter').addEventListener('click',toggleSearch);
$('clear-filter').addEventListener('click',()=>{if(!active)return;Object.assign(active.view,{query:'',tag:'',pinned:false});$('search').value='';searchOpen=false;renderAll();});
$('more-button').addEventListener('click',mainMenu);
captureEditor=imRichField.create({id:'capture-input',label:'Take a note',placeholder:'Take a note…',capture:true,sendButton:true,onSubmit:()=>safeRun(()=>submitCapture()),onResize:scheduleWindow});
const originalCapture=$('capture-field');originalCapture.replaceWith(captureEditor.wrapper);
$('capture-input').addEventListener('im-markdown-change',inputCapture);
$('capture-input').addEventListener('compositionstart',()=>{if(active)active.composing=true;});
$('capture-input').addEventListener('compositionend',()=>{
  const s=active;if(!s)return;s.composing=false;
  // The final input event may follow compositionend in the same browser task.
  setTimeout(()=>{
    if(active!==s)return;
    if($('capture-input').value!==MosaicModel.normalized(s.titleEntry?.text??s.captureValue))inputCapture();
    const request=s.submitAfterComposition;s.submitAfterComposition=null;
    if(request)safeRun(()=>submitCapture(s,request.tag));
  },0);
});
let outsideCapture=null;
document.addEventListener('pointerdown',event=>{
  outsideCapture=!active?.titleEntry&&document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice,#menu,.im-format-toolbar,.card-tag,#search-button,#change-filter,#search-tags-panel')?{session:active,tag:active?.view.tag,x:event.clientX,y:event.clientY}:null;
},true);
document.addEventListener('pointercancel',()=>outsideCapture=null,true);
document.addEventListener('pointermove',event=>{if(outsideCapture&&Math.hypot(event.clientX-outsideCapture.x,event.clientY-outsideCapture.y)>9)outsideCapture=null;},true);
document.addEventListener('pointerup',()=>{const pending=outsideCapture;setTimeout(()=>{if(outsideCapture===pending)outsideCapture=null;},700);},true);
document.addEventListener('click',event=>{
  const pending=outsideCapture;outsideCapture=null;
  if(active?.titleEntry||!menu.hidden||modal.open)return;
  if(pending?.session===active)safeRun(()=>submitCapture(pending.session,pending.tag));
  else if(document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice,#menu,.im-format-toolbar,.card-tag,#search-button,#change-filter,#search-tags-panel'))safeRun(()=>submitCapture());
},true);
$('pinned-filter').addEventListener('click',()=>{if(active){active.view.pinned=!active.view.pinned;viewport.scrollTop=0;searchOpen=false;renderAll();}});
$('search').addEventListener('input',event=>{if(active){active.view.query=event.target.value;viewport.scrollTop=0;renderAll();}});
$('search').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();searchOpen=false;renderSearchControls();viewport.focus();}});
$('empty-action').addEventListener('click',()=>{if(!active)return;if(active.view.query||active.view.tag||active.view.pinned){Object.assign(active.view,{query:'',tag:'',pinned:false});$('search').value='';renderAll();}else editorDialog();});
$('preview-button').addEventListener('click',demo);
// Scrolling is navigation, not an intention to hover a card. A fresh mouse
// movement restores hover after scrolling; a stationary cursor never lights up
// whichever card happens to move underneath it. No timers or saves are needed.
let boardScrollAt=0,boardMousePoint=null;
function suppressBoardHover(){boardScrollAt=performance.now();board.classList.add('is-scrolling');}
viewport.addEventListener('scroll',()=>{suppressBoardHover();scheduleWindow();},{passive:true});
viewport.addEventListener('wheel',suppressBoardHover,{passive:true});
viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')suppressBoardHover();},{passive:true});
viewport.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse')return;
  // movementX/Y can both be zero when entering an iframe. Client coordinates
  // distinguish a deliberate move from a stationary pointer during scrolling.
  const moved=!boardMousePoint||event.clientX!==boardMousePoint.x||event.clientY!==boardMousePoint.y;
  boardMousePoint={x:event.clientX,y:event.clientY};
  if(moved&&performance.now()-boardScrollAt>120)board.classList.remove('is-scrolling');
},{passive:true});
let lastWidth=0;const overlayObserver=new ResizeObserver(()=>{if(board.clientWidth!==lastWidth){lastWidth=board.clientWidth;rebuildLayout();}syncOverlayMetrics();});
for(const node of [viewport,$('capture-composer'),$('notice')])overlayObserver.observe(node);
menu.addEventListener('pointerdown',event=>{event.stopPropagation();menuPress=true;});
menu.addEventListener('click',event=>{if(menuFromTouch&&!menuPress&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();return;}menuPress=false;},true);
document.addEventListener('contextmenu',event=>{if(matchMedia('(pointer:coarse)').matches&&event.target.closest('button,[role="button"],.ui-selection-status'))event.preventDefault();},true);
document.addEventListener('pointerdown',event=>{
  if(!menu.hidden&&!menu.contains(event.target)&&!event.target.closest('#more-button,.more-card,.palette-card,.detail-more'))hideMenu();
  if(searchOpen&&!event.target.closest('#search-tags-panel,.board-toolbar')){searchOpen=false;renderSearchControls();}
});
document.addEventListener('keydown',event=>{
  if(!event.defaultPrevented&&!event.isComposing&&active&&!modal.open&&!active.view.selecting&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='f'){
    event.preventDefault();searchOpen=true;hideMenu();renderSearchControls();$('search').focus();$('search').select();return;
  }
  if(event.key==='Escape'){
    if(active?.titleEntry&&menu.hidden&&!modal.open){event.preventDefault();active.titleEntry=null;renderCapture();return;}
    if(!menu.hidden){event.preventDefault();hideMenu();return;}
    if(modal.open)return;
    if(searchOpen){event.preventDefault();searchOpen=false;renderSearchControls();return;}
    if(active?.view.selecting){event.preventDefault();cancelSelection();}
  }
  if(!menu.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
  }
});
// Escape clears a selection first; a subsequent press follows the same
// guarded save-and-close path as Close. Capture it before ProseMirror prevents
// the browser's native dialog action, while allowing IME cancellation to work.
function clearCardSelection(event){
  const field=document.activeElement;
  if(modal.contains(field)&&field.matches('textarea,input')&&field.selectionStart!==null&&field.selectionStart!==field.selectionEnd){
    const head=field.selectionDirection==='backward'?field.selectionStart:field.selectionEnd;field.setSelectionRange(head,head);return true;
  }
  const body=modalState.body,view=body?.imRich?.view,selection=window.getSelection();
  const inBody=selection?.rangeCount&&body.contains(selection.anchorNode)&&body.contains(selection.focusNode);
  if(view&&(inBody&&!selection.isCollapsed||!view.state.selection.empty&&(body.contains(event.target)||event.target.closest('.im-format-toolbar')))){
    const head=inBody&&!selection.isCollapsed?view.posAtDOM(selection.focusNode,selection.focusOffset):view.state.selection.head;
    view.dispatch(view.state.tr.setSelection(imRichDeps.state.TextSelection.near(view.state.doc.resolve(head))));view.focus();return true;
  }
  if(selection?.rangeCount&&!selection.isCollapsed&&modal.contains(selection.anchorNode)&&modal.contains(selection.focusNode)){
    selection.collapse(selection.focusNode,selection.focusOffset);return true;
  }
  return false;
}
modal.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229&&!event.defaultPrevented&&modalState?.kind==='edit'&&!modalState.body?.imRich?.view.composing){
    event.preventDefault();event.stopPropagation();if(!event.repeat&&!clearCardSelection(event))closeModal();
  }
},true);
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
function dismissCardKeyboard(){
  if(!phoneBoard||modalState?.kind!=='edit')return false;
  const field=document.activeElement;
  if(modal.contains(field)&&field.matches('.editor-body,.editor-title')){field.blur();return true;}return false;
}
function isOutsideModal(event){const box=modal.getBoundingClientRect();return event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;}
modal.addEventListener('pointerdown',event=>{
  if(modalState)modalState.outsidePress=event.isPrimary&&event.button===0&&event.target===modal&&isOutsideModal(event)?{pointerId:event.pointerId}:null;
  if(!event.target.closest('.editor-body,.editor-title,.im-format-toolbar,.im-format-toggle')&&dismissCardKeyboard())modalState.outsidePress=null;
},true);
modal.addEventListener('pointercancel',()=>{if(modalState)modalState.outsidePress=null;},true);
modal.addEventListener('click',event=>{
  const d=modalState,press=d?.outsidePress;if(d)d.outsidePress=null;
  // A selection can start inside the card and produce a click on its backdrop.
  // Dismiss only when this same pointer also began outside this modal session.
  if(press&&event.detail>0&&(event.pointerId===undefined||event.pointerId===press.pointerId)&&event.target===modal&&isOutsideModal(event))closeModal();
});
window.addEventListener('beforeunload',event=>{if(retainedSessions.size||unfinishedEdits.size||(modalState?.kind==='edit'&&modalState.currentText!==modalState.original)){event.preventDefault();event.returnValue='';}});
renderAll();
if(window.parent===window&&new URLSearchParams(location.search).get('preview')==='1')demo();
