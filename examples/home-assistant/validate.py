"""Execute actual deployed handlers with a fake Viat context; no device/server calls."""
import copy
import json
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parent


def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


class ViatError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code = status, code


class FakeHome:
    def __init__(self, states):
        self.states, self.calls = states, []

    def get(self, path, **options):
        self.calls.append(('GET', path, options))
        assert path.startswith('/api/states/')
        return copy.deepcopy(self.states[path.removeprefix('/api/states/')])

    def post(self, path, **options):
        self.calls.append(('POST', path, options))
        assert path in ('/api/services/light/turn_on', '/api/services/light/turn_off')
        return []


def script(name, context):
    fake = types.ModuleType('viat')
    fake.ctx, fake.ViatError = context, ViatError
    sys.modules['viat'] = fake
    path = ROOT / 'project/scripts' / (name + '.py')
    namespace = {'__name__': name + '_under_test'}
    exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'), namespace)
    return types.SimpleNamespace(**namespace)


class HomeTests(unittest.TestCase):
    def setUp(self):
        self.cfg = load('project/resources/ha_settings.yaml')['plain']['data']
        self.api = FakeHome(self.cfg['fixture_states'])
        self.principal = types.SimpleNamespace(user_id='synthetic-user', authorizer='password', is_admin=False)
        self.context = types.SimpleNamespace(principal=self.principal,
            resources=types.SimpleNamespace(ha_settings=self.cfg, ha_api=self.api))
        self.read, self.execute = script('ha_read', self.context), script('ha_execute', self.context)
        self.requests, self.expected = load('fixtures/requests.json'), load('fixtures/expected.json')

    def authorize(self):
        self.cfg['read_user_ids'] = ['synthetic-user']
        self.cfg['execute_user_ids'] = ['synthetic-user']

    def denied(self, fn, status, **args):
        with self.assertRaises(ViatError) as result:
            fn(**args)
        self.assertEqual(result.exception.status, status)
        self.assertEqual(result.exception.code, 'forbidden' if status == 403 else 'bad_request')

    def test_empty_policy_denies_even_admin(self):
        self.principal.is_admin = True
        self.denied(self.read.main, 403, **self.requests['read'])
        self.denied(self.execute.main, 403, **self.requests['action'])
        self.assertEqual(self.api.calls, [])

    def test_fixture_read_and_action_off(self):
        self.authorize()
        self.assertEqual(self.read.main(**self.requests['read']), self.expected['read'])
        self.assertEqual(self.execute.main(**self.requests['action']), self.expected['disabled'])
        self.assertEqual(self.api.calls, [])

    def test_principal_is_not_a_body_claim(self):
        self.authorize()
        for uid, authorizer in [(None, 'password'), ('someone-else', 'password'), ('synthetic-user', 'public')]:
            self.principal.user_id, self.principal.authorizer = uid, authorizer
            self.denied(self.read.main, 403, **self.requests['read'])
            self.denied(self.execute.main, 403, **self.requests['action'])
        self.assertEqual(self.api.calls, [])

    def test_actual_http_read_branch(self):
        self.authorize()
        self.cfg.update(read_mode='http', read_network_enabled=True)
        result = self.read.main(**self.requests['read'])
        self.assertEqual(result, {**self.expected['read'], 'fixture': False})
        self.assertEqual(self.api.calls[0][1], '/api/states/sensor.example_temperature')

    def test_read_gate_and_entity_validation(self):
        self.authorize()
        self.cfg['read_mode'] = 'http'
        self.denied(self.read.main, 403, **self.requests['read'])
        for entity in ['lock.front_door', '../services/script/run', [], 'light.example_desk?x=y']:
            self.denied(self.read.main, 400, entity=entity)
        self.assertEqual(self.api.calls, [])

    def test_allowlist_and_data_validation_precede_post(self):
        self.authorize()
        self.cfg['real_actions_enabled'] = True
        for args in self.requests['unsafe']:
            with self.subTest(args=args):
                self.denied(self.execute.main, 400, **args)
        self.assertEqual(self.api.calls, [])

    def test_two_action_gates_and_exact_request(self):
        self.authorize()
        self.cfg['real_actions_enabled'] = True
        for confirm in [False, 'true', 1]:
            args = {**self.requests['action'], 'confirm': confirm}
            self.assertEqual(self.execute.main(**args), self.expected['disabled'])
        self.assertEqual(self.api.calls, [])
        self.assertEqual(self.execute.main(**self.requests['action']), self.expected['accepted'])
        self.assertEqual(self.api.calls, [('POST', '/api/services/light/turn_on',
            {'json': {'entity_id': 'light.example_desk', 'brightness': 64}, 'timeout': 5})])

    def test_read_membership_does_not_grant_execute(self):
        self.cfg['read_user_ids'] = ['synthetic-user']
        self.assertEqual(self.read.main(**self.requests['read']), self.expected['read'])
        self.denied(self.execute.main, 403, **self.requests['action'])
        self.assertEqual(self.api.calls, [])

    def test_upstream_errors_are_sanitized(self):
        self.authorize()
        self.cfg.update(read_mode='http', read_network_enabled=True, real_actions_enabled=True)

        def fail(*args, **kwargs):
            error = ViatError(401, 'http_error', 'private upstream location')
            error.extra = {'body': {'secret': 'private upstream location'}}
            raise error

        self.api.get = self.api.post = fail
        for fn, args, expected in [
            (self.read.main, self.requests['read'], 'Home state unavailable'),
            (self.execute.main, self.requests['action'], 'Home service unavailable; effect may have applied'),
        ]:
            with self.assertRaises(ViatError) as caught:
                fn(**args)
            self.assertEqual((caught.exception.status, caught.exception.code), (502, 'upstream_error'))
            self.assertEqual(str(caught.exception), expected)
            self.assertFalse(getattr(caught.exception, 'extra', None))
            self.assertTrue(caught.exception.__suppress_context__)

    def test_repository_contract(self):
        for path in (ROOT / 'project').rglob('*.yaml'):
            value = json.loads(path.read_text(encoding='utf-8'))
            if path.parent.parent.name == 'endpoints':
                self.assertEqual(value['allowed_authorizers'], [])
                self.assertIn('ref', value['target'])
        self.assertFalse(self.cfg['real_actions_enabled'])
        self.assertFalse(self.cfg['read_network_enabled'])
        self.assertEqual(self.cfg['read_user_ids'], [])
        self.assertFalse(load('case.json')['external_side_effects_default'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
