---
title: "Published snapshots and gates"
description: "What publishing freezes, complete publish APIs, warning/test gates and build readiness."
doc_id: publishing.snapshots
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.plan", "cli.publish.apply", "cli.endpoint.publish"]
---

# Published snapshots and gates

Editing a script/endpoint does not change ordinary public calls until publication. The registry serves active immutable snapshots, refreshed across instances by database notification. Draft test runs are deliberately different. Publish/unpublish/rollback/cache purge and endpoint snapshot history require effective project **Owner/Admin** publish rights; Developer can edit, not publish. Project plan/history/show require membership (including Operator). A console token is not an end-user route credential.

Examples below are source-derived/unexecuted. Publishing may run enabled saved cases against **real resources**, install dependencies/build workers, change routes and trigger cross-instance reloads; obtain explicit approval before doing it in a real project.

## What freezes and what remains live

| Target/config | Publication boundary |
| --- | --- |
| Ordinary script endpoint | Main source/version/language/folder and input schema freeze. The complete `uses:` graph freezes **only if no `(live)` reference occurs anywhere in that graph**. Any live reference keeps the resolve-live path for the dependency graph; it does not freeze just the other branches. |
| Workflow endpoint | Definition, step main script source/version/folder and nested workflow definitions/step main source freeze. **Step `uses:` dependencies remain live, including nested workflows.** Main-source freezing is not whole dependency freezing. |
| Inbound WebSocket endpoint | Routes and their scripts freeze through script snapshot validation; not live outbound-subscription behavior. |
| CRUD | Author config and schema-resolved PK/selection/filter/writable types freeze. Resource credentials/schema health and live authz bindings/rules still matter. |
| Proxy | Mount path, strip behavior and upstream bindings freeze; referenced http_api resource settings/credentials are resolved live. |
| Auth/overrides | Effective authorizer **bindings**, gates, path/method, input/response overrides freeze. Authorizer configuration, users/roles/keys, authorization model and resources can still change live. Built-in native-auth code/hooks are not user script snapshots. |
| Schedules/watches/IM/queues/outbound WS | Trigger config is live, not part of endpoint publication. Direct script/workflow triggers resolve live drafts. Schedule endpoint targets follow the published endpoint. |

Thus rollback cannot undo resource rotation, DB schema/data, live workflow modules, provider changes or messages already sent. Conversely, ordinary frozen script modules must be republished to change, unless the graph intentionally opts into live dependencies. Source/export repos represent **drafts**, not a portable export of the active immutable snapshots.

## Plan and project apply

`GET /projects/<slug>/publish/plan` returns `project_slug,publishable_count,endpoints`. Each endpoint item contains `id,tree_name,method,path,current_status,target_kind,target_name,current_version,draft_version,diff_summary`; proxy method/current absent version may be null. The server heals stale dependency-closure dirty markers while making the plan; it activates no route. It is not a lock/reservation or a promise apply will see identical drafts.

Source-derived plan response example:

```json
{"project_slug":"demo","publishable_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","tree_name":"default","method":"GET","path":"/hello","current_status":"unpublished","target_kind":"script","target_name":"echo","current_version":null,"draft_version":1,"diff_summary":"new endpoint"}]}
```

`POST /projects/<slug>/publish/apply` accepts an optional body:

```http
POST /projects/demo/publish/apply
Authorization: Bearer <console-token>
Content-Type: application/json

{"acknowledge_warnings":false,"acknowledge_test_failures":false}
```

Both fields default false when body/field is absent; booleans are not nullable clear operations. Apply publishes **all publishable dirty/unpublished leaves** as one transaction/revision, not arbitrary script drafts and not only the endpoint you last edited. Empty work returns a zero-count response without a new revision. No server `require_tests` field exists; that is a local CLI option.

```json
{"project_slug":"demo","published_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","snapshot_id":"00000000-0000-4000-8000-000000000003","snapshot_version":1}],"builds":[{"script":"echo","language":"python","ok":true,"error":null,"duration_ms":42}],"build_pending":false}
```

`builds` rows have script/language/ok/error/duration_ms and optional nonempty Rust diagnostics; build_pending true means background builds, typically with empty builds. A 200 is route activation success, **not proof every environment is ready**.

## Per-endpoint publication and full snapshot response

