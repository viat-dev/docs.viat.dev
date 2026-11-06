---
title: 'Async tasks from scripts'
description: 'Enqueue, inspect and cancel project work without blocking the caller.'
doc_id: script.async-tasks
verified_release: '1.1.0'
channel: stable
---

# Async tasks from scripts

`ctx.tasks` is a Python/TypeScript API only. It creates ordinary project run-queue jobs, not a new workflow step, recurring schedule or external job adapter. Use only in a project where the parent run and target are authorized. No task is created by the examples until you explicitly run them against an instance.

## Input and output

Python signature: `ctx.tasks.enqueue(script=None, workflow=None, endpoint=None, args=None, delay=None, run_at=None, immediate=False)`. TypeScript: `await ctx.tasks.enqueue({script?, workflow?, endpoint?, args?, delay?, run_at?, immediate?})`.

| Field | Contract |
| --- | --- |
| Target | Exactly one of `script`, `workflow`, `endpoint`. Script/workflow use an asset path; endpoint is `"POST /path"` with method and path. Proxy/CRUD targets are not tasks. |
| `args` | JSON object, default `{}`, at most 1 MiB serialized. Pass an ID or storage key instead of a large payload. |
| `delay` | Seconds; Python also accepts `timedelta`. Mutually exclusive with `run_at`. |
| `run_at` | RFC 3339 timestamp; Python accepts timezone-aware `datetime`, TypeScript `Date`. At most 30 days ahead; neither scheduling field means as soon as admitted. |
| `immediate` | Boolean, default false. False defers persistence until the parent run finishes successfully; true writes at this call. |

The handle is `{run_id, status:"queued", scheduled_for?, deferred, target_kind, target_ref}`. `get(run_id)` returns a run of this project or null/None: status, output, error_kind/error_message, http_status, progress, timestamps and parent_request_id. A deferred handle may not yet have a row. `cancel(run_id)` returns `{cancelled,status,reason?,detail?}`; a deferred not-yet-written task can be retracted, a queued row removed, and a running job signalled when cancellable. Reasons include `already_finished`, `not_cancellable`, `owner_unreachable`.

## Minimal safe producer

Create a target asset `task_target` containing:

```python
def main(value: int):
    return {"value": value}
```

Create producer `task_producer`:

```python
from viat import ctx

def main(value: int):
    return ctx.tasks.enqueue(script="task_target", args={"value": value}, delay=60)
```

TypeScript producer:

```typescript
import { ctx } from "viat";
export async function main(args: { value: number }) {
  return await ctx.tasks.enqueue({ script: "task_target", args, delay: 60 });
}
```

Input `{"value":7}` returns a queued handle, not the target's output. After successful producer finalization and the delay, the target result is `{"value":7}`. Use `get` to observe it; do not busy-loop in the connected request. In offline `viat script test`, enqueue is recorded, not executed; console Test and draft runs enqueue **for real**.

## Identity, publication and transaction boundary

A direct script/workflow target is read live and frozen at enqueue; a target endpoint uses its published snapshot. The task carries the parent's authenticated principal, never the original credential. A `caller_token` resource therefore has nothing to forward. Endpoint authorization gates are checked at enqueue, so a denied target fails the call with `403 forbidden` rather than failing hours later.

Default deferral commits tasks only when the entire parent run ends without error. Exceptions, timeout, `ViatError`, or explicit 4xx/5xx responses discard them. A workflow step's tasks wait for the **whole workflow** to succeed. This is not a distributed transaction with the business database: prior DB writes may persist even when a later error discards tasks. `immediate=True` opts out of deferral and survives later parent failure. Streaming uses the status-line decision; generator failure after it may happen after tasks were already submitted.

The target's queue declaration controls admission; a task chain is capped by deployment depth, normally 100, with `429 task_depth_exceeded`. There is no recurring form. Use a schedule for a repeating job. Cancelling a task is not undo; inspect final state and apply business compensation if it already made effects. Queued rows survive restart; already-started execution does not resume from a checkpoint. [Runtime](runtime.md) explains cancellation limits and [Testing](testing.md) the offline recorder.
