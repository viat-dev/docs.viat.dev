---
title: "CRUD surface and contract alignment (preview)"
description: "Draft-time static crud_config validation, OpenAPI 3.1 synthesis, execution budgets, and Console/CLI/MCP parity for CRUD endpoints."
doc_id: triggers.crud-surface-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

# CRUD surface and contract alignment (preview)

This unreleased follow-up to [CRUD endpoints](crud.md) and [paged CRUD lists](crud-list-preview.md) aligns CRUD behavior across the management API, OpenAPI export, Console tabs, CLI and MCP projections, and extends CRUD queries with read-only nested `relations`, expanded filter operators, cross-relation filtering, named `order_presets`, and unified multi-table `resource.authz_tables` row-level authorization. It requires a server, CLI and MCP build containing commit `ff5874a9`. Stable `1.1.0` reference pages remain unchanged.

> [!NOTE]
> Arbitrary dynamic SQL, custom joins outside declared schema relations, per-relation authorization overrides, and CRUD `response_transform` remain unsupported. All row-level authorization is governed uniformly by the resource's `authz_tables` bindings (plus optional root `authz_type` override).

## Draft-time static `crud_config` validation

`POST /projects/{slug}/endpoints` and `PUT /projects/{slug}/endpoints/{id}/info` now run static `crud_config` validation before saving a draft, returning `400 bad_request` instead of deferring structural authoring errors until publish.

| Rule | Rejected at draft save |
| --- | --- |
| `table` | Empty or whitespace-only table name. |
| List-only options | Non-empty `filters`, non-empty `order_by`, explicit `order_param`, non-empty `order_presets`, explicit `limit`, `pagination`, or `search` on `get_by_pk`, `insert`, `update_by_pk` or `delete_by_pk`. |
| Read-only `relations` | Non-empty `relations` on `insert`, `update_by_pk` or `delete_by_pk`; invalid alias or relation identifiers; relation depth above 3; array relation `limit == 0` or `limit > 200`; alias colliding with root `columns`. |
| `pagination: "page"` | Empty `order_by`, `limit.default == 0`, `limit.max == 0`, `limit.default > limit.max`, or `limit.max` outside signed 64-bit bounds. |
| `filters`, `search.param` and `order_param` | Parameter names that are not valid GraphQL identifiers, invalid dotted `filters.<name>.relation` paths (depth > 3), duplicate or colliding names across `filters` / `search.param` / `order_param`, or collisions with reserved pagination params (`limit`, `offset`, plus `page` and `page_size` in page mode). |
| `order_presets` | Preset names that are not valid identifiers, or presets with an empty `order_by` list. |
| `search.columns` | Empty column list, blank column names or duplicate column entries. |
| `writable` and `defaults` | Overlap between `writable` and `defaults`, or any `defaults` value outside `$identity`, `$principal`, `$user_id`, `$role`, `$authorizer`, `$project_id`, `$now`, and `$claim.<non-empty>`. |

Publishing still performs full schema-aware checks (table existence, mapped columns, primary keys, relation traversal, object vs array relation options, text/varchar search and pattern column types, `<table>_aggregate` collisions, and multi-table `resource.authz_tables` coverage) and re-runs the static validator as defense-in-depth for legacy rows saved by older servers.

## Nested relations, expanded filters and named order presets

Available on builds containing commit `ff5874a9`:

- **Read-only nested `relations`** (`list` and `get_by_pk`): map an output key to `{relation?, columns?, order_by?, limit?, relations?}` (max depth `3`). When `relation` is omitted, the map key names the schema relation; setting `relation` aliases the output field. `Object` relations reject `order_by` and `limit`; `Array` relations support `order_by` and `limit` (default `50`, max `200`).
- **Unified multi-table row-level authorization**: CRUD executes through the same `authz_scope::bind_authz_policy` path as `viat_gql` scripts and `ctx.resources.<db>.graphql(...)`. When the resource binds `authz_tables` (or the endpoint sets `authz_type`), every related table reached by `relations` or cross-relation `filters` must also be bound in `resource.authz_tables` with a `read` action—otherwise publish is refused (`400`), and at runtime every root and nested table enforces its live row scope.
- **Expanded filter operators and cross-relation filters** (`list`): `filters.<name>.op` now adds `in`, `nin`, `is_null`, `contains`, `icontains`, `prefix`, `iprefix`, `suffix`, and `isuffix` alongside `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`. `in`/`nin` accept comma-separated strings (trimming whitespace for non-string scalars), JSON arrays, or a single scalar (max `200` items; `null` items rejected). `is_null` expects a boolean and is the only filter operator permitted on `json`/`jsonb` columns. Optional `filters.<name>.relation` accepts a dotted schema relation path (max depth `3`) to filter on related rows under their live row scopes.
- **Named `order_presets`** (`list`): declare `order_presets: {"<name>": [{"column": "...", "dir": "asc"|"desc"}]}` and optional `order_param` (default `"order_by"`). Omitting the query parameter falls back to static `order_by`; supplying an unknown preset name returns `400 bad_request`.

## OpenAPI 3.1 synthesis and execution budget

`GET /projects/{slug}/openapi.json` (see [HTTP API overview](../api/overview.md)) reflects the published CRUD snapshot contract more accurately:

