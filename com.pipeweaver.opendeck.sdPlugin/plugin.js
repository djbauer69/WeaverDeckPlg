#!/usr/bin/env node
"use strict";

/*
 * PipeWeaver Control for OpenDeck
 *
 * IMPORTANT: this plugin talks only to PipeWeaver's HTTP API.
 * It does not call PipeWire, PulseAudio, WirePlumber, pactl, wpctl, etc.
 */

const http = require("http");

const PIPEWEAVER_URL = process.env.PIPEWEAVER_URL || "http://127.0.0.1:14565/api/command";
const STATUS_INTERVAL_MS = 3000;
const PIPEWEAVER_TIMEOUT_MS = 4000;
const DEFAULT_STEP = 5;
const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 30000;

let port = null;
let pluginUUID = null;
let ws = null;
let lastStatus = null;
let statusRefreshInFlight = false;
let statusTimer = null;
let reconnectTimer = null;
let reconnectDelay = RECONNECT_INITIAL_MS;
let socketGeneration = 0;
const instances = new Map();

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

port = Number(argValue("-port"));
pluginUUID = argValue("-pluginUUID");

if (!port || !pluginUUID) {
  console.error("PipeWeaver Control: missing -port or -pluginUUID");
  process.exit(2);
}

function send(message) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function setTitle(context, title) {
  send({ event: "setTitle", context, payload: { title: String(title) } });
}

function setState(context, state) {
  send({ event: "setState", context, payload: { state: Number(state) } });
}

function showAlert(context) {
  send({ event: "showAlert", context });
}

function showOk(context) {
  send({ event: "showOk", context });
}

function pipeCommand(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(PIPEWEAVER_URL);
    const body = JSON.stringify(data);

    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Accept": "application/json"
      },
      timeout: PIPEWEAVER_TIMEOUT_MS
    }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => text += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`PipeWeaver HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new Error("PipeWeaver returned invalid JSON"));
        }
      });
    });

    req.on("timeout", () => req.destroy(new Error("PipeWeaver request timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function getStatus() {
  return pipeCommand("GetStatus");
}

function unwrapStatus(response) {
  if (!response) return null;
  if (response.Status) return response.Status;
  if (response.data && response.data.Status) return response.data.Status;
  return null;
}

function isOk(response) {
  return response === "Ok" ||
    (response && (response.Ok === null || response.Ok === undefined) && Object.prototype.hasOwnProperty.call(response, "Ok")) ||
    (response && response.data === "Ok");
}

function findNamedTarget(status, name) {
  if (!status) return null;
  const profile = status.audio?.profile || {};
  const configured = profile.devices?.targets || {};
  const configuredTargets = []
    .concat(configured.virtual_devices || [])
    .concat(configured.physical_devices || []);

  for (const d of configuredTargets) {
    const n = d.description?.name || d.name;
    if (n === name) return d;
  }

  const physical = status.audio?.devices?.Target || status.audio?.devices?.target || [];
  for (const d of physical) {
    if ((d.name || d.description) === name) return d;
  }
  return null;
}

function findNamedSource(status, name) {
  if (!status) return null;
  const profile = status.audio?.profile || {};
  const configured = profile.devices?.sources || {};
  const configuredSources = []
    .concat(configured.virtual_devices || [])
    .concat(configured.physical_devices || []);

  for (const d of configuredSources) {
    const n = d.description?.name || d.name;
    if (n === name) return d;
  }

  const physical = status.audio?.devices?.Source || status.audio?.devices?.source || [];
  for (const d of physical) {
    if ((d.name || d.description) === name) return d;
  }
  return null;
}

function targetVolume(target) {
  if (!target) return null;
  if (Number.isFinite(target.volume)) return Number(target.volume);
  return null;
}

function targetMuted(target) {
  if (!target) return null;
  const s = target.mute_state ?? target.muted;
  if (typeof s === "boolean") return s;
  if (s === "Muted") return true;
  if (s === "Unmuted") return false;
  return null;
}

function applications(status) {
  const out = [];
  const seen = new Set();

  // PipeWeaver has used nested application maps in status.audio.applications.
  // Walk that object rather than assuming a particular DeviceType/process key
  // casing. Only objects that look like PipeWeaver Application records are kept.
  function walk(value, processHint = "", deviceTypeHint = "") {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item, processHint, deviceTypeHint);
      return;
    }

    const looksLikeApp =
      Number.isInteger(value.node_id) ||
      Number.isInteger(value.nodeId);

    if (looksLikeApp && typeof value.name === "string") {
      const nodeId = Number.isInteger(value.node_id) ? value.node_id : value.nodeId;
      const process = typeof value.process === "string" ? value.process : processHint;
      const deviceType = typeof value.device_type === "string"
        ? value.device_type
        : deviceTypeHint;

      const key = `${deviceType}|${process}|${value.name}|${nodeId}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          deviceType,
          process,
          name: value.name,
          nodeId,
          volume: Number.isFinite(value.volume) ? value.volume : null,
          muted: Boolean(value.muted),
          title: value.title || ""
        });
      }
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const nextProcess =
        processHint ||
        (key.includes("/") || key.includes(".") || key.includes("-") ? key : "");

      const nextDevice =
        deviceTypeHint ||
        (key.toLowerCase() === "source" || key.toLowerCase() === "target" ? key : "");

      walk(child, nextProcess, nextDevice);
    }
  }

  walk(status?.audio?.applications || {});
  return out.sort((a, b) =>
    `${a.name} ${a.process}`.localeCompare(`${b.name} ${b.process}`)
  );
}

