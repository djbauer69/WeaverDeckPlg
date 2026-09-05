"use strict";

/* WeaverDeck v0.17.0 runtime extension for the stable plugin-core.js.
 * Applies a small, guarded textual patch in memory, then compiles the result.
 * The on-disk v0.15.0/v0.11.2-derived control core remains unchanged.
 */
const fs=require("fs");
const path=require("path");
const Module=require("module");
const filename=path.join(__dirname,"plugin-core.js");
let source=fs.readFileSync(filename,"utf8");
function replaceOnce(before,after,label){const first=source.indexOf(before);if(first<0)throw new Error(`v0.17.0 core patch failed: ${label} pattern not found`);if(source.indexOf(before,first+before.length)>=0)throw new Error(`v0.17.0 core patch failed: ${label} pattern is ambiguous`);source=source.slice(0,first)+after+source.slice(first+before.length)}
replaceOnce("  sourceMuteA:\"com.pipeweaver.opendeck.sourcemutea\", sourceMuteB:\"com.pipeweaver.opendeck.sourcemuteb\",\n  targetMixA:\"com.pipeweaver.opendeck.targetmixa\", targetMixB:\"com.pipeweaver.opendeck.targetmixb\", targetMixToggle:\"com.pipeweaver.opendeck.targetmixtoggle\",","  sourceMuteA:\"com.pipeweaver.opendeck.sourcemutea\", sourceMuteB:\"com.pipeweaver.opendeck.sourcemuteb\",\n  sourceLinkToggle:\"com.pipeweaver.opendeck.sourcelinktoggle\",\n  targetMixA:\"com.pipeweaver.opendeck.targetmixa\", targetMixB:\"com.pipeweaver.opendeck.targetmixb\", targetMixToggle:\"com.pipeweaver.opendeck.targetmixtoggle\",","action UUID");
replaceOnce("function sourceVolume(src,mix){const v=src?.volumes?.volume?.[mix];return Number.isFinite(v)?Number(v):null}\nfunction sourceMuted(src,mix){const st=src?.mute_states?.mute_state; if(Array.isArray(st)) return st.includes(\"Target\"+mix); if(typeof st===\"string\") return st.includes(\"Target\"+mix); return false}","function sourceVolume(src,mix){const v=src?.volumes?.volume?.[mix];return Number.isFinite(v)?Number(v):null}\nfunction sourceLinked(src){if(!src||!src.volumes||!(\"volumes_linked\" in src.volumes))return null;return src.volumes.volumes_linked!==null&&src.volumes.volumes_linked!==undefined}\nfunction sourceMuted(src,mix){const st=src?.mute_states?.mute_state; if(Array.isArray(st)) return st.includes(\"Target\"+mix); if(typeof st===\"string\") return st.includes(\"Target\"+mix); return false}","source link reader");
replaceOnce("  const sources=sourceDevices.map(d=>({name:deviceName(d),id:deviceId(d),volumeA:sourceVolume(d,\"A\"),volumeB:sourceVolume(d,\"B\"),mutedA:sourceMuted(d,\"A\"),mutedB:sourceMuted(d,\"B\")})).filter(x=>x.name&&x.id);","  const sources=sourceDevices.map(d=>({name:deviceName(d),id:deviceId(d),volumeA:sourceVolume(d,\"A\"),volumeB:sourceVolume(d,\"B\"),mutedA:sourceMuted(d,\"A\"),mutedB:sourceMuted(d,\"B\"),linked:sourceLinked(d)})).filter(x=>x.name&&x.id);","scene source snapshot");
replaceOnce("  const sourceActions=[ACTIONS.sourceVolUp,ACTIONS.sourceVolDown,ACTIONS.sourceSetVol,ACTIONS.sourceAVolUp,ACTIONS.sourceAVolDown,ACTIONS.sourceBVolUp,ACTIONS.sourceBVolDown,ACTIONS.sourceMute,ACTIONS.sourceMuteA,ACTIONS.sourceMuteB];\n  if(sourceActions.includes(a)){","  const sourceActions=[ACTIONS.sourceVolUp,ACTIONS.sourceVolDown,ACTIONS.sourceSetVol,ACTIONS.sourceAVolUp,ACTIONS.sourceAVolDown,ACTIONS.sourceBVolUp,ACTIONS.sourceBVolDown,ACTIONS.sourceMute,ACTIONS.sourceMuteA,ACTIONS.sourceMuteB];\n  if(a===ACTIONS.sourceLinkToggle){\n    const n=st.sourceName,d=findNamedSource(lastStatus,n),linked=sourceLinked(d);\n    setState(i.context,linked===true?1:0);\n    setTitle(i.context,`${n||\"Source\"}\\n${linked===null?\"?\":linked?\"LINKED\":\"UNLINKED\"}`);\n  } else if(sourceActions.includes(a)){","live key state");
replaceOnce("async function toggleSourceMute(i){const s=await refreshStatus(),n=i.settings.sourceName,mix=i.settings.mix||\"A\",src=findNamedSourceByName(s,n),id=src?.description?.id||src?.id;if(!src||!id){showAlert(i.context);return}const target=\"Target\"+mix,muted=sourceMuted(src,mix);const cmd=muted?{DelSourceMuteTarget:[id,target]}:{AddSourceMuteTarget:[id,target]};try{const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error(\"Source mute failed:\",e.message);showAlert(i.context)}}\nasync function setSourceVolume","async function toggleSourceMute(i){const s=await refreshStatus(),n=i.settings.sourceName,mix=i.settings.mix||\"A\",src=findNamedSourceByName(s,n),id=src?.description?.id||src?.id;if(!src||!id){showAlert(i.context);return}const target=\"Target\"+mix,muted=sourceMuted(src,mix);const cmd=muted?{DelSourceMuteTarget:[id,target]}:{AddSourceMuteTarget:[id,target]};try{const r=await pipeCommand({Pipewire:cmd});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error(\"Source mute failed:\",e.message);showAlert(i.context)}}\nasync function toggleSourceVolumeLink(i){const s=await refreshStatus(),n=i.settings.sourceName,src=findNamedSourceByName(s,n),id=deviceId(src),linked=sourceLinked(src);if(!src||!id||linked===null){showAlert(i.context);return}const next=!linked;try{const r=await pipeCommand({Pipewire:{SetSourceVolumeLinked:[id,next]}});if(!isOk(r)&&!JSON.stringify(r).includes(\"Requested State matches current state\"))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context)}catch(e){console.error(\"Source volume link toggle failed:\",e.message);showAlert(i.context)}}\nasync function setSourceVolume","toggle implementation");
replaceOnce("    if([\"sourceMute\",\"sourceVolume\"].includes(type)){\n      if(!sources.length)add(errors,idx,type,\"No sources selected\");\n      for(const name of sources)if(!findNamedSource(status,name))add(errors,idx,type,`Source not found: ${name}`);\n      if(type===\"sourceVolume\"&&!vol())add(errors,idx,type,\"Volume must be a number from 0 to 100\");","    if([\"sourceMute\",\"sourceVolume\",\"sourceVolumeLink\"].includes(type)){\n      if(!sources.length)add(errors,idx,type,\"No sources selected\");\n      for(const name of sources)if(!findNamedSource(status,name))add(errors,idx,type,`Source not found: ${name}`);\n      if(type===\"sourceVolume\"&&!vol())add(errors,idx,type,\"Volume must be a number from 0 to 100\");\n      if(type===\"sourceVolumeLink\"&&!['linked','unlinked'].includes(op.state))add(errors,idx,type,\"Link state must be linked or unlinked\");","scene validation");
replaceOnce("  if(type===\"sourceMute\"){","  if(type===\"sourceVolumeLink\"){\n    const linked=op.state!==\"unlinked\";\n    for(const name of sceneNames(op.sources)){\n      const src=findNamedSource(status,name),id=deviceId(src);if(!id)throw new Error(`Scene source not found: ${name}`);\n      const current=sourceLinked(src);if(current===null)throw new Error(`Scene source link state unavailable: ${name}`);\n      if(current===linked)continue;\n      const r=await pipeCommand({Pipewire:{SetSourceVolumeLinked:[id,linked]}});\n      if(!isOk(r)&&!JSON.stringify(r).includes(\"Requested State matches current state\"))throw new Error(`${name}: ${JSON.stringify(r)}`);\n    }\n    return;\n  }\n  if(type===\"sourceMute\"){","scene execution");
replaceOnce("  if(type===\"sourceMute\")return `Source ${op?.mix===\"B\"?\"B\":\"A\"} ${op?.state===\"unmuted\"?\"unmute\":\"mute\"}: ${list(sources)}`;\n  if(type===\"targetMute\")","  if(type===\"sourceMute\")return `Source ${op?.mix===\"B\"?\"B\":\"A\"} ${op?.state===\"unmuted\"?\"unmute\":\"mute\"}: ${list(sources)}`;\n  if(type===\"sourceVolumeLink\")return `Source volume ${op?.state===\"unlinked\"?\"unlink\":\"link\"}: ${list(sources)}`;\n  if(type===\"targetMute\")","scene description");
replaceOnce("      case ACTIONS.sourceMuteB: return toggleSourceMuteForced(i,\"B\");\n      case ACTIONS.targetMixA:","      case ACTIONS.sourceMuteB: return toggleSourceMuteForced(i,\"B\");\n      case ACTIONS.sourceLinkToggle: return toggleSourceVolumeLink(i);\n      case ACTIONS.targetMixA:","key handler");


