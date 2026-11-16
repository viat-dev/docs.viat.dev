---
title: Logging, metrics, tracing and retention configuration
description: Diagnostics, line-log backends, metrics, OTLP, audit, version history and retention settings.
doc_id: configuration.observability
verified_release: '1.1.0'
channel: stable
---

# Logging, metrics, tracing and retention configuration

See [overview](overview.md) for scope/default/reload conventions. Everything
is optional except stated backend requirements. Logs can contain sensitive
business data — protect access to and backups of your observability systems
too.

| Variable | Type; binary default | Unit, validation, scope and override |
| --- | --- | --- |
| `RUST_LOG` | filter; `info` | S. tracing EnvFilter expression; invalid/unset falls back to info (image sets info). Governs server **diagnostics**, not script line-log retention. |
| `VIAT_LOG_SPANS` | switch; off | S. **Any** value other than the literals `0`/`false` (empty included) enables busy/idle span-duration logging at span close. |
| `VIAT_OTLP_ENDPOINT` | URL; unset | S. Non-empty enables OTLP **gRPC span** export (service name viat). Initialization failures only log and continue; export is not guaranteed. Not OTLP/HTTP, and it does not export metrics. |
| `VIAT_METRICS_TOKEN` | string; unset | S. Mounted at `/metrics` only when non-blank after trimming; requires an exact bearer token. Unset/blank answers 404 — **not an open endpoint**. |
| `VIAT_LINE_LOG_BACKEND` | enum; `postgres` | S. Strictly `postgres`/`clickhouse`/`loki`; empty → postgres, unknown blocks startup. Selects the **write** path only; history APIs keep reading PostgreSQL. |
| `VIAT_CH_URL` | URL; unset | S. **Required** with clickhouse; HTTP base address. Startup checks presence only and creates no remote service/table. |
| `VIAT_CH_DB` | string; `default` | S. ClickHouse database identifier; use a trusted simple name. No project override. |
| `VIAT_CH_TABLE` | string; `line_logs` | S. Pre-created table identifier; schema compatibility is operator-owned. |
| `VIAT_CH_USER` | string; unset | S. Optional Basic auth only when user/password are **both** present; one without the other means none. |
| `VIAT_CH_PASSWORD` | string; unset | S. Paired password; carry it over trusted HTTPS/private networks. |
| `VIAT_LOKI_URL` | URL; unset | S. **Required** with loki; base address. The implementation appends `/loki/api/v1/push` — do not include that suffix. |
| `VIAT_LOKI_USER` | string; unset | S. Basic auth only when user/password are both present. |
| `VIAT_LOKI_PASSWORD` | string; unset | S. Paired Basic auth secret. |
| `VIAT_LOKI_TENANT` | string; unset | S. Optional `X-Scope-OrgID` header; **not** a Viat project identifier and no automatic tenant ACL. |
| `VIAT_ALERT_INTERVAL_SECS` | u64; `60` s | S. Alert evaluation period; parsing accepts 0 but the timer does not — use at least 1. Rules cannot override the period. |
| `VIAT_SCRIPT_HISTORY_KEEP` | i64; `50` versions | D. Superseded versions kept per script, clamped 1..1000. **Not days**, and not publish snapshot history. |
| `VIAT_PUBLISH_REVIAT_KEEP` | i64; `20` revisions | S. Yes, the legacy spelling includes REVIAT. Positivity is not enforced — use a positive number; pruning happens at publish. There is no `PUBLISH_REVISION_KEEP` alias. |
| `VIAT_AUDIT_DEFAULT_UNATTRIBUTED` | enum; `reject` | D. Trimmed case-insensitive `record` enables recording; everything else rejects. Resource audit blocks may override. Applies to **business-table audit**, not control-plane audit_logs. |
| `VIAT_AUDIT_QUERY_MAX_ROWS` | i64; `1000` rows | D. Positive; per-page/export batch cap for business-audit queries, only lowerable per request. **Not** the platform audit page cap (500). |
| `VIAT_RETENTION_ENABLED` | boolean; `true` | S. The literal `0` or case-insensitive `false` disables the cleanup loop — **including** partition maintenance and expired-credential cleanup. Empty/other values enable it. |
| `VIAT_RETENTION_INTERVAL_HOURS` | u32; `24` h | S. Cleanup period; the **first destructive pass waits a full period** after startup. Parsing accepts 0 but the timer does not; at least 1. |
| `VIAT_RETENTION_EXECUTION_DAYS` | u32; `90` days | S. Execution-summary retention; 0 = expire immediately; no project override. |
| `VIAT_RETENTION_LINE_DAYS` | u32; `14` days | S. PostgreSQL line logs expire by **monthly partition**, not precise per-row days; it does not configure ClickHouse/Loki TTLs. Accepts 0. |
| `VIAT_RETENTION_ASYNC_DAYS` | u32; `7` days | S. Rows/results of finished async tasks; accepts 0 — results are not kept forever. |
| `VIAT_RETENTION_PAYLOAD_DAYS` | u32; `14` days | S. Purges execution inputs/outputs and workflow step I/O; summaries may live longer. Accepts 0. |
| `VIAT_RETENTION_IM_MESSAGE_DAYS` | u32; `90` days | S. Chat message ledger days; accepts 0. Personal/conversational data, not mere diagnostics. |
| `VIAT_RETENTION_IM_PEER_DAYS` | u32; `180` days | S. Forgets context tokens by **peer inactivity**, not creation age; accepts 0. |
| `VIAT_RETENTION_AUDIT_DAYS` | u32; `365` days | S. Control-plane audit_logs retention — not business-table audits; accepts 0 (deletes evidence). |
| `VIAT_RETENTION_IDEMPOTENCY_HOURS` | u32; `24` h | S. Idempotency key/stored-response retention; accepts 0. Check client retry windows before shortening. |
| `VIAT_RETENTION_FILE_ACCESS_DAYS` | u32; `90` days | S. File-access audit retention; accepts 0 and should match evidence policy. |

