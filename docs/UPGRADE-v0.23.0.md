# Upgrade to v0.23.0 grouped actions

v0.23.0 reduces the action sidebar from 57 entries to **12**. Application, Physical Input, Physical Output, Route, Source and Target each become one draggable action. Choose the operation in the inspector's **Action** dropdown. All 51 operations from those six groups remain available; the six utility actions remain separate.

For a fresh installation or a setup already using the v0.23.0 grouped actions, install the plugin ZIP directly through OpenDeck. The one-time procedure below is only for older individual action identifiers.

## Migrating from v0.22.0 or earlier

**Use the upgrade bundle before opening OpenDeck with the new plugin.** OpenDeck's current action list does not honor `VisibleInActionsList`, and missing action UUIDs can cause it to discard saved buttons. The included offline installer converts old button/dial UUIDs and preserves their operation, selections, numeric settings, manual text, user artwork and nested Multi Actions. It also creates a backup and installs the matching plugin ZIP.

1. Fully quit OpenDeck, including its tray process.
2. Extract `weaverdeck-v0.23.0-upgrade.zip` into Downloads. Keep its installer, plugin ZIP and checksum together.
3. Run:

   ```bash
   python3 ~/Downloads/weaverdeck-v0.23.0-upgrade/install-grouped-actions.py --apply
   ```

   Omit `--apply` for a preview. For a different configuration location, append `--config /path/to/opendeck` (the directory containing `profiles/` and `plugins/`). No administrator privileges are needed.
4. Check that the script reports **Upgrade complete**. Start PipeWeaver and OpenDeck.

Backups are saved under `<config>/weaverdeck-backups/<timestamp>/`, outside the active profiles and plugins directories. To roll back, quit OpenDeck, keep a copy of your current files, restore the backed-up profile files and replace the plugin folder with the backup. Do not restore only the old plugin while leaving converted profiles in place.

Installer correction: OpenDeck device-selection metadata (`profiles/<device>.json`) is preserved without being treated as a button profile. Profile validation errors now identify the affected file. If the earlier installer stopped with “Unrecognized OpenDeck profile format”, replace the extracted bundle with this corrected copy and rerun the command; that validation stop did not install anything.

The installer requires Python 3 on Linux and validates the bundled ZIP checksum. It refuses to run while OpenDeck is active or when the profile format is unrecognized. It converts profile JSON files already present in the selected configuration. **If importing a profile exported before v0.23.0, first import it using v0.22.0, quit OpenDeck, then run this migration.** Old exported profiles are not automatically rewritten by the plugin.

For a fresh installation with no existing WeaverDeck profile entries, the inner plugin ZIP can be installed normally. For development checkouts, explicitly pass `--zip /path/to/pipeweaver-opendeck-plugin-v0.23.0.zip`; its `.sha256` file must be beside it.

## Using the grouped actions

- Drag the desired group onto a key. Select its operation in the header dropdown, then select an application, channel or device. Switching operations preserves shared selections and numeric settings.
- Physical Input adds **Default, Microphone, Electric guitar, Acoustic guitar, Drums, Keyboard and Webcam** icons.
- Physical Output adds **Default, Desktop speakers, Headphones, Soundbar and AirPods** icons.
- The **Icon** selector sits beside the operation selector and wraps beneath it on narrow inspectors. Custom physical volume icons retain the live percentage badge; mute icons show live/muted state. OpenDeck user-assigned artwork can override plugin artwork; clear it if you want the selected plugin icon to be visible.
- Dynamic Text and Manual Input remain in the scrollable area. Numeric settings share a row below selections where space permits.
- On an encoder, the same grouped action uses its Volume Dial operation; Route remains a key action. Icon choices apply to key artwork, not the encoder strip layout.
- Native Multi Actions exclude fade operations because they cannot wait for completion. Smart Scene fades continue to wait for completion and use their existing Scene operation settings.

## Completed runtime checks

Automated checks pass: 89 Node tests and 15 Python tests, including operation dispatch, settings/text preservation, controller restrictions, icon feedback, profile conversion, byte-exact backups and rollback. Icon SVGs have been rendered for visual inspection. The user confirmed the following OpenDeck/PipeWeaver checks passed on 7 September 2026:

1. Confirm existing buttons keep their selected operations and work after migration/restart.
2. Confirm the sidebar has 12 alphabetical entries. Drag each of the six groups onto a key and switch operations.
3. Try Physical Input and Output icon choices, then mute and volume controls. Confirm manual labels and bottom-right percentages.
4. Check hold Step/Hold ms and a short Fade. Switch operations and confirm the selected device and settings remain.
5. Delete a button, select an empty button, then return to a grouped action and Scene; confirm the inspector is fully visible.

See [the runtime test record](../releases/v0.23.0-testing.md) for logged evidence and user confirmation.
