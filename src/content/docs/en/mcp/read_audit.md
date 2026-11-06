---
title: "read_audit — Read control-plane audit trail"
description: "Inspect who changed project configuration, with actor/time filters and paired cursors."
doc_id: mcp.read_audit
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_audit]
---

# `read_audit` — Read control-plane audit trail

Inspect who changed project configuration, with actor/time filters and paired cursors.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Publisher-gated: project Owner or Admin; Developer and Viewer are refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `actor` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Audit actor email/system principal filter. |
| `before` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Pagination cursor; tool-specific source/format below. |
| `before_id` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Audit ID cursor paired with before. |
| `limit` | integer / null | no (may be conditional) | 100; clamp 1..500; null = omitted. | format: "int64"; Page size; effective default and bounds below. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `since` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Inclusive RFC3339 lower time bound. |

## Behavior and validation

This is the platform control-plane audit, not your business database row audit. `actor` filters actor email/system principal; `since` is RFC3339 inclusive. Limit defaults 100 and clamps to 1..500. Pass `before` and `before_id` together or neither; a half pair fails locally.

## Output and pagination

Object `{entries:JSON[],next_before?:string,next_before_id?:string}`. Entries pass through API AuditEntry: string UUID `id`, timestamp `at`, string `method`, `path`, integer `status`; nullable strings `actor_user_id` (UUID), `actor_email`, `actor_ip`, `project_slug`, `detail`. Missing continuation fields are omitted by MCP.

Copy BOTH `next_before` → `before` and `next_before_id` → `before_id`, retaining filters. Stop when no pair is returned; the ID breaks equal-timestamp ties.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "read_audit",
    "arguments": {
      "project": "mcp-lab",
      "limit": 100,
      "actor": "operator@example.invalid"
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
        "text": "{\"entries\":[]}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "entries": []
}
```

## Failures and recovery

Half cursor → `bad_input`; malformed timestamp/UUID → upstream 400; non-publisher → 403. Audit retention limits available history; absence of a record is not proof that no business-data mutation occurred.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `read_audit`. Implementation/tests under the pinned product source: `audit.rs; handlers/audit.rs; db/src/audit.rs; tests/it/tool_read_audit.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
