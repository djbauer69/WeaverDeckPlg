"use strict";
const {performance}=require('perf_hooks');
const kinds=['application','source','target','input','output'];
function durationMs(op){
 const value=op.milliseconds!==undefined&&op.milliseconds!==null&&op.milliseconds!==''?op.milliseconds:Number(op.seconds)*1000;
 return Number(value);
}
function validate(op){
 const errors=[];
 const hasMilliseconds=op.milliseconds!==undefined&&op.milliseconds!==null;
 const ms=durationMs(op);
 if(!kinds.includes(op.kind))errors.push('Select a fade control type');
 if(op.volume===''||op.volume==null||!Number.isFinite(Number(op.volume))||Number(op.volume)<0||Number(op.volume)>100)errors.push('Fade volume must be 0–100');
 if((hasMilliseconds&&op.milliseconds==='')||(!hasMilliseconds&&(op.seconds==null||op.seconds===''))||!Number.isFinite(ms)||ms<0||ms>120000)errors.push('Fade duration must be 0–120000 milliseconds');
 if(op.kind==='application'&&!op.application?.name&&!op.application?.process)errors.push('Select an application');
 if(op.kind==='source'&&(!op.sourceName||!['A','B'].includes(op.mix)))errors.push('Select a source and mix A/B');
 if(op.kind==='target'&&!op.targetName)errors.push('Select a target');
 if(['input','output'].includes(op.kind)&&!op.device?.id&&!op.device?.name)errors.push('Select a physical device');
 return errors;
}
function create(api,{now=()=>performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const active=new Map();let intervention=0;
 function cancel(key){intervention++;const job=active.get(key);if(job)job.cancelled=true;return job?.done}
 function clear(){intervention++;for(const job of active.values())job.cancelled=true}
 async function run(op){
  const errors=validate(op);if(errors.length)throw Error(errors.join('; '));
  const ticket=intervention;
  const initial=api.resolve(op,await api.refresh());
  if(ticket!==intervention)throw Error('Fade cancelled while waiting for PipeWeaver');
  if(!initial.key||!Number.isFinite(initial.volume))throw Error('Fade device/application unavailable or ambiguous');
  const key=initial.key,previous=active.get(key);if(previous)previous.cancelled=true;
  let finish;const job={cancelled:false,done:new Promise(r=>finish=r)};active.set(key,job);
  function check(){if(job.cancelled)throw Error('Fade cancelled by another control or disconnect')}
  function resolve(status){const d=api.resolve(op,status);if(d.key!==key||!Number.isFinite(d.volume))throw Error('Fade device/application disappeared or changed identity');return d}
  try{
   if(previous)await previous.done;check();
   const start=resolve(await api.refresh());check();
   const from=start.volume,target=Math.round(Number(op.volume)),duration=Math.round(durationMs(op)),began=now();let expected=from;
   api.log('START '+initial.name+' '+from+'% -> '+target+'% in '+duration+'ms');
   if(from===target){api.log('COMPLETE '+initial.name+' already at '+target+'%');return}
   for(;;){
    if(duration)await sleep(Math.min(100,Math.max(0,duration-(now()-began))));check();
    const d=resolve(await api.refresh());check();
    if(Math.abs(d.volume-expected)>1)throw Error('Fade cancelled: volume changed externally');
    const progress=duration?Math.min(1,(now()-began)/duration):1;
    const value=Math.round(from+(target-from)*progress);
    if(value!==expected){
     const r=await api.command({Pipewire:d.volumeCommand(value)});if(!api.ok(r))throw Error('PipeWeaver rejected fade command: '+JSON.stringify(r));expected=value;
    }
    check();if(progress===1)break;
   }
   const end=resolve(await api.refresh());check();
   if(Math.abs(end.volume-target)>1)throw Error('Fade final volume was not confirmed');
   api.log('COMPLETE '+initial.name+' '+target+'%');
  }catch(e){api.log('STOP '+initial.name+': '+e.message);throw e}
  finally{if(active.get(key)===job)active.delete(key);finish()}
 }
 return {run,cancel,clear};
}
module.exports={create,validate,durationMs};
