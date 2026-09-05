# PipeWeaver Control for OpenDeck — v0.18.0 prerelease

Linux OpenDeck plugin controlling **PipeWeaver only**, through its HTTP API at
`http://127.0.0.1:14565/api/command`. No direct PipeWire, PulseAudio, system service,
`pactl`, or `wpctl` commands are used.

## New button actions

- **Audio Buffer Size** — select PipeWire configured/default or an explicit sample count.
- **Audio Engine Restart** — invoke PipeWeaver’s Restart Audio Engine operation.
- **Source Mute To Add / All / Remove / Set / Toggle** — configure the destination
  dropdown for a source’s A or B mute slot.

Mute To changes the destination selection; it does not activate source mute.
Set replaces the selection with one target. Add, Remove and Toggle match membership
in PipeWeaver’s dropdown. All clears the selection, which PipeWeaver represents as
Mute to All. Removing the final selected destination also restores All.
**PipeWeaver may unmute the affected slot when changing its destinations.** This
matches PipeWeaver’s UI behaviour. Use a Source Mute button or a later Scene mute
step when you want the source muted after changing its destination selection.

The destination list contains configured PipeWeaver targets, including configured
physical targets. It excludes unrelated raw hardware devices.

## Smart Scenes

New step types:

- **Audio Buffer Size**
- **Audio Engine Restart**
- **Source Mute To Destinations** — select one or more sources, mute slot A/B,
  and Set/Add/Remove selected targets or Mute to All. Set supports multiple targets.

All new steps retain Always / Application running / Application not running
conditions and Stop Scene / Continue Scene failure policy. Scene JSON, native
Scene files and Scene Library preserve the new steps. Capture Current State
retains its existing scope; it does not automatically add engine restarts or
capture the new buffer/destination settings.

Example: Source Mute To Destinations (Browser, A, Set Headphones), then Source
Mute (Browser, A, Muted). Existing source mute steps use the configured destinations.

## Engine behaviour

Runtime testing confirmed that Brave may pause after an engine restart or buffer
change. Clicking Play restores audio immediately. Engine recovery does not mean
application playback resumes automatically. Missing application streams can still
cause Scene application steps to be skipped under the existing behaviour.

Restart and buffer changes briefly interrupt audio. The plugin sends the daemon
command once, then polls for recovery for approximately 30 seconds, requiring two
successful status responses. Buffer changes additionally verify the selected
setting before reporting success. A current-value buffer selection is a no-op.
The next Scene step waits for recovery; a timeout follows the configured failure
policy. A transport failure while sending a restart is reported without blindly
retrying a command that may already have been accepted.

Restart uses PipeWeaver’s API, so it requires the daemon/API to accept requests.
It cannot recover a stopped daemon or bypass PipeWeaver’s HTTP 503 manager guard.
Scenes retain preflight validation before changes, so an unavailable initial
status still prevents Scene execution.

Supported buffer sizes (samples): 8, 16, 32, 64, 128, 256, 512, 768, 1024, 1280,
1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096, or PipeWire configured.

## Existing functionality

Resilient application matching from v0.17 is retained across direct actions,
artwork, Scene application steps and conditions. It normalizes trailing
` (deleted)` markers and executable basenames, accepts unambiguous name/process
fallback, rejects ambiguous matches, and preserves configured offline applications.
Application discovery retains its 3.5-second status cache.

Concurrent status refresh callers now await the same pending request instead of
receiving an old/null snapshot. This addresses a possible source of first-press
recovery failures; the previously observed intermittent Mute double-press has not
been conclusively diagnosed.

Source A/B controls, Source Link, Smart Scene delays and failure policies, Scene
Library, native Scene files, capture, and prior application/device/routing controls
remain. Existing action UUIDs are preserved. Action names and Scene operation
choices are alphabetized by function; names such as Route Toggle, Target Set
Volume, and Target Mix Toggle keep related actions together.

## Install and test

1. Back up your OpenDeck profile and current plugin folder; fully quit OpenDeck.
2. Move the old `com.pipeweaver.opendeck.sdPlugin` outside the plugins directory.
3. Extract the v0.18.0 ZIP into the plugins directory. On the tested installation:
   `~/.config/opendeck/plugins/`.
4. Restart OpenDeck with PipeWeaver running; confirm `[v0.18.0]` in the plugin log.

Requires an OpenDeck-compatible Node runtime with global WebSocket support and
PipeWeaver commands listed below. Runtime-tested v0.17 was used on OpenDeck 2.14.x.
v0.18 is a **prerelease with its principal new controls runtime-tested**.
See [the runtime test record](releases/v0.18.0.md) for passed checks, log evidence,
playback behaviour, and remaining tests.

Start with an unmuted source. Test Mute To Set on slot B with one target, compare
PipeWeaver’s dropdown, then test Toggle and All. Test slot A separately. Build a
Scene setting destinations followed by Source Mute, and verify only the selected
destinations are affected according to PipeWeaver’s native mute semantics.

Record the existing buffer setting; try 512 samples, confirm PipeWeaver’s setting,
then restore the original. Test Restart separately. Finally run a Scene containing
Restart followed by a normal source/application operation and confirm recovery
before the second step. Retest existing controls and an idle period afterward.

## Verification and reproducible build

```bash
node --test tests/features-v018.test.js
python3 tools/build-release.py
```

Tests cover exact API envelopes, mute-slot isolation and idempotence, missing
selections, buffer enum validation, transient engine failures, recovery timeout,
no duplicate restart after an uncertain acknowledgement, composed core compilation,
application identity regression, shared status requests, manifest paths/order,
and Scene editor script integration/import-export. Editor integration is exercised
with a DOM test harness. Subsequent live tests exercised the new Scene controls;
see the runtime test record for the precise coverage.

The build script writes sorted ZIP entries with fixed timestamps and explicit
file modes and verifies every entry against the source. This avoids the earlier
v0.17 source/package mismatch.

## API references

Verified against PipeWeaver commit `23e90c3c0d5d2dd3f761c259a8a16ad106009361`:

- [Command schema](https://github.com/pipeweaver/pipeweaver/blob/23e90c3c0d5d2dd3f761c259a8a16ad106009361/ipc/src/commands/mod.rs)
- [Settings UI](https://github.com/pipeweaver/pipeweaver/blob/23e90c3c0d5d2dd3f761c259a8a16ad106009361/web/src/views/Settings.vue)
- [Mute destination UI](https://github.com/pipeweaver/pipeweaver/blob/23e90c3c0d5d2dd3f761c259a8a16ad106009361/web/src/views/desktop/channels/MuteTargetSelector.vue)
- [Mute destination side effects](https://github.com/pipeweaver/pipeweaver/blob/23e90c3c0d5d2dd3f761c259a8a16ad106009361/daemon/src/handler/pipewire/components/mute.rs)

Envelopes: `{"Daemon":"ResetAudio"}`, `{"Daemon":{"SetAudioQuantum":"Quantum512"}}`,
`{"Daemon":{"SetAudioQuantum":null}}`, and `{"Pipewire":{"AddMuteTargetNode":[sourceId,"TargetB",targetId]}}`
(with corresponding DelMuteTargetNode and ClearMuteTargetNodes commands).

v0.18.0 install ZIP SHA-256:

`a9007120acddad56a51f88443c8d8f758f7edc8e6110676a1be1d44067895827`
