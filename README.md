# PipeWeaver Control for OpenDeck — WeaverDeck v0.22.0

## Unified Scene Library

**Scene Library** is the single shared collection for reusable Scenes, with
save, update, rename, duplicate and delete controls. **Scene Files** remains the
import/export option for backups, sharing and startup loading. Loading a Scene
copies it into the selected button; later edits do not automatically update the
library or exported files.

Saved Presets are automatically imported into Scene Library on first use. If a
library entry and preset have the same name but different content, both are kept
and the incoming entry gets a suffix such as `(Preset)` or `(Preset 2)`.
Identical entries are not duplicated. Migration history prevents renamed or
deleted imports from reappearing on later launches. The old preset file is kept
intact as a backup. Any still-accessible browser presets are imported too, and
browser storage is cleared only after the plugin confirms a successful import.

Scene Library lives in `$XDG_DATA_HOME/weaverdeck/scene-library-v1.json` (normally
`~/.local/share/weaverdeck/scene-library-v1.json`). Saving a Scene File uses the
selected library entry's name, falling back to the current Scene name. Existing
Scene files and startup paths continue to work.

Action inspectors now load directly in OpenDeck instead of inside the common
iframe whose default height is 150 px. The shared action header, Button Text and
compact styling are applied to each editor in place. Existing OpenDeck profiles
using the old inspector path navigate automatically to the matching editor
without changing saved button settings. Scene retains its two internal editor
layers, sized to their content with compositing enabled. The user confirmed that
this direct-editor change fixes the recurring inspector clipping.

Physical Input/Output fades now wait up to 1000 ms for feedback after each accepted
volume command before sending the next step. This addresses early confirmation
failures seen with the C922 and Volt 2 inputs. Commands are never resent; timeout
errors include requested and reported percentages. Slow device feedback can
extend a fade's duration. The C922 and Volt 2 inputs now pass the user's 1500 ms
and 200 ms tests, including simultaneous fades on the two devices.
See [the current runtime test record](releases/v0.22.0-testing.md).

## Core consolidation

The complete v0.22.0 runtime now lives in `plugin-core.js`, which `plugin.js`
loads directly after installing the presentation and Scene adapters. The twelve
historical `core-v*.js` patch files have been removed; Git retains their history.
The existing feature modules remain separate.

The consolidated core is byte-for-byte identical to the final runtime produced
by the old patch chain. The core consolidation itself leaves action identifiers, saved settings, Scene formats and
UI files unchanged. Tests now load the consolidated core directly, and a startup test exercises the real entry point with simulated OpenDeck and PipeWeaver connections. Historical
internal names and diagnostic labels are retained to keep this refactor mechanical.

## v0.22.0: Hold-repeat volume buttons and millisecond fades

All **Volume Up** and **Volume Down** keypad actions can now repeat while held.
This covers Application, Source, fixed Source A/B, Target, Physical Input, and
Physical Output volume buttons. Each action keeps its existing Step % setting and
adds **Hold ms** (50-2000 ms, default 200) to control repeat speed. A quick press
still applies one step. Releasing the key, changing settings, removing the
button, or disconnecting OpenDeck stops the held repeat. Set Volume remains an
exact one-shot action. Volume Up/Down inside Multi Actions also apply just one step.

Standalone **Volume Fade** actions and Smart Scene **Volume Fade** steps now use
milliseconds instead of seconds. The UI writes `milliseconds` values from
0-120000, with a default of 3000. Older saved Scene files or settings containing
`seconds` still validate and run through a compatibility fallback.

The common action inspector is less crowded: Button Text mode/manual input now
lives inside the scrollable action settings, the fixed header shows the selected
action name, and compact rows let dropdown-heavy actions place controls side by
side when the inspector is wide enough. Numeric inputs share a dedicated row below the dropdown controls, wrapping only when the inspector is too narrow. Fade inspectors use the same dark background as other actions. The inspector content uses a shrinkable, scrollable viewport so controls remain reachable when opening from an empty key or a small inspector pane. Nested Scene frames resize to their content, growing and shrinking as steps change; the main inspector handles page scrolling without fixed-height blank space. Dropdowns use a dark grey background with white text, and header help text and control descriptions are hidden to save space.

**71 automated tests pass**, covering hold-repeat start/stop behavior, millisecond
fade validation/execution, Smart Scene fade editor round trips, common Button Text
injection, live volume badges, startup Scenes, source mute destinations,
application identity matching, packaging compilation, and existing regressions.

First checks:
1. Hold Target Volume Up/Down and confirm it repeats at the configured **Hold ms**,
   then stops as soon as you release.
2. Repeat with Application, Source, Source A/B, Physical Input, and Physical
   Output volume buttons.
3. Create a fade for 250 ms, 1000 ms, and 3000 ms; confirm the label and Scene
   summary show milliseconds.
