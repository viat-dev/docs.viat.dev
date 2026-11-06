---
title: "test_alert — Send a real test alert"
description: "Send once to the saved webhook/chat/email/push destination, even for a disabled rule."
doc_id: mcp.test_alert
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.test_alert]
---

# `test_alert` — Send a real test alert

Send once to the saved webhook/chat/email/push destination, even for a disabled rule.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Publisher-gated: project Owner or Admin; Developer and Viewer are refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | No default; missing/null is invalid. | Exact asset name; see tool-specific identity and folder rules. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |

## Behavior and validation

The API loads the rule and invokes its channel directly; it does not gate delivery on `enabled`. This is NOT a dry-run, connectivity-only check or safe default health probe. Provision an isolated local destination stub and obtain explicit consent before using it.

## Output and pagination

Object `{delivered:boolean,error?:string}`. Delivery failure ordinarily returns HTTP 200 with `delivered:false`, so inspect the flag even when `isError` is false. Push success means provider acceptance, not confirmed handset receipt.

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
    "name": "test_alert",
    "arguments": {
      "project": "mcp-lab",
      "name": "mcp_alert"
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
        "text": "{\"delivered\":true}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "delivered": true
}
```

## Failures and recovery

Unknown rule/permissions → tool error; actual channel refusal is usually the ordinary `error` string beside `delivered:false`. A lost response is not evidence no message was sent; do not blindly retry.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Really sends. The example assumes `mcp_alert` points only to an operator-owned local HTTP stub; it was not sent. Delete the isolated rule afterward; already sent chat/email/push/webhook effects cannot be undone by deleting it.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `test_alert`. Implementation/tests under the pinned product source: `alerts.rs; handlers/alerts.rs; tests/it/tool_test_alert.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
