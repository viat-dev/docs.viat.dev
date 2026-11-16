---
title: Health checks and troubleshooting
description: Use liveness, readiness, metrics and execution evidence to diagnose startup, routing, authentication, runtime, storage and integration failures.
doc_id: operations.troubleshooting
verified_release: '1.1.0'
channel: stable
---

# Health checks and troubleshooting

Start from the **failing boundary** — not a random environment-variable
increase. Access: host/container logs need operator rights, project logs
need membership, platform-wide audit needs platform Owner. **All commands
are unexecuted read-only templates** unless an explicit change procedure
says otherwise. Never paste secrets, raw payloads or provider responses
into public reports.

## The probe contract

| Path | Authentication | Returns, and what it does not mean |
| --- | --- | --- |
| `GET /healthz` | Public, outside the activation gate | 200 `{"status":"ok"}` means HTTP is being served — nothing about the database, activation, runtime/dependencies or version. |
| `GET /readyz` | Public, outside the activation gate | Database success gives 200 `{"status":"ready","pool":"ok"}`; all pooled connections busy may answer `pool:saturated`. The empty/idle-connection check has a 2-second budget; failure answers 503 `{"status":"not_ready","check":"database"}` with raw database detail in logs only. |
| `GET /metrics` | Mounted only when configured non-empty; exact bearer required | Unconfigured answers 404; mounted with a wrong/missing token answers 401. Outside the activation gate — protect it with the network. |
| `GET /version` | Platform authentication | This node's version; not an anonymous fingerprinting entry. |

Usage: `healthz` answers **should I restart**; `readyz` answers **dependency
routing** (per your topology). Restarting the app never fixes PostgreSQL
being down; "busy" is not automatically "unready" — monitor saturation
separately. Green probes under license lockout are **deliberate**: the
administrator must still reach activation.

```sh
docker ps --filter name=viat-server
docker inspect --format '{{.State.Status}} {{.RestartCount}}' viat-server
docker logs --since 15m viat-server
curl --fail-with-body "$BASE/healthz"
curl --fail-with-body "$BASE/readyz"
curl --fail-with-body "$BASE/version" -H "Authorization: Bearer $TOKEN"
```

Use the real container name and a trusted HTTPS `BASE` including any prefix.
The commands observe; they repair nothing, and support bundles must not copy
live credentials. The image healthcheck probes liveness, **not** /ui —
disabling the UI must not count as unhealthy. The deployment script's
plaintext `/auth/config` check is different and can misjudge built-in TLS.

## Symptom → action

| Symptom | First boundary to check | Recovery direction |
| --- | --- | --- |
| Exits before listening | Required database/master key, bind, TLS pair, migrations, backend construction | Keep the startup error; fix environment/network/permissions — not project scripts first |
| `db connect` / PoolTimedOut | Database reachability, total connections, locks, dependency failures | Read PostgreSQL and the instance-wide connection budget before adding parallelism |
| `db migrate` / checksum errors | Schema/data/permission drift | Stop restart loops; back up and rehearse; **never delete migration checksums** |
| Old Docker cannot create threads (EPERM) | seccomp/clone3 compatibility | Upgrade runtime/libseccomp; bullseye is transitional, not permanent `unconfined` |
| `403 license_required` | Not activated / expired | An authorized admin submits a valid official code; green probes are no contradiction |
| Management API 401 | Platform credentials wrong/expired, or a run key misused | Use a proper management login/PAT; **never** swap JWT/master key to "fix login" |
| Project operation 403 | Membership/project role, scope, gates | Verify identity, PAT scope and project role; platform role ≠ project authorization |
| 404 after editing an endpoint | Wrong slug/method/path/prefix or unpublished; wrong polling capability | Check published routes and the URL; authorize publish or fix the capability — no invented management bypass |
| 429 / Retry-After | Identity/endpoint quota or failure backoff | Honor retries; check proxy-IP vs Redis/local scope; do not disable brute-force protection wholesale |
| 413 | Proxy, 2 MiB buffered/text, file/resource caps | Locate which path's budget applies; use supported streaming/upload; no invented global body knob |
| READY/build timeouts | Missing uv/bun, package source/CA/proxy, cache permissions, cold installs | Read environment/build output; persist caches, fix mirrors/ownership, sane build budgets |
| Pool/lane/queue 503 | Saturation or failed-environment gating | Check budgets/lanes, queue age and bottlenecks; bounded backpressure |
| Script timeout / proxy 504 | Execution ceiling, proxy idle timeout, downstream stalls | Correlate the request; the target may have committed despite the disconnect — confirm before retrying |
| File PermissionError | Container path, UID, ownership, read-only mounts | Fix permissions/UID precisely; never chown the whole host or the spool |
| Decryption failure | Wrong original master key, missing historical backend, expired Vault or lost secret | Restore correct read access/original key; **never overwrite ciphertext** |
| Private-CA TLS failure | The actual client's trust chain/hostname | Install approved trust, fix the chain; there is no generic CA variable — never disable verification globally |
| Empty history / search 409 | External write backend or retention | Check the target backend/sink; summaries may still be in PostgreSQL |
| Alert 200 but nothing arrived | `delivered:false`, edge already recorded, no permit/device | Read the body/last_error; fix then test **with approval**; never auto-resend unchanged edges |
| Async poll 404 | Wrong/missing capability, wrong project/id, or expired | Use the returned capability header and look up the task with proper permissions; 404 is anti-enumeration by design |
| Disk growth | Logs/payloads/spool/artifacts/target/uv/business data | Separate responsibility and lifecycle first; deletion can destroy audit/recovery evidence |

Defaults: [configuration](../configuration/overview.md). Deeper procedures:
[runs](runs.md), [logs](logs.md), [alerts](alerts.md), [audit](audit.md),
[retention](retention.md), [capacity](capacity.md), [TLS/proxies](tls-proxy.md).

## Authentication and publishing traps

- Endpoint auth/binding changes usually affect callers **after publishing**.
  Authorizers are **replaced** by the nearest declaration; authz gates
  **accumulate** to the override boundary. Draft-test permission/data paths
  differ from published calls; shared `uses` dependencies read live and do
  not roll back with snapshots.
- Until you have located a valid rule, changing public endpoints does not
  "fix" authentication.
- The bootstrap password only creates an Owner that does not exist and
  resets no existing user; MFA required/enrollment belongs to the
  password-login handshake and must not swallow the 401; keep recovery
  codes and use the documented administrator reset.
- The CLI walks up from the working directory for `.viat`;
  `VIAT_CONFIG_DIR` pins a directory. The MCP legacy token does **not
  automatically equal** the CLI's newer access/refresh formats.

## Orderly recovery and reporting

1. Preserve evidence: UTC times, version/image, status/error codes, paths
   without tokens, request/run IDs and relevant redacted logs.
2. Reproduce with an isolated project/harmless fixture; real
   provider/message/device behavior needs approval.
3. Change one confirmed cause at a time; watch probes, actual functionality
   and side effects together; schedule draining/retries before restarts.
4. On suspected data/schema corruption or lost secrets, **stop destructive
   attempts** — perform an [isolated recovery](backup-restore.md) before
   replacing production.
5. Remove debug/fixtures, revoke leaked credentials, record verified and
   unverified boundaries, and retain incident evidence per policy.

Using the product should never require reading source to discover a
required step; behavior beyond the documented interfaces is unsupported/
unverified — invent neither variables nor guarantees.
