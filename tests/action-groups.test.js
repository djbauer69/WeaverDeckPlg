'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin'),G=require(root+'/action-groups'),P='com.pipeweaver.opendeck.';
test('12 sidebar entries cover all 51 grouped legacy operations without losing the six utility actions',()=>{
 const m=require(root+'/manifest.json');assert.equal(m.Actions.length,12);assert.equal(G.catalog.groups.length,6);
 const old=new Set(G.catalog.legacy.map(a=>a.UUID)),mapped=G.catalog.groups.flatMap(g=>g.operations.map(o=>o.uuid));
 assert.equal(mapped.length,51);assert.equal(new Set(mapped).size,51);
 for(const id of mapped)assert(old.has(id));
 assert.deepEqual(m.Actions.filter(a=>!G.groups.has(a.UUID)).map(a=>a.UUID).sort(),[...old].filter(id=>!mapped.includes(id)).sort());
 const c={window:{}};vm.runInNewContext(fs.readFileSync(root+'/propertyInspector/action-catalog.js','utf8'),c);assert.deepEqual(JSON.parse(JSON.stringify(c.window.WeaverActionCatalog)),G.catalog);
});
test('group operation resolution is bounded by family and controller and preserves legacy passthrough',()=>{
 for(const g of G.catalog.groups){
  for(const o of g.operations){const r=G.resolve(g.uuid,{operation:o.uuid,deviceId:'mic',deviceName:'Mic',name:'Brave',process:'/opt/brave',deviceType:'Source',mix:'B'},o.controller);assert.equal(r.action,o.uuid);assert.equal(r.invalid,false);if(o.uuid.endsWith('volumefade')){if(g.name==='Application')assert.equal(r.settings.application.process,'/opt/brave');if(g.name.startsWith('Physical'))assert.equal(r.settings.device.id,'mic')}}
  assert.equal(G.resolve(g.uuid,{operation:P+'audiorestart'}).invalid,true);
  if(g.encoderAction){assert.equal(G.resolve(g.uuid,{operation:g.defaultAction},'Encoder').action,g.encoderAction);assert.equal(G.resolve(g.uuid,{operation:g.encoderAction},'Keypad').invalid,true)}
 }
 assert.equal(G.resolve(P+'appmute',{}),null);
});
function harness(){
 const timers=new Map();let next=0;const adapter=G.createAdapter();
 const c=vm.createContext({require:createRequire(root+'/plugin-core.js'),process:{env:{},argv:['node','plugin','-port','1234','-pluginUUID','groups-test']},console:{log(){},error(){},warn(){}},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),Buffer,URL});
 const source=fs.readFileSync(root+'/plugin-core.js','utf8');vm.runInContext(source.slice(0,source.indexOf('diag("startup",')),c);
 c.status={"audio": {"profile": {"devices": {"sources": {"virtual_devices": [{"id": "src", "name": "Browser", "volumes": {"volume": {"A": 30, "B": 60}, "volumes_linked": null}, "mute_states": {"mute_state": []}}]}, "targets": {"virtual_devices": [{"id": "dst", "name": "Headphones", "volume": 50, "muted": false, "mix": "A"}]}}}, "devices": {"Source": [{"id": "mic", "name": "Mic", "volume": 25, "muted": false}], "Target": [{"id": "speaker", "name": "Speakers", "volume": 40, "muted": false}]}, "applications": {"Source": {"brave": {"Brave": [{"node_id": 42, "volume": 50, "muted": false}]}}}}};
 c.sent=[];c.commands=[];c.fades=[];
 vm.runInContext("lastStatus=status;send=m=>sent.push(m);refreshStatus=async()=>status;pipeCommand=async cmd=>{commands.push(cmd);return 'Ok'};fades021.run=async op=>{fades.push(op)}",c);
 const event=async m=>{await c.handleMessage(JSON.parse(adapter.adapt({data:JSON.stringify(m)}).data));for(let n=0;n<10;n++)await new Promise(setImmediate)};
 return {c,timers,event};
}
test('real core dispatches grouped app, physical, route, source and target operations through the existing command path',async()=>{
 const h=harness(),cases=[['application','appsetvolume',{name:'Brave',process:'brave',deviceType:'Source',volume:31},{SetApplicationVolume:[42,31]}],['physicalinput','physinmute',{deviceId:'mic'},{SetPhysicalDeviceMute:['mic',true]}],['physicaloutput','physvolup',{deviceId:'speaker',step:7},{SetPhysicalDeviceVolume:['speaker',47]}],['routing','routeon',{sourceName:'Browser',targetName:'Headphones'},{SetRouteByNames:['Browser','Headphones',true]}],['sourcecontrol','sourcesetvolume',{sourceName:'Browser',mix:'B',volume:18},{SetSourceVolume:['src','B',18]}],['targetcontrol','setvolume',{targetName:'Headphones',volume:22},{SetVolumeByName:['Headphones',null,22]}]];
 for(const [group,operation,settings,command] of cases){await h.event({event:'willAppear',action:P+group,context:group,payload:{controller:'Keypad',settings:{...settings,operation:P+operation}}});await h.event({event:'keyDown',context:group});assert.deepEqual(JSON.parse(JSON.stringify(h.c.commands.at(-1).Pipewire)),command);await h.event({event:'keyUp',context:group})}
});
test('changing operation cancels held repeats and uses new operation without losing saved device fields',async()=>{
 const h=harness(),settings={targetName:'Headphones',operation:P+'volumeup',step:3,holdMs:150};
 await h.event({event:'willAppear',action:P+'targetcontrol',context:'key',payload:{controller:'Keypad',settings}});await h.event({event:'keyDown',context:'key'});assert.equal(h.timers.size,1);
 await h.event({event:'didReceiveSettings',action:P+'targetcontrol',context:'key',payload:{settings:{...settings,operation:P+'muteon'}}});assert.equal(h.timers.size,0);
 await h.event({event:'keyDown',context:'key'});assert.deepEqual(JSON.parse(JSON.stringify(h.c.commands.at(-1).Pipewire)),{SetTargetMuteStatesByName:['Headphones','Muted']});
});
test('grouped fade receives the selected physical/application identity and is rejected in Multi Actions',async()=>{
 const h=harness();
 await h.event({event:'willAppear',action:P+'physicalinput',context:'key',payload:{controller:'Keypad',settings:{operation:P+'physinvolumefade',deviceId:'mic',deviceName:'Mic',volume:0,milliseconds:250}}});
 await h.event({event:'keyDown',context:'key',payload:{isInMultiAction:true}});assert.equal(h.c.fades.length,0);assert(h.c.sent.some(m=>m.event==='showAlert'));
 await h.event({event:'keyDown',context:'key'});assert.equal(h.c.fades.length,1);assert.equal(h.c.fades[0].device.id,'mic');assert.equal(h.c.fades[0].milliseconds,250);
 await h.event({event:'didReceiveSettings',action:P+'physicalinput',context:'key',payload:{settings:{operation:P+'appmute'}}});await h.event({event:'keyDown',context:'key'});assert.equal(h.c.commands.length,0);
});
test('physical icon artwork retains live percentage and mute state when switching operations',async()=>{
 const h=harness();const send=op=>h.event({event:'didReceiveSettings',action:P+'physicalinput',context:'key',payload:{settings:{operation:P+op,deviceId:'mic',deviceIcon:'electric-guitar'}}});
 await h.event({event:'willAppear',action:P+'physicalinput',context:'key',payload:{controller:'Keypad',settings:{operation:P+'physinvolup',deviceId:'mic',deviceIcon:'electric-guitar'}}});
 const latest=()=>Buffer.from(h.c.sent.filter(m=>m.event==='setImage'&&m.payload.image?.startsWith('data:')).at(-1).payload.image.split(',')[1],'base64').toString();
 assert(latest().includes('>25%</text>'));assert(latest().includes('32-32'));
 await send('physinmute');assert(latest().includes('>LIVE</text>'));
 h.c.status.audio.devices.Source[0].muted=true;vm.runInContext('updateAll()',h.c);assert(latest().includes('>MUTE</text>'));
 await send('physinvolumefade');assert(latest().includes('>25%</text>'));
});
test('all ten device icons are bounded authored SVGs and untrusted icon paths are rejected',()=>{
 const art=require(root+'/physical-artwork');assert.equal(Object.keys(art.shapes).length,10);
 for(const icon of [...art.input,...art.output]){const s=art.svg(icon,{volume:0});assert(s.includes('viewBox="0 0 144 144"'));assert(s.includes('>0%</text>'));assert(!s.includes('undefined'));assert(!s.includes('http',s.indexOf('viewBox')))}
 assert(!art.valid('../webcam','input'));assert(!art.valid('airpods','input'));assert(!art.valid('microphone','output'));
});
// Match OpenDeck's set_image -> convert_icon resolution, not browser URL rules.
function hostIcon(image){
 assert.equal(typeof image,'string');
 const stem=path.join(root,image);
 return fs.existsSync(stem+'.svg')?stem+'.svg':fs.existsSync(stem+'@2x.png')?stem+'@2x.png':stem+'.png';
}
test('grouped Route, Target Mix and Target Mute send resolvable original artwork in both live states',async()=>{
 const h=harness(),target=h.c.status.audio.profile.devices.targets.virtual_devices[0];
 const latest=()=>h.c.sent.filter(m=>m.event==='setImage'&&m.payload.image).at(-1).payload.image;
 const cases=[
  ...['route','routeon','routeoff'].map(op=>['routing',op,['routeOff','routeOn'],state=>{h.c.status.audio.profile.routes={src:state?['dst']:[]}}]),
  ...['targetmixa','targetmixb','targetmixtoggle'].map(op=>['targetcontrol',op,['mixA','mixB'],state=>{target.mix=state?'B':'A'}]),
  ...['mute','muteon','muteoff'].map(op=>['targetcontrol',op,['muteLive','muteMuted'],state=>{target.muted=!!state}])
 ];
 for(const [group,operation,icons,set] of cases){
  set(0);
  await h.event({event:'willAppear',action:P+group,context:'key',payload:{controller:'Keypad',settings:{operation:P+operation,sourceName:'Browser',targetName:'Headphones'}}});
  for(const state of [0,1,0]){
   set(state);vm.runInContext('updateAll()',h.c);
   const filename=hostIcon(latest());assert(fs.existsSync(filename),operation+' must resolve to an existing file');
   assert.equal(fs.readFileSync(filename,'utf8'),fs.readFileSync(root+'/icons/'+icons[state]+'.svg','utf8'),operation+' state '+state);
  }
  await h.event({event:'willDisappear',context:'key'});
 }
});
test('switching a grouped Target between volume, mix and mute replaces the previous artwork',async()=>{
 const h=harness();
 await h.event({event:'willAppear',action:P+'targetcontrol',context:'key',payload:{controller:'Keypad',settings:{operation:P+'volumeup',targetName:'Headphones'}}});
 for(const [operation,icon] of [['targetmixtoggle','mixA'],['mute','muteLive'],['targetmixb','mixA']]){
  await h.event({event:'didReceiveSettings',action:P+'targetcontrol',context:'key',payload:{settings:{operation:P+operation,targetName:'Headphones'}}});
  const image=h.c.sent.filter(m=>m.event==='setImage'&&m.payload.image).at(-1).payload.image;
  assert.equal(hostIcon(image),root+'/icons/'+icon+'.svg');assert(fs.existsSync(hostIcon(image)));
 }
});
test('Audio utilities refresh old saved artwork with the PipeWeaver logo without sending audio commands',async()=>{
 const h=harness(),m=require(root+'/manifest.json');
 for(const suffix of ['audiobuffer','audiorestart']){
  const action=m.Actions.find(a=>a.UUID===P+suffix);
  assert.equal(action.Icon,'icons/plugin');assert(action.States.every(s=>s.Image==='icons/plugin'));
  await h.event({event:'willAppear',action:action.UUID,context:suffix,payload:{settings:{bufferSize:'512'},states:[{image:'icons/statusOnline'},{image:'icons/routeOn'}]}});
  assert(h.c.sent.some(e=>e.event==='setImage'&&e.context===suffix&&e.payload.image==='icons/plugin'));
  const n=h.c.sent.filter(e=>e.event==='setImage').length;
  vm.runInContext('updateAll()',h.c);
  assert.equal(h.c.sent.filter(e=>e.event==='setImage').length,n);
 }
 assert.equal(h.c.commands.length,0);
});
