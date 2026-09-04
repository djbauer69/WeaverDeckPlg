# PipeWeaver Control for OpenDeck 0.6.0

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.6.0 highlights

- Live visual state feedback for application, source, target, route, physical-device, default-device, and PipeWeaver status actions.
- Mute keys now show **green/live** and **red/muted** states.
- Route keys show active vs inactive routing state.
- Target Mix actions now visually distinguish **Mix A** and **Mix B**.
- Set Default Device indicates when the selected device is currently active as PipeWeaver's default.
- Volume actions continue to show the current percentage in the key title.
- Property Inspectors now request their PipeWeaver data directly from `websocket.onopen` instead of relying on arbitrary 50 ms delays.
- Application routing keeps the v0.5.1 device-type fix: playback applications route to PipeWeaver Sources and capture applications route to PipeWeaver Targets.

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
2. Extract the v0.6.0 plugin package into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add PipeWeaver actions to Stream Deck keys and configure them in OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.
