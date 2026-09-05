"use strict";

// PipeWeaver API controls. No direct PipeWire or system commands.
const BUFFER_SIZES=[8,16,32,64,128,256,512,768,1024,1280,1536,1792,2048,2304,2560,2816,3072,3328,3584,3840,4096];
const PREFIX="com.pipeweaver.opendeck.";
const BUTTONS={audiorestart:"audioRestart",audiobuffer:"audioBuffer",sourcemutetoall:"all",sourcemutetoset:"set",sourcemutetoadd:"add",sourcemutetoremove:"remove",sourcemutetotoggle:"toggle"};
const TYPES=["audioRestart","audioBuffer","sourceMuteDestinations"];
function quantum(value){if(value==="default")return null;const n=Number(value);if(!BUFFER_SIZES.includes(n)||String(value).trim()==="")throw new Error("Select a supported audio buffer size or PipeWire configured");return "Quantum"+n}
function create(api){
  const {pipeCommand,unwrapStatus,isOk,configured,deviceId,deviceName}=api;
  const pause=api.pause||((ms)=>new Promise(r=>setTimeout(r,ms)));
  const now=api.now||Date.now;
  let queue=Promise.resolve();
  const serialized=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result};
  function find(status,type,name){const matches=configured(status,type).filter(d=>deviceName(d)===name);if(matches.length!==1)throw new Error(`${type} missing or ambiguous: ${name}`);return matches[0]}
  function destinations(src,mix){const value=src?.mute_states?.mute_targets?.["Target"+mix];if(!Array.isArray(value))throw new Error("Source mute destinations unavailable");return value}
  function validate(op,status){
    const errors=[];
    try{
      if(op.type==="audioBuffer")quantum(op.bufferSize);
      if(op.type==="sourceMuteDestinations"){
        if(!["A","B"].includes(op.mix))throw new Error("Mute slot must be A or B");
        if(!["set","add","remove","toggle","all"].includes(op.mode))throw new Error("Invalid mute destination mode");
        if(!Array.isArray(op.sources)||!op.sources.length)throw new Error("Select at least one source");
        for(const name of op.sources)destinations(find(status,"source",name),op.mix);
        if(op.mode!=="all"){
          if(!Array.isArray(op.targets)||!op.targets.length)throw new Error("Select at least one mute destination");
          for(const name of op.targets)find(status,"target",name);
          if(op.mode==="toggle"&&op.targets.length!==1)throw new Error("Toggle requires exactly one destination");
        }
      }
    }catch(e){errors.push(e.message)}
    return errors;
  }
  async function fresh(){const s=unwrapStatus(await pipeCommand("GetStatus"));if(!s?.audio?.profile)throw new Error("PipeWeaver status unavailable");return s}
  async function command(payload){const r=await pipeCommand(payload);if(!isOk(r))throw new Error(JSON.stringify(r))}
  async function waitReady(expected){
    const deadline=now()+30000;let consecutive=0,last="Engine not ready";
    // ResetAudio is acknowledged before the daemon begins its reset.
    await pause(1000);
    while(now()<deadline){
      try{const s=await fresh();if(expected!==undefined&&s.audio.profile.audio_node_quantum!==expected)throw new Error("Buffer setting has not been applied");if(++consecutive>=2)return s}
      catch(e){consecutive=0;last=e.message}
      await pause(500);
    }
    throw new Error("Audio engine recovery timed out: "+last);
  }
  async function execute(op){return serialized(async()=>{
    if(op.type==="audioRestart"){
      await command({Daemon:"ResetAudio"}); // Never retry a potentially accepted restart.
      await waitReady();return;
    }
    if(op.type==="audioBuffer"){
      const q=quantum(op.bufferSize),s=await fresh();
      if(s.audio.profile.audio_node_quantum===q)return;
      await command({Daemon:{SetAudioQuantum:q}});
      await waitReady(q);return;
    }
    if(op.type!=="sourceMuteDestinations")throw new Error("Unsupported operation");
    let s=await fresh();const errors=validate(op,s);if(errors.length)throw new Error(errors.join("; "));
    for(const name of [...new Set(op.sources)]){
      s=await fresh();let src=find(s,"source",name),ids=[...destinations(src,op.mix)];
      const wanted=op.mode==="all"?[]:[...new Set(op.targets.map(n=>deviceId(find(s,"target",n))))];
      const sid=deviceId(src),slot="Target"+op.mix;
      const send=(cmd,args)=>command({Pipewire:{[cmd]:args}});
      if(op.mode==="set"||op.mode==="all"){
        const allIds=configured(s,"target").map(deviceId);
        const desired=allIds.length&&allIds.every(id=>wanted.includes(id))?[]:wanted;
        if(ids.length===desired.length&&ids.every(id=>desired.includes(id)))continue;
        if(ids.length)await send("ClearMuteTargetNodes",[sid,slot]);
        for(const id of desired)await send("AddMuteTargetNode",[sid,slot,id]);
      }else{
        for(const id of wanted){
          s=await fresh();ids=destinations(find(s,"source",name),op.mix);
          const present=ids.includes(id),add=op.mode==="add"||(op.mode==="toggle"&&!present);
          if(add&&!present)await send("AddMuteTargetNode",[sid,slot,id]);
          if(!add&&present)await send("DelMuteTargetNode",[sid,slot,id]);
        }
      }
    }
  })}
  function buttonOperation(i){const kind=BUTTONS[i.action?.slice(PREFIX.length)];if(!i.action?.startsWith(PREFIX)||!kind)return null;const st=i.settings||{};return kind.startsWith("audio")?{type:kind,bufferSize:st.bufferSize??"default"}:{type:"sourceMuteDestinations",sources:[st.sourceName||""],targets:[st.targetName||""],mix:st.mix||"A",mode:kind}}
  function describe(op){if(op.type==="audioRestart")return "Audio Engine Restart";if(op.type==="audioBuffer")return `Audio Buffer Size: ${op.bufferSize==="default"?"PipeWire configured":op.bufferSize+" samples"}`;return `Source Mute To ${op.mode}: ${(op.sources||[]).join(", ")} / ${op.mix} → ${op.mode==="all"?"All":(op.targets||[]).join(", ")}`}
  function visual(op,status){
    if(op.type==="audioRestart")return {state:0,title:"Audio\nRestart"};
    if(op.type==="audioBuffer"){const current=status?.audio?.profile?.audio_node_quantum;return {state:0,title:"Buffer\n"+(current===null?"Default":current?.replace("Quantum","")||"?")}}
    try{const src=find(status,"source",op.sources[0]),ids=destinations(src,op.mix),all=ids.length===0;const selected=op.mode==="all"?all:ids.includes(deviceId(find(status,"target",op.targets[0])));return {state:selected?1:0,title:`${op.sources[0]} ${op.mix}\n${all?"To All":op.targets[0]||"Selected"}`}}catch(_){return {state:0,title:"Mute To\nUnavailable"}}
  }
  return {supports:op=>TYPES.includes(op?.type),validate,execute,buttonOperation,describe,visual};
}
module.exports={create,BUFFER_SIZES,quantum};
