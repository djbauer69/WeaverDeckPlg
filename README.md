# PipeWeaver Control for OpenDeck 0.16.0

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

## v0.16.0 highlights — Smart Scenes

v0.16.0 adds a declarative Smart Scene layer while retaining the validated v0.15.1 Source A/B volume-link support and the existing deterministic Scene engine.

- **UI hotfix:** the Smart Scene wrapper now waits for the stable v0.15.1 Scene Builder readiness marker rather than the optional Source-link injection marker. This fixes OpenDeck Property Inspectors that remained stuck on **Loading Smart Scene controls…** even though the base Scene Builder was already working.
- **Application identity hotfix:** Smart Scene application matching normalizes Linux process names by ignoring a trailing ` (deleted)` marker. This prevents a condition captured as `brave (deleted)` from being treated as a different application after Brave restarts and PipeWeaver reports the process as `brave`.
- **Source-link editor hotfix:** Smart Scene action dropdowns include **Source Volume Link / Unlink**, and selecting it exposes the full **Sources** selector and **Link state: Linked / Unlinked** controls while retaining Smart Scene **Condition** and **On failure** controls.
- Each Scene step can run **Always**, **when an application is running**, or **when an application is not running**.
- Adds an explicit **Wait / Delay** Scene operation from 0 to 60,000 ms.
- Adds per-step **On failure** policy: **Stop Scene** (default) or **Continue Scene**.
- Conditions use application descriptors (`name`, `process`, `deviceType`) rather than transient PipeWire node IDs.
- A condition that is not met produces a logged **SKIP** and is not a Scene failure.
- A runtime command failure with **Continue Scene** proceeds to later steps, but the Scene finishes with an alert and logs **COMPLETE WITH ERRORS**.
- Validation errors still block the entire Scene before execution. Failure policy does not bypass preflight validation.
- **Capture Current State remains deterministic and unconditional**. Captured operations do not receive conditions automatically.
- Scene JSON, Scene files, browser-local presets, and the native Scene Library preserve Smart Scene fields without changing the Scene file format version.

## Smart Scene conditions

Every structured Scene operation has a **Condition** selector:

- **Always** — run the step normally. This is the default and matches pre-v0.16 behavior.
- **Application running** — run only if the configured application is currently present.
- **Application not running** — run only if the configured application is currently absent.

Application conditions store a stable descriptor containing the application's name, process, and PipeWeaver device type. They do not store the transient node ID. Linux process names are normalized for matching so a trailing ` (deleted)` marker does not break identity across application restarts.

If an application condition evaluates false at execution time, the step is skipped and the Scene continues normally. The plugin logs `SKIP condition not met` with the condition description.

## Wait / Delay

Choose **Wait / Delay** as a Scene step to pause execution before the next step.

- Minimum: `0 ms`
- Maximum: `60000 ms`
- UI step size: `50 ms`
- Default when added: `250 ms`

Waits are useful when PipeWeaver or an application needs a short settling interval between routing, mix, volume, or application operations.

## Per-step failure policy

Normal Scene operations expose an **On failure** selector:

- **Stop Scene** — default. A runtime command failure stops execution immediately and the Scene shows failure feedback.
- **Continue Scene** — log the failed step and continue with later steps. If any step failed this way, the Scene completes with an alert rather than a success tick.

This applies only to runtime execution failures. Scene validation remains all-or-nothing and runs before any operation is changed.

## Example Smart Scene

A Scene can express logic such as:

```text
1. If Brave is running:
     Route Brave → Browser
2. Wait 250 ms
3. Set Browser A volume → 80%
4. If Discord is not running:
     Mute Voice B
```

The implementation is intentionally declarative. WeaverDeck does not execute arbitrary JavaScript from Scene files.

## Source Volume Link Toggle

v0.15.1 Source A/B linking remains available unchanged.

Add **Source Volume Link Toggle** to an OpenDeck key and choose a PipeWeaver Source. The key displays the Source and live **LINKED / UNLINKED** state.

