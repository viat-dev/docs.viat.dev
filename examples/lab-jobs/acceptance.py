"""OPT-IN synthetic HTTP/DB/adapter acceptance; never use on real provider jobs.
Leaves exactly fixture-job and fixture-cancel for deliberate cleanup.
"""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # urllib otherwise forwards Authorization across redirected origins.
        raise RuntimeError("Redirect refused; use the final approved endpoint URL")


def run(base, operator, callback):
    opener = build_opener(RejectRedirects())
    def call(path, key, data, expected=200):
        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = "Bearer " + key
        request = Request(base.rstrip("/") + path, json.dumps(data).encode(), headers, method="POST")
        try:
            with opener.open(request, timeout=30) as response:
                status, value = response.status, json.load(response)
        except HTTPError as response:
            status, value = response.code, json.load(response)
        if status != expected:
            raise AssertionError(f"{path} {data.get('op', 'workflow')}: expected {expected}, got {status}")
        return value

    payload = {"task": "synthetic"}
    dry = call("/submission", operator, {"job_id": "fixture-job", "payload": payload})["job"]
    assert dry == {"dry_run": True, "job_id": "fixture-job", "op": "submit"}
    submitted = call("/submission", operator, {"job_id": "fixture-job", "payload": payload, "opt_in": True})["job"]
    assert (submitted["state"], submitted["event_seq"]) == ("queued", 0)
    request = {"op": "submit", "job_id": "fixture-job", "payload": payload, "opt_in": True}
    assert call("/jobs", operator, request)["state"] == "queued"
    call("/jobs", operator, dict(request, payload={"task": "analysis"}), 400)
    call("/jobs", callback, {"op": "read", "job_id": "fixture-job"}, 403)
    call("/callback", None, {"op": "event", "job_id": "fixture-job"}, 401)
    call("/callback", operator, {"op": "event", "job_id": "fixture-job"}, 403)
    trace = [("running", 2, "applied"), ("queued", 1, "stale"),
             ("succeeded", 3, "applied"), ("succeeded", 3, "stale"),
             ("running", 4, "terminal")]
    for state, seq, decision in trace:
        result = call("/callback", callback, {"op": "event", "job_id": "fixture-job",
                      "event": {"job_id": "fixture-job", "state": state, "seq": seq}})
        assert result["decision"] == decision
    # Adapter's older queued response must not regress the callback terminal.
    assert call("/jobs", operator, {"op": "poll", "job_id": "fixture-job", "opt_in": True})["state"] == "succeeded"
    call("/jobs", operator, dict(request, job_id="fixture-cancel"))
    result = call("/jobs", operator, {"op": "cancel", "job_id": "fixture-cancel", "opt_in": True})
    assert result["state"] == "cancelled" and result["cancel_requested"] is True
    print("Synthetic HTTP assertions passed. Business IDs: fixture-job, fixture-cancel. No cleanup performed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="published /p/<isolated-slug> base")
    parser.add_argument("--operator-key-file", required=True)
    parser.add_argument("--callback-key-file", required=True)
    parser.add_argument("--allow-synthetic-adapter-io", required=True, action="store_true")
    args = parser.parse_args()
    run(args.base, Path(args.operator_key_file).read_text().strip(),
        Path(args.callback_key_file).read_text().strip())
