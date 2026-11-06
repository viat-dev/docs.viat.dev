---
title: "read_queue_trigger_fires — Read queue delivery outcomes"
description: "Read the latest delivery-to-execution records for one queue trigger."
doc_id: mcp.read_queue_trigger_fires
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.read_queue_trigger_fires]
---

# `read_queue_trigger_fires` — Read queue delivery outcomes

Read the latest delivery-to-execution records for one queue trigger.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Resolves the named trigger in the API and returns its latest 50 consumed-delivery records. It is not a peek into the broker and does not fetch message payload bodies.

## Output and pagination

Bare API JSON array: UUID strings `id`, `trigger_id`; nullable UUID `execution_id`; nullable strings `message_id`, `routing_key`, `detail`; boolean `redelivered`; string `outcome`, timestamp `fired_at`. Null keys remain present. An execution ID is not automatically the request ID expected by `read_logs`.

Hard window of the latest 50 records, with no limit, cursor or continuation tool. MCP cannot retrieve older pages.

The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.

## Synthetic request and expected shape

After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "read_queue_trigger_fires",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_queue"
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
        "text": "[]"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
[]
```

## Failures and recovery

Unknown trigger → 404; Viewer → 403. Empty history does not establish that the queue is empty or healthy.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `read_queue_trigger_fires`. Implementation/tests under the pinned product source: `queue.rs; handlers/queue_triggers.rs; core/types/queue_trigger.rs; tests/it/tool_read_queue_trigger_fires.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
