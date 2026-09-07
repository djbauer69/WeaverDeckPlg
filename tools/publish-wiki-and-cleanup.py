#!/usr/bin/env python3
"""Publish the prepared wiki/package and apply the recorded release/tag cleanup.

Default: local preview only. --apply uses the user's authenticated GitHub CLI.
No credentials are read by this script; gh handles authentication.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote
import zipfile

ROOT = Path(__file__).resolve().parents[1]
WIKI_FILES = ('Home.md', 'Actions.md', 'Version-History.md', 'Communication.md', '_Sidebar.md')


def run(args, *, cwd=None, data=None):
    result = subprocess.run(args, cwd=cwd, input=data, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Command failed: {' '.join(args)}\n{result.stderr.strip()}")
    return result.stdout


def api(repo, path, *, method='GET', payload=None, pages=False):
    endpoint = f'repos/{repo}' + (f'/{path}' if path else '')
    args = ['gh', 'api', '--hostname', 'github.com', endpoint, '--method', method]
    if pages:
        args += ['--paginate', '--slurp']
    if payload is not None:
        args += ['--input', '-']
    raw = run(args, data=json.dumps(payload) if payload is not None else None)
    value = json.loads(raw) if raw.strip() else None
    return [item for page in value for item in page] if pages else value


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_plan(plan):
    if plan['repository'] != 'djbauer69/WeaverDeckPlg' or plan['keep_tag'] != 'v0.22.0':
        raise ValueError('This publisher is restricted to WeaverDeck v0.22.0.')
    releases = plan['delete_releases']
    tags = plan['delete_tags']
    if any(r['tag'] == plan['keep_tag'] for r in releases):
        raise ValueError('Refusing to delete the retained release.')
    if any(t['ref'] == 'refs/tags/' + plan['keep_tag'] for t in tags):
        raise ValueError('Refusing to delete the retained tag.')
    if len({r['id'] for r in releases}) != len(releases) or len({t['ref'] for t in tags}) != len(tags):
        raise ValueError('Duplicate cleanup entries.')


def check_inventory(plan, releases, tags):
    allowed_releases = {r['id']: r['tag'] for r in plan['delete_releases']}
    allowed_tags = {t['ref']: (t['sha'], t['type']) for t in plan['delete_tags']}
    for r in releases:
        if r['tag_name'] != plan['keep_tag'] and allowed_releases.get(r['id']) != r['tag_name']:
            raise ValueError('Release inventory changed; review before deleting: ' + r['tag_name'])
    for t in tags:
        if t['ref'] == 'refs/tags/' + plan['keep_tag']:
            if t['object']['type'] != 'commit' or t['object']['sha'] not in (plan['expected_old_tag_sha'], plan['target_sha']):
                raise ValueError('v0.22.0 tag moved unexpectedly; review before publishing.')
        elif allowed_tags.get(t['ref']) != (t['object']['sha'], t['object']['type']):
            raise ValueError('Tag inventory changed; review before deleting: ' + t['ref'])


def verify_zip(path, expected_sha, remote_tree=None):
    if sha256(path) != expected_sha:
        raise ValueError('ZIP checksum mismatch: ' + str(path))
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError('Corrupt plugin ZIP.')
        files = {i.filename: i for i in archive.infolist() if not i.is_dir()}
        if len(files) != len(archive.infolist()):
            raise ValueError('Unexpected or duplicate ZIP entry.')
        prefix = 'com.pipeweaver.opendeck.sdPlugin/'
        if any(not n.startswith(prefix) or '..' in Path(n).parts for n in files):
            raise ValueError('Unexpected plugin ZIP path.')
        manifest = json.loads(archive.read(prefix + 'manifest.json'))
        if manifest['Version'] != '0.22.0':
            raise ValueError('Wrong plugin version.')
        if remote_tree is not None:
            if remote_tree.get('truncated'):
                raise ValueError('Incomplete GitHub source tree.')
            entries = {e['path']: e for e in remote_tree['tree'] if e['type'] == 'blob' and e['path'].startswith(prefix)}
            if set(entries) != set(files):
                raise ValueError('ZIP/source file lists differ.')
            for name, info in files.items():
                data = archive.read(info)
                blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
                if entries[name]['sha'] != blob or entries[name]['mode'] != format(info.external_attr >> 16, 'o'):
                    raise ValueError('ZIP/source bytes or mode differ: ' + name)


def git(*args, cwd=None):
    # Use gh's normal credential-helper interface, scoped to this invocation.
    return run(['git', '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', *args], cwd=cwd)


def publish_wiki(repo, workspace):
    checkout = workspace / 'wiki'
    try:
        git('clone', f'https://github.com/{repo}.wiki.git', str(checkout))
    except RuntimeError as error:
        raise RuntimeError('Wiki clone failed. If the wiki has never been used, open '
                           f'https://github.com/{repo}/wiki and create/save a Home page first, '
                           'then rerun this script. No release or tag has been changed.\n' + str(error))
    branch = git('branch', '--show-current', cwd=checkout).strip()
    if not branch:
        raise RuntimeError('Wiki has no default branch. Create a Home page on GitHub first.')
    for name in WIKI_FILES:
        shutil.copyfile(ROOT / 'docs/wiki' / name, checkout / name)
    git('add', '--', *WIKI_FILES, cwd=checkout)
    if git('diff', '--cached', '--name-only', cwd=checkout).strip():
        git('-c', 'user.name=djbauer69', '-c', 'user.email=113255748+djbauer69@users.noreply.github.com',
            'commit', '-m', 'Document WeaverDeck actions, version history and communication', cwd=checkout)
        git('push', 'origin', f'HEAD:refs/heads/{branch}', cwd=checkout)
    remote = git('ls-remote', 'origin', f'refs/heads/{branch}', cwd=checkout).split()[0]
    if remote != git('rev-parse', 'HEAD', cwd=checkout).strip():
        raise RuntimeError('Wiki push could not be verified.')
    print('Wiki published and verified.')


def download_asset(repo, tag, name, destination):
    run(['gh', 'release', 'download', tag, '--repo', repo, '--pattern', name, '--dir', str(destination)])
    return destination / name


def publish_release(plan, package, workspace):
    repo, tag = plan['repository'], plan['keep_tag']
    release = api(repo, f'releases/tags/{tag}')
    if release.get('immutable'):
        raise RuntimeError('GitHub marks v0.22.0 immutable; its package/tag cannot be replaced.')
    canonical = next((a for a in release['assets'] if a['name'] == plan['zip_name']), None)
    correct = False
    if canonical:
        old_dir = workspace / 'previous-current'
        old_dir.mkdir()
        old_path = download_asset(repo, tag, canonical['name'], old_dir)
        digest = sha256(old_path)
        allowed = {plan['zip_sha256'], '9b4ebc37f92f59fecd881a7f3e571286c221ca36acd8b89021756fa98ac59ba0'}
        if digest not in allowed:
            raise RuntimeError('Published v0.22.0 asset changed unexpectedly; review before replacing.')
        correct = digest == plan['zip_sha256']
        if not correct:
            backup = ROOT / 'cleanup-backup'
            backup.mkdir(exist_ok=True)
            shutil.copyfile(old_path, backup / ('previous-' + digest[:12] + '-' + canonical['name']))
    staged = None
    if not correct:
        staged_name = 'pipeweaver-opendeck-plugin-v0.22.0-verified-c60ab275.zip'
        staged = next((a for a in release['assets'] if a['name'] == staged_name), None)
        if staged is None:
            staging = workspace / staged_name
            shutil.copyfile(package, staging)
            run(['gh', 'release', 'upload', tag, str(staging), '--repo', repo])
        check_dir = workspace / 'check-staged'
        check_dir.mkdir()
        verify_zip(download_asset(repo, tag, staged_name, check_dir), plan['zip_sha256'])
        release = api(repo, f'releases/tags/{tag}')
        staged = next(a for a in release['assets'] if a['name'] == staged_name)
        current = next((a for a in release['assets'] if a['name'] == plan['zip_name']), None)
        if (current or {}).get('id') != (canonical or {}).get('id'):
            raise RuntimeError('The canonical asset changed during upload; review before replacing.')
    ref = api(repo, f'git/ref/tags/{tag}')
    if ref['object']['type'] != 'commit' or ref['object']['sha'] not in (plan['expected_old_tag_sha'], plan['target_sha']):
        raise RuntimeError('v0.22.0 tag moved during preparation; stopped.')
    if ref['object']['sha'] != plan['target_sha']:
        api(repo, f'git/refs/tags/{tag}', method='PATCH', payload={'sha': plan['target_sha'], 'force': True})
    if not correct:
        if canonical:
            api(repo, f"releases/assets/{canonical['id']}", method='DELETE')
        api(repo, f"releases/assets/{staged['id']}", method='PATCH', payload={'name': plan['zip_name']})
    api(repo, f"releases/{release['id']}", method='PATCH', payload={
        'name': 'WeaverDeck v0.22.0', 'body': (ROOT / 'releases/v0.22.0.md').read_text(),
        'draft': False, 'prerelease': False, 'make_latest': 'true'})
    final_dir = workspace / 'check-final'
    final_dir.mkdir()
    verify_zip(download_asset(repo, tag, plan['zip_name'], final_dir), plan['zip_sha256'])
    final = api(repo, f'releases/tags/{tag}')
    if final['draft'] or final['prerelease'] or api(repo, 'releases/latest')['id'] != final['id']:
        raise RuntimeError('Could not verify v0.22.0 is stable/latest.')
    print('v0.22.0 tag, stable/latest status and replacement ZIP verified.')


def cleanup(plan):
    repo = plan['repository']
    releases = api(repo, 'releases?per_page=100', pages=True)
    tags = api(repo, 'git/matching-refs/tags/')
    check_inventory(plan, releases, tags)
    for wanted in plan['delete_releases']:
        current = next((r for r in releases if r['id'] == wanted['id']), None)
        if current is None:
            continue
        # Recheck the precise release immediately before deletion.
        live = api(repo, f"releases/{wanted['id']}")
        if live['tag_name'] != wanted['tag'] or live['tag_name'] == plan['keep_tag']:
            raise RuntimeError('Release changed before deletion: ' + wanted['tag'])
        api(repo, f"releases/{wanted['id']}", method='DELETE')
        print('Removed release ' + wanted['tag'])
    existing = {t['ref']: t for t in api(repo, 'git/matching-refs/tags/')}
    for wanted in plan['delete_tags']:
        if wanted['ref'] not in existing:
            continue
        suffix = quote(wanted['ref'].removeprefix('refs/'), safe='/')
        live = api(repo, 'git/ref/' + suffix)
        if live['object']['sha'] != wanted['sha'] or live['object']['type'] != wanted['type']:
            raise RuntimeError('Tag moved before deletion: ' + wanted['ref'])
        api(repo, 'git/refs/' + suffix, method='DELETE')
        print('Removed tag ' + wanted['ref'])
    remaining_releases = api(repo, 'releases?per_page=100', pages=True)
    remaining_tags = api(repo, 'git/matching-refs/tags/')
    if [r['tag_name'] for r in remaining_releases] != [plan['keep_tag']]:
        raise RuntimeError('Unexpected remaining release entries; review manually.')
    if [t['ref'] for t in remaining_tags] != ['refs/tags/' + plan['keep_tag']]:
        raise RuntimeError('Unexpected remaining tags; review manually.')
    print('Verified: v0.22.0 is the sole release and tag.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Publish and remove the explicitly inventoried old releases/tags.')
    args = parser.parse_args()
    plan = json.loads((ROOT / 'tools/github-cleanup-plan.json').read_text())
    check_plan(plan)
    for name in WIKI_FILES:
        if not (ROOT / 'docs/wiki' / name).is_file():
            raise ValueError('Missing prepared wiki page: ' + name)
    package = ROOT / plan['zip_name']
    if package.exists():
        verify_zip(package, plan['zip_sha256'])
    print(f"Repository: {plan['repository']}\nPublish: 3 guides, wiki Home/sidebar, tested v0.22.0 ZIP\n"
          f"Remove: {len(plan['delete_releases'])} older releases and {len(plan['delete_tags'])} older tags\n"
          f"Keep: v0.22.0; branches and commit history are not deleted")
    if not args.apply:
        print('Preview only. Pass --apply to perform this plan using your GitHub login.')
        return
    for command in ('gh', 'git'):
        if shutil.which(command) is None:
            raise RuntimeError(f'Install {command} first, then rerun.')
    run(['gh', 'auth', 'status', '--hostname', 'github.com'])
    if not package.exists():
        run([sys.executable, str(ROOT / 'tools/build-release.py'), str(package)])
        verify_zip(package, plan['zip_sha256'])
    repo = plan['repository']
    check_inventory(plan, api(repo, 'releases?per_page=100', pages=True), api(repo, 'git/matching-refs/tags/'))
    tree = api(repo, f"git/trees/{plan['target_sha']}?recursive=1")
    verify_zip(package, plan['zip_sha256'], tree)
    keep = api(repo, 'releases/tags/' + plan['keep_tag'])
    if keep.get('immutable'):
        raise RuntimeError('v0.22.0 is immutable; cannot replace its tag/asset.')
    if not api(repo, '')['has_wiki']:
        raise RuntimeError('Enable Wiki in the repository Settings, create/save its Home page, then rerun.')
    with tempfile.TemporaryDirectory(prefix='weaverdeck-publish-') as folder:
        workspace = Path(folder)
        publish_wiki(repo, workspace)
        publish_release(plan, package, workspace)
        cleanup(plan)
    print(f"Done: https://github.com/{repo}/wiki\nRelease: https://github.com/{repo}/releases/tag/v0.22.0")


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, KeyError, StopIteration) as error:
        print('Stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
