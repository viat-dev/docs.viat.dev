---
title: Health checks and troubleshooting
description: Use liveness, readiness, metrics and execution evidence to diagnose startup, routing, authentication, runtime, storage and integration failures.
doc_id: operations.troubleshooting
verified_release: '1.1.0'
channel: stable
---

# Health checks and troubleshooting

Start with the failing boundary, not a random environment-variable increase. Host/container logs need operator access; project logs need membership; platform-wide audit requires platform Owner. **All commands are unexecuted read-only templates** unless an explicit change procedure elsewhere says otherwise. Do not paste secrets, raw payloads or provider responses into public reports.

## Probe contract

| Route | Authentication | Response and what it does not prove |
| --- | --- | --- |
| `GET /healthz` | Public, outside activation gate | 200 `{"status":"ok"}` means HTTP stack is serving. No DB, activation, runtime/dependency or build-version check. |
| `GET /readyz` | Public, outside activation gate | 200 `{"status":"ready","pool":"ok"}` when DB check succeeds; can be `pool:"saturated"` with no spare existing connections. Empty pool/available connection checks bounded to 2s. 503 `{"status":"not_ready","check":"database"}` on failure; raw DB detail stays in logs. |
| `GET /metrics` | Exact bearer scrape token, only mounted when nonblank configured | No configured token → 404; wrong/missing token on mounted route → 401. Exempt from activation gate. Protect network access. |
| `GET /version` | Platform authentication | Reports this node's version; not an unauthenticated fingerprint endpoint. |

Use `/healthz` for restart decisions and `/readyz` for dependency-based routing decisions appropriate to your topology. Restarting the app does not repair a PostgreSQL outage. Busy is deliberately not automatically unready; monitor saturation separately. Green probes during license lock are intentional so administrators can reach activation.

```sh
docker ps --filter name=viat-server
docker inspect --format '{{.State.Status}} {{.RestartCount}}' viat-server
docker logs --since 15m viat-server
curl --fail-with-body "$BASE/healthz"
curl --fail-with-body "$BASE/readyz"
curl --fail-with-body "$BASE/version" -H "Authorization: Bearer $TOKEN"
```

Use actual container name and a trusted HTTPS `BASE` including prefix. These commands inspect, not repair; do not include live credentials in a copied support bundle. The image probes liveness, not console `/ui/`, so disabling the UI should not make it unhealthy. Deployment wrapper waiting for plaintext `/auth/config` is a different check and can misdiagnose direct TLS configurations.

## Symptom-to-action map

