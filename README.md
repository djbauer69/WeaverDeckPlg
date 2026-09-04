# PipeWeaver Control for OpenDeck 0.7.1

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.7.1 highlights

- Adds detailed **scene execution logging** to make field diagnosis much easier.
- Structured scenes now log scene start, each step start/result, failures, completion, scene name, operation count, context, and execution duration.
- Failed steps identify the exact step number and a human-readable operation description.
- Legacy JSON scenes also log start, per-command progress, completion, and failure details.
- Keeps the v0.7.0 structured **Scene Builder**, including multi-source and multi-target operations.
- Keeps all v0.6.0 live visual-state feedback and the v0.5.1 application-routing type fix.

## Scene diagnostics

A successful structured scene produces concise log entries such as:

- `[Scene] START name="Gaming" operations=5 ...`
- `[Scene] STEP 1/5 START Source A mute: Browser, Music`
- `[Scene] STEP 1/5 OK ...`
- `[Scene] COMPLETE name="Gaming" operations=5 duration=...ms`

If a step fails, the log records the exact step number, operation description, error returned by PipeWeaver, and total elapsed time before the failure. This is intended to make user-submitted plugin logs useful for troubleshooting without requiring additional debug builds.

## Scene Builder

The **PipeWeaver Scene** action supports these structured operations:

- Source Mute / Unmute — select one or more sources, Mix A or B, and the desired mute state.
- Target Mute / Unmute — select one or more targets and the desired mute state.
- Source Set Volume — select one or more sources, Mix A or B, and an exact 0–100% volume.
- Target Set Volume — select one or more targets and an exact 0–100% volume.
- Target Mix A / B — select one or more targets and the desired mix.
- Route On / Off — select one or more sources and targets and explicitly enable or disable all selected route combinations.

Steps run from top to bottom. A single scene can therefore mute several sources, unmute several targets, set volumes, switch mixes, and change routes with one key press.

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
2. Extract the v0.7.1 plugin package into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add PipeWeaver actions to Stream Deck keys and configure them in OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.
