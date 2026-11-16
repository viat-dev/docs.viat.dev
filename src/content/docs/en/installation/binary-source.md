---
title: Binaries and source builds
description: Distinguish released CLI binaries from server source builds and supply the runtime configuration a source-built server actually needs.
doc_id: installation.binary-source
verified_release: '1.1.0'
channel: stable
---

# Binaries and source builds

The simplest stable-server installation is
[Docker Compose](docker-compose.md). Two program names to keep apart:
`viat` is the **management CLI**, not a combined server installer; the
server executable is `viat-api`. This page covers identifying the
binaries and building a pinned source checkout when you deliberately
maintain a developer-managed installation.

## Confirm before choosing

- You need: host install/run permissions, a controllable PostgreSQL
  database, protected secret storage, and a valid activation code
  **matching** the verifying key compiled into the chosen server build.
  Source builds **bypass no activation**, and "customers generate signing
  keys" is not an activation step.
- Source builds additionally need: the release's Rust toolchain
  (`rust-toolchain.toml` pins `1.98`), Cargo, a C linker and platform
  development libraries; Node/npm to build the browser console — using
  the repository-root lockfile/workspaces, **never** a separate install
  inside `web/`; `uv` for Python scripts, `bun` for TypeScript and
  Bash/`jq` for shell capabilities (compiling the server installs
  **none** of these interpreters); network access for build
  dependencies and, when needed, runtime package installation.
- This page promises **no** downloadable native server installer and no
  signed Windows/Linux desktop distribution. Apple client installation
  and its bundled CLI: [clients](clients.md); this manual establishes no
  public artifact download URL.

## Identify what you already have

For an installed CLI:

```sh
command -v viat
viat --version
viat version
```

This baseline's `viat --version` should answer `viat 1.1.0`. `viat
version` always reports the local CLI and adds the server version only
when the configured session can read `/version` — "Version unavailable"
is not necessarily a binary problem; it can be signed-out, network
failure or an older server.

The official container ships `/usr/local/bin/viat-api` and
`/usr/local/bin/viat`. **Never** assume a Linux binary copied out of the
image runs on macOS/Windows — architecture and shared-library
requirements still apply.

## Deliberately build stable source

Use a product working copy obtained through the authorized source
distribution channel; before compiling at the root, confirm the
server/CLI release commit:

```sh
git checkout --detach fd340879
git rev-parse HEAD
```

`fd340879` is the server/CLI 1.1.0 release baseline. The later
documentation contract baseline `03751a67` additionally contains Apple
release tooling — which **does not make** every later branch a new
stable server version; never check out unreleased Widget/APNs branches
and ship them as stable.

### Containerized source build

With Docker, specify the target explicitly to avoid accidentally
building the final compilable variant stage:

```sh
docker build --target runtime -t viat-local:1.1.0 .
```

- Expect a local image containing the server, CLI, console and reference
  handbook. The command only builds locally: no push, no running
  service; it needs significant time/disk/downloads and the Dockerfile
  compiles with the committed SQLx cache. To deploy, change
  `viat.image` in [Docker Compose](docker-compose.md) to
  `viat-local:1.1.0` **keeping every runtime configuration and storage
  requirement**.
- When the node must compile Rust scripts, pick the other target
  explicitly:

```sh
docker build --target runtime-build -t viat-local:1.1.0-build .
```

  The build variant adds the compiler and matching SDK — it **removes
  no** persistent-artifact-storage, database-backup, activation or
  runtime-limit requirements.

### Native development build

From the pinned product root:

```sh
SQLX_OFFLINE=true cargo build --release --locked -p viat-api -p viat-cli
npm ci
npm run build:web
```

- Expected artifacts: `target/release/viat-api` and
  `target/release/viat`; browser output in `web/dist`. For unmodified
  release sources `SQLX_OFFLINE=true` uses the committed `.sqlx/`
  descriptions — it **cannot** replace regenerating the cache after
  modifying SQL. Ordinary online SQLx compilation requires a live,
  migration-matched PostgreSQL at compile time. On cache mismatch,
  restore a consistent source/cache combination — **never** blindly edit
  query metadata.
- Headless management-API/CLI installs may skip the `npm` steps; without
  built files and `VIAT_WEB_DIR` the native server ships no console out
  of thin air. This sequence builds **no** native apps, runs no tests,
  creates no system service and installs nothing into `PATH`.

## Configure the source-built server

- Prepare an **empty** PostgreSQL database and a dedicated login; during
  bootstrap that role needs permission to apply platform migrations.
  **Never** point an experimental build at an existing production
  database.
- In a **Bash** session at the product root, enter privately:

```bash
read -r -s -p 'PostgreSQL URL: ' DATABASE_URL; printf '\n'
export DATABASE_URL
read -r -s -p 'Master key (64 hex characters): ' VIAT_MASTER_KEY; printf '\n'
export VIAT_MASTER_KEY
read -r -s -p 'JWT secret: ' VIAT_JWT_SECRET; printf '\n'
export VIAT_JWT_SECRET
read -r -p 'Initial owner email: ' VIAT_DEFAULT_ADMIN_EMAIL
export VIAT_DEFAULT_ADMIN_EMAIL
read -r -s -p 'Initial owner password: ' VIAT_DEFAULT_ADMIN_PASSWORD; printf '\n'
export VIAT_DEFAULT_ADMIN_PASSWORD
export VIAT_BIND=127.0.0.1:8080
export VIAT_ALLOW_REGISTRATION=false
export VIAT_WEB_DIR="$PWD/web/dist"
./target/release/viat-api
```

- The PostgreSQL URL looks like
  `postgres://USER:PASSWORD@HOST:5432/DATABASE` with your real values
  (percent-encoded when needed). Generate the master key once with
  `openssl rand -hex 32`, store it safely and **reuse** it; generate a
  separate strong random JWT secret — the native default
  `dev-secret-change-me` suits no real deployment. These prompts keep
  passwords out of shell history; environment variables and local
  process access remain host-security concerns.
