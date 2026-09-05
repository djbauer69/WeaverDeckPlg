# PipeWeaver Control for OpenDeck 0.14.2

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.14.2 highlights

- Fixes **Save Scene File** on OpenDeck Linux. The embedded Property Inspector WebView did not reliably honor browser-style `<a download>` requests in v0.14.1.
- Scene files are now written by the native Node.js plugin process directly to the user's Linux Downloads directory. The Property Inspector reports the exact saved path after a successful write.
- Existing files are never silently overwritten. Repeated saves use `-2`, `-3`, and so on before `.weaverdeck-scene.json`.
- The portable Scene JSON format remains unchanged: `WeaverDeckScene`, `formatVersion: 1`, `sceneVersion: 1`.
- **Load Scene File** remains browser/WebView-based for now so its separate file-picker capability can be tested independently.
- Keeps the proven v0.14.1 Capture Scope bridge and Local Scene Presets behavior.
- Keeps the stable v0.11.2 Scene execution/control engine unchanged; audio control still goes exclusively through PipeWeaver.
- Keeps v0.12.2 large application artwork, dynamic titles, and optional Button Text.

## Capture Scope

Before pressing **Capture Current State**, choose any combination of Sources, Targets, Routes, Physical devices, Default devices, and Applications. When every category is selected, behavior is identical to v0.13.0. With a narrower scope, the captured Scene is filtered to only the corresponding structured operation types.

Scoped capture has been validated for Routes, Applications, Physical devices, Default devices, and mixed Sources + Targets. The all-category capture path remains available as the compatibility baseline.

## Scene files

The existing v0.13.0 portable JSON format remains unchanged:

- `format: "WeaverDeckScene"`
- `formatVersion: 1`
- `sceneVersion: 1`
- Scene name
- structured Scene operations

**Save Scene File** serializes the current Scene and sends it through the existing OpenDeck Property Inspector connection to the plugin process. The plugin writes `<scene-name>.weaverdeck-scene.json` to the Linux Downloads directory resolved from `XDG_DOWNLOAD_DIR`, `~/.config/user-dirs.dirs`, or `~/Downloads` as a fallback.

The save path is returned to the Property Inspector and displayed after the write succeeds. Existing files are preserved by choosing the next available numbered filename.

**Load Scene File** reads the same portable format and applies the existing format/version checks before replacing the current Scene. The file-picker path is intentionally kept separate from the native save path so OpenDeck WebView upload support can be tested independently.

The existing copy/paste **Export Scene JSON** and **Import Scene JSON** controls remain available in the underlying Scene Builder.

## Local Scene Presets

**Save Current as Preset** stores the current portable Scene document under a chosen name. Presets can be selected and loaded into another Scene action or deleted later.

Presets live in OpenDeck's local Property Inspector browser storage. Use Scene files or exported JSON for durable backups and sharing across systems.

## Validation and execution

Imported files and presets retain the same v0.13.0 validation/preflight behavior. Use **Validate Scene** after loading a Scene onto another configuration. Missing applications remain warnings and are skipped safely; validation errors prevent the Scene from executing.

The PipeWeaver control engine remains unchanged and audio control continues to go exclusively through PipeWeaver.

## Application artwork

Application actions retain the large dynamic Linux artwork from v0.12.x. Leaving **Button Text** blank uses the dynamic application title; setting Button Text uses the persistent custom label.

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.14.2.zip` from the v0.14.2 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Release

The v0.14.2 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`c2a682fa87980df1d15c77bf567448c78da0ccfcfe5f78c5b3bc28460852571d`
