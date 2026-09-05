"use strict";
// Reuse the original inspector's registered socket. Intercept saves so older
// inspectors (including nested Scene editors) cannot discard the text settings.
let latest={},preferences={},context,socket,rawSend;
const mode=document.getElementById('textMode'),manual=document.getElementById('manual'),input=document.getElementById('manualText'),frame=document.getElementById('inspector');
function adopt(settings){
  latest={...settings};
  preferences={textMode:settings.textMode==='manual'||(settings.textMode!=='dynamic'&&!!settings.buttonText)?'manual':'dynamic',buttonText:String(settings.buttonText??'')};
  mode.value=preferences.textMode;input.value=preferences.buttonText;manual.hidden=mode.value!=='manual';
}
function save(){
  preferences={textMode:mode.value,buttonText:input.value};manual.hidden=mode.value!=='manual';
  latest={...latest,...preferences};
  if(socket?.readyState===1)rawSend.call(socket,JSON.stringify({event:'setSettings',context,payload:latest}));
}
mode.addEventListener('change',save);input.addEventListener('input',save);
function patchWindow(win){
  const proto=win.WebSocket.prototype;
  if(!Object.prototype.hasOwnProperty.call(proto,'weaverTextPatched')){
    Object.defineProperty(proto,'weaverTextPatched',{value:true});
    const original=proto.send;
    proto.send=function(data){
      if(socket!==this){
        socket=this;rawSend=original;mode.disabled=false;input.disabled=false;
        this.addEventListener('message',ev=>{try{const m=JSON.parse(ev.data);if(m.event==='didReceiveSettings'&&m.context===context)adopt(m.payload?.settings||{})}catch(_){}});
      }
      try{
        const m=JSON.parse(data);
        if(m.event==='setSettings'&&m.context===context){
          latest={...latest,...m.payload,...preferences};m.payload=latest;data=JSON.stringify(m);
        }
      }catch(_){}
      return original.call(this,data);
    };
  }
  const old=win.document.getElementById('buttonText');if(old?.closest('.row'))old.closest('.row').hidden=true;
  for(const child of win.document.querySelectorAll('iframe')){
    patchWindow(child.contentWindow);
    child.addEventListener('load',()=>patchWindow(child.contentWindow));
  }
}
window.connectElgatoStreamDeckSocket=function(...args){
  const info=JSON.parse(args[4]);context=info.context;adopt(info.payload?.settings||{});
  const original=window.buttonInspectors[info.action];
  if(!original){document.getElementById('help').textContent='Unknown action inspector';return}
  frame.onload=()=>{
    patchWindow(frame.contentWindow);
    frame.contentWindow.connectElgatoStreamDeckSocket(...args);
  };
  frame.src=original;
};
