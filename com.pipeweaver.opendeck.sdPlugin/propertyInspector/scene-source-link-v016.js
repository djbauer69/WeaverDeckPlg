"use strict";
let v016SourceLinkRetry=null;

function v016InstallSourceLinkDropdown(){
  try{
    const base=document.getElementById("baseFrame")?.contentWindow;
    const inner=base?.document?.getElementById("sceneFrame")?.contentWindow;
    if(!inner||!inner.document||!inner.__weaver016smartScenes||
       typeof inner.render!=="function"||
       typeof inner.setType!=="function"||
       typeof inner.fields!=="function"||
       typeof inner.summary!=="function"){
      v016SourceLinkRetry=setTimeout(v016InstallSourceLinkDropdown,50);
      return;
    }
    if(inner.__weaver016sourceLinkEditor)return;

    const s=inner.document.createElement("script");
    s.textContent=`(()=>{
      if(window.__weaver016sourceLinkEditor)return;
      window.__weaver016sourceLinkEditor=true;

      // This v0.16 layer owns the Source Link editor once Smart Scenes are live.
      // Mark the older v0.15.1 injector as satisfied so a late iframe race
      // cannot replace these Smart-Scene-aware controls.
      window.__weaver0151sourceLinks=true;

      const previousSetType=setType;
      const previousFields=fields;
      const previousSummary=summary;
      const previousRender=render;

      function sourceLinkFields(op,i){
        const choices=Array.isArray(data.sceneSources)&&data.sceneSources.length
          ? data.sceneSources
          : (Array.isArray(data.sources)?data.sources:[]);
        return '<div class="field"><label>Sources</label>'+ 
          multiChoices(i,"sources",choices)+
          '</div>'+ 
          '<div class="field"><label>Link state</label>'+ 
          '<select onchange="setField('+i+',\\'state\\',this.value)">'+
          '<option value="linked" '+(op.state!=="unlinked"?"selected":"")+'>Linked</option>'+ 
          '<option value="unlinked" '+(op.state==="unlinked"?"selected":"")+'>Unlinked</option>'+ 
          '</select></div>'+ 
          '<div class="appnote">When linked, PipeWeaver preserves the current A/B volume ratio. Existing A/B volume actions remain unchanged.</div>';
      }

      function conditionSuffix(op){
        const c=op&&op.condition&&typeof op.condition==="object"
          ? op.condition
          : {type:"always"};
        let suffix=" • Always";
        if(c.type==="applicationRunning"||c.type==="applicationNotRunning"){
          const a=c.application||{};
          const label=(a.name||"Application")+
            (a.process?" ("+a.process+")":"")+
            (a.deviceType?" ["+a.deviceType+"]":"");
          suffix=" • If "+label+(c.type==="applicationNotRunning"?" is not running":" is running");
        }
        if(op?.onFailure==="continue")suffix+=" • Continue on failure";
        return suffix;
      }

      setType=function(i,v){
        if(v==="sourceVolumeLink"){
          const old=operations[i]||{};
          operations[i]={
            type:"sourceVolumeLink",
            sources:[],
            state:"linked",
            condition:old.condition&&typeof old.condition==="object"
              ? old.condition
              : {type:"always"},
            onFailure:old.onFailure==="continue"?"continue":"stop"
          };
          render();
          save();
          return;
        }
        return previousSetType(i,v);
      };

      fields=function(op,i){
        if(op?.type!=="sourceVolumeLink")return previousFields(op,i);
        const existing=String(previousFields(op,i)||"");
        if(existing.includes("<label>Sources</label>")&&existing.includes("<label>Link state</label>")){
          return existing;
        }
        // The Smart Scenes wrapper already contributes Condition / On failure
        // controls for unknown operation types. Prepend the missing Source Link
        // operation-specific editor without duplicating those Smart controls.
        return sourceLinkFields(op,i)+existing;
      };

      summary=function(op){
        if(op?.type!=="sourceVolumeLink")return previousSummary(op);
        const names=Array.isArray(op.sources)&&op.sources.length
          ? op.sources.join(", ")
          : "none selected";
        return names+" • "+(op.state==="unlinked"?"Unlinked":"Linked")+conditionSuffix(op);
      };

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
