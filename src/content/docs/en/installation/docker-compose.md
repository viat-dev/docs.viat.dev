---
title: Install with Docker Compose
description: Deploy the stable server with PostgreSQL, durable storage, required secrets, bootstrap login, and health checks.
doc_id: installation.docker-compose
verified_release: '1.1.0'
channel: stable
---

# Install with Docker Compose

This procedure creates a **new single-node installation** with the official server/CLI **1.1.0** image and PostgreSQL. It binds HTTP to the host's loopback interface for the initial setup. It does not configure production TLS, external backups, or a multi-node fleet.

## Prerequisites and permissions

- A host that can run the published Linux image, Docker Engine, and the Compose plugin (`docker compose`). The image publishing script targets `linux/amd64`; do not infer that a native image exists for every host architecture.
- Permission to run Docker and create persistent volumes, free local port `8080`, sufficient disk, and an appropriate memory/process budget.
- Access to `registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0` or an authorized mirror of that exact artifact. Registry credentials, if required, are host-side pull credentials—not Viat resource secrets.
- OpenSSL for random secrets and an initial platform Owner's email/password.
- A **valid activation code matching the official image**, or the ability to obtain one through your existing distribution arrangement. Without a code, the process can boot and login remains available, but protected routes stay locked. See [Activation](../instance/activation.md).

Do not use the product repository's `docker-compose.yml` as the installer: it starts development/test dependencies, not the full customer server. The product's `docker-compose.example.yml` is a deployment example; the self-contained version below pins the stable image instead of `latest`.

## 1. Prepare a private directory and secrets

Run on the installation host in a new directory:

```sh
mkdir viat-deployment
cd viat-deployment
umask 077
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 24
openssl rand -hex 24
```

Save the four outputs privately as, respectively, the master key, JWT secret, PostgreSQL password, and initial admin password. Create `.env` with a text editor:

```dotenv
VIAT_MASTER_KEY=REPLACE_WITH_FIRST_OUTPUT
VIAT_JWT_SECRET=REPLACE_WITH_SECOND_OUTPUT
POSTGRES_PASSWORD=REPLACE_WITH_THIRD_OUTPUT
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_FOURTH_OUTPUT
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_LICENSE_CODE=
```

Replace every `REPLACE_WITH_...` value and use an email you control before continuing. These are placeholders, not working credentials. Hex-generated database passwords avoid URL-escaping problems in the `DATABASE_URL` below. Leave the license empty only if you will activate after login.

```sh
chmod 600 .env
```

`VIAT_MASTER_KEY` must be exactly **64 hexadecimal characters**. Keep it stable across restarts and back it up separately; generating a new key on every boot does not rotate stored secrets safely. Set a strong JWT secret before first use. Never commit `.env`.

## 2. Create `compose.yaml`

```yaml
services:
  postgres:
    image: postgres:17.4-alpine
    environment:
      POSTGRES_USER: viat
      POSTGRES_DB: viat
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
    volumes:
      - viat-pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U viat -d viat"]
      interval: 5s
      timeout: 3s
      retries: 20
    restart: unless-stopped

  viat:
    image: registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      DATABASE_URL: postgres://viat:${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}@postgres:5432/viat
      VIAT_MASTER_KEY: ${VIAT_MASTER_KEY:?set VIAT_MASTER_KEY}
      VIAT_JWT_SECRET: ${VIAT_JWT_SECRET:?set VIAT_JWT_SECRET}
      VIAT_DEFAULT_ADMIN_EMAIL: ${VIAT_DEFAULT_ADMIN_EMAIL:?set VIAT_DEFAULT_ADMIN_EMAIL}
      VIAT_DEFAULT_ADMIN_PASSWORD: ${VIAT_DEFAULT_ADMIN_PASSWORD:?set VIAT_DEFAULT_ADMIN_PASSWORD}
      VIAT_ALLOW_REGISTRATION: "false"
      VIAT_LICENSE_CODE: ${VIAT_LICENSE_CODE:-}
      VIAT_TRUST_PROXY_HEADERS: "false"
      RUST_LOG: info
    volumes:
      - viat-uv-cache:/home/viat/.cache/uv
    pids_limit: 512
    mem_limit: 4g
    restart: unless-stopped

volumes:
  viat-pg:
  viat-uv-cache:
```

The PostgreSQL port is not published to the host. `DATABASE_URL` uses the service name `postgres` and its internal port `5432`, not `localhost:5433` from the developer stack. PostgreSQL remains the platform database even if you later create a `sqlite` resource.

