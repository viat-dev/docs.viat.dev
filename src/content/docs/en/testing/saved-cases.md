---
title: "Saved regression cases"
description: "Persist script/workflow expectations and understand their real-resource publication gate."
doc_id: testing.saved-cases
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.testcase.create", "cli.testcase.list", "cli.testcase.run", "cli.testcase.update"]
---

# Saved regression cases

A saved case lives on the server: `args + expected + match_mode` for a
**script/workflow draft**, run automatically before every publication. It is
not a fake-resource unit test, not an endpoint fixture, not an HTTP status
assertion and not a publish snapshot — it is the last layer of the publish
gate.

Two things to internalize first:

- Running a case touches **real resources** under the system
  test/scheduler principal, not the console user's caller permissions.
  Saving executes nothing; but run and publish can really write, send and
  cost money — isolate the project/data and get approval for external
  actions.
- Permissions: list/read for any project member; create/update/enable/
  disable/delete/**run** all need content-edit rights
  (Owner/Admin/Developer). Targets are kind/folder/name, never endpoint ids;
  updates cannot retarget.

The console can save a case straight from an observed Test output and then
view/edit/run it; the API/CLI can create them directly.

## Full API and examples

Source-derived, unexecuted. Assume an existing `echo` returning
`{hello: name}`:

```http
POST /projects/demo/test-cases
Authorization: Bearer <console-token>
Content-Type: application/json

{"target_kind":"script","target_folder":"","target_name":"echo","name":"happy-path","args":{"name":"Ada"},"expected":{"hello":"Ada"},"match_mode":"subset"}
```

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","target_kind":"script","target_folder":"","target_name":"echo","name":"happy-path","enabled":true,"args":{"name":"Ada"},"expected":{"hello":"Ada"},"match_mode":"subset","created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| Field | Create/update semantics |
| --- | --- |
| `target_kind` | Required `script`/`workflow`; no endpoint kind. |
| `target_folder` | Omitted/null on create means root `""`; independent of target_name. |
| `target_name` | Required leaf name; a case can exist before its target does — existence proves nothing about runnability. |
| `name` | Required, non-empty after trim, unique per target; duplicates answer 400, no overwrite. |
| `args` | Omitted/null on create means `{}`; must be an object. |
| `expected` | Required JSON; scalar/object/array/null all allowed. |
| `match_mode` | Omitted/null means `subset`; the other option is `exact`. |
| `enabled` | New cases start enabled; the create body does not control it — a separate route does. |

The remaining routes:

- `GET /projects/<slug>/test-cases?target_kind=script&target_folder=&target_name=echo`
  lists; `GET …/test-cases/<id>` reads one fully.
- `PUT …/<id>` is a **partial update** accepting only
  name/args/expected/match_mode; an omitted **or null** field is kept and `{}`
  is a no-op. Two traps: `args:{}` **explicitly clears** the arguments, while
  updating `expected:null` does **not** turn the expectation into JSON null —
  create a new case for that. Target and enabled cannot change here.
- `POST …/<id>/enabled {"enabled":false}` answers `{"enabled":false}`; true
  re-enables.
- `DELETE …/<id>` answers `{"deleted":"<id>"}`.

`POST …/<id>/run {}` executes once explicitly — enabled gates the automatic
runs, not this action. The actual enum serialization:

```json
{"outcome":"passed"}
```

```json
{"outcome":{"failed":{"mismatches":[{"path":"hello","expected":"Ada","actual":"Bob","absent":false}]}}}
```

`errored:{message}` means there was no comparable output at all
(parse/build/run/timeout/stream); `failed` is specifically an output mismatch.
Unlike the direct script test — `POST …/scripts/echo/test-run
{"args":{"name":"Ada"},"run_async":false,"record":false}` returning
ok/output/stdout/stderr/execution_log_id/request_id/recorded/error, where an
explicit ViatResponse can leave **output null** even with a real body — the
saved case compares the explicit response's **body**, not HTTP status/headers.
Streaming targets have no single body and come back errored; use dedicated
stream/endpoint tests for those.

## Matching and what the gate covers

- `subset`: recursively requires every expected object key/value to exist in
  actual; extra actual keys are ignored. **In both modes arrays must match in
  length and item-by-item** — subset is not set inclusion or a prefix.
- `exact`: full equality.
- Mismatches record path (dot/index), expected, actual, absent; actual null
  with absent=true means the **field is missing**, not "present and null".

Both `POST …/publish/apply` and `POST …/endpoints/<id>/publish` run the
enabled cases of the publication's targets **after warnings and before the
snapshot commits**:

- Project apply covers the publishable leaves only — not every draft in the
  project; a single-endpoint publish covers that leaf.
- Workflows collect their frozen step scripts, catch/control branches and the
  nested script closure (deduplicated).
- **The current collector does not enumerate WebSocket route scripts** — the
  route freezing source does not promise gate coverage.
- Proxy/CRUD/built-in auth have no saved script-target cases.

`failed`/`errored`/budget-exhausted `skipped` all block the commit with
**409 publish_test_failures** plus test_results.
`VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` defaults to 120, clamped to 1–3600;
the budget only stops **starting** new cases and does not force-abort a
running case's own target timeout. Disabled cases are skipped.

> [!WARNING]
> The current implementation logs and proceeds when reading enabled cases
> fails — **a successful publish does not prove tests ran**.
> `acknowledge_test_failures: true` skips the pass decision outright; it is
> independent of warning acknowledgement and is not a retry. Regression proves
> the current draft/environment, not that a new dependency's build
> environment works — see [publishing](../publishing/snapshots.md).

## CLI and lifecycle

```sh
viat testcase create echo happy-path --args '{"name":"Ada"}' --expected '{"hello":"Ada"}'
viat testcase list echo --json
viat testcase run 00000000-0000-4000-8000-000000000001
viat testcase update 00000000-0000-4000-8000-000000000001 --match exact
viat testcase disable 00000000-0000-4000-8000-000000000001
```

Unexecuted examples; use ids from your isolated project. show/enable/delete
also exist; workflows take `--kind workflow`. Full flags:
[CLI testcase](../cli/testcase.md). A non-passed `run` exits non-zero — not
just the HTTP success signal.

Saved cases are not repo cassettes — do not assume push/pull carries them.
**Editing expected just to go green destroys the assertion**: review the
behavior, confirm the change is legitimate, then refresh the expectation.
Disable/delete only your own cases; clean external effects separately —
deleting a case or its logs never undoes a run that happened.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/test_cases.rs`,
`regression.rs`, `handlers/{scripts,publish,snapshots}.rs`; the comparison
tests in `crates/viat-core/src/types/test_case.rs`;
`crates/viat-cli/src/commands/testcase.rs`. No cases, builds or real
resource calls were executed.
