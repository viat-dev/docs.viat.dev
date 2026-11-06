---
title: Back up and validate an isolated restore
description: Capture databases, keys and external state consistently, restore only into an isolated target, and prove recovery before relying on it.
doc_id: operations.backup-restore
verified_release: '1.1.0'
channel: stable
---

# Back up and validate an isolated restore

**Every command on this page is an unexecuted operational template. Nothing was backed up, stopped, restored or contacted while writing it.** Backup/restore changes require deployment/database administrator permission, data-owner approval and a maintenance window. Do not paste these commands into production without adapting service names, PostgreSQL version, role, paths and recovery objectives.

A `viat pull` or source repository is **not an instance backup**: it does not include account/session state, all resource secrets, live business data, run history, external bytes or complete configuration. There is no built-in one-command disaster-recovery/HA guarantee.

## Inventory the recovery set

| Item | Capture | Why it matters |
| --- | --- | --- |
| Platform PostgreSQL | Consistent database backup, required roles/grants/extensions and server version; optionally a separately managed PITR/WAL solution | All platform state, ciphertext/references, snapshots, queue and audit |
| Original master key | Restricted independent secret backup and tested retrieval | Database dump alone cannot decrypt AES secrets |
| JWT/config/license | Restricted deployment environment, service files, image digest, valid activation arrangement, TLS/key recovery policy | Recreating a container does not recover missing configuration; license must still be valid |
| Vault/AWS Secrets Manager | Provider-supported backup/version/recovery, historical names/paths/mounts and read credentials | Database only holds references; changing write backend does not migrate history |
| Business databases | Provider-consistent dump/snapshot including audit triggers/table, file metadata, migration ledger | Separate from platform database; coordinate a consistent business recovery point |
| Local files/SQLite | Consistent files and ownership/modes; SQLite backup/checkpoint discipline including WAL if applicable | A live partial file copy is not necessarily a valid database |
| S3/storage/artifacts | Object versions, bucket configuration and lifecycle; required executable artifacts | Byte data is not in platform SQL; artifact compatibility depends on release/target |
| Dependency/build caches | Optional online; potentially essential offline | Rebuild requires available sources/toolchains and time |
| Remote logs/exports | Independent backend backup/retention and evidence controls | Platform dump does not contain new ClickHouse/Loki lines |

Define RPO/RTO with measured restore times and business requirements, not an invented product guarantee. Encrypt backups, keep keys separately, restrict operator access, retain off-host copies and test their readability. Never put filled deployment `.env` files or database dumps in source control.

## Example platform backup with Compose

This example assumes the installation guide's `viat` and `postgres` services, PostgreSQL role/database `viat`, working directory at your approved Compose project, and matching tools already present. Stop **all Viat replicas and external writers** that share the recovery set if you need one consistent cross-store point. Disable inbound traffic/producers under your change plan; let supported in-flight work drain. PostgreSQL `pg_dump` itself is consistent while online, but it cannot make multiple stores atomically consistent.

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

A failed dump can leave an incomplete output file: inspect the command exit status, size and archive table of contents; a filename/hash alone is not proof of completeness. `pg_dumpall --globals-only` needs appropriate privileges and may contain role password hashes; protect it like credentials. With a managed DB, use its approved role/export mechanism instead of assuming superuser.

While writers remain quiesced, capture each external store using its supported consistency procedure; record matching timestamps/IDs, deployment files and image digest, then resume the original application only after those captures finish:

```sh
docker compose start viat
```

Do not copy the raw running PostgreSQL data directory with ordinary `tar`. Use logical backup as above or a PostgreSQL-aware physical/PITR solution. For ordinary local-file trees, snapshot/copy the stopped tree with ownership/modes preserved and record content hashes. For SQLite, use its online backup API or a quiesced consistent copy; do not silently omit WAL data. An S3 copy needs versions and a proven relationship to file metadata; “bucket exists” is insufficient.

## Restore only on an isolated recovery host first

Use a dedicated recovery host/VM with **no route or credentials capable of reaching production providers/databases**, no production-mounted directories, and no public listener. A Docker `--internal` network is useful defense-in-depth, not a universal firewall against every host/network path. Verify isolation before starting the restored application: cloned queue rows, schedules, alerts and chat connectors can act automatically. `SCHEDULER_ENABLED=false` disables only cron, not all side effects.

Prepare a new empty working directory, copies of the trusted backup artifacts and the **already available approved** PostgreSQL/application images. Do not use production service/container/volume names. These commands intentionally use `--pull=never` and no published ports:

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

The `trust` authentication above is **only for the disposable, nonpublished isolated drill**, never a production configuration. Do not continue until `pg_isready` succeeds; it may need to be repeated after startup. Use a matching PostgreSQL major/tool version or a separately tested migration path. Inspect globals and recreate only required safe roles/grants; never replay unreviewed superuser/role changes into a shared cluster.

```sh
docker exec -i viat-restore-db pg_restore \
  -U viat -d viat --no-owner --no-privileges --exit-on-error \
  < backups/recovery-point/platform.dump
docker exec viat-restore-db psql -U viat -d viat -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) AS projects FROM projects;' \
  -c 'SELECT count(*) AS users FROM platform_users;'
```

`--no-owner --no-privileges` deliberately avoids restoring original ownership/ACLs into this minimal drill; it is not proof a production restore has correct ACLs. Review/reapply approved ownership/permissions for the real target. Do not use `--clean` against an existing database as a shortcut.

## Validate application, secrets and bytes

In a private editor create `recovery.env` with mode 0600 containing the following **reviewed fixture configuration**, plus any read backends needed by the restored secrets. Preserve the original master key; use a new drill-only JWT secret and a drill-specific public URL:

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

These switches **do not disable all automation**. The host isolation is mandatory. A restored stored activation can still be valid and allow background work; do not rely on license lock as a safety mechanism. Do not copy live Vault/AWS credentials just to make the drill green; restore provider fixtures/read-only copies in the isolated environment where possible, otherwise mark that recovery dependency unvalidated.

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

Start the **same release** before considering an upgrade: startup applies its bundled migrations. The example omits file/artifact mounts on purpose; add restored **copies only** at required container paths and verify ownership. Restore checks must include:

- Expected project/user/snapshot counts and known saved objects; successful approved login with correct role and valid activation.
- One harmless fixture secret actually decrypted through the restored backend; probes alone do not test the master key.
- One restored file with expected content hash and one business record/audit link; database import alone does not test byte recovery.
- Compatible Rust artifact availability or a proven offline rebuild path; dependencies/build cache accessibility.
- Explicit inventory of queued/running jobs and revoked sessions/PATs that an older backup can resurrect. Do not replay production actions as validation.
- A written list of every untested external provider/backend and the measured restore duration. Never label a partially validated restore “complete”.

## Cleanup and actual disaster cutover

After approved evidence capture, remove **only the drill-named** containers/network/volume. The last command destroys the drill database; verify its name first:

```sh
docker rm -f viat-restore viat-restore-db
docker network rm viat-restore-net
docker volume rm viat-restore-pg
```

Securely handle `recovery.env`, dumps and exports under backup policy; deleting a file is not guaranteed secure erasure on every storage system. For a real recovery, fence the failed/old writers, restore approved production ownership and secret access, reconcile replay risk/credentials, then re-enable ingress and automation in controlled stages. Never run old and restored producers concurrently against the same business targets without an explicit reconciliation plan. See [upgrades](upgrades.md) and [run recovery](runs.md).
