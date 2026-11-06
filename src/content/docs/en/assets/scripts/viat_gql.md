---
title: 'viat_gql scripts'
description: 'GraphQL over PostgreSQL, MySQL and SQLite with scope enforcement.'
doc_id: script.viat_gql
verified_release: '1.1.0'
channel: stable
---

# viat_gql scripts

Language `viat_gql` executes a GraphQL document directly against a database through Viat's engine. Declare exactly one `postgresql`, `mysql` or `sqlite` resource. **SQL Server is not supported** by this language (it is supported by [SQL](sql.md)). It is not a proxy to a GraphQL resource and has no `main` or `ctx`.

## Complete minimal query

Prerequisite: an isolated PostgreSQL resource `db`, a table `doc_items(id integer primary key, name text not null)`, and one row `(7,'fixture')`. Create that fixture only in a disposable database, using the resource query tooling or your migration process. The resource's GraphQL exposure/overlay and scope rules must admit this table and caller.

Save `scripts/gql_item.graphql`:

```graphql
# @resource db
query Item($id: Int!) {
  doc_items(where: {id: {_eq: $id}}, limit: 1) {
    id
    name
  }
}
```

```bash
viat script create --name gql_item --language viat_gql --file scripts/gql_item.graphql
viat script run gql_item --args '{"id":7}'
viat script update gql_item --file scripts/gql_item.graphql
```

Expected body `{"doc_items":[{"id":7,"name":"fixture"}]}` when this caller can see the row. Empty visibility can yield an empty list; unauthorized operations can be refused. This is a prerequisite-based runnable example, not a claim that every resource has `doc_items`. No fixture is created or queried here. Requires project editing/run access and appropriate database/scope rights.

## Document grammar and schema

Tables become query fields and foreign keys become relations. Use GraphQL selection sets, variable declarations and typed values, not SQL text. Common list arguments include `where`, `order_by`, `limit`, `offset`; predicates use operators such as `_eq`, `_in`, `_and`, `_or` according to the generated schema. Relations, aggregate fields, mutations, distinct/paging and dialect-specific scalar behavior depend on the introspected schema and resource overlay. They are not arbitrary SQL passthrough. For a small bounded endpoint, select only needed columns and set an explicit limit/order.

Variables come from request arguments; the result is `data`, not a GraphQL data/errors envelope. Database schema is introspected and cached. After DDL, refresh it:

```bash
viat resource refresh db
```

This is different from **script I/O schema extraction**, which is currently **unsupported** for viat_gql. Saving produces open schemas and a warning even though the database engine has a typed GraphQL schema. Do not advertise extracted endpoint parameter validation for this language. Check actual query/variable errors against an isolated resource.

## Bounded shape variables: `@choices` and `@optional`

These are **GraphQL variable-definition directives**, not comment headers and not general-purpose template directives. With neither, variables can fill value positions (`_eq`, `_in`, `_is_null`, limit/offset), but cannot freely change compiled SQL shape such as `order_by: $sort`.

- `@choices(values: [...])` declares finite allowed JSON/GraphQL values. The engine compiles one shape per choice; a request outside the list is a 400 variable error. Multiple choices multiply, capped at 256 compiled shapes. There is no implicit choice list or automatic sorting whitelist.
- `@optional` takes no arguments and requires a nullable variable used as the **whole comparison operand** in a conjunction (implicit AND or `_and`). Explicit null drops that comparison. Missing is still an error unless the document provides a default such as `= null`. It is refused under `_or`/`_not`, where dropping a predicate would change authorization/filter meaning. It works with `_is_null`: true selects null rows, false non-null rows, null drops the test.
- The two can compose: choices bound non-null values while optional adds the dropped-null shape. Do not also list null among choices when optional already uses null to drop the filter. Arbitrary custom directives are not supported by implication.

With the existing doc_items fixture, this complete alternative document accepts `sort: [{id: "asc"}]` or `[{id: "desc"}]`, and requires name (possibly explicit null):

```graphql
# @resource db
query ($sort: [doc_items_order_by!]! @choices(values: [[{id: asc}], [{id: desc}]]), $name: String @optional) {
  doc_items(where: {name: {_eq: $name}}, order_by: $sort, limit: 20) { id name }
}
```

Input `{"sort":[{"id":"asc"}],"name":null}` returns the fixture row without a name comparison; `name: "other"` returns an empty list. Comparing `_eq: null` directly is not a substitute—use `_is_null` or optional as appropriate. Schema extraction remains unsupported even for these annotated variables.

## Writes and refusals

The generated schema can expose insert/update/delete with returning; viat_gql is **not inherently read-only**. Read-only views/tables and resource overlays can refuse writes, and scope rules apply to written rows. On the isolated fixture only, a permitted update has this body:

```graphql
# @resource db
mutation ($name: String!) {
  update_doc_items(where: {id: {_eq: 7}}, _set: {name: $name}) {
    returning { id name }
  }
}
```

With `{"name":"changed"}`, the returning row has id 7 and name changed; this is a real mutation if executed. Restore only your fixture row explicitly afterward. A missing declared variable is a caller error; malformed documents/unknown fields/depth violations are script errors; scope-violating writes can be 403. Do not interpret every empty list as an authorization failure, and do not expose internal database diagnostics to the caller.

## Authorization and dialect boundaries

Resource GraphQL scope policy and authz table bindings execute under the caller principal, not a bypassing service identity. Missing principal fields are omitted rather than invented as null values; a policy requiring an unavailable field can deny/fail. Row scope applies to relations and mutations too; declaring the resource is not a grant to expose every table. Database authentication remains platform-side when using the engine/broker, not copied into query text.

PostgreSQL/MySQL/SQLite do not have identical scalar/operator capabilities: do not copy PostgreSQL jsonb/timetz behavior to MySQL or SQLite. SQL Server and remote GraphQL resources are rejected. Engine schema validation, unsupported constructs, invalid ordering, excessive result/depth limits, scope violations and database errors fail with classified errors; timeout uses the run budget. No task API, subscriptions or incremental row stream is available here.

Test a permitted caller and a denied caller separately before publishing. Re-query after schema refresh to catch stale introspection. For cleanup, unpublish/delete the disposable endpoint and script; remove only the fixture row/table that you explicitly created, never a shared table. [Testing](testing.md) explains draft versus published execution; [resources](../resources/index.md) owns database configuration, overlays and scope options.
