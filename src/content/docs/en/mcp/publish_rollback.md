---
title: "publish_rollback — Roll back latest publish revision"
description: "Restore the revision preceding the newest publish not already rolled back."
doc_id: mcp.publish_rollback
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.publish_rollback]
---

# `publish_rollback` — Roll back latest publish revision

Restore the revision preceding the newest publish not already rolled back.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Publisher-gated: project Owner or Admin; Developer and Viewer are refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Takes only the optional project; no revision ID selector exists. It is a project-wide serving-state operation. Read current plans and coordinate with other publishers before using it.

## Output and pagination

Object `{project_slug:string,revision_id:string,rolled_back_count:integer,endpoints:JSON[]}`; endpoint entries are API pass-through JSON.

In the pinned API, each endpoint entry has UUID string `id`, nullable string `method`, string `path`, nullable UUID string `restored_snapshot_id` and nullable integer `restored_snapshot_version`. These nullable keys remain present because the entries pass through unchanged; null can mean the endpoint had no prior snapshot to restore.

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
    "name": "publish_rollback",
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
        "text": "{\"project_slug\":\"mcp-lab\",\"revision_id\":\"00000000-0000-4000-8000-000000000001\",\"rolled_back_count\":1,\"endpoints\":[]}"
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
  "revision_id": "00000000-0000-4000-8000-000000000001",
  "rolled_back_count": 1,
  "endpoints": []
}
```

## Failures and recovery

Nothing to roll back → upstream 400. An uncertain response must be reconciled before repeating: a second successful rollback can target an older revision.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Changes live snapshots, not an undo of database mutations, notifications or all draft edits. `uses:` modules are read live and are not rolled back. Restoration requires an intentional new publish; do not use this as routine fixture cleanup on a shared project.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `publish_rollback`. Implementation/tests under the pinned product source: `publish.rs; handlers/publish.rs; tests/it/tool_publish.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
