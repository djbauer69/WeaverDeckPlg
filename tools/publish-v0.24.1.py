#!/usr/bin/env python3
"""Publish v0.24.1 and its wiki with the maintainer's gh login. No cleanup.

Requires a full merged commit SHA and the final ZIP. Without --apply, only
checks the local ZIP and prints the plan. Never installs or edits OpenDeck.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

REPO = 'djbauer69/WeaverDeckPlg'
TAG = 'v0.24.1'
ASSET = 'pipeweaver-opendeck-plugin-v0.24.1.zip'
SHA256 = '9c9adc5c6c0fa29c5b674aa1b4e34832ce4e2ffe49e04c38a94895a870cb4734'
PAGES = ('Home.md', 'Actions.md', 'Version-History.md', 'Communication.md', '_Sidebar.md')


def run(args, cwd=None, data=None):
    r = subprocess.run(args, cwd=cwd, input=data, text=True, capture_output=True)
    if r.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(map(str, args)) + '\n' + r.stderr.strip())
    return r.stdout


def api(path, *, method='GET', payload=None):
    args = ['gh', 'api', '--hostname', 'github.com', f'repos/{REPO}/{path}',
            '--method', method, '-H', 'Cache-Control: no-cache']
    if payload is not None:
        args += ['--input', '-']
    return json.loads(run(args, data=json.dumps(payload) if payload is not None else None))


def validate_release(release, ref, tagged):
    if not isinstance(release, dict) or not isinstance(release.get('id'), int) or release['id'] <= 0 or release.get('tag_name') != TAG:
        raise ValueError('Unexpected release identity; stopped without editing it.')
    if not tagged and (not release.get('draft') or release.get('target_commitish') != ref):
        raise ValueError('Existing release target is unexpected; stopped without editing it.')


def content(path, ref):
    obj = api(f'contents/{path}?ref={ref}')
    if obj.get('encoding') != 'base64':
        raise ValueError('Unsupported source encoding: ' + path)
    return base64.b64decode(obj['content'])


def verify_zip(path, tree=None):
    if hashlib.sha256(path.read_bytes()).hexdigest() != SHA256:
        raise ValueError('ZIP checksum differs. Download the final v0.24.1 ZIP and check --zip path.')
    with zipfile.ZipFile(path) as z:
        if z.testzip() is not None:
            raise ValueError('Damaged ZIP.')
        files = {i.filename: i for i in z.infolist()}
        prefix = 'com.pipeweaver.opendeck.sdPlugin/'
        if len(files) != len(z.infolist()) or any(not n.startswith(prefix) or '..' in Path(n).parts for n in files):
            raise ValueError('Unexpected ZIP paths.')
        if json.loads(z.read(prefix + 'manifest.json'))['Version'] != '0.24.1':
            raise ValueError('Wrong manifest version.')
        if tree is not None:
            if tree.get('truncated'):
                raise ValueError('Incomplete source tree.')
            expected = {e['path']: e for e in tree['tree'] if e['type'] == 'blob' and e['path'].startswith(prefix)}
            if set(expected) != set(files):
                raise ValueError('ZIP/source file lists differ.')
            for name, info in files.items():
                data = z.read(info)
                sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
                if expected[name]['sha'] != sha or expected[name]['mode'] != format(info.external_attr >> 16, 'o'):
                    raise ValueError('ZIP/source bytes or mode differ: ' + name)


def check_tag(ref):
    matches = api(f'git/matching-refs/tags/{TAG}')
    exact = next((x for x in matches if x['ref'] == 'refs/tags/' + TAG), None)
    if exact:
        obj = exact['object']
        for _ in range(5):
            if obj['type'] != 'tag':
                break
            obj = api('git/tags/' + obj['sha'])['object']
        if obj['type'] != 'commit' or obj['sha'] != ref:
            raise ValueError('Existing v0.24.1 tag points elsewhere; stopped without moving it.')
    return exact is not None


def git(*args, cwd=None):
    return run(['git', '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', *args], cwd)


def publish(zip_path, ref, release_id=None):
    verify_zip(zip_path, api(f'git/trees/{ref}?recursive=1'))
    ancestry = api(f'compare/{ref}...main')
    if ancestry['status'] not in ('identical', 'ahead'):
        raise ValueError('Release source is not merged into main.')
    tagged = check_tag(ref)
    pages = {name: content('docs/wiki/' + name, ref) for name in PAGES}
    notes = content('releases/' + TAG + '.md', ref)
    if release_id is not None:
        release = api(f'releases/{release_id}')
        if release.get('id') != release_id:
            raise ValueError('GitHub returned a different release ID.')
    else:
        releases = json.loads(run(['gh', 'api', '--hostname', 'github.com', f'repos/{REPO}/releases',
                                  '-H', 'Cache-Control: no-cache', '--paginate', '--slurp']))
        matches = [r for page in releases for r in page if r.get('tag_name') == TAG]
        if len(matches) > 1:
            raise ValueError('Multiple v0.24.1 releases found; use --release-id for the intended draft.')
        release = matches[0] if matches else None
    if release is not None:
        validate_release(release, ref, tagged)
    with tempfile.TemporaryDirectory(prefix='weaverdeck-publish-') as temp:
        work = Path(temp)
        wiki = work / 'wiki'
        print('Preparing wiki... ', flush=True)
        git('clone', f'https://github.com/{REPO}.wiki.git', str(wiki))
        for name, data in pages.items():
            (wiki / name).write_bytes(data)
        git('add', '--', *PAGES, cwd=wiki)
        changed = bool(git('diff', '--cached', '--name-only', cwd=wiki).strip())
        if changed:
            git('-c', 'user.name=WeaverDeck documentation publisher', '-c', 'user.email=weaverdeck-publisher@users.noreply.github.com',
                '-c', 'commit.gpgsign=false', 'commit', '-m', 'Document WeaverDeck v0.24.1 actions and version history', cwd=wiki)
        note_path = work / 'release-notes.md'
        note_path.write_bytes(notes)
        upload = work / ASSET
        shutil.copyfile(zip_path, upload)
        if not release:
            # Use the creation response itself. The releases collection can lag
            # behind a successful write and must not be used to rediscover it.
            release = api('releases', method='POST', payload={
                'tag_name': TAG, 'target_commitish': ref, 'draft': True, 'prerelease': False,
                'name': 'WeaverDeck v0.24.1', 'body': notes.decode('utf-8')})
            validate_release(release, ref, tagged)
        print(f"Using release ID {release['id']}. If interrupted, rerun with --release-id {release['id']}.", flush=True)
        # Reruns reuse the identical asset; never clobber an unexpected upload.
        assets = api(f"releases/{release['id']}/assets?per_page=100")
        if not any(a['name'] == ASSET for a in assets):
            run(['gh', 'release', 'upload', TAG, str(upload), '--repo', REPO])
        downloaded = work / 'downloaded'
        downloaded.mkdir()
        run(['gh', 'release', 'download', TAG, '--repo', REPO, '--pattern', ASSET, '--dir', str(downloaded)])
        verify_zip(downloaded / ASSET)
        # No force push. Concurrent wiki edits cause a safe stop and can be retried.
        if changed:
            git('push', 'origin', 'HEAD', cwd=wiki)
        check_tag(ref)
        run(['gh', 'release', 'edit', TAG, '--repo', REPO, '--draft=false', '--prerelease=false', '--latest',
             '--title', 'WeaverDeck v0.24.1', '--notes-file', str(note_path)])
        if not check_tag(ref):
            raise ValueError('Published tag is missing.')
        latest = api('releases/latest')
        if latest['tag_name'] != TAG or latest['draft'] or latest['prerelease']:
            raise ValueError('Latest release verification failed.')
        print('Wiki updated. WeaverDeck v0.24.1 is the latest stable release; ZIP download checksum verified.')
        print(latest['html_url'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', required=True, type=Path)
    parser.add_argument('--ref', required=True, help='Full merged commit SHA supplied with this build')
    parser.add_argument('--release-id', type=int, help='Resume a known draft by its GitHub release ID')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.ref):
        raise ValueError('--ref must be a full 40-character commit SHA.')
    if args.release_id is not None and args.release_id <= 0:
        raise ValueError('--release-id must be a positive integer.')
    path = args.zip.expanduser().resolve()
    verify_zip(path)
    print(f'{REPO}: publish five wiki pages and {TAG} as latest stable. Preserve other releases/tags.', flush=True)
    if args.apply:
        publish(path, args.ref, args.release_id)
    else:
        print('ZIP verified. Add --apply to publish using your gh login.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, zipfile.BadZipFile, KeyError) as exc:
        sys.exit('Stopped: ' + str(exc))
