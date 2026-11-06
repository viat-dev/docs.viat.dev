---
title: "pause_schedule — Pause schedule firing"
description: "Disable future cadence fires without replacing schedule configuration."
doc_id: mcp.pause_schedule
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.pause_schedule]
---

# `pause_schedule` — Pause schedule firing

Disable future cadence fires without replacing schedule configuration.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

POST pause action by schedule name. Unlike upsert, this preserves the trigger, target and policies. Do not infer that an in-flight execution is cancelled.

## Output and pagination

Schedule object: strings `name`, `on_overlap`, `updated_at`; boolean `enabled`, `catch_up`; JSON objects `trigger`, `target`, `inputs`; `next_due_at` is a timestamp string or null (the key remains present). Optional timestamp strings `last_fired_at`, `last_run_id` (UUID string); integer `max_attempts`; optional integers `queue_cap`, `retry_backoff_secs`. Other optional fields are omitted when absent. `trigger` is `{kind:"cron",cron,timezone}`, `{kind:"interval",every_secs}`, or `{kind:"once",at}`. `target` is `{kind:"script"|"workflow",name}` or `{kind:"endpoint",method,path}`; malformed legacy endpoint targets can echo `{kind:"endpoint",raw}`.

No pagination or continuation cursor.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "pause_schedule",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_timer"
    }
  }
}
```

Expected MCP envelope shape (IDs, timestamps, headers and computed values are illustrative, not deterministic assertions).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"name\":\"mcp_timer\",\"enabled\":false,\"trigger\":{\"kind\":\"interval\",\"every_secs\":60},\"target\":{\"kind\":\"script\",\"name\":\"mcp_demo\"},\"inputs\":{},\"next_due_at\":\"2026-01-01T00:00:00Z\",\"on_overlap\":\"skip\",\"max_attempts\":1,\"retry_backoff_secs\":60,\"catch_up\":true,\"updated_at\":\"2026-01-01T00:00:00Z\"}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "name": "mcp_timer",
  "enabled": false,
  "trigger": {
    "kind": "interval",
    "every_secs": 60
  },
  "target": {
    "kind": "script",
    "name": "mcp_demo"
  },
  "inputs": {},
  "next_due_at": "2026-01-01T00:00:00Z",
  "on_overlap": "skip",
  "max_attempts": 1,
  "retry_backoff_secs": 60,
  "catch_up": true,
  "updated_at": "2026-01-01T00:00:00Z"
}
```

## Failures and recovery

Missing schedule → upstream error. After an uncertain response, read `enabled` in `list_schedules` before changing it again.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Changes automation state to disabled. For safe fixture cleanup leave it paused or delete it. Restore enabled state only with explicit intent; `resume_schedule` recomputes cadence.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `pause_schedule`. Implementation/tests under the pinned product source: `schedules.rs; handlers/schedules.rs; tests/it/tool_pause_resume_schedule.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
