---
title: "read_async_run — Poll an asynchronous run"
description: "Read queued, running or terminal state using a detached run ID."
doc_id: mcp.read_async_run
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_async_run]
---

# `read_async_run` — Poll an asynchronous run

Read queued, running or terminal state using a detached run ID.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `run_id` | string | yes | No default; missing/null is invalid. | Detached async run UUID, distinct from request_id. |

## Behavior and validation

Uses the member-gated console async-run route, not the public capability-token polling route. Obtain `run_id` from detached `test_run_script` or an async endpoint response. Polling is one read per call; no subscription or long poll.

## Output and pagination

Required strings `id`, `request_id`, `method`, `path`, `status`, `source`, `created_at`. Status can be `queued`, `pending`, `running`, `succeeded`, `failed`, `cancelled`. Optional strings `target_kind`, `target_ref`, `error_kind`, `error_message`, `started_at`, `finished_at`; optional integer `http_status`, `queue_position` (1-based while queued); optional JSON `output`. Null optional values are omitted, including a JSON-null output.

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
    "name": "read_async_run",
    "arguments": {
      "project": "mcp-lab",
      "run_id": "00000000-0000-4000-8000-000000000001"
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
        "text": "{\"id\":\"00000000-0000-4000-8000-000000000001\",\"request_id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"TEST\",\"path\":\"mcp_demo\",\"status\":\"succeeded\",\"source\":\"test\",\"created_at\":\"2026-01-01T00:00:00Z\",\"output\":{\"ok\":true}}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "request_id": "00000000-0000-4000-8000-000000000001",
  "method": "TEST",
  "path": "mcp_demo",
  "status": "succeeded",
  "source": "test",
  "created_at": "2026-01-01T00:00:00Z",
  "output": {
    "ok": true
  }
}
```

## Failures and recovery

Missing/expired run IDs return upstream errors. A terminal `failed` status is still a successful read, not `isError`. This tool cannot cancel or restart a run.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `read_async_run`. Implementation/tests under the pinned product source: `executions.rs; handlers/async_runs.rs; tests/it/tool_read_async_run.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
