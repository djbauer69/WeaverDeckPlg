#!/usr/bin/env python3
"""Install grouped WeaverDeck actions with a backed-up OpenDeck profile migration.

Fully quit OpenDeck first. Default is preview; --apply installs the bundled ZIP.
"""
import argparse
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile

PLUGIN = 'com.pipeweaver.opendeck.sdPlugin'


def convert_profile(profile, catalog, manifest):
    result = copy.deepcopy(profile)
    mapping = {o['uuid']: g for g in catalog['groups'] for o in g['operations']}
    grouped = {a['UUID']: a for a in manifest['Actions']}
    count = 0
    def visit(instance):
        nonlocal count
        if instance is None: return
        if not isinstance(instance, dict) or not isinstance(instance.get('action'), dict):
            raise ValueError('Unrecognized action instance; profile was not changed.')
        action = instance['action']
        uuid = action.get('uuid')
        if action.get('plugin') == PLUGIN and uuid in mapping:
            group = mapping[uuid]
            template = grouped[group['uuid']]
            settings = instance.get('settings')
            if not isinstance(settings, dict):
                raise ValueError('WeaverDeck settings are not an object; profile was not changed.')
            # Keep all original fields. Add a group operation and flatten only
            # the descriptors previously nested by Fade actions.
            settings['operation'] = uuid
            if uuid.endswith('volumefade'):
                if group['name'] == 'Application':
                    app = settings.get('application') or {}
                    for key in ('name', 'process', 'deviceType'): settings[key] = app.get(key, '')
                if group['name'].startswith('Physical '):
                    device = settings.get('device') or {}
                    settings['deviceId'] = device.get('id', '')
                    settings['deviceName'] = device.get('name', '')
                if settings.get('milliseconds') is None and settings.get('seconds') is not None:
                    settings['milliseconds'] = round(float(settings['seconds']) * 1000)
            action.update(uuid=group['uuid'], name=group['name'], tooltip=template['Tooltip'],
                          property_inspector=f'plugins/{PLUGIN}/propertyInspector/grouped.html',
                          controllers=template['Controllers'], disable_automatic_states=True,
                          visible_in_action_list=True, supported_in_multi_actions=True)
            # Preserve host-parsed Encoder layouts on existing dials. OpenDeck
            # can initialize a missing layout from the new manifest if needed.
            count += 1
        children = instance.get('children')
        if children is not None:
            if not isinstance(children, list): raise ValueError('Unrecognized child actions.')
            for child in children: visit(child)
    if not isinstance(result, dict) or not isinstance(result.get('keys'), list) or not isinstance(result.get('sliders'), list):
        raise ValueError('Unrecognized OpenDeck profile format; nothing was installed.')
    for field in ('keys', 'sliders', 'infobars'):
        slots = result.get(field, [])
        if not isinstance(slots, list): raise ValueError('Unrecognized profile slots.')
        for instance in slots: visit(instance)
    return result, count


def opendeck_running():
    # Read this user's process names only. Never stop a process automatically.
    proc = Path('/proc')
    if not proc.is_dir(): raise RuntimeError('This installer requires Linux /proc.')
    for entry in proc.iterdir():
        if not entry.name.isdigit(): continue
        try:
            if entry.stat().st_uid != os.getuid(): continue
            name = (entry / 'comm').read_text().strip().lower()
            if 'opendeck' in name: return True
        except (OSError, ProcessLookupError): pass
    return False


