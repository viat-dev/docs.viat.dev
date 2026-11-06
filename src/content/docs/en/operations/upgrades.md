---
title: Upgrade, verify and roll back safely
description: Prepare backups and compatible runtimes, understand automatic migrations and artifact invalidation, and choose a defensible rollback.
doc_id: operations.upgrades
verified_release: '1.1.0'
channel: stable
---

# Upgrade, verify and roll back safely

Upgrading the server is a deployment/database operation, not an endpoint publication. Host/database administrators approve it; project owners coordinate traffic, schedules and side effects. **All commands are unexecuted templates. No image was pulled or service changed while writing this page.** This manual is verified for 1.1.0; do not treat unreleased branch features as shipped stable behavior.

## Before the maintenance window

1. Record the running image digest/version, PostgreSQL major, mount inventory, environment/config, activation expiry, worker UID/GID and all replicas. `viat version` reports client/server information; server and mobile/client versions are independent. Do not use mutable `latest` as the rollback record.
2. Read the target release's upgrade notices for schema/data/name collisions and required operator actions. Resolve reserved-name collisions before applying the migration; do not edit applied SQL checksums to bypass it.
3. Create and validate a [full recovery set](backup-restore.md), including the original master key, external secret references, business databases/audit and file bytes. An endpoint snapshot rollback cannot restore platform schema or deleted data.
4. Rehearse the exact target image against an isolated restored copy. Startup automatically applies bundled platform migrations before HTTP listening. There is no general automatic downgrade migration, and migration duration depends on your data/locks.
5. Validate dependency installation from approved mirrors, persistent uv cache, SDK/toolchain/artifact compatibility and available disk/PIDs. Slim images do not compile Rust merely because a switch is on.
6. Plan traffic fencing and job drain; decide what happens to queued/running/long/stream jobs and retries. Stop external producers as needed. `SCHEDULER_ENABLED=false` only stops cron, not every connector/queue/alert.
7. Confirm independent monitoring and a valid activation code matching the official artifact. An expired license can leave probes green while protected endpoints answer 403.

## Single-node Compose example

Use the approved Compose project and a maintenance window. The examples assume your service uses `VIAT_TAG`; if the image is pinned directly, edit that exact image reference instead. Preserve all volumes and secrets. Do **not** run `docker compose down -v`.

```sh
# Only after backup/drain approval; this interrupts application service.
docker compose stop -t 60 viat
# Edit the approved environment/image selection to the target stable artifact.
# If testing installation of the documented release, the example tag is 1.1.0.
VIAT_TAG=1.1.0 docker compose pull viat
VIAT_TAG=1.1.0 docker compose up -d --no-deps viat
docker compose logs --since 10m viat
```

These commands contact the configured registry when run; this document did not run them. For offline deployment, transfer an approved exact image archive, verify its digest/provenance, and use your controlled import path. Never execute scripts bundled with an untrusted downloaded archive.

The product `deploy-server.sh` is different: it sources a trusted shell file, then **forcibly removes** the old named container and creates a replacement. It is not graceful rolling deployment or automatic rollback; review its [inputs and side effects](../configuration/network.md). Prefer explicit stop/drain before a planned replacement rather than assuming `docker rm -f` drains work.

## Verify before restoring traffic

- Inspect startup for DB connection/migration/checksum errors, secret/log backend initialization, invalid defaults, worker identity and artifact key inputs.
- `/healthz` must serve; `/readyz` must reflect database usability. `pool:saturated` can be 200 by design; neither probe proves activation or warm dependencies.
- Authenticate, read `/version`, confirm role/project membership, activation and a representative published fixture endpoint. Do not use a draft-only test as proof of published behavior.
- Verify one authorized resource operation, a harmless secret decrypt, restored-file read and required workflow/stream/WebSocket fixture, using isolated destinations where possible.
- Inspect schedules/queue age, environments and alert state; explicitly authorize any notification/provider test. Check external metrics/trace/log ingestion rather than assuming configuration presence proves delivery.
- Compare error rate/latency/resource use with the pre-upgrade baseline. Re-enable producers/automation incrementally and observe through a representative workload period.

## Rust artifacts and worker caches

Artifact keys include script/manifest, platform SDK/toolchain/host-protocol and target inputs. An upgrade can retire compatible-looking old binaries if those inputs changed. A run-only node without a new compatible artifact can fail even though the database and HTTP listener are healthy. Prepare new artifacts with matching builders/CLI and distribute through the approved shared store/upload path. Do not rename old binaries to a new key or bypass digest validation.

Keep `VIAT_RUST_S3_GC` off during mixed-toolchain/architecture or rolling transitions: one node's live-set can misidentify another node's artifacts as dead. Local artifact LRU and Cargo target storage are different budgets. Persistent `/home/viat/.cache/uv` reduces cold downloads but does not prove every changed dependency is built. For migrations from older root-owned cache paths, mount at the current worker-home location and verify startup ownership adoption; avoid broad manual chown of shared host data.

## Choose the right rollback

| Failure | Safe direction |
| --- | --- |
| Bad non-destructive config before migration/data effects | Restore prior config/image only after confirming schema compatibility; restart and verify |
| Migration failed | Preserve logs/database state; determine transaction/applied status in isolation. Do not blindly rerun/erase migration ledger |
| Migration succeeded but old binary incompatible | Restore the approved pre-upgrade recovery set into a fenced target or apply a verified forward fix; an old image alone is not rollback |
| Bad published endpoint revision | Use endpoint/project snapshot rollback with publisher permission; it does not roll back platform schema, business writes or live `uses:` modules |
| Missing Rust artifact/dependency | Supply compatible artifact/build environment; reverting platform data is not the first response |

A database restore loses writes after its recovery point and can resurrect jobs or revoked credentials. Fence old nodes before cutover, reconcile external side effects and document residual data loss. Never let old and restored producers race against the same targets without a plan. After recovery, preserve evidence, remove temporary fixture/config changes, and update the runbook with what was actually verified.
