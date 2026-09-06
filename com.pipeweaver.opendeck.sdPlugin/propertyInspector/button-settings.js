"use strict";
// Reuse the original inspector's registered socket. Intercept saves so older
// inspectors (including nested Scene editors) cannot discard the text settings.
let latest={},preferences={},context,socket,rawSend;
const frame=document.getElementById('inspector'),help=document.getElementById('help'),actionName=document.getElementById('actionName');
let mode=null,manual=null,input=null,manualLabel=null;
function adopt(settings){
  latest={...settings};
  preferences={textMode:settings.textMode==='manual'||(settings.textMode!=='dynamic'&&!!settings.buttonText)?'manual':'dynamic',buttonText:String(settings.buttonText??'')};
  syncTextControls();
}
function save(){
  if(!mode||!input)return;
  preferences={textMode:mode.value,buttonText:input.value};manual.hidden=mode.value!=='manual';if(manualLabel)manualLabel.hidden=manual.hidden;
  latest={...latest,...preferences};
  if(socket?.readyState===1)rawSend.call(socket,JSON.stringify({event:'setSettings',context,payload:latest}));
}
function syncTextControls(){
  if(!mode||!input||!manual)return;
  mode.value=preferences.textMode;input.value=preferences.buttonText;manual.hidden=mode.value!=='manual';if(manualLabel)manualLabel.hidden=manual.hidden;
}
function setTextControlsEnabled(enabled){if(mode)mode.disabled=!enabled;if(input)input.disabled=!enabled}
function injectStyles(win){
  const doc=win.document;if(!doc?.body)return;
  doc.body.classList?.add('weaver-compact');
  if(doc.getElementById('weaverCompactStyle'))return;
  const style=doc.createElement('style');style.id='weaverCompactStyle';
  style.textContent=`body.weaver-compact [hidden]{display:none!important}body.weaver-compact{box-sizing:border-box;padding:10px!important}body.weaver-compact .row{gap:6px!important;margin-bottom:7px!important}body.weaver-compact label{max-width:78px}body.weaver-compact select,body.weaver-compact input,body.weaver-compact textarea{padding:5px 6px!important}body.weaver-compact .field{gap:6px!important;margin:5px 0!important}body.weaver-compact .field label{width:68px!important}.weaver-text-controls{margin:0 0 9px;padding:8px;border:1px solid #444;border-radius:5px;background:#222}.weaver-text-grid{display:grid;grid-template-columns:82px minmax(0,1fr);gap:7px;align-items:start}.weaver-text-grid label{padding-top:5px;color:#bbb}.weaver-text-grid select,.weaver-text-grid textarea{box-sizing:border-box;width:100%;background:#2a2a2a;color:#fff;border:1px solid #555;border-radius:4px}.weaver-manual[hidden]{display:none}@media (min-width:420px){body.weaver-compact>div.row:not(.top){display:inline-flex;width:calc(50% - 5px)!important;vertical-align:top}body.weaver-compact>div.row:nth-of-type(even):not(.top){margin-left:5px!important}}@media (min-width:480px){body.weaver-compact .step .field:not(:has(.choices)){display:inline-flex;width:calc(50% - 5px)!important;margin-right:5px!important;vertical-align:top}body.weaver-compact .step .field:has(.choices){display:flex;width:100%!important}}`;
  (doc.head||doc.body).appendChild(style);
}
function injectTextControls(win){
  const doc=win.document;if(!doc?.body)return;
  let host=doc.getElementById('weaverTextControls');
  if(!host){
    host=doc.createElement('div');host.id='weaverTextControls';host.className='weaver-text-controls';
    host.innerHTML='<div class="weaver-text-grid"><label for="weaverTextMode">Button Text</label><select id="weaverTextMode" disabled><option value="dynamic">Dynamic Text</option><option value="manual">Manual Input</option></select><label class="weaver-manual" for="weaverManualText">Manual Input</label><div class="weaver-manual" id="weaverManual"><textarea id="weaverManualText" rows="2" disabled placeholder="Enter your button label"></textarea></div></div>';
    doc.body.insertBefore(host,doc.body.firstChild);
  }
  mode=doc.getElementById('weaverTextMode');manual=doc.getElementById('weaverManual');input=doc.getElementById('weaverManualText');
  manualLabel=host.querySelector('label.weaver-manual');
  mode.onchange=()=>{if(manualLabel)manualLabel.hidden=mode.value!=='manual';save()};
  input.oninput=save;
  syncTextControls();setTextControlsEnabled(!!socket);
  if(manualLabel)manualLabel.hidden=mode.value!=='manual';
}
function patchWindow(win,withTextControls=false){
  injectStyles(win);
  if(withTextControls)injectTextControls(win);
  const proto=win.WebSocket.prototype;
  if(!Object.prototype.hasOwnProperty.call(proto,'weaverTextPatched')){
    Object.defineProperty(proto,'weaverTextPatched',{value:true});
    const original=proto.send;
    proto.send=function(data){
      if(socket!==this){
        socket=this;rawSend=original;setTextControlsEnabled(true);
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
    patchWindow(child.contentWindow,false);
    child.addEventListener('load',()=>patchWindow(child.contentWindow,false));
  }
}
window.connectElgatoStreamDeckSocket=function(...args){
  const info=JSON.parse(args[4]);context=info.context;adopt(info.payload?.settings||{});
  actionName.textContent=window.buttonInspectorNames?.[info.action]||info.action.split('.').pop();
  if(info.action.endsWith('volumedial'))help.textContent='Turn to adjust by Step % per tick. Press or tap to mute. The strip shows live volume and mute state in either text mode; labels use one line.';
  else if(info.action.endsWith('volup')||info.action.endsWith('voldown'))help.textContent='Tap once for one Step %. Hold to repeat at the configured hold speed.';
  const original=window.buttonInspectors[info.action];
  if(!original){help.textContent='Unknown action inspector';return}
  frame.onload=()=>{
    patchWindow(frame.contentWindow,true);
    frame.contentWindow.connectElgatoStreamDeckSocket(...args);
  };
  frame.src=original;
};
