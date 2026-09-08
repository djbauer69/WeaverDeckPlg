# Scene preview — v0.24.0 review build

Open the Scene action inspector and click **Preview Scene**, beside Validate Scene. It reads a fresh PipeWeaver status snapshot and shows all structured steps without performing any Scene operation. Expand a step to see selections, before/after values, conditions, failure policy and notes. The panel uses the existing inspector scrolling and does not add an inner scrollbar.

- **Would change:** the planned value differs from the snapshot or a preceding projected step.
- **Already set:** no value change is expected. Some runtime commands may still be sent when the Scene actually runs; this label is not a command count.
- **Would skip:** an application is offline or the condition is not met in the snapshot.
- **Needs attention:** a selection is missing/ambiguous or the operation is invalid.
- **Provisional:** a reading is unknown, a linked mix needs feedback, or an earlier timed/engine step requires another status check.
- **Wait:** displays the duration, without waiting.

The planner uses the runtime's application identity resolver, validators, status accessors and duration conversion. Named or physical selections with multiple candidates are flagged instead of choosing one silently. It projects direct preceding changes, including volume, mute, mix, links, routing and mute destinations. This makes a Scene that unlinks Source A/B and then sets Music B to 70% understandable in execution order.

The preview is a snapshot, not a guarantee of execution success. Projected values assume preceding steps succeed. Linked-mix side effects are marked unknown. Steps following nonzero waits/fades or engine changes are provisional, and conditions need another check. An offline ordinary Application step is skipped by the runner; an unavailable Application Fade is an error unless skipped by its condition. Existing preflight validation errors still block the entire real Scene, even if a step uses Continue on failure.

Audio Engine Restart and Audio Buffer Size are displayed but never executed by preview. Default-device changes are planned without applying them. Source Mute To shows its destination selection; an empty destination list means All targets and does not itself change mute state.

Editing or importing a Scene invalidates its displayed preview. Input and dropdown edits show a notice beside the changed field immediately, even before leaving a number/text input, and label the preview button as out of date. Replies are correlated with requests and stale replies are discarded. Preview has a ten-second UI timeout; it does not change stored Scene settings. Legacy raw command Scenes are not previewed.

## Verification

100 Node tests pass. A 38-step fixture reproduces the user's Default Scene structure, with anonymized physical device identifiers. Tests cover all operation families, step projection, no status/Scene mutation, status-only request dispatch, conditions, offline/ambiguous matches, linked mix uncertainty, engine/timing boundaries, safe text rendering, stale replies and timeout handling.

## Runtime checks

1. Import or select Default Scene and click Preview Scene. Confirm 38 steps, including Music B at 70%, muted Headphones, controller input/output at 0%, the default devices and Spotify → Music.
2. Confirm preview makes no audible or visible audio-setting changes in PipeWeaver.
3. Stop Spotify playback/close its stream, then preview again. Application steps should report skipped/unavailable as appropriate. Resume playback and refresh preview.
4. Add a conditional step and a Wait or Fade. Check skipped conditions before the timing boundary and provisional results after it.
5. Edit a value after preview. Confirm it requests a new preview, and check that long step details remain fully reachable in the inspector.

Install the plugin ZIP directly through OpenDeck on the existing v0.23.0 setup. No profile migration is needed for this update.
