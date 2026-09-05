"use strict";
const path=require('path'),Module=require('module');
function build(){
 let source=require('./core-v0191').build();
 function replace(before,after){if(source.split(before).length!==2)throw Error('v0.20 anchor missing or ambiguous: '+before);source=source.replace(before,after)}
 replace('function updateInstance(i){',`const dialKind020=require('./dial-controls').kind;
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
function updateInstance(i){
 if(dials020.render(i,lastStatus))return;`);
 replace('  const e = m.event;',`  const e = m.event;
  if(e==='willDisappear'||e==='didReceiveSettings')dials020.cancel(m.context);
  if(['dialRotate','dialDown','dialUp','touchTap'].includes(e)){
    dials020.handle(m,instances.get(m.context));return;
  }`);
 replace('startup019.disconnected();','dials020.clear();startup019.disconnected();');
 return source;
}
function start(){const filename=path.join(__dirname,'plugin-core.js'),patched=new Module(filename,module);patched.filename=filename;patched.paths=module.paths;patched._compile(build(),filename)}
module.exports={build,start};
