'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createStore,installScenePresets}=require('../com.pipeweaver.opendeck.sdPlugin/scene-presets');
const scene={format:'WeaverDeckScene',formatVersion:1,sceneVersion:1,name:'Desktop',operations:[{type:'volumeFade',kind:'target',targetName:'Desktop',volume:40,milliseconds:1500,condition:{mode:'always'},failurePolicy:'stop'}]};
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weaver-presets-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'presets.json');return {file,store:createStore(file)}}
test('presets survive fresh stores and edits from independent inspectors retain other names',t=>{
 const {file,store}=fixture(t);store.change('saveScenePreset',{name:'Desktop',scene});
 const restarted=createStore(file);assert.deepEqual(restarted.change('getScenePresets').entries[0].scene,scene);
 restarted.change('saveScenePreset',{name:'Headphones',scene});store.change('saveScenePreset',{name:'Desktop',scene:{...scene,operations:[]}});
 const entries=createStore(file).change('getScenePresets').entries;assert.deepEqual(entries.map(e=>e.name),['Desktop','Headphones']);assert.equal(entries[1].scene.operations[0].milliseconds,1500);
});
test('browser migration preserves newer disk presets and deleted presets do not return from stale browser caches',t=>{
 const {file,store}=fixture(t);store.change('saveScenePreset',{name:'Desktop',scene:{...scene,operations:[]}});
 const legacy={Desktop:scene,Old:scene};store.change('importScenePresets',{presets:legacy});
 assert.equal(store.read().presets.Desktop.operations.length,0);assert.equal(store.read().presets.Old.operations.length,1);
 store.change('deleteScenePreset',{name:'Old'});createStore(file).change('importScenePresets',{presets:legacy});assert(!Object.hasOwn(store.read().presets,'Old'));
});
test('invalid data and failed writes report errors without overwriting the stored file',t=>{
 const {file,store}=fixture(t);store.change('saveScenePreset',{name:'Good',scene});const before=fs.readFileSync(file,'utf8');
 assert.throws(()=>store.change('importScenePresets',{presets:{Valid:scene,Invalid:{operations:'bad'}}}));assert.equal(fs.readFileSync(file,'utf8'),before);
 assert.throws(()=>store.change('saveScenePreset',{name:'Large',scene:{...scene,notes:'x'.repeat(2*1024*1024)}}));assert.equal(fs.readFileSync(file,'utf8'),before);
 fs.writeFileSync(file,'broken');assert.throws(()=>store.change('saveScenePreset',{name:'Next',scene}));assert.equal(fs.readFileSync(file,'utf8'),'broken');
 const blocked=path.join(file,'presets.json'),layer=installScenePresets({file:blocked}),sent=[];
 assert(layer.handleIncoming({send:s=>sent.push(JSON.parse(s))},{data:JSON.stringify({event:'sendToPlugin',context:'key',payload:{command:'saveScenePreset',requestId:'1',name:'Test',scene}})}));
 assert.equal(sent[0].payload.ok,false);assert.equal(sent[0].payload.requestId,'1');
});
test('preset names are data, including reserved object names, and protocol replies retain the requesting context',t=>{
 const {file,store}=fixture(t);for(const name of ['__proto__','constructor'])store.change('saveScenePreset',{name,scene});
 assert.deepEqual(createStore(file).change('getScenePresets').entries.map(e=>e.name),['__proto__','constructor']);
 const sent=[],layer=installScenePresets({file});assert.equal(layer.handleIncoming({send:s=>sent.push(JSON.parse(s))},{data:JSON.stringify({event:'sendToPlugin',context:'second-key',payload:{command:'getScenePresets',requestId:'abc'}})}),true);
 assert.equal(sent[0].context,'second-key');assert.equal(sent[0].payload.requestId,'abc');assert.equal(layer.handleIncoming({}, {data:'{}'}),false);
});
