---
title: Network, TLS and deployment inputs
description: Listener, public URL, TLS, WebSockets, image and deployment-wrapper settings with actual limits.
doc_id: configuration.network
verified_release: '1.1.0'
channel: stable
---

# Network, TLS and deployment inputs

This page includes application network settings and non-application installer inputs. [Table conventions](overview.md) apply; all are optional except stated conditional requirements. Deployment/proxy examples are unexecuted.

## Server and WebSocket settings

| Variable | Type; default | Validation, scope and precedence |
| --- | --- | --- |
| `VIAT_BIND` | string; `0.0.0.0:8080` | S. Listener address. TLS path requires parseable IP:port SocketAddr; choose loopback/private interface behind a proxy. Docker/wrapper may explicitly set it. |
| `VIAT_PUBLIC_URL` | URL; unset / 未设置 | S + D. Trimmed/trailing slash removed; path becomes mount prefix. Unset derives origin from Host/X-Forwarded-Proto. No strict universal URL validation; provide an absolute trusted URL. No project override. |
| `VIAT_TRUST_PROXY_HEADERS` | boolean; `false` | F. Trim/case-fold true/yes or 1 enables forwarded client IP. Only safe when all traffic passes trusted header-sanitizing proxies. |
| `VIAT_TLS_CERT` | path; unset / 未设置 | S. PEM certificate/full chain; must pair with key. Empty is unset. File contents reloaded on mtime changes every 60s; changing path requires restart. |
| `VIAT_TLS_KEY` | path; unset / 未设置 | S. PEM private key matching cert; one-sided config or initial load failure aborts startup. Failed later reload keeps previous certificate. |
| `VIAT_WEB_DIR` | path; unset / 未设置 | S. Readable built console directory containing index.html. Docker /app/web. Invalid directory serves no console with warning, not arbitrary server filesystem. |
| `VIAT_UI_ENABLED` | boolean; `true` | S. Trimmed case-insensitive false/no or 0 disables console even when image supplies directory; API remains. No UI if directory absent regardless. |
| `VIAT_DOCS_DIR` | path; unset / 未设置 | S. Rendered book directory containing readable index.html. Docker /app/docs. Used for /_docs, not a remote docs URL. |
| `VIAT_DOCS_ENABLED` | boolean; `true` | S. Same parser as UI_ENABLED. Disable embedded /_docs independently from console. |
| `VIAT_WS_MAX_CONNECTIONS` | u64 → usize; `10000` connections | F. Positive per-instance WebSocket connection cap; 0/invalid → default. Not a fleet-wide cap. |
| `VIAT_WS_MAX_MESSAGE_BYTES` | u64 → usize; `65536` bytes | F. Positive inbound WebSocket message ceiling (64 KiB). |
| `VIAT_WS_QUEUE_DEPTH` | u64 → usize; `32` messages | F. Positive outbound per-connection queue; slow consumers may be closed instead of growing unbounded memory. |
| `VIAT_WS_REVALIDATE_SECS` | u64; `300` s | F. Positive session/authorization recheck interval, not a guarantee of instant credential revocation. |
| `VIAT_WS_MAX_LIFETIME_SECS` | u64; `86400` s | F. Positive connection lifetime ceiling (24h); clients must reconnect/re-authenticate. |

## Compose and deployment-wrapper controls

