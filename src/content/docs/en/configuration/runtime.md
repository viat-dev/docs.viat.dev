---
title: Runtime, build and scheduling configuration
description: Complete deployment settings for pools, execution lanes, builds, durable queues, scheduling and Rust artifacts.
doc_id: configuration.runtime
verified_release: '1.1.0'
channel: stable
---

# Runtime, build and scheduling configuration

Read [overview](overview.md) for S/F/D/W and restart semantics. All variables here are optional except stated conditional compilation requirements. Units differ: pool deadlines generally use milliseconds; execution/lane deadlines generally use seconds.

## Execution and admission

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_DEFAULT_TIMEOUT_SECS` | u64; `30` s | D. Positive; 0/invalid → default. Fallback after target declaration and project default, then clamped to ceiling. |
| `VIAT_MAX_TIMEOUT_SECS` | u64; `300` s | D. Positive sync ceiling; 0/invalid → default. Target/project can lower, not raise. Also influences stale idempotency/upload sweep horizons. |
| `VIAT_MAX_ASYNC_TIMEOUT_SECS` | u64; `1800` s | D. Positive async ceiling; 0/invalid → default. Queue-trigger validation parses positive i64 and compares to ack deadline. |
| `VIAT_ASYNC_MAX_INFLIGHT` | usize; `128` runs | F. Positive, per-process inflight semaphore. Separate from queued depth and long-run/stream permits. |
| `VIAT_SHARED_MAX_TIMEOUT_SECS` | u64; `60` s | D. Positive; resolved timeouts at or above this threshold enter long-run lane where applicable. Not an execution ceiling. |
| `VIAT_LONGRUN_MAX_CONCURRENT` | usize; `8` runs | F. Positive; per-process long-running one-shot permits. Does not bound every in-process database/SQL operation. |
| `VIAT_LONGRUN_QUEUE_WAIT_SECS` | u64; `5` s | D. Positive; synchronous callers wait this long for a long-run permit before 503. Durable queued work can wait until cancellation instead. |
| `VIAT_STREAM_MAX_CONCURRENT` | usize; `8` streams | F. Positive; per-process streaming worker permits, distinct from shared pool. |
| `VIAT_STREAM_QUEUE_WAIT_SECS` | u64; `30` s | D. Positive; wait for streaming lane admission, not stream execution lifetime. |
| `VIAT_QUEUE_MAX_DEPTH` | i64; `1000` runs | D. Positive; waiting runs per concurrency key; full queue refuses new submissions. |
| `VIAT_DELAY_MAX_DEPTH` | i64; `100000` runs | D. Positive; delay-only backlog cap using synthetic _delay key. Not execution concurrency. |
| `VIAT_QUEUE_POLL_MS` | u64; `1000` ms | D (dispatcher initialization). Positive; periodic claim scan in addition to local wakeups. Lowering increases database work. |
| `VIAT_TASK_MAX_DEPTH` | u16; `100` hops | D. Positive; recursive task.call/task.delay hop ceiling, not number of sibling tasks. |
| `VIAT_QUEUE_ACK_DEADLINE_SECS` | i64; `1500` s | D. Positive RabbitMQ acknowledgment budget. Default async ceiling 1800 exceeds it: configure a coherent ceiling/deadline, or explicitly accept trigger ack_deadline_override risk. |
| `VIAT_SHUTDOWN_GRACE_SECS` | u64; `10` s | D (shutdown). 0 is accepted; grace drain budget, not durable checkpointing of running scripts. Container stop deadline must be longer. |

## Worker pool and environment lifecycle

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_POOL_SHARED_MAX` | usize; `16` workers | S. Shared warm-slot capacity. Parser accepts 0; use at least 1 operationally. Dedicated/one-shot lanes add capacity outside this value. |
| `VIAT_POOL_QUEUE_DEPTH` | usize; `32` requests | S. Shared-pool waiting queue; 0 accepted. Distinct from durable async queue. |
| `VIAT_POOL_QUEUE_WAIT_MS` | u64; `5000` ms | S. Pool wait deadline; 0 accepted, effectively no grace. |
| `VIAT_POOL_READY_TIMEOUT_MS` | u64; `10000` ms | S. Request-path worker READY timeout, not script execution budget; 0 accepted but unusable for normal cold starts. |
| `VIAT_POOL_BUILD_TIMEOUT_MS` | u64; `300000` ms | S. Publish/environment build default. Script build-timeout declaration can override within build_timeout_max; 0 accepted by parser. |
| `VIAT_POOL_BUILD_TIMEOUT_MAX_MS` | u64; `3600000` ms | S. Deployment ceiling for script build-timeout declarations. 0 accepted by parser; keep coherent with default. |
| `VIAT_POOL_AUTO_PROMOTE_QPS` | f64; `10.0` requests/s | S. Auto promotion threshold; 0.0 disables auto switching. No robust finite/nonnegative validation; use finite nonnegative values. |
| `VIAT_POOL_AUTO_DEMOTE_QPS` | f64; `2.0` requests/s | S. If promote >0 and demote >= promote, effective demote becomes promote/2. Use finite nonnegative value. |
| `VIAT_POOL_AUTO_WINDOW_SECS` | usize; `60` s | S. Rolling QPS window, clamped to at least 1. |
| `VIAT_POOL_AUTO_DEDICATED_COUNT` | usize; `2` workers | S. Slots on auto promotion, clamped to at least 1. Adds processes; not a CPU reservation. |
| `VIAT_POOL_AUTO_MIN_DWELL_SECS` | u64; `60` s | S. Minimum promoted dwell before demotion; 0 accepted. |
| `VIAT_POOL_AUTO_TICK_SECS` | u64; `5` s | S. Reconciliation tick, clamped to at least 1. |
| `VIAT_BOOT_WARM` | boolean; on / 开启 | S. Literal 0/false disables background boot environment warming. Does not block HTTP startup; warming can still be incomplete when readyz is green. |
| `VIAT_ENV_GATE` | boolean; off / 关闭 | D. Exactly 1/true enables refusing runs whose environment is known failed. Default off; does not itself install dependencies. |
| `VIAT_ENV_RETRY_BACKOFF_SECS` | i64; `300` s | D. Failed environment retry backoff, clamped to >=0. Zero permits immediate retry. |
| `VIAT_PYTHON_PRELOAD` | string; `psycopg2-binary` | W. Space/comma-separated package specs; explicit empty value disables preloads. This changes environment/dependency needs, not just logging. |
| `VIAT_SHELL_BIN` | path; `/bin/bash` | W. Shell executable must exist and be worker-executable. Docker explicitly supplies /bin/bash. |

