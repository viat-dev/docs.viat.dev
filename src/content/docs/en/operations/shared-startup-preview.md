---
title: "Shared-pool startup outside the state lock (preview)"
description: "Cold-start isolation, stage two: capacity reservations, same-content deduplication, and READY waits outside the state lock."
doc_id: operations.shared-startup-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased second stage builds on [startup resource cleanup](worker-lifecycle-preview.md). It neither describes shipped stable behavior nor claims that every cold-start path is isolated. See [runtime](../assets/scripts/runtime.md) and [capacity planning](capacity.md) for existing lane and budget contracts.

## Shared startup changes

A shared-pool hit still briefly reads state and obtains a sender. A miss reserves capacity and registers one startup record, then prepares the directory and waits for worker READY outside the state lock. Only a still-valid record can publish a serviceable slot. LRU records request access order, including starting content. Reaching READY is not a new access and must not demote a warm slot that was accessed during a slow start to the oldest entry.

The complete content key includes the script, source, frozen dependencies, and applicable compiled artifact identity. Concurrent misses for the same key share a startup and its result instead of each spawning a process. Published snapshots and drafts can still coexist; an older in-flight snapshot is not replaced with the latest draft.

Directory preparation uses bounded blocking work. Shared/dedicated pool-managed starts still share a single-start permit: **startup concurrency is not increased at the same time**. Existing environment builds, one-shot, stream, and long-run budgets do not become part of this permit. It is not a node-wide process limit.

## Capacity and cancellation

Ready shared slots and Starting reservations both count toward shared capacity, with at most two contents per script. Ordinary LRU eviction does not arbitrarily discard a startup reservation. When reservations occupy all capacity, new keys wait for state changes outside the lock. The existing effective capacity floor of one is preserved; `shared_max=0` is not redefined to disable the pool.

One departing waiter does not cancel a startup still needed by others. Cancellation becomes eligible after the last waiter leaves. READY waiting uses cooperative cancellation and bounded cleanup before returning the startup permit. Synchronous directory work cannot be forcibly stopped, so cancellation still waits for that work to end rather than releasing the permit early and accumulating background filesystem jobs.

Publication-related resets or policy changes can cancel old startup records. An old ticket cannot publish, remove a newer ticket, or charge an old failure after a circuit-breaker reset. A still-valid request retries with its original source and dependencies rather than silently switching content. If a dedicated set for that complete content is now live, the retry uses it instead of refilling a redundant shared slot.

Real spawn failures count once per startup, not once per waiter. A successful build invalidates older shared-start tickets in the same atomic commit that records validation and clears the breaker, covering layout and READY waits rather than only the probe phase. Failure invalidates only its complete content key, not other snapshots/drafts of the same script; circuit-breaker counting retains its existing script-level scope. Failure state is committed before the environment probe, so a late failure cannot erase a successful concurrent build's new validation. Normal failure responses still wait for the probe, but probes hold neither the state lock nor a startup permit and can be cancelled when the final waiter leaves or shutdown begins. The failure's validation/circuit-breaker state is not written again after probing.

A worker that reached READY but lost publication eligibility is drained outside the lock with a bounded grace. A delayed failure from an old sender can only evict the old slot it actually observed, not a newer replacement under the same key.

## Limits and shutdown

Stage two itself **does not move auto-promotion and explicit reconcile's directory preparation/READY waits outside the state lock**. Improvements for shared misses must not be described as eliminating publication or auto-promotion pauses. See the [stage-three preview](dedicated-startup-preview.md) for the subsequent changes and replacement-wait trade-offs.

Shutdown closes new admission, cancels pending shared starts, and waits for tracked startup cleanup. New shared slots cannot publish after closing. Dedicated policy tasks, asynchronous drains, and overall shutdown coordination have not all been redesigned. This stage does not promise to terminate arbitrary descendant process trees or make shared capacity a hard PID limit including draining processes.

Existing `ready_timeout`, per-slot queues, and execution budgets remain unchanged. Shared execution gains no hard-cancel capability. Waiting for capacity or a startup permit is not silently charged as script execution or per-slot queue time. Cancellation still does not roll back external side effects.

## Verification boundary

Interleaving regressions use independent per-supervisor local worker fixtures and barriers: a warm request finishes before another cold start is released; same-key deduplication; one/all waiter cancellation; full capacity; source/dependency/artifact isolation; invalidated tickets; failure/panic cleanup; no publication after closing; and delayed old senders cannot evict replacements.

Existing Python/TypeScript/Rust tests continue to cover actual language paths. Performance conclusions require a fixed-load comparison, not a promised hardware-independent multiplier or treating one diagnostic sample as end-to-end HTTP p99.
