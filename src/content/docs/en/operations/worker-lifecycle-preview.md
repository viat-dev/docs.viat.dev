---
title: "Worker startup resource cleanup (preview)"
description: "The first stage of cold-start lock isolation: explicit resource ownership without changing pool scheduling."
doc_id: operations.worker-lifecycle-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This page describes unreleased worker lifecycle fixes, not a stable 1.3.0 guarantee. See [script runtime](../assets/scripts/runtime.md) and [capacity planning](capacity.md) for current budgets, lanes, and cancellation boundaries.

## What changes

Before a worker emits READY, a startup owner holds the direct child process, control pipe, stdin, stdout reader task, and temporary run directory. After READY succeeds, these resources transfer together to the driver that executes requests.

- Dropping the startup wait terminates the direct child and cancels its output reader instead of merely discarding a task handle that continues running in the background.
- A READY timeout or an early control-pipe close requests process termination, retains the existing bounded stderr diagnostic, and then attempts to reap the direct child.
- Output readers no longer rely solely on EOF. Even if another process inherited a write end, abandoning the owning startup or driver cancels its reader tasks.
- Abandoning the entire ready slot, or cancelling its drain future, cancels the driver and cleans up its child and output readers through their owned lifetimes.
- An explicit drain still allows requests using already-issued senders to finish. While those senders remain alive, drain does not pretend to have completed.

The distinction matters: **dropping one request's sender is not dropping the entire slot owned by the shared pool.** One departing caller does not terminate the warm worker shared by other callers.

## Failure and cleanup boundaries

The existing READY wait budget is unchanged. After an explicit startup failure, the existing stderr tail collection waits up to 500 milliseconds, with a separate two-second grace for reaping the direct child. These are not an end-to-end HTTP wall-clock limit. Cleanup failures produce warnings, and the child handle retains its kill-on-drop protection.

Sending a termination signal, finishing the driver, and completing operating-system process reaping are different events. A dropped future cannot synchronously await all cleanup; final results must be checked through process and task state. This stage does not promise to terminate arbitrary descendant process trees or turn process isolation into a complete hostile-code sandbox.

Cancellation still cannot roll back database writes, external calls, or messages already sent. Scripts that require idempotency or compensation still need those mechanisms.

## Behavior explicitly unchanged

This stage does not move the supervisor's global lock, raise startup concurrency, change shared/dedicated/queued/stream/long-run selection, change frozen or live dependency semantics, or add hard cancellation to shared execution.

Consequently, **this stage does not claim that cold-start latency optimization is complete**. Same-key startup deduplication, capacity reservations, publication epochs, auto-promotion, and coordinated shutdown remain later stages. Dropping one drain task handle also does not prove that every untracked background drain at a higher layer has stopped.

## Verification

Regression fixtures use a local controlled worker and release a READY barrier over stdin instead of guessing progress with a fixed sleep. Coverage includes process spawn failure, pre-READY cancellation, READY timeout, early control EOF with stderr preservation, READY ownership transfer, graceful drain, cancelled drain, driver panic, and reader cancellation while a write end remains open.

Checks observe direct-child exit, output-task completion, release of shared state, and temporary-directory removal. The normal path also verifies that an existing sender can still complete a request. Existing Python/TypeScript slot tests remain in place. These checks need no real resource credentials or production requests and make no external-provider calls.
