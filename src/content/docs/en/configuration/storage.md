---
title: File, cache and persistent storage configuration
description: Directory allowlists, upload spooling, S3 limits, response cache and persistence boundaries.
doc_id: configuration.storage
verified_release: '1.1.0'
channel: stable
---

# File, cache and persistent storage configuration

Use [overview conventions](overview.md) for types/reload. All settings here are optional. Worker ownership settings are in [security](security.md), Rust artifact settings in [runtime](runtime.md), and SQLite paths in [database](database.md). These allowlists do not substitute for one another.

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_STORAGE_ROOTS` | string; unset / 未设置 | D. Colon-separated absolute allowlisted directories for local storage resources; unset forbids saving local storage roots. Resource root must be within approved paths after path checks. |
| `VIAT_STORAGE_SPOOL_DIR` | path; `<tmp>/viat-spool` | S + D. Absolute directory; relative values ignored with startup warning. Platform-owned, Unix 0711. Do not hand this directory to workers or mix it with durable files. |
| `VIAT_STORAGE_MAX_FILE_BYTES` | u64; `104857600` bytes | D. Positive 100 MiB deployment per-file maximum; resource max_file_bytes may only lower it. 0/invalid → default. |
| `VIAT_S3_MULTIPART_THRESHOLD_BYTES` | u64; `67108864` bytes | D. Positive 64 MiB threshold; larger uploads use multipart. Does not raise resource per-file maximum. |
| `VIAT_S3_MULTIPART_PART_BYTES` | u64; `67108864` bytes | D. Positive value, clamped 5 MiB..5 GiB; implementation may grow parts to stay within 10,000 parts. |
| `VIAT_S3_HELPER_MAX_BYTES` | u64; `8388608` bytes | D. 8 MiB buffer ceiling for ctx.resources S3 helper. 0 accepted (not documented as unlimited). Use streaming /_s3 path for larger objects instead of raising all buffers. |
| `VIAT_WATCH_ROOTS` | string; unset / 未设置 | S + D. Colon-separated absolute directory allowlist for watch triggers; unset disables watcher capability. Mount containers paths; not a local storage or SQLite allowlist. |
| `VIAT_CACHE_REDIS_URL` | URL; unset / 未设置 | S. Optional shared response cache; malformed configured URI aborts startup. Runtime outage is a miss and no store, not failure of the endpoint. Redis overrides memory backend choice. |
| `VIAT_CACHE_MEMORY_MAX_BYTES` | u64; `67108864` bytes | F. Per-process weighted memory cache budget, default 64 MiB; 0 disables cache only when Redis is absent. Not total process memory. |
| `VIAT_CACHE_MAX_ENTRY_BYTES` | u64 → usize; `262144` bytes | F. Positive 256 KiB response body ceiling for cache storage; larger responses still served, not cached. 0/invalid → default. |
| `VIAT_CACHE_MAX_TTL_SECS` | u32 via u64; `86400` s | D. Positive value fitting u32; endpoint ttl_secs may only lower it. Invalid/0/out-of-range → 24h. |

## Plan directories and mounts

```dotenv
VIAT_STORAGE_ROOTS=/srv/viat-files
VIAT_STORAGE_SPOOL_DIR=/var/tmp/viat-spool
VIAT_STORAGE_MAX_FILE_BYTES=104857600
VIAT_WATCH_ROOTS=/srv/viat-input
```

This is unexecuted configuration. Directories must exist or be creatable by the server, with container mappings at the intended paths. Separate durable files, input trees, upload spool, interpreter cache and compiler cache. Do not allow project authors to select platform data/key directories, `/etc`, host root or Docker sockets as storage roots.

Local storage is accessed by the platform backend; it does not require chowning the whole tree to scripts. Direct script writes to an ordinary mounted directory are separate: `VIAT_WORKER_DATA_DIRS` recursively changes ownership. For fixed host ownership, use a matching worker UID and omit trees that should not be adopted. Prefer read-only watch mounts. Check actual container paths and identities, not just host-side permissions.

## Spooling, uploads and failure cleanup

Multipart file parts are written into the platform spool for the request and removed on normal completion. On Unix the directory is 0711 (traversable, not listable); workers should read only handles specifically passed to them. Startup and hourly age sweeps remove crash leftovers conservatively; the horizon derives from sync/idempotency stale limits, not a promise to delete at the next hour after upload. Do not empty the spool while requests are active or use it for durable output.

An upload can consume reverse-proxy temporary space, platform spool and destination-object capacity simultaneously. A per-file ceiling is not a deployment quota. Budget concurrent uploads plus failure leftovers and monitor disk/inodes. For 413 distinguish ordinary 2 MiB buffered bodies, multipart text, file maximums and proxy limits. Backstop abandoned S3 multipart uploads with object-store lifecycle rules; platform cleanup can fail.

## A cache is not a backup

Without Redis, response caches are per process and lost on restart; `VIAT_CACHE_MEMORY_MAX_BYTES=0` disables only that mode. An unavailable configured Redis yields cache misses, not guaranteed hit rate. Cache keys distinguish snapshots and configured caller scope; hits still pass authentication/authorization checks. Do not keep business truth in a cache; review endpoint cache scope before sharing sensitive responses.

Cache Redis and endpoint-limit Redis (`VIAT_RATELIMIT_REDIS_URL`) are independent settings. They can use one controlled service but need separate budgeting/protection/verification. The limiter falls back to per-instance buckets during failure, not strict fleet-wide limits; see [integrations](integrations.md).

## Backup scope and restore validation

The platform database stores resource configuration and management metadata. It **does not automatically back up** local file bytes, SQLite databases, business databases, S3 buckets or external secrets. File metadata/audit may be in a project's own database; restore metadata and bytes to a consistent point. Local Rust artifacts can be recovery-critical without another copy/compiler; Cargo/uv caches are usually rebuildable, but offline systems cannot assume they can redownload them.

Rehearse [backup and isolated restore](../operations/backup-restore.md): isolate original directories/buckets, mount restored copies, check permissions and a known sample hash, and prove no script writes back to production. Successfully importing PostgreSQL alone is not a restore drill.
