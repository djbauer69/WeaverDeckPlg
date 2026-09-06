"use strict";
const path=require('path'),Module=require('module');
function build(){
 let source=require('./core-v020').build();
 function replace(before,after){if(source.split(before).length!==2)throw Error('v0.21 anchor missing or ambiguous: '+before);source=source.replace(before,after)}
 replace('function pipeCommand(data){','function pipeCommand(data){const key=volumeResource021(data,lastStatus);if(key)return Promise.resolve(fades021.cancel(key)).then(()=>pipeCommand021(data));return pipeCommand021(data)}\nfunction pipeCommand021(data){');
 replace('function updateInstance(i){',`const fadeTypes021={appvolumefade:'application',sourcevolumefade:'source',targetvolumefade:'target',physinvolumefade:'input',physvolumefade:'output'};
function fadeButton021(i){const kind=fadeTypes021[i.action.split('.').pop()];return kind?{...i.settings,type:'volumeFade',kind}:null}
function volumeResource021(data,status){
 const p=data?.Pipewire;if(!p)return null;
 if(p.SetApplicationVolume)return 'app:'+p.SetApplicationVolume[0];
 if(p.SetSourceVolume)return 'device:'+p.SetSourceVolume[0];
 if(p.SetPhysicalDeviceVolume)return 'device:'+p.SetPhysicalDeviceVolume[0];
 if(p.SetVolumeByName){const id=deviceId(findNamedTarget(status,p.SetVolumeByName[0]));return id?'device:'+id:null}
 return null;
}
function resolveFade021(op,status){
 const prefix={application:'app',source:'source',target:'target',input:'physin',output:'phys'}[op.kind];
 const physical=['input','output'].includes(op.kind)?findScenePhysical(status,op.kind,op.device):null;
 const settings={...op,...op.application,deviceId:deviceId(physical),deviceName:deviceName(physical)};
 const d=describeDial020({action:'com.pipeweaver.opendeck.'+prefix+'volumedial',settings},status);
 return {...d,key:d.volumeCommand?volumeResource021({Pipewire:d.volumeCommand(0)},status):null};
}
const fades021=require('./volume-fades').create({resolve:resolveFade021,refresh:refreshStatus,command:pipeCommand021,ok:isOk,log:m=>console.log('[Fade] '+m)});
async function runFadeButton021(i,op){
 const run=Symbol();i.fadeRun=run;setTitle(i.context,'Fading…');
 try{await fades021.run(op);if(i.fadeRun===run)showOk(i.context)}
 catch(e){console.error('[Fade] Button: '+e.message);if(i.fadeRun===run)showAlert(i.context)}
 finally{if(i.fadeRun===run){delete i.fadeRun;updateInstance(i)}}
}
function updateInstance(i){
 const fade=fadeButton021(i);
 if(fade){const d=resolveFade021(fade,lastStatus);setTitle(i.context,(d.name||'Fade')+'\\n'+(i.fadeRun?'Fading…':String(fade.volume??0)+'% / '+String(fade.seconds??3)+'s'));setState(i.context,Number.isFinite(d.volume)?0:1);const image=volumeArt0191(d.volume);if(i.fadeImage!==image){i.fadeImage=image;send({event:'setImage',context:i.context,payload:{image}})}return;}`);
 replace('    switch(i.action){', '    const fade=fadeButton021(i);if(fade)return runFadeButton021(i,fade);\n    switch(i.action){');
 replace('    if(features018.supports(op)){',`    if(type==='volumeFade'){
      for(const message of require('./volume-fades').validate(op))add(errors,idx,type,message);
    }else if(features018.supports(op)){`);
 replace('  if(features018.supports(op))return features018.execute(op);', "  if(type==='volumeFade')return fades021.run(op);\n  if(features018.supports(op))return features018.execute(op);");
 replace('function sceneOperationDescription(op){',"function sceneOperationDescription(op){\n  if(op.type==='volumeFade')return 'Volume Fade '+op.kind+' to '+op.volume+'% over '+op.seconds+'s';");
 replace('dials020.clear();startup019.disconnected();','fades021.clear();dials020.clear();startup019.disconnected();');
 return source;
}
function start(){const filename=path.join(__dirname,'plugin-core.js'),patched=new Module(filename,module);patched.filename=filename;patched.paths=module.paths;patched._compile(build(),filename)}
module.exports={build,start};
