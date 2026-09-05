"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin');
const {installButtonPresentation}=require(root+'/button-presentation');
const manifest=require(root+'/manifest.json');
const title=(layer,context,text)=>JSON.parse(layer.handleOutgoing(JSON.stringify({event:'setTitle',context,payload:{title:text,target:0}}))).payload.title;
test('every action supports dynamic, manual, blank, legacy custom, and settings changes',()=>{
 const layer=installButtonPresentation();
 for(const action of manifest.Actions){
  const context=action.UUID;
  const settings=s=>layer.handleIncoming(null,{data:JSON.stringify({event:'didReceiveSettings',context,action:context,payload:{settings:s}})});
  settings({});assert.equal(title(layer,context,'Live 50%'),'Live 50%');
  settings({buttonText:'Old label'});assert.equal(title(layer,context,'Live'),'Old label');
  settings({textMode:'dynamic',buttonText:'Saved manual label'});assert.equal(title(layer,context,'Live'),'Live');
  settings({textMode:'manual',buttonText:'Desk\n<&> 🔊'});assert.equal(title(layer,context,'Live'),'Desk\n<&> 🔊');
  settings({textMode:'manual',buttonText:''});assert.equal(title(layer,context,'Live'),'');
  layer.handleIncoming(null,{data:JSON.stringify({event:'willDisappear',context})});assert.equal(title(layer,context,'Live'),'Live');
 }
});
test('Scene success and delayed title use the common text policy',()=>{
 const layer=installButtonPresentation(),scene=require(root+'/scene-visuals').installSceneVisuals(),sent=[];
 const incoming={data:JSON.stringify({event:'willAppear',action:'com.pipeweaver.opendeck.scene',context:'scene',payload:{settings:{name:'Default',textMode:'manual',buttonText:'My scene'}}})};
 const socket={send:data=>sent.push(JSON.parse(layer.handleOutgoing(data)))};
 layer.handleIncoming(socket,incoming);scene.handleIncoming(socket,incoming);
 scene.handleOutgoing(socket,JSON.stringify({event:'showOk',context:'scene'}));assert.equal(sent[0].payload.title,'My scene');
 scene.handleIncoming(socket,{data:JSON.stringify({event:'willDisappear',context:'scene'})});
});
function core(){
 const c=vm.createContext({require:createRequire(root+'/plugin-core.js'),process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','test']},console:{log(){},error(){},warn(){}},setTimeout,clearTimeout,Buffer,URL});
 let source=require(root+'/core-v0191').build();source=source.slice(0,source.indexOf('diag("startup",'));vm.runInContext(source,c);
 c.sent=[];vm.runInContext('send=m=>sent.push(m)',c);return c;
}
test('all non-app volume actions show actual current volume, correct A/B, physical ID, 0%, and offline unknown',()=>{
 const c=core();c.fixture={audio:{profile:{devices:{sources:{virtual_devices:[{name:'Browser',volumes:{volume:{A:0,B:62}}}]},targets:{virtual_devices:[{name:'Headphones',volume:37}]}}},devices:{Source:[{id:'mic',name:'Mic',volume:24}],Target:[{id:'speaker',name:'Speakers',volume:89}]}}};
 vm.runInContext('lastStatus=fixture',c);
 const cases={sourcevoldown:62,sourcevolup:62,sourcesetvolume:62,sourceavoldown:0,sourceavolup:0,sourcebvoldown:62,sourcebvolup:62,volumedown:37,volumeup:37,setvolume:37,physvoldown:89,physvolup:89,physinvoldown:24,physinvolup:24};
 for(const [suffix,value] of Object.entries(cases)){
  c.i={action:'com.pipeweaver.opendeck.'+suffix,context:suffix,settings:{sourceName:'Browser',mix:'B',targetName:'Headphones',volume:99,deviceId:suffix.startsWith('physin')?'mic':'speaker'}};
  c.sent.length=0;vm.runInContext('updateInstance(i)',c);
  const img=c.sent.find(m=>m.event==='setImage');assert(img,suffix);
  const svg=Buffer.from(img.payload.image.split(',')[1],'base64').toString();assert(svg.includes('>'+value+'%</text>'),suffix);assert(svg.includes('x="110" y="124"'));
  c.sent.length=0;vm.runInContext('updateInstance(i)',c);assert(!c.sent.some(m=>m.event==='setImage'),'unchanged image cached');
  vm.runInContext('lastStatus=null;updateInstance(i)',c);assert(Buffer.from(c.sent.find(m=>m.event==='setImage').payload.image.split(',')[1],'base64').toString().includes('>?</text>'));
  vm.runInContext('lastStatus=fixture',c);
 }
 c.i={action:'com.pipeweaver.opendeck.appvolup',context:'app',settings:{}};c.sent.length=0;vm.runInContext('updateInstance(i)',c);assert(!c.sent.some(m=>m.event==='setImage'),'application artwork remains owned by app visuals');
});
function ui(){
 const nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:true,events:{},addEventListener(e,f){this.events[e]=f}});return nodes.get(id)}
 const c=vm.createContext({document:{getElementById:node},console});c.window=c;
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/button-inspectors.js','utf8'),c);
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/button-settings.js','utf8'),c);
 const sent=[];let sock;
 class WS{constructor(){this.readyState=1;this.listeners=[]}send(s){sent.push(JSON.parse(s))}addEventListener(e,f){this.listeners.push(f)}}
 const legacyRow={hidden:false};
 const inner={WebSocket:WS,document:{getElementById:id=>id==='buttonText'?{closest:()=>legacyRow}:null,querySelectorAll:()=>[]}};
 const middle={WebSocket:class extends WS{},document:{getElementById:()=>null,querySelectorAll:()=>[{contentWindow:inner,addEventListener(){}}]}};
 const outer={WebSocket:class extends WS{},document:{getElementById:()=>null,querySelectorAll:()=>[{contentWindow:middle,addEventListener(){}}]},connectElgatoStreamDeckSocket(){sock=new inner.WebSocket();sock.send(JSON.stringify({event:'registerPropertyInspector',uuid:'pi'}))}};
 node('inspector').contentWindow=outer;
 c.connectElgatoStreamDeckSocket(1234,'pi','registerPropertyInspector','{}',JSON.stringify({action:'com.pipeweaver.opendeck.scene',context:'key',payload:{settings:{name:'Scene',operations:[{type:'wait',milliseconds:200}],buttonText:'Legacy'}}}));
 node('inspector').onload();return {c,node,sent,socket:sock,legacyRow};
}
test('nested inspectors share one socket; manual edits survive old Scene saves and receive-settings',()=>{
 const u=ui();assert.equal(u.node('inspector').src,'scene-v018.html');assert.equal(u.node('textMode').value,'manual');assert(u.legacyRow.hidden);assert.equal(u.sent.filter(m=>m.event==='registerPropertyInspector').length,1);
 u.node('manualText').value='New scene label';u.node('manualText').events.input();assert.equal(u.sent.at(-1).payload.operations[0].milliseconds,200);
 u.socket.send(JSON.stringify({event:'setSettings',context:'key',payload:{name:'Edited scene',operations:[{type:'audioRestart'}],buttonText:'stale'}}));
 assert.equal(u.sent.at(-1).payload.buttonText,'New scene label');assert.equal(u.sent.at(-1).payload.name,'Edited scene');
 u.node('textMode').value='dynamic';u.node('textMode').events.change();assert.equal(u.sent.at(-1).payload.textMode,'dynamic');assert.equal(u.sent.at(-1).payload.operations[0].type,'audioRestart');
 for(const listener of u.socket.listeners)listener({data:JSON.stringify({event:'didReceiveSettings',context:'key',payload:{settings:{textMode:'manual',buttonText:'Remote',name:'Remote scene'}}})});
 assert.equal(u.node('manualText').value,'Remote');assert.equal(u.node('textMode').value,'manual');
});
test('every manifest action maps to an existing original inspector and entry point starts latest core',()=>{
 const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(root+'/propertyInspector/button-inspectors.js','utf8'),c);
 for(const a of manifest.Actions){assert.equal(a.PropertyInspectorPath,'propertyInspector/button-settings.html');assert(fs.existsSync(root+'/propertyInspector/'+c.window.buttonInspectors[a.UUID]),a.UUID)}
 assert(fs.readFileSync(root+'/plugin.js','utf8').includes('require("./core-v0191").start()'));
 new vm.Script(require(root+'/core-v0191').build());
});
