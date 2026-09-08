#!/usr/bin/env node
"use strict";

/* PipeWeaver Control for OpenDeck v0.24.0
 * Adds read-only Scene preview, hold-repeat volume buttons, millisecond volume fades, compact action
 * inspectors, resilient application identity, Source Link, Scene Library,
 * capture, startup Scenes and portable Scene files.
 * All audio control goes exclusively through PipeWeaver's HTTP API.
 */

const {installApplicationVisuals}=require("./app-visuals");
const {installSceneFileIO}=require("./scene-file-io");
const {installSceneLibrary}=require("./scene-library");
const {installSceneVisuals}=require("./scene-visuals");

const NativeWebSocket=globalThis.WebSocket;
if(!NativeWebSocket){
  console.error("PipeWeaver Control: Node.js 20+ is required (global WebSocket missing)");
  process.exit(3);
}

// Keep historical diagnostic labels aligned with the package version.
// plugin-core.js contains the complete consolidated runtime.
for(const method of ["log","error","warn"]){
  const original=console[method].bind(console);
  console[method]=(...args)=>original(...args.map(v=>typeof v==="string"?v.replace(/\[v0\.(?:11\.2|12\.2|15\.0|15\.1|16\.0|18\.1|21\.0)\]/g,"[v0.24.0]"):v));
}

const presentationLayer=require("./button-presentation").installButtonPresentation();
const visualLayer=installApplicationVisuals();
const sceneFileLayer=installSceneFileIO();
const sceneLibraryLayer=installSceneLibrary();
const sceneVisualLayer=installSceneVisuals();
const groupLayer=require('./action-groups').createAdapter();
const inspectorLayer=require('./inspector-lifecycle').installInspectorLifecycle();

class WeaverVisualWebSocket {
  constructor(...args){
    this._ws=new NativeWebSocket(...args);
    this._onopen=null;this._onmessage=null;this._onerror=null;this._onclose=null;
    this._ws.onopen=(ev)=>{
      visualLayer.attachSocket(this);
      if(this._onopen)this._onopen(ev);
    };
    this._ws.onmessage=(ev)=>{
      ev=groupLayer.adapt(ev);
      if(inspectorLayer.handleIncoming(this,ev))return;
      presentationLayer.handleIncoming(this,ev);
      try{visualLayer.handleIncoming(this,ev)}catch(e){console.error("[v0.24.0] application visuals inbound error:",e?.stack||e)}
      try{sceneVisualLayer.handleIncoming(this,ev)}catch(e){console.error("[v0.24.0] Scene visuals inbound error:",e?.stack||e)}
      try{if(sceneFileLayer.handleIncoming(this,ev))return}catch(e){console.error("[v0.24.0] Scene file I/O inbound error:",e?.stack||e)}
      try{if(sceneLibraryLayer.handleIncoming(this,ev))return}catch(e){console.error("[v0.24.0] Scene Library inbound error:",e?.stack||e)}
      if(this._onmessage)return this._onmessage(ev);
    };
    this._ws.onerror=(ev)=>{if(this._onerror)this._onerror(ev)};
    this._ws.onclose=(ev)=>{
      inspectorLayer.clear();
      groupLayer.clear();
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
    try{data=sceneVisualLayer.handleOutgoing(this,data)}catch(e){console.error("[v0.24.0] Scene visuals outbound error:",e?.stack||e)}
    return this._ws.send(presentationLayer.handleOutgoing(data))
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
console.error("[v0.24.0] artwork, resilient application identity, cached app discovery, Scene visuals, Scene Library, Source volume-link, Smart Scenes, millisecond fades, and hold-repeat volume controls enabled");
require("./plugin-core");
