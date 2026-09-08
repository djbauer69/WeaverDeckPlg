# Diagnostic logging

Normal v0.24.1 logs keep startup, preview/validation result summaries, Scene start/end, skipped conditions, warnings/failures and fade results. Full OpenDeck event payloads, action settings, application/device discovery, inspector selection/redraw messages and successful per-step Scene detail are disabled by default.

For troubleshooting, set `WEAVERDECK_DEBUG=1` in the environment used to launch OpenDeck, then fully restart OpenDeck. The plugin inherits it. Unset the variable and restart again to return to smaller normal logs. This setting changes logging only; it does not disable repaint handling, change Scene behavior or filter failures. Verbose logs contain device/application identities and action settings, so inspect them before sharing publicly.

The shared `diagnostics.js` policy allows inspector and application-icon modules to use the same debug switch. The core checks the policy before serializing large objects. Existing module boundaries and audio execution paths are retained.
