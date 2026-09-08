# Actions

WeaverDeck v0.24.1 provides **12 sidebar actions** and retains all **57 operations**. Drag Application, Physical Input, Physical Output, Route, Source or Target onto a key, then choose an operation from the **Action** dropdown in the inspector header. The tables below list these selectable operations. Audio Buffer Size, Audio Engine Restart, Default Device Set, Scene, Scene Startup and Status remain separate actions. On encoders, the five audio groups select their Volume Dial operation automatically.

Installations still using v0.22.0 or older individual action identifiers need the [one-time profile migration](https://github.com/djbauer69/WeaverDeckPlg/blob/main/docs/UPGRADE-v0.23.0.md) before installing the compact manifest. The requested v0.23.0 runtime checks have passed. Already-migrated installations use the plugin ZIP directly through OpenDeck.

Physical Input and Output also have an **Icon** selector beside the operation dropdown. Input choices: Default, Microphone, Electric guitar, Acoustic guitar, Drums, Keyboard and Webcam. Output choices: Default, Desktop speakers, Headphones, Soundbar and AirPods. Custom volume icons keep the live percentage badge; mute icons display live/muted state. These choices control plugin key artwork; manually assigned OpenDeck images can take precedence.

The plugin header, shared PipeWeaver artwork, **Audio Buffer Size** and **Audio Engine Restart** use the official PipeWeaver logo. Existing Audio buttons receive the updated artwork when they appear. Route and Target Mix/Mute operations retain their operation-specific state icons.

## Shared controls

- **Button Text → Dynamic Text** displays the action's current status. **Manual Input** uses your own label, including line breaks; an empty label hides the title. Switching modes keeps the manual label for later.
- Volume buttons show the **current volume % at the bottom right**, in either text mode. Set Volume shows the current reading, not just its saved destination. Unavailable readings may show `?` or offline application artwork.
- **Step %** is the change per press or dial tick (default 5 percentage points). Volume stays within 0–100%.
- **Hold ms**, on Volume Up/Down keys, sets repeat spacing from 50–2000 ms (default 200). Tap for one step; hold to repeat. Releasing, removing the key, editing its settings, or losing the OpenDeck connection stops repeat. Native OpenDeck Multi Actions apply one step only. Actual speed also depends on command completion.
- **Volume %** is an exact destination for Set Volume and Fade. Setting volume does not automatically unmute the resource.
- **Fade ms** accepts 0–120000 milliseconds (default 3000). Zero applies the destination immediately. See the fade behavior below.
- Dropdowns select PipeWeaver objects. A configured Source or Target can itself represent a physical channel; the separate **Physical Input/Output** actions address raw devices exposed by PipeWeaver.

## Application

Play audio or start capture so PipeWeaver can discover the application, then select it. The saved identity remains visible while offline and is resolved again after restarts. Ambiguous matches are rejected. An application with no active stream cannot receive live audio commands.

Playback applications route to compatible PipeWeaver **Sources**; capture applications route to compatible **Targets**. Application routes are transient, distinct from Source → Target routes.

| Action | Settings | What it does |
| --- | --- | --- |
| Application Mute | Application | Toggles application mute. |
| Application Route Off | Application | Clears its transient route back to Default. |
| Application Route On | Application, destination | Routes the live application to the selected compatible channel. |
| Application Route Toggle | Application, destination | Switches between the selected channel and Default. |
| Application Set Volume | Application, Volume % | Applies an exact volume. |
| Application Volume Dial | Application, Step % | Turn to adjust; press or briefly tap the strip to toggle mute. |
| Application Volume Down | Application, Step %, Hold ms | Decreases volume; repeats while held. |
| Application Volume Fade | Application, Volume %, milliseconds | Fades to the destination volume. |
| Application Volume Up | Application, Step %, Hold ms | Increases volume; repeats while held. |

## Audio

| Action | Settings | What it does |
| --- | --- | --- |
| Audio Buffer Size | Buffer size | Changes PipeWeaver's audio quantum, then waits for engine recovery. Selecting the current value is a no-op. |
| Audio Engine Restart | None beyond Button Text | Requests PipeWeaver's audio engine restart and waits for recovery. |

Buffer values are **PipeWire configured** (use the configured/default quantum), or 8, 16, 32, 64, 128, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840 or 4096 samples.

Restart and buffer changes can pause playback in Brave. Clicking Play restored audio in runtime testing. The actions wait for PipeWeaver readiness, not for applications to resume playback. Restart requires the PipeWeaver API to accept the command; it cannot start a stopped daemon. Recovery has an approximately 30-second polling deadline, with in-flight request time potentially extending it.

## Default device

| Action | Settings | What it does |
| --- | --- | --- |
| Default Device Set | Input/output type, device | Sets PipeWeaver's default input or output. Its state indicates whether the selection is currently the default. |

## Physical Input

| Action | Settings | What it does |
| --- | --- | --- |
| Physical Input Mute | Input | Toggles mute on the physical input. |
| Physical Input Volume Dial | Input, Step % | Turn to adjust; press or briefly tap the strip to toggle mute. |
| Physical Input Volume Down | Input, Step %, Hold ms | Decreases input volume; repeats while held. |
| Physical Input Volume Fade | Input, Volume %, milliseconds | Fades input volume, waiting for device feedback after each command. |
| Physical Input Volume Up | Input, Step %, Hold ms | Increases input volume; repeats while held. |

## Physical Output

| Action | Settings | What it does |
| --- | --- | --- |
| Physical Output Mute | Output | Toggles mute on the physical output. |
| Physical Output Volume Dial | Output, Step % | Turn to adjust; press or briefly tap the strip to toggle mute. |
| Physical Output Volume Down | Output, Step %, Hold ms | Decreases output volume; repeats while held. |
| Physical Output Volume Fade | Output, Volume %, milliseconds | Fades output volume, waiting for device feedback after each command. |
| Physical Output Volume Up | Output, Step %, Hold ms | Increases output volume; repeats while held. |

There are no separate physical Set Volume buttons in this version. Use a physical Fade with 0 ms for an immediate exact value, or a Scene Physical Input/Output Set Volume step.

## Route

| Action | Settings | What it does |
| --- | --- | --- |
| Route Off | Source, Target | Disables the selected Source → Target connection. |
| Route On | Source, Target | Enables the selected Source → Target connection. |
| Route Toggle | Source, Target | Reverses the selected connection's current state. |

## Scene

| Action | Settings | What it does |
| --- | --- | --- |
| Scene | Ordered steps, conditions, failure policies | Validates and runs the saved sequence when pressed. Also provides capture, Scene Library and file controls in its inspector. |
| Scene Startup | File path, enable switch, readiness delay | Configures one shared startup Scene; pressing the key runs that file manually. |

### Building and running a Scene

1. Add a Scene action and use **+ Add Step**. Select the operation and its channels/devices, desired state or value.
2. Use the arrows to reorder steps. A multiple-source/multiple-target route step affects every selected source–target pair.
3. Choose **Always**, **Application running**, or **Application not running** for each step. These conditions use PipeWeaver stream discovery, not an OS process list.
4. Choose **Stop Scene** or **Continue Scene** on runtime failure. Continue applies to execution errors; invalid preflight validation still prevents execution.
5. Click **Validate Scene** to check selections, or **Preview Scene** to inspect per-step before/after values without changing audio. Editing a Scene marks the preview out of date immediately; preview again to inspect the new values. Preview is optional and does not block execution. Press the deck key to run the saved Scene from top to bottom.

The Scene inspector keeps section headings, controls, validation and preview results, and operation/error feedback. Static explanatory paragraphs and ready/loading descriptions were removed in v0.24.1.

| Scene operation | Configuration and behavior |
| --- | --- |
| Application Mute / Unmute | Select applications and an explicit mute state. |
| Application Route | Select applications and a compatible destination, or Default. |
| Application Set Volume | Select applications and an exact percentage. |
| Audio Buffer Size | Select a supported sample count or configured default; waits for recovery. |
| Audio Engine Restart | Restarts through PipeWeaver and waits before the next step. |
| Physical Input Mute / Unmute | Select an input and explicit mute state. |
| Physical Input Set Volume | Select an input and exact percentage. |
| Physical Output Mute / Unmute | Select an output and explicit mute state. |
| Physical Output Set Volume | Select an output and exact percentage. |
| Route On / Off | Select sources, targets and explicit enabled/disabled state. |
| Set Default Device | Select input/output and a physical device. |
| Source Mute / Unmute | Select sources, A/B mute slot and explicit mute state. |
| Source Mute To Destinations | Select sources, A/B slot, destination mode and targets; Set can contain multiple targets. |
| Source Set Volume | Select sources, mix A/B and exact percentage. |
| Source Volume Link | Select sources and Linked/Unlinked. |
| Target Mix A / B | Select targets and explicit mix. |
| Target Mute / Unmute | Select targets and explicit mute state. |
| Target Set Volume | Select targets and exact percentage. |
| Volume Fade | Select one Application, Source, Target, Physical Input or Physical Output, destination % and milliseconds. Source also selects mix A/B. Waits for completion before the next step. |
| Wait / Delay | Pause for 0–60000 milliseconds (default 250) before the next step. |

A Scene is sequential, not an atomic transaction: earlier changes remain if a later step fails. Missing application streams may be warned about or skipped; COMPLETE does not prove that an offline application's audio changed. Conditions are evaluated against current status during execution. Use explicit states for repeatable results.

**Capture Current State** replaces the working steps with a snapshot of the chosen Capture Scope: Sources, Targets, Routes, Physical devices, Default devices and/or Applications. Source capture includes A/B volume, mute and link state. Captured steps are unconditional by default. Capture does not add engine restarts or capture buffer/mute-destination settings. Refresh Channels / Apps updates discovery; it does not capture audio settings.

### Scene Library and Scene Files

| Storage | Purpose | How changes are saved |
| --- | --- | --- |
| Scene button | The working sequence for that button | Stored with the action's OpenDeck settings. |
| Scene Library | Shared reusable Scenes on this computer | Save As creates an entry; Update replaces the selected entry; Rename, Duplicate, Delete and Refresh manage the collection. Load copies an entry into the button. |
| Scene Files | Portable `.weaverdeck-scene.json` backups, sharing and startup input | Save Scene File writes the current Scene to Downloads. Load Scene File imports a file. JSON export/import offers a copy/paste alternative. |

Loading creates a copy: editing a button does not automatically update its library entry or an exported file. Saving a file uses the selected library name, otherwise the Scene name; names are sanitized and existing files get numbered suffixes rather than being overwritten.

The former Browser-local/Saved Presets are migrated into Scene Library. Identical entries are deduplicated; different same-name entries receive a `(Preset)` suffix. Migration records prevent deleted or renamed imports reappearing. The previous native preset file is retained as a backup. There is no separate preset collection to manage in the current UI.

### Scene Startup

1. Save a Scene File and keep it at a stable local path.
2. Add Scene Startup, enter an absolute path or `~/Downloads/Your-Scene.weaverdeck-scene.json`, then use **Check file**. This validates without executing.
3. Enable **Run saved Scene at startup**, select the readiness delay (0–60 **seconds**, default 2), and click **Save startup settings**.
4. Restart OpenDeck. The plugin waits for PipeWeaver readiness, settles, checks readiness again, reads the file and runs it once per plugin process launch.

The setting is shared and stored outside the button. **You can delete the Scene Startup button after saving; automatic startup remains enabled.** Add it again to change or disable the setting. Disabling and saving cancels a pending startup run. Saving enabled settings takes effect on the next launch, not immediately.

The key also runs the saved file manually when automatic startup is disabled. A manual run cancels a pending automatic run. Ordinary socket reconnects or PipeWeaver restarts do not replay a completed startup Scene. Missing files or partial failures are logged and not automatically retried. Startup does not launch applications or resume their media playback.

## Source

| Action | Settings | What it does |
| --- | --- | --- |
| Source A Volume Down | Source, Step %, Hold ms | Decreases fixed mix A; repeats while held. |
| Source A Volume Up | Source, Step %, Hold ms | Increases fixed mix A; repeats while held. |
| Source B Volume Down | Source, Step %, Hold ms | Decreases fixed mix B; repeats while held. |
| Source B Volume Up | Source, Step %, Hold ms | Increases fixed mix B; repeats while held. |
| Source Mute | Source, A/B slot | Toggles the selected mute slot. |
| Source Mute A | Source | Toggles fixed mute slot A. |
| Source Mute B | Source | Toggles fixed mute slot B. |
| Source Mute To Add | Source, A/B slot, Target | Adds a destination to the slot's list. |
| Source Mute To All | Source, A/B slot | Clears the destination list, which PipeWeaver interprets as all destinations. |
| Source Mute To Remove | Source, A/B slot, Target | Removes a destination; removing the final entry restores All. |
| Source Mute To Set | Source, A/B slot, Target | Replaces the destination selection with the chosen target. |
| Source Mute To Toggle | Source, A/B slot, Target | Adds/removes that target's membership in the slot's destination list. |
| Source Set Volume | Source, mix A/B, Volume % | Applies an exact volume to the selected mix. |
| Source Volume Dial | Source, mix A/B, Step % | Turn to adjust; press or briefly tap the strip to toggle the selected mute slot. |
| Source Volume Down | Source, mix A/B, Step %, Hold ms | Decreases selected mix volume; repeats while held. |
| Source Volume Fade | Source, mix A/B, Volume %, milliseconds | Fades selected mix volume. |
| Source Volume Link Toggle | Source | Toggles linked/unlinked A/B volumes using PipeWeaver's native ratio behavior. |
| Source Volume Up | Source, mix A/B, Step %, Hold ms | Increases selected mix volume; repeats while held. |

**Mute To changes the destination selection, not mute activation.** PipeWeaver may unmute the slot when destinations change. To mute to a chosen target, use Mute To Set followed by Source Mute, or use two Scene steps with an explicit Muted state. Destination choices are configured PipeWeaver targets, including configured physical targets.

Source volume controls honor PipeWeaver's A/B link setting. Adjusting one linked mix can change the other. Unlink first if you need independent A/B volumes.

## Status

| Action | Settings | What it does |
| --- | --- | --- |
| Status | Button Text | Displays PipeWeaver connection status; pressing requests a refresh. |

## Target

| Action | Settings | What it does |
| --- | --- | --- |
| Target Mix A | Target | Selects mix A for that target. |
| Target Mix B | Target | Selects mix B for that target. |
| Target Mix Toggle | Target | Switches between mixes A and B. |
| Target Mute | Target | Toggles target mute. |
| Target Mute Off | Target | Explicitly unmutes the target. |
| Target Mute On | Target | Explicitly mutes the target. |
| Target Set Volume | Target, Volume % | Applies an exact volume. |
| Target Volume Dial | Target, Step % | Turn to adjust; press or briefly tap the strip to toggle mute. |
| Target Volume Down | Target, Step %, Hold ms | Decreases volume; repeats while held. |
| Target Volume Fade | Target, Volume %, milliseconds | Fades to the destination volume. |
| Target Volume Up | Target, Step %, Hold ms | Increases volume; repeats while held. |

## Fade behavior

Fades interpolate volume linearly, with updates no faster than approximately one per 100 ms per fade. Millisecond entry provides granular duration settings; it is not a sample-accurate audio envelope. HTTP latency and physical-device feedback may extend the duration. Physical fades wait up to 1000 ms for readback after each accepted command without resending it.

A new fade on the same resource replaces the old fade. A direct WeaverDeck volume adjustment takes over after any already-sent fade command finishes. A detected external change outside the expected range/tolerance, missing resource, changed application identity, or OpenDeck disconnect stops the fade. It does not resume automatically on reconnect. Removing a button or changing deck pages does not by itself cancel a fade already running. Only one fade per Source runs at a time, including its two mixes.

Use Smart Scenes when another operation must wait for the fade. Fade buttons are excluded from native OpenDeck Multi Actions because that host sequence cannot await fade completion. Older saved `seconds` values remain supported; newly saved fades use `milliseconds`.

## Dial behavior

Each volume dial shows its label, live percentage, volume bar and Live/MUTED/Unavailable state on its strip. Clockwise increases and counterclockwise decreases. Press or short tap toggles mute once; release and long touch do not toggle again. There is no held-turn modifier. Rapid same-direction ticks may be combined; pending input expires after two seconds and is cancelled when the dial is removed, reassigned or disconnected. See the [compatibility matrix](https://github.com/djbauer69/WeaverDeckPlg/blob/main/docs/COMPATIBILITY.md) for implementation and platform coverage.

## Troubleshooting

If a list is empty, confirm PipeWeaver is running and exposing the desired object. Start application playback/capture before initial application selection. A yellow exclamation means an action failed; inspect the plugin log for the relevant command, fade or Scene error. It is not an application playback log.

The current package retains the inspector deletion/reselection repaint fix. If clipping recurs, describe the selection sequence. To collect visibility and redraw dimensions, start OpenDeck with `WEAVERDECK_DEBUG=1` in its environment and attach a fresh plugin log. Normal logging omits this verbose detail; warnings, errors and concise results remain available. See [diagnostic logging](https://github.com/djbauer69/WeaverDeckPlg/blob/main/docs/DIAGNOSTICS.md).

This guide is checked against the [manifest](https://github.com/djbauer69/WeaverDeckPlg/blob/main/com.pipeweaver.opendeck.sdPlugin/manifest.json) and current runtime. See [Communication](https://github.com/djbauer69/WeaverDeckPlg/wiki/Communication) and [Version History](https://github.com/djbauer69/WeaverDeckPlg/wiki/Version-History).

## Scene preview (v0.24.0)

Preview Scene sits beside Validate Scene. It reads current status and shows each structured step's proposed changes, conditions and unavailable selections without changing audio. Expand a step for before/after values. Later values after waits, fades or engine changes are provisional; editing the Scene invalidates the snapshot. See [the preview guide](https://github.com/djbauer69/WeaverDeckPlg/blob/main/docs/SCENE-PREVIEW.md).
