---
title: "read_logs — Read execution and line logs"
description: "Fetch one request’s raw execution summary plus a capped list of output lines."
doc_id: mcp.read_logs
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_logs]
---

# `read_logs` — Read execution and line logs

Fetch one request’s raw execution summary plus a capped list of output lines.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `line_limit` | integer / null | no (may be conditional) | 500; max 2000; null = omitted. | minimum: 0; format: "uint"; Returned log lines, default 500, cap 2000. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `request_id` | string | yes | No default; missing/null is invalid. | Execution request UUID for read_logs. |

## Behavior and validation

`request_id` is the execution request UUID, not a script or async run ID. `line_limit` defaults 500, caps at 2000; zero returns no lines. The API’s full returned line array is fetched before MCP truncates it.

## Output and pagination

Object `{execution:JSON,lines:Line[],truncated:boolean,total_lines:integer}`. Line: integer `seq`, string `stream`, `content`, optional string `step_id` (omitted when null). `execution` is the API ExecutionLog object: IDs `id`, `project_id`, `request_id`; string `method`, `path`, `principal_kind`, `created_at`; integers `status`, `latency_ms`; booleans `is_test`, `cache_hit`; nullable `endpoint_node_id`, `project_user_id`, `authorizer_id`, `ip`, `error_kind`, `error_message`, `workflow_id`, `workflow_name`, `workflow_version`, `target_kind`, `target_ref`. UUIDs/timestamps are strings; `workflow_version` is an integer when present.

No cursor. `truncated:true` only means more returned lines existed than `line_limit`; increase it up to 2000. There is no supported follow-up page.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "read_logs",
    "arguments": {
      "project": "mcp-lab",
      "request_id": "00000000-0000-4000-8000-000000000001",
      "line_limit": 500
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
        "text": "{\"execution\":{\"id\":\"00000000-0000-4000-8000-000000000001\",\"project_id\":\"00000000-0000-4000-8000-000000000001\",\"request_id\":\"00000000-0000-4000-8000-000000000001\",\"endpoint_node_id\":null,\"method\":\"GET\",\"path\":\"/mcp-demo\",\"status\":200,\"latency_ms\":1,\"principal_kind\":\"anonymous\",\"project_user_id\":null,\"authorizer_id\":null,\"ip\":null,\"error_kind\":null,\"error_message\":null,\"workflow_id\":null,\"workflow_name\":null,\"workflow_version\":null,\"is_test\":false,\"target_kind\":\"script\",\"target_ref\":\"mcp_demo\",\"cache_hit\":false,\"created_at\":\"2026-01-01T00:00:00Z\"},\"lines\":[],\"truncated\":false,\"total_lines\":0}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "execution": {
    "id": "00000000-0000-4000-8000-000000000001",
    "project_id": "00000000-0000-4000-8000-000000000001",
    "request_id": "00000000-0000-4000-8000-000000000001",
    "endpoint_node_id": null,
    "method": "GET",
    "path": "/mcp-demo",
    "status": 200,
    "latency_ms": 1,
    "principal_kind": "anonymous",
    "project_user_id": null,
    "authorizer_id": null,
    "ip": null,
    "error_kind": null,
    "error_message": null,
    "workflow_id": null,
    "workflow_name": null,
    "workflow_version": null,
    "is_test": false,
    "target_kind": "script",
    "target_ref": "mcp_demo",
    "cache_hit": false,
    "created_at": "2026-01-01T00:00:00Z"
  },
  "lines": [],
  "truncated": false,
  "total_lines": 0
}
```

## Failures and recovery

A valid-looking but unknown UUID returns 404. `total_lines` counts the array returned by the configured log backend, not a promise that expired/external logs still exist. Workflow step logs/spans are not exposed by this tool.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `read_logs`. Implementation/tests under the pinned product source: `executions.rs; handlers/logs.rs; core/types/log.rs; tests/it/tool_read_logs.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