// v0.16.0 Smart Scenes: declarative conditions, waits, and per-step failure policy.
replaceOnce("function sceneAppMatches(a,d){return !!(a&&d&&a.name===d.name&&(!d.process||a.process===d.process)&&(!d.deviceType||String(a.deviceType).toLowerCase()===String(d.deviceType).toLowerCase()))}",`function sceneAppProcessKey(v){return String(v??"").trim().replace(/\s+\(deleted\)$/i,"").toLowerCase()}
function sceneAppMatches(a,d){return !!(a&&d&&a.name===d.name&&(!d.process||sceneAppProcessKey(a.process)===sceneAppProcessKey(d.process))&&(!d.deviceType||String(a.deviceType).toLowerCase()===String(d.deviceType).toLowerCase()))}`,"stable application process matching");
replaceOnce("function sceneAppLabel(d){return `${d?.name||\"Application\"}${d?.process?` (${d.process})`:\"\"}${d?.deviceType?` [${d.deviceType}]`:\"\"}`}\nfunction validateSceneOperations",`function sceneAppLabel(d){return \`${'${d?.name||"Application"}'}${'${d?.process?` (${d.process})`:""}'}${'${d?.deviceType?` [${d.deviceType}]`:""}'}\`}
function sceneConditionSpec(op){
  const raw=op?.condition;
  if(raw===undefined||raw===null)return {type:"always",application:null};
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {type:"invalid",application:null};
  const type=String(raw.type||"always");
  return {type,application:sceneAppDescriptor(raw.application)};
}
function sceneFailurePolicy(op){return op?.onFailure==="continue"?"continue":"stop"}
function sceneWaitMs(op){const n=Number(op?.milliseconds);return Number.isFinite(n)?Math.round(n):null}
function sceneConditionEvaluation(op,status){
  const c=sceneConditionSpec(op);
  if(c.type==="always")return {met:true,label:"Always"};
  const label=sceneAppLabel(c.application);
  const running=!!(c.application&&applications(status).some(a=>sceneAppMatches(a,c.application)));
  if(c.type==="applicationRunning")return {met:running,label:\`Application running: ${'${label}'}\`};
  if(c.type==="applicationNotRunning")return {met:!running,label:\`Application not running: ${'${label}'}\`};
  return {met:false,label:"Invalid condition"};
}
function sceneSmartDescription(op){
  const base=sceneOperationDescription(op),c=sceneConditionSpec(op),failure=sceneFailurePolicy(op);
  let prefix="";
  if(c.type==="applicationRunning")prefix=\`If ${'${sceneAppLabel(c.application)}'} is running: \`;
  else if(c.type==="applicationNotRunning")prefix=\`If ${'${sceneAppLabel(c.application)}'} is not running: \`;
  return prefix+base+(failure==="continue"?" [continue on failure]":"");
}
function validateSceneOperations`,"smart scene helpers");
replaceOnce("    const sources=sceneNames(op.sources),targets=sceneNames(op.targets),vol=()=>{const n=Number(op.volume);return String(op.volume??\"\").trim()!==\"\"&&Number.isFinite(n)&&n>=0&&n<=100};\n    if([\"sourceMute\",\"sourceVolume\",\"sourceVolumeLink\"].includes(type)){",`    const sources=sceneNames(op.sources),targets=sceneNames(op.targets),vol=()=>{const n=Number(op.volume);return String(op.volume??"").trim()!==""&&Number.isFinite(n)&&n>=0&&n<=100};
    const condition=sceneConditionSpec(op);
    if(!["always","applicationRunning","applicationNotRunning"].includes(condition.type))add(errors,idx,type,"Condition must be Always, Application running, or Application not running");
    if(["applicationRunning","applicationNotRunning"].includes(condition.type)&&!condition.application)add(errors,idx,type,"Application condition requires an application descriptor");
    if(op.onFailure!==undefined&&!['stop','continue'].includes(op.onFailure))add(errors,idx,type,"Failure policy must be stop or continue");
    if(type==="wait"){
      const ms=sceneWaitMs(op);
      if(ms===null||ms<0||ms>60000)add(errors,idx,type,"Wait must be between 0 and 60000 milliseconds");
    }else if(["sourceMute","sourceVolume","sourceVolumeLink"].includes(type)){`,"smart scene validation");
