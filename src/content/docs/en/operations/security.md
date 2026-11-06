---
title: Production hardening and security recovery
description: Apply least privilege, isolate script execution, protect credentials and backups, and respond to compromise without overclaiming isolation.
doc_id: operations.security
verified_release: '1.1.0'
channel: stable
---

# Production hardening and security recovery

This checklist is for deployment/security administrators and project owners. **Do not execute live changes solely because they appear here.** All command/config examples in this manual are unexecuted; production credential rotation, account resets, network changes and deletion need explicit approval. See [security settings](../configuration/security.md) for exact defaults/parsers.

## Establish the trust boundary

Viat executes developer-supplied code. Distinct worker UID, cleared environments and resource brokers reduce exposure; they are **not** a guarantee that hostile code cannot use the network, consume resources or read every granted resource credential. Some database/cache/AMQP/S3 objects still project credentials to scripts in 1.1.0. Therefore:

- Give code-authoring access only to trusted authors for the resources they can access; use separate instances/accounts/networks for mutually untrusted tenants/workloads.
- Keep resource database/service accounts least-privilege. A resource with broad production credentials expands the authority of scripts, regardless of log masking.
- Keep container memory/PID limits, syscall confinement and host patching. Do not mount Docker socket, host root, platform key directories or unrelated backups into script-visible trees.
- Enforce egress with network controls. `VIAT_OUTBOUND_DENY_PRIVATE` is a selected save-time host check, not complete DNS-rebinding protection or arbitrary-code firewall.
- Treat Rust compile permission as privileged code execution on the builder: Cargo dependencies/build scripts can execute before runtime worker UID drop.

## Before exposure to users

1. Pin an approved 1.1.0 image/digest and record server/client versions separately. Use a supported host/container runtime and maintain security updates; old bullseye images are a transition path, not an evergreen security recommendation.
2. Set independent strong master/JWT values, keep the original master key in separate recovery custody, and verify no built-in development JWT warning appears at startup. The binary does not fail closed on the known JWT default.
3. Keep public registration disabled unless deliberately required; confirm a working Owner before removing bootstrap credentials. Bootstrap password changes do not reset existing accounts.
4. Restrict management ingress, serve HTTPS, set a trusted `VIAT_PUBLIC_URL`, and only trust forwarded IP headers behind controlled proxies. An API-only node can disable console/docs, but the API still needs authentication/network policy.
5. Check worker identity startup logs: Docker parent is root to launch uid/gid 10001 children. Missing account, malformed explicit UID or disabled drop may keep workers at server identity. Running the parent unprivileged does not somehow preserve a distinct child UID.
6. Limit file/watch/SQLite roots and mount only approved directories. `VIAT_WORKER_DATA_DIRS` changes ownership recursively; never point it at broad host trees or the platform spool.
7. Enable suitable MFA policy after enrollment/recovery preparation, use least-privilege PAT scopes, and review actual **operator/developer/admin/owner** project assignments. Platform roles and project membership differ.
8. Protect `/metrics` with a random token and monitoring-only network access; protect remote log/trace stores and payloads as sensitive data. Do not disable TLS verification to get private-CA integrations working.
9. Back up platform data, master key, external secrets/business stores/file bytes consistently and validate an [isolated restore](backup-restore.md).

## Credential and certificate change plan

| Item | Supported operational approach | Hazard |
| --- | --- | --- |
| Platform JWT secret | Approved coordinated restart of all nodes, then reauthenticate/reissue affected credentials | Invalidates signed tokens; inconsistent nodes cause intermittent failures |
| Master key | Preserve existing key; any re-encryption/migration needs a separately designed, verified procedure | Replacing env value alone strands AES ciphertext; not an automatic rotation feature |
| Resource credential | Update using authorized resource API/console, validate controlled target, coordinate published/live behavior | Some objects are readable in scripts; old credentials need explicit provider revocation |
| Vault token/AWS identity | Rotate scoped provider identity, keep historical-reference read access; restart static-config clients as required | Vault token is not renewed by Viat; changing backend selector does not migrate blobs |
| TLS certificate | Atomically replace matched PEM pair; direct TLS polls mtimes every 60s | Bad reload keeps previous cert; monitor expiry/served fingerprint externally |
| CLI/MCP session/PAT | Revoke server-side session/token using actual auth controls, remove local copy under policy | Deleting `.viat/config.yaml` alone is not proof every server credential was revoked |

Do not forward secrets via broad `VIAT_RUNTIME_ENV_PASSTHROUGH` rules. The denylist protects specific core names and Cargo/SSH families, **not every possible application secret**. Package-registry tokens in default forwarded namespaces can be visible to workers. Validate custom passthrough with harmless markers, not real credentials in script output.

## Detect and contain a suspected compromise

1. Record UTC interval, affected identities/projects, request/run IDs and node/image versions. Preserve privately scoped logs/audit/backend events; avoid copying live secrets into incident tickets.
2. Fence malicious ingress/producers and isolate affected nodes under the incident plan. Cancelling a run may not cancel already-committed external work; killing every container may destroy useful volatile evidence.
3. Revoke affected sessions/PATs/resource/provider credentials through the correct control plane. Review project permissions, published snapshots, shared modules, alert destinations and external account bindings. A restored old backup can resurrect queued work/credentials.
4. Determine exposure using [control/business audit](audit.md), provider logs and resource permissions. Absence of a row is not proof of no activity: anonymous noise, some reads and best-effort sink failures have documented gaps.
5. Rebuild from approved artifacts and restore known-good data into isolation. Do not blindly copy compromised caches/binaries or replay queued side effects.
6. Prove recovery with known fixtures, correct worker identity, activation, probes and external monitoring; reopen in stages, record residual unvalidated dependencies and review root cause.

## Known transport and assurance limits

Business `postgresql` resource `ssl` is currently ignored; MySQL `ssl=true` means Preferred and can fall back. Enforce required transport at a validated database/proxy/network boundary and verify it, rather than treating resource save as proof. See [database configuration](../configuration/database.md).

In-process alerts cannot guarantee notification during process/DB/egress failure; provider acceptance is not recipient delivery. Audit tables are not independent WORM storage against a DBA. Leases/advisory locks and idempotency records are not blanket exactly-once/HA guarantees. Explicitly document any compensating controls needed by your risk/compliance requirements.
