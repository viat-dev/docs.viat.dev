---
title: "Paged CRUD lists and fixed-column search (preview)"
description: "Opt-in page pagination, scoped totals, and bounded search configuration without changing legacy CRUD lists."
doc_id: triggers.crud-list-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This unreleased extension builds on [CRUD endpoints](crud.md). Existing list endpoints keep their `limit` / `offset` inputs and array responses unless their published configuration explicitly enables page mode. This is not an automatic migration of script endpoints.

## Configuration

Add these fields to a list endpoint's `crud_config`:

| Field | Default and rules |
| --- | --- |
| `pagination` | Omitted/null keeps the legacy array contract. `"page"` accepts `page` / `page_size` and returns `{items,total}`. Other values are rejected. |
| `search` | Omitted/null disables search. Object with `param`, nonempty unique `columns`, and optional `op` (default `ilike`; only `like` or `ilike`). Columns must be mapped text/varchar columns, not JSON, numeric, enum or temporal columns. Unknown search fields are rejected. |
| `filters.<name>.skip_empty` | Default false. When true, an exact empty-string input omits that filter before coercion. Whitespace is not empty; null is not empty. Existing filters retain their behavior unless explicitly configured. |

All three features are list-only. Search can also be enabled on a legacy array list. Search parameter names must be bare identifiers and cannot collide with filters or reserved parameters. `limit` / `offset` remain reserved; `page` / `page_size` become reserved only in page mode, so existing legacy filters with those names keep working.

Page mode requires nonempty fixed `order_by`. Include a unique tie-breaker, such as every primary-key column, to make page boundaries deterministic; nonempty ordering alone does not guarantee uniqueness. Page mode also requires positive `limit.default`, `limit.default <= limit.max`, and `limit.max` within the signed 64-bit range. The existing `limit` object still defaults to `{default:50,max:200}`; it is not a new hard-coded 200-row ceiling.

A mapped table named `<table>_aggregate` shadows the engine's synthetic aggregate root. Such a collision prevents publishing page mode and is checked again against the live engine schema at execution. It must be resolved through the resource's schema/overlay before enabling this mode.

## Requests and responses

For `pagination: "page"`:

- `page` is a positive integer, default 1.
- `page_size` is a positive integer, default `limit.default`; requested values above `limit.max` are clamped first, then offset is computed from the effective page size.
- Zero, negative, fractional, invalid or out-of-range integer values, and offset multiplication overflow, return `400 bad_request`. This is intentionally not the Python-style `value or default` treatment of zero.
- `limit` and `offset` are not alternative inputs in this mode. Unknown inputs still return 400.
- `items` contains only the selected columns for that page. `total` is the number of matching authorized rows before pagination, not the page length. A page beyond the last row can return empty `items` and nonzero `total`.

Search takes a string. The runtime binds `%<value>%` as one value across the fixed columns with OR, then ANDs that group with the declared filters. Empty search strings are ignored; strings are not trimmed. `like` is case-sensitive and `ilike` is case-insensitive according to the backend's text matching behavior. `%` and `_` retain LIKE wildcard meaning: this is pattern-containing search, not escaped literal substring search. Request values never choose SQL identifiers, operators or expressions.

[HTTP parameter declarations](http.md) still run first: an earlier HTTP coercion can reject an empty string before CRUD's `skip_empty` sees it, and `strict: true` requires every accepted query wire name to be declared. If an `as` alias binds a wire name to a different argument name, configure the CRUD filter/search against that bound name. Review aliases inherited from a script wrapper rather than copying them blindly.

## Example shape

This configuration fragment is illustrative and unexecuted; it requires a resource that already exposes the named table and columns, plus reviewed route and row authorization:

```json
{
  "table": "catalog",
  "op": "list",
  "pagination": "page",
  "columns": ["id", "title", "code"],
  "limit": {"default": 20, "max": 200},
  "order_by": [
    {"column": "updated_at", "dir": "desc"},
    {"column": "id", "dir": "desc"}
  ],
  "search": {
    "param": "q",
    "columns": ["title", "description", "code"],
    "op": "ilike"
  },
  "filters": {
    "category": {"column": "category", "op": "eq", "skip_empty": true}
  }
}
```

After saving and publishing an endpoint with that configuration, a request shaped as `GET /p/demo/catalog?q=sample&page=2&page_size=20` uses the second page and the same search predicate for its total. OpenAPI describes the published mode; a draft edit does not change the public response until republished. The console's CRUD JSON editor and advanced creation configuration preserve these fields. CLI endpoint YAML carries them inside `target.config`; use a matching updated CLI to retain correct diff/push equivalence handling.

## Authorization, cost, and verification boundaries

Both roots—paginated rows and unpaginated aggregate—are in one GraphQL operation executed through the existing scoped engine path. They share the same request filters and resolved row policy; count is not a separate unscoped query. On PostgreSQL the engine emits one SQL SELECT, so the data reads share a statement snapshot. The authorization model is loaded separately; this does not make model edits and business-data reads a cross-database atomic snapshot.

Counting can scan substantially more rows than the returned page. The page ceiling does not cap the count's work; existing execution timeouts still apply. Caller-scoped response caching retains its existing behavior and can return an older complete envelope; a cache hit is not a new live rule evaluation. No automatic write-driven invalidation is added.

Before migration, compare script and CRUD behavior on isolated fixtures: all search columns, case and wildcard behavior, empty/whitespace filters, page bounds, clamping, ties, out-of-range pages, and two identities with different visible rows. Also check live deny rules and frozen-versus-draft configuration. These tests do not prove production performance or compatibility with every external caller. Write authorization, database defaults, unknown-body-field behavior, and arbitrary response transforms remain separate migration questions; this extension does not relax them.
