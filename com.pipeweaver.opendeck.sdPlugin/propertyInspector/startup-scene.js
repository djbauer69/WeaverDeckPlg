"use strict";
let socket019,context019,loaded019=false,timer019;
function request019(command,extra={}){if(socket019?.readyState!==1)return;socket019.send(JSON.stringify({event:"sendToPlugin",context:context019,payload:{command,...extra}}))}
function connectElgatoStreamDeckSocket(port,uuid,event,info,actionInfo){
 context019=JSON.parse(actionInfo).context;
 socket019=new WebSocket("ws://localhost:"+port);
 socket019.onopen=()=>{socket019.send(JSON.stringify({event,uuid}));request019("getStartupScene");timer019=setInterval(()=>request019("getStartupScene"),2000)};
 socket019.onclose=()=>{clearInterval(timer019);document.getElementById("status").textContent="Disconnected"};
 socket019.onmessage=e=>{try{
  const p=JSON.parse(e.data).payload;if(p?.command!=="startupSceneResult")return;
  const status=document.getElementById("status");
  if(!p.ok){status.textContent=p.error;return}
  const r=p.result;
  if(p.request==="checkStartupScene"){status.textContent=(r.ok?"Validation passed":"Validation failed")+": "+r.name+" ("+r.steps+" steps)"+[...(r.errors||[]),...(r.warnings||[])].map(x=>"\nStep "+x.step+": "+x.message).join("");return}
  if(!loaded019||p.request==="saveStartupScene"){
   document.getElementById("enabled").checked=r.enabled;document.getElementById("filePath").value=r.filePath;document.getElementById("settleSeconds").value=r.settleSeconds;
   loaded019=true;document.getElementById("check").disabled=false;document.getElementById("save").disabled=false;
  }
  if(p.request!=="getStartupScene"||!document.getElementById("status").dataset.hold)status.textContent=r.message;
 }catch(e){document.getElementById("status").textContent=e.message}};
}
function check019(){document.getElementById("status").dataset.hold="true";request019("checkStartupScene",{filePath:document.getElementById("filePath").value})}
function save019(){delete document.getElementById("status").dataset.hold;request019("saveStartupScene",{settings:{enabled:document.getElementById("enabled").checked,filePath:document.getElementById("filePath").value,settleSeconds:Number(document.getElementById("settleSeconds").value)}})}
