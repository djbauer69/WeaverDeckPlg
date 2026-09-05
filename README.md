# PipeWeaver Control for OpenDeck 0.17.0

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.17.0 highlights — resilient applications

v0.17.0 builds on the runtime-validated v0.16.0 Smart Scene release and focuses on application identity, transient application handling, and reducing redundant discovery traffic.

- **Resilient application identity** is now shared across direct Application actions, application artwork, Smart Scene application steps, and Smart Scene conditions.
- Linux process names are normalized by removing a trailing ` (deleted)` marker and by comparing executable basenames when a full path is reported.
- Exact `name + process + deviceType` remains the strongest match.
- If one part changes after an application restart, WeaverDeck can fall back to an unambiguous same-process or same-name match.
- Ambiguous fallback matches are deliberately rejected instead of controlling an arbitrary application.
- Direct Application Property Inspectors now preserve the configured application when it is not currently running instead of silently clearing the selection.
- Application settings now retain `deviceType` where available, improving playback/capture disambiguation while remaining backward-compatible with older saved buttons.
- Scene application selectors also preserve configured-but-not-running descriptors.
- Repeated `getApplications` requests from Property Inspectors use the plugin's recent status snapshot for up to 3.5 seconds. This allows the core 3-second status refresh to service bursts from multiple Scene Property Inspectors without issuing redundant PipeWeaver status requests.
- Existing Smart Scene conditions, Wait / Delay, failure policy, Source Volume Link / Unlink, Scene Library, Scene files, Capture Scope, application artwork, and PipeWeaver-only control semantics are retained.

## Application identity resolution

A saved application descriptor uses:

- `name`
- `process`
- `deviceType` when available (`Source` for playback, `Target` for capture)

Matching is scored in this order:

1. exact normalized name + process + compatible device type,
2. exact normalized process + compatible device type,
3. exact normalized name + compatible device type.

Fallback is accepted only when the best-scoring live candidates resolve to one logical application identity. Multiple PipeWire nodes belonging to that same logical identity are not treated as ambiguous.

This means a saved `Brave / brave (deleted) / Source` descriptor can match a later `Brave / brave / Source` instance, while two unrelated same-name applications with different processes will not be chosen arbitrarily.

## Transient / disappearing applications

Application buttons and Scene steps keep their saved descriptor even when the application disappears.

- Direct Application Property Inspectors show the saved selection as **Configured … — not running** when it is absent.
- Smart Scene application selectors preserve the configured descriptor the same way.
- Direct key presses still alert when no unambiguous live application can be resolved.
- Scene application operations keep the existing v0.16 behaviour: a missing application is skipped rather than turning a transient disappearance into a Scene failure.
- Application-running / application-not-running conditions use the same resilient identity resolver.

## Cached application discovery

The core already refreshes PipeWeaver status every 3 seconds. v0.17.0 records the timestamp of that shared status snapshot.

`getApplications` Property Inspector requests reuse a snapshot that is at most 3.5 seconds old. This is intended to reduce duplicate `GetStatus` calls when several Scene Property Inspectors refresh applications close together while still keeping discovery responsive.

Commands that require a deliberately fresh preflight snapshot, such as Scene validation, Capture Current State, channel/device discovery, and runtime actions, continue to refresh PipeWeaver directly as before.

## Smart Scenes

The v0.16.0 Smart Scene feature set remains available:

- per-step **Always**, **Application running**, and **Application not running** conditions
- **Wait / Delay** from 0 to 60,000 ms
- per-step **Stop Scene** / **Continue Scene** runtime failure policy
- logged condition `SKIP`
- `COMPLETE WITH ERRORS` when failures are continued
- Source Volume Link / Unlink with deterministic Linked / Unlinked state
- deterministic Capture Current State
- Scene JSON import/export
- native Scene files
- browser-local presets
- native Scene Library

## Source Volume Link Toggle

The standalone **Source Volume Link Toggle** action remains unchanged. PipeWeaver owns the A:B ratio semantics when a source is linked.

Scene Builder uses deterministic **Source Volume Link / Unlink** steps rather than toggles so repeated Scene execution stays idempotent.

## Native Scene Library

Default location:

`~/.local/share/weaverdeck/scene-library-v1.json`

With `XDG_DATA_HOME` configured:

`$XDG_DATA_HOME/weaverdeck/scene-library-v1.json`

Library management includes Load, Save Current As, Update Selected, Rename, Duplicate, Delete, and Refresh.

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.17.0.zip` from the v0.17.0 GitHub prerelease.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Pre-release validation performed

The v0.17.0 candidate has passed local/package validation for:

- JavaScript syntax for the plugin entrypoint, application visuals, v0.17 runtime patch, shared application identity helper, and Smart Scene v0.17 wrapper
- manifest JSON validity
- guarded v0.17 core patch compilation against the stable `plugin-core.js`
- patched-core verification for direct Application Volume/Mute resolver use, Smart Scene resolver use, condition resolver use, and cached `getApplications` handling
- direct Property Inspector inline-script syntax
- Smart Scene injected-script syntax
- exact application identity matching
- `brave (deleted)` → `brave` normalization
- executable path basename normalization
- unambiguous process-change fallback
- unambiguous name-change fallback
- device-type mismatch rejection
- ambiguous same-name fallback rejection
- multiple-node same-logical-application handling
- configured-but-not-running UI preservation in direct Application and Scene selectors
- ZIP integrity and executable plugin entrypoint mode

Real OpenDeck/PipeWeaver runtime testing is still required before v0.17.0 should be promoted from prerelease to stable.

## Release

The v0.17.0 prerelease ZIP SHA-256 is:

`57a8810ad8a6761ad59b106e5bab39a2f9b324bca798b950bc9ad54d49877102`
