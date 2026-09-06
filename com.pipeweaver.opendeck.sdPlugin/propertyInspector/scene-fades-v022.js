"use strict";
function installSceneFades022(){
 const inner=document.getElementById('baseFrame')?.contentWindow?.document?.getElementById('sceneFrame')?.contentWindow;
 if(!inner?.__features018){setTimeout(installSceneFades022,50);return}
 if(inner.__fades022)return;
 const script=inner.document.createElement('script');script.textContent=fadeChoices.toString()+';'+fadeSelection.toString()+';('+sceneFades022.toString()+')()';inner.document.head.append(script);script.remove();
}
window.addEventListener('load',installSceneFades022);
function sceneFades022(){
 window.__fades022=true;
 const oldSet=setType,oldFields=fields,oldSummary=summary,oldRender=render;
 function fadeMs(op){if(op.milliseconds!==undefined&&op.milliseconds!==null&&op.milliseconds!=='')return Math.round(Number(op.milliseconds));if(op.seconds!==undefined&&op.seconds!==null&&op.seconds!=='')return Math.round(Number(op.seconds)*1000);return 3000}
 setType=function(i,type){if(type!=='volumeFade')return oldSet(i,type);const old=operations[i]||{};operations[i]={type,kind:'source',mix:'A',volume:0,milliseconds:3000,condition:old.condition||{type:'always'},onFailure:old.onFailure||'stop'};save();render()};
 window.setFadeKind=function(i,kind){const old=operations[i];operations[i]={type:'volumeFade',kind,mix:'A',volume:old.volume,milliseconds:fadeMs(old),condition:old.condition,onFailure:old.onFailure};save();render()};
 window.setFadeChoice=function(i,value){if(value)Object.assign(operations[i],JSON.parse(value));else{delete operations[i].application;delete operations[i].device;delete operations[i].sourceName;delete operations[i].targetName}save();render()};
 fields=function(op,i){
  if(op.type!=='volumeFade')return oldFields(op,i);
  const options=fadeChoices(op.kind,data),selected=fadeSelection(op);
  if(selected&&!options.some(o=>o.value===selected))options.push({label:op.application?.name||op.sourceName||op.targetName||op.device?.name||'Configured selection (offline)',value:selected});
  const choices=options.map(o=>'<option value="'+esc(o.value)+'" '+(o.value===selected?'selected':'')+'>'+esc(o.label)+'</option>').join('');
  return '<div class="field"><label>Fade control</label><select onchange="setFadeKind('+i+',this.value)">'+[['application','Application'],['input','Physical Input'],['output','Physical Output'],['source','Source'],['target','Target']].map(([v,n])=>'<option value="'+v+'" '+(v===op.kind?'selected':'')+'>'+n+'</option>').join('')+'</select></div>'+
   '<div class="field"><label>Device / Application</label><select onchange="setFadeChoice('+i+',this.value)"><option value="">Select…</option>'+choices+'</select></div>'+
   (op.kind==='source'?'<div class="field"><label>Mix</label><select onchange="setField('+i+',\'mix\',this.value)"><option '+(op.mix==='A'?'selected':'')+'>A</option><option '+(op.mix==='B'?'selected':'')+'>B</option></select></div>':'')+
   '<div class="field"><label>Fade to %</label><input type="number" min="0" max="100" value="'+esc(op.volume??0)+'" onchange="setField('+i+',\'volume\',this.value)"></div><div class="field"><label>Duration ms</label><input type="number" min="0" max="120000" step="1" inputmode="numeric" value="'+esc(fadeMs(op))+'" onchange="setField('+i+',\'milliseconds\',this.value);delete operations['+i+'].seconds;save();renderSummary('+i+')"></div><div class="appnote">Waits for this fade to finish. Missing devices/applications or an interrupted fade follow the failure policy below. Use a condition to skip an application that is not running. Mute is unchanged.</div>'+oldFields(op,i);
 };
 summary=function(op){return op.type==='volumeFade'?'Volume Fade • '+op.kind+' • '+op.volume+'% • '+fadeMs(op)+'ms • '+oldSummary(op):oldSummary(op)};
 render=function(){oldRender();document.querySelectorAll('.step-head select').forEach((sel,i)=>{if(!sel.querySelector('option[value="volumeFade"]'))sel.add(new Option('Volume Fade','volumeFade'));sel.replaceChildren(...[...sel.options].sort((a,b)=>a.textContent.localeCompare(b.textContent)));sel.value=operations[i]?.type})};render();
}
