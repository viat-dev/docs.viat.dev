---
title: "Authenticate published endpoints"
description: "Project login, API keys, OAuth2 grants, sessions and inherited endpoint authentication."
doc_id: auth.endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Authenticate published endpoints

Published calls use `/p/{slug}/...`; management calls use `/projects/{slug}/...`. A platform JWT/PAT is not a project end-user login token. Configure [authorizers](authorizers.md), then bind them to the endpoint tree and publish. Draft edits do not change active snapshots. Authentication establishes identity; [authorization gates and row scopes](authorization.md) decide what that identity may do.

All snippets below are **source-derived and unexecuted**. Use a disposable project such as the handbook's `demo`, fixture script `hello`, and variables for credentials. Examples are protocol recipes, not provider-registration or SSO test results.

## Password registration and login

Projects provision platform-owned `POST /auth/login` and `/auth/register` nodes beneath `/p/{slug}`. Do not replace them with scripts querying the platform database. Registration is disabled by default (`allow_registration: false`). A project Owner/Admin enables it in [project settings](../projects/settings.md).

```sh
curl -sS "$BASE/p/demo/auth/login" -H 'Content-Type: application/json' \
  -d '{"identity":"fixture-user","credential":"REPLACE_WITH_DISPOSABLE_PASSWORD","authorizer":"password"}'
```

Login requires a usable identity/password pair; `authorizer` defaults to `password` on the native door. Registration requires non-empty `identity`, `credential`; uses the password authorizer and project registration policy. Responses include `token`, `expires_in`, `expires_at`, `user_id`, `project_slug`; enabled interactive sessions add `refresh_token`, `refresh_expires_at`. Consume actual returned fields rather than assuming the platform login's `access_token` shape. MFA may first return `401` with a ticket; see [MFA](mfa.md).

There is also `POST /projects/{slug}/auth/login` with required `{authorizer,identity,credential}` returning `{token,expires_in,expires_at,user_id,identity,role}` plus optional refresh fields. It authenticates a **project user**, not a console collaborator. Do not send platform `email/password` JSON to it.

```sh
curl -sS "$BASE/p/demo/hello?name=Reader" \
  -H "Authorization: Bearer $PROJECT_TOKEN"
```

Password login can run configured pre/post hooks. Pre-hook rejection or execution failure blocks login; post-hook failure is advisory after the operation has committed. Hooks never receive platform database credentials. Project user deactivation and role changes are checked against live user state, not trusted from a caller's JSON.

## Interactive sessions

On `password`, `oauth_oidc`, `social` authorizers, `config.login_token_ttl_hours` defaults 12, accepts whole hours 1–720. It is **not** `token_ttl_hours` (the `_token` access-token knob). Missing/null `session` disables refresh sessions. To enable:

```json
{"login_token_ttl_hours":1,"session":{"idle_timeout_hours":36,"max_lifetime_hours":720}}
```

`session.idle_timeout_hours` is required, integer 1–8760 and at least login-token TTL. `max_lifetime_hours` defaults 720, runtime at least idle; if explicitly supplied it must be 1–8760 and at least idle. Unknown session keys are refused. Refresh slides the idle deadline, never beyond the absolute session lifetime.

`POST /p/{slug}/_session/refresh` and `POST .../_session/logout` take `{"refresh_token":"$PROJECT_REFRESH_TOKEN"}`. Refresh returns `token`, `expires_in`, `expires_at`, `refresh_token`, `refresh_expires_at`, `user_id`, `project_slug`. Atomically replace the refresh token; replay revokes that session family. Logout always returns `{"ok":true}` and ends the family; issued access tokens last until expiry. Disabling sessions stops existing sessions at their next refresh. A password change is the epoch-based immediate retirement mechanism for login tokens.

Self-service `POST /p/{slug}/auth/password` requires a password-login token and `{"current":"...","new":"...","code":"..."}`; `code` is needed when enrolled MFA is active. A machine API key cannot change its human owner's password.

## API keys and client credentials

An editor creates an `api_key` authorizer and a project user, then calls:

```sh
curl -sS "$BASE/projects/demo/authorizers/machine/keys" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"project_user_id":"11111111-2222-4333-8444-555555555555","name":"fixture-worker","expires_at":null}'
```

`project_user_id` and `name` are required; omitted/null `expires_at` means no key expiry. The user and authorizer must belong to this project; authorizer kind must be `api_key`. Creation returns public key metadata and the full `token` once, shaped `vsk_<key_id>.<secret>`. List `GET .../keys` cannot recover it; `DELETE .../keys/{key_id}` revokes it. Store the actual returned token, never the fixture UUID above.

Use `Authorization: Bearer $API_KEY` directly, or exchange its two parts using OAuth2. `client_id` is `<key_id>` **without** `vsk_`; `client_secret` is the part after the dot.

```sh
curl -sS "$BASE/p/demo/_token" \
  -u "$API_KEY_ID:$API_KEY_SECRET" \
  --data-urlencode 'grant_type=client_credentials'
```

The endpoint accepts form encoding (standard) and JSON `{grant_type,client_id,client_secret}`; HTTP Basic wins if both are supplied. Success is `{access_token,token_type:"Bearer",expires_in}` with `Cache-Control: no-store`. API-key authorizer `token_ttl_hours` defaults 1 and clamps to 1–24 hours at issuance. No refresh token is returned for client credentials. Wrong project, revoked/expired key and inactive user deliberately collapse to `invalid_client`; do not use the exchange to enumerate users.

