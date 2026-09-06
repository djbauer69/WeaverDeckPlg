"use strict";
function fadeChoices(kind,data){
 if(kind==='application')return (data.applications||[]).map(a=>({label:(a.name||'Application')+' ('+(a.process||'')+') ['+(a.deviceType||'')+']',value:JSON.stringify({application:{name:a.name||'',process:a.process||'',deviceType:a.deviceType||''}})}));
 if(kind==='source'||kind==='target')return (data[kind==='source'?'sources':'targets']||[]).map(name=>({label:name,value:JSON.stringify({[kind==='source'?'sourceName':'targetName']:name})}));
 return (data[kind==='input'?'physicalInputs':'physicalOutputs']||[]).map(d=>({label:d.name,value:JSON.stringify({device:{id:d.id,name:d.name}})}));
}
function fadeSelection(op){
 const value=op.kind==='application'?{application:op.application}:op.kind==='source'?{sourceName:op.sourceName}:op.kind==='target'?{targetName:op.targetName}:{device:op.device};
 return Object.values(value)[0]?JSON.stringify(value):'';
}
