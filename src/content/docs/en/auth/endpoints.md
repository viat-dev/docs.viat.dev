---
title: "Authenticate published endpoints"
description: "Project login, API keys, OAuth2 grants, sessions and inherited endpoint authentication."
doc_id: auth.endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Authenticate published endpoints

Two paths, keep them apart: published calls use `/p/{slug}/...`, management
calls use `/projects/{slug}/...`, and a platform JWT/PAT is **not** a
project end-user login token. Flow: configure [authorizers](authorizers.md)
→ bind them to the endpoint tree → publish — draft edits change no active
snapshot. Authentication establishes who; [authorization gates and row
scopes](authorization.md) decide what.

All examples are **source-derived and unexecuted**: isolated project `demo`
with the fixture script `hello`, credentials via variables; nothing here
implies completed provider registration or SSO integration testing.

## Password registration and login

Each project has platform-owned `POST /auth/login` and `/auth/register`
nodes under `/p/{slug}` — **never** replace them with scripts querying the
platform database. Registration defaults to off
(`allow_registration: false`) and is enabled by the project Owner/Admin in
[project settings](../projects/settings.md).

```sh
curl -sS "$BASE/p/demo/auth/login" -H 'Content-Type: application/json' \
  -d '{"identity":"fixture-user","credential":"REPLACE_WITH_DISPOSABLE_PASSWORD","authorizer":"password"}'
```

- Login takes a valid identity/password; the native entrance's
  `authorizer` defaults to `password`. Registration requires non-empty
  `identity` and `credential`, goes through a password authorizer and is
  gated by the registration switch.
- The response carries `token`, `expires_in`, `expires_at`, `user_id`,
  `project_slug`; with interactive sessions enabled it adds
  `refresh_token` and `refresh_expires_at`. **Do not** parse it as the
  platform login's `access_token` field. MFA can first answer `401` with a
  ticket — see [MFA](mfa.md).
- There is also `POST /projects/{slug}/auth/login` requiring
  `{authorizer,identity,credential}` and answering
  `{token,expires_in,expires_at,user_id,identity,role}` plus optional
  refresh fields — it authenticates a **project user**, not a
  collaborator; never send platform `email/password` JSON.

```sh
curl -sS "$BASE/p/demo/hello?name=Reader" \
  -H "Authorization: Bearer $PROJECT_TOKEN"
```

Password logins can run configured pre/post hooks: a rejecting or failing
pre-hook **blocks** the login; post-hooks run after commit and only log on
failure; hooks never receive platform database credentials. Deactivated
users and role changes read **live** state — caller-supplied roles in JSON
are never trusted.

## Interactive sessions

- `config.login_token_ttl_hours` for `password`/`oauth_oidc`/`social`
  defaults to 12 (integer 1–720); it is **not** `token_ttl_hours` (the
  `_token` access-token parameter).
- Omitted/null `session` disables refresh; enabling looks like:

```json
{"login_token_ttl_hours":1,"session":{"idle_timeout_hours":36,"max_lifetime_hours":720}}
```

- `session.idle_timeout_hours` is required, integer 1–8760 and ≥ the
  login-token TTL; `max_lifetime_hours` defaults to 720 (explicit values
  1–8760 and ≥ idle). Unknown session keys are rejected.
- `POST /p/{slug}/_session/refresh` and `POST .../_session/logout` take
  `{"refresh_token":"$PROJECT_REFRESH_TOKEN"}`. Refresh returns `token`,
  `expires_in`, `expires_at`, `refresh_token`, `refresh_expires_at`,
  `user_id`, `project_slug`; refresh tokens are **atomically replaced** —
  replay revokes the whole session family. Logout always answers
  `{"ok":true}` and ends the family; existing access tokens remain usable
  until expiry; after disabling sessions, existing sessions die on their
  next refresh. Password changes invalidate old login tokens **immediately**
  via an epoch.
- Self-service `POST /p/{slug}/auth/password` requires a password-login
  token with `{"current":"...","new":"...","code":"..."}`; `code` is
  required when MFA is enabled and enrolled. Machine API keys cannot
  change their user's password.

## API keys and the client-credentials exchange

After an editor creates an `api_key` authorizer and a project user:

```sh
curl -sS "$BASE/projects/demo/authorizers/machine/keys" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"project_user_id":"11111111-2222-4333-8444-555555555555","name":"fixture-worker","expires_at":null}'
```

- `project_user_id` and `name` are required; omitted/null `expires_at`
  means no expiry. The user and authorizer must belong to the project and
  the authorizer must be `api_key`.
- Creation returns public metadata plus the full `token` shown **exactly
  once**: `vsk_<key_id>.<secret>`. `GET .../keys` cannot recover the
  secret; `DELETE .../keys/{key_id}` revokes it. Use the token your own
  creation returned — never the example UUID.

You can send `Authorization: Bearer $API_KEY` directly, or split it for an
OAuth2 exchange: `client_id` is the `<key_id>` **without** `vsk_`, and
`client_secret` is the part after the dot.

```sh
curl -sS "$BASE/p/demo/_token" \
  -u "$API_KEY_ID:$API_KEY_SECRET" \
  --data-urlencode 'grant_type=client_credentials'
```

- The entrance accepts standard form or JSON
  `{grant_type,client_id,client_secret}`; when both are supplied, HTTP
  Basic wins. Success is `{access_token,token_type:"Bearer",expires_in}`
  with `Cache-Control: no-store`.
- The api-key authorizer's `token_ttl_hours` defaults to 1, issuance
  clamped to 1–24 hours; this grant returns **no** refresh token.
