---
title: "Startup stderr and pinned-pool recovery (preview)"
description: "Drain startup stderr without blocking READY, and recover script admission after an authoritative healthy pinned-group commit."
doc_id: operations.worker-startup-recovery-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

These unreleased corrections build on [startup ownership](worker-lifecycle-preview.md) and [dedicated-group coordination](dedicated-startup-preview.md). They do not increase startup concurrency, change lane selection, or make a new stable-release guarantee.

## Read stderr before READY

A valid worker can write enough dependency-install or import output to fill its stderr pipe before announcing READY. Leaving that pipe unread until after READY creates a circular wait and misreports healthy startup as a timeout.

The startup owner now starts both stdout and stderr readers immediately. The stderr reader retains only the most recent 4096 raw bytes while waiting for READY, including output without line delimiters. Failure diagnostics use a bounded, UTF-8-safe rendering of that tail; malformed bytes or a partial multibyte character do not panic the diagnostic path. The surrounding error message has its own prefix, so 4096 is not a limit on the entire serialized response.

READY includes a reader-handoff acknowledgement before the slot can accept its first request. The same owned stderr task then forwards runtime log lines to the active request sink. Runtime lines remain whole rather than being split at the startup buffer boundary, preserving per-line masking behavior. Lossy decoding prevents a partial startup UTF-8 sequence from silently terminating later runtime logging. After a runtime line is handed to its sink, buffer allocations larger than 8KiB are released rather than retained by the warm reader. This limits retained capacity, not individual runtime line length; it does not introduce a new truncation policy or promise an immediate operating-system RSS decrease.

Closing stderr before READY is still legal: a worker with working control/stdin channels need not keep stderr open. Dropped startup futures, explicit cancellation, startup failure and driver cleanup retain ownership of both reader tasks; an inherited pipe writer cannot keep an abandoned reader alive indefinitely.

The READY budget remains unchanged. On failure, stderr gets up to the existing 500ms best-effort drain window after termination is requested, followed by the existing direct-child reap handling. Cancellation need not wait for the diagnostic drain window. These are cleanup budgets, not a complete process-tree or whole-HTTP-request deadline.

## Recover admission at a successful pinned-group commit

A replacement pinned group may wait for an old group to retire. During that wait, legitimate requests for another content fingerprint of the same script can fail shared startup and trip the existing script-level circuit breaker. Clearing the breaker only when replacement was registered misses those later failures: the new group can become READY yet normal admission still rejects it as broken.

The authoritative whole-group commit now clears the script's prior startup-failure streak and broken marker in the same state-lock section that fences older shared starts and installs the ready group. The broken-script metric is decremented only if a marker was actually removed.

This additional reset happens only after the existing current-ticket, project-generation, ownership, cancellation and known-worker-health checks succeed. Failed, cancelled or superseded completion and cleanup do not get to erase newer failure state. Existing explicit build/publication reset paths are otherwise unchanged.

This does **not** change the breaker into a per-fingerprint breaker or order authority by script version. Published and draft fingerprints can still coexist; legitimate new failures after commit can trip the script-level breaker again. A READY commit is evidence of known health at that point, not a guarantee of future worker survival or zero-downtime replacement.

## Verification boundary

Controlled local workers cover stderr output larger than pipe capacity, missing newlines, invalid bytes, failure-tail preservation, runtime logging after handoff, a worker that closes stderr early, and cancellation/cleanup. A separate reader test retains a writer after failure to verify bounded cleanup; whole runtime lines are checked across read-buffer boundaries.

Pinned-group regressions use retirement and startup barriers: three actual failures for another fingerprint occur while replacement waits, then successful commit restores admission. Failed replacement and superseded completion must preserve the newer broken state; the later authoritative success may clear it. All fingerprints deliberately share a script version, so version ordering cannot accidentally make the tests pass.

No production resources or supplier services are involved. These fixes do not resolve the separate questions of superseded API planning side effects, Widget repair intent, authorizer-secret replacement, cancelled-ticket memory retention, or bundle-export comparison cost.