| Variable | Type; default | Validation, scope and precedence |
| --- | --- | --- |
| `VIAT_TAG` | string; `latest` | I, Compose only. Selects image tag; pin 1.1.0 or an approved digest instead of mutable latest. |
| `VIAT_PORT` | port mapping; `8080` | I, Compose only. Host-side published port; container remains 8080. Docker validates mapping. |
| `POSTGRES_USER` | string; `viat` | I, example PostgreSQL image init and generated DATABASE_URL. Changing an existing volume does not rename/create its roles. |
| `POSTGRES_PASSWORD` | string; `viat` | I, example PostgreSQL image init and URI interpolation. Replace unsafe example default. Changing it does not rotate an existing database role password. |
| `POSTGRES_DB` | string; `viat` | I, example PostgreSQL initialization and URI. Existing volume is not reinitialized. |
| `ENV_FILE` | path; `scripts/.env` | I, deployment wrapper. Select before sourcing; file required, executable shell syntax. Wrapper only forwards keys declared in this file, excluding script-only keys. |
| `IMAGE` | image reference; official `:latest` | I, wrapper. Nonempty caller environment > file > default. Pin stable artifact; no automatic schema compatibility guarantee. |
| `IMAGE_TAR` | path; unset / 未设置 | I, wrapper. Nonempty imports local docker archive and skips registry login/pull; IMAGE must match loaded image. Caller > file. |
| `NAME` | string; `viat-server` | I, wrapper. Docker container name; existing named container is forcibly removed/recreated. Caller > file. |
| `HOST_PORT` | port mapping; `8080` | I, wrapper. Host mapping to fixed internal 8080. Caller > file; consider 127.0.0.1:8080 behind proxy. |
| `PULL` | switch; `1` | I, wrapper. Exactly 1 pulls unless IMAGE_TAR supplied; 0 uses local image. Caller > file. |
| `UV_CACHE_VOLUME` | mount; `viat-uv-cache` | I, wrapper. Mounted at /home/viat/.cache/uv. Caller > file. Do not confuse with application UV_* package settings. |
| `READY_TIMEOUT` | integer; `60` s | I, wrapper. Shell loop wait for HTTP /auth/config, not /readyz or script environment readiness. Use positive seconds; caller > file. |
| `DOCKER_NETWORK` | string; unset / 未设置 | I, wrapper. Existing Docker network; caller > file. Enables database/container-name reachability. |
| `EXTRA_MOUNT` | string; unset / 未设置 | I, wrapper. Comma-separated Docker -v specifications. Caller > file. Use read-only mounts where possible; do not mount host socket/root. |
| `SECURITY_OPT` | string; unset / 未设置 | I, wrapper. Comma-separated Docker security-opt entries; caller > file. seccomp=unconfined weakens isolation; not a production default. |
| `PIDS_LIMIT` | Docker limit; `512` | I, wrapper. Container processes/threads; Docker validates. Actual implementation sources file after caller, so file can override caller for this variable. Not application concurrency. |
| `MEMORY_LIMIT` | Docker size; `4g` | I, wrapper. Container memory limit; Docker validates. File can override caller in current implementation. Example starting point, not sizing recommendation. |
| `REGISTRY_HOST` | host[:port]; derived / 推导 | I, wrapper. Derived from IMAGE registry component unless explicit; caller > file. Never forwarded to app. |
| `REGISTRY_USERNAME` | string; unset / 未设置 | I, wrapper. Needed with registry password when login performed; caller > file. Docker stores login credential on deployment host. |
| `REGISTRY_PASSWORD` | string; unset / 未设置 | I, wrapper. Paired login secret, sent using password-stdin, not app env. File credential below wins. Caller > file. |
| `REGISTRY_PASSWORD_FILE` | path; unset / 未设置 | I, wrapper. Readable password file overrides REGISTRY_PASSWORD. Restrict file access. Caller > file. |
| `REGISTRY_LOGIN` | switch; `1` | I, wrapper. Exactly 1 allows login on pull path; 0 skips, uses Docker existing credentials/anonymous access. Caller > file. |

## Public URL, prefixes and reverse proxies

```dotenv
VIAT_PUBLIC_URL=https://api.example.com/viat
VIAT_TRUST_PROXY_HEADERS=true
```

External endpoints become `https://api.example.com/viat/p/PROJECT/PATH`, and the console is `/viat/ui/`. The path in `VIAT_PUBLIC_URL` is the prefix; there is no second supported prefix variable. The proxy can preserve it for the server to strip, or strip it exactly once itself; do not double-add/remove it. Update registered IdP callbacks and external webhook URLs; avoid prefixes colliding with internal platform paths.

An explicit public URL fixes the origin used in outbound links and prevents a missing `X-Forwarded-Proto` turning HTTPS into an HTTP guess. It neither terminates TLS nor opens ports nor validates proxy trust. Only enable `VIAT_TRUST_PROXY_HEADERS` when every request crosses controlled, header-sanitizing proxies. IP extraction prefers the **last** `X-Forwarded-For` element, then considers `X-Real-IP`; validate multi-proxy topology rather than blindly trusting the first element.

For complete TLS/streaming/WebSocket examples, renewal and verification see [TLS and proxy operations](../operations/tls-proxy.md).

## Fixed limits that matter

- Ordinary buffered script/workflow request bodies have a **2 MiB** ceiling; there is no arbitrary body-size environment knob. Multipart text fields share this budget; file parts use spool/file limits.
- Proxy and dedicated S3 streaming paths differ from buffered execution. Set route-specific proxy upload limits and disk budgets instead of making every path unlimited.
- Rust artifact uploads have a **512 MiB** ceiling. Upload support does not bypass a front proxy's size limits or authorization.
- The default 10,000 WebSocket connections/instance is not a capacity guarantee. Queues/messages consume memory; proxies must support Upgrade and avoid harmful SSE/stream buffering.
- Image health checks run every 30 seconds with 3-second timeout, 20-second start period and 3 retries. They probe `/healthz`, not public certificate identity or `/readyz`.

## Actual deployment-script effects

`deploy-server.sh` expects existing PostgreSQL; it does not create it. It sources trusted `.env`, optionally logs into a registry/imports or pulls an image, then **forcibly removes the old container** and starts its replacement. It is not a zero-downtime rolling updater. Its wait checks plaintext `http://127.0.0.1:HOST_PORT/auth/config`; direct TLS, unusual bindings or mappings need separate verification instead of treating this check as authoritative.

The wrapper supplies port 8080, a cache volume and container limits, and also forwards application keys declared in its file. Avoid conflicting `VIAT_BIND` declarations in wrapper mode. Application keys only present in the caller shell but not declared in that file are not automatically forwarded. `ENV_FILE` is shell-source input: use trusted files only, never execute an unknown downloaded script.

Image build inputs `DEBIAN_SUITE` (bookworm), `VITE_MONACO_BUNDLE` (true; false no longer supported), `RUSTUP_DIST_SERVER`/`RUSTUP_UPDATE_ROOT` (official toolchain download when absent) are **I, build-time**. The official image's `VITE_BASE=./` gives relative assets; `VITE_VIAT_API_URL` is a custom-frontend build input, not a server knob for changing an installed API origin. See [client/toolchain classification](integrations.md).
