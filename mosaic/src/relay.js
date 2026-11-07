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
