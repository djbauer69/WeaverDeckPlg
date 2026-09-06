'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {readLibrary,mutateLibrary,installSceneLibrary}=require('../com.pipeweaver.opendeck.sdPlugin/scene-library');
const {createStore}=require('../com.pipeweaver.opendeck.sdPlugin/scene-presets');
const {migrateSavedPresets,importBrowserPresets}=require('../com.pipeweaver.opendeck.sdPlugin/scene-library-migration');
const scene={format:'WeaverDeckScene',formatVersion:1,sceneVersion:1,name:'Desktop',operations:[{type:'volumeFade',kind:'target',targetName:'Desktop',volume:40,milliseconds:1500}]};
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weaver-unified-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'library.json'),legacy=path.join(dir,'presets.json');return {file,legacy,presets:createStore(legacy),save:(name,s=scene)=>mutateLibrary('saveSceneLibrary',{name,scene:s},file),migrate:()=>migrateSavedPresets(file,legacy),read:()=>readLibrary(file)}}
test('migration preserves both collections, deduplicates identical entries and leaves the old preset file intact',t=>{
 const x=fixture(t);x.save('Desktop',{...scene,operations:[]});x.save('Same');
 x.presets.change('saveScenePreset',{name:'Desktop',scene});x.presets.change('saveScenePreset',{name:'Same',scene});x.presets.change('saveScenePreset',{name:'New',scene});
 const before=fs.readFileSync(x.legacy,'utf8');const {doc}=x.migrate();assert.deepEqual(Object.keys(doc.scenes).sort(),['Desktop','Desktop (Preset)','New','Same']);
 assert.equal(doc.scenes.Desktop.operations.length,0);assert.equal(doc.scenes['Desktop (Preset)'].operations[0].milliseconds,1500);assert.equal(fs.readFileSync(x.legacy,'utf8'),before);
 const saved=fs.readFileSync(x.file,'utf8');x.migrate();assert.equal(fs.readFileSync(x.file,'utf8'),saved);
});
test('conflicting suffixed, long and reserved names remain distinct and reload correctly',t=>{
 const x=fixture(t);x.save('Desktop',{...scene,operations:[]});x.save('Desktop (Preset)',{...scene,operations:[]});
 const long='x'.repeat(96);x.save(long,{...scene,operations:[]});
 for(const name of ['Desktop',long,'__proto__','constructor'])x.presets.change('saveScenePreset',{name,scene});
 x.migrate();const doc=x.read();assert(doc.scenes['Desktop (Preset 2)']);assert(doc.scenes.__proto__);assert(doc.scenes.constructor);assert(Object.keys(doc.scenes).every(n=>n.length<=96));assert.equal(Object.keys(doc.scenes).length,7);
});
test('migration history survives library rename, delete and restart, including stale browser copies',t=>{
 const x=fixture(t);x.presets.change('saveScenePreset',{name:'Desktop',scene});x.migrate();
 mutateLibrary('renameSceneLibrary',{name:'Desktop',newName:'Renamed'},x.file);x.migrate();assert(!Object.hasOwn(x.read().scenes,'Desktop'));
 mutateLibrary('deleteSceneLibrary',{name:'Renamed'},x.file);x.migrate();importBrowserPresets({Desktop:scene},x.file,x.legacy);assert.equal(Object.keys(x.read().scenes).length,0);
});
test('unmigrated browser presets merge without replacing library values and deleted browser imports stay deleted',t=>{
 const x=fixture(t);x.save('Desktop',{...scene,operations:[]});importBrowserPresets({Desktop:scene},x.file,x.legacy);assert.equal(x.read().scenes['Desktop (Preset)'].operations.length,1);
 mutateLibrary('deleteSceneLibrary',{name:'Desktop (Preset)'},x.file);importBrowserPresets({Desktop:scene},x.file,x.legacy);assert.equal(Object.keys(x.read().scenes).length,1);
});
test('invalid migration input never overwrites existing library or preset data',t=>{
 const x=fixture(t);x.save('Existing');const before=fs.readFileSync(x.file,'utf8');fs.writeFileSync(x.legacy,'broken');assert.throws(()=>x.migrate());assert.equal(fs.readFileSync(x.file,'utf8'),before);assert.equal(fs.readFileSync(x.legacy,'utf8'),'broken');
 fs.unlinkSync(x.legacy);assert.throws(()=>importBrowserPresets({Good:scene,Bad:{operations:'bad'}},x.file,x.legacy));assert.equal(fs.readFileSync(x.file,'utf8'),before);
});
function migrationUI(){
 const storage=new Map([['key',JSON.stringify({Desktop:scene})]]),sent=[];
 const c=vm.createContext({PRESET_KEY:'key',localStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},bridge:p=>{sent.push(p);return true},status(){},child:null,refreshLibrary(){},addEventListener(){}});c.window=c;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../com.pipeweaver.opendeck.sdPlugin/propertyInspector/scene-library-migration.js'),'utf8'),c);return {c,storage,sent};
}
test('browser migration clears its source only after a matching successful acknowledgement',()=>{
 const u=migrationUI();u.c.sceneLibraryMigrationResult({ok:true,operation:'getSceneLibrary'});assert(u.storage.size);const request=u.sent.at(-1);
 u.c.sceneLibraryMigrationResult({ok:false,operation:'importBrowserPresets',requestId:request.requestId});assert(u.storage.size);
 u.c.sceneLibraryMigrationResult({ok:true,operation:'getSceneLibrary'});u.c.sceneLibraryMigrationResult({ok:true,operation:'importBrowserPresets',requestId:u.sent.at(-1).requestId});assert.equal(u.storage.size,0);
});
test('migration acknowledgement does not erase a browser cache edited while import was pending',()=>{
 const u=migrationUI();u.c.sceneLibraryMigrationResult({ok:true,operation:'getSceneLibrary'});u.storage.set('key',JSON.stringify({Other:scene}));u.c.sceneLibraryMigrationResult({ok:true,requestId:u.sent.at(-1).requestId});assert(u.storage.get('key').includes('Other'));
});
test('the nested Scene inspector uses only Scene Library and exports the selected library name',t=>{
 const x=fixture(t);x.presets.change('saveScenePreset',{name:'Persistent Desktop',scene});
 const layer=installSceneLibrary({filePath:x.file,legacyPresetPath:x.legacy}),nodes=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',className:''});return nodes.get(id)};
 const parent=vm.createContext({document:{getElementById:node},localStorage:{getItem:()=>null,removeItem(){}},prompt:()=> 'Fresh Scene',confirm:()=>true,addEventListener(){},console});parent.window=parent;
 const childDoc={hidden:false,addEventListener(){},getElementById:node,createElement:()=>({textContent:'',remove(){}}),head:{appendChild:s=>vm.runInContext(s.textContent,child)}};
 const child=vm.createContext({document:childDoc,parent,console,setTimeout:f=>{f();return 1},setInterval:()=>1,clearInterval(){},addEventListener(){},transport:m=>{requests.push(m.payload);layer.handleIncoming({send:s=>vm.runInContext('websocket',child).onmessage({data:s})},{data:JSON.stringify(m)})}});child.window=child;
 vm.runInContext(`let websocket,appRefreshTimer=null;const info={context:'scene-key'};function requestApplications(){}function connectElgatoStreamDeckSocket(){websocket={readyState:1,send:s=>transport(JSON.parse(s)),onopen(){},onmessage(){}}}`,child);
 child.exportScene=()=>{node('sceneJson').value=JSON.stringify(scene)};child.importScene=()=>{child.loaded=JSON.parse(node('sceneJson').value)};
 const pi=path.join(__dirname,'../com.pipeweaver.opendeck.sdPlugin/propertyInspector'),html=fs.readFileSync(path.join(pi,'scene-v0151.html'),'utf8');assert(!html.includes('id="presetSelect"'));assert(html.includes('id="librarySelect"'));
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],parent);vm.runInContext(fs.readFileSync(path.join(pi,'scene-library-migration.js'),'utf8'),parent);
 parent.frameWindow=child;vm.runInContext('child=frameWindow;installBridge()',parent);child.connectElgatoStreamDeckSocket();vm.runInContext('websocket.onopen({})',child);
 assert(node('librarySelect').innerHTML.includes('Persistent Desktop'));node('librarySelect').value='Persistent Desktop';parent.loadSelectedLibrary();assert.equal(child.loaded.operations[0].milliseconds,1500);
 parent.downloadScene();assert.equal(requests.at(-1).fileName,'Persistent-Desktop.weaverdeck-scene.json');
 parent.saveLibraryAs();assert(x.read().scenes['Fresh Scene']);assert.equal(node('librarySelect').value,'Fresh Scene');
});
test('failed migration commit leaves both source collections intact and can be retried',t=>{
 const x=fixture(t);x.save('Library');x.presets.change('saveScenePreset',{name:'Preset',scene});const libraryBefore=fs.readFileSync(x.file,'utf8'),presetsBefore=fs.readFileSync(x.legacy,'utf8');
 const rename=fs.renameSync;try{fs.renameSync=()=>{throw new Error('simulated disk failure')};assert.throws(()=>x.migrate(),/simulated disk failure/)}finally{fs.renameSync=rename}
 assert.equal(fs.readFileSync(x.file,'utf8'),libraryBefore);assert.equal(fs.readFileSync(x.legacy,'utf8'),presetsBefore);
 x.migrate();assert.deepEqual(Object.keys(x.read().scenes).sort(),['Library','Preset']);
});
