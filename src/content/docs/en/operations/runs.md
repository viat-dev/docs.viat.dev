---
title: Run inspection, queues and cancellation
description: Trace requests into executions and async runs, interpret progress, cancel safely and recover after interruption.
doc_id: operations.runs
verified_release: '1.1.0'
channel: stable
---

# Run inspection, queues and cancellation

Use this procedure for a slow endpoint, growing queue or interrupted background job. **All command examples are unexecuted templates**; choose an isolated fixture before submitting or cancelling work. Read access needs a platform session/PAT and project membership. Production cancellation requires project **Owner/Admin/Developer**, not Operator. End-user endpoint credentials and per-run tokens are separate from management credentials.

## Identify the work before changing it

Record project slug, UTC time range, endpoint method/path, published revision, `request_id`, async `run_id`, caller and execution budget. Redact credentials. A request may be refused before runtime (routing/method/auth/body limit), or reach a worker and fail there; both can produce execution summaries. A successful draft test is not proof the published snapshot is correct.

In the console open the project's run/log view, filter time/status/target, and inspect the execution's error, duration and workflow steps. Use [CLI logs](../cli/logs.md) for CLI alternatives. Workflow steps are identified by `(index, step_id, iteration, attempt)`; nested workflows can restart index at zero, so use dotted `step_id`, not index alone.

## Management API

Set `BASE` to the deployment URL including any mount prefix and `PROJECT` to the slug. `TOKEN` below is an authorized management token already supplied securely, not an endpoint API key. Avoid verbose curl output or storing tokens in shell history.

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/async-runs" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=50'
curl --fail-with-body "$BASE/projects/$PROJECT/async-runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

List returns `{runs,counts}`; `counts` contains per-state totals. `limit` defaults to 50 and clamps to 1..200. Optional filters are `status`, `before` (the oldest previously shown `created_at` timestamp) and `request_id` (single-request lookup, ignores other filters). Use the returned run timestamps rather than inventing offsets. The management detail is member-authorized and can contain internal errors/outputs; do not expose it directly to endpoint clients.

| Status | Interpretation | Action |
| --- | --- | --- |
| `queued` | Accepted durable row; may await `not_before`, a concurrency-key slot, local inflight capacity or a lane. | Inspect schedule time, key, `max_concurrent`, queue position and node capacity before raising limits. |
| `pending` | Accepted background run not yet actively executing its target. | Inspect environment/admission/start timing; do not confuse with the durable `queued` state. |
| `running` | Claimed execution, not proof of useful progress. | Inspect `started_at`, progress timestamp, worker/environment and external dependency state. |
| `succeeded` | Target finished successfully; result retained for a bounded horizon. | Check HTTP status/output and side effects; application-defined response semantics still matter. |
| `failed` | Runtime/system/timeout/interruption failure. | Preserve request correlation and error; check external side effects before replay. |
| `cancelled` | Cancellation recorded. | Confirm terminal state and verify externally committed work; cancellation is not rollback. |

`progress_percent`, `progress_message`, `progress_at` are script-reported progress, not a platform ETA. An old 40% is different from a fresh 40%; absent progress does not itself prove a dead worker.

## Async endpoint caller contract

An endpoint request with `X-Viat-Async: true` (or a published always-async policy) can return **202**, containing a run identifier and capability for polling. Follow the returned URL/credential; do not assume a management token is interchangeable. The polling route accepts `X-Viat-Run-Token` or its `token` query capability; prefer the header so access logs/history do not retain the token. A missing/wrong token or unknown run deliberately returns **404**, not an enumeration-friendly 401.

Polling returns status/timestamps/progress; queued runs may include queue position/concurrency information. Successful runs include `http_status` and `output`; failed/cancelled runs include error kind/message with caller-safe filtering. This is not the full privileged console traceback. Retention can eventually make a valid old capability return 404.

`X-Viat-Delay` takes whole nonnegative seconds; zero means no delay. `X-Viat-Run-At` accepts a future RFC3339 instant or next `HH:MM[:SS]` occurrence in `X-Viat-Tz` (IANA, default UTC). Delay and run-at are mutually exclusive, capped at **30 days**. Durable queue acceptance is not a promise to run by that exact time under arbitrary load.

## Cancel with explicit approval

The following **mutates execution state and may terminate a worker**; run only after authorization and incident-owner approval:

```sh
curl --fail-with-body -X POST \
  "$BASE/projects/$PROJECT/async-runs/$RUN_ID/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

Read `{cancelled,status,reason,detail}`, not just HTTP 200:

- `cancelled:true`: a queued row was cancelled or a cancellation signal reached a live execution. Poll until terminal; this is not transactional rollback.
- `reason:not_cancellable`: path does not support the cancellation signal, e.g. shared warm script or no worker. Workflows check between steps, but an external call may not stop immediately.
- `reason:already_finished`: nothing left to cancel.
- `reason:owner_unreachable`: another node owns it and did not acknowledge in time. It is **not** proof cancellation or execution succeeded/failed.

## Restart, retry and cleanup

Graceful shutdown stops new queue claims and drains within `VIAT_SHUTDOWN_GRACE_SECS`; the default is 10 seconds. Not-yet-started durable queue rows survive. Running scripts are not checkpointed; dead-instance sweeps eventually fail orphaned runs. A database outage/heartbeat delay is not an exactly-once guarantee.

Before retrying, inspect downstream transactions, sent messages/files and idempotency records. A 504 from a proxy may occur while the target later succeeds. Preserve `Idempotency-Key` only when intentionally retrying the same request under the endpoint's supported semantics; never invent exactly-once claims for external services. Queue consumers are at-least-once.

After an incident, archive the minimal redacted evidence, remove fixture data only in its isolated project, restore temporary tuning, and verify queue depth/age trends return to normal. See [capacity](capacity.md), [logs](logs.md), [retention](retention.md) and [troubleshooting](troubleshooting.md).
