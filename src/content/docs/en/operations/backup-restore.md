---
title: Back up and validate an isolated restore
description: Capture databases, keys and external state consistently, restore only into an isolated target, and prove recovery before relying on it.
doc_id: operations.backup-restore
verified_release: '1.1.0'
channel: stable
---

# Back up and validate an isolated restore

**Every command on this page is an unexecuted operational template — nothing
was stopped, backed up, restored or contacted while writing it.** The work
needs deployment/database-administrator permission, data-owner approval and
a maintenance window; adapt service names, PostgreSQL version, roles, paths
and recovery targets before use — **never paste into production**.

One fact to anchor on: `viat pull` or a source repository **is not an
instance backup** — it contains neither complete accounts/sessions nor all
resource secrets, business data, run history, external files or deployment
configuration. There is no one-command disaster-recovery/HA guarantee.

## The recovery-set checklist

| Item | Back up | Why |
| --- | --- | --- |
| Platform PostgreSQL | Consistent backup, required roles/grants/extensions, version; optionally managed PITR/WAL | Platform state, ciphertext/references, snapshots, queues, audit |
| **Original master key** | Separate restricted secret backup, retrieval rehearsed | A SQL dump alone **cannot decrypt AES** |
| JWT/config/license | Restricted environment, service files, image digests, valid activation arrangements, TLS/private-key recovery policy | Recreating containers restores no missing config; the license must stay valid |
| Vault/AWS Secrets Manager | Provider-supported backup/version recovery; historical names/paths/mounts and read identities | The database stores references; switching write backends migrates no history |
| Business databases | Consistent backups including audit tables/triggers, file metadata, migration ledgers | Not in the platform database; business recovery points must align |
| Local files/SQLite | Files, ownership, permissions; proper SQLite backup/checkpoint plus necessary WAL | A partial online copy is not necessarily a consistent database |
| S3/storage/artifacts | Object versions, bucket config/lifecycle, required executable artifacts | Bytes are not in platform SQL; artifact compatibility depends on version/target |
| Dependency/build caches | Rebuildable online, possibly required offline | Rebuilds need available sources, toolchains and time |
| Remote logs/exports | Independent backend backups/retention and evidence control | A platform dump contains no new ClickHouse/Loki rows |

Define RPO/RTO from **measured recovery durations** and business needs — no
invented product guarantees. Encrypt backups, store keys separately,
restrict access, keep off-site copies and verify readability; completed
`.env` files and dumps **never enter version control**.

## Compose platform backup example

Assumptions: the install guide's viat/postgres services, the viat
database/role, an approved Compose project directory, matching installed
tools. For a cross-store consistent recovery point, **stop every Viat
replica and external writer sharing the recovery set**; close entry
points/producers per the change plan and allow supported task draining.
pg_dump is online-consistent by itself but **cannot** make multiple stores
atomically consistent.

```sh
umask 077
mkdir -p backups/recovery-point
# This stops the application, not PostgreSQL; review the interruption first.
docker compose stop -t 60 viat
docker compose exec -T postgres pg_dump -U viat -d viat \
  --format=custom > backups/recovery-point/platform.dump
docker compose exec -T postgres pg_dumpall -U viat \
  --globals-only > backups/recovery-point/postgres-globals.sql
sha256sum backups/recovery-point/platform.dump \
  backups/recovery-point/postgres-globals.sql \
  > backups/recovery-point/backup.sha256
```

- A failed command can leave partial files: check exit codes, sizes and the
  archive directory — **a filename/hash alone proves no completeness**.
- `pg_dumpall` globals need adequate permissions and can contain password
  hashes: protect them like credentials. Managed databases use approved
  roles/export mechanisms; never assume superuser.
- While writers stay quiet, capture external state per each store's
  supported method, recording matching times/ids, configuration and image
  digests; afterwards bring the application back:

```sh
docker compose start viat
```

- **Never copy a running PostgreSQL data directory with plain tar** — use
  the logical backup above or PostgreSQL-aware physical/PITR. Ordinary
  files may be snapshotted with ownership/permissions once writes stop,
  with hashes recorded; SQLite needs the online backup API or a quiet
  consistent copy (WAL included); S3 copies must include versions and
  correspond to file metadata — "the bucket exists" is not enough.

## Rehearse on an isolated recovery host first

Requirements: a dedicated host/VM with **no network path or credentials to
production providers/databases**, no production mounts, no public
listeners. A Docker `--internal` network is defense in depth, not a
universal firewall. **Prove isolation before starting the restored app**:
cloned queues, schedules, alerts and chat connectors can act on their own;
`SCHEDULER_ENABLED=false` stops only cron.

