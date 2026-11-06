---
title: "get_endpoint_tree — Read nested endpoint tree"
description: "Understand the URL hierarchy of one named tree."
doc_id: mcp.get_endpoint_tree
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.get_endpoint_tree]
---

# `get_endpoint_tree` — Read nested endpoint tree

Understand the URL hierarchy of one named tree.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `tree` | string | yes | No default; missing/null is invalid. | Tree NAME, resolved to UUID; not an ID. |

## Behavior and validation

Required `tree` is resolved by exact name through the trees collection, then nodes are assembled by parent ID. It does not create a missing tree or filter to published leaves.

## Output and pagination

Object `{tree:string,tree_id:string,path_override:string,nodes:Node[]}`. Each node: string `id`, `segment`, `kind`, `path`, `children:Node[]`; optional strings `method`, `script_name`, `workflow_name`; optional `ws_routes` map of strings. Optional node fields are omitted, unlike list_endpoints’ nullable fields.

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
    "name": "get_endpoint_tree",
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
        "text": "{\"tree\":\"main\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"path_override\":\"\",\"nodes\":[{\"id\":\"00000000-0000-4000-8000-000000000001\",\"segment\":\"mcp-demo\",\"method\":\"GET\",\"script_name\":\"mcp_demo\",\"kind\":\"script\",\"path\":\"/mcp-demo\",\"children\":[]}]}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "tree": "main",
  "tree_id": "00000000-0000-4000-8000-000000000001",
  "path_override": "",
  "nodes": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "segment": "mcp-demo",
      "method": "GET",
      "script_name": "mcp_demo",
      "kind": "script",
      "path": "/mcp-demo",
      "children": []
    }
  ]
}
```

## Failures and recovery

Unknown tree → `bad_input`; read permission still requires Editor. A UUID passed as a name does not select that tree unless it is literally its name.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `get_endpoint_tree`. Implementation/tests under the pinned product source: `endpoints.rs; handlers/trees.rs; tests/it/tool_get_endpoint_tree.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
