---
title: Security and secret backend configuration
description: Keys, login policy, worker identity and secret backend boundaries with recovery requirements.
doc_id: configuration.security
verified_release: '1.1.0'
channel: stable
---

# Security and secret backend configuration

Set these with host/service operator privileges; project-edit permission does not authorize changing the deployment environment. See [platform users](../instance/platform-users.md) and [activation](../instance/activation.md). All examples are unexecuted.

[Table conventions](overview.md) apply.

| Variable | Type; binary default | Range, scope, override and validation |
| --- | --- | --- |
| `VIAT_MASTER_KEY` | string; required / 必填 | S. Exactly 64 hexadecimal characters (32 bytes). AES-GCM key; required even when new secrets use Vault/AWS. No project override. A different key cannot decrypt existing AES blobs. |
| `VIAT_JWT_SECRET` | string; `dev-secret-change-me` | S. Signing bytes; no enforced minimum length. Production must supply a strong unique value; the default only emits a startup error and does not stop boot. Changing it invalidates signed tokens. |
| `VIAT_ACCESS_TTL_SECONDS` | i64; `3600` s | S. Parsed value wins over legacy hours; otherwise legacy value/default. No positivity clamp in AppConfig; use a positive lifetime. |
| `VIAT_TOKEN_TTL_HOURS` | i64; unset / 未设置 | S. Deprecated fallback only if access TTL is absent/unparseable; multiplied by 3600 with warning. No positivity clamp. Prefer seconds. |
| `VIAT_REFRESH_TTL_SECONDS` | i64; `2592000` s | S. 30 days. No positivity clamp in AppConfig. Changes future lifetime calculations, not a promise to rewrite all stored expiry timestamps. |
| `VIAT_DEFAULT_ADMIN_EMAIL` | string; unset / 未设置 | S. Non-empty bootstrap email opts into one-time Owner creation; requires password. Existing account is never reset/promoted by changing this value. |
| `VIAT_DEFAULT_ADMIN_PASSWORD` | string; unset / 未设置 | S. Needed with bootstrap email for a new account; missing/empty skips seed with warning. Remove bootstrap credentials from ongoing deployment after confirming alternate access. |
| `VIAT_ALLOW_REGISTRATION` | boolean; `true` | D. False spellings: trimmed case-insensitive false/no, or 0. Other present values enable. Docker sets false. Platform registration, not each project end-user policy. |
| `VIAT_MFA_REQUIRED` | enum; `off` | D. Case-folded admins/admin → elevated platform roles; all/true/1/yes → all password users; other values including typos → off. Does not add TOTP to every PAT/OIDC/API-key call. |
| `VIAT_LICENSE_CODE` | string; unset / 未设置 | S. Valid official activation code adopted at boot; invalid/expired ignored with logs and cannot downgrade a longer installed license. No code: boots locked. |
| `VIAT_EXPOSE_SCRIPT_ERRORS` | boolean; `false` | D. Only trimmed literal 1/true/yes enables caller-visible script error text. Keep off in production; execution logs still carry internal detail. |
| `VIAT_OUTBOUND_DENY_PRIVATE` | boolean; `false` | D. Trimmed case-insensitive true/yes or 1 opts into save-time URL host checks. Not a complete DNS-rebinding defense or network sandbox; see hardening below. |
| `VIAT_AUTH_RATELIMIT_IP_PER_MINUTE` | u32; `100` requests/min | S. Per authentication route/IP bucket. 0 disables this bucket. Credential throttles are durable in PostgreSQL across nodes. |
| `VIAT_AUTH_RATELIMIT_IDENTITY_PER_MINUTE` | u32; `20` requests/min | S. Authentication route/normalized identity budget. 0 disables this bucket; not recommended. Additional failed-login backoff is separate. |
| `VIAT_SECRET_BACKEND` | enum; `aes_gcm` | S. Exactly aes_gcm/vault/aws; empty also AES. Unknown value aborts startup. Selects new writes only, not automatic migration of existing secrets. |
| `VAULT_ADDR` | URL; unset / 未设置 | S. Presence initializes Vault even if not selected for writes; non-empty required. Needed for vault write backend and reads of old Vault blobs. |
| `VAULT_TOKEN` | string; unset / 未设置 | S. Required/non-empty when VAULT_ADDR exists. Static token; no automatic renewal. Provide narrowly scoped KV v2 read/create/update rights. |
| `VAULT_KV_MOUNT` | string; `secret` | S. KV v2 mount name, not full /v1/data URL. Changing it can make existing references unreadable. |
| `VIAT_VAULT_PATH_PREFIX` | string; `viat` | S. New values use prefix/UUID paths; old blob paths remain self-described. Keep read permission for historical prefixes. |
| `VIAT_SECRETS_AWS` | switch; unset / 未设置 | S. Exactly 1 initializes AWS Secrets Manager. Required for aws write backend and reads of old AWS blobs. Not enabled by true. |
| `VIAT_AWS_SM_NAME_PREFIX` | string; `viat/` | S. Prefix of new Secrets Manager secret names. AWS SDK region/credential chain is separate from Rust S3 artifact credentials. |
| `VIAT_WORKER_DROP` | boolean; on / 开启 | F; Unix only. Literal 0/false/no disables UID drop. A privileged parent and resolvable non-root target are still required. Docker parent is root, workers uid/gid 10001. |
| `VIAT_WORKER_UID` | u32; unset / 未设置 | F; Unix only. Explicit positive nonzero UID overrides user lookup. Malformed or 0 leaves workers at server identity with warning, not a hard startup failure. |
| `VIAT_WORKER_GID` | u32; explicit UID / 显式 UID | F; Unix only. Only used with explicit UID; invalid/unset falls back to UID. OS permission checks still apply. |
| `VIAT_WORKER_USER` | string; `viat` | F; Unix only. Used when UID not set; missing/root account means no drop and warning. Unprivileged server cannot change worker UID. |
| `VIAT_WORKER_DATA_DIRS` | string; unset / 未设置 | S. Colon-separated existing absolute directories, not /. Recursively adopts ownership for worker identity; symlink/ownership rules apply. Omit shared host trees you do not intend to chown. |