function targetNames(status) {
  const names = new Set();
  const configured = status?.audio?.profile?.devices?.targets || {};
  for (const group of [configured.virtual_devices || [], configured.physical_devices || []]) {
    for (const d of group) {
      const n = d.description?.name || d.name;
      if (n) names.add(n);
    }
  }
  for (const d of (status?.audio?.devices?.Target || status?.audio?.devices?.target || [])) {
    const n = d.name || d.description;
    if (n) names.add(n);
  }
  return [...names].sort((a,b) => a.localeCompare(b));
}

function sourceNames(status) {
  const names = new Set();
  const configured = status?.audio?.profile?.devices?.sources || {};
  for (const group of [configured.virtual_devices || [], configured.physical_devices || []]) {
    for (const d of group) {
      const n = d.description?.name || d.name;
      if (n) names.add(n);
    }
  }
  for (const d of (status?.audio?.devices?.Source || status?.audio?.devices?.source || [])) {
    const n = d.name || d.description;
    if (n) names.add(n);
  }
  return [...names].sort((a,b) => a.localeCompare(b));
}

function instanceListForAction(action) {
  return [...instances.values()].filter(x => x.action === action);
}

function updateInstance(inst) {
  if (!lastStatus) {
    setState(inst.context, 1);
    setTitle(inst.context, "PW\nOFF");
    return;
  }

  if (inst.action === "com.pipeweaver.opendeck.volumeup" ||
      inst.action === "com.pipeweaver.opendeck.volumedown") {
    const name = inst.settings.targetName;
    const target = findNamedTarget(lastStatus, name);
    const vol = targetVolume(target);
    if (vol == null) {
      setState(inst.context, 1);
      setTitle(inst.context, name ? `PW\n${name}` : "PW\nSET");
    } else {
      setState(inst.context, 0);
      setTitle(inst.context, `${name || "Target"}\n${vol}%`);
    }
  } else if (inst.action === "com.pipeweaver.opendeck.mute") {
    const name = inst.settings.targetName;
    const target = findNamedTarget(lastStatus, name);
    const muted = targetMuted(target);
    if (muted == null) {
      setState(inst.context, 1);
      setTitle(inst.context, name ? `${name}\n?` : "PW\nMUTE");
    } else {
      setState(inst.context, muted ? 1 : 0);
      setTitle(inst.context, `${name || "Target"}\n${muted ? "MUTED" : "LIVE"}`);
    }
  } else if (inst.action === "com.pipeweaver.opendeck.appmute") {
    const a = applications(lastStatus).find(x =>
      x.process === inst.settings.process && x.name === inst.settings.name
    );
    if (!a) {
      setState(inst.context, 1);
      setTitle(inst.context, inst.settings.name ? `${inst.settings.name}\n?` : "PW\nAPP");
    } else {
      setState(inst.context, a.muted ? 1 : 0);
      setTitle(inst.context, `${a.name}\n${a.muted ? "MUTED" : "LIVE"}`);
    }
  } else if (inst.action === "com.pipeweaver.opendeck.route") {
    setState(inst.context, 0);
    setTitle(inst.context, `${inst.settings.sourceName || "SRC"}\n→ ${inst.settings.targetName || "TGT"}`);
  }
}

