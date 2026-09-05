"use strict";
let socket018,info018,settings018={},choices018={};
const bufferSizes018=[8,16,32,64,128,256,512,768,1024,1280,1536,1792,2048,2304,2560,2816,3072,3328,3584,3840,4096];
function connectElgatoStreamDeckSocket(port,uuid,event,info,actionInfo){
  info018=JSON.parse(actionInfo);settings018={...(info018.payload?.settings||{})};
  render018();
  socket018=new WebSocket("ws://localhost:"+port);
  socket018.onopen=()=>{socket018.send(JSON.stringify({event,uuid}));request018()};
  socket018.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.event==="sendToPropertyInspector"&&m.payload?.command==="targets"){choices018=m.payload;render018()}else if(m.event==="didReceiveSettings"){settings018={...(m.payload?.settings||{})};render018()}}catch(e){document.getElementById("hint").textContent=e.message}};
}
function request018(){if(info018.action.includes("sourcemuteto"))socket018.send(JSON.stringify({event:"sendToPlugin",context:info018.context,payload:{command:"getTargets"}}))}
function field018(key,label,values,defaultValue){
  const host=document.getElementById("controls"),l=document.createElement("label"),select=document.createElement("select");l.textContent=label;host.append(l,select);
  for(const [value,text] of values)select.add(new Option(text,value));
  const chosen=settings018[key]??defaultValue;
  if(chosen&&!values.some(v=>v[0]===chosen))select.add(new Option("Configured: "+chosen,chosen));
  select.value=chosen;
  select.onchange=()=>{settings018[key]=select.value;socket018?.send(JSON.stringify({event:"setSettings",context:info018.context,payload:settings018}))};
}
function render018(){
  document.getElementById("controls").replaceChildren();const action=info018.action;
  if(action.endsWith("audiorestart")){document.getElementById("hint").textContent="Restarts PipeWeaver’s audio engine and waits up to 30 seconds for recovery. Audio is briefly interrupted.";return}
  if(action.endsWith("audiobuffer")){field018("bufferSize","Audio buffer size",[["default","PipeWire configured"],...bufferSizes018.map(n=>[String(n),n+" samples"])],"default");document.getElementById("hint").textContent="Changing buffer size restarts PipeWeaver’s audio engine. The action waits for recovery. Selecting the current setting does nothing.";return}
  field018("sourceName","Source",[["","Select source…"],...(choices018.sceneSources||[]).slice().sort().map(n=>[n,n])],"");
  field018("mix","Mute slot",[["A","A"],["B","B"]],"A");
  if(!action.endsWith("sourcemutetoall"))field018("targetName","Mute destination",[["","Select destination…"],...(choices018.sceneTargets||[]).slice().sort().map(n=>[n,n])],"");
  const refresh=document.createElement("button");refresh.textContent="Refresh choices";refresh.onclick=request018;document.getElementById("controls").append(refresh);
  document.getElementById("hint").textContent="Configures the source’s Mute To dropdown. This does not press Mute. PipeWeaver may unmute this slot when its destinations change. An empty destination list means Mute to All; removing the last destination restores All.";
}
