# PipeWeaver Control for OpenDeck 0.15.1

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.15.1 highlights

- Adds **Source Volume Link Toggle**, a dedicated OpenDeck action for PipeWeaver Source A/B volume linking.
- The key shows the selected Source and live **LINKED / UNLINKED** state.
- Linking uses PipeWeaver's native `SetSourceVolumeLinked` API and preserves PipeWeaver's current A/B ratio semantics.
- Existing **Source A/B Volume Up/Down** and **Source Set Volume** actions are unchanged. When a Source is linked, PipeWeaver itself applies the linked A/B behavior.
- Adds a structured Scene operation: **Source Volume Link / Unlink**.
- **Capture Current State** now records Source volume-link state as part of the Sources capture category.
- Captured Scenes temporarily unlink known Source pairs before restoring independent A/B volumes, then reapply the captured linked state. This prevents a pre-existing link ratio from corrupting deterministic A/B volume restoration.
- Retains the v0.15.0 native Scene Library, Scene execution tick/failure feedback, quieter application polling, Capture Scope, portable Scene files, and browser-local presets.

## Source Volume Link Toggle

Add **Source Volume Link Toggle** to an OpenDeck key and choose a PipeWeaver Source in the Property Inspector.

The button state is:

- **UNLINKED** — A and B volume sliders are independent.
- **LINKED** — PipeWeaver stores the current B:A volume ratio and applies that ratio when either A or B is changed.

Pressing the key toggles between the two states.

The existing A/B volume actions continue sending the same `SetSourceVolume` commands as before. WeaverDeck does not duplicate or override PipeWeaver's link mathematics; PipeWeaver remains responsible for moving the paired channel while linked.

## Source link state in Scenes

Scene Builder now includes **Source Volume Link / Unlink**. Select one or more Sources and choose **Linked** or **Unlinked**.

Scene validation checks that every referenced Source exists and that the link state is valid before execution.

### Deterministic capture behavior

When **Sources** is included in Capture Scope, Capture Current State records:

- Source A mute
- Source B mute
- Source A volume
- Source B volume
- Source A/B volume-link state

For deterministic volume restoration, a captured Scene intentionally inserts an **Unlink** operation before the Source volume operations. After the A/B values have been restored independently, it adds a final **Linked** operation for every Source that was linked at capture time. Sources captured as unlinked remain unlinked.

This affects captured Scene ordering only. Normal Source volume buttons continue to follow PipeWeaver's live linked/unlinked behavior.

## Native Scene Library

The Scene Library remains shared by every WeaverDeck Scene action and is stored outside the embedded Property Inspector browser.

Default location:

`~/.local/share/weaverdeck/scene-library-v1.json`

With `XDG_DATA_HOME` configured:

`$XDG_DATA_HOME/weaverdeck/scene-library-v1.json`

Library management includes **Load, Save Current As, Update Selected, Rename, Duplicate, Delete, and Refresh**.

Loading copies a Scene into the selected Stream Deck action rather than creating a live reference, keeping Scene execution deterministic.

## Scene key feedback

Scene names remain visible on the key. After execution WeaverDeck briefly shows:

- `✓` after success
- `!` after failure

The original Scene name is restored automatically.

## Capture Scope

Before pressing **Capture Current State**, choose any combination of:

- Sources — now includes Source A/B link state
- Targets
- Routes
- Physical devices
- Default devices
- Applications

When every category is selected, the complete current state is captured.

## Scene files

Portable Scene files retain the existing WeaverDeck Scene format:

- `format: "WeaverDeckScene"`
- `formatVersion: 1`
- `sceneVersion: 1`
- Scene name
- structured Scene operations, including `sourceVolumeLink` in v0.15.1+

**Save Scene File** writes natively to the Linux Downloads directory and preserves existing files with numbered names such as `Scene-2.weaverdeck-scene.json`.

**Load Scene File** uses the OpenDeck WebView file picker.

## Application polling

Scene Builder continues the v0.15.0 polling cleanup:

- refresh live applications every 10 seconds while visible
- pause while the Property Inspector is hidden
- refresh immediately when visible or focused again
- retain manual **Refresh Channels / Apps**

## Validation and execution

Scene validation/preflight remains mandatory before execution. Validation errors prevent execution. Missing applications remain warnings and are skipped safely when appropriate.

v0.15.1 extends the existing PipeWeaver control engine only where required for Source volume-link state. Existing Source A/B volume action behavior is unchanged.

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.15.1.zip` from the v0.15.1 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Release

The v0.15.1 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`08c09702e1ba8f1213b96f3510452bdae1cab593873aabd888cd062f8cb283e2`
