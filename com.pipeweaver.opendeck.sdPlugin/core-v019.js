"use strict";
const path=require("path"),Module=require("module");
function build(){
 let source=require("./core-v018").build();
 function replace(before,after){if(source.split(before).length!==2)throw new Error("v0.19 core anchor missing or ambiguous: "+before);source=source.replace(before,after)}
 replace('function send(m){','function send(m){if(m.context==="weaverdeck-startup")return;');
 replace('function updateInstance(i){',`const STARTUP_ACTION="com.pipeweaver.opendeck.scenestartup";
const startup019=require("./startup-scene").create({status:refreshStatus,runScene,validate:validateSceneOperations,log:m=>console.log("[Startup Scene] "+m),changed:()=>updateAll()});
async function startupMessage019(m){
 const p=m.payload||{};
 try{
  let result;
  if(p.command==="getStartupScene")result=startup019.snapshot();
  else if(p.command==="saveStartupScene")result=startup019.save(p.settings||{});
  else if(p.command==="checkStartupScene")result=await startup019.check(p.filePath);
  else return false;
  send({event:"sendToPropertyInspector",context:m.context,payload:{command:"startupSceneResult",request:p.command,ok:true,result}});
 }catch(e){send({event:"sendToPropertyInspector",context:m.context,payload:{command:"startupSceneResult",request:p.command,ok:false,error:e.message}})}
 return true;
}
function updateInstance(i){
 if(i.action===STARTUP_ACTION){const s=startup019.snapshot();setState(i.context,s.phase==="Failed"?1:0);setTitle(i.context,"Startup Scene\\n"+s.phase);return}`);
 replace('  const e = m.event;', '  const e = m.event;\n  if(e==="sendToPlugin"&&m.action===STARTUP_ACTION&&await startupMessage019(m))return;');
 replace('    switch(i.action){', '    if(i.action===STARTUP_ACTION){try{await startup019.runNow(i.context);showOk(i.context)}catch(e){console.error("[Startup Scene] Manual run failed: "+e.message);showAlert(i.context)}return}\n    switch(i.action){');
 replace('send({event:"registerPlugin",uuid:pluginUUID});void refreshStatus();','send({event:"registerPlugin",uuid:pluginUUID});startup019.connected();void refreshStatus();');
 replace('if(ws===socket)ws=null;console.error', 'if(ws===socket)ws=null;startup019.disconnected();console.error');
 // Return the existing runner's real outcome to the startup controller.
 const begin=source.indexOf('async function runScene(i){'),end=source.indexOf('async function handleMessage(m)',begin);
 let runner=source.slice(begin,end);
 runner=runner.replace('let activeStep=0,continuedFailures=0;', 'let activeStep=0,continuedFailures=0,succeeded019=false;');
 runner=runner.replace('showOk(i.context);','showOk(i.context);succeeded019=true;');
 runner=runner.replace('    return;\n  }\n  let cmds;', '    return succeeded019;\n  }\n  let cmds;');
 source=source.slice(0,begin)+runner+source.slice(end);
 return source;
}
function start(){const filename=path.join(__dirname,"plugin-core.js"),patched=new Module(filename,module);patched.filename=filename;patched.paths=module.paths;patched._compile(build(),filename)}
module.exports={build,start};
