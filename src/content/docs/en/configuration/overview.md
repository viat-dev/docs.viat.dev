---
title: Configuration model and inventory
description: Choose the right configuration surface, apply changes safely, and distinguish server, image, installer, worker and client settings.
doc_id: configuration.overview
verified_release: '1.1.0'
channel: stable
---

# Configuration model and inventory

This manual describes stable **1.1.0**. This page answers three questions:
where a setting lives, who may change it, and how to verify the change. The
full variable tables per topic (database/security/runtime/network/storage/
observability/integrations) are reached through the index below.

> [!WARNING]
> Every command in the configuration and operations chapters is an
> **operator-reviewed template, not something executed while authoring this
> documentation**. Replace example names and secrets, review effects, and
> validate in an isolated installation before production. First-time
> deployments should start with [Docker Compose installation](../installation/docker-compose.md)
> or [binary/source installation](../installation/binary-source.md).

## Configuration surfaces

| Surface | Operator | Persistence and precedence |
| --- | --- | --- |
| Process environment | Host/container operations | No generic YAML config file and no unified reload API. Explicit process/container environment overrides image `ENV`; unset uses the actual runtime defaults in the tables; restart/recreate to apply. |
| Image and container | Docker administrator | The image supplies interpreters, static files and some defaults. Compose `.env` is variable substitution only and is **not injected into the process** — the service's `environment` (or equivalent) must pass variables explicitly. |
| Deployment wrapper scripts | Host operations | `deploy-server.sh` loads `.env` as a **shell script**, not passive dotenv — trusted files only; script variables ≠ application config, see [network configuration](network.md). |
| Instance settings | Platform Owner/Admin with the right permission | Stored in PostgreSQL; they never replace database connection, master key, listener or worker configuration. |
| Projects, endpoints, resources | Project members with edit/publish rights | Drafts ≠ published snapshots; endpoint auth/bindings/overrides usually need publishing — a passing draft test does not mean the route changed. |
| CLI/MCP sessions | The local client user | `.viat/config.yaml` and the client environment — not server parameters, see [integrations](integrations.md). |

> [!NOTE]
> Booleans have **no uniform parsing rule**: some switches accept only
> lowercase `false`/`0`, some a case-insensitive `no`, and some enable-flags
> require a literal `1`. A misspelled security switch can leave the feature
> on — always verify after changing.

## Conventions used in the variable tables

Every entry states **type, the binary's actual default, unit/range,
validation and fallback, scope and precedence**. Everything is optional
unless marked **required**. Unless stated otherwise: a legal explicit value
replaces the runtime default; numeric parse failures fall back to the listed
default; "unset" is not an empty string. `u64`/`u32`/`u16`/`usize`/`i64`
follow their Rust integer ranges (`usize` is platform-dependent), with
additional product constraints listed — **never treat a theoretical maximum
as an operable value**.

Scope and reload codes:

| Code | Meaning |
| --- | --- |
| **S** | Read at startup or route build; restart required. |
| **F** | Cached in-process after first use; restart required. |
| **D** | Read when the related operation executes; there is no generic way to mutate a running process's environment from outside — a deployment change still needs a restart, and **editing `.env` does not hot-reload**. |
| **W** | Read when a worker/compile process is created; existing workers are unaffected; restart and rebuild the affected environments after changing. |
| **C** | This CLI/MCP invocation only, nothing server-side; rerun the client. |
| **I** | Installer/Compose/image-build input, not a server parameter; redeploy/rebuild after confirming effects. |

Projects or scripts override only where explicitly noted; endpoint authors
cannot break deployment ceilings. Execution timeouts pick "target declaration
→ project default → deployment default" and then respect the sync/async
caps; build budgets and proxy timeouts are separate parameters.

## Find your topic

- [Database](database.md): platform PostgreSQL, resource connection limits,
  migration timeouts and the real TLS limits.
- [Security](security.md): keys, tokens, bootstrap accounts, registration,
  MFA, worker identity, secret backends and SSRF switches.
- [Runtime](runtime.md): pools, execution lanes, run/build/queue budgets,
  scheduling and Rust artifacts.
- [Network and deployment](network.md): listeners, public URL and prefixes,
  TLS, console/built-in docs, WebSocket, Compose and deployment scripts.
- [Storage](storage.md): directory allowlists, upload staging, S3
  buffering/multipart and artifact persistence.
- [Observability](observability.md): logs, metrics, tracing, line-log
  backends, history and retention.
- [Integrations and clients](integrations.md): SMTP, chat/social gateways,
  package managers, proxy/CA passthrough, CLI/MCP and dev-only inputs.

## Change, verify, recover

1. Record the current version, image digest, deployment files, mounts and
   the reason for the change; **never put secret values into tickets or
   process command lines**.
2. Check the item's Docker/binary differences and its single-node vs shared
   scope; keys, public URLs and backend choices must agree across nodes.
3. Before migrations, key/backend changes or retention reductions, complete
   a [backup](../operations/backup-restore.md) — swapping the master key
   directly is not a rotation procedure.
4. Change the **actual service environment**: adding a line to Compose
   `.env` without passing it into the service does nothing; system services
   use the service manager's environment configuration; the binary itself
   never loads `.env`.
5. Restart gracefully and read the startup logs: startup builds the platform
   database pool (capped at 10 connections), runs built-in migrations,
   creates the initial Owner when needed, initializes backends, starts
   background loops and then serves.
6. Check `/healthz`, `/readyz`, the authenticated `/version`, sign-in and an
   isolated project request — healthy probes **do not** prove activation,
   dependencies, external credentials or notification delivery.
7. On trouble, restore the previous non-destructive configuration and
   restart; database migration rollbacks and deleted data go through the
   recovery procedure — never merely swap back an old image.

## Runtime defaults ≠ Docker defaults

The bare binary allows registration when unconfigured; the official image
sets `VIAT_ALLOW_REGISTRATION=false`. The image also sets
`VIAT_WEB_DIR=/app/web`, `VIAT_DOCS_DIR=/app/docs`,
`VIAT_BIND=0.0.0.0:8080`, `VIAT_SHELL_BIN=/bin/bash`,
`SCHEDULER_ENABLED=true`, `RUST_LOG=info` and `HOME=/home/viat`; `-build`
images add the Rust SDK, artifact/target directories and Cargo/rustup paths.
Ordinary images contain no Rust compiler even though the binary's build
switch defaults on. The `4g` memory and `512` PID limits in the deployment
example are **container examples — not application defaults and not measured
capacity**.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/config.rs` (including
`AppConfig::from_env`), the startup sequence, runtime pool/lane/Rust/account
configuration, backend construction, the `Dockerfile`, Compose and
deployment scripts. [Integrations](integrations.md) separately categorizes
test-only, worker-injected and build-tool variables — they are not server
switches. Archived plans are never evidence of current behavior.