def atomic_write(path, data, mode):
    fd, temporary = tempfile.mkstemp(prefix='.weaverdeck-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def install(config, package, *, apply=False):
    config = config.expanduser().resolve()
    if opendeck_running(): raise RuntimeError('Fully quit OpenDeck, including its tray process, then rerun.')
    if not (config / 'profiles').is_dir() or not (config / 'plugins').is_dir():
        raise ValueError('Expected profiles/ and plugins/ in the selected OpenDeck config directory. Use --config for another installation.')
    with zipfile.ZipFile(package) as archive:
        if archive.testzip() is not None: raise ValueError('Corrupt plugin ZIP.')
        records = archive.infolist()
        for info in records:
            parts = Path(info.filename).parts
            if not parts or parts[0] != PLUGIN or '..' in parts or Path(info.filename).is_absolute(): raise ValueError('Unexpected ZIP path.')
            if info.external_attr >> 16 & 0o170000 not in (0, 0o100000, 0o040000): raise ValueError('ZIP contains a non-regular entry.')
        manifest = json.loads(archive.read(PLUGIN + '/manifest.json'))
        catalog = json.loads(archive.read(PLUGIN + '/action-catalog.json'))
        if manifest['Version'] != '0.23.0': raise ValueError('This upgrade is pinned to v0.23.0.')
        # ZIP checksum is recorded in the bundle beside this installer.
        checksum = package.with_suffix('.sha256')
        if not checksum.is_file() or hashlib.sha256(package.read_bytes()).hexdigest() != checksum.read_text().split()[0]:
            raise ValueError('Missing/mismatched plugin checksum.')
        changes = []
        for path in sorted((config / 'profiles').rglob('*.json')):
            if path.is_symlink(): raise ValueError('Symlinked profile found; review it before migration.')
            before = path.read_bytes()
            try:
                document = json.loads(before)
                # OpenDeck's DeviceStores saves profiles/<device>.json with
                # selected_profile; actual DiskProfiles live below device/.
                # Skip only this known metadata shape at the metadata location.
                if (path.parent == config / 'profiles' and isinstance(document, dict)
                        and isinstance(document.get('selected_profile'), str)
                        and not any(key in document for key in ('keys', 'sliders', 'infobars'))):
                    continue
                converted, count = convert_profile(document, catalog, manifest)
            except ValueError as error:
                raise ValueError(f'{path.relative_to(config)}: {error}') from error
            if count: changes.append((path, before, (json.dumps(converted, ensure_ascii=False, indent=2)+'\n').encode(), count, path.stat().st_mode & 0o777))
        print(f'OpenDeck config: {config}\nConvert {sum(c[3] for c in changes)} buttons/dials across {len(changes)} profiles.\nInstall WeaverDeck v0.23.0 with 12 sidebar actions.')
        if not apply:
            print('Preview only. Rerun with --apply to back up, convert and install.'); return
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        backup = config / 'weaverdeck-backups' / stamp
        backup.mkdir(parents=True)
        for path, before, _, _, mode in changes:
            target = backup / path.relative_to(config); target.parent.mkdir(parents=True, exist_ok=True)
            atomic_write(target, before, mode)
        current = config / 'plugins' / PLUGIN
        if current.is_symlink(): raise ValueError('Symlinked plugin directory; review before installation.')
        saved = backup / 'plugins' / PLUGIN
        if current.exists():
            saved.parent.mkdir(parents=True, exist_ok=True); shutil.copytree(current, saved)
        (backup / 'README.txt').write_text('Rollback: fully quit OpenDeck. Restore the profiles/ files to your config profiles/ directory and replace the installed plugin with this backup plugins/com.pipeweaver.opendeck.sdPlugin. Keep your current files separately until rollback is verified.\n')
        print(f'Backup: {backup}')
        with tempfile.TemporaryDirectory(prefix='.weaverdeck-install-', dir=config / 'plugins') as staging:
            archive.extractall(staging)
            for info in records:
                p = Path(staging) / info.filename
                if p.is_file(): p.chmod(0o755 if p.name in ('plugin.js', 'plugin-core.js') else 0o644)
            # Recheck before the first mutation: all work above is preparatory.
            if opendeck_running(): raise RuntimeError('OpenDeck was started during preparation. Quit it and rerun.')
            if any(path.read_bytes() != before for path, before, *_ in changes): raise RuntimeError('A profile changed during preparation. Nothing was installed.')
            retired = Path(staging) / 'previous-plugin'
            installed = False
            written = []
            try:
                if current.exists(): os.replace(current, retired)
                os.replace(Path(staging) / PLUGIN, current); installed = True
                for path, before, after, _, mode in changes:
                    atomic_write(path, after, mode); written.append((path, before, mode))
            except BaseException:
                for path, before, mode in reversed(written): atomic_write(path, before, mode)
                if installed: shutil.rmtree(current)
                if retired.exists(): os.replace(retired, current)
                raise
    print('Upgrade complete. Start OpenDeck and test the grouped actions. Your backup is retained.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--config', type=Path, default=Path(os.environ.get('XDG_CONFIG_HOME', str(Path.home()/'.config'))) / 'opendeck')
    parser.add_argument('--zip', type=Path, default=Path(__file__).resolve().parent / 'pipeweaver-opendeck-plugin-v0.23.0.zip')
    args = parser.parse_args(); install(args.config, args.zip, apply=args.apply)


if __name__ == '__main__':
    try: main()
    except (ValueError, RuntimeError, OSError, zipfile.BadZipFile) as error:
        print('Stopped: ' + str(error), file=sys.stderr); sys.exit(1)
