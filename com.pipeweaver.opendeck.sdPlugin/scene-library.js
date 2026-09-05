"use strict";

/* WeaverDeck v0.15.0 native Scene Library
 *
 * Stores reusable WeaverDeck Scene documents outside the embedded Property
 * Inspector browser so every Scene action can access the same library.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const LIBRARY_FORMAT = "WeaverDeckSceneLibrary";
const LIBRARY_VERSION = 1;
const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;
const MAX_SCENE_BYTES = 2 * 1024 * 1024;

function dataHome() {
  const home = os.homedir();
  const env = String(process.env.XDG_DATA_HOME || "").trim();
  return env && path.isAbsolute(env) ? path.normalize(env) : path.join(home, ".local", "share");
}

function libraryPath() {
  return path.join(dataHome(), "weaverdeck", "scene-library-v1.json");
}

function cleanLibraryName(value) {
  const name = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Scene Library name is required");
  if (name.length > 96) throw new Error("Scene Library name is too long");
  return name;
}

function normalizeScene(scene, forcedName) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) throw new Error("Scene document must be an object");
  if (scene.format && scene.format !== "WeaverDeckScene") throw new Error("Unsupported WeaverDeck Scene format");
  if (scene.formatVersion != null && Number(scene.formatVersion) !== 1) throw new Error("Unsupported WeaverDeck Scene format version");
  if (scene.sceneVersion != null && Number(scene.sceneVersion) !== 1) throw new Error("Unsupported WeaverDeck Scene version");
  if (!Array.isArray(scene.operations)) throw new Error("Scene operations array is missing");
  const copy = JSON.parse(JSON.stringify(scene));
  copy.format = "WeaverDeckScene";
  copy.formatVersion = 1;
  copy.sceneVersion = 1;
  if (forcedName != null) copy.name = cleanLibraryName(forcedName);
  else copy.name = String(copy.name || "Scene").trim() || "Scene";
  const text = JSON.stringify(copy);
  if (Buffer.byteLength(text, "utf8") > MAX_SCENE_BYTES) throw new Error("Scene is too large for the library");
  return copy;
}

function emptyLibrary() {
  return { format: LIBRARY_FORMAT, formatVersion: LIBRARY_VERSION, scenes: {} };
}

function readLibrary(filePath = libraryPath()) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    if (Buffer.byteLength(text, "utf8") > MAX_LIBRARY_BYTES) throw new Error("Scene Library file is too large");
    const doc = JSON.parse(text);
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error("Scene Library root must be an object");
    if (doc.format !== LIBRARY_FORMAT || Number(doc.formatVersion) !== LIBRARY_VERSION) throw new Error("Unsupported Scene Library format");
    if (!doc.scenes || typeof doc.scenes !== "object" || Array.isArray(doc.scenes)) throw new Error("Scene Library scenes object is missing");
    const out = emptyLibrary();
    for (const [rawName, rawScene] of Object.entries(doc.scenes)) {
      const name = cleanLibraryName(rawName);
      out.scenes[name] = normalizeScene(rawScene, name);
    }
    return out;
  } catch (error) {
    if (error?.code === "ENOENT") return emptyLibrary();
    throw error;
  }
}

function writeLibrary(doc, filePath = libraryPath()) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const text = JSON.stringify(doc, null, 2) + "\n";
  if (Buffer.byteLength(text, "utf8") > MAX_LIBRARY_BYTES) throw new Error("Scene Library is too large");
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try {
    fs.renameSync(temp, filePath);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch (_) {}
    throw error;
  }
  return filePath;
}

function sortedEntries(doc) {
  return Object.keys(doc.scenes).sort((a, b) => a.localeCompare(b)).map(name => ({ name, scene: doc.scenes[name] }));
}

function mutateLibrary(command, payload, filePath = libraryPath()) {
  const doc = readLibrary(filePath);
  if (command === "saveSceneLibrary") {
    const name = cleanLibraryName(payload.name || payload.scene?.name);
    if (doc.scenes[name] && !payload.overwrite) throw new Error(`A Scene Library entry named “${name}” already exists`);
    doc.scenes[name] = normalizeScene(payload.scene, name);
    writeLibrary(doc, filePath);
    return { message: `Saved “${name}” to Scene Library`, selected: name, doc };
  }
  if (command === "deleteSceneLibrary") {
    const name = cleanLibraryName(payload.name);
    if (!doc.scenes[name]) throw new Error(`Scene Library entry “${name}” was not found`);
    delete doc.scenes[name];
    writeLibrary(doc, filePath);
    return { message: `Deleted “${name}” from Scene Library`, selected: "", doc };
  }
  if (command === "renameSceneLibrary") {
    const from = cleanLibraryName(payload.name), to = cleanLibraryName(payload.newName);
    if (!doc.scenes[from]) throw new Error(`Scene Library entry “${from}” was not found`);
    if (from !== to && doc.scenes[to] && !payload.overwrite) throw new Error(`A Scene Library entry named “${to}” already exists`);
    const scene = normalizeScene(doc.scenes[from], to);
    if (from !== to) delete doc.scenes[from];
    doc.scenes[to] = scene;
    writeLibrary(doc, filePath);
    return { message: `Renamed “${from}” to “${to}”`, selected: to, doc };
  }
  if (command === "duplicateSceneLibrary") {
    const from = cleanLibraryName(payload.name), to = cleanLibraryName(payload.newName);
    if (!doc.scenes[from]) throw new Error(`Scene Library entry “${from}” was not found`);
    if (doc.scenes[to] && !payload.overwrite) throw new Error(`A Scene Library entry named “${to}” already exists`);
    doc.scenes[to] = normalizeScene(doc.scenes[from], to);
    writeLibrary(doc, filePath);
    return { message: `Duplicated “${from}” as “${to}”`, selected: to, doc };
  }
  throw new Error(`Unsupported Scene Library command: ${command}`);
}

function sendResult(socket, context, payload) {
  socket.send(JSON.stringify({ event: "sendToPropertyInspector", context, payload }));
}

function libraryPayload(doc, extra = {}) {
  return {
    command: "sceneLibrary",
    ok: true,
    path: libraryPath(),
    entries: sortedEntries(doc),
    ...extra
  };
}

function installSceneLibrary() {
  const commands = new Set(["getSceneLibrary", "saveSceneLibrary", "deleteSceneLibrary", "renameSceneLibrary", "duplicateSceneLibrary"]);
  return {
    handleIncoming(socket, event) {
      let message;
      try { message = typeof event?.data === "string" ? JSON.parse(event.data) : null; }
      catch (_) { return false; }
      const payload = message?.payload;
      if (message?.event !== "sendToPlugin" || !commands.has(payload?.command)) return false;
      try {
        let response;
        if (payload.command === "getSceneLibrary") {
          response = libraryPayload(readLibrary());
        } else {
          const result = mutateLibrary(payload.command, payload);
          response = libraryPayload(result.doc, { message: result.message, selected: result.selected });
          console.error(`[v0.15.0] ${result.message}`);
        }
        sendResult(socket, message.context, response);
      } catch (error) {
        const detail = error?.message || String(error);
        console.error(`[v0.15.0] Scene Library error: ${detail}`);
        sendResult(socket, message.context, { command: "sceneLibrary", ok: false, error: detail, path: libraryPath() });
      }
      return true;
    }
  };
}

module.exports = { installSceneLibrary, libraryPath, cleanLibraryName, normalizeScene, readLibrary, writeLibrary, mutateLibrary, sortedEntries };
