"use strict";

/* WeaverDeck v0.15.0 Scene file I/O
 *
 * OpenDeck's embedded Property Inspector WebView does not reliably honor
 * browser-style <a download> requests. This helper keeps Scene serialization
 * in the Property Inspector, but performs the actual file write in the native
 * Node.js plugin process.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const SCENE_EXT = ".weaverdeck-scene.json";
const MAX_SCENE_BYTES = 2 * 1024 * 1024;

function safeBaseName(value) {
  let raw = String(value || "Scene").trim();
  if (raw.toLowerCase().endsWith(SCENE_EXT)) raw = raw.slice(0, -SCENE_EXT.length);
  raw = raw.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return raw || "Scene";
}

function expandHome(value, home) {
  let out = String(value || "").trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  out = out.replace(/\$\{HOME\}|\$HOME/g, home);
  out = out.replace(/\\([\\"'$ ])/g, "$1");
  return out;
}

function downloadsDir() {
  const home = os.homedir();
  const envDir = expandHome(process.env.XDG_DOWNLOAD_DIR || "", home);
  if (envDir && path.isAbsolute(envDir)) return path.normalize(envDir);

  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  const userDirsFile = path.join(configHome, "user-dirs.dirs");
  try {
    const text = fs.readFileSync(userDirsFile, "utf8");
    const match = text.match(/^XDG_DOWNLOAD_DIR\s*=\s*(.+)$/m);
    if (match) {
      const resolved = expandHome(match[1], home);
      if (resolved && path.isAbsolute(resolved)) return path.normalize(resolved);
    }
  } catch (_) {}

  return path.join(home, "Downloads");
}

function serializeScene(scene) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) throw new Error("Scene document must be an object");
  if (scene.format && scene.format !== "WeaverDeckScene") throw new Error("Unsupported WeaverDeck Scene format");
  if (scene.formatVersion != null && Number(scene.formatVersion) !== 1) throw new Error("Unsupported WeaverDeck Scene format version");
  if (scene.sceneVersion != null && Number(scene.sceneVersion) !== 1) throw new Error("Unsupported WeaverDeck Scene version");
  if (!Array.isArray(scene.operations)) throw new Error("Scene operations array is missing");

  const text = JSON.stringify(scene, null, 2) + "\n";
  if (Buffer.byteLength(text, "utf8") > MAX_SCENE_BYTES) throw new Error("Scene file is too large");
  return text;
}

function saveUnique(dir, requestedName, scene) {
  fs.mkdirSync(dir, { recursive: true });
  const base = safeBaseName(requestedName || scene?.name || "Scene");
  const text = serializeScene(scene);

  for (let index = 0; index < 1000; index++) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const fileName = `${base}${suffix}${SCENE_EXT}`;
    const filePath = path.join(dir, fileName);
    try {
      fs.writeFileSync(filePath, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
      return { fileName, filePath };
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique Scene filename");
}

function sendResult(socket, context, payload) {
  socket.send(JSON.stringify({ event: "sendToPropertyInspector", context, payload }));
}

function installSceneFileIO() {
  return {
    handleIncoming(socket, event) {
      let message;
      try {
        message = typeof event?.data === "string" ? JSON.parse(event.data) : null;
      } catch (_) {
        return false;
      }
      const payload = message?.payload;
      if (message?.event !== "sendToPlugin" || payload?.command !== "saveSceneFile") return false;

      try {
        const result = saveUnique(downloadsDir(), payload.fileName, payload.scene);
        console.error(`[v0.15.0] Scene file saved: ${result.filePath}`);
        sendResult(socket, message.context, {
          command: "sceneFileSaved",
          ok: true,
          fileName: result.fileName,
          path: result.filePath
        });
      } catch (error) {
        const detail = error?.message || String(error);
        console.error(`[v0.15.0] Scene file save failed: ${detail}`);
        sendResult(socket, message.context, {
          command: "sceneFileSaved",
          ok: false,
          error: detail
        });
      }
      return true;
    }
  };
}

module.exports = { installSceneFileIO, downloadsDir, serializeScene, saveUnique, safeBaseName };
