---
title: 'Runtime, errors and streaming'
description: 'Budgets, responses, cancellation and streams.'
doc_id: script.runtime
verified_release: '1.1.0'
channel: stable
---

# Runtime, errors and streaming

An endpoint runs its published source, not the editor text. Direct `viat script run` runs a draft and can use real resources. Saving is neither a dependency-build check nor a publish. Shared modules follow a specific [snapshot rule and workflow exception](dependencies.md).

## Execution budget and lanes

Resolve valid `timeout:`, then project default, then deployment default (normally 30 seconds). Clamp to the deployment ceiling: normally 300 seconds for connected callers and 1800 for detached/schedule/watch/chat runs. A requested budget cannot override that ceiling. The editor supports 1–86400 seconds; the low-level parser accepts a positive integer of at most six digits before clamping.

Python/TypeScript use warm shared workers below the shared threshold (normally 60 seconds), a capped long-run lane at/above it, dedicated workers when configured, and a capped stream lane with `stream: true`. Explicit live dependencies force one-shot execution; frozen dependencies remain warm-pool eligible. SQL/GraphQL/viat_gql/llm use platform clients; shell starts a fresh Bash process. Rust/binary artifacts have warm-worker and one-shot paths too; language contract flags do not promise that artifact processes are never reused.

A workflow has one total timeout. Each step receives the remaining budget; its own script header does not reset it. Lane selection follows the **declared workflow budget**, not the remaining seconds. Resource I/O and retries consume the same clock.

## Responses and errors

Plain returns are JSON responses (normally 200, with any endpoint response transform). Python explicit response:

```python
from viat import ViatError, ViatResponse

def main(name: str):
    if not name.strip():
        raise ViatError(status=400, code="invalid_name", message="name must not be blank")
    return ViatResponse({"hello": name}, status=201, headers={"x-example": "1"})
```

TypeScript equivalent:

```typescript
import { ViatError, ViatResponse } from "viat";
export async function main(args: { name: string }) {
  if (!args.name.trim()) throw new ViatError({ status: 400, code: "invalid_name", message: "name must not be blank" });
  return new ViatResponse({ body: { hello: args.name }, status: 201, headers: { "x-example": "1" } });
}
```

`ViatResponse` accepts exactly one of `body`, `file`, `bytes`; body must be an object/array/string, not a scalar or null. Defaults: status 200, headers `{}`, content type null; status is integer 100–599. File is a managed-storage reference (Python file row or `(storage,id_or_key)`), not an arbitrary server pathname. Bytes are bounded; file reads still pass authorization. `filename` and `disposition` (`attachment`/`inline`) shape downloads.

`ViatError` is an intentional HTTP refusal with status, code, message and optional extra object. Unexpected exceptions are runtime failures with details logged; never send tracebacks or resource configuration to callers. Endpoint argument-schema rejection happens before the script. Missing resources, kind mismatch, import/contract errors, unavailable environments, overload and timeout are distinct failures; extending timeout cannot repair them. A returned 4xx/5xx envelope also affects deferred task submission.

Draft readback caveat in 1.1.0: the server's script test-run API reports plain `output`, stdout and stderr but does not expose an explicit response envelope as output. Therefore `viat script run` prints null for a successful `ViatResponse` (and cannot validate its HTTP status/headers or a stream this way). Verify explicit HTTP/stream behavior through a deliberately published disposable endpoint or an appropriate endpoint contract fixture; do not change a correct response into a plain return merely to satisfy this draft readback.

## Streaming

Python returns `ViatStream` wrapping a generator or async generator:

```python
# stream: true
from viat import ViatStream

def main():
    def items():
        yield {"n": 1}
        yield {"n": 2}
    return ViatStream(items())
```

TypeScript requires an **async iterable**, not a synchronous generator:

```typescript
// stream: true
import { ViatStream } from "viat";
export async function main() {
  async function* items() { yield { n: 1 }; yield { n: 2 }; }
  return new ViatStream({ generator: items() });
}
```

Expected default body: two NDJSON items, `{"n":1}` then `{"n":2}`, each on its own line. An SSE-configured endpoint frames items as SSE. Stream status/headers/content_type have the response defaults above. Yield JSON-serializable values; top-level `_viat_error` is reserved. A late failure cannot change an already-sent status: it reports a stream error/end instead of replacing the response with an ordinary JSON error. The header declares lane admission; it does not turn a plain result into a stream. One-shot paths cannot provide the pooled streaming protocol, so do not assume live `uses:` works with streaming.

Cancellation is lane-dependent. Workflows check between entries, retries and iterations; worker-owning lanes can also stop the in-flight process. Warm shared execution, SQL and some paths may finish their current step first. Rust execution is not cancellable in this release. Cancellation does not roll back database writes, external requests, messages or immediate tasks. Use idempotency and compensation. Queued runs can be removed before a worker starts; running jobs have no durable checkpoint.

## Target queue limits and restart

`max_concurrent` controls eligible async endpoint runs and tasks, not synchronous callers. A queued row freezes input, authenticated principal and target, never the caller Authorization header. `caller_token` resources cannot borrow it later. Limits are cluster-wide per project/key; deployment lane caps still limit starts. Defaults include queue depth 1000 and poll interval 1 second. Schedules and direct tests are not automatically queued.

Queued rows survive restart. Runs already started on the lost instance become interrupted, not resumed. Cancellation, timeout and retry do not make effects atomic. [Testing](testing.md) distinguishes offline tests from real draft runs.
