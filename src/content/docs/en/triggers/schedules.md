---
title: "Schedules: cron, interval and once"
description: "Complete schedule fields, timezone semantics, overlap, retries and replay."
doc_id: triggers.schedules
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Schedules: cron, interval and once

Schedules are live configuration, not endpoint snapshots. A direct script/workflow target resolves its **draft** at fire time; an endpoint target follows the endpoint's current published snapshot. These are not equivalent deployment guarantees. The schedule management API currently requires an authenticated **project member**, including writes/manual firing; do not assume the editor-only restriction used by queue/WS subscriptions. Endpoint targets execute as the scheduler system principal and still need the scheduler role's applicable authorization, not the console operator's rights. Only published endpoint targets are accepted at save time; target resolution/permissions can still fail later.

## Creation and full replacement

Source-derived/unexecuted example, with existing script `reports/nightly`:

```http
POST /projects/demo/schedules
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"nightly","trigger":{"kind":"cron","cron":"0 2 * * *","timezone":"Asia/Shanghai"},"target":{"kind":"script","name":"reports/nightly"},"inputs":{},"enabled":false,"on_overlap":"skip","max_attempts":1,"retry_backoff_secs":60,"catch_up":true}
```

201 response example (synthetic timestamps/ids):

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"nightly","enabled":false,"trigger":{"kind":"cron","cron":"0 2 * * *","timezone":"Asia/Shanghai"},"target":{"kind":"script","name":"reports/nightly"},"inputs":{},"next_due_at":"2026-11-06T18:00:00Z","last_fired_at":null,"last_run_id":null,"on_overlap":"skip","queue_cap":null,"max_attempts":1,"retry_backoff_secs":60,"catch_up":true,"retry_attempt":0,"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| Field | Default / validation |
| --- | --- |
| `name` | Required, 1–63 lowercase ASCII letters/digits/`_`/`-`, first character a letter. PUT body must match path name. |
| `trigger` | Required tagged object: `cron`, `interval`, or `once` below. |
| `target` | Required `{kind:script|workflow,name:"folder/name"}` or `{kind:endpoint,method:"POST",path:"/reports"}`. Endpoint method GET/POST/PUT/PATCH/DELETE; path starts `/`, contains no query/fragment. |
| `inputs` | Must be a JSON object. Although deserialization defaults a missing value to null, validation rejects it: send `{}` explicitly. |
| `enabled` | API and repo default **true**; console schedule creation also initializes true. Send false for a safe staged creation. (Queue console creation differs.) |
| `on_overlap` | Omitted/null → `skip`; `queue` or `parallel` supported. |
| `queue_cap` | Omitted/null is no configured cap; positive integer only with queue mode. |
| `max_attempts` | Omitted/null → 1, allowed 1–10, includes initial automatic attempt. |
| `retry_backoff_secs` | Omitted/null → 60, fixed 1–86400 seconds. |
| `catch_up` | Omitted/null → true; false records sufficiently late occurrences as skipped instead of firing late. |

`PUT /projects/<slug>/schedules/<name>` is a **full replacement**, not PATCH. Required name/trigger/target/inputs must be supplied, omitted optional values reset to defaults. Do not use it merely to toggle enabled or to change a field without retaining policy. Null is only accepted for optional fields, not for non-nullable booleans/objects. Updating recomputes due time. API output always echoes concrete cron timezone; `retry_attempt > 0` means next_due is a retry, not an ordinary trigger.

### Trigger modes and time

- `{"kind":"cron","cron":"0 2 * * *","timezone":"Europe/London"}`: documented five-field minute/hour/day/month/weekday form; parser prepends seconds 0 (also accepts its supported year extension). IANA timezone defaults at **write time** to `VIAT_DEFAULT_SCHEDULE_TZ`, itself UTC; stored concretely, never reinterpreted when deployment default changes. Invalid zone/expression is 400.
- `{"kind":"interval","every_secs":60}`: 10–86400 seconds, absolute intervals, not a timezone wall clock. Initial due is now + interval; missed downtime is not a durable occurrence-by-occurrence event archive.
- `{"kind":"once","at":"2027-01-01T00:00:00Z"}`: RFC3339 instant, no more than ten years ahead. Past instants are accepted and due on the next tick. Auto-disables after claiming its firing; retry policy may re-arm a failed occurrence. Repeating a PUT of the **same already-fired instant** does not re-arm it, even if the file says enabled true. A new instant creates a new occurrence. Explicit resume deliberately re-arms the old instant, so a past once fires immediately.

