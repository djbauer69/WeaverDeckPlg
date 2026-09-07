"use strict";
// All editor frames expand to their content. The outer document owns page
// scrolling, including Button Text and the complete Scene editor.
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
  // Keep overflow reachable if a WebView delays sizing. Correctly sized frames
  // need no inner scrollbar, but stale dimensions must never hide controls.
  Object.assign(doc.documentElement.style,{height:'auto',minHeight:'0',overflow:'auto'});
  Object.assign(doc.body.style,{height:'auto',minHeight:'0',margin:'0',display:'flow-root',overflow:'visible'});
  frame.style.minHeight='0';
  // Give the remaining nested Scene documents their own composited surface.
  frame.style.transform='translateZ(0)';
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
 function refreshTree(frame){
  const doc=frame.contentWindow?.document;if(!doc?.body)return;
  for(const child of doc.querySelectorAll('iframe'))refreshTree(child);
  fit(frame);
 }
 function watch(frame,host=root){
  // Run from the outer inspector, not from hidden child animation queues.
  // One low-frequency check also catches reveal/resize notifications missed
  // by embedded WebKit. Bottom-up sizing propagates the entire Scene at once.
  const refresh=()=>{
   if(host.document?.hidden)return;
   if(frame)refreshTree(frame);
   else for(const child of host.document.querySelectorAll('iframe'))refreshTree(child);
  };
  const timer=host.setInterval(refresh,500);
  for(const event of ['focus','resize','pageshow'])host.addEventListener(event,refresh);
  const dispose=()=>{host.clearInterval(timer);for(const event of ['focus','resize','pageshow'])host.removeEventListener(event,refresh);host.removeEventListener('pagehide',dispose)};
  host.addEventListener('pagehide',dispose);
  refresh();return dispose;
 }
 function createRedraw(host=root,report=()=>{}){
  const timers=new Set();let visible=false,restore=null,disposed=false;
  const later=(fn,delay)=>{const id=host.setTimeout(()=>{timers.delete(id);fn()},delay);timers.add(id)};
  function cancel(){for(const id of timers)host.clearTimeout(id);timers.clear();if(restore){const done=restore;restore=null;done()}}
  function paint(){
   if(!visible||disposed)return;
   if(restore){const done=restore;restore=null;done()}
   const doc=host.document,body=doc.body,element=doc.documentElement,scroll=doc.scrollingElement||element;
   if(!body||!scroll)return;
   const box=body.getBoundingClientRect();if(box.width<=0||host.innerHeight<=0)return;
   // A real scroll clears the stale WebView paint clip reported after deleting
   // a key. Give even short pages a temporary one-pixel scroll range, conceal
   // that temporary scrollbar, then restore styles and the user's position.
   const styles=[[element.style,'overflow-y'],[element.style,'scroll-behavior'],[element.style,'scroll-snap-type'],[body.style,'min-height']].map(([style,key])=>({style,key,value:style.getPropertyValue(key),priority:style.getPropertyPriority(key)}));
   const from=scroll.scrollTop;
   element.style.setProperty('overflow-y','hidden','important');
   element.style.setProperty('scroll-behavior','auto','important');
   element.style.setProperty('scroll-snap-type','none','important');
   body.style.setProperty('min-height',Math.max(box.height,host.innerHeight+1)+'px','important');
   void body.offsetHeight;
   scroll.scrollTop=from>0?from-1:1;
   const to=scroll.scrollTop;
   const finish=()=>{
    const position=scroll.scrollTop===to?from:scroll.scrollTop;
    for(const {style,key,value,priority} of styles){if(value)style.setProperty(key,value,priority);else style.removeProperty(key)}
    scroll.scrollTop=position;
   };
   restore=finish;
   later(()=>{if(restore!==finish)return;restore=null;finish();report({viewport:host.innerHeight,content:box.height,from,to})},40);
  }
  function setVisible(value){
   if(disposed)return;cancel();visible=value;
   if(visible)for(const delay of [0,120,350])later(paint,delay);
  }
  const refresh=()=>{if(visible)setVisible(true)};
  const dispose=()=>{cancel();visible=false;disposed=true;host.removeEventListener('resize',refresh);host.removeEventListener('pagehide',dispose)};
  host.addEventListener('resize',refresh);host.addEventListener('pagehide',dispose);
  return {setVisible,dispose};
 }
 const api={fit,refreshTree,watch,createRedraw};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.WeaverInspectorLayout=api;
})(typeof window==='object'?window:globalThis);
