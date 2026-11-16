---
title: Security and secret backend configuration
description: Keys, login policy, worker identity and secret backend boundaries with recovery requirements.
doc_id: configuration.security
verified_release: '1.1.0'
channel: stable
---

# Security and secret backend configuration

Every parameter on this page needs **host/service operator privileges** —
project-edit rights never reach here. Account and role management:
[platform users](../instance/platform-users.md); activation:
[activation](../instance/activation.md). All examples are unexecuted;
[table conventions](overview.md) apply.

| Variable | Type; binary default | Range, scope, override and validation |
| --- | --- | --- |
| `VIAT_MASTER_KEY` | string; **required** | S. Exactly 64 hex characters (32 bytes). AES-GCM master key; required even when new secrets go to Vault/AWS. No project override. **Changing it makes old AES ciphertext undecryptable.** |
| `VIAT_JWT_SECRET` | string; `dev-secret-change-me` | S. Token-signing bytes; no minimum length enforced. Production must set a strong independent value; the dangerous default only logs a startup error and **does not block boot**. Changing it invalidates all signed tokens. |
| `VIAT_ACCESS_TTL_SECONDS` | i64; `3600` s | S. Takes precedence over the legacy hours parameter when it parses; otherwise the legacy value/default. AppConfig does not force positivity — configure a sane positive TTL. |
| `VIAT_TOKEN_TTL_HOURS` | i64; unset | S. Deprecated; fallback only when the seconds value is missing or unparseable (×3600 with a warning). Prefer seconds. |
| `VIAT_REFRESH_TTL_SECONDS` | i64; `2592000` s | S. 30 days. Not forced positive; affects future expiry computation and **never rewrites** stored expirations. |
| `VIAT_DEFAULT_ADMIN_EMAIL` | string; unset | S. A non-empty email enables initial Owner creation (password required too). Existing accounts are **never** reset or elevated by changing this. |
| `VIAT_DEFAULT_ADMIN_PASSWORD` | string; unset | S. Pairs with the email to create the initial account; missing/empty skips with a warning. Remove from continuous-deployment config once normal admin access is confirmed. |
| `VIAT_ALLOW_REGISTRATION` | boolean; `true` | D. Trimmed `false`/`no` (case-insensitive) or `0` disables; everything else enables. Docker defaults to false. Gates **platform** registration, not project end-user policy. |
| `VIAT_MFA_REQUIRED` | enum; `off` | D. Case-insensitive: `admins`/`admin` requires high-privilege platform roles; `all`/`true`/`1`/`yes` requires all password users; **anything else (typos included) means off**. No extra TOTP per PAT/OIDC/API-key call. |
| `VIAT_LICENSE_CODE` | string; unset | S. Startup accepts a valid code matching the official image; invalid/expired values are logged, ignored, and never downgrade a longer-lived installed license. Unactivated installs still boot but stay locked. |
| `VIAT_EXPOSE_SCRIPT_ERRORS` | boolean; `false` | D. Only the trimmed literals `1`/`true`/`yes` enable returning script error details to callers. Keep off in production; internal execution logs keep the detail. |
| `VIAT_OUTBOUND_DENY_PRIVATE` | boolean; `false` | D. Trimmed `true`/`yes` (case-insensitive) or `1` enables a save-time URL host check. **Not** a full DNS-rebinding defense or network sandbox (see the end). |
| `VIAT_AUTH_RATELIMIT_IP_PER_MINUTE` | u32; `100` req/min | S. Per auth-route/IP minute budget; 0 disables the bucket. Credential rate limiting persists in PostgreSQL and is shared across nodes. |
| `VIAT_AUTH_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `20` req/min | S. Per auth-route/normalized-identity limit; 0 disables the bucket (not recommended). Login-failure backoff is computed separately. |
| `VIAT_SECRET_BACKEND` | enum; `aes_gcm` | S. Strictly `aes_gcm`/`vault`/`aws`; empty also means AES; unknown values block startup. Decides **new writes only** — no automatic migration of existing secrets. |
| `VAULT_ADDR` | URL; unset | S. Its mere presence initializes Vault (even as a non-writing backend); must be non-empty. Needed for Vault writes and for reading old Vault references. |
| `VAULT_TOKEN` | string; unset | S. Required and non-empty whenever `VAULT_ADDR` is set. A static token with **no auto-renewal**; grant only read/create/update on the scoped KV v2 path. |
| `VAULT_KV_MOUNT` | string; `secret` | S. The KV v2 mount name, not a full `/v1/data` URL. Changing it can make old references unreadable. |
| `VIAT_VAULT_PATH_PREFIX` | string; `viat` | S. New values write to `prefix/UUID` paths; old references keep theirs — historical prefixes stay read-required. |
| `VIAT_SECRETS_AWS` | switch; unset | S. **Only the strict value `1`** initializes AWS Secrets Manager; `true` does not enable it. Needed for AWS writes and old AWS reference reads. |
| `VIAT_AWS_SM_NAME_PREFIX` | string; `viat/` | S. Name prefix for new secrets. The AWS SDK region/credential chain and the Rust artifact S3 credentials are **not** one configuration. |
| `VIAT_WORKER_DROP` | boolean; on | F; Unix only. The literals `0`/`false`/`no` disable privilege dropping. Still requires a privileged parent and a resolvable non-root target; under Docker the parent is root and the worker is 10001/10001. |
| `VIAT_WORKER_UID` | u32; unset | F; Unix only. An explicit positive non-zero UID beats account lookup; invalid or 0 warns and keeps the server identity without blocking startup. |
| `VIAT_WORKER_GID` | u32; with explicit UID | F; Unix only. Only used together with an explicit UID; missing/invalid falls back to the UID's numeric value. OS permissions still apply. |
| `VIAT_WORKER_USER` | string; `viat` | F; Unix only. Account looked up when no UID is set; a missing account or root means no drop with a warning. An unprivileged server cannot change the worker UID. |
| `VIAT_WORKER_DATA_DIRS` | string; unset | S. Colon-separated, **existing** absolute directories (never `/`); ownership is recursively handed to the worker account, subject to symlink/owner checks. Do not list shared host directories whose ownership you may not change. |

## Master key, JWT and the initial account

- Generate independent random values for the master key and JWT with
  `openssl rand -hex 32` in a private terminal and place them in a
  restricted service environment; the commands are examples — never copy
  sample secrets.
- **Back up the master key separately from the database** and rehearse
  recovering both together.
- Nodes sharing one JWT value recognize the same tokens; randomly changing
  only one node's key yields intermittent login/decryption failures.
- The initial Owner is created only when the account does **not** exist:
  editing `VIAT_DEFAULT_ADMIN_PASSWORD` **resets no existing password** and
  elevates no existing low-privilege user.
- Before disabling registration, confirm a working Owner/OIDC/recovery
  channel still exists.
- Before `VIAT_MFA_REQUIRED=admins`, have affected people enroll
  authenticators and store recovery codes offline; `all` widens the blast
  radius. **A misspelled MFA policy equals "off"** — it will not safely
  refuse to boot.

## AES, Vault and AWS in practice

- **AES-GCM** (default): ciphertext lives in the platform PostgreSQL;
  decryption needs the original `VIAT_MASTER_KEY`.
- **Vault KV v2**: prepare the KV v2 mount, TLS trust and a scoped token
  first, then set:

```dotenv
VIAT_SECRET_BACKEND=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=REPLACE_WITH_SCOPED_TOKEN
VAULT_KV_MOUNT=secret
VIAT_VAULT_PATH_PREFIX=viat
```

  The platform writes `/v1/secret/data/viat/UUID` with JSON
  `{"data":{"v":"BASE64_VALUE"}}`; reads expect `data.data.v` at the same
  path. Base64 is not encryption — security rests on Vault itself. The
  token never auto-renews; renewal/rotation and process restarts are
  operator duties, and this client explicitly ignores environment proxies.
- **AWS Secrets Manager**: set `VIAT_SECRETS_AWS=1` and
  `VIAT_SECRET_BACKEND=aws`; use the AWS SDK's default credential/region
  chain (prefer a restricted workload identity); constrain names with
  `VIAT_AWS_SM_NAME_PREFIX`; at minimum `CreateSecret` and
  `GetSecretValue` are required, plus KMS key permissions if KMS is
  configured. **Never** reuse the Rust artifact store's `VIAT_RUST_S3_*`
  as Secrets Manager credentials.

> [!WARNING]
> The backend tag is stored with every blob (`0x01` AES, `0x02` Vault path,
> `0x03` AWS secret name). **Switching the write backend re-encrypts
> nothing**: during migration/rollback keep every historical read backend,
> mount, key and permission; restoring the database without the external
> secrets leaves dead references. Deleting a resource also cleans no
> historical external secrets — lifecycle cleanup belongs to your
> backup/compliance policy.

Verify: write one test secret in an isolated project and read it back
through a legitimate resource call; **never** print secrets into logs. On
failure check in order: the blob's backend → token expiry → region/
permissions → path/mount → network; restore the old read configuration —
**never "fix" by overwriting ciphertext**.

## Important: credential projection is not isolation

The platform clears the worker environment and blocks forwarding of core
platform secrets, and many resources are called through platform-side
proxies with known secrets masked. **But in 1.1.0 some database, cache,
AMQP and S3 resource objects still project credentials into scripts** — so
"no resource secret ever reaches a script" cannot be claimed. Trust
developers according to the sensitivity of the resources they can reach;
log masking neither stops active exfiltration nor replaces least-privilege
resource accounts.

The container's default UID separation only reduces same-UID `/proc`
reading risk — **it is not a sandbox for arbitrary malicious code**:
without a worker account, with an explicitly wrong UID, an unprivileged
parent or dropping disabled, the worker can share the server's identity.
Production must check startup logs and constrain container memory/PIDs,
mounts, egress and host privileges; Rust compilation executes build
scripts, making the build host a sensitive trust boundary too.

`VIAT_OUTBOUND_DENY_PRIVATE` is only a host check on selected save paths:
it resolves neither every DNS result nor arbitrary script sockets. Enforce
policy for untrusted authors with network firewalls/isolated instances.
The full checklist: [security operations](../operations/security.md).
