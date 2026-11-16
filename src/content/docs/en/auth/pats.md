---
title: "Personal access tokens (PATs)"
description: "Create, scope, use, rotate and revoke management tokens without confusing project credentials."
doc_id: auth.pats
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Personal access tokens (PATs)

A `vis_pat_` PAT authenticates a **platform account** for management
automation: it uses that account's **current** memberships/roles — it
snapshots nothing, grants nothing, creates no project user, and is not an
API key for published endpoints. CI jobs should prefer a project-scoped,
expiring PAT. Scopes only **narrow** authority; they never elevate an
Operator into a Developer.

## Prerequisites and creation

Complete a platform session login (including any required
[MFA](mfa.md)) first. PAT management uses `require_session` — **a PAT
cannot** create, list or revoke PATs. When `project_slug` is set, the
account must be a member of that project.

Source-derived, unexecuted request:

```sh
curl -sS "$BASE/auth/tokens" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-ci","project_slug":"demo","ttl_seconds":86400}'
```

`POST /auth/tokens` fields:

| Field | Rule |
| --- | --- |
| `name` | Required non-empty, ≤64 bytes, unique per account; conflicts answer `409` |
| `project_slug` | Omitted/null = every project the account can access; a string = an existing project requiring current membership |
| `ttl_seconds` | Omitted/null = 2592000 (30 days); 0 = no expiry; other non-negative integers are lifetime seconds; negative answers `400` |

The response carries `id`, `name`, nullable `project_slug`, `prefix`,
**`secret`**, `created_at`, nullable `expires_at`. `secret` is the full
token shown **exactly once** — the server stores only a hash and cannot
recover the plaintext; do not expect `token`/`access_token` fields.
`expires_at:null` means **no expiry**, not expired; PATs have no refresh
endpoint.

## Use and scope

```sh
curl -sS "$BASE/projects/demo" -H "Authorization: Bearer $VIAT_PAT"
```

- A project-scoped PAT passes the extractor's scope check only on the
  **exact** `/projects/demo` with its `/...` subpaths and the exact
  `/p/demo` with its subpaths. `/auth/whoami`, `/auth/logout` and
  `/auth/logout-all` are explicit extractor exceptions — without changing
  each handler's own session/credential requirements (`/auth/logout`
  still needs the refresh-token body). The scope does **not** allow
  `/projects`, `/users`, `/admin/...`, other projects, or prefix look-
  alikes such as `/projects/demo-other`.
- Passing the scope via `/p/demo/...` does **not** make the PAT a project
  credential: project middleware still requires a valid **project
  identity**; ordinary published calls use project-user tokens/API keys.
  A Developer member's PAT updates scripts but **still cannot** publish
  or change Owner/Admin-only settings.
- CLI `VIAT_TOKEN` and configuration precedence:
  [CLI overview](../cli/overview.md) and the
  [auth commands](../cli/auth.md). **Never** write a PAT into a committed
  `viat.yaml` or shell history. MCP configuration has a legacy quirk:
  `viat mcp`'s loader reads `VIAT_TOKEN` or the stored legacy `token`
  field and **not** the modern access/refresh pair; an ordinary CLI login
  does not guarantee the legacy field is populated. Never claim the
  generated MCP configuration supports login refresh, and never put a
  refresh token into `VIAT_TOKEN` — see [MCP CLI](../cli/utilities.md).

## Inventory, revocation, rotation

- A platform session's `GET /auth/tokens` returns `{items:[...]}`, each
  with `id`, `name`, nullable `project_slug`, `prefix`, `created_at`,
  nullable `expires_at`, `last_used_at`, `revoked_at` — the secret never
  reappears; keep the IDs/names/prefixes you need instead of copying
  full bearers around.
- The owner's platform session calls `DELETE /auth/tokens/{id}` for
  `{"revoked":true}`; someone else's ID answers `404`; re-revoking your
  own revoked record is safe.
- There is **no** PATCH to rename, extend TTL or change scope. Rotation =
  create a replacement under a **different name** → update every consumer
  → verify allowed operations and denial boundaries → revoke the old ID.
  Names stay unique per account — use a fresh rotation name and never
  assume revocation frees the old one.
- Every PAT-management request checks expiry/revocation. An unexpired PAT
  loses project access the moment membership is removed. Password/MFA/
  session changes are **not** PAT revocations; offboarding inventories
  and revokes PATs separately. Local CLI logout revokes no PAT and
  separately keeps `project_token`.

## Denial validation and cleanup

After creating: verify `GET /auth/whoami` → one permitted project read →
one **deliberately forbidden** other-project path. A project Operator
must still fail on editor entrances like endpoint/tree reads; even an
unscoped PAT cannot manage `/auth/tokens`. **Never** widen the scope to
all projects just to make CI pass. Error shapes: missing/expired/revoked
token `401`; valid token past path/role authority `403`; nonexistent
project at creation `404`, non-member `403`.

When finished, revoke `fixture-ci` and delete CI/local copies — clearing
environment variables **revokes nothing**. This page executed no
creation/revocation/network calls.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/{handlers/auth_tokens.rs,middleware_auth.rs}`,
`crates/viat-auth/src/pat.rs`,
`crates/viat-cli/src/{config.rs,commands/auth.rs,commands/mcp.rs}`. The
management request shapes come from the implementation, not a complete
management OpenAPI export.
