"use strict";
// All editor frames expand to their content. The outer inspectorScroll element
// owns page scrolling, including Button Text and the complete Scene editor.
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
  Object.assign(doc.body.style,{height:'auto',minHeight:'0',margin:'0',display:'flow-root',overflow:'hidden'});
  frame.style.minHeight='0';
  let pending=null,disposed=false;
  const update=()=>{
   if(disposed)return;
   const box=doc.body.getBoundingClientRect();
   // OpenDeck preloads hidden inspectors. Wait for a real layout before sizing.
   if(box.width<=0)return;
   const height=Math.ceil(box.height)+'px';
   if(frame.style.height!==height)frame.style.height=height;
  };
  // Defer observer writes until the next frame. In a nested editor, resizing a
  // child changes its parent's body too; avoid dropping that update in the same
  // ResizeObserver delivery cycle. Mutations also cover asynchronously loaded
  // library rows/status and WebViews that miss a body resize while hidden.
  const schedule=()=>{
   if(disposed||pending!==null)return;
   if(!win.requestAnimationFrame){update();return}
   pending=win.requestAnimationFrame(()=>{pending=null;update()});
  };
  const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null;
  const mutations=win.MutationObserver?new win.MutationObserver(schedule):null;
  const owner=frame.ownerDocument?.defaultView;
  const visibility=owner?.IntersectionObserver?new owner.IntersectionObserver(schedule):null;
  const dispose=()=>{
   disposed=true;
   observer?.disconnect();mutations?.disconnect();visibility?.disconnect();
   if(pending!==null)win.cancelAnimationFrame?.(pending);
   for(const event of ['resize','focus','pageshow'])win.removeEventListener(event,schedule);
   doc.removeEventListener?.('visibilitychange',schedule);
   win.removeEventListener('pagehide',dispose);
   if(bindings.get(frame)?.doc===doc)bindings.delete(frame);
  };
  bindings.set(frame,{doc,update,dispose});
  observer?.observe(doc.body);
  mutations?.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true});
  visibility?.observe(frame);
  for(const event of ['resize','focus','pageshow'])win.addEventListener(event,schedule);
  doc.addEventListener?.('visibilitychange',schedule);
  win.addEventListener('pagehide',dispose);
  update();
 }
 const api={fit};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.WeaverInspectorLayout=api;
})(typeof window==='object'?window:globalThis);
