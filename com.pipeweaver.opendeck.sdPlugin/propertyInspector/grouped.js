'use strict';
(function(){
 let info,group,settings={},socket,data={},controller='Keypad',operation,icon;
 const el=id=>document.getElementById(id),P='com.pipeweaver.opendeck.';
 const inputIcons=[['default','Default'],['microphone','Microphone'],['electric-guitar','Electric guitar'],['acoustic-guitar','Acoustic guitar'],['drums','Drums'],['keyboard','Keyboard'],['webcam','Webcam']];
 const outputIcons=[['default','Default'],['speakers','Desktop speakers'],['headphones','Headphones'],['soundbar','Soundbar'],['airpods','AirPods']];
 const defaults=s=>({step:5,holdMs:200,volume:0,mix:'A',...s,milliseconds:s?.milliseconds??(s?.seconds!=null?Math.round(Number(s.seconds)*1000):3000)});
 const suffix=()=>String(controller==='Encoder'?group.encoderAction:(settings.operation||group.defaultAction)).slice(P.length);
 function send(m){if(socket?.readyState===1)socket.send(JSON.stringify({context:info.context,...m}))}
 function save(){send({event:'setSettings',payload:{...settings}})}
 function refresh(){send({event:'sendToPlugin',payload:{command:'getTargets'}})}
 function selectedOperation(){return controller==='Encoder'?group.encoderAction:(settings.operation||group.defaultAction)}
 function options(){return group.operations.filter(o=>o.controller===controller&&!(info.payload?.isInMultiAction&&o.uuid.endsWith('volumefade')))}
 function selectControl(id,label,choices,current,change){
  const row=document.createElement('div');row.className='row';
  const l=document.createElement('label');l.htmlFor=id;l.textContent=label;
  const select=document.createElement('select');select.id=id;select.add(new Option('Select…',''));
  if(current&&!choices.some(c=>c.value===current))choices=[...choices,{value:current,label:'Configured: '+current+' (unavailable)'}];
  for(const c of choices)select.add(new Option(c.label,c.value));select.value=current||'';
  select.addEventListener('change',()=>change(select.value));row.append(l,select);return row;
 }
 function numberControl(key,label,min,max,fallback){
  const row=document.createElement('div');row.className='row';const l=document.createElement('label');l.htmlFor='group-'+key;l.textContent=label;
  const input=document.createElement('input');input.id=l.htmlFor;input.type='number';input.min=min;input.max=max;input.step='1';input.value=settings[key]??fallback;
  input.addEventListener('change',()=>{if(input.value.trim()===''||!Number.isFinite(Number(input.value))||Number(input.value)<min||Number(input.value)>max){el('groupStatus').textContent=`${label} must be between ${min} and ${max}.`;return}settings[key]=Number(input.value);if(key==='milliseconds')settings.seconds=null;save();el('groupStatus').textContent=''});
  row.append(l,input);return row;
 }
 function renderSelections(){
  const root=el('groupSelections');if(!root)return;root.replaceChildren();const a=suffix();
  const names=xs=>(xs||[]).map(n=>({label:n,value:n}));
  function choice(key,label,values){root.appendChild(selectControl('group-'+key,label,values,settings[key],v=>{settings[key]=v;save()}))}
  if(group.name==='Application'){
   const I=window.WeaverAppIdentity,apps=data.applications||[],current=I.descriptor(settings),matched=I.find(apps,current),choices=apps.map(app=>({label:I.label(app),value:I.value(app)}));
   let value=current?.name?I.value(matched||current):'';
   if(value&&!choices.some(c=>c.value===value))choices.push({value,label:'Configured: '+I.label(current)+' (offline or ambiguous)'});
   root.appendChild(selectControl('group-application','Application',choices,value,v=>{let app={};try{app=JSON.parse(v)}catch{}settings={...settings,name:app.name||'',process:app.process||'',deviceType:app.deviceType||''};save();renderSelections()}));
   if(a==='approuteon'||a==='approutetoggle')choice('targetName','Route to',names(String(settings.deviceType).toLowerCase()==='target'?data.sceneTargets:data.sceneSources));
  }else if(group.name.startsWith('Physical ')){
   const devices=group.name==='Physical Input'?data.physicalInputs:data.physicalOutputs;
   root.appendChild(selectControl('group-device','Device',(devices||[]).map(d=>({label:d.name,value:d.id})),settings.deviceId,v=>{settings.deviceId=v;settings.deviceName=devices?.find(d=>d.id===v)?.name||'';save()}));
  }else if(group.name==='Route'){
   choice('sourceName','Source',names(data.sources));choice('targetName','Target',names(data.targets));
  }else if(group.name==='Target')choice('targetName','Target',names(data.targets));
  else if(group.name==='Source'){
   choice('sourceName','Source',names(a.startsWith('sourcemuteto')?data.sceneSources:data.sources));
   if(!/^source[ab]vol/.test(a)&&!['sourcemutea','sourcemuteb','sourcelinktoggle'].includes(a)){
    root.appendChild(selectControl('group-mix',a.startsWith('sourcemute')?'Mute slot':'Mix',[{value:'A',label:'A'},{value:'B',label:'B'}],settings.mix||'A',v=>{settings.mix=v;save()}));
   }
   if(a.startsWith('sourcemuteto')&&a!=='sourcemutetoall')choice('targetName','Mute to',names(data.sceneTargets));
  }
 }
 function render(){
  operation.replaceChildren(...options().map(o=>new Option(o.name,o.uuid)));operation.value=selectedOperation();
  const valid=options().some(o=>o.uuid===selectedOperation());
  el('groupStatus').textContent=valid?'':'This operation is unavailable for this control. Choose an operation.';
  if(icon)icon.value=settings.deviceIcon||'default';
  const root=el('groupControls');root.replaceChildren();const selections=document.createElement('div');selections.id='groupSelections';root.appendChild(selections);
  const numbers=document.createElement('div');numbers.className='weaver-numeric-row';root.appendChild(numbers);
  if(!valid)return;
  renderSelections();const a=suffix(),fade=a.endsWith('volumefade'),dial=a.endsWith('volumedial');
  if(a.endsWith('volup')||a.endsWith('voldown')||['volumeup','volumedown'].includes(a)||dial){
   numbers.appendChild(numberControl('step','Step %',1,100,5));if(!dial)numbers.appendChild(numberControl('holdMs','Hold ms',50,2000,200));
  }
  if(fade||a.includes('setvolume'))numbers.appendChild(numberControl('volume','Volume %',0,100,0));
  if(fade)numbers.appendChild(numberControl('milliseconds','Duration ms',0,120000,3000));
 }
 window.connectElgatoStreamDeckSocket=function(port,uuid,event,unused,actionInfo){
  info=JSON.parse(actionInfo);group=window.WeaverActionCatalog.groups.find(g=>g.uuid===info.action);
  if(!group){el('groupStatus').textContent='Unknown action group';return}
  controller=info.payload?.controller||'Keypad';settings=defaults(info.payload?.settings);
  if(settings.milliseconds==null&&settings.seconds!=null)settings.milliseconds=Math.round(Number(settings.seconds)*1000);
  const header=el('weaverActionName');header.textContent='';header.classList.add('group-header');
  operation=document.createElement('select');operation.id='groupOperation';operation.setAttribute('aria-label',group.name+' action');header.appendChild(operation);
  operation.addEventListener('change',()=>{settings.operation=operation.value;save();render()});
  if(group.name.startsWith('Physical ')){
   const wrap=document.createElement('div');wrap.className='icon-choice';const label=document.createElement('label');label.htmlFor='groupIcon';label.textContent='Icon';icon=document.createElement('select');icon.id='groupIcon';
   for(const [value,name] of group.name==='Physical Input'?inputIcons:outputIcons)icon.add(new Option(name,value));
   icon.addEventListener('change',()=>{settings.deviceIcon=icon.value;save()});wrap.append(label,icon);header.appendChild(wrap);
  }
  render();socket=new WebSocket('ws://localhost:'+port);
  socket.onopen=()=>{send({event,uuid});send({event:'getSettings'});refresh()};
  socket.onmessage=ev=>{try{const m=JSON.parse(ev.data);if(m.context!==info.context)return;
   if(m.event==='sendToPropertyInspector'&&m.payload?.command==='targets'){data=m.payload;renderSelections()}
   if(m.event==='didReceiveSettings'){settings=defaults(m.payload?.settings);if(settings.milliseconds==null&&settings.seconds!=null)settings.milliseconds=Math.round(Number(settings.seconds)*1000);render()}
  }catch(e){el('groupStatus').textContent='Could not read inspector data: '+e.message}};
  el('groupRefresh').addEventListener('click',refresh);
 };
})();
