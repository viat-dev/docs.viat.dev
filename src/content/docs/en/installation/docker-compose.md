---
title: Install with Docker Compose
description: Deploy the stable server with PostgreSQL, persistent volumes, required secrets, initial sign-in and health checks.
doc_id: installation.docker-compose
verified_release: '1.1.0'
channel: stable
---

# Install with Docker Compose

This flow creates a **new single-node installation** from the official
server/CLI **1.1.0** image and PostgreSQL, binding only to the host loopback
for the initial setup. Production TLS, external backups and multi-node
clusters are out of scope.

When done you have: an instance listening on `127.0.0.1:8080`, the bundled
web console, and a bootstrapped platform Owner account.

![The login page after installation](/screenshots/en/login.png)

## Prerequisites

- A host that runs published Linux images, Docker Engine and the Compose
  plugin. Images are published for `linux/amd64`; do not assume native
  artifacts for every architecture.
- Permission to run Docker and create persistent volumes, a free local `8080`
  port, and adequate disk/memory.
- Access to pull `registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0`.
  Registry credentials belong to host-side pull configuration, not to Viat
  resource secrets.
- OpenSSL for random secrets; an email and password for the initial platform
  Owner.
- A **valid activation code matching the official image**, or the arranged
  way to obtain one. Without a code the deployment still boots, lets you sign
  in and reach the activation page, but protected routes stay locked — see
  [activation](../instance/activation.md).

> [!WARNING]
> Do not use the product repository's `docker-compose.yml` as an installer —
> it starts development/test dependencies. The deployment example is
> `docker-compose.example.yml`; the standalone configuration below pins the
> stable image version.

## 1. Prepare a private directory and secrets

In a fresh directory on the install host:

```sh
mkdir viat-deployment
cd viat-deployment
umask 077
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 24
openssl rand -hex 24
```

Save the four outputs as master key, JWT secret, PostgreSQL password and
initial admin password, then create `.env` (every `REPLACE_WITH_...` is a
placeholder, not a usable credential; a hex database password avoids URL
escaping in `DATABASE_URL`):

```dotenv
VIAT_MASTER_KEY=REPLACE_WITH_FIRST_OUTPUT
VIAT_JWT_SECRET=REPLACE_WITH_SECOND_OUTPUT
POSTGRES_PASSWORD=REPLACE_WITH_THIRD_OUTPUT
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_FOURTH_OUTPUT
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_LICENSE_CODE=
```

Use an address you control; leave the code empty only when you plan to
activate after signing in. Then:

```sh
chmod 600 .env
```

`VIAT_MASTER_KEY` must be exactly **64 hexadecimal characters**. Keep it
stable across restarts and back it up separately; inventing a new key on
every boot is not how you rotate existing secrets. Never commit `.env`.

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

Key points:

- The PostgreSQL port is not published to the host; `DATABASE_URL` uses the
  service name `postgres` and internal `5432` — not the dev stack's
  `localhost:5433`.
- The platform database stays PostgreSQL even if you later create `sqlite`
  resources.
- The official image bundles the web console, reference handbook, CLI, `uv`,
  `bun`, Bash and `jq`. The plain `1.1.0` image **cannot compile Rust
  scripts** — nodes that need compilation use the `1.1.0-build` variant with
  planned artifact persistence.

## 3. Start and verify

```sh
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --since 10m viat
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8080/readyz
```

`config --quiet` validates variable interpolation without printing secrets.
PostgreSQL turns healthy first; Viat then boots and applies platform
migrations. `/healthz` answers `200` with `{"status":"ok"}`; `/readyz`
answers `200` once the instance can serve database traffic, else `503` — it
is not an activation check.

Open `http://127.0.0.1:8080/`, get redirected to `/ui/`, and sign in with the
initial credentials (see the screenshot at the top). The bootstrap account is
created once with platform role `owner`; changing the environment later
**never** resets an existing account. If you land on the activation page,
submit a valid code per [activation](../instance/activation.md).

Confirm the in-image CLI from the Compose directory:

```sh
docker compose exec viat viat --version
```

Expect `viat 1.1.0`. Next: [first endpoint](../getting-started/first-endpoint.md).

## Defaults and production adjustments

- HTTP listens on `0.0.0.0:8080`; this setup exposes only `127.0.0.1:8080`.
  Remote browsers need a tunnel or an explicitly configured proxy.
- Self-registration defaults to `false`; invite collaborators instead of
  opening registration to create an Owner.
- The default schedule timezone is `UTC`; pick the IANA timezone before
  creating schedules.
- The Python dependency cache persists at `/home/viat/.cache/uv` — it is not
  a platform database backup.
- Workers run as a separate low-privilege account (UID `10001`). For scripts
  writing into mounted directories, declare the handover paths with
  `VIAT_WORKER_DATA_DIRS`; never make whole mounts world-writable.
- Before exposing publicly, set up HTTPS and point `VIAT_PUBLIC_URL` at the
  real external URL including any mount prefix. Enable
  `VIAT_TRUST_PROXY_HEADERS=true` only when your proxy terminates every
  request.
- Size memory and process limits to legitimate load; runaway scripts can
  still exhaust the container budget.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Compose says a variable must be set | Fill the matching `.env` value; empty required values are rejected |
| Pull denied / no matching manifest | Check registry access and `linux/amd64` compatibility; do not switch to an unknown `latest` |
| Server exits on malformed secret | Exactly 64 hex characters; no quotes pasted into values |
| Database connection or migration errors | Read `docker compose ps` and PostgreSQL logs; confirm the URL points at the right, compatible database |
| PostgreSQL rejects a just-changed password | `POSTGRES_PASSWORD` only initializes a new volume; editing `.env` never changes a stored password |
| `healthz` fine but product APIs answer `403 license_required` | Sign in and activate; probes and activation stay reachable while locked by design |
| Python dependency builds cannot download | Check server-side network/proxy/package mirrors; a working host browser proves nothing for the container |
| Old Docker cannot create worker threads | Upgrade Docker Engine; do not normalize loosening seccomp |

## Stop, back up and clean up

```sh
docker compose stop
docker compose start
```

Both keep containers and volumes. `docker compose down` removes this stack's
containers and network, usually keeping named volumes;
**`docker compose down -v` destroys the named volumes' data, including the
platform database** — it is not an upgrade or repair command.

Before upgrading: back up PostgreSQL per the database backup flow, keep
`.env`/master key in protected secret storage, back up business files and
artifact mounts, and record the image version or digest. Never assume an
older server can read a database with newer migrations applied — rollback
needs a validated, compatible restore plan.

## Verification basis

Contract source `03751a67`: `docker-compose.example.yml`, `.env.example`,
`Dockerfile`, `scripts/docker-build-push.sh`, `crates/viat-api/src/config.rs`,
`crates/viat-api/src/main.rs`, `crates/viat-api/src/handlers/health.rs`.
Stable server artifact: `1.1.0` (`fd340879`).
