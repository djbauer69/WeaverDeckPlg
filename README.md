# PipeWeaver Control for OpenDeck 0.12.0

For OpenDeck 2.14.x on Linux.

## Important

This plugin controls **PipeWeaver only** through its HTTP API at `http://127.0.0.1:14565/api/command`. It does not call PipeWire, PulseAudio, WirePlumber, `pactl`, or `wpctl` directly.

Linux desktop files and icon-theme assets are read only to improve Stream Deck button artwork. They are never used for audio control.

## v0.12.0 highlights

- Adds dynamic **application artwork** to Application Mute, Volume, Set Volume, and Route actions.
- Resolves installed Linux application icons from `.desktop` files and icon themes, including common system, user, and Flatpak export locations.
- Matches applications using the PipeWeaver-provided application name, process name, and title metadata.
- Adds a built-in application catalogue and aliases for common applications such as Spotify, Discord, Firefox, Brave, Steam, OBS Studio, VLC, Chromium, Google Chrome, Slack, Zoom, and Microsoft Teams.
- Includes bundled Spotify and Discord fallback marks; other known or unknown applications fall back to generated labelled badges if a local icon is unavailable.
- Application Mute buttons use the resolved app artwork with **green when live/unmuted** and **red when muted**.
- Application Route buttons use active/inactive visual treatments while retaining the application artwork.
- Application Volume buttons retain the application artwork and display the current volume percentage.
- Keeps the proven v0.11.2 control engine isolated in `plugin-core.js`; v0.12.0 adds the artwork resolver as a separate visual layer so audio-control behavior remains unchanged.
- Keeps all v0.11.2 Scene validation, capture, physical-device, application-scene, and route-idempotency functionality.

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

- **Application Mute:** app icon on green when unmuted/live; app icon on red with a mute marker when muted.
- **Application Volume / Set Volume:** app icon on a neutral background with the current percentage.
- **Application Route On / Off / Toggle:** app icon with active/inactive route treatment and route marker.

If an application is not currently running, the normal generic action artwork is restored until PipeWeaver reports the application again.

## Scene validation

The Scene Builder includes **Validate Scene**. Structured Scenes are also validated automatically immediately before execution.

Validation checks include:

- Source and Target selections and availability
- Source and Target volume ranges
- Physical input/output availability
- Default-device selections
- Application descriptors and compatible route destinations
- Unsupported or malformed Scene operations

A validation **error** prevents the entire Scene from executing. Missing applications are warnings and their application steps are skipped safely.

## Capture Current State

Capture Current State records editable structured operations for:

- Source A/B volume and mute state
- Target volume, mute state, and Mix A/B
- Source-to-Target routes, both enabled and disabled
- Application mute, volume, and routing state when available
- Physical input/output volume and mute state
- Current default input and output

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

1. Download `pipeweaver-opendeck-plugin-v0.12.0.zip` from the v0.12.0 GitHub Release.
2. Remove the previous `com.pipeweaver.opendeck.sdPlugin` folder if present.
3. Extract the plugin package into OpenDeck's plugins directory.
4. Restart OpenDeck.
5. Add or re-open application actions so WeaverDeck can resolve their live PipeWeaver application metadata and artwork.

Plugin logs are normally written under `~/.local/share/opendeck/logs/plugins/`.

For v0.12.0, useful artwork diagnostics begin with `[v0.12.0]`, including the desktop-entry count and the selected icon source for each resolved application.

## Release

The v0.12.0 source tree, manifest, README, and release ZIP are intended to remain synchronized. The release ZIP SHA-256 is:

`85358f0b432fd161195c12e3adc86ddb15305c832c74aac5ee542217ffa655a7`
