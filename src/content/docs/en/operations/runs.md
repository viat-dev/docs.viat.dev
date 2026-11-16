---
title: Run inspection, queues and cancellation
description: Trace requests into executions and async runs, interpret progress, cancel safely and recover after interruption.
doc_id: operations.runs
verified_release: '1.1.0'
channel: stable
---

# Run inspection, queues and cancellation

Use this procedure for slow endpoints, growing queues and interrupted
background jobs. **All commands are unexecuted templates**; pick an isolated
fixture before submitting or cancelling. Reads need a platform session/PAT
and project membership; production cancellation requires project
**Owner/Admin/Developer** — Operator observes only. End-user endpoint
credentials, per-run capability tokens and management credentials are three
different things.

## Locate before changing anything

1. Record: project slug, UTC window, method/endpoint path, publish version,
   `request_id`, async `run_id`, caller and execution budget — with
   credentials redacted.
2. Remember both failure classes leave execution summaries: rejected
   **before** the runtime (routing/method/auth/size limits) and failed
   **after** reaching a worker. A passing draft test proves nothing about
   the published snapshot.
3. Locate: the console's project runs/logs pages filter by time, status and
   target — inspect errors, durations and workflow steps; the CLI
   alternative is [CLI logs](../cli/logs.md).
4. Workflow steps are identified by
   `(index, step_id, iteration, attempt)`; nested workflows **restart index
   at zero** — read the dotted-path `step_id`, never the bare index.

## Management API

`BASE` is the deployment URL including any mount prefix, `PROJECT` the slug,
and `TOKEN` a safely provisioned management token (**not** an endpoint API
key). Avoid verbose curl and never write tokens into history.

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/async-runs" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=50'
curl --fail-with-body "$BASE/projects/$PROJECT/async-runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

- The list returns `{runs,counts}` (counts per status); limit defaults to 50
  within 1..200; optional filters `status`, `before` (the oldest displayed
  created_at) and `request_id` (single-request query ignoring other
  filters). Use task timestamps — **never invent offsets**.
- Management detail is membership-authorized and may contain internal
  errors/output — do not forward it to endpoint end users.

| Status | Meaning | Action |
| --- | --- | --- |
| `queued` | Durably accepted; may wait for `not_before`, a concurrency-key slot, local in-flight capacity or an execution lane | Check scheduled time, key, `max_concurrent`, position and node capacity before raising limits |
| `pending` | Accepted for background execution; target not started | Check environment, admission and start time; different from durable queued |
| `running` | Claimed and executing — no promise of useful progress | Inspect `started_at`, progress timestamps, worker/environment and external dependencies |
| `succeeded` | Target finished successfully; results retained for a limited time | Check HTTP status, output and side effects; business semantics remain yours to judge |
| `failed` | Runtime/system/timeout/interruption failure | Keep correlated IDs and errors; confirm external side effects before replay |
| `cancelled` | Cancellation recorded | Confirm the terminal state and committed external work — **cancelling is not rollback** |

`progress_percent`/`progress_message`/`progress_at` are progress **reported
by the script**, not a platform ETA: a 40% updated long ago differs from one
updated just now, and absent progress does not prove a dead worker.

## The async endpoint calling protocol

- With `X-Viat-Async: true` (or a published always-async policy) a call may
  answer **202** with a task id and polling capability — use the returned
  URL/credentials; never assume the management token substitutes.
- Polling accepts an `X-Viat-Run-Token` header or a `token` query parameter —
  **prefer the header** so URLs stay out of logs/history. Missing/wrong
  tokens and unknown tasks all **deliberately answer 404**, not an
  enumerable 401.
- Poll responses carry status, times and progress; queued tasks may include
  queue position/concurrency info. Success carries `http_status` and
  `output`; failure/cancellation carries caller-facing filtered error
  types/messages, never the full console traceback. After the retention
  horizon, even a once-valid capability token can get 404.
- Delay: `X-Viat-Delay` is non-negative integer seconds (0 = no delay);
  `X-Viat-Run-At` takes a future RFC3339 time or the next `HH:MM[:SS]` in
  `X-Viat-Tz` (IANA, default UTC). The two headers are mutually exclusive,
  up to **30 days** out. Acceptance into the queue **promises no**
  punctual execution under arbitrary load.

## Cancel only with explicit approval

The following command **mutates execution state and may terminate workers** —
run it only with authorization and the incident owner's approval:

```sh
curl --fail-with-body -X POST \
  "$BASE/projects/$PROJECT/async-runs/$RUN_ID/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

You must read `{cancelled,status,reason,detail}` — HTTP 200 alone means
nothing:

- `cancelled:true`: the queued row was cancelled, or the signal reached an
  active execution — keep polling to the terminal state; **it is not a
  transaction rollback**.
- `reason:not_cancellable`: the execution path never reads cancel signals
  (shared warm scripts, worker-less operations); workflows check between
  steps, but external calls may not abort promptly.
- `reason:already_finished`: already over; nothing to cancel.
- `reason:owner_unreachable`: another node owns the task and did not
  acknowledge in time — **this proves neither cancellation nor any
  execution outcome**.

## Restarts, retries and cleanup

- Graceful shutdown stops claiming and drains within
  `VIAT_SHUTDOWN_GRACE_SECS` (default 10 s); unstarted durable queue rows
  survive restarts. Running scripts keep **no checkpoints**; orphan cleanup
  eventually fails stranded runs. Under database failure/heartbeat lag there
  is no exactly-once.
- Before retrying: check downstream transactions, sent messages/files and
  idempotency records — **after a proxy 504 the target may still have
  succeeded**. Reuse an `Idempotency-Key` only for deliberate retries of the
  same request under the endpoint's supported semantics; you cannot invent
  exactly-once for external services. Queue consumption is at-least-once.
- Closing an incident: keep the minimum necessary redacted evidence, clean
  only the isolated project's fixtures, revert temporary tuning, and verify
  queue depth/age recovering. See [capacity](capacity.md),
  [logs](logs.md), [retention](retention.md) and
  [troubleshooting](troubleshooting.md).