function updateAll() {
  for (const inst of instances.values()) updateInstance(inst);
}

async function refreshStatus() {
  // Never allow background polling and a button-triggered refresh to overlap.
  if (statusRefreshInFlight) return lastStatus;
  statusRefreshInFlight = true;
  try {
    const response = await getStatus();
    const status = unwrapStatus(response);
    if (!status) throw new Error("PipeWeaver status response not recognised");
    lastStatus = status;
    updateAll();
    return status;
  } catch (e) {
    console.error("PipeWeaver status refresh failed:", e.message);
    if (lastStatus !== null) {
      lastStatus = null;
      updateAll();
    }
    return null;
  } finally {
    statusRefreshInFlight = false;
  }
}

function scheduleStatusRefresh() {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(async () => {
    await refreshStatus();
    scheduleStatusRefresh();
  }, STATUS_INTERVAL_MS);
}

async function volumeStep(inst, delta) {
  const status = await refreshStatus();
  const current = targetVolume(findNamedTarget(status, inst.settings.targetName));
  if (current == null) {
    showAlert(inst.context);
    return;
  }

  const step = Number(inst.settings.step);
  const amount = Number.isFinite(step) && step > 0 ? Math.round(step) : DEFAULT_STEP;
  const next = Math.max(0, Math.min(100, current + delta * amount));

  try {
    const response = await pipeCommand({
      Pipewire: {
        SetVolumeByName: [inst.settings.targetName, null, next]
      }
    });
    if (!isOk(response) && response?.Pipewire !== "Ok") {
      throw new Error(JSON.stringify(response));
    }
    await refreshStatus();
    showOk(inst.context);
  } catch (e) {
    console.error("Volume command failed:", e.message);
    showAlert(inst.context);
  }
}

async function toggleMute(inst) {
  const status = await refreshStatus();
  const current = targetMuted(findNamedTarget(status, inst.settings.targetName));
  if (current == null) {
    showAlert(inst.context);
    return;
  }
  const next = current ? "Unmuted" : "Muted";
  try {
    const response = await pipeCommand({
      Pipewire: {
        SetTargetMuteStatesByName: [inst.settings.targetName, next]
      }
    });
    if (!isOk(response) && response?.Pipewire !== "Ok") throw new Error(JSON.stringify(response));
    await refreshStatus();
    showOk(inst.context);
  } catch (e) {
    console.error("Mute command failed:", e.message);
    showAlert(inst.context);
  }
}

async function toggleRoute(inst) {
  if (!inst.settings.sourceName || !inst.settings.targetName) {
    showAlert(inst.context);
    return;
  }
  try {
    const response = await pipeCommand({
      Pipewire: {
        ToggleRouteByNames: [inst.settings.sourceName, inst.settings.targetName]
      }
    });
    if (!isOk(response) && response?.Pipewire !== "Ok") throw new Error(JSON.stringify(response));
    showOk(inst.context);
  } catch (e) {
    console.error("Route command failed:", e.message);
    showAlert(inst.context);
  }
}

