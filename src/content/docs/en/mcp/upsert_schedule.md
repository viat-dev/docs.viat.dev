---
title: "upsert_schedule — Create or replace schedule"
description: "Replace a named automation schedule; omitted options reset to defaults."
doc_id: mcp.upsert_schedule
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.upsert_schedule]
---

# `upsert_schedule` — Create or replace schedule

Replace a named automation schedule; omitted options reset to defaults.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `at` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Once trigger RFC3339 instant, at most 10 years ahead. |
| `catch_up` | boolean / null | no (may be conditional) | true; null = omitted. | Fire a missed occurrence late, default true. |
| `cron` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Five-field cron expression. |
| `enabled` | boolean / null | no (may be conditional) | true; null = omitted. | Stored enabled flag; upserts default true, toggle tools require boolean. |
| `every_secs` | integer / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | format: "int64"; Interval seconds, 10..86400. |
| `inputs` | JSON (any value) | no (may be conditional) | {}; null = omitted. | Schedule input object, default {}. |
| `max_attempts` | integer / null | no (may be conditional) | 1; null = omitted. | format: "int64"; Attempts per occurrence, default 1, 1..10. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `on_overlap` | string / null | no (may be conditional) | skip; null = omitted. | skip (default) \| queue \| parallel. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `queue_cap` | integer / null | no (may be conditional) | null; null = omitted. | format: "int64"; Positive queue capacity; only with on_overlap queue. |
| `retry_backoff_secs` | integer / null | no (may be conditional) | 60; null = omitted. | format: "int64"; Retry delay, default 60, 1..86400 seconds. |
| `target_kind` | string | yes | No default; missing/null is invalid. | script \| workflow \| endpoint; selects required target fields. |
| `target_method` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Published endpoint target method. |
| `target_path` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Published endpoint target path. |
| `target_script` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Existing script target name. |
| `target_workflow` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Existing workflow target name. |
| `timezone` | string / null | no (may be conditional) | deployment timezone (UTC default); null = omitted. | IANA timezone, deployment schedule default if omitted/null. |
| `trigger_kind` | string | yes | No default; missing/null is invalid. | cron \| interval \| once; selects required trigger fields. |

## Behavior and validation

Full replacement, NOT PATCH. Name: 1..63 characters, starts lowercase ASCII, then lowercase letters/digits/`_`/`-`. `trigger_kind`: `cron` requires five-field `cron` with optional IANA `timezone` (deployment default, normally UTC); `interval` requires `every_secs` 10..86400; `once` requires RFC3339 `at` no more than 10 years ahead (past is permitted and due). `target_kind`: `script` needs `target_script`; `workflow` needs `target_workflow`; `endpoint` needs `target_method` and `target_path` selecting an already published endpoint. Fields for unselected kinds are ignored by MCP. `inputs` omitted/null becomes `{}` and must be an object. `enabled` defaults true; `on_overlap` defaults `skip`, also accepts `queue`/`parallel`. `queue_cap` must be positive and is valid only with `queue`. `max_attempts` defaults 1, range 1..10; `retry_backoff_secs` defaults 60, range 1..86400; `catch_up` defaults true. Omission/null resets these policies even during update.

A once schedule automatically disables after firing. Replacing an already-fired once schedule with the SAME instant does not re-arm it even if `enabled:true`; a new instant is a new occurrence. Inspect the echoed enabled state rather than assuming the requested flag won.

## Output and pagination

Object `{created:boolean,schedule:Schedule}`. Schedule object: strings `name`, `on_overlap`, `updated_at`; boolean `enabled`, `catch_up`; JSON objects `trigger`, `target`, `inputs`; `next_due_at` is a timestamp string or null (the key remains present). Optional timestamp strings `last_fired_at`, `last_run_id` (UUID string); integer `max_attempts`; optional integers `queue_cap`, `retry_backoff_secs`. Other optional fields are omitted when absent. `trigger` is `{kind:"cron",cron,timezone}`, `{kind:"interval",every_secs}`, or `{kind:"once",at}`. `target` is `{kind:"script"|"workflow",name}` or `{kind:"endpoint",method,path}`; malformed legacy endpoint targets can echo `{kind:"endpoint",raw}`.

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
    "name": "upsert_schedule",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_timer",
      "trigger_kind": "interval",
      "every_secs": 60,
      "target_kind": "script",
      "target_script": "mcp_demo",
      "enabled": false,
      "inputs": {}
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
        "text": "{\"created\":true,\"schedule\":{\"name\":\"mcp_timer\",\"enabled\":false,\"trigger\":{\"kind\":\"interval\",\"every_secs\":60},\"target\":{\"kind\":\"script\",\"name\":\"mcp_demo\"},\"inputs\":{},\"next_due_at\":\"2026-01-01T00:00:00Z\",\"on_overlap\":\"skip\",\"max_attempts\":1,\"retry_backoff_secs\":60,\"catch_up\":true,\"updated_at\":\"2026-01-01T00:00:00Z\"}}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "created": true,
  "schedule": {
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
}
```

## Failures and recovery

Unsupported kind/missing kind-specific field → local `bad_input`. API validates ranges, target existence and published endpoint requirement; unpublished endpoint → 400. GET chooses PUT versus POST, so concurrent upserts can race.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Enabled defaults TRUE and can arm real execution immediately, including a past once trigger. The example deliberately sets false and targets the inert draft script; this is still a real configuration write. For new fixtures use `delete_schedule`; for existing schedules save all policies and restore the complete object, not just changed fields.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `upsert_schedule`. Implementation/tests under the pinned product source: `schedules.rs; handlers/schedules.rs; tests/it/tool_upsert_schedule.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
