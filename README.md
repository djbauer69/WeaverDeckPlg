# PipeWeaver Control for OpenDeck 0.14.0

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.14.0 highlights

- Adds **Capture Scope** to the Scene Builder. Sources, Targets, Routes, Physical devices, Default devices, and Applications can be included or excluded independently when using Capture Current State.
- All Capture Scope categories are enabled by default, preserving the existing full-state capture behavior.
- Adds **Download Scene File** and **Load Scene File** for portable `*.weaverdeck-scene.json` backups and sharing.
- Adds **Local Scene Presets** that can be saved, loaded, and deleted by name in OpenDeck's Property Inspector storage.
- Keeps the proven v0.13.0 Scene Builder intact inside a thin v0.14.0 Property Inspector wrapper; the stable Scene execution/control engine is unchanged.
- Keeps v0.13.0 portable JSON import/export, validation, Capture Current State semantics, application/physical-device Scene support, and route idempotency.
- Keeps v0.12.2 large application artwork, dynamic titles, and optional Button Text.

## Capture Scope

Before pressing **Capture Current State**, choose any combination of Sources, Targets, Routes, Physical devices, Default devices, and Applications. When every category is selected, behavior is identical to v0.13.0. With a narrower scope, the captured Scene is filtered to only the corresponding structured operation types.

This makes focused snapshots such as routing-only, application-only, or source-mix-only Scenes practical without manually deleting unrelated steps afterward.

## Scene files

The existing v0.13.0 JSON format remains unchanged:

- `format: "WeaverDeckScene"`
- `formatVersion: 1`
- `sceneVersion: 1`
- Scene name
- structured Scene operations

**Download Scene File** serializes the current Scene as `<scene-name>.weaverdeck-scene.json`. **Load Scene File** reads the same portable format and applies the same format/version checks before replacing the current Scene.

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

1. Download `pipeweaver-opendeck-plugin-v0.14.0.zip` from the v0.14.0 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Release

The v0.14.0 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`b10edbf5d73859aa724a5835be04ae561e61bf473bb5751f7dbcafd371627624`
