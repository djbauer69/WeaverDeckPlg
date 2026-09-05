"use strict";
const {mode}=require('./button-presentation');
const kinds={appvolumedial:'application',sourcevolumedial:'source',targetvolumedial:'target',physinvolumedial:'input',physvolumedial:'output'};
const kind=i=>kinds[String(i?.action||'').split('.').pop()];
function create(api,{schedule=setTimeout,now=Date.now}={}){
  let jobs=[],running=false;const pressed=new Set(),epochs=new Map();
  const current=j=>api.current(j.i)&&j.epoch===(epochs.get(j.i.context)||0);
  function render(i,status){
    if(!kind(i))return false;
    const d=api.describe(i,status),online=Number.isFinite(d.volume);
    const label=mode(i.settings)==='manual'?String(i.settings.buttonText??''):d.name;
    const payload={label:label.replace(/[\r\n]+/g,' '),value:online?Math.round(d.volume)+'%':'?',status:!online?'Unavailable':d.muted===true?'MUTED':d.muted===false?'Live':'Mute unknown',indicator:online?Math.max(0,Math.min(100,d.volume)):0};
    const key=JSON.stringify(payload);
    if(i.dialFeedback!==key){api.send({event:'setFeedback',context:i.context,payload});i.dialFeedback=key}
    return true;
  }
  function cancel(context){jobs=jobs.filter(j=>j.i.context!==context);pressed.delete(context);epochs.set(context,(epochs.get(context)||0)+1)}
  function clear(){jobs=[];pressed.clear();for(const [context,epoch] of epochs)epochs.set(context,epoch+1)}
  async function drain(){
    try{
      while(jobs.length){
        const j=jobs.shift();
        if(!current(j)||now()-j.time>2000)continue;
        try{
          const status=await api.refresh();
          if(!current(j)||now()-j.time>2000)continue;
          const d=api.describe(j.i,status);
          if(!Number.isFinite(d.volume)||!d.volumeCommand)throw Error('Configured device/application unavailable or ambiguous');
          let command;
          if(j.type==='rotate'){
            const raw=Number(j.i.settings.step),step=Number.isFinite(raw)&&raw>=1&&raw<=100?Math.round(raw):5;
            const next=Math.max(0,Math.min(100,d.volume+j.ticks*step));
            if(next===d.volume)continue;
            command=d.volumeCommand(next);
          }else{
            if(typeof d.muted!=='boolean'||!d.muteCommand)throw Error('Mute state unavailable');
            command=d.muteCommand(!d.muted);
          }
          const result=await api.command({Pipewire:command});
          if(!api.ok(result))throw Error('PipeWeaver rejected dial command: '+JSON.stringify(result));
          await api.refresh();
          api.log('OK '+kind(j.i)+' '+j.type);
        }catch(e){
          // No retries after uncertain acknowledgement. Discard queued gestures
          // for this control instead of replaying them on a recovered device.
          jobs=jobs.filter(x=>x.i.context!==j.i.context);
          api.log('FAILED '+kind(j.i)+' '+j.type+': '+e.message);
          if(current(j)){j.i.original.dialFeedback=null;api.send({event:'setFeedback',context:j.i.context,payload:{value:'?',status:'Error',indicator:0}})}
        }
      }
    }finally{running=false}
  }
  function handle(m,i){
    if(!kind(i))return false;
    if(m.event==='dialUp'){pressed.delete(i.context);return true}
    if(!['dialRotate','dialDown','touchTap'].includes(m.event))return false;
    if(m.payload?.controller!=='Encoder')return true;
    let type='mute',ticks=0;
    if(m.event==='dialRotate'){
      ticks=m.payload?.ticks;if(!Number.isInteger(ticks)||!ticks||Math.abs(ticks)>32768)return true;type='rotate';
    }else if(m.event==='dialDown'){
      if(pressed.has(i.context))return true;pressed.add(i.context);
    }else if(m.payload?.hold)return true;
    if(!epochs.has(i.context))epochs.set(i.context,0);
    const snapshot={...i,settings:{...i.settings},original:i};
    const previous=jobs.at(-1),signature=JSON.stringify(snapshot.settings);
    if(type==='rotate'&&previous?.type==='rotate'&&previous.i.original===i&&previous.signature===signature&&Math.sign(previous.ticks)===Math.sign(ticks))previous.ticks=Math.max(-32768,Math.min(32768,previous.ticks+ticks));
    else if(jobs.length<64)jobs.push({i:snapshot,type,ticks,signature,epoch:epochs.get(i.context),time:now()});
    else api.log('Input queue full; gesture dropped');
    if(!running){running=true;schedule(()=>void drain(),35)}
    return true;
  }
  return {handle,render,cancel,clear};
}
module.exports={create,kind};
