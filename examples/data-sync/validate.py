"""Unit-only: deployable setup/sync with stdlib SQLite, not workflow/HTTP integration."""
from concurrent.futures import ThreadPoolExecutor
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


setup, sync = load("setup"), load("sync_batch")


class Database:
    def __init__(self, path):
        self.conn = sqlite3.connect(path, isolation_level=None, timeout=5)
        self.conn.row_factory = sqlite3.Row
        self.fail_on = None

    def query(self, sql, params=None):
        return {"rows": [dict(row) for row in self.conn.execute(sql, params or {})], "affected": 0}

    def execute(self, sql, params=None):
        if self.fail_on and self.fail_on in sql:
            self.fail_on = None
            raise RuntimeError("injected failure before checkpoint")
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


def main():
    inputs = json.loads((ROOT / "fixtures/input.json").read_text())
    expected = json.loads((ROOT / "fixtures/expected.json").read_text())
    with tempfile.TemporaryDirectory(prefix="viat-sync-unit-") as temp:
        path = str(Path(temp) / "unit.sqlite")
        db = Database(path)
        CTX.resources = SimpleNamespace(sync_db=db)
        setup.main("data-sync-isolated-db")
        for bad in (0, 101, True, "2", None):
            try:
                sync.main(bad)
            except Refusal as exc:
                assert exc.code == expected["invalid_input"]
            else:
                raise AssertionError("Invalid input accepted")
        # Fail after sink writes but before checkpoint acknowledgement.
        db.fail_on = "UPDATE sync_checkpoint"
        try:
            sync.main(**inputs)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Failure injection did not fire")
        assert db.query("SELECT cursor FROM sync_checkpoint")["rows"] == [{"cursor": 0}]
        assert db.query("SELECT * FROM sync_items")["rows"] == []
        assert [sync.main(**inputs) for _ in range(3)] == expected["pages"]
        assert db.query("SELECT * FROM sync_items ORDER BY item_id")["rows"] == expected["items"]
        # Simulate a lost checkpoint in an older non-atomic adapter. Replaying
        # older changes must not overwrite a newer target revision/tombstone.
        db.execute("UPDATE sync_checkpoint SET cursor=0")
        assert sync.main(**inputs) == expected["pages"][0]
        assert db.query("SELECT * FROM sync_items ORDER BY item_id")["rows"] == expected["items"]
        sync.main(**inputs)
        # Restart with fresh connections and two simultaneous callers.
        db.execute("UPDATE sync_checkpoint SET cursor=0")

        def run_page(_):
            other = Database(path)
            try:
                return sync.synchronize(other, 2)
            finally:
                other.conn.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            pages = sorted(pool.map(run_page, range(2)), key=lambda page: page["cursor"])
        assert pages == expected["pages"][:2]
        assert db.query("SELECT * FROM sync_items ORDER BY item_id")["rows"] == expected["items"]
        db.conn.close()
    print("data-sync: unit-only validation passed; no workflow/HTTP/source-provider calls")


if __name__ == "__main__":
    main()