async function toggleAppMute(inst) {
  const status = await refreshStatus();
  const a = applications(status).find(x =>
    x.name === inst.settings.name &&
    (!inst.settings.process || x.process === inst.settings.process)
  );
  if (!a || !Number.isInteger(a.nodeId)) {
    showAlert(inst.context);
    return;
  }
  try {
    const response = await pipeCommand({
      Pipewire: {
        SetApplicationMute: [a.nodeId, !a.muted]
      }
    });
    if (!isOk(response) && response?.Pipewire !== "Ok") throw new Error(JSON.stringify(response));
    await refreshStatus();
    showOk(inst.context);
  } catch (e) {
    console.error("Application mute command failed:", e.message);
    showAlert(inst.context);
  }
}

async function handleMessage(msg) {
  const event = msg.event;

  if (event === "willAppear") {
    const settings = msg.payload?.settings || {};
    instances.set(msg.context, {
      context: msg.context,
      action: msg.action,
      settings: {...settings}
    });
    updateInstance(instances.get(msg.context));
    return;
  }

  if (event === "willDisappear") {
    instances.delete(msg.context);
    return;
  }

  if (event === "didReceiveSettings") {
    const inst = instances.get(msg.context);
    if (inst) {
      inst.settings = {...(msg.payload?.settings || {})};
      updateInstance(inst);
    }
    return;
  }

  if (event === "keyDown") {
    const inst = instances.get(msg.context);
    if (!inst) return;
    if (inst.action === "com.pipeweaver.opendeck.volumeup") await volumeStep(inst, 1);
    else if (inst.action === "com.pipeweaver.opendeck.volumedown") await volumeStep(inst, -1);
    else if (inst.action === "com.pipeweaver.opendeck.mute") await toggleMute(inst);
    else if (inst.action === "com.pipeweaver.opendeck.route") await toggleRoute(inst);
    else if (inst.action === "com.pipeweaver.opendeck.appmute") await toggleAppMute(inst);
    return;
  }

  if (event === "sendToPlugin") {
    const payload = msg.payload || {};
    const inst = instances.get(msg.context);
    if (payload.command === "getTargets" && inst) {
      const status = lastStatus || await refreshStatus();
      send({
        event: "sendToPropertyInspector",
        context: msg.context,
        payload: {
          command: "targets",
          targets: targetNames(status),
          sources: sourceNames(status),
          applications: applications(status),
          applicationStatus: status?.audio?.applications || {}
        }
      });
    }
  }
}

function scheduleReconnect(generation) {
  if (generation !== socketGeneration) return;
  if (reconnectTimer) return;

  const delay = reconnectDelay;
  console.error(`PipeWeaver Control: reconnecting to OpenDeck in ${delay}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    connect();
  }, delay);
}

function connect() {
  const WebSocket = globalThis.WebSocket;
  if (!WebSocket) {
    console.error("PipeWeaver Control: Node.js 20+ is required (global WebSocket missing)");
    process.exit(3);
  }

  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;

  const generation = ++socketGeneration;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  ws = socket;

  socket.onopen = () => {
    if (generation !== socketGeneration) return;
    reconnectDelay = RECONNECT_INITIAL_MS;
    console.error(`PipeWeaver Control: connected to OpenDeck on ${port}`);
    send({event: "registerPlugin", uuid: pluginUUID});
    void refreshStatus();
    scheduleStatusRefresh();
  };

  socket.onmessage = async (ev) => {
    if (generation !== socketGeneration) return;
    try {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      await handleMessage(msg);
    } catch (e) {
      console.error("OpenDeck message error:", e.message);
    }
  };

  socket.onerror = (e) => {
    if (generation === socketGeneration) {
      console.error("OpenDeck websocket error:", e?.message || e);
    }
  };

  socket.onclose = () => {
    if (generation !== socketGeneration) return;
    if (ws === socket) ws = null;
    console.error("PipeWeaver Control: OpenDeck connection closed");
    scheduleReconnect(generation);
  };
}

process.on("uncaughtException", err => {
  console.error("PipeWeaver Control: uncaught exception:", err?.stack || err);
});

process.on("unhandledRejection", reason => {
  console.error("PipeWeaver Control: unhandled rejection:", reason);
});

connect();
scheduleStatusRefresh();
