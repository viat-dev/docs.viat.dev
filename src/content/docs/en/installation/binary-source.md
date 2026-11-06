---
title: Binaries and source builds
description: Distinguish released CLI binaries from server source builds and supply the runtime configuration a source-built server actually needs.
doc_id: installation.binary-source
verified_release: '1.1.0'
channel: stable
---

# Binaries and source builds

The simplest stable server installation is [Docker Compose](docker-compose.md). A `viat` executable is the **management CLI**, not a combined server installer. The server executable is `viat-api`. This page covers identifying those binaries and building a pinned source checkout when you deliberately maintain a developer-managed installation.

## Before choosing this path

You need permission to install/run software on the host, a PostgreSQL database you control, protected secret storage, and a valid activation code for the verification key in your chosen server build. Building from source does not bypass activation and does not make customer-side signing-key generation an activation procedure.

For a source build, also provide:

- The release's Rust toolchain (`rust-toolchain.toml` pins `1.98`), Cargo, a C linker and platform development libraries required by its dependencies.
- Node/npm if you want to build the browser console; use the repository-root lockfile/workspaces, not independent installs inside `web/`.
- `uv` for Python scripts, `bun` for TypeScript, and Bash/`jq` for the shell capabilities you intend to use. Compiling the server does not install those interpreters.
- Network access for the build dependencies and, when needed, runtime package installations.

This is not a promise of downloadable native server packages or signed Windows/Linux desktop releases. For Apple client artifact installation and its bundled CLI, see [Clients](clients.md). No public artifact download URL is established by this handbook.

## Identify what you have

For an already installed CLI:

```sh
command -v viat
viat --version
viat version
```

`viat --version` should report `viat 1.1.0` for this baseline. `viat version` always reports the CLI and adds the server release only when a configured session can read `/version`. “Version unavailable” is not proof that the binary is wrong; it can indicate missing login, network failure, or an older server.

The official container carries `/usr/local/bin/viat-api` and `/usr/local/bin/viat`. Do not copy a Linux binary out of the image and assume it will execute on macOS or Windows. Its architecture and shared-library requirements still apply.

## Build the stable source deliberately

Use a product checkout obtained through your authorized source distribution. In its root, confirm the server/CLI release commit before compiling:

```sh
git checkout --detach fd340879
git rev-parse HEAD
```

`fd340879` is the server/CLI 1.1.0 release baseline. The later documentation-contract baseline `03751a67` also contains Apple release-entry tooling; it is not a reason to treat every later branch as a new stable server release. Do not check out or ship unreleased Widget/APNs branches under the stable label.

### Containerized source build

With Docker available, an explicit target avoids accidentally building the final build-capable stage:

```sh
docker build --target runtime -t viat-local:1.1.0 .
```

Expected outcome: a local image containing server, CLI, console, and reference book. This command builds locally; it does not push an image or install a running service. It requires substantial time, disk, and dependency downloads. The Dockerfile uses the committed SQLx cache for compilation. To deploy this locally built image, adapt the `viat.image` in [Docker Compose](docker-compose.md) to `viat-local:1.1.0` and retain all runtime configuration and storage requirements.

For a Rust-compiling server node, select the other target explicitly:

```sh
docker build --target runtime-build -t viat-local:1.1.0-build .
```

The build variant adds the compiler and matching SDK. It does not remove the need for durable artifact storage, database backups, activation, or runtime limits.

### Native developer build

From the pinned product root:

```sh
SQLX_OFFLINE=true cargo build --release --locked -p viat-api -p viat-cli
npm ci
npm run build:web
```

Expected executables are `target/release/viat-api` and `target/release/viat`; browser files are `web/dist`. `SQLX_OFFLINE=true` uses the checked-in `.sqlx/` descriptions for this unchanged release. It is not a substitute for regenerating the cache when maintaining modified SQL. Ordinary online SQLx compilation instead requires a live, migration-compatible PostgreSQL database at compile time. A cache mismatch is a reason to restore a consistent source/cache pair—not to edit query metadata blindly.

The `npm` steps are unnecessary for a headless management API/CLI setup, but without built files and `VIAT_WEB_DIR`, a native server does not magically contain the console. This sequence does not build native apps, run tests, create a system service, or install tools on your `PATH`.

## Configure a source-built server

Prepare an empty PostgreSQL database with a dedicated login. For the bootstrap, the login needs privileges to apply the platform's migrations. Do not point an experimental build at an existing production database.

In a **Bash** session at the product root, set values privately:

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

Use a PostgreSQL URL such as `postgres://USER:PASSWORD@HOST:5432/DATABASE` with actual values and percent-encoding where necessary. Generate the master key with `openssl rand -hex 32` once, save it securely, and re-use it. Generate a separate strong JWT secret. The native default JWT value `dev-secret-change-me` is not safe for any real deployment. These prompts avoid putting literal passwords in shell history; environment variables and local process access remain a host-security concern.

The server applies migrations at startup. If your platform database or master key is missing, startup fails. The initial Owner is seeded only once; environment changes do not overwrite an existing password. For a persistent service, move configuration into protected service-manager credentials/configuration rather than relying on an interactive shell.

If you skipped the console build, omit `VIAT_WEB_DIR` and use CLI/API login. If you want a console, ensure `web/dist` exists before starting. Set `VIAT_LICENSE_CODE` privately for startup activation, or sign in and follow [Activation](../instance/activation.md).

## Verify and diagnose

From a second terminal:

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
./target/release/viat --version
```

Expect HTTP `200` from liveness (`{"status":"ok"}`), readiness `200` for a usable database, and CLI `viat 1.1.0`. A healthy process may still be unactivated. Follow [Your first endpoint](../getting-started/first-endpoint.md) for a genuine publish/call verification.

| Failure | Remedy |
| --- | --- |
| `DATABASE_URL must be set` | Export a URL for the platform PostgreSQL database, not a resource SQLite file |
| `VIAT_MASTER_KEY must be set` / invalid hex | Supply the saved 64-hex-character master key |
| Build cannot find SQLx query data | Use the matching release cache; modified SQL needs a live compile database and cache regeneration |
| `/ui/` unavailable | Build `web/dist` and set `VIAT_WEB_DIR`, or use headless CLI/API intentionally |
| Python/TypeScript runtime cannot start | Install the chosen interpreter on the server's `PATH`; a successful Rust build did not install it |
| Rust script will not compile | Verify matching compiler/SDK/build capability, not merely the existence of the CLI |

## Stop and clean up

Use `Ctrl-C` for an interactive server and wait for shutdown. Keep the database and saved master key if you want to resume. Removing `target/` removes local build products, **not** the platform database or server-created application files. Drop only a deliberately disposable database through your normal database-administration process. Do not use an untested older binary against a migrated database as a rollback plan.

## Verification basis

Server release `fd340879`; contract source `03751a67`: `Cargo.toml`, `rust-toolchain.toml`, `Dockerfile`, root `package.json`, `crates/viat-api/src/{config,main}.rs`, and `crates/viat-cli/src/commands/auth.rs`.
