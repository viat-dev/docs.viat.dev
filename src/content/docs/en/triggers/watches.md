---
title: "File watches"
description: "Watch allowed local roots with settling, reconciliation, claims and bounded delivery."
doc_id: triggers.watches
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# File watches

A watch observes files visible on a server instance and runs a live **script or workflow**. It is not an S3 notification, arbitrary remote filesystem connector or endpoint target. Deployment must explicitly allow absolute root paths with `VIAT_WATCH_ROOTS`; unset means disabled. Mount the intended isolated directory into each serving container/host. The API currently checks **project membership** for reads and writes, not queue-trigger editor permissions. File access is server-side privilege: an allowed root should not contain credentials or unrelated tenants' files.

## Complete creation example

Source-derived/unexecuted example; create `ingest` first, and have an operator allow the synthetic root `/srv/viat-input`:

```http
POST /projects/demo/watches
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"incoming","source":{"path":"/srv/viat-input","recursive":true,"max_depth":3},"on":["created","modified"],"filter":{"include":["**/*.json"],"exclude":["**/*.tmp"],"min_size":1},"timing":{"settle_secs":5,"reconcile_secs":300,"max_fires_per_tick":50,"max_concurrent_runs":4,"max_entries":20000},"target":{"kind":"script","name":"ingest"},"inputs":{},"enabled":false}
```

The response is a WatchPublic object: `id,project_id,name,enabled,source,on,filter,timing,target,inputs,created_at,updated_at`. Source/filter/timing are echoed with resolved defaults, optional `max_depth/min_size/max_size` as values or null; target remains `{kind,name}`. Example projection:

```json
{"name":"incoming","enabled":false,"source":{"path":"/srv/viat-input","recursive":true,"max_depth":3},"on":["created","modified"],"filter":{"include":["**/*.json"],"exclude":["**/*.tmp"],"min_size":1,"max_size":null},"timing":{"settle_secs":5,"reconcile_secs":300,"max_fires_per_tick":50,"max_concurrent_runs":4,"max_entries":20000},"target":{"kind":"script","name":"ingest"},"inputs":{}}
```

## Fields and replacement semantics

| Field | Default / conditions |
| --- | --- |
| `name` | Required, nonblank. Update path/body must identify the intended watch. |
| `source.path` | Required absolute path inside deployment allowlist; outside it is 400, not a dormant accepted watch. Runtime must also be able to see it. |
| `source.recursive` | `true`; false scans only the root level. |
| `source.max_depth` | Omitted/null unbounded by depth; otherwise >=1. |
| `on` | Default `["created","modified"]`; nonempty subset of created/modified/deleted. |
| `filter.include`, `exclude` | Empty lists; relative-path globs, syntax validated. Empty include includes all; excludes win. |
| `filter.min_size`, `max_size` | Omitted/null no bound; when both present min must not exceed max. Use min_size 1 to exclude empty placeholders. |
| `timing.settle_secs` | 5, >=0: file version must stabilize before firing. |
| `timing.reconcile_secs` | 300, >=5: complete scan to recover missed notifications. |
| `timing.max_fires_per_tick` | 50: bound each scan's claims; keep positive. |
| `timing.max_concurrent_runs` | 4: per-instance watch execution slots; runtime floors slots at one. |
| `timing.max_entries` | 20000: scan ceiling; exceeding it is an error/degraded service, not silent partial coverage. Keep positive. |
| `target` | Required existing `{kind:script|workflow,name:"folder/name"}`; no endpoint targets. |
| `inputs` | Defaults null at API deserialization; execution merges object fields if an object. Send `{}`/an object for predictable constants. |
| `enabled` | Defaults true in API/repo and console form; send false to stage. |

`PUT …/watches/<name>` fully replaces configuration, with omitted optional fields reset to defaults. Null is not a general clear operation: optional bounds can be cleared with null, collections use `[]`, filter/timing use `{}` to restore defaults; required object/string/bool fields cannot be null. Changes reconcile without publication. There is no dedicated watch CLI command: repo files `watches/<name>.yaml` and `viat pull/push` are supported (`--only watches`). Mirror sync may delete remote watches absent locally; review a complete checkout/diff.

## Delivery and script inputs

The target receives constants plus reserved `file` (the observed event wins that key): `{path,abs_path,name,ext,size,modified_at,event}`. `path` is relative and stable; `abs_path` is valid **only on the executing instance**. A deletion event does not imply its file can still be opened. Example handler:

```python
def main(file):
    return {"path": file["path"], "event": file["event"]}
```

Scanning is truth; OS notifications only reduce latency. Existing files at registration are discoverable by reconciliation, and missed/overflowed events self-correct. Claims coordinate instances on watch/path/version; interrupted work can be retried, with up to three attempts, so side effects require idempotency. This is not a total-order file event journal. Multiple files/instances/runs can overlap and intermediate versions can collapse during settle. Same-size writes within the same whole-second mtime may be invisible on coarse filesystems. Symlink/allowlist checks constrain traversal; a disappearing mount is not reliable evidence of mass deletion: suspicious large disappearance degrades service and suppresses deletions until scans agree.

`GET /projects/<slug>/watches`, `GET …/<name>`, `GET …/<name>/events` and `GET …/<name>/health` are the observation API. Event rows contain `id,watch_id,rel_path,event,size,modified_at,request_id,status,attempts,started_at,finished_at,error_message`; statuses claimed/running/succeeded/failed. Health returns `summary:"serving"|"stalled"` and `instances:[{instance_id,hostname,status,last_scan_at,last_error}]`, with ok/degraded/unavailable status. Degraded notification registration can still work at reconcile latency; stalled means no live instance serves the root, not healthy idleness.

## Recover and clean up

For no events: check allowlist, mounts/ownership, health, globs/size, settle delay, scan ceiling, and target existence/environment. Do not test by touching a production ingestion directory without approval. Use a synthetic file in an isolated root and compare relative path plus event ledger/execution output. Runtime timeouts apply to the target; disabling a watch does not roll back or promise cancellation of its active run. Disable by full PUT preserving config, wait/account for active work, then `DELETE …/<name>`; separately remove only the synthetic files you created. There is no generic event replay API: repair the target and deliberately replay business work, considering previous effects.

Evidence: `crates/viat-api/src/handlers/watches.rs`, `watcher/{mod,scan,filters}.rs`; watch ledger queries/tests; `crates/viat-cli/src/repo/watches.rs`; console `pages/watches/WatchDrawer.tsx`. All examples source-derived/unexecuted; filesystem and multi-instance behavior not exercised here.
