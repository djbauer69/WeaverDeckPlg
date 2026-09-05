"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin');
const {create,readScene}=require(root+'/startup-scene');
function fixture(t,enabled=true){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weaver-startup-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const configFile=path.join(dir,'startup.json'),filePath=path.join(dir,'scene.json');
 fs.writeFileSync(filePath,JSON.stringify({format:'WeaverDeckScene',formatVersion:1,sceneVersion:1,name:'Startup Test',operations:[{type:'wait',milliseconds:0}]}));
 fs.writeFileSync(configFile,JSON.stringify({version:1,enabled,filePath,settleSeconds:2}));
 let n=0,online=true,runs=[],logs=[],successful=true;const tasks=new Map();
 const api={status:async()=>online?{audio:{profile:{}}}:null,runScene:async i=>{runs.push(i);return successful},validate:()=>({ok:true,errors:[],warnings:[]}),log:m=>logs.push(m)};
 const controller=create(api,{configFile,schedule:(f,ms)=>{tasks.set(++n,{f,ms});return n},cancel:id=>tasks.delete(id)});
 async function tick(){const [id,job]=tasks.entries().next().value||[];if(!job)return false;tasks.delete(id);await job.f();await new Promise(setImmediate);return true}
 return {controller,configFile,filePath,tasks,runs,logs,tick,setOnline:v=>online=v,setSuccessful:v=>successful=v};
}
test('waits for OpenDeck and late PipeWeaver, settles, and runs exactly once across reconnects',async t=>{
 const x=fixture(t);assert.equal(x.tasks.size,0);x.setOnline(false);x.controller.connected();await x.tick();assert.equal(x.runs.length,0);
 x.setOnline(true);await x.tick();await x.tick();assert.equal([...x.tasks.values()][0].ms,2000);assert.equal(x.runs.length,0);await x.tick();assert.equal(x.runs.length,1);assert.equal(x.controller.snapshot().phase,'Complete');
 x.controller.disconnected();x.controller.connected();assert.equal(x.tasks.size,0);assert.equal(x.runs.length,1);
});
test('readiness lost during settling returns to waiting',async t=>{
 const x=fixture(t);x.controller.connected();await x.tick();await x.tick();x.setOnline(false);await x.tick();assert.equal(x.runs.length,0);x.setOnline(true);await x.tick();await x.tick();await x.tick();assert.equal(x.runs.length,1);
});
test('disabled configuration never auto-runs; saving enables only next launch',async t=>{
 const x=fixture(t,false);x.controller.connected();assert.equal(x.tasks.size,0);x.controller.save({enabled:true,filePath:x.filePath,settleSeconds:1});x.controller.connected();assert.equal(x.tasks.size,0);assert.equal(JSON.parse(fs.readFileSync(x.configFile)).enabled,true);
 const y=create({status:async()=>null,log(){}},{configFile:x.configFile,schedule:()=>123,cancel(){}});assert.equal(y.snapshot().enabled,true);
});
test('disable cancels pending startup; manual run works while disabled',async t=>{
 const x=fixture(t);x.controller.connected();x.controller.save({enabled:false,filePath:x.filePath,settleSeconds:2});assert.equal(x.tasks.size,0);await x.controller.runNow('key');assert.equal(x.runs[0].context,'key');
});
test('failed Scene is not automatically replayed',async t=>{
 const x=fixture(t);x.setSuccessful(false);x.controller.connected();await x.tick();await x.tick();await x.tick();assert.equal(x.runs.length,1);assert.equal(x.controller.snapshot().phase,'Failed');x.controller.disconnected();x.controller.connected();assert.equal(x.tasks.size,0);
});
test('deleted or invalid files fail before commands; file is read at execution time',async t=>{
 const x=fixture(t);fs.unlinkSync(x.filePath);x.controller.connected();await x.tick();await x.tick();await x.tick();assert.equal(x.runs.length,0);assert.equal(x.controller.snapshot().phase,'Failed');
 fs.writeFileSync(x.filePath,'{"operations":[]}');assert.throws(()=>readScene(x.filePath),/WeaverDeck/);
 assert.throws(()=>x.controller.save({enabled:true,filePath:x.filePath}),/WeaverDeck/);
});
test('file check validates without running and edited file content is used',async t=>{
 const x=fixture(t);const check=await x.controller.check(x.filePath);assert.equal(check.ok,true);assert.equal(x.runs.length,0);
 const doc=JSON.parse(fs.readFileSync(x.filePath));doc.name='Edited Scene';fs.writeFileSync(x.filePath,JSON.stringify(doc));x.controller.connected();await x.tick();await x.tick();await x.tick();assert.equal(x.runs[0].settings.name,'Edited Scene');
});
test('disconnect while a readiness request is pending cannot start a Scene',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weaver-pending-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const p=path.join(dir,'cfg');fs.writeFileSync(p,JSON.stringify({version:1,enabled:true,filePath:'/tmp/example.json',settleSeconds:0}));
 let callback,resolve,runs=0;const c=create({status:()=>new Promise(r=>resolve=r),runScene:async()=>{runs++;return true},log(){}},{configFile:p,schedule:f=>(callback=f,1),cancel(){}});c.connected();callback();c.disconnected();resolve({audio:{profile:{}}});await new Promise(setImmediate);assert.equal(runs,0);
});
test('composed runner reports success, validation failure and continued failure accurately',async t=>{
 const x=fixture(t,false),nativeRequire=createRequire(root+'/plugin-core.js');
 const logs=[];const c=vm.createContext({require:n=>n==='./startup-scene'?{create:api=>create(api,{configFile:x.configFile})}:nativeRequire(n),process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','test']},console:{log:s=>logs.push(s),error:s=>logs.push(s),warn:s=>logs.push(s)},setTimeout,clearTimeout,Buffer,URL});
 let s=require(root+'/core-v019').build();s=s.slice(0,s.indexOf('diag("startup",'));vm.runInContext(s,c);vm.runInContext('getStatus=async()=>({Status:{audio:{profile:{}}}})',c);
 assert.equal(await vm.runInContext('runScene({context:"weaverdeck-startup",settings:{operations:[{type:"wait",milliseconds:0}]}})',c),true);
 assert.equal(await vm.runInContext('runScene({context:"weaverdeck-startup",settings:{operations:[{type:"bad"}]}})',c),false);
 vm.runInContext('executeSceneOperation=async()=>{throw new Error("test failure")}',c);
 assert.equal(await vm.runInContext('runScene({context:"weaverdeck-startup",settings:{operations:[{type:"wait",milliseconds:0,onFailure:"continue"}]}})',c),false);
});
