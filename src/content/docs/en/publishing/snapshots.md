---
title: "Published snapshots and gates"
description: "What publishing freezes, complete publish APIs, warning/test gates and build readiness."
doc_id: publishing.snapshots
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.plan", "cli.publish.apply", "cli.endpoint.publish"]
---

# Published snapshots and gates

Publishing freezes an endpoint's draft state into an **immutable snapshot**, and
public traffic reads that snapshot from then on — not your drafts. This page
covers what exactly freezes, the complete management API, how warnings and
saved regression cases gate a publish, and how to read build results.

Three sentences to start with:

- Public calls read the active snapshot; editing drafts changes nothing online
  until you publish again.
- Publish/unpublish/rollback/cache purge and endpoint snapshot history need
  effective project **Owner/Admin** rights; a Developer can edit but not
  publish. plan/history/show only need project membership (Operator included).
- A console token is not an end-user route credential.

> [!WARNING]
> Publishing may run enabled saved cases against **real resources**, install
> dependencies, build workers, change routes and trigger cross-instance
> reloads. Obtain explicit approval before running it in a real project. The
> examples on this page are source-derived and unexecuted.

## What freezes and what remains live

| Target/config | Publication boundary |
| --- | --- |
| Ordinary script endpoint | Main source/version/language/folder and input schema freeze. The complete `uses:` graph freezes **only if no `(live)` reference occurs anywhere in that graph**; any live reference keeps the whole dependency graph on live resolution — it does not freeze just the other branches. |
| Workflow endpoint | Definition, step main script source/version/folder and nested workflow definitions/step main source freeze. **Step `uses:` dependencies remain live, including nested workflows**; main-source freezing is not whole-graph freezing. |
| Inbound WebSocket endpoint | Routes and their scripts freeze through script snapshot validation; live outbound-subscription behavior is different. |
| CRUD | Author config and schema-resolved PK/selection/filter/writable types freeze. Resource credentials/schema health and live authz bindings/rules still matter. |
| Proxy | Mount path, strip behavior and upstream bindings freeze; referenced http_api settings/credentials resolve live. |
| Auth/overrides | Effective authorizer **bindings**, gates, path/method, input/response overrides freeze. Authorizer configuration, users/roles/keys, the authorization model and resources stay live. Built-in native-auth code/hooks are not user script snapshots. |
| Schedules/watches/IM/queues/outbound WS | Trigger config is live and not part of endpoint publication. Direct script/workflow triggers resolve live drafts. Schedule endpoint targets follow the published endpoint. |

Two conclusions people get wrong most often:

- **Rollback does not undo** resource rotation, database schema/data, live
  workflow modules, provider state, or messages already sent.
- Source/export repositories represent **drafts**, not a portable export of the
  active snapshots; changing a frozen module needs a new publish unless it is
  deliberately live.

## Plan and project-level apply

`GET /projects/<slug>/publish/plan` returns `project_slug/publishable_count/
endpoints`; each entry carries `id, tree_name, method, path, current_status,
target_kind, target_name, current_version, draft_version, diff_summary`
(method null for proxy entries, versions null when none existed). The server
repairs stale dirty flags across the dependency closure but enables no routes;
a plan is neither a lock nor a reservation — apply may see different drafts.

Source-derived response example:

```json
{"project_slug":"demo","publishable_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","tree_name":"default","method":"GET","path":"/hello","current_status":"unpublished","target_kind":"script","target_name":"echo","current_version":null,"draft_version":1,"diff_summary":"new endpoint"}]}
```

`POST /projects/<slug>/publish/apply` takes an optional body:

```http
POST /projects/demo/publish/apply
Authorization: Bearer <console-token>
Content-Type: application/json

{"acknowledge_warnings":false,"acknowledge_test_failures":false}
```

A missing body or field means `false`; booleans cannot be cleared with null.
apply publishes **all** publishable dirty/unpublished leaves in one
transaction/revision — not arbitrary script drafts, and not only the most
recently edited one. An empty job publishes zero items and creates no
revision. The server has no `require_tests` field; that is a local CLI option.

```json
{"project_slug":"demo","published_count":1,"endpoints":[{"id":"00000000-0000-4000-8000-000000000001","method":"GET","path":"/hello","snapshot_id":"00000000-0000-4000-8000-000000000003","snapshot_version":1}],"builds":[{"script":"echo","language":"python","ok":true,"error":null,"duration_ms":42}],"build_pending":false}
```

Each `builds` row has `script/language/ok/error/duration_ms`, with possibly
non-empty Rust diagnostics in error; `build_pending: true` means a background
build, in which case builds is usually empty. HTTP `200` means the routes were
enabled — it **does not** prove every environment is ready.

## Single-endpoint publish and the full snapshot response

