---
title: Production hardening and security recovery
description: Apply least privilege, isolate script execution, protect credentials and backups, and respond to compromise without overclaiming isolation.
doc_id: operations.security
verified_release: '1.1.0'
channel: stable
---

# Production hardening and security recovery

This checklist is for deployment/security administrators and project owners.
**Never execute live changes merely because they appear here**: all
command/config examples are unexecuted, and production credential rotation,
account resets, network changes and deletions need explicit approval. Exact
parsing/defaults: [security settings](../configuration/security.md).

## Make the trust boundary explicit

Viat executes developer code. Distinct UIDs, cleared environments and
resource proxies **reduce** exposure but **do not guarantee** that malicious
code cannot reach the network, exhaust resources, or read every granted
resource's credentials — in 1.1.0 some database/cache/AMQP/S3 objects still
project credentials into scripts. Therefore:

- Grant code execution only to trusted authors, limited to resources they
  may access; mutually distrusting tenants/workloads get **separate
  instances, accounts and networks**.
- Configure business accounts least-privilege — broad production credentials
  widen what scripts can do, and log masking does not undo that.
- Keep memory/PID limits, syscall constraints and host patching; never mount
  the Docker socket, host root, key directories or unrelated backups into
  script-visible trees.
- Restrict egress with network policy. `VIAT_OUTBOUND_DENY_PRIVATE` is a
  host check on selected save paths — **not** complete DNS-rebinding
  protection and not a firewall for arbitrary code.
- Rust compilation is **privileged code execution on the builder**:
  dependencies/build scripts run before the worker drops privileges.

## Before opening to users

1. Pin the approved 1.1.0 image/digest and record server and client
   versions; use supported hosts/container runtimes with patching — the old
   bullseye image is transitional, not long-term security advice.
2. Set independent strong master key and JWT; store the original master key
   separately and rehearse retrieval; confirm no development-JWT warning at
   startup — **the binary will not refuse to boot on dangerous defaults**.
3. Disable public registration unless explicitly needed; confirm a working
   Owner before removing bootstrap credentials; editing the bootstrap
   password **resets no** existing account.
4. Restrict management entry points: HTTPS plus a trusted
   `VIAT_PUBLIC_URL`; trust forwarded headers only behind a controlled
   proxy. API-only deployments may disable the console/docs, but APIs still
   need authentication/network policy.
5. Check worker-identity logs: under Docker the root parent spawns 10001/
   10001 children; a missing account, invalid UID or disabled dropping puts
   workers in the **same identity** as the server — an unprivileged parent
   does not magically preserve distinct child UIDs.
6. Constrain file/watch/SQLite roots and mount only approved directories;
   `VIAT_WORKER_DATA_DIRS` changes ownership recursively — never point it at
   broad host directories or the platform spool.
7. Prepare enrollment and recovery before mandating MFA; use minimal PAT
   scopes; audit actual **operator/developer/admin/owner** project roles —
   platform roles and project membership differ.
8. Metrics behind a random token on a dedicated network; external
   logs/traces/payloads are sensitive data; a private-CA problem is
   **never** solved by disabling TLS verification.
9. Back up the platform database, master key, external secrets/business
   databases/files consistently and rehearse
   [isolated recovery](backup-restore.md).

## Credential and certificate changes

| Object | Operational procedure | Risks |
| --- | --- | --- |
| Platform JWT | With approval, **restart all nodes together**, then have affected parties re-login/re-issue | Issued tokens invalidate; inconsistent nodes fail intermittently |
| Master key | Keep the original; re-encryption/migration needs a separately designed and verified procedure | Replacing only the environment value renders AES ciphertext unusable; **no automatic rotation** exists |
| Resource credentials | Change via authorized console/API; verify in a controlled way and reconcile live/published behavior | Some script objects can read credentials; old credentials still need provider-side revocation |
| Vault/AWS identity | Rotate the scoped identity; keep read access for historical references; restart static clients as needed | Viat never renews Vault tokens; switching backends migrates no blobs |
| TLS certificates | Atomically replace the matching PEM pair; built-in TLS checks mtime every 60 s | Failed reloads keep the old certificate; expiry/actual fingerprint need external monitoring |
| CLI/MCP sessions/PATs | Revoke **server-side** credentials via real auth controls; remove local copies per policy | Deleting `.viat/config.yaml` proves no server-side revocation |

> [!WARNING]
> Never pass secrets via broad passthrough rules: the deny list protects
> specific core names plus Cargo/SSH prefixes and **recognizes no arbitrary
> application secrets**; tokens inside the default-forwarded package-source
> namespaces are worker-readable too. Validate rules with harmless markers —
> never print real secrets.

## When you suspect compromise

1. Record the UTC window, identities/projects, request/run IDs, nodes and
   images; preserve logs/audit/provider events privately — **never copy
   secrets into tickets**.
2. Isolate malicious entry points, producers and nodes per the incident
   plan; cancelling rolls back no external commits, and killing all
   containers can destroy volatile evidence.
3. Revoke sessions/PATs/resource/provider credentials in the correct
   control plane; review permissions, publish snapshots, shared modules,
   alert destinations and bindings — **old backups can resurrect queues and
   credentials**.
4. Judge exposure with [control-plane/business audit](audit.md), provider
   logs and resource permissions: anonymous requests, partial reads and
   best-effort logs have known gaps — **absence of records is not absence
   of behavior**.
5. Rebuild from approved artifacts and restore into an isolated environment
   — never blindly copy contaminated caches/binaries or replay side effects.
6. Verify recovery with known fixtures: worker identity, activation, probes
   and external monitoring; reopen in stages and record untested
   dependencies and root causes.

## Known guarantee boundaries

- Business PostgreSQL resource `ssl` is currently ignored; MySQL
  `ssl=true` is Preferred (fallback allowed). Enforce transport at
  **validated database/proxy/network boundaries** and verify — a saved
  resource is not evidence; see [database](../configuration/database.md).
- In-process alerting cannot guarantee notification when the
  process/database/egress is down; provider acceptance does not mean the
  recipient received anything.
- Audit tables do not defend against DBAs and are not WORM.
- Leases/locks/idempotency are not blanket exactly-once/HA.

Define compensating controls per risk and compliance requirements.
