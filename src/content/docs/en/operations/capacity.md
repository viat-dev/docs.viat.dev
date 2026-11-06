---
title: Capacity planning and tuning
description: Budget CPU, memory, workers, connections, storage and queues using measurements rather than invented throughput or HA guarantees.
doc_id: operations.capacity
verified_release: '1.1.0'
channel: stable
---

# Capacity planning and tuning

There is no hardware-independent request-rate benchmark or blanket HA guarantee. Capacity is a property of **your scripts, dependencies, payloads, databases, object stores and deployment controls**. Host/container operators own resource limits; project developers own reasonable script budgets and idempotency. Coordinate both before increasing parallelism.

## Build a budget, not a single concurrency number

| Component | Default/constraint | Budget implication |
| --- | --- | --- |
| Shared warm pool | 16 slots, queue 32, wait 5s | Python/TypeScript short-run processes plus imports; dedicated slots add outside shared capacity |
| Long-run lane | 8 concurrent, 5s synchronous wait | One-shot processes can hold memory for minutes; durable queue can wait rather than shed |
| Streaming lane | 8 concurrent, 30s wait | Connections and processes remain open; slow consumers/proxy buffering can pin resources |
| Async inflight | 128/process | Separate admission cap, not 128 independent guaranteed CPU shares |
| Durable queue | 1000 waiting/key; delay-only cap 100000 | Rows retain request/identity/target data; queue age is as important as depth |
| Platform PostgreSQL | Pool max 10/process plus other connections | Add notification/background/admin/backup headroom; no supported pool-size env knob |
| Cached business DB pools | Common PostgreSQL/MySQL max 8/resource/process | Multiply by active resources and replicas; account for the database's own limits |
| WebSockets | 10000 connections/process; queue 32; message max 64 KiB | Defaults are protocol caps, not measured support; memory/FD budget can be lower |
| Response cache | 64 MiB/process weighted budget by default | Plus metadata/allocator/process overhead; Redis is another system to size |
| Uploads/builds/logs | Spool, uv cache, Cargo targets, artifacts and logs | Separate disk/inode/IO budgets; artifact LRU does not bound Cargo targets |

See [runtime](../configuration/runtime.md), [storage](../configuration/storage.md) and [network](../configuration/network.md) for exact parsers, overrides and scope. One-shot/in-process SQL/resource paths and workflow fan-out mean the shared pool is not a universal process/query governor.

## Establish a representative baseline

In an isolated staging project, use realistic but sanitized inputs and the same interpreters/image class as production. Measure separately:

1. Cold dependency/build startup versus warmed execution; a warm-only benchmark hides publish/first-call outages.
2. Short sync, long async, stream, nested workflow/parallel steps and database-heavy targets.
3. End-to-end p50/p95/p99 latency, queue wait/age, rejection/timeout rates, CPU, RSS/peak memory, PIDs/threads, open FDs, DB connections/locks and disk/inode growth.
4. Failures of a dependency/cache/collector and recovery after a restart. No paid/live provider calls without explicit approval.

Stop before resource exhaustion and record the workload/version/limits with measurements. Change one control group, repeat the same workload and preserve headroom for a restart, background sweep and burst. Do not infer sustainable capacity from a single successful request.

## Container and compiler constraints

The Compose/wrapper example uses **512 PIDs and 4g memory**. These are starting examples, not safe values for every workload. Docker PID limits include threads: Cargo and rustc can consume many more than a handful of processes. A build node often needs a separate larger tested budget and controlled `CARGO_BUILD_JOBS`; moving its compiler contention away from latency-sensitive runners can help, but does not itself establish a supported HA topology.

Runaway allocation or fork loops can kill the whole container. Keep memory/PID limits and security confinement; never fix this by permanently setting unlimited resources or `seccomp=unconfined`. Distinct worker UID is not a cgroup sandbox per script. Set OS file-descriptor limits with the service manager/container host only after measuring sockets/files, not by an invented Viat environment variable.

Useful **unexecuted, read-only observation templates** on the actual Docker host:

```sh
docker stats --no-stream viat-server
docker inspect --format '{{.State.Status}} {{.RestartCount}}' viat-server
docker logs --since 15m viat-server
df -h
df -i
```

Inspect log output privately. Container names must match your deployment; these commands do not size or modify production automatically.

## Fleet behavior and its limits

Nodes sharing PostgreSQL coordinate published-route refreshes/claims/leases and some background work. Local warm workers, default response caches and endpoint-limit buckets are still per node. Shared Redis response cache and limiter are separate opt-ins; limiter outages fall back locally, cache outages become misses. Shared artifacts/dependency caches need deliberate persistence and compatible toolchains/architecture. Local file watches/storage are not magically replicated.

Use the same master/JWT keys, public URL, backend configuration and compatible artifacts across nodes. Sum database/resource connections and external rate quotas across the fleet. Validate load-balancer routing, streaming/WebSocket behavior and node interruption with your topology. Readiness deliberately does **not** evict a node just because all existing DB pool connections are busy; `pool:saturated` can be 200. Therefore measure saturation directly, not via readiness alone.

Advisory locks/leases/heartbeats reduce duplicate work but are not exactly-once execution or zero-downtime guarantees. Database/network partitions and already-committed external actions still require idempotency. The deployment wrapper forcibly replaces one container and is not an HA rolling orchestrator.

## Tune the cause

- READY timeout: package/cache/tool issue; prewarm/persist/fix mirrors before raising execution limits.
- 503 queue wait: determine shared/long/stream lane, workload duration and downstream limit; do not just deepen every queue.
- DB pool/lock wait: reduce fan-out, fix queries/transactions, reserve DB capacity; adding replicas can worsen it.
- Large output/upload memory: stream where supported, keep helper/cache entry limits; raising buffers multiplies by concurrent requests.
- Growing queues: cap producers, partition work intentionally, prioritize idempotent recovery and inspect oldest age. More queued work is not more throughput.

After tuning, restore baseline if error/latency/resource regression appears, retain the experiment record and revalidate [backup](backup-restore.md), [alerts](alerts.md) and [upgrades](upgrades.md) under the chosen limits.
