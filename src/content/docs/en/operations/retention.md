---
title: Retention, history and safe deletion
description: Set distinct lifetimes for summaries, payloads, chat, audit and idempotency while preserving recovery and compliance evidence.
doc_id: operations.retention
verified_release: '1.1.0'
channel: stable
---

# Retention, history and safe deletion

Retention is a host-operator configuration change with **irreversible data deletion**. Project roles cannot raise deployment retention. Before shortening any horizon, obtain data-owner/compliance approval, export required evidence and validate a recoverable backup. All examples are unexecuted; this page does not authorize running a purge.

## Default lifecycle inventory

| Data | Default | Actual cleanup boundary |
| --- | --- | --- |
| Execution summary | 90 days | Batched deletion by creation time; workflow children cascade with parent |
| stdout/stderr/structured lines in PostgreSQL | 14 days | Whole old **monthly** partitions, not exact per-row 14-day TTL |
| Execution/workflow I/O | 14 days | Clears payload fields independently, keeping summary rows |
| Finished async run/result | 7 days | Finished rows; waiting future queued work is not simply aged out as finished output |
| Chat message ledger | 90 days | Message history rows |
| Chat peer context | 180 days inactive | Last activity, not account creation time |
| Control-plane audit | 365 days | Platform `audit_logs`, not external business audit |
| File-read audit | 90 days | Platform access records |
| Idempotency key/stored response | 24 hours | Retry deduplication evidence/response horizon |
| Script previous versions | 50 superseded versions, clamp 1..1000 | Count per script on edits, not days |
| Published revisions | 20 | Pruned on publish, exact knob `VIAT_PUBLISH_REVIAT_KEEP` |

See [all retention variables](../configuration/observability.md) for types, zero handling and scope. There is no general “0 means forever”: zero day counts are accepted and can delete almost everything old at the next pass. Zero interval is invalid for the timer even though numeric parsing accepts it. To preserve a hold, define an approved external evidence process; do not guess at a magic infinite value.

## Scheduler and granularity

The loop defaults to every 24 hours. At boot it maintains PostgreSQL line-log partition coverage for the current and next five months. Destructive cleanup waits one full interval; it does not immediately purge everything on boot. Each pass logs errors and continues. Multiple instances coordinate the cluster job, but failure handling is idempotent rather than an immutable exactly-once guarantee.

A monthly partition intersecting the line cutoff must remain, so observed line retention can exceed the configured number of days. Conversely, payloads can disappear before the corresponding execution summary. A null captured payload is not proof the original request was empty. Full execution deletion also removes dependent workflow steps. Storage reuse/file shrinking after PostgreSQL DELETE is controlled by database vacuum/storage management, not immediate operating-system space reclamation.

Disabling `VIAT_RETENTION_ENABLED` also disables the loop's partition maintenance and expired OAuth/session/ticket/MFA/login-failure cleanup; it is not a safe unbounded-retention strategy without replacement maintenance. Upload-spool and other dedicated sweeps are separate. Do not manually drop active partitions or truncate parent log tables to “fix” a full disk.

## Plan and apply a change

1. Inventory what is kept in PostgreSQL, ClickHouse/Loki, business databases, object stores, container logs, backups and exports. Deleting the platform row does not erase external copies.
2. Define approved minimum/maximum retention per class. Consider personal data in chat context and execution payloads, compliance evidence in audit, and clients' retry policy for idempotency.
3. Export required audit evidence and record a backup/recovery point **before** lowering horizons. A database snapshot taken afterward cannot restore what was already purged.
4. Change the relevant deployment variables, forwarding them into Compose explicitly, then restart under a maintenance plan. A smaller value applies to already-existing old rows at the next pass; it is not just a new-row policy.
5. Watch server retention messages and database disk/row/partition trends. Investigate permission, lock, DDL and storage errors; do not claim cleanup succeeded because the process stayed healthy.
6. Verify representative old/new records and external stores. Retain the approved change record and remove temporary export files only under your evidence policy.

Example **unexecuted policy**, not a universal recommendation:

```dotenv
VIAT_RETENTION_EXECUTION_DAYS=90
VIAT_RETENTION_PAYLOAD_DAYS=7
VIAT_RETENTION_LINE_DAYS=14
VIAT_RETENTION_AUDIT_DAYS=365
VIAT_RETENTION_IDEMPOTENCY_HOURS=24
VIAT_RETENTION_INTERVAL_HOURS=24
```

Shortening idempotency retention can allow an old retry to execute again once its stored key/response is gone. Shortening async-result retention can make callers lose completed output. Keep client behavior aligned with the chosen horizon, and provide durable business storage for outputs that must live longer.

## External systems and deletion recovery

ClickHouse/Loki TTLs, PostgreSQL-resource business audit, S3 lifecycle/versioning, local file bytes, container logs and backups are **operator-owned policies**, not controlled by the above loop. External secret backends can retain historical values after resource changes; coordinate their lifecycle with retained database references. Rust shared-artifact garbage collection is off by default and unsafe across mixed toolchains/architectures without a complete live set.

A mistakenly shortened horizon cannot be undone by increasing it. Stop further destructive sweeps under approved incident control, preserve the affected state, and restore into an **isolated** environment first using [backup/restore](backup-restore.md). Reconcile only required data back under a reviewed plan; blindly replacing production with an old database loses newer writes and may resurrect revoked credentials or queued side effects.
