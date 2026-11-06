---
title: 'Workflow limits and snapshots'
description: 'Concurrency, budgets, cancellation, restart and published versus draft data.'
doc_id: workflow.limits
verified_release: '1.1.0'
channel: stable
---

# Workflow limits and snapshots

Workflows orchestrate bounded in-process execution. They do not persist instruction pointers or resume running steps after a restart. A database-backed queue is not a durable workflow checkpoint engine.

## Limits and separate concurrency knobs

| Control | Default/range and boundary |
| --- | --- |
| YAML entry nesting | Maximum structural nesting depth 16; distinct from sub-workflow call depth. |
| Nested workflow calls | Maximum call depth counter 4; static cycles rejected while baking, runtime also checks depth. Root starts at depth 0; a call from depth 4 is refused. |
| while/until max_iterations | Required 1–1000; exhaustion is an error, not a truncated successful result. |
| for_each max_concurrency | Default 4, integer 1–16, inside for_each mapping. |
| parallel max_concurrency | Absent allows all declared children, explicit integer 1–16, sibling of parallel. It bounds child entries, not all nested leaves globally. |
| root max_concurrent | Optional positive u32, eligible detached target runs; separate project/key durable admission budget. |
| script retry times | 1–10 **additional retries**, up to 11 attempts; all share deadline. |
| task chains | Deployment max depth normally 100, not the workflow nesting depth. Python/TypeScript task API only. |

There is no published universal “for_each handles unlimited items safely” guarantee. The engine allocates iteration futures/result arrays for the resolved input; max_concurrency limits active work, not input/result memory. Bound input arrays and output size at your application boundary. Nested fan-outs multiply, and deployment worker/connection/resource limits can admit less than the YAML asks.

## One budget

Root `timeout` selects a total run budget, fallback project/deployment default (normally 30 seconds), clamped by the connected/detached ceilings (normally 300/1800 seconds). A step script's own timeout and a child workflow's declared timeout do **not** reset the parent deadline. Child calls inherit the remaining budget; rounding to seconds is an implementation granularity, not a fresh full window. Retry delays, semaphore waits, resource requests and every iteration consume the same budget.

Lane selection uses the root declared budget, not the shrinking remainder. A long workflow keeps long-run lane semantics even near completion. A queued workflow holds one admitted long-run permit for its run; its one-shot steps and parallel branches do not recursively acquire a new permit per child. Outside queued admission, deployment lane limits still apply and overload can fail a step.

## Queue admission and restart

Root `max_concurrent`/`concurrency_key` apply to eligible background endpoint runs/tasks, not synchronous requests or ordinary test/schedule acceptance. Key absent uses `workflow:<folder/name>`; a declared key shares a project-local budget with scripts/workflows. Same key does not make inconsistent declared limits converge into a new global value: each accepted run keeps its declaration. Invalid/zero limits may be ignored and publish warns; they are not a disable switch.

Waiting rows preserve frozen target/input/principal and survive process restart. They have no caller Authorization credential; caller_token resources cannot use it later. Queue depth and lane caps still apply. A run already executing when its instance dies is marked `interrupted`; it is **not** resumed/retried from the last completed step. At-least-once external effects, idempotency and compensation remain application responsibilities.

## Cancellation and parallel failure

The engine checks cancellation before entries, retry attempts and loop iterations, ahead of deadline checks. It cannot be swallowed by `on_error: continue` or catch. A worker-owning lane can terminate its current process; shared workers, SQL and unsupported paths can finish the current step first. Rust execution is not cancellable in 1.1.0. The guarantee is boundary-aware stopping, not universal instantaneous interruption or rollback.

Parallel/for_each use fail-fast joining: one unhandled failure drops sibling execution futures. Requests/writes already sent may complete and some sibling end logs may be absent. Do not infer “did not happen” from a missing end row. A script catch/continue can convert a child failure to success; there is no wrapper-wide retry/catch policy. Partial fan-out effects must be reconciled explicitly.

## Published and draft behavior

Endpoint publish bakes the workflow definition, each step script main source and recursively nested workflow definitions. Changes in editor/live rows take effect for direct test/schedule targets, but public published callers keep the snapshot until republish. Rollback restores that baked definition/source, not external databases or live resources.

**Important 1.1.0 exception:** workflow-step `uses:` modules are resolved live before each workflow run, including all nested steps. Unlike an ordinary script endpoint's frozen non-live graph, these dependency modules are not persisted in workflow snapshots. Shared-module edits can change a published workflow without republishing; rollback does not restore those modules. Explicit `(live)`, direct drafts/schedules and legacy script snapshots without frozen module metadata also resolve live. [Script dependencies](../scripts/dependencies.md) describes the distinction.

Resources are resolved using step/dependency folder context and current resource data; the YAML is not a universal secret snapshot. Prefer broker helpers and do not serialize authentication projections into outputs. Steps inherit principal/request; nested workflows do not add privileges. A raw-body workflow endpoint has only path/query arguments under `$inputs`; a script step reads the raw bytes from request context.

## Verification and unsupported features

Use [overview](overview.md)'s no-resource case, add bounded concurrency and deliberate failures in an isolated project, inspect result order plus per-attempt logs, and compare draft versus published execution after an edit. Logs identify nested paths such as `sub.inner` or `sub[0].inner`; step_index alone is not globally unique—iteration/attempt/path matter. A rerun is a new execution with possible repeated effects, not checkpoint restoration.

No native approval, wait-event, durable sleep/checkpoint or external-job adapters exist. Long waits should not be disguised as unbounded loops; use a deliberate task/schedule design with state in your application if needed. This page provides manual cases only; no live cancellation/restart/side-effect verification was performed here.