- The server applies migrations at startup; a missing platform database
  or master key fails the boot. The initial Owner bootstraps exactly
  once — environment variables **never** overwrite an existing
  password. Long-running services should switch to protected
  service-manager credentials/configuration rather than an interactive
  shell.
- Skipped console build: omit `VIAT_WEB_DIR` and sign in via CLI/API;
  when the console is wanted, confirm `web/dist` exists before start.
  You may privately set `VIAT_LICENSE_CODE` for startup activation or
  follow [activation](../instance/activation.md) after signing in.

## Verify and troubleshoot

In a second terminal:

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
./target/release/viat --version
```

Expected: liveness `200` (`{"status":"ok"}`), readiness `200` when the
database is reachable, CLI `viat 1.1.0`. A healthy process **can still
be unactivated**; real publish/call verification:
[first endpoint](../getting-started/first-endpoint.md).

| Failure | Action |
| --- | --- |
| `DATABASE_URL must be set` | Export the **platform** PostgreSQL URL, not a resource SQLite file |
| `VIAT_MASTER_KEY must be set` / invalid hex | Supply the stored 64-hex-character master key |
| Build cannot find SQLx query data | Use the release-matched cache; after SQL changes, compile against a live database and regenerate |
| `/ui/` unavailable | Build `web/dist` and set `VIAT_WEB_DIR`, or deliberately choose headless CLI/API |
| Python/TypeScript runtimes won't start | Install the chosen interpreters into the server's `PATH`; a Rust compile success installs no interpreter |
| Rust scripts won't compile | Check the matching compiler, SDK and build capability — not merely whether the CLI exists |

## Stop and clean up

Stop an interactive service with `Ctrl-C` and let it shut down. To
recover later, **keep the database and master key**; removing `target/`
deletes only local build artifacts and **never** the platform database
or business files the service created. Delete only explicitly
discardable databases through normal database-management procedures;
**never** attach unverified old binaries to a migrated database as a
"rollback".

## Verification basis

Server release `fd340879`; contract source `03751a67`: `Cargo.toml`,
`rust-toolchain.toml`, `Dockerfile`, root `package.json`,
`crates/viat-api/src/{config,main}.rs`,
`crates/viat-cli/src/commands/auth.rs`.
