# PipeWeaver Control for OpenDeck 0.5.1

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## Actions

### Application
- Application Mute
- Application Route Off / On / Toggle
- Application Set Volume
- Application Volume Down / Up

Application routing is type-aware in v0.5.1: playback applications route to compatible PipeWeaver **Sources**, while capture/recording applications route to compatible PipeWeaver **Targets**. Route Off clears the transient route back to the system Default destination, matching PipeWeaver's API behavior.

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
2. Extract the v0.5.1 plugin package into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add PipeWeaver actions to Stream Deck keys and configure them in OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## v0.5.1

Version 0.5.1 fixes Application Route On / Off / Toggle destination selection. v0.5.0 incorrectly offered PipeWeaver Targets to playback applications, causing PipeWeaver to return `Target Type mismatch`. The property inspector now preserves the application's PipeWeaver device type and presents only compatible routing destinations.

## v0.5.0

Version 0.5.0 builds on the stable v0.4.8 baseline and adds exact source volume control, dedicated Mix A/B source controls, independent source A/B mute actions, live application set-volume and transient route controls, physical input volume/mute controls, and improved state feedback for routes, source mute/volume, target mix, applications, and physical devices.

The plugin communicates exclusively through PipeWeaver.
