---
title: "Offline fixtures and resource fakes"
description: "Script-test setup, cassette semantics, database rollback and limits of the offline harness."
doc_id: testing.fixtures
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.script.test", "cli.script.run", "cli.publish.apply"]
---

# Offline fixtures and resource fakes

Use `viat script test [path]` for local handler logic; [endpoint fixtures](endpoint-tests.md) add real HTTP dispatch, while [saved cases](saved-cases.md) run real resources on the server. Local tests need no project API authorization because they do not ask the server to execute the target. Possession of a checkout/database URL still grants local access; do not treat “test” as a privilege boundary or a guarantee direct network code is blocked.

All examples are source-derived/unexecuted and synthetic. This documentation task installed/ran nothing. Supported test harnesses are Python/pytest, TypeScript/bun test and inline Rust cargo tests; the existence of nine production script languages does **not** imply nine equivalent offline SDKs.

## Prerequisites, discovery and results

```sh
viat script test
viat script test tests/echo
viat script test --json
```

Python uses uv to create an ephemeral environment with pytest and declared requirements. Tests live under tests, scripts under scripts. Use `load("folder/script")` for Python folder-aware relative-first `uses:` resolution and module isolation; flat import may select the wrong same-named common module. TypeScript uses bun test and discovers its normal .test.ts/.spec.ts patterns; its npm requirements must already be installed. The CLI temporarily injects node_modules/viat and refuses to overwrite an existing real one, then removes its injected SDK. Rust tests live in script .rs files under `#[cfg(test)]`, compiled in a temporary crate with the Viat SDK and declared deps; `VIAT_RUST_SDK_PATH`/toolchain must be available. Test host version must match CLI (`VIAT_TEST_HOST_BIN` override, sibling, PATH). Package setup may need registry/cache access even when upstream calls are faked.

Mixed-language projects run each discovered suite, nonzero if any fails; do not inspect only the first suite's report. --json stdout is machine-readable but shape differs by language; runner output goes to stderr, **exit code is the reliable pass signal**. A missing interpreter/setup error is not validated coverage. `viat publish apply --require-tests` invokes these local tests first; it does not run endpoint fixtures automatically and does not replace server saved-case gates.

## Complete fake surface

Python `ctx_with(request=?,principal=?,resources=?,project_users=?,authz=?,ws=?)` installs test context. TypeScript is async `await ctxWith({...})`, camelCase helpers. Set request/principal fields explicitly to prove a branch; omitted facts are not an authenticated production principal.

| Fake | Backing / limits |
| --- | --- |
| `FakeHttp(cassette)` | http_api resource calls through real host request dispatch. |
| `FakeGraphql(cassette)` | graphql document calls. |
| `FakeCloud(cassette)` | cloud_api action calls. |
| `FakeSecret(value)` | Synthetic secret value for get_resource/value; never use real credentials. |
| `FakeConfig(dict)` | Local document; Python from_resource(name) loads `resources/<name>.yaml` plain.data, preserves written $secret placeholders. Endpoint fixture config override is **not** supported. |
| `TestDb(url)` | Real scratch PostgreSQL SQL, one rollback transaction per test, not arbitrary database emulation. |
| `FakeStorage(root?,prefix?,max_file_bytes?,allowed_types?)` | Temp directory/in-memory file metadata unless explicit root; same helper validation/error shapes, default deployment ceiling modeled as 100 MiB. URL is viat-test://, not a served signed link. No file authz/audit behavior. |
| `FakeUpload(path,filename?,content_type?,field?)` | Local file handle in request.files, not an HTTP multipart parser. |
| `FakeProjectUsers(initial,fail?)` | Separate project_users argument, not resource; records user state and injectable failures. Explicit principal is_admin false rejects; omit flag to leave fake ungated. Does not model all server role/escalation guards. |
| `FakeAuthz(model)` | Separate authz argument; viat.yaml authz section/export/dict, evaluated by production policy engine. Principal identity/user_id/role/admin/meta/claims feed it; missing attrs fail closed. Not a fake “allow all”. |
| `FakeWs(...)` | Python/TS local connection/room state and sent/closed records. Same UUID/code validation, no real socket; default empty fake makes sends false. Rust has ws event context but no equivalent connection fake. |

