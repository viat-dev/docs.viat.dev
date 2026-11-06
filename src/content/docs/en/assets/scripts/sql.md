---
title: 'SQL scripts'
description: 'Database dialects, typed named parameters and rows/affected output.'
doc_id: script.sql
verified_release: '1.1.0'
channel: stable
---

# SQL scripts

Use language `sql`. Declare exactly one `postgresql`, `mysql`, `sqlserver` or `sqlite` resource. The resource chooses the dialect; there is no separate mysql script language. The platform executes SQL directly with its database client; no Python/Bun interpreter or `ctx` exists here. The account must be allowed to author/run in the project, and the resource's database account must have the SQL privileges required. Parameter binding is not authorization or read-only enforcement.

## Complete minimal script

With an existing isolated PostgreSQL resource named `db`, save `scripts/sql_echo.sql`:

```sql
-- @resource db
-- @input value:int
SELECT :value AS value;
```

```bash
viat script create --name sql_echo --language sql --file scripts/sql_echo.sql
viat script run sql_echo --args '{"value":7}'
viat script update sql_echo --file scripts/sql_echo.sql
```

Expected result body: `{"rows":[{"value":7}],"affected":1}`. This read-only example creates no table. Resource creation takes `viat resource create --file resources/db.yaml`, not `--config`; the resource reference owns that file's credential/config shape. Do not put real credentials in the script or its logs. Public binding/publishing is shown in [Testing](testing.md).

## Parameters and result types

Write `:name` in every dialect. The binder rewrites to PostgreSQL `$N`, MySQL `?`, SQL Server `@PN`, SQLite `?N` and sends values separately; never concatenate user values. String literals, dollar-quoted bodies and `::casts` are not runtime parameters. Static schema extraction is simpler and can misread unusual SQL; inspect warnings. `-- @input name:type[=default]` declares types, otherwise placeholders become required string inputs with warning. Annotation defaults remain **strings**, not a promise to supply missing parameters. See [all type names](annotations.md).

All dialects return `{rows,affected}`. Numeric/decimal columns generally become strings to preserve exactness. PostgreSQL UUID/time become strings, bytea base64, interval `{months,days,microseconds}`, arrays element-wise; unsupported column types can become null with a warning (cast to text to choose representation). MySQL TINYINT(1) is boolean. SQL Server bit is boolean, uniqueidentifier string and binary base64; unsupported spatial/sql_variant may fail rather than becoming null. SQLite's flexible storage classes make explicit casts useful. SQL Server uses SQL authentication, not Windows/AD.

## Statements, transactions and failures

Parameterized PostgreSQL scripts are one prepared statement. A **parameterless** PostgreSQL script can fall back to simple-query mode for multiple statements and executes them in one transaction; failure rolls them back. Returned text-protocol values do not decode every type (e.g. interval), so prefer one statement for result-bearing queries. Other engines and broker query helpers are one statement per call; do not extrapolate this PostgreSQL exception. Persistent schema migrations should use migration tooling rather than repeatedly executing DDL as an endpoint.

`-- timeout: N` chooses an execution budget subject to deployment clamps; database/network errors and timeout fail the run. There is no `ViatError`, no task API, and no per-row streaming. Cancellation is not a guarantee that an already-sent write is undone. Do not retry writes blindly; workflow retries classify runtime errors, not arbitrary SQL error text. Use explicit transactions through a general-language broker helper when several application operations must be atomic.

Check results on the isolated resource, inspect logs/warnings, then remove any disposable endpoint before deleting `sql_echo`. There is no database cleanup for this SELECT-only example. A successful save does not prove the database is reachable.
