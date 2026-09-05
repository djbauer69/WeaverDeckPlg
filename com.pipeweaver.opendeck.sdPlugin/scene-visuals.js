"use strict";

/* WeaverDeck v0.15.0 Scene key visuals
 * Keeps Scene names visible and briefly marks success/failure without changing
 * the stable Scene execution engine.
 */

const SCENE_ACTION = "com.pipeweaver.opendeck.scene";

function parse(data) {
  try { return typeof data === "string" ? JSON.parse(data) : null; } catch (_) { return null; }
}

function installSceneVisuals() {
  const contexts = new Map();
  const timers = new Map();

  function nameFor(context) { return contexts.get(context)?.name || "SCENE"; }
  function rawTitle(socket, context, title) {
    try { socket._ws.send(JSON.stringify({ event: "setTitle", context, payload: { title } })); } catch (_) {}
  }
  function flash(socket, context, ok) {
    if (!contexts.has(context)) return;
    const name = nameFor(context);
    rawTitle(socket, context, `${ok ? "✓" : "!"}\n${name}`);
    if (timers.has(context)) clearTimeout(timers.get(context));
    timers.set(context, setTimeout(() => {
      timers.delete(context);
      if (contexts.has(context)) rawTitle(socket, context, nameFor(context));
    }, 1400));
  }

  return {
    handleIncoming(socket, event) {
      const m = parse(event?.data);
      if (!m) return;
      if ((m.event === "willAppear" || m.event === "didReceiveSettings") && m.action === SCENE_ACTION && m.context) {
        contexts.set(m.context, { name: String(m.payload?.settings?.name || "SCENE") });
      } else if (m.event === "willDisappear" && m.context) {
        contexts.delete(m.context);
        if (timers.has(m.context)) { clearTimeout(timers.get(m.context)); timers.delete(m.context); }
      }
    },
    handleOutgoing(socket, data) {
      const m = parse(data);
      if (!m?.context || !contexts.has(m.context)) return data;
      if (m.event === "showOk") flash(socket, m.context, true);
      else if (m.event === "showAlert") flash(socket, m.context, false);
      return data;
    }
  };
}

module.exports = { installSceneVisuals, SCENE_ACTION };
