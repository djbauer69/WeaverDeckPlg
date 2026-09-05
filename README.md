# PipeWeaver Control for OpenDeck 0.11.2

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.11.2 highlights

- Adds Scene validation and all-or-nothing runtime preflight before structured Scene execution.
- Validates configured Sources, Targets, physical devices, application route destinations, selections, and volume values before a Scene runs.
- Missing applications are warnings rather than fatal errors; their application steps are safely skipped while the rest of the Scene can continue.
- Restores configured PipeWeaver physical Sources and Targets to normal Scene Source/Target lists.
- Makes Scene route execution idempotent: routes already in the requested state are treated as successful no-ops.
- Keeps application controls inside Scenes, including mute, volume, and transient routing.
- Keeps physical input/output volume and mute controls and default-device selection inside Scenes.
- Keeps Capture Current State for Sources, Targets, routes, applications, physical devices, and defaults.
- Keeps detailed Scene execution and validation diagnostics in the plugin log.
- Keeps live visual-state feedback for normal actions.

## Scene validation

The Scene Builder includes **Validate Scene**. Structured Scenes are also validated automatically immediately before execution.

Validation checks include:

- Source and Target selections and availability
- Source and Target volume ranges
- Physical input/output availability
- Default-device selections
- Application descriptors and compatible route destinations
- Unsupported or malformed Scene operations

A validation **error** prevents the entire Scene from executing. This is an all-or-nothing preflight: no earlier valid step is executed when any step contains a fatal validation error.

An application that is not currently running produces a **warning**, not an error. The corresponding application operation is skipped at execution time.

## Capture Current State

Arrange PipeWeaver exactly as desired, open the **PipeWeaver Scene** property inspector, and choose **Capture Current State**. The plugin requests a fresh PipeWeaver status snapshot and generates editable structured operations representing the current state.

Capture includes:

- Source A/B volume and mute state
- Target volume, mute state, and Mix A/B
- Source-to-Target routes, both enabled and disabled
- Application mute, volume, and routing state when available
- Physical input/output volume and mute state
- Current default input and output

Disabled routes are deliberately captured so a Scene can restore a deterministic routing matrix rather than only enabling routes that happened to be active when it was captured.

## Scene Builder

The **PipeWeaver Scene** action supports structured operations for:

- Source Mute / Unmute — one or more Sources, Mix A or B
- Target Mute / Unmute — one or more Targets
- Source Set Volume — one or more Sources, Mix A or B, 0–100%
- Target Set Volume — one or more Targets, 0–100%
- Target Mix A / B — one or more Targets
- Route On / Off — one or more Sources and Targets
- Application Mute / Unmute
- Application Set Volume
- Application Route On / Off
- Physical Input Mute / Unmute
- Physical Input Set Volume
- Physical Output Mute / Unmute
- Physical Output Set Volume
- Set Default Input / Output

Steps execute from top to bottom after the complete Scene passes preflight validation.

## Scene diagnostics

Structured Scenes log validation, Scene start, each operation start/result, failures, completion, Scene name, operation count, context, and execution duration.

Typical validation entries include:

- `[Scene] VALIDATION START name="Gaming" operations=5`
- `[Scene] VALIDATION OK errors=0 warnings=0`
- `[Scene] VALIDATION ERROR step=2 type=sourceMute reason="No sources selected"`
- `[Scene] VALIDATION FAILED errors=1 warnings=0`

Execution entries include:

- `[Scene] START name="Gaming" operations=5 ...`
- `[Scene] STEP 1/5 START Source A mute: Browser, Music`
- `[Scene] STEP 1/5 OK ...`
- `[Scene] COMPLETE name="Gaming" operations=5 duration=...ms`

Legacy JSON Scenes retain execution support for backwards compatibility.

## Actions

### Application
- Application Mute
- Application Route Off / On / Toggle
- Application Set Volume
- Application Volume Down / Up

### Physical / default devices
- Physical Input Mute
- Physical Input Volume Down / Up
- Physical Output Mute
- Physical Output Volume Down / Up
- Set Default Device

### Routing
- Route Off
- Route On
- Toggle Route

### Source
- Source A Volume Down / Up
- Source B Volume Down / Up
- Source Mute
- Source Mute A
- Source Mute B
- Source Set Volume
- Source Volume Down / Up

### Target
- Set Target Volume
- Target Mix A / B
- Toggle Target Mix
- Target Mute / Mute Off / Mute On
- Target Volume Down / Up

### Utility
- PipeWeaver Scene
- PipeWeaver Status

## Requirements
- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install
1. Download `pipeweaver-opendeck-plugin-v0.11.2.zip` from the v0.11.2 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.
5. Add PipeWeaver actions to Stream Deck keys and configure them in OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Release

The v0.11.2 release contains the matching plugin ZIP. Source on `main`, the manifest version, plugin diagnostics version, and release package are intended to remain synchronized for each WeaverDeck release.
