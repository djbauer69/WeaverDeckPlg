'use strict';
// Normal logs retain startup, operation results and failures. Verbose discovery
// and inspector events are opt-in and are not serialized in normal mode.
function create({env=process.env,sink=console}={}){
 const debugEnabled=/^(1|true|yes)$/i.test(String(env.WEAVERDECK_DEBUG||''));
 return {debugEnabled,debug(...args){if(debugEnabled)sink.error(...args)}};
}
module.exports={create,...create()};