Unsupported resources/operations fail, not silently call real resources. Do not infer mysql, raw s3 or every resource kind is supported from production availability; the covered host paths include HTTP/GraphQL/cloud/secret/config/Postgres/storage. A transaction's .graphql and overlapping real-connection concurrency are not reproduced by TestDb.

## Minimal handler and test

```python
# scripts/echo.py
def main(name="world"):
    return {"hello": name}
```

```python
# tests/test_echo.py
from viat.testing import ctx_with, load

def test_echo():
    ctx_with(resources={})
    assert load("echo").main(name="Ada") == {"hello": "Ada"}
```

For a handler that calls `ctx.resources.upstream.get("/thing/1")`, provide `FakeHttp("cassettes/upstream.yaml")`. The exact response expected by the SDK is the host wire response, not an invented requests.Response:

```yaml
interactions:
  - op: http
    name: upstream
    match:
      method: GET
      path: /thing/1
    response:
      status: 200
      content_type: application/json
      text: '{"id":1,"label":"synthetic"}'
```

Cassette interaction fields: required op/name and appropriate response; match pins only listed request fields, omitted fields wildcard. HTTP matches method/path and optional query/body; GraphQL document and cloud action use their own call fields. `ignore` excludes volatile body keys before matching. Repeated matching calls consume responses **in order then repeat the last**; unmatched requests fail clearly. Tighten body/query when identical paths dispatch different operations, or separate scenario directories. A loose recording replaying successfully is not proof the correct operation matched.

## Rollback, side effects and cancellation limits

TestDb requires a real scratch schema. Bare queries and transaction blocks share **one connection**. Script transactions become savepoints within the outer rollback transaction: nested/sequential atomic blocks can be tested, overlapping independent transactions cannot. A bare query inside an open block sees uncommitted block data here unlike production's separate connections. Rollback does not make production URLs safe: nontransactional/external effects and the wrong isolation assumptions remain dangerous.

Offline ctx.tasks.enqueue records requests rather than scheduling: inspect ctx.tasks.enqueued in order; get reports queued records, cancel marks them cancelled. It validates one target/delay/range syntax, not whether targets exist or endpoint authorization would allow them. ctx.cache.purge records normalized GET paths in ctx.cache.purged, no real cache invalidation. A console Test run or endpoint-test path is not automatically this purely local task recorder. FakeWs acceptance is not real transport receipt; FakeStorage does not prove file permissions/audit.

No harness cancellation/timeout makes committed external effects disappear. Keep deterministic small inputs, isolate explicit storage roots and DB schemas, inspect failure output, repair a fake/schema/setup before rerunning, and clean only artifacts you created. Never retry provider sends to “see whether the fake works”.

## Recording is a real run

`viat script run <name> --args '<json>' --record cassettes/scenario/` invokes the real server/resources and captures HTTP/GraphQL/cloud interactions. It is not an offline capture. Each resource YAML is **overwritten**, not appended; use separate scenario directories. Request credentials applied by the platform and secret resources are not recorded, but **response bodies are verbatim**: OAuth responses or business records can contain secrets/personal data. Review/redact before committing and do not record secret-returning flows. Synchronous recording only; an async handle cannot return a complete cassette immediately. Recording authorization equals real draft-run authorization and carries its real effects.

Evidence: `crates/viat-runtime/src/testing.rs`, SDK Python/TypeScript/Rust testing helpers; `crates/viat-api/src/endpoint_test.rs`, `handlers/scripts.rs`; `crates/viat-cli/src/commands/script.rs` and local test runners. Runtime/DB/provider examples not executed; transport, provider quotas and real concurrent transaction behavior require separate verification.
