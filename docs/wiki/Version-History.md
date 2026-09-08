# Version History

This is the historical change record for WeaverDeck. The earlier release-page cleanup retained **v0.22.0**; older changes remain documented here and in Git history. Removing download entries does not remove features from the current plugin.

Entries below are reconstructed from repository commits, versioned READMEs, release notes and recorded user testing. Some early development builds were not individually committed or released. Missing numbers are not invented. The [original release metadata and notes](https://github.com/djbauer69/WeaverDeckPlg/blob/main/docs/history/releases-before-cleanup.json) preserve the published record before cleanup, including checksums and contemporary testing caveats. Those historical caveats are not the current release status.

## v0.24.0 — Scene preview

Adds read-only Preview Scene beside Validate Scene, with per-step before/after values, condition outcomes, missing/ambiguous selections and provisional results after timed/engine steps. Earlier direct state changes are projected forward. No audio commands or engine operations are executed by preview. Request correlation and invalidation prevent stale Scene results.

Validation: 100 Node tests and 15 Python tests pass, including a fixture derived from the user's 38-step Default Scene. The user confirmed all 38 preview steps, unchanged audio and the immediate stale-preview notice after the follow-up fix. See the [test record](https://github.com/djbauer69/WeaverDeckPlg/blob/main/releases/v0.24.0-testing.md).

## v0.23.0 — grouped actions and device icons

- Consolidate 51 sidebar entries into six grouped actions, retaining all operations and six separate utilities. The resulting sidebar has 12 alphabetical entries.
- Replace the grouped inspector's fixed heading with an operation dropdown. Keep shared application/device choices, numeric settings and manual text across switches.
- Add six Physical Input and four Physical Output icon choices, plus Default, with live volume/mute feedback.
- Include an offline installer that backs up and migrates saved profile identifiers before installing the compact manifest. This is required because current OpenDeck does not hide legacy entries using `VisibleInActionsList` and can discard missing action identifiers.
- Preserve hold repeat, millisecond fades, Scene behavior and inspector redraw fixes. Fade selections remain excluded from native Multi Actions.

Validation: 89 Node tests and 15 Python tests pass. The user confirmed all requested grouped-action runtime checks on 7 September 2026. See the [test record](https://github.com/djbauer69/WeaverDeckPlg/blob/main/releases/v0.23.0-testing.md).

## v0.22.0 — hold repeat, millisecond fades and inspector/storage fixes

- Configurable Hold ms (50–2000, default 200) on all button Volume Up/Down actions, retaining Step % and one-step taps. Release, reassignment/removal and disconnect stop repeat; native Multi Actions remain one-shot.
- Standalone and Smart Scene fades accept 0–120000 milliseconds. Older saved second-based durations remain compatible.
- Compact dark Property Inspectors: action name in the header, Dynamic/Manual Button Text within the scrollable settings, dropdowns above numeric rows, better dropdown contrast, fewer help rows, and consistent fade backgrounds.
- Scene editor frames grow and shrink with content. Direct action inspectors replace the common wrapper iframe; old saved inspector paths navigate to their corresponding direct editor.
- Saved Presets persist outside browser storage, then merge into one shared Scene Library. Migration preserves different same-name entries, deduplicates identical entries and records imports so renamed/deleted entries do not return. Scene file names follow the selected library entry.
- Physical Input/Output fades wait for asynchronous device feedback rather than reporting premature endpoint failures. No command retry is introduced.
- Consolidated twelve historical runtime patch layers into `plugin-core.js`, preserving the final runtime bytes and separate feature modules.
- Follow-up deletion/reselection fix: forward inspector visibility events, add a registration handshake, request a temporary scroll repaint even for short editors, restore scroll/styles, and log inspector diagnostics.

**Validation:** 77 automated tests pass. User/log checks confirm Source A/B fades, 0 ms changes, Scene fade ordering and restored durations; C922 and Volt 2 physical input fades pass after the feedback fix, including concurrent fades. On 7 September 2026 the user confirmed the inspector deletion/reselection fix works. The [runtime test record](https://github.com/djbauer69/WeaverDeckPlg/blob/main/releases/v0.22.0-testing.md) distinguishes logged evidence from visual confirmation.

Current tested plugin SHA-256:

```text
c60ab275f60ee400ca5ab1fbcc30ac9a549409872c178550a81dbb9edf377ae3
```

This supersedes the earlier direct-inspectors v0.22.0 package with SHA-256 `9b4ebc37f92f59fecd881a7f3e571286c221ca36acd8b89021756fa98ac59ba0`.

## v0.21.0 — volume fades

Added Application, Source, Target, Physical Input and Physical Output Volume Fade buttons, plus an awaited Smart Scene Volume Fade step. Initially durations used seconds. Added linear interpolation, endpoint checking, manual takeover, replacement fades, external-change/identity/disconnect cancellation and live volume feedback. Excluded fade buttons from native Multi Actions because they cannot await completion. Automated suite: 42 tests at initial packaging.

## v0.20.0 — volume dials and touch strips

Added five Volume Dial actions for Application, Source, Target and Physical Input/Output. Turning adjusts volume; pressing or briefly tapping toggles mute. Added live strip labels, percentages, bars and mute/availability state; serialized/coalesced input, stale-input limits and cancellation. Added the hardware/distribution compatibility matrix. Existing button and Scene functionality retained. Automated suite: 33 tests at packaging.

## v0.19.1 — universal labels and volume badges

Added Dynamic Text and Manual Input to every action. All Volume Down/Up/Set buttons show their current percentage at the bottom right independently of title mode. Preserved older custom Application labels and offline artwork behavior. Automated suite: 23 tests at packaging; user subsequently confirmed the update worked.

## v0.19.0 — startup Scene

Added Scene Startup: one persistent, optional local Scene file run after OpenDeck connects and PipeWeaver becomes ready. Includes Check file, configurable settle delay, once-per-process execution, manual run, disable/cancel behavior and file/error diagnostics. Shared settings survive deleting the setup button. Ordinary reconnects do not replay a completed run. Automated suite: 18 tests at packaging.

## v0.18.1 — exported Scene names

Save Scene File uses the selected Browser-local Preset name for the filename and exported Scene name, with the Scene name as fallback. It saves current contents and retains filename sanitization/collision suffixes. This later follows Scene Library selection after the v0.22.0 unification.

## v0.18.0 — engine controls and mute destinations

Added Audio Buffer Size and Audio Engine Restart buttons and Scene steps, with readiness polling and no repeat of an uncertain restart. Added Source Mute To Add/All/Remove/Set/Toggle buttons and multi-source Scene destination operations. Actions/operations grouped alphabetically by function. Concurrent status refresh callers share the pending response.

Runtime checks covered Browser slot B → Headphones Set/Toggle/All, 256/512 sample buffer changes, engine restart, and Scenes that continue after recovery. Brave could pause during engine changes; clicking Play immediately restored audio. Mute To configures destinations and may unmute a slot, so an explicit mute step can follow. Original release notes preserve the remaining individual coverage gaps.

## v0.17.0 — resilient application identity

Normalized trailing ` (deleted)` markers and executable paths to basenames. Added unambiguous name/process fallback, rejection of ambiguous identities and retention of configured offline applications. Applied the logic to direct actions, artwork, Scene operations and conditions. Added cached application discovery. The implementation was staged as smaller auditable layers before later core consolidation. [Repository commit](https://github.com/djbauer69/WeaverDeckPlg/commit/fb8da690113bcdd4696c0a20f8c11de81ecd40a4). No v0.17.0 release entry/tag was present in the cleanup inventory.

## v0.16.0 — Smart Scenes

Added per-step Always/Application running/Application not running conditions, Wait / Delay steps, and Stop/Continue failure policy with condition-aware validation/logging. Retained Source Link capture/restore, library/files/presets and Capture Scope. Follow-up commits fixed Smart Scene controls readiness, application identity/process normalization and Source Link editor/dropdown integration, and synchronized the runtime with the package. Subsequently documented as runtime-validated stable.

## v0.15.1 — Source A/B volume linking

Added Source Volume Link Toggle with LINKED/UNLINKED feedback. Scenes capture, validate and set link state; PipeWeaver retains its native linked-ratio behavior. Follow-up fixes repaired Scene link-state capture and aligned the wrapper with the packaged source.

## v0.15.0 — native Scene Library

Added shared native Scene Library with Load, Save As, Update, Rename, Duplicate, Delete and Refresh. Added Scene key success/failure feedback and quieter application polling. Retained file I/O, scoped capture and browser-local presets.

## v0.14.2 — native Scene file saving

Moved Scene file writes from WebView browser downloads into the native plugin process. Saves to Downloads, reports the full path and uses numbered filenames to preserve existing files.

## v0.14.1 — scoped capture repair

Filtered the actual internal Scene operation list through its JSON bridge, fixing routes-only captures that returned no steps. Repaired file/preset handling affected by the same iframe state-access issue.

## v0.14.0 — capture scope, Scene files and presets

Added independent capture categories for Sources, Targets, Routes, Physical devices, Default devices and Applications. Added portable Scene file load/save and browser-local reusable presets.

## v0.13.0 — Scene import/export

Added portable versioned Scene JSON export, copy/share and import into other Scene buttons, retaining validation against the receiving PipeWeaver configuration.

## v0.12.2 — custom Application text

Kept enlarged application artwork, restored dynamic titles and added optional persistent custom Application Button Text.

## v0.12.1 — enlarged Application artwork

Enlarged resolved application icons and suppressed the host text overlay that obscured them, retaining compact mute/route/volume artwork indicators. Dynamic titles returned with v0.12.2.

## v0.12.0 — Application artwork

Added Linux `.desktop`/icon-theme resolution, common-app fallbacks and generated badges for application actions. Added green/live and red/muted Application Mute artwork.

## v0.11.2 — idempotent Scene routes

Treats a Scene route already in the requested state as a successful no-op.

## v0.11.1 — configured physical Scene channels

Restored configured physical Sources/Targets in Scene channel selections, kept raw hardware in Physical Input/Output steps, and fixed the source version marker.

## v0.11.0 — Scene preflight validation

Added Validate Scene and checks for Sources, Targets, routes, physical/default devices, application selections/destinations and volume values. Offline applications produce warnings. Invalid Scenes abort before changing audio. Added detailed validation logs.

## v0.10.0 — physical-device Scene operations

Physical-device Scene functionality is explicitly recorded as included in the v0.11.0 release notes. No separate v0.10.0 release/tag or detailed version record was present in the recovered history; the later implementation includes physical input/output mute/volume and default-device steps.

## v0.9.2 — Scene editor fixes

Fixed Scene volume input editing, automatic discovery interrupting active edits, Source Set Volume spinner rerendering and already-matching Target Mix no-ops. Retained v0.9.x application discovery/controls in Scenes.

## v0.9.0 development — applications in Scenes

Added application controls to Scene Builder. Repository history also records restoration of the v0.8.0 baseline before further v0.9 testing. No standalone v0.9.1 release record was present. [Application Scene commit](https://github.com/djbauer69/WeaverDeckPlg/commit/0800696b9eb88876417519027ed8445d2e94b13c).

## v0.8.0 — Capture Current State

Added Scene Capture Current State, allowing the existing audio state to populate a Scene. Historical tag: `WeaverDeckPlg_0_8_0`. [Commit](https://github.com/djbauer69/WeaverDeckPlg/commit/8e0081b5267af22fe060350b9846cc8b2f0c1317).

## v0.7.1 — Scene execution logging

Documented Scene execution logging and synchronized the v0.7.1 source. Historical tag: `WeaverDeckPlg_0_7_1`. [Source synchronization](https://github.com/djbauer69/WeaverDeckPlg/commit/1671509dc1d0a2e48bac9dcde5dea651ba6e5948).

## v0.7.0 — structured Scene Builder

Replaced the raw-JSON-only inspector with ordered, editable steps, multiple channel selection and explicit states. Included Source/Target mute and volume, Target Mix, and Source → Target routes; add/remove/reorder controls; retained legacy JSON execution. [Historical README](https://github.com/djbauer69/WeaverDeckPlg/blob/dcf42991665f66058e0da5c4e7ef8e499af7a2f9/README.md).

## v0.6.0 — live feedback

Added visual state for applications, channels, routes, physical/default devices and connection status. Mute states show live/muted, routes show active/inactive, mixes show A/B, and default-device state reflects the selection. Inspector discovery begins at WebSocket open instead of a fixed delay. [Historical README](https://github.com/djbauer69/WeaverDeckPlg/blob/fd62ea097a67895339988682db21b6468b96173a/README.md).

## v0.5.1 — type-aware application routing

Fixed playback applications incorrectly being offered Targets. Playback routes to Sources and capture routes to Targets; Route Off restores Default. [Historical README](https://github.com/djbauer69/WeaverDeckPlg/blob/ca97be18902d718a3497fb96acac5394c2f7ce31/README.md).

## v0.5.0 — expanded Source and application controls

Added exact Source volume, dedicated A/B volume and mute controls, Application Set Volume/transient routing, Physical Input volume/mute and improved feedback. Its README identifies v0.4.8 as the stable baseline; separate v0.4.2–v0.4.8 change records were not recovered.

## v0.4.1 — Source/mix discovery

Expanded Source volume/mute and Target Mix controls, and improved discovery of configured/physical channels. The recorded action set also includes application volume, route On/Off/Toggle, physical output controls, default-device selection, Status and Scene. [Historical README](https://github.com/djbauer69/WeaverDeckPlg/blob/e880f3f7c356c4c3f3c0425c448965991bbfae5b/README.md).

## v0.2.2 — connection reliability

Added long-running connection reliability improvements. [Implementation commit](https://github.com/djbauer69/WeaverDeckPlg/commit/9cab616ebcf067202e319af298a6c5189022853b).

## v0.2.1 — earliest repository baseline

The initial committed plugin provides volume Up/Down, Target Mute toggle, Route toggle and Application Mute through PipeWeaver's HTTP API. Includes OpenDeck action inspectors and icons. [Historical README](https://github.com/djbauer69/WeaverDeckPlg/blob/3d8a264ef6c4ca3be2657ab3ae6e64d1c93e89d4/README.md).

Earlier prototypes and intermediate unrecorded versions are outside the recoverable repository history. Use the [commit history](https://github.com/djbauer69/WeaverDeckPlg/commits/main/) for the complete recorded implementation chronology.
