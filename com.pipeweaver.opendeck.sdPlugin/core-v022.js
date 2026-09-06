"use strict";
const path=require('path'),Module=require('module');
function build(){
 let source=require('./core-v021').build();
 function replace(before,after){if(source.split(before).length!==2)throw Error('v0.22 anchor missing or ambiguous: '+before);source=source.replace(before,after)}
 replace("const fades021=require('./volume-fades').create({resolve:resolveFade021,refresh:refreshStatus,command:pipeCommand021,ok:isOk,log:m=>console.log('[Fade] '+m)});",`const fadeDurationMs022=require('./volume-fades').durationMs;
function fadeDurationLabel022(op){const ms=fadeDurationMs022(op);return Number.isFinite(ms)?Math.round(ms)+'ms':'?ms'}
const fades021=require('./volume-fades').create({resolve:resolveFade021,refresh:refreshStatus,command:pipeCommand021,ok:isOk,log:m=>console.log('[Fade] '+m)});`);
 replace("String(fade.volume??0)+'% / '+String(fade.seconds??3)+'s'","String(fade.volume??0)+'% / '+fadeDurationLabel022(fade)");
 replace("if(op.type==='volumeFade')return 'Volume Fade '+op.kind+' to '+op.volume+'% over '+op.seconds+'s';","if(op.type==='volumeFade')return 'Volume Fade '+op.kind+' to '+op.volume+'% over '+fadeDurationLabel022(op);");
 replace('async function handleMessage(m) {',`const holdTimers022=new Map();
function holdMs022(i){const n=Number(i.settings?.holdMs);return Number.isFinite(n)&&n>=50&&n<=2000?Math.round(n):200}
function holdSpec022(i){
 const st=i.settings||{},a=i.action;
 if(a===ACTIONS.sourceVolUp)return {delta:1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:st};
 if(a===ACTIONS.sourceVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:st};
 if(a===ACTIONS.sourceAVolUp)return {delta:1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'A'}};
 if(a===ACTIONS.sourceAVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'A'}};
 if(a===ACTIONS.sourceBVolUp)return {delta:1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'B'}};
 if(a===ACTIONS.sourceBVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.sourcevolumedial',settings:{...st,mix:'B'}};
 if(a===ACTIONS.volUp)return {delta:1,action:'com.pipeweaver.opendeck.targetvolumedial',settings:st};
 if(a===ACTIONS.volDown)return {delta:-1,action:'com.pipeweaver.opendeck.targetvolumedial',settings:st};
 if(a===ACTIONS.appVolUp)return {delta:1,action:'com.pipeweaver.opendeck.appvolumedial',settings:st};
 if(a===ACTIONS.appVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.appvolumedial',settings:st};
 if(a===ACTIONS.physVolUp)return {delta:1,action:'com.pipeweaver.opendeck.physvolumedial',settings:st};
 if(a===ACTIONS.physVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.physvolumedial',settings:st};
 if(a===ACTIONS.physInVolUp)return {delta:1,action:'com.pipeweaver.opendeck.physinvolumedial',settings:st};
 if(a===ACTIONS.physInVolDown)return {delta:-1,action:'com.pipeweaver.opendeck.physinvolumedial',settings:st};
 return null;
}
async function holdStep022(i){
 const spec=holdSpec022(i);if(!spec)return false;
 try{
 const status=await refreshStatus(),d=describeDial020({action:spec.action,settings:spec.settings},status);
 if(!d.volumeCommand||!Number.isFinite(d.volume)){showAlert(i.context);return false}
 const raw=Number(i.settings?.step),step=Number.isFinite(raw)&&raw>0?Math.round(raw):DEFAULT_STEP,next=Math.max(0,Math.min(100,d.volume+spec.delta*step));
 if(next===d.volume){showOk(i.context);return false}
 const r=await pipeCommand({Pipewire:d.volumeCommand(next)});if(!isOk(r))throw new Error(JSON.stringify(r));await refreshStatus();showOk(i.context);return true}
 catch(e){console.error('[Hold] Volume command failed:',e.message);showAlert(i.context);return false}
}
function holdStop022(context){const job=holdTimers022.get(context);if(!job)return;job.active=false;clearTimeout(job.timer);holdTimers022.delete(context)}
function holdClear022(){for(const context of [...holdTimers022.keys()])holdStop022(context)}
function holdStart022(i,repeat=true){
 if(!holdSpec022(i))return false;
 holdStop022(i.context);
 const job={active:true,timer:null,busy:false};holdTimers022.set(i.context,job);
 const tick=async()=>{if(!job.active||job.busy)return;job.busy=true;const ok=await holdStep022(i);job.busy=false;if(!job.active)return;if(ok&&repeat)job.timer=setTimeout(tick,holdMs022(i));else holdStop022(i.context)};
 tick();return true;
}
async function handleMessage(m) {`);
 replace("if(e==='willDisappear'||e==='didReceiveSettings')dials020.cancel(m.context);","if(e==='willDisappear'||e==='didReceiveSettings'){dials020.cancel(m.context);holdStop022(m.context)}\n  if(e==='keyUp'){holdStop022(m.context);return;}");
 replace("const fade=fadeButton021(i);if(fade)return runFadeButton021(i,fade);","if(holdStart022(i,!m.payload?.isInMultiAction))return;\n    const fade=fadeButton021(i);if(fade)return runFadeButton021(i,fade);");
 replace('fades021.clear();dials020.clear();startup019.disconnected();','holdClear022();fades021.clear();dials020.clear();startup019.disconnected();');
 return source;
}
function start(){const filename=path.join(__dirname,'plugin-core.js'),patched=new Module(filename,module);patched.filename=filename;patched.paths=module.paths;patched._compile(build(),filename)}
module.exports={build,start};
