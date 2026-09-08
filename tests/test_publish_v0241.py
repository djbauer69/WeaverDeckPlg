import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('publisher241', ROOT / 'tools/publish-v0.24.1.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
ZIP = ROOT.parent / p.ASSET


def source_tree():
    # Build the fixture from source, not the ZIP, to detect mismatched packages.
    entries = []
    for file in (ROOT / 'com.pipeweaver.opendeck.sdPlugin').rglob('*'):
        if file.is_file():
            data = file.read_bytes()
            entries.append({'path': file.relative_to(ROOT).as_posix(), 'type': 'blob',
                            'mode': '100755' if file.name in ('plugin.js', 'plugin-core.js') else '100644',
                            'sha': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()})
    return {'tree': entries}


class PublisherTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # A checkout can reproduce the release without downloading a binary.
        import subprocess
        cls.temp = tempfile.TemporaryDirectory()
        cls.zip = Path(cls.temp.name) / p.ASSET
        subprocess.run(['python3', str(ROOT / 'tools/build-release.py'), str(cls.zip)], check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_final_zip_matches_source_and_rejects_wrong_checksum(self):
        p.verify_zip(self.zip, source_tree())
        wrong = Path(self.temp.name) / 'wrong.zip'
        wrong.write_bytes(b'wrong build')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            p.verify_zip(wrong)

    def test_source_mode_change_is_rejected(self):
        tree = source_tree()
        tree['tree'][0]['mode'] = '100777'
        with self.assertRaisesRegex(ValueError, 'mode differ'):
            p.verify_zip(self.zip, tree)

    def test_existing_wrong_tag_is_not_moved(self):
        with patch.object(p, 'api', return_value=[{'ref': 'refs/tags/v0.24.1', 'object': {'type': 'commit', 'sha': 'b' * 40}}]):
            with self.assertRaisesRegex(ValueError, 'points elsewhere'):
                p.check_tag('a' * 40)

    def simulate(self, bad_download=False):
        events = []
        def api(path):
            if path.startswith('git/trees/'): return source_tree()
            if path.startswith('compare/'): return {'status': 'identical'}
            if path == 'releases/tags/v0.24.1': return {'id': 241}
            if path.startswith('releases/241/assets'): return []
            if path == 'releases/latest': return {'tag_name': p.TAG, 'draft': False, 'prerelease': False, 'html_url': 'release-url'}
            raise AssertionError(path)
        def run(args, cwd=None):
            events.append(args)
            if args[1] == 'api':
                created = any(e[:3] == ['gh', 'release', 'create'] for e in events)
                return json.dumps([[{'id': 241, 'tag_name': p.TAG}]] if created else [[]])
            if args[1:3] == ['release', 'download']:
                out = Path(args[args.index('--dir') + 1]) / p.ASSET
                if bad_download: out.write_bytes(b'incomplete download')
                else: shutil.copyfile(self.zip, out)
            return ''
        def git(*args, cwd=None):
            events.append(['git', *args])
            if args[0] == 'clone': Path(args[-1]).mkdir()
            if args[:3] == ('diff', '--cached', '--name-only'): return 'Home.md'
            return ''
        with patch.object(p, 'api', side_effect=api), patch.object(p, 'content', return_value=b'updated docs'), \
             patch.object(p, 'run', side_effect=run), patch.object(p, 'git', side_effect=git), \
             patch.object(p, 'check_tag', side_effect=[False, False, True]):
            if bad_download:
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    p.publish(self.zip, 'a' * 40)
            else:
                p.publish(self.zip, 'a' * 40)
        return events

    def test_publish_verifies_download_before_wiki_push_and_latest(self):
        events = self.simulate()
        download = next(i for i, e in enumerate(events) if e[:3] == ['gh', 'release', 'download'])
        push = next(i for i, e in enumerate(events) if e[:2] == ['git', 'push'])
        edit = next(i for i, e in enumerate(events) if e[:3] == ['gh', 'release', 'edit'])
        self.assertLess(download, push)
        self.assertLess(push, edit)
        self.assertIn('--latest', events[edit])
        self.assertIn('--prerelease=false', events[edit])
        self.assertFalse(any('delete' in e or '--force' in e or '--clobber' in e for e in events))

    def test_corrupt_upload_never_publishes_wiki_or_release(self):
        events = self.simulate(bad_download=True)
        self.assertFalse(any(e[:2] == ['git', 'push'] or e[:3] == ['gh', 'release', 'edit'] for e in events))
