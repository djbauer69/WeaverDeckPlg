"use strict";
(function(){
  function text(v){return String(v??"").trim()}
  function nameKey(v){return text(v).toLowerCase()}
  function processKey(v){
    let s=text(v).replace(/\s+\(deleted\)$/i,"").replace(/\\/g,"/");
    if(s.includes("/"))s=s.split("/").pop();
    return s.toLowerCase();
  }
  function typeKey(v){return text(v).toLowerCase()}
  function descriptor(a){return a?{name:text(a.name),process:text(a.process),deviceType:text(a.deviceType)}:null}
  function score(a,d){
    if(!a||!d)return -1;
    const dt=typeKey(d.deviceType),at=typeKey(a.deviceType);
    if(dt&&at&&dt!==at)return -1;
    const an=nameKey(a.name),dn=nameKey(d.name),ap=processKey(a.process),dp=processKey(d.process);
    const nameEq=!!(an&&dn&&an===dn),procEq=!!(ap&&dp&&ap===dp);
    if(nameEq&&procEq)return 100;
    if(procEq)return 80;
    if(nameEq)return 60;
    return -1;
  }
  function identityKey(a){const d=descriptor(a)||{};return `${typeKey(d.deviceType)}|${processKey(d.process)}|${nameKey(d.name)}`}
  function bestGroup(list,d){
    const rows=(Array.isArray(list)?list:[]).map((a,index)=>({a,index,score:score(a,d)})).filter(x=>x.score>=0);
    if(!rows.length)return [];
    const best=Math.max(...rows.map(x=>x.score)),top=rows.filter(x=>x.score===best),groups=new Map();
    for(const row of top){const k=identityKey(row.a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row)}
    if(groups.size!==1)return [];
    return [...groups.values()][0];
  }
  function find(list,d){return bestGroup(list,d)[0]?.a||null}
  function findIndex(list,d){return bestGroup(list,d)[0]?.index??-1}
  function label(a){const d=descriptor(a)||{};const kind=typeKey(d.deviceType)==="target"?"capture":typeKey(d.deviceType)==="source"?"playback":"";return `${d.name||"Application"}${d.process?` — ${d.process}`:""}${kind?` (${kind})`:""}`}
  function value(a){return JSON.stringify(descriptor(a)||{name:"",process:"",deviceType:""})}
  function addConfiguredOption(select,current,textPrefix="Configured"){
    const d=descriptor(current);if(!select||!d?.name)return null;
    const o=document.createElement("option");o.value=value(d);o.textContent=`${textPrefix}: ${label(d)} — not running`;o.selected=true;select.appendChild(o);return o;
  }
  window.WeaverAppIdentity={text,nameKey,processKey,typeKey,descriptor,score,identityKey,bestGroup,find,findIndex,label,value,addConfiguredOption};
})();