replaceOnce("  const type=String(op.type||\"\");\n  if(type===\"sourceVolumeLink\"){",`  const type=String(op.type||"");
  if(type==="wait"){
    const ms=sceneWaitMs(op);if(ms===null||ms<0||ms>60000)throw new Error("Invalid Scene wait");
    if(ms>0)await new Promise(resolve=>setTimeout(resolve,ms));
    return;
  }
  if(type==="sourceVolumeLink"){`,"wait execution");
replaceOnce("  if(type===\"sourceMute\")return `Source ${op?.mix===\"B\"?\"B\":\"A\"} ${op?.state===\"unmuted\"?\"unmute\":\"mute\"}: ${list(sources)}`;\n  if(type===\"sourceVolumeLink\")",`  if(type==="wait")return \`Wait ${'${sceneWaitMs(op)}'} ms\`;
  if(type==="sourceMute")return \`Source ${'${op?.mix==="B"?"B":"A"}'} ${'${op?.state==="unmuted"?"unmute":"mute"}'}: ${'${list(sources)}'}\`;
  if(type==="sourceVolumeLink")`,"wait description");
replaceOnce("    let activeStep=0;", "    let activeStep=0,continuedFailures=0;");
replaceOnce(`      for(let idx=0;idx<ops.length;idx++){
        activeStep=idx+1;
        const desc=sceneOperationDescription(ops[idx]);
        console.log(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} START ${'${desc}'}\`);
        const stepStarted=Date.now();
        try{
          await executeSceneOperation(ops[idx],status);
          console.log(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} OK ${'${desc}'} (${'${Date.now()-stepStarted}'}ms)\`);
        }catch(e){
          console.error(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} FAILED ${'${desc}'}: ${'${e.message}'}\`);
          throw e;
        }
        status=await refreshStatus()||status;
      }
      await refreshStatus();
      console.log(\`[Scene] COMPLETE name=${'${JSON.stringify(sceneName)}'} operations=${'${ops.length}'} duration=${'${Date.now()-started}'}ms\`);
      showOk(i.context);`, `      for(let idx=0;idx<ops.length;idx++){
        activeStep=idx+1;
        const op=ops[idx],desc=sceneSmartDescription(op),condition=sceneConditionEvaluation(op,status);
        if(!condition.met){
          console.log(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} SKIP condition not met (${ '${condition.label}' }): ${'${desc}'}\`);
          status=await refreshStatus()||status;
          continue;
        }
        console.log(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} START ${'${desc}'}\`);
        const stepStarted=Date.now();
        try{
          await executeSceneOperation(op,status);
          console.log(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} OK ${'${desc}'} (${'${Date.now()-stepStarted}'}ms)\`);
        }catch(e){
          const policy=sceneFailurePolicy(op);
          console.error(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} FAILED ${'${desc}'}: ${'${e.message}'}\`);
          if(policy==="continue"){continuedFailures++;console.warn(\`[Scene] STEP ${'${activeStep}'}/${'${ops.length}'} CONTINUE after failure\`)}
          else throw e;
        }
        status=await refreshStatus()||status;
      }
      await refreshStatus();
      if(continuedFailures){
        console.warn(\`[Scene] COMPLETE WITH ERRORS name=${'${JSON.stringify(sceneName)}'} operations=${'${ops.length}'} continuedFailures=${'${continuedFailures}'} duration=${'${Date.now()-started}'}ms\`);
        showAlert(i.context);
      }else{
        console.log(\`[Scene] COMPLETE name=${'${JSON.stringify(sceneName)}'} operations=${'${ops.length}'} duration=${'${Date.now()-started}'}ms\`);
        showOk(i.context);
      }`,"smart scene execution loop");


