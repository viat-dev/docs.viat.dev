---
title: Logging, metrics, tracing and retention configuration
description: Diagnostics, line-log backends, metrics, OTLP, audit, version history and retention settings.
doc_id: configuration.observability
verified_release: '1.1.0'
channel: stable
---

# Logging, metrics, tracing and retention configuration

Use [overview](overview.md) for scope/default/reload conventions. Settings are optional except stated backend requirements. Logs can contain sensitive business data; protect and back up observability systems too.

| Variable | Type; binary default | Units, validation, scope and override |
| --- | --- | --- |
| `RUST_LOG` | filter; `info` | S. tracing EnvFilter directives; invalid/unset → info. Image sets info. Server diagnostic logs, not script line-log retention. |
| `VIAT_LOG_SPANS` | switch; off / 关闭 | S. Any present value other than literal 0/false enables close-span busy/idle lines; empty also enables. |
| `VIAT_OTLP_ENDPOINT` | URL; unset / 未设置 | S. Nonempty enables OTLP gRPC span exporter with service name viat. Init failure logs and continues without exporter. Not OTLP/HTTP or automatic metrics export. |
| `VIAT_METRICS_TOKEN` | string; unset / 未设置 | S. Trimmed nonblank mounts /metrics and requires exact bearer token. Unset/blank → route absent (404); not an open endpoint. |
| `VIAT_LINE_LOG_BACKEND` | enum; `postgres` | S. Exactly postgres/clickhouse/loki; empty → postgres, unknown aborts boot. Selects writes only; historical API reads remain PostgreSQL. |
| `VIAT_CH_URL` | URL; unset / 未设置 | S. Required when clickhouse selected; HTTP base URL. Existence checked, remote service/table not provisioned at boot. |
| `VIAT_CH_DB` | string; `default` | S. ClickHouse database identifier; use simple trusted identifiers. No per-project override. |
| `VIAT_CH_TABLE` | string; `line_logs` | S. Precreated ClickHouse table identifier; operator supplies compatible schema. |
| `VIAT_CH_USER` | string; unset / 未设置 | S. Optional Basic auth only when both user and password are present; partial pair means no Basic auth. |
| `VIAT_CH_PASSWORD` | string; unset / 未设置 | S. Paired ClickHouse password; transport must be protected externally with trusted HTTPS/private network. |
| `VIAT_LOKI_URL` | URL; unset / 未设置 | S. Required for loki; base URL, implementation appends /loki/api/v1/push. Do not supply that suffix twice. |
| `VIAT_LOKI_USER` | string; unset / 未设置 | S. Optional Basic auth only when both user/password present. |
| `VIAT_LOKI_PASSWORD` | string; unset / 未设置 | S. Paired Loki Basic auth secret. |
| `VIAT_LOKI_TENANT` | string; unset / 未设置 | S. Optional X-Scope-OrgID header, not a Viat project slug or automatic tenant ACL. |
| `VIAT_ALERT_INTERVAL_SECS` | u64; `60` s | S. Evaluator cadence; parser accepts 0 but timer cannot use zero. Set >=1. No per-rule interval override. |
| `VIAT_SCRIPT_HISTORY_KEEP` | i64; `50` versions | D. Superseded versions per script; clamped 1..1000. Not days, not published snapshot history. |
| `VIAT_PUBLISH_REVIAT_KEEP` | i64; `20` revisions | S. Exact legacy spelling includes REVIAT. No positivity clamp at parse; use positive count. Pruned on publish. No supported PUBLISH_REVISION_KEEP alias. |
| `VIAT_AUDIT_DEFAULT_UNATTRIBUTED` | enum; `reject` | D. Trim/case-fold record opts in; anything else → reject. Resource audit block may override. Business table audit, not control-plane audit_logs. |
| `VIAT_AUDIT_QUERY_MAX_ROWS` | i64; `1000` rows | D. Positive; business trail page/export batch ceiling; query limit can only lower. Not platform audit page ceiling (500). |
| `VIAT_RETENTION_ENABLED` | boolean; `true` | S. Literal 0 or case-insensitive false disables retention loop including partition maintenance/credential cleanup. Empty/other values enable. |
| `VIAT_RETENTION_INTERVAL_HOURS` | u32; `24` h | S. Sweep cadence, first destructive pass after full interval. Parser accepts 0 but timer cannot; set >=1. |
| `VIAT_RETENTION_EXECUTION_DAYS` | u32; `90` days | S. Execution summary row retention. 0 accepts immediate cutoff; no per-project override. |
| `VIAT_RETENTION_LINE_DAYS` | u32; `14` days | S. PostgreSQL line-log monthly partition cutoff, coarse month granularity. Does not configure ClickHouse/Loki TTL. 0 accepted. |
| `VIAT_RETENTION_ASYNC_DAYS` | u32; `7` days | S. Finished async run rows/results. 0 accepted. Does not make finished output permanent. |
| `VIAT_RETENTION_PAYLOAD_DAYS` | u32; `14` days | S. Clears execution input/output and workflow step I/O, retaining summaries longer. 0 accepted. |
| `VIAT_RETENTION_IM_MESSAGE_DAYS` | u32; `90` days | S. Chat message ledger retention; 0 accepted. Personal/conversation data, not just diagnostics. |
| `VIAT_RETENTION_IM_PEER_DAYS` | u32; `180` days | S. Forget context tokens after peer inactivity, not creation age. 0 accepted. |
| `VIAT_RETENTION_AUDIT_DAYS` | u32; `365` days | S. Control-plane audit_logs retention; not business-database trail. 0 accepted, destroys evidence. |
| `VIAT_RETENTION_IDEMPOTENCY_HOURS` | u32; `24` h | S. Stored idempotency keys/responses. 0 accepted; shorten only after considering client retry horizon. |
| `VIAT_RETENTION_FILE_ACCESS_DAYS` | u32; `90` days | S. File-read access audit. 0 accepted; evidence-retention policy applies. |

