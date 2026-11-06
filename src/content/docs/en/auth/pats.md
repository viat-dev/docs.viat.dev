---
title: "Personal access tokens (PATs)"
description: "Create, scope, use, rotate and revoke management tokens without confusing project credentials."
doc_id: auth.pats
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Personal access tokens (PATs)

A `vis_pat_` personal access token authenticates a **platform account** for management automation. It inherits that account's current project memberships/roles; it does not snapshot or grant permissions, create a project user, or serve as an API key for published endpoints. Prefer a project-scoped, expiring PAT for a specific CI job. A scope limits authority; it never elevates an Operator to Developer.

## Prerequisites and creation

Sign in to a platform session first (including [MFA](mfa.md) if requested). PAT management uses `require_session`: a PAT cannot create, list or revoke PATs itself. The account must be a member of `project_slug` when scoping to a project.

Source-derived **unexecuted** request:

```sh
curl -sS "$BASE/auth/tokens" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-ci","project_slug":"demo","ttl_seconds":86400}'
```

`POST /auth/tokens` fields:

| Field | Rule |
| --- | --- |
| `name` | Required string, nonempty, <=64 bytes; unique for this account; conflict = `409` |
| `project_slug` | Omitted/null = all projects the account may access; string = existing project and current membership required |
| `ttl_seconds` | Omitted/null = 2592000 (30 days); 0 = never expires; nonnegative integer otherwise; negative = `400` |

Response: `id`, `name`, nullable `project_slug`, `prefix`, **`secret`**, `created_at`, nullable `expires_at`. `secret` is the complete display token, returned once; the server stores its hash, not a recoverable plaintext copy. Do not expect a field called `token` or `access_token` here. `expires_at:null` means no expiry, not “already expired”. There is no PAT refresh endpoint.

## Use and scope

```sh
curl -sS "$BASE/projects/demo" -H "Authorization: Bearer $VIAT_PAT"
```

A project-scoped PAT passes management extractor scope only for exact `/projects/demo` or its `/...` descendants and exact `/p/demo` or its descendants. `/auth/whoami`, `/auth/logout`, `/auth/logout-all` are explicit extractor exceptions. These exceptions do not change each handler's session/credential requirements; `/auth/logout` still takes a refresh-token body. The scope does not permit `/projects`, `/users`, `/admin/...`, other project slugs, or prefix lookalikes such as `/projects/demo-other`.

Passing a path scope check on `/p/demo/...` does not make the PAT a project credential: project middleware still requires a supported project identity. Use a project user token/API key for normal published calls. A scoped PAT with Developer membership can update scripts, but still cannot publish or change Owner/Admin-only project settings.

CLI uses `VIAT_TOKEN`/its configured credential precedence described in [CLI overview](../cli/overview.md) and [auth commands](../cli/auth.md). Never put a PAT directly in committed `viat.yaml` or shell history. MCP configuration has a separate legacy nuance: the `viat mcp` configuration loader reads `VIAT_TOKEN` or the stored legacy `token` field rather than the modern access/refresh pair; ordinary CLI login does not guarantee this field is populated. Do not publish a generated MCP config as a refresh-capable login or paste a refresh token into `VIAT_TOKEN`. See [MCP CLI](../cli/utilities.md).

## Inventory, revoke, rotate

`GET /auth/tokens` with a platform session returns `{items:[...]}`. Each item: `id`, `name`, nullable `project_slug`, `prefix`, `created_at`, nullable `expires_at`, `last_used_at`, `revoked_at`. Secrets never reappear; retain the ID/name/prefix for operations, not full bearer copies.

`DELETE /auth/tokens/{id}` with the owning platform session returns `{"revoked":true}`; an ID not owned by the caller is `404`. Revocation of an already owned/revoked row is safe. There is no PATCH to rename, extend TTL or change scope. Rotate by creating a separately named replacement, updating each consumer, verifying the intended operation and denial boundaries, then revoking the old ID. Names remain unique per account; use distinct rotation names rather than assuming revoke frees a name.

A PAT's expiry/revocation is checked on each PAT-authenticated management request. Removing membership prevents project access even if the PAT has not expired. Password/MFA/session changes must not be assumed to revoke PATs: audit and revoke them explicitly during offboarding. CLI local logout is not PAT revocation and leaves `project_token` separately stored.

## Negative verification and cleanup

After creation, verify `GET /auth/whoami`, one permitted project read and one deliberately forbidden other-project path. A project Operator must still fail endpoint/tree editor reads. A PAT must fail `/auth/tokens` management even if unscoped. Never test permissions by broadening a CI token to all projects. Missing/expired/revoked token gives `401`; a valid token outside its path or role gives `403`; an unknown scope project gives `404` at creation, nonmembership `403`.

Revoke `fixture-ci` when done and remove copies from CI/local config; clearing an environment variable alone is not revocation. No token creation/revocation/network call was executed for this page.

**Evidence:** `crates/viat-api/src/{handlers/auth_tokens.rs,middleware_auth.rs}`, `crates/viat-auth/src/pat.rs`, `crates/viat-cli/src/{config.rs,commands/auth.rs,commands/mcp.rs}`. Management endpoint shapes were read from implementation; this is not a complete management OpenAPI export.
