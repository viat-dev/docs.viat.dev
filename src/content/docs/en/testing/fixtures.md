---
title: "Offline fixtures and resource fakes"
description: "Script-test setup, cassette semantics, database rollback and limits of the offline harness."
doc_id: testing.fixtures
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.script.test", "cli.script.run", "cli.publish.apply"]
---

# Offline fixtures and resource fakes

Three kinds of "test", one layer each — keep them apart:

| Layer | Tool | Resources |
| --- | --- | --- |
| Local handler logic | `viat script test` (this page) | Fakes |
| Full HTTP dispatch | [Endpoint fixtures](endpoint-tests.md) | Fakes + scratch instance |
| Server publish gate | [Saved cases](saved-cases.md) | **Real resources** |

Local tests never call the server, so no project API authorization is needed;
the checkout and database URLs are still local access capabilities, though.
"test" is not a permission boundary, and it does not block your script's own
network calls. Python/pytest, TypeScript/bun test and Rust inline cargo tests
are supported — nine production languages do **not** mean nine equivalent
offline SDKs.

> [!NOTE]
> Everything here is source-derived and unexecuted with synthetic data; this
> task installed and ran nothing.

## Setup, discovery, results

```sh
viat script test
viat script test tests/echo
viat script test --json
```

- **Python**: uv builds a temporary environment with pytest and your declared
  dependencies; tests live in `tests`, scripts in `scripts`.
  `load("folder/script")` resolves with Python's uses rules first and isolates
  modules — a flat import can still pick the wrong same-named `common`.
- **TypeScript**: discovery follows bun's `.test.ts`/`.spec.ts`; npm
  dependencies must already be installed. The CLI injects `node_modules/viat`
  temporarily, refuses to overwrite a real module, and removes the injected
  SDK afterwards.
- **Rust**: tests live in the script `.rs` under `cfg(test)` and compile in a
  temporary crate with declared deps; `VIAT_RUST_SDK_PATH` and a toolchain are
  required.
- **The host version must match the CLI**, found via `VIAT_TEST_HOST_BIN`,
  then next to the viat binary, then PATH. Faked upstreams do not guarantee
  the package-preparation phase skips registries/caches.

Mixed projects run every language suite; any failure exits non-zero — do not
stop at the first one. `--json` stdout shapes differ per language and runner
output goes to stderr; **the exit code is the reliable signal**. A missing
interpreter or failed initialization is not coverage. `viat publish apply
--require-tests` runs these local tests first: it does not run endpoint
fixtures automatically and does not replace the server-side case gate.

## The full fake surface

Python installs context with
`ctx_with(request=?,principal=?,resources=?,project_users=?,authz=?,ws=?)`;
TypeScript uses async `await ctxWith({...})` with camelCase helpers. Test
branches should set request/principal explicitly — omitting them is not "an
authenticated production identity".

| Fake | Backing and limits |
| --- | --- |
| `FakeHttp(cassette)` | http_api calls go through the real host dispatch. |
| `FakeGraphql(cassette)` | GraphQL documents. |
| `FakeCloud(cassette)` | cloud_api actions. |
| `FakeSecret(value)` | Synthetic value for get_resource/value; never real credentials. |
| `FakeConfig(dict)` | Local document; Python `from_resource(name)` reads the resource YAML's plain.data, keeping `$secret` placeholders; endpoint fixtures do **not** support config overrides. |
| `TestDb(url)` | A real scratch PostgreSQL, one rollback transaction per test; not a general DB simulator. |
| `FakeStorage(root?,prefix?,max_file_bytes?,allowed_types?)` | Temporary directory/in-memory metadata by default (explicit root excepted); keeps validation/error shapes, models the 100 MiB deployment default; URLs are `viat-test://`, not real signed links; no file authz/audit. |
| `FakeUpload(path,filename?,content_type?,field?)` | Local handle for `request.files`; not an HTTP multipart parser. |
| `FakeProjectUsers(initial,fail?)` | A separate project_users argument, not a resource; inspect user state/inject failures; `principal is_admin false` refuses; omitted means the fake sets no admin gate and does not reproduce all role/elevation protections. |
| `FakeAuthz(model)` | Separate authz argument; reads viat.yaml authz/export/dict and runs the **production policy engine**; principal identity/user_id/role/admin/meta/claims supply attributes; missing attributes fail closed, not allow-all. |
| `FakeWs(...)` | Python/TS record connections/rooms/sends/closes locally with the same UUID/code checks; no real socket; the default fake is empty and send is false. Rust has a WS event context but no equivalent connection fake. |

