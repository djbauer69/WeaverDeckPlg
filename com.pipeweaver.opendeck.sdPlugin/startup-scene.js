"use strict";
const fs=require("fs"),os=require("os"),path=require("path");
const MAX_BYTES=2*1024*1024;
function configFile(){return path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),".local/share"),"weaverdeck","startup-scene-v1.json")}
function scenePath(value){let p=String(value||"").trim();if(p.startsWith("~/"))p=path.join(os.homedir(),p.slice(2));if(!path.isAbsolute(p))throw new Error("Enter an absolute Scene file path (or ~/Downloads/…)");return path.normalize(p)}
function readScene(filename){
 const p=scenePath(filename),st=fs.statSync(p);if(!st.isFile())throw new Error("Scene path is not a regular file");if(st.size>MAX_BYTES)throw new Error("Scene file exceeds 2 MiB");
 const obj=JSON.parse(fs.readFileSync(p,"utf8"));
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj.format!=="WeaverDeckScene"||Number(obj.formatVersion)!==1||Number(obj.sceneVersion)!==1||!Array.isArray(obj.operations)||!obj.operations.length)throw new Error("Select a non-empty WeaverDeck Scene file (format version 1)");
 return {name:String(obj.name||path.basename(p)),operations:obj.operations};
}
function create(api,options={}){
 const file=options.configFile||configFile(),read=options.readScene||readScene,schedule=options.schedule||setTimeout,cancel=options.cancel||clearTimeout;
 let settings={enabled:false,filePath:"",settleSeconds:2},phase="Disabled",message="Startup Scene is disabled",connected=false,attempted=false,timer=null,busy=false,generation=0,readyCount=0;
 try{if(fs.existsSync(file)){const c=JSON.parse(fs.readFileSync(file,"utf8"));if(c.version!==1||typeof c.enabled!=="boolean")throw new Error("Invalid startup configuration");settings={enabled:c.enabled,filePath:c.filePath||"",settleSeconds:Number(c.settleSeconds??2)};if(!Number.isFinite(settings.settleSeconds)||settings.settleSeconds<0||settings.settleSeconds>60)throw new Error("Invalid settle delay");if(settings.enabled)scenePath(settings.filePath)}}catch(e){settings.enabled=false;phase="Failed";message="Startup configuration: "+e.message;api.log(message)}
 let armed=settings.enabled;
 if(armed){phase="Waiting";message="Waiting for OpenDeck and PipeWeaver"}
 function report(p,m){phase=p;message=m;api.log(m);api.changed?.()}
 function snapshot(){return {...settings,phase,message}}
 function later(fn,ms){if(timer!==null)cancel(timer);timer=schedule(()=>{timer=null;void fn()},ms)}
 async function perform(context){
  if(busy)throw new Error("A startup Scene is already running");busy=true;
  try{const scene=read(settings.filePath);report("Running","Running saved Scene: "+scene.name);const ok=await api.runScene({context,settings:scene});if(ok!==true)throw new Error("Scene failed or completed with errors; see plugin log");report("Complete","Completed saved Scene: "+scene.name);return true}
  catch(e){report("Failed",e.message);throw e}
  finally{busy=false}
 }
 async function poll(token=generation){
  if(token!==generation||!connected||!armed||attempted)return;
  let status=null;try{status=await api.status()}catch(_){}
  if(token!==generation||!connected||!armed||attempted)return;
  if(!status?.audio?.profile){readyCount=0;later(()=>poll(token),1000);return}
  if(++readyCount<2){later(()=>poll(token),1000);return}
  report("Waiting","PipeWeaver ready; waiting "+settings.settleSeconds+" seconds before startup Scene");
  later(async()=>{
   if(token!==generation||!connected||!armed||attempted)return;
   let ready=null;try{ready=await api.status()}catch(_){}
   if(token!==generation||!connected||!armed||attempted)return;
   if(!ready?.audio?.profile){readyCount=0;later(()=>poll(token),1000);return}
   attempted=true;armed=false;
   try{await perform("weaverdeck-startup")}catch(_){} // Never replay a partially applied Scene automatically.
  },settings.settleSeconds*1000);
 }
 return {
  snapshot,
  connected(){connected=true;if(armed&&!attempted&&timer===null)later(()=>poll(generation),1000)},
  disconnected(){connected=false;generation++;readyCount=0;if(timer!==null){cancel(timer);timer=null}},
  save(raw){
   if(busy)throw new Error("Wait for the running Scene to finish before changing startup settings");
   const enabled=raw.enabled===true,delay=Number(raw.settleSeconds??2);if(!Number.isFinite(delay)||delay<0||delay>60)throw new Error("Settle delay must be 0–60 seconds");
   const filePath=String(raw.filePath||"").trim()?scenePath(raw.filePath):"";
   if(enabled)read(filePath); // Validate local file before enabling automatic execution.
   const next={enabled,filePath,settleSeconds:delay};fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+".tmp-"+process.pid;
   try{fs.writeFileSync(temp,JSON.stringify({version:1,...next},null,2)+"\n",{mode:0o600});fs.renameSync(temp,file)}finally{try{fs.unlinkSync(temp)}catch(_){}}
   settings=next;armed=false;generation++;readyCount=0;if(timer!==null){cancel(timer);timer=null}
   report(enabled?"Saved":"Disabled",enabled?"Saved for the next OpenDeck/plugin startup":"Startup Scene disabled");return snapshot();
  },
  async check(filename){const scene=read(filename);const s=await api.status();if(!s)throw new Error("File is readable, but PipeWeaver is unavailable for validation");const result=api.validate(scene.operations,s);return {name:scene.name,steps:scene.operations.length,...result}},
  async runNow(context){if(!connected)throw new Error("OpenDeck is not connected");if(!settings.filePath)throw new Error("Save a Scene file path first");if(busy)throw new Error("A startup Scene is already running");armed=false;attempted=true;generation++;if(timer!==null){cancel(timer);timer=null}return perform(context)}
 };
}
module.exports={create,readScene,scenePath};
