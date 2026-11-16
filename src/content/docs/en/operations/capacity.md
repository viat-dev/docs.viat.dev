---
title: Capacity planning and tuning
description: Budget CPU, memory, workers, connections, storage and queues using measurements rather than invented throughput or HA guarantees.
doc_id: operations.capacity
verified_release: '1.1.0'
channel: stable
---

# Capacity planning and tuning

There is no hardware-independent throughput benchmark and no blanket HA
guarantee. Capacity is a property of **your scripts, dependencies, payloads,
databases, object stores and deployment controls**. Division of labor:
host/container operators own resource limits, developers own script budgets
and idempotency — coordinate before raising parallelism.

## Build budgets, not one concurrency number

| Component | Default/constraint | Budget meaning |
| --- | --- | --- |
| Shared warm pool | 16 slots, queue 32, wait 5 s | Short-task Python/TypeScript processes and imports; dedicated slots add **on top**. |
| Long-run lane | 8 concurrent, sync wait 5 s | One-shot processes can hold memory for minutes; durable queues wait instead of rejecting. |
| Streaming lane | 8 concurrent, wait 30 s | Long-lived connection/process occupancy; slow consumers/proxy buffers pin resources. |
| Async in-flight | 128 per process | An admission limit, **not** "128 guaranteed CPUs". |
| Durable queue | 1000 waiting per key, 100000 pure-delay | Rows retain request/identity/target; **queue age matters as much as depth**. |
| Platform PostgreSQL | Pool of 10 per process + more | Reserve for notifications/background/admin/backup; no supported pool-size variable. |
| Business DB pools | PostgreSQL/MySQL typically 8 per resource/process | Multiply by active resources and instances, plus the database's own quota. |
| WebSocket | 10000 per process, queue 32, message 64 KiB | A **protocol ceiling**, not measured capacity; memory/FDs may hit first. |
| Response cache | Default 64 MiB weight budget per process | Plus metadata/allocator overhead; Redis needs its own planning. |
| Uploads/builds/logs | Spool, uv, Cargo target, artifacts, logs | Budget disk/inode/IO separately; the artifact LRU does not bound Cargo target. |

Exact parsing, overrides and scopes: [runtime](../configuration/runtime.md),
[storage](../configuration/storage.md), [network](../configuration/network.md).
Note: one-shot processes, in-process SQL, resource calls and workflow fan-out
are **not all** governed by the shared pool — it is not a universal
process/query gate.

## Establish a representative baseline

In an isolated pre-production project, with desensitized real inputs and the
same interpreter/image class, measure separately:

1. Cold dependency/build versus hot execution — testing only the hot path
   hides publish/first-call failures.
2. Short sync, long async, streaming, nested/parallel workflows and
   database-heavy targets.
3. End-to-end p50/p95/p99, queue wait/age, rejection/timeout rates, CPU,
   RSS/peak, PIDs/threads, FDs, database connections/locks, disk/inode
   growth.
4. Dependency/cache/collector failures and restart recovery. No paid or real
   provider calls without explicit approval.

Stop **before** resources are exhausted; record load, versions, limits and
measurements. Change one control group at a time and re-measure under the
same load; keep headroom for restarts, background cleanup and bursts.
**One successful request is not sustainable capacity.**

## Container and compilation constraints

- The Compose/deploy-script example of **512 PIDs and 4g memory** is a
  starting point, not a fit for every workload.
- Docker's PID quota **includes threads**; Cargo/rustc spawn far more than
  "a few processes". Compile nodes usually need separately measured budgets
  and a controlled `CARGO_BUILD_JOBS`; moving compilation contention off
  low-latency execution nodes helps but **does not automatically become** a
  guaranteed HA topology.
- Runaway allocation or forking can kill the whole container: keep
  memory/PID limits and security constraints; never "fix" with permanently
  unbounded resources or `seccomp=unconfined`. Distinct worker UIDs are not
  per-script cgroup sandboxes. FD limits belong to the service
  manager/container host after measurement — **there is no** Viat
  environment variable to invent here.

A **read-only observation template** for a real Docker host (unexecuted):

```sh
docker stats --no-stream viat-server
docker inspect --format '{{.State.Status}} {{.RestartCount}}' viat-server
docker logs --since 15m viat-server
df -h
df -i
```

View logs privately and substitute your actual container name; these
commands neither measure nor modify production capacity automatically.

## Multi-node behavior and limits

- Shared-PostgreSQL coordination covers published-route refresh,
  claims/leases and some background tasks. Still local: warm workers, the
  default response cache, endpoint rate-limit buckets.
- Shared Redis cache and rate limiting are enabled separately; on limit
  failure it degrades to local, on cache failure reads count as misses.
  Shared artifact/dependency caches need explicit persistence and
  toolchain/architecture coordination. Local file watches/storage **do not**
  replicate.
- Keep consistent across nodes: master key/JWT, public URL, backends and
  compatible artifacts. Sum database/resource connections and external
  quotas across the cluster; validate load balancing, streaming/WebSocket
  and node loss against the real topology.
- Readiness deliberately does **not** remove a node just because database
  pool connections are busy — `pool:saturated` can return 200; so
  **readiness is no substitute for load monitoring**.
- Locks/leases/heartbeats reduce duplicate work and promise neither
  exactly-once nor zero interruption; database/network partitions and
  committed external actions still rely on idempotency. The deployment
  script force-replaces a single container — it is **not** an HA rolling
  orchestrator.

## Tune by cause

| Symptom | Do this first |
| --- | --- |
| READY timeouts | Fix packages, caches, toolchain/sources and persist warmup — not the execution timeout |
| 503 waits | Inspect shared/long-run/streaming lanes, durations and downstream limits; do not just widen every queue |
| DB pool/lock waits | Reduce fan-out, fix queries/transactions, reserve capacity; adding replicas can worsen it |
| Large outputs/uploads eating memory | Use supported streaming interfaces and keep helper/entry limits; bigger buffers multiply by concurrency |
| Queue growth | Throttle producers, rebalance work, prefer idempotent recovery, watch the **oldest age**; more backlog ≠ more throughput |

If errors/latency/resources worsen after tuning: restore the baseline, keep
experiment records, and re-check [backup](backup-restore.md),
[alerts](alerts.md) and [upgrades](upgrades.md) under the new limits.