`POST /projects/<slug>/endpoints/<id>/publish` accepts the same two optional
flags, publishes only that leaf, and answers with a different shape:

```json
{"snapshot":{"id":"00000000-0000-4000-8000-000000000003","node_id":"00000000-0000-4000-8000-000000000001","version":1,"method":"GET","path_pattern":"/hello","target_kind":"script","script_name":"echo","script_version":1,"workflow_name":null,"workflow_version":null,"proxy_resource_name":null,"created_by":"00000000-0000-4000-8000-000000000004","created_at":"2026-11-06T00:00:00Z"},"builds":[],"build_pending":false}
```

This is the **full SnapshotView**: it deliberately omits source, workflow
definitions, step blobs, credentials and override internals; endpoint history
and single-endpoint rollback use the same shape. `version` is the endpoint
snapshot version — not a script or server release. CRUD/WS entries have their
own target_kind; ordinary script/workflow names may be null.

## Warnings, regression and build gates

Both publish routes check **warnings first, then saved-case regression** before
committing; a failure rolls back the snapshot/revision write but **not** any
external side effects of tests already executed.

**`409 publish_warnings_unacknowledged`** — the single-endpoint route returns a
warnings string array; project apply returns
`endpoint_warnings:[{endpoint_id,path,warnings}]`. Read them one by one;
`acknowledge_warnings: true` clears the warning layer only, never hard
validation or tests. Warnings are recorded in the revision detail. Missing
targets, reserved paths, bindings, schema or auth-capability violations are
**non-acknowledgeable** errors.

**`409 publish_test_failures`** — both return `error/message/test_results`;
each result is `case/target_kind/target/outcome`
(passed/failed/errored/skipped). The single-endpoint route covers that leaf;
project apply covers the targets actually going live, including workflow
frozen steps and nested scripts; the current collector **does not enumerate WS
route scripts**. The test budget defaults to 120 seconds, range 1–3600; a
timeout stops starting new cases; `skipped` also blocks. Failing to load a
case is currently logged and skipped past — a **green response does not prove
tests ran**.

`acknowledge_test_failures: true` skips the pass decision outright — it does
not downgrade red to a warning; treat it as an independent emergency decision.
Tests run against the **draft/current environment**, not a post-build traffic
simulation; streams have no single comparable body — the comparison rules for
explicit response cases are in [saved cases](../testing/saved-cases.md).

> [!NOTE]
> Default build verification runs **after** commit/registry swap: failures are
> reported but the publication stands. `VIAT_PUBLISH_BUILD_ASYNC` moves warmup
> to the background; `VIAT_PUBLISH_BUILD_BLOCK` enables **pre-commit
> whole-project build rejection** and forces synchronous builds — an
> unrelated script's failure can then block a single-endpoint publish. Rust
> compilation capability and artifact configuration decide what a node can
> verify; they are deployment settings, not request flags. For cold/failing
> environments read the script env/build errors and Rust diagnostics, fix
> dependencies/toolchain/artifacts, then rebuild or republish deliberately —
> do not repeatedly acknowledge missing-main/schema warnings to hide a
> deployment defect.

## CLI, verification and cleanup

```sh
viat publish plan --json
viat publish apply --require-tests --yes --json
viat endpoint publish 00000000-0000-4000-8000-000000000001
```

Use ids returned by your isolated project; never the example UUIDs.
`--require-tests` first runs **local script tests** (not endpoint fixtures);
`--json` drops the interactive confirmation and prints the raw success or
rejection body, exiting non-zero on ordinary non-2xx — though "published with
build failure/pending" can still exit 0. The single-endpoint CLI has a narrower
acknowledgement surface than the API: use only the documented flags from
[CLI publish](../cli/publish.md) and [endpoint](../cli/endpoint.md); there is
no `--force`.

After publishing, verify:

- snapshot versions and build/env state in history/show;
- one allowed and one rejected public smoke call.

Cross-instance notification convergence is not a global atomic traffic switch:
in-flight requests keep the payload they started with; cancellation or
disconnect does not undo committed side effects. After an ambiguous timeout,
check history/current snapshot before retrying — publish does not deduplicate
by an Idempotency-Key, so a retry may create a new revision or do nothing.

`POST …/endpoints/<id>/unpublish` answers `{"unpublished":true}`: new ordinary
traffic stops, history remains, already-produced effects are not undone;
built-in auth leaves refuse. Handle pending work and external data before
deleting an isolated endpoint.

For restoring routes see [rollback](rollback.md); for cross-environment flows
see [promotion](promotion.md).

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/{publish,snapshots}.rs`,
registry.rs, regression.rs and runner dependency resolution;
`crates/viat-core/src/types/snapshot.rs`; `crates/viat-db/src/{snapshots,revisions}.rs`;
CLI publish code. Examples unexecuted; nothing built, tested, reloaded or called.
