---
title: "PostgreSQL CRUD endpoints"
description: "Expose a table with a frozen REST contract and live authorization scope."
doc_id: triggers.crud
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# PostgreSQL CRUD endpoints

CRUD is a native endpoint target, not a generated script or a generic database browser. It supports **postgresql resources only** and exposed, post-overlay table/column names. Each leaf performs one operation, under ordinary endpoint authorizers, gates, rate limits and logging. Create/edit requires content-edit rights; publish requires publish rights; callers need published route access and the applicable row authorization. Prerequisites: a PostgreSQL resource with a refreshed mapped schema, a table, primary key for key operations, and a deliberate row-scope policy for writes.

## Create and call

Source-derived, unexecuted example for an isolated database with `books(id,title)`, a project resource `db`, script-free endpoint and a real project authorizer called `public`:

```http
POST /projects/demo/endpoints
Content-Type: application/json
Authorization: Bearer <console-token>

{"segment":"books","method":"GET","crud_resource_name":"db","crud_config":{"table":"books","op":"list","columns":["id","title"],"filters":{"title":{"column":"title","op":"ilike"}},"order_by":[{"column":"id","dir":"asc"}],"limit":{"default":50,"max":200}},"allowed_authorizers":["public"]}
```

Read back `GET …/endpoints/<id>`: the normal endpoint view includes `crud_resource_name:"db"`, `crud_config` containing the submitted object, `method:"GET"`, `path:"/books"`, `script_name:null`, `workflow_name:null`, and no published snapshot yet. Publish with `POST …/endpoints/<id>/publish {}` before calling `/p/demo/books?title=%25guide%25&limit=20&offset=0`. Response data comes from the real table; an empty list is not an authorization error. See [HTTP](http.md) for the complete endpoint view and shared fields.

| Operation | Method | Required path | Result |
| --- | --- | --- | --- |
| `list` | GET | Collection | Array of selected rows. |
| `get_by_pk` | GET | Every primary-key column as a same-named `:column` parameter | Row, or 404. |
| `insert` | POST | Collection | Inserted selected row. |
| `update_by_pk` | PATCH | Every primary-key column | Updated row, or 404. |
| `delete_by_pk` | DELETE | Every primary-key column | Deleted row, or 404. |

For example a successful list body is `[{"id":1,"title":"A guide"}]`; a get/update/delete result is the single selected row, not that one-element array. Key types are frozen from schema and coerced at dispatch. Use `path_override`/tree branches for `/books/:id`; composite keys require all key names. No key means key operations cannot publish.

## Complete `crud_config`

Unknown top-level config keys are rejected. `table` and `op` are required; remaining fields default as follows:

| Field | Default and rules |
| --- | --- |
| `columns` | `[]`: all mapped columns; otherwise response allowlist. Avoid accidentally exposing newly mapped sensitive columns. |
| `filters` | `{}`; list-only query-name → `{column,op:"eq"}`. Operators `eq,neq,gt,gte,lt,lte,like,ilike`; scalar values only, no `in` or null operator. Unknown query parameters are rejected rather than ignored. |
| `order_by` | `[]`; list-only fixed array `{column,dir:"asc"|"desc"}`. No caller-selected sort. Without a fixed order, pagination is not stable. |
| `limit` | Omitted/null uses `{default:50,max:200}`. Caller `limit` is clamped to max; `offset` is pagination offset. No unlimited spelling. |
| `writable` | `[]`: all mapped non-PK columns for insert/update; explicit list narrows it. Unknown/non-writable body columns are refused, not ignored. Omitted fields are not automatically set to null; SQL null must satisfy the column/schema. |
| `defaults` | `{}`; server-filled column → `$identity`, `$principal`, `$user_id`, `$role`, `$authorizer`, `$project_id`, `$claim.<name>`. Cannot overlap `writable`; callers cannot provide these columns. Unresolvable values refuse the write rather than inserting null. |
| `authz_type` | Omitted/null inherits the resource's table binding. Explicit type uses `read` for list/get, `create` for insert, `update` and `delete`. Its action must exist. Inherited `authz_tables` bindings may remap actions. No granting rule means no visible/writable rows. |
| `allow_unscoped_writes` | `false`; mutations need explicit `authz_type` or the resource's `authz_tables` binding, otherwise publish is refused. `true` is a deliberate full-table escape hatch, not automatic authorization. |

Save `PUT …/endpoints/<id>/info {"crud_config":{…}}` replaces the whole config; omission/null keeps it, not clears it. Resource target kind is not changed by replacing config. Publish validates operation/method, table/column/filter/order/PK compatibility and freezes resolved column types. Resource credentials, authorization bindings and rule model remain live: scope edits/rotation can affect existing snapshots. The runtime rechecks scope so removing a resource scope is not an implicit unscoped-write permission. Underlying schema drift may cause engine errors; refresh schema, review contract and republish rather than changing a frozen snapshot.

## Limits, recovery and cleanup

Body and query binding use the HTTP dispatch contract; generated CRUD validation then restricts accepted arguments. Mutations use platform-managed credentials and auditing/reason policy. CRUD is synchronous: no script hooks, arbitrary joins, multipart upload, workflow target or arbitrary SQL, and no async execution. GET cache is supported **per caller only**; writes do not automatically purge cached reads. Authenticated mutations support dispatch idempotency, but still use a database/business uniqueness key against duplicate inserts.

Verify with isolated fixtures covering unknown filters, wrong key types, missing rows, two tenants and rejected writes. A 404 can intentionally conceal an out-of-scope row; do not retry it as a transient failure. An engine/schema error requires checking resource health/schema and logs. Timeout or lost response may follow a committed mutation: inspect by business key before retrying. Disable callers by unpublishing, drain/account for in-flight writes, then delete the isolated endpoint and test table. Deleting an endpoint does not undo rows already written.

Repo entry is an endpoint YAML with `target:{kind:crud,ref:db,config:{…}}`, mirrored by `viat pull/push`; use [CLI endpoint](../cli/endpoint.md) for available commands. There is no separate invented `viat crud` command.

Maintenance evidence: `crates/viat-core/src/types/crud.rs`; `crates/viat-api/src/handlers/endpoints.rs`, `handlers/snapshots.rs`, `crud_dispatch.rs`; runtime CRUD dispatch and its tests. Examples are source-derived/unexecuted; no database/provider operation was performed.
