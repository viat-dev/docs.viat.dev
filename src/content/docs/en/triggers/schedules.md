---
title: "Schedules: cron, interval and once"
description: "Complete schedule fields, timezone semantics, overlap, retries and replay."
doc_id: triggers.schedules
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Schedules: cron, interval and once

Schedules run targets automatically over time, with three trigger modes: cron,
fixed interval, and one-shot. Two boundaries to internalize first:

- A schedule is **live configuration**, not an endpoint snapshot: a direct
  script/workflow target resolves its **draft** at fire time, while an
  endpoint target follows the current published snapshot — not equivalent
  deployment guarantees.
- Permissions: the management API (writes and manual firing included)
  requires an authenticated **project member** — do not assume the
  editor-only restriction of queue/WS subscriptions; but endpoint targets
  execute as the scheduler system principal and need the scheduler role's
  authorization, not the console operator's. Only published endpoint targets
  are accepted at save time; target resolution/permissions can still fail
  later.

## Create and full update

Source-derived, unexecuted example (script `reports/nightly` exists):

```http
POST /projects/demo/schedules
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"nightly","trigger":{"kind":"cron","cron":"0 2 * * *","timezone":"Asia/Shanghai"},"target":{"kind":"script","name":"reports/nightly"},"inputs":{},"enabled":false,"on_overlap":"skip","max_attempts":1,"retry_backoff_secs":60,"catch_up":true}
```

Example 201 answer (ids/times synthetic):

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"nightly","enabled":false,"trigger":{"kind":"cron","cron":"0 2 * * *","timezone":"Asia/Shanghai"},"target":{"kind":"script","name":"reports/nightly"},"inputs":{},"next_due_at":"2026-11-06T18:00:00Z","last_fired_at":null,"last_run_id":null,"on_overlap":"skip","queue_cap":null,"max_attempts":1,"retry_backoff_secs":60,"catch_up":true,"retry_attempt":0,"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| Field | Default/validation |
| --- | --- |
| `name` | Required; 1–63 lowercase ASCII letters/digits/`_`/`-`, leading letter; the PUT body must match the path. |
| `trigger` | Required kind-tagged object; cron/interval/once below. |
| `target` | `{kind:script\|workflow,name:"folder/name"}` or `{kind:endpoint,method:"POST",path:"/reports"}`; endpoint methods are GET/POST/PUT/PATCH/DELETE, path starts with `/`, no query/fragment. |
| `inputs` | Must be a JSON object; deserialization defaults to null but validation rejects it — send `{}` explicitly. |
| `enabled` | API/repo default **true** (the console also initializes true). For staged rollouts set `false` explicitly. |
| `on_overlap` | Omitted/null: `skip`; also `queue`, `parallel`. |
| `queue_cap` | Omitted/null: no cap; positive integer in queue mode only. |
| `max_attempts` | Omitted/null: 1; range 1–10, **including** the first attempt. |
| `retry_backoff_secs` | Omitted/null: 60; fixed delay, range 1–86400 seconds. |
| `catch_up` | Omitted/null: true; false records sufficiently-late fires as skipped instead of catching up. |

`PUT /projects/<slug>/schedules/<name>` is a **full replacement**, not a
PATCH:

- The required name/trigger/target/inputs must all be sent; omitted
  optionals revert to defaults.
- Use pause/resume to change only `enabled`; when changing other fields,
  carry the policy over unchanged.
- null applies to Option fields only, never plain booleans/objects.
- Updates recompute due times; the answer always echoes the concrete cron
  timezone; `retry_attempt > 0` means next_due is a retry time.

### Time modes

- **cron**: `{"kind":"cron","cron":"0 2 * * *","timezone":"Europe/London"}`
  — standard five fields (minute/hour/day/month/weekday), the parser
  prepends second 0 and supports its year extension. The IANA timezone is
  taken **at write time** from `VIAT_DEFAULT_SCHEDULE_TZ` (default UTC) and
  frozen into the row: later deployment-default changes never re-interpret
  old schedules. Bad timezone/expression answers 400.
- **interval**: `{"kind":"interval","every_secs":60}` — 10–86400 seconds,
  absolute intervals, not a wall clock; first due is now + interval; downtime
  does not build a per-tick persistent event archive.
