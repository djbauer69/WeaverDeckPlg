# PipeWeaver Control for OpenDeck 0.7.0

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.7.0 highlights

- Replaces the raw JSON-only Scene Property Inspector with a structured **Scene Builder**.
- A scene can contain multiple ordered steps and each step can control multiple PipeWeaver channels.
- Source mute/unmute supports independent **A/B** channel selection and multiple sources at once.
- Target mute/unmute supports multiple targets at once.
- Source Set Volume supports multiple sources with A/B selection.
- Target Set Volume supports multiple targets.
- Target Mix A/B supports multiple targets.
- Route On/Off supports multiple sources and multiple targets in one scene step.
- Scene steps can be added, removed, and reordered from the Property Inspector.
- Scene operations use explicit states rather than toggles, so repeatedly running a scene produces the same result.
- Existing legacy JSON scenes continue to run until they are replaced with structured scene steps.
- Keeps all v0.6.0 live visual-state feedback and the v0.5.1 application-routing type fix.

## Scene Builder

The **PipeWeaver Scene** action now supports these structured operations:

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
2. Extract the v0.7.0 plugin package into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add PipeWeaver actions to Stream Deck keys and configure them in OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.
