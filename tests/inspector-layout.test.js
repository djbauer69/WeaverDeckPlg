'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fit}=require('../com.pipeweaver.opendeck.sdPlugin/propertyInspector/inspector-layout');
function documentView(){
 const box={width:600,height:380},listeners=new Map(),observers=[];
 const doc={documentElement:{style:{}},body:{style:{},getBoundingClientRect:()=>box,scrollHeight:2600}};
 const win={document:doc,ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(el){this.target=el}disconnect(){this.disconnected=true}},addEventListener:(e,f)=>listeners.set(e,f),removeEventListener:(e,f)=>{if(listeners.get(e)===f)listeners.delete(e)}};
 return {win,doc,box,listeners,observers};
}
test('nested Scene frames grow and shrink with content instead of keeping their old viewport height',()=>{
 const v=documentView(),frame={contentWindow:v.win,style:{height:'2600px',minHeight:'1500px'}};
 fit(frame);assert.equal(frame.style.height,'380px');assert.equal(frame.style.minHeight,'0');assert.equal(v.doc.documentElement.style.overflow,'hidden');
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
