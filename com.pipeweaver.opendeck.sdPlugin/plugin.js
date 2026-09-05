#!/usr/bin/env node
"use strict";

/* PipeWeaver Control for OpenDeck v0.11.1
 * IMPORTANT: this plugin talks only to PipeWeaver's HTTP API.
 * It does not call PipeWire, PulseAudio, WirePlumber, pactl, wpctl, etc.
 */
const http = require("http");
const PIPEWEAVER_URL = process.env.PIPEWEAVER_URL || "http://127.0.0.1:14565/api/command";
const STATUS_INTERVAL_MS = 3000;
const PIPEWEAVER_TIMEOUT_MS = 4000;
const DEFAULT_STEP = 5;
const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const ACTIONS = {
  volUp:"com.pipeweaver.opendeck.volumeup", volDown:"com.pipeweaver.opendeck.volumedown", setVol:"com.pipeweaver.opendeck.setvolume",
  targetMute:"com.pipeweaver.opendeck.mute", muteOn:"com.pipeweaver.opendeck.muteon", muteOff:"com.pipeweaver.opendeck.muteoff",
  route:"com.pipeweaver.opendeck.route", routeOn:"com.pipeweaver.opendeck.routeon", routeOff:"com.pipeweaver.opendeck.routeoff",
  appMute:"com.pipeweaver.opendeck.appmute", appVolUp:"com.pipeweaver.opendeck.appvolup", appVolDown:"com.pipeweaver.opendeck.appvoldown", appSetVol:"com.pipeweaver.opendeck.appsetvolume",
  appRouteOn:"com.pipeweaver.opendeck.approuteon", appRouteOff:"com.pipeweaver.opendeck.approuteoff", appRouteToggle:"com.pipeweaver.opendeck.approutetoggle",
  physVolUp:"com.pipeweaver.opendeck.physvolup", physVolDown:"com.pipeweaver.opendeck.physvoldown", physMute:"com.pipeweaver.opendeck.physmute",
  physInVolUp:"com.pipeweaver.opendeck.physinvolup", physInVolDown:"com.pipeweaver.opendeck.physinvoldown", physInMute:"com.pipeweaver.opendeck.physinmute",
  sourceVolUp:"com.pipeweaver.opendeck.sourcevolup", sourceVolDown:"com.pipeweaver.opendeck.sourcevoldown", sourceMute:"com.pipeweaver.opendeck.sourcemute", sourceSetVol:"com.pipeweaver.opendeck.sourcesetvolume",
  sourceAVolUp:"com.pipeweaver.opendeck.sourceavolup", sourceAVolDown:"com.pipeweaver.opendeck.sourceavoldown", sourceBVolUp:"com.pipeweaver.opendeck.sourcebvolup", sourceBVolDown:"com.pipeweaver.opendeck.sourcebvoldown",
  sourceMuteA:"com.pipeweaver.opendeck.sourcemutea", sourceMuteB:"com.pipeweaver.opendeck.sourcemuteb",
  targetMixA:"com.pipeweaver.opendeck.targetmixa", targetMixB:"com.pipeweaver.opendeck.targetmixb", targetMixToggle:"com.pipeweaver.opendeck.targetmixtoggle",
  default:"com.pipeweaver.opendeck.default", status:"com.pipeweaver.opendeck.status", scene:"com.pipeweaver.opendeck.scene"
};
let port=Number(process.argv[process.argv.indexOf("-port")+1]);
let pluginUUID=process.argv[process.argv.indexOf("-pluginUUID")+1];
if(!port||!pluginUUID){console.error("PipeWeaver Control: missing -port or -pluginUUID");process.exit(2);}
let ws=null,lastStatus=null,statusRefreshInFlight=false,statusTimer=null,reconnectTimer=null,reconnectDelay=RECONNECT_INITIAL_MS,socketGeneration=0;
const instances=new Map();
const DIAG_PREFIX="[v0.11.1]";
function diag(label, value){
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    console.error(`${DIAG_PREFIX} ${label}: ${text}`);
  } catch(e) {
    console.error(`${DIAG_PREFIX} ${label}: <unserializable: ${e.message}>`);
  }
}
function diagKeys(value, depth=0){
  if(value===null || value===undefined || depth>4) return value===null ? "null" : typeof value;
  if(Array.isArray(value)) return {arrayLength:value.length, sample:value.length ? diagKeys(value[0], depth+1) : null};
  if(typeof value!=="object") return typeof value;
  const out={};
  for(const k of Object.keys(value)) out[k]=diagKeys(value[k], depth+1);
  return out;
}
function send(m){if(ws&&ws.readyState===1){try{ws.send(JSON.stringify(m));}catch(e){console.error("OpenDeck send failed:",e.message);}}}
function setTitle(c,t){send({event:"setTitle",context:c,payload:{title:String(t)}})}
function setState(c,s){send({event:"setState",context:c,payload:{state:Number(s)}})}
function showAlert(c){send({event:"showAlert",context:c})}
function showOk(c){send({event:"showOk",context:c})}
function pipeCommand(data){return new Promise((resolve,reject)=>{let u;try{u=new URL(PIPEWEAVER_URL)}catch(e){reject(e);return}const body=JSON.stringify(data);const req=http.request({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),Accept:"application/json"},timeout:PIPEWEAVER_TIMEOUT_MS},res=>{let text="";res.setEncoding("utf8");res.on("data",c=>text+=c);res.on("end",()=>{if(res.statusCode<200||res.statusCode>=300){reject(new Error(`PipeWeaver HTTP ${res.statusCode}: ${text.slice(0,300)}`));return}try{resolve(JSON.parse(text))}catch(e){reject(new Error("PipeWeaver returned invalid JSON"))}})});req.on("timeout",()=>{req.destroy(new Error("PipeWeaver request timed out"))});req.on("error",e=>{reject(e)});req.write(body);req.end()})}
async function getStatus(){return pipeCommand("GetStatus")}
function unwrapStatus(r){return r?.Status||r?.data?.Status||null}
function isOk(r){return r==="Ok"||!!(r&&Object.prototype.hasOwnProperty.call(r,"Ok"))||r?.data==="Ok"||r?.Pipewire==="Ok"}
function deviceId(d){return d?.id||d?.description?.id||null}
function deviceName(d){return d?.name||d?.description?.name||""}
function asList(v){if(Array.isArray(v))return v;if(v&&typeof v==="object")return Object.values(v);return []}
function configuredGroups(container){if(!container)return [];return [container.virtual_devices,container.virtualDevices,container.VirtualDevices,container.physical_devices,container.physicalDevices,container.PhysicalDevices].flatMap(asList)}
function deviceCollection(status,type,root){const key=type==="target"?"targets":"sources";return root?.[key]||root?.[key[0].toUpperCase()+key.slice(1)]||root?.[type]||root?.[type[0].toUpperCase()+type.slice(1)]||null}
function namedDevices(status,type){const out=[];const seen=new Set();const profile=status?.audio?.profile?.devices||{};const configured=deviceCollection(status,type,profile);for(const d of configuredGroups(configured)){const n=deviceName(d);if(n&&!seen.has(n)){seen.add(n);out.push(d)}}const devices=status?.audio?.devices||{};const physical=asList(deviceCollection(status,type,devices));for(const d of physical){const n=deviceName(d);if(n&&!seen.has(n)){seen.add(n);out.push(d)}}return out}
function findNamedTarget(s,n){return namedDevices(s,"target").find(d=>deviceName(d)===n)||null}
function findNamedSource(s,n){return namedDevices(s,"source").find(d=>deviceName(d)===n)||null}
function targetVolume(t){return Number.isFinite(t?.volume)?Number(t.volume):null}
function targetMuted(t){const x=t?.mute_state??t?.muted;if(typeof x==="boolean")return x;if(x==="Muted")return true;if(x==="Unmuted")return false;return null}
function targetMix(t){const m=t?.mix;return m==="A"||m==="B"?m:null}
function defaultDeviceId(s,type){const d=s?.audio?.defaults_id||s?.audio?.defaultsId||{};const key=type==="input"?"Source":"Target";return d?.[key]??d?.[key.toLowerCase()]??null}
function physicalDevices(s,type){return (s?.audio?.devices?.[type==="input"?"Source":"Target"]||s?.audio?.devices?.[type==="input"?"source":"target"]||[]).filter(d=>deviceId(d)&&deviceName(d)&&d.is_usable!==false)}
function physicalTargets(s){return physicalDevices(s,"output")}
function physicalDescriptor(d,type){return d?{id:String(deviceId(d)||""),name:String(deviceName(d)||""),deviceType:type}:null}
function scenePhysicalDescriptor(v,type){if(!v||typeof v!=="object")return null;const id=String(v.id||"").trim(),name=String(v.name||"").trim();return (id||name)?{id,name,deviceType:type}:null}
function findScenePhysical(s,type,descriptor){const d=scenePhysicalDescriptor(descriptor,type);if(!d)return null;const list=physicalDevices(s,type);return (d.id&&list.find(x=>String(deviceId(x))===d.id))||(d.name&&list.find(x=>deviceName(x)===d.name))||null}
function scenePhysicalLabel(d){return d?.name||d?.id||"Physical device"}
function applications(s){
  const out=[],seen=new Set();
  const root=s?.audio?.applications;
  const typeEntries=root&&typeof root==='object'?Object.entries(root):[];
  for(const [deviceType,processMap] of typeEntries){
    if(!processMap||typeof processMap!=='object') continue;
    for(const [process,nameMap] of Object.entries(processMap)){
      if(!nameMap||typeof nameMap!=='object') continue;
      for(const [name,list] of Object.entries(nameMap)){
        const rows=Array.isArray(list)?list:[list];
        for(const v of rows){
          if(!v||typeof v!=='object') continue;
          const node=Number.isInteger(v.node_id)?v.node_id:(Number.isInteger(v.nodeId)?v.nodeId:null);
          if(node===null) continue;
          const key=`${deviceType}|${process}|${name}|${node}`;
          if(seen.has(key)) continue;
          seen.add(key);
          out.push({
            deviceType,
            process,
            name,
            nodeId:node,
            volume:Number.isFinite(v.volume)?Number(v.volume):null,
            muted:Boolean(v.muted),
            title:typeof v.title==='string'?v.title:'',
            targetId:typeof v.target_id==='string'?v.target_id:(typeof v.targetId==='string'?v.targetId:null)
          });
        }
      }
    }
  }
  return out.sort((a,b)=>`${a.name} ${a.process} ${a.deviceType}`.localeCompare(`${b.name} ${b.process} ${b.deviceType}`));
}
function names(status,type){return namedDevices(status,type).map(deviceName).filter(Boolean).sort((a,b)=>a.localeCompare(b))}
function appsForPI(s){return applications(s).map(a=>({name:a.name,process:a.process,deviceType:a.deviceType,nodeId:a.nodeId,volume:a.volume,muted:a.muted,title:a.title,targetId:a.targetId}))}
function sourceVolume(src,mix){const v=src?.volumes?.volume?.[mix];return Number.isFinite(v)?Number(v):null}
function sourceMuted(src,mix){const st=src?.mute_states?.mute_state; if(Array.isArray(st)) return st.includes("Target"+mix); if(typeof st==="string") return st.includes("Target"+mix); return false}
function sourceMixValue(src,mix){return sourceVolume(src,mix)}
function findNamedSourceByName(s,n){return findNamedSource(s,n)}
function routeEnabled(s,sourceName,targetName){const src=findNamedSource(s,sourceName),tgt=findNamedTarget(s,targetName),sid=deviceId(src),tid=deviceId(tgt);if(!sid||!tid)return null;const r=s?.audio?.profile?.routes?.[sid];return Array.isArray(r)?r.includes(tid):null}
function appForSettings(s,st){return applications(s).find(x=>x.name===st.name&&(!st.process||x.process===st.process)&&(!st.deviceType||String(x.deviceType).toLowerCase()===String(st.deviceType).toLowerCase()))||null}
function appDestination(s,a,name){if(!a||!name)return null;return String(a.deviceType).toLowerCase()==="target"?findNamedTarget(s,name):findNamedSource(s,name)}
function sceneConfiguredDevices(status,type){
  const profile=status?.audio?.profile?.devices||{};
  const container=deviceCollection(status,type,profile);
  if(!container)return [];
  const raw=configuredGroups(container);
  const out=[],seen=new Set();
  for(const d of raw){const n=deviceName(d),id=deviceId(d);if(n&&id&&!seen.has(id)){seen.add(id);out.push(d)}}
  return out;
}
function sceneData(s){
  const sourceDevices=sceneConfiguredDevices(s,"source"),targetDevices=sceneConfiguredDevices(s,"target");
  const sources=sourceDevices.map(d=>({name:deviceName(d),id:deviceId(d),volumeA:sourceVolume(d,"A"),volumeB:sourceVolume(d,"B"),mutedA:sourceMuted(d,"A"),mutedB:sourceMuted(d,"B")})).filter(x=>x.name&&x.id);
  const targets=targetDevices.map(d=>({name:deviceName(d),id:deviceId(d),volume:targetVolume(d),muted:targetMuted(d),mix:targetMix(d)})).filter(x=>x.name&&x.id);
  const routeMap=s?.audio?.profile?.routes||{};
  const routes=[];
  for(const src of sources){
    const raw=routeMap?.[src.id];
    const ids=Array.isArray(raw)?raw:(raw&&typeof raw==="object"?Object.values(raw):[]);
    for(const tgt of targets) routes.push({source:src.name,target:tgt.name,enabled:ids.includes(tgt.id)});
  }
  const applications=appsForPI(s).map(a=>{
    const compatible=String(a.deviceType).toLowerCase()==="target"?targetDevices:sourceDevices;
    const routed=compatible.find(d=>deviceId(d)===a.targetId);
    return {...a,targetName:routed?deviceName(routed):null};
  });
  const physicalInputs=physicalDevices(s,"input").map(d=>({id:String(deviceId(d)),name:deviceName(d),volume:targetVolume(d),muted:targetMuted(d)}));
  const physicalOutputs=physicalDevices(s,"output").map(d=>({id:String(deviceId(d)),name:deviceName(d),volume:targetVolume(d),muted:targetMuted(d)}));
  const defaults={inputId:defaultDeviceId(s,"input"),outputId:defaultDeviceId(s,"output")};
  return {sources,targets,routes,applications,physicalInputs,physicalOutputs,defaults};
}

