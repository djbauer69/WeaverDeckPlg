# WeaverDeck v0.24.1

Control **PipeWeaver** from **OpenDeck on Linux**: application and channel volume/mute, routing, Source A/B mixes, audio engine controls, Smart Scenes, startup Scenes and volume dials.

v0.24.1 uses the official PipeWeaver logo for shared artwork, the plugin header and both Audio actions, removes Scene explanatory text, and makes verbose diagnostic logging optional. See [cleanup notes](releases/v0.24.1.md) and [debug logging](docs/DIAGNOSTICS.md).

v0.24.0 adds **Preview Scene**: a read-only, step-by-step view of current and proposed audio settings, skipped conditions, missing selections and provisional results. It uses the current PipeWeaver status and does not send audio-control commands. See [the preview guide](docs/SCENE-PREVIEW.md).

[Download WeaverDeck v0.24.1](https://github.com/djbauer69/WeaverDeckPlg/releases/tag/v0.24.1). The v0.24.0 preview and edit-notice runtime checks passed; see the [test record](releases/v0.24.0-testing.md). Validation of the v0.24.1 artwork and logging changes is recorded in the [release notes](releases/v0.24.1.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Actions](docs/wiki/Actions.md) | 12 sidebar actions and all 57 operations, settings, hold controls, fades, Scene Library, Scene Files and startup. |
| [Version History](docs/wiki/Version-History.md) | Recorded changes from the first repository baseline through v0.24.1. |
| [Communication](docs/wiki/Communication.md) | How the plugin exchanges OpenDeck events and PipeWeaver API commands. |
| [Compatibility](docs/COMPATIBILITY.md) | Requirements and hardware/distribution test matrix. |

The three main guides are also prepared for the GitHub wiki. Their repository copies remain available here.

## Install or update

Install `pipeweaver-opendeck-plugin-v0.24.1.zip` directly through OpenDeck for fresh installations or installations already using the v0.23.0 grouped actions. No installer bundle is needed for subsequent updates on that setup.

For profiles still using v0.22.0 or older individual action identifiers, consult the [one-time migration guide](docs/UPGRADE-v0.23.0.md) before replacing the plugin; OpenDeck can discard unrecognized action identifiers.

The package requires an OpenDeck-compatible Node runtime with global `WebSocket` available (`node -p 'typeof WebSocket'` should print `function`) and PipeWeaver's HTTP API, normally at `http://127.0.0.1:14565/api/command`. See Compatibility for installation differences.

Existing action settings, Scene files and shared Scene Library/startup settings remain supported. The plugin performs audio changes through PipeWeaver only.

## Current changes

v0.23.0 provides one draggable action per requested function group, operation selection in the header, and selectable physical input/output icons. The six utility actions stay separate. Existing hold, fade, Scene and inspector fixes are retained.

**103 Node tests pass**, including read-only preview, the 38-step Default Scene, state projection, conditions and stale inspector response tests. The 20 Python installer/publishing tests also pass. The [v0.23.0 release notes](releases/v0.23.0.md) describe the changes; the [runtime test record](releases/v0.23.0-testing.md) records successful user testing. The prior stable [runtime test record](releases/v0.22.0-testing.md) remains available.

## Development

```bash
node --test tests/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tools/build-release.py
```

`plugin.js` loads the consolidated `plugin-core.js` and separate feature modules. The builder creates a deterministic ZIP with verified file contents and executable modes. Wiki sources live in `docs/wiki/`; the maintainer publishing/cleanup procedure is in [docs/PUBLISHING.md](docs/PUBLISHING.md).
