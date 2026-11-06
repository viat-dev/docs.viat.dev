"""Unit-only: actual deployable Python + stdlib SQLite, fake Viat/crypto broker.
Does NOT validate HTTP authentication, header exposure, snapshots or the RPC broker.
"""
import concurrent.futures
from contextlib import contextmanager
import hashlib
import hmac
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
from types import ModuleType, SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
NOW = 1793750400


class Refusal(Exception):
    def __init__(self, *, status, code, message):
        super().__init__(message)
        self.status, self.code = status, code


CTX = SimpleNamespace()
viat = ModuleType("viat")
viat.ctx, viat.ViatError = CTX, Refusal
sys.modules["viat"] = viat


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ingest = load("example_ingest", ROOT / "project/scripts/ingest.py")
setup = load("example_setup", ROOT / "project/scripts/setup.py")
signer = load("fixture_signer", ROOT / "sign_fixture.py")


class Database:
    def __init__(self, path):
        self.conn = sqlite3.connect(path, isolation_level=None, timeout=5)
        self.conn.row_factory = sqlite3.Row
        self.fail_projection = False

    def query(self, sql, params=None):
        return {"rows": [dict(row) for row in self.conn.execute(sql, params or {})], "affected": 0}

    def execute(self, sql, params=None):
        if self.fail_projection and "INSERT INTO webhook_totals" in sql:
            self.fail_projection = False
            raise RuntimeError("injected projection failure")
        return self.conn.execute(sql, params or {}).rowcount

    @contextmanager
    def transaction(self):
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            yield self
            self.conn.commit()
        except BaseException:
            self.conn.rollback()
            raise


class FixtureKey:
    """Emulates only the crypto helper, using the public dummy key."""
    def verify(self, data, signature, **options):
        assert options == {"signature_encoding": "hex", "hash": "sha256"}
        expected = hmac.new(signer.DUMMY_KEY, data, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


def headers(raw, timestamp=NOW):
    return {"x-event-timestamp": str(timestamp), "x-event-signature": signer.sign(raw, timestamp)}


def expect_refusal(code, call):
    try:
        call()
    except Refusal as exc:
        assert exc.code == code, (exc.code, code)
        return
    raise AssertionError("Expected refusal: " + code)


def main():
    expected = json.loads((ROOT / "fixtures/expected.json").read_text())
    raw = (ROOT / "fixtures/event.json").read_bytes()
    key = FixtureKey()
    with tempfile.TemporaryDirectory(prefix="viat-webhook-unit-") as temp:
        path = str(Path(temp) / "unit.sqlite")
        db = Database(path)
        CTX.resources = SimpleNamespace(webhook_db=db, webhook_key=key)
        assert setup.main("webhook-ingestion-isolated-db")["ready"] is True
        CTX.request = SimpleNamespace(body=raw.decode(), body_base64=None, headers=headers(raw))
        ingest.time = SimpleNamespace(time=lambda: NOW)
        assert ingest.main() == expected["first"]
        assert ingest.main() == expected["repeat"]
        assert db.query("SELECT total_cents FROM webhook_totals")["rows"] == [{"total_cents": expected["total_cents"]}]
        failures = expected["failures"]
        expect_refusal(failures["bad_signature"], lambda: ingest.process(db, key, raw, {**headers(raw), "x-event-signature": "0" * 64}, NOW))
        expect_refusal(failures["stale"], lambda: ingest.process(db, key, raw, headers(raw, NOW - 301), NOW))
        changed = raw.replace(b"1250", b"1251")
        expect_refusal(failures["changed_body"], lambda: ingest.process(db, key, changed, headers(changed), NOW))
        malformed = b"[]"
        expect_refusal(failures["malformed"], lambda: ingest.process(db, key, malformed, headers(malformed), NOW))
        oversized = b"x" * 65537
        expect_refusal(failures["oversize"], lambda: ingest.process(db, key, oversized, headers(oversized), NOW))
        # Failure after the ledger write must roll it back together with the projection.
        restart = raw.replace(b"evt_fixture_001", b"evt_restart")
        db.fail_projection = True
        try:
            ingest.process(db, key, restart, headers(restart), NOW)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Failure injection did not fire")
        assert db.query("SELECT event_id FROM webhook_events WHERE event_id='evt_restart'")["rows"] == []
        assert ingest.process(db, key, restart, headers(restart), NOW)["status"] == "processed"
        race = raw.replace(b"evt_fixture_001", b"evt_race")

        def deliver(_):
            other = Database(path)
            try:
                return ingest.process(other, key, race, headers(race), NOW)["status"]
            finally:
                other.conn.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(deliver, range(2))) == ["duplicate", "processed"]
        assert db.query("SELECT COUNT(*) AS n FROM webhook_events")["rows"][0]["n"] == 3
        assert db.query("SELECT total_cents FROM webhook_totals")["rows"][0]["total_cents"] == 3750
        db.conn.close()
    print("webhook-ingestion: unit-only validation passed; no HTTP/provider calls")


if __name__ == "__main__":
    main()
