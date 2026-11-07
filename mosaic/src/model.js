/* Presentation helpers. A card is still one format-3 message, never a second copy. */
const MosaicModel = (() => {
  const heights=new WeakMap();
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
  const pins = settings => [...new Set(Array.isArray(settings.pinnedMessageIds) ? settings.pinnedMessageIds : [])];
  const isImported = message => !!message.forwarding && !message.importedStatusCleared;
  const matches = (message, query, tag, pinned, pinIds) =>
    (!query || message.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
    (!tag || (tag==='__untagged__' ? message.reactions.length===0 : message.reactions.includes(tag))) &&
    (!pinned || pinIds.has(message.id));
  function tags(messages, settings) {
    const removed = new Set(settings.deletedEmojis || []);
    const order = [...new Set([...(settings.reactionOrder || ['1️⃣','2️⃣','3️⃣','📓','📚','✅','💡','📍']), ...messages.flatMap(m=>m.reactions)])];
    return order.filter(tag=>!removed.has(tag));
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
    const first=sources[0],combined={...first,text:sources.map(m=>m.text).join('\n\n'),reactions:[...new Set(sources.flatMap(m=>m.reactions))],edited:true};
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
  function cardHeight(message,columns) {
    const cached=heights.get(message);if(cached?.columns===columns)return cached.height;
    const parts=split(message.text),titleLines=previewLines(parts.title,columns,3),bodyLines=parts.body?previewLines(parts.body,columns,7):0;
    const height=84+titleLines*25+bodyLines*23+(bodyLines?12:0)+(message.reactions.length?34:0)+(message.replyTo?44:0);
    heights.set(message,{columns,height});return height;
  }
  function layout(messages, settings, width, query='', tag='', pinnedOnly=false) {
    const gap=16, columns=Math.max(1,Math.floor((width+gap)/276)), cardWidth=(width-gap*(columns-1))/columns;
    const pinIds=new Set(pins(settings));
    const filtered=messages.filter(m=>matches(m,query,tag,pinnedOnly,pinIds)).slice().reverse();
    const groups=[['Pinned',filtered.filter(m=>pinIds.has(m.id))],['Other cards',filtered.filter(m=>!pinIds.has(m.id))]];
    const items=[], headings=[];let base=0;
    for(const [name,group] of groups){
      if(!group.length)continue;
      if(name==='Pinned'||headings.length){headings.push({label:name,y:base});base+=36;}
      const heights=Array(columns).fill(base);
      for(const message of group){
        const height=cardHeight(message,Math.max(12,Math.floor((cardWidth-40)/7.4)));
        const column=heights.indexOf(Math.min(...heights));
        items.push({message,x:column*(cardWidth+gap),y:heights[column],width:cardWidth,height});
        heights[column]+=height+gap;
      }
      base=Math.max(...heights)+12;
    }
    return {items,headings,height:base,count:filtered.length};
  }
  return {split,join,normalized,pins,tags,isImported,matches,clearStatuses,reply,target,merge,layout};
})();