function updateInstance(i){
  if(!lastStatus){setState(i.context,1);setTitle(i.context,"PW\nOFF");return}
  const a=i.action,st=i.settings||{};
  const sourceActions=[ACTIONS.sourceVolUp,ACTIONS.sourceVolDown,ACTIONS.sourceSetVol,ACTIONS.sourceAVolUp,ACTIONS.sourceAVolDown,ACTIONS.sourceBVolUp,ACTIONS.sourceBVolDown,ACTIONS.sourceMute,ACTIONS.sourceMuteA,ACTIONS.sourceMuteB];
  if(sourceActions.includes(a)){
    const forcedMix=[ACTIONS.sourceAVolUp,ACTIONS.sourceAVolDown,ACTIONS.sourceMuteA].includes(a)?"A":[ACTIONS.sourceBVolUp,ACTIONS.sourceBVolDown,ACTIONS.sourceMuteB].includes(a)?"B":null;
    const mix=forcedMix||st.mix||"A",n=st.sourceName,d=findNamedSource(lastStatus,n),v=sourceVolume(d,mix),m=sourceMuted(d,mix),isMute=[ACTIONS.sourceMute,ACTIONS.sourceMuteA,ACTIONS.sourceMuteB].includes(a);
    setState(i.context,isMute?(d?(m?1:0):1):(v==null?1:0));
    setTitle(i.context,isMute?`${n||"Source"} ${mix}\n${d==null?"?":m?"MUTED":"LIVE"}`:`${n||"Source"} ${mix}\n${v==null?"?":v+"%"}`);
  } else if([ACTIONS.targetMixA,ACTIONS.targetMixB,ACTIONS.targetMixToggle].includes(a)){
    const n=st.targetName,t=findNamedTarget(lastStatus,n),mix=targetMix(t);setState(i.context,mix===null?0:(mix==="B"?1:0));setTitle(i.context,`${n||"Target"}\n${mix?"MIX "+mix:"?"}`);
  } else if([ACTIONS.volUp,ACTIONS.volDown,ACTIONS.setVol].includes(a)){
    const n=st.targetName,t=findNamedTarget(lastStatus,n),v=targetVolume(t);setState(i.context,v==null?1:0);setTitle(i.context,v==null?(n?`PW\n${n}`:"PW\nSET"):`${n||"Target"}\n${a===ACTIONS.setVol?st.volume+"%":v+"%"}`);
  } else if([ACTIONS.targetMute,ACTIONS.muteOn,ACTIONS.muteOff].includes(a)){
    const n=st.targetName,m=targetMuted(findNamedTarget(lastStatus,n));setState(i.context,m==null?1:(m?1:0));setTitle(i.context,m==null?(n?`${n}\n?`:"PW\nMUTE"):`${n||"Target"}\n${m?"MUTED":"LIVE"}`);
  } else if([ACTIONS.appMute,ACTIONS.appVolUp,ACTIONS.appVolDown,ACTIONS.appSetVol,ACTIONS.appRouteOn,ACTIONS.appRouteOff,ACTIONS.appRouteToggle].includes(a)){
    const x=appForSettings(lastStatus,st);if(!x){setState(i.context,1);setTitle(i.context,st.name?`${st.name}\n?`:"PW\nAPP");return}
    if(a===ACTIONS.appMute){setState(i.context,x.muted?1:0);setTitle(i.context,`${x.name}\n${x.muted?"MUTED":"LIVE"}`)}
    else if([ACTIONS.appVolUp,ACTIONS.appVolDown,ACTIONS.appSetVol].includes(a)){setState(i.context,x.volume!=null?0:1);setTitle(i.context,`${x.name}\n${x.volume==null?"?":x.volume+"%"}`)}
    else {const t=appDestination(lastStatus,x,st.targetName),on=!!(t&&x.targetId&&x.targetId===deviceId(t));setState(i.context,on?1:0);setTitle(i.context,`${x.name}\n${on?"→ "+(st.targetName||"ON"):"ROUTE OFF"}`)}
  } else if([ACTIONS.physVolUp,ACTIONS.physVolDown,ACTIONS.physMute,ACTIONS.physInVolUp,ACTIONS.physInVolDown,ACTIONS.physInMute].includes(a)){
    const isInput=[ACTIONS.physInVolUp,ACTIONS.physInVolDown,ACTIONS.physInMute].includes(a),isMute=[ACTIONS.physMute,ACTIONS.physInMute].includes(a),d=physicalDevices(lastStatus,isInput?"input":"output").find(x=>deviceId(x)===st.deviceId),v=targetVolume(d),m=targetMuted(d);
    setState(i.context,(isMute?m:v)==null?1:(isMute&&m?1:0));setTitle(i.context,isMute?`${deviceName(d)|| (isInput?"Input":"Output")}\n${m==null?"?":m?"MUTED":"LIVE"}`:`${deviceName(d)|| (isInput?"Input":"Output")}\n${v==null?"?":v+"%"}`);
  } else if(a===ACTIONS.default){const type=st.type||"output",active=!!(st.deviceId&&defaultDeviceId(lastStatus,type)===st.deviceId);setState(i.context,active?1:0);setTitle(i.context,`${type==="input"?"IN":"OUT"}\n${st.deviceName||"DEFAULT"}${active?" ✓":""}`)}
  else if(a===ACTIONS.status){setState(i.context,0);setTitle(i.context,"PipeWeaver\nONLINE")}
  else if(a===ACTIONS.scene){setState(i.context,0);setTitle(i.context,st.name||"SCENE")}
  else if([ACTIONS.route,ACTIONS.routeOn,ACTIONS.routeOff].includes(a)){const on=routeEnabled(lastStatus,st.sourceName,st.targetName);setState(i.context,on===null?1:(on?1:0));setTitle(i.context,`${st.sourceName||"SRC"}\n${on===null?"?":on?"→ ON":"→ OFF"}`)}
}
function updateAll(){for(const i of instances.values())updateInstance(i)}
async function refreshStatus(){if(statusRefreshInFlight){return lastStatus}statusRefreshInFlight=true;try{const r=await getStatus();const s=unwrapStatus(r);if(!s)throw new Error("PipeWeaver status response not recognised");lastStatus=s;updateAll();return s}catch(e){console.error("PipeWeaver status refresh failed:",e?.stack||e?.message||e);diag("refreshStatus failure",e?.stack||e?.message||String(e));if(lastStatus!==null){lastStatus=null;updateAll()}return null}finally{statusRefreshInFlight=false;}}
function scheduleStatusRefresh(){if(statusTimer)clearTimeout(statusTimer);statusTimer=setTimeout(async()=>{await refreshStatus();scheduleStatusRefresh()},STATUS_INTERVAL_MS)}
async function sourceVolumeStep(i,delta){const s=await refreshStatus(),n=i.settings.sourceName,mix=i.settings.mix||"A",cur=sourceVolume(findNamedSourceByName(s,n),mix);if(cur==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP;const next=Math.max(0,Math.min(100,cur+delta*step));try{const r=await pipeCommand({Pipewire:{SetSourceVolume:[findNamedSourceByName(s,n)?.description?.id||findNamedSourceByName(s,n)?.id,mix,next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Source volume failed:",e.message);showAlert(i.context)}}
async function toggleSourceMute(i){const s=await refreshStatus(),n=i.settings.sourceName,mix=i.settings.mix||"A",src=findNamedSourceByName(s,n),id=src?.description?.id||src?.id;if(!src||!id){showAlert(i.context);return}const target="Target"+mix,muted=sourceMuted(src,mix);const cmd=muted?{DelSourceMuteTarget:[id,target]}:{AddSourceMuteTarget:[id,target]};try{const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Source mute failed:",e.message);showAlert(i.context)}}
async function setSourceVolume(i,forcedMix=null){const s=await refreshStatus(),n=i.settings.sourceName,mix=forcedMix||i.settings.mix||"A",src=findNamedSource(s,n),id=deviceId(src),v=Math.max(0,Math.min(100,Math.round(Number(i.settings.volume))));if(!src||!id||!Number.isFinite(v)){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetSourceVolume:[id,mix,v]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Set source volume failed:",e.message);showAlert(i.context)}}
async function sourceVolumeStepForced(i,delta,mix){const old=i.settings.mix;i.settings.mix=mix;try{return await sourceVolumeStep(i,delta)}finally{i.settings.mix=old}}
async function toggleSourceMuteForced(i,mix){const old=i.settings.mix;i.settings.mix=mix;try{return await toggleSourceMute(i)}finally{i.settings.mix=old}}
async function setTargetMix(i,mix){const s=await refreshStatus(),n=i.settings.targetName,t=findNamedTarget(s,n),id=t?.description?.id||t?.id;if(!t||!id){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetTargetMix:[id,mix]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Target mix failed:",e.message);showAlert(i.context)}}
async function toggleTargetMix(i){const s=await refreshStatus(),n=i.settings.targetName,t=findNamedTarget(s,n),id=t?.description?.id||t?.id;if(!t||!id||!t.mix){showAlert(i.context);return}return setTargetMix(i,t.mix==="A"?"B":"A")}
async function setTargetVolume(i){const s=await refreshStatus();if(!findNamedTarget(s,i.settings.targetName)){showAlert(i.context);return}const v=Math.max(0,Math.min(100,Math.round(Number(i.settings.volume))));if(!Number.isFinite(v)){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetVolumeByName:[i.settings.targetName,null,v]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Set target volume failed:",e.message);showAlert(i.context)}}
async function volumeStep(i,delta){const s=await refreshStatus(),cur=targetVolume(findNamedTarget(s,i.settings.targetName));if(cur==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP;const next=Math.max(0,Math.min(100,cur+delta*step));try{const r=await pipeCommand({Pipewire:{SetVolumeByName:[i.settings.targetName,null,next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Target volume command failed:",e.message);showAlert(i.context)}}
async function appVolumeStep(i,delta){const s=await refreshStatus(),a=applications(s).find(x=>x.name===i.settings.name&&(!i.settings.process||x.process===i.settings.process));if(!a||a.volume==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP;const next=Math.max(0,Math.min(100,a.volume+delta*step));try{const r=await pipeCommand({Pipewire:{SetApplicationVolume:[a.nodeId,next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Application volume command failed:",e.message);showAlert(i.context)}}
async function setAppVolume(i){const s=await refreshStatus(),a=appForSettings(s,i.settings),v=Math.max(0,Math.min(100,Math.round(Number(i.settings.volume))));if(!a||!Number.isFinite(v)){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetApplicationVolume:[a.nodeId,v]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Set application volume failed:",e.message);showAlert(i.context)}}
async function setAppRoute(i,enabled){const s=await refreshStatus(),a=appForSettings(s,i.settings),t=appDestination(s,a,i.settings.targetName);if(!a||(!t&&enabled)){showAlert(i.context);return}try{const cmd=enabled?{SetTransientApplicationRouteByName:[a.nodeId,i.settings.targetName]}:{ClearTransientApplicationRoute:a.nodeId};const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Application route failed:",e.message);showAlert(i.context)}}
async function toggleAppRoute(i){const s=await refreshStatus(),a=appForSettings(s,i.settings),t=appDestination(s,a,i.settings.targetName);if(!a||!t){showAlert(i.context);return}return setAppRoute(i,!(a.targetId&&a.targetId===deviceId(t)))}
async function setTargetMute(i,state){try{const r=await pipeCommand({Pipewire:{SetTargetMuteStatesByName:[i.settings.targetName,state]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Target mute command failed:",e.message);showAlert(i.context)}}
async function toggleMute(i){const s=await refreshStatus(),m=targetMuted(findNamedTarget(s,i.settings.targetName));if(m==null){showAlert(i.context);return}return setTargetMute(i,m?"Unmuted":"Muted")}
async function setRoute(i,enabled){try{const r=await pipeCommand({Pipewire:{SetRouteByNames:[i.settings.sourceName,i.settings.targetName,enabled]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Route command failed:",e.message);showAlert(i.context)}}
async function toggleRoute(i){try{const r=await pipeCommand({Pipewire:{ToggleRouteByNames:[i.settings.sourceName,i.settings.targetName]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Route toggle failed:",e.message);showAlert(i.context)}}
async function toggleAppMute(i){const s=await refreshStatus(),a=applications(s).find(x=>x.name===i.settings.name&&(!i.settings.process||x.process===i.settings.process));if(!a){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetApplicationMute:[a.nodeId,!a.muted]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Application mute failed:",e.message);showAlert(i.context)}}
async function physicalVolume(i,delta){const s=await refreshStatus(),d=physicalTargets(s).find(x=>deviceId(x)===i.settings.deviceId),cur=targetVolume(d);if(!d||cur==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP,next=Math.max(0,Math.min(100,cur+delta*step));try{const r=await pipeCommand({Pipewire:{SetPhysicalDeviceVolume:[deviceId(d),next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Physical volume command failed:",e.message);showAlert(i.context)}}
async function physicalMute(i){const s=await refreshStatus(),d=physicalTargets(s).find(x=>deviceId(x)===i.settings.deviceId),m=targetMuted(d);if(m==null){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetPhysicalDeviceMute:[deviceId(d),!m]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Physical mute command failed:",e.message);showAlert(i.context)}}
async function physicalVolumeTyped(i,delta,type){const s=await refreshStatus(),d=physicalDevices(s,type).find(x=>deviceId(x)===i.settings.deviceId),cur=targetVolume(d);if(!d||cur==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP,next=Math.max(0,Math.min(100,cur+delta*step));try{const r=await pipeCommand({Pipewire:{SetPhysicalDeviceVolume:[deviceId(d),next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Physical volume command failed:",e.message);showAlert(i.context)}}
async function physicalMuteTyped(i,type){const s=await refreshStatus(),d=physicalDevices(s,type).find(x=>deviceId(x)===i.settings.deviceId),m=targetMuted(d);if(m==null){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetPhysicalDeviceMute:[deviceId(d),!m]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Physical mute failed:",e.message);showAlert(i.context)}}
async function setDefault(i){const s=await refreshStatus(),d=physicalDevices(s,i.settings.type||"output").find(x=>deviceId(x)===i.settings.deviceId);if(!d){showAlert(i.context);return}try{const cmd=i.settings.type==="input"?{SetDefaultInput:deviceId(d)}:{SetDefaultOutput:deviceId(d)};const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Default device command failed:",e.message);showAlert(i.context)}}
function sceneNames(v){return Array.isArray(v)?v.map(x=>String(x||"").trim()).filter(Boolean):[]}
function sceneVolume(v){const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null}
function sceneAppDescriptor(v){
  if(!v||typeof v!=="object")return null;
  const name=String(v.name||"").trim(),process=String(v.process||"").trim(),deviceType=String(v.deviceType||"").trim();
  return name?{name,process,deviceType}:null;
}
function sceneApps(v){return Array.isArray(v)?v.map(sceneAppDescriptor).filter(Boolean):[]}
function sceneAppMatches(a,d){return !!(a&&d&&a.name===d.name&&(!d.process||a.process===d.process)&&(!d.deviceType||String(a.deviceType).toLowerCase()===String(d.deviceType).toLowerCase()))}
function sceneAppLabel(d){return `${d?.name||"Application"}${d?.process?` (${d.process})`:""}${d?.deviceType?` [${d.deviceType}]`:""}`}
function validateSceneOperations(ops,status){
  const errors=[],warnings=[];
  const add=(kind,idx,type,message)=>kind.push({step:idx+1,type:type||"unknown",message});
  if(!Array.isArray(ops)||!ops.length){errors.push({step:0,type:"scene",message:"Scene has no structured operations"});return {ok:false,errors,warnings}}
  for(let idx=0;idx<ops.length;idx++){
    const op=ops[idx],type=String(op?.type||"");
    if(!op||typeof op!=="object"){add(errors,idx,type,"Invalid scene operation");continue}
    const sources=sceneNames(op.sources),targets=sceneNames(op.targets),vol=()=>{const n=Number(op.volume);return String(op.volume??"").trim()!==""&&Number.isFinite(n)&&n>=0&&n<=100};
    if(["sourceMute","sourceVolume"].includes(type)){
      if(!sources.length)add(errors,idx,type,"No sources selected");
      for(const name of sources)if(!findNamedSource(status,name))add(errors,idx,type,`Source not found: ${name}`);
      if(type==="sourceVolume"&&!vol())add(errors,idx,type,"Volume must be a number from 0 to 100");
    }else if(["targetMute","targetVolume","targetMix"].includes(type)){
      if(!targets.length)add(errors,idx,type,"No targets selected");
      for(const name of targets)if(!findNamedTarget(status,name))add(errors,idx,type,`Target not found: ${name}`);
      if(type==="targetVolume"&&!vol())add(errors,idx,type,"Volume must be a number from 0 to 100");
    }else if(type==="route"){
      if(!sources.length)add(errors,idx,type,"No sources selected");if(!targets.length)add(errors,idx,type,"No targets selected");
      for(const name of sources)if(!findNamedSource(status,name))add(errors,idx,type,`Source not found: ${name}`);
      for(const name of targets)if(!findNamedTarget(status,name))add(errors,idx,type,`Target not found: ${name}`);
    }else if(["physicalInputMute","physicalInputVolume","physicalOutputMute","physicalOutputVolume"].includes(type)){
      const dt=type.startsWith("physicalInput")?"input":"output";
      if(!scenePhysicalDescriptor(op.device,dt))add(errors,idx,type,`No physical ${dt} selected`);
      else if(!findScenePhysical(status,dt,op.device))add(errors,idx,type,`Physical ${dt} not available: ${scenePhysicalLabel(op.device)}`);
      if(type.endsWith("Volume")&&!vol())add(errors,idx,type,"Volume must be a number from 0 to 100");
    }else if(type==="defaultDevice"){
      const dt=op.deviceType==="input"?"input":"output";
      if(!scenePhysicalDescriptor(op.device,dt))add(errors,idx,type,`No default ${dt} device selected`);
      else if(!findScenePhysical(status,dt,op.device))add(errors,idx,type,`Default ${dt} device not available: ${scenePhysicalLabel(op.device)}`);
    }else if(["applicationMute","applicationVolume","applicationRoute"].includes(type)){
      const ds=sceneApps(op.applications);
      if(!ds.length)add(errors,idx,type,"No applications selected");
      if(type==="applicationVolume"&&!vol())add(errors,idx,type,"Volume must be a number from 0 to 100");
      for(const d of ds){
        const live=applications(status).filter(a=>sceneAppMatches(a,d));
        if(!live.length)add(warnings,idx,type,`Application not running; step will be skipped: ${sceneAppLabel(d)}`);
        if(type==="applicationRoute"&&op.state!=="off"){
          const targetName=String(op.targetName||"").trim();
          if(!targetName)add(errors,idx,type,`No route destination selected for ${sceneAppLabel(d)}`);
          else {
            const dtype=String(d.deviceType||live[0]?.deviceType||"").toLowerCase();
            const dest=dtype==="target"?findNamedTarget(status,targetName):dtype==="source"?findNamedSource(status,targetName):(live[0]?appDestination(status,live[0],targetName):null);
            if(!dest)add(errors,idx,type,`Compatible route destination not found for ${sceneAppLabel(d)}: ${targetName}`);
          }
        }
      }
    }else add(errors,idx,type,`Unsupported scene operation: ${type||"(missing type)"}`);
  }
  return {ok:errors.length===0,errors,warnings};
}
async function executeSceneOperation(op,status){
  if(!op||typeof op!=="object")throw new Error("Invalid scene operation");
  const type=String(op.type||"");
  if(type==="sourceMute"){
    const mix=op.mix==="B"?"B":"A",target="Target"+mix,state=op.state==="unmuted"?"unmuted":"muted";
    for(const name of sceneNames(op.sources)){
      const src=findNamedSource(status,name),id=deviceId(src);if(!id)throw new Error(`Scene source not found: ${name}`);
      const currentlyMuted=sourceMuted(src,mix);
      if((state==="muted"&&currentlyMuted)||(state==="unmuted"&&!currentlyMuted))continue;
      const cmd=state==="muted"?{AddSourceMuteTarget:[id,target]}:{DelSourceMuteTarget:[id,target]};
      const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(`${name}: ${JSON.stringify(r)}`);
    }
    return;
  }
  if(type==="targetMute"){
    const state=op.state==="unmuted"?"Unmuted":"Muted";
    for(const name of sceneNames(op.targets)){if(!findNamedTarget(status,name))throw new Error(`Scene target not found: ${name}`);const r=await pipeCommand({Pipewire:{SetTargetMuteStatesByName:[name,state]}});if(!isOk(r))throw new Error(`${name}: ${JSON.stringify(r)}`)}
    return;
  }
  if(type==="sourceVolume"){
    const mix=op.mix==="B"?"B":"A",v=sceneVolume(op.volume);if(v===null)throw new Error("Invalid source volume");
    for(const name of sceneNames(op.sources)){const src=findNamedSource(status,name),id=deviceId(src);if(!id)throw new Error(`Scene source not found: ${name}`);const r=await pipeCommand({Pipewire:{SetSourceVolume:[id,mix,v]}});if(!isOk(r))throw new Error(`${name}: ${JSON.stringify(r)}`)}
    return;
  }
  if(type==="targetVolume"){
    const v=sceneVolume(op.volume);if(v===null)throw new Error("Invalid target volume");
    for(const name of sceneNames(op.targets)){if(!findNamedTarget(status,name))throw new Error(`Scene target not found: ${name}`);const r=await pipeCommand({Pipewire:{SetVolumeByName:[name,null,v]}});if(!isOk(r))throw new Error(`${name}: ${JSON.stringify(r)}`)}
    return;
  }
  if(type==="targetMix"){
    const mix=op.mix==="B"?"B":"A";
    for(const name of sceneNames(op.targets)){
      const t=findNamedTarget(status,name),id=deviceId(t);if(!id)throw new Error(`Scene target not found: ${name}`);
      if(targetMix(t)===mix)continue;
      const r=await pipeCommand({Pipewire:{SetTargetMix:[id,mix]}});
      if(!isOk(r)){
        const text=JSON.stringify(r);
        if(!text.includes("Nothing to Do, Mixes Match"))throw new Error(`${name}: ${text}`);
      }
    }
    return;
  }
  if(type==="route"){
    const sources=sceneNames(op.sources),targets=sceneNames(op.targets),enabled=op.state!=="off";
    for(const source of sources){if(!findNamedSource(status,source))throw new Error(`Scene source not found: ${source}`);for(const target of targets){if(!findNamedTarget(status,target))throw new Error(`Scene target not found: ${target}`);const r=await pipeCommand({Pipewire:{SetRouteByNames:[source,target,enabled]}});if(!isOk(r))throw new Error(`${source} → ${target}: ${JSON.stringify(r)}`)}}
    return;
  }
  if(type==="physicalInputMute"||type==="physicalOutputMute"){
    const deviceType=type==="physicalInputMute"?"input":"output",muted=op.state!=="unmuted",d=findScenePhysical(status,deviceType,op.device);
    if(!d)throw new Error(`Scene physical ${deviceType} not found: ${scenePhysicalLabel(op.device)}`);
    if(targetMuted(d)===muted)return;
    const r=await pipeCommand({Pipewire:{SetPhysicalDeviceMute:[deviceId(d),muted]}});if(!isOk(r))throw new Error(`${scenePhysicalLabel(op.device)}: ${JSON.stringify(r)}`);
    return;
  }
  if(type==="physicalInputVolume"||type==="physicalOutputVolume"){
    const deviceType=type==="physicalInputVolume"?"input":"output",v=sceneVolume(op.volume),d=findScenePhysical(status,deviceType,op.device);
    if(v===null)throw new Error("Invalid physical device volume");
    if(!d)throw new Error(`Scene physical ${deviceType} not found: ${scenePhysicalLabel(op.device)}`);
    if(targetVolume(d)===v)return;
    const r=await pipeCommand({Pipewire:{SetPhysicalDeviceVolume:[deviceId(d),v]}});if(!isOk(r))throw new Error(`${scenePhysicalLabel(op.device)}: ${JSON.stringify(r)}`);
    return;
  }
  if(type==="defaultDevice"){
    const deviceType=op.deviceType==="input"?"input":"output",d=findScenePhysical(status,deviceType,op.device);
    if(!d)throw new Error(`Scene default ${deviceType} not found: ${scenePhysicalLabel(op.device)}`);
    if(String(defaultDeviceId(status,deviceType)||"")===String(deviceId(d)))return;
    const cmd=deviceType==="input"?{SetDefaultInput:deviceId(d)}:{SetDefaultOutput:deviceId(d)};
    const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(`${scenePhysicalLabel(op.device)}: ${JSON.stringify(r)}`);
    return;
  }
  if(type==="applicationMute"){
    const muted=op.state!=="unmuted",descriptors=sceneApps(op.applications);
    if(!descriptors.length)throw new Error("No applications selected");
    for(const d of descriptors){
      const matches=applications(status).filter(a=>sceneAppMatches(a,d));
      if(!matches.length){console.log(`[Scene] application not running; skipped ${sceneAppLabel(d)}`);continue;}
      for(const a of matches){if(a.muted===muted)continue;const r=await pipeCommand({Pipewire:{SetApplicationMute:[a.nodeId,muted]}});if(!isOk(r))throw new Error(`${sceneAppLabel(d)}: ${JSON.stringify(r)}`)}
    }
    return;
  }
  if(type==="applicationVolume"){
    const v=sceneVolume(op.volume),descriptors=sceneApps(op.applications);if(v===null)throw new Error("Invalid application volume");
    if(!descriptors.length)throw new Error("No applications selected");
    for(const d of descriptors){
      const matches=applications(status).filter(a=>sceneAppMatches(a,d));
      if(!matches.length){console.log(`[Scene] application not running; skipped ${sceneAppLabel(d)}`);continue;}
      for(const a of matches){const r=await pipeCommand({Pipewire:{SetApplicationVolume:[a.nodeId,v]}});if(!isOk(r))throw new Error(`${sceneAppLabel(d)}: ${JSON.stringify(r)}`)}
    }
    return;
  }
  if(type==="applicationRoute"){
    const descriptors=sceneApps(op.applications),enabled=op.state!=="off",targetName=String(op.targetName||"").trim();
    if(!descriptors.length)throw new Error("No applications selected");
    for(const d of descriptors){
      const matches=applications(status).filter(a=>sceneAppMatches(a,d));
      if(!matches.length){console.log(`[Scene] application not running; skipped ${sceneAppLabel(d)}`);continue;}
      for(const a of matches){
        if(enabled){const destination=appDestination(status,a,targetName);if(!destination)throw new Error(`Compatible application route target not found for ${sceneAppLabel(d)}: ${targetName||"(none)"}`);const r=await pipeCommand({Pipewire:{SetTransientApplicationRouteByName:[a.nodeId,targetName]}});if(!isOk(r))throw new Error(`${sceneAppLabel(d)} → ${targetName}: ${JSON.stringify(r)}`)}
        else {const r=await pipeCommand({Pipewire:{ClearTransientApplicationRoute:a.nodeId}});if(!isOk(r))throw new Error(`${sceneAppLabel(d)} → Default: ${JSON.stringify(r)}`)}
      }
    }
    return;
  }
  throw new Error(`Unsupported scene operation: ${type||"(missing type)"}`);
}
function sceneOperationDescription(op){
  const type=String(op?.type||"unknown");
  const sources=sceneNames(op?.sources);
  const targets=sceneNames(op?.targets);
  const list=a=>a.length?a.join(", "):"(none)";
  if(type==="sourceMute")return `Source ${op?.mix==="B"?"B":"A"} ${op?.state==="unmuted"?"unmute":"mute"}: ${list(sources)}`;
  if(type==="targetMute")return `Target ${op?.state==="unmuted"?"unmute":"mute"}: ${list(targets)}`;
  if(type==="sourceVolume")return `Source ${op?.mix==="B"?"B":"A"} volume ${sceneVolume(op?.volume)}%: ${list(sources)}`;
  if(type==="targetVolume")return `Target volume ${sceneVolume(op?.volume)}%: ${list(targets)}`;
  if(type==="targetMix")return `Target mix ${op?.mix==="B"?"B":"A"}: ${list(targets)}`;
  if(type==="route")return `Route ${op?.state==="off"?"off":"on"}: ${list(sources)} -> ${list(targets)}`;
  if(type==="physicalInputMute")return `Physical input ${op?.state==="unmuted"?"unmute":"mute"}: ${scenePhysicalLabel(op?.device)}`;
  if(type==="physicalOutputMute")return `Physical output ${op?.state==="unmuted"?"unmute":"mute"}: ${scenePhysicalLabel(op?.device)}`;
  if(type==="physicalInputVolume")return `Physical input volume ${sceneVolume(op?.volume)}%: ${scenePhysicalLabel(op?.device)}`;
  if(type==="physicalOutputVolume")return `Physical output volume ${sceneVolume(op?.volume)}%: ${scenePhysicalLabel(op?.device)}`;
  if(type==="defaultDevice")return `Default ${op?.deviceType==="input"?"input":"output"}: ${scenePhysicalLabel(op?.device)}`;
  if(type==="applicationMute")return `Application ${op?.state==="unmuted"?"unmute":"mute"}: ${sceneApps(op?.applications).map(sceneAppLabel).join(", ")||"(none)"}`;
  if(type==="applicationVolume")return `Application volume ${sceneVolume(op?.volume)}%: ${sceneApps(op?.applications).map(sceneAppLabel).join(", ")||"(none)"}`;
  if(type==="applicationRoute")return `Application route ${op?.state==="off"?"Default":`→ ${op?.targetName||"(none)"}`}: ${sceneApps(op?.applications).map(sceneAppLabel).join(", ")||"(none)"}`;
  return `Unsupported operation: ${type}`;
}
async function runScene(i){
  const sceneName=String(i.settings.name||"Scene");
  const ops=Array.isArray(i.settings.operations)?i.settings.operations:[];
  if(ops.length){
    const started=Date.now();
    let activeStep=0;
    console.log(`[Scene] START name=${JSON.stringify(sceneName)} operations=${ops.length} context=${i.context}`);
    try{
      let status=await refreshStatus();
      if(!status)throw new Error("PipeWeaver status unavailable");
      console.log(`[Scene] VALIDATION START name=${JSON.stringify(sceneName)} operations=${ops.length}`);
      const validation=validateSceneOperations(ops,status);
      for(const v of validation.errors)console.error(`[Scene] VALIDATION ERROR step=${v.step} type=${v.type} reason=${JSON.stringify(v.message)}`);
      for(const v of validation.warnings)console.warn(`[Scene] VALIDATION WARNING step=${v.step} type=${v.type} reason=${JSON.stringify(v.message)}`);
      if(!validation.ok){console.error(`[Scene] VALIDATION FAILED errors=${validation.errors.length} warnings=${validation.warnings.length}`);throw new Error(`Scene validation failed with ${validation.errors.length} error(s)`)}
      console.log(`[Scene] VALIDATION OK errors=0 warnings=${validation.warnings.length}`);
      for(let idx=0;idx<ops.length;idx++){
        activeStep=idx+1;
        const desc=sceneOperationDescription(ops[idx]);
        console.log(`[Scene] STEP ${activeStep}/${ops.length} START ${desc}`);
        const stepStarted=Date.now();
        try{
          await executeSceneOperation(ops[idx],status);
          console.log(`[Scene] STEP ${activeStep}/${ops.length} OK ${desc} (${Date.now()-stepStarted}ms)`);
        }catch(e){
          console.error(`[Scene] STEP ${activeStep}/${ops.length} FAILED ${desc}: ${e.message}`);
          throw e;
        }
        status=await refreshStatus()||status;
      }
      await refreshStatus();
      console.log(`[Scene] COMPLETE name=${JSON.stringify(sceneName)} operations=${ops.length} duration=${Date.now()-started}ms`);
      showOk(i.context);
    }catch(e){
      console.error(`[Scene] FAILED name=${JSON.stringify(sceneName)} step=${activeStep||"startup"}/${ops.length} duration=${Date.now()-started}ms: ${e.message}`);
      showAlert(i.context);
    }
    return;
  }
  let cmds;
  try{cmds=JSON.parse(i.settings.commands||"[]")}catch(e){console.error(`[Scene] LEGACY INVALID name=${JSON.stringify(sceneName)}: ${e.message}`);showAlert(i.context);return}
  if(!Array.isArray(cmds)||!cmds.length){console.warn(`[Scene] EMPTY name=${JSON.stringify(sceneName)} context=${i.context}`);showAlert(i.context);return}
  const started=Date.now();
  console.log(`[Scene] LEGACY START name=${JSON.stringify(sceneName)} commands=${cmds.length} context=${i.context}`);
  try{
    for(let idx=0;idx<cmds.length;idx++){
      const cmd=cmds[idx];
      if(!cmd||typeof cmd!=="object"||Array.isArray(cmd))throw new Error(`Command ${idx+1}: each legacy scene item must be a PipeWeaver API command object`);
      console.log(`[Scene] LEGACY STEP ${idx+1}/${cmds.length} START command=${Object.keys(cmd).join(",")||"(empty)"}`);
      const r=await pipeCommand({Pipewire:cmd});
      if(!isOk(r))throw new Error(`Command ${idx+1}: ${JSON.stringify(r)}`);
      console.log(`[Scene] LEGACY STEP ${idx+1}/${cmds.length} OK`);
    }
    await refreshStatus();
    console.log(`[Scene] LEGACY COMPLETE name=${JSON.stringify(sceneName)} commands=${cmds.length} duration=${Date.now()-started}ms`);
    showOk(i.context);
  }catch(e){console.error(`[Scene] LEGACY FAILED name=${JSON.stringify(sceneName)} duration=${Date.now()-started}ms: ${e.message}`);showAlert(i.context)}
}
async function handleMessage(m) {
  const e = m.event;
  if(e==="sendToPlugin" || e==="willAppear" || e==="didReceiveSettings") diag("OpenDeck event",m);
  if (e === "willAppear") {
    instances.set(m.context, { context:m.context, action:m.action, settings:{...(m.payload?.settings||{})} });
    updateInstance(instances.get(m.context));
    return;
  }
  if (e === "willDisappear") { instances.delete(m.context); return; }
  if (e === "didReceiveSettings") {
    const i=instances.get(m.context);
    if(i){i.settings={...(m.payload?.settings||{})};updateInstance(i);}
    return;
  }
  if (e === "keyDown") {
    const i=instances.get(m.context); if(!i) return;
    switch(i.action){
      case ACTIONS.sourceVolUp: return sourceVolumeStep(i,1);
      case ACTIONS.sourceVolDown: return sourceVolumeStep(i,-1);
      case ACTIONS.sourceMute: return toggleSourceMute(i);
      case ACTIONS.sourceSetVol: return setSourceVolume(i);
      case ACTIONS.sourceAVolUp: return sourceVolumeStepForced(i,1,"A");
      case ACTIONS.sourceAVolDown: return sourceVolumeStepForced(i,-1,"A");
      case ACTIONS.sourceBVolUp: return sourceVolumeStepForced(i,1,"B");
      case ACTIONS.sourceBVolDown: return sourceVolumeStepForced(i,-1,"B");
      case ACTIONS.sourceMuteA: return toggleSourceMuteForced(i,"A");
      case ACTIONS.sourceMuteB: return toggleSourceMuteForced(i,"B");
      case ACTIONS.targetMixA: return setTargetMix(i,"A");
      case ACTIONS.targetMixB: return setTargetMix(i,"B");
      case ACTIONS.targetMixToggle: return toggleTargetMix(i);
      case ACTIONS.volUp: return volumeStep(i,1);
      case ACTIONS.volDown: return volumeStep(i,-1);
      case ACTIONS.setVol: return setTargetVolume(i);
      case ACTIONS.appVolUp: return appVolumeStep(i,1);
      case ACTIONS.appVolDown: return appVolumeStep(i,-1);
      case ACTIONS.appSetVol: return setAppVolume(i);
      case ACTIONS.appRouteOn: return setAppRoute(i,true);
      case ACTIONS.appRouteOff: return setAppRoute(i,false);
      case ACTIONS.appRouteToggle: return toggleAppRoute(i);
      case ACTIONS.targetMute: return toggleMute(i);
      case ACTIONS.muteOn: return setTargetMute(i,"Muted");
      case ACTIONS.muteOff: return setTargetMute(i,"Unmuted");
      case ACTIONS.route: return toggleRoute(i);
      case ACTIONS.routeOn: return setRoute(i,true);
      case ACTIONS.routeOff: return setRoute(i,false);
      case ACTIONS.appMute: return toggleAppMute(i);
      case ACTIONS.physVolUp: return physicalVolume(i,1);
      case ACTIONS.physVolDown: return physicalVolume(i,-1);
      case ACTIONS.physMute: return physicalMute(i);
      case ACTIONS.physInVolUp: return physicalVolumeTyped(i,1,"input");
      case ACTIONS.physInVolDown: return physicalVolumeTyped(i,-1,"input");
      case ACTIONS.physInMute: return physicalMuteTyped(i,"input");
      case ACTIONS.default: return setDefault(i);
      case ACTIONS.status: {
        const st=await refreshStatus();
        if(st){setState(i.context,0);setTitle(i.context,"PipeWeaver\nONLINE");}
        else {setState(i.context,1);setTitle(i.context,"PipeWeaver\nOFF");}
        return;
      }
      case ACTIONS.scene: return runScene(i);
    }
    return;
  }
  if (e === "sendToPlugin") {
    const p=typeof m.payload==="string"?{command:m.payload}:(m.payload||{});
    diag("sendToPlugin command",p);
    const i=instances.get(m.context);
    diag("sendToPlugin instance found",String(!!i));
    if(!i) return;
    let s=lastStatus;
    if(["getSceneData","getTargets","getApplications","getDevices","validateScene"].includes(p.command)) s=await refreshStatus();
    if(p.command==="getTargets"){
      const payload={
        command:"targets",
        targets:names(s,"target"),
        sources:names(s,"source"),
        sceneTargets:sceneConfiguredDevices(s,"target").map(deviceName).filter(Boolean).sort((a,b)=>a.localeCompare(b)),
        sceneSources:sceneConfiguredDevices(s,"source").map(deviceName).filter(Boolean).sort((a,b)=>a.localeCompare(b)),
        physicalInputs:physicalDevices(s,"input").map(d=>({id:String(deviceId(d)),name:deviceName(d),volume:targetVolume(d),muted:targetMuted(d)})),
        physicalOutputs:physicalDevices(s,"output").map(d=>({id:String(deviceId(d)),name:deviceName(d),volume:targetVolume(d),muted:targetMuted(d)})),
        applications:appsForPI(s)
      };
      diag("getTargets reply",payload);
      send({event:"sendToPropertyInspector",context:m.context,payload});
    }
    else if(p.command==="getApplications"){
      const payload={command:"applications",applications:appsForPI(s)};
      diag("getApplications reply",payload);
      send({event:"sendToPropertyInspector",context:m.context,payload});
    }
    else if(p.command==="getDevices"){
      const payload={command:"devices",outputs:physicalDevices(s,"output").map(d=>({id:deviceId(d),name:deviceName(d),volume:d.volume,muted:targetMuted(d)})),inputs:physicalDevices(s,"input").map(d=>({id:deviceId(d),name:deviceName(d),volume:d.volume,muted:targetMuted(d)}))};
      diag("getDevices reply",payload);
      send({event:"sendToPropertyInspector",context:m.context,payload});
    }
    else if(p.command==="validateScene"){
      const ops=Array.isArray(p.operations)?p.operations:(Array.isArray(i.settings.operations)?i.settings.operations:[]);
      const result=validateSceneOperations(ops,s);
      diag("validateScene reply",{ok:result.ok,errors:result.errors.length,warnings:result.warnings.length});
      send({event:"sendToPropertyInspector",context:m.context,payload:{command:"sceneValidation",...result}});
    }
    else if(p.command==="getSceneData"){
      const snapshot=sceneData(s);
      const payload={command:"sceneData",...snapshot};
      diag("getSceneData reply",{sources:snapshot.sources.length,targets:snapshot.targets.length,routes:snapshot.routes.length,physicalInputs:snapshot.physicalInputs.length,physicalOutputs:snapshot.physicalOutputs.length,applications:snapshot.applications.length});
      send({event:"sendToPropertyInspector",context:m.context,payload});
    }
  }
}

function scheduleReconnect(g){if(g!==socketGeneration||reconnectTimer)return;const d=reconnectDelay;console.error(`PipeWeaver Control: reconnecting to OpenDeck in ${d}ms`);reconnectTimer=setTimeout(()=>{reconnectTimer=null;reconnectDelay=Math.min(reconnectDelay*2,RECONNECT_MAX_MS);connect()},d)}
function connect(){const WebSocket=globalThis.WebSocket;if(!WebSocket){console.error("PipeWeaver Control: Node.js 20+ is required (global WebSocket missing)");process.exit(3)}if(ws&&(ws.readyState===0||ws.readyState===1))return;const g=++socketGeneration,socket=new WebSocket(`ws://127.0.0.1:${port}`);ws=socket;socket.onopen=()=>{if(g!==socketGeneration)return;reconnectDelay=RECONNECT_INITIAL_MS;console.error(`PipeWeaver Control: connected to OpenDeck on ${port}`);send({event:"registerPlugin",uuid:pluginUUID});void refreshStatus();scheduleStatusRefresh()};socket.onmessage=async ev=>{if(g!==socketGeneration)return;try{await handleMessage(JSON.parse(typeof ev.data==="string"?ev.data:ev.data.toString()))}catch(e){console.error("OpenDeck message error:",e?.stack||e)}};socket.onerror=e=>{if(g===socketGeneration)console.error("OpenDeck websocket error:",e?.message||e)};socket.onclose=()=>{if(g!==socketGeneration)return;if(ws===socket)ws=null;console.error("PipeWeaver Control: OpenDeck connection closed");scheduleReconnect(g)}}
diag("startup",{port,pluginUUID,pipeweaverUrl:PIPEWEAVER_URL});
process.on("uncaughtException",e=>console.error("PipeWeaver Control: uncaught exception:",e?.stack||e));process.on("unhandledRejection",e=>console.error("PipeWeaver Control: unhandled rejection:",e));connect();scheduleStatusRefresh();
