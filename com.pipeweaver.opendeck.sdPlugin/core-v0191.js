"use strict";
const path=require('path'),Module=require('module');
function build(){
  let source=require('./core-v019').build();
  const anchor='function updateInstance(i){';
  if(source.split(anchor).length!==2)throw new Error('v0.19.1 updateInstance anchor missing or ambiguous');
  source=source.replace(anchor,`const volumeArt0191=require('./volume-visuals').artwork;
function updateInstance(i){
  updateInstance0191(i);
  const a=i.action.split('.').pop(),st=i.settings||{};
  let volume=null,owned=true;
  if(['sourcevoldown','sourcevolup','sourcesetvolume','sourceavoldown','sourceavolup','sourcebvoldown','sourcebvolup'].includes(a)){
    const mix=a.startsWith('sourcea')?'A':a.startsWith('sourceb')?'B':st.mix||'A';
    volume=sourceVolume(findNamedSource(lastStatus,st.sourceName),mix);
  }else if(['volumedown','volumeup','setvolume'].includes(a)){
    volume=targetVolume(findNamedTarget(lastStatus,st.targetName));
  }else if(['physvoldown','physvolup','physinvoldown','physinvolup'].includes(a)){
    volume=targetVolume(physicalDevices(lastStatus,a.startsWith('physin')?'input':'output').find(d=>deviceId(d)===st.deviceId));
  }else owned=false;
  if(owned){
    const image=volumeArt0191(volume,a.endsWith('down'));
    if(i.volumeImage0191!==image){i.volumeImage0191=image;send({event:'setImage',context:i.context,payload:{image}})}
  }
}
function updateInstance0191(i){`);
  return source;
}
function start(){const filename=path.join(__dirname,'plugin-core.js'),patched=new Module(filename,module);patched.filename=filename;patched.paths=module.paths;patched._compile(build(),filename)}
module.exports={build,start};
