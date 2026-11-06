---
title: "upsert_alert — Create or replace alert rule"
description: "Set a named failure threshold and exactly one real notification destination."
doc_id: mcp.upsert_alert
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.upsert_alert]
---

# `upsert_alert` — Create or replace alert rule

Set a named failure threshold and exactly one real notification destination.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Publisher-gated: project Owner or Admin; Developer and Viewer are refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `channel_kind` | string | yes | No default; missing/null is invalid. | webhook \| chat \| email \| push; exactly one matching destination. |
| `chat_account` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Existing chat account name, with chat_id. |
| `chat_id` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Chat recipient/group ID, with chat_account. |
| `email_to` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Comma-separated email recipients. |
| `enabled` | boolean / null | no (may be conditional) | true; null = omitted. | Stored enabled flag; upserts default true, toggle tools require boolean. |
| `kind` | string | yes | No default; missing/null is invalid. | Alert kind: endpoint_errors \| schedule_failures. |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `push_resource` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Existing push resource name/qualified path. |
| `threshold` | integer | yes | No default; missing/null is invalid. | format: "int64"; Failure threshold >=1; API int32. |
| `webhook_url` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | HTTP/HTTPS destination for webhook channel. |
| `window_secs` | integer / null | no (may be conditional) | null; conditional; null = omitted. | format: "int64"; Required >=60 for endpoint_errors; forbidden for schedule_failures. |

## Behavior and validation

Lists rules to choose POST versus PUT, then re-reads the list after saving. Supply full replacement configuration: enabled defaults true. `kind:endpoint_errors` needs `window_secs` >=60; `schedule_failures` must not supply a window. `threshold` >=1 (API int32). Exactly one destination matching `channel_kind`: `webhook` needs http/https `webhook_url`; `chat` needs BOTH existing `chat_account` name and `chat_id`; `email` needs nonempty comma-separated `email_to` and configured SMTP at save time; `push` needs existing `push_resource` name or qualified path. Mixed destinations are rejected, not silently discarded.

The rule name must not be blank. SMTP configuration is required at SAVE time for an email rule, even when disabled, and recipients are validated as addresses. WeCom accounts are refused for unprompted alert messages; use a webhook or supported Feishu/Lark/DingTalk account instead. WeChat can be saved but delivery depends on a recipient’s recent-message permit. Push save validates the resource reference/kind and fixes its qualified folder choice; it does not validate provider credentials or prove handset delivery.

## Output and pagination

Object `{created:boolean,alert:Alert}` from the re-read list. Alert object: string `name`, `kind`, `channel_kind`, `state`, `state_since`, `updated_at`; boolean `enabled`; integer `threshold`; optional integer `window_secs`; optional strings `webhook_url`, `chat_id`, `email_to`, `push_resource`, `last_notified_at`, `last_error`; optional JSON `chat_account` (currently the resolved account name). Optional fields are omitted when null. Non-publishers see an existing webhook URL as `[redacted]`.

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
    "name": "upsert_alert",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_alert",
      "enabled": false,
      "kind": "endpoint_errors",
      "threshold": 5,
      "window_secs": 300,
      "channel_kind": "webhook",
      "webhook_url": "http://127.0.0.1:9999/alert-stub"
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
        "text": "{\"created\":true,\"alert\":{\"name\":\"mcp_alert\",\"enabled\":false,\"kind\":\"endpoint_errors\",\"threshold\":5,\"window_secs\":300,\"channel_kind\":\"webhook\",\"webhook_url\":\"http://127.0.0.1:9999/alert-stub\",\"state\":\"ok\",\"state_since\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-01T00:00:00Z\"}}"
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
  "alert": {
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
}
```

## Failures and recovery

Missing/mixed/mismatched destination → local `bad_input`; invalid window, recipients, missing chat/push resource → upstream error. A post-write re-read can fail after the rule was saved, so reconcile with `list_alerts` before retrying.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Can arm real notifications (default true); this is not merely validating a schema. The example is disabled and points to a local stub that must be operator-owned on the API host. Do not use public provider URLs. New fixtures: `delete_alert`; existing rules: preserve and restore the entire rule, including enabled state. Disabling cannot retract prior messages.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `upsert_alert`. Implementation/tests under the pinned product source: `alerts.rs; handlers/alerts.rs; tests/it/tool_upsert_alert.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
