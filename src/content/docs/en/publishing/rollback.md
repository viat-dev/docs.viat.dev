---
title: "Rollback and unpublish"
description: "Restore prior endpoint snapshots or undo the current project publication revision without pretending to undo data."
doc_id: publishing.rollback
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.rollback", "cli.publish.history", "cli.publish.show", "cli.endpoint.rollback", "cli.endpoint.unpublish"]
---

# Rollback and unpublish

Rollback restores **routing pointers to existing immutable snapshots**. It is not a source-control checkout, database rollback, provider-message recall, trigger rollback or restore of users/resources/secrets. Publish rights (effective project Owner/Admin) are required for both rollback APIs and endpoint history/unpublish. Project revision history/show only require membership. Do not confuse the two rollback scopes.

All examples are source-derived/unexecuted. These operations change what callers execute and may warm workers/reload routes. Real rollback, smoke requests and external cleanup require explicit approval.

## Choose the correct recovery

| Need | Entry point | Exact scope |
| --- | --- | --- |
| Stop new calls to one leaf | `POST /projects/<slug>/endpoints/<id>/unpublish` | Removes active snapshot pointer, keeps history. Protected built-in auth leaves refuse. |
| Restore that leaf's previous version | `POST …/endpoints/<id>/rollback` | Chooses highest snapshot version **less than the currently active version**; not an arbitrary version/id selector. Requires a suitable prior active/history state. |
| Undo most recent active publication revision | `POST /projects/<slug>/publish/rollback` | Locks latest not-yet-rolled-back project revision and restores each recorded before pointer. Newly published leaves with before=null become unpublished. |

No body, version/id option, warning acknowledgement or test expectation is needed by rollback. Null/omitted body is not “choose latest arbitrary historical release”; the route determines selection. There is no native `publish rollback <revision-id>` or forward promotion-by-snapshot API. `viat publish show <id-or-prefix>` only reads.

## Inspect before changing traffic

`GET /projects/<slug>/publish/history?limit=20&offset=0` returns `project_slug,total,limit,offset,revisions`. Limit clamps 1–100, offset >=0. Each revision has `id,created_at,created_by_email,endpoint_count,rolled_back_at,rolled_back_by_email,summary`. `GET …/publish/revisions/<uuid-or-prefix>` returns `id,project_slug,created_at,created_by_email,rolled_back_at,rolled_back_by_email,endpoints,warnings?`; warnings is omitted when none. Each endpoint contains `node_id,method,path,before_snapshot_id,before_snapshot_version,after_snapshot_id,after_snapshot_version,target_kind,target_name`. Prefix must uniquely identify one project revision, otherwise 400; unknown is 404.

For one endpoint `GET …/endpoints/<id>/history` returns an array of complete [SnapshotView](snapshots.md#per-endpoint-publication-and-full-snapshot-response), not source blobs. Compare active id/path/method and target versions before running rollback. A plan/history response is not a traffic lock; coordinate operators and stop concurrent publish/edit automation.

## Complete project example

```http
POST /projects/demo/publish/rollback
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

```json
{"project_slug":"demo","revision_id":"00000000-0000-4000-8000-000000000010","rolled_back_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","restored_snapshot_id":"00000000-0000-4000-8000-000000000003","restored_snapshot_version":1}]}
```

This marks that revision rolled back, refreshes the project registry, purges affected endpoint cache generations and reconciles worker pools. A null restored_snapshot_id/version means unpublished, not deleted. “nothing to roll back” is 400. Repeating a successful project rollback can undo the **next older active revision**, so it is **not idempotent**; on lost response inspect history/current pointers before retrying. There is no request Idempotency-Key contract on this management route.

Single endpoint `POST /projects/demo/endpoints/<id>/rollback {}` returns the SnapshotView directly:

```json
{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"}
```

It selects a previous snapshot, not a new snapshot, then reloads routes and invalidates cached answers. It revalidates restored project_users_grant/current_user_grant against current role/capability restrictions; old validity is not sufficient. Project rollback is a separate bulk pointer-restoration path, not a promise to rerun every per-endpoint publish/grant/regression check. Review restored security bindings and current policy explicitly. Rollback does not run the saved-case publication gate.

## What recovery cannot promise

- Draft script/endpoint rows remain drafts; rollback does not rewrite them to historical source. A later apply can republish a still-dirty unwanted draft. Inspect plan and fix the repo/draft deliberately.
- Ordinary frozen script dependency graphs restore with their snapshot; `(live)` dependency graphs and **workflow step uses (including nested)** are still live. Restoring main source does not restore those modules.
- Resource credentials/config, authorizer configuration, authorization rules, project users, DB migrations/data, cache-invalidating external changes and trigger settings remain current. A schema-incompatible old script may still fail.
- In-flight HTTP/async runs keep already accepted payloads; existing WS connections/current message effects are not a transactional global cutover. Rollback/timeout/cancel cannot retract committed writes or sent messages.
- Project revision history is bounded by configured retention (default 20 revisions); snapshot persistence and project revision retention are different. A deleted endpoint is not automatically recreated by pointing at an old revision. Export of drafts is not a backup of snapshot history or business data.

## CLI, verification and cleanup

```sh
viat publish history --limit 20 --offset 0 --json
viat publish show 00000000-0000-4000-8000-000000000010 --json
viat publish rollback --yes --json
viat endpoint rollback 00000000-0000-4000-8000-000000000001
```

Commands are alternatives, **not a sequence to execute together**. Normal project rollback prompts unless --yes/--json; declining can exit 0 without doing anything. Endpoint rollback has no revision argument. See [CLI publication](../cli/publish.md) and [CLI endpoint](../cli/endpoint.md) for literal flags.

After success verify current pointers/versions, build/env health, an allowed and forbidden caller, expected public path/method and cache freshness on each relevant instance. For a timeout do not automatically retry: an operation may have committed before response loss. If previous snapshot cannot run under today's resources/schema, unpublish the affected leaf to stop new traffic, repair compatible config/code and deliberately republish. Re-enabling triggers or replaying tasks is separate approval. Clean isolated test endpoints via unpublish/delete after drains; preserve recovery/audit evidence and do not delete production snapshots/logs to hide a failed rollout.

Evidence: `crates/viat-api/src/handlers/{publish,snapshots}.rs`; `crates/viat-db/src/{revisions,snapshots}.rs` (before=null and pointer rollback tests); `crates/viat-core/src/types/snapshot.rs`; CLI publish/endpoint implementations. No rollback, build, test or provider action was executed.
