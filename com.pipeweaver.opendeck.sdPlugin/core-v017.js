"use strict";

/* WeaverDeck v0.17.0 runtime extension for the stable plugin-core.js.
 * The feature patches are split by concern so each layer stays auditable.
 * The on-disk stable control core remains unchanged.
 */
const fs=require("fs");
const path=require("path");
const Module=require("module");

const filename=path.join(__dirname,"plugin-core.js");
let source=fs.readFileSync(filename,"utf8");
source=require("./core-v017-source-link").apply(source);
source=require("./core-v017-smart-scenes").apply(source);
source=require("./core-v017-apps").apply(source);

const patched=new Module(filename,module);
patched.filename=filename;
patched.paths=module.paths;
patched._compile(source,filename);
