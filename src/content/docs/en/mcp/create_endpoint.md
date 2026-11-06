---
title: "create_endpoint — Create endpoint or directory"
description: "Bind a draft path node to one target, or create an unbound directory."
doc_id: mcp.create_endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: [mcp.create_endpoint]
---

# `create_endpoint` — Create endpoint or directory

Bind a draft path node to one target, or create an unbound directory.

Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.

## Prerequisites and permissions

Editor-gated: project Owner, Admin or Developer; Viewer is refused. The PAT owner needs this project role and the PAT scope must permit the route.

Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.

## Complete input fields

Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.

| Field | Type | Required | Omission / explicit null | Constraints and meaning |
| --- | --- | --- | --- | --- |
| `allowed_authorizers` | array&lt;string&gt; / null | no (may be conditional) | inherit; null = omitted. | Authorizer names declared at this node; [] is explicit. |
| `authz_gates` | array&lt;JSON&gt; / null | no (may be conditional) | inherit; null = omitted. | Array of {type,action} gate objects; [] differs from inherit. |
| `crud_config` | JSON (any value) | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | CRUD object; required table/op plus options described below. |
| `crud_resource_name` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Existing postgresql resource for table CRUD. |
| `method` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | HTTP method; accepted values and conditional requirement below. |
| `override_authorizers` | boolean / null | no (may be conditional) | false; null = omitted. | Stored authorizer override flag; omitted updates preserve current value. |
| `overrides` | JSON (any value) | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Endpoint overrides object; replace, not recursive merge. |
| `parent_id` | string / null | no (may be conditional) | tree root; null = omitted. | Parent endpoint UUID; omission/null has create/move semantics below. |
| `path_override` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Leaf absolute path override; no null-clearing via MCP. |
| `project` | string / null | no (may be conditional) | VIAT_PROJECT / current_project; else project_required; null = omitted. | Project slug; omission/null uses VIAT_PROJECT/current_project, otherwise project_required. |
| `proxy_resource_name` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Existing http_api resource binding. |
| `proxy_strip_prefix` | boolean / null | no (may be conditional) | true; null = omitted. | Strip mount prefix; create API default true. |
| `proxy_upstreams` | map<string,string> / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Path-parameter value → http_api resource name map. |
| `script_name` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Script binding name, qualified by folder when needed. |
| `segment` | string | yes | No default; missing/null is invalid. | One path segment, literal or :param. |
| `tree` | string / null | no (may be conditional) | only tree, otherwise required; null = omitted. | Tree NAME, resolved to UUID; not an ID. |
| `workflow_name` | string / null | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | Workflow binding name, qualified by folder when needed. |
| `ws_config` | JSON (any value) | no (may be conditional) | Not supplied to API; conditional rules below.; null = omitted. | WebSocket config with routes; API validation applies. |

## Behavior and validation

Choose at most one binding: `script_name`, `workflow_name`, `proxy_resource_name`, `crud_resource_name`, `ws_config`. No binding and no method means directory. Script/workflow/CRUD leaves need a method; proxy mounts have no method; WebSocket uses GET. `tree` is a name and may be omitted only when exactly one tree exists. `parent_id` omitted/null creates a root node. `segment` is one literal or `:param`, not a multi-segment path. Proxy strip defaults true. Empty authorizer/gate arrays are explicit declarations, not omission; authorizers replace the inherited list while gates accumulate. Complex JSON fields are described below.

A segment must be 1..64 bytes, cannot be bare `:`, and cannot contain `/` or whitespace. A WebSocket node may omit method (the API supplies GET); if a method is supplied it must be GET. In `ws_config.routes`, `script_id` wins over `script` if both are present. Route names are `[a-z0-9_]{1,64}` or `$connect`, `$disconnect`, `$default`; at least one message route other than connect/disconnect is required. `route_key` must be nonblank and at most 64 bytes, and quota values must be positive.

### JSON objects accepted by the API