`POST /projects/<slug>/endpoints/<id>/publish` uses the same optional two flags and publishes just that leaf, returning a different success shape:

```json
{"snapshot":{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"},"builds":[],"build_pending":false}
```

This **complete SnapshotView** intentionally excludes source, workflow definition, step blobs, credentials and override internals. It is also the shape in endpoint history and per-endpoint rollback. `version` is endpoint snapshot version, not script version/server release. CRUD/WS targets have their own target_kind while ordinary script/workflow name fields can be null.

## Warning, regression and build gates

Both routes enforce warnings **first**, then saved-case regression, before snapshot commit. Failure rolls back snapshot/revision writes, **not side effects from tests already run**.

- **409 publish_warnings_unacknowledged**: per-endpoint returns `warnings:[strings]`; project apply returns `endpoint_warnings:[{endpoint_id,path,warnings}]`. Read each warning; acknowledge_warnings true bypasses this warning gate, not hard validation or test failures. Warnings are recorded on revision detail. Missing target/reserved paths/invalid bindings/schema/auth capabilities may be hard errors that acknowledgement cannot waive.
- **409 publish_test_failures**: both return `error,message,test_results`. Each result names case/target_kind/target and outcome passed/failed/errored/skipped. Per-endpoint covers that leaf; project apply covers targets actually going live. Workflow baked step scripts/nested scripts are included; current target collector does **not enumerate WS route scripts**. Budget defaults 120s (1–3600), stops starting additional cases, skipped blocks. Loading cases can currently fail open with an error log; a green response is not proof cases ran.
- `acknowledge_test_failures:true` skips the regression pass entirely, not merely turns red results into warnings; separate deliberate emergency override. Tests run **drafts/current environments**, not a post-build snapshot traffic simulation. Streaming has no saved comparable body; explicit response cases compare the body. See [saved cases](../testing/saved-cases.md).
- Default build validation occurs after commit/registry swap and reports failures without undoing activation. `VIAT_PUBLISH_BUILD_ASYNC` permits background warmup. `VIAT_PUBLISH_BUILD_BLOCK` opts into **precommit project-wide build refusal** and forces synchronous behavior; a failing unrelated project script can therefore block a narrow endpoint publish. Rust build availability/artifact configuration can affect what a node validates. These are deployment settings, not request flags.

For cold/failed environments inspect script env/build error (and Rust diagnostics), repair dependencies/toolchain/artifact availability, then deliberately rebuild/publish as applicable. A CLI success alone does not prove readiness. Do not repeatedly acknowledge a missing-main/schema warning to suppress a real deployment defect.

## CLI, verification and cleanup

```sh
viat publish plan --json
viat publish apply --require-tests --yes --json
viat endpoint publish 00000000-0000-4000-8000-000000000001
```

Use returned ids from an isolated project, not these synthetic ids. `--require-tests` runs **local script tests**, not endpoint fixtures, before the remote apply. --json suppresses the apply confirmation and exposes raw responses/refusals; ordinary non-2xx fails. Accepted publish with failed/pending builds can still exit 0. Per-endpoint CLI has a narrower acknowledgement surface than API; use only documented flags in [CLI publish](../cli/publish.md)/[CLI endpoint](../cli/endpoint.md), never guess `--force`.

After apply inspect project history/show, per-endpoint snapshot version, build/env readiness, allowed and denied callers and an authorized public smoke request. Cross-instance notification convergence is not a globally atomic traffic cutover; requests already running keep their start payload. Cancellation/disconnect cannot undo prior commits. If the result is uncertain after a timeout, inspect history/current snapshot before retrying; publish is not keyed by Idempotency-Key and retry can create another revision or see no dirty work.

To stop new ordinary traffic use `POST …/endpoints/<id>/unpublish` → `{"unpublished":true}`; it preserves history, not an undo of runtime effects, and system-managed auth leaves refuse it. Delete isolated endpoints only after pending work/external data is accounted for. Use [rollback](rollback.md) for routing recovery and [promotion](promotion.md) for another environment.

Evidence: `crates/viat-api/src/handlers/{publish,snapshots}.rs`, `registry.rs`, `regression.rs`, runner dependency resolution; `crates/viat-core/src/types/snapshot.rs`; `crates/viat-db/src/{snapshots,revisions}.rs`; CLI publish/endpoint code. Examples unexecuted; no builds, tests, registry reloads or provider calls performed here.
