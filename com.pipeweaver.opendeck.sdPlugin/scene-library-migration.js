'use strict';
const {isDeepStrictEqual}=require('node:util');
const {readLibrary,writeLibrary,cleanLibraryName,normalizeScene,libraryPath}=require('./scene-library');
const {createStore,presetPath}=require('./scene-presets');
function merge(doc,presets,kind,suppressed=new Set()){
 const seen=new Set(doc.presetImports);let count=0,changed=false;
 for(const [rawName,rawScene] of Object.entries(presets)){
  const name=cleanLibraryName(rawName),key=kind+':'+name;if(seen.has(key))continue;
  if(!suppressed.has(name)){
   const scene=normalizeScene(rawScene,name);
   let target=name,index=1;
   while(Object.hasOwn(doc.scenes,target)&&!isDeepStrictEqual(normalizeScene(doc.scenes[target],name),scene)){
    const suffix=index===1?' (Preset)':` (Preset ${index})`;index++;
    target=name.slice(0,96-suffix.length).trimEnd()+suffix;
   }
   if(!Object.hasOwn(doc.scenes,target)){doc.scenes[target]=normalizeScene(scene,target);count++}
  }
  seen.add(key);changed=true;
 }
 doc.presetImports=[...seen];return {changed,count};
}
function migrateSavedPresets(file=libraryPath(),legacyFile=presetPath()){
 const doc=readLibrary(file),legacy=createStore(legacyFile).read();
 const result=merge(doc,legacy.presets,'saved');
 if(result.changed)writeLibrary(doc,file);
 return {doc,message:result.count?`Moved ${result.count} saved preset(s) into Scene Library`:''};
}
function importBrowserPresets(presets,file=libraryPath(),legacyFile=presetPath()){
 if(!presets||typeof presets!=='object'||Array.isArray(presets))throw Error('Invalid browser presets');
 const {doc}=migrateSavedPresets(file,legacyFile),legacy=createStore(legacyFile).read();
 // A durable preset (including a deleted one) takes precedence over its older
 // browser copy. All other collisions are retained under a distinct name.
 const suppressed=new Set([...legacy.migratedNames,...Object.keys(legacy.presets)]);
 const result=merge(doc,presets,'browser',suppressed);
 if(result.changed)writeLibrary(doc,file);
 return {doc,message:result.count?`Imported ${result.count} browser preset(s) into Scene Library`:''};
}
module.exports={migrateSavedPresets,importBrowserPresets};
