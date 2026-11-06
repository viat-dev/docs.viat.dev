---
title: "move_endpoint — Move or reroot endpoint node"
description: "Reparent a draft node inside its current tree."
doc_id: mcp.move_endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.move_endpoint]
---

# `move_endpoint` — Move or reroot endpoint node

Reparent a draft node inside its current tree.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `id` | string | yes | No default; missing/null is invalid. | Endpoint node UUID, not a tree/script ID. |
| `parent_id` | string / null | no (may be conditional) | tree root (MOVE); null = omitted. | Parent endpoint UUID; omission/null has create/move semantics below. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Always sends `{parent_id:...}`. Omitted/null `parent_id` therefore moves the node to the tree root; it is NOT “leave unchanged”. A supplied ID selects the new parent. The current tree is retained; no cross-tree parameter exists.

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
    "name": "move_endpoint",
    "arguments": {
      "project": "mcp-lab",
      "id": "00000000-0000-4000-8000-000000000001"
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
        "text": "{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo\",\"segment\":\"mcp-demo\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\"}"
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
  "path": "/mcp-demo",
  "segment": "mcp-demo",
  "tree_id": "00000000-0000-4000-8000-000000000001",
  "script_name": "mcp_demo",
  "kind": "script"
}
```

## Failures and recovery

Missing/protected nodes and invalid parents are refused by the API; cycles, cross-tree parents and resulting path conflicts are not supported.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Reparents the node and changes descendant draft paths. Save its original parent ID; restore by moving back. Review descendants and `publish_plan`; no live revision is published by this operation.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `move_endpoint`. Implementation/tests under the pinned product source: `endpoints.rs; handlers/endpoints.rs; tests/it/tool_update_endpoint.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
