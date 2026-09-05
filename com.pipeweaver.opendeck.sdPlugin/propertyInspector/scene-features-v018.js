"use strict";
function installSceneFeatures018(){
  const inner=document.getElementById("baseFrame")?.contentWindow?.document?.getElementById("sceneFrame")?.contentWindow;
  if(!inner?.__weaver016sourceLinkEditor){setTimeout(installSceneFeatures018,50);return}
  if(inner.__features018)return;
  const script=inner.document.createElement("script");script.textContent="("+sceneFeatures018.toString()+")()";inner.document.head.append(script);script.remove();
}
window.addEventListener("load",installSceneFeatures018);
function sceneFeatures018(){
  window.__features018=true;
  const types={audioBuffer:"Audio Buffer Size",audioRestart:"Audio Engine Restart",sourceMuteDestinations:"Source Mute To Destinations"};
  const sizes=[8,16,32,64,128,256,512,768,1024,1280,1536,1792,2048,2304,2560,2816,3072,3328,3584,3840,4096];
  const oldSet=setType,oldFields=fields,oldSummary=summary,oldRender=render;
  setType=function(i,type){
    if(!types[type])return oldSet(i,type);
    const old=operations[i]||{};
    operations[i]={type,condition:old.condition||{type:"always"},onFailure:old.onFailure||"stop",...(type==="audioBuffer"?{bufferSize:"default"}:type==="sourceMuteDestinations"?{sources:[],targets:[],mix:"A",mode:"set"}:{})};save();render();
  };
  function select(i,key,label,values,value){return '<div class="field"><label>'+label+'</label><select onchange="setField('+i+',\''+key+'\',this.value);render()">'+values.map(([v,t])=>'<option value="'+esc(v)+'" '+(String(value)===v?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></div>'}
  fields=function(op,i){
    if(!types[op.type])return oldFields(op,i);
    let html="";
    if(op.type==="audioBuffer")html=select(i,"bufferSize","Buffer size",[["default","PipeWire configured"],...sizes.map(n=>[String(n),n+" samples"])],op.bufferSize)+ '<div class="appnote">Changing buffer size restarts audio. Waits up to 30 seconds for recovery before the next step.</div>';
    if(op.type==="audioRestart")html='<div class="appnote">Restarts PipeWeaver’s audio engine. Waits up to 30 seconds for recovery before the next step. Audio is briefly interrupted.</div>';
    if(op.type==="sourceMuteDestinations"){
      html='<div class="field"><label>Sources</label>'+multiChoices(i,"sources",data.sceneSources||[])+'</div>'+select(i,"mix","Mute slot",[["A","A"],["B","B"]],op.mix)+select(i,"mode","Destinations",[["set","Set selected destinations"],["add","Add selected destinations"],["remove","Remove selected destinations"],["all","Mute to All"]],op.mode);
      if(op.mode!=="all")html+='<div class="field"><label>Targets</label>'+multiChoices(i,"targets",data.sceneTargets||[])+'</div>';
      html+='<div class="appnote">Configures Mute To; does not activate Mute. PipeWeaver may unmute this slot when destinations change. Add a Source Mute step afterward if needed. Removing the final target restores Mute to All.</div>';
    }
    return html+oldFields(op,i); // Existing wrapper supplies conditions and failure policy.
  };
  summary=function(op){if(!types[op.type])return oldSummary(op);return types[op.type]+(op.type==="audioBuffer"?' • '+op.bufferSize:op.type==="sourceMuteDestinations"?' • '+op.mix+' • '+op.mode+' • '+(op.sources||[]).join(', '):'')+' • '+oldSummary(op)};
  render=function(){
    oldRender();
    document.querySelectorAll('.step-head select').forEach((sel,i)=>{
      for(const [value,label] of Object.entries(types))if(!sel.querySelector('option[value="'+value+'"]'))sel.add(new Option(label,value));
      for(const opt of sel.options){if(opt.value==="defaultDevice")opt.textContent="Default Device";if(opt.value==="wait")opt.textContent="Wait / Delay"}
      const options=[...sel.options].sort((a,b)=>a.textContent.localeCompare(b.textContent));sel.replaceChildren(...options);sel.value=operations[i]?.type;
    });
  };render();
}