// v0.17.0 application robustness: stable identity fallback, ambiguity protection,
// and cached PI application discovery shared by all open Property Inspectors.
replaceOnce("let ws=null,lastStatus=null,statusRefreshInFlight=false,statusTimer=null,reconnectTimer=null,reconnectDelay=RECONNECT_INITIAL_MS,socketGeneration=0;",`let ws=null,lastStatus=null,lastStatusAt=0,statusRefreshInFlight=false,statusTimer=null,reconnectTimer=null,reconnectDelay=RECONNECT_INITIAL_MS,socketGeneration=0;\nconst APPLICATION_CACHE_MAX_AGE_MS=3500;`,"application status cache state");
replaceOnce("lastStatus=s;updateAll();return s", "lastStatus=s;lastStatusAt=Date.now();updateAll();return s", "status cache timestamp");
replaceOnce("function appForSettings(s,st){return applications(s).find(x=>x.name===st.name&&(!st.process||x.process===st.process)&&(!st.deviceType||String(x.deviceType).toLowerCase()===String(st.deviceType).toLowerCase()))||null}",`function appIdentityNameKey(v){return String(v??"").trim().toLowerCase()}
function appIdentityProcessKey(v){let s=String(v??"").trim().replace(/\\s+\\(deleted\\)$/i,"").replace(/\\\\/g,"/");if(s.includes("/"))s=s.split("/").pop();return s.toLowerCase()}
function appIdentityTypeKey(v){return String(v??"").trim().toLowerCase()}
function appIdentityScore(a,d){if(!a||!d)return -1;const dt=appIdentityTypeKey(d.deviceType),at=appIdentityTypeKey(a.deviceType);if(dt&&at&&dt!==at)return -1;const an=appIdentityNameKey(a.name),dn=appIdentityNameKey(d.name),ap=appIdentityProcessKey(a.process),dp=appIdentityProcessKey(d.process),nameEq=!!(an&&dn&&an===dn),procEq=!!(ap&&dp&&ap===dp);if(nameEq&&procEq)return 100;if(procEq)return 80;if(nameEq)return 60;return -1}
function appIdentityKey(a){return \`${'${appIdentityTypeKey(a?.deviceType)}'}|${'${appIdentityProcessKey(a?.process)}'}|${'${appIdentityNameKey(a?.name)}'}\`}
function appResolveMany(list,d){const rows=(Array.isArray(list)?list:[]).map(a=>({a,score:appIdentityScore(a,d)})).filter(x=>x.score>=0);if(!rows.length)return [];const best=Math.max(...rows.map(x=>x.score)),top=rows.filter(x=>x.score===best),groups=new Map();for(const row of top){const k=appIdentityKey(row.a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row.a)}return groups.size===1?[...groups.values()][0]:[]}
function appForSettings(s,st){return appResolveMany(applications(s),st)[0]||null}`,"application identity resolver");
replaceOnce("async function appVolumeStep(i,delta){const s=await refreshStatus(),a=applications(s).find(x=>x.name===i.settings.name&&(!i.settings.process||x.process===i.settings.process));", "async function appVolumeStep(i,delta){const s=await refreshStatus(),a=appForSettings(s,i.settings);", "application volume identity");
replaceOnce("async function toggleAppMute(i){const s=await refreshStatus(),a=applications(s).find(x=>x.name===i.settings.name&&(!i.settings.process||x.process===i.settings.process));", "async function toggleAppMute(i){const s=await refreshStatus(),a=appForSettings(s,i.settings);", "application mute identity");
replaceOnce(`function sceneAppProcessKey(v){return String(v??"").trim().replace(/s+(deleted)$/i,"").toLowerCase()}
function sceneAppMatches(a,d){return !!(a&&d&&a.name===d.name&&(!d.process||sceneAppProcessKey(a.process)===sceneAppProcessKey(d.process))&&(!d.deviceType||String(a.deviceType).toLowerCase()===String(d.deviceType).toLowerCase()))}`, `function sceneAppProcessKey(v){return appIdentityProcessKey(v)}
function sceneAppMatches(a,d){return appIdentityScore(a,d)>=0}`, "scene application identity");
source=source.split("applications(status).filter(a=>sceneAppMatches(a,d))").join("appResolveMany(applications(status),d)");
source=source.split("applications(status).some(a=>sceneAppMatches(a,c.application))").join("appResolveMany(applications(status),c.application).length>0");
replaceOnce("    if([\"getSceneData\",\"getTargets\",\"getApplications\",\"getDevices\",\"validateScene\"].includes(p.command)) s=await refreshStatus();",`    if([\"getSceneData\",\"getTargets\",\"getDevices\",\"validateScene\"].includes(p.command)) s=await refreshStatus();\n    else if(p.command===\"getApplications\"&&(!s||Date.now()-lastStatusAt>APPLICATION_CACHE_MAX_AGE_MS)) s=await refreshStatus();`,"cached application discovery");

const patched=new Module(filename,module);
patched.filename=filename;
patched.paths=module.paths;
patched._compile(source,filename);