## Keys, JWT and bootstrap access

Generate independent master/JWT random values with `openssl rand -hex 32` in a private terminal and store them in a restricted service environment. This is an unexecuted example, not a supplied password. Keep the master key separately from database backups and rehearse restoring both. Nodes sharing one database need consistent cryptographic configuration; changing a single node's key produces intermittent authentication/decryption failures.

The bootstrap Owner is created only when the account does not exist. Changing `VIAT_DEFAULT_ADMIN_PASSWORD` **does not reset an existing password** or promote an existing lower-role account. Before closing registration, prove an Owner, OIDC or recovery path works. Before `VIAT_MFA_REQUIRED=admins`, enroll affected users and store recovery codes offline; `all` expands the affected audience. A misspelled MFA policy disables enforcement rather than safely refusing startup.

## AES, Vault and AWS in practice

- **AES-GCM**: default; ciphertext is in platform PostgreSQL and requires the original `VIAT_MASTER_KEY`.
- **Vault KV v2**: prepare a KV v2 mount, trusted TLS and scoped token before setting this configuration; the example does not create a real secret.

```dotenv
VIAT_SECRET_BACKEND=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=REPLACE_WITH_SCOPED_TOKEN
VAULT_KV_MOUNT=secret
VIAT_VAULT_PATH_PREFIX=viat
```

The platform writes `/v1/secret/data/viat/UUID` with `{"data":{"v":"BASE64_VALUE"}}`, then reads that path expecting `data.data.v`. Base64 is not encryption; Vault's protections still matter. The static token is not renewed automatically: token renewal/rotation and process restart are operator responsibilities. This client explicitly bypasses environment proxies.

- **AWS Secrets Manager**: set `VIAT_SECRETS_AWS=1` and `VIAT_SECRET_BACKEND=aws`; use the AWS SDK default credential/region chain, preferably scoped workload identity. Restrict creation/reading to names under `VIAT_AWS_SM_NAME_PREFIX`; the implementation needs corresponding `CreateSecret` and `GetSecretValue` privileges and appropriate KMS permissions if applicable. Rust artifact `VIAT_RUST_S3_*` credentials are not Secrets Manager credentials.

Each blob retains a backend tag: `0x01` AES, `0x02` Vault path, `0x03` AWS secret name. Changing the write backend **does not re-encrypt existing data**. Keep historical read backends, mounts, keys and permissions during migration/rollback. A restored database without its external secrets contains unusable references. Do not assume resource deletion cleans up every historical external secret; manage lifecycle under a separate backup/compliance policy.

In an isolated project, save one fixture secret and verify it through an authorized resource operation without logging it. On failure inspect the blob's backend, token expiry, region/permissions, mount/path and network; restore read access rather than overwriting ciphertext as a “repair”.

## Important: credential projection is not absolute isolation

The platform clears worker environments, blocks core platform-secret passthrough, brokers many resource calls and masks known secrets. However, **in 1.1.0 some database, cache, AMQP and S3 script resource objects still expose credentials to scripts**. Do not claim that all resource secrets always stay platform-side. Trust code authors according to the sensitivity of resources they can access; log masking does not stop deliberate exfiltration or replace least-privilege resource accounts.

Docker's distinct worker UID reduces same-UID `/proc` exposure; it is **not a complete hostile-code sandbox**. Missing worker account, malformed explicit UID, an unprivileged parent, or disabling the drop can leave workers at the server's identity. Check startup logs and constrain container memory/PIDs, mounts, egress and host privileges. Rust compilation can execute build scripts, so the builder is also a sensitive trust boundary.

`VIAT_OUTBOUND_DENY_PRIVATE` is a host check on selected save paths, not validation of all DNS resolutions or a restriction on arbitrary script sockets. Enforce untrusted-code policy with network controls/isolated instances. See [security operations](../operations/security.md).
