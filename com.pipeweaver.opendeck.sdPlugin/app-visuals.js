"use strict";

/* v0.12.2 visual-only application icon resolver.
 * This module reads Linux desktop/icon metadata only for artwork. It never
 * manipulates PipeWire, PulseAudio or WirePlumber. Live application state is
 * read from PipeWeaver's HTTP API.
 */
const http=require("http");
const fs=require("fs");
const path=require("path");
const os=require("os");

const PIPEWEAVER_URL=process.env.PIPEWEAVER_URL||"http://127.0.0.1:14565/api/command";
const REFRESH_MS=2000;
const APP_ACTIONS=new Set([
  "com.pipeweaver.opendeck.appmute",
  "com.pipeweaver.opendeck.appvolup",
  "com.pipeweaver.opendeck.appvoldown",
  "com.pipeweaver.opendeck.appsetvolume",
  "com.pipeweaver.opendeck.approuteon",
  "com.pipeweaver.opendeck.approuteoff",
  "com.pipeweaver.opendeck.approutetoggle"
]);
const BUILTIN_APP_CATALOG={
  spotify:{aliases:["spotify"],asset:"icons/apps/spotify.svg",label:"S"},
  discord:{aliases:["discord","discordcanary","discordptb"],asset:"icons/apps/discord.svg",label:"D"},
  firefox:{aliases:["firefox","firefoxbin","mozilla firefox"],label:"F"},
  brave:{aliases:["brave","bravebrowser","bravedesktop"],label:"B"},
  steam:{aliases:["steam","steamwebhelper"],label:"ST"},
  obs:{aliases:["obs","obsstudio","obs studio"],label:"OBS"},
  vlc:{aliases:["vlc","vlc media player"],label:"VLC"},
  chromium:{aliases:["chromium","chromiumbrowser"],label:"C"},
  chrome:{aliases:["googlechrome","google chrome","chrome"],label:"G"},
  slack:{aliases:["slack"],label:"S"},
  zoom:{aliases:["zoom","zoomus"],label:"Z"},
  teams:{aliases:["microsoftteams","microsoft teams","teams"],label:"T"}
};
const DESKTOP_DIRS=[
  path.join(os.homedir(),".local/share/applications"),
  path.join(os.homedir(),".local/share/flatpak/exports/share/applications"),
  "/usr/local/share/applications",
  "/usr/share/applications",
  "/var/lib/flatpak/exports/share/applications"
];
const ICON_ROOTS=[
  path.join(os.homedir(),".local/share/icons"),
  path.join(os.homedir(),".icons"),
  path.join(os.homedir(),".local/share/flatpak/exports/share/icons"),
  "/usr/local/share/icons",
  "/usr/share/icons",
  "/usr/share/pixmaps",
  "/var/lib/flatpak/exports/share/icons"
];

function norm(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"")}
function esc(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function dataUri(mime,data){return `data:${mime};base64,${Buffer.from(data).toString("base64")}`}
function deviceId(d){return d?.id||d?.description?.id||null}
function deviceName(d){return d?.name||d?.description?.name||""}
function asList(v){if(Array.isArray(v))return v;if(v&&typeof v==="object")return Object.values(v);return []}
function configuredGroups(c){if(!c)return [];return [c.virtual_devices,c.virtualDevices,c.VirtualDevices,c.physical_devices,c.physicalDevices,c.PhysicalDevices].flatMap(asList)}
function collection(status,type){
  const devices=status?.audio?.profile?.devices||{};
  const key=type==="target"?"targets":"sources";
  return devices?.[key]||devices?.[key[0].toUpperCase()+key.slice(1)]||devices?.[type]||devices?.[type[0].toUpperCase()+type.slice(1)]||null;
}
function namedDevices(status,type){return configuredGroups(collection(status,type))}
function appDestination(status,app,name){
  const type=String(app?.deviceType||"").toLowerCase();
  const rows=namedDevices(status,type==="target"?"target":"source");
  return rows.find(d=>deviceName(d)===name)||null;
}
function applications(status){
  const out=[],seen=new Set(),root=status?.audio?.applications;
  for(const [deviceType,processMap] of Object.entries(root&&typeof root==="object"?root:{})){
    for(const [process,nameMap] of Object.entries(processMap&&typeof processMap==="object"?processMap:{})){
      for(const [name,list] of Object.entries(nameMap&&typeof nameMap==="object"?nameMap:{})){
        for(const v of Array.isArray(list)?list:[list]){
          if(!v||typeof v!=="object")continue;
          const nodeId=Number.isInteger(v.node_id)?v.node_id:(Number.isInteger(v.nodeId)?v.nodeId:null);
          if(nodeId===null)continue;
          const key=`${deviceType}|${process}|${name}|${nodeId}`;if(seen.has(key))continue;seen.add(key);
          out.push({deviceType,process,name,nodeId,volume:Number.isFinite(v.volume)?Number(v.volume):null,muted:Boolean(v.muted),title:typeof v.title==="string"?v.title:"",targetId:typeof v.target_id==="string"?v.target_id:(typeof v.targetId==="string"?v.targetId:null)});
        }
      }
    }
  }
  return out;
}
function getStatus(){
  return new Promise((resolve,reject)=>{
    let u;try{u=new URL(PIPEWEAVER_URL)}catch(e){reject(e);return}
    const body=JSON.stringify("GetStatus");
    const req=http.request({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),Accept:"application/json"},timeout:3500},res=>{
      let text="";res.setEncoding("utf8");res.on("data",c=>text+=c);res.on("end",()=>{if(res.statusCode<200||res.statusCode>=300){reject(new Error(`PipeWeaver HTTP ${res.statusCode}`));return}try{const r=JSON.parse(text);resolve(r?.Status||r?.data?.Status||null)}catch(e){reject(e)}})
    });
    req.on("timeout",()=>req.destroy(new Error("PipeWeaver visual status timeout")));req.on("error",reject);req.write(body);req.end();
  });
}

