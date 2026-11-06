"""Unit-only: actual deployable report/notification logic; SQLite and fake mail.
No real SMTP submission, workflow execution, HTTP, resource Test or network calls.
"""
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
from types import ModuleType, SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent


class Refusal(Exception):
    def __init__(self, *, status, code, message):
        super().__init__(message)
        self.status, self.code = status, code


CTX = SimpleNamespace()
viat = ModuleType("viat")
viat.ctx, viat.ViatError = CTX, Refusal
sys.modules["viat"] = viat


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "project/scripts" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


setup, builder, notifier = load("setup"), load("build_report"), load("notify_report")


class Database:
    def __init__(self, path):
        self.conn = sqlite3.connect(path, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.fail_ack = False

    def query(self, sql, params=None):
        return {"rows": [dict(row) for row in self.conn.execute(sql, params or {})], "affected": 0}

    def execute(self, sql, params=None):
        if self.fail_ack and "SET state='accepted'" in sql:
            self.fail_ack = False
            raise RuntimeError("injected lost acknowledgement")
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


class FakeMail:
    def __init__(self):
        self.calls = []
        self.fail = False
        self.during_send = None

    def send(self, **message):
        self.calls.append(message)
        if self.during_send:
            self.during_send()
        if self.fail:
            raise TimeoutError("synthetic unknown relay outcome")
        return {"queued": True, "accepted": 1}


def expect(code, call):
    try:
        call()
    except Refusal as exc:
        assert exc.code == code, (exc.code, code)
        return
    raise AssertionError("Expected refusal " + code)


def main():
    inputs = json.loads((ROOT / "fixtures/input.json").read_text())
    expected = json.loads((ROOT / "fixtures/expected.json").read_text())
    with tempfile.TemporaryDirectory(prefix="viat-reports-unit-") as temp:
        db = Database(str(Path(temp) / "unit.sqlite"))
        mail = FakeMail()
        CTX.resources = SimpleNamespace(report_db=db, report_mail=mail)
        setup.main("reports-isolated-db")
        report = builder.main(inputs["start_date"], inputs["end_date"])
        assert report == expected["report"]
        rid = report["report_id"]
        assert notifier.main(rid, inputs["send"]) == expected["notification"]
        assert mail.calls == []
        assert db.query("SELECT * FROM report_deliveries")["rows"] == []
        for start, end in (("2026-11-04", "2026-11-03"), ("2026-11-03", "2026-11-03"),
                           ("2026-11-03", "2026-12-05"), ("20261103", "2026-11-04"), (None, "2026-11-04")):
            expect("invalid_window", lambda: builder.main(start, end))
        expect("invalid_send", lambda: notifier.main(rid, "false"))
        expect("report_missing", lambda: notifier.main("missing", False))
        # SQL aggregation is really executed; limit tests use a fresh window so
        # immutable saved reports do not hide the limits.
        old_limit = builder.MAX_ROWS
        builder.MAX_ROWS = 2
        expect("report_row_limit", lambda: builder.main("2026-11-02", "2026-11-04"))
        builder.MAX_ROWS = old_limit
        old_bytes = builder.MAX_TEXT_BYTES
        builder.MAX_TEXT_BYTES = 10
        expect("report_size_limit", lambda: builder.main("2026-11-02", "2026-11-04"))
        builder.MAX_TEXT_BYTES = old_bytes
        assert db.query("SELECT COUNT(*) AS n FROM report_runs")["rows"] == [{"n": 1}]
        # Once built, the report remains immutable despite later arriving sales.
        db.execute("INSERT INTO sales VALUES ('late','2026-11-03T12:00:00Z','USD',50)")
        assert builder.main(inputs["start_date"], inputs["end_date"]) == expected["report"]
        # An overlapping caller sees the committed claim and does not submit.
        mail.during_send = lambda: check_claim(db, mail, rid)
        assert notifier.main(rid, True) == {"state": "accepted", "attempted": True, "accepted": 1}
        mail.during_send = None
        assert mail.calls[0]["text"] == expected["report"]["text"]
        assert mail.calls[0]["to"] == "reports@example.test"
        assert notifier.main(rid, True) == {"state": "accepted", "attempted": False}
        assert len(mail.calls) == 1
        # Unknown SMTP outcome blocks blind retries, including after restart.
        other = builder.main("2026-11-01", "2026-11-02")["report_id"]
        mail.fail = True
        expect("delivery_uncertain", lambda: notifier.main(other, True))
        mail.fail = False
        assert notifier.main(other, True) == {"state": "uncertain", "attempted": False}
        assert len(mail.calls) == 2
        # Successful fake relay + failed DB acknowledgement is still not safe to retry.
        third = builder.main("2026-10-31", "2026-11-01")["report_id"]
        db.fail_ack = True
        try:
            notifier.main(third, True)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Acknowledgement injection did not fire")
        assert notifier.main(third, True) == {"state": "sending", "attempted": False}
        assert len(mail.calls) == 3
        db.conn.close()
    print("reports: unit-only validation passed; fake relay assertions only, no email sent")


def check_claim(db, mail, rid):
    assert notifier.deliver(db, mail, rid, True) == {"state": "sending", "attempted": False}


if __name__ == "__main__":
    main()
