---
title: "call_endpoint — Invoke a published endpoint"
description: "Send real HTTP traffic through the project router and inspect status, headers and body."
doc_id: mcp.call_endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.call_endpoint]
---

# `call_endpoint` — Invoke a published endpoint

Send real HTTP traffic through the project router and inspect status, headers and body.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

The configured bearer is forwarded to `/p/{project}{path}`; the endpoint’s published authorizers and authorization gates decide access. Successful control-plane reads do not imply permission to invoke an endpoint. A project PAT remains confined to its project; do not assume it is an accepted project-user credential.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `body` | JSON (any value) | no (may be conditional) | no request body; null = omitted. | JSON body; omission/null sends no body. |
| `headers` | object / null | no (may be conditional) | no extra headers; null = omitted. | Request header map, string values intended. |
| `method` | string | yes | No default; missing/null is invalid. | HTTP method; accepted values and conditional requirement below. |
| `path` | string | yes | No default; missing/null is invalid. | Project-relative absolute path, with any query string. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `timeout_ms` | integer / null | no (may be conditional) | 10000; max 60000; null = omitted. | minimum: 0; format: "uint64"; HTTP wait in milliseconds; tool-specific default and clamp below. |

## Behavior and validation

`path` must start with `/`; append any query to that path. `method` must be a valid HTTP token (not restricted to the endpoint creation enum). `headers` is an object: string values are intended; non-string values become empty strings in the implementation. The configured Authorization header is still attached; do not rely on header arguments for safe identity switching. Omitted/null `body` means no JSON body, not a JSON null payload. Timeout defaults 10000 ms, caps at 60000, with no MCP lower clamp. Response body is truncated to 1 MiB after reading it, then parsed as JSON or decoded as a lossy UTF-8 string.

## Output and pagination

Object `{status:integer,headers:object<string,string>,body:JSON,truncated:boolean}`. Repeated response header names are collapsed. Endpoint 4xx/5xx usually remain ordinary successful MCP results: inspect `status`. A truncated JSON document may become a string.

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
    "name": "call_endpoint",
    "arguments": {
      "project": "mcp-lab",
      "method": "GET",
      "path": "/mcp-demo"
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
        "text": "{\"status\":200,\"headers\":{\"content-type\":\"application/json\"},\"body\":{\"ok\":true},\"truncated\":false}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "ok": true
  },
  "truncated": false
}
```

## Failures and recovery

Invalid path/method/header → `bad_input`; timeout → `upstream_timeout`. The exception to status pass-through is 403 with JSON `error:"license_required"`, which becomes an MCP error. WebSocket upgrades/streaming sessions are not supported.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

This is NOT a dry run: any method can trigger database writes, messages or provider calls, depending on code. The example assumes an isolated published GET fixture returning `{ok:true}` with no external resources. Use that fixture only; unpublish/delete it afterward. A timeout is not cancellation and automatic retries can duplicate effects.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `call_endpoint`. Implementation/tests under the pinned product source: `call.rs; http.rs; tests/it/tool_call_endpoint.rs; tests/it/tool_publish.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