- `authz_gates`: array of objects with required strings `type`, `action`; the model must declare the type/action and the type must be usable as a subject-only gate. Omission inherits; an empty array declares no gates locally. Gates accumulate through ancestors until the stored override boundary. MCP does not expose changing that boundary.
- `ws_config`: required `routes` map; each route value identifies a script by `script` string or `script_id` UUID string. Optional `route_key` defaults to `"type"`; optional `message_rate_limit` is a quota; `log_messages` is `all` or default `errors`. Unknown top-level config keys are rejected. Routes resolve existing scripts at write time. This config does not enable WebSocket transport in MCP.
- `crud_config`: required `table:string` and `op` = `list|get_by_pk|insert|update_by_pk|delete_by_pk`. `columns:string[]` defaults []; `filters` defaults {} and maps query names to `{column:string,op?:eq|neq|gt|gte|lt|lte|like|ilike}` (op defaults eq); `order_by` defaults [] of `{column:string,dir:asc|desc}`; optional `limit` has integer `default`=50, `max`=200. `writable:string[]` defaults []; `defaults` defaults {} mapping columns to identity scope strings; optional `authz_type:string` inherits the resource table binding when absent; `allow_unscoped_writes:boolean` defaults false. Unknown keys are rejected. Lists use filters/order/limits (other ops reject those options); limit.max must be positive and limit.default cannot exceed it. Empty columns selects all mapped columns; empty writable selects mapped non-primary-key columns. Primary-key operations derive the path key from the mapped table. Mutations need row scope (authz_type/resource binding) unless deliberately opting out; do not enable unscoped writes just to silence a publish refusal.
- `overrides`: object, replaced as a whole. `path_params`, `query_params`, `body_fields` default {} and map wire names to `{type:int|float|bool|string|json,required?:boolean,nullable?:boolean,default?:JSON,as?:string}`. required defaults false; absent nullable does not accept null; default/as are absent by default. Body nullable is separate from required. `required_headers:string[]` defaults []; `response_headers:map<string,string>` defaults {}; optional `response_transform:string` is RFC9535 JSONPath. `strict`, `raw_body`, `run_async` default false. Optional `audit_reason:string` selects a validated reason source. Optional `rate_limit` has nullable/optional `endpoint`/`subject` quotas and `subject_key` = default `identity` or `ip`. A quota requires positive integer `requests`, `window_secs`; optional positive `burst` defaults to requests. Optional `multipart` has `max_file_bytes` default 0 (deployment ceiling), `max_files` default 0 (effective 1, max 32), `fields:string[]` default [] (all text fields). Optional `cache` requires positive integer `ttl_secs` within the deployment ceiling; `scope` defaults `caller` or may be `shared`; `vary_headers:string[]`, `ignore_params:string[]` default []. Optional `project_users_grant` contains `roles:string[]` default []; optional `current_user_grant` contains `read_social_identity:boolean` default false and `provision_meta_keys:string[]` default []. These are privilege grants, not harmless annotations.

The API rejects incompatible options: multipart with raw_body/run_async; raw_body with body_fields; cache with raw_body/multipart/run_async. Cache serves GET only. Strict mode requires path declarations; duplicate argument bindings and malformed JSONPath/header names fail. `path_override` is leaf-only, absolute, at most 256 characters, cannot contain `//`, backslash or `..`, and cannot claim a reserved platform path. A string `null` is not a clearing command.

## Output and pagination

Object `{endpoint:Endpoint}`. Endpoint object: string `id`, `path`, `segment`, `tree_id`, `kind`; optional strings `method`, `parent_id`, `script_name`, `workflow_name`, `proxy_resource_name`; optional `ws_routes` object (route → script string), `authz_gates` array of `{type, action}`. Optional fields are omitted, not null. This projection does not echo authorizer lists, overrides or full CRUD configuration; do not treat it as a complete backup.

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
    "name": "create_endpoint",
    "arguments": {
      "project": "mcp-lab",
      "tree": "main",
      "segment": "mcp-demo",
      "method": "GET",
      "script_name": "mcp_demo"
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
        "text": "{\"endpoint\":{\"id\":\"00000000-0000-4000-8000-000000000001\",\"method\":\"GET\",\"path\":\"/mcp-demo\",\"segment\":\"mcp-demo\",\"tree_id\":\"00000000-0000-4000-8000-000000000001\",\"script_name\":\"mcp_demo\",\"kind\":\"script\"}}"
      }
    ],
    "isError": false
  }
}
```

Decoded JSON value in the text block:

```json
{
  "endpoint": {
    "id": "00000000-0000-4000-8000-000000000001",
    "method": "GET",
    "path": "/mcp-demo",
    "segment": "mcp-demo",
    "tree_id": "00000000-0000-4000-8000-000000000001",
    "script_name": "mcp_demo",
    "kind": "script"
  }
}
```

## Failures and recovery

Mixed bindings, a method with no binding, orphan `crud_config`, or proxy fragments without a proxy resource → local `bad_input`. The API rejects invalid methods, missing targets, reserved paths, invalid schemas/gates and conflicting paths. A CRUD leaf needs both resource and config.

All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.

## Side effects, verification and cleanup

Creates a draft only; do not blindly publish the whole project for this one node. Inspect `publish_plan`. Cleanup a fresh fixture with `delete_endpoint` (after unpublishing it if published); deleting a directory removes its subtree.

Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.

## Maintenance evidence

Input inventory: `contracts/1.1.0/mcp-tools.json`, tool `create_endpoint`. Implementation/tests under the pinned product source: `endpoints.rs; handlers/endpoints.rs; core/types/endpoint.rs; core/types/crud.rs; tests/it/tool_create_endpoint.rs`. Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.
