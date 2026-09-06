'use strict';
let browserImportPending=null,browserImportCounter=0;
function sceneLibraryMigrationResult(payload){
 if(payload.requestId&&payload.requestId===browserImportPending?.id){
  if(payload.ok){
   try{if(localStorage.getItem(PRESET_KEY)===browserImportPending.snapshot)localStorage.removeItem(PRESET_KEY)}catch(_){}
  }
  browserImportPending=null;return;
 }
 if(!payload.ok||payload.operation!=='getSceneLibrary'||browserImportPending)return;
 let snapshot,presets;try{snapshot=localStorage.getItem(PRESET_KEY);presets=JSON.parse(snapshot||'{}')}catch(_){return}
 if(!presets||typeof presets!=='object'||Array.isArray(presets)||!Object.keys(presets).length)return;
 const id='library-preset-import-'+(++browserImportCounter);
 browserImportPending={id,snapshot};
 if(!bridge({command:'importBrowserPresets',presets,requestId:id})){
  browserImportPending=null;status('Scene Library import waiting for OpenDeck connection…');
 }
}
window.addEventListener('focus',()=>{if(child?.sendToPluginBridge)refreshLibrary()});
