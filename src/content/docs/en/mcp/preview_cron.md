---
title: "preview_cron — Preview cron instants"
description: "Parse a cron expression with the server’s scheduler parser without creating a schedule."
doc_id: mcp.preview_cron
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.preview_cron]
---

# `preview_cron` — Preview cron instants

Parse a cron expression with the server’s scheduler parser without creating a schedule.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Requires membership in the selected project (any project role, including Viewer). A platform role alone is not project membership. The PAT must be valid and its scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `count` | integer / null | no (may be conditional) | 5; API clamp 1..20; null = omitted. | format: "int64"; Preview count, default 5, clamped 1..20. |
| `cron` | string | yes | No default; missing/null is invalid. | Five-field cron expression. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `timezone` | string / null | no (may be conditional) | deployment timezone (UTC default); null = omitted. | IANA timezone, deployment schedule default if omitted/null. |

## Behavior and validation

`cron` is a five-field expression. `timezone` is an IANA zone, defaulting to deployment schedule timezone (normally UTC). `count` defaults 5 and clamps to 1..20 in the API; null follows the default. Results are computed relative to server time, not a supplied example clock.

## Output and pagination

Object `{upcoming:string[],timezone:string}`. Upcoming entries are timestamp strings; exact values depend on server time and timezone rules.

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
    "name": "preview_cron",
    "arguments": {
      "project": "mcp-lab",
      "cron": "0 9 * * *",
      "timezone": "UTC",
      "count": 1
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
        "text": "{\"upcoming\":[\"2026-01-02T09:00:00+00:00\"],\"timezone\":\"UTC\"}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "upcoming": [
    "2026-01-02T09:00:00+00:00"
  ],
  "timezone": "UTC"
}
```

## Failures and recovery

Invalid cron/timezone → upstream validation error. A deployment’s invalid default timezone can be a server configuration error rather than bad user input.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Read-only calculation; no schedule is saved and no target executes. No cleanup required.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `preview_cron`. Implementation/tests under the pinned product source: `schedules.rs; handlers/schedules.rs; tests/it/tool_preview_cron.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
