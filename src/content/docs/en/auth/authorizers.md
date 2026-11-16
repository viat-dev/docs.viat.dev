---
title: "Authorizer reference"
description: "Every authorizer kind, configuration, secret update rule and external-login boundary."
doc_id: auth.authorizers
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Authorizer reference

An authorizer belongs to one project and records **how** a caller was
admitted. It is not a business role, not a resource credential and not a
platform SSO provider. Everything — **list/detail reads included** —
requires project editor membership (`owner`/`admin`/`developer`). Endpoint
admission is configured separately and published; see
[endpoint authentication](endpoints.md).

## Management requests and update semantics

`GET/POST /projects/{slug}/authorizers`;
`GET/PUT/DELETE .../authorizers/{name}`.

- Creation requires `name` (1–64 bytes) and `kind`; optional `config`
  (default JSON null), optional/null `default_role` (an existing role) and
  optional/null `secret` (kind-specific). Types with required config should
  receive an object — omitting config **does not** bypass validation.
- Response fields: `id`, `project_id`, `name`, `kind`, `config`,
  `default_role_id`, `created_at`, `updated_at` — **never the
  secret/ciphertext**.
- Updates can neither rename nor change kind: omitted/null `config` keeps
  and an object **replaces wholesale**; omitted/null `default_role` keeps,
  `""` clears, a non-empty name resolves an existing role; omitted/null
  secret keeps the existing one (the delegated-social transition is the
  exception, below).
- **Rotate in place; never delete-recreate**: deleting an authorizer
  cascades its API-key relationships — it is not a harmless rename.

Source-derived, unexecuted creation example:

```sh
curl -sS "$BASE/projects/demo/authorizers" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"machine","kind":"api_key","config":{"token_ttl_hours":1},"default_role":"public"}'
```

| `kind` | Credential/entry | Config and boundaries |
| --- | --- | --- |
| `password` | Native identity/password login | `failure_backoff`, interactive-session config; no resource secret |
| `anonymous` | Requests without an identity | Must be exposed explicitly via a named anonymous authorizer; creates no end user |
| `api_key` | `Bearer vsk_...` or `_token` client credential | `token_ttl_hours` default 1, issuance range 1–24; keys belong to project users |
| `oauth_oidc` | Browser redirect to external OIDC | issuer/client/scopes/redirect, encrypted client secret, interactive-session config |
| `jwt` | External asymmetric JWT bearer | issuer/audience required; PEM or JWKS, not both |
| `social` | Server-side authorization-code exchange | Provider-specific config/secrets, optional platform-app delegation, interactive-session config |
| `chat` | Created by the platform for bound chat senders | Created on first binding; **cannot** be created manually; the reserved name `chat` is refused too |

`default_role` is used by applicable user-creation flows — it is **not** a
per-request instruction overriding every existing user's role. Chat-bound
calls attribute to the platform `chat` row, not the password authorizer
that once proved the binding.

## Password failure backoff and sessions

- Omitted/null `failure_backoff` defaults to
  `{after_failures:5,max_delay_secs:900}`; inner `after_failures` is an
  integer 0–86400 (0 disables) and `max_delay_secs` 1–86400; unknown inner
  keys/wrong types are rejected.
- Backoff tracks consecutive failures per identity **and client address**,
  waiting 1, 2, 4… seconds up to the cap, resetting on success. Multiple
  password authorizers combine into the **strictest** enabled
  configuration — callers cannot shop for the loosest entrance. Global
  identity/IP rate limits still apply.
- Password/OIDC/social share interactive config:
  `login_token_ttl_hours` defaults to 12 (integer 1–720) when
  omitted/null; `session` omitted/null means no refresh; an object must
  carry `idle_timeout_hours` (1–8760, not below the token TTL) with
  optional `max_lifetime_hours` (default 720; explicit values ≥ idle and
  ≤ 8760). To delete/reset a key, send a **full replacement config**, not
  a nested partial patch. Refresh and logout: [endpoint
  authentication](endpoints.md).

## External OIDC (`oauth_oidc`)

- Required `config.issuer`, `client_id`, `post_login_redirect_uri`;
  optional/null `scopes` default to
  `["openid","profile","email"]` and an explicit list must contain the
  exact value `openid`; `discovery_cache_ttl_secs` is optional, 60–86400.
  The issuer must be HTTPS (localhost/127.0.0.1 may use HTTP); the client
  ID is non-empty ≤512 bytes; the redirect must parse as a URL.
- Secret shape `{"client_secret":"..."}`: required non-empty ≤1024 bytes
  at create; omitted/null/blank on update **keeps** the old value and
  never clears.

```json
{"name":"external-login","kind":"oauth_oidc","config":{"issuer":"https://identity.example.invalid","client_id":"fixture-client","scopes":["openid","profile","email"],"post_login_redirect_uri":"https://app.example.invalid/signed-in","discovery_cache_ttl_secs":3600},"secret":{"client_secret":"REPLACE_WITH_PROVIDER_SECRET"},"default_role":"public"}
```

Register the exact callback
`BASE/projects/demo/auth/oidc/external-login/callback` with the provider.
Flow: browser entry `GET /projects/demo/auth/oidc/external-login/start` →
the callback validates state/code/provider tokens → creates/resolves the
project identity → redirects to your app with the Viat login result.
Never send the provider secret to the browser; this is **not** the
platform-account `/auth/oidc/{name}/start`. Provider registration,
discovery-document connectivity and real SSO were not tested here.

## External JWT (`jwt`)

`issuer` and `audience` are required non-empty; `subject_claim` defaults
to `sub` (non-empty when provided). Key modes — exactly one:

