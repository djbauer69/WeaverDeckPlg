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
function ui(legacy={}){
 const sent=[],messages=[],elements=new Map(),storage=new Map([['weaverdeck.scenePresets.v1',JSON.stringify(legacy)]]);
 const node=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:''});return elements.get(id)};
 const c=vm.createContext({document:{getElementById:node},PRESET_KEY:'weaverdeck.scenePresets.v1',localStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},status:(s,k)=>messages.push({s,k}),esc:String,bridge:p=>{sent.push(p);return true},sceneDoc:()=>structuredClone(scene),prompt:()=> 'Desktop',confirm:()=>true,applyDoc:s=>{c.loaded=s},child:{sendToPluginBridge(){}},addEventListener(){}});c.window=c;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../com.pipeweaver.opendeck.sdPlugin/propertyInspector/scene-presets.js'),'utf8'),c);
 function reply(extra={}){const request=sent.at(-1);c.scenePresetsUpdate({requestId:request.requestId,ok:true,entries:[],...extra})}
 return {c,node,sent,messages,storage,reply};
}
test('fresh browser storage loads disk presets; selected preset and its fade data can be loaded',()=>{
 const u=ui();u.c.refreshPresets();u.reply({entries:[{name:'Desktop',scene}]});assert(u.node('presetSelect').innerHTML.includes('Desktop'));
 u.node('presetSelect').value='Desktop';u.c.loadPreset();assert.equal(u.c.loaded.operations[0].milliseconds,1500);
 u.c.refreshPresets();u.reply({entries:[{name:'Desktop',scene}]});assert.equal(u.node('presetSelect').value,'Desktop');
});
test('legacy browser cache is cleared only after migration succeeds and retained on failure',()=>{
 const u=ui({Legacy:scene});u.c.refreshPresets();u.reply();assert.equal(u.sent.at(-1).command,'importScenePresets');assert(u.storage.size);
 u.reply({ok:false,error:'disk full'});assert(u.storage.size);assert.equal(u.messages.at(-1).k,'error');
 u.c.refreshPresets();u.reply();u.reply({entries:[{name:'Legacy',scene}]});assert.equal(u.storage.size,0);assert(u.node('presetSelect').innerHTML.includes('Legacy'));
});
test('saving does not claim success or update the preset list until the plugin confirms persistence',()=>{
 const u=ui();u.c.refreshPresets();u.reply();u.c.savePreset();assert.equal(u.sent.at(-1).command,'saveScenePreset');assert.equal(Object.keys(u.c.presetMap()).length,0);assert(!u.messages.some(m=>m.k==='ok'));
 u.reply({entries:[{name:'Desktop',scene}],selected:'Desktop',message:'Saved preset Desktop'});assert.equal(u.node('presetSelect').value,'Desktop');assert.equal(u.messages.at(-1).k,'ok');
});
test('the real nested Scene bridge loads and saves durable presets and keeps preset-based export filenames',t=>{
 const {file}=fixture(t),layer=installScenePresets({file}),nodes=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',className:''});return nodes.get(id)};
 const parent=vm.createContext({document:{getElementById:node},localStorage:{getItem:()=>null,removeItem(){}},prompt:()=> 'Persistent Desktop',confirm:()=>true,addEventListener(){},console});parent.window=parent;
 const childDoc={hidden:false,addEventListener(){},getElementById:node,createElement:()=>({textContent:'',remove(){}}),head:{appendChild:s=>vm.runInContext(s.textContent,child)}};
 const child=vm.createContext({document:childDoc,parent,console,setTimeout:f=>{f();return 1},setInterval:()=>1,clearInterval(){},addEventListener(){},transport:m=>{
  requests.push(m.payload);layer.handleIncoming({send:s=>vm.runInContext('websocket',child).onmessage({data:s})},{data:JSON.stringify(m)});
 }});child.window=child;
 vm.runInContext(`let websocket,appRefreshTimer=null;const info={context:'scene-key'};function requestApplications(){}function connectElgatoStreamDeckSocket(){websocket={readyState:1,send:s=>transport(JSON.parse(s)),onopen(){},onmessage(){}}}`,child);
 child.exportScene=()=>{node('sceneJson').value=JSON.stringify(scene)};
 const pi=path.join(__dirname,'../com.pipeweaver.opendeck.sdPlugin/propertyInspector');
 vm.runInContext(fs.readFileSync(path.join(pi,'scene-v0151.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],parent);
 vm.runInContext(fs.readFileSync(path.join(pi,'scene-presets.js'),'utf8'),parent);
 parent.frameWindow=child;vm.runInContext('child=frameWindow;installBridge()',parent);child.connectElgatoStreamDeckSocket();vm.runInContext('websocket.onopen({})',child);
 assert(requests.some(p=>p.command==='getScenePresets'));
 parent.savePreset();assert.equal(createStore(file).change('getScenePresets').entries[0].name,'Persistent Desktop');
 parent.downloadScene();assert.equal(requests.at(-1).fileName,'Persistent-Desktop.weaverdeck-scene.json');assert.equal(requests.at(-1).scene.name,'Persistent Desktop');
});
