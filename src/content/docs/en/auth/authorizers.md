---
title: "Authorizer reference"
description: "Every authorizer kind, configuration, secret update rule and external-login boundary."
doc_id: auth.authorizers
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Authorizer reference

An authorizer belongs to one project and records **how** a caller was admitted. It is not a business role, a resource credential or a platform SSO provider. You need project editor membership (`owner`, `admin`, `developer`) even for authorizer list/detail reads. Configure endpoint admission separately and publish; see [endpoint authentication](endpoints.md).

## Management envelope and update semantics

`GET/POST /projects/{slug}/authorizers`; `GET/PUT/DELETE .../authorizers/{name}`. Creation requires `name` (1–64 bytes as checked by the handler), `kind`; optional `config` defaults JSON null, optional/null `default_role` names an existing role, optional/null `secret` carries kind-specific secrets. Use an object config for kinds with settings; omitted config does not bypass required-kind validation.

Response fields are `id`, `project_id`, `name`, `kind`, `config`, `default_role_id`, `created_at`, `updated_at`. Secrets/ciphertext are not returned. Update cannot rename or change kind: omitted/null `config` keeps it, a supplied config replaces the entire object; omitted/null `default_role` keeps it, `""` clears, a nonempty name resolves an existing role. Omitted/null secret keeps stored secrets except the delegated-social transition described below. Rotate in place instead of delete/recreate: deleting an authorizer cascades its API-key relationship and is not a harmless rename.

Source-derived **unexecuted** creation example:

```sh
curl -sS "$BASE/projects/demo/authorizers" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"machine","kind":"api_key","config":{"token_ttl_hours":1},"default_role":"public"}'
```

| `kind` | Credential/entry | Configuration and boundary |
| --- | --- | --- |
| `password` | Native identity/credential login | `failure_backoff`, interactive session settings; no resource secret |
| `anonymous` | No admitted identity | Explicit public admission through a named anonymous authorizer; does not create an end user |
| `api_key` | `Bearer vsk_...` or `_token` client credentials | `token_ttl_hours` default 1, issuance range 1–24; keys belong to project users |
| `oauth_oidc` | Browser redirect to external OIDC provider | Issuer/client/scopes/redirect, encrypted client secret, interactive session settings |
| `jwt` | External asymmetric bearer JWT | Required issuer/audience and exactly one PEM/JWKS key source |
| `social` | Provider authorization code exchanged server-side | Provider-specific config/secret, optional delegated platform app, interactive session settings |
| `chat` | Platform-created identity for a bound chat sender | Created on first binding; cannot be manually created; reserved name `chat` also refused |

A default role is used by applicable user-creation flows; it is not an instruction to overwrite all existing users' roles on every request. Do not use a password authorizer as the log attribution for chat binding: the platform's `chat` row identifies that admission path.

## Password backoff and session settings

`failure_backoff` missing/null defaults `{after_failures:5,max_delay_secs:900}`. Optional nested `after_failures` integer 0–86400 (0 disables), `max_delay_secs` integer 1–86400. Unknown nested keys/ill-typed values fail validation. Consecutive failures for identity **and client address** cause 1, 2, 4… second delays capped by maximum; success clears streak. Multiple password authorizers use the strictest enabled combination, not the caller-selected easiest one. Global identity/IP throttles still apply.

Shared interactive config on password/OIDC/social: `login_token_ttl_hours` missing/null = 12, integer 1–720; `session` missing/null = no refresh. Object `session` requires `idle_timeout_hours` (1–8760, at least token TTL), optional `max_lifetime_hours` (default 720, explicit value at least idle and at most 8760). Remove/reset these keys in the **complete replacement config**, not by sending a partial nested patch. Full refresh/logout semantics are in [endpoint authentication](endpoints.md).

## External OIDC (`oauth_oidc`)

Required `config.issuer`, `client_id`, `post_login_redirect_uri`; optional/null `scopes` defaults `["openid","profile","email"]` and, if supplied, must contain exact `openid`; `discovery_cache_ttl_secs` optional 60–86400. Issuer must be HTTPS except HTTP localhost/127.0.0.1. Client ID must be nonblank and at most 512 bytes. Redirect must parse as a URL. Secret is `{"client_secret":"..."}`: required nonblank at creation, at most 1024 bytes; omitted/null or blank on update keeps the stored secret, it does not clear it.

```json
{"name":"external-login","kind":"oauth_oidc","config":{"issuer":"https://identity.example.invalid","client_id":"fixture-client","scopes":["openid","profile","email"],"post_login_redirect_uri":"https://app.example.invalid/signed-in","discovery_cache_ttl_secs":3600},"secret":{"client_secret":"REPLACE_WITH_PROVIDER_SECRET"},"default_role":"public"}
```

Register the exact external-provider redirect `BASE/projects/demo/auth/oidc/external-login/callback`. Browser entry is `GET /projects/demo/auth/oidc/external-login/start`; the callback validates state/code/provider tokens and creates/resolves a project identity, then redirects to configured application URI with Viat login material. Do not expose the provider secret to the browser. This is **not** `/auth/oidc/{name}/start`, which signs platform accounts in. Provider registration, discovery connectivity and real SSO were not tested here.

## External JWT (`jwt`)

Required `issuer`, `audience` nonempty strings. Optional `subject_claim` defaults `sub`, if supplied must be a nonempty string. Exactly one mode:

