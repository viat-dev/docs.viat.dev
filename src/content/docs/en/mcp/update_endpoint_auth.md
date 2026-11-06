---
title: "update_endpoint_auth — Update endpoint authorization"
description: "Change declared authorizers or gates without unintentionally clearing omitted fields."
doc_id: mcp.update_endpoint_auth
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.update_endpoint_auth]
---

# `update_endpoint_auth` — Update endpoint authorization

Change declared authorizers or gates without unintentionally clearing omitted fields.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `allowed_authorizers` | array&lt;string&gt; / null | no (may be conditional) | preserve current; null = omitted. | Authorizer names declared at this node; [] is explicit. |
| `authz_gates` | array&lt;JSON&gt; / null | no (may be conditional) | preserve current; null = omitted. | Array of {type,action} gate objects; [] differs from inherit. |
| `id` | string | yes | No default; missing/null is invalid. | Endpoint node UUID, not a tree/script ID. |
| `inherit_authz_gates` | boolean / null | no (may be conditional) | false; null = omitted. | True sends API null to inherit; default false; mutually exclusive with gates. |
| `override_authorizers` | boolean / null | no (may be conditional) | preserve current; null = omitted. | Stored authorizer override flag; omitted updates preserve current value. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

GETs the node first and echoes omitted `allowed_authorizers` and `override_authorizers`, also preserving the unexposed `override_permissions`. Pass `authz_gates:[{type,action}]` to declare gates, `inherit_authz_gates:true` to send API null/inherit, or neither to preserve them. Explicit MCP null behaves like omission, so `authz_gates:null` does NOT clear gates. `authz_gates` plus `inherit_authz_gates:true` is invalid. An empty array declares no local gates; ancestor gates can still apply. Each gate needs string `type` and `action` validated against the authorization model.

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
    "name": "update_endpoint_auth",
    "arguments": {
      "project": "mcp-lab",
      "id": "00000000-0000-4000-8000-000000000001",
      "authz_gates": [],
      "inherit_authz_gates": false
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
        "text": "{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo\",\"segment\":\"mcp-demo\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\",\"authz_gates\":[]}"
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
  "kind": "script",
  "authz_gates": []
}
```

## Failures and recovery

Mutually exclusive gate arguments → `bad_input`; missing node or protected system node → API 404/403. This read-modify-write is not a compare-and-swap: avoid concurrent edits to the same node.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Changes draft security configuration; existing published auth stays until publish. Save the original declaration, restore it with this tool, and review the plan before publishing. The returned projection is insufficient to back up all authorizer settings.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `update_endpoint_auth`. Implementation/tests under the pinned product source: `endpoints.rs; handlers/endpoints.rs; tests/it/tool_update_endpoint.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
