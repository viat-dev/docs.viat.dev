---
title: Database configuration
description: Platform and resource database connections, permissions, migration budgets and TLS limitations.
doc_id: configuration.database
verified_release: '1.1.0'
channel: stable
---

# Database configuration

The platform metadata store **must be PostgreSQL** — SQLite, MySQL and cache
resources cannot replace it. It holds accounts, projects, drafts, published
snapshots, secret ciphertext (or external secret references), run state and
control-plane audit. Business database resources are **separate credentials
and separate pools**; never conflate the two.

## Variables

| Variable | Type; binary default | Range, scope and behavior |
| --- | --- | --- |
| `DATABASE_URL` | string; **required** | S. Platform PostgreSQL connection URI. No fallback: a missing, empty, malformed or unreachable value prevents startup. URL-encode special password characters; TLS uses the PostgreSQL URI parameters sqlx supports. No project override. |
| `VIAT_DB_MIGRATION_TIMEOUT_SECS` | u64; `600` s | D. Positive seconds; zero/invalid falls back to 600. Budgets **resource migration requests only**, never platform startup migrations; a request cannot raise it. |
| `VIAT_GRAPHQL_MAX_RELATION_DEPTH` | usize; `8` levels | D (engine creation). 0 disables the ceiling. Resource/GraphQL authors cannot exceed the deployment ceiling; validate deep queries before raising it. |
| `VIAT_GRAPHQL_MAX_TABLE_READS` | usize; `64` reads | D (engine creation). 0 disables the ceiling. Bounds table reads within one execution — **not** the server's PostgreSQL pool size. |
| `VIAT_SQLITE_ROOTS` | string; unset | D. Colon-separated absolute allowlisted directories; unset means no SQLite resource path is allowed. Paths resolve on the server filesystem and must pass canonical-path checks. |

## Connection, permissions and migrations

```dotenv
DATABASE_URL=postgres://viat:REPLACE_WITH_URL_ENCODED_PASSWORD@postgres:5432/viat
VIAT_DB_MIGRATION_TIMEOUT_SECS=600
```

Unexecuted configuration example. The essentials:

- The database must **already exist**; the startup role must sign in and
  apply the release's bundled DDL migrations, and normal operation needs
  platform-table reads/writes, sequences and database notifications. A
  read-only business role is not enough; never grant superuser permanently
  to debug permissions — establish the needed grants on an isolated copy.
- The platform pool is fixed at **10 connections/process**; there is no
  supported `VIAT_DB_POOL_SIZE` variable. Startup opens additional
  connections for notifications and similar work — leave headroom for
  administration, backups and other clients. Resource pools count
  separately: cached PostgreSQL/MySQL resource pools commonly allow
  **8 connections/resource/process**. More instances multiply the
  connection budget, never the shared database's capacity.
- All bundled migrations run **before** the HTTP listener;
  `VIAT_DB_MIGRATION_TIMEOUT_SECS` bounds only `viat db` business-resource
  migrations — it is not a fuse for startup migrations. On
  `db connect`/`db migrate`/checksum errors: stop restart loops, keep logs
  and backups; **never** edit applied migration records or remove
  checksums.

## The real TLS boundary

- The platform `DATABASE_URL` uses sqlx's URI support: in production,
  configure certificate verification per PostgreSQL driver capabilities and
  actually validate the chain and hostname from the deployed environment.
- **The business `postgresql` resource's `ssl` boolean is currently ignored
  by its connection construction path** — it is not evidence of enabled or
  verified TLS.
- Business `mysql` `ssl=true` maps to **Preferred** (fallback allowed), not
  Require/VerifyIdentity. TLS settings on the platform URI do not affect
  these resources.

> [!WARNING]
> Where encrypted, identity-verified transport is mandatory, enforce it at
> the database server (reject plaintext), via a validated tunnel/proxy or
> another **external** boundary — and verify the connection. A successful
> resource save is not compliance evidence. Never fix trust errors by
> globally disabling verification.

## Operational checks and recovery

| Symptom | Action |
| --- | --- |
| Fresh install will not start | Verify address, container DNS/network, port, database name and role before starting the app; `localhost` inside a container is that container |
| `PoolTimedOut` | Distinguish unreachable database / exhausted quota / long transactions and locks / load; check `/readyz` and database connection/lock views — do not just raise concurrency |
| Business migration timeout | Verify target database, migration ledger, locks and the SQL; a disconnect does not prove all statements rolled back — inspect state before retrying |
| Version rollback after migration | Follow [upgrades](../operations/upgrades.md) and [backup/restore](../operations/backup-restore.md); no general automatic downgrade-migration promise exists |

SQLite files including WAL/SHM, external databases and their audit tables
are **not** part of a platform-database backup; see [storage](storage.md).