Unsupported resources/operations are meant to **fail**, not silently reach real
ones; do not infer from a production kind that mysql, raw s3 or everything is
fakeable. Covered: HTTP/GraphQL/cloud/secret/config/PostgreSQL/storage; TestDb
does not reproduce transaction.graphql or concurrent overlapping independent
connections.

## Minimal script and test

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

If the handler calls `ctx.resources.upstream.get("/thing/1")`, provide
`FakeHttp("cassettes/upstream.yaml")`; the expected object is the host's wire
response, not an invented requests.Response:

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

Cassette matching rules:

- Each entry needs `op`/`name` plus its response; `match` pins only the listed
  request fields — omitted fields are wildcards.
- HTTP matches method/path plus optional query/body; GraphQL documents and
  cloud actions use their own fields; `ignore` removes volatile body keys
  before comparison.
- Repeated matches are **consumed in order, then the last response repeats**;
  no match fails explicitly.
- Same path with different operations needs a pinned body/query or separate
  scenario directories; a loosely recorded cassette replaying "successfully"
  proves nothing about operation matching.

## Rollback, side effects, cancellation limits

- **TestDb** needs a real isolated schema; bare queries and transaction blocks
  share **one connection**. The script's transaction becomes a savepoint inside
  the outer rollback transaction — order/nesting are testable, overlapping
  independent transactions are not. Bare queries inside the block see
  uncommitted writes; another connection in production may not. Rollback never
  makes a production URL safe: non-transactional/external effects and
  isolation assumptions remain dangerous.
- **tasks**: offline `ctx.tasks.enqueue` records without scheduling;
  `ctx.tasks.enqueued` is ordered, `get` reports queued, `cancel` marks
  cancelled; target/delay/range syntax is checked, target existence and
  endpoint authorization are not. Console Test/endpoint tests are not
  automatically a pure local task recorder.
- **cache**: `ctx.cache.purge` only records the normalized GET path in
  `ctx.cache.purged`; nothing is actually purged.
- **FakeWs** acceptance is not real delivery; **FakeStorage** proves nothing
  about file authorization/audit.

No test timeout or cancellation undoes committed external effects. Use small
deterministic inputs and isolated roots/DB schemas; read the failure, fix the
fake/schema/setup, then rerun; clean up only what you created — never resend
real messages "to see whether the fake works".

## Recording is a real run

```sh
viat script run <name> --args '<json>' --record cassettes/scenario/
```

Recording issues **real server/resource requests** and captures
HTTP/GraphQL/cloud interactions — it is not an offline operation. Each
resource's YAML is **overwritten, not appended**; use one directory per
scenario. Request credentials applied by the platform and secret resources are
not recorded, but **response bodies are kept verbatim**: OAuth/business
responses can contain tokens or personal data — review redaction before
committing and never record flows that return secrets. Recording is
synchronous only; an async handle cannot return a complete cassette
immediately. Permissions and side effects equal a real draft run.

## Verification basis

Contract source `03751a67`: `crates/viat-runtime/src/testing.rs`, the
Python/TypeScript/Rust SDK testing helpers; `crates/viat-api/src/endpoint_test.rs`
and `handlers/scripts.rs`; `crates/viat-cli/src/commands/script.rs` and the
local runner. No runtime/DB/provider examples were executed; real transports,
quotas and concurrent transactions need separate verification.
