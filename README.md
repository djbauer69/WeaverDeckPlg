# PipeWeaver Control for OpenDeck 0.13.0

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

Linux desktop files and icon-theme assets are read only to improve Stream Deck button artwork. They are never used for audio control.

## v0.13.0 highlights

- Adds **Scene Import / Export / Share** to the structured Scene Builder.
- **Export Scene JSON** serializes the current scene into a portable, human-readable `WeaverDeckScene` JSON document and attempts to copy it to the clipboard.
- **Import Scene JSON** accepts exported/shared scene JSON, checks the scene format/version, confirms before replacing an existing scene, saves it to the key, and prompts validation against the current PipeWeaver setup.
- Exported scenes contain the scene name, format version, scene version, and structured operations. They do not contain OpenDeck context IDs or transient runtime state.
- Imported application descriptors, physical-device descriptors, configured source/target names, routes, volumes, mute states and default-device steps retain the same semantics as locally built scenes.
- Existing **Validate Scene** remains the compatibility/preflight check after importing a scene onto another system.
- Keeps v0.12.2 large application artwork, dynamic titles and optional Button Text.
- Keeps the proven PipeWeaver-only control engine and all Scene validation, Capture Current State, application, physical-device, and route-idempotency behavior.

## Sharing a Scene

1. Open a PipeWeaver Scene action in OpenDeck.
2. Build or capture the scene normally.
3. Select **Export Scene JSON**.
4. Copy/save the JSON text and share it.
5. On another Scene action, paste the JSON into **Scene Import / Export** and select **Import Scene JSON**.
6. Select **Validate Scene** before running it. Device names and application identities must exist or be compatible with the receiving PipeWeaver setup; missing running applications remain warnings and are skipped according to existing Scene behavior.

Export format example:

```json
{
  "format": "WeaverDeckScene",
  "formatVersion": 1,
  "name": "Gaming",
  "sceneVersion": 1,
  "operations": [
    {
      "type": "targetVolume",
      "targets": ["Desktop"],
      "volume": 50
    }
  ]
}
```

## Application artwork and Button Text

Application actions retain the large icon presentation introduced in v0.12.1. Leaving **Button Text** blank uses the normal dynamic title; setting Button Text uses that persistent custom label. Linux `.desktop` and icon-theme discovery remains visual-only.

## Scene validation

The Scene Builder includes **Validate Scene**, and structured Scenes are validated automatically immediately before execution. Validation checks source/target selections and availability, volume ranges, physical devices, default devices, application descriptors and route destinations, and unsupported/malformed operations. Validation errors abort the whole Scene before execution. Missing applications are warnings and their steps are skipped safely.

## Capture Current State

Capture Current State records Source A/B volume and mute state, Target volume/mute/mix, the complete Source-to-Target route matrix, application mute/volume/routing state when available, physical input/output volume and mute state, and current default input/output devices.

## Actions

Application controls include Mute, Route Off/On/Toggle, Set Volume, and Volume Down/Up. Physical/default controls include physical input/output mute and volume plus Set Default Device. Source/Target controls include routing, Source A/B volume and mute, Target volume/mute and Mix A/B. Utility actions include PipeWeaver Scene and PipeWeaver Status.

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.13.0.zip` from the v0.13.0 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Release

The v0.13.0 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`b2fed6c6d965ed6ceeb09e72427a37e9ad5442596bcc14dad0f038bf2e2aea0d`
