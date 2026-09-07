'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {installInspectorLifecycle}=require('../com.pipeweaver.opendeck.sdPlugin/inspector-lifecycle');
const {createRedraw}=require('../com.pipeweaver.opendeck.sdPlugin/propertyInspector/inspector-layout');
test('inspector selection follows deletion, empty selection and switching independently of button/socket loading',()=>{
 const sent=[],logs=[],socket={send:s=>sent.push(JSON.parse(s))},layer=installInspectorLifecycle({log:s=>logs.push(s)});
 const event=(event,context,payload)=>layer.handleIncoming(socket,{data:JSON.stringify({event,context,payload})});
 event('propertyInspectorDidAppear','a');assert.equal(sent.at(-1).payload.visible,true);
 event('willDisappear','a');event('propertyInspectorDidAppear','b');assert.equal(sent.at(-1).context,'b');assert.equal(sent.at(-1).payload.visible,true);
 event('propertyInspectorDidDisappear','b');assert.equal(sent.at(-1).payload.visible,false);
 event('propertyInspectorDidAppear','b');assert.equal(sent.at(-1).payload.visible,true,'empty key then same button requests a new redraw');
 assert.equal(event('sendToPlugin','a',{command:'inspectorReady'}),true);assert.equal(sent.at(-1).payload.visible,false,'removed button visibility must not survive context reuse');
 event('sendToPlugin','b',{command:'inspectorReady'});assert.equal(sent.at(-1).payload.visible,true,'late socket registration receives current visibility');
 layer.clear();event('sendToPlugin','b',{command:'inspectorReady'});assert.equal(sent.at(-1).payload.visible,false);
 assert(sent.every(m=>m.event==='sendToPropertyInspector'));assert(logs.some(s=>s.startsWith('button removed/hidden')));
});
test('layout messages never mutate audio/settings and unrelated plugin commands pass through',()=>{
 const messages=[],logs=[],layer=installInspectorLifecycle({log:s=>logs.push(s)}),socket={send:s=>messages.push(s)};
 assert.equal(layer.handleIncoming(socket,{data:'invalid'}),false);
 assert.equal(layer.handleIncoming(socket,{data:JSON.stringify({event:'sendToPlugin',context:'a',payload:{command:'getTargets'}})}),false);
 assert.equal(layer.handleIncoming(socket,{data:JSON.stringify({event:'sendToPlugin',context:'a',payload:{command:'inspectorRedraw',viewport:300,content:220,from:0,to:1}})}),true);
 assert.equal(messages.length,0);assert.match(logs[0],/viewport=300 content=220 scroll=0->1/);
});
function view(height=200){
 let clock=0,id=0,top=0;const timers=new Map(),listeners=new Map(),reports=[];
 function style(){const values=new Map();return {getPropertyValue:key=>values.get(key)?.value||'',getPropertyPriority:key=>values.get(key)?.priority||'',setProperty:(key,value,priority='')=>values.set(key,{value,priority}),removeProperty:key=>values.delete(key)}}
 const body={style:style(),offsetHeight:height,getBoundingClientRect:()=>({width:600,height})};
 const element={style:style()};
 Object.defineProperty(element,'scrollTop',{get:()=>top,set:v=>{top=Math.max(0,Math.min(v,Math.max(height,parseFloat(body.style.getPropertyValue('min-height'))||0)-300))}});
 const host={innerHeight:300,document:{body,documentElement:element,scrollingElement:element},setTimeout(fn,ms){const key=++id;timers.set(key,{at:clock+ms,fn});return key},clearTimeout:key=>timers.delete(key),addEventListener:(e,fn)=>listeners.set(e,fn),removeEventListener:e=>listeners.delete(e)};
 function advance(ms){const target=clock+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn()}clock=target}
 const redraw=createRedraw(host,p=>reports.push(p));
 return {host,body,element,redraw,reports,timers,listeners,advance};
}
test('short inspectors without a scrollbar get real scroll movement and restore all temporary styles',()=>{
 const v=view();v.redraw.setVisible(true);v.advance(0);assert.equal(v.element.scrollTop,1);assert.equal(v.element.style.getPropertyValue('overflow-y'),'hidden');
 v.advance(40);assert.equal(v.element.scrollTop,0);assert.equal(v.body.style.getPropertyValue('min-height'),'');assert.equal(v.element.style.getPropertyValue('overflow-y'),'');
 v.advance(400);assert.equal(v.reports.length,3);assert(v.reports.every(r=>r.from===0&&r.to===1));assert.equal(v.timers.size,0);
 v.redraw.setVisible(false);v.redraw.setVisible(true);v.advance(400);assert.equal(v.reports.length,6,'selecting again must redraw even if dimensions did not change');
});
test('long Scene redraw preserves scroll position, original style priorities and a concurrent user scroll',()=>{
 const v=view(1800);v.element.scrollTop=600;v.body.style.setProperty('min-height','500px','important');v.element.style.setProperty('overflow-y','auto');
 v.redraw.setVisible(true);v.advance(0);assert.equal(v.element.scrollTop,599);v.advance(40);assert.equal(v.element.scrollTop,600);assert.equal(v.body.style.getPropertyValue('min-height'),'500px');assert.equal(v.body.style.getPropertyPriority('min-height'),'important');
 v.advance(80);v.element.scrollTop=900;v.advance(40);assert.equal(v.element.scrollTop,900,'do not undo a real user scroll during the repaint');v.redraw.dispose();
});
test('deselection, deletion/pagehide and rapid reactivation cancel pending work and restore the document',()=>{
 const v=view();v.redraw.setVisible(true);v.advance(0);v.redraw.setVisible(false);assert.equal(v.element.scrollTop,0);assert.equal(v.timers.size,0);assert.equal(v.body.style.getPropertyValue('min-height'),'');
 v.redraw.setVisible(true);v.advance(0);v.redraw.setVisible(true);v.advance(400);assert.equal(v.reports.length,3);assert.equal(v.element.scrollTop,0);
 v.redraw.setVisible(true);v.advance(0);v.listeners.get('pagehide')();assert.equal(v.timers.size,0);assert.equal(v.listeners.size,0);assert.equal(v.body.style.getPropertyValue('min-height'),'');
 v.redraw.setVisible(true);assert.equal(v.timers.size,0,'disposed page cannot restart redraws');
});