## Three different kinds of log

1. Server diagnostics go to process output under `RUST_LOG`/`VIAT_LOG_SPANS`. Docker/your collector owns their rotation; Viat retention does not rotate container logs.
2. Execution summaries, workflow steps and async state live in platform PostgreSQL. stdout/stderr/structured line logs can be written to PostgreSQL, ClickHouse or Loki.
3. Control-plane audit records configuration mutations; business-data audit records row changes; file-access audit records reads. None is merely another name for execution logs.

Use [runs](../operations/runs.md), [logs](../operations/logs.md) and [audit](../operations/audit.md) for operational reading/correlation.

## Secure metrics before scraping

```dotenv
VIAT_METRICS_TOKEN=REPLACE_WITH_RANDOM_SCRAPE_TOKEN
RUST_LOG=info
VIAT_LOG_SPANS=1
VIAT_OTLP_ENDPOINT=http://otel-collector:4317
```

This example is unexecuted. Expose metrics only to trusted monitoring networks. Scrape `/metrics` using `Authorization: Bearer TOKEN`: no configured token gives 404, wrong token gives 401. `/healthz` and `/readyz` do not require it and do not attest to every business capability. A scrape token grants no project-management rights.

OTLP exports gRPC spans, not logs or a replacement for `/metrics`; it does not prove collector durability. Initialization failure does not stop the server. Establish collector networking/authentication externally; do not invent Viat-specific OTLP username/password knobs. Standard SDK `OTEL_*` behavior belongs to the dependency and must be validated against the selected exporter.

## Before changing the line-log backend

PostgreSQL is the default and supports console/CLI/API historical reads and substring search. ClickHouse/Loki selection changes line-log **writes only**. It neither migrates old rows nor provisions remote tables or retention. Historical reads still target PostgreSQL; use the new backend's native tools for new lines. The search API returns 409 with a non-PostgreSQL backend.

Non-PostgreSQL writes are best-effort: remote failures warn and continue; this is **not a reliable delivery queue**. Configuration presence does not prove credential, schema or storage usability. In an isolated project send a harmless fixture log, find it in the destination, then switch production. See [log operations](../operations/logs.md) for compatible ClickHouse DDL and Loki labels.

## Retention and history safety

By default the retention loop creates current/next-five-month PostgreSQL line-log partitions at boot; the first destructive sweep waits one interval. Old line logs are removed by whole monthly partitions, not exactly 14 days; a month crossing the cutoff remains. Executions/audit are cleaned in batches. Shortening a horizon can delete already-old data on the next pass; raising it cannot recover deleted data.

Disabling retention also disables partition maintenance and expired-credential cleanup handled by that loop; it is not a cost-free archival strategy. Script history is a count of versions, publish history a count of revisions; neither is regulatory archive. For policy, external-backend TTLs and evidence export see [retention operations](../operations/retention.md).
