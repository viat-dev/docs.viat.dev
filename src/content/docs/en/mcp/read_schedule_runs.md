---
title: "read_schedule_runs — Read schedule run history"
description: "Inspect recent attempts and obtain request IDs for their logs."
doc_id: mcp.read_schedule_runs
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_schedule_runs]
---

# `read_schedule_runs` — Read schedule run history

Inspect recent attempts and obtain request IDs for their logs.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `before` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Pagination cursor; tool-specific source/format below. |
| `limit` | integer / null | no (may be conditional) | 20; clamp 1..200; null = omitted. | format: "int64"; Page size; effective default and bounds below. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Limit defaults 20 and clamps to 1..200. `before` is an RFC3339 timestamp from an older row’s `started_at`. An attempt is 1-based; several rows can belong to retries of an occurrence.

## Output and pagination

Bare array: string `id`, `request_id`, `status`, `started_at`; JSON `target`; integer `attempt`; optional strings `finished_at`, `error_message` omitted when null. No `next_before` or total count.

Use the oldest returned row’s `started_at` as `before`. There is no next-page marker; continue until empty if needed. Timestamp-only paging cannot provide an ID tie-break for equal timestamps.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "read_schedule_runs",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_timer",
      "limit": 20
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
        "text": "[{\"id\":\"00000000-0000-4000-8000-000000000001\",\"request_id\":\"00000000-0000-4000-8000-000000000001\",\"target\":{\"kind\":\"script\",\"name\":\"mcp_demo\"},\"status\":\"succeeded\",\"attempt\":1,\"started_at\":\"2026-01-01T00:00:00Z\",\"finished_at\":\"2026-01-01T00:00:00Z\"}]"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "request_id": "00000000-0000-4000-8000-000000000001",
    "target": {
      "kind": "script",
      "name": "mcp_demo"
    },
    "status": "succeeded",
    "attempt": 1,
    "started_at": "2026-01-01T00:00:00Z",
    "finished_at": "2026-01-01T00:00:00Z"
  }
]
```

## Failures and recovery

Bad timestamps or missing schedules are upstream failures. `failed`/`skipped` statuses are data in a successful list, not tool errors.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `read_schedule_runs`. Implementation/tests under the pinned product source: `schedules.rs; handlers/schedules.rs; tests/it/tool_read_schedule_runs.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
