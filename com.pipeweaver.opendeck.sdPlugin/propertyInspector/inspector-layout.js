"use strict";
// Only nested editor frames expand to their content. The outer action inspector
// keeps its viewport height and owns scrolling for the complete Scene editor.
(function(root){
 const bindings=new WeakMap();
 function fit(frame){
  const win=frame.contentWindow,doc=win?.document;
  if(!doc?.body)return;
  const previous=bindings.get(frame);
  if(previous?.doc===doc){previous.update();return}
  previous?.dispose();
  // Measure intrinsic body height, not document scrollHeight: scrollHeight is
  // floored by the old iframe viewport and would prevent a long scene shrinking.
  Object.assign(doc.documentElement.style,{height:'auto',minHeight:'0',overflow:'hidden'});
  Object.assign(doc.body.style,{height:'auto',minHeight:'0',display:'flow-root',overflow:'hidden'});
  frame.style.minHeight='0';
  const update=()=>{
   const box=doc.body.getBoundingClientRect();
   // OpenDeck preloads hidden inspectors. Wait for a real layout before sizing.
   if(box.width<=0)return;
   const height=Math.ceil(box.height)+'px';
   if(frame.style.height!==height)frame.style.height=height;
  };
  const observer=new win.ResizeObserver(update);
  const dispose=()=>{
   observer.disconnect();
   win.removeEventListener('resize',update);
   win.removeEventListener('pagehide',dispose);
   if(bindings.get(frame)?.doc===doc)bindings.delete(frame);
  };
  bindings.set(frame,{doc,update,dispose});
  observer.observe(doc.body);
  win.addEventListener('resize',update);
  win.addEventListener('pagehide',dispose);
  update();
 }
 const api={fit};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.WeaverInspectorLayout=api;
})(typeof window==='object'?window:globalThis);
