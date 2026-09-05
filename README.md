# PipeWeaver Control for OpenDeck 0.8.0

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.8.0 highlights

- Adds **Capture Current State** to the structured Scene Builder.
- Captures Source Mix A and B volumes and mute states.
- Captures Target volume, mute state, and Mix A/B selection.
- Captures the complete Source-to-Target routing matrix, including routes that are currently off, so captured scenes restore a deterministic routing state.
- Captured state is converted into normal editable structured scene steps; individual operations can be removed, reordered, or changed before use.
- Existing scene steps are protected by a confirmation prompt before capture replaces them.
- Keeps the detailed scene execution logging introduced in v0.7.1.
- Keeps all existing live visual-state feedback and application-routing behavior.

## Capture Current State

Arrange PipeWeaver exactly as desired, open the **PipeWeaver Scene** property inspector, and choose **Capture Current State**. The plugin requests a fresh PipeWeaver status snapshot and generates structured operations for the current Sources, Targets, and routes.

Capture currently includes:

- Source A volume and mute state
- Source B volume and mute state
- Target volume and mute state
- Target Mix A/B
- Source-to-Target routes, both enabled and disabled

Disabled routes are deliberately captured. This means a scene can turn off routes that were enabled after the scene was created, rather than only enabling the routes that were active at capture time.

After capture, the generated operations remain fully editable in the Scene Builder. Remove any steps for state you do not want the scene to control.

## Scene Builder

The **PipeWeaver Scene** action supports these structured operations:

- Source Mute / Unmute — select one or more sources, Mix A or B, and the desired mute state.
- Target Mute / Unmute — select one or more targets and the desired mute state.
- Source Set Volume — select one or more sources, Mix A or B, and an exact 0–100% volume.
- Target Set Volume — select one or more targets and an exact 0–100% volume.
- Target Mix A / B — select one or more targets and the desired mix.
- Route On / Off — select one or more sources and targets and explicitly enable or disable all selected route combinations.

Steps run from top to bottom. A single scene can therefore mute several sources, unmute several targets, set volumes, switch mixes, and change routes with one key press.

## Scene diagnostics

Structured scenes log scene start, each operation start/result, failures, completion, scene name, operation count, context, and execution duration. Failed steps identify the exact step number and a human-readable operation description.

Example successful entries:

- `[Scene] START name="Gaming" operations=5 ...`
- `[Scene] STEP 1/5 START Source A mute: Browser, Music`
- `[Scene] STEP 1/5 OK ...`
- `[Scene] COMPLETE name="Gaming" operations=5 duration=...ms`

Legacy JSON scenes retain execution logging for backwards compatibility.

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
1. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
2. Extract the v0.8.0 plugin package into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add PipeWeaver actions to Stream Deck keys and configure them in OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.
