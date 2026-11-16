---
title: Network, TLS and deployment inputs
description: Listener, public URL, TLS, WebSockets, image and deployment-wrapper settings with actual limits.
doc_id: configuration.network
verified_release: '1.1.0'
channel: stable
---

# Network, TLS and deployment inputs

Application network settings and non-application installer inputs.
[Table conventions](overview.md) apply; everything is optional unless a
condition says otherwise. Deployment/proxy examples are unexecuted.

## Server and WebSocket settings

| Variable | Type; default | Validation, scope and precedence |
| --- | --- | --- |
| `VIAT_BIND` | string; `0.0.0.0:8080` | S. Listen address; built-in TLS requires a resolvable IP:port. Behind a proxy, pick a loopback/private address. Docker/deploy scripts may set it explicitly. |
| `VIAT_PUBLIC_URL` | URL; unset | S + D. Trimmed of whitespace and trailing slash; the **path is the mount prefix**. Unset derives from Host/X-Forwarded-Proto. No unified strict validation — provide a trusted absolute URL. No project override. |
| `VIAT_TRUST_PROXY_HEADERS` | boolean; `false` | F. Trimmed case-insensitive `true`/`yes`/`1` enables forwarded client IPs; safe **only when every request passes a trusted proxy that sanitizes headers**. |
| `VIAT_TLS_CERT` | path; unset | S. PEM certificate/full chain, requires the key; empty counts as unset. Mtime is checked every 60 seconds and the file reloaded; **changing the path needs a restart**. |
| `VIAT_TLS_KEY` | path; unset | S. Matching PEM private key; setting only one side, or a first-load failure, blocks startup; later reload failures **keep the old certificate**. |
| `VIAT_WEB_DIR` | path; unset | S. Console build directory with a readable index.html (Docker: /app/web). An invalid directory warns and serves no console. |
| `VIAT_UI_ENABLED` | boolean; `true` | S. Trimmed `false`/`no` (case-insensitive) or `0` disables the console; **APIs stay on**. Enabled without a directory still serves no UI. |
| `VIAT_DOCS_DIR` | path; unset | S. Rendered handbook directory with a readable index.html (Docker: /app/docs); serves `/_docs`, not a remote docs URL. |
| `VIAT_DOCS_ENABLED` | boolean; `true` | S. Same parsing as UI_ENABLED; independently disables built-in `/_docs`. |
| `VIAT_WS_MAX_CONNECTIONS` | u64 → usize; `10000` connections | F. Positive per-instance WebSocket cap; 0/invalid falls back. **Not** a cluster cap. |
| `VIAT_WS_MAX_MESSAGE_BYTES` | u64 → usize; `65536` bytes | F. Positive inbound message cap (64 KiB). |
| `VIAT_WS_QUEUE_DEPTH` | u64 → usize; `32` messages | F. Positive per-connection outbound queue depth; slow consumers can be closed to bound memory. |
| `VIAT_WS_REVALIDATE_SECS` | u64; `300` s | F. Positive session/authorization recheck interval — no guarantee of instant credential revocation. |
| `VIAT_WS_MAX_LIFETIME_SECS` | u64; `86400` s | F. Positive connection lifetime cap (24 hours); clients must reconnect and re-authenticate. |

## Compose and deployment-script controls

| Variable | Type; default | Validation, scope and precedence |
| --- | --- | --- |
| `VIAT_TAG` | string; `latest` | I, Compose only. Image tag; pin 1.1.0 or an approved digest in production — not the mutable latest. |
| `VIAT_PORT` | port mapping; `8080` | I, Compose only. Host-published port; the container still listens on 8080. |
| `POSTGRES_USER` | string; `viat` | I. Example-image initialization and DATABASE_URL assembly; on an existing volume, changing it **renames/creates nothing**. |
| `POSTGRES_PASSWORD` | string; `viat` | I. Example initialization and URI substitution; replace the insecure default; changing it **never rotates** an existing database password. |
| `POSTGRES_DB` | string; `viat` | I. Example initialization and URI; existing volumes are not reinitialized. |
| `ENV_FILE` | path; `scripts/.env` | I, deploy script. Chosen before loading; the file must exist with executable shell syntax; only its declared non-script keys are forwarded. |
| `IMAGE` | image ref; official `:latest` | I, deploy script. Non-empty: calling environment > file > default. Pin stable artifacts; automatic database-schema compatibility is not guaranteed. |
| `IMAGE_TAR` | path; unset | I, deploy script. Non-empty imports a local image tar and skips login/pull; IMAGE must match the imported image; calling environment wins. |
| `NAME` | string; `viat-server` | I, deploy script. Container name; **an existing same-named container is force-deleted and recreated**; calling environment wins. |
| `HOST_PORT` | port mapping; `8080` | I, deploy script. Host mapping onto the fixed container port 8080; behind a proxy `127.0.0.1:8080` works; calling environment wins. |
| `PULL` | switch; `1` | I, deploy script. Without IMAGE_TAR, strictly `1` pulls; `0` uses the local image; calling environment wins. |
| `UV_CACHE_VOLUME` | mount; `viat-uv-cache` | I, deploy script. Mounted at /home/viat/.cache/uv; calling environment wins; **not** an application UV_* package setting. |
| `READY_TIMEOUT` | integer; `60` s | I, deploy script. Shell loop waiting on plain `http://…/auth/config` — **not** /readyz or environment readiness; positive seconds; calling environment wins. |
| `DOCKER_NETWORK` | string; unset | I, deploy script. An existing Docker network; calling environment wins; used for database/container-name reachability. |
| `EXTRA_MOUNT` | string; unset | I, deploy script. Comma-separated Docker -v specs; calling environment wins; prefer read-only and **never mount host sockets or root**. |
| `SECURITY_OPT` | string; unset | I, deploy script. Comma-separated security-opts; calling environment wins; `seccomp=unconfined` weakens isolation and is no production default. |
| `PIDS_LIMIT` | Docker limit; `512` | I, deploy script. Container process/thread cap (Docker-validated). The implementation reads the calling environment before the file, so **the file can override the caller's value**. Not application concurrency. |
| `MEMORY_LIMIT` | Docker size; `4g` | I, deploy script. Container memory cap (Docker-validated); the file can override the caller's value; an example starting point, not capacity advice. |
| `REGISTRY_HOST` | host[:port]; derived | I, deploy script. Derived from IMAGE when unset; calling environment wins; never injected into the app. |
| `REGISTRY_USERNAME` | string; unset | I, deploy script. Needed when logging in with a password; calling environment wins; Docker stores login credentials on the deploy host. |
| `REGISTRY_PASSWORD` | string; unset | I, deploy script. Paired login secret passed via password-stdin, **never entering the app environment**; the password file below wins; calling environment wins. |
| `REGISTRY_PASSWORD_FILE` | path; unset | I, deploy script. A readable password file overriding REGISTRY_PASSWORD; restrict its permissions; calling environment wins. |
| `REGISTRY_LOGIN` | switch; `1` | I, deploy script. The pull path logs in only on strict `1`; `0` skips it and uses existing Docker credentials/anonymously; calling environment wins. |

