# PipeWeaver Control for OpenDeck 0.15.0

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.15.0 highlights

- Adds a **native Scene Library** shared by every WeaverDeck Scene action.
- Scene Library entries are stored outside the embedded Property Inspector browser at `~/.local/share/weaverdeck/scene-library-v1.json` by default, or under `$XDG_DATA_HOME/weaverdeck/` when configured.
- Scene Library management includes **Load, Save Current As, Update Selected, Rename, Duplicate, Delete, and Refresh**.
- Loading a library Scene copies it into the selected Stream Deck Scene action. The button therefore remains deterministic even if the library entry is edited later.
- Scene names continue to appear on the Stream Deck key. v0.15.0 also briefly flashes a success or failure marker after Scene execution without changing the stable Scene executor.
- Reduces Scene Property Inspector application polling from every 2.5 seconds to every 10 seconds, pauses it while the inspector is hidden, and refreshes when the inspector regains focus.
- Keeps v0.14.2 native Scene-file saving and WebView file loading.
- Keeps Capture Scope and browser-local presets for compatibility.
- Keeps the proven v0.11.2 Scene execution/control engine unchanged; audio control still goes exclusively through PipeWeaver.
- Keeps v0.12.x dynamic Linux application artwork and optional Button Text.

## Native Scene Library

The Scene Library is intended for reusable named configurations such as `Gaming`, `Streaming`, `Headphones`, or `Speakers`.

The default library file is:

`~/.local/share/weaverdeck/scene-library-v1.json`

If `XDG_DATA_HOME` is set, WeaverDeck uses:

`$XDG_DATA_HOME/weaverdeck/scene-library-v1.json`

The file uses a versioned WeaverDeck-specific JSON schema and is written atomically by the native Node.js plugin process.

### Scene Library workflow

1. Build or capture a Scene in any **PipeWeaver Scene** action.
2. Click **Save Current As…** and give it a library name.
3. Open another PipeWeaver Scene action and choose the same library entry.
4. Click **Load** to copy that Scene into the button.
5. Use **Update Selected**, **Rename**, **Duplicate**, or **Delete** to manage library entries.

Loading copies the Scene document into the button's own settings rather than creating a live reference. This keeps Stream Deck execution deterministic and prevents later library edits from silently changing existing buttons.

## Scene key feedback

The stable control engine already keeps the Scene name visible on the key. v0.15.0 adds an isolated visual layer that briefly shows:

- `✓` after a successful Scene execution
- `!` after a failed Scene execution

The original Scene name is restored automatically after the short feedback interval.

## Application polling cleanup

The Scene Builder previously requested live application data every 2.5 seconds while open. v0.15.0 changes that behavior to:

- refresh every 10 seconds while visible
- pause polling while the Property Inspector is hidden
- refresh immediately when the inspector becomes visible or regains focus
- retain manual **Refresh Channels / Apps** behavior

This reduces background PipeWeaver/OpenDeck traffic and makes plugin logs substantially easier to read without removing live application discovery.

## Capture Scope

Before pressing **Capture Current State**, choose any combination of Sources, Targets, Routes, Physical devices, Default devices, and Applications. When every category is selected, behavior remains compatible with the pre-scope full-capture path.

Validated capture categories include:

- Everything
- Routes only
- Applications only
- Physical devices only
- Default devices only
- Sources + Targets

## Scene files

Portable Scene files keep the existing format:

- `format: "WeaverDeckScene"`
- `formatVersion: 1`
- `sceneVersion: 1`
- Scene name
- structured Scene operations

**Save Scene File** writes directly to the user's Linux Downloads directory through the native plugin process. Existing files are preserved by allocating numbered filenames such as `Scene-2.weaverdeck-scene.json`.

**Load Scene File** uses the OpenDeck WebView file picker, which has been validated independently from the save path.

## Browser-local presets

The v0.14.x localStorage preset system remains available as **Browser-local Presets** for compatibility. The native Scene Library is preferred for durable reusable Scenes because it does not depend on embedded browser storage.

## Validation and execution

Scene validation/preflight remains unchanged. Validation errors prevent execution. Missing applications remain warnings and are skipped safely when appropriate.

The Scene execution engine remains the proven v0.11.2 control engine. v0.15.0 adds only isolated wrapper layers around it for library persistence, file I/O, and visual feedback.

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.15.0.zip` from the v0.15.0 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Release

The v0.15.0 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`f49784f72d92009ab642fba3068ee33de4d7c3679053436348ecc969e72cdfce`
