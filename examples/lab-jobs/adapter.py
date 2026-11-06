"""Opt-in local synthetic adapter. SQLite persists IDs; never starts real jobs.

No callbacks are sent. An operator can replay the returned event to Viat using
its separate callback API key. This is not a production server or Slurm bridge.
"""
import argparse
import hmac
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
from contextlib import closing
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("job_logic", ROOT / "project/scripts/job_logic.py")
logic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(logic)


def serve(database, token, port):
    with closing(sqlite3.connect(database)) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS jobs (job_id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL, seq INTEGER NOT NULL)")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Do not record headers, tokens or arbitrary reflected input.

        def reply(self, status, value):
            body = json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def handle_request(self):
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token):
                return self.reply(401, {"error": "unauthorized"})
            parts = self.path.split("/")
            if parts[:2] != ["", "jobs"] or len(parts) not in (2, 3, 4):
                return self.reply(404, {"error": "not_found"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 <= size <= 8192:
                    raise ValueError("body too large")
                data = json.loads(self.rfile.read(size)) if size else {}
                if not isinstance(data, dict):
                    raise ValueError("JSON object required")
                with closing(sqlite3.connect(database)) as db, db:
                    db.row_factory = sqlite3.Row
                    if self.command == "POST" and len(parts) == 2:
                        if set(data) != {"job_id", "payload"}:
                            raise ValueError("job_id/payload required")
                        job_id = logic.identifier(data["job_id"])
                        encoded = logic.canonical(data["payload"])
                        db.execute("INSERT OR IGNORE INTO jobs VALUES (?, ?, 'queued', 0)", (job_id, encoded))
                        row = db.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
                        if row["payload"] != encoded:
                            return self.reply(409, {"error": "payload_conflict"})
                    elif len(parts) >= 3:
                        job_id = logic.identifier(parts[2])
                        row = db.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
                        if row is None:
                            return self.reply(404, {"error": "not_found"})
                        if self.command == "POST" and len(parts) == 4:
                            if parts[3] == "cancel":
                                state = "cancelled"
                            elif parts[3] == "advance":
                                # Fixture-only driver; no process is executed.
                                state = data.get("state")
                                if state not in ("running", "succeeded", "failed"):
                                    raise ValueError("invalid synthetic state")
                            else:
                                return self.reply(404, {"error": "not_found"})
                            candidate, decision = logic.reduce_event(
                                {"job_id": job_id, "state": row["state"], "event_seq": row["seq"]},
                                {"job_id": job_id, "state": state, "seq": row["seq"] + 1})
                            if decision == "applied":
                                db.execute("UPDATE jobs SET state=?, seq=? WHERE job_id=?",
                                           (candidate["state"], candidate["event_seq"], job_id))
                            row = db.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
                        elif self.command != "GET" or len(parts) != 3:
                            return self.reply(405, {"error": "method_not_allowed"})
                    else:
                        return self.reply(405, {"error": "method_not_allowed"})
                    result = {"job_id": row["job_id"], "state": row["state"], "seq": row["seq"]}
                self.reply(200, result)
            except (ValueError, KeyError, TypeError) as exc:
                self.reply(400, {"error": "bad_request", "message": str(exc)})

        do_GET = handle_request
        do_POST = handle_request

    # Loopback only; exposing this fixture outside a trusted development host
    # requires a separately reviewed TLS/auth/network deployment, not a flag.
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="new operator-owned SQLite fixture path")
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--port", type=int, default=8099)
    args = parser.parse_args()
    token = Path(args.token_file).read_text().strip()
    if not token:
        parser.error("token file must be nonempty")
    serve(args.db, token, args.port)
