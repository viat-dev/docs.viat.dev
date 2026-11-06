---
title: "publish_apply — Publish all pending leaves"
description: "Make the project’s publishable draft endpoints live in one snapshot revision."
doc_id: mcp.publish_apply
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.publish_apply]
---

# `publish_apply` — Publish all pending leaves

Make the project’s publishable draft endpoints live in one snapshot revision.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Publisher-gated: project Owner or Admin; Developer and Viewer are refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `acknowledge_test_failures` | boolean / null | no (may be conditional) | false; null = omitted. | Accept reviewed failed test gates, default false. |
| `acknowledge_warnings` | boolean / null | no (may be conditional) | false; null = omitted. | Accept reviewed publish warnings, default false. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Always call `publish_plan` first. This is project-wide, not a single-endpoint publish. Both acknowledge flags default false for omission/null. A 409 message names warnings or failing test gates; fix them or explicitly accept the specific category only after review. The flags are not a safe default.

## Output and pagination

Object `{project_slug:string,published_count:integer,endpoints:JSON[],builds:JSON[],build_pending:boolean}`. Endpoint/build entries are passed through from the API, not a stable MCP output schema. `build_pending:true` with empty `builds` means background build, not readiness. The arrays are not paginated.

In the pinned API, each endpoint entry has string UUID `id`, nullable string `method`, string `path`, UUID string `snapshot_id`, integer `snapshot_version`. Each build has string `script`, `language`, boolean `ok`, nullable string `error`, integer `duration_ms`, and optional `diagnostics` array (empty array omitted). Rust diagnostics contain strings `level`, `message`, `rendered`; optional strings `code`, `source`, `path`; optional unsigned integers `line`, `column` (omitted when absent). A build `ok:false` is result data and must be inspected even if the tool call succeeded.

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
    "name": "publish_apply",
    "arguments": {
      "project": "mcp-lab"
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
        "text": "{\"project_slug\":\"mcp-lab\",\"published_count\":0,\"endpoints\":[],\"builds\":[],\"build_pending\":false}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "project_slug": "mcp-lab",
  "published_count": 0,
  "endpoints": [],
  "builds": [],
  "build_pending": false
}
```

## Failures and recovery

409 codes include `publish_warnings_unacknowledged` and `publish_test_failures`; the original API body is a string in the MCP error message. Build/network failures require inspecting state before retrying, not blind acknowledgement.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Changes live routing atomically for the revision; dependency installation/builds may also run. There is no dry-run switch here. Keep prior revision context; `publish_rollback` is project-wide, and `unpublish_endpoint` removes one fixture endpoint. Neither reverses external script side effects or live shared modules.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `publish_apply`. Implementation/tests under the pinned product source: `publish.rs; handlers/publish.rs; tests/it/tool_publish.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
