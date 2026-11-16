---
title: Runtime, build and scheduling configuration
description: Complete deployment settings for pools, execution lanes, builds, durable queues, scheduling and Rust artifacts.
doc_id: configuration.runtime
verified_release: '1.1.0'
channel: stable
---

# Runtime, build and scheduling configuration

Read [overview](overview.md) for the S/F/D/W scopes and restart semantics.
Every variable here is optional unless a condition (e.g. "required to
compile") says otherwise. Units differ: **pool deadlines are usually
milliseconds; execution/lane deadlines are usually seconds**.

## Execution and admission

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_DEFAULT_TIMEOUT_SECS` | u64; `30` s | D. Positive; 0/invalid falls back. Used only when both the target declaration and project default are **missing**, then clamped by the ceilings. |
| `VIAT_MAX_TIMEOUT_SECS` | u64; `300` s | D. Positive **synchronous** ceiling; 0/invalid falls back. Targets/projects can only lower it. Also bounds idempotency occupancy and staging cleanup. |
| `VIAT_MAX_ASYNC_TIMEOUT_SECS` | u64; `1800` s | D. Positive **async** ceiling; 0/invalid falls back. Queue-trigger validation takes a positive i64 and compares it with the ack deadline. |
| `VIAT_ASYNC_MAX_INFLIGHT` | usize; `128` runs | F. Positive; the per-process async in-flight semaphore — distinct from queue depth and long-run/stream permits. |
| `VIAT_SHARED_MAX_TIMEOUT_SECS` | u64; `60` s | D. Positive; a script whose resolved timeout reaches this threshold moves to the long-run lane. **Not an execution ceiling.** |
| `VIAT_LONGRUN_MAX_CONCURRENT` | usize; `8` runs | F. Positive; per-process one-shot long-run permits, not a unified cap on in-process database/SQL work. |
| `VIAT_LONGRUN_QUEUE_WAIT_SECS` | u64; `5` s | D. Positive; synchronous requests give up with 503 after waiting — durable queued tasks may wait until cancelled. |
| `VIAT_STREAM_MAX_CONCURRENT` | usize; `8` streams | F. Positive; per-process streaming worker permits, separate from the shared pool. |
| `VIAT_STREAM_QUEUE_WAIT_SECS` | u64; `30` s | D. Positive; **admission** wait for the streaming lane, not a stream's lifetime. |
| `VIAT_QUEUE_MAX_DEPTH` | i64; `1000` runs | D. Positive; waiting-task cap per concurrency key — full queues reject new submissions. |
| `VIAT_DELAY_MAX_DEPTH` | i64; `100000` runs | D. Positive; backlog cap for pure delay tasks on the synthetic `_delay` key — not execution concurrency. |
| `VIAT_QUEUE_POLL_MS` | u64; `1000` ms | D (dispatcher init). Positive; the periodic claim scan beyond local wakeups — lowering it raises database load. |
| `VIAT_TASK_MAX_DEPTH` | u16; `100` hops | D. Positive; recursion cap for task.call/task.delay — does not limit same-level siblings. |
| `VIAT_QUEUE_ACK_DEADLINE_SECS` | i64; `1500` s | D. Positive; the RabbitMQ acknowledgement budget. **The default async ceiling of 1800 exceeds it**: reconcile the budgets or deliberately accept the trigger's `ack_deadline_override` risk. |
| `VIAT_SHUTDOWN_GRACE_SECS` | u64; `10` s | D (at shutdown). Accepts 0; governs graceful draining and **never** persists running scripts as checkpoints. Container stop deadlines must exceed it. |

## Worker pools and dependency environments

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_POOL_SHARED_MAX` | usize; `16` workers | S. Shared warm workers; parsing accepts 0, operations should keep ≥1. Dedicated/one-shot lanes are not counted here. |
| `VIAT_POOL_QUEUE_DEPTH` | usize; `32` requests | S. Shared-pool wait queue; accepts 0. Distinct from the durable async queue. |
| `VIAT_POOL_QUEUE_WAIT_MS` | u64; `5000` ms | S. Pool wait deadline; accepts 0 (no grace). |
| `VIAT_POOL_READY_TIMEOUT_MS` | u64; `10000` ms | S. Request-path wait for worker READY — **not** a script execution budget; accepts 0, though normal cold starts then cannot work. |
| `VIAT_POOL_BUILD_TIMEOUT_MS` | u64; `300000` ms | S. Default publish/environment build budget; per-script build-timeouts may override within max; parsing accepts 0. |
| `VIAT_POOL_BUILD_TIMEOUT_MAX_MS` | u64; `3600000` ms | S. Deployment ceiling for script build-timeouts; accepts 0, keep it coherent with the default budget. |
| `VIAT_POOL_AUTO_PROMOTE_QPS` | f64; `10.0` req/s | S. QPS threshold for automatic promotion to dedicated; `0.0` disables switching. Finiteness/non-negativity are not strictly validated — use finite non-negative values. |
| `VIAT_POOL_AUTO_DEMOTE_QPS` | f64; `2.0` req/s | S. When promote>0 and demote≥promote, the effective demotion threshold becomes promote/2. Use finite non-negative values. |
| `VIAT_POOL_AUTO_WINDOW_SECS` | usize; `60` s | S. Rolling QPS window; at least 1. |
| `VIAT_POOL_AUTO_DEDICATED_COUNT` | usize; `2` workers | S. Worker count when auto-promoting; at least 1. Adds processes, **not CPU reservations**. |
| `VIAT_POOL_AUTO_MIN_DWELL_SECS` | u64; `60` s | S. Minimum dwell after promotion before demotion; accepts 0. |
| `VIAT_POOL_AUTO_TICK_SECS` | u64; `5` s | S. Auto-coordination period; at least 1. |
| `VIAT_BOOT_WARM` | boolean; on | S. The literals `0`/`false` disable startup background warmup. HTTP boot is never blocked; warmup may still be unfinished when readyz is fine. |
| `VIAT_ENV_GATE` | boolean; off | D. Strict `1`/`true` rejects runs whose environment build is known-failed. Off by default; it does not install dependencies. |
| `VIAT_ENV_RETRY_BACKOFF_SECS` | i64; `300` s | D. Retry backoff for failed environments; constrained ≥0, `0` allows immediate retries. |
| `VIAT_PYTHON_PRELOAD` | string; `psycopg2-binary` | W. Space/comma-separated package specs; an explicitly empty value disables preloading. Changes dependency environments, not just logging. |
| `VIAT_SHELL_BIN` | path; `/bin/bash` | W. The shell executable must exist and be worker-executable; Docker sets /bin/bash explicitly. |

## Publishing, scheduling and Rust

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_PUBLISH_BUILD_BLOCK` | boolean; off | D. Strict `1`/`true` blocks publishing with 409 on build failure. Default logs diagnostics only; distinct from the regression gate. |
| `VIAT_PUBLISH_BUILD_ASYNC` | boolean; off | D. Strict `1`/`true` moves builds to the background and routes go live immediately — do not rely on synchronous-build protection then. |
| `VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` | u64; `120` s | D. Budget for the whole publish regression set; parsed value clamped to 1..3600. |
| `SCHEDULER_ENABLED` | boolean; `true` | S. The literals `false`/`0` stop the **scheduler** only. The image sets true; queues, alerts, chat, watches and cleanup are separate loops. |
| `VIAT_DEFAULT_SCHEDULE_TZ` | IANA zone; `UTC` | D (at schedule save). Trimmed; empty → UTC; unknown zones refuse to save. The zone is **written into each schedule row** — changing the default moves nothing existing. |
| `VIAT_SCHEDULE_MISFIRE_GRACE_SECS` | i64; `60` s | D. Positive; a due cron later than this is recorded/skipped as misfired — no replay of every missed tick. |
| `VIAT_RUST_AUTHORING` | boolean; on | D. Trimmed case-insensitive `0/false/off/no/disabled` forbids Rust create/update (400 bad_request); already-published binaries keep running. |
| `VIAT_BUILD_ENABLED` | boolean; on | D. The same off-values forbid compiling on this node. On still needs SDK/toolchain; run-only nodes need compatible prebuilt artifacts. |
| `VIAT_RUST_ARTIFACT_UPLOAD` | boolean; off | D. Explicit opt-in for artifact upload (spelling below). Permission-checked uploads only — not anonymous binary deployment. |
| `VIAT_RUST_SDK_PATH` | path; unset | D. **Required to compile**; not needed to fetch/run compatible artifacts. The -build image uses /opt/viat/rust-sdk; the SDK digest must match the server. |
| `VIAT_RUST_ARTIFACT_DIR` | path; `<tmp>/viat-rust-artifacts` | D. Local artifacts/cache; -build image uses /var/lib/viat/rust-artifacts. Persist it or configure shared storage; a local cache is not cluster distribution. |
| `VIAT_RUST_TARGET_DIR` | path; `<tmp>/viat-rust-build` | D. Cargo target directory; -build image uses /var/lib/viat/rust-target. Budget its disk separately from the artifact LRU; client-side compile overrides also use it. |
| `VIAT_RUST_BUILD_TIMEOUT_SECS` | u64; `300` s | D. Deadline for one cargo build; accepts 0. Distinct from Python READY/build budgets and CLI waits. |
| `VIAT_RUST_CACHE_MAX_BYTES` | u64; `5368709120` bytes | D. 5 GiB local artifact LRU cap; 0 removes the cap. Does not bound the Cargo target dir or shared bucket. |
| `VIAT_RUST_S3_BUCKET` | string; unset | D. Non-empty enables the shared artifact bucket with the local directory as a front cache. **Not** a project S3 resource. |
| `VIAT_RUST_S3_REGION` | string; `us-east-1` | D. Blank falls back to the default; used for signing and endpoint derivation. |
| `VIAT_RUST_S3_ENDPOINT` | URL; derived | D. Object-storage endpoint; unset derives the regional AWS S3 endpoint. |
| `VIAT_RUST_S3_ACCESS_KEY` | string; empty | D. Explicit platform artifact credentials; practically required for authenticated buckets. **No** AWS SDK identity-chain fallback here. |
| `VIAT_RUST_S3_SECRET_KEY` | string; empty | D. Pairs with the access key; not forwarded to running workers by default. |
| `VIAT_RUST_S3_SESSION_TOKEN` | string; unset | D. Session token for temporary credentials; maintain its lifetime with your deployment credentials. |
| `VIAT_RUST_S3_PATH_STYLE` | boolean; off | D. Strict `1`/`true` uses path-style URLs for some S3-compatible stores. |
| `VIAT_RUST_S3_GC` | boolean; off | D. Strict `1`/`true` enables shared-artifact garbage collection after publishing. **Unsafe under mixed architectures/toolchains or rolling upgrades**; keep off unless the live set is provably complete. |

## A suggested tuning procedure

1. Start from each endpoint's execution budget: its source, clamping and
   predicted lane. `# timeout:` or workflow timeout declarations beat the
   project default; the deployment default applies only when both are
   missing. The async ceiling is independent of the sync one — raising
   `VIAT_MAX_TIMEOUT_SECS` never changes an always-async endpoint's async
   ceiling.
2. Tell apart **four kinds of waiting**: durable-queue wait, lane permits,
   shared-pool queue, worker READY. Turning a READY timeout into an
   execution timeout never fixes cold dependency installs — check image
   sources, packages, caches and build state.
3. Measure with representative scripts in an isolated project: cold/warm
   starts, tail latency, RSS, PIDs/threads, connections and disk growth;
   change one group of parameters at a time. No official cross-hardware
   throughput promise exists.
4. Short-request shared pool, dedicated slots, long runs, streams and
   in-process resource calls are **not one total concurrency number**;
   raising one limit may only move the bottleneck to the database or
   memory. See [capacity](../operations/capacity.md).

## Publishing and offline dependencies

- Default publishing attempts dependency builds, but a failed build does
  not necessarily block the route. To block: synchronous builds plus
  `VIAT_PUBLISH_BUILD_BLOCK=1`, verified against a failing publish in an
  isolated project. `VIAT_PUBLISH_BUILD_ASYNC=1` backgrounds builds and
  puts routes live first — never lean on synchronous-build protection at
  the same time. The regression gate and the build gate are different
  things.
- Offline dependencies: persist `/home/viat/.cache/uv`, configure trusted
  Python/npm mirrors, and empty `VIAT_PYTHON_PRELOAD` when appropriate.
  The image ships a prewarmed CPython 3.12 with the default psycopg2
  package cache — **not** offline availability for every user dependency;
  re-verify builds after rebuilding containers, clearing caches or changing
  dependency versions. Proxy/CA passthrough rules:
  [integrations](integrations.md).
- Rust: ordinary images carry no toolchain; compiling nodes use the
  matching `-build` artifact and verify the SDK; run-only nodes set
  `VIAT_BUILD_ENABLED=0` and receive shared artifacts or an authorized
  compatible upload. `VIAT_RUST_ARTIFACT_UPLOAD` turns on for the trimmed
  case-insensitive `1/true/yes/on/enabled` and off otherwise. **Never**
  expose compilation to untrusted authors — Cargo build scripts run with
  the compiling process's permissions.

## Scheduling, queues and restart recovery

- `SCHEDULER_ENABLED=false` stops only cron; durable queues, chat,
  queue triggers, file watches, alerts and retention cleanup keep running.
  A new cron's default timezone is written into its row; existing schedules
  need per-row edits. The misfire grace is **not** "replay everything
  missed during downtime".
- RabbitMQ: the default 1500-second ack deadline is below the 1800-second
  async ceiling, so creating/updating triggers can be refused. First align
  the broker's consumer timeout, the deployment execution ceilings and the
  ack deadline into one conservative budget; `ack_deadline_override`
  deliberately accepts redelivery-before-completion risk — it does not
  extend the broker limit. Consumption is at-least-once; keep handlers
  idempotent.
- Shutdown: queues stop claiming and background tasks try to drain;
  unstarted durable queue rows survive restarts. A running script is not a
  recoverable process — after a crash it may be marked interrupted/failed,
  and external side effects may already have happened. Check
  [runs operations](../operations/runs.md) before retrying.
