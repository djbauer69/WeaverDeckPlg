'use strict';
const catalog=require('./action-catalog.json');
const groups=new Map(catalog.groups.map(g=>[g.uuid,g]));
function resolve(action,settings={},controller='Keypad'){
 const group=groups.get(action);if(!group)return null;
 const operation=controller==='Encoder'?group.encoderAction:(settings.operation||group.defaultAction);
 if(!group.operations.some(o=>o.uuid===operation&&o.controller===controller))return {group,action:'com.pipeweaver.opendeck.invalidgroup',settings:{...settings},invalid:true};
 const st={...settings};
 if(operation.endsWith('volumefade')){
  if(group.name==='Application')st.application={name:st.name||'',process:st.process||'',deviceType:st.deviceType||''};
  if(group.name.startsWith('Physical '))st.device={id:st.deviceId||'',name:st.deviceName||'',deviceType:group.name==='Physical Input'?'input':'output'};
 }
 return {group,action:operation,settings:st,invalid:false};
}
function createAdapter(){
 const contexts=new Map();
 return {
  clear(){contexts.clear()},
  adapt(event){
   let m;try{m=JSON.parse(typeof event.data==='string'?event.data:event.data.toString())}catch{return event}
   const previous=contexts.get(m.context),group=groups.get(m.action)||previous?.group;
   if(!group)return event;
   let entry=previous;
   if(m.event==='willAppear'||m.event==='didReceiveSettings'){
    const controller=m.payload?.controller||previous?.controller||'Keypad';
    entry={group,controller,...resolve(group.uuid,m.payload?.settings||{},controller)};contexts.set(m.context,entry);
    m.payload={...m.payload,settings:entry.settings};
   }
   if(entry){m.action=entry.action;m.weaverGroup=group.uuid;m.weaverGroupInvalid=entry.invalid;m.weaverController=entry.controller;}
   if(m.event==='willDisappear')contexts.delete(m.context);
   return {...event,data:JSON.stringify(m)};
  }
 };
}
module.exports={catalog,groups,resolve,createAdapter};