| Symptom | Likely boundary and first checks | Recovery direction |
| --- | --- | --- |
| Process exits before listening | Required DATABASE_URL/master key, bind, TLS pair, DB migration, backend constructor | Preserve startup error; fix actual environment/network/permissions, not project script |
| `db connect` / PoolTimedOut | DB unreachable, exhausted connections, locks or unhealthy shared dependency | Verify PostgreSQL/network and total fleet connection budget before increasing parallelism |
| `db migrate` / checksum mismatch | Schema/data/privilege drift | Stop restart churn, backup, rehearse target migration; never erase applied checksums |
| Cannot spawn worker thread, EPERM on older Docker | Host seccomp/clone3 compatibility | Upgrade runtime/libseccomp. Old bullseye is a temporary bridge; avoid permanent unconfined sandbox |
| 403 `license_required` | Unactivated/expired deployment | Authenticated administrator supplies valid official activation code; green probes are not contradiction |
| 401 on management API | Wrong/expired platform credential; using runtime API key | Reauthenticate with actual management session/PAT; do not replace JWT/master key to “log in” |
| 403 on a project operation | Missing membership/insufficient project role, scope or gate | Verify exact identity, PAT scope and project role; platform role alone is not every project grant |
| Endpoint 404 after editing | Wrong slug/method/path/prefix or unpublished draft; bad run capability on polling | Verify published route and URL; publish with permission or correct capability, not guessed management bypass |
| 429 / Retry-After | Authentication/endpoint quota or failure backoff | Honor retry policy; verify trusted proxy IP and Redis/local scope, do not blanket-disable brute-force protection |
| 413 | Proxy limit, 2 MiB buffered/text cap, multipart file/resource cap | Identify path and budget; use supported streaming/upload route, not a nonexistent global body env knob |
| Worker READY/build timeout | Missing uv/bun, package source/CA/proxy, cache permission or cold install | Inspect environment status/build output, persist cache, fix mirrors/ownership, rebuild with a sane build budget |
| 503 pool/lane/queue admission | Saturation or known failed environment gate | Inspect effective budget/lane, queue age and resource bottleneck; apply bounded backpressure |
| Script timeout / proxy 504 | Execution ceiling versus proxy idle deadline or downstream stall | Correlate request ID: target may still run/commit after proxy disconnect; verify before retrying |
| File PermissionError | Wrong container path/worker UID/mount owner, readonly mount | Correct targeted permissions/UID; do not chown whole host or platform spool |
| Resource decrypt error | Wrong original master key, missing historical backend, expired Vault token or missing external secret | Restore correct key/reference read access; do not overwrite ciphertext |
| Private-CA TLS failure | Trust at actual client boundary or incomplete chain/hostname | Install approved trust/correct chain; no universal CA variable and no global verification disable |
| Empty historical log lines / search 409 | Non-PostgreSQL write backend or retention | Query external backend and inspect sink errors; summaries can still be in PostgreSQL |
| Alert never arrives though request 200 | `delivered:false`, edge already recorded, no channel permit/device | Read body/last_error, fix and explicitly approve test; no automatic unchanged-edge resend |
| Async poll 404 | Missing/wrong run token, wrong project/run or retention | Use returned header capability, verify privileged run existence; 404 hides enumeration |
| Growing disk | Logs, payloads, spool, artifacts, Cargo targets, uv, business data | Determine owner/lifecycle first; deletion may destroy audit/recovery data |

Runtime and backend defaults are in [configuration](../configuration/overview.md). Detailed procedures: [runs](runs.md), [logs](logs.md), [alerts](alerts.md), [audit](audit.md), [retention](retention.md), [capacity](capacity.md), [TLS/proxy](tls-proxy.md).

## Authentication and publication traps

A changed endpoint auth/binding normally does nothing for callers until publish. Authorizer inheritance uses nearest declaration replacing ancestors; authorization gates accumulate until an override boundary. A draft test's permissions/data path differs from a published call. Shared `uses:` dependencies are read live and not rolled back with an endpoint snapshot. Do not “repair” auth by making the endpoint public before identifying the effective rule.

A bootstrap environment password only creates a missing Owner; it does not reset an existing user. MFA-required/enrollment responses are part of the password login handshake, not random 401s to suppress. Keep recovery codes and use documented administrator reset flows. CLI config discovery depends on cwd/upward `.viat` search unless `VIAT_CONFIG_DIR` pins the directory. MCP's legacy token loader is not automatically the current CLI access/refresh format.

## Recover methodically and report useful evidence

1. Preserve UTC timestamps, version/image, symptom/status/code, route without tokens, request/run IDs and sanitized relevant logs.
2. Reproduce in an isolated project with harmless fixture inputs; never trigger live provider/message/device behavior without approval.
3. Change one verified cause, observe probes plus the actual feature and inspect side effects. Restart only with a drain/retry plan.
4. If data/schema corruption or lost secrets are suspected, stop destructive experimentation and use [isolated restore](backup-restore.md) before production replacement.
5. Remove temporary debug verbosity/fixtures, revoke disclosed credentials, record what was and was not verified, and retain incident evidence under policy.

No support procedure should require reading implementation source to discover a mandatory knob. If a behavior is outside the documented interface, treat it as unsupported/unverified rather than inventing an environment variable or guarantee.
