"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("fs"),vm=require("vm"),path=require("path"),{createRequire}=require("module");
const root=path.resolve(__dirname,"../com.pipeweaver.opendeck.sdPlugin");
const {create,quantum,BUFFER_SIZES}=require(root+"/features-v018");
function fixture(){
 const source={description:{id:"s1",name:"Browser"},mute_states:{mute_state:[],mute_targets:{TargetA:[],TargetB:[]}},volumes:{volume:{A:70,B:40},volumes_linked:null}};
 const targets=["Desktop","Headphones","Chat"].map((name,i)=>({description:{name,id:"t"+i}}));
 const status={audio:{profile:{audio_node_quantum:null,devices:{sources:{virtual_devices:[source]},targets:{virtual_devices:targets}}},applications:{}}};
 const calls=[];let clock=0,unavailable=0,failRestart=false;
 const api={configured:(s,t)=>s.audio.profile.devices[t+"s"].virtual_devices,deviceName:d=>d.description.name,deviceId:d=>d.description.id,unwrapStatus:r=>r.Status,isOk:r=>r==="Ok",now:()=>clock,pause:async ms=>{clock+=ms},pipeCommand:async cmd=>{
  calls.push(cmd);
  if(cmd==="GetStatus"){if(unavailable-->0)throw new Error("HTTP 503");return {Status:structuredClone(status)}}
  if(cmd.Daemon){if(failRestart)throw new Error("transport lost");if(cmd.Daemon.SetAudioQuantum!==undefined)status.audio.profile.audio_node_quantum=cmd.Daemon.SetAudioQuantum;unavailable=2;return "Ok"}
  const [type,args]=Object.entries(cmd.Pipewire)[0],slot=args[1],ids=source.mute_states.mute_targets[slot];
  source.mute_states.mute_state=[]; // PipeWeaver's documented destination-edit side effect.
  if(type==="ClearMuteTargetNodes")source.mute_states.mute_targets[slot]=[];
  if(type==="AddMuteTargetNode"){assert(!ids.includes(args[2]),"duplicate addition");ids.push(args[2]);if(ids.length===targets.length)source.mute_states.mute_targets[slot]=[]}
  if(type==="DelMuteTargetNode"){assert(ids.includes(args[2]),"missing removal");source.mute_states.mute_targets[slot]=ids.filter(id=>id!==args[2])}
  return "Ok";
 }};
 return {f:create(api),source,status,calls,targets,api,setUnavailable:n=>unavailable=n,failRestart:()=>failRestart=true};
}
const mute=(mode,targets=["Headphones"],mix="A")=>({type:"sourceMuteDestinations",sources:["Browser"],targets,mode,mix});
test("mute destinations use slot A/B, set is idempotent, and All clears without toggling mute",async()=>{
 const x=fixture();await x.f.execute(mute("set"));assert.deepEqual(x.source.mute_states.mute_targets.TargetA,["t1"]);
 const count=x.calls.filter(c=>c.Pipewire).length;await x.f.execute(mute("set"));assert.equal(x.calls.filter(c=>c.Pipewire).length,count);
 await x.f.execute(mute("set",["Desktop"],"B"));assert.deepEqual(x.source.mute_states.mute_targets.TargetB,["t0"]);
 await x.f.execute(mute("all"));assert.deepEqual(x.source.mute_states.mute_targets.TargetA,[]);assert.deepEqual(x.source.mute_states.mute_targets.TargetB,["t0"]);
});
test("add/remove/toggle follow dropdown membership and last removal restores All",async()=>{
 const x=fixture();await x.f.execute(mute("add"));await x.f.execute(mute("add"));await x.f.execute(mute("toggle",["Desktop"]));assert.deepEqual(x.source.mute_states.mute_targets.TargetA,["t1","t0"]);
 await x.f.execute(mute("remove"));await x.f.execute(mute("toggle",["Desktop"]));assert.deepEqual(x.source.mute_states.mute_targets.TargetA,[]);
});
test("set all destinations uses canonical All, missing target prevents every mutation",async()=>{
 const x=fixture();await x.f.execute(mute("set",["Desktop","Headphones","Chat"]));assert.equal(x.calls.filter(c=>c.Pipewire).length,0);
 await assert.rejects(x.f.execute(mute("set",["Headphones","Missing"])),/missing/);assert.equal(x.calls.filter(c=>c.Pipewire).length,0);
});
test("buffer enum accepts exactly UI sizes, default sends null, unchanged setting is a no-op",async()=>{
 for(const n of BUFFER_SIZES)assert.equal(quantum(n),"Quantum"+n);for(const n of [0,42,"",null,"Quantum512"])assert.throws(()=>quantum(n));
 const x=fixture();await x.f.execute({type:"audioBuffer",bufferSize:"512"});assert.deepEqual(x.calls.find(c=>c.Daemon),{Daemon:{SetAudioQuantum:"Quantum512"}});
 await x.f.execute({type:"audioBuffer",bufferSize:"512"});assert.equal(x.calls.filter(c=>c.Daemon).length,1);
 await x.f.execute({type:"audioBuffer",bufferSize:"default"});assert.equal(x.status.audio.profile.audio_node_quantum,null);
});
test("restart tolerates transient recovery failures and is never retried on uncertain acknowledgement",async()=>{
 const x=fixture();await x.f.execute({type:"audioRestart"});assert.equal(x.calls.filter(c=>c.Daemon).length,1);assert(x.calls.filter(c=>c==="GetStatus").length>=4);
 x.failRestart();await assert.rejects(x.f.execute({type:"audioRestart"}),/transport lost/);assert.equal(x.calls.filter(c=>c.Daemon).length,2);
});
test("recovery timeout fails instead of silently continuing",async()=>{
 const x=fixture();const original=x.api.pipeCommand;x.api.pipeCommand=async c=>{if(c==="GetStatus")throw new Error("HTTP 503");return original(c)};
 await assert.rejects(create(x.api).execute({type:"audioRestart"}),/timed out/);
});
function coreContext(){
 let source=require(root+"/core-v018").build();source=source.slice(0,source.indexOf('diag("startup",'));
 const sandbox={require:createRequire(root+"/plugin-core.js"),process:{env:{},argv:["node","plugin.js","-port","12345","-pluginUUID","test"]},console,setTimeout,clearTimeout,Buffer,URL};vm.createContext(sandbox);vm.runInContext(source,sandbox);return sandbox;
}
test("composed core validates new operations, preserves identity matching, and shares concurrent status requests",async()=>{
 const c=coreContext(),x=fixture();c.fixtureStatus=x.status;
 assert.equal(vm.runInContext('validateSceneOperations([{type:"audioRestart"},{type:"audioBuffer",bufferSize:"512"},{type:"sourceMuteDestinations",sources:["Browser"],targets:["Headphones"],mode:"set",mix:"B"}],fixtureStatus).ok',c),true);
 assert.equal(vm.runInContext('validateSceneOperations([{type:"audioBuffer",bufferSize:"42"}],fixtureStatus).ok',c),false);
 assert.equal(vm.runInContext('appResolveMany([{name:"Brave",process:"brave",deviceType:"Source"}],{name:"Brave",process:"/opt/brave (deleted)",deviceType:"Source"}).length',c),1);
 assert.equal(vm.runInContext('appResolveMany([{name:"X",process:"one"},{name:"X",process:"two"}],{name:"X",process:"old"}).length',c),0);
 vm.runInContext('var requests=0,resolveStatus;getStatus=()=>{requests++;return new Promise(r=>resolveStatus=r)};var p1=refreshStatus(),p2=refreshStatus()',c);
 assert.equal(vm.runInContext('requests===1&&p1===p2',c),true);vm.runInContext('resolveStatus({Status:fixtureStatus})',c);await c.p1;
});
test("manifest retains existing UUIDs and has alphabetical action groups",()=>{
 const m=JSON.parse(fs.readFileSync(root+"/manifest.json"));const names=m.Actions.map(a=>a.Name);assert.deepEqual(names,[...names].sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())));
 for(const a of m.Actions){assert(fs.existsSync(root+"/"+a.PropertyInspectorPath));for(const s of a.States)assert(fs.existsSync(root+"/"+s.Image+".svg"))}
});
test("Scene editor layers expose new fields, preserve conditions, and round-trip imports",()=>{
 const nodes=new Map();let inner;
 const doc={addEventListener(){},querySelectorAll(){return []},getElementById(id){if(!nodes.has(id))nodes.set(id,{value:"",innerHTML:"",textContent:""});return nodes.get(id)},createElement(){return {textContent:"",remove(){}}},head:{appendChild(s){vm.runInContext(s.textContent,inner)}}};
 doc.head.append=doc.head.appendChild;
 inner=vm.createContext({document:doc,navigator:{},console,setTimeout,clearTimeout,confirm:()=>true,addEventListener(){}});inner.window=inner;
 const base=fs.readFileSync(root+'/propertyInspector/scene.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(base,inner);inner.__weaver0151=true;
 const middle={document:{getElementById:()=>({contentWindow:inner})}};
 const outerDoc={getElementById:id=>id==='baseFrame'?{contentWindow:middle}:{textContent:""}};
 const outer=vm.createContext({document:outerDoc,console,setTimeout,addEventListener(){}});outer.window=outer;
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/scene-smart-v017.js','utf8'),outer);vm.runInContext('v016FrameReady()',outer);
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/scene-source-link-v016.js','utf8'),outer);vm.runInContext('v016InstallSourceLinkDropdown()',outer);
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/scene-features-v018.js','utf8'),outer);vm.runInContext('installSceneFeatures018()',outer);
 assert.equal(inner.__features018,true);
 vm.runInContext('data.sceneSources=["Browser"];data.sceneTargets=["Headphones"];operations=[{type:"wait",condition:{type:"applicationNotRunning",application:{name:"Brave",process:"brave"}},onFailure:"continue"}]',inner);
 for(const type of ['audioBuffer','audioRestart','sourceMuteDestinations']){
  vm.runInContext('setType(0,'+JSON.stringify(type)+')',inner);
  const html=vm.runInContext('fields(operations[0],0)',inner);assert(html.includes('Condition'));assert(html.includes('Continue Scene'));assert.equal(vm.runInContext('operations[0].condition.type',inner),'applicationNotRunning');
  if(type==='sourceMuteDestinations')assert(html.includes('Headphones'));
  vm.runInContext('exportScene();importScene()',inner);assert.equal(vm.runInContext('operations[0].type',inner),type);
 }
});
