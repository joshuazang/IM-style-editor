/* Presentation helpers. A card is still one format-3 message, never a second copy. */
const MosaicModel = (() => {
  const heights=new WeakMap(),measured=new WeakMap();
  // Preset IDs are the only saved color values; unknown metadata is preserved.
  const colors=[
    {id:'default',name:'Default'},
    {id:'coral',name:'Coral',light:'#f7b2ae',dark:'#663e3e'},
    {id:'peach',name:'Peach',light:'#f6b18a',dark:'#67452f'},
    {id:'lemon',name:'Lemon',light:'#fff6b3',dark:'#5a512e'},
    {id:'sage',name:'Sage',light:'#e2f3ce',dark:'#3b5138'},
    {id:'seafoam',name:'Seafoam',light:'#b9ded5',dark:'#304f49'},
    {id:'ice',name:'Ice',light:'#d4e5ed',dark:'#354d59'},
    {id:'blue',name:'Blue',light:'#aecfdf',dark:'#304d65'},
    {id:'lavender',name:'Lavender',light:'#d7c2df',dark:'#51405e'},
    {id:'rose',name:'Rose',light:'#f5dfd9',dark:'#5b4148'},
    {id:'sand',name:'Sand',light:'#e9e3d1',dark:'#514b3b'},
    {id:'stone',name:'Stone',light:'#eeeef0',dark:'#44484d'},
    {id:'iris',name:'Iris blue',light:'#4e5cf0',dark:'#4e5cf0',ink:'#ffffff'}
  ];
  const color = (message,dark=false) => {
    const preset=colors.find(item=>item.id===message.cardColor)||colors[0];
    return {id:preset.id,background:preset[dark?'dark':'light']||'var(--surface)',ink:preset.ink||(dark?'#f3f5f1':'#27332f')};
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
  const heightKey=(width,pinned,selecting)=>width+':'+pinned+':'+selecting;
  function measure(message,width,pinned,selecting,height) {
    const key=heightKey(width,pinned,selecting),previous=measured.get(message);
    if(previous?.key===key&&previous.height===height)return false;
    measured.set(message,{key,height});return true;
  }
  function cardHeight(message,width,pinned,selecting) {
    const compact=width<230,key=heightKey(width,pinned,selecting),actual=measured.get(message),cached=heights.get(message);
    if(actual?.key===key)return actual.height;
    if(cached?.key===key)return cached.height;
    const padding=compact?24:36,columns=Math.max(8,Math.floor((width-padding)/7));
    const parts=split(message.text),titleLines=previewLines(parts.title,Math.max(5,columns-(pinned?4:0)),3),bodyLines=parts.body?previewLines(parts.body,columns,7):0;
    const height=(compact?80:90)+titleLines*(compact?22:25)+bodyLines*(compact?20:23)+(bodyLines?10:0)+(message.reactions.length?34:0)+(message.replyTo?40:0);
    heights.set(message,{key,height});return height;
  }
  function layout(messages, settings, width, query='', tag='', pinnedOnly=false,selecting=false) {
    const gap=width<600?10:16, columns=width<600?2:Math.max(2,Math.floor((width+gap)/276)), cardWidth=(width-gap*(columns-1))/columns;
    const pinIds=new Set(pins(settings));
    const filtered=messages.filter(m=>matches(m,query,tag,pinnedOnly,pinIds)).slice().reverse();
    const groups=[['Pinned',filtered.filter(m=>pinIds.has(m.id))],['Other cards',filtered.filter(m=>!pinIds.has(m.id))]];
    const items=[], headings=[];let base=0;
    for(const [name,group] of groups){
      if(!group.length)continue;
      if(name==='Pinned'||headings.length){headings.push({label:name,y:base});base+=36;}
      const heights=Array(columns).fill(base);
      for(const message of group){
        const height=cardHeight(message,cardWidth,pinIds.has(message.id),selecting);
        const column=heights.indexOf(Math.min(...heights));
        items.push({message,x:column*(cardWidth+gap),y:heights[column],width:cardWidth,height});
        heights[column]+=height+gap;
      }
      base=Math.max(...heights)+12;
    }
    return {items,headings,height:base,count:filtered.length};
  }
  return {split,join,normalized,pins,tags,isImported,matches,clearStatuses,reply,target,merge,layout,measure,colors,color};
})();
