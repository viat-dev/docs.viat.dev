---
title: Configuration model and inventory
description: Choose the right configuration surface, apply changes safely, and distinguish server, image, installer, worker and client settings.
doc_id: configuration.overview
verified_release: '1.1.0'
channel: stable
---

# Configuration model and inventory

This manual describes stable **1.1.0**, not a future release. Start with [Docker Compose installation](../installation/docker-compose.md) or [binary/source installation](../installation/binary-source.md), then choose the reference below. All commands in these configuration/operations chapters are **operator-reviewed templates, not commands executed during documentation authoring**. Replace example names and secrets, review effects, and validate in an isolated installation before production.

## Configuration surfaces

| Surface | Who changes it | Persistence and precedence |
| --- | --- | --- |
| Process environment | Host/container operator | Server has no general YAML configuration file or configuration-reload API. Explicit container/process environment overrides image `ENV`; missing values use the individual runtime defaults below. Restart/recreate to change it. |
| Image and container | Docker administrator | Runtime image supplies interpreters/static assets and selected defaults. Compose `.env` is substitution input, **not automatic process environment**: the Compose service must forward each application variable. |
| Deployment wrapper | Host operator | `deploy-server.sh` reads a shell `.env`, not a passive dotenv file. Only use a trusted file. Wrapper controls are not application settings; see [network](network.md). |
| Instance settings | Platform Owner/Admin according to the setting | Stored in PostgreSQL; not a replacement for `DATABASE_URL`, master key, listener or worker configuration. |
| Project/endpoint/resource | Project member with the corresponding write/publish permission | Stored live drafts and published snapshots differ. Endpoint authentication/bindings/overrides normally require publish; draft test runs do not prove the published route changed. |
| CLI/MCP session | Local CLI user | `.viat/config.yaml` and client environment, not server knobs. See [integrations](integrations.md). |

There is no universal boolean parser. Use the spellings documented for each row: some switches recognize only literal lowercase `false`/`0`, some accept case-insensitive `no`, and positive opt-ins may require exactly `1`. A misspelled safety setting can leave the feature enabled.

## How to read every variable table

Every row gives **type, actual binary default, units/range, validation/fallback, scope and override behavior**. Unless marked **required**, a variable is optional. Unless a row says otherwise, an explicit valid value replaces its binary default; invalid numbers fall back to the displayed default. “Unset” is not the same as an empty string. Integers described as `u64`, `u32`, `u16`, `usize` or `i64` use that Rust integer's representable range; only additional product bounds are shown. `usize` is platform-sized. Keep operational values comfortably below numeric extremes.

Scope/reload codes used throughout:

- **S** — server startup/router construction; restart required.
- **F** — cached on first use for the server process; restart required.
- **D** — read when the indicated operation runs; no supported external mechanism mutates a running process's environment. Change the deployment environment and restart; this does **not** mean editing `.env` hot-reloads it.
- **W** — worker/compile spawn; existing workers keep their environment. Restart/rebuild environments after changing it.
- **C** — CLI/MCP invocation, not server. Rerun the client.
- **I** — installer/Compose/build input, not server. Rerun/recreate only after reviewing its side effects.

A project or script override exists only where explicitly stated. A deployment ceiling cannot be raised by an endpoint author. In particular, execution budgets resolve target timeout → project default → deployment default, then clamp to the applicable sync/async ceiling. Build budgets and proxy timeouts are separate.

## Complete reference by responsibility

- [Database](database.md): required platform PostgreSQL, resource database limits, migration timeout and real TLS limitations.
- [Security](security.md): keys, tokens, bootstrap, registration, MFA, worker identity, secret backends and SSRF switch.
- [Runtime](runtime.md): pools, lanes, execution/build/queue budgets, schedules and Rust artifacts.
- [Network and deployment](network.md): listener, public origin/prefix, TLS, console/docs, WebSockets, Compose and wrapper controls.
- [Storage](storage.md): filesystem allowlists, spooling, S3 buffers/multipart and artifact persistence.
- [Observability](observability.md): telemetry, metrics, line-log backends, history and retention settings.
- [Integrations and client scope](integrations.md): SMTP, chat/social gateways, package managers, proxy/CA forwarding, CLI/MCP and development-only inputs.

## Apply and verify a change

1. Record the running version/image digest, effective deployment file, current mounts and the reason for the change. Keep secret values out of tickets and process listings.
2. Check the applicable row, including Docker versus binary defaults and per-node versus shared scope. On a fleet, use consistent keys, public URL and backend selection.
3. Back up before migrations, key/backend changes or shorter retention; follow [backup and restore](../operations/backup-restore.md). Do not “rotate” the master key by replacing its environment variable.
4. Edit the actual service environment. A newly added line in Compose `.env` alone does nothing unless the service forwards it. In a system service, use the service manager's environment mechanism; the binary itself does not load `.env`.
5. Restart gracefully and inspect startup logs. Startup connects to PostgreSQL with a 10-connection pool, applies bundled migrations, seeds an initial Owner if configured, initializes backends and starts background loops before serving.
6. Check `/healthz`, `/readyz`, authenticated `/version`, login, and one isolated project request. A healthy probe does not prove activation, dependencies, external credentials or notification delivery.
7. If behavior is wrong, restore the previous non-destructive setting and restart. Database migration rollback and deleted retention data require the recovery procedure, not merely an older image.

## Runtime defaults are not Docker defaults

The binary allows registration when unset; the official image sets `VIAT_ALLOW_REGISTRATION=false`. The image also sets `VIAT_WEB_DIR=/app/web`, `VIAT_DOCS_DIR=/app/docs`, `VIAT_BIND=0.0.0.0:8080`, `VIAT_SHELL_BIN=/bin/bash`, `SCHEDULER_ENABLED=true`, `RUST_LOG=info`, and `HOME=/home/viat`. The `-build` image additionally sets Rust SDK/artifact/target and Cargo/rustup paths. A slim image has no Rust compiler even though the binary's build switch defaults on. Docker's example `4g` memory and `512` PID limits are container examples, **not application defaults or measured capacity**.

## Maintenance evidence

Behavior was checked against the pinned implementation's `crates/viat-api/src/config.rs` (including `AppConfig::from_env`), startup, runtime pool/lane/Rust/worker settings, backend constructors, `Dockerfile`, Compose and deployment scripts. Environment strings used only in tests, injected worker context and build tools are explicitly classified in [integrations](integrations.md); they are not supported server toggles. No archived plan is used as a behavior contract.
