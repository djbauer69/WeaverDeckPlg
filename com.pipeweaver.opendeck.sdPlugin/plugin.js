#!/usr/bin/env node
"use strict";

/* PipeWeaver Control for OpenDeck v0.12.1
 * v0.12.1 keeps the proven v0.11.2 control engine intact and adds an isolated
 * application-artwork layer around its OpenDeck WebSocket connection.
 * Audio control still goes exclusively through PipeWeaver's HTTP API.
 */

const {installApplicationVisuals}=require("./app-visuals");

const NativeWebSocket=globalThis.WebSocket;
if(!NativeWebSocket){
  console.error("PipeWeaver Control: Node.js 20+ is required (global WebSocket missing)");
  process.exit(3);
}

// Keep diagnostics aligned with the package version while the stable v0.11.2
// engine lives in plugin-core.js unchanged.
for(const method of ["log","error","warn"]){
  const original=console[method].bind(console);
  console[method]=(...args)=>original(...args.map(v=>typeof v==="string"?v.replace(/\[v0\.11\.2\]/g,"[v0.12.1]"):v));
}

const visualLayer=installApplicationVisuals();

class WeaverVisualWebSocket {
  constructor(...args){
    this._ws=new NativeWebSocket(...args);
    this._onopen=null;this._onmessage=null;this._onerror=null;this._onclose=null;
    this._ws.onopen=(ev)=>{
      visualLayer.attachSocket(this);
      if(this._onopen)this._onopen(ev);
    };
    this._ws.onmessage=(ev)=>{
      try{visualLayer.handleIncoming(this,ev)}catch(e){console.error("[v0.12.1] application visuals inbound error:",e?.stack||e)}
      if(this._onmessage)return this._onmessage(ev);
    };
    this._ws.onerror=(ev)=>{if(this._onerror)this._onerror(ev)};
    this._ws.onclose=(ev)=>{
      visualLayer.detachSocket(this);
      if(this._onclose)this._onclose(ev);
    };
  }
  get readyState(){return this._ws.readyState}
  get url(){return this._ws.url}
  get protocol(){return this._ws.protocol}
  get extensions(){return this._ws.extensions}
  get binaryType(){return this._ws.binaryType}
  set binaryType(v){this._ws.binaryType=v}
  get bufferedAmount(){return this._ws.bufferedAmount}
  send(data){
    // App artwork already contains its own compact state indicator. Suppress
    // the core text title for application-action contexts so it cannot cover
    // the larger application icon.
    try{
      const m=typeof data==="string"?JSON.parse(data):null;
      if(m?.event==="setTitle"&&m?.context&&visualLayer.ownsContext(m.context)){
        m.payload={...(m.payload||{}),title:""};
        data=JSON.stringify(m);
      }
    }catch(_){}
    return this._ws.send(data)
  }
  close(...args){return this._ws.close(...args)}
  addEventListener(...args){return this._ws.addEventListener(...args)}
  removeEventListener(...args){return this._ws.removeEventListener(...args)}
  set onopen(fn){this._onopen=fn} get onopen(){return this._onopen}
  set onmessage(fn){this._onmessage=fn} get onmessage(){return this._onmessage}
  set onerror(fn){this._onerror=fn} get onerror(){return this._onerror}
  set onclose(fn){this._onclose=fn} get onclose(){return this._onclose}
}
for(const key of ["CONNECTING","OPEN","CLOSING","CLOSED"]){
  Object.defineProperty(WeaverVisualWebSocket,key,{value:NativeWebSocket[key]});
  Object.defineProperty(WeaverVisualWebSocket.prototype,key,{value:NativeWebSocket[key]});
}

globalThis.WebSocket=WeaverVisualWebSocket;
console.error("[v0.12.1] application artwork layer enabled");
require("./plugin-core");
