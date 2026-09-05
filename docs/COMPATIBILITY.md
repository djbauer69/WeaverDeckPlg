# WeaverDeck compatibility and test matrix

Applies to **WeaverDeck v0.20.0 prerelease**. Updated 2026-09-05.

**Automated pass** means a simulated protocol/core test passed; it does not mean
that physical hardware or a Linux distribution was tested. **Pending** means no
runtime result has been recorded. There are no universal hardware/distro guarantees.

## Hardware

| Device / integration | Buttons | Dials and touch-strip display | Evidence / remaining work |
| --- | --- | --- | --- |
| Elgato Stream Deck XL | User-tested on CachyOS through v0.19.1; v0.20 regression pending | No dials/strip | v0.19.1 labels and persistence confirmed; 47 existing button UUIDs retained in v0.20 |
| Elgato Mini / Original / MK.2 | Expected through OpenDeck; hardware pending | Not applicable | No fixed XL grid assumption in action handlers; verify artwork/readability on each model |
| Elgato Stream Deck + | Hardware pending | Implemented; automated protocol pass; hardware pending | Five Volume Dial actions, feedback layout, turn/press/tap |
| Elgato Stream Deck + XL | Hardware pending | Expected through OpenDeck 2.14.0; hardware pending | OpenDeck release adds model support; verify every encoder position and strip scaling |
| Elgato Stream Deck Neo | Button hardware pending | Dedicated infobar action **not implemented** | Infobar is distinct from the encoder touch-strip layout; no Neo display compatibility claim |
| Elgato Stream Deck Pedal | Expected button-event controls; hardware pending | No display/dial support claimed | Test mute/Scene activation; no physical artwork expected |
| Non-Elgato controller with an OpenDeck device plugin | Conditional; hardware pending | Conditional; hardware pending | Exact adapter must expose compatible Keypad/Encoder events and feedback rendering |
| Generic USB macro pad / MIDI controller without an OpenDeck adapter | Not supported directly | Not supported directly | WeaverDeck does not implement USB or MIDI drivers |

Hardware support is supplied by OpenDeck or its device plugins. WeaverDeck
communicates with PipeWeaver only; it does not directly control other mixers/apps.

## Linux installations

| Environment | Status | Required checks |
| --- | --- | --- |
| CachyOS, x86_64, user's existing installation | v0.19.1 runtime passed; v0.20 pending | Existing XL controls, labels, Scene regression |
| Other Arch-based distributions | Pending | Native runtime, OpenDeck device access, PipeWeaver API, startup Scene path |
| Debian / Ubuntu, x86_64 | Pending | Same checks using distribution packages; inspect Node.js version |
| Fedora / openSUSE, x86_64 | Pending | Same checks using distribution packages |
| Immutable/Atomic desktops and OpenDeck Flatpak | Pending | Host Node.js, USB rules, API reachability and local Scene-file access |
| Linux aarch64 | Manifest entry provided; runtime pending | Native OpenDeck/PipeWeaver availability and Node.js; no architecture-specific plugin binary |
| Other architectures / Windows / macOS | No support claim | Outside this Linux package's validated scope |

Target host for dial development: **OpenDeck 2.14.0** (source inspected at
`b2d09ca60089cea38ffea7eef191270ffefdf851`). Touch-strip rendering and touchTap
were introduced in OpenDeck 2.13.0, but older hosts have not been validated here.

Runtime prerequisites:
- Node.js with global `WebSocket` available. Native Node.js 22 or newer is a
  suitable starting point; check `node -p 'typeof WebSocket'` returns `function`.
- A compatible running PipeWeaver with its HTTP API reachable at the configured
  endpoint (default `http://127.0.0.1:14565/api/command`).
- OpenDeck device permissions/udev rules and executable plugin launch files.
- Read access to saved Scene files and write access to the user's settings folder.
- For OpenDeck Flatpak, follow upstream instructions for native Node.js; a Node.js
  Flatpak is not a substitute. File paths and available icons may differ by install.