```json
{"name":"external-jwt","kind":"jwt","config":{"issuer":"https://identity.example.invalid","audience":"fixture-api","jwks_url":"https://identity.example.invalid/.well-known/jwks.json","subject_claim":"sub"},"default_role":"public"}
```

- PEM: `public_key_pem` plus `algorithm: "RS256"` or `"ES256"`; parseable matching public PEM. This key becomes stale on upstream rotation.
- JWKS: `jwks_url`, HTTPS or loopback HTTP. Selects published key by token `kid`; supported asymmetric algorithms are RS256/384/512, PS256/384/512, ES256/384. No symmetric shared-secret JWT authorizer and no EdDSA mode are documented here.

Signature, expiry, issuer, audience and subject must pass. The resolved project identity is namespaced by authorizer (`jwt:<authorizer>:<subject>`); do not preseed federated identities from lower-trust project administration. Verified claims can feed declared subject attrs/scope claims; unverified body fields cannot. Rotate JWKS at its owner with overlap; replacing a PEM config is a whole-config update.

## Social providers and code flows

Required `config.provider`, `app_id` (the app ID/corp ID/AppKey). Optional fields:

| Field | Default / rule |
| --- | --- |
| `agent_id` | WeCom self-built agent ID; required for ordinary WeCom app configuration |
| `identity_key` | Prefer unionid when available, otherwise native key; allowed choices below |
| `scopes` | Provider defaults below; entries nonblank, at most 64 bytes |
| `qr_login` | false; WeCom uses QR rather than in-app H5 when true |
| `collect_phone` | false; requires provider permissions and phone payload/authorization |
| `post_login_redirect_uri` | Required for redirect providers; valid URL; not needed for code-only providers |
| `api_base`, `auth_base` | Provider defaults; test/egress origins, HTTPS or loopback HTTP; host allowlist still applies |
| `alipay_public_key` | Alipay verification RSA key, required where validated; public, not a secret |
| `platform_app` | Absent/null means first-party app; name of this project's compatible delegated platform app otherwise |

| Provider | Entry/default scopes | Allowed explicit `identity_key` |
| --- | --- | --- |
| `weixin_mp` | WeChat H5 / `snsapi_userinfo` | `unionid`, `openid` |
| `weixin_open` | Website QR / `snsapi_login` | `unionid`, `openid` |
| `weixin_mini` | `wx.login` code only / empty | `unionid`, `openid` |
| `wecom` | In-app H5 or QR / `snsapi_base` | `userid` |
| `dingtalk` | Browser / `openid` | `unionid`, `openid` |
| `dingtalk_app` | `dd.getAuthCode` code only / empty | `unionid`, `userid` |
| `alipay` | Browser / `auth_user` | `user_id`, `open_id` |
| `alipay_mini` | `my.getAuthCode` code only / `auth_base` | `user_id`, `open_id` |
| `douyin` | Browser / `user_info` | `unionid`, `open_id` |
| `douyin_mini` | `tt.login` code only / empty | `unionid`, `open_id` |
| `kuaishou` | Browser / `user_info` | `open_id` |
| `kuaishou_mini` | `ks.login` code only / empty | `open_id` |

First-party `secret.app_secret` is required for non-Alipay providers (nonblank, <=1024 bytes). Alipay uses `app_private_key` (RSA PEM/base64, <=8192 bytes) and public verification key; `aes_key` is required when Alipay mini-program phone collection needs its own AES decryption. Updates merge nonblank social secret fields over stored ones; omitted/blank does not erase a neighboring field. Switching config must still leave valid provider credentials.

Browser routes: `GET /p/{slug}/_social/{name}/start`, provider callback `GET .../callback`. Code route: `POST .../exchange` with required `code`, optional `phone_code`, `phone_data`, `client_id`, `client_secret`, `link`. Mini-program phone data shapes are provider-specific; a phone permission cannot be fabricated by setting `collect_phone:true`. Returned Viat login material follows the interactive-session policy. `link` requires the existing authenticated identity; arbitrary provider code/claimed unionid is not proof of account ownership. Unionid is family/platform-scoped, openid is app-scoped; do not merge unrelated people by a bare string.

Delegation uses `platform_app` plus authorized account `app_id`; compatible families are listed in [platform apps](platform-apps.md). Moving behind a platform app removes stored app secrets so they cannot silently reactivate later; Alipay mini-program's own phone AES key is retained separately as needed. Reverting to first-party mode requires valid first-party secret material.

## Safety, failure handling and cleanup

A valid authorizer configuration is not an end-to-end provider test. Confirm callback origin and TLS trust, provider permissions, project role assignment, published allowed-authorizer list and a denied caller. Expect validation `400`, name conflict `409`, absent object `404`, and editor failure `403`; login/exchange may additionally fail state, upstream network, token or scope checks. Do not make issuer/audience optional or disable TLS verification to bypass errors.

Use in-place secret rotation; verify new logins, then retire upstream old credentials. Deleting the Viat row does not revoke an upstream app registration. Remove disposable authorizers only after removing endpoint dependencies and reviewing the publish plan. Credentials never belong in repo-sync config or copied provider responses.

**Evidence:** `crates/viat-core/src/types/authorizer.rs`, `crates/viat-api/src/{dto.rs,handlers/authorizers.rs,handlers/oidc.rs,social/mod.rs,social/handlers.rs,login_backoff.rs,project_session.rs,middleware_project.rs}`, `crates/viat-auth/src/jwt.rs`. All recipes are unexecuted.
