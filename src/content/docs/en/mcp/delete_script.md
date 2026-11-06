---
title: "delete_script — Delete a script"
description: "Permanently remove one non-system script draft by name and folder."
doc_id: mcp.delete_script
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.delete_script]
---

# `delete_script` — Delete a script

Permanently remove one non-system script draft by name and folder.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `folder` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Resource/script/workflow folder path; empty string selects root; omission/null uses name lookup. Nonempty: at most 255 bytes / 8 levels, segments [A-Za-z0-9_-]+, no leading/trailing/repeated slash. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Uses DELETE on the script name route with optional `folder`. Resolve ambiguous names with `list_scripts` before deletion; no confirmation argument exists.

## Output and pagination

Object `{deleted:string}` echoes the deleted script name (falls back to the requested name if the upstream field is absent).

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
    "name": "delete_script",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_demo",
      "folder": ""
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
        "text": "{\"deleted\":\"mcp_demo\"}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "deleted": "mcp_demo"
}
```

## Failures and recovery

System scripts are refused with 403. Missing or ambiguous scripts yield upstream 404/409. Do not interpret a lost response as proof that nothing was deleted.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Destructive: there is no MCP undelete. Bound draft endpoints can become `unknown` until rebound. This is not an unpublish operation; inspect published exposure separately. Back up source, folders and references first; cleanup is recreating the fixture only if intentionally needed.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `delete_script`. Implementation/tests under the pinned product source: `scripts.rs; handlers/scripts.rs; tests/it/tool_delete_script.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
