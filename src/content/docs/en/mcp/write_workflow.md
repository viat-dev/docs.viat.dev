---
title: "write_workflow — Create or replace workflow draft"
description: "Upsert the complete YAML definition and report stale endpoint snapshots."
doc_id: mcp.write_workflow
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.write_workflow]
---

# `write_workflow` — Create or replace workflow draft

Upsert the complete YAML definition and report stale endpoint snapshots.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `definition` | string | yes | No default; missing/null is invalid. | Complete workflow YAML text; not a file path. |
| `folder` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Resource/script/workflow folder path; empty string selects root; omission/null uses name lookup. Nonempty: at most 255 bytes / 8 levels, segments [A-Za-z0-9_-]+, no leading/trailing/repeated slash. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

GET by name/folder; only 404 causes POST to the collection, otherwise PATCH the named workflow. Definition is required on both paths and replaces the whole YAML. `folder` is also sent in the body; use an explicit folder to avoid ambiguity. Validate first with `validate_workflow`.

Creation validates name length 1..64 bytes and forbids `/`. A byte-identical definition does not mint a new version. MCP uses `folder` both to locate and echo the selected folder, so this tool is not a general move-to-another-folder interface.

## Output and pagination

Object `{created:boolean,workflow:Workflow,pending_endpoints?:[{method?:string,path:string}]}`. Non-empty pending endpoints include transitive nested-workflow dependencies. Workflow object: string `name`, `definition` (YAML text), `created_at`, `updated_at`; integer `version`; optional string `folder`, omitted at the root.

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
    "name": "write_workflow",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_flow",
      "folder": "",
      "definition": "inputs:\nsteps:\n  - id: hello\n    script: mcp_demo\n    args: {}\noutputs:\n  result: \"$hello.output\"\n"
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
        "text": "{\"created\":true,\"workflow\":{\"name\":\"mcp_flow\",\"version\":1,\"definition\":\"inputs:\\nsteps:\\n  - id: hello\\n    script: mcp_demo\\n    args: {}\\noutputs:\\n  result: \\\"$hello.output\\\"\\n\",\"created_at\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-01T00:00:00Z\"}}"
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
  "workflow": {
    "name": "mcp_flow",
    "version": 1,
    "definition": "inputs:\nsteps:\n  - id: hello\n    script: mcp_demo\n    args: {}\noutputs:\n  result: \"$hello.output\"\n",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

## Failures and recovery

Invalid definitions are rejected on write with the validator’s code/message in the API error. A GET 403/409 is not permission to create another copy.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Saves a draft, not a publish; review `publish_plan` before making it live. Preserve the original definition for restoration. For a new fixture, remove its endpoint/schedule/nested workflow references then `delete_workflow`.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `write_workflow`. Implementation/tests under the pinned product source: `workflows.rs; handlers/workflows.rs; tests/it/tool_write_workflow.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