- **once**: `{"kind":"once","at":"2027-01-01T00:00:00Z"}` — RFC3339, up to
  ten years ahead; past times are accepted (due on the next tick). Auto-
  disables after one claim; the failure/retry policy can re-arm that run.
  Re-PUTting the **same already-executed instant** re-enables nothing even
  with enabled true — a new instant is a new schedule; an explicit resume
  deliberately re-arms the old instant, and a past time fires immediately.

**DST rules**: a repeated autumn wall-clock time fires **the first** time
only; a nonexistent spring time moves to the first valid instant after the
gap; multiple matches folding onto the same gap-end instant fire once.

Preview: `POST /projects/<slug>/cron/preview
{"cron":"30 1 * * *","timezone":"Europe/London","count":5}` — count defaults
to 5, clamped 1–20; the answer is
`{"upcoming":["<UTC-instant>"],"timezone":"Europe/London"}` and may be an
empty array for a valid expression with no future match.

## Firing, overlap, retries and replay

- `GET …/schedules` lists, `GET …/<name>` reads one; `POST …/<name>/pause`
  and `/resume` return the updated schedule. **Pausing only stops future
  automatic work** and rolls back nothing in flight; cron/interval resume
  recomputes from now without replaying the paused history. Catch-up covers
  downtime lateness, not a replay archive of every tick.
- Overlap: `skip` refuses overlap; `queue` stores pending runs up to the
  optional cap; `parallel` allows concurrency. Cluster claim/lease
  coordinates instances and **does not guarantee** exactly-once external
  effects; automatic failures retry at the fixed delay. Manual trigger/replay
  is an explicit action and does not run the full automatic retry sequence;
  a successful manual action clears a scheduled retry. **Business logic must
  be idempotent.**
- `POST …/<name>/trigger` answers `{"request_id":"<uuid>"}`; 409 = already
  running/queue busy or full; 403 = insufficient scheduler authorization.
- `GET …/<name>/runs?limit=50&before=<timestamp>`: limit clamped 1–200; rows
  carry `id,schedule_id,request_id,target,inputs,status,attempt,started_at,
  finished_at,error_message` with status running/succeeded/failed/skipped.
  `GET …/runs/<run_id>` reads one; `POST …/runs/<run_id>/rerun` uses the
  **historical inputs with the current target** — not historical source,
  returns a new request id, and is not a snapshot rollback.

> [!WARNING]
> Timeouts apply per execution budget — queuing is not a license to unlimited
> resources. There is no dedicated schedule-cancel route: pause only blocks
> future fires; if a cancellable async-run handle exists, use that API.
> **Never claim pause killed a running script.** Before replaying a timed-out
> change, inspect the runs and execution logs.

## CLI, repository, verification, cleanup

```sh
viat schedule create nightly --cron '0 2 * * *' --script reports/nightly --inputs '{}' --disabled
```

list/show/update/delete/pause/resume/trigger also exist. Note: **the
standalone create/update CLI supports only cron/interval with
script/workflow** — do not invent once/timezone/endpoint/retry flags; use the
API or the repo file `schedules/nightly.yaml` (carrying
trigger/target/inputs/enabled/overlap/retry/catch-up, mirrored by
`viat pull/push`; a local deletion can delete the remote schedule, so diff
against a complete checkout first). The narrow CLI's full-update may reset
policies you did not send.

Rollout order: create `disabled` → verify the cron preview, scheduler
permissions and one manual run's logs → enable. To stop: pause first, drain
current/queued work, then `DELETE …/<name>` (204); **deletion does not undo
writes/messages already produced**. There are no native
HomeAssistant/MQTT/Slurm scheduling connectors — those need explicit
scripts/resources/adapters; never invent target kinds.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/schedules.rs`,
`scheduler.rs`, `schedule_target.rs`, `scheduler_cluster.rs`;
`crates/viat-db/src/schedules.rs` and `schedules_due.rs` (DST tests);
`crates/viat-cli/src/repo/schedules.rs`, `commands/schedule.rs`; the console's
`pages/schedules/ScheduleDrawer.tsx`. Examples unexecuted.
