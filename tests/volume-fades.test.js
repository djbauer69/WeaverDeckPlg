"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),path=require('path'),fs=require('fs'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin'),{create,validate,durationMs}=require(root+'/volume-fades');
const op={type:'volumeFade',kind:'target',targetName:'Desktop',volume:80,milliseconds:1000};
function fixture(){let volume=20,time=0,key='device:x',online=true;const commands=[],logs=[];const api={refresh:async()=>({}),resolve:()=>({name:'Desktop',key:online?key:null,volume:online?volume:null,volumeCommand:v=>({v})}),command:async c=>{commands.push(c);volume=c.Pipewire.v;return 'Ok'},ok:r=>r==='Ok',log:s=>logs.push(s)};const options={now:()=>time,sleep:async ms=>{time+=ms}};const engine=create(api,options);return {api,options,engine,commands,logs,setVolume:v=>volume=v,setKey:v=>key=v,offline:()=>online=false,get volume(){return volume}}}
test('linear fades increase/decrease to exact endpoint, no-op and zero duration behave correctly',async()=>{
 const f=fixture();await f.engine.run(op);assert.equal(f.volume,80);assert.deepEqual(f.commands.map(c=>c.Pipewire.v),[26,32,38,44,50,56,62,68,74,80]);
 f.commands.length=0;await f.engine.run({...op,volume:0,milliseconds:300});assert.equal(f.volume,0);assert(f.commands.every(c=>c.Pipewire.v>=0));
 f.commands.length=0;await f.engine.run({...op,volume:0});assert.equal(f.commands.length,0);await f.engine.run({...op,milliseconds:0});assert.equal(f.commands.length,1);assert.equal(f.volume,80);
});
test('invalid settings and missing devices fail before audio mutation',async()=>{
 const f=fixture();for(const patch of [{volume:101},{milliseconds:-1},{milliseconds:120001},{milliseconds:''},{kind:'unknown'},{targetName:''}])await assert.rejects(f.engine.run({...op,...patch}));
 assert.equal(validate({...op,milliseconds:null,seconds:1}).length,0);assert(validate({...op,milliseconds:null,seconds:121}).length);
 f.offline();await assert.rejects(f.engine.run(op),/unavailable/);assert.equal(f.commands.length,0);assert(validate({...op,kind:'application'}).length);assert(validate({...op,kind:'input'}).length);
});
test('external changes, disappearance, identity changes, and direct takeover stop a fade',async()=>{
 for(const scenario of ['external','offline','identity','cancel']){
  const f=fixture(),raw=f.api.command;f.api.command=async c=>{const r=await raw(c);if(scenario==='external')f.setVolume(10);if(scenario==='offline')f.offline();if(scenario==='identity')f.setKey('device:new');if(scenario==='cancel')f.engine.cancel('device:x');return r};
  await assert.rejects(f.engine.run(op));assert.equal(f.commands.length,1,scenario);
 }
});
test('timeout or rejected command is never retried',async()=>{
 for(const fail of [async()=>{throw Error('timeout')},async()=>({Error:'rejected'})]){const f=fixture();let n=0;f.api.command=async()=>{n++;return fail()};await assert.rejects(f.engine.run(op));assert.equal(n,1)}
});
test('new fade takes over the same resource after an outstanding write completes',async()=>{
 const f=fixture();let release,entered;const start=new Promise(r=>entered=r),raw=f.api.command;
 f.api.command=async c=>{entered();await new Promise(r=>release=r);return raw(c)};
 const first=f.engine.run(op).catch(e=>e);await start;const second=f.engine.run({...op,volume:0,milliseconds:0});await new Promise(setImmediate);f.api.command=raw;release();assert.match((await first).message,/cancelled/);await second;assert.equal(f.volume,0);assert.equal(f.commands.length,2);
});
test('disconnect or direct change while initial status is pending prevents fade start',async()=>{
 for(const clear of [false,true]){const f=fixture();let release;f.api.refresh=()=>new Promise(r=>release=r);const pending=f.engine.run(op);if(clear)f.engine.clear();else f.engine.cancel('device:x');release({});await assert.rejects(pending,/cancelled/);assert.equal(f.commands.length,0)}
});
function core(){
 let api,time=0;const native=createRequire(root+'/plugin-core.js');
 const c=vm.createContext({require:n=>n==='./volume-fades'?{validate,durationMs,create:a=>{api=a;return create(a,{now:()=>time,sleep:async ms=>{time+=ms}})}}:native(n),process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','test']},console:{log(){},error(){},warn(){}},setTimeout,clearTimeout,Buffer,URL});let s=fs.readFileSync(root+"/plugin-core.js","utf8");s=s.slice(0,s.indexOf('diag("startup",'));vm.runInContext(s,c);return {c,get api(){return api}};
}
test('composed core validates fade steps, awaits their completion and uses common resource identity',async()=>{
 const f=core();f.c.fixture={audio:{profile:{devices:{targets:{virtual_devices:[{id:'dst',name:'Desktop',volume:20,muted:false}]},sources:{virtual_devices:[{id:'src',name:'Browser',volumes:{volume:{A:30,B:60}}}]}}},devices:{Source:[{id:'mic',name:'Mic',volume:10}],Target:[]}}};
 f.c.op=op;assert.equal(vm.runInContext('validateSceneOperations([op],fixture).ok',f.c),true);
 f.c.op={...op,milliseconds:200000};assert.equal(vm.runInContext('validateSceneOperations([op],fixture).ok',f.c),false);
 assert.equal(vm.runInContext("volumeResource021({Pipewire:{SetVolumeByName:['Desktop',null,50]}},fixture)",f.c),'device:dst');
 assert.equal(vm.runInContext("volumeResource021({Pipewire:{SetPhysicalDeviceVolume:['dst',50]}},fixture)",f.c),'device:dst');
 const resolved=vm.runInContext("resolveFade021({kind:'input',device:{id:'old',name:'Mic'}},fixture)",f.c);assert.equal(resolved.key,'device:mic');assert.equal(resolved.volume,10);
 f.api.refresh=async()=>f.c.fixture;f.api.command=async c=>{f.c.fixture.audio.profile.devices.targets.virtual_devices[0].volume=c.Pipewire.SetVolumeByName[2];return 'Ok'};
 await f.c.executeSceneOperation(op,f.c.fixture);assert.equal(f.c.fixture.audio.profile.devices.targets.virtual_devices[0].volume,80);
});
test('Scene fade editor preserves conditions and failure policy, and round-trips all selections',()=>{
 const nodes=new Map(),doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:''});return nodes.get(id)},querySelectorAll:()=>[],addEventListener(){}};
 const c=vm.createContext({document:doc,navigator:{},console,confirm:()=>true,setTimeout,clearTimeout});c.window=c;
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/scene.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],c);
 // Load the current wrapper over the Scene editor; shared condition rendering
 // is independently covered by the Smart Scene regression suite.
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/fade-ui.js','utf8'),c);c.addEventListener=()=>{};
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/scene-fades-v022.js','utf8'),c);vm.runInContext("sceneFades022();operations=[{type:'wait',condition:{type:'applicationRunning',application:{name:'Brave'}},onFailure:'continue'}];setType(0,'volumeFade')",c);
 assert.equal(vm.runInContext('operations[0].condition.type',c),'applicationRunning');assert.equal(vm.runInContext('operations[0].onFailure',c),'continue');
 for(const [kind,choice] of [['source',{sourceName:'Browser'}],['target',{targetName:'Desktop'}],['application',{application:{name:'Brave',process:'brave',deviceType:'Source'}}],['input',{device:{id:'mic',name:'Mic'}}],['output',{device:{id:'out',name:'Speakers'}}]]){
  c.kind=kind;c.choice=JSON.stringify(choice);vm.runInContext("setFadeKind(0,kind);setFadeChoice(0,choice);exportScene();importScene()",c);assert.equal(vm.runInContext('operations[0].kind',c),kind);assert(vm.runInContext('fields(operations[0],0)',c).includes('Duration ms'));
 }
});
test('manual takeover can wait for the last in-flight fade write before applying its value',async()=>{
 const f=fixture();let release,entered;const started=new Promise(r=>entered=r),raw=f.api.command;
 f.api.command=async c=>{entered();await new Promise(r=>release=r);return raw(c)};
 const fade=f.engine.run(op).catch(e=>e);await started;
 let applied=false;const manual=Promise.resolve(f.engine.cancel('device:x')).then(()=>{f.setVolume(15);applied=true});
 await new Promise(setImmediate);assert.equal(applied,false);release();await fade;await manual;assert.equal(f.volume,15);
});
function physicalFixture({delay=180,never=false}={}){
 let time=0,volume=100,pending=null;const commands=[],logs=[];
 const api={refresh:async()=>{if(pending&&!never&&time>=pending.at){volume=pending.value;pending=null}return {}},resolve:()=>({key:'device:mic',name:'Mic',volume,volumeCommand:v=>({v})}),command:async c=>{assert.equal(pending,null,'must confirm the preceding command before another write');commands.push(c);pending={at:time+delay,value:c.Pipewire.v};return 'Ok'},ok:r=>r==='Ok',log:s=>logs.push(s)};
 const options={now:()=>time,sleep:async ms=>{time+=ms}},engine=create(api,options);
 return {api,engine,commands,logs,options,get time(){return time},get volume(){return volume},setVolume:v=>{pending=null;volume=v}};
}
const physicalOp={kind:'input',device:{id:'mic',name:'Mic'},volume:50,milliseconds:1500};
test('physical fades wait for delayed device feedback for each write and for the final endpoint',async()=>{
 for(const kind of ['input','output']){
  const f=physicalFixture();await f.engine.run({...physicalOp,kind});assert.equal(f.volume,50);assert(f.logs.at(-1).startsWith('COMPLETE'));
  await f.engine.run({...physicalOp,kind,volume:100,milliseconds:200});assert.equal(f.volume,100);assert(f.logs.at(-1).startsWith('COMPLETE'));
  const before=f.commands.length;await f.engine.run({...physicalOp,kind,milliseconds:0});assert.equal(f.commands.length,before+1,'0ms sends exactly one write');assert.equal(f.volume,50);
 }
});
test('unconfirmed physical writes time out with requested/readback values and are never repeated',async()=>{
 const f=physicalFixture({never:true});await assert.rejects(f.engine.run({...physicalOp,milliseconds:0}),/confirmation timed out \(requested 50%, reported 100%\)/);
 assert.equal(f.commands.length,1);assert.equal(f.time,1000);assert(!f.logs.some(s=>s.startsWith('COMPLETE')));
});
test('physical confirmation stops for external changes and disappearing device identity',async()=>{
 for(const scenario of ['external','identity']){
  const f=physicalFixture(),raw=f.api.command;f.api.command=async c=>{const r=await raw(c);if(scenario==='external')f.setVolume(0);else f.api.resolve=()=>({key:null,volume:null});return r};
  await assert.rejects(f.engine.run(physicalOp),scenario==='external'?/changed externally/:/changed identity/);assert.equal(f.commands.length,1);
 }
});
test('manual takeover or disconnect interrupts physical feedback waits without further fade writes',async()=>{
 for(const disconnect of [false,true]){
  const f=physicalFixture({never:true}),raw=f.options.sleep;
  f.options.sleep=async ms=>{await raw(ms);if(disconnect)f.engine.clear();else f.engine.cancel('device:mic')};
  f.engine=create(f.api,f.options);
  await assert.rejects(f.engine.run({...physicalOp,milliseconds:0}),/cancelled/);assert.equal(f.commands.length,1);
 }
});
