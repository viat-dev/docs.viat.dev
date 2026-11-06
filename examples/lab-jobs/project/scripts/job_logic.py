"""Pure adapter protocol/state reduction used by deployed scripts and tests."""
import json
import re

TERMINAL = frozenset({"succeeded", "failed", "cancelled"})
STATES = frozenset({"queued", "running"}) | TERMINAL


def identifier(job_id):
    if not isinstance(job_id, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", job_id):
        raise ValueError("job_id must be a lowercase slug, 1..64 characters")
    return job_id


def canonical(payload):
    if (not isinstance(payload, dict) or set(payload) != {"task"}
            or payload["task"] not in ("synthetic", "analysis")):
        raise ValueError("payload must be {task: synthetic} or {task: analysis}; no shell commands")
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def event_value(event, job_id):
    if not isinstance(event, dict) or set(event) != {"job_id", "state", "seq"}:
        raise ValueError("event requires exactly job_id/state/seq")
    if event["job_id"] != job_id or not isinstance(event["state"], str) or event["state"] not in STATES:
        raise ValueError("event job/state mismatch")
    if type(event["seq"]) is not int or not 0 <= event["seq"] <= 9223372036854775807:
        raise ValueError("seq must be a nonnegative signed-64-bit integer")
    return event


def reduce_event(row, event):
    event_value(event, row["job_id"])
    if event["seq"] <= row["event_seq"]:
        return dict(row), "stale"
    # Terminal outcomes never change. A late running callback cannot resurrect
    # completed work, even if a provider incorrectly increments its sequence.
    if row["state"] in TERMINAL:
        return dict(row), "terminal"
    if row["state"] == "running" and event["state"] == "queued":
        return dict(row), "regression"
    updated = dict(row, state=event["state"], event_seq=event["seq"])
    return updated, "applied"


def same_submission(row, payload):
    if row["payload"] != canonical(payload):
        raise ValueError("job_id is already bound to a different payload")


def public(row):
    return {k: row[k] for k in ["job_id", "state", "event_seq", "cancel_requested"]}