Prepare a fresh empty directory, trusted backup copies and **already
present, approved** PostgreSQL/application images; use no production
containers/volumes/service names; the commands below use explicit
`--pull=never` and publish no ports:

```sh
sha256sum -c backups/recovery-point/backup.sha256
docker network create --internal viat-restore-net
docker volume create viat-restore-pg
docker run -d --pull=never --name viat-restore-db \
  --network viat-restore-net \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=viat -e POSTGRES_DB=viat \
  -v viat-restore-pg:/var/lib/postgresql/data \
  postgres:17.4-alpine
docker exec viat-restore-db pg_isready -U viat -d viat
```

- The `trust` auth here is **for a one-off, port-unpublished isolated drill
  only — never a production setting**. Proceed only after `pg_isready`
  succeeds (it may need a rerun during startup).
- Use matching PostgreSQL major versions/tools or a separately validated
  upgrade path; review the globals and restore only required security
  roles/grants — **never** replay unreviewed superuser changes onto a
  shared cluster.

```sh
docker exec -i viat-restore-db pg_restore \
  -U viat -d viat --no-owner --no-privileges --exit-on-error \
  < backups/recovery-point/platform.dump
docker exec viat-restore-db psql -U viat -d viat -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) AS projects FROM projects;' \
  -c 'SELECT count(*) AS users FROM platform_users;'
```

The drill's no-owner/no-privileges **deliberately skips** original
ACLs/ownership — it **cannot prove production permissions restored**; a
real recovery reviews and rebuilds approved permissions. Never use
`--clean` against an existing database for convenience.

## Verify application, secrets and files

Create `recovery.env` (mode 0600) in a trusted editor with **reviewed
fixture configuration** and the necessary historical secret-read backends.
Keep the original master key; use a drill-only independent random JWT; a
drill public URL:

```dotenv
DATABASE_URL=postgres://viat@viat-restore-db:5432/viat
VIAT_MASTER_KEY=REPLACE_WITH_ORIGINAL_64_HEX_KEY
VIAT_JWT_SECRET=REPLACE_WITH_DRILL_ONLY_RANDOM_VALUE
VIAT_PUBLIC_URL=http://viat-restore:8080
VIAT_ALLOW_REGISTRATION=false
SCHEDULER_ENABLED=false
VIAT_BOOT_WARM=0
VIAT_RETENTION_ENABLED=false
VIAT_UI_ENABLED=false
```

> [!WARNING]
> These switches **do not disable all automation** — host-level isolation
  is mandatory. The restored activation can still be valid and background
  jobs can still run; **license lockout is not a safety measure**. And do
  not copy live Vault/AWS credentials just to make things look normal:
  prefer restoring provider fixtures/read-only replicas inside the isolated
  environment, or record the item explicitly as unverified.

```sh
docker run -d --pull=never --name viat-restore \
  --network viat-restore-net --env-file recovery.env \
  --pids-limit 512 --memory 4g \
  registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0
docker logs viat-restore
docker exec viat-restore curl --fail --silent --show-error \
  http://127.0.0.1:8080/healthz
docker exec viat-restore curl --fail --silent --show-error \
  http://127.0.0.1:8080/readyz
```

Start the **same version** first; consider upgrades afterwards (startup
runs its built-in migrations). The example deliberately mounts no
files/artifacts — mount only **restored copies** where needed and verify
ownership. Validation must include at least:

- Project/user/snapshot counts and known objects; approved sign-in with
  correct roles and valid activation.
- **Actually decrypting one harmless fixture secret** through the restored
  backends — probes never validate the master key.
- One file's expected hash and its business-record/audit correlation — a
  SQL import proves no byte-level file recovery.
- Compatible Rust artifacts or a proven offline rebuild path;
  dependencies/caches reachable.
- An inventory of queued/running tasks and revoked sessions/PATs an old
  backup can resurrect; **never replay production side effects as a
  test**.
- Records of every untested external provider/backend and the recovery
  duration — **a partial recovery is not "complete"**.

## Cleanup and the real switchover

After preserving evidence with approval, clean up **drill-only names
only**; the last command destroys the drill database — confirm names first:

```sh
docker rm -f viat-restore viat-restore-db
docker network rm viat-restore-net
docker volume rm viat-restore-pg
```

Dispose of `recovery.env`/dumps/exports per backup policy — deleting files
guarantees no secure erasure on every storage. A real recovery: isolate old
writers first → restore approved production permissions and secret reads →
reconcile replay risks/credentials → reopen entry points and automation in
stages. **Without an explicit reconciliation plan, the old and restored
instances must never touch the same business targets simultaneously.** See
[upgrades](upgrades.md) and [run recovery](runs.md).
