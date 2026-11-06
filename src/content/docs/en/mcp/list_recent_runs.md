---
title: "list_recent_runs — List recent endpoint executions"
description: "Filter execution summaries by HTTP status, exact path or script and page backward."
doc_id: mcp.list_recent_runs
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_recent_runs]
---

# `list_recent_runs` — List recent endpoint executions

Filter execution summaries by HTTP status, exact path or script and page backward.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `before` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Pagination cursor; tool-specific source/format below. |
| `limit` | integer / null | no (may be conditional) | 20; max 200; null = omitted. | minimum: 0; format: "uint32"; Page size; effective default and bounds below. |
| `path_eq` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Exact path filter, not prefix. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `script` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Execution script-name filter. |
| `status_max` | integer / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | minimum: 0; maximum: 65535; format: "uint16"; Inclusive maximum status filter, uint16. |
| `status_min` | integer / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | minimum: 0; maximum: 65535; format: "uint16"; Inclusive minimum status filter, uint16. |

## Behavior and validation

`status_min`/`status_max` are inclusive uint16 filters; `path_eq` is exact, not a prefix. `script` is a name. Limit defaults 20 and is capped at 200 in MCP; zero reaches the API rather than receiving a local minimum clamp. All absent/null filters are left out of the query.

## Output and pagination

Object `{items:Run[],next_before?:string}`. Run: string `request_id`, `created_at`, `method`, `path`; integer `status`, `latency_ms`; optional strings `error_kind`, `error_message`, `workflow_name`. Missing optional values/cursor are omitted.

Pass the returned `next_before` as `before` with the same filters. Stop when it is omitted; do not fabricate timestamp cursors or assume every full page has a next page.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_recent_runs",
    "arguments": {
      "project": "mcp-lab",
      "limit": 20,
      "status_min": 500
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
        "text": "{\"items\":[]}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "items": []
}
```

## Failures and recovery

Malformed filters/cursor can be refused upstream. This is execution history, not a health guarantee: missing history can reflect retention or logging policy.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `list_recent_runs`. Implementation/tests under the pinned product source: `executions.rs; handlers/logs.rs; tests/it/tool_list_recent_runs.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
