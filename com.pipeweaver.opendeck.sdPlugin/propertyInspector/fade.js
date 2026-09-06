"use strict";
let socket,info,settings;
const el=id=>document.getElementById(id);
const kinds={appvolumefade:'application',sourcevolumefade:'source',targetvolumefade:'target',physinvolumefade:'input',physvolumefade:'output'};
function populate(data){
 const old=fadeSelection(settings),select=el('selection');select.replaceChildren(new Option('Select…',''));
 const choices=fadeChoices(settings.kind,data);
 if(old&&!choices.some(c=>c.value===old))choices.push({label:settings.application?.name||settings.sourceName||settings.targetName||settings.device?.name||'Configured selection (offline)',value:old});
 for(const c of choices)select.add(new Option(c.label,c.value));select.value=old;
 el('status').textContent=choices.length?'':'No available devices/applications. Check PipeWeaver.';
}
function save(){
 let choice={};try{choice=JSON.parse(el('selection').value||'{}')}catch(_){}
 settings={...settings,application:null,sourceName:null,targetName:null,device:null,...choice,volume:el('volume').value,seconds:el('seconds').value,mix:el('mix').value};
 socket?.send(JSON.stringify({event:'setSettings',context:info.context,payload:settings}));
}
for(const id of ['selection','volume','seconds','mix'])el(id).addEventListener('change',save);
window.connectElgatoStreamDeckSocket=function(port,uuid,event,unused,actionInfo){
 info=JSON.parse(actionInfo);settings={volume:0,seconds:3,mix:'A',...info.payload?.settings,kind:kinds[info.action.split('.').pop()]};
 el('volume').value=settings.volume;el('seconds').value=settings.seconds;el('mix').value=settings.mix;el('mixRow').hidden=settings.kind!=='source';
 socket=new WebSocket('ws://localhost:'+port);
 socket.onopen=()=>{socket.send(JSON.stringify({event,uuid}));socket.send(JSON.stringify({event:'sendToPlugin',context:info.context,payload:{command:'getTargets'}}))};
 socket.onmessage=ev=>{try{const m=JSON.parse(ev.data);if(m.event==='sendToPropertyInspector'&&m.payload?.command==='targets')populate(m.payload)}catch(_){}};
};
