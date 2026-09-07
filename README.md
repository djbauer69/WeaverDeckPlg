# WeaverDeck v0.22.0

Control **PipeWeaver** from **OpenDeck on Linux**: application and channel volume/mute, routing, Source A/B mixes, audio engine controls, Smart Scenes, startup Scenes and volume dials.

[**Download v0.22.0**](https://github.com/djbauer69/WeaverDeckPlg/releases/tag/v0.22.0) · [Wiki](https://github.com/djbauer69/WeaverDeckPlg/wiki)

## Documentation

| Guide | Contents |
| --- | --- |
| [Actions](docs/wiki/Actions.md) | All 57 actions, settings, hold controls, fades, Scene Library, Scene Files and startup. |
| [Version History](docs/wiki/Version-History.md) | Recorded changes from the first repository baseline through v0.22.0. |
| [Communication](docs/wiki/Communication.md) | How the plugin exchanges OpenDeck events and PipeWeaver API commands. |
| [Compatibility](docs/COMPATIBILITY.md) | Requirements and hardware/distribution test matrix. |

The three main guides are also prepared for the GitHub wiki. Their repository copies remain available here.

## Install or update

1. Fully quit OpenDeck and back up your profile and existing plugin folder.
2. Move the old `com.pipeweaver.opendeck.sdPlugin` folder outside OpenDeck's plugins directory.
3. Extract the release ZIP so `com.pipeweaver.opendeck.sdPlugin` sits directly inside that directory. On the tested installation it is `~/.config/opendeck/plugins/`.
4. Start PipeWeaver and OpenDeck. Add a PipeWeaver action and select its application, channel or device.

The package requires an OpenDeck-compatible Node runtime with global `WebSocket` available (`node -p 'typeof WebSocket'` should print `function`) and PipeWeaver's HTTP API, normally at `http://127.0.0.1:14565/api/command`. See Compatibility for installation differences.

Existing action settings, Scene files and shared Scene Library/startup settings remain supported. The plugin performs audio changes through PipeWeaver only.

## Latest fixes

v0.22.0 adds configurable hold-repeat volume buttons, millisecond fades, persistent unified Scene Library and compact inspectors. Follow-up fixes address physical-device fade feedback and inspector clipping, including after deleting a button and selecting another. The final deletion/reselection fix has been confirmed by the user and merged.

**77 automated tests pass.** The [runtime test record](releases/v0.22.0-testing.md) records the tested behavior and remaining evidence limits. Current package notes and checksum are in [v0.22.0 release notes](releases/v0.22.0.md).

## Development

```bash
node --test tests/*.test.js
python3 tools/build-release.py
```

`plugin.js` loads the consolidated `plugin-core.js` and separate feature modules. The builder creates a deterministic ZIP with verified file contents and executable modes. Wiki sources live in `docs/wiki/`; the maintainer publishing/cleanup procedure is in [docs/PUBLISHING.md](docs/PUBLISHING.md).
