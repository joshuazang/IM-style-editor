/* Selection IDs use Standard Notes' encrypted UserPrefs through the existing bridge.
 * The host does not acknowledge successful preference writes. Legacy local entries
 * are removed only after a subsequent registration reads the saved value back.
 */
const imSelectionPreferenceKey='imStyleSelectionV1';
const imLegacySelectionPrefix='im-style-editor.next.selection.v1:';
const imSelectionPreferences={bridge:null,notes:Object.create(null),legacy:new Set(),legacyBlocked:false,error:'',queued:false,listeners:new Set(),revision:0,ready:false};
function imReadLegacySelection(uuid){
  const state=imSelectionPreferences;
  if(state.legacyBlocked)return undefined;
  try{return localStorage.getItem(imLegacySelectionPrefix+uuid);}
  // Legacy storage is optional. Denied access is not an encrypted-save failure.
  // Undefined means unavailable, distinct from a verified absent entry (null).
  catch{state.legacyBlocked=true;return undefined;}
}
function imSelectionValue(value){
  if(!value||!Array.isArray(value.ids)||!value.ids.every(id=>imFormat.validId(id)))throw new Error('Invalid selection preference');
  return {ids:[...new Set(value.ids)],...(Number.isFinite(value.height)&&value.height>=46?{height:value.height}:{})};
}
function imSelectionNotice(){
  return imSelectionPreferences.error||(imSelectionPreferences.legacy.size?'Selection privacy migration is awaiting verification. Reopen the editor after Standard Notes saves; verified local entries will then be removed.':'');
}
function imSelectionNotify(){for(const listener of imSelectionPreferences.listeners)listener(imSelectionNotice());}
function imSelectionFailure(){imSelectionPreferences.error='Could not confirm saving selection preferences. Retry selection saving. No new selection data was written to browser storage.';imSelectionNotify();}
function imSaveSelectionPreferences(){
  const state=imSelectionPreferences;if(state.queued)return;
  state.queued=true;
  queueMicrotask(()=>{
    state.queued=false;
    if(!state.bridge||!state.ready){imSelectionFailure();return;}
    const revision=state.revision;
    try{
      const notes=JSON.parse(JSON.stringify(state.notes));
      const data={...state.bridge.component.data,[imSelectionPreferenceKey]:{version:1,notes}};
      state.bridge.component.data=data;
      state.error='';
      state.bridge.postMessage('set-component-data',{componentData:data},reply=>{
        if(reply?.error&&state.revision===revision)imSelectionFailure();
      });
      imSelectionNotify();
    }catch{imSelectionFailure();}
  });
}
function imInitializeSelectionPreferences(bridge){
  const state=imSelectionPreferences;state.bridge=bridge;state.ready=false;
  try{
    const saved=bridge.getComponentDataValueForKey(imSelectionPreferenceKey);
    if(saved!==undefined&&(saved?.version!==1||!saved.notes||typeof saved.notes!=='object'||Array.isArray(saved.notes)))throw new Error('Invalid saved selection preferences');
    const notes=Object.create(null);
    for(const [uuid,value] of Object.entries(saved?.notes||{}))notes[uuid]=imSelectionValue(value);
    state.notes=notes;state.legacy.clear();state.ready=true;state.error='';
    let cleanup=false;
    for(const [uuid,normalized] of Object.entries(notes)){
      // This is a fresh host registration, not the SDK's locally updated copy.
      const old=imReadLegacySelection(uuid);let removed=old===null;
      if(old!==undefined&&old!==null)try{
        const key=imLegacySelectionPrefix+uuid;
        localStorage.removeItem(key);if(localStorage.getItem(key)!==null)throw new Error('Local removal failed');removed=true;
      }catch{state.legacy.add(uuid);state.error='Old local selection data could not be removed. Standard Notes preferences were read, but local cleanup is incomplete.';}
      // Keep cancellation tombstones when storage cannot be checked, so a
      // cancelled legacy selection cannot return if access becomes available.
      if(!normalized.ids.length&&removed){delete state.notes[uuid];cleanup=true;}
    }
    if(cleanup)imSaveSelectionPreferences();
  }catch{imSelectionFailure();}
  imSelectionNotify();
}
function imRememberSelection(uuid,ids,composer){
  const state=imSelectionPreferences;
  const height=parseFloat(composer?.style.getPropertyValue('--selection-row-height'));
  if(ids.size||state.legacy.has(uuid)||(state.legacyBlocked&&Object.hasOwn(state.notes,uuid)))state.notes[uuid]={ids:[...ids],...(Number.isFinite(height)&&height>=46?{height}:{})};
  else delete state.notes[uuid];
  state.revision++;imSaveSelectionPreferences();
}
function imRestoreSelection(uuid,messages,composer){
  const state=imSelectionPreferences;let value=state.notes[uuid];
  if(!Object.hasOwn(state.notes,uuid)){
    try{
      const old=imReadLegacySelection(uuid);
      if(old!==undefined&&old!==null){
        value=imSelectionValue(JSON.parse(old));state.legacy.add(uuid);
        const valid=new Set(messages.map(message=>message.id));
        // Migrate only a note supplied by the host, not unknown notes from local storage.
        if(messages.length||!value.ids.length){state.notes[uuid]={...value,ids:value.ids.filter(id=>valid.has(id))};value=state.notes[uuid];state.revision++;imSaveSelectionPreferences();}
        imSelectionNotify();
      }
    }catch{imSelectionFailure();}
  }
  const valid=new Set(messages.map(message=>message.id));
  const ids=new Set((value?.ids||[]).filter(id=>valid.has(id)));
  if(ids.size&&Number.isFinite(value?.height)&&value.height>=46)composer?.style.setProperty('--selection-row-height',value.height+'px');
  return ids;
}
function ImSelectionPreferenceNotice(){
  const [notice,setNotice]=dt.useState(imSelectionNotice);
  dt.useEffect(()=>{imSelectionPreferences.listeners.add(setNotice);setNotice(imSelectionNotice());return()=>imSelectionPreferences.listeners.delete(setNotice);},[]);
  if(!notice)return null;
  return x.jsxs('div',{className:'save-notice',role:imSelectionPreferences.error?'alert':'status',children:[notice,
    imSelectionPreferences.error&&x.jsx('button',{type:'button',onClick:imSaveSelectionPreferences,children:'Retry selection saving'})]});
}
