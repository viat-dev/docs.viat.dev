---
title: "Worker admission and stream backpressure (preview)"
description: "Fence abandoned queued work and keep stream deadlines and cancellation observable under data backpressure."
doc_id: operations.worker-admission-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased correction extends the [worker lifecycle](worker-lifecycle-preview.md) and [dedicated startup/shutdown](dedicated-startup-preview.md) work. Existing language and cancellation boundaries remain in the [runtime reference](../assets/scripts/runtime.md). It is not a claim that stable releases already include these fixes.

## Abandonment and admission have one winner

A pool request now has an atomic pending/admitted/abandoned state shared by its caller wait and worker driver. A wait that expires or is dropped before admission fences that request, so the driver cannot later start it merely because it finally reaches the front of the FIFO. The driver also skips requests whose result receiver is already closed. An abandoned ticket can remain in the bounded FIFO until the driver reaches it; this does not add arbitrary queue removal or extra capacity.

The existing caller wait envelope remains `VIAT_POOL_QUEUE_WAIT_MS + request execution timeout + 500ms`. This change does not replace it with a new standalone queue-only timer or alter the configured values, worker counts, or lane selection.

When that wait envelope expires:

- If admission has not won, the wait returns the existing queue-wait overload error (HTTP 503), and that ticket cannot subsequently be admitted.
- If admission has already won, the wait returns the existing runtime-timeout error (ordinary HTTP runtime errors currently map to 500), not a queue overload. Its diagnostic budget is the whole elapsed caller-wait envelope, not a new measurement of execution-only time. This is distinct from a timeout terminal frame inside an already-open stream: that frame carries status 504 without changing the HTTP status already sent.
- A result or error actually delivered by the driver is preserved rather than reclassified as an outer-wait expiry.

This distinction applies to this pool-wait path, not to every possible 503 a script or upstream can return. It does not make retries safe after an execution timeout. Already-admitted work can still have effects, and shared execution gains no new hard-cancel capability. Use idempotency and compensation; cancellation does not roll back writes or external requests.

## Data backpressure no longer suspends control decisions

Previously, waiting for a stream-data send inside the control-reader branch prevented the driver's surrounding select loop from checking deadlines and cancellation. A stalled consumer could therefore hold the worker past its execution timeout even though a separate terminal-frame slot existed.

The driver now retains at most one decoded data frame while waiting for delivery capacity, instead of awaiting that send inside the read branch. The stream still has 64 buffered data positions and one reserved terminal position. Further control-data reads pause while a data frame is pending; memory does not grow into an unbounded side queue.

While waiting for capacity, the driver continues checking execution deadlines, hard cancellation, forced slot stop, and cooperative stream-cancel forwarding. A healthy slow consumer can resume and receive every data frame in order followed by the normal terminal frame, without retiring the worker simply for being slow.

On a timeout, hard cancel, or forced stop, the already-buffered data precedes an error terminal frame; an undelivered pending frame need not survive a failed run. Forced stop no longer deliberately drops the terminal permit as ordinary EOF. Delivery still depends on a live receiver and host: this is not a guarantee after a host crash, a forcibly aborted task, or a broken connection.

Cooperative stream cancellation remains cooperative: the platform forwards the cancel envelope without converting it into a hard kill. Its worker-generated terminal frame can remain behind buffered data until the consumer resumes. Likewise, EOF behind pending data need not be discovered eagerly; the execution deadline still bounds the stall. Reading past arbitrary data to discover EOF would require discarding data or unbounded buffering, neither of which this change adds.

## Verification and limits

Controlled local worker fixtures cover an explicitly held first request, an expired or dropped queued caller, and later healthy requests. Execution-ID journals distinguish "caller stopped waiting" from "worker never executed the abandoned request". Atomic-state tests cover admission/abandonment races, dropping the wait future, and timeout classification before versus after admission.

Stream fixtures emit 66 data frames, exceeding the 64 data positions, and keep the consumer stalled while deadline, cancellation or stop is triggered. They also cover worker EOF behind pending data, cooperative-cancel receipt, preserved terminal errors, and healthy ordered resume with worker reuse. No provider service, production workload, or customer data is involved.

The scope is the worker queue's admission boundary and stream-data backpressure. It does not redesign resource-RPC waits, startup stderr handling, publication generations, process-tree termination, or the durable task queue. Existing cleanup windows remain unchanged; this is not a whole-service shutdown deadline.
