"use strict";
let v016SourceLinkRetry=null;
function v016InstallSourceLinkDropdown(){
  try{
    const base=document.getElementById("baseFrame")?.contentWindow;
    const inner=base?.document?.getElementById("sceneFrame")?.contentWindow;
    if(!inner||!inner.document||!inner.__weaver016smartScenes||typeof inner.render!=="function"){
      v016SourceLinkRetry=setTimeout(v016InstallSourceLinkDropdown,50);
      return;
    }
    if(inner.__weaver016sourceLinkDropdown)return;
    const s=inner.document.createElement("script");
    s.textContent=`(()=>{
      if(window.__weaver016sourceLinkDropdown)return;
      window.__weaver016sourceLinkDropdown=true;
      const previousRender=render;
      render=function(){
        previousRender();
        const sels=[...document.querySelectorAll(".step-head select")];
        sels.forEach((sel,i)=>{
          if(!sel.querySelector('option[value="sourceVolumeLink"]')){
            const opt=document.createElement("option");
            opt.value="sourceVolumeLink";
            opt.textContent="Source Volume Link / Unlink";
            const before=sel.querySelector('option[value="targetMute"]');
            sel.insertBefore(opt,before||null);
          }
          if(operations[i])sel.value=operations[i].type;
        });
      };
      render();
    })();`;
    const host=inner.document.head||inner.document.documentElement;
    host.appendChild(s);
    s.remove();
  }catch(_){
    v016SourceLinkRetry=setTimeout(v016InstallSourceLinkDropdown,250);
  }
}
window.addEventListener("load",()=>setTimeout(v016InstallSourceLinkDropdown,50));
