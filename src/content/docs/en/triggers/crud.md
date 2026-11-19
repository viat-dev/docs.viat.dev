---
title: "CRUD endpoints"
description: "Expose a database table with a frozen REST contract and live authorization scope."
doc_id: triggers.crud
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# CRUD endpoints

CRUD is a **native endpoint target**: without writing a script, it exposes a
database table's create/read/update/delete as controlled REST routes. It is
not a generated script and not a generic database browser.

Four things to internalize:

- **`postgresql`, `mysql` and `sqlite` resources**, using post-overlay
  table/column names (`sqlite` suits single-node or replicated read-only files,
  not multi-node shared writes).
- Each leaf performs exactly one operation, under ordinary endpoint
  authorizers, gates, rate limits and logging.
- Permissions are two-layer: create/edit needs content-edit rights and
  publish needs publish rights; **callers must satisfy both the published
  route access and the row-level authorization**.
- Prerequisites: a refreshed resource schema mapping, the table's existence,
  a primary key for key operations, and a deliberate row-scope policy for
  writes.

## Create and call

Source-derived, unexecuted example: an isolated database has
`books(id,title)`, the project resource is `db`, and the public authorizer is
actually named `public`:

```http
POST /projects/demo/endpoints
Content-Type: application/json
Authorization: Bearer <console-token>

{"segment":"books","method":"GET","crud_resource_name":"db","crud_config":{"table":"books","op":"list","columns":["id","title"],"filters":{"title":{"column":"title","op":"ilike"}},"order_by":[{"column":"id","dir":"asc"}],"limit":{"default":50,"max":200}},"allowed_authorizers":["public"]}
```

`GET …/endpoints/<id>` returns the ordinary endpoint view containing
`crud_resource_name:"db"`, the submitted `crud_config`, `method:"GET"`,
`path:"/books"`, `script_name:null`/`workflow_name:null`, and initially no
published snapshot. Flow: `POST …/endpoints/<id>/publish {}` → call
`/p/demo/books?title=%25guide%25&limit=20&offset=0`. Data comes from the
real table — **an empty list is not an authorization error**. Full endpoint
view and shared fields: [HTTP](http.md).

| Operation | Method | Path requirement | Result |
| --- | --- | --- | --- |
| `list` | GET | collection | 200 array of rows with the chosen columns. |
| `get_by_pk` | GET | one `:column` per primary-key column | 200 single row or 404. |
| `insert` | POST | collection | 201 inserted row, chosen columns. |
| `update_by_pk` | PATCH or PUT | all primary-key columns | 200 updated row or 404. |
| `delete_by_pk` | DELETE | all primary-key columns | 200 deleted row or 404. |

A successful list body looks like `[{"id":1,"title":"A guide"}]`;
get/update/delete return a single row object, not a one-element array.
Primary-key types are frozen from the schema and coerced at dispatch. Build
`/books/:id` with tree branches or `path_override`; composite keys need every
key column named, and key operations cannot publish for keyless tables.

## The full `crud_config`

Unknown top-level config fields are rejected. `table` and `op` are required;
the rest default as follows.

| Field | Default and rules |
| --- | --- |
| `columns` | `[]` = every mapped column; otherwise a response allowlist. **Note: newly mapped sensitive columns can become exposed by default later.** |
| `filters` | `{}`; list only. Query name → `{column,op:"eq"}`; supports `eq,neq,gt,gte,lt,lte,like,ilike`; scalars only, no `in` or null operators; unknown queries are **rejected**, not ignored. |
| `order_by` | `[]`; list only. A fixed `{column,dir:"asc"\|"desc"}` array; callers never choose ordering; without a fixed order, pagination is unstable. |
| `limit` | Omitted/null uses `{default:50,max:200}`; caller limits clamp to max; `offset` paginates; there is no "unlimited" form. |
| `writable` | `[]` = all mapped non-key columns; an explicit list narrows writes; unknown or non-writable body columns are rejected. Omitted fields are **not** auto-nulled; SQL nulls must still satisfy table constraints/schema. |
| `defaults` | `{}`; platform-filled columns → `$identity`, `$principal`, `$user_id`, `$role`, `$authorizer`, `$project_id`, `$claim.<name>`, `$now` (RFC 3339 UTC timestamp); must not overlap `writable` and callers cannot submit them; unresolvable values are rejected and **null is never written**. |
| `authz_type` | Omitted/null inherits the resource's table binding; an explicit type maps list/get to `read` and insert to `create`, plus `update` and `delete`, whose actions must exist; inherited authz_tables can remap actions. **Without an allow rule, rows are neither visible nor writable.** |
| `allow_unscoped_writes` | Default false; mutating operations need an authz_type or resource authz_tables binding or publishing refuses; true is a deliberate whole-table escape hatch, **not** automatic authorization. |

`PUT …/endpoints/<id>/info {"crud_config":{…}}` replaces the config wholesale
(omitted/null keeps rather than clears); replacement never changes the target
resource kind. Publishing validates method/operation and
table/column/filter/order/key compatibility, then freezes the resolved types.
**Resource credentials, authorization bindings and rules stay live** —
rotating credentials or changing scope affects calls without republishing;
scope is re-checked at runtime, and removing a scope never silently opens
unscoped writes. Underlying schema drift can surface as engine errors:
refresh the schema, re-review the contract and republish — historical
snapshots are never modified.

## Limits, recovery and cleanup

- body/query binds through the HTTP contract first, then CRUD parameter
  restrictions apply; resource credentials and audit-reason policy are
  platform-imposed.
- CRUD executes synchronously: no script hooks, arbitrary joins, multipart,
  workflow targets, arbitrary SQL or async.
- GET supports **caller-scope** caching only; writes do not auto-invalidate.
  Authenticated mutations get dispatch idempotency protection, but inserts
  still need business/database unique keys.

Verify on an isolated fixture: unknown filters, wrong keys, missing rows, two
tenants, denied writes. **A 404 can deliberately hide an unauthorized row —
never retry it as a transient error.** For engine/schema errors, check
resource health, schema and logs. A change may have committed before a
timeout/lost response — query by business key before retrying. Cleanup order:
unpublish to stop new calls → drain in-flight writes → delete the isolated
endpoint and test tables; **deleting the endpoint undoes no historical
writes**.

Repository side: endpoint YAML uses `target:{kind:crud,ref:db,config:{…}}`
synced by `viat pull/push`; commands live in [CLI endpoint](../cli/endpoint.md)
— there is no standalone `viat crud` command.

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/crud.rs`;
`crates/viat-api/src/handlers/endpoints.rs`, `handlers/snapshots.rs`,
`crud_dispatch.rs`; the runtime CRUD dispatch and tests. Examples are
source-derived and unexecuted; no database or provider service was touched.
