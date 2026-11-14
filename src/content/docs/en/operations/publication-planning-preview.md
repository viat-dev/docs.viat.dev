---
title: "Planning effects and cancelled startup payloads (preview)"
description: "Fence asynchronous pool-planning mutations and release obsolete script payloads without bypassing worker retirement."
doc_id: operations.publication-planning-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased follow-up extends [dedicated startup coordination](dedicated-startup-preview.md) and [startup recovery](worker-startup-recovery-preview.md). It changes internal pool-planning authority and ownership, not published route transactionality or the number of workers allowed to start.

## Check authority where state is changed

Pool reconciliation already acquires a project scope before its first asynchronous script read. That scope now travels through the reconciliation stage's breaker reset, missing-environment probes, and environment-build completions, instead of protecting only the final desired-worker-set application.

Each scoped mutation acquires the pool state lock, then validates the owning supervisor, project, current generation, cancellation and closing state while holding the policy lock. Both locks remain held through the actual mutation and synchronous event enqueue. A newer plan cannot slip between a preflight check and the state update. The new reset/build/probe commit sections contain no filesystem or process waits; their source/dependency hashing and event-metadata preparation happen before taking the locks.

Once superseded, this planning scope cannot:

- Cancel a newer shared-start ticket through an old breaker reset or build success.
- Add validation, clear newer breaker/failure state, or replace current environment reporting with its late result.
- Publish a stale Ready/Failed/removal event to the environment mirror.

Physical builds can still finish and return their real per-call advisory result. Dependency-cache writes or other external effects are not rolled back; a suppressed pool-state commit is not a claim that physical work never ran.

## Environment reporting during scoped planning

An environment key is shared by language and canonical requirements, not owned by one project or script. A plain `Building` record has no operation owner. Rather than introduce a new global environment-version protocol, the reconciliation-scoped build path does **not** install or emit a global `Building` marker. Its previous environment state remains visible during physical work; a dropped scoped build cannot leave a new ghost `Building` entry.

This applies to pool coordination after publication and its startup missing-environment warming path. It is not a change to every operation inside a publish request: other precommit validation callers, editor tests, explicit builds and trigger warming retain their existing unscoped APIs and behavior. Cached/gated builds are not converted into publication scopes, and publication builds do not newly join their single-flight mechanism.

An authorized successful scoped build retains the existing Ready-overwrite recovery behavior, including replacing an unowned `Building` record that may have been left by an earlier unscoped build. Scoped negative results and probes do not erase an existing `Building` marker. Therefore this is a project-planning fence, **not a total ordering guarantee for every environment operation across scripts/projects**, nor a fix for every pre-existing unscoped reporting race. Environment mirrors remain best-effort and can lag.

During this scoped phase, a previous Ready/Failed/missing state is not proof that no build is in progress. The operation's returned per-script build results remain the advisory results of the physical work. Ordinary build entry points keep their existing activity reporting.

## Separate startup outcome from retirement completion

An obsolete dedicated-start ticket can be waiting behind a long-running retired worker without having started any physical preparation of its own. Cancellation now releases that ticket's full Script payload and its supervisor reference promptly. Reconcile and automatic-promotion waiters keep a lightweight outcome receiver rather than the full startup record.

The cleanup task does not disappear: it keeps actual retired workers and lightweight completion tokens until predecessors and its own retired batch have settled. A per-script budget fence survives removal of the cancelled ticket, including cancellation of the latest caller before any successor is registered. The next replacement cannot bypass that fence merely because the source payload was freed.

Cancellation can therefore be reported before predecessor retirement completes. This does not abort healthy old requests, release the physical-start permit early, or provide a surge budget. Work already in non-abortable layout preparation retains the ownership it needs until that work ends. Existing shared/stream/long-run fallback rules remain unchanged.

The fix removes the unbounded sequence of obsolete **source copies** from this wait chain; it does not claim constant total memory. Lightweight fence metadata may still remain until retirement, and callers or other subsystems may legitimately own their own source copies.

## Verification boundary

Planning regressions drive the same production mutation/completion functions used by the API adapter. They cover stale reset/success/failure/probe effects and events, supersession while waiting for the state lock, supervisor/project mismatches, closing, full dependency keys, no scoped `Building` marker, and authorized recovery of an unowned marker. They do not pretend that pool-launch test hooks execute a real dependency installer or reproduce every API/database interleaving.

Controlled worker fixtures hold a retired sender, repeatedly supersede and cancel replacements, and observe weak-reference release plus supervisor reference counts before retirement is allowed to finish. A later replacement still waits, the old worker remains usable, and only the latest source starts after release. Existing publication, build, lifecycle and shutdown regressions must continue to pass.

These changes do not make publishing a cross-asset transaction, order rollback authority by script version, roll back external side effects, or promise zero-downtime replacement under a long old stream.
