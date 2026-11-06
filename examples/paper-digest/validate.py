"""Offline unit validation of the deployed script, not a Viat/provider integration test."""
import copy
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import types
import unittest

ROOT = Path(__file__).resolve().parent


def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


class NoIO:
    def __getattr__(self, name):
        raise AssertionError('Unexpected external operation: ' + name)


class Http:
    def __init__(self, feed=None, fail=False):
        self.feed, self.fail, self.calls = feed, fail, []

    def get(self, path, **options):
        assert path == '/feed.xml'
        self.calls.append(('GET', path, options))
        return self.feed

    def post(self, path, **options):
        assert path == '/digest'
        self.calls.append(('POST', path, options))
        if self.fail:
            raise RuntimeError('Synthetic lost response; upstream effect unknown')
        return {'accepted': True}


class Model:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def chat(self, messages, **options):
        self.calls.append((messages, options))
        return {'content': json.dumps(self.answer), 'tool_calls': [], 'model': 'synthetic', 'usage': {}}


class Store:
    def __init__(self, path):
        self.connection = sqlite3.connect(path)

    def execute(self, sql, params=None):
        cursor = self.connection.execute(sql, params or {})
        self.connection.commit()
        return max(cursor.rowcount, 0)

    def row(self):
        return self.connection.execute('SELECT state, result_json, delivery_state FROM pd_items').fetchone()

    def close(self):
        self.connection.close()


def script(resources):
    fake = types.ModuleType('viat')
    fake.ctx = types.SimpleNamespace(resources=resources)
    sys.modules['viat'] = fake
    namespace = {'__name__': 'pd_run_under_test'}
    path = ROOT / 'project/scripts/pd_run.py'
    exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'), namespace)
    return types.SimpleNamespace(**namespace)


class DigestTests(unittest.TestCase):
    def setUp(self):
        self.cfg = load('project/resources/pd_settings.yaml')['plain']['data']
        self.resources = types.SimpleNamespace(pd_settings=self.cfg, pd_feed=NoIO(),
                                              pd_model=NoIO(), pd_delivery=NoIO(), pd_store=NoIO())
        self.app = script(self.resources)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)

    def store(self):
        store = Store(str(Path(self.temp.name) / 'ledger.sqlite'))
        self.addCleanup(store.close)
        self.resources.pd_store = store
        self.cfg['durable_enabled'] = True
        return store

    def test_default_shared_fixture(self):
        self.assertEqual(self.app.main(), load('fixtures/expected.json'))
        self.assertFalse(self.cfg['paid_calls_enabled'])
        self.assertFalse(self.cfg['network_enabled'])
        self.assertFalse(self.cfg['delivery_enabled'])

    def test_actual_http_and_model_branch_with_fakes(self):
        self.store()
        self.cfg.update(source_mode='http', network_enabled=True, model_mode='resource', paid_calls_enabled=True)
        feed = Http(self.cfg['fixture_feed'])
        answer = self.cfg['fixture_summaries']['https://papers.example.test/cache']
        model = Model(copy.deepcopy(answer))
        self.resources.pd_feed, self.resources.pd_model = feed, model
        self.assertEqual(self.app.main(), {**load('fixtures/expected.json'), 'durable': True})
        self.assertEqual(len(feed.calls), 1)
        self.assertEqual(len(model.calls), 1)
        self.assertEqual(json.loads(model.calls[0][0][1]['content'])['url'], answer['citations'][0])

    def test_persisted_claim_survives_new_connection(self):
        db = self.store()
        first = self.app.main()
        self.assertTrue(first['durable'])
        other = Store(str(Path(self.temp.name) / 'ledger.sqlite'))
        self.addCleanup(other.close)
        self.resources.pd_store = other
        self.assertEqual(self.app.main()['items'], [])
        self.assertEqual(self.app.main()['skipped'], 1)
        self.assertEqual(db.row()[0], 'ready')
        self.assertEqual(json.loads(db.row()[1]), first['items'][0])

    def test_failed_model_is_held_for_manual_recovery(self):
        db = self.store()
        self.cfg.update(model_mode='resource', paid_calls_enabled=True)
        self.resources.pd_model = Model({'summary': 'Invented citation', 'citations': ['https://wrong.example.test/']})
        with self.assertRaises(ValueError):
            self.app.main()
        self.assertEqual(db.row()[0], 'failed')
        self.assertEqual(self.app.main()['skipped'], 1)
        self.assertEqual(len(self.resources.pd_model.calls), 1)

    def test_uncertain_delivery_is_not_retried(self):
        db = self.store()
        self.cfg['delivery_enabled'] = True
        self.resources.pd_delivery = Http(fail=True)
        with self.assertRaises(RuntimeError):
            self.app.main()
        self.assertEqual(db.row()[2], 'uncertain')
        self.assertEqual(self.app.main()['skipped'], 1)
        self.assertEqual(len(self.resources.pd_delivery.calls), 1)

    def test_explicit_delivery_acceptance(self):
        db = self.store()
        self.cfg['delivery_enabled'] = True
        self.resources.pd_delivery = Http()
        self.assertEqual(len(self.app.main()['items']), 1)
        self.assertEqual(db.row()[2], 'accepted')
        self.assertEqual(self.resources.pd_delivery.calls[0][2]['json'], load('fixtures/expected.json')['items'][0])

    def test_live_modes_require_durable_claims_before_io(self):
        for change in [dict(source_mode='http', network_enabled=True),
                       dict(model_mode='resource', paid_calls_enabled=True),
                       dict(delivery_enabled=True)]:
            original = copy.deepcopy(self.cfg)
            self.cfg.update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.app.main()
            self.cfg.clear()
            self.cfg.update(original)

    def test_disabled_network_model_and_unsafe_xml(self):
        self.store()
        self.cfg['source_mode'] = 'http'
        with self.assertRaises(ValueError):
            self.app.main()
        self.cfg.update(source_mode='fixture', model_mode='resource')
        with self.assertRaises(ValueError):
            self.app.main()
        for value in ['<!DOCTYPE rss><rss/>', '<rss><channel><item><link>http://bad.test/</link></item></channel></rss>', 'x' * 262145]:
            with self.subTest(value=value[:40]), self.assertRaises(ValueError):
                self.app.papers(value)

    def test_repository_contract(self):
        for path in (ROOT / 'project').rglob('*.yaml'):
            json.loads(path.read_text(encoding='utf-8'))
        endpoint = load('project/endpoints/paper-digest/digest.post.yaml')
        schedule = load('project/schedules/pd_daily.yaml')
        self.assertEqual(endpoint['target'], {'kind': 'workflow', 'ref': 'pd_daily'})
        self.assertEqual(endpoint['allowed_authorizers'], [])
        self.assertFalse(schedule['enabled'])
        self.assertEqual(schedule['target'], {'kind': 'workflow', 'name': 'pd_daily'})
        self.assertEqual(load('case.json')['validation_command'], ['python3', '-I', 'validate.py'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
