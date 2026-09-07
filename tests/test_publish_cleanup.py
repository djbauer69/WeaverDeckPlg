"""Offline checks for the maintainer's destructive cleanup guards."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('publish_cleanup', ROOT / 'tools/publish-wiki-and-cleanup.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
PLAN = json.loads((ROOT / 'tools/github-cleanup-plan.json').read_text())


def inventory():
    releases = [{'id': r['id'], 'tag_name': r['tag']} for r in PLAN['delete_releases']]
    releases += [{'id': 383587973, 'tag_name': PLAN['keep_tag']}]
    tags = [{'ref': t['ref'], 'object': {'sha': t['sha'], 'type': t['type']}} for t in PLAN['delete_tags']]
    tags += [{'ref': 'refs/tags/' + PLAN['keep_tag'], 'object': {'sha': PLAN['target_sha'], 'type': 'commit'}}]
    return releases, tags


class CleanupGuards(unittest.TestCase):
    def test_repository_endpoint_has_no_trailing_slash(self):
        with patch.object(publisher, 'run', return_value='{"has_wiki": true}') as run:
            self.assertTrue(publisher.api(PLAN['repository'], '')['has_wiki'])
        self.assertEqual(run.call_args.args[0][4], 'repos/djbauer69/WeaverDeckPlg')
        with patch.object(publisher, 'run', return_value='[]') as run:
            publisher.api(PLAN['repository'], 'git/matching-refs/tags/')
        self.assertEqual(run.call_args.args[0][4], 'repos/djbauer69/WeaverDeckPlg/git/matching-refs/tags/')

    def test_rejects_deleting_retained_release_or_tag(self):
        for field, value in [('delete_releases', {'id': 383587973, 'tag': 'v0.22.0'}),
                             ('delete_tags', {'ref': 'refs/tags/v0.22.0', 'sha': PLAN['target_sha'], 'type': 'commit'})]:
            plan = copy.deepcopy(PLAN)
            plan[field].append(value)
            with self.assertRaises(ValueError):
                publisher.check_plan(plan)

    def test_unknown_release_or_tag_and_moved_tag_are_rejected(self):
        releases, tags = inventory()
        publisher.check_inventory(PLAN, releases, tags)
        with self.assertRaises(ValueError):
            publisher.check_inventory(PLAN, releases + [{'id': 999, 'tag_name': 'v0.23.0'}], tags)
        with self.assertRaises(ValueError):
            publisher.check_inventory(PLAN, releases, tags + [{'ref': 'refs/tags/new', 'object': {'sha': 'x', 'type': 'commit'}}])
        changed = copy.deepcopy(tags)
        changed[0]['object']['sha'] = 'moved'
        with self.assertRaises(ValueError):
            publisher.check_inventory(PLAN, releases, changed)
        changed = copy.deepcopy(tags)
        changed[-1]['object']['sha'] = 'unexpected'
        with self.assertRaises(ValueError):
            publisher.check_inventory(PLAN, releases, changed)

    def test_unknown_inventory_stops_before_any_deletion(self):
        releases, tags = inventory()
        releases.append({'id': 999, 'tag_name': 'v0.23.0'})
        calls = []
        def api(repo, path, **kw):
            calls.append((path, kw.get('method', 'GET')))
            return releases if path.startswith('releases?') else tags
        with patch.object(publisher, 'api', api), self.assertRaises(ValueError):
            publisher.cleanup(PLAN)
        self.assertTrue(all(method == 'GET' for _, method in calls))

    def test_cleanup_deletes_only_inventory_and_can_resume(self):
        releases, tags = inventory()
        releases.pop(0)  # Simulate an earlier successful deletion.
        tags.pop(0)
        calls = []
        def api(repo, path, *, method='GET', **kw):
            self.assertEqual(repo, PLAN['repository'])
            calls.append((path, method))
            if path.startswith('releases?'):
                return copy.deepcopy(releases)
            if path == 'git/matching-refs/tags/':
                return copy.deepcopy(tags)
            if path.startswith('releases/'):
                item = next(r for r in releases if r['id'] == int(path.split('/')[-1]))
                if method == 'DELETE':
                    self.assertNotEqual(item['tag_name'], 'v0.22.0')
                    releases.remove(item)
                    return None
                return copy.deepcopy(item)
            ref = 'refs/' + path.split('/', 2)[2]
            item = next(t for t in tags if t['ref'] == ref)
            if method == 'DELETE':
                self.assertNotEqual(ref, 'refs/tags/v0.22.0')
                tags.remove(item)
                return None
            return copy.deepcopy(item)
        with patch.object(publisher, 'api', api), patch('builtins.print'):
            publisher.cleanup(PLAN)
            before = len([c for c in calls if c[1] == 'DELETE'])
            publisher.cleanup(PLAN)
        self.assertEqual(before, len(PLAN['delete_releases']) + len(PLAN['delete_tags']) - 2)
        self.assertEqual(before, len([c for c in calls if c[1] == 'DELETE']))
        self.assertEqual([r['tag_name'] for r in releases], ['v0.22.0'])
        self.assertEqual([t['ref'] for t in tags], ['refs/tags/v0.22.0'])

    def test_wiki_failure_prevents_release_and_cleanup(self):
        releases, tags = inventory()
        def api(repo, path, **kw):
            if path.startswith('releases?'): return releases
            if path.startswith('git/matching'): return tags
            if path.startswith('git/trees'): return {'tree': []}
            if path.startswith('releases/tags'): return {'immutable': False}
            return {'has_wiki': True}
        # Local-only mocks: no subprocess, HTTP or Git writes are performed.
        with patch('sys.argv', ['publish', '--apply']), patch.object(publisher, 'run'), \
             patch.object(publisher.shutil, 'which', return_value='/mock/tool'), \
             patch.object(publisher, 'api', api), patch.object(publisher, 'verify_zip'), \
             patch.object(publisher, 'publish_wiki', side_effect=RuntimeError('wiki unavailable')), \
             patch.object(publisher, 'publish_release') as release, \
             patch.object(publisher, 'cleanup') as cleanup, patch('builtins.print'):
            with self.assertRaises(RuntimeError): publisher.main()
        release.assert_not_called()
        cleanup.assert_not_called()

    def test_failed_package_publication_prevents_cleanup(self):
        releases, tags = inventory()
        def api(repo, path, **kw):
            if path.startswith('releases?'): return releases
            if path.startswith('git/matching'): return tags
            if path.startswith('git/trees'): return {'tree': []}
            if path.startswith('releases/tags'): return {'immutable': False}
            return {'has_wiki': True}
        with patch('sys.argv', ['publish', '--apply']), patch.object(publisher, 'run'), \
             patch.object(publisher.shutil, 'which', return_value='/mock/tool'), \
             patch.object(publisher, 'api', api), patch.object(publisher, 'verify_zip'), \
             patch.object(publisher, 'publish_wiki'), \
             patch.object(publisher, 'publish_release', side_effect=RuntimeError('checksum mismatch')), \
             patch.object(publisher, 'cleanup') as cleanup, patch('builtins.print'):
            with self.assertRaises(RuntimeError): publisher.main()
        cleanup.assert_not_called()


if __name__ == '__main__':
    unittest.main()
