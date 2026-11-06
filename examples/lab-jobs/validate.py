"""Offline unit layer; fake viat below is NOT integration/policy/DB acceptance."""
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


logic = load("job_logic", ROOT / "project/scripts/job_logic.py")
sys.modules["job_logic"] = logic


class UnitViatError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code = status, code


class NoResources:
    def __getattr__(self, name):
        raise AssertionError("default unit call must not access resources: " + name)


class UnitAuthz:
    """An explicit decision stub, not a replica of the Viat policy engine."""
    allowed = True

    def require(self, *args):
        if not self.allowed:
            raise UnitViatError(403, "forbidden", "unit decision denied")


stub = types.ModuleType("viat")
stub.ctx = types.SimpleNamespace(authz=UnitAuthz(), resources=NoResources())
stub.ViatError = UnitViatError
sys.modules["viat"] = stub
jobs = load("jobs", ROOT / "project/scripts/jobs.py")


class JobTests(unittest.TestCase):
    def test_acceptance_refuses_redirects(self):
        from urllib.request import Request
        module = load('lab_acceptance', ROOT / 'acceptance.py')
        request = Request('https://approved.example.invalid/', headers={'Authorization': 'Bearer fixture'})
        with self.assertRaisesRegex(RuntimeError, 'Redirect refused'):
            module.RejectRedirects().redirect_request(request, None, 307, 'redirect', {}, 'https://other.example.invalid/')

    def test_read_loader_does_not_lock_rows(self):
        queries = []
        row = self.row()

        class Transaction:
            def query(self, sql, params):
                queries.append(sql)
                return {'rows': [row]}

        jobs.load(Transaction(), 'fixture-job', for_update=False)
        self.assertNotIn('FOR UPDATE', queries[-1])
        jobs.load(Transaction(), 'fixture-job')
        self.assertIn('FOR UPDATE', queries[-1])


    def test_adapter_closes_connections(self):
        import io
        import sqlite3
        import tempfile
        module = load('lab_adapter', ROOT / 'adapter.py')
        original_connect = sqlite3.connect
        connections = []
        responses = []

        class TrackedConnection(sqlite3.Connection):
            closed = False

            def close(self):
                self.closed = True
                super().close()

        def connect(database):
            connection = original_connect(database, factory=TrackedConnection)
            connections.append(connection)
            return connection

        class FakeServer:
            def __init__(self, address, handler):
                self.handler = handler

            def serve_forever(self):
                for method, path, data in [
                    ('POST', '/jobs', {'job_id': 'fixture-job', 'payload': {'task': 'synthetic'}}),
                    ('GET', '/jobs/fixture-job', {}),
                    ('POST', '/jobs/fixture-job/cancel', {}),
                ]:
                    handler = object.__new__(self.handler)
                    body = json.dumps(data).encode()
                    handler.headers = {'Authorization': 'Bearer fixture', 'Content-Length': str(len(body))}
                    handler.path, handler.command = path, method
                    handler.rfile = io.BytesIO(body)
                    handler.reply = lambda status, value: responses.append((status, value))
                    handler.handle_request()

        module.HTTPServer = FakeServer
        module.sqlite3.connect = connect
        try:
            with tempfile.TemporaryDirectory() as directory:
                module.serve(str(Path(directory) / 'adapter.sqlite'), 'fixture', 0)
        finally:
            module.sqlite3.connect = original_connect
        self.assertEqual([status for status, _ in responses], [200, 200, 200])
        self.assertEqual(len(connections), 4)
        self.assertTrue(all(connection.closed for connection in connections))

    def row(self):
        return {"job_id": "fixture-job", "payload": '{"task":"synthetic"}',
                "state": "prepared", "event_seq": -1, "cancel_requested": False}

    def test_fixture_trace(self):
        row = self.row()
        decisions = []
        expected = json.loads((ROOT / "fixtures/expected.json").read_text())
        for event in json.loads((ROOT / "fixtures/events.json").read_text()):
            row, decision = logic.reduce_event(row, event)
            decisions.append(decision)
        self.assertEqual(decisions, expected["decisions"])
        self.assertEqual(row["state"], expected["final_state"])
        self.assertEqual(row["event_seq"], expected["final_seq"])

    def test_defaults_do_not_touch_db_or_http(self):
        request = json.loads((ROOT / "fixtures/input.json").read_text())
        expected = json.loads((ROOT / "fixtures/expected.json").read_text())
        self.assertEqual(jobs.main(**request), expected["dry_run"])
        for op in ["poll", "cancel"]:
            self.assertTrue(jobs.main(op=op, job_id="fixture-job")["dry_run"])

    def test_denied_decision_precedes_dry_run(self):
        stub.ctx.authz.allowed = False
        try:
            for op in ["submit", "poll", "cancel", "event", "read"]:
                with self.assertRaises(UnitViatError) as caught:
                    jobs.main(op=op, job_id="fixture-job")
                self.assertEqual(caught.exception.status, 403)
        finally:
            stub.ctx.authz.allowed = True

    def test_idempotency_and_payload_conflict(self):
        logic.same_submission(self.row(), {"task": "synthetic"})
        with self.assertRaises(ValueError):
            logic.same_submission(self.row(), {"task": "analysis"})
        with self.assertRaises(ValueError):
            logic.canonical({"task": "synthetic", "command": "do-not-execute"})

    def test_regression_and_terminal_are_immutable(self):
        row = dict(self.row(), state="running", event_seq=2)
        unchanged, why = logic.reduce_event(row, {"job_id": "fixture-job", "state": "queued", "seq": 9})
        self.assertEqual((unchanged, why), (row, "regression"))
        for terminal in logic.TERMINAL:
            row = dict(self.row(), state=terminal, event_seq=5)
            unchanged, why = logic.reduce_event(row, {"job_id": "fixture-job", "state": "running", "seq": 6})
            self.assertEqual((unchanged, why), (row, "terminal"))

    def test_cancel_request_is_not_confirmation(self):
        row = dict(self.row(), state="running", event_seq=2, cancel_requested=True)
        self.assertEqual(logic.public(row)["state"], "running")
        row, why = logic.reduce_event(row, {"job_id": "fixture-job", "state": "cancelled", "seq": 3})
        self.assertEqual((row["state"], why), ("cancelled", "applied"))

    def test_bad_protocol(self):
        for job_id in ["../x", "x/y", "", "X"]:
            with self.assertRaises(ValueError):
                logic.identifier(job_id)
        for event in [{"job_id": "other", "state": "running", "seq": 1},
                      {"job_id": "fixture-job", "state": "running", "seq": True},
                      {"job_id": "fixture-job", "state": "running", "seq": -1},
                      {"job_id": "fixture-job", "state": "invented", "seq": 1}]:
            with self.assertRaises(ValueError):
                logic.reduce_event(self.row(), event)

    def test_repo_guards(self):
        self.assertFalse(json.loads((ROOT / "case.json").read_text())["external_side_effects_default"])
        for path in (ROOT / "project/schedules").glob("*.yaml"):
            schedule = json.loads(path.read_text())
            self.assertFalse(schedule["enabled"])
            self.assertFalse(schedule["inputs"]["opt_in"])
            self.assertIn("name", schedule["target"])
        for path in (ROOT / "project/endpoints/default").glob("*.yaml"):
            target = json.loads(path.read_text())["target"]
            self.assertEqual(target["ref"], "submit_job" if target["kind"] == "workflow" else "jobs")


if __name__ == "__main__":
    unittest.main()
