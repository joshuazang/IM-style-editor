"use strict";
const MOSAIC_VERSION="1.3.5";
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
/* IM_SHARED_UI_BEGIN 3770f882af3c851f674c445b3cf1e9192273ac37a7ccf0400eed3031804c923a */
/* Shared original SVG vectors. Only this fixed dictionary becomes markup. */
const imUiIcons = {
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
  const heights=new WeakMap(),measured=new WeakMap(),prepared=new WeakMap(),indexes=new WeakMap(),pinCache=new WeakMap();
  let latestIndex=null;
  const palettes=[{id:'sage',name:'Sage',description:'Soft green and clear white'},
    {id:'paper',name:'Paper',description:'Clean white and charcoal'},
    {id:'sand',name:'Sand',description:'Warm cream and dark brown'}];
  // Medium keeps the previous type sizes; Large is the default for readability.
  const fontSizes={
    small:{name:'Small',title:15,compactTitle:14,titleLine:22,compactTitleLine:20,body:12,bodyLine:20,compactBodyLine:18,editTitle:22,compactEditTitle:20,editBody:14,capture:14},
    medium:{name:'Medium',title:17,compactTitle:16,titleLine:25,compactTitleLine:22,body:13,bodyLine:23,compactBodyLine:20,editTitle:24,compactEditTitle:22,editBody:16,capture:15},
    large:{name:'Large',title:19,compactTitle:18,titleLine:28,compactTitleLine:25,body:15,bodyLine:26,compactBodyLine:23,editTitle:26,compactEditTitle:24,editBody:18,capture:18},
    'extra-large':{name:'Extra large',title:22,compactTitle:21,titleLine:32,compactTitleLine:29,body:18,bodyLine:30,compactBodyLine:27,editTitle:29,compactEditTitle:27,editBody:21,capture:20}
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
    const value={message,search:sameText?previous.search:(imFormat.title(message)?imFormat.title(message)+'\n'+message.text:message.text).toLocaleLowerCase(),parts:sameText?previous.parts:{title:imFormat.title(message),body:message.text},tags:previous?.message.reactions===message.reactions?previous.tags:new Set(message.reactions)};
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
  const label = message => {const {title,body}=preview(message);return title||body.slice(0,70).replace(/\s+/g,' ').trim()||'Empty card';};
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
  const heightKey=(width,pinned,selecting,fontSize)=>width+':'+pinned+':'+fontSize;
  function boardBounds(width,fontSize='large') {
    const compact=width<230,font=fontSizes[fontSize],padding=compact?22:28;
    const bodyLine=compact?font.compactBodyLine:font.bodyLine;
    return {minimum:padding+bodyLine,maximum:5*(padding+bodyLine),bodyLine,padding};
  }
  function boardTagCount(message,width,fontSize='large') {
    const bounds=boardBounds(width,fontSize),font=fontSizes[fontSize],parts=preview(message);
    const title=parts.title?(width<230?font.compactTitleLine:font.titleLine):0;
    const reserved=bounds.padding+title+(parts.body?bounds.bodyLine:0)+(title&&parts.body?8:0)+(message.replyTo?44:0)+8;
    const rows=Math.max(1,Math.floor((bounds.maximum-reserved+6)/28));
    // Leave room for the overflow button, including wide native emoji glyphs.
    const slots=rows*Math.max(1,Math.floor((width-bounds.padding+6)/46));
    return message.reactions.length<=Math.min(boardTagLimit,slots)?message.reactions.length:Math.max(1,Math.min(boardTagLimit,slots-1));
  }
  function measure(message,width,pinned,selecting,height,fontSize='large') {
    const key=heightKey(width,pinned,selecting,fontSize),previous=measured.get(message);
    if(previous?.key===key&&previous.height===height)return false;
    measured.set(message,{key,height});return true;
  }
  function cardHeight(message,width,pinned,selecting,fontSize) {
    const compact=width<230,font=fontSizes[fontSize],key=heightKey(width,pinned,selecting,fontSize),actual=measured.get(message),cached=heights.get(message);
    if(actual?.key===key)return actual.height;
    if(cached?.key===key)return cached.height;
    const padding=compact?22:28,columns=Math.max(8,Math.floor((width-padding)/(font.body*.53)));
    const bounds=boardBounds(width,fontSize),lineLimit=Math.ceil(bounds.maximum/bounds.bodyLine);
    const parts=preview(message),titleLines=parts.title?previewLines(parts.title,columns,lineLimit):0,bodyLines=parts.body?previewLines(parts.body,columns,lineLimit):0;
    const tagCount=boardTagCount(message,width,fontSize),tagSlots=tagCount+(message.reactions.length>tagCount?1:0);
    const tagRows=Math.ceil(tagSlots/Math.max(1,Math.floor((width-padding+6)/37)));
    const height=Math.min(bounds.maximum,Math.max(bounds.minimum,bounds.padding+titleLines*(compact?font.compactTitleLine:font.titleLine)+bodyLines*bounds.bodyLine+(bodyLines&&titleLines?8:0)+(message.replyTo?36:0)+(tagRows?8+tagRows*22+(tagRows-1)*6:0)));
    heights.set(message,{key,height});return height;
  }
  function layout(messages, settings, width, query='', tag='', pinnedOnly=false,selecting=false) {
    const gap=width<600?10:16, columns=width<600?2:Math.max(2,Math.floor((width+gap)/276)), cardWidth=(width-gap*(columns-1))/columns;
    const pinIds=new Set(pins(settings)),fontSize=appearance(settings).fontSize;
    const matching=filtered(messages,settings,query,tag,pinnedOnly).slice().reverse();
    const groups=[['Pinned',matching.filter(m=>pinIds.has(m.id))],['Other cards',matching.filter(m=>!pinIds.has(m.id))]];
    const items=[],headings=[],byId=new Map(),columnItems=Array.from({length:columns},()=>[]);let base=0;
    for(const [name,group] of groups){
      if(!group.length)continue;
      if(name==='Pinned'||headings.length){headings.push({label:name,y:base});base+=36;}
      const heights=Array(columns).fill(base);
      for(const message of group){
        const height=cardHeight(message,cardWidth,pinIds.has(message.id),selecting,fontSize);
        const column=heights.indexOf(Math.min(...heights));
        const item={message,x:column*(cardWidth+gap),y:heights[column],width:cardWidth,height,order:items.length};
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
  return {split,join,normalized,pins,tags,index,preview,label,boardTagLimit,boardBounds,boardTagCount,visible,isImported,matches,clearStatuses,reply,target,merge,layout,measure,colors,color,palettes,fontSizes,appearance};
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
const modal=$('modal'), menu=$('menu'), viewport=$('viewport'), board=$('board');
let active=null, modalState=null, toastTimer, frame=0, searchOpen=false, menuFromTouch=false, menuPress=false, dateOpen=false, layout={items:[],headings:[],height:0,count:0};
let mounted=new Map(), selectionPreferences=Object.create(null), searchPanelFit=null;
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
  const messages=change.messages??s.messages,settings=change.settings??s.settings;
  const draft=Object.hasOwn(change,'draft')?change.draft:s.draft,reply=Object.hasOwn(change,'reply')?change.reply:s.reply;
  imFormat.write(s.note,messages,settings,draft,reply);
  Object.assign(s,{messages:imFormat.readMessages(s.note),settings:imFormat.readSettings(s.note),draft:imFormat.readDraft(s.note),reply:imFormat.readReply(s.note)});
  const promise=persist(s);
  if(s===active){if(redraw)renderAll();else renderCapture();}
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
  field.setAttribute('aria-label',s?.titleEntry?'Title':'Take a note');field.placeholder=s?.titleEntry?'Write a title…':'Take a note…';
  if(field.value!==value)field.value=value;
  field.disabled=!writable();growCapture();
  const quote=$('capture-reply');quote.replaceChildren();quote.hidden=!s?.reply&&!s?.titleEntry;
  if(s?.titleEntry){const source=s.messages.find(m=>m.id===s.titleEntry.id);quote.append(el('strong','','Title for card'),el('span','inline-quote',source?.text.slice(0,160)||'Card'),button('Cancel title entry','close',()=>{s.titleEntry=null;if(!s.dirty&&!s.pending)retainedSessions.delete(s.note.uuid);renderCapture();},'icon-button'));}
  else if(s?.reply){
    const text=button('Show quoted card',null,()=>jumpTo(s.reply),'inline-quote');text.textContent=s.reply.text.replace(/\s+/g,' ').slice(0,160)||'Quoted message';
    quote.append(text,button('Cancel reply','close',()=>safeRun(()=>update(s,{reply:null},false)),'icon-button danger'));
  }
}
function growCapture(){const field=$('capture-input');field.style.height='0px';field.style.height=Math.min(180,Math.max(56,field.scrollHeight))+'px';scheduleWindow();}
function inputCapture(){
  const s=active;if(!writable(s))return;
  const value=$('capture-input').value;
  if(s.titleEntry){s.titleEntry.text=value;return;}
  s.captureValue=value===MosaicModel.normalized(s.captureOriginal)?s.captureOriginal:value;s.captureRevision++;
  safeRun(()=>update(s,{draft:s.captureValue},false));
}
function submitCapture(s=active,tag=s?.view.tag){
  if(s?.titleEntry){if(s.composing){s.submitAfterComposition={title:true};return Promise.resolve();}return submitTitle(s);}
  if(!writable(s)||s.submission||!s.captureValue.trim())return Promise.resolve();
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
function renderAll() {
  const s=active;renderAppearance();renderStatus();renderNotice();renderCapture();renderTags();
  $('welcome').hidden=!!s;$('more-button').disabled=!s;$('search-button').disabled=!s;$('pinned-filter').disabled=!s;$('search').disabled=!s;
  $('pinned-filter').setAttribute('aria-pressed',String(!!s?.view.pinned));
  renderSearchControls();refreshEditorMetadata();
  $('app').classList.toggle('selection-mode',!!s?.view.selecting);
  rebuildLayout();renderSelection();
}
function renderAppearance() {
  const root=document.documentElement,{palette,fontSize}=MosaicModel.appearance(active?.settings),font=MosaicModel.fontSizes[fontSize];
  if(root.dataset.mosaicPalette!==palette)root.dataset.mosaicPalette=palette;
  if(root.dataset.mosaicFontSize!==fontSize)root.dataset.mosaicFontSize=fontSize;
  for(const [key,value] of Object.entries(font))if(typeof value==='number'){
    const name='--type-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),next=value+'px';
    if(root.style.getPropertyValue(name)!==next)root.style.setProperty(name,next);
  }
}
function rebuildLayout() {
  const anchor=findAnchor();
  layout=active?MosaicModel.layout(active.messages,active.settings,Math.max(1,board.clientWidth),active.view.query,active.view.tag,active.view.pinned,active.view.selecting):{items:[],headings:[],height:0,count:0};
  board.style.height=layout.height+'px';board.replaceChildren();mounted.clear();
  for(const heading of layout.headings){const node=el('div','section-heading',heading.label);node.style.top=heading.y+'px';board.append(node);}
  const filtered=active&&(active.view.query||active.view.tag||active.view.pinned);
  $('empty').hidden=!active||!!layout.count||active.damaged||!filtered;
  if(anchor){const next=layout.byId?.get(anchor.id);if(next)viewport.scrollTop+=next.y-anchor.y;}
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
    node.classList.toggle('is-compact',item.width<230);
    const geometry=item.width+':'+fontSize;
    Object.assign(node.style,{width:item.width+'px',height:node.dataset.geometry===geometry?item.height+'px':'auto',transform:`translate(${item.x}px,${item.y}px)`});
    if(node.dataset.geometry!==geometry){
      node.dataset.geometry=geometry;node.style.removeProperty('--board-title-lines');node.style.removeProperty('--board-body-lines');
      measurements.push({node,item});
    }
  }
  for(const [id,node] of mounted)if(!visible.has(id)){node.remove();mounted.delete(id);}
  // Reserve real tag/reply heights before clamping text. Batch all reads before
  // writes; this only runs for newly mounted cards or changed width/font size.
  const previewLimit=({node,item})=>{
    const title=node.querySelector('.card-title'),body=node.querySelector('.card-body'),style=getComputedStyle(node);
    const occupied=[...node.children].filter(n=>n!==title&&n!==body&&n.className!=='selection-check').reduce((sum,n)=>sum+n.getBoundingClientRect().height+parseFloat(getComputedStyle(n).marginTop),0);
    const maximum=MosaicModel.boardBounds(item.width,fontSize).maximum;
    const padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+2;
    const bodyStyle=body&&getComputedStyle(body),titleStyle=title&&getComputedStyle(title);
    const bodyLine=bodyStyle?parseFloat(bodyStyle.lineHeight):0,titleLine=titleStyle?parseFloat(titleStyle.lineHeight):0;
    const gap=(bodyStyle?parseFloat(bodyStyle.marginTop):0)+(titleStyle?parseFloat(titleStyle.marginTop):0);
    const available=maximum-padding-occupied-gap;
    const titleLines=title?Math.max(1,Math.min(Math.ceil(title.scrollHeight/titleLine),Math.floor((available-bodyLine)/titleLine))):0;
    return {node,titleLines,bodyLines:body?Math.max(1,Math.floor((available-titleLines*titleLine)/bodyLine)):0,crowded:available<titleLine+bodyLine};
  };
  let limits=measurements.map(previewLimit);
  const crowded=limits.filter(({node,crowded})=>crowded&&node.collapseTags);
  // Custom tags can be wider than emoji estimates. Fall back to one tag plus
  // +N rather than pushing the text or tags outside the five-times budget.
  if(crowded.length){for(const {node} of crowded)node.collapseTags();limits=measurements.map(previewLimit);}
  for(const {node,titleLines,bodyLines} of limits){node.style.setProperty('--board-title-lines',titleLines);node.style.setProperty('--board-body-lines',bodyLines);}
  // Measure only newly mounted/resized previews, in one read batch. Reuse those
  // real heights on future layouts rather than leaving guessed empty space.
  let changed=false;const selecting=!!active?.view.selecting;
  for(const {node,item} of measurements){
    const height=Math.ceil(node.getBoundingClientRect().height);
    const measured=MosaicModel.measure(item.message,item.width,node.classList.contains('is-pinned'),selecting,height,fontSize);
    if(measured&&(height!==item.height))changed=true;
  }
  if(changed){
    const anchor=findAnchor(),s=active,atBottom=viewport.scrollHeight-viewport.clientHeight-viewport.scrollTop<=4;
    layout=MosaicModel.layout(s.messages,s.settings,Math.max(1,board.clientWidth),s.view.query,s.view.tag,s.view.pinned,s.view.selecting);
    board.style.height=layout.height+'px';
    for(const [index,heading] of layout.headings.entries())board.querySelectorAll('.section-heading')[index].style.top=heading.y+'px';
    for(const [id,node] of mounted){const item=layout.byId.get(id);if(item)Object.assign(node.style,{height:item.height+'px',transform:`translate(${item.x}px,${item.y}px)`});}
    if(!s.locatedId){
      if(atBottom)viewport.scrollTop=viewport.scrollHeight;
      else if(anchor){const next=layout.byId.get(anchor.id);if(next&&Math.abs(next.y-anchor.y)>.5)viewport.scrollTop+=next.y-anchor.y;}
    }
    scheduleWindow();
  }
}
function metaText(message) {
  const bits=[];if(message.copied)bits.push('Copied');if(message.exported)bits.push('Exported');if(MosaicModel.isImported(message))bits.push('Imported');
  if(message.createdAt&&!Number.isNaN(new Date(message.createdAt).getTime()))bits.push(new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(message.createdAt)));
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
function cardNode(message,width) {
  const s=active,parts=MosaicModel.preview(message),pinned=MosaicModel.pins(s.settings).includes(message.id);
  const node=el('article','card'+(pinned?' is-pinned':'')+(s.view.selected.has(message.id)?' selected':''));
  if(s.locatedId===message.id)node.classList.add('located');
  const color=MosaicModel.color(message);node.style.setProperty('--card-color',color.background);node.style.setProperty('--card-ink',color.ink);
  node.dataset.id=message.id;node.setAttribute('role','listitem');node.tabIndex=0;node.setAttribute('aria-label',MosaicModel.label(message));
  if(s.view.selecting){const check=el('span','selection-check');if(s.view.selected.has(message.id))check.append(mosaicIcon('check'));node.append(check);node.setAttribute('aria-label',(s.view.selected.has(message.id)?'Selected: ':'Select: ')+MosaicModel.label(message));}
  const activate=()=>{if(!menu.hidden)return;s.view.selecting?toggleSelection(message.id):writable(s)?editorDialog(message.id):readCard(message.id);};
  if(parts.title)node.append(el('h2','card-title',parts.title));
  if(message.replyTo)node.append(el('div','card-reply',message.replyTo.text.replace(/\s+/g,' ').slice(0,150)||'Quoted message'));
  if(parts.body)node.append(el('p','card-body',parts.body));
  if(message.reactions.length){
    const tags=el('div','card-tags');
    const tagCount=MosaicModel.boardTagCount(message,width,MosaicModel.appearance(s.settings).fontSize);
    for(const tag of message.reactions.slice(0,tagCount)){
      const badge=button('Filter messages by '+tag,null,()=>{
        if(active!==s)return;
        if(s.view.selecting){toggleSelection(message.id);return;}
        s.view.tag=tag;s.view.scroll=0;viewport.scrollTop=0;searchOpen=false;hideMenu();renderAll();
      },'card-tag');
      badge.replaceChildren();
      // The same rounded vector body, pointed tail and transparent hole as IM.
      for(const [className,markup] of [
        ['emoji-tag-body','<rect width="100%" height="100%" rx="6"/><rect x="50%" width="50%" height="100%"/>'],
        ['emoji-tag-tip','<path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H2Q6 0 9 4L18 16Q22 20 18 24L9 36Q6 40 2 40H0ZM13 20a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0Z"/>']]){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class',className);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
        if(className==='emoji-tag-tip')svg.setAttribute('viewBox','0 0 20 40');svg.innerHTML=markup;badge.append(svg);
      }
      badge.append(el('span','emoji-tag-emoji',tag));tags.append(badge);
    }
    let more;
    const overflow=remaining=>{
      const label='Show '+remaining+' more tag'+(remaining===1?'':'s');
      if(!more){more=button(label,null,activate,'card-tag card-tag-overflow');tags.append(more);}
      more.textContent='+'+remaining;more.setAttribute('aria-label',label);more.title=label;
    };
    const remaining=message.reactions.length-tagCount;if(remaining>0)overflow(remaining);
    if(message.reactions.length>1)node.collapseTags=()=>{for(const badge of [...tags.children].slice(1))if(badge!==more)badge.remove();overflow(message.reactions.length-1);};
    node.append(tags);
  }
  node.addEventListener('click',activate);
  node.addEventListener('keydown',event=>{if(event.target!==node)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();node.click();}});
  bindContextMenu(node,event=>{const current=s.messages.find(m=>m.id===message.id);if(current)cardMenu(current,event);},()=>active===s&&!s.view.selecting);
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
function colorMenu(id,event) {
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
  const s=active,pinned=MosaicModel.pins(s.settings).includes(message.id);
  const editing=modalState?.kind==='edit'&&modalState.uuid===s.note.uuid&&modalState.id===message.id?modalState:null;
  const current=()=>s.messages.find(m=>m.id===message.id);
  const saved=action=>async()=>{if(editing&&!(await editing.commit(false)))return;return action();};
  showMenu([['Edit','edit',()=>editCard(message.id)],[imFormat.title(message)?'Edit title':'Add title','textSize',()=>{if(editing)editing.unlockTitle();else beginTitle(message.id);}],['Reply','reply',saved(()=>replyTo(message.id))],[pinned?'Unpin':'Pin',pinned?'unpin':'pin',()=>togglePin(s,message.id)],
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
  if(modalState!==record)return;if(!record.error){record.error=el('p','dialog-error');record.error.setAttribute('role','alert');record.root.append(record.error);}record.error.textContent=text;
}
function closeModal(force=false) {
  if(!force&&modalState?.busy)return;
  if(!force&&modalState?.kind==='edit'&&modalState.commit){safeRun(()=>modalState.commit(true));return;}
  if(!force)stashEdit();
  modalState?.layoutObserver?.disconnect();modalState?.tagObserver?.disconnect();modalState?.tagBadges?.remove();modal.style.removeProperty('--tag-overhang');
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
  for(const tag of d.tags){const badge=el('span','card-tag',tag);badge.setAttribute('role','listitem');d.tagBadges.append(badge);}
  positionEditorTags(d);
}
function positionEditorTags(d){
  if(modalState!==d||!d.tagBadges)return;
  const extra=d.tagBadges.hidden?0:Math.max(0,Math.ceil(d.tagBadges.getBoundingClientRect().height)-13),value=extra+'px';
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
    const text=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(message.createdAt));
    add(text,'card-timestamp');d.meta.querySelector('.card-timestamp').title=new Date(message.createdAt).toLocaleString();
  }
  if(message.edited)add('edited','card-edited');
  renderEditorTags(d);
}
function editorDialog(id=null) {
  if(!id){$('capture-input').focus();return;}
  if(modalState?.kind==='edit'&&modalState.id===id&&modalState.uuid===active?.note.uuid){modalState.body.focus();return;}
  const s=active;if(s?.titleEntry){notify('Finish or cancel the current title entry first.');return;}if(!writable(s)){notify('This note is read only until the notice above is resolved.');return;}
  const message=s.messages.find(m=>m.id===id);if(!message)return;
  const stashed=unfinishedEdits.get(editKey(s.note.uuid,id));
  const restored=stashed?.id===id&&stashed.original===message.text&&(stashed.originalTitle??imFormat.title(message))===imFormat.title(message)?stashed:null;
  const original=message.text,originalTitle=imFormat.title(message),currentTitle=restored?.title??originalTitle;
  const d=openModal('edit','Edit card');Object.assign(d,{id,original,originalTitle,titleValue:currentTitle,titleUnlocked:restored?.titleUnlocked||false,currentText:restored?.text??original,tags:new Set(restored?.tags??message.reactions),originalTags:message.reactions,fieldRevision:0,sending:false,wantClose:false});
  if(stashed&&!restored){
    d.root.append(el('p','dialog-help','This card changed after your unfinished edit. Your earlier edit is available here to copy before you continue.'));
    const earlier=el('textarea','transfer-text');earlier.readOnly=true;earlier.value=stashed.text;earlier.setAttribute('aria-label','Earlier unfinished edit');d.root.append(earlier);
  }
  const title=el('textarea','editor-title');title.rows=1;title.placeholder='Title';title.setAttribute('aria-label','Card title');title.value=currentTitle;title.enterKeyHint='enter';title.hidden=!d.titleUnlocked;
  const titlePreview=el('h3','detail-title',currentTitle);titlePreview.hidden=!currentTitle||d.titleUnlocked;
  const body=el('textarea','editor-body');body.rows=1;body.placeholder='Text';body.setAttribute('aria-label','Card body');body.value=d.currentText;body.enterKeyHint='enter';d.body=body;
  // Measure the natural text height; flex shrinks only the body at the screen limit.
  // Preserve its reading position when a long card is resized or edited.
  const growBody=()=>{const top=body.scrollTop;body.style.height='0px';body.style.height=body.scrollHeight+'px';body.scrollTop=top;};
  let measuredWidth=0;
  d.layoutObserver=new ResizeObserver(()=>{const width=body.clientWidth;if(width!==measuredWidth){measuredWidth=width;growBody();}});
  d.layoutObserver.observe(d.root);
  body.addEventListener('input',growBody);
  const pin=button('Pin card','pin',()=>safeRun(()=>togglePin(s,id)),'icon-button detail-pin');d.pin=pin;
  d.root.append(titlePreview,title,pin,body);
  d.unlockTitle=()=>{d.titleUnlocked=true;title.hidden=false;titlePreview.hidden=true;title.style.height='auto';title.style.height=title.scrollHeight+'px';growBody();hideMenu();title.focus();};
  d.tagBadges=el('div','card-detail-tags');d.tagBadges.setAttribute('role','list');d.tagBadges.setAttribute('aria-label','Emoji tags');modal.append(d.tagBadges);
  d.tagObserver=new ResizeObserver(()=>positionEditorTags(d));d.tagObserver.observe(d.tagBadges);
  d.toggleTag=tag=>{d.tags.has(tag)?d.tags.delete(tag):d.tags.add(tag);d.fieldRevision++;renderEditorTags(d);};
  d.meta=el('div','card-detail-meta');d.meta.setAttribute('aria-label','Card timestamp and statuses');d.root.append(d.meta);
  const footer=el('div','card-detail-tools');
  const palette=button('Background options','palette',event=>colorMenu(id,event));
  const more=button('Card options','more',event=>cardMenu(s.messages.find(m=>m.id===id),event),'icon-button detail-more');
  const close=button('Close',null,()=>safeRun(()=>saveEditor(true)),'detail-close');d.submit=close;
  footer.append(palette,more,close);d.root.append(footer);
  const change=()=>{d.fieldRevision++;d.currentText=MosaicModel.normalized(body.value)===MosaicModel.normalized(original)?original:MosaicModel.normalized(body.value).replace(/\n/g,(/\r\n|\n|\r/.exec(original)||['\n'])[0]);d.titleValue=MosaicModel.normalized(title.value)===MosaicModel.normalized(currentTitle)?currentTitle:title.value;if(!title.hidden){title.style.height='auto';title.style.height=title.scrollHeight+'px';}};
  title.addEventListener('input',change);body.addEventListener('input',change);
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
      if(restored)unfinishedEdits.delete(editKey(s.note.uuid,id));if(d.wantClose)closeModal(true);return true;
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
      if(d.wantClose&&d.fieldRevision===revision){closeModal(true);notify('Card updated.');}
      else{d.wantClose=false;refreshEditorMetadata();}
    }});
    try{await saving;return d.fieldRevision===revision;}catch{
      d.busy=false;close.disabled=false;close.textContent='Retry save';close.setAttribute('aria-label','Retry save');
      dialogError(d,'Saving was not confirmed. Your text is still here. Retry save before closing.');return false;
    }
  }
  refreshEditorMetadata();setTimeout(()=>body.focus(),0);
}
function editCard(id){editorDialog(id);}
function readCard(id) {
  const s=active,message=s?.messages.find(m=>m.id===id);if(!message)return;
  const d=openModal('read','Card'),parts=MosaicModel.preview(message);
  if(message.replyTo){const quote=button('Show quoted card',null,()=>{closeModal();jumpTo(message.replyTo);},'reply-preview');quote.textContent=message.replyTo.text||'Quoted message';d.root.append(quote);}
  d.root.append(el('h3','reader-title',parts.title),el('div','reader-body',parts.body),el('p','reader-meta',metaText(message)));
  const tags=el('div','reader-tags');for(const tag of message.reactions)tags.append(el('span','card-tag',tag));d.root.append(tags);
  actions(d,[button('Copy','copy',()=>safeRun(()=>copyRecords(s,[message])),'secondary-button'),button('Reply','reply',()=>replyTo(id),'secondary-button'),button('Edit','edit',()=>editCard(id),'primary-button')]);
}
function replyTo(id) {
  const s=active,message=s.messages.find(m=>m.id===id);if(!message||!writable(s))return;
  closeModal();safeRun(()=>update(s,{reply:MosaicModel.reply(message,s.note.uuid)},false));$('capture-input').focus();
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
$('capture-input').addEventListener('input',inputCapture);
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
bindSubmitField($('capture-input'),()=>safeRun(()=>submitCapture()),{composing:()=>!!active?.composing});
let outsideCapture=null;
document.addEventListener('pointerdown',event=>{
  outsideCapture=!active?.titleEntry&&document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice,#menu,.card-tag,#search-button,#change-filter,#search-tags-panel')?{session:active,tag:active?.view.tag,x:event.clientX,y:event.clientY}:null;
},true);
document.addEventListener('pointercancel',()=>outsideCapture=null,true);
document.addEventListener('pointermove',event=>{if(outsideCapture&&Math.hypot(event.clientX-outsideCapture.x,event.clientY-outsideCapture.y)>9)outsideCapture=null;},true);
document.addEventListener('pointerup',()=>{const pending=outsideCapture;setTimeout(()=>{if(outsideCapture===pending)outsideCapture=null;},700);},true);
document.addEventListener('click',event=>{
  const pending=outsideCapture;outsideCapture=null;
  if(active?.titleEntry||!menu.hidden||modal.open)return;
  if(pending?.session===active)safeRun(()=>submitCapture(pending.session,pending.tag));
  else if(document.activeElement===$('capture-input')&&!$('capture-composer').contains(event.target)&&!event.target.closest('dialog,#notice,#menu,.card-tag,#search-button,#change-filter,#search-tags-panel'))safeRun(()=>submitCapture());
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
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{if(event.target===modal){const box=modal.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeModal();}});
window.addEventListener('beforeunload',event=>{if(retainedSessions.size||unfinishedEdits.size||(modalState?.kind==='edit'&&modalState.currentText!==modalState.original)){event.preventDefault();event.returnValue='';}});
renderAll();
if(window.parent===window&&new URLSearchParams(location.search).get('preview')==='1')demo();