## Publication, schedules and Rust

| Variable | Type; binary default | Range, scope and override |
| --- | --- | --- |
| `VIAT_PUBLISH_BUILD_BLOCK` | boolean; off / 关闭 | D. Exactly 1/true blocks publish with 409 on build failure. Default records diagnostics but does not block; not a substitute for regression gate. |
| `VIAT_PUBLISH_BUILD_ASYNC` | boolean; off / 关闭 | D. Exactly 1/true starts builds in background while routes go live; do not expect synchronous build blocking to protect those routes. |
| `VIAT_PUBLISH_REGRESSION_TIMEOUT_SECS` | u64; `120` s | D. Whole publish regression-suite budget; parsed value clamped 1..3600. |
| `SCHEDULER_ENABLED` | boolean; `true` | S. Literal false/0 disables scheduler only. Image sets true. Queue, alerts, chat, watchers and retention are separate loops. |
| `VIAT_DEFAULT_SCHEDULE_TZ` | IANA zone; `UTC` | D (schedule writes). Trimmed; blank → UTC; unknown zone rejects write. Stored per schedule; changing deployment default does not retime existing schedules. |
| `VIAT_SCHEDULE_MISFIRE_GRACE_SECS` | i64; `60` s | D. Positive; maximum lateness for a due cron fire before recording/skipping a misfire. Not replay of every missed occurrence. |
| `VIAT_RUST_AUTHORING` | boolean; on / 开启 | D. Trim/case-fold 0/false/off/no/disabled rejects Rust create/update (400 bad_request). Existing published binaries can still run. |
| `VIAT_BUILD_ENABLED` | boolean; on / 开启 | D. Same falsy set as Rust authoring disables compilation here. SDK/toolchain still needed when on. Run-only node needs compatible prebuilt artifacts. |
| `VIAT_RUST_ARTIFACT_UPLOAD` | boolean; off / 关闭 | D. Explicit artifact-upload opt-in; see exact accepted spelling below. Allows authorized upload, not unauthenticated executable deployment. |
| `VIAT_RUST_SDK_PATH` | path; unset / 未设置 | D. Required to compile, not to fetch/run compatible artifacts. -build image: /opt/viat/rust-sdk; SDK digest must match server. |
| `VIAT_RUST_ARTIFACT_DIR` | path; `<tmp>/viat-rust-artifacts` | D. Local binaries/cache. -build image: /var/lib/viat/rust-artifacts. Persist or supply shared store; local-only cache is not fleet distribution. |
| `VIAT_RUST_TARGET_DIR` | path; `<tmp>/viat-rust-build` | D. Cargo target directory. -build image: /var/lib/viat/rust-target. Separate disk budget from artifact LRU. Also client-side compile override. |
| `VIAT_RUST_BUILD_TIMEOUT_SECS` | u64; `300` s | D. One cargo build deadline; 0 accepted. Separate from Python READY/build budgets and CLI wait timeout. |
| `VIAT_RUST_CACHE_MAX_BYTES` | u64; `5368709120` bytes | D. Local artifact cache cap (5 GiB), LRU eviction; 0 disables cap. Does not cap Cargo target directory or shared bucket. |
| `VIAT_RUST_S3_BUCKET` | string; unset / 未设置 | D. Nonblank enables shared artifact bucket with local cache in front. Not a project S3 resource. |
| `VIAT_RUST_S3_REGION` | string; `us-east-1` | D. Empty/blank → default. Used for signing and endpoint derivation. |
| `VIAT_RUST_S3_ENDPOINT` | URL; derived / 自动推导 | D. Override for compatible object stores; absent derives regional AWS S3 endpoint. |
| `VIAT_RUST_S3_ACCESS_KEY` | string; empty / 空 | D. Explicit platform artifact credential; practically required with bucket for authenticated stores. No AWS SDK identity-chain fallback in this configuration. |
| `VIAT_RUST_S3_SECRET_KEY` | string; empty / 空 | D. Pair with access key; not forwarded to guest workers by default. |
| `VIAT_RUST_S3_SESSION_TOKEN` | string; unset / 未设置 | D. Optional temporary-credential session token; maintain its validity with deployment credentials. |
| `VIAT_RUST_S3_PATH_STYLE` | boolean; off / 关闭 | D. Exactly 1/true uses path-style URLs, useful for compatible stores. |
| `VIAT_RUST_S3_GC` | boolean; off / 关闭 | D. Exactly 1/true enables shared artifact garbage collection after publish. Unsafe across mixed architectures/toolchains or rolling upgrades; keep off unless live-set is demonstrably complete. |