4. Open several action settings, especially Scene, and confirm the action name is
   in the fixed header while Button Text appears in the scrollable settings.

## v0.21.0: Volume fades

Adds **Application Volume Fade**, **Source Volume Fade**, **Target Volume Fade**,
**Physical Input Volume Fade**, and **Physical Output Volume Fade** buttons.
Select a device/application, destination volume (0–100%), and duration
(0–120 seconds; default 3). Zero seconds applies immediately. Mute is unchanged.
Buttons retain Dynamic Text / Manual Input and show the current volume badge.

Smart Scenes gain a **Volume Fade** step covering the same five control types.
Each step fades one selection and waits for completion before the next step.
Conditions, Stop/Continue failure policy, saved Scene files, and startup Scenes
are supported. Use Smart Scenes for sequencing fades; fade buttons are excluded
from native OpenDeck Multi Actions, which cannot await plugin completion.

Fades interpolate the volume percentage linearly with at most one update per
100ms per fade. HTTP latency may extend the nominal duration; this is not a
sample-accurate audio envelope. The final target is checked against PipeWeaver.
Source A/B follows PipeWeaver's existing volume-link setting. Only one fade per
source runs at a time, even when its mixes are unlinked.

A new fade on the same resource supersedes the previous fade. A direct WeaverDeck
volume command cancels the fade and waits for any already-sent fade command before
applying its adjustment. A detected external volume change (over 1 percentage
point), missing device/application, identity change, or OpenDeck disconnect stops
the fade. Uncertain commands are not retried. A fade does not resume automatically
after reconnect. Removing a button or changing deck pages does not itself cancel
an already-started fade; use a volume adjustment to take over.

**42 automated tests pass**, including the new engine, interruption handling,
Scene validation/execution, editor import/export, and existing regressions.
OpenDeck/PipeWeaver runtime validation of v0.21.0 remains pending.
Dial/display features are retained from v0.20.0 and still **not hardware verified**;
the user has no dial hardware available. See [compatibility](docs/COMPATIBILITY.md).

First checks on the existing XL:
1. Add Target Volume Fade, select a target, choose 20% over 3 seconds, and press.
   Confirm the slider fades and the button badge follows; then fade back up.
2. During a fade, use an existing Volume Up/Down/Set button. The fade should stop.
3. Repeat with Brave and Source A/B; account for Source Link if enabled.
4. In a Smart Scene, add Volume Fade then a mute/routing step. Confirm the second
   step starts after the fade finishes. Export/import the Scene and recheck it.
5. Check physical-device fades, manual labels, and persistence after restart.

Other suggested features (hold controls, Scene status/restore, startup file picker)
remain future work; this release focuses on volume fades.


## v0.20.0: Volume dials and touch-strip feedback

Adds five Encoder actions: **Application Volume Dial**, **Source Volume Dial**,
**Target Volume Dial**, **Physical Input Volume Dial**, and **Physical Output
Volume Dial**. Drag one onto a dial in OpenDeck and select its device/application.

- Turn clockwise/counter-clockwise to adjust volume by Step % per tick (default 5).
- Press the dial or briefly tap its strip segment to toggle mute. Release does
  not toggle again; long touch is ignored. No held-turn modifier is implemented.
- The strip shows Dynamic Text or Manual Input, the live percentage, a volume
  bar, and Live/MUTED/Unavailable state. Strip labels use one line.
- Source dials select A or B and respect PipeWeaver's existing volume-link state.
- Application dials reuse resilient identity matching; ambiguous matches fail safely.
- Rapid same-direction ticks are combined and all dial changes run in order.
  Pending input expires after two seconds, is bounded to 64 queued groups, and
  is cancelled on reassignment/disappearance/disconnect. Commands with uncertain
  acknowledgement are not retried. An already-sent command cannot be undone by
  removing a dial.
- All 47 existing button actions and Smart Scene/startup behavior are retained.
  New actions remain grouped by function and sorted alphabetically.

Implemented against OpenDeck 2.14.0's Encoder and touch-strip interface. **Real
Stream Deck +/+ XL hardware testing is pending.** Neo infobar support is separate
and is not implemented in this release. Other suggested features, including
volume fades, remain deferred.

**33 automated tests pass.** See the [compatibility matrix and hardware test
steps](docs/COMPATIBILITY.md) for device/distribution status, prerequisites, test
coverage, and the distinction between implemented and hardware-verified support.



## v0.19.1: Button text and volume badges

Every action now has a **Button Text** selector with **Dynamic Text** and
**Manual Input**. Dynamic Text keeps the action's live status title. Manual Input
uses your label (including line breaks); a blank manual label hides the title.
Existing custom Application labels are retained as Manual Input on upgrade.
Switching back to Dynamic Text retains the manual label for later use.