- Wrong project, expired/revoked key and deactivated user all collapse
  into `invalid_client` — **not an account-enumeration oracle**.
- Revoking the key blocks later use/exchange; already-issued JWTs are not
  the original key — consider their remaining lifetime. **Never** put
  keys in query parameters, and never use a platform PAT as
  `client_secret`.

## The project as an OAuth2/OIDC provider

This is the reverse of accepting an external OIDC authorizer. After an
Owner/Admin configures a stable `VIAT_PUBLIC_URL` and enables the project
IdP, create clients via `POST /projects/{slug}/oauth-clients`:

```json
{"name":"fixture-web","redirect_uris":["http://127.0.0.1:8080/callback"],"public":true,"allowed_scopes":["openid","profile","email"],"audience":null}
```

- Required: non-empty `name` and a non-empty list of **exact**
  `redirect_uris` (parseable URLs, no fragments/wildcards, HTTP only on
  loopback). The handler does not force every non-HTTP scheme to HTTPS —
  native custom schemes pass this check; web clients should still use
  HTTPS. `public` defaults to false: public clients have no secret and
  **must** use PKCE; confidential clients show `client_secret` only at
  creation.
- `allowed_scopes` defaults to `["openid","profile","email"]`, each
  non-empty and space-free. `audience` omitted/null is `project:<slug>`;
  custom-audience tokens serve **external resource servers** and are
  **not accepted by Viat itself**.
- `PATCH .../{client_id}` partially updates
  `name`/`redirect_uris`/`allowed_scopes` (lists replace wholesale);
  `audience` omitted keeps, null resets, a string sets; the client type
  cannot be patched. Deletion is `DELETE .../{client_id}`.
- Discovery at `GET /p/{slug}/.well-known/openid-configuration`; JWKS at
  `GET /p/{slug}/.well-known/jwks.json`.
- Authorization-code flow: browsers hit `GET /p/{slug}/_authorize` with
  `response_type=code`, the created `client_id`, the exactly registered
  `redirect_uri`, requested `scope`, a random `state` and PKCE
  `code_challenge`/`code_challenge_method=S256` — **the consent page is
  not the access token**.
- Exchange: to `_token` with `grant_type=authorization_code`,
  `client_id`, `code`, the same `redirect_uri` and `code_verifier`;
  confidential clients authenticate with the secret. Refresh with
  `grant_type=refresh_token`, `refresh_token` and applicable client
  authentication; **persist the rotated refresh credential**. Read
  `_userinfo` with the bearer (supported endpoints per the discovery
  document). `openid`/`profile`/`email` are OIDC informational scopes,
  **not** grants of project authorization rules. Provider logout is
  `GET /p/{slug}/_logout`, not the platform logout.
- Signing keys: `GET /projects/{slug}/idp/keys` lists; `POST .../rotate`
  adds a key; after a consumer/token overlap window,
  `POST .../{kid}/retire` retires the old one. They are not
  exportable resource secrets. Disabling the IdP hides discovery/JWKS and
  stops ES256 issuance while keeping the key rows — issued tokens still
  verify locally until expiry; external verifiers must plan JWKS
  availability and rotation separately.

## Authorizer inheritance is replacement

Editors call `PUT /projects/{slug}/endpoints/{id}/auth`:

```json
{"allowed_authorizers":["password","machine"],"authz_gates":[{"type":"report","action":"read"}],"override_authorizers":false,"override_permissions":false}
```

- `allowed_authorizers` holds **authorizer names, not roles**. The nearest
  non-null list **replaces** the ancestor list; `[]` rejects everyone;
  null/omitted means **inherit** (not "keep the stored field"); with no
  list, `override_authorizers:true` cuts inheritance and rejects everyone.
- Conversely, `authz_gates` **accumulate** along ancestors: omitting the
  key keeps existing gates; null removes the local declaration/inheritance;
  `[]` declares no local gates while **keeping** ancestor gates;
  `override_permissions:true` stops upward accumulation.
- Both booleans default to false on every request — **always send your
  intended values**. Retired non-empty `required_permissions` is rejected
  and no longer runs.

After changes: review the publish plan → publish → verify one caller that
must pass and one that must be refused. A passing draft anonymous test
**cannot** certify the live gate.

## Denial cases and recovery

| Case | Meaning |
| --- | --- |
| Platform PAT | Even when scoped to the project, it never becomes a project user |
| Authorizer absent from the published list | A valid project token whose authorizer is off the route's effective list is still denied |
| The anonymous authorizer | Adding it is a **deliberate public-access decision**, not a fix for expired tokens; unrecognizable bearers may resolve as anonymous — an anonymous-allowing route is not a "reject all invalid tokens" service |
| Gate failure | Valid identity failing a gate is refused before execution; a role literally named `admin` does not automatically read every row |
| OAuth error shape | `{error,error_description}` (`invalid_client`, `invalid_grant`, `unsupported_grant_type`, …), unlike the ordinary `{error,message}`; rate limiting answers `429` + `Retry-After` |

Cleanup is explicit: revoke isolated keys/clients, delete fixture
users/endpoints and publish the intended removal — clearing shell
variables **revokes nothing**. See [CLI auth](../cli/auth.md),
[API keys](../cli/apikey.md) and [endpoint commands](../cli/endpoint.md).

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/{lib.rs,auth_native.rs,middleware_project.rs,project_session.rs,handlers/project_token.rs,handlers/idp_oauth.rs,handlers/oauth_clients.rs,dto.rs}`,
`crates/viat-db/src/endpoints.rs`. No network/provider flows were executed.
