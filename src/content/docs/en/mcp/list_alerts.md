---
title: "list_alerts — List alert rules and state"
description: "Inspect enabled rules, destinations and current alert evaluator state."
doc_id: mcp.list_alerts
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.list_alerts]
---

# `list_alerts` — List alert rules and state

Inspect enabled rules, destinations and current alert evaluator state.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

Any member may list rules, but only publishers can see actual existing webhook URLs; other roles receive `[redacted]`. MCP echoes a resolved chat account name, not the raw account ID. This does not test destination delivery.

## Output and pagination

Array of Alert objects. Alert object: string `name`, `kind`, `channel_kind`, `state`, `state_since`, `updated_at`; boolean `enabled`; integer `threshold`; optional integer `window_secs`; optional strings `webhook_url`, `chat_id`, `email_to`, `push_resource`, `last_notified_at`, `last_error`; optional JSON `chat_account` (currently the resolved account name). Optional fields are omitted when null. Non-publishers see an existing webhook URL as `[redacted]`.

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
    "name": "list_alerts",
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
        "text": "[{\"name\":\"mcp_alert\",\"enabled\":false,\"kind\":\"endpoint_errors\",\"threshold\":5,\"window_secs\":300,\"channel_kind\":\"webhook\",\"webhook_url\":\"http://127.0.0.1:9999/alert-stub\",\"state\":\"ok\",\"state_since\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-01T00:00:00Z\"}]"
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
    "name": "mcp_alert",
    "enabled": false,
    "kind": "endpoint_errors",
    "threshold": 5,
    "window_secs": 300,
    "channel_kind": "webhook",
    "webhook_url": "http://127.0.0.1:9999/alert-stub",
    "state": "ok",
    "state_since": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

## Failures and recovery

A non-publisher’s redacted URL is not a callable endpoint. `last_error` can indicate a prior delivery problem even when the list request itself succeeded.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only: no asset is changed and no cleanup is required. Keep returned source, logs and identifiers private.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `list_alerts`. Implementation/tests under the pinned product source: `alerts.rs; handlers/alerts.rs; tests/it/tool_list_alerts.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