```json
{"name":"external-jwt","kind":"jwt","config":{"issuer":"https://identity.example.invalid","audience":"fixture-api","jwks_url":"https://identity.example.invalid/.well-known/jwks.json","subject_claim":"sub"},"default_role":"public"}
```

- **PEM**: `public_key_pem` plus `algorithm:"RS256"` or `"ES256"` with a
  parseable matching public key — it can go stale when the upstream
  rotates.
- **JWKS**: `jwks_url` (HTTPS or loopback HTTP) selecting keys by the
  token's `kid`; supports RS256/384/512, PS256/384/512, ES256/384. There
  is **no** shared-symmetric-secret JWT authorizer and no EdDSA mode.

Tokens must pass signature, expiry, issuer, audience and subject
validation. Project identities are isolated per authorizer
(`jwt:<authorizer>:<subject>`) — a low-trust project management entrance
**cannot** pre-seed federated identities; only verified claims can become
declared subject attrs/scope claims, **never** plain request bodies.
Leave an overlap window when rotating JWKS upstream; send the full config
when replacing a PEM.

## Social providers and authorization codes

Required: `config.provider` and `app_id` (appid/corpid/AppKey). Optional
fields:

| Field | Default/rules |
| --- | --- |
| `agent_id` | WeCom self-built app agent ID; required by ordinary WeCom app configs |
| `identity_key` | Prefers unionid when present, else the native key; allowed values below |
| `scopes` | Defaults below; each non-empty, ≤64 bytes |
| `qr_login` | false; WeCom true uses QR instead of the in-app H5 |
| `collect_phone` | false; needs provider permission and phone authorization/payload |
| `post_login_redirect_uri` | Required valid URL for redirect-style providers; unnecessary for pure-code providers |
| `api_base`, `auth_base` | Provider defaults; test/egress origins must be HTTPS or loopback HTTP and still obey the host allowlist |
| `alipay_public_key` | Alipay verification RSA public key, required where applicable; **not** a secret |
| `platform_app` | Omitted/null = own app; otherwise a reference to a compatible platform app in this project |

| Provider | Entry/default scopes | Explicit `identity_key` values |
| --- | --- | --- |
| `weixin_mp` | WeChat H5 / `snsapi_userinfo` | `unionid`, `openid` |
| `weixin_open` | Website QR / `snsapi_login` | `unionid`, `openid` |
| `weixin_mini` | `wx.login` code only / empty | `unionid`, `openid` |
| `wecom` | In-app H5 or QR / `snsapi_base` | `userid` |
| `dingtalk` | Browser / `openid` | `unionid`, `openid` |
| `dingtalk_app` | `dd.getAuthCode` only / empty | `unionid`, `userid` |
| `alipay` | Browser / `auth_user` | `user_id`, `open_id` |
| `alipay_mini` | `my.getAuthCode` only / `auth_base` | `user_id`, `open_id` |
| `douyin` | Browser / `user_info` | `unionid`, `open_id` |
| `douyin_mini` | `tt.login` only / empty | `unionid`, `open_id` |
| `kuaishou` | Browser / `user_info` | `open_id` |
| `kuaishou_mini` | `ks.login` only / empty | `open_id` |

Secrets: non-Alipay own apps require `secret.app_secret` non-empty
≤1024 bytes; Alipay uses `app_private_key` (RSA PEM/base64, ≤8192 bytes)
plus the public verification key; Alipay mini-program phone collection
needing its own AES decryption requires `aes_key`. Updates merge
**non-empty** social secrets field-by-field into the existing secret;
omitted/blank does not erase neighbors; after switching configuration you
must still hold the new provider's credentials.

Routes and semantics:

- Browser: `GET /p/{slug}/_social/{name}/start` with the provider
  callback `GET .../callback`; the code entrance `POST .../exchange`
  requires `code` with optional `phone_code`, `phone_data`, `client_id`,
  `client_secret`, `link`.
- Mini-program phone payloads differ per provider; `collect_phone:true`
  **cannot** fabricate phone consent. The Viat login result follows the
  interactive-session policy.
- `link` requires an existing authenticated identity: submitting a code or
  claiming a unionid at will **proves no** account ownership. unionid is
  scoped by platform family/tenant, openid by application — bare strings
  merge no one.
- Delegation uses `platform_app` plus the delegated account's `app_id`
  (compatibility: [platform apps](platform-apps.md)). Transitioning to
  delegation **removes** the old app secret so it cannot silently return;
  the Alipay mini-program phone AES key is retained separately as needed.
  Returning to an own app requires a valid own secret.

## Security, failures and cleanup

- Passing validation **does not** mean provider integration works: verify
  callback origins/TLS trust, provider permissions, project roles, the
  published authorizer list and denial cases.
- Common errors: `400` bad config, `409` name conflict, `404` missing
  object, `403` insufficient editor rights; logins/exchanges can still
  fail on state, upstream networking, tokens or scopes. **Never** make
  issuer/audience optional or disable TLS verification to "get past" a
  problem.
- Rotation: rotate secrets in place and retire the old upstream
  credential only after new logins verify; deleting the Viat row
  **unregisters nothing** upstream.
- Cleanup: clear endpoint references and review the publish plan before
  removing an isolated authorizer; credentials never enter repo-sync
  config or copied provider responses.

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/authorizer.rs`,
`crates/viat-api/src/{dto.rs,handlers/authorizers.rs,handlers/oidc.rs,social/mod.rs,social/handlers.rs,login_backoff.rs,project_session.rs,middleware_project.rs}`,
`crates/viat-auth/src/jwt.rs`. Every recipe is unexecuted.