DST: an ambiguous repeated wall-clock time fires at the **first occurrence only**; a nonexistent spring-forward time shifts to the first valid time after the gap. Several matches collapsed to the same gap-end instant fire once. Preview with `POST /projects/<slug>/cron/preview {"cron":"30 1 * * *","timezone":"Europe/London","count":5}` (count defaults 5, clamps 1–20): response `{"upcoming":["<UTC-instant>"],"timezone":"Europe/London"}`; may be empty for a valid expression with no future match.

## Fire, overlap, retry and replay

`GET …/schedules` lists; `GET …/<name>` shows; `POST …/<name>/pause` and `/resume` return the updated schedule. Pause stops new automatic work, not rollback of in-flight side effects; resume recomputes cron/interval from now, not all missed paused occurrences. Automatic catch-up is for downtime lateness, not replay of every historical tick. Skip refuses overlapping execution; queue retains pending work up to optional cap; parallel allows overlap. Cluster claims/leases coordinate instances but do not make external actions exactly-once. Automatic failures can retry with a fixed delay; manual run/replay is an explicit action, not a promise to perform the configured automatic retry sequence. A successful manual action can clear a booked retry. Use idempotent business keys.

`POST …/<name>/trigger` works as an explicit run and returns `{"request_id":"<uuid>"}` after the invocation path; 409 means already active/queue busy/full, 403 means scheduler authorization missing. `GET …/<name>/runs?limit=50&before=<timestamp>` clamps limit 1–200; each row has `id,schedule_id,request_id,target,inputs,status,attempt,started_at,finished_at,error_message`. Status is running/succeeded/failed/skipped. `GET …/runs/<run_id>` reads one. `POST …/runs/<run_id>/rerun` reuses **historical inputs and current target**, not historical source, and returns a new request id. It is not an old snapshot rollback.

Runtime timeout applies per execution; queued/waiting does not authorize unlimited resource calls. There is no dedicated schedule cancellation route: pause blocks future fires, and any separately exposed cancellable async-run handle must be cancelled through its own API; do not claim pause killed a running script. Inspect run and execution logs before replaying a timed-out mutation.

## CLI, repo, verification and cleanup

`viat schedule create nightly --cron '0 2 * * *' --script reports/nightly --inputs '{}' --disabled` is supported, as are list/show/update/delete/pause/resume/trigger. The create/update CLI supports cron/interval and script/workflow **only**: no guessed once/timezone/endpoint/retry flags. Use API or `schedules/nightly.yaml` for the full surface. Repo files carry trigger/target/inputs/enabled/overlap/retry/catch-up and mirror through `viat pull/push`; missing local schedules can delete remote schedules, so diff a complete checkout first. A narrow CLI full update can reset policy it does not send.

Verify disabled creation, cron preview, intended scheduler permissions, one manual run and log output before enabling in an isolated project. Stop by pause, account for current runs/queued work, then `DELETE …/<name>` (204); deleting the schedule does not undo writes/messages. No native HomeAssistant, MQTT or Slurm scheduler connector exists; use explicit scripts/resources/adapters, not invented trigger kinds.

Evidence: `crates/viat-api/src/handlers/schedules.rs`, `scheduler.rs`, `schedule_target.rs`, `scheduler_cluster.rs`; `crates/viat-db/src/schedules.rs`, `schedules_due.rs` (DST tests); `crates/viat-cli/src/repo/schedules.rs`, `commands/schedule.rs`; console `pages/schedules/ScheduleDrawer.tsx`. Examples were not run.
