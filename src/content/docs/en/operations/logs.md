---
title: Execution logs and diagnostic evidence
description: Query, correlate and stream logs, protect captured payloads and operate PostgreSQL, ClickHouse or Loki backends.
doc_id: operations.logs
verified_release: '1.1.0'
channel: stable
---

# Execution logs and diagnostic evidence

Project members, including Operator, may read execution logs; membership is not permission to edit/publish/cancel. Management APIs require a platform session/PAT. Endpoint API keys/run capabilities do not grant project log access. All commands/DDL below are **unexecuted**; remote log-backend setup requires administrator approval.

## Query and correlate

Use console project logs or [CLI logs](../cli/logs.md). Record `request_id` from the caller; do not confuse it with execution row ID, async `run_id`, endpoint ID or workflow `step_id`.

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/executions" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'limit=50' --data-urlencode 'status_min=500' \
  --data-urlencode 'since=2026-01-01T00:00:00Z'
curl --fail-with-body "$BASE/projects/$PROJECT/executions/$REQUEST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Replace the time with your incident interval. The list returns `{items,next_before}`. Supported filters are `endpoint_id`, `request_id`, `status_min`, `status_max`, `since`, `until`, `limit`, `before`, `path_eq`, `script`, `script_folder`, `is_test`, `target_kind`, `target_ref`. Default limit is 50, clamped 1..200. `before` is the returned `RFC3339,UUID` cursor. `script_folder=''` pins root; absent folder permits matching a bare name in multiple folders. `is_test=false` selects production logs; `true` selects **only** test runs, not both.

Detail returns `{execution,lines,input,output}`. Null payload can mean disabled capture, retention cleanup or an unrecorded path—not necessarily an empty request. An error/stream may have no captured output. Workflow snapshot route is `/projects/PROJECT/executions/REQUEST_ID/workflow_snapshot`; use it to inspect the recorded execution, not today's edited draft.

### Search and tail

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/log-lines" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'q=fixture' --data-urlencode 'limit=50'
curl --no-buffer --fail-with-body \
  "$BASE/projects/$PROJECT/logs/tail?backfill=20" \
  -H "Authorization: Bearer $TOKEN"
```

Search requires at least three trimmed characters, supports `since`, `until`, `stream`, `limit`, `before`, and returns `{items,next_before}`. PostgreSQL only: other selected line backends return **409**. SSE tail emits execution/line events with keepalives; `backfill` defaults to 0 and adds bounded recent executions. Cross-node polling supplements local live events. A lagging subscriber can lose events; reconnect/tail is not a durable audit export. Recover history with queries and deduplicate IDs. Configure [proxy streaming](tls-proxy.md) so buffering does not imitate delayed execution.

## Payload privacy

Project `record_payloads` controls execution/workflow I/O capture; `redact_keys` adds normalized field names. Built-in matching lowercases and removes hyphens/underscores, then matches **whole keys** such as password/token/authorization—not every sensitive substring. Captured values over **64 KiB** are replaced with a truncation marker. Redaction has a depth bound and cannot infer arbitrary business PII or secrets embedded in free text.

Known resource/caller secrets are masked on log sinks, but this is not an exfiltration-proof boundary. Some resource objects project credentials to script code; never print them. Validate project-specific sensitive keys with harmless fixtures, avoid payload capture where unnecessary, and use shorter payload than summary retention. Server/container diagnostics and external sinks need their own access/rotation policy.

## PostgreSQL versus external line backends

Execution summaries/workflow rows remain in PostgreSQL. Changing `VIAT_LINE_LOG_BACKEND` changes **line-log writes only**; no automatic historical migration or remote read integration. New external lines will not appear in PostgreSQL historical detail/search. Use destination-native tools; live streams are not a substitute for stored remote logs. Best-effort write failures warn and continue; there is no guaranteed replay spool.

### ClickHouse setup

An authorized ClickHouse administrator must precreate the target table with this compatible schema (unexecuted DDL; apply approved database/table names and retention):

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

Set `VIAT_LINE_LOG_BACKEND=clickhouse`, `VIAT_CH_URL`, database/table and both Basic-auth fields if needed; see [settings](../configuration/observability.md). The client uses HTTP JSONEachRow with a 10-second timeout. Configure HTTPS, restricted insert access, independent TTL/backup and a known fixture lookup by execution ID before trusting it.

### Loki setup

Set `VIAT_LINE_LOG_BACKEND=loki`, base `VIAT_LOKI_URL`, optional paired Basic auth and `VIAT_LOKI_TENANT`. The writer appends `/loki/api/v1/push`; do not duplicate it. Labels are `viat_project`, `viat_stream` and optional `viat_step_id`; line text includes `exec=EXECUTION_ID seq=NUMBER`. Example native query is `{viat_project="PROJECT_UUID"} |= "exec=EXECUTION_ID"` with actual IDs. Configure tenant authorization and retention in Loki; Viat PostgreSQL retention does not delete these remote records.

## Failure and recovery

- Empty detail/search after a switch: verify selected backend; do not assume executions lost their summaries.
- 400 search/cursor: use a three-character query and returned cursor verbatim.
- 401/403: use management identity and actual project membership, not a runtime API key.
- Missing recent lines: inspect sink errors, proxy buffering, subscriber lag and external retention; absence is not proof code did not run.
- Full disk: stop uncontrolled log producers and preserve incident evidence before deleting anything; tune [retention](retention.md), external TTLs and container rotation separately.

After collecting evidence, restrict exported files, remove temporary high-verbosity filters and rotate any accidentally disclosed credential. Do not paste raw database errors or payloads into public reports.
