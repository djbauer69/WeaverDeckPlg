'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../com.pipeweaver.opendeck.sdPlugin/propertyInspector'),P='com.pipeweaver.opendeck.';
function harness(group,settings={},controller='Keypad',multi=false){
 const nodes=new Map();
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.classList={add(){}};this.value='';this.dataset={};}
  set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
  append(...xs){this.children.push(...xs)}appendChild(x){this.append(x);return x}
  add(x){this.append(x)}replaceChildren(...xs){this.children=xs}
  setAttribute(k,v){this[k]=v}addEventListener(k,fn){this.listeners[k]=fn}
  change(value){this.value=value;this.listeners.change?.();this.onchange?.()}
  insertBefore(x){this.children.unshift(x)}querySelector(){return new Element('label')}
  querySelectorAll(){return []}
  set innerHTML(v){for(const id of ['weaverTextMode','weaverManual','weaverManualText']){const e=new Element('input');e.id=id;this.append(e)}}
 }
 const document={createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id),body:new Element('body'),head:new Element('head'),currentScript:{dataset:{weaverDirect:'true'}},querySelectorAll:()=>[]};
 for(const id of ['groupControls','groupStatus','groupRefresh']){const e=new Element('div');e.id=id;document.body.append(e)}
 const sent=[];let socket;
 class WebSocket{constructor(){socket=this;this.readyState=1;this.listeners=[]}send(s){sent.push(JSON.parse(s))}addEventListener(k,fn){if(k==='message')this.listeners.push(fn)}receive(m){const ev={data:JSON.stringify({context:'ctx',...m})};this.onmessage?.(ev);for(const fn of this.listeners)fn(ev)}}
 const win={document,WebSocket,WeaverInspectorLayout:{watch:()=>()=>{}}};
 const context=vm.createContext({window:win,document,WebSocket,Option:function(text,value){this.text=text;this.value=value},console});
 for(const f of ['action-catalog.js','app-identity-v017.js','grouped.js','button-settings.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),context);
 win.connectElgatoStreamDeckSocket('123','pi','registerPropertyInspector','{}',JSON.stringify({context:'ctx',action:P+group,payload:{settings,controller,isInMultiAction:multi}}));socket.onopen();
 return {get:id=>nodes.get(id),sent,receive:m=>socket.receive(m),save:()=>sent.filter(m=>m.event==='setSettings').at(-1)?.payload};
}
test('group operation changes retain device, numeric preferences and shared manual text',()=>{
 const h=harness('physicalinput',{operation:P+'physinvolup',deviceId:'mic',deviceName:'Microphone',step:7,holdMs:125,textMode:'manual',buttonText:'Desk'});
 assert(h.sent.some(m=>m.event==='registerPropertyInspector'));assert(h.sent.some(m=>m.payload?.command==='getTargets'));
 assert.equal(h.get('group-step').value,7);assert.equal(h.get('group-holdMs').value,125);
 h.get('weaverManualText').value='Voice';h.get('weaverManualText').oninput();
 h.get('groupOperation').change(P+'physinvolumefade');
 assert.equal(h.save().buttonText,'Voice');assert.equal(h.save().deviceId,'mic');assert.equal(h.save().step,7);
 h.get('group-milliseconds').change('250');assert.equal(h.save().milliseconds,250);
 h.get('groupIcon').change('electric-guitar');assert.equal(h.save().deviceIcon,'electric-guitar');
 assert.equal(h.get('groupIcon').children.length,7);
 const editing=h.get('group-milliseconds');editing.value='275';
 h.receive({event:'sendToPropertyInspector',payload:{command:'targets',physicalInputs:[{id:'mic',name:'Microphone'}]}});
 assert.equal(h.get('group-milliseconds'),editing,'discovery does not replace an active numeric editor');assert.equal(editing.value,'275');
 h.get('group-milliseconds').change('-1');assert.equal(h.save().milliseconds,250);assert.match(h.get('groupStatus').textContent,/between/);
});
test('all six group inspectors list their keypad operations and encoder operation is controller-specific',()=>{
 for(const group of ['application','physicalinput','physicaloutput','routing','sourcecontrol','targetcontrol']){
  const h=harness(group);assert(h.get('groupOperation').children.length>=3);
  assert(h.get('groupOperation').children.every(o=>!o.value.endsWith('volumedial')));
 }
 const h=harness('physicaloutput',{},'Encoder');assert.deepEqual(h.get('groupOperation').children.map(o=>o.value),[P+'physvolumedial']);
 assert.equal(h.get('groupIcon').children.length,5);
 const multi=harness('physicalinput',{},'Keypad',true);assert(multi.get('groupOperation').children.every(o=>!o.value.endsWith('volumefade')));
});
test('application identity, offline selection and incoming saved settings survive operation switching',()=>{
 const h=harness('application',{name:'brave',process:'brave',deviceType:'Source',operation:P+'appmute'});
 assert(h.get('group-application').children.some(o=>o.text.includes('offline')));
 h.get('groupOperation').change(P+'appsetvolume');assert.equal(h.save().name,'brave');
 h.receive({event:'didReceiveSettings',payload:{settings:{operation:P+'appvolumefade',name:'brave',process:'brave',deviceType:'Source',milliseconds:625,textMode:'manual',buttonText:'Browser'}}});
 assert.equal(h.get('group-milliseconds').value,625);
 h.get('group-volume').change('42');assert.equal(h.save().buttonText,'Browser');assert.equal(h.save().volume,42);
});
