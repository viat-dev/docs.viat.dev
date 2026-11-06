---
title: 'Testing and extracted schemas'
description: 'Offline tests versus live draft runs and schema extraction limits.'
doc_id: script.testing
verified_release: '1.1.0'
channel: stable
---

# Testing and extracted schemas

There are three different operations. `viat script test` runs **local offline** suites. `viat script run NAME --args JSON` executes the saved **live draft on the server**. Publishing an endpoint freezes the target for public callers. Neither a passing offline test nor a passing draft run changes a published endpoint.

## Minimal Python offline case

In an existing local project, save `scripts/hello.py`:

```python
from viat import ctx

def main(name: str = "world"):
    ctx.logger.info("greet", who=name)
    return {"hello": name}
```

Save `tests/test_hello.py`:

```python
from viat.testing import ctx_with
from hello import main

def test_hello():
    ctx_with()
    assert main(name="Ada") == {"hello": "Ada"}
```

```bash
viat script test tests/test_hello.py
viat script test --json
```

Requires `uv` and Python locally. The CLI prepares an ephemeral pytest environment including script requirements and puts `scripts/` and `tests/` on the import path. For folder-local `uses:` use `from viat.testing import load` then `load("folder/name").main(...)`; flat imports cannot isolate same-named folder modules.

TypeScript requires Bun. A matching `scripts/hello.ts` and `tests/hello.test.ts`:

```typescript
// scripts/hello.ts
import { ctx } from "viat";
export async function main(args: { name: string }): Promise<{ hello: string }> {
  ctx.logger.info("greet", { who: args.name });
  return { hello: args.name };
}
```

```typescript
// tests/hello.test.ts
import { test, expect } from "bun:test";
import { ctxWith } from "viat/testing";
import { main } from "../scripts/hello";
test("hello", async () => {
  ctxWith({});
  expect(await main({ name: "Ada" })).toEqual({ hello: "Ada" });
});
```

```bash
viat script test tests/hello.test.ts
```

The runner selects Python pytest, Bun tests, and Rust `#[cfg(test)]` suites it finds; it is not a universal SQL/shell/LLM interpreter. Missing local tools are prerequisites, not evidence of a passing suite.

## Fakes, permissions and effects

The test host answers real resource RPC from fixtures. Supported fakes include HTTP, GraphQL, cloud, secret, config, managed storage and PostgreSQL. `TestDb(url)` uses a **real scratch PostgreSQL database**, wraps each test in a rollback transaction, and models broker transactions as savepoints. It is not network-free; never point it at production. Concurrent overlapping transactions are not reproduced faithfully by that single test connection.

`ctx_with(resources={...}, request={...}, principal={...})` / `ctxWith({...})` supplies context. Use FakeAuthz/FakeProjectUsers/FakeWs when those helpers matter; a permissive or absent fake does not prove production authorization. Unsupported helper kinds fail rather than silently accessing a real resource. MySQL, S3 and a transaction's GraphQL path are not covered by this harness in 1.1.0. A cassette records/replays HTTP-shaped I/O, not every protocol.

`ctx.tasks.enqueue` is recorded in `ctx.tasks.enqueued`, `get/cancel` act on the recorder, and `ctx.cache.purged` records purge requests. Only offline tests do this. Server draft/Test runs can send mail, push, publish messages, write secrets and create real tasks. Recording via `viat script run hello --record cassettes` is itself a real run: obtain opt-in and inspect cassettes for sensitive application payloads.

## Extraction matrix

| Language | Input/output extraction and limits |
| --- | --- |
| Python | Parse `main` annotations/defaults and supported local type structures. Missing/unsupported annotations open that field and can warn; `Optional[T]`, `T \| None`, default None accept null. Return annotation is not a proof of every runtime return. |
| TypeScript | Best with `export function main(args: { ... }): Promise<{ ... }>`; supported primitives, arrays, object literals and unions. Named/imported/complex types can become `{}`; it is not whole-program typechecking. Optional property is not the same as nullable. Runtime can accept default export, but extraction expects a named main declaration. |
| SQL | `:name` plus `-- @input name:type[=default]`; untyped placeholders default to required string with warning. Output describes rows/affected but not exact columns. Scanner is simpler than SQL binding; unusual casts/dollar quotes can produce misleading extracted parameters. |
| Shell | Header `# @input`; no static output schema, always a warning. Defaults are strings. |
| GraphQL | Variables of **first** operation; warns on multiple operations. Custom scalars/enums/input objects are opaque. Extracted output says data/errors envelope, but actual runner returns only `data`; do not mistake it for observed output. |
| `viat_gql` | Extraction currently unsupported; open schemas and warning. Database schema introspection is a different feature. |
| `llm` | `{{name}}` placeholders become required string inputs; content/model/usage output. This does not validate model factual accuracy. |
| Rust | Compile then run `--viat-schema`; `serve_typed` gives serde/schemars schema. Saving clears it; compile/publish refreshes it. Untyped serve has no typed schema. |
| Binary | No extracted I/O schema and no schema probe; endpoint input is open. Protocol conformance is still mandatory. |

Extraction failures are warnings/open schemas, not blanket rejection of source. Inspect `schema_warnings` and saved schemas, then verify endpoint bindings and refusal behavior. Do not assume JSON Schema defaults populate missing inputs. Workflow input defaults are explicitly applied by the workflow engine; see [Workflow grammar](../workflows/overview.md).

## Draft, publish and cleanup commands

First [authenticate to the instance](../../instance/platform-users.md) and [select an isolated project](../../projects/create-and-collaborate.md). Replace `ENDPOINT_ID` with the ID returned when creating the endpoint; it is not a name flag.

```bash
viat script create --name hello --language python --file scripts/hello.py
viat script update hello --file scripts/hello.py
viat script run hello --args '{"name":"Ada"}'
viat endpoint create --segment hello --method POST --script hello
viat endpoint publish ENDPOINT_ID
viat script logs hello
viat endpoint unpublish ENDPOINT_ID
viat endpoint delete ENDPOINT_ID
viat script delete hello
```

Expected script body is `{"hello":"Ada"}`; `script run` prints the successful output as pretty JSON on stdout and diagnostic stderr separately. Publishing may refuse warnings/test gates; fix them instead of automatically acknowledging. CLI access does not bypass project membership, authoring rights or public endpoint authentication. Deletion is real and not part of an offline test. No tests or real-service calls have been run for these snippets here.
