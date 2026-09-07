"use strict";
// Selection is a separate lifecycle from button appearance and socket loading.
function installInspectorLifecycle({log=message=>console.log('[Inspector] '+message)}={}){
 const visible=new Set();
 function reply(socket,context){socket.send(JSON.stringify({event:'sendToPropertyInspector',context,payload:{command:'inspectorVisibility',visible:visible.has(context)}}))}
 return {
  clear(){visible.clear()},
  handleIncoming(socket,event){
   let m;try{m=JSON.parse(typeof event.data==='string'?event.data:event.data.toString())}catch{return false}
   if(!m.context)return false;
   if(m.event==='propertyInspectorDidAppear'||m.event==='propertyInspectorDidDisappear'){
    const shown=m.event==='propertyInspectorDidAppear';
    if(shown)visible.add(m.context);else visible.delete(m.context);
    log((shown?'selected ':'hidden ')+m.context);reply(socket,m.context);return false;
   }
   if(m.event==='willDisappear'){visible.delete(m.context);log('button removed/hidden '+m.context);return false}
   if(m.event==='sendToPlugin'&&m.payload?.command==='inspectorReady'){reply(socket,m.context);return true}
   if(m.event==='sendToPlugin'&&m.payload?.command==='inspectorRedraw'){
    const p=m.payload;
    const number=value=>Number.isFinite(value)?Math.round(value):'?';
    log('redraw '+m.context+' viewport='+number(p.viewport)+' content='+number(p.content)+' scroll='+number(p.from)+'->'+number(p.to));
    return true;
   }
   return false;
  }
 };
}
module.exports={installInspectorLifecycle};
