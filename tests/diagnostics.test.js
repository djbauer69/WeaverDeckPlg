'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin'),{create}=require(root+'/diagnostics');
test('normal mode skips serializing full event settings while retaining preview summaries; debug can restore dumps',()=>{
 for(const debug of [false,true]){
  const output=[],sink={log:(...x)=>output.push(x),error:(...x)=>output.push(x),warn:(...x)=>output.push(x)},diagnostics=create({env:debug?{WEAVERDECK_DEBUG:'1'}:{},sink}),native=createRequire(root+'/plugin-core.js');
  const c=vm.createContext({require:name=>name==='./diagnostics'?diagnostics:native(name),process:{env:{},argv:['node','plugin','-port','1','-pluginUUID','test']},console:sink,setTimeout,clearTimeout,Buffer,URL});
  const source=fs.readFileSync(root+'/plugin-core.js','utf8');vm.runInContext(source.slice(0,source.indexOf('diag("startup",')),c);
  c.payload={toJSON(){output.push(['serialized']);return {settings:'large discovery payload'}}};vm.runInContext('diag("OpenDeck event",payload)',c);
  assert.equal(output.some(x=>x[0]==='serialized'),debug);
  vm.runInContext('diag("previewScene reply",{ok:true,steps:38,errors:0})',c);assert(output.some(x=>String(x[0]).includes('previewScene reply')));
 }
});
test('quiet inspector logging preserves visibility replies and redraw handling',()=>{
 const output=[],diagnostics=create({env:{},sink:{error:s=>output.push(s)}}),c={module:{exports:{}},require:()=>diagnostics};
 vm.runInNewContext(fs.readFileSync(root+'/inspector-lifecycle.js','utf8'),c);
 const layer=c.module.exports.installInspectorLifecycle(),sent=[],socket={send:s=>sent.push(JSON.parse(s))};
 layer.handleIncoming(socket,{data:JSON.stringify({event:'propertyInspectorDidAppear',context:'key'})});
 assert.equal(sent[0].payload.visible,true);
 assert.equal(layer.handleIncoming(socket,{data:JSON.stringify({event:'sendToPlugin',context:'key',payload:{command:'inspectorRedraw',viewport:255,content:500,from:0,to:1}})}),true);
 assert.equal(output.length,0);
});
