'use strict';
(function(root){
 const labels={change:'Would change',unchanged:'Already set',skipped:'Would skip',error:'Needs attention',uncertain:'Provisional',wait:'Wait'};
 function create({document,send,snapshot,setTimeout,clearTimeout}){
  const panel=document.getElementById('scenePreview'),button=document.getElementById('previewSceneButton');let serial=0,pending=null,timer=null;
  const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
  function reset(){serial++;pending=null;if(timer)clearTimeout(timer);timer=null;button.disabled=false}
  function message(text){panel.hidden=false;panel.replaceChildren(el('p',text))}
  function invalidate(){if(panel.hidden)return;reset();message('Scene edited. Preview again to see the current steps.')}
  function request(){
   reset();const s=snapshot();pending={id:serial,fingerprint:JSON.stringify(s)};button.disabled=true;message('Reading PipeWeaver status…');
   if(!send({command:'previewScene',requestId:serial,operations:s.operations})){reset();message('OpenDeck connection is unavailable. Reopen this inspector and try again.');return}
   timer=setTimeout(()=>{reset();message('Preview timed out. Check the connection and try again.');},10000);
  }
  const format=(v,property)=>v===null||v===undefined?'Unknown':Array.isArray(v)?v.join(', '):property==='volume'?v+'%':typeof v==='boolean'?(property==='muted'?(v?'Muted':'Unmuted'):property==='linked'?(v?'Linked':'Unlinked'):(v?'On':'Off')):String(v);
  function receive(result){
   if(!pending||result.requestId!==pending.id)return;
   if(pending.fingerprint!==JSON.stringify(snapshot())){invalidate();return}
   reset();panel.hidden=false;panel.replaceChildren();panel.append(el('h3','Scene preview'));
   panel.append(el('p',result.notice||'Preview unavailable. No audio changes were made.'));
   panel.append(el('p','Snapshot: '+new Date(result.generatedAt).toLocaleTimeString()+' · '+(result.steps||[]).length+' steps'));
   for(const error of result.errors||[])panel.append(el('p',(error.step?'Step '+error.step+': ':'')+error.message));
   for(const warning of result.warnings||[])panel.append(el('p','Warning · '+(warning.step?'Step '+warning.step+': ':'')+warning.message));
   for(const step of result.steps||[]){
    const item=el('details');item.open=step.outcome==='error';item.className='preview-step';
    item.append(el('summary',step.step+'. '+(labels[step.outcome]||step.outcome)+' — '+step.title));
    item.append(el('p',step.condition+' · On failure: '+step.failurePolicy));
    if(step.changes.length){const table=el('table'),head=el('tr');for(const title of ['Selection / property','Before → After','Result'])head.append(el('th',title));table.append(head);
     for(const change of step.changes){const row=el('tr');row.append(el('td',change.target+' · '+change.property),el('td',format(change.before,change.property)+' → '+format(change.after,change.property)),el('td',labels[change.outcome]||change.outcome));table.append(row)}item.append(table)}
    for(const note of step.notes||[])item.append(el('p',note));panel.append(item);
   }
   const close=el('button','Close preview');close.type='button';close.addEventListener('click',()=>{reset();panel.hidden=true;panel.replaceChildren()});panel.append(close);
  }
  return {request,receive,invalidate};
 }
 root.WeaverScenePreviewUI={create};if(typeof module==='object')module.exports={create};
})(typeof window==='object'?window:globalThis);
