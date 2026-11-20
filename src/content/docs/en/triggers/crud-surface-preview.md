---
title: "CRUD surface and contract alignment (preview)"
description: "Draft-time static crud_config validation, OpenAPI 3.1 synthesis, execution budgets, and Console/CLI/MCP parity for CRUD endpoints."
doc_id: triggers.crud-surface-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

# CRUD surface and contract alignment (preview)

This follow-up to [CRUD endpoints](crud.md) and [paged CRUD lists](crud-list-preview.md) aligns CRUD behavior across the management API, OpenAPI export, Console tabs, CLI and MCP projections, and extends CRUD queries with read-only nested `relations`, expanded filter operators, cross-relation filtering, named `order_presets`, unified multi-table `resource.authz_tables` row-level authorization, database constraint 4xx error mapping, server-side `fixed_filters`, offline `viat endpoint test` support for CRUD/`viat_gql`, and zero-downtime draft target rebinding. It ships in server, CLI and MCP releases `1.5.0` (`ceda3d8a`) and `1.6.0` (`a193744f`). Stable `1.1.0` reference pages remain unchanged.

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
| `fixed_filters` | Non-empty `fixed_filters` on `insert`, `update_by_pk` or `delete_by_pk`; blank column names, invalid dotted `relation` paths (depth > 3), non-boolean value for `is_null`, non-array/empty/over-200/`null`-containing list for `in`/`nin`, or non-string value for text pattern operators. |
| `writable` and `defaults` | Overlap between `writable` and `defaults`, or any `defaults` value outside `$identity`, `$principal`, `$user_id`, `$role`, `$authorizer`, `$project_id`, `$now`, and `$claim.<non-empty>`. |

Publishing still performs full schema-aware checks (table existence, mapped columns, primary keys, relation traversal, object vs array relation options, text/varchar search and pattern column types, column-typed literal validation for `fixed_filters`, `<table>_aggregate` collisions, and multi-table `resource.authz_tables` coverage) and re-runs the static validator as defense-in-depth for legacy rows saved by older servers.

## `1.6.0` additions: constraint 4xx mapping, `fixed_filters`, offline `testdb`, and draft rebind

Available starting in `1.6.0` (`a193744f`, syncing `viat-gql 1.0.2`):

- **Database integrity constraint errors mapped to 4xx**: CRUD and `viat_gql` writes that trip database constraints no longer return raw `500` responses. Errors are classified uniformly across PostgreSQL, MySQL, and SQLite via `sqlx::error::ErrorKind` into redacted client errors while logging the full database error:
  - `UniqueViolation`, `ExclusionViolation`, and `ForeignKeyViolation` → `409 conflict`
  - `NotNullViolation` and `CheckViolation` → `400 bad_request`
- **Server-side static `fixed_filters`** (`list` and `get_by_pk`): array of `{"column": "...", "op"?: "eq", "value": ..., "relation"?: "..."}` rules that take no caller input and cannot be overridden by query parameters (e.g. soft-delete `deleted_at is_null: true` or fixed `status` slices). Publishing validates and normalizes literals against actual column types (including `float4` range checks, arbitrary-precision `numeric` literal checks, and cross-relation `authz_tables` coverage); runtime injects them as independent `$ff_N` variables ANDed into list queries, aggregate count queries, and `get_by_pk` lookups (rows excluded by `fixed_filters` return `404`).
- **Offline `testdb` support in `viat endpoint test`** (see [endpoint contract tests](../testing/endpoint-tests.md)):
  - `viat-endpoint-test-host` pre-scans fixture `resources.<name>.testdb` declarations before seeding so publish-time CRUD schema introspection runs against `testdb` while preserving the resource's `graphql_overlay` and `authz_tables`.
  - The offline host's `PoolRegistry` fails closed for unmapped resources and non-`ViatGql` pools, ensuring offline tests never dial production hosts.
  - CLI scratch seeding substitutes synthetic placeholders for `$secret`/`$keep` and strips `plain.audit` so audited production Postgres resources still seed cleanly; CRUD and `viat_gql` writes execute inside per-fixture `SAVEPOINT`-backed rollback transactions, and `viat_gql` scripts evaluate row scopes against the scratch project's seeded `authz` model just like CRUD.
- **Zero-downtime draft target rebinding**: `PUT /projects/{slug}/endpoints/{id}/info` adds tri-state `crud_resource_name` (omitted = unchanged, `null` = explicitly clear CRUD binding, string = bind/switch CRUD resource), letting operators convert `script`/`workflow` ↔ `crud` or switch a CRUD resource in draft while leaving `published_snapshot_id` live until `publish apply` (and preserving snapshot rollback; `proxy`, `auth`, and `websocket` endpoints still reject rebinding).
  - **CLI sync**: `viat push` still refuses silent target-kind or CRUD resource changes by default; pass `--allow-rebind` to perform the draft rebind in a single `PUT /info` (see [CLI sync](../cli/sync.md)).
  - **CLI endpoint management**: `viat endpoint update-info` adds `--workflow`, `--clear-workflow`, `--crud-resource`, `--clear-crud`, and `--crud-config` (see [CLI endpoint](../cli/endpoint.md)).
  - **MCP tool**: `update_endpoint_info` adds `crud_resource_name` and `clear_crud_binding` for draft rebinding over MCP (see [MCP update_endpoint_info](../mcp/update_endpoint_info.md)).
