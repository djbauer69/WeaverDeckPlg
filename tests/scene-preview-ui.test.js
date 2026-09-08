'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../com.pipeweaver.opendeck.sdPlugin/propertyInspector/scene-preview-ui');
function harness(){
 class Element{constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.hidden=false}append(...xs){this.children.push(...xs)}replaceChildren(...xs){this.children=xs}addEventListener(e,fn){this.listeners[e]=fn}setAttribute(){}remove(){}}
 const listeners={};
 const panel=new Element('section');panel.hidden=true;const button=new Element('button'),document={getElementById:id=>id==='scenePreview'?panel:button,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>{listeners[name]=fn}};
 let snapshot={name:'Scene',operations:[{type:'wait',milliseconds:0}]},timer,id=0;const sent=[];
 const ui=create({document,send:p=>{sent.push(p);return true},snapshot:()=>snapshot,setTimeout:fn=>{timer=fn;return ++id},clearTimeout:()=>{timer=null}});
 return {ui,panel,button,sent,fire:(name,id='volume',inSteps=true)=>{const row={insertAdjacentElement:(_,notice)=>{notice.remove=()=>{};notice.setAttribute=()=>{};}};const target={id,matches:()=>true,closest:q=>q==='#steps'?(inSteps?{}:null):row};listeners[name]({target})},edit:()=>{snapshot={...snapshot,name:'Edited'}},timeout:()=>timer(),text:()=>{const visit=e=>(e.textContent||'')+e.children.map(visit).join(' ');return visit(panel)}};
}
const reply=id=>({requestId:id,generatedAt:'2026-09-07T22:00:00Z',notice:'Read-only snapshot',errors:[],warnings:[],steps:[{step:1,title:'<img src=x onerror=alert(1)>',outcome:'change',condition:'Always',failurePolicy:'stop',notes:[],changes:[{target:'<script>bad</script>',property:'volume',before:10,after:20,outcome:'change'}]}]});
test('preview UI correlates responses, renders names as text and invalidates edited snapshots',()=>{
 const h=harness();h.ui.request();assert.equal(h.sent[0].command,'previewScene');assert(h.button.disabled);
 h.ui.receive(reply(-1));assert(h.button.disabled);
 h.ui.receive(reply(h.sent[0].requestId));assert(!h.button.disabled);assert.match(h.text(),/10% → 20%/);assert.match(h.text(),/<img/);
 const tags=e=>[e.tag,...e.children.flatMap(tags)];assert(!tags(h.panel).includes('img'));assert(!tags(h.panel).includes('script'));
 h.ui.request();const old=h.sent.at(-1).requestId;h.edit();h.ui.receive(reply(old));assert.match(h.text(),/Scene edited/);
 h.ui.request();const current=h.sent.at(-1).requestId;h.ui.receive(reply(old));assert(h.button.disabled);h.ui.receive(reply(current));assert(!h.button.disabled);
});
test('timeout and invalidation clear pending previews and late responses cannot replace them',()=>{
 const h=harness();h.ui.request();h.timeout();assert.match(h.text(),/timed out/);assert(!h.button.disabled);h.ui.receive(reply(h.sent[0].requestId));assert.match(h.text(),/timed out/);
 h.ui.request();h.ui.invalidate();h.ui.receive(reply(h.sent.at(-1).requestId));assert.match(h.text(),/Scene edited/);
});

test('editing a number invalidates preview immediately before onchange commits the Scene value',()=>{
 const h=harness();h.ui.request();h.ui.receive(reply(h.sent.at(-1).requestId));const sends=h.sent.length;
 h.fire('input');assert.match(h.text(),/Scene edited/);assert.match(h.button.textContent,/out of date/);assert.equal(h.sent.length,sends,'dirty tracking must not send commands or save settings');
 h.ui.request();assert.equal(h.button.textContent,'Preview Scene');const pending=h.sent.at(-1).requestId;
 h.fire('input');h.ui.receive(reply(pending));assert.match(h.text(),/Scene edited/,'reply for the old pending preview must be ignored even before the model commits');
});
test('Scene dropdown/name edits invalidate but unrelated text areas do not',()=>{
 const h=harness();h.ui.request();h.ui.receive(reply(h.sent.at(-1).requestId));
 h.fire('input','sceneJson',false);assert.match(h.text(),/Read-only snapshot/);
 h.fire('change');assert.match(h.text(),/Scene edited/);
 h.ui.request();h.ui.receive(reply(h.sent.at(-1).requestId));h.fire('input','name',false);assert.match(h.text(),/Scene edited/);
});