When linked, PipeWeaver preserves its native A:B volume ratio. Existing Source A/B Volume Up/Down and Set Volume actions continue sending their normal commands; PipeWeaver applies linked behavior itself.

## Source link state in Scenes

Scene Builder includes **Source Volume Link / Unlink** and Capture Current State records link state when Sources are included. Scene steps deliberately set **Linked** or **Unlinked** rather than toggling, so repeated Scene execution remains idempotent and deterministic.

Selecting **Source Volume Link / Unlink** in Scene Builder exposes:

- **Sources** — one or more PipeWeaver Sources
- **Link state** — **Linked** or **Unlinked**
- **Condition** — Smart Scene condition
- **On failure** — **Stop Scene** or **Continue Scene**

For deterministic restoration, captured Scenes:

1. unlink known Sources,
2. restore A and B volumes independently,
3. re-link the Sources that were linked when captured.

This behavior is preserved in v0.16.0 and can itself be combined with Smart Scene conditions when configured manually.

## Capture Current State

Capture Scope categories remain:

- Sources + link state
- Targets
- Routes
- Physical devices
- Default devices
- Applications

Capture continues to represent the current PipeWeaver state deterministically. It does **not** infer conditions, waits, or failure policy; those are added manually where desired.

## Native Scene Library

The shared Scene Library remains stored outside the embedded Property Inspector browser.

Default location:

`~/.local/share/weaverdeck/scene-library-v1.json`

With `XDG_DATA_HOME` configured:

`$XDG_DATA_HOME/weaverdeck/scene-library-v1.json`

Library management includes **Load, Save Current As, Update Selected, Rename, Duplicate, Delete, and Refresh**. Loading copies a Scene into the selected button rather than creating a live reference.

## Scene files and presets

Portable Scene files retain:

- `format: "WeaverDeckScene"`
- `formatVersion: 1`
- `sceneVersion: 1`
- Scene name
- structured operations

Smart fields such as `condition`, `milliseconds`, and `onFailure` live inside operations and are preserved by export/import, native Scene files, the Scene Library, and browser-local presets.

## Scene feedback and logging

Scene key feedback remains:

- `✓` after a fully successful Scene
- `!` after a stopped Scene or a Scene that completed with continued runtime failures

v0.16.0 adds explicit logging for:

- condition evaluation skips
- Wait steps and elapsed time
- continued failures
- `COMPLETE WITH ERRORS`

## Application polling

The v0.15 polling cleanup remains:

- refresh live applications every 10 seconds while the Scene Property Inspector is visible
- pause polling while hidden
- refresh immediately when visible or focused
- retain manual **Refresh Channels / Apps**

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.16.0.zip` from the v0.16.0 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

## Validation and runtime testing

v0.16.0 has completed package checks and real OpenDeck/PipeWeaver runtime validation.

Validated areas include:

- JavaScript syntax across the plugin entrypoint and Smart Scene runtime extension
- Property Inspector injected-script syntax
- manifest JSON validity and ZIP integrity
- Smart Scene Property Inspector readiness
- application-running conditions with the application present and absent
- application-not-running conditions with the application present and absent
- condition `SKIP` behaviour
- Linux application identity normalization for `process` values with/without trailing ` (deleted)`
- Wait / Delay execution and timing
- Source Volume Link / Unlink dropdown, source selector, Linked/Unlinked state editor, validation and repeated execution
- Stop Scene runtime failure policy: later steps do not run
- Continue Scene runtime failure policy: later steps run and the Scene logs `COMPLETE WITH ERRORS`
- malformed condition / wait / failure-policy validation
- v0.15.1 Source Volume Link Scene capture/restore regression

**v0.16.0 is runtime-validated and considered stable.**

## Release

The v0.16.0 stable ZIP SHA-256 is:

`d45d8fd156b36802785d010dc25b2cfb86e8612c86ab42af98f00767ad9db593`
