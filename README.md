# PipeWeaver Control for OpenDeck 0.4.1

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only**. It sends PipeWeaver API commands to:
`http://127.0.0.1:14565/api/command`

It does not call PipeWire, PulseAudio, WirePlumber, pactl, or wpctl directly.

## Actions

### Target control
- Volume Up
- Volume Down
- Toggle Target Mute
- Set Target Volume
- Target Mute
- Target On
- Target Off
- Target Mix A
- Target Mix B
- Toggle Target Mix

### Source control
- Source Volume Up
- Source Volume Down
- Source Mute

### Routing
- Toggle Route
- Route On
- Route Off

### Application control
- Application Mute
- Application Volume Up
- Application Volume Down

### Physical/default-device control
- Physical Output Volume Up
- Physical Output Volume Down
- Physical Output Mute
- Set Default Device

### Utility
- PipeWeaver Status
- PipeWeaver Scene

## Requirements
- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API enabled on port 14565 (the PipeWeaver default)

## Install
1. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
2. Extract the `v0.4.1` plugin package into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add a PipeWeaver action to a Stream Deck key and configure it in the property inspector.

The plugin log should appear at:
`~/.local/share/opendeck/logs/plugins/com.pipeweaver.opendeck.log`

## v0.4.1

Version 0.4.1 expands the PipeWeaver action set with source volume/mute controls and target mix controls, and improves discovery of configured and physical PipeWeaver sources and targets in the property inspectors.

The plugin continues to communicate exclusively through PipeWeaver's API; it does not manipulate PipeWire or PulseAudio directly.