function installApplicationVisuals(){
  const contexts=new Map(),sockets=new Set(),imageKeys=new Map(),iconCache=new Map();
  let desktopEntries=null,refreshTimer=null,refreshing=false;

  function send(ws,m){if(ws&&ws.readyState===1)try{ws.send(JSON.stringify(m))}catch(_){}}
  function setImage(ws,context,image){send(ws,{event:"setImage",context,payload:{image}})}
  function readDesktopEntries(){
    if(desktopEntries)return desktopEntries;
    const out=[];
    for(const dir of DESKTOP_DIRS){
      let files=[];try{files=fs.readdirSync(dir)}catch(_){continue}
      for(const file of files){
        if(!file.endsWith(".desktop"))continue;
        const full=path.join(dir,file);let text="";try{text=fs.readFileSync(full,"utf8")}catch(_){continue}
        const section=text.split("[Desktop Entry]")[1]?.split("\n[")[0]||"";
        const get=k=>{const m=section.match(new RegExp(`^${k}=(.*)$`,`m`));return m?m[1].trim():""};
        const name=get("Name"),exec=get("Exec"),icon=get("Icon"),wm=get("StartupWMClass");
        if(!name&&!exec&&!icon)continue;
        let execBase="";
        if(exec){
          const cleaned=exec.replace(/%[fFuUdDnNickvm]/g,"").trim();
          const parts=cleaned.match(/(?:[^\s\"]+|\"[^\"]*\")+/g)||[];
          const candidate=parts.find(x=>!/^env$/i.test(x)&&!x.includes("=")&&!/^flatpak$/i.test(path.basename(x.replace(/^\"|\"$/g,""))))||parts[0]||"";
          execBase=path.basename(candidate.replace(/^\"|\"$/g,"")).replace(/\.bin$/i,"");
        }
        out.push({name,execBase,icon,wm,file});
      }
    }
    desktopEntries=out;
    console.error(`[v0.12.2] application icon desktop entries: ${out.length}`);
    return out;
  }
  function builtinFor(app){
    const keys=[app?.process,app?.name,app?.title].map(norm).filter(Boolean);
    for(const [id,row] of Object.entries(BUILTIN_APP_CATALOG))if(keys.some(k=>row.aliases.map(norm).includes(k)))return {id,...row};
    return null;
  }
  function desktopFor(app){
    const p=norm(app?.process),n=norm(app?.name),t=norm(app?.title);let best=null,score=0;
    for(const e of readDesktopEntries()){
      const v={exec:norm(e.execBase),name:norm(e.name),wm:norm(e.wm),file:norm(e.file.replace(/\.desktop$/i,""))};let s=0;
      if(p&&v.exec===p)s=120;else if(p&&v.wm===p)s=115;else if(n&&v.name===n)s=110;else if(t&&v.name===t)s=105;else if(p&&v.file===p)s=100;else if(p&&v.exec&&(v.exec.includes(p)||p.includes(v.exec)))s=80;
      if(s>score){best=e;score=s}
    }
    return best;
  }
  function findIconFile(icon){
    if(!icon)return null;if(path.isAbsolute(icon)&&fs.existsSync(icon))return icon;
    const names=[icon,`${icon}.svg`,`${icon}.png`,`${icon}.jpg`,`${icon}.jpeg`,`${icon}.webp`],rels=[];
    for(const n of names){
      rels.push(n,`scalable/apps/${n}`,`512x512/apps/${n}`,`256x256/apps/${n}`,`128x128/apps/${n}`,`96x96/apps/${n}`,`64x64/apps/${n}`,`48x48/apps/${n}`);
      rels.push(`hicolor/${n}`,`hicolor/scalable/apps/${n}`,`hicolor/512x512/apps/${n}`,`hicolor/256x256/apps/${n}`,`hicolor/128x128/apps/${n}`,`hicolor/64x64/apps/${n}`);
    }
    for(const root of ICON_ROOTS)for(const rel of rels){const f=path.join(root,rel);try{if(fs.statSync(f).isFile())return f}catch(_){}}
    const wanted=new Set(names.map(x=>x.toLowerCase()));
    for(const root of ICON_ROOTS){
      const stack=[root];let visited=0;
      while(stack.length&&visited<10000){
        const dir=stack.pop();let rows=[];try{rows=fs.readdirSync(dir,{withFileTypes:true})}catch(_){continue}
        for(const row of rows){visited++;if(visited>=10000)break;const f=path.join(dir,row.name);if(row.isDirectory())stack.push(f);else if(wanted.has(row.name.toLowerCase()))return f}
      }
    }
    return null;
  }
  function fileData(file){
    if(!file)return null;
    try{const ext=path.extname(file).toLowerCase(),mime=ext===".svg"?"image/svg+xml":ext===".png"?"image/png":ext===".jpg"||ext===".jpeg"?"image/jpeg":ext===".webp"?"image/webp":null;return mime?dataUri(mime,fs.readFileSync(file)):null}catch(_){return null}
  }
  function iconSource(app){
    const key=`${app?.process||""}|${app?.name||""}|${app?.title||""}`;if(iconCache.has(key))return iconCache.get(key);
    const desktop=desktopFor(app),local=desktop?fileData(findIconFile(desktop.icon)):null,builtin=builtinFor(app),bundled=builtin?.asset?fileData(path.join(__dirname,builtin.asset)):null;
    const result={data:local||bundled||null,builtin,source:local?"desktop":bundled?"builtin":"generated",desktop:desktop?.file||null};iconCache.set(key,result);
    console.error(`[v0.12.2] application icon resolved: ${app?.name||app?.process||"Application"} source=${result.source}${result.desktop?` desktop=${result.desktop}`:""}${builtin?` builtin=${builtin.id}`:""}`);
    return result;
  }
  function badge(app,builtin){
    const raw=(builtin?.label||String(app?.name||app?.process||"APP").split(/\s+/).map(x=>x[0]||"").join("").slice(0,3)||"APP").toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144"><rect width="144" height="144" rx="28" fill="#20242c"/><text x="72" y="84" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${raw.length>2?34:48}" fill="white">${esc(raw)}</text></svg>`;
  }
  function artwork(app,mode,state){
    const resolved=iconSource(app),src=resolved.data||dataUri("image/svg+xml",badge(app,resolved.builtin));let bg="#30343b",accent="#e3e2e6",mark="";
    if(mode==="mute"){bg=state?"#b3261e":"#18794e";accent=state?"#ffdad6":"#b7f7d8";mark=state?"M":""}
    else if(mode==="route"){bg=state?"#165d9c":"#42464d";accent=state?"#d1e4ff":"#d9dde4";mark=state?"→":"×"}
    else {mark=Number.isFinite(app?.volume)?`${Math.round(app.volume)}%`:""}
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144"><rect width="144" height="144" rx="26" fill="${bg}"/><image href="${esc(src)}" x="10" y="8" width="124" height="124" preserveAspectRatio="xMidYMid meet"/>${mark?`<rect x="84" y="101" width="52" height="34" rx="12" fill="#111820" fill-opacity=".90"/><text x="110" y="124" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${mark.length>2?15:22}" fill="${accent}">${esc(mark)}</text>`:""}</svg>`;
    return dataUri("image/svg+xml",svg);
  }
  function appNameKey(v){return String(v??"").trim().toLowerCase()}
  function appProcessKey(v){let s=String(v??"").trim().replace(/\s+\(deleted\)$/i,"").replace(/\\/g,"/");if(s.includes("/"))s=s.split("/").pop();return s.toLowerCase()}
  function appTypeKey(v){return String(v??"").trim().toLowerCase()}
  function appIdentityScore(app,settings){if(!app||!settings)return -1;const dt=appTypeKey(settings.deviceType),at=appTypeKey(app.deviceType);if(dt&&at&&dt!==at)return -1;const an=appNameKey(app.name),dn=appNameKey(settings.name),ap=appProcessKey(app.process),dp=appProcessKey(settings.process),nameEq=!!(an&&dn&&an===dn),procEq=!!(ap&&dp&&ap===dp);if(nameEq&&procEq)return 100;if(procEq)return 80;if(nameEq)return 60;return -1}
  function appIdentityKey(app){return `${appTypeKey(app?.deviceType)}|${appProcessKey(app?.process)}|${appNameKey(app?.name)}`}
  function resolveApp(list,settings){const rows=(list||[]).map(a=>({a,score:appIdentityScore(a,settings)})).filter(x=>x.score>=0);if(!rows.length)return null;const best=Math.max(...rows.map(x=>x.score)),top=rows.filter(x=>x.score===best),groups=new Map();for(const row of top){const k=appIdentityKey(row.a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row.a)}if(groups.size!==1)return null;return [...groups.values()][0][0]||null}
  function modeFor(action){if(action==="com.pipeweaver.opendeck.appmute")return "mute";if(action.includes("approute"))return "route";return "volume"}
  function stateFor(status,app,ctx){
    const mode=modeFor(ctx.action);if(mode==="mute")return app.muted;if(mode==="volume")return app.volume;
    const dest=appDestination(status,app,ctx.settings.targetName);return !!(dest&&app.targetId&&app.targetId===deviceId(dest));
  }
  async function refresh(ws){
    if(refreshing||!contexts.size)return;refreshing=true;
    try{
      const status=await getStatus();if(!status)return;const apps=applications(status);
      for(const [context,ctx] of contexts){
        const app=resolveApp(apps,ctx.settings);
        if(!app){if(imageKeys.has(context)){imageKeys.delete(context);setImage(ws,context,null)}continue}
        const mode=modeFor(ctx.action),state=stateFor(status,app,ctx),key=`${mode}|${state}|${app.volume}|${app.process}|${app.name}|${ctx.settings.targetName||""}`;
        if(imageKeys.get(context)===key)continue;imageKeys.set(context,key);setImage(ws,context,artwork(app,mode,state));
      }
    }catch(e){console.error("[v0.12.2] application visuals refresh failed:",e?.message||e)}finally{refreshing=false}
  }
  function schedule(){if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{const ws=[...sockets].find(x=>x.readyState===1);if(ws)await refresh(ws);schedule()},REFRESH_MS)}
  function attachSocket(ws){sockets.add(ws);schedule()}
  function detachSocket(ws){sockets.delete(ws)}
  function handleIncoming(ws,ev){
    let m;try{m=JSON.parse(typeof ev.data==="string"?ev.data:ev.data.toString())}catch(_){return}
    if(m.event==="willAppear"&&APP_ACTIONS.has(m.action)){contexts.set(m.context,{action:m.action,settings:{...(m.payload?.settings||{})}});setTimeout(()=>refresh(ws),20)}
    else if(m.event==="didReceiveSettings"&&contexts.has(m.context)){const c=contexts.get(m.context);c.settings={...(m.payload?.settings||{})};imageKeys.delete(m.context);setTimeout(()=>refresh(ws),20)}
    else if(m.event==="willDisappear"&&contexts.has(m.context)){contexts.delete(m.context);imageKeys.delete(m.context)}
    else if(m.event==="keyDown"&&contexts.has(m.context)){setTimeout(()=>refresh(ws),180)}
  }
  function ownsContext(context){return contexts.has(context)}
  function customTitleFor(context){
    const value=contexts.get(context)?.settings?.buttonText;
    return typeof value==="string"?value.trim():"";
  }
  return {attachSocket,detachSocket,handleIncoming,ownsContext,customTitleFor};
}

module.exports={installApplicationVisuals};