Revoking the key prevents future direct use/exchange but an already issued exchange token is not the key itself; plan for its remaining lifetime. Do not put API keys in query strings or use a platform PAT as `client_secret`.

## Project as OAuth2/OIDC provider

This is distinct from accepting a third-party OIDC authorizer. Owner/Admin enables project IdP mode with stable `VIAT_PUBLIC_URL`, then creates an OAuth client at `POST /projects/{slug}/oauth-clients`:

```json
{"name":"fixture-web","redirect_uris":["http://127.0.0.1:8080/callback"],"public":true,"allowed_scopes":["openid","profile","email"],"audience":null}
```

Fields: required nonblank `name`, nonempty exact `redirect_uris`; URLs must parse, cannot contain fragments/wildcards, and HTTP is allowed only on loopback. The handler does not restrict all non-HTTP schemes to HTTPS, so native custom-scheme URLs are not rejected by that particular check; use HTTPS for web clients. `public` defaults false. Public clients have no secret and require PKCE; confidential creation shows `client_secret` once. `allowed_scopes` defaults `["openid","profile","email"]`; entries must be nonempty, no spaces. `audience` omitted/null uses `project:<slug>`; custom audience tokens are for the external resource server and are **not** accepted back by Viat. `PATCH .../{client_id}` partially updates `name`, `redirect_uris`, `allowed_scopes`; lists replace; `audience` omitted preserves, null resets, string sets. Client type cannot be changed by patch. Delete uses `DELETE .../{client_id}`.

Use discovery `GET /p/{slug}/.well-known/openid-configuration` and JWKS `GET /p/{slug}/.well-known/jwks.json`. Redirect the browser to `GET /p/{slug}/_authorize` with `response_type=code`, returned `client_id`, an exactly registered `redirect_uri`, requested `scope`, random `state`, and PKCE `code_challenge`/`code_challenge_method=S256`. Do not invent an access token from the authorization page.

Exchange at `_token` with `grant_type=authorization_code`, `client_id`, `code`, the same `redirect_uri`, and `code_verifier`; confidential clients also authenticate with their secret. Refresh uses `grant_type=refresh_token`, `refresh_token` and client authentication as applicable. Persist rotated refresh credentials. Read `_userinfo` with the resulting bearer; discovery gives the supported endpoints. `openid`/`profile`/`email` scopes control OIDC disclosure, not project authorization-rule grants. Provider logout is `GET /p/{slug}/_logout`; it is not platform logout.

Signing-key lifecycle: list `GET /projects/{slug}/idp/keys`, add a new signing key with `POST .../rotate`, then retire an old `kid` with `POST .../{kid}/retire` after consumer/token overlap. Keys are not resource secrets to export. Disabling IdP hides discovery/JWKS and stops ES256 minting but keeps key rows; tokens already issued are still accepted locally until expiry. External verifiers need an explicit JWKS availability/rotation plan.

## Authorizer inheritance is replacement

An editor updates `PUT /projects/{slug}/endpoints/{id}/auth`:

```json
{"allowed_authorizers":["password","machine"],"authz_gates":[{"type":"report","action":"read"}],"override_authorizers":false,"override_permissions":false}
```

`allowed_authorizers` names authorizers, not roles. Non-null list at the nearest node **replaces** ancestors. `[]` denies all; null/omitted authorizer list means inherit (not patch-preserve). `override_authorizers:true` with no list stops inheritance as deny-all. By contrast `authz_gates` accumulate through ancestors; absent key preserves current gates, null removes local declaration/inherits, `[]` declares none locally but does not remove ancestor gates. `override_permissions:true` stops gate accumulation above that node. Both booleans default false on each request: send intended values explicitly. Retired nonempty `required_permissions` is rejected, not silently honored.

Publish after auth changes, inspect the publish plan, then verify both a valid caller and a caller that must be refused. Never conclude a gate is active from a successful anonymous test of a draft.

## Negative cases and recovery

- A platform PAT does not become a project user simply because it is scoped to that project.
- A valid project token still fails when its admitting authorizer is absent from the published route's effective list.
- Adding an anonymous authorizer is an explicit public access decision, not a repair for expired tokens. Opaque/unrecognized bearer material can resolve anonymous; a route allowing anonymous is not a universal invalid-token rejection service.
- Valid identity plus a failing gate returns denial before runtime; a role called `admin` alone does not imply every row is readable.
- OAuth errors use `{error,error_description}` (for example `invalid_client`, `invalid_grant`, `unsupported_grant_type`), unlike ordinary `{error,message}`; throttling uses `429` and `Retry-After`.

Cleanup is explicit: revoke disposable keys/clients, remove fixture users/endpoints and publish the intended removal; clearing local shell variables does not revoke credentials. [CLI auth](../cli/auth.md), [API keys](../cli/apikey.md), [endpoint commands](../cli/endpoint.md).

**Evidence:** `crates/viat-api/src/{lib.rs,auth_native.rs,middleware_project.rs,project_session.rs,handlers/project_token.rs,handlers/idp_oauth.rs,handlers/oauth_clients.rs,dto.rs}`, `crates/viat-db/src/endpoints.rs`. No network/provider flow was executed.
