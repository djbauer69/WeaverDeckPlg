"use strict";
// Text policy is shared by every action, including transient Scene titles.
function mode(settings={}) {
  return settings.textMode === 'manual' || (settings.textMode !== 'dynamic' && !!settings.buttonText) ? 'manual' : 'dynamic';
}
function installButtonPresentation() {
  const contexts=new Map();
  return {
    handleIncoming(_socket,event) {
      let m;try{m=JSON.parse(event.data)}catch(_){return}
      if(['willAppear','didReceiveSettings'].includes(m.event))contexts.set(m.context,m.payload?.settings||{});
      if(m.event==='willDisappear')contexts.delete(m.context);
    },
    handleOutgoing(data) {
      let m;try{m=JSON.parse(data)}catch(_){return data}
      const settings=contexts.get(m.context);
      if(m.event==='setTitle' && settings && mode(settings)==='manual') {
        m.payload={...m.payload,title:String(settings.buttonText??'')};
        return JSON.stringify(m);
      }
      return data;
    }
  };
}
module.exports={mode,installButtonPresentation};
