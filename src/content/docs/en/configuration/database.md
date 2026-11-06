---
title: Database configuration
description: Platform and resource database connections, permissions, migration budgets and TLS limitations.
doc_id: configuration.database
verified_release: '1.1.0'
channel: stable
---

# Database configuration

The platform metadata store **must be PostgreSQL**. SQLite, MySQL and cache resources cannot replace it. It holds accounts, projects, drafts, published snapshots, secret ciphertext/external references, run state and control-plane audit. Business database resources have separate credentials and pools.

## Variables

| Variable | Type; binary default | Range, scope and behavior |
| --- | --- | --- |
| `DATABASE_URL` | string; **required / 必填** | S. PostgreSQL connection URI. No application fallback; missing value prevents startup. Empty/malformed/unreachable URI fails connection. URL-encode special password characters; use PostgreSQL URI TLS parameters as supported by sqlx. No project override. |
| `VIAT_DB_MIGRATION_TIMEOUT_SECS` | u64; `600` s | D. Positive seconds; zero/invalid → 600. Budget for resource migration requests, not startup platform migrations. A request cannot raise it. |
| `VIAT_GRAPHQL_MAX_RELATION_DEPTH` | usize; `8` levels / 层 | D (engine creation). 0 disables this ceiling. Resource/GraphQL author cannot raise deployment ceiling; validate deep queries before increasing it. |
| `VIAT_GRAPHQL_MAX_TABLE_READS` | usize; `64` reads / 次 | D (engine creation). 0 disables this ceiling. Bounds table reads within an execution, not the server PostgreSQL pool. |
| `VIAT_SQLITE_ROOTS` | string; unset / 未设置 | D. Colon-separated absolute allowlisted directories; unset means no SQLite resource path is allowed. Mount paths inside the server filesystem; resource path must pass canonical-path checks. |

## Connection, permissions and migrations

```dotenv
DATABASE_URL=postgres://viat:REPLACE_WITH_URL_ENCODED_PASSWORD@postgres:5432/viat
VIAT_DB_MIGRATION_TIMEOUT_SECS=600
```

This configuration example is unexecuted. The database must already exist. The startup database role needs login and permission to apply the release's bundled DDL migrations; normal operation needs platform-table reads/writes, sequences and database notifications. A read-only business-database role is not sufficient. Do not permanently grant superuser merely to debug permissions; determine migration requirements in an isolated copy.

The platform database pool is fixed at **10 connections/process**; there is no supported `VIAT_DB_POOL_SIZE` environment variable. Notification and other tasks can require additional database connections; reserve room for administration, backups and other clients. Resource pools count separately: cached PostgreSQL/MySQL resource pools commonly allow **8 connections/resource/process**. More instances multiply the connection budget, not the shared database's capacity.

Bundled migrations run before the HTTP listener. `VIAT_DB_MIGRATION_TIMEOUT_SECS` bounds business-resource migrations through `viat db`, not platform startup migrations. On `db connect`, `db migrate` or checksum errors, stop restart loops, preserve logs and backups; do not edit applied migration records or remove checksums.

## Actual TLS limitations

The platform `DATABASE_URL` uses sqlx's URI connection support; configure certificate verification according to PostgreSQL driver capabilities and validate trust/hostname from the deployed environment. **The business `postgresql` resource's `ssl` boolean is currently ignored by its connection construction path**; it is not proof that TLS is enabled or verified. Business `mysql` resource `ssl=true` maps to **Preferred**, which permits fallback—not Require/VerifyIdentity. TLS settings on the platform URI do not change these resource behaviors.

Where encrypted, identity-verified transport is mandatory, enforce it at the database, a validated network tunnel/proxy, or another external boundary and actually verify the connection. A successful resource save is not compliance evidence. Do not fix trust errors by globally disabling verification.

## Operational checks and recovery

- New installation: establish correct address, container DNS/network, port, database and role before starting the application. `localhost` inside a container is that container.
- `PoolTimedOut`: distinguish unavailable PostgreSQL, exhausted connection quota, long transactions/locks and load. Check `/readyz` and database connection/lock views before increasing concurrency.
- Business migration timeout: identify the target database, ledger, lock and SQL. Disconnection does not prove every statement rolled back; inspect state before retrying.
- Rollback after migration: follow [upgrades](../operations/upgrades.md) and [backup/restore](../operations/backup-restore.md). There is no general automatic downgrade-migration guarantee.

SQLite files including WAL/SHM, external databases and their audit tables are not part of a platform-database backup; see [storage](storage.md).
