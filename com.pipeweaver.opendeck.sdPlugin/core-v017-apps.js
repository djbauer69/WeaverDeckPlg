"use strict";

function apply(source){
  function replaceOnce(before,after,label){
    const first=source.indexOf(before);
    if(first<0)throw new Error(`v0.17.0 core patch failed: ${label} pattern not found`);
    if(source.indexOf(before,first+before.length)>=0)throw new Error(`v0.17.0 core patch failed: ${label} pattern is ambiguous`);
    source=source.slice(0,first)+after+source.slice(first+before.length);
  }
replaceOnce("let ws=null,lastStatus=null,statusRefreshInFlight=false,statusTimer=null,reconnectTimer=null,reconnectDelay=RECONNECT_INITIAL_MS,socketGeneration=0;",`let ws=null,lastStatus=null,lastStatusAt=0,statusRefreshInFlight=false,statusTimer=null,reconnectTimer=null,reconnectDelay=RECONNECT_INITIAL_MS,socketGeneration=0;\nconst APPLICATION_CACHE_MAX_AGE_MS=3500;`,"application status cache state");
replaceOnce("lastStatus=s;updateAll();return s", "lastStatus=s;lastStatusAt=Date.now();updateAll();return s", "status cache timestamp");
replaceOnce("function appForSettings(s,st){return applications(s).find(x=>x.name===st.name&&(!st.process||x.process===st.process)&&(!st.deviceType||String(x.deviceType).toLowerCase()===String(st.deviceType).toLowerCase()))||null}",`function appIdentityNameKey(v){return String(v??\"\").trim().toLowerCase()}\nfunction appIdentityProcessKey(v){let s=String(v??\"\").trim().replace(/\\s+\\(deleted\\)$/i,\"\").replace(/\\\\/g,\"/\");if(s.includes(\"/\"))s=s.split(\"/\").pop();return s.toLowerCase()}\nfunction appIdentityTypeKey(v){return String(v??\"\").trim().toLowerCase()}\nfunction appIdentityScore(a,d){if(!a||!d)return -1;const dt=appIdentityTypeKey(d.deviceType),at=appIdentityTypeKey(a.deviceType);if(dt&&at&&dt!==at)return -1;const an=appIdentityNameKey(a.name),dn=appIdentityNameKey(d.name),ap=appIdentityProcessKey(a.process),dp=appIdentityProcessKey(d.process),nameEq=!!(an&&dn&&an===dn),procEq=!!(ap&&dp&&ap===dp);if(nameEq&&procEq)return 100;if(procEq)return 80;if(nameEq)return 60;return -1}\nfunction appIdentityKey(a){return \`${'${appIdentityTypeKey(a?.deviceType)}'}|${'${appIdentityProcessKey(a?.process)}'}|${'${appIdentityNameKey(a?.name)}'}\`}\nfunction appResolveMany(list,d){const rows=(Array.isArray(list)?list:[]).map(a=>({a,score:appIdentityScore(a,d)})).filter(x=>x.score>=0);if(!rows.length)return [];const best=Math.max(...rows.map(x=>x.score)),top=rows.filter(x=>x.score===best),groups=new Map();for(const row of top){const k=appIdentityKey(row.a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row.a)}return groups.size===1?[...groups.values()][0]:[]}\nfunction appForSettings(s,st){return appResolveMany(applications(s),st)[0]||null}`,"application identity resolver");
replaceOnce("async function appVolumeStep(i,delta){const s=await refreshStatus(),a=applications(s).find(x=>x.name===i.settings.name&&(!i.settings.process||x.process===i.settings.process));", "async function appVolumeStep(i,delta){const s=await refreshStatus(),a=appForSettings(s,i.settings);", "application volume identity");
replaceOnce("async function toggleAppMute(i){const s=await refreshStatus(),a=applications(s).find(x=>x.name===i.settings.name&&(!i.settings.process||x.process===i.settings.process));", "async function toggleAppMute(i){const s=await refreshStatus(),a=appForSettings(s,i.settings);", "application mute identity");
replaceOnce(`function sceneAppProcessKey(v){return String(v??"").trim().replace(/s+(deleted)$/i,"").toLowerCase()}
function sceneAppMatches(a,d){return !!(a&&d&&a.name===d.name&&(!d.process||sceneAppProcessKey(a.process)===sceneAppProcessKey(d.process))&&(!d.deviceType||String(a.deviceType).toLowerCase()===String(d.deviceType).toLowerCase()))}`, `function sceneAppProcessKey(v){return appIdentityProcessKey(v)}
function sceneAppMatches(a,d){return appIdentityScore(a,d)>=0}`, "scene application identity");
source=source.split("applications(status).filter(a=>sceneAppMatches(a,d))").join("appResolveMany(applications(status),d)");
source=source.split("applications(status).some(a=>sceneAppMatches(a,c.application))").join("appResolveMany(applications(status),c.application).length>0");
replaceOnce("    if([\"getSceneData\",\"getTargets\",\"getApplications\",\"getDevices\",\"validateScene\"].includes(p.command)) s=await refreshStatus();",`    if([\"getSceneData\",\"getTargets\",\"getDevices\",\"validateScene\"].includes(p.command)) s=await refreshStatus();\n    else if(p.command===\"getApplications\"&&(!s||Date.now()-lastStatusAt>APPLICATION_CACHE_MAX_AGE_MS)) s=await refreshStatus();`,"cached application discovery");
  return source;
}

module.exports={apply};