All existing Volume Down, Volume Up, and Set Volume actions display the current
volume percentage at the bottom right, independently of the text mode.
Application artwork retains its existing badge. Sources follow their selected
mix (fixed A/B actions keep their fixed mix), targets show actual current volume,
and physical input/output buttons follow the configured device. Set Volume shows
the live volume, not merely the configured setpoint. Unavailable non-application
volume readings show `?`; unavailable applications retain their existing offline
artwork behavior. The new non-application badges reuse the core status refresh.

The common inspector preserves each action's existing controls and Scene editor
bridges. Action UUIDs, functional grouping, and alphabetical order are unchanged.

Validation: 23 automated tests pass, including text policies for all actions,
nested inspector settings preservation, badge values/mixes/offline handling,
composed core compilation, and existing Smart Scene/startup regressions.
ZIP integrity, packaged source bytes, manifest references, and executable modes
are checked during packaging. Hardware validation of v0.19.1 remains pending.

Suggested OpenDeck checks:
1. Set a Source, Target, Physical Input, and Physical Output volume button to
   Manual Input; change volume and confirm only its percentage changes.
2. Check Source A/B independently, and change a Set Volume target externally:
   its badge should track the current volume before the key is pressed.
3. Switch a button back to Dynamic Text; confirm live titles return.
4. Give a Scene, Scene Startup, mute, route, and audio action manual labels.
   Save their settings and restart OpenDeck; labels and existing actions should
   remain intact. Check that an existing custom Application label is preserved.


## v0.19.0: Startup Scene

A new **Scene Startup** action configures one local Scene file to execute after
OpenDeck connects and PipeWeaver responds successfully. It is disabled by default.

1. Add Scene Startup to a deck key and open its settings.
2. Enter the absolute path of a saved .weaverdeck-scene.json file, or use
   `~/Downloads/Your-Scene.weaverdeck-scene.json`.
3. Use **Check file** to validate it against PipeWeaver without applying anything.
4. Enable **Run saved Scene at startup**, choose a settle delay (default 2 seconds),
   and press **Save startup settings**.
5. Restart OpenDeck to test automatic execution. Press the deck key to run the saved
   file manually, including when automatic startup is disabled.

The setting is shared across all Scene Startup keys and stored natively under
`$XDG_DATA_HOME/weaverdeck/startup-scene-v1.json`, defaulting to
`~/.local/share/weaverdeck/startup-scene-v1.json`. It is independent of the active
deck page and survives plugin-folder replacement. The local file is read at each
launch; moving/deleting it causes a logged failure. No file contents are cached
as a substitute.

The controller waits for two successful PipeWeaver status responses, applies the
settle delay (0–60 seconds), then checks readiness again before running the Scene.
If PipeWeaver starts later, it keeps waiting. Saving disabled cancels a pending
run; saving enabled applies to the next launch, rather than executing immediately.

Execution occurs once per plugin process launch, which normally accompanies
OpenDeck startup. Reloading/restarting the plugin can also trigger it. Ordinary
OpenDeck socket reconnects or PipeWeaver restarts within that process do not replay
the startup Scene. A failed/partly executed Scene is not automatically retried.
Manual execution cancels a pending automatic run to avoid duplicate application.

Uses the existing Scene preflight validation, conditions and Stop/Continue failure
policies. Check file never applies audio changes. Engine readiness does not imply
that every application has an active stream: absent application operations retain
their normal skip behaviour. Engine-restart steps can require manually resuming
playback, as observed with Brave. Startup does not control application playback.

Diagnostics use `[Startup Scene]` plus the normal `[Scene]` execution records.

Validation: all 18 automated tests pass, including delayed readiness, readiness
loss during settling, reconnect suppression, disabling, missing/invalid files,
current-file reads, manual runs, and accurate runner success/failure reporting.
All JS/inline scripts compile. The ZIP is verified byte-for-byte against package
source with executable modes preserved. Live OpenDeck startup testing is pending.

v0.19.0 ZIP SHA-256:
`61ebdc0c6efcc748e92a1e1e3a9f72a5f304073628e3e7cd7d3f036812e9df70`

Run checks with `node --test tests/*.test.js`; build with
`python3 tools/build-release.py`.


## v0.18.1: Scene file names

Save Scene File now uses the currently selected Browser-local Preset name for
both the filename and exported Scene name. It saves the current Scene contents.
With no valid preset selected, it falls back to the Scene name. Filename
sanitization and numbered suffixes for existing files remain unchanged.

Verified preset selection and fallback cases; all nine existing automated tests
pass. This small fix is pending confirmation in OpenDeck.

v0.18.1 ZIP SHA-256:
`b676d23d7fd83314b6269708690fd90b8e4f335f5bc646c1fc8c7c46a7c778b2`

The v0.18.0 feature and testing notes below remain applicable.


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
