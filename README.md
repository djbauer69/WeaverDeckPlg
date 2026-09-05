# PipeWeaver Control for OpenDeck 0.12.1

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

Linux desktop files and icon-theme assets are read only to improve Stream Deck button artwork. They are never used for audio control.

## v0.12.1 highlights

- Enlarges dynamic application icons so they use substantially more of the Stream Deck key area.
- Suppresses the normal OpenDeck/core text title on application-artwork buttons so dynamic text no longer obscures the application icon.
- Keeps compact state information inside the artwork itself: mute state, route state, and current volume percentage remain visible without covering the icon.
- Retains v0.12.0 Linux `.desktop` and icon-theme discovery, common application aliases, bundled fallbacks, and generated fallback badges.
- Keeps the proven v0.11.2 PipeWeaver control engine unchanged; v0.12.1 remains a visual-layer update only.
- Keeps all Scene validation, capture, physical-device, application-scene, and route-idempotency functionality.

## Application icon resolution

For each live PipeWeaver application, WeaverDeck tries the following artwork sources:

1. Match the PipeWeaver process/name/title to installed Linux `.desktop` metadata.
2. Resolve the desktop entry's `Icon=` value from common icon-theme and Flatpak export locations.
3. Use a bundled fallback mark for applications with one in the built-in catalogue.
4. Use a generated labelled badge when no icon file is available.

The resolver searches locations including:

- `~/.local/share/applications`
- `~/.local/share/flatpak/exports/share/applications`
- `/usr/local/share/applications`
- `/usr/share/applications`
- `/var/lib/flatpak/exports/share/applications`
- user and system icon-theme directories under `~/.local/share/icons`, `~/.icons`, `/usr/share/icons`, `/usr/share/pixmaps`, and Flatpak exports

This means newly installed applications can acquire their native Linux icon without requiring a new WeaverDeck release, while the built-in catalogue still provides recognizable fallbacks for common apps that are not installed.

## Application visual states

- **Application Mute:** large app icon on green when unmuted/live; red when muted, with a compact mute marker.
- **Application Volume / Set Volume:** large app icon on a neutral background with a small current-percentage badge.
- **Application Route On / Off / Toggle:** large app icon with active/inactive route treatment and a compact route marker.

The core text title is intentionally hidden on these application actions because the visual layer already carries the useful state information and the title otherwise overlaps the artwork.

If an application is not currently running, the normal generic action artwork is restored until PipeWeaver reports the application again.

## Scene validation

The Scene Builder includes **Validate Scene**. Structured Scenes are also validated automatically immediately before execution.

Validation checks include Source and Target availability, volume ranges, physical devices, default-device selections, application descriptors and compatible route destinations, and unsupported or malformed Scene operations.

A validation **error** prevents the entire Scene from executing. Missing applications are warnings and their application steps are skipped safely.

## Capture Current State

Capture Current State records editable structured operations for Source A/B volume and mute state, Target volume/mute/Mix A/B, the complete route matrix, application state, physical input/output state, and current default input/output.

## Actions

### Application
- Application Mute
- Application Route Off / On / Toggle
- Application Set Volume
- Application Volume Down / Up

### Physical / default devices
- Physical Input Mute
- Physical Input Volume Down / Up
- Physical Output Mute
- Physical Output Volume Down / Up
- Set Default Device

### Routing
- Route Off
- Route On
- Toggle Route

### Source
- Source A Volume Down / Up
- Source B Volume Down / Up
- Source Mute
- Source Mute A
- Source Mute B
- Source Set Volume
- Source Volume Down / Up

### Target
- Set Target Volume
- Target Mix A / B
- Toggle Target Mix
- Target Mute / Mute Off / Mute On
- Target Volume Down / Up

### Utility
- PipeWeaver Scene
- PipeWeaver Status

## Requirements

- OpenDeck 2.14.x
- Node.js 20+
- PipeWeaver API available on port 14565

## Install

1. Download `pipeweaver-opendeck-plugin-v0.12.1.zip` from the v0.12.1 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.
5. Re-open or reselect application actions if needed so WeaverDeck can resolve live PipeWeaver metadata and artwork.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

For v0.12.1, artwork diagnostics begin with `[v0.12.1]`.

## Release

The v0.12.1 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`565a2840b51c5695eb2a96abbf8eb600a4676900cbacd1757b44f9b329239e7a`
