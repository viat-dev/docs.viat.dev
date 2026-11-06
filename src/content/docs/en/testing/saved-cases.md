---
title: "Saved regression cases"
description: "Persist script/workflow expectations and understand their real-resource publication gate."
doc_id: testing.saved-cases
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.testcase.create", "cli.testcase.list", "cli.testcase.run", "cli.testcase.update"]
---

# Saved regression cases

A saved case is server-side `(args,expected,match_mode)` for a **script or workflow draft**. It is not a fake-resource unit test, endpoint fixture, recorded HTTP status assertion or publication snapshot. It runs **real resources** as the system test/scheduler principal, not with the console operator's caller permissions. Saving does not execute it; running it and publishing can write/send/charge real services. Use a separate test project/resource dataset and explicit approval for external actions.

All project members may list/read cases. Create/update/enable/disable/delete/**run** require content-edit rights (Owner/Admin/Developer). Cases identify target kind/folder/name rather than an endpoint id; the target is immutable on update. The console saves a case from an observed Test result, then can inspect/edit/run it; the API/CLI also support creation directly.

## Complete API and examples

Source-derived/unexecuted, existing script `echo` returning `{hello:name}`:

```http
POST /projects/demo/test-cases
Authorization: Bearer <console-token>
Content-Type: application/json

{"target_kind":"script","target_folder":"","target_name":"echo","name":"happy-path","args":{"name":"Ada"},"expected":{"hello":"Ada"},"match_mode":"subset"}
```

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","target_kind":"script","target_folder":"","target_name":"echo","name":"happy-path","enabled":true,"args":{"name":"Ada"},"expected":{"hello":"Ada"},"match_mode":"subset","created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| Field | Create / update semantics |
| --- | --- |
| `target_kind` | Required script/workflow, no endpoint target. |
| `target_folder` | Optional/null becomes root `""` at creation; separate from target_name. |
| `target_name` | Required leaf name. Cases are not proof the target exists/runs until actually run. |
| `name` | Required, trimmed/nonempty; unique per target. Duplicate maps to 400, not a silent overwrite. |
| `args` | Creation omitted/null → `{}`; must be object. |
| `expected` | Required JSON, can describe scalar/object/array/null. |
| `match_mode` | Omitted/null → subset; exact also supported. |
| `enabled` | New cases enabled; not controlled by creation body. Use dedicated enabled route. |

`GET /projects/<slug>/test-cases?target_kind=script&target_folder=&target_name=echo` lists the target's cases; `GET …/test-cases/<id>` reads full case. `PUT …/<id>` is **partial**, only `name,args,expected,match_mode`; absent **or null** preserves current values. `{}` no-op. Thus `args:{}` intentionally clears arguments; `expected:null` on update does **not** replace the expectation with JSON null (create a new case when that is the intended expectation). Cannot move target or change enabled here. `POST …/<id>/enabled {"enabled":false}` returns `{"enabled":false}`; true reenables. `DELETE …/<id>` returns `{"deleted":"<id>"}`.

`POST …/<id>/run {}` runs once even though enabled controls automatic gating, not this explicit action. Response examples use the actual enum serialization:

```json
{"outcome":"passed"}
```

```json
{"outcome":{"failed":{"mismatches":[{"path":"hello","expected":"Ada","actual":"Bob","absent":false}]}}}
```

`errored:{message}` means no comparable output (resolution/build/runtime/timeout/stream); `failed` means comparison disagreed. Direct script Test API differs: `POST …/scripts/echo/test-run {"args":{"name":"Ada"},"run_async":false,"record":false}` returns `ok,output,stdout,stderr,execution_log_id,request_id,recorded,error`. An explicit ViatResponse can have **output null** there even with a real response body. Saved cases correctly compare its **body**, not HTTP status/headers. A streaming target has no single comparable body and errors; use endpoint fixtures/stream-specific tests instead.

## Matching and publication gate scope

Subset recursively requires expected object keys/values, ignoring extra actual keys. Arrays still require equal length and compare elementwise in **both** modes; subset is not array membership/prefix matching. Exact requires full equality. Mismatches carry dotted/indexed path, expected, actual and absent flag; actual null with absent true is a missing field, not a present null.

Both `POST …/publish/apply` and `POST …/endpoints/<id>/publish` run enabled cases for targets being published, after warnings and before committing snapshots. Project apply covers only publishable leaves, not every draft asset in the project; per-endpoint covers that leaf. Workflow publication also includes its baked step scripts, catch/control branches and nested script closure collected by the implementation. Targets are deduplicated. **Current target collection does not enumerate WebSocket route scripts**, so do not promise a saved-case gate for those routes merely because they freeze script source. Proxy/CRUD/native-auth have no saved script target cases.

Failed, errored and budget-skipped cases block with **409 publish_test_failures** and test_results. `VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` defaults 120, clamps 1–3600; it stops **starting** new cases after budget, not forcibly aborting an already-running case's target timeout. Disabled cases are ignored. If loading enabled cases fails, current implementation logs the error and proceeds without a gate: green publication is not proof tests ran. `acknowledge_test_failures:true` bypasses the pass entirely; it is independent from warning acknowledgement and is not a retry. Regression proves current draft behavior/environment, not that the newly built published dependency environment is valid. See [publication](../publishing/snapshots.md).

## CLI and lifecycle

```sh
viat testcase create echo happy-path --args '{"name":"Ada"}' --expected '{"hello":"Ada"}'
viat testcase list echo --json
viat testcase run 00000000-0000-4000-8000-000000000001
viat testcase update 00000000-0000-4000-8000-000000000001 --match exact
viat testcase disable 00000000-0000-4000-8000-000000000001
```

These invocations are unexecuted; use ids returned by your isolated project. Commands also include show/enable/delete, `--kind workflow` where supported; see [complete CLI](../cli/testcase.md). Run returns nonzero for non-passed outcome, not a HTTP-transport-only signal. Saved cases are not portable repo resource cassettes; do not assume push/pull carries them. Changing expected merely to make a failure green destroys the assertion; inspect actual behavior and deliberately refresh after a known legitimate change. Disable/delete only test cases you own, and clean external effects separately; deleting a case/log never undoes a test run.

Evidence: `crates/viat-api/src/handlers/test_cases.rs`, `regression.rs`, `handlers/{scripts,publish,snapshots}.rs`; `crates/viat-core/src/types/test_case.rs` comparison tests; `crates/viat-cli/src/commands/testcase.rs`. No cases, builds or real-resource calls were executed.