## v0.20 automated coverage

33 Node tests pass across the full suite. The dial-specific tests cover:

| Check | Result | Hardware validation |
| --- | --- | --- |
| Positive/negative multi-tick rotation, burst coalescing, reversal, 0–100 limits | Pass | Pending |
| New rotation during an outstanding request | Pass; changes serialized | Pending rapid-turn responsiveness |
| Press/release, duplicate press, short tap, ignored long touch | Pass | Pending physical event delivery |
| Application identity, Source mix B, Target, Physical Input/Output command selection | Pass | Pending each control type |
| Manual/Dynamic labels, blank label, 0%, unavailable feedback | Pass | Pending physical layout and muted indication |
| Deleted/reconfigured controls, stale gestures, disconnect during readiness | Pass; no later command sent | Pending page/reconnect behavior |
| Uncertain command acknowledgement | Pass; no retry, queued input discarded | Pending induced outage |
| Encoder layout references, item bounds, all button UUIDs, alphabetical grouping | Pass | Pending host rendering |
| Existing application identity, Scene, startup, and text-mode regressions | Pass | Pending v0.20 user regression |

## Hardware acceptance sequence

Record device model, Linux distribution, CPU architecture, OpenDeck/PipeWeaver/
Node.js versions, installation format, and plugin version with each result.

1. On the existing XL, confirm old buttons, Dynamic/Manual labels and live
   percentage badges work. Run a representative Smart Scene. Restart OpenDeck
   and verify persistence. Check Startup Scene only if configured/enabled.
2. On a Stream Deck +, assign **Target Volume Dial** to an encoder. Select a
   target and Step % (default 5). Turn one tick each way; compare PipeWeaver and
   the displayed percentage. Turn quickly both ways and test 0%/100% boundaries.
3. Press and release once: mute must toggle exactly once. Tap the strip once:
   mute must toggle once. Long touch intentionally does nothing.
4. Repeat for Application, Source, Physical Input and Physical Output Volume
   Dial. Check Source A/B independently (or expect both to follow if linked in
   PipeWeaver). Restart Brave and verify its configured dial reconnects safely.
5. Change volumes/mute externally in PipeWeaver. Feedback should follow the
   normal status refresh (approximately three seconds), including 0% and MUTED.
6. Choose Manual Input; verify the label stays fixed while the bar/value/state
   update. Switch to Dynamic Text, test a blank manual label and restart OpenDeck.
   Strip labels use one line; long names may be clipped by the host renderer.
7. Switch pages, remove/reassign a dial and disconnect/reconnect the deck. No
   old queued movement should be applied to a newly assigned device.
8. Stop PipeWeaver; confirm Unavailable after a failed status refresh. Turn a
   dial while offline, restart PipeWeaver, and verify no old gesture replays.
9. On + XL or a third-party adapter, repeat for every encoder position and check
   strip sizing, touch coordinates and event delivery. Do not infer a pass from +.

Attach screenshots for display issues and the plugin/OpenDeck logs for input or
connection issues. A log alone cannot prove visual rendering or perceived latency.

## Sources

- [OpenDeck device and Linux installation guidance](https://github.com/nekename/OpenDeck#readme)
- [OpenDeck 2.13.0 display/touch additions](https://github.com/nekename/OpenDeck/releases/tag/v2.13.0)
- [OpenDeck 2.14.0 model support](https://github.com/nekename/OpenDeck/releases/tag/v2.14.0)
- [OpenDeck 2.14.0 dial event implementation](https://github.com/nekename/OpenDeck/blob/v2.14.0/src-tauri/src/events/outbound/encoder.rs)
- [OpenDeck 2.14.0 feedback renderer](https://github.com/nekename/OpenDeck/blob/v2.14.0/src-tauri/src/encoder_layouts.rs)
- [Elgato dial/touch event protocol](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/)
