'use strict';
// Legacy Saved Presets format retained for migration into Scene Library.
// The active plugin no longer installs this module's separate preset commands.
const fs=require('fs'),path=require('path');
const {libraryPath,cleanLibraryName,normalizeScene,writeLibrary}=require('./scene-library');
const FORMAT='WeaverDeckScenePresets',LIMIT=8*1024*1024;
function presetPath(){return path.join(path.dirname(libraryPath()),'scene-presets-v1.json')}
function createStore(file=presetPath()){
 function read(){
  let raw;try{if(fs.statSync(file).size>LIMIT)throw Error('Saved Presets file is too large');raw=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {format:FORMAT,formatVersion:1,presets:Object.create(null),migratedNames:[]};throw e}
  if(raw?.format!==FORMAT||raw.formatVersion!==1||!raw.presets||typeof raw.presets!=='object'||Array.isArray(raw.presets)||!Array.isArray(raw.migratedNames))throw Error('Invalid Saved Presets file');
  const doc={format:FORMAT,formatVersion:1,presets:Object.create(null),migratedNames:raw.migratedNames.map(cleanLibraryName)};
  for(const [n,s] of Object.entries(raw.presets)){const name=cleanLibraryName(n);doc.presets[name]=normalizeScene(s,name)}return doc;
 }
 function change(command,payload={}){
  const doc=read(),seen=new Set(doc.migratedNames);let selected='',message='',changed=false;
  if(command==='saveScenePreset'){
   const name=cleanLibraryName(payload.name);doc.presets[name]=normalizeScene(payload.scene,name);seen.add(name);selected=name;changed=true;message=`Saved preset “${name}”`;
  }else if(command==='deleteScenePreset'){
   const name=cleanLibraryName(payload.name);delete doc.presets[name];seen.add(name);changed=true;message=`Deleted preset “${name}”`;
  }else if(command==='importScenePresets'){
   if(!payload.presets||typeof payload.presets!=='object'||Array.isArray(payload.presets))throw Error('Invalid browser presets');
   // Import only once per name. A stale browser cache cannot resurrect a deleted
   // preset or overwrite a newer preset saved from another inspector.
   let count=0;
   for(const [n,s] of Object.entries(payload.presets)){
    const name=cleanLibraryName(n);if(seen.has(name))continue;
    const scene=normalizeScene(s,name);
    if(!Object.hasOwn(doc.presets,name)){doc.presets[name]=scene;count++}
    seen.add(name);changed=true;
   }
   message=count?`Imported ${count} browser preset(s)`:'';
  }else if(command!=='getScenePresets')throw Error('Unsupported preset command');
  if(changed){doc.migratedNames=[...seen];writeLibrary(doc,file)}
  return {command:'scenePresets',ok:true,entries:Object.keys(doc.presets).sort((a,b)=>a.localeCompare(b)).map(name=>({name,scene:doc.presets[name]})),selected,message};
 }
 return {read,change};
}
function installScenePresets(options={}){
 const store=createStore(options.file),commands=new Set(['getScenePresets','saveScenePreset','deleteScenePreset','importScenePresets']);
 return {handleIncoming(socket,event){
  let m;try{m=JSON.parse(event.data)}catch(_){return false}
  if(m?.event!=='sendToPlugin'||!commands.has(m.payload?.command))return false;
  let response;try{response=store.change(m.payload.command,m.payload);if(response.message)console.log('[Presets] '+response.message)}catch(e){response={command:'scenePresets',ok:false,error:e.message};console.error('[Presets] '+e.message)}
  socket.send(JSON.stringify({event:'sendToPropertyInspector',context:m.context,payload:{...response,requestId:m.payload.requestId,operation:m.payload.command}}));return true;
 }};
}
module.exports={createStore,installScenePresets,presetPath};
