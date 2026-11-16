---
title: Retention, history and safe deletion
description: Set distinct lifetimes for summaries, payloads, chat, audit and idempotency while preserving recovery and compliance evidence.
doc_id: operations.retention
verified_release: '1.1.0'
channel: stable
---

# Retention, history and safe deletion

Retention is a host-operator configuration that **irreversibly deletes
data**. Project roles cannot raise deployment retention. Before shortening
any horizon: obtain data-owner/compliance approval → export required
evidence → validate a recoverable backup. All examples are unexecuted; this
page authorizes no purge.

## Default lifetimes

| Data | Default | Actual cleanup boundary |
| --- | --- | --- |
| Execution summaries | 90 days | Batch-deleted by creation time; workflow child rows **cascade** with the parent |
| PostgreSQL stdout/stderr/structured lines | 14 days | Whole old **monthly partitions** dropped — not a precise per-row 14-day TTL |
| Execution/workflow I/O | 14 days | Payloads cleared independently; summaries remain |
| Finished async tasks/results | 7 days | Finished rows; future queued tasks are not cleaned by this |
| Chat message ledger | 90 days | Message-history rows |
| Chat peer context | 180 days of **inactivity** | By last activity, not account creation |
| Control-plane audit | 365 days | Platform audit_logs, not external business audit |
| File-access audit | 90 days | Platform access rows |
| Idempotency keys/stored responses | 24 hours | Dedup and retry-response window |
| Superseded script versions | 50 per script (range 1..1000) | Pruned **by count per script** at edit time, not days |
| Publish revisions | 20 | Pruned at publish; the exact variable is `VIAT_PUBLISH_REVIAT_KEEP` |

Types, zero values and scopes: [full retention variables](../configuration/observability.md).
There is no universal "0 = keep forever": **0 days can delete nearly all old
data on the next pass**; an interval of 0 parses but cannot drive a timer.
Legal holds belong in approved external evidence processes — never guess an
"infinite" value.

## Periodicity and granularity

- Cleanup runs every 24 hours by default. Startup maintains PostgreSQL
  line-log partitions for the current and next five months; the
  **destructive pass waits a full period** rather than purging at every
  boot. Stage failures log and continue; multi-instance coordination relies
  on idempotent processing — not immutable exactly-once.
- A month partition straddling the cutoff must stay, so line logs can
  outlive the configured days. Payloads can vanish before summaries — a null
  payload does not mean the original request was empty. Deleting an
  execution summary removes its workflow steps too. Space reuse after
  PostgreSQL DELETE is up to vacuum/storage management — **no** guarantee of
  immediate space return to the OS.
- Disabling `VIAT_RETENTION_ENABLED` also stops the loop's partition
  maintenance and the expiry cleanup for OAuth/session/ticket/MFA/login
  failures — without replacement maintenance it is not "safe infinite
  retention". Upload spooling and other dedicated cleanups are separate.
  **Never** "solve" a full disk by manually dropping active partitions or
  truncating log parent tables.

## Planning and applying

1. Inventory: PostgreSQL, ClickHouse/Loki, business databases, object
   stores, container logs, backups and exports — **deleting platform rows
   deletes no external copies**.
2. Define approved minimum/maximum retention per class, weighing personal
   information in chat/payloads, audit evidence and client idempotency retry
   windows.
3. **Before lowering**: export evidence and record a backup restore point; a
   post-purge snapshot cannot resurrect deleted data.
4. Change the deployment variables (Compose requires explicit passing) and
   restart on the maintenance plan. **Smaller values apply to
   already-overdue history at the next pass** — not just to new data.
5. Monitor cleanup logs and database disk/row/partition trends;
   troubleshoot permissions, locks, DDL and storage errors — a healthy
   process does not mean successful cleanup.
6. Spot-check old/new records and external stores; keep approval records;
   handle temporary export files per evidence policy.

The following is an **unexecuted policy example**, not general advice:

```dotenv
VIAT_RETENTION_EXECUTION_DAYS=90
VIAT_RETENTION_PAYLOAD_DAYS=7
VIAT_RETENTION_LINE_DAYS=14
VIAT_RETENTION_AUDIT_DAYS=365
VIAT_RETENTION_IDEMPOTENCY_HOURS=24
VIAT_RETENTION_INTERVAL_HOURS=24
```

Two knock-on effects: shortening the idempotency window deletes old
keys/responses, so **late retries can re-execute**; shortening the async
result horizon can leave clients unable to fetch results. Keep client
behavior consistent with the windows, and write long-lived outputs to
durable business storage.

## External systems and mistaken deletions

- ClickHouse/Loki TTLs, business-database audit, S3 lifecycle/versioning,
  file bytes, container logs and backups are all **operator-defined**
  policies. External secrets can outlive resource edits — coordinate with
  the database reference lifecycle. Rust shared-artifact GC is off by
  default: without the complete live-set, no "safe cleanup" across mixed
  architectures/toolchains exists.
- Raising a horizon after mistakenly shortening it **recovers nothing**.
  Under incident-approval controls: stop further destructive cleanup →
  preserve the scene → restore to an **isolated environment** per
  [backup-restore](backup-restore.md) → reconcile only the needed data
  after review. Replacing production with an old database loses new writes
  and can resurrect revoked credentials or queued tasks with side effects.
