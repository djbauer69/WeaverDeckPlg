'use strict';
// Pure planning: this module receives read helpers only, never command/execute APIs.
function create(a){
 return function preview(operations,status){
  const result={generatedAt:new Date().toISOString(),readOnly:true,ok:false,blocked:false,errors:[],warnings:[],steps:[]};
  if(!status?.audio?.profile){result.errors.push({step:0,message:'PipeWeaver status unavailable. Start PipeWeaver and preview again.'});return result}
  if(!Array.isArray(operations)||!operations.length){result.errors.push({step:0,message:'No structured Scene steps to preview. Legacy raw commands are not previewed.'});return result}
  let validation;
  try{validation=a.validate(operations,status)}catch(e){validation={ok:false,errors:[{step:0,message:e.message}],warnings:[]}}
  result.errors.push(...validation.errors);result.warnings.push(...validation.warnings);result.blocked=!validation.ok;
  const values=new Map();let uncertain=false;
  const get=(key,current)=>uncertain?null:values.has(key)?values.get(key):current;
  const read=(d,property,mix)=>property==='volume'?(mix?a.sourceVolume(d,mix):a.targetVolume(d)):property==='muted'?(mix?(d?.mute_states?.mute_state==null?null:a.sourceMuted(d,mix)):a.targetMuted(d)):property==='mix'?a.targetMix(d):a.sourceLinked(d);
  const pool=type=>[...a.configured(status,type),...a.physical(status,type==='source'?'input':'output')];
  function unique(list,label){const byId=new Map(list.map(d=>[String(a.id(d)),d]));if(byId.size!==1)throw new Error(`${label}: ${byId.size?'ambiguous selection':'not available'}`);return [...byId.values()][0]}
  const named=(type,name)=>unique(pool(type).filter(d=>a.name(d)===name),name||type);
  function physical(type,descriptor){const list=a.physical(status,type),ids=descriptor?.id?list.filter(d=>String(a.id(d))===String(descriptor.id)):[];return unique(ids.length?ids:list.filter(d=>descriptor?.name&&a.name(d)===descriptor.name),descriptor?.name||descriptor?.id||'Physical '+type)}
  function apps(descriptor){const all=a.applications(status),matches=a.resolveApps(all,descriptor);if(!matches.length&&all.some(x=>a.appScore(x,descriptor)>=0))throw new Error('Ambiguous application: '+a.appLabel(descriptor));return matches}
  for(let idx=0;idx<operations.length;idx++){
   const op=operations[idx],step={step:idx+1,type:op?.type||'unknown',title:'',condition:'Always',failurePolicy:op?.onFailure==='continue'?'continue':'stop',outcome:'unchanged',changes:[],notes:[]};result.steps.push(step);
   const local=validation.errors.filter(e=>e.step===idx+1);if(local.length){step.outcome='error';step.notes.push(...local.map(e=>e.message));continue}
   let deferred=false;
   function change(key,target,property,current,after){
    const before=get(key,current),known=before!==null&&before!==undefined,nextKnown=after!==null&&after!==undefined;
    const same=known&&nextKnown&&JSON.stringify(before)===JSON.stringify(after);
    const outcome=uncertain||!known||!nextKnown?'uncertain':same?'unchanged':'change';
    step.changes.push({target,property,before:known?before:null,after:nextKnown?after:null,outcome});
    if(!uncertain)values.set(key,after);
   }
   function device(d,property,after,mix){const key='device:'+a.id(d)+':'+property+(mix?':'+mix:'');change(key,a.name(d)+(mix?' · '+mix:''),property,read(d,property,mix),after)}
   function volume(d,value,mix){
    device(d,'volume',value,mix);
    if(mix&&get('device:'+a.id(d)+':linked',a.sourceLinked(d))!==false){
     const other=mix==='A'?'B':'A';device(d,'volume',null,other);step.notes.push('Linked mix volume requires a fresh status reading; its result is not assumed.');
    }
   }
   function appEffect(descriptor,property,after){
    const matches=apps(descriptor);
    if(!matches.length){step.changes.push({target:a.appLabel(descriptor),property,before:null,after,outcome:uncertain?'uncertain':'skipped'});step.notes.push('Application has no matching active stream; the runner skips it.');return}
    for(const app of matches){
     let before=app[property],next=after;
     if(property==='route'){
      const type=String(app.deviceType).toLowerCase()==='target'?'target':'source';
      before=app.targetId?(pool(type).find(d=>a.id(d)===app.targetId)?a.name(pool(type).find(d=>a.id(d)===app.targetId)):'Unknown destination'):'Default';
      if(next!=='Default')named(type,next);
     }
     change('app:'+app.nodeId+':'+property,a.appLabel(app),property,before,next);
    }
   }
   try{
    step.title=a.describe(op);
    const c=a.condition(op);step.condition=c.type==='always'?'Always':(c.type==='applicationNotRunning'?'If not running: ':'If running: ')+a.appLabel(c.application);
    if(c.type!=='always'){
     const running=apps(c.application).length>0,met=c.type==='applicationNotRunning'?!running:running;
     if(uncertain){step.notes.push('Condition must be checked again after an earlier wait, fade or engine change.');deferred=true}
     else if(!met){step.outcome='skipped';step.notes.push('Condition is not met in the current snapshot.');continue}
    }
    const mix=op.mix==='B'?'B':'A',sources=a.names(op.sources),targets=a.names(op.targets),v=Math.round(Number(op.volume));
    switch(op.type){
     case 'sourceMute':for(const n of sources)device(named('source',n),'muted',op.state!=='unmuted',mix);break;
     case 'sourceVolumeLink':for(const n of sources)device(named('source',n),'linked',op.state!=='unlinked');break;
     case 'sourceVolume':for(const n of sources)volume(named('source',n),v,mix);break;
     case 'targetMute':for(const n of targets)device(named('target',n),'muted',op.state!=='unmuted');break;
     case 'targetVolume':for(const n of targets)volume(named('target',n),v);break;
     case 'targetMix':for(const n of targets)device(named('target',n),'mix',mix);break;
     case 'route':for(const s of sources)for(const t of targets){const src=named('source',s),dst=named('target',t);change('route:'+a.id(src)+':'+a.id(dst),s+' → '+t,'route enabled',a.route(status,s,t),op.state!=='off')}break;
     case 'physicalInputMute':case 'physicalOutputMute':device(physical(op.type==='physicalInputMute'?'input':'output',op.device),'muted',op.state!=='unmuted');break;
     case 'physicalInputVolume':case 'physicalOutputVolume':volume(physical(op.type==='physicalInputVolume'?'input':'output',op.device),v);break;
     case 'defaultDevice':{
      const type=op.deviceType==='input'?'input':'output',d=physical(type,op.device),id=a.defaultId(status,type),before=a.physical(status,type).find(x=>a.id(x)===id);
      change('default:'+type,'Default '+type,'device',before?a.name(before):null,a.name(d));break;
     }
     case 'applicationMute':for(const d of a.sceneApps(op.applications))appEffect(d,'muted',op.state!=='unmuted');break;
     case 'applicationVolume':for(const d of a.sceneApps(op.applications))appEffect(d,'volume',v);break;
     case 'applicationRoute':for(const d of a.sceneApps(op.applications))appEffect(d,'route',op.state==='off'?'Default':op.targetName);break;
     case 'wait':step.notes.push('Wait '+Math.round(Number(op.milliseconds))+' ms. No waiting occurs during preview.');step.outcome='wait';if(Number(op.milliseconds)>0)deferred=true;break;
     case 'volumeFade':{
      if(op.kind==='application'){
       if(!apps(op.application).length)throw new Error('Fade application is not available: '+a.appLabel(op.application));
       appEffect(op.application,'volume',v);
      }else if(op.kind==='source')volume(named('source',op.sourceName),v,mix);
      else if(op.kind==='target')volume(named('target',op.targetName),v);
      else volume(physical(op.kind,op.device),v);
      const ms=a.duration(op);step.notes.push('Fade duration: '+ms+' ms. Mute remains unchanged.');if(ms>0)deferred=true;break;
     }
     case 'audioRestart':step.outcome='uncertain';step.notes.push('Restart audio engine and await recovery. Playback may need to be resumed. This is not executed by preview.');deferred=true;break;
     case 'audioBuffer':{
      const q=a.quantum(op.bufferSize),current=status.audio.profile.audio_node_quantum;
      change('quantum','Audio engine','buffer',current===null?'PipeWire configured':current??null,q===null?'PipeWire configured':q);
      if(step.changes[0].outcome!=='unchanged'){step.notes.push('Buffer changes require engine recovery; playback may need to be resumed.');deferred=true}break;
     }
     case 'sourceMuteDestinations':{
      const configured=a.configured(status,'target'),desired=op.mode==='all'?[]:[...new Set(targets.map(n=>a.id(unique(configured.filter(d=>a.name(d)===n),n))))];
      for(const n of sources){const d=unique(a.configured(status,'source').filter(d=>a.name(d)===n),n),key='destinations:'+a.id(d)+':'+mix,current=d?.mute_states?.mute_targets?.['Target'+mix],ids=get(key,current);let next;
       if(op.mode==='set'||op.mode==='all')next=configured.length&&configured.every(t=>desired.includes(a.id(t)))?[]:desired;
       else if(Array.isArray(ids)){next=[...ids];for(const id of desired){const present=next.includes(id),add=op.mode==='add'||(op.mode==='toggle'&&!present);if(add&&!present)next.push(id);if(!add&&present)next=next.filter(x=>x!==id)}}
       const label=xs=>Array.isArray(xs)?xs.length?xs.map(id=>a.name(configured.find(t=>a.id(t)===id))||String(id)).sort():['All targets']:null;
       step.changes.push({target:n+' · '+mix,property:'mute destinations',before:label(ids),after:label(next),outcome:uncertain||!Array.isArray(ids)||!Array.isArray(next)?'uncertain':JSON.stringify(label(ids))===JSON.stringify(label(next))?'unchanged':'change'});
       if(!uncertain)values.set(key,next);step.notes.push('An empty destination list means All targets. This changes destinations, not the mute state.');
      }break;
     }
     default:throw new Error('Unsupported Scene operation: '+op.type);
    }
    if(step.changes.length){const states=step.changes.map(x=>x.outcome);step.outcome=states.includes('uncertain')?'uncertain':states.includes('change')?'change':states.every(x=>x==='skipped')?'skipped':states.includes('skipped')?'uncertain':'unchanged'}
    if(uncertain)step.notes.push('Provisional: an earlier timed or engine step requires a fresh status check.');
    if(deferred)uncertain=true;
   }catch(e){step.outcome='error';step.notes.push(e.message);result.errors.push({step:idx+1,message:e.message});uncertain=true}
  }
  result.ok=!result.errors.length;result.summary={};for(const s of result.steps)result.summary[s.outcome]=(result.summary[s.outcome]||0)+1;
  result.notice='Read-only snapshot. Projected values assume preceding steps succeed. No audio commands, waits or restarts were executed. Conditions and availability can change before a real run.';
  if(result.blocked)result.notice+=' Existing Scene validation would prevent the whole Scene from running.';
  return result;
 };
}
module.exports={create};
