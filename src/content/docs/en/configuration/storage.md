---
title: File, cache and persistent storage configuration
description: Directory allowlists, upload spooling, S3 limits, response cache and persistence boundaries.
doc_id: configuration.storage
verified_release: '1.1.0'
channel: stable
---

# File, cache and persistent storage configuration

See [overview conventions](overview.md) for types/reload. Everything here is
optional. Related-but-**non-interchangeable** allowlists and parameters:
worker ownership in [security](security.md), Rust artifacts in
[runtime](runtime.md), SQLite paths in [database](database.md).

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_STORAGE_ROOTS` | string; unset | D. Colon-separated absolute-directory allowlist for local-storage resources; unset forbids saving any local storage root. A resource root must pass path checks **and** fall inside the allowlist. |
| `VIAT_STORAGE_SPOOL_DIR` | path; `<tmp>/viat-spool` | S + D. Must be absolute; relative values warn and are ignored. Platform-owned with Unix mode 0711. **Never** hand it to workers or mix persistent business files into it. |
| `VIAT_STORAGE_MAX_FILE_BYTES` | u64; `104857600` bytes | D. Positive deployment-level per-file cap (default 100 MiB); a resource's `max_file_bytes` can only lower it. 0/invalid falls back. |
| `VIAT_S3_MULTIPART_THRESHOLD_BYTES` | u64; `67108864` bytes | D. Positive threshold (default 64 MiB) above which uploads go multipart; it **does not raise** the per-file cap. |
| `VIAT_S3_MULTIPART_PART_BYTES` | u64; `67108864` bytes | D. Positive, clamped to 5 MiB..5 GiB; the implementation may enlarge parts to stay under 10,000. |
| `VIAT_S3_HELPER_MAX_BYTES` | u64; `8388608` bytes | D. The 8 MiB buffer cap of the `ctx.resources` S3 helper. Accepts 0 but is **not** an "unlimited" switch — stream big objects via /_s3 instead of enlarging the buffer. |
| `VIAT_WATCH_ROOTS` | string; unset | S + D. Colon-separated absolute directories for file watches; unset disables them. Must be in-container paths; **not** a storage or SQLite allowlist. |
| `VIAT_CACHE_REDIS_URL` | URL; unset | S. Optional shared response cache; a configured but malformed URI blocks startup. Runtime failures count as miss-without-store and never fail the endpoint. Setting it replaces the in-memory backend. |
| `VIAT_CACHE_MEMORY_MAX_BYTES` | u64; `67108864` bytes | F. Per-process weight-based memory-cache budget (default 64 MiB); 0 disables caching **only** when Redis is unconfigured. **Not** total process memory. |
| `VIAT_CACHE_MAX_ENTRY_BYTES` | u64 → usize; `262144` bytes | F. Positive cached-body cap (default 256 KiB); larger responses serve normally but are not cached. 0/invalid falls back. |
| `VIAT_CACHE_MAX_TTL_SECS` | u32 via u64; `86400` s | D. Positive and must fit u32; an endpoint's `ttl_secs` can only lower it. Invalid/0/out-of-range falls back to 24 hours. |

## Planning directories and mounts

```dotenv
VIAT_STORAGE_ROOTS=/srv/viat-files
VIAT_STORAGE_SPOOL_DIR=/var/tmp/viat-spool
VIAT_STORAGE_MAX_FILE_BYTES=104857600
VIAT_WATCH_ROOTS=/srv/viat-input
```

Unexecuted example. Essentials:

- Directories must exist (or be creatable by the server) and map to the same
  in-container paths.
- Keep separate: persistent files, input directories, upload spool,
  interpreter caches, compilation caches.
- **Never** expose platform data directories, private-key directories,
  `/etc`, the host root or the Docker socket under roots project authors
  can choose.
- Local-storage files are accessed by the platform backend — no need to
  chown whole trees to the script account for readability. Scripts writing
  plain mounted directories is a different capability: use
  `VIAT_WORKER_DATA_DIRS` explicitly, knowing it **recursively changes
  ownership**; with fixed host UIDs, match the worker UID instead and remove
  trees that need no adoption from the list. Mount watch directories
  read-only where possible. Verify **in-container** paths and account
  permissions, not just host-side.

## Spooling, uploads and failure cleanup

- Multipart files are written into the platform spool per request and
  deleted on normal completion. The Unix directory is 0711 (traversable,
  not listable); workers should read only the handles handed to them.
- Crash leftovers are cleaned at startup and hourly by a **conservative
  age** related to the sync-run/idempotency staleness thresholds — not
  "deleted on the hour after upload". Do not manually empty the spool with
  active requests, and never use it for final files.
- One upload can simultaneously consume reverse-proxy temp disk, the
  platform spool and the target object store — the per-file cap is **not**
  a total deployment quota. Estimate concurrent-upload peaks and failure
  leftovers; watch disk/inodes. On 413, distinguish: the ordinary 2 MiB
  buffered body / multipart text fields / the file cap / proxy limits.
  Failed-multipart leftovers should be backstopped by object-storage
  lifecycle rules — never assume platform cleanup always succeeds.

## Cache is not backup

- Without Redis, the response cache is **per-process and lost on restart**;
  `VIAT_CACHE_MEMORY_MAX_BYTES=0` disables caching only in that mode. With
  Redis configured but unreachable, requests count as misses — hit rate is
  not guaranteed.
- Cache keys distinguish published snapshots and permitted caller scopes; a
  hit still passes authentication/authorization checks. **Never store
  business truth in the cache**; review the endpoint's cache scope for
  sensitive shared responses.
- Cache Redis and endpoint rate-limit Redis
  (`VIAT_RATELIMIT_REDIS_URL`) are separate settings: they may target the
  same controlled service but need independent budgeting, protection and
  verification. The latter falls back to per-instance limiting on failure —
  **not** a strict cluster quota; see [integrations](integrations.md).

## Backup scope and recovery verification

The platform database stores resource configuration and management metadata;
it **never automatically backs up** local-storage bytes, SQLite files,
business databases, S3 buckets or external secrets. File records/audits may
live in the project's own business database — restore metadata and file
bytes to one consistent point in time. Local Rust artifacts can also be
recovery-critical without other copies/toolchains; Cargo/uv caches are
usually rebuildable, but offline environments cannot assume re-downloading
works.

Rehearse with [backup and isolated recovery](../operations/backup-restore.md):
isolate the original directories/buckets → mount restored copies → check
permissions and one known sample hash → verify scripts cannot write back to
production. **A recovery test must prove more than "PostgreSQL imports".**
