---
title: "set_queue_trigger_enabled — Enable or disable queue consumption"
description: "Toggle an existing trigger without changing its queue or target configuration."
doc_id: mcp.set_queue_trigger_enabled
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.set_queue_trigger_enabled]
---

# `set_queue_trigger_enabled` — Enable or disable queue consumption

Toggle an existing trigger without changing its queue or target configuration.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `enabled` | boolean | yes | No default; missing/null is invalid. | Stored enabled flag; upserts default true, toggle tools require boolean. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Required boolean `enabled` is POSTed to the enabled action. It cannot create a trigger or change `ack_deadline_override`. The default script timeout ceiling can exceed the broker ack deadline, so trigger creation requires an explicit deadline policy in the console; do not bypass that decision with a generic JSON patch.

## Output and pagination

Queue-trigger object: strings `name`, `resource`, `queue`, `target_kind` (`script` or `workflow`), `target_name`, `updated_at`; boolean `enabled`; integer `max_concurrent_runs`; JSON `inputs`; optional boolean `ack_deadline_override` (omitted if absent upstream).

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
    "name": "set_queue_trigger_enabled",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_queue",
      "enabled": false
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
        "text": "{\"name\":\"mcp_queue\",\"enabled\":false,\"resource\":\"queue_stub\",\"queue\":\"demo\",\"max_concurrent_runs\":1,\"ack_deadline_override\":true,\"target_kind\":\"script\",\"target_name\":\"mcp_demo\",\"inputs\":{},\"updated_at\":\"2026-01-01T00:00:00Z\"}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
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
```

## Failures and recovery

Unknown trigger → upstream 404; insufficient role → 403. Success is stored enabled state, not confirmation that a broker consumer has started or drained.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Enabling starts real message consumption and target execution; disabling stops future consumption, not an undo of deliveries already in flight. The example disables an isolated fixture. Record prior state and restore only intentionally; MCP has no queue-trigger delete or message requeue tool.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `set_queue_trigger_enabled`. Implementation/tests under the pinned product source: `queue.rs; handlers/queue_triggers.rs; tests/it/tool_set_queue_trigger_enabled.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
