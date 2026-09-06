"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),path=require('path'),fs=require('fs'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin'),{create}=require(root+'/dial-controls');
function fixture(){
 let time=0,volume=50,muted=false,online=true,valid=true,fail=false;const timers=[],sent=[],commands=[],logs=[];
 const i={action:'com.pipeweaver.opendeck.targetvolumedial',context:'dial',settings:{step:5}};
 const api={describe:()=>({name:'Desktop',volume:online?volume:null,muted,volumeCommand:v=>({volume:v}),muteCommand:m=>({mute:m})}),refresh:async()=>({}),current:s=>valid&&JSON.stringify(s.settings)===JSON.stringify(i.settings),send:m=>sent.push(m),command:async c=>{commands.push(c);if(fail)throw Error('timeout');const p=c.Pipewire;if('volume' in p)volume=p.volume;if('mute'in p)muted=p.mute;return 'Ok'},ok:r=>r==='Ok',log:s=>logs.push(s)};
 const dial=create(api,{schedule:f=>timers.push(f),now:()=>time});
 const event=(e,p={})=>dial.handle({event:e,payload:{controller:'Encoder',...p}},i);
 async function flush(){while(timers.length)timers.shift()();for(let n=0;n<30;n++)await new Promise(setImmediate)}
 return {api,dial,i,event,flush,sent,commands,logs,setVolume:v=>volume=v,setOffline:()=>online=false,setInvalid:()=>valid=false,setFail:()=>fail=true,age:()=>time=3000,get volume(){return volume}};
}
test('signed multi-tick bursts coalesce, reverse in order, clamp, and retain sequential changes',async()=>{
 const f=fixture();f.event('dialRotate',{ticks:2});f.event('dialRotate',{ticks:3});await f.flush();assert.deepEqual(f.commands,[{Pipewire:{volume:75}}]);
 f.event('dialRotate',{ticks:20});f.event('dialRotate',{ticks:-2});await f.flush();assert.equal(f.volume,90);
 f.event('dialRotate',{ticks:-200});await f.flush();assert.equal(f.volume,0);
});
test('rotate while request is pending is queued, not lost to overlapping read/modify/write',async()=>{
 const f=fixture();let release;f.api.refresh=()=>new Promise(r=>release=r);
 f.event('dialRotate',{ticks:1});const pending=f.flush();await new Promise(setImmediate);
 f.event('dialRotate',{ticks:2});f.api.refresh=async()=>({});release({});await pending;await f.flush();assert.equal(f.volume,65);assert.equal(f.commands.length,2);
});
test('down/up toggles once, duplicate downs ignored; tap toggles, hold and invalid ticks ignored',async()=>{
 const f=fixture();f.event('dialDown');f.event('dialDown');f.event('dialUp');await f.flush();assert.deepEqual(f.commands,[{Pipewire:{mute:true}}]);
 f.event('touchTap',{hold:false});f.event('touchTap',{hold:true});f.event('dialRotate',{ticks:'2'});f.event('dialRotate',{ticks:Infinity});f.event('dialRotate',{ticks:0});await f.flush();assert.equal(f.commands.length,2);assert.deepEqual(f.commands[1],{Pipewire:{mute:false}});
});
test('offline, deleted, reconfigured and stale gestures never send audio commands',async()=>{
 for(const scenario of ['offline','delete','settings','stale','cancel']){
  const f=fixture();f.event('dialRotate',{ticks:1});
  if(scenario==='offline')f.setOffline();if(scenario==='delete')f.setInvalid();if(scenario==='settings')f.i.settings.step=10;if(scenario==='stale')f.age();if(scenario==='cancel')f.dial.cancel(f.i.context);
  await f.flush();assert.equal(f.commands.length,0,scenario);
 }
});
test('uncertain acknowledgement is not retried and queued input for that control is discarded',async()=>{
 const f=fixture();f.setFail();f.event('dialRotate',{ticks:1});f.event('dialDown');await f.flush();assert.equal(f.commands.length,1);assert(f.logs.some(x=>x.includes('FAILED')));assert.equal(f.sent.at(-1).payload.status,'Error');
});
test('feedback preserves manual label, live zero, mute and offline state; blank stays blank',()=>{
 const f=fixture();f.i.settings={textMode:'manual',buttonText:'Desk\nMusic'};f.setVolume(0);f.dial.render(f.i,{});assert.deepEqual(f.sent.at(-1).payload,{label:'Desk Music',value:'0%',status:'Live',indicator:0});
 f.dial.render(f.i,{});assert.equal(f.sent.length,1);f.setOffline();f.dial.render(f.i,null);assert.equal(f.sent.at(-1).payload.status,'Unavailable');assert.equal(f.sent.at(-1).payload.value,'?');
 f.i.settings.buttonText='';f.dial.render(f.i,null);assert.equal(f.sent.at(-1).payload.label,'');
 f.i.settings.textMode='dynamic';f.dial.render(f.i,null);assert.equal(f.sent.at(-1).payload.label,'Desktop');
});
function core(){
 let api;const native=createRequire(root+'/plugin-core.js'),timers=[];
 const c=vm.createContext({require:n=>n==='./dial-controls'?{kind:require(root+'/dial-controls').kind,create:a=>{api=a;return create(a,{schedule:f=>timers.push(f)})}}:native(n),process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','test']},console:{log(){},error(){},warn(){}},setTimeout,clearTimeout,Buffer,URL});
 let s=require(root+'/core-v021').build();s=s.slice(0,s.indexOf('diag("startup",'));vm.runInContext(s,c);return {c,get api(){return api},timers};
}
test('composed dial commands select correct source mix, target, physical direction and resilient application identity',()=>{
 const f=core();f.c.status={audio:{profile:{devices:{sources:{virtual_devices:[{id:'src',name:'Browser',volumes:{volume:{A:25,B:70}},mute_states:{mute_state:['TargetB']}}]},targets:{virtual_devices:[{id:'dst',name:'Desktop',volume:40,muted:false}]}}},devices:{Source:[{id:'mic',name:'Mic',volume:80,muted:false}],Target:[{id:'out',name:'Out',volume:90,muted:true}]},applications:{Source:{'brave (deleted)':[{name:'Brave',process:'brave (deleted)',node_id:269,volume:60,muted:false}]}}}};
 // Application fixture follows the existing application's actual wire structure.
 vm.runInContext('applications=s=>s.testApps||[]',f.c);f.c.status.testApps=[{name:'Brave',process:'brave (deleted)',deviceType:'Source',nodeId:269,volume:60,muted:false}];
 const cases=[['source',{sourceName:'Browser',mix:'B'},70,{SetSourceVolume:['src','B',55]},{DelSourceMuteTarget:['src','TargetB']}],['target',{targetName:'Desktop'},40,{SetVolumeByName:['Desktop',null,55]},{SetTargetMuteStatesByName:['Desktop','Muted']}],['physin',{deviceId:'mic'},80,{SetPhysicalDeviceVolume:['mic',55]},{SetPhysicalDeviceMute:['mic',true]}],['phys',{deviceId:'out'},90,{SetPhysicalDeviceVolume:['out',55]},{SetPhysicalDeviceMute:['out',false]}],['app',{name:'Brave',process:'/usr/bin/brave',deviceType:'Source'},60,{SetApplicationVolume:[269,55]},{SetApplicationMute:[269,true]}]];
 for(const [prefix,settings,volume,volCmd,muteCmd] of cases){
  f.c.i={action:'com.pipeweaver.opendeck.'+prefix+'volumedial',settings};const d=vm.runInContext('describeDial020(i,status)',f.c);assert.equal(d.volume,volume);assert.deepEqual(JSON.parse(JSON.stringify(d.volumeCommand(55))),volCmd);assert.deepEqual(JSON.parse(JSON.stringify(d.muteCommand(!d.muted))),muteCmd);
 }
 f.c.status.testApps.push({name:'Other',process:'brave',deviceType:'Source',nodeId:300,volume:99});f.c.i.settings={process:'brave',deviceType:'Source'};assert.equal(vm.runInContext('describeDial020(i,status).volumeCommand',f.c),undefined);
});
test('real core routes dial lifecycle and feedback, cancels vanished controls, and leaves button actions alone',async()=>{
 const f=core(),sent=[],commands=[];f.api.send=m=>sent.push(m);f.api.refresh=async()=>({});f.api.describe=()=>({name:'Desktop',volume:50,muted:false,volumeCommand:v=>({volume:v})});f.api.command=async c=>(commands.push(c),'Ok');
 const action='com.pipeweaver.opendeck.targetvolumedial',context='dial';
 await f.c.handleMessage({event:'willAppear',action,context,payload:{controller:'Encoder',settings:{step:5}}});assert.equal(sent[0].event,'setFeedback');
 await f.c.handleMessage({event:'dialRotate',context,payload:{controller:'Encoder',ticks:2}});f.timers.shift()();for(let n=0;n<10;n++)await new Promise(setImmediate);assert.equal(commands[0].Pipewire.volume,60);
 await f.c.handleMessage({event:'dialRotate',context,payload:{controller:'Encoder',ticks:1}});await f.c.handleMessage({event:'willDisappear',context});f.timers.shift()();await new Promise(setImmediate);assert.equal(commands.length,1);
 assert.equal(require(root+'/dial-controls').kind({action:'com.pipeweaver.opendeck.volumeup'}),undefined);
});
test('five Encoder-only actions have a complete bounded feedback layout and retain all button UUIDs',()=>{
 const m=require(root+'/manifest.json'),dials=m.Actions.filter(a=>a.Controllers.includes('Encoder'));assert.equal(dials.length,5);
 for(const a of dials){assert.deepEqual(a.Controllers,['Encoder']);assert.equal(a.SupportedInMultiActions,false);const layout=JSON.parse(fs.readFileSync(root+'/'+a.Encoder.layout));assert.deepEqual(layout.items.map(i=>i.key),['label','value','status','indicator']);for(const i of layout.items){const [x,y,w,h]=i.rect;assert(x>=0&&y>=0&&x+w<=200&&y+h<=100)}}
 assert.equal(m.Actions.filter(a=>a.Controllers.includes('Keypad')).length,52);
});
test('disconnect cancels a gesture even while its readiness request is in flight',async()=>{
 const f=fixture();let release;f.api.refresh=()=>new Promise(r=>release=r);f.event('dialRotate',{ticks:2});const pending=f.flush();await new Promise(setImmediate);f.dial.clear();release({});await pending;assert.equal(f.commands.length,0);
});
