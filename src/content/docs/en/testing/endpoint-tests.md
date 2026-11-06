---
title: "Endpoint contract tests"
description: "Run fixture requests through real dispatch in a disposable local instance."
doc_id: testing.endpoint-tests
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.endpoint.test", "cli.script.run", "cli.workflow.test"]
---

# Endpoint contract tests

`viat endpoint test [dir]` checks the wire contract: authorizer/gates, argument binding/coercion, raw body, script execution, response transform and HTTP result. Direct script unit tests do not cover those layers. The runner creates a scratch database/local host, pushes this checkout, publishes its endpoints, then drives in-process requests with resource fakes. It does not call your selected production server to run fixtures, but **this is not a network sandbox**: direct script network code and platform paths not using the resource fake can still have effects. Use synthetic config, no production credentials, and isolated database URLs.

All snippets are source-derived/unexecuted; this task ran no tests, installation, database or provider calls.

## Prerequisites and invocation

- A complete local Viat project/repo with selected slug in CLI configuration. CWD is the repo root; session discovery does not move it.
- Matching-version `viat-endpoint-test-host`: lookup `VIAT_ENDPOINT_TEST_HOST_BIN`, sibling of viat, then PATH. The CLI asks its version and refuses a mismatch, including an old host that cannot report one.
- `VIAT_ENDPOINT_TEST_DB` is a base Postgres URL with CREATE DATABASE rights; it is not the application/test data resource itself. The host creates/drops a scratch DB there. Provision an isolated local Postgres beforehand.
- Required runtime interpreters/toolchains/dependency availability for scripts (e.g. uv for Python, bun for TypeScript). Package resolution may need prepopulated caches; “offline tests” means fake upstream interaction, not a guarantee that language setup cannot access a package registry.

```sh
VIAT_ENDPOINT_TEST_DB='postgres://test:test@127.0.0.1:5432/postgres' viat endpoint test endpoint_tests
```

There is **no --json flag** on this command. Default dir is endpoint_tests. Missing/empty/yaml-less fixture directory is an error, not a zero-test success. A malformed fixture is reported as failure. The CLI prints each `ok`/`FAIL`, final `<n> passed, <n> failed`; any fixture failure exits 1. Internal host result rows are `{name,passed,detail?}`, detail omitted on pass.

The host registers a disposable console user, creates a project, imports resources/pushes the checkout and publishes with **both warning/test acknowledgements true**. Therefore endpoint fixtures do **not** prove publication gates passed. This setup is privileged only inside the scratch instance, not evidence that the fixture caller can manage production.

## Complete fixture schema

One YAML object per `.yaml`/`.yml` fixture:

```yaml
name: echoes the query
endpoint: hello
method: GET
headers: {}
query: {name: Ada}
resources: {}
expect:
  status: 200
  body_contains: '"hello":"Ada"'
```

For the [HTTP echo endpoint](../triggers/http.md), this expects a compact JSON substring. This is intentionally a **substring**, not structural JSON equality; whitespace can affect it. Do not copy the assertion onto a different renderer without inspecting output.

| Field | Default / behavior |
| --- | --- |
| `name` | Optional/null uses `<method> <endpoint>`. |
| `endpoint` | Required path after `/p/<slug>`, leading slash tolerated; not a full server URL. |
| `method` | GET. |
| `headers` | Empty string map; invalid names/values fail request construction. May supply own Authorization. |
| `query` | Empty string map, keys/values URL-encoded; not repeated-key/multimap input. |
| `body` | Default/null empty body; string verbatim, object/array serialized JSON (JSON content type unless explicitly set). |
| `login` | Optional/null; `{authorizer,identity,credential}` logs in through the real project authorizer and sends returned bearer. Omit for anonymous routes. All three fields required if present. It is not arbitrary claims injection. |
| `resources` | Empty map; each fake sets exactly one backing below. |
| `expect.status` | Required u16 HTTP status. |
| `expect.body_contains` | Optional/null string substring; no built-in exact JSON/header/stream timing assertion. |

Example fake map: `resources:{upstream:{cassette:cassettes/upstream.yaml},token:{secret:synthetic},db:{testdb:"postgres://test:test@127.0.0.1/test_data"},files:{storage:{}}}`. No source/expected file is executed by YAML itself; the project scripts are real code. See [fixtures](fixtures.md) for cassette matching and scratch data precautions.

Fake declarations accept exactly one of cassette, secret, testdb, storage or config structurally, **but endpoint config overrides are explicitly refused at runtime**: the published config resource is used as-is. Do not advertise `{config:{…}}` as a working endpoint fixture fake just because the DTO accepts it. Storage settings are optional `root,prefix:"",max_file_bytes:0,allowed_types:[]`; absent root uses temporary storage. Secret fake value is a string. Fake backing does not prove every native resource/target (proxy, CRUD, auth, files) is intercepted identically; verify the path being tested and use only isolated addresses.

## Isolation, failure and cleanup

Fixtures run sequentially, each with its own resource host and login. Login hooks get a **separate cassette cursor** from endpoint execution, so their first call does not consume the endpoint's first response. Scratch platform DB is shared within that host run, not automatically reset after each fixture. TestDb calls use their own rolled-back test transaction; see its savepoint limitations. Responses are collected up to 16 MiB; a stream without termination can still wait for its runtime timeout, and this fixture format cannot assert live socket protocol or streaming timing.

CLI attempts shutdown/database drop on setup/fixture errors and kills the host; abrupt OS termination can still require checking for a leftover local host/scratch DB. Do not drop a DB solely by a guessed name: identify it as this test's scratch artifact first. Never point testdb at production relying on rollback as a general safety boundary. Explicit root storage files, direct network calls and real task enqueue paths may need separate cleanup. No generic retry/cancel flag: fix schema/host/version/interpreter/setup or fixture mismatch first, then rerun intentionally.

Direct draft tests are another surface: `viat script run echo --args '{"name":"Ada"}'` calls `/scripts/<name>/test-run`, uses real resources and returns output/log metadata; explicit ViatResponse may have output:null. `viat workflow test flow --input '{}'` calls `/workflows/<name>/test_run`, prints step runs; CLI exits **1 if any step attempt is failed even when retry/catch recovery later succeeds**, or if user_error exists. A recovered workflow is not necessarily green under that CLI criterion. Do not confuse either with offline fixtures or saved-case matching. See [saved cases](saved-cases.md).

Evidence: `crates/viat-api/src/endpoint_test.rs`, endpoint-test-host binary and endpoint_test_flow tests; `crates/viat-cli/src/commands/{endpoint_test,script,workflow}.rs`. Actual provider, proxy, socket and package-install behavior was not tested here.
