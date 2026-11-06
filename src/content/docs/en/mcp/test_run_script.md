---
title: "test_run_script — Execute a script draft"
description: "Run the live draft directly, synchronously or detached, without publishing."
doc_id: mcp.test_run_script
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.test_run_script]
---

# `test_run_script` — Execute a script draft

Run the live draft directly, synchronously or detached, without publishing.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `args` | object / null | no (may be conditional) | {}; null = omitted. | default: null; Script input object; omission/null becomes {}. |
| `folder` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Resource/script/workflow folder path; empty string selects root; omission/null uses name lookup. Nonempty: at most 255 bytes / 8 levels, segments [A-Za-z0-9_-]+, no leading/trailing/repeated slash. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `record` | boolean / null | no (may be conditional) | false; null = omitted. | Record resource calls on sync runs, default false. |
| `run_async` | boolean / null | no (may be conditional) | false; null = omitted. | Detach run, default false. |
| `timeout_ms` | integer / null | no (may be conditional) | 30000; clamp 1000..60000; null = omitted. | minimum: 0; format: "uint64"; HTTP wait in milliseconds; tool-specific default and clamp below. |

## Behavior and validation

`args` omitted/null becomes `{}`; `run_async` and `record` default false. Timeout defaults 30000 ms and clamps to 1000..60000; this is the HTTP wait, not a script timeout or cancellation guarantee. `record` captures resource calls only in sync mode. Test execution bypasses endpoint authorizers and runs as the platform, not an endpoint user.

## Output and pagination

Always `is_async:boolean`, `request_id:string`. Detached: optional `run_id`, `status` strings, then poll `read_async_run`. Sync: optional `ok:boolean`, JSON `output`, strings `stdout`, `stderr`, `execution_log_id`, JSON `recorded`, `error`. Null/absent optional values are omitted. The API’s `async` key is renamed to `is_async` by MCP.

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
    "name": "test_run_script",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_demo",
      "folder": "",
      "args": {}
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
        "text": "{\"is_async\":false,\"request_id\":\"00000000-0000-4000-8000-000000000001\",\"ok\":true,\"output\":{\"ok\":true},\"stdout\":\"\",\"stderr\":\"\",\"execution_log_id\":\"00000000-0000-4000-8000-000000000001\"}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "is_async": false,
  "request_id": "00000000-0000-4000-8000-000000000001",
  "ok": true,
  "output": {
    "ok": true
  },
  "stdout": "",
  "stderr": "",
  "execution_log_id": "00000000-0000-4000-8000-000000000001"
}
```

## Failures and recovery

A failed script is normally a successful MCP result with `ok:false` and `error`, not `isError:true`. HTTP/auth/transport failures still use tool errors. A client timeout does not prove execution stopped; inspect logs before replaying writes.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Executes real code: it may write databases, send messages and create execution logs. Use only the inert `mcp_demo` fixture above, without resources. Delete that fixture after removing references; external effects need their own explicit rollback and are not undone by deleting logs.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `test_run_script`. Implementation/tests under the pinned product source: `scripts.rs; handlers/scripts.rs; tests/it/tool_test_run_script.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
