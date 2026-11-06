---
title: "list_endpoints — List endpoint nodes"
description: "Inspect draft endpoint kinds, paths and bindings, optionally within one tree."
doc_id: mcp.list_endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_endpoints]
---

# `list_endpoints` — List endpoint nodes

Inspect draft endpoint kinds, paths and bindings, optionally within one tree.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `tree` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Tree NAME, resolved to UUID; not an ID. |

## Behavior and validation

Despite being a read tool, both the endpoints collection and tree-name lookup are Editor-gated. `tree` is a name, not a UUID; MCP resolves it with the trees API. No tree argument lists all trees’ nodes. These are draft rows, not a statement of published state.

## Output and pagination

Array: string `id`, `path`, `segment`, `tree_id`, `kind`; nullable string `method`, `parent_id`, `script_name`, `workflow_name` (keys stay present with null); optional object `ws_routes` (route → script), omitted when absent. Kinds: `script`, `workflow`, `proxy`, `crud`, `websocket`, `auth`, `directory`, `unknown`. Deleted script bindings can appear as `unknown`.

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
    "name": "list_endpoints",
    "arguments": {
      "project": "mcp-lab",
      "tree": "main"
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
        "text": "[{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo\",\"segment\":\"mcp-demo\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\",\"parent_id\":null,\"workflow_name\":null}]"
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
    "method": "GET",
    "path": "/mcp-demo",
    "segment": "mcp-demo",
    "tree_id": "00000000-0000-4000-8000-000000000001",
    "script_name": "mcp_demo",
    "kind": "script",
    "parent_id": null,
    "workflow_name": null
  }
]
```

## Failures and recovery

Unknown tree names → local `bad_input`; Viewer → 403. WebSocket nodes cannot be opened with `call_endpoint` (a plain request typically answers 426).

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `list_endpoints`. Implementation/tests under the pinned product source: `endpoints.rs; handlers/endpoints.rs; handlers/trees.rs; tests/it/tool_list_endpoints.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
