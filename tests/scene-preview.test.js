'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin'),fixture=require('./fixtures/default-scene');
function harness(){
 const c=vm.createContext({require:createRequire(root+'/plugin-core.js'),process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','preview-test']},console:{log(){},error(){},warn(){}},setTimeout,clearTimeout,Buffer,URL});
 const text=fs.readFileSync(root+'/plugin-core.js','utf8');vm.runInContext(text.slice(0,text.indexOf('diag("startup",')),c);
 c.status=fixture.status();c.ops=fixture.scene.operations;c.sent=[];c.reads=0;c.writes=0;
 vm.runInContext("send=m=>sent.push(m);getStatus=async()=>{reads++;return {Status:status}};pipeCommand=async()=>{writes++;throw Error('Unexpected audio command')};pipeCommand021=pipeCommand",c);
 return {c,preview:ops=>{c.ops=ops;return JSON.parse(JSON.stringify(vm.runInContext('previewScene024(ops,status)',c)))}};
}
test('user Default Scene resolves all 38 steps with no writes and no mutation of Scene or status',()=>{
 const h=harness(),before=JSON.stringify(h.c.status),ops=JSON.stringify(fixture.scene);
 const r=h.preview(fixture.scene.operations);assert.equal(r.steps.length,38);assert.equal(r.ok,true,JSON.stringify(r.errors));assert.equal(r.blocked,false);
 assert.equal(r.steps[5].changes[0].target,'Music · B');assert.equal(r.steps[5].changes[0].after,70);
 assert.equal(r.steps[25].changes[0].after,false);assert.equal(r.steps[26].changes[0].after,0);
 assert.equal(r.steps[37].changes[0].after,'Music');assert.equal(h.c.writes,0);assert.equal(h.c.reads,0);
 assert.equal(JSON.stringify(h.c.status),before);assert.equal(JSON.stringify(fixture.scene),ops);
});
test('preview message reads status only and preserves request correlation',async()=>{
 const h=harness();vm.runInContext("instances.set('scene',{context:'scene',action:ACTIONS.scene,settings:{}})",h.c);
 await h.c.handleMessage({event:'sendToPlugin',context:'scene',payload:{command:'previewScene',requestId:12,operations:fixture.scene.operations}});
 const m=h.c.sent.find(m=>m.payload?.command==='scenePreview');assert(m);assert.equal(m.payload.requestId,12);assert.equal(m.payload.steps.length,38);assert.equal(h.c.reads,1);assert.equal(h.c.writes,0);
});
test('projection follows preceding changes and does not mistake linked volume effects for known values',()=>{
 const h=harness(),r=h.preview([{type:'sourceVolumeLink',sources:['Music'],state:'unlinked'},...[70,70,20].map(volume=>({type:'sourceVolume',sources:['Music'],mix:'B',volume}))]);
 assert.equal(r.steps[2].changes[0].before,70);assert.equal(r.steps[2].outcome,'unchanged');assert.equal(r.steps[3].changes[0].before,70);
 const linked=h.preview([{type:'sourceVolume',sources:['Music'],mix:'A',volume:80},{type:'sourceVolume',sources:['Music'],mix:'B',volume:10}]);
 assert.equal(linked.steps[0].outcome,'uncertain');assert.equal(linked.steps[1].changes[0].before,null);
});
test('offline apps skip, missing fade apps fail, and ambiguous app conditions are flagged',()=>{
 const h=harness(),applications=[{name:'Absent',process:'absent',deviceType:'Source'}];
 let r=h.preview([{type:'applicationMute',applications,state:'muted'},{type:'volumeFade',kind:'application',application:applications[0],volume:0,milliseconds:0}]);
 assert.equal(r.steps[0].outcome,'skipped');assert.equal(r.steps[1].outcome,'error');
 h.c.status.audio.applications.Source={one:{Player:[{node_id:1,volume:20}]},two:{Player:[{node_id:2,volume:30}]}};
 r=h.preview([{type:'wait',milliseconds:0,condition:{type:'applicationNotRunning',application:{name:'Player',deviceType:'Source'}}}]);
 assert.equal(r.steps[0].outcome,'error');assert.match(r.steps[0].notes.join(' '),/Ambiguous/);
});
test('conditions skip before a wait and become provisional after waits, fades or engine changes',()=>{
 const h=harness(),conditional={type:'targetVolume',targets:['Speakers'],volume:20,condition:{type:'applicationRunning',application:{name:'Absent'}}};
 for(const preceding of [{type:'wait',milliseconds:250},{type:'audioRestart'},{type:'audioBuffer',bufferSize:256},{type:'volumeFade',kind:'target',targetName:'Speakers',volume:0,milliseconds:300}]){
  const r=h.preview([conditional,preceding,conditional]);assert.equal(r.steps[0].outcome,'skipped');assert.equal(r.steps[2].outcome,'uncertain');assert.equal(h.c.writes,0);
 }
 const r=h.preview([{type:'audioBuffer',bufferSize:'default'},conditional]);assert.equal(r.steps[0].outcome,'unchanged');assert.equal(r.steps[1].outcome,'skipped');
});
test('mute destination set/toggle/all projection follows the existing empty-list means All behavior',()=>{
 const h=harness(),base={type:'sourceMuteDestinations',sources:['Music'],mix:'B',targets:['Headphones']};
 const r=h.preview([{...base,mode:'set'},{...base,mode:'toggle'},{...base,mode:'all'}]);
 assert.equal(r.ok,true);assert.deepEqual(r.steps[0].changes[0].before,['All targets']);assert.deepEqual(r.steps[0].changes[0].after,['Headphones']);
 assert.deepEqual(r.steps[1].changes[0].after,['All targets']);assert.equal(r.steps[2].outcome,'unchanged');
});
test('unavailable, malformed and ambiguous physical selections never fabricate a successful plan',()=>{
 const h=harness();assert.equal(h.preview([{type:'targetVolume',targets:['Missing'],volume:50}]).blocked,true);
 assert.equal(h.preview([null]).ok,false);assert.equal(h.preview([]).ok,false);
 h.c.status.audio.devices.Source.push({id:'duplicate',name:'Webcam',volume:10,muted:false});
 const r=h.preview([{type:'physicalInputMute',device:{name:'Webcam'},state:'muted'}]);assert.equal(r.steps[0].outcome,'error');
 h.c.status=null;assert.match(h.preview(fixture.scene.operations).errors[0].message,/unavailable/);assert.equal(h.c.writes,0);
});
