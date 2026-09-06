'use strict';
let savedPresets=Object.create(null),presetsReady=false,presetRequest=0;
const pendingPresets=new Map();
function presetMap(){return savedPresets}
function renderPresets(selected){
 const s=document.getElementById('presetSelect');if(!s)return;const keep=selected===undefined?s.value:selected;
 s.innerHTML='<option value="">Saved preset…</option>'+Object.keys(savedPresets).sort((a,b)=>a.localeCompare(b)).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
 if(Object.prototype.hasOwnProperty.call(savedPresets,keep))s.value=keep;
}
function requestPresets(command,extra={}){
 const requestId='presets-'+(++presetRequest);pendingPresets.set(requestId,command);
 if(!bridge({command,...extra,requestId})){pendingPresets.delete(requestId);status('Saved Presets: OpenDeck connection is not ready','error');return false}return true;
}
function refreshPresets(){requestPresets('getScenePresets')}
function legacyPresets(){try{const x=JSON.parse(localStorage.getItem(PRESET_KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch(_){return {}}}
function scenePresetsUpdate(p){
 const operation=pendingPresets.get(p?.requestId);if(!operation)return;pendingPresets.delete(p.requestId);
 if(!p.ok){status('Saved Presets: '+(p.error||'unknown error'),'error');return}
 savedPresets=Object.create(null);for(const e of p.entries||[])savedPresets[e.name]=e.scene;
 presetsReady=true;renderPresets(operation==='saveScenePreset'||operation==='deleteScenePreset'?p.selected:undefined);
 if(p.message)status(p.message,'ok');
 if(operation==='importScenePresets'){
  // Clear the browser copy only after the plugin confirms the durable write.
  try{localStorage.removeItem(PRESET_KEY)}catch(_){}
 }else if(operation==='getScenePresets'){
  const legacy=legacyPresets();if(Object.keys(legacy).length)requestPresets('importScenePresets',{presets:legacy});
 }
}
function savePreset(){
 if(!presetsReady)return status('Saved Presets are still loading','error');
 const obj=sceneDoc();if(!obj)return status('Scene Builder is not ready','error');
 const name=prompt('Preset name',obj.name)?.trim();if(!name)return;
 if(Object.prototype.hasOwnProperty.call(savedPresets,name)&&!confirm(`Replace preset “${name}”?`))return;
 status('Saving preset…');requestPresets('saveScenePreset',{name,scene:obj});
}
function loadPreset(){const n=document.getElementById('presetSelect').value;if(n&&Object.prototype.hasOwnProperty.call(savedPresets,n))applyDoc(savedPresets[n],`saved preset “${n}”`)}
function deletePreset(){const name=document.getElementById('presetSelect').value;if(!name||!confirm(`Delete preset “${name}”?`))return;status('Deleting preset…');requestPresets('deleteScenePreset',{name})}
window.addEventListener('focus',()=>{if(child?.sendToPluginBridge)refreshPresets()});
