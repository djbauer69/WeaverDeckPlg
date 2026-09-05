"use strict";
const fs=require("fs"),path=require("path"),Module=require("module");
function build(){
  let source=fs.readFileSync(path.join(__dirname,"plugin-core.js"),"utf8");
  for(const layer of ["source-link","smart-scenes","apps"])source=require("./core-v017-"+layer).apply(source);
  function replace(before,after){if(source.split(before).length!==2)throw new Error("v0.18 patch anchor missing or ambiguous: "+before);source=source.replace(before,after)}
  replace("function updateInstance(i){",`const features018=require("./features-v018").create({pipeCommand,unwrapStatus,isOk,configured:sceneConfiguredDevices,deviceId,deviceName});
async function featureButton018(i){
  const op=features018.buttonOperation(i);
  if(!op)return;
  setTitle(i.context,"Working…");
  try{console.log("[v0.18.0] ACTION START "+features018.describe(op));await features018.execute(op);await refreshStatus();showOk(i.context);console.log("[v0.18.0] ACTION OK "+features018.describe(op))}
  catch(e){console.error("[v0.18.0] ACTION FAILED "+features018.describe(op)+": "+e.message);showAlert(i.context);updateInstance(i)}
}
function updateInstance(i){
  const op018=features018.buttonOperation(i);
  if(op018){const v=features018.visual(op018,lastStatus);setState(i.context,v.state);setTitle(i.context,v.title);return}`);
  replace("    switch(i.action){","    if(features018.buttonOperation(i))return featureButton018(i);\n    switch(i.action){");
  replace('    if(type==="wait"){',`    if(features018.supports(op)){
      for(const message of features018.validate(op,status))add(errors,idx,type,message);
    }else if(type==="wait"){`);
  replace('  const type=String(op.type||"");\n  if(type==="wait"){','  const type=String(op.type||"");\n  if(features018.supports(op))return features018.execute(op);\n  if(type==="wait"){');
  replace('function sceneOperationDescription(op){','function sceneOperationDescription(op){\n  if(features018.supports(op))return features018.describe(op);');
  // Await one shared request instead of returning a stale/null snapshot while it is in flight.
  replace('async function refreshStatus(){if(statusRefreshInFlight){return lastStatus}statusRefreshInFlight=true;', 'let statusPromise018=null;\nfunction refreshStatus(){if(statusPromise018)return statusPromise018;statusPromise018=refreshStatus018().finally(()=>{statusPromise018=null});return statusPromise018}\nasync function refreshStatus018(){statusRefreshInFlight=true;');
  return source;
}
function start(){const filename=path.join(__dirname,"plugin-core.js"),patched=new Module(filename,module);patched.filename=filename;patched.paths=module.paths;patched._compile(build(),filename)}

module.exports={build,start};
