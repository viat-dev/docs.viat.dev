---
title: "unpublish_endpoint — Unpublish one endpoint"
description: "Remove one endpoint from the served snapshot while leaving the rest published."
doc_id: mcp.unpublish_endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.unpublish_endpoint]
---

# `unpublish_endpoint` — Unpublish one endpoint

Remove one endpoint from the served snapshot while leaving the rest published.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Publisher-gated: project Owner or Admin; Developer and Viewer are refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `id` | string | yes | No default; missing/null is invalid. | Endpoint node UUID, not a tree/script ID. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Requires an endpoint node ID. POSTs to the node’s unpublish action, not the project apply route; no confirmation switch. The draft and underlying script remain available for editing.

## Output and pagination

Object `{unpublished:boolean}`; MCP falls back to true if the API omits the flag.

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
    "name": "unpublish_endpoint",
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
        "text": "{\"unpublished\":true}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "unpublished": true
}
```

## Failures and recovery

Protected system nodes are refused with 403; nonexistent node IDs produce upstream errors. Do not confuse a runtime authorization 403 with this control-plane refusal.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Immediately removes that endpoint’s served snapshot; it is a live outage for its callers, not draft-only. For a fixture, unpublish before deleting its node/script. Restoring service needs an intentional publish after inspecting the project-wide plan.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `unpublish_endpoint`. Implementation/tests under the pinned product source: `publish.rs; handlers/snapshots.rs; tests/it/tool_unpublish_endpoint.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
