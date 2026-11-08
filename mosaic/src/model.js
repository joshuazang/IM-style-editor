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
    return {minimum:padding+bodyLine,maximum:8*(padding+bodyLine),bodyLine,padding};
  }
  const boardTagCount=message=>Math.min(boardTagLimit,message.reactions.length);
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
    const bounds=boardBounds(width,fontSize),bodyArea=bounds.maximum-bounds.padding,bodyLimit=Math.floor(bodyArea/bounds.bodyLine),titleLine=compact?font.compactTitleLine:font.titleLine;
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
  function layout(messages, settings, width, query='', tag='', pinnedOnly=false,selecting=false) {
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
  return {split,join,normalized,pins,tags,index,preview,label,boardTagLimit,boardBounds,boardTagCount,ordered,moveCard,visible,isImported,matches,clearStatuses,reply,target,merge,layout,measure,colors,color,palettes,fontSizes,appearance};
})();
