---
title: Execution logs and diagnostic evidence
description: Query, correlate and stream logs, protect captured payloads and operate PostgreSQL, ClickHouse or Loki backends.
doc_id: operations.logs
verified_release: '1.1.0'
channel: stable
---

# Execution logs and diagnostic evidence

Project members — Operator included — may read execution logs; membership is
**not** permission to edit, publish or cancel. Management APIs require a
platform session/PAT; endpoint API keys or single-run capabilities never
substitute. All commands/DDL below are **unexecuted**; remote backend setup
needs administrator approval.

## Query and correlate

Use the console's project logs page or the [CLI logs](../cli/logs.md). Get
the `request_id` from the caller — never confuse execution-row IDs, async
`run_id`s, endpoint IDs and workflow `step_id`s.

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/executions" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'limit=50' --data-urlencode 'status_min=500' \
  --data-urlencode 'since=2026-01-01T00:00:00Z'
curl --fail-with-body "$BASE/projects/$PROJECT/executions/$REQUEST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Substitute the real event window for the timestamps. Essentials:

- The list returns `{items,next_before}`; filters include `endpoint_id`,
  `request_id`, `status_min`, `status_max`, `since`, `until`, `limit`,
  `before`, `path_eq`, `script`, `script_folder`, `is_test`, `target_kind`,
  `target_ref`. Limit defaults to 50 within 1..200; `before` takes the
  returned `RFC3339,UUID` cursor.
- `script_folder=''` pins the root folder; omitted, a same-named script can
  match several folders.
- `is_test=false` selects production logs; `true` selects **tests only** —
  not both.
- Detail returns `{execution,lines,input,output}`. A null payload can mean
  capture disabled, purged, or not recorded on this path — **not necessarily
  an empty request**; errored or streaming executions may have no output.
  The workflow snapshot path
  `/projects/PROJECT/executions/REQUEST_ID/workflow_snapshot` shows **what
  ran then**, not today's edited draft.

### Search and live tailing

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/log-lines" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'q=fixture' --data-urlencode 'limit=50'
curl --no-buffer --fail-with-body \
  "$BASE/projects/$PROJECT/logs/tail?backfill=20" \
  -H "Authorization: Bearer $TOKEN"
```

- Search terms are trimmed to **at least 3 characters**; supports
  `since/until/stream/limit/before`, returning `{items,next_before}`.
  **Only PostgreSQL line logs support search** — other configured backends
  answer **409**.
- The SSE tail emits execution/line events plus keepalives; `backfill`
  defaults to 0 and can replay a few recent executions first; cross-node
  coverage comes from polling on top of local live events. A lagging
  subscriber can drop events — **reconnect/tail is not a reliable audit
  export**; fill gaps with history queries and deduplicate by ID.
- Configure [proxy streaming behavior](tls-proxy.md) so buffering does not
  masquerade as execution latency.

## Payload privacy

- The project's `record_payloads` decides whether execution/workflow I/O is
  captured; `redact_keys` extends redaction. The built-in rules lowercase
  keys, strip hyphens/underscores and match **whole keys**
  (password/token/authorization, …) — **not** every sensitive substring.
- Captured values over **64 KiB** are replaced by a truncation marker.
  Redaction has depth limits: it cannot understand arbitrary business
  personal data or secrets inside free text.
- The log sink masks known resource/caller secrets but is **not an
  anti-exfiltration boundary**; some resource objects still project
  credentials into scripts — never print them.
- Practice: validate custom redaction keys with a non-sensitive fixture;
  disable payload capture when unneeded; keep payload retention shorter than
  summaries. Server/container diagnostics and external sinks need access
  control and rotation too.

## PostgreSQL and external line-log backends

Execution summaries and workflow rows **always** stay in PostgreSQL.
`VIAT_LINE_LOG_BACKEND` changes only **line-log writes**: no history
migration and no remote history integration — new remote lines never appear
in PostgreSQL history/search; query them with the backend's native tools,
and live streams never replace durable remote logs. Writes are best-effort:
failures warn and continue with **no** replay-guaranteeing spool.

### ClickHouse

An authorized ClickHouse administrator creates the compatible table first
(unexecuted DDL; database/table names and retention need review):

```sql
CREATE TABLE IF NOT EXISTS line_logs (
    id UUID DEFAULT generateUUIDv4(),
    project_id UUID,
    request_id UUID,
    execution_log_id UUID,
    stream Enum8('stdout'=1, 'stderr'=2, 'structured'=3),
    seq Int32,
    content String,
    step_id Nullable(String),
    created_at DateTime64(6, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, execution_log_id, seq);
```

Set `VIAT_LINE_LOG_BACKEND=clickhouse`, `VIAT_CH_URL`, the database/table
and paired Basic auth per [configuration](../configuration/observability.md).
The client writes HTTP JSONEachRow with a 10-second timeout. Use HTTPS,
INSERT-only restricted permissions and independent TTL/backups; locate a
non-sensitive fixture by execution ID before relying on it.

### Loki

Configure `VIAT_LINE_LOG_BACKEND=loki`, the base `VIAT_LOKI_URL`, optional
paired auth and `VIAT_LOKI_TENANT`. The writer appends
`/loki/api/v1/push` itself — do not duplicate it. Labels: `viat_project`,
`viat_stream`, optional `viat_step_id`; the text carries
`exec=EXECUTION_ID seq=NUMBER`. A native query example:
`{viat_project="PROJECT_UUID"} |= "exec=EXECUTION_ID"` (substitute real
IDs). Tenant authorization and retention live in Loki; Viat's PostgreSQL
cleanup **never** deletes remote rows.

## Errors and recovery

| Symptom | Action |
| --- | --- |
| Empty detail/search after switching backends | Verify the **write** backend first; do not conclude summaries are lost |
| Search/cursor 400 | Use ≥3-character terms and the exact returned cursors |
| 401/403 | Use the management identity with real project membership, not a run API key |
| Recent lines missing | Check sink errors, proxy buffering, subscriber lag and external retention; **no logs does not mean no execution** |
| Disk full | Suppress the runaway source and preserve incident evidence first, then clean cautiously; tune [retention](retention.md), external TTLs and container rotation **separately** |

After collection: restrict export-file permissions, revert temporary verbose
log levels, and rotate any leaked credentials. **Never** paste raw database
errors or business payloads into public reports.