## A tuning procedure

1. Inspect the endpoint's effective budget: source, clamp and predicted lane. `# timeout:` or workflow timeout wins over project default; deployment default is only the fallback. Sync and async ceilings are independent. Raising `VIAT_MAX_TIMEOUT_SECS` does not raise an always-async endpoint's ceiling.
2. Separate durable-queue wait, lane-permit wait, shared-pool wait and worker READY. Changing execution timeout does not repair a dependency installation that exceeds READY; check package source, dependency, cache and environment build status.
3. Measure representative scripts in an isolated project: cold/warm startup, tail latency, RSS, PIDs/threads, connections and disk growth. Change one parameter group at a time. No cross-hardware throughput benchmark is promised here.
4. Shared short runs, dedicated slots, long runs, streams and in-process resource calls are not one global concurrency count. Raising one limit can just move the bottleneck to PostgreSQL or memory. See [capacity](../operations/capacity.md).

## Publication and offline dependencies

Default publication attempts dependency builds, but a failed build need not prevent routes becoming active. For blocking, use synchronous builds with `VIAT_PUBLISH_BUILD_BLOCK=1` and verify failure responses in an isolated project. `VIAT_PUBLISH_BUILD_ASYNC=1` starts background builds while routes go live; do not rely on synchronous blocking in that mode. Regression-test gates and build gates are separate.

Persist `/home/viat/.cache/uv`, configure trusted Python/npm mirrors, and explicitly empty `VIAT_PYTHON_PRELOAD` if appropriate. The image warms CPython 3.12 and the default psycopg2 cache; this does not make all user dependencies offline-ready. Revalidate builds after replacing containers, clearing caches or changing dependency versions. Proxy/CA forwarding is covered in [integrations](integrations.md).

The slim image has no Rust toolchain. Nodes that compile need the matching `-build` artifact and SDK validation. Run-only nodes use `VIAT_BUILD_ENABLED=0` and shared artifacts or an authorized compatible upload workflow. `VIAT_RUST_ARTIFACT_UPLOAD` enables on trimmed, case-folded `1`, `true`, `yes`, `on`, `enabled`; other values disable it. Do not give untrusted authors build capability: Cargo build scripts execute with the builder's privileges.

## Schedules, queues and restart recovery

`SCHEDULER_ENABLED=false` stops cron only, not the durable queue, chat, queue triggers, watches, alerts or retention. The default timezone is written into new cron rows; edit existing schedules explicitly to change their timezone. Misfire grace is not replay of every occurrence missed during downtime.

RabbitMQ's default 1500-second acknowledgment deadline is below the 1800-second async ceiling, so trigger creation/update can be refused. First reconcile broker consumer timeout, deployment execution ceiling and acknowledgment budget; `ack_deadline_override` accepts the risk of redelivery while the previous run still executes, not an extension of the broker's limit. Consumption is at-least-once; handlers should be idempotent.

Shutdown stops queue claims and tries to drain background work. Not-yet-started durable queued rows survive replacement. Running scripts are not resumable processes: after a crash they may be marked interrupted/failed while external side effects have already occurred. Before replay, use [run operations](../operations/runs.md).
