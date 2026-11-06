---
title: "list_projects — List accessible projects"
description: "Discover projects belonging to the token’s user, not the whole instance."
doc_id: mcp.list_projects
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_projects]
---

# `list_projects` — List accessible projects

Discover projects belonging to the token’s user, not the whole instance.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires an authenticated platform user. Only projects that user belongs to are returned. A project-scoped PAT cannot call `/projects`: expect 403, and configure `VIAT_PROJECT` instead of using this discovery tool.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

No fields. Pass `{}`; this tool does not accept a project selector.

## Behavior and validation

Arguments are an empty object: this is the exception to the optional `project` argument. No default project is needed. The upstream request is `GET /projects`.

## Output and pagination

An array of objects with string `slug`, `name`, `created_at`; no membership or role list is included.

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
    "name": "list_projects",
    "arguments": {}
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
        "text": "[{\"slug\":\"mcp-lab\",\"name\":\"MCP lab\",\"created_at\":\"2026-01-01T00:00:00Z\"}]"
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
    "slug": "mcp-lab",
    "name": "MCP lab",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

## Failures and recovery

403 with a project PAT is expected confinement, not an empty project list. An invalid bearer returns an authentication failure.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `list_projects`. Implementation/tests under the pinned product source: `projects.rs; handlers/projects.rs; tests/it/tool_list_projects.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
