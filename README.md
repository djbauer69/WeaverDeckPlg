# WeaverDeck v0.23.0

Control **PipeWeaver** from **OpenDeck on Linux**: application and channel volume/mute, routing, Source A/B mixes, audio engine controls, Smart Scenes, startup Scenes and volume dials.

v0.23.0 has passed the requested runtime checks. See the [test record](releases/v0.23.0-testing.md) and [release notes](releases/v0.23.0.md). GitHub release publication is pending; published downloads are listed on the [Releases page](https://github.com/djbauer69/WeaverDeckPlg/releases).

## Documentation

| Guide | Contents |
| --- | --- |
| [Actions](docs/wiki/Actions.md) | 12 sidebar actions and all 57 operations, settings, hold controls, fades, Scene Library, Scene Files and startup. |
| [Version History](docs/wiki/Version-History.md) | Recorded changes from the first repository baseline through v0.23.0. |
| [Communication](docs/wiki/Communication.md) | How the plugin exchanges OpenDeck events and PipeWeaver API commands. |
| [Compatibility](docs/COMPATIBILITY.md) | Requirements and hardware/distribution test matrix. |

The three main guides are also prepared for the GitHub wiki. Their repository copies remain available here.

## Install or update

Install `pipeweaver-opendeck-plugin-v0.23.0.zip` directly through OpenDeck for fresh installations or installations already using the v0.23.0 grouped actions. No installer bundle is needed for subsequent updates on that setup.

For profiles still using v0.22.0 or older individual action identifiers, consult the [one-time migration guide](docs/UPGRADE-v0.23.0.md) before replacing the plugin; OpenDeck can discard unrecognized action identifiers.

The package requires an OpenDeck-compatible Node runtime with global `WebSocket` available (`node -p 'typeof WebSocket'` should print `function`) and PipeWeaver's HTTP API, normally at `http://127.0.0.1:14565/api/command`. See Compatibility for installation differences.

Existing action settings, Scene files and shared Scene Library/startup settings remain supported. The plugin performs audio changes through PipeWeaver only.

## Current changes

v0.23.0 provides one draggable action per requested function group, operation selection in the header, and selectable physical input/output icons. The six utility actions stay separate. Existing hold, fade, Scene and inspector fixes are retained.

**89 Node tests and 15 Python tests pass.** The [v0.23.0 release notes](releases/v0.23.0.md) describe the changes; the [runtime test record](releases/v0.23.0-testing.md) records successful user testing. The prior stable [runtime test record](releases/v0.22.0-testing.md) remains available.

## Development

```bash
node --test tests/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tools/build-release.py
```

`plugin.js` loads the consolidated `plugin-core.js` and separate feature modules. The builder creates a deterministic ZIP with verified file contents and executable modes. Wiki sources live in `docs/wiki/`; the maintainer publishing/cleanup procedure is in [docs/PUBLISHING.md](docs/PUBLISHING.md).
