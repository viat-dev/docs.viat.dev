---
title: "Rollback and unpublish"
description: "Restore prior endpoint snapshots or undo the current project publication revision without pretending to undo data."
doc_id: publishing.rollback
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.rollback", "cli.publish.history", "cli.publish.show", "cli.endpoint.rollback", "cli.endpoint.unpublish"]
---

# Rollback and unpublish

Rollback does exactly one thing: **it points routes back at an existing
immutable snapshot**. It is not a source checkout, not a database rollback,
not message recall, and it restores no users, resources or secrets.

Both rollback APIs and endpoint history/unpublish need project Owner/Admin
publish rights; project revision history/show only need membership. The two
scopes (single endpoint / whole project) are not interchangeable.

> [!WARNING]
> A rollback immediately changes what callers execute and may warm workers and
> reload routes. Real rollbacks, smoke calls and external cleanup need
    explicit approval. The examples on this page are source-derived and
    unexecuted.

## Pick the right scope first

| Need | Entry point | Exact behavior |
| --- | --- | --- |
| Stop new calls to one leaf | `POST /projects/<slug>/endpoints/<id>/unpublish` | Clears the active pointer and keeps history; built-in auth leaves refuse. |
| Restore that leaf's previous version | `POST …/endpoints/<id>/rollback` | Selects the **largest snapshot version below the current active version**; arbitrary version/id is not accepted; a usable active/history must exist. |
| Undo the latest project publication | `POST /projects/<slug>/publish/rollback` | Locks the latest not-yet-rolled-back project revision and restores each entry's before pointer; a first publication has before=null and becomes an unpublish. |

Rollback takes no body, version, id, warning acknowledgement or test
expectation. An omitted or null body does not mean "any historical release" —
the route decides. There is no `publish rollback <revision-id>` and no
forward promote-by-snapshot API; `viat publish show <id-or-prefix>` is
read-only.

## Read before touching traffic

`GET /projects/<slug>/publish/history?limit=20&offset=0` returns
`project_slug/total/limit/offset/revisions` (limit clamped to 1–100, offset
≥ 0). A revision carries
`id,created_at,created_by_email,endpoint_count,rolled_back_at,rolled_back_by_email,summary`.

`GET …/publish/revisions/<uuid-or-prefix>` returns
`id,project_slug,created_at,created_by_email,rolled_back_at,rolled_back_by_email,endpoints,warnings?`
(the field is omitted when empty); endpoint entries carry
`node_id,method,path,before_snapshot_id,before_snapshot_version,after_snapshot_id,after_snapshot_version,target_kind,target_name`.
A prefix must be unique within the project: ambiguity is 400, unknown is 404.

`GET …/endpoints/<id>/history` returns an array of full
[SnapshotViews](snapshots.md) without source blobs. Compare the active
id/path/method/target versions before acting; neither history nor plan is a
traffic lock — coordinate with operators and pause concurrent
publish/edit automation.

## Whole-project example

```http
POST /projects/demo/publish/rollback
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

```json
{"project_slug":"demo","revision_id":"00000000-0000-4000-8000-000000000010","rolled_back_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","restored_snapshot_id":"00000000-0000-4000-8000-000000000003","restored_snapshot_version":1}]}
```

The server marks the revision rolled back, refreshes the registry, clears the
affected cache generations and reconciles worker pools. Null `restored_*`
means unpublished, not deleted; nothing to roll back answers 400.

> [!WARNING]
> Repeating a successful project rollback keeps undoing **the next-older active
> revision** — it is **not idempotent**. If you lose the response, read
> history/current pointers before deciding; never retry blind. Management
> routes have no Idempotency-Key contract.

The single-endpoint `POST /projects/demo/endpoints/<id>/rollback {}` answers
with a SnapshotView directly:

```json
{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"}
```

It selects an old snapshot instead of creating a new one, then reloads and
invalidates caches. Restored project_users_grant/current_user_grant are
re-checked against **current** roles and capabilities — valid back then does
not mean valid today. Project rollback is a separate bulk pointer-restore
path: it does **not** run the grant/regression checks of a single-endpoint
publish, so explicitly re-review restored security bindings and current
policy afterwards; rollback does not run the saved-case publish gate.

## What cannot be restored

- **Drafts stay drafts** — they are not rewritten to historical source; a
  later apply can republish unwanted dirty drafts. Check plan; fix the
  repo/drafts.
- Ordinary frozen dependency graphs restore with the snapshot; graphs with
  `(live)` references and **workflow step uses (nested included)** stay live —
  restoring main source does not restore them.
- Resource credentials/config, authorizers, authorization rules/users,
  database schema/data and triggers keep their current state; an old script
  can be incompatible with a new schema.
- In-flight HTTP/async keeps its accepted payload; existing WS and
  already-sent message effects are not part of a global transaction switch —
  rollback/timeout/cancel never undo committed writes or sent messages.
- Project revision history is retained per configuration (default 20), unlike
  the durable snapshot store; deleting an endpoint does not auto-revive it
  from an old revision. A draft export is not a snapshot-history or business
  data backup.

## CLI, verification and cleanup

```sh
viat publish history --limit 20 --offset 0 --json
viat publish show 00000000-0000-4000-8000-000000000010 --json
viat publish rollback --yes --json
viat endpoint rollback 00000000-0000-4000-8000-000000000001
```

These are **alternatives**, not a sequence to run together. Project rollback
asks for confirmation without `--yes/--json` and a refusal can still exit 0;
endpoint rollback takes no revision argument. Full flags:
[CLI publish](../cli/publish.md) and [endpoint](../cli/endpoint.md).

After success verify: pointer/version, build/env, one allowed and one
rejected caller, public path/method, and cache freshness on every instance.
Do not auto-retry a timeout — the change may have committed before the
response was lost. When an old snapshot is incompatible with today's
resources/schema, unpublish first to stop new traffic, then fix the
compatible config/code and publish deliberately. Re-enabling triggers or
replaying jobs needs separate authorization.

Test-environment cleanup: after draining, unpublish/delete and keep the
restore/audit evidence; never delete production snapshots/logs to hide a
failure.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/{publish,snapshots}.rs`;
`crates/viat-db/src/{revisions,snapshots}.rs` (before=null and pointer rollback
tests); `crates/viat-core/src/types/snapshot.rs`; CLI publish/endpoint
implementations. No rollback, build, test or provider action was executed.
