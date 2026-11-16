---
title: Upgrade, verify and roll back safely
description: Prepare backups and compatible runtimes, understand automatic migrations and artifact invalidation, and choose a defensible rollback.
doc_id: operations.upgrades
verified_release: '1.1.0'
channel: stable
---

# Upgrade, verify and roll back safely

Upgrading the server is a **deployment/database operation**, not an endpoint
publication. Host/database administrators approve it; project owners
coordinate traffic, schedules and side effects. **All commands are
unexecuted templates — no image was pulled and no service changed while
writing this.** This manual is verified for 1.1.0; unreleased branch
features are not stable capabilities.

## Before the maintenance window

1. Record: image digest/version, PostgreSQL major version, mounts,
   environment, activation horizon, worker UID/GID and every replica.
   `viat version` reports CLI/server info — server and mobile-client
   versions are **independent**. A mutable latest is not a rollback record.
2. Read the target release's upgrade notes: schema/data changes, reserved
   name conflicts and required actions. Resolve conflicts before migrating;
   **never** bypass applied SQL checksums.
3. Create and verify a [complete recovery set](backup-restore.md): the
   original master key, external secret references, business
   databases/audit and files. Snapshot rollback restores no platform
   schema or deleted data.
4. Rehearse on an isolated restored copy with the **exact target image**.
   Startup runs platform migrations automatically before HTTP; there is no
   generic automatic downgrade, and duration depends on data and locks.
5. Verify: dependency installs from trusted sources, persisted uv cache,
   SDK/toolchain/artifact compatibility, disk/PID — an ordinary image does
   **not** grow a Rust compiler because a switch is on.
6. Plan traffic isolation and task draining: decide the fate of queued/
   running/long/streaming tasks and retries; stop external producers as
   needed. `SCHEDULER_ENABLED=false` stops only cron — not connectors,
   queues or alerts.
7. Confirm independent monitoring and a valid activation code matching the
   official artifact — with an expired license, probes stay green while
   protected endpoints keep answering 403.

## Single-node Compose example

Use an approved project and maintenance window. This assumes the image is
selected via `VIAT_TAG`; deployments pinning `image` directly edit that
reference. Keep all volumes/secrets and **never run
`docker compose down -v`**.

```sh
# Only after backup/drain approval; this interrupts application service.
docker compose stop -t 60 viat
# Edit the approved environment/image selection to the target stable artifact.
# If testing installation of the documented release, the example tag is 1.1.0.
VIAT_TAG=1.1.0 docker compose pull viat
VIAT_TAG=1.1.0 docker compose up -d --no-deps viat
docker compose logs --since 10m viat
```

- Running these accesses the configured registry — not executed here.
  Offline: transfer an approved exact image bundle, verify digest/source
  and import under control; **never execute scripts from untrusted
  downloads**.
- The product's `deploy-server.sh` is different: after sourcing a trusted
  shell file it **force-deletes** the old same-named container and creates
  a new one — no graceful rolling or auto-rollback; read
  [inputs and side effects](../configuration/network.md) first. Planned
  replacements drain/stop explicitly — **never assume `rm -f` drains**.

## Verify before restoring traffic

- Logs: database connection/migrations/checksums, secret/log backends,
  dangerous defaults, worker identity and artifact keys.
- Probes: `healthz` healthy and `readyz` reflecting database availability;
  `pool:saturated` may legitimately answer 200 — probes prove neither
  activation nor dependency warmup.
- Function: sign in, read `/version`, confirm roles/membership/activation
  and a **published fixture endpoint** — draft tests prove no publish
  behavior; exercise one authorized resource operation, harmless secret
  decryption, a file read and any required workflow/streaming/WebSocket,
  on isolated targets where possible.
- Surroundings: schedules, queue age, environments and alerts; real
  notification/provider tests need approval; actually check external
  metrics/traces/log ingestion — **configured is not delivered**.
- Baseline: compare error rates/latency/resources with pre-upgrade; restore
  producers/automation gradually and observe a representative load cycle.

## Rust and dependency caches

- The artifact key = script/manifest + SDK + toolchain + host protocol +
  target. An upgrade can invalidate old binaries that "look compatible";
  run-only nodes can lack new artifacts even with healthy database/HTTP.
  Prepare ahead with the matching builder/CLI and distribute via approved
  shared storage/uploads. **Never** rename old files to new keys or bypass
  digest checks.
- Keep `VIAT_RUST_S3_GC` **off** during mixed architectures/toolchains and
  rolling phases — one node's live-set can misjudge another node's
  artifacts as garbage. Local LRU and the Cargo target directory are
  separate. A persisted `/home/viat/.cache/uv` reduces downloads but
  proves nothing about changed dependencies being built; after moving an
  old root-owned cache into the current worker HOME, verify ownership
  adoption — never broad-chown shared host trees.

## Choose the right rollback

| Failure | Direction |
| --- | --- |
| Non-destructive config error, no migration/data side effects | Restore the old config/image after confirming schema compatibility, and verify |
| Migration failure | Preserve logs/scene; confirm transactions and application state in isolation — no blind reruns, no ledger deletion |
| Migrated, old binary incompatible | Restore the approved recovery set to an isolated write target, or verify a forward fix; **the old image alone is not a rollback** |
| Wrong publish revision | Project/endpoint snapshot rollback by someone with publish rights — platform schema, business writes and live uses modules do not roll back |
| Missing Rust artifacts/dependencies | Supply compatible artifacts/environments; do not roll back platform data first |

> [!WARNING]
> Restoring a database loses writes made after the restore point and can
> resurrect queued tasks/revoked credentials. Before switching: isolate old
> nodes → reconcile external side effects → record residual losses.
> Never let old and new producers touch the same targets simultaneously
> without a plan.

Afterwards: keep evidence, revoke temporary fixtures/config, and write the
real verification results back into your operations records.