## Three different kinds of "log"

1. **Server diagnostics** go to process output under `RUST_LOG`/
   `VIAT_LOG_SPANS`; container log rotation belongs to Docker/your shipping
   system, not Viat's retention loop.
2. **Execution artifacts**: summaries, workflow steps and async state live in
   the platform PostgreSQL; stdout/stderr/structured line logs may go to
   PostgreSQL, ClickHouse or Loki.
3. **Audit**: control-plane audit records who changed configuration;
   business-table audit records row changes; file-access audit records
   reads — none are synonyms for execution logs.

Reading and locating logs: [runs](../operations/runs.md),
[logs](../operations/logs.md), [audit](../operations/audit.md).

## Protect metrics before collecting them

```dotenv
VIAT_METRICS_TOKEN=REPLACE_WITH_RANDOM_SCRAPE_TOKEN
RUST_LOG=info
VIAT_LOG_SPANS=1
VIAT_OTLP_ENDPOINT=http://otel-collector:4317
```

Unexecuted example. Essentials:

- Expose metrics only to trusted monitoring networks; scrapers call
  `/metrics` with `Authorization: Bearer TOKEN`. No token configured answers
  404; a wrong token answers 401. `/healthz` and `/readyz` need no token —
  and report nothing about most business capabilities. A scrape token
  grants **no** project-management rights.
- OTLP is gRPC spans: not a log backend, not a `/metrics` replacement, and
  no guarantee the collector persisted anything; initialization errors never
  block startup. Configure collector networking/auth boundaries as needed;
  **never invent** Viat-specific OTLP user/password variables. The
  dependency's standard `OTEL_*` behavior is library configuration — verify
  with your actual exporter.

## Before switching line-log backends

- Default PostgreSQL supports **console/CLI/API history reads and
  full-text snippet search**. Switching to ClickHouse/Loki changes only the
  **write** path: old data does not migrate, remote tables/TTLs are not
  created, history reads keep hitting PostgreSQL (query new lines with the
  backend's native tools), and the search API answers **409** in
  non-PostgreSQL modes.
- Non-PostgreSQL writes are **best-effort**: unreachable backends warn and
  continue — this is not a reliable delivery queue, and "configuration
  present" says nothing about credentials, schema or storage availability.
- Validate first in an isolated project: emit one fixture log without
  sensitive data → retrieve it in the target backend → then switch
  production. Table examples and Loki labels:
  [logs operations](../operations/logs.md).

## Retention, history and their safety implications

- The cleanup loop creates PostgreSQL line-log partitions for the current
  and next five months at startup; the **first destructive pass waits one
  full period**. Line logs are reclaimed by dropping whole old monthly
  partitions — not exactly 14 days, and the month straddling the cutoff is
  kept.
- Executions and audits clean in batches. **Lowering a period grants no
  grace**: the next pass deletes already-overdue data; raising it restores
  nothing deleted.
- Disabling retention (`VIAT_RETENTION_ENABLED=false`) also disables
  partition maintenance and expired-credential cleanup — it is not a free
  long-term-storage strategy.
- Script history prunes by count and publish history by revision count;
  **neither is regulatory archiving**. Full policy, external TTLs and
  compliance exports: [retention operations](../operations/retention.md).
