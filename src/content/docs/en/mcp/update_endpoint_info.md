---
title: "update_endpoint_info — Update endpoint structure and binding"
description: "Rename a segment, replace overrides or rebind a draft leaf."
doc_id: mcp.update_endpoint_info
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.update_endpoint_info]
---

# `update_endpoint_info` — Update endpoint structure and binding

Rename a segment, replace overrides or rebind a draft leaf.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `crud_config` | JSON (any value) | no (may be conditional) | unchanged; null = omitted. | CRUD object; required table/op plus options described below. |
| `id` | string | yes | No default; missing/null is invalid. | Endpoint node UUID, not a tree/script ID. |
| `method` | string / null | no (may be conditional) | unchanged; null = omitted. | HTTP method; accepted values and conditional requirement below. |
| `overrides` | JSON (any value) | no (may be conditional) | unchanged; null = omitted. | Endpoint overrides object; replace, not recursive merge. |
| `path_override` | string / null | no (may be conditional) | unchanged; null = omitted. | Leaf absolute path override; no null-clearing via MCP. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `script_name` | string / null | no (may be conditional) | unchanged; null = omitted. | Script binding name, qualified by folder when needed. |
| `segment` | string / null | no (may be conditional) | unchanged; null = omitted. | One path segment, literal or :param. |
| `workflow_name` | string / null | no (may be conditional) | unchanged; null = omitted. | Workflow binding name, qualified by folder when needed. |
| `ws_config` | JSON (any value) | no (may be conditional) | unchanged; null = omitted. | WebSocket config with routes; API validation applies. |

## Behavior and validation

Only non-null supplied fields are sent in a PUT. `id` alone, or null-only changes, is `bad_input`. MCP does not expose the API’s null-clears-field behavior: use the console to clear bindings. JSON config objects replace their object, not a recursive merge; preserve unrelated settings. Methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Binding combinations, path overrides, WebSocket and CRUD payloads still undergo API validation; complex JSON fields follow create_endpoint.

For every nested JSON field, use the [complete API object descriptions](create_endpoint.md#json-objects-accepted-by-the-api); the same validation applies here.

## Output and pagination

Endpoint object: string `id`, `path`, `segment`, `tree_id`, `kind`; optional strings `method`, `parent_id`, `script_name`, `workflow_name`, `proxy_resource_name`; optional `ws_routes` object (route → script string), `authz_gates` array of `{type, action}`. Optional fields are omitted, not null. This projection does not echo authorizer lists, overrides or full CRUD configuration; do not treat it as a complete backup.

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
    "name": "update_endpoint_info",
    "arguments": {
      "project": "mcp-lab",
      "id": "00000000-0000-4000-8000-000000000001",
      "segment": "mcp-demo-renamed"
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
        "text": "{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo-renamed\",\"segment\":\"mcp-demo-renamed\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\"}"
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
  "method": "GET",
  "path": "/mcp-demo-renamed",
  "segment": "mcp-demo-renamed",
  "tree_id": "00000000-0000-4000-8000-000000000001",
  "script_name": "mcp_demo",
  "kind": "script"
}
```

## Failures and recovery

No changes → `bad_input`; reserved/malformed paths, incompatible bindings or invalid config → API errors. It cannot change proxy resource bindings or explicitly clear `method`.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Changes draft topology and may mark affected published endpoints dirty. Save original settings and bindings for restoration; inspect `list_endpoints` and `publish_plan` afterward. It does not publish.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `update_endpoint_info`. Implementation/tests under the pinned product source: `endpoints.rs; handlers/endpoints.rs; tests/it/tool_update_endpoint.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
