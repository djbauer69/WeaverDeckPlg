#!/usr/bin/env node
"use strict";

/* PipeWeaver Control for OpenDeck v0.11.2
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
  sourceLinkToggle:"com.pipeweaver.opendeck.sourcelinktoggle",
  targetMixA:"com.pipeweaver.opendeck.targetmixa", targetMixB:"com.pipeweaver.opendeck.targetmixb", targetMixToggle:"com.pipeweaver.opendeck.targetmixtoggle",
  default:"com.pipeweaver.opendeck.default", status:"com.pipeweaver.opendeck.status", scene:"com.pipeweaver.opendeck.scene"
};
let port=Number(process.argv[process.argv.indexOf("-port")+1]);
let pluginUUID=process.argv[process.argv.indexOf("-pluginUUID")+1];
if(!port||!pluginUUID){console.error("PipeWeaver Control: missing -port or -pluginUUID");process.exit(2);}
let ws=null,lastStatus=null,lastStatusAt=0,statusRefreshInFlight=false,statusTimer=null,reconnectTimer=null,reconnectDelay=RECONNECT_INITIAL_MS,socketGeneration=0;
const APPLICATION_CACHE_MAX_AGE_MS=3500;
const instances=new Map();
const DIAG_PREFIX="[v0.11.2]";
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
function send(m){if(m.context==="weaverdeck-startup")return;if(ws&&ws.readyState===1){try{ws.send(JSON.stringify(m));}catch(e){console.error("OpenDeck send failed:",e.message);}}}
function setTitle(c,t){send({event:"setTitle",context:c,payload:{title:String(t)}})}
function setState(c,s){const i=instances.get(c);if(i)i.visualState=Number(s);send({event:"setState",context:c,payload:{state:Number(s)}})}
function showAlert(c){send({event:"showAlert",context:c})}
function showOk(c){send({event:"showOk",context:c})}
function pipeCommand(data){const key=volumeResource021(data,lastStatus);if(key)return Promise.resolve(fades021.cancel(key)).then(()=>pipeCommand021(data));return pipeCommand021(data)}
function pipeCommand021(data){return new Promise((resolve,reject)=>{let u;try{u=new URL(PIPEWEAVER_URL)}catch(e){reject(e);return}const body=JSON.stringify(data);const req=http.request({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),Accept:"application/json"},timeout:PIPEWEAVER_TIMEOUT_MS},res=>{let text="";res.setEncoding("utf8");res.on("data",c=>text+=c);res.on("end",()=>{if(res.statusCode<200||res.statusCode>=300){reject(new Error(`PipeWeaver HTTP ${res.statusCode}: ${text.slice(0,300)}`));return}try{resolve(JSON.parse(text))}catch(e){reject(new Error("PipeWeaver returned invalid JSON"))}})});req.on("timeout",()=>{req.destroy(new Error("PipeWeaver request timed out"))});req.on("error",e=>{reject(e)});req.write(body);req.end()})}
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
function sourceLinked(src){if(!src||!src.volumes||!("volumes_linked" in src.volumes))return null;return src.volumes.volumes_linked!==null&&src.volumes.volumes_linked!==undefined}
function sourceMuted(src,mix){const st=src?.mute_states?.mute_state; if(Array.isArray(st)) return st.includes("Target"+mix); if(typeof st==="string") return st.includes("Target"+mix); return false}
function sourceMixValue(src,mix){return sourceVolume(src,mix)}
function findNamedSourceByName(s,n){return findNamedSource(s,n)}
function routeEnabled(s,sourceName,targetName){const src=findNamedSource(s,sourceName),tgt=findNamedTarget(s,targetName),sid=deviceId(src),tid=deviceId(tgt);if(!sid||!tid)return null;const r=s?.audio?.profile?.routes?.[sid];return Array.isArray(r)?r.includes(tid):null}
function appIdentityNameKey(v){return String(v??"").trim().toLowerCase()}
function appIdentityProcessKey(v){let s=String(v??"").trim().replace(/\s+\(deleted\)$/i,"").replace(/\\/g,"/");if(s.includes("/"))s=s.split("/").pop();return s.toLowerCase()}
function appIdentityTypeKey(v){return String(v??"").trim().toLowerCase()}
function appIdentityScore(a,d){if(!a||!d)return -1;const dt=appIdentityTypeKey(d.deviceType),at=appIdentityTypeKey(a.deviceType);if(dt&&at&&dt!==at)return -1;const an=appIdentityNameKey(a.name),dn=appIdentityNameKey(d.name),ap=appIdentityProcessKey(a.process),dp=appIdentityProcessKey(d.process),nameEq=!!(an&&dn&&an===dn),procEq=!!(ap&&dp&&ap===dp);if(nameEq&&procEq)return 100;if(procEq)return 80;if(nameEq)return 60;return -1}
function appIdentityKey(a){return `${appIdentityTypeKey(a?.deviceType)}|${appIdentityProcessKey(a?.process)}|${appIdentityNameKey(a?.name)}`}
function appResolveMany(list,d){const rows=(Array.isArray(list)?list:[]).map(a=>({a,score:appIdentityScore(a,d)})).filter(x=>x.score>=0);if(!rows.length)return [];const best=Math.max(...rows.map(x=>x.score)),top=rows.filter(x=>x.score===best),groups=new Map();for(const row of top){const k=appIdentityKey(row.a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row.a)}return groups.size===1?[...groups.values()][0]:[]}
function appForSettings(s,st){return appResolveMany(applications(s),st)[0]||null}
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
  const sources=sourceDevices.map(d=>({name:deviceName(d),id:deviceId(d),volumeA:sourceVolume(d,"A"),volumeB:sourceVolume(d,"B"),mutedA:sourceMuted(d,"A"),mutedB:sourceMuted(d,"B"),linked:sourceLinked(d)})).filter(x=>x.name&&x.id);
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

const features018=require("./features-v018").create({pipeCommand,unwrapStatus,isOk,configured:sceneConfiguredDevices,deviceId,deviceName});
async function featureButton018(i){
  const op=features018.buttonOperation(i);
  if(!op)return;
  setTitle(i.context,"Working…");
  try{console.log("[v0.18.1] ACTION START "+features018.describe(op));await features018.execute(op);await refreshStatus();showOk(i.context);console.log("[v0.18.1] ACTION OK "+features018.describe(op))}
  catch(e){console.error("[v0.18.1] ACTION FAILED "+features018.describe(op)+": "+e.message);showAlert(i.context);updateInstance(i)}
}
const STARTUP_ACTION="com.pipeweaver.opendeck.scenestartup";
const startup019=require("./startup-scene").create({status:refreshStatus,runScene,validate:validateSceneOperations,log:m=>console.log("[Startup Scene] "+m),changed:()=>updateAll()});
async function startupMessage019(m){
 const p=m.payload||{};
 try{
  let result;
  if(p.command==="getStartupScene")result=startup019.snapshot();
  else if(p.command==="saveStartupScene")result=startup019.save(p.settings||{});
  else if(p.command==="checkStartupScene")result=await startup019.check(p.filePath);
  else return false;
  send({event:"sendToPropertyInspector",context:m.context,payload:{command:"startupSceneResult",request:p.command,ok:true,result}});
 }catch(e){send({event:"sendToPropertyInspector",context:m.context,payload:{command:"startupSceneResult",request:p.command,ok:false,error:e.message}})}
 return true;
}
const volumeArt0191=require('./volume-visuals').artwork;
const dialKind020=require('./dial-controls').kind;
function describeDial020(i,status){
 const k=dialKind020(i),st=i.settings||{};let d,name,volume=null,muted=null,volumeCommand,muteCommand;
 if(k==='application'){
  d=appForSettings(status,st);name=d?.name||st.name||'Application';volume=d?.volume;muted=d?.muted;
  if(d){volumeCommand=v=>({SetApplicationVolume:[d.nodeId,v]});muteCommand=m=>({SetApplicationMute:[d.nodeId,m]})}
 }else if(k==='source'){
  const mix=st.mix==='B'?'B':'A';d=findNamedSource(status,st.sourceName);name=(st.sourceName||'Source')+' '+mix;volume=sourceVolume(d,mix);muted=d?sourceMuted(d,mix):null;
  if(deviceId(d)){volumeCommand=v=>({SetSourceVolume:[deviceId(d),mix,v]});muteCommand=m=>m?{AddSourceMuteTarget:[deviceId(d),'Target'+mix]}:{DelSourceMuteTarget:[deviceId(d),'Target'+mix]}}
 }else if(k==='target'){
  d=findNamedTarget(status,st.targetName);name=st.targetName||'Target';volume=targetVolume(d);muted=targetMuted(d);
  if(d){volumeCommand=v=>({SetVolumeByName:[st.targetName,null,v]});muteCommand=m=>({SetTargetMuteStatesByName:[st.targetName,m?'Muted':'Unmuted']})}
 }else{
  d=physicalDevices(status,k).find(x=>deviceId(x)===st.deviceId);name=deviceName(d)||st.deviceName||('Physical '+k);volume=targetVolume(d);muted=targetMuted(d);
  if(d){volumeCommand=v=>({SetPhysicalDeviceVolume:[deviceId(d),v]});muteCommand=m=>({SetPhysicalDeviceMute:[deviceId(d),m]})}
 }
 return {name,volume,muted,volumeCommand,muteCommand};
}
const dials020=require('./dial-controls').create({describe:describeDial020,refresh:refreshStatus,command:pipeCommand,ok:isOk,send,current:i=>instances.get(i.context)===i.original&&JSON.stringify(i.original.settings)===JSON.stringify(i.settings),log:m=>console.log('[Dial] '+m)});
const fadeTypes021={appvolumefade:'application',sourcevolumefade:'source',targetvolumefade:'target',physinvolumefade:'input',physvolumefade:'output'};
function fadeButton021(i){const kind=fadeTypes021[i.action.split('.').pop()];return kind?{...i.settings,type:'volumeFade',kind}:null}
function volumeResource021(data,status){
 const p=data?.Pipewire;if(!p)return null;
 if(p.SetApplicationVolume)return 'app:'+p.SetApplicationVolume[0];
 if(p.SetSourceVolume)return 'device:'+p.SetSourceVolume[0];
 if(p.SetPhysicalDeviceVolume)return 'device:'+p.SetPhysicalDeviceVolume[0];
 if(p.SetVolumeByName){const id=deviceId(findNamedTarget(status,p.SetVolumeByName[0]));return id?'device:'+id:null}
 return null;
}
function resolveFade021(op,status){
 const prefix={application:'app',source:'source',target:'target',input:'physin',output:'phys'}[op.kind];
 const physical=['input','output'].includes(op.kind)?findScenePhysical(status,op.kind,op.device):null;
 const settings={...op,...op.application,deviceId:deviceId(physical),deviceName:deviceName(physical)};
 const d=describeDial020({action:'com.pipeweaver.opendeck.'+prefix+'volumedial',settings},status);
 return {...d,key:d.volumeCommand?volumeResource021({Pipewire:d.volumeCommand(0)},status):null};
}
const fadeDurationMs022=require('./volume-fades').durationMs;
function fadeDurationLabel022(op){const ms=fadeDurationMs022(op);return Number.isFinite(ms)?Math.round(ms)+'ms':'?ms'}
const fades021=require('./volume-fades').create({resolve:resolveFade021,refresh:refreshStatus,command:pipeCommand021,ok:isOk,log:m=>console.log('[Fade] '+m)});
async function runFadeButton021(i,op){
 const run=Symbol();i.fadeRun=run;setTitle(i.context,'Fading…');
 try{await fades021.run(op);if(i.fadeRun===run)showOk(i.context)}
 catch(e){console.error('[Fade] Button: '+e.message);if(i.fadeRun===run)showAlert(i.context)}
 finally{if(i.fadeRun===run){delete i.fadeRun;updateInstance(i)}}
}
const physicalArt023=require('./physical-artwork');
const legacyActions023=new Map(require('./action-catalog.json').legacy.map(a=>[a.UUID,a]));
function updateInstance(i){
 if(i.groupInvalid){setTitle(i.context,'Select action');setState(i.context,1);return}
 updateInstance023Base(i);
 if(!i.weaverGroup||i.controller==='Encoder')return;
 const a=i.action.split('.').pop(),st=i.settings||{};
 let image;
 const physical=i.weaverGroup==='com.pipeweaver.opendeck.physicalinput'?'input':i.weaverGroup==='com.pipeweaver.opendeck.physicaloutput'?'output':null;
 if(physical&&physicalArt023.valid(st.deviceIcon,physical)){
  const d=physicalDevices(lastStatus,physical).find(d=>deviceId(d)===st.deviceId);
  image=physicalArt023.artwork(st.deviceIcon,{volume:targetVolume(d),muted:targetMuted(d),mute:a.endsWith('mute')});
 }else if(!a.startsWith('app')&&!a.endsWith('volumefade')&&!holdSpec022(i)&&!a.includes('setvolume')){
  const template=legacyActions023.get(i.action);image=template?.States?.[i.visualState]?.Image||template?.States?.[0]?.Image;
  if(image)image+='\.svg';
 }
 if(image&&i.groupImage!==image){i.groupImage=image;send({event:'setImage',context:i.context,payload:{image}})}
}
function updateInstance023Base(i){
 const fade=fadeButton021(i);
 if(fade){const d=resolveFade021(fade,lastStatus);setTitle(i.context,(d.name||'Fade')+'\n'+(i.fadeRun?'Fading…':String(fade.volume??0)+'% / '+fadeDurationLabel022(fade)));setState(i.context,Number.isFinite(d.volume)?0:1);const image=physicalArt023.valid(i.settings?.deviceIcon,fade.kind)?physicalArt023.artwork(i.settings.deviceIcon,{volume:d.volume}):volumeArt0191(d.volume);if(i.fadeImage!==image){i.fadeImage=image;send({event:'setImage',context:i.context,payload:{image}})}return;}
 if(dials020.render(i,lastStatus))return;
  updateInstance0191(i);
  const a=i.action.split('.').pop(),st=i.settings||{};
  let volume=null,owned=true;
  if(['sourcevoldown','sourcevolup','sourcesetvolume','sourceavoldown','sourceavolup','sourcebvoldown','sourcebvolup'].includes(a)){
    const mix=a.startsWith('sourcea')?'A':a.startsWith('sourceb')?'B':st.mix||'A';
    volume=sourceVolume(findNamedSource(lastStatus,st.sourceName),mix);
  }else if(['volumedown','volumeup','setvolume'].includes(a)){
    volume=targetVolume(findNamedTarget(lastStatus,st.targetName));
  }else if(['physvoldown','physvolup','physinvoldown','physinvolup'].includes(a)){
    volume=targetVolume(physicalDevices(lastStatus,a.startsWith('physin')?'input':'output').find(d=>deviceId(d)===st.deviceId));
  }else owned=false;
  if(owned){
    const physicalKind=a.startsWith('physin')?'input':a.startsWith('phys')?'output':null;
    const image=physicalKind&&physicalArt023.valid(st.deviceIcon,physicalKind)?physicalArt023.artwork(st.deviceIcon,{volume}):volumeArt0191(volume,a.endsWith('down'));
    if(i.volumeImage0191!==image){i.volumeImage0191=image;send({event:'setImage',context:i.context,payload:{image}})}
  }
}
function updateInstance0191(i){
 if(i.action===STARTUP_ACTION){const s=startup019.snapshot();setState(i.context,s.phase==="Failed"?1:0);setTitle(i.context,"Startup Scene\n"+s.phase);return}
  const op018=features018.buttonOperation(i);
  if(op018){const v=features018.visual(op018,lastStatus);setState(i.context,v.state);setTitle(i.context,v.title);return}
  if(!lastStatus){setState(i.context,1);setTitle(i.context,"PW\nOFF");return}
  const a=i.action,st=i.settings||{};
  const sourceActions=[ACTIONS.sourceVolUp,ACTIONS.sourceVolDown,ACTIONS.sourceSetVol,ACTIONS.sourceAVolUp,ACTIONS.sourceAVolDown,ACTIONS.sourceBVolUp,ACTIONS.sourceBVolDown,ACTIONS.sourceMute,ACTIONS.sourceMuteA,ACTIONS.sourceMuteB];
  if(a===ACTIONS.sourceLinkToggle){
    const n=st.sourceName,d=findNamedSource(lastStatus,n),linked=sourceLinked(d);
    setState(i.context,linked===true?1:0);
    setTitle(i.context,`${n||"Source"}\n${linked===null?"?":linked?"LINKED":"UNLINKED"}`);
  } else if(sourceActions.includes(a)){
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
let statusPromise018=null;
function refreshStatus(){if(statusPromise018)return statusPromise018;statusPromise018=refreshStatus018().finally(()=>{statusPromise018=null});return statusPromise018}
async function refreshStatus018(){statusRefreshInFlight=true;try{const r=await getStatus();const s=unwrapStatus(r);if(!s)throw new Error("PipeWeaver status response not recognised");lastStatus=s;lastStatusAt=Date.now();updateAll();return s}catch(e){console.error("PipeWeaver status refresh failed:",e?.stack||e?.message||e);diag("refreshStatus failure",e?.stack||e?.message||String(e));if(lastStatus!==null){lastStatus=null;updateAll()}return null}finally{statusRefreshInFlight=false;}}
function scheduleStatusRefresh(){if(statusTimer)clearTimeout(statusTimer);statusTimer=setTimeout(async()=>{await refreshStatus();scheduleStatusRefresh()},STATUS_INTERVAL_MS)}
async function sourceVolumeStep(i,delta){const s=await refreshStatus(),n=i.settings.sourceName,mix=i.settings.mix||"A",cur=sourceVolume(findNamedSourceByName(s,n),mix);if(cur==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP;const next=Math.max(0,Math.min(100,cur+delta*step));try{const r=await pipeCommand({Pipewire:{SetSourceVolume:[findNamedSourceByName(s,n)?.description?.id||findNamedSourceByName(s,n)?.id,mix,next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Source volume failed:",e.message);showAlert(i.context)}}
async function toggleSourceMute(i){const s=await refreshStatus(),n=i.settings.sourceName,mix=i.settings.mix||"A",src=findNamedSourceByName(s,n),id=src?.description?.id||src?.id;if(!src||!id){showAlert(i.context);return}const target="Target"+mix,muted=sourceMuted(src,mix);const cmd=muted?{DelSourceMuteTarget:[id,target]}:{AddSourceMuteTarget:[id,target]};try{const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Source mute failed:",e.message);showAlert(i.context)}}
async function toggleSourceVolumeLink(i){const s=await refreshStatus(),n=i.settings.sourceName,src=findNamedSourceByName(s,n),id=deviceId(src),linked=sourceLinked(src);if(!src||!id||linked===null){showAlert(i.context);return}const next=!linked;try{const r=await pipeCommand({Pipewire:{SetSourceVolumeLinked:[id,next]}});if(!isOk(r)&&!JSON.stringify(r).includes("Requested State matches current state"))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Source volume link toggle failed:",e.message);showAlert(i.context)}}
async function setSourceVolume(i,forcedMix=null){const s=await refreshStatus(),n=i.settings.sourceName,mix=forcedMix||i.settings.mix||"A",src=findNamedSource(s,n),id=deviceId(src),v=Math.max(0,Math.min(100,Math.round(Number(i.settings.volume))));if(!src||!id||!Number.isFinite(v)){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetSourceVolume:[id,mix,v]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Set source volume failed:",e.message);showAlert(i.context)}}
async function sourceVolumeStepForced(i,delta,mix){const old=i.settings.mix;i.settings.mix=mix;try{return await sourceVolumeStep(i,delta)}finally{i.settings.mix=old}}
async function toggleSourceMuteForced(i,mix){const old=i.settings.mix;i.settings.mix=mix;try{return await toggleSourceMute(i)}finally{i.settings.mix=old}}
async function setTargetMix(i,mix){const s=await refreshStatus(),n=i.settings.targetName,t=findNamedTarget(s,n),id=t?.description?.id||t?.id;if(!t||!id){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetTargetMix:[id,mix]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Target mix failed:",e.message);showAlert(i.context)}}
async function toggleTargetMix(i){const s=await refreshStatus(),n=i.settings.targetName,t=findNamedTarget(s,n),id=t?.description?.id||t?.id;if(!t||!id||!t.mix){showAlert(i.context);return}return setTargetMix(i,t.mix==="A"?"B":"A")}
async function setTargetVolume(i){const s=await refreshStatus();if(!findNamedTarget(s,i.settings.targetName)){showAlert(i.context);return}const v=Math.max(0,Math.min(100,Math.round(Number(i.settings.volume))));if(!Number.isFinite(v)){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetVolumeByName:[i.settings.targetName,null,v]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Set target volume failed:",e.message);showAlert(i.context)}}
async function volumeStep(i,delta){const s=await refreshStatus(),cur=targetVolume(findNamedTarget(s,i.settings.targetName));if(cur==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP;const next=Math.max(0,Math.min(100,cur+delta*step));try{const r=await pipeCommand({Pipewire:{SetVolumeByName:[i.settings.targetName,null,next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Target volume command failed:",e.message);showAlert(i.context)}}
async function appVolumeStep(i,delta){const s=await refreshStatus(),a=appForSettings(s,i.settings);if(!a||a.volume==null){showAlert(i.context);return}const raw=Number(i.settings.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP;const next=Math.max(0,Math.min(100,a.volume+delta*step));try{const r=await pipeCommand({Pipewire:{SetApplicationVolume:[a.nodeId,next]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Application volume command failed:",e.message);showAlert(i.context)}}
async function setAppVolume(i){const s=await refreshStatus(),a=appForSettings(s,i.settings),v=Math.max(0,Math.min(100,Math.round(Number(i.settings.volume))));if(!a||!Number.isFinite(v)){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetApplicationVolume:[a.nodeId,v]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Set application volume failed:",e.message);showAlert(i.context)}}
async function setAppRoute(i,enabled){const s=await refreshStatus(),a=appForSettings(s,i.settings),t=appDestination(s,a,i.settings.targetName);if(!a||(!t&&enabled)){showAlert(i.context);return}try{const cmd=enabled?{SetTransientApplicationRouteByName:[a.nodeId,i.settings.targetName]}:{ClearTransientApplicationRoute:a.nodeId};const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Application route failed:",e.message);showAlert(i.context)}}
async function toggleAppRoute(i){const s=await refreshStatus(),a=appForSettings(s,i.settings),t=appDestination(s,a,i.settings.targetName);if(!a||!t){showAlert(i.context);return}return setAppRoute(i,!(a.targetId&&a.targetId===deviceId(t)))}
async function setTargetMute(i,state){try{const r=await pipeCommand({Pipewire:{SetTargetMuteStatesByName:[i.settings.targetName,state]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Target mute command failed:",e.message);showAlert(i.context)}}
async function toggleMute(i){const s=await refreshStatus(),m=targetMuted(findNamedTarget(s,i.settings.targetName));if(m==null){showAlert(i.context);return}return setTargetMute(i,m?"Unmuted":"Muted")}
async function setRoute(i,enabled){try{const r=await pipeCommand({Pipewire:{SetRouteByNames:[i.settings.sourceName,i.settings.targetName,enabled]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Route command failed:",e.message);showAlert(i.context)}}
async function toggleRoute(i){try{const r=await pipeCommand({Pipewire:{ToggleRouteByNames:[i.settings.sourceName,i.settings.targetName]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Route toggle failed:",e.message);showAlert(i.context)}}
async function toggleAppMute(i){const s=await refreshStatus(),a=appForSettings(s,i.settings);if(!a){showAlert(i.context);return}try{const r=await pipeCommand({Pipewire:{SetApplicationMute:[a.nodeId,!a.muted]}});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error("Application mute failed:",e.message);showAlert(i.context)}}
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
function sceneAppProcessKey(v){return appIdentityProcessKey(v)}
function sceneAppMatches(a,d){return appIdentityScore(a,d)>=0}
function sceneAppLabel(d){return `${d?.name||"Application"}${d?.process?` (${d.process})`:""}${d?.deviceType?` [${d.deviceType}]`:""}`}
function sceneConditionSpec(op){
  const raw=op?.condition;
  if(raw===undefined||raw===null)return {type:"always",application:null};
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {type:"invalid",application:null};
  const type=String(raw.type||"always");
  return {type,application:sceneAppDescriptor(raw.application)};
}
function sceneFailurePolicy(op){return op?.onFailure==="continue"?"continue":"stop"}
function sceneWaitMs(op){const n=Number(op?.milliseconds);return Number.isFinite(n)?Math.round(n):null}
function sceneConditionEvaluation(op,status){
  const c=sceneConditionSpec(op);
  if(c.type==="always")return {met:true,label:"Always"};
  const label=sceneAppLabel(c.application);
  const running=!!(c.application&&appResolveMany(applications(status),c.application).length>0);
  if(c.type==="applicationRunning")return {met:running,label:`Application running: ${label}`};
  if(c.type==="applicationNotRunning")return {met:!running,label:`Application not running: ${label}`};
  return {met:false,label:"Invalid condition"};
}
function sceneSmartDescription(op){
  const base=sceneOperationDescription(op),c=sceneConditionSpec(op),failure=sceneFailurePolicy(op);
  let prefix="";
  if(c.type==="applicationRunning")prefix=`If ${sceneAppLabel(c.application)} is running: `;
  else if(c.type==="applicationNotRunning")prefix=`If ${sceneAppLabel(c.application)} is not running: `;
  return prefix+base+(failure==="continue"?" [continue on failure]":"");
}
function validateSceneOperations(ops,status){
  const errors=[],warnings=[];
  const add=(kind,idx,type,message)=>kind.push({step:idx+1,type:type||"unknown",message});
  if(!Array.isArray(ops)||!ops.length){errors.push({step:0,type:"scene",message:"Scene has no structured operations"});return {ok:false,errors,warnings}}
  for(let idx=0;idx<ops.length;idx++){
    const op=ops[idx],type=String(op?.type||"");
    if(!op||typeof op!=="object"){add(errors,idx,type,"Invalid scene operation");continue}
    const sources=sceneNames(op.sources),targets=sceneNames(op.targets),vol=()=>{const n=Number(op.volume);return String(op.volume??"").trim()!==""&&Number.isFinite(n)&&n>=0&&n<=100};
    const condition=sceneConditionSpec(op);
    if(!["always","applicationRunning","applicationNotRunning"].includes(condition.type))add(errors,idx,type,"Condition must be Always, Application running, or Application not running");
    if(["applicationRunning","applicationNotRunning"].includes(condition.type)&&!condition.application)add(errors,idx,type,"Application condition requires an application descriptor");
    if(op.onFailure!==undefined&&!['stop','continue'].includes(op.onFailure))add(errors,idx,type,"Failure policy must be stop or continue");
    if(type==='volumeFade'){
      for(const message of require('./volume-fades').validate(op))add(errors,idx,type,message);
    }else if(features018.supports(op)){
      for(const message of features018.validate(op,status))add(errors,idx,type,message);
    }else if(type==="wait"){
      const ms=sceneWaitMs(op);
      if(ms===null||ms<0||ms>60000)add(errors,idx,type,"Wait must be between 0 and 60000 milliseconds");
    }else if(["sourceMute","sourceVolume","sourceVolumeLink"].includes(type)){
      if(!sources.length)add(errors,idx,type,"No sources selected");
      for(const name of sources)if(!findNamedSource(status,name))add(errors,idx,type,`Source not found: ${name}`);
      if(type==="sourceVolume"&&!vol())add(errors,idx,type,"Volume must be a number from 0 to 100");
      if(type==="sourceVolumeLink"&&!['linked','unlinked'].includes(op.state))add(errors,idx,type,"Link state must be linked or unlinked");
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
        const live=appResolveMany(applications(status),d);
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
  if(type==='volumeFade')return fades021.run(op);
  if(features018.supports(op))return features018.execute(op);
  if(type==="wait"){
    const ms=sceneWaitMs(op);if(ms===null||ms<0||ms>60000)throw new Error("Invalid Scene wait");
    if(ms>0)await new Promise(resolve=>setTimeout(resolve,ms));
    return;
  }
  if(type==="sourceVolumeLink"){
    const linked=op.state!=="unlinked";
    for(const name of sceneNames(op.sources)){
      const src=findNamedSource(status,name),id=deviceId(src);if(!id)throw new Error(`Scene source not found: ${name}`);
      const current=sourceLinked(src);if(current===null)throw new Error(`Scene source link state unavailable: ${name}`);
      if(current===linked)continue;
      const r=await pipeCommand({Pipewire:{SetSourceVolumeLinked:[id,linked]}});
      if(!isOk(r)&&!JSON.stringify(r).includes("Requested State matches current state"))throw new Error(`${name}: ${JSON.stringify(r)}`);
    }
    return;
  }
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
    for(const source of sources){if(!findNamedSource(status,source))throw new Error(`Scene source not found: ${source}`);for(const target of targets){if(!findNamedTarget(status,target))throw new Error(`Scene target not found: ${target}`);const current=routeEnabled(status,source,target);if(current===enabled)continue;const r=await pipeCommand({Pipewire:{SetRouteByNames:[source,target,enabled]}});if(!isOk(r)){const text=JSON.stringify(r);if(!text.includes("Requested route change already set"))throw new Error(`${source} → ${target}: ${text}`)}}}
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
      const matches=appResolveMany(applications(status),d);
      if(!matches.length){console.log(`[Scene] application not running; skipped ${sceneAppLabel(d)}`);continue;}
      for(const a of matches){if(a.muted===muted)continue;const r=await pipeCommand({Pipewire:{SetApplicationMute:[a.nodeId,muted]}});if(!isOk(r))throw new Error(`${sceneAppLabel(d)}: ${JSON.stringify(r)}`)}
    }
    return;
  }
  if(type==="applicationVolume"){
    const v=sceneVolume(op.volume),descriptors=sceneApps(op.applications);if(v===null)throw new Error("Invalid application volume");
    if(!descriptors.length)throw new Error("No applications selected");
    for(const d of descriptors){
      const matches=appResolveMany(applications(status),d);
      if(!matches.length){console.log(`[Scene] application not running; skipped ${sceneAppLabel(d)}`);continue;}
      for(const a of matches){const r=await pipeCommand({Pipewire:{SetApplicationVolume:[a.nodeId,v]}});if(!isOk(r))throw new Error(`${sceneAppLabel(d)}: ${JSON.stringify(r)}`)}
    }
    return;
  }
  if(type==="applicationRoute"){
    const descriptors=sceneApps(op.applications),enabled=op.state!=="off",targetName=String(op.targetName||"").trim();
    if(!descriptors.length)throw new Error("No applications selected");
    for(const d of descriptors){
      const matches=appResolveMany(applications(status),d);
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
  if(op.type==='volumeFade')return 'Volume Fade '+op.kind+' to '+op.volume+'% over '+fadeDurationLabel022(op);
  if(features018.supports(op))return features018.describe(op);
  const type=String(op?.type||"unknown");
  const sources=sceneNames(op?.sources);
  const targets=sceneNames(op?.targets);
  const list=a=>a.length?a.join(", "):"(none)";
  if(type==="wait")return `Wait ${sceneWaitMs(op)} ms`;
  if(type==="sourceMute")return `Source ${op?.mix==="B"?"B":"A"} ${op?.state==="unmuted"?"unmute":"mute"}: ${list(sources)}`;
  if(type==="sourceVolumeLink")return `Source volume ${op?.state==="unlinked"?"unlink":"link"}: ${list(sources)}`;
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
    let activeStep=0,continuedFailures=0,succeeded019=false;
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
        const op=ops[idx],desc=sceneSmartDescription(op),condition=sceneConditionEvaluation(op,status);
        if(!condition.met){
          console.log(`[Scene] STEP ${activeStep}/${ops.length} SKIP condition not met (${condition.label}): ${desc}`);
          status=await refreshStatus()||status;
          continue;
        }
        console.log(`[Scene] STEP ${activeStep}/${ops.length} START ${desc}`);
        const stepStarted=Date.now();
        try{
          await executeSceneOperation(op,status);
          console.log(`[Scene] STEP ${activeStep}/${ops.length} OK ${desc} (${Date.now()-stepStarted}ms)`);
        }catch(e){
          const policy=sceneFailurePolicy(op);
          console.error(`[Scene] STEP ${activeStep}/${ops.length} FAILED ${desc}: ${e.message}`);
          if(policy==="continue"){continuedFailures++;console.warn(`[Scene] STEP ${activeStep}/${ops.length} CONTINUE after failure`)}
          else throw e;
        }
        status=await refreshStatus()||status;
      }
      await refreshStatus();
      if(continuedFailures){
        console.warn(`[Scene] COMPLETE WITH ERRORS name=${JSON.stringify(sceneName)} operations=${ops.length} continuedFailures=${continuedFailures} duration=${Date.now()-started}ms`);
        showAlert(i.context);
      }else{
        console.log(`[Scene] COMPLETE name=${JSON.stringify(sceneName)} operations=${ops.length} duration=${Date.now()-started}ms`);
        showOk(i.context);succeeded019=true;
      }
    }catch(e){
      console.error(`[Scene] FAILED name=${JSON.stringify(sceneName)} step=${activeStep||"startup"}/${ops.length} duration=${Date.now()-started}ms: ${e.message}`);
      showAlert(i.context);
    }
    return succeeded019;
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
const holdTimers022=new Map();
function holdMs022(i){const n=Number(i.settings?.holdMs);return Number.isFinite(n)&&n>=50&&n<=2000?Math.round(n):200}
function holdSpec022(i){
 const st=i.settings||{},a=i.action;
 if(a===ACTIONS.sourceVolUp)return {delta:1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:st};
 if(a===ACTIONS.sourceVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:st};
 if(a===ACTIONS.sourceAVolUp)return {delta:1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'A'}};
 if(a===ACTIONS.sourceAVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'A'}};
 if(a===ACTIONS.sourceBVolUp)return {delta:1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'B'}};
 if(a===ACTIONS.sourceBVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'B'}};
 if(a===ACTIONS.volUp)return {delta:1,action:'com.pipeweaver.opendeck.targetvolumedial',settings:st};
 if(a===ACTIONS.volDown)return {delta:-1,action:'com.pipeweaver.opendeck.targetvolumedial',settings:st};
 if(a===ACTIONS.appVolUp)return {delta:1,action:'com.pipeweaver.opendeck.appvolumedial',settings:st};
 if(a===ACTIONS.appVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.appvolumedial',settings:st};
 if(a===ACTIONS.physVolUp)return {delta:1,action:'com.pipeweaver.opendeck.physvolumedial',settings:st};
 if(a===ACTIONS.physVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.physvolumedial',settings:st};
 if(a===ACTIONS.physInVolUp)return {delta:1,action:'com.pipeweaver.opendeck.physinvolumedial',settings:st};
 if(a===ACTIONS.physInVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.physinvolumedial',settings:st};
 return null;
}
async function holdStep022(i){
 const spec=holdSpec022(i);if(!spec)return false;
 try{
 const status=await refreshStatus(),d=describeDial020({action:spec.action,settings:spec.settings},status);
 if(!d.volumeCommand||!Number.isFinite(d.volume)){showAlert(i.context);return false}
 const raw=Number(i.settings?.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP,next=Math.max(0,Math.min(100,d.volume+spec.delta*step));
 if(next===d.volume){showOk(i.context);return false}
 const r=await pipeCommand({Pipewire:d.volumeCommand(next)});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context);return true}
 catch(e){console.error('[Hold] Volume command failed:',e.message);showAlert(i.context);return false}
}
function holdStop022(context){const job=holdTimers022.get(context);if(!job)return;job.active=false;clearTimeout(job.timer);holdTimers022.delete(context)}
function holdClear022(){for(const context of [...holdTimers022.keys()])holdStop022(context)}
function holdStart022(i,repeat=true){
 if(!holdSpec022(i))return false;
 holdStop022(i.context);
 const job={active:true,timer:null,busy:false};holdTimers022.set(i.context,job);
 const tick=async()=>{if(!job.active||job.busy)return;job.busy=true;const ok=await holdStep022(i);job.busy=false;if(!job.active)return;if(ok&&repeat)job.timer=setTimeout(tick,holdMs022(i));else holdStop022(i.context)};
 tick();return true;
}
async function handleMessage(m) {
  const e = m.event;
  if(e==='willDisappear'||e==='didReceiveSettings'){dials020.cancel(m.context);holdStop022(m.context)}
  if(e==='keyUp'){holdStop022(m.context);return;}
  if(['dialRotate','dialDown','dialUp','touchTap'].includes(e)){
    dials020.handle(m,instances.get(m.context));return;
  }
  if(e==="sendToPlugin"&&m.action===STARTUP_ACTION&&await startupMessage019(m))return;
  if(e==="sendToPlugin" || e==="willAppear" || e==="didReceiveSettings") diag("OpenDeck event",m);
  if (e === "willAppear") {
    instances.set(m.context, { context:m.context, action:m.action, weaverGroup:m.weaverGroup, controller:m.weaverController||m.payload?.controller, groupInvalid:m.weaverGroupInvalid, settings:{...(m.payload?.settings||{})} });
    updateInstance(instances.get(m.context));
    return;
  }
  if (e === "willDisappear") { instances.delete(m.context); return; }
  if (e === "didReceiveSettings") {
    const i=instances.get(m.context);
    if(i){
      if(m.weaverGroup){
        // Detach the old run's completion feedback before changing operation.
        if(i.fadeRun){const op=fadeButton021(i),d=op&&resolveFade021(op,lastStatus);if(d?.key)void fades021.cancel(d.key);delete i.fadeRun}
        i.action=m.action;i.weaverGroup=m.weaverGroup;i.controller=m.weaverController;i.groupInvalid=m.weaverGroupInvalid;
        delete i.volumeImage0191;delete i.fadeImage;delete i.groupImage;delete i.dialFeedback;
        send({event:'setImage',context:i.context,payload:{image:null}});
      }
      i.settings={...(m.payload?.settings||{})};updateInstance(i);
    }
    return;
  }
  if (e === "keyDown") {
    const i=instances.get(m.context); if(!i) return;
    if(i.groupInvalid||(i.weaverGroup&&m.payload?.isInMultiAction&&fadeButton021(i))){showAlert(i.context);return;}
    if(features018.buttonOperation(i))return featureButton018(i);
    if(i.action===STARTUP_ACTION){try{await startup019.runNow(i.context);showOk(i.context)}catch(e){console.error("[Startup Scene] Manual run failed: "+e.message);showAlert(i.context)}return}
    if(holdStart022(i,!m.payload?.isInMultiAction))return;
    const fade=fadeButton021(i);if(fade)return runFadeButton021(i,fade);
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
      case ACTIONS.sourceLinkToggle: return toggleSourceVolumeLink(i);
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
    if(["getSceneData","getTargets","getDevices","validateScene"].includes(p.command)) s=await refreshStatus();
    else if(p.command==="getApplications"&&(!s||Date.now()-lastStatusAt>APPLICATION_CACHE_MAX_AGE_MS)) s=await refreshStatus();
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
function connect(){const WebSocket=globalThis.WebSocket;if(!WebSocket){console.error("PipeWeaver Control: Node.js 20+ is required (global WebSocket missing)");process.exit(3)}if(ws&&(ws.readyState===0||ws.readyState===1))return;const g=++socketGeneration,socket=new WebSocket(`ws://127.0.0.1:${port}`);ws=socket;socket.onopen=()=>{if(g!==socketGeneration)return;reconnectDelay=RECONNECT_INITIAL_MS;console.error(`PipeWeaver Control: connected to OpenDeck on ${port}`);send({event:"registerPlugin",uuid:pluginUUID});startup019.connected();void refreshStatus();scheduleStatusRefresh()};socket.onmessage=async ev=>{if(g!==socketGeneration)return;try{await handleMessage(JSON.parse(typeof ev.data==="string"?ev.data:ev.data.toString()))}catch(e){console.error("OpenDeck message error:",e?.stack||e)}};socket.onerror=e=>{if(g===socketGeneration)console.error("OpenDeck websocket error:",e?.message||e)};socket.onclose=()=>{if(g!==socketGeneration)return;if(ws===socket)ws=null;holdClear022();fades021.clear();dials020.clear();startup019.disconnected();console.error("PipeWeaver Control: OpenDeck connection closed");scheduleReconnect(g)}}
diag("startup",{port,pluginUUID,pipeweaverUrl:PIPEWEAVER_URL});
process.on("uncaughtException",e=>console.error("PipeWeaver Control: uncaught exception:",e?.stack||e));process.on("unhandledRejection",e=>console.error("PipeWeaver Control: unhandled rejection:",e));connect();scheduleStatusRefresh();
