---
title: "write_script — Create or update a script draft"
description: "Upsert source by name and folder, then inspect pending published endpoints."
doc_id: mcp.write_script
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.write_script]
---

# `write_script` — Create or update a script draft

Upsert source by name and folder, then inspect pending published endpoints.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `content` | string / null | no (may be conditional) | required on create; unchanged on update; null = omitted. | Script source; required on create, optional replacement on update. |
| `dedicated` | boolean / null | no (may be conditional) | create false; update unchanged; null = omitted. | Dedicated worker toggle; updates only supplied values. |
| `dedicated_count` | integer / null | no (may be conditional) | create 2; update unchanged; null = omitted. | format: "int64"; Dedicated slots, 1..32; create default 2; omitted updates preserve current. Supplied create flags require a follow-up PATCH. |
| `folder` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Resource/script/workflow folder path; empty string selects root; omission/null uses name lookup. Nonempty: at most 255 bytes / 8 levels, segments [A-Za-z0-9_-]+, no leading/trailing/repeated slash. |
| `language` | string / null | no (may be conditional) | required on create; ignored on update; null = omitted. | Required on script creation only; ignored on update. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

First GETs the script. Only 404 selects create; creation requires `language` and `content`. An update PATCH sends only `content`, `dedicated`, `dedicated_count` that are present. `language` on update is ignored, not a language change. Folder locates the script; it never moves it. Dedicated count must be 1..32. New dedicated configuration is a second PATCH after create, so failure can leave a created script.

Accepted language literals are `python`, `sql`, `typescript`, `shell`, `graphql`, `viat_gql`, `llm`, `rust`, `binary`. An unknown value is rejected by the API. Rust authoring can be disabled by the deployment’s `VIAT_RUST_AUTHORING` policy; Rust compilation is native code execution, not a security sandbox. A binary script’s content must be a valid manifest, not executable bytes; MCP has no artifact-upload tool (see [binary scripts](../assets/scripts/binary.md)). Script creation validates name length 1..64 bytes and forbids `/`; use a separate folder. New scripts default to `dedicated:false`, `dedicated_count:2`. Omitted flags on update preserve their current values; do not assume the default is one slot.

## Output and pagination

Object `{created:boolean,script:Script,pending_endpoints?:[{method?:string,path:string}]}`. Pending endpoints are omitted for an empty list. Script object: `name`, `language`, `content`, `created_at`, `updated_at` are strings; `version` is an integer and `is_system` a boolean. Optional `folder` is omitted at the root. `input_schema`, `output_schema`, `schema_warnings` are JSON values, omitted when null/absent upstream.

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
    "name": "write_script",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_demo",
      "folder": "",
      "language": "python",
      "content": "def main():\n    return {\"ok\": True}\n"
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
        "text": "{\"created\":true,\"script\":{\"name\":\"mcp_demo\",\"language\":\"python\",\"content\":\"def main():\\n    return {\\\"ok\\\": True}\\n\",\"version\":1,\"is_system\":false,\"created_at\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-01T00:00:00Z\"}}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "created": true,
  "script": {
    "name": "mcp_demo",
    "language": "python",
    "content": "def main():\n    return {\"ok\": True}\n",
    "version": 1,
    "is_system": false,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

## Failures and recovery

No updateable fields → local `bad_input`. 409 ambiguity and permission failures are not treated as create signals. On a failed dedicated PATCH, re-read before retrying: creation is not transactional across the two requests.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Changes the live draft. Bound published snapshots remain unchanged until `publish_apply`; shared `uses:` modules are live dependencies and can affect callers immediately. For a fresh fixture, delete it with `delete_script` after removing endpoint/schedule/workflow references; for an update, preserve and restore the original source/configuration.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `write_script`. Implementation/tests under the pinned product source: `scripts.rs; handlers/scripts.rs; tests/it/tool_write_script.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
