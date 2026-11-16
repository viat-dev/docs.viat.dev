---
title: "File watches"
description: "Watch allowed local roots with settling, reconciliation, claims and bounded delivery."
doc_id: triggers.watches
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# File watches

A watch observes a directory visible on a server instance and runs a live
**script or workflow** when files change. It is not an S3 notification, not
an arbitrary remote-filesystem connector, and it has no endpoint target.

Three boundaries up front:

- The deployment must explicitly allow absolute roots via `VIAT_WATCH_ROOTS`;
  unset means the whole feature is off. You also need to mount your isolated
  directory into the container/host actually serving.
- The API checks **project membership** for reads and writes — not the
  queue-trigger editor gate.
- File access is server-side privilege: an allowed root must not contain
  credentials or other tenants' files.

## Full creation example

Source-derived, unexecuted. Create the script `ingest` first and have
operations allow the synthetic directory `/srv/viat-input`:

```http
POST /projects/demo/watches
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"incoming","source":{"path":"/srv/viat-input","recursive":true,"max_depth":3},"on":["created","modified"],"filter":{"include":["**/*.json"],"exclude":["**/*.tmp"],"min_size":1},"timing":{"settle_secs":5,"reconcile_secs":300,"max_fires_per_tick":50,"max_concurrent_runs":4,"max_entries":20000},"target":{"kind":"script","name":"ingest"},"inputs":{},"enabled":false}
```

The WatchPublic response carries
`id,project_id,name,enabled,source,on,filter,timing,target,inputs,created_at,updated_at`;
source/filter/timing echo parsed defaults (max_depth/min_size/max_size are
values or null; target stays `{kind,name}`):

```json
{"name":"incoming","enabled":false,"source":{"path":"/srv/viat-input","recursive":true,"max_depth":3},"on":["created","modified"],"filter":{"include":["**/*.json"],"exclude":["**/*.tmp"],"min_size":1,"max_size":null},"timing":{"settle_secs":5,"reconcile_secs":300,"max_fires_per_tick":50,"max_concurrent_runs":4,"max_entries":20000},"target":{"kind":"script","name":"ingest"},"inputs":{}}
```

## Fields and replacement semantics

| Field | Default/condition |
| --- | --- |
| `name` | Required, non-blank; updates identify the watch by path/body. |
| `source.path` | Required **absolute path**; must be inside the deployment allowlist or the save answers 400 — no silently idle configuration is created; the running instance must also see it. |
| `source.recursive` | Default true; false scans only the root layer. |
| `source.max_depth` | Omitted/null: unlimited; otherwise ≥1. |
| `on` | Default `["created","modified"]`; non-empty; created/modified/deleted only. |
| `filter.include`/`exclude` | Default empty arrays; relative-path globs, syntax validated at save; empty include selects everything; **exclude wins**. |
| `filter.min_size`/`max_size` | Omitted/null: unbounded; both set requires min ≤ max; `min_size:1` filters empty placeholder files. |
| `timing.settle_secs` | Default 5 (≥0); fires only after versions settle. |
| `timing.reconcile_secs` | Default 300 (≥5); full scans repair missed notifications. |
| `timing.max_fires_per_tick` | Default 50; caps claims per scan; keep positive. |
| `timing.max_concurrent_runs` | Default 4; per-watch concurrency slots within an instance, at least one at runtime. |
| `timing.max_entries` | Default 20000; scan cap — exceeding errors/degrades rather than silently truncating; keep positive. |
| `target` | Required, existing `{kind:script\|workflow,name:"folder/name"}`; no endpoint kind. |
| `inputs` | API default deserializes to null; runtime merges object fields only — send `{}` or an object explicitly. |
| `enabled` | API/repo/console default true; use false for staged rollouts. |

`PUT …/watches/<name>` fully replaces; omitted optionals revert to defaults.
**null is not a universal clear**: null clears optional bounds, `[]` clears
collections, `{}` restores filter/timing defaults; required
objects/strings/booleans cannot be null. Configuration takes effect on
reconciliation without any publish. There is no standalone watch CLI; the
repo supports `watches/<name>.yaml` and `viat pull/push` (`--only watches`),
and mirroring deletes remote watches missing locally — diff a complete
checkout first.

## Delivery and script input

The target receives constant inputs plus the reserved `file` key (the event
overrides a same-named input):

- `file` carries `{path,abs_path,name,ext,size,modified_at,event}`.
- `path` is a stable **relative** path; `abs_path` is valid **only on the
  executing instance**.
- A `deleted` event does not mean the file can still be opened.

```python
def main(file):
    return {"path": file["path"], "event": file["event"]}
```

Delivery semantics worth internalizing:

- **Scans are the truth; OS notifications only cut latency**: files existing
  before registration are found by reconciliation, and lost/overflowed
  notifications self-heal.
- Instances coordinate claims by watch/path/version; interrupted work retries
  up to three attempts — **side effects must be idempotent**.
- This is not a totally-ordered event log: multiple files/instances/runs can
  overlap, and settling merges intermediate versions.
- On coarse-mtime filesystems, a same-second same-size overwrite can be
  invisible. Symlinks obey the allowlist; a vanished mount is not a reliable
  mass-delete signal — abnormally mass disappearance degrades and
  **suppresses deleted** until a scan is consistent again.

Observability: `GET /projects/<slug>/watches`, `GET …/<name>`,
`GET …/<name>/events`, `GET …/<name>/health`. Event rows carry
`id,watch_id,rel_path,event,size,modified_at,request_id,status,attempts,started_at,finished_at,error_message`
with status claimed/running/succeeded/failed. Health returns
`summary:"serving"|"stalled"` plus
`instances:[{instance_id,hostname,status,last_scan_at,last_error}]` with
instance status ok/degraded/unavailable. With notification-registration
failure, degraded still runs on the reconcile delay; **stalled means no live
instance serves the root** — it is not normal idleness.

## Recovery and cleanup

When nothing fires, check in order: allowlist → mount/permissions → health →
glob/size filters → settle → scan caps → target environment. **Never write
test files into a production ingestion directory without authorization.**
Create synthetic files in an isolated root and verify relative paths, the
event ledger and execution output.

Targets obey runtime timeouts; disabling rolls back nothing and does not
guarantee cancelling the current run. Cleanup order: full PUT keeping config
but disabled → drain in-flight work → `DELETE …/<name>`; delete only test
files you created. There is no generic event-replay API — after fixing the
target, replay business work deliberately in light of the side effects that
already happened.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/watches.rs`,
`watcher/{mod,scan,filters}.rs`, the watch-ledger queries/tests;
`crates/viat-cli/src/repo/watches.rs`; the console's
`pages/watches/WatchDrawer.tsx`. Examples are source-derived and unexecuted;
filesystem and multi-instance behavior was not verified.