- **`viat-gql 1.0.2` sync**: pulls in the NULL post-write scope-guard fix, MySQL scoped upsert `Unsupported` refusal, MySQL `DELETE FOR UPDATE` locking fix, and parser/validator hardening and performance improvements.

## Nested relations, expanded filters and named order presets

Available starting in `1.5.0` (`ceda3d8a`):

- **Read-only nested `relations`** (`list` and `get_by_pk`): map an output key to `{relation?, columns?, order_by?, limit?, relations?}` (max depth `3`). When `relation` is omitted, the map key names the schema relation; setting `relation` aliases the output field. `Object` relations reject `order_by` and `limit`; `Array` relations support `order_by` and `limit` (default `50`, max `200`).
- **Unified multi-table row-level authorization**: CRUD executes through the same `authz_scope::bind_authz_policy` path as `viat_gql` scripts and `ctx.resources.<db>.graphql(...)`. When the resource binds `authz_tables` (or the endpoint sets `authz_type`), every related table reached by `relations` or cross-relation `filters` must also be bound in `resource.authz_tables` with a `read` action—otherwise publish is refused (`400`), and at runtime every root and nested table enforces its live row scope (removing a related table from `authz_tables` post-publish fails closed).
- **Expanded filter operators and cross-relation filters** (`list`): `filters.<name>.op` now adds `in`, `nin`, `is_null`, `contains`, `icontains`, `prefix`, `iprefix`, `suffix`, and `isuffix` alongside `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`. `in`/`nin` accept comma-separated strings (trimming whitespace for non-string scalars), JSON arrays, or a single scalar (max `200` items; `null` items and empty lists `""`/`[]` are rejected unless `skip_empty: true`, which skips both `""` and `[]`). `is_null` expects a boolean and is the only filter operator permitted on `json`/`jsonb` columns. Optional `filters.<name>.relation` accepts a dotted schema relation path (max depth `3`) to filter on related rows under their live row scopes.
- **Named `order_presets`** (`list`): declare `order_presets: {"<name>": [{"column": "...", "dir": "asc"|"desc"}]}` and optional `order_param` (default `"order_by"`). Omitting the query parameter falls back to static `order_by`; supplying an unknown preset name returns `400 bad_request`. Under `overrides.strict: true`, publishing warns when any filter, `search.param`, or `order_param` lacks a `query_params` declaration, and also warns when a non-string `query_params` declaration binds a `skip_empty: true` filter.

## OpenAPI 3.1 synthesis and execution budget

`GET /projects/{slug}/openapi.json` (see [HTTP API overview](../api/overview.md)) reflects the published CRUD snapshot contract more accurately:

- **`insert` status code**: emits `"201"` (`Created.`) instead of `"200"`, matching runtime dispatch.
- **Path parameters**: on `get_by_pk`, `update_by_pk` and `delete_by_pk`, synthesizes `in: "path", required: true` parameters from the frozen `resolved.pk` columns whenever `overrides.path_params` leaves them undeclared (enriching `as` aliases without emitting a duplicate internal column name). For CRUD `list` and `insert` routes mounted under parameterized paths (such as `/orgs/:org_id/orders`), synthesizes required `in: "path"` parameters for undeclared `:seg` segments and omits them from `in: "query"`.
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

Contract source `a193744f` (`1.6.0`, building on `1.5.0` `ceda3d8a`): `Cargo.toml` (`viat-gql 1.0.2`); `crates/viat-core/src/types/{crud,snapshot}.rs`; `crates/viat-db/src/endpoints.rs`; `crates/viat-runtime/src/{authz_scope,crud,resource_io,resource_pool,testing,viat_gql_runtime}.rs`; `crates/viat-api/src/{crud_dispatch,dto,endpoint_test,openapi,bin/viat-endpoint-test-host,handlers/dispatch,handlers/endpoints,handlers/snapshots,runner/broker,runner/budget,runner/mod}.rs`; `crates/viat-mcp/src/tools/{endpoints,service}.rs`; `crates/viat-cli/src/{main,commands/endpoint,commands/endpoint_test,commands/sync,repo/diff,repo/endpoints,repo/resources}.rs`; `web/src/api/{endpoints.ts,generated/CrudConfig.ts,generated/CrudFixedFilter.ts}`; `web/src/pages/endpoints/{crudContract.ts,NodeContractTab.tsx,NodeTestTab.tsx,NodeInfoTab.tsx,NodeAuthTab.tsx,NodeCacheTab.tsx,NodePublishTab.tsx,PublishHistoryDrawer.tsx}`.
