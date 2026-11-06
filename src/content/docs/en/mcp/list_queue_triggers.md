---
title: "list_queue_triggers — List queue consumers"
description: "Inspect configured AMQP queue triggers without consuming a message through MCP."
doc_id: mcp.list_queue_triggers
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_queue_triggers]
---

# `list_queue_triggers` — List queue consumers

Inspect configured AMQP queue triggers without consuming a message through MCP.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

This read route is Editor-gated, unlike schedule/alert list routes. The MCP surface does not create or fully update queue triggers; provision the AMQP resource, target and ack-deadline decision from the console first.

## Output and pagination

Array of QueueTrigger objects. Queue-trigger object: strings `name`, `resource`, `queue`, `target_kind` (`script` or `workflow`), `target_name`, `updated_at`; boolean `enabled`; integer `max_concurrent_runs`; JSON `inputs`; optional boolean `ack_deadline_override` (omitted if absent upstream).

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
    "name": "list_queue_triggers",
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
        "text": "[{\"name\":\"mcp_queue\",\"enabled\":false,\"resource\":\"queue_stub\",\"queue\":\"demo\",\"max_concurrent_runs\":1,\"ack_deadline_override\":true,\"target_kind\":\"script\",\"target_name\":\"mcp_demo\",\"inputs\":{},\"updated_at\":\"2026-01-01T00:00:00Z\"}]"
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
    "name": "mcp_queue",
    "enabled": false,
    "resource": "queue_stub",
    "queue": "demo",
    "max_concurrent_runs": 1,
    "ack_deadline_override": true,
    "target_kind": "script",
    "target_name": "mcp_demo",
    "inputs": {},
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

## Failures and recovery

Viewer receives 403, not an empty list. A configured enabled trigger is not proof the broker is reachable or that deliveries are completing.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `list_queue_triggers`. Implementation/tests under the pinned product source: `queue.rs; handlers/queue_triggers.rs; tests/it/tool_list_queue_triggers.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