- **`insert` status code**: emits `"201"` (`Created.`) instead of `"200"`, matching runtime dispatch.
- **Primary-key path parameters**: on `get_by_pk`, `update_by_pk` and `delete_by_pk`, synthesizes `in: "path", required: true` parameters from the frozen `resolved.pk` columns whenever `overrides.path_params` leaves them undeclared. When `overrides.path_params` declares a wire alias (`as`), the alias entry is enriched with the frozen PK schema instead of emitting a duplicate internal column name.
- **Closed-set write bodies**: on `insert` and `update_by_pk`, builds the JSON object request body schema from the frozen `resolved.writable` columns merged with `overrides.body_fields` (respecting `as` aliases and `nullable`) plus `overrides.audit_reason` when configured as `body.<field>`. `additionalProperties` is always `false`, including when `writable` is empty.
- **Expanded list queries and nested relation responses**: synthesizes boolean schemas for `is_null` filters, list descriptions for `in`/`nin` and cross-relation filters, `enum` query parameters for `order_presets`, and recursive response object schemas where `Object` relations emit `["object", "null"]` and `Array` relations emit `array`.
- **Execution budget**: `GET /projects/{slug}/endpoints/{id}` populates `execution_budget` on the `in_process` lane (`always_async: false`) using the project's `default_timeout_secs` or the deployment synchronous script timeout ceiling.

Source-derived OpenAPI fragment for a published `insert` endpoint (`books`, writable `["title"]`):

```json
{
  "requestBody": {
    "required": true,
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      }
    }
  },
  "responses": {
    "201": {
      "description": "Created."
    }
  }
}
```

> [!WARNING]
> OpenAPI still describes the **active published snapshot**, not unsaved or unpublished draft edits. Regenerating client SDKs does not encode live row-level authorization rules, database constraints or `defaults` resolution failures.

## Console CRUD tab alignment

When inspecting a CRUD endpoint in the web console:

- **Contract tab**: displays the closed-set CRUD ingress contract (primary-key path bindings, list query inputs for `filters`, `search` and `limit`/`offset` or `page`/`page_size`, writable body fields plus `audit_reason: body.<field>`, and platform-filled `defaults` including `$now`) instead of showing script-style open body pass-through. See [explicit null defaults](null-default-preview.md) for how `overrides` defaults compose with CRUD arguments.
- **Test tab**: pre-seeds path, query and body editors from `crud_config` and `overrides`, and hides script-only `X-Viat-Async` execution controls.
- **Info, Cache, Auth and History**: Info surfaces `pagination` and `search`; Cache keeps caller-scope GET rules; Auth displays effective row-level authorization (`authz_type`, inherited resource `authz_tables`, or `allow_unscoped_writes`); snapshot history formats CRUD snapshots as `crud=<resource>:<table>.<op>`.

## CLI, repo-sync and MCP projections

- **CLI endpoint inspection** (see [CLI endpoint](../cli/endpoint.md)):
  - `viat endpoint list` displays target summaries for non-script leaves (`crud=<resource>:<table>.<op>`, `workflow=<name>`, `proxy=<name>`, `ws`, `auth=<kind>`) instead of printing `script=-`.
  - `viat endpoint show` text output includes optional `workflow_name`, `proxy_resource_name`, `crud_resource_name`, `crud_config`, `ws_config` and `auth_kind` when present.
  - `viat endpoint history` renders `crud=<resource>:<table>.<op>` using the `crud_resource_name`, `crud_table` and `crud_op` fields now carried on `EndpointSnapshotView`.
- **CLI repo diff**: `viat project diff` normalizes `TargetRef::Crud` default values (`filters.<name>.op: "eq"`, `filters.<name>.skip_empty: false`, omitted/default `limit`) inside rendered unified diffs, avoiding spurious diff noise when local YAML omits defaults.
- **MCP endpoint tools** (see [MCP create_endpoint](../mcp/create_endpoint.md)):
  - `list_endpoints`, `get_endpoint_tree`, `create_endpoint`, `update_endpoint_info`, `update_endpoint_auth` and `move_endpoint` echo optional `proxy_resource_name`, `crud_resource_name` and `crud_config` when present (omitted when absent).
  - `create_endpoint`'s exported schema description for `crud_resource_name` lists `postgresql`, `mysql`, or `sqlite`.

## Verification and upgrade boundaries

Before upgrading an existing project, verify draft saves, OpenAPI output and CLI diffs on an isolated fixture:

1. Confirm malformed `crud_config` payloads (such as `pagination: "page"` with empty `order_by`, or overlapping `writable`/`defaults`) fail at draft save with `400 bad_request`.
2. Publish `list`, `get_by_pk`, `insert`, `update_by_pk` and `delete_by_pk` fixtures and inspect `/projects/{slug}/openapi.json` for `201` on `insert`, PK path parameters and `additionalProperties: false` on write bodies.
3. Run `viat endpoint list`, `viat endpoint show <id>`, `viat endpoint history <id>` and `viat project diff` with a matching CLI binary; older CLIs do not display the new snapshot fields or normalize CRUD defaults in diffs.

Existing legacy rows in the database are not modified automatically; re-save or repair any invalid draft before publishing.

## Verification basis

Contract source `ff5874a9`: `crates/viat-core/src/types/{crud,snapshot}.rs`; `crates/viat-runtime/src/{authz_scope,crud}.rs`; `crates/viat-api/src/{crud_dispatch,openapi,handlers/endpoints,handlers/snapshots,runner/budget}.rs`; `crates/viat-mcp/src/tools/endpoints.rs`; `crates/viat-cli/src/{commands/endpoint,repo/diff}.rs`; `web/src/pages/endpoints/{crudContract.ts,NodeContractTab.tsx,NodeTestTab.tsx,NodeInfoTab.tsx,NodeAuthTab.tsx,NodeCacheTab.tsx,NodePublishTab.tsx,PublishHistoryDrawer.tsx}`.