The official image contains the web console, reference book, CLI, `uv`, `bun`, Bash, and `jq`. The normal `1.1.0` image **does not compile Rust scripts**. Use the matching `1.1.0-build` variant for a node that must compile, and plan persistent artifact storage before relying on Rust artifacts. The presence of the CLI does not imply a Rust toolchain.

## 3. Start and inspect

```sh
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --since 10m viat
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
```

`config --quiet` validates Compose interpolation without printing the expanded secret values. PostgreSQL should become healthy, then Viat should start and apply its platform migrations. `/healthz` returns HTTP `200` with `{"status":"ok"}`. `/readyz` returns `200` when the server can serve database-backed traffic, or `503` when it cannot; it is not an activation check. Do not share raw startup logs without inspecting them for private configuration.

Open `http://127.0.0.1:8080/`; it redirects to `/ui/`. Sign in with the bootstrap email/password. The bootstrap user is created once as platform `owner`; changing the environment later does **not** reset an existing user's password. If redirected to activation, submit your valid code using [Activation](../instance/activation.md).

From the same Compose directory, the bundled CLI can report its local version:

```sh
docker compose exec viat viat --version
```

Expected version: `viat 1.1.0`. To administer from your workstation, install a matching CLI or use the console; use [Your first endpoint](../getting-started/first-endpoint.md) next.

## Defaults and production changes

- HTTP listens inside the image on `0.0.0.0:8080`. This example exposes only `127.0.0.1:8080`; a remote browser cannot reach that listener without a tunnel or a deliberately configured proxy.
- Image self-registration defaults to `false`. Invite collaborators rather than opening registration to bootstrap an owner.
- Default schedule timezone is `UTC`; choose the intended IANA timezone before creating schedules.
- Python dependency cache persists at `/home/viat/.cache/uv`. It is not the platform database backup.
- Workers use a separate unprivileged account (UID `10001`). For script-write mounts, configure `VIAT_WORKER_DATA_DIRS` with the specific absolute paths to adopt, or select a suitable worker UID. Do not solve permissions by making every mount world-writable.
- Before public exposure, configure HTTPS and `VIAT_PUBLIC_URL` with the real externally reachable URL, including any mount prefix. Only enable `VIAT_TRUST_PROXY_HEADERS=true` when a proxy you control terminates every request; the implementation assumes one trusted proxy.
- Size memory/process limits for legitimate work. An unbounded script can still exhaust its assigned container budget.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Compose says a variable must be set | Fill the corresponding `.env` value; blank required values are rejected |
| Image pull denied / no matching manifest | Check registry access and `linux/amd64` compatibility; do not silently switch to an unknown `latest` |
| Server exits with a key-format error | Verify exactly 64 hex characters, without quotes pasted into the value |
| Database connection or migration error | Check `docker compose ps` and PostgreSQL logs; ensure the URL targets this database and existing data is compatible |
| PostgreSQL rejects a newly changed password | `POSTGRES_PASSWORD` initializes a new volume; changing `.env` does not change a password already stored in PostgreSQL |
| `healthz` is healthy but product API gives `403 license_required` | Login and activate; probes and activation are deliberately available while locked |
| Python dependency build cannot download packages | Check the server's network/proxy and package sources; the host browser's connectivity is not enough |
| Old Docker fails to spawn worker threads | Update the engine; do not weaken seccomp globally as a routine installation step |

## Stop, backup, and cleanup

```sh
docker compose stop
docker compose start
```

These retain containers and volumes. `docker compose down` removes the stack's containers/network but normally retains named volumes. **`docker compose down -v` destroys this stack's named-volume data, including the platform database**; never use it as an upgrade or repair command.

Before an upgrade, back up PostgreSQL using your database backup procedure, `.env`/master key through a protected secrets backup, and any application file/artifact mounts you added. Record the image version or digest. Do not assume an old server can use a database after newer migrations have been applied; rollback requires a tested, compatible restore plan, not merely changing an image tag.

## Verification basis

Contract source `03751a67`: `docker-compose.example.yml`, `.env.example`, `Dockerfile`, `scripts/docker-build-push.sh`, `crates/viat-api/src/config.rs`, `crates/viat-api/src/main.rs`, and `crates/viat-api/src/handlers/health.rs`. Stable server artifact: `1.1.0` (`fd340879`).