## Public URL, prefixes and reverse proxies

```dotenv
VIAT_PUBLIC_URL=https://api.example.com/viat
VIAT_TRUST_PROXY_HEADERS=true
```

Meaning: the external endpoint is
`https://api.example.com/viat/p/PROJECT/PATH` and the console sits at
`/viat/ui/`. Essentials:

- The `VIAT_PUBLIC_URL` path **is** the mount prefix; there is no second
  supported prefix variable.
- The proxy may keep the prefix for the server to strip, or strip it once
  itself — **never add/remove it twice**.
- After changing the prefix, update IdP registration callbacks and external
  webhook URLs; avoid prefixes colliding with internal platform paths.
- An explicit public URL pins the origin used in outbound links and prevents
  HTTPS being guessed as HTTP when a proxy omits `X-Forwarded-Proto`. It
  **does not** replace TLS, open ports or vouch for the proxy.
- Enabling `VIAT_TRUST_PROXY_HEADERS` requires: every request traverses a
  controlled proxy that **overrides** client-supplied forwarding headers.
  IP resolution prefers the **last** `X-Forwarded-For` segment, then
  `X-Real-IP`; validate multi-hop chains as deployed — never blindly take
  the first segment.

Full TLS/streaming/WebSocket proxy examples, renewal and validation:
[TLS and proxies](../operations/tls-proxy.md).

## Fixed limits you cannot ignore

- Ordinary request bodies handed to scripts/workflows cap at **2 MiB** — not
  a raisable environment variable. Multipart text fields share that budget;
  file parts use disk staging and file caps.
- Proxied/dedicated S3 streaming is a different, unbuffered path: configure
  request size and disk budgets per-path instead of enlarging everything.
- Rust artifact uploads cap at **512 MiB**; "uploadable" does not mean wise
  through any front proxy — proxy limits and authorization still apply.
- The default 10,000 WebSocket connections per instance is not a capacity
  promise — every queue and message costs memory; proxies must support
  Upgrade and disable unnecessary buffering for streaming/SSE.
- Image healthcheck: probes `/healthz` every 30 seconds with a 3-second
  timeout, 20-second start period, 3 retries; it validates no public
  certificate identity and is **not** `/readyz`.

## The deployment script's real side effects

`deploy-server.sh`:

- **Depends on an existing PostgreSQL** and creates no database.
- Reads a trusted `.env`, logs in/imports/pulls as needed, then
  **force-deletes the old container** and starts a new one — it is not a
  zero-downtime rolling updater.
- Its check only waits for plain
  `http://127.0.0.1:HOST_PORT/auth/config`: built-in TLS, special binds or
  network mappings need separate verification and must not be judged
  unavailable by it.
- Defaults: container port 8080, cache volume and resource limits; it also
  forwards the file's declared application variables — avoid a conflicting
  `VIAT_BIND` in script mode. Non-script keys present only in the caller's
  shell and undeclared in the file are **not** forwarded.
- `ENV_FILE` is sourced as a shell script: load trusted files only and
  **never** run downloaded unknown scripts.

Image-build inputs (`DEBIAN_SUITE` default bookworm, `VITE_MONACO_BUNDLE`
default true with false no longer supported, and
`RUSTUP_DIST_SERVER`/`RUSTUP_UPDATE_ROOT` defaulting to official toolchain
downloads) are all **I (build time)**. `VITE_BASE=./` is the official
image's relative asset path; `VITE_VIAT_API_URL` is a build input for
self-built frontends — not a server switch for changing the API origin
after deployment. See [client and toolchain classification](integrations.md).
