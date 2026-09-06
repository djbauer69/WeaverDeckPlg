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
 let source=fs.readFileSync(root+"/plugin-core.js","utf8");source=source.slice(0,source.indexOf('diag("startup",'));vm.runInContext(source,c);
 c.sent=[];vm.runInContext('send=m=>sent.push(m)',c);return c;
}
function holdCore(){
 const timers=new Map();let nextTimer=1;
 const c=vm.createContext({
  require:createRequire(root+'/plugin-core.js'),
  process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','test']},
  console:{log(){},error(){},warn(){}},
  setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id},
  clearTimeout:id=>timers.delete(id),
  Buffer,URL
 });
 let source=fs.readFileSync(root+"/plugin-core.js","utf8");source=source.slice(0,source.indexOf('diag("startup",'));vm.runInContext(source,c);
 c.status={audio:{profile:{devices:{sources:{virtual_devices:[]},targets:{virtual_devices:[{id:'dst',name:'Desktop',volume:50,muted:false}]}}}},devices:{Source:[],Target:[]}};
 c.commands=[];
 vm.runInContext("refreshStatus=async()=>status;pipeCommand=async cmd=>{commands.push(cmd);status.audio.profile.devices.targets.virtual_devices[0].volume=cmd.Pipewire.SetVolumeByName[2];return 'Ok'};showOk=()=>{};showAlert=()=>{}",c);
 async function flush(){for(let n=0;n<20;n++)await new Promise(setImmediate)}
 async function runTimer(){const entry=timers.entries().next().value;assert(entry);timers.delete(entry[0]);entry[1].fn();await flush();return entry[1].ms}
 return {c,timers,flush,runTimer};
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
test('volume buttons repeat while held and stop on key release',async()=>{
 const h=holdCore();
 const eligible=['sourcevolup','sourcevoldown','sourceavolup','sourceavoldown','sourcebvolup','sourcebvoldown','volumeup','volumedown','appvolup','appvoldown','physvolup','physvoldown','physinvolup','physinvoldown'];
 for(const suffix of eligible){h.c.i={action:'com.pipeweaver.opendeck.'+suffix,settings:{}};assert.equal(vm.runInContext('!!holdSpec022(i)',h.c),true,suffix)}
 h.c.i={action:'com.pipeweaver.opendeck.setvolume',settings:{}};assert.equal(vm.runInContext('!!holdSpec022(i)',h.c),false);
 await h.c.handleMessage({event:'willAppear',action:'com.pipeweaver.opendeck.volumeup',context:'key',payload:{settings:{targetName:'Desktop',step:5,holdMs:150}}});
 await h.c.handleMessage({event:'keyDown',context:'key'});await h.flush();
 assert.equal(h.c.commands.length,1);assert.deepEqual(JSON.parse(JSON.stringify(h.c.commands[0].Pipewire.SetVolumeByName)),['Desktop',null,55]);assert.equal(h.timers.values().next().value.ms,150);
 assert.equal(await h.runTimer(),150);assert.equal(h.c.commands.length,2);assert.deepEqual(JSON.parse(JSON.stringify(h.c.commands[1].Pipewire.SetVolumeByName)),['Desktop',null,60]);
 await h.c.handleMessage({event:'keyUp',context:'key'});assert.equal(h.timers.size,0);
});
test('Multi Action volume buttons apply one step without scheduling hold repeats',async()=>{
 const h=holdCore();
 await h.c.handleMessage({event:'willAppear',action:'com.pipeweaver.opendeck.volumeup',context:'multi',payload:{isInMultiAction:true,settings:{targetName:'Desktop',step:3,holdMs:50}}});
 await h.c.handleMessage({event:'keyDown',context:'multi',payload:{isInMultiAction:true}});await h.flush();
 assert.equal(h.c.commands.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(h.c.commands[0].Pipewire.SetVolumeByName)),['Desktop',null,53]);
 assert.equal(h.timers.size,0);
 assert.equal(vm.runInContext('holdTimers022.size',h.c),0);
});
function ui({direct=false,nested=true,actualFade=false,legacyOpenDeck=false}={}){
 const nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:true,events:{},addEventListener(e,f){this.events[e]=f}});return nodes.get(id)}
 const fitted=[];
 const c=vm.createContext({document:{getElementById:node},console});c.window=c;c.WeaverInspectorLayout={fit(frame){fitted.push(frame)},watch(){return ()=>{}}};
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/button-inspectors.js','utf8'),c);
 const sent=[];let sock;
 class WS{constructor(){this.readyState=1;this.listeners=[];sock=this}send(s){sent.push(JSON.parse(s))}addEventListener(e,f){this.listeners.push(f)}}
 const legacyRow={hidden:false};
 function doc(frames=[]){
  const map=new Map();
  function el(id){
   let current=id;
   const o={value:'',hidden:false,disabled:false,style:{},className:'',innerHTML:'',textContent:'',classList:{add(){}},appendChild(){},addEventListener(){},insertBefore(child){this.firstChild=child},querySelector:s=>s==='label.weaver-manual'?{hidden:false}:null,closest:()=>legacyRow};
   Object.defineProperty(o,'id',{get(){return current},set(v){current=v;if(v)map.set(v,o)}});
   o.id=id;return o;
  }
  const d={body:el('body'),head:{appendChild(){}},createElement:()=>el(''),getElementById(id){if(id==='buttonText')return {closest:()=>legacyRow};if(['weaverTextControls','weaverActionHeader'].includes(id)&&!map.has(id))return null;if(!map.has(id))map.set(id,el(id));return map.get(id)},querySelectorAll:()=>frames};
  return d;
 }
 const inner={WebSocket:WS,document:doc()};
 const middle={WebSocket:class extends WS{},document:doc([{contentWindow:inner,addEventListener(){}}])};
 const outer={WebSocket:class extends WS{},document:doc(nested?[{contentWindow:middle,addEventListener(){}}]:[]),connectElgatoStreamDeckSocket(){sock=new (direct&&!nested?c.WebSocket:inner.WebSocket)();sock.send(JSON.stringify({event:'registerPropertyInspector',uuid:'pi'}))}};
 if(direct){c.document=outer.document;c.document.currentScript={dataset:{weaverDirect:'true'}};c.WebSocket=outer.WebSocket;c.connectElgatoStreamDeckSocket=outer.connectElgatoStreamDeckSocket;
  if(actualFade){vm.runInContext(fs.readFileSync(root+'/propertyInspector/fade-ui.js','utf8'),c);vm.runInContext(fs.readFileSync(root+'/propertyInspector/fade.js','utf8'),c)}
  else vm.runInContext('let latest,preferences,context,socket,rawSend;const frame=123;function save(){}',c);
 }
 vm.runInContext(fs.readFileSync(root+'/propertyInspector/button-settings.js','utf8'),c);
 if(legacyOpenDeck){c.URL=URL;c.location={href:'http://localhost:1234/plugins/weaver/propertyInspector/button-settings.html%7Copendeck_property_inspector',replace(url){this.destination=url}}}
 node('inspector').contentWindow=outer;
 c.connectElgatoStreamDeckSocket(1234,'pi','registerPropertyInspector','{}',JSON.stringify({action:actualFade?'com.pipeweaver.opendeck.physinvolumefade':'com.pipeweaver.opendeck.scene',context:'key',payload:{settings:{name:'Scene',operations:[{type:'wait',milliseconds:200}],buttonText:'Legacy'}}}));
 if(actualFade)sock.onopen();
 if(!direct&&!legacyOpenDeck)node('inspector').onload();return {c,node,sent,socket:sock,legacyRow,fitted,controls:{mode:outer.document.getElementById('weaverTextMode'),input:outer.document.getElementById('weaverManualText')}};
}
test('nested inspectors share one socket; manual edits survive old Scene saves and receive-settings',()=>{
 const u=ui();assert.equal(u.node('inspector').src,'scene-v022.html');assert.equal(u.controls.mode.value,'manual');assert(u.legacyRow.hidden);assert.equal(u.sent.filter(m=>m.event==='registerPropertyInspector').length,1);
 assert.equal(u.fitted.length,3);assert.equal(u.fitted.at(-1),u.node('inspector'),'the top editor must expand too, leaving scrolling to the outer inspector');
 u.controls.input.value='New scene label';u.controls.input.oninput();assert.equal(u.sent.at(-1).payload.operations[0].milliseconds,200);
 u.socket.send(JSON.stringify({event:'setSettings',context:'key',payload:{name:'Edited scene',operations:[{type:'audioRestart'}],buttonText:'stale'}}));
 assert.equal(u.sent.at(-1).payload.buttonText,'New scene label');assert.equal(u.sent.at(-1).payload.name,'Edited scene');
 u.controls.mode.value='dynamic';u.controls.mode.onchange();assert.equal(u.sent.at(-1).payload.textMode,'dynamic');assert.equal(u.sent.at(-1).payload.operations[0].type,'audioRestart');
 for(const listener of u.socket.listeners)listener({data:JSON.stringify({event:'didReceiveSettings',context:'key',payload:{settings:{textMode:'manual',buttonText:'Remote',name:'Remote scene'}}})});
 assert.equal(u.controls.input.value,'Remote');assert.equal(u.controls.mode.value,'manual');
});
test('every manifest action maps to an existing original inspector and entry point starts latest core',()=>{
 const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(root+'/propertyInspector/button-inspectors.js','utf8'),c);
 for(const a of manifest.Actions){assert.equal(a.PropertyInspectorPath,'propertyInspector/'+c.window.buttonInspectors[a.UUID]);const html=fs.readFileSync(root+'/'+a.PropertyInspectorPath,'utf8');assert(html.includes('data-weaver-direct="true"'),a.UUID);assert(!html.includes('id="inspector"'),a.UUID);if(a.UUID!=='com.pipeweaver.opendeck.scene')assert(!html.includes('<iframe'),a.UUID)}
 assert(fs.readFileSync(root+'/plugin.js','utf8').includes('require("./plugin-core")'));
 new vm.Script(fs.readFileSync(root+"/plugin-core.js","utf8"));
});
test('direct action editors preserve common text settings with no containing iframe or global-name collisions',()=>{
 const u=ui({direct:true,nested:false});assert.equal(u.fitted.length,0);
 assert.equal(u.sent.filter(m=>m.event==='registerPropertyInspector').length,1);
 assert.equal(u.c.document.getElementById('weaverActionName').textContent,'Scene');
 assert.equal(u.controls.mode.value,'manual');assert.equal(u.controls.input.value,'Legacy');
 u.controls.input.value='My label';u.controls.input.oninput();
 u.socket.send(JSON.stringify({event:'setSettings',context:'key',payload:{volume:25,milliseconds:750,buttonText:'stale'}}));
 assert.equal(u.sent.at(-1).payload.buttonText,'My label');assert.equal(u.sent.at(-1).payload.milliseconds,750);
 for(const listener of u.socket.listeners)listener({data:JSON.stringify({event:'didReceiveSettings',context:'key',payload:{settings:{textMode:'dynamic',buttonText:'Updated'}}})});
 assert.equal(u.controls.mode.value,'dynamic');assert.equal(u.controls.input.value,'Updated');
});
test('direct Scene editor patches both remaining child layers and retains one registered socket',()=>{
 const u=ui({direct:true,nested:true});assert.equal(u.fitted.length,2);assert.equal(u.sent.filter(m=>m.event==='registerPropertyInspector').length,1);
 u.controls.input.value='Scene label';u.controls.input.oninput();
 u.socket.send(JSON.stringify({event:'setSettings',context:'key',payload:{operations:[{type:'wait',milliseconds:750}],buttonText:'old'}}));
 assert.equal(u.sent.at(-1).payload.buttonText,'Scene label');assert.equal(u.sent.at(-1).payload.operations[0].milliseconds,750);
});
test('the actual physical fade inspector connects directly and saves device/duration plus common text',()=>{
 const u=ui({direct:true,nested:false,actualFade:true}),doc=u.c.document;
 assert.equal(u.fitted.length,0);assert.equal(doc.getElementById('weaverActionName').textContent,'Physical Input Volume Fade');
 assert.equal(u.sent.filter(m=>m.event==='registerPropertyInspector').length,1);
 assert.equal(u.sent.at(-1).payload.command,'getTargets');
 u.controls.input.value='Microphone';u.controls.input.oninput();
 doc.getElementById('selection').value=JSON.stringify({device:{id:'mic',name:'C922'}});
 doc.getElementById('milliseconds').value='200';doc.getElementById('volume').value='100';
 u.c.save();const settings=u.sent.at(-1).payload;
 assert.equal(settings.device.id,'mic');assert.equal(settings.kind,'input');assert.equal(settings.milliseconds,'200');assert.equal(settings.volume,'100');assert.equal(settings.buttonText,'Microphone');
});
test('existing OpenDeck profiles navigate from the old inspector path without editing saved settings',()=>{
 const u=ui({legacyOpenDeck:true});
 assert.equal(decodeURI(u.c.location.destination),'http://localhost:1234/plugins/weaver/propertyInspector/scene-v022.html|opendeck_property_inspector');
 assert.equal(u.sent.length,0,'let OpenDeck reconnect the destination document; do not register or mutate settings in the old wrapper');
 assert.equal(u.fitted.length,0);
});
