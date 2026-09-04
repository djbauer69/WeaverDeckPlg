# PipeWeaver Control for OpenDeck 0.2.1

For OpenDeck 2.14.x on Linux.

## Important
This plugin controls **PipeWeaver only**. It sends PipeWeaver API commands to:
`http://127.0.0.1:14565/api/command`

It does not call PipeWire, PulseAudio, WirePlumber, pactl, or wpctl directly.

## Actions
- Volume Up
- Volume Down
- Toggle Target Mute
- Toggle Route
- Application Mute

## Requirements
- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API enabled on port 14565 (the PipeWeaver default)

## Install
1. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
2. Extract this plugin into OpenDeck's plugins directory.
3. Restart OpenDeck.
4. Add a PipeWeaver action to a Stream Deck key and select its target/source in the property inspector.

The plugin log should appear at:
`~/.local/share/opendeck/logs/plugins/com.pipeweaver.opendeck.log`
