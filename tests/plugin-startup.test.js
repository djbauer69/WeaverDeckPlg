'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../com.pipeweaver.opendeck.sdPlugin');
test('the real entry point loads the consolidated core and registers once through its socket adapters',()=>{
 const output=execFileSync(process.execPath,['-e',String.raw`
  const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
  const root=process.argv[1],sockets=[],sent=[],requests=[];
  global.setTimeout=()=>1;global.clearTimeout=()=>{};
  require('node:http').request=(options,callback)=>{
   const req=new EventEmitter();let body='';req.write=s=>body+=s;req.destroy=()=>{};
   req.end=()=>{requests.push(JSON.parse(body));queueMicrotask(()=>{
    const res=new EventEmitter();res.statusCode=200;res.setEncoding=()=>{};callback(res);
    res.emit('data',JSON.stringify({Status:{audio:{profile:{devices:{sources:{virtual_devices:[]},targets:{virtual_devices:[]}}},applications:{}}}}));res.emit('end');
   })};return req;
  };
  class Socket{
   constructor(url){this.url=url;this.readyState=1;sockets.push(this)}
   send(s){sent.push(JSON.parse(s))}close(){}addEventListener(){}removeEventListener(){}
  }
  global.WebSocket=Socket;
  process.argv=['node',root+'/plugin.js','-port','1234','-pluginUUID','cleanup-test'];
  require(root+'/plugin.js');
  assert.equal(sockets.length,1);
  assert.equal(sockets[0].url,'ws://127.0.0.1:1234');
  assert.notEqual(global.WebSocket,Socket,'presentation adapters must remain installed');
  sockets[0].onopen();
  setImmediate(()=>{
   assert.deepEqual(sent.filter(m=>m.event==='registerPlugin'),[{event:'registerPlugin',uuid:'cleanup-test'}]);
   assert(requests.includes('GetStatus'),'startup must query PipeWeaver status');
   assert(!Object.keys(require.cache).some(p=>/\/core-v[^/]*\.js$/.test(p)));
   assert(require.cache[root+'/plugin-core.js']);
   sockets[0].onmessage({data:JSON.stringify({event:'propertyInspectorDidAppear',context:'key'})});
   assert.deepEqual(sent.at(-1),{event:'sendToPropertyInspector',context:'key',payload:{command:'inspectorVisibility',visible:true}});
   sockets[0].onmessage({data:JSON.stringify({event:'sendToPlugin',context:'key',payload:{command:'inspectorReady'}})});
   assert.equal(sent.at(-1).payload.visible,true,'lifecycle handshake must pass through the actual runtime socket adapter');
   console.log('startup-ok');
  });
 `,root],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']});
 assert.match(output,/startup-ok/);
});
