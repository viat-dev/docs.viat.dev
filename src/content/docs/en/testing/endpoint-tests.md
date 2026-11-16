---
title: "Endpoint contract tests"
description: "Run fixture requests through real dispatch in a disposable local instance."
doc_id: testing.endpoint-tests
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.endpoint.test", "cli.script.run", "cli.workflow.test"]
---

# Endpoint contract tests

`viat endpoint test [dir]` checks the **wire contract**: authorizers/gates,
argument binding and coercion, raw bodies, script execution, response
transforms and the final HTTP result — layers that direct unit tests of your
script never touch.

How it works: the runner creates a throwaway scratch database and local host,
pushes your current checkout, publishes the endpoints, then executes fixture
requests one by one **with resource fakes** in place. It never runs fixtures
against your currently selected production server.

> [!WARNING]
> This is **not a network sandbox**: direct network calls from your script, and
> platform paths that bypass the resource fakes, can still have effects. Use
> synthetic config, no production credentials, and isolated database URLs.
> The examples here are source-derived and unexecuted; this task ran no tests,
> installs, database work or provider calls.

## Prerequisites

- A complete local Viat project/repository; the CLI has the slug selected; CWD
  is the repository root (session discovery never changes your CWD).
- A **version-matched** `viat-endpoint-test-host`, found via
  `VIAT_ENDPOINT_TEST_HOST_BIN`, then next to the viat binary, then PATH. The
  CLI checks the version first and rejects mismatches and old hosts that
  cannot report one.
- `VIAT_ENDPOINT_TEST_DB`: a Postgres base URL with CREATE DATABASE rights
  (not the application's testdb resource itself); the host creates and drops
  scratch databases there, so an isolated local Postgres must be ready.
- Interpreters/toolchains/dependencies your scripts need (uv for Python, bun
  for TypeScript, …); dependency steps may use the cache. "Offline" here means
  upstream interactions are faked — it does **not** guarantee the language
  preparation phase skips package repositories.

## Running

```sh
VIAT_ENDPOINT_TEST_DB='postgres://test:test@127.0.0.1:5432/postgres' viat endpoint test endpoint_tests
```

The default directory is `endpoint_tests`, and the command has **no
`--json`**. A missing/empty/YAML-less directory is an error, not a zero-test
success; a broken fixture counts as failed. Output is per-item `ok`/`FAIL`
plus `<n> passed, <n> failed`, exit 1 on any failure; host-internal rows are
`{name,passed,detail?}` with no detail on pass.

The host registers a one-off console user, creates the project, imports
resources/pushes, and publishes with **both acknowledgements true** — so a
green fixture run **does not prove** the publish gate would pass. The
bootstrap permissions live only inside the scratch instance; they say nothing
 about managing production.

## Full fixture schema

One object per `.yaml`/`.yml` file:

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

This example targets the [HTTP echo](../triggers/http.md): `body_contains`
matches a compact-JSON **substring**, not structural equality — whitespace
differences break the match, so look at real output before switching renderers.

| Field | Default/behavior |
| --- | --- |
| `name` | Optional; null becomes `<method> <endpoint>`. |
| `endpoint` | Required; the path after `/p/<slug>`, leading slash allowed — not a full URL. |
| `method` | `GET`. |
| `headers` | Empty string map; invalid headers fail construction; supply Authorization yourself if needed. |
| `query` | Empty string map; URL-encoded automatically; no repeated multi-value keys. |
| `body` | Absent/null means empty; strings go as-is, objects/arrays serialize as JSON — unless you set a content type explicitly. |
| `login` | Optional/null; `{authorizer,identity,credential}` logs in through the real project authorizer and carries the returned bearer; omit for anonymous. All three fields are required when present — it is not arbitrary claims injection. |
| `resources` | Empty map; each resource takes exactly one backing below. |
| `expect.status` | Required; u16 HTTP status. |
| `expect.body_contains` | Optional/null; substring; no built-in exact-JSON/header/stream-timing assertions. |

Fake resources example:
`resources:{upstream:{cassette:cassettes/upstream.yaml},token:{secret:synthetic},db:{testdb:"postgres://test:test@127.0.0.1/test_data"},files:{storage:{}}}`.
The YAML does not execute source/expectation files — your project scripts stay
real code. Preparing cassettes and isolated data: [fixtures](fixtures.md).

The DTO shape allows exactly one of cassette/secret/testdb/storage/config per
resource, but:

> [!WARNING]
> **Endpoint config overrides are explicitly rejected at runtime** — the test
> uses the published config resource itself. The field existing on the DTO
> does not make `{config:{…}}` usable. Storage takes an optional `root`
> (default: a temporary directory), `prefix` defaulting empty,
> `max_file_bytes` 0 and `allowed_types` empty; a secret fake is just a
> string. Fakes also do not prove every native resource/target
> (proxy/CRUD/auth/files) is intercepted the same way — verify the actual
> path and use isolated addresses.

## Isolation, failures, cleanup

- Fixtures run sequentially, each with its own resource host/login; the login
  hook and the endpoint use **independent cassette cursors**, so the hook
  cannot consume the endpoint's first response.
- The scratch platform database is shared within one host run; per-fixture
  resets are not guaranteed. TestDb has its own rollback transaction and
  savepoint limitations.
- Responses cap at 16 MiB; unterminated streams wait for the runtime timeout —
  this format cannot assert live socket protocols or stream timing.

On initialization or fixture errors the CLI shuts down, drops the database and
kills the host as best it can; after a forced termination, check for leftover
local hosts/scratch databases yourself — confirm ownership before deleting,
never delete by guessed name. Do not treat a production URL as a safe data
source via rollback; explicit root files, direct network calls and real task
enqueues may need extra cleanup. There is no generic retry/cancel flag: fix
the version/interpreter/initialization/schema or the assertion, then rerun
deliberately.

## How this differs from direct draft tests

`viat script run echo --args '{"name":"Ada"}'` calls
`/scripts/<name>/test-run` with **real resources** and returns output/logs; an
explicit ViatResponse can make output null.

`viat workflow test flow --input '{}'` calls `/workflows/<name>/test_run` and
prints each step; the CLI rule is: **any failed step attempt exits 1, even if
a later retry/catch recovered** (a user_error fails too). A completed
recovery is not necessarily a green CLI. This chain, offline fixtures and
saved cases are three different kinds of "test" — do not mix them; see
[saved cases](saved-cases.md).

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/endpoint_test.rs`, the
endpoint-test-host and endpoint_test_flow tests;
`crates/viat-cli/src/commands/{endpoint_test,script,workflow}.rs`. Real
providers, proxies, sockets and dependency installs were not verified.
