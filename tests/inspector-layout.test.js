'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fit,watch}=require('../com.pipeweaver.opendeck.sdPlugin/propertyInspector/inspector-layout');
function documentView(){
 const box={width:600,height:380},listeners=new Map(),observers=[];
 const doc={documentElement:{style:{}},body:{style:{},getBoundingClientRect:()=>box,scrollHeight:2600}};
 const win={document:doc,ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(el){this.target=el}disconnect(){this.disconnected=true}},addEventListener:(e,f)=>listeners.set(e,f),removeEventListener:(e,f)=>{if(listeners.get(e)===f)listeners.delete(e)}};
 return {win,doc,box,listeners,observers};
}
test('nested Scene frames grow and shrink with content instead of keeping their old viewport height',()=>{
 const v=documentView(),frame={contentWindow:v.win,style:{height:'2600px',minHeight:'1500px'}};
 fit(frame);assert.equal(frame.style.height,'380px');assert.equal(frame.style.minHeight,'0');assert.equal(v.doc.documentElement.style.overflow,'auto');
 v.box.height=4300.4;v.observers[0].fn();assert.equal(frame.style.height,'4301px');
 v.box.height=260;v.observers[0].fn();assert.equal(frame.style.height,'260px','deleting steps must reclaim blank space');
 v.box.width=0;v.box.height=0;v.observers[0].fn();assert.equal(frame.style.height,'260px','hidden selection must not collapse cached editor');
 v.box.width=320;v.box.height=510;v.listeners.get('resize')();assert.equal(frame.style.height,'510px','resizing or revealing accounts for wrapping');
});
test('repeated binding reuses the observer and navigation replaces and cleans up the old document binding',()=>{
 const a=documentView(),frame={contentWindow:a.win,style:{}};
 fit(frame);fit(frame);assert.equal(a.observers.length,1);
 const b=documentView();frame.contentWindow=b.win;fit(frame);
 assert(a.observers[0].disconnected);assert.equal(a.listeners.size,0);assert.equal(b.observers.length,1);
 b.listeners.get('pagehide')();assert(b.observers[0].disconnected);assert.equal(b.listeners.size,0);
 fit(frame);assert.equal(b.observers.length,2,'returning to a page can bind again');
});
test('hidden inspectors and asynchronous library changes get a fresh layout without requiring a viewport resize',()=>{
 const v=documentView(),jobs=new Map(),mutations=[],intersections=[];let id=0;
 v.win.requestAnimationFrame=fn=>{jobs.set(++id,fn);return id};
 v.win.cancelAnimationFrame=id=>jobs.delete(id);
 v.win.MutationObserver=class{constructor(fn){this.fn=fn;mutations.push(this)}observe(){}disconnect(){this.disconnected=true}};
 const owner={IntersectionObserver:class{constructor(fn){this.fn=fn;intersections.push(this)}observe(){}disconnect(){this.disconnected=true}}};
 const flush=()=>{const batch=[...jobs.values()];jobs.clear();batch.forEach(fn=>fn())};
 const frame={contentWindow:v.win,ownerDocument:{defaultView:owner},style:{height:'150px'}};
 v.box.width=0;fit(frame);assert.equal(frame.style.height,'150px');
 v.box.width=600;v.box.height=2400;intersections[0].fn();flush();assert.equal(frame.style.height,'2400px');
 v.box.height=3100;mutations[0].fn();v.observers[0].fn();assert.equal(jobs.size,1,'coalesce body mutations and resize notifications');
 flush();assert.equal(frame.style.height,'3100px','late-loaded library content remains reachable');
 v.box.height=620;v.listeners.get('focus')();flush();assert.equal(frame.style.height,'620px','reopening reclaims blank space');
 mutations[0].fn();v.listeners.get('pagehide')();assert.equal(jobs.size,0);assert(mutations[0].disconnected);assert(intersections[0].disconnected);
});
test('nested frame height changes propagate through the parent to the outer scrolling content',()=>{
 const child=documentView(),parent=documentView();
 const childFrame={contentWindow:child.win,style:{}},outerFrame={contentWindow:parent.win,style:{}};
 parent.doc.body.getBoundingClientRect=()=>({width:600,height:500+parseInt(childFrame.style.height||0)});
 fit(childFrame);fit(outerFrame);assert.equal(outerFrame.style.height,'880px');
 child.box.height=5000;child.observers[0].fn();parent.observers[0].fn();assert.equal(outerFrame.style.height,'5500px');
 child.box.height=200;child.observers[0].fn();parent.observers[0].fn();assert.equal(outerFrame.style.height,'700px');
});
test('outer watchdog repairs nested sizes even when child animation callbacks remain suspended',()=>{
 const child=documentView(),parent=documentView(),events=new Map();let tick,cleared=false;
 const childFrame={contentWindow:child.win,style:{}},frame={contentWindow:parent.win,style:{}};
 child.doc.querySelectorAll=()=>[];parent.doc.querySelectorAll=()=>[childFrame];
 parent.doc.body.getBoundingClientRect=()=>({width:600,height:500+parseInt(childFrame.style.height||0)});
 child.win.requestAnimationFrame=()=>123;parent.win.requestAnimationFrame=()=>456;
 child.win.cancelAnimationFrame=()=>{};parent.win.cancelAnimationFrame=()=>{};
 const host={document:{hidden:false},setInterval(fn,ms){assert.equal(ms,500);tick=fn;return 1},clearInterval(){cleared=true},addEventListener:(e,fn)=>events.set(e,fn),removeEventListener:e=>events.delete(e)};
 const stop=watch(frame,host);assert.equal(frame.style.height,'880px');
 child.box.height=4700;child.observers[0].fn();parent.observers[0].fn();
 assert.equal(frame.style.height,'880px','simulate a WebView that suspended child requestAnimationFrame');
 tick();assert.equal(childFrame.style.height,'4700px');assert.equal(frame.style.height,'5200px');
 child.box.height=200;tick();assert.equal(frame.style.height,'700px');
 host.document.hidden=true;child.box.height=900;tick();assert.equal(frame.style.height,'700px');
 host.document.hidden=false;events.get('focus')();assert.equal(frame.style.height,'1400px');
 stop();assert(cleared);assert.equal(events.size,0);
});
