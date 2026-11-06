---
title: "list_files — List managed storage files"
description: "Read file metadata for one storage resource, not raw bucket contents or file bodies."
doc_id: mcp.list_files
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_files]
---

# `list_files` — List managed storage files

Read file metadata for one storage resource, not raw bucket contents or file bodies.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `before` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Pagination cursor; tool-specific source/format below. |
| `folder` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Resource/script/workflow folder path; empty string selects root; omission/null uses name lookup. Nonempty: at most 255 bytes / 8 levels, segments [A-Za-z0-9_-]+, no leading/trailing/repeated slash. |
| `limit` | integer / null | no (may be conditional) | 100; API clamp 1..1000; null = omitted. | format: "int64"; Page size; effective default and bounds below. |
| `owner_id` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Recorded owning object ID filter. |
| `owner_type` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Recorded owning object type filter. |
| `prefix` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Literal managed file key prefix. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `resource` | string | yes | No default; missing/null is invalid. | Existing storage resource name. |

## Behavior and validation

Requires an existing `storage` resource and its configured metadata database. `folder` locates the resource; `prefix` is a literal key prefix (SQL wildcard characters are escaped). `owner_type` and `owner_id` independently filter recorded ownership. Limit is forwarded to the API, whose effective default is 100 and clamp 1..1000. Deleted files are excluded.

## Output and pagination

API pass-through object `{files:File[],next_cursor:string|null}`. File metadata includes UUID string `id`; string `storage`, `key`, `name`, `content_type`, `sha256`; integer `size`; nullable string `owner_type`, `owner_id`; JSON `meta`, `uploaded_by`; timestamp string `uploaded_at`, nullable timestamps `replaced_at`, `deleted_at`. No binary content, signed download URL or credentials. The terminal cursor is null, not omitted.

Pass `next_cursor` unchanged as `before`, retaining resource/folder/filters. Stop on null. Ordering is newest uploaded_at first with ID tie-break; the cursor is opaque, not a timestamp.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_files",
    "arguments": {
      "project": "mcp-lab",
      "resource": "files_stub",
      "limit": 10,
      "prefix": "demo/"
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
        "text": "{\"files\":[],\"next_cursor\":null}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "files": [],
  "next_cursor": null
}
```

## Failures and recovery

Missing resource → 404; wrong resource kind, unavailable metadata store or invalid cursor → upstream error (`bad_cursor` for a fabricated cursor). No create/delete/download tool is exposed here.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Does not write file contents or metadata. Storage operations may still participate in the platform’s access/audit logging. No fixture cleanup is needed for listing; do not delete user files as verification.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `list_files`. Implementation/tests under the pinned product source: `files.rs; handlers/files.rs; api/src/files.rs; tests/it/tool_list_files.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
