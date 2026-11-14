---
title: "Dedicated pools and publication plans outside the state lock (preview)"
description: "Cold-start isolation, stage three: atomic dedicated groups, publication epochs, retirement budgets, and shutdown cleanup."
doc_id: operations.dedicated-startup-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased change builds on [resource lifecycles](worker-lifecycle-preview.md) and [shared-pool startup](shared-startup-preview.md). It does not claim availability in stable releases. See [runtime](../assets/scripts/runtime.md) and [capacity planning](capacity.md) for existing language and cancellation contracts.

## Dedicated startup no longer waits under the global state lock

Auto-promotion and explicit reconcile use tracked dedicated-start records. Directory preparation, READY waits, retirement, and failed-artifact cleanup happen outside the supervisor state lock; only short policy decisions and whole-group commits hold it.

Pool-managed startup retains the same single-start permit used by shared workers. Startup concurrency is not increased at the same time. Environment builds and one-shot lanes retain their separate budgets; this permit does not imply a node-wide PID limit.

A new group commits only after all added slots reach READY and content/policy authority is still valid. Partial groups are neither routed to nor counted as healthy residents. Failed, cancelled, or obsolete partial groups are cleaned up together.

## Publication epochs and explicit policy ownership

The API acquires a project scope before its first asynchronous script read or environment build and carries that scope into application. An older plan cannot overwrite a newer desired set merely by finishing its reads or builds later. The scope is bound to both the project and supervisor instance, not a reusable cross-project token.

Epochs order policy calls, not script version numbers. An explicit rollback to older source can still be the latest valid policy. Complete snapshot and draft content identities are not silently substituted.

Planning temporarily protects the project from an auto-promotion commit. Errors or a dropped caller future release that planning interest. Applied pinned desired state is retained separately, even if warm startup fails, so auto-promotion cannot silently take it over. A later explicit reconcile can change or remove it.

Build or dedicated-warmup failure retains the existing warning policy. It does not automatically roll back published routes or make publication a cross-asset transaction. An applied policy is not proof that every worker is ready.

## Resize and replacement trade-offs

- A ready group with the same content and count is reused only while its members still accept requests. Dedicated failures retain their existing fail-fast behavior; a later explicit reconcile must remove known-dead members and refill the count rather than reuse a failed group forever based only on fingerprint and size. Healthy same-content members are retained where possible.
- Same-content growth keeps the existing ready group serving and prepares only the additional slots, merging them atomically once the whole increment is ready.
- Shrink keeps the required subset and normally retires the remaining slots. Each retirement batch starts cleaning up its own slots immediately instead of waiting for an earlier batch's long requests. The cumulative retirement fence opens only after all batches actually finish.
- Different-content replacement retires the old group before creating another full dedicated group without a surge budget. The new group waits outside the lock for old-group and superseded-start cleanup. Immediate repin after remove/demote cannot bypass this fence.
- Existing usable shared workers continue serving while auto-promotion prepares or fails.

**Old long-running requests or streams can extend replacement waits for the same script.** Normal retirement does not secretly impose a two-second hard-cancel budget on in-flight execution, and this is not a zero-downtime replacement promise. Warm requests for other scripts should not wait for the global state lock because of that retirement. Extra surge capacity or a forced replacement deadline requires a separate resource and termination contract.

## Routing and automatic adjustment

Routing keeps queued first, followed by a ready dedicated group matching the content, then the existing stream, long-run, or shared selection rules. Without a usable matching worker, routing may wait outside the state lock for a matching pinned start. If that ticket is cancelled, routing stops waiting for it and reselects the original lane instead of waiting for cleanup to finish. Cleanup completion remains a separate budget fence for replacement groups.

Nonblocking execution-timeout/cancellation results do not wait for TERM cleanup to finish, so a shorter outer budget does not misclassify an execution failure as a queue-wait timeout. Output streams retain 64 buffered data positions and reserve one additional terminal-frame position. A full data queue cannot make terminal notification block cleanup or disappear as ordinary EOF; data itself retains its existing backpressure. This does not guarantee error-frame delivery after a host crash or a forcibly interrupted connection.

Failure fallback cannot jump straight to shared and bypass stream/long-run permits. Shared execution gains no hard-cancel capability. The automatic-adjustment tick only registers tracked startup candidates; it does not await one candidate's layout, READY, or old-group retirement, so a slow candidate cannot prevent promotion/demotion decisions for other scripts.

## Shutdown

Closing is sticky state and cancellation, not a one-time notification that can be missed. Shutdown first stops new admission and cancels shared/dedicated starts and planning, then settles the policy tick, startup tasks, and retired drivers. Late slot publication is refused after closing.

The normal request-drain grace remains five seconds, followed by up to four seconds for forced cleanup if needed; the tick has a separate bounded stop wait. These are pool-cleanup windows, not a wall-clock bound for the whole server process to exit. Listeners, WebSockets, and other background tasks have their own shutdown stages. Driver join ownership is retained until completion. Exceeding a bound explicitly aborts and warns rather than treating a discarded join handle as proof of termination. Dropping the shutdown future also triggers forced drain, so its only grace timer cannot simply disappear.

Non-abortable blocking directory work that exceeds the deadline remains tracked with its real permit and produces a warning. It cannot publish when it finishes. A termination signal, reaping the direct child, and termination of arbitrary descendants are distinct events; this stage does not promise that an entire user-created process tree is gone. Cancellation does not roll back external side effects.

## Verification boundary

Local workers, layout/READY barriers, explicit notifications, and PID/directory observations cover whole-group commits, partial failure, epoch interleavings, cancellation, resize, retirement fences, routing fallback, and shutdown. Runtime scope tests exercise slow read/build windows; the API adapter actually acquires scope before the first asynchronous read. This is not equivalent to a production rollout exercise or exhaustive DB/API fault injection.

Existing real-language and publication-endpoint regressions must still pass the full workspace suite. Performance requires a separate controlled-load comparison; neither throughput multipliers nor production p99 follow from describing an implementation as outside the lock.
