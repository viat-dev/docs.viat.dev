---
title: "Management authentication and identity planes"
description: "Platform sessions, project collaborators, end-user administration, secret handling and offboarding."
doc_id: auth.management
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Management authentication and identity planes

## Pick the correct identity plane first

Viat has three independent identity systems; the same email appearing in
two of them **does not** link the accounts.

| Plane | Accounts and credentials | Permissions come from |
| --- | --- | --- |
| Platform account | Console/CLI user; platform access JWT, refresh token or `vis_pat_` PAT | Platform role + explicit project membership |
| Project collaborator | A platform account's membership in one project | Member role `owner`/`admin`/`developer`/`operator` |
| Project end user | A record in the project's user store; password/social/OIDC/JWT/API-key identities | Project business roles, `is_admin`, authorization rules |

Platform and member roles reuse the **same four values but are granted
separately**. A platform Owner is **not** automatically a member of every
project; the project creator becomes that project's Owner; a project
user's `is_admin: true` means **no** console administrator and cannot
edit scripts via `/projects/...`.

See also [project collaboration](../projects/create-and-collaborate.md),
[endpoint authentication](endpoints.md), [PATs](pats.md) and the
[authorization model](authorization.md). The management routes here are
source-verified — **not** a promise of a complete management OpenAPI; the
project OpenAPI describes published project endpoints.

## Platform password sessions

Prerequisites: an activated instance, HTTPS and an existing platform
account. Public registration follows deployment policy — check
`GET /auth/config` first and never assume `/auth/register` is open.

Requests below are source-written and **unexecuted**; `BASE` is the
instance address and variables hold isolated test-account credentials,
never production passwords.

```sh
curl -sS "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.invalid","password":"REPLACE_WITH_DISPOSABLE_PASSWORD"}'
```

- `POST /auth/login` requires `email` and `password`. Success returns
  `access_token`, `refresh_token`, `refresh_expires_at`, `user_id`,
  `email`, plus the `overview_token` shown **exactly once**. Management
  requests send `Authorization: Bearer $PLATFORM_ACCESS_TOKEN`. A correct
  password can still first answer `401 mfa_required` or
  `mfa_enrollment_required` with an `mfa_ticket` — complete
  [MFA](mfa.md) to get a session.
- `POST /auth/register` takes `email`, `password` and optional/null
  `display_name`; it creates a **platform account**, not a project
  customer. Bootstrap, invitations and role limits:
  [platform users](../instance/platform-users.md).

| Route | Input | Output and effect |
| --- | --- | --- |
| `GET /auth/whoami` | Platform bearer | Public identity/roles; never passwords or token sets |
| `POST /auth/refresh` | `{"refresh_token":"$PLATFORM_REFRESH_TOKEN"}` | A new access/refresh pair; the absolute refresh validity is unchanged; **no** `overview_token` |
| `POST /auth/logout` | Same refresh-token body | `{"ok":true}` even for unknown tokens; revokes that refresh record; an unrotated record also revokes that login's overview reader |
| `POST /auth/logout-all` | Platform bearer | `{"ok":true,"revoked":N}`; revokes other refresh sessions (keeping the current `sid` when present); deletes all overview tokens |
| `GET /auth/sessions` | Platform bearer | Session inventory; use the returned IDs, never token strings |
| `DELETE /auth/sessions/{id}` | Platform bearer | Revokes sessions **you own**; never arbitrary other users' |
| `PUT /auth/password` | `old_password`, `new_password`, optional `code` | Replaces the password and returns a fresh login; with MFA enabled the current code/recovery code is required |

> [!WARNING]
> Refreshing is **rotation**, not a long-lived reusable token: store the
> newest pair atomically and refresh serially; replaying a rotated refresh
> token can revoke the account's refresh sessions and overview readers.
> Deleting a refresh record does not instantly kill issued JWTs, and
> logout destroys no bearer copies — bound access-token lifetime instead.

The `vso_` overview token only reads `GET /projects/{slug}/overview` for
current member projects: no editing, no arbitrary management collections,
no project endpoints, and it is not a PAT; refresh never re-shows it.
These are the **server-side** logout behaviors — the CLI's
`viat auth logout` only clears local legacy/access/refresh fields and
keeps `project_token`. Offboarding revokes server sessions explicitly and
handles project credentials separately.

## Effective project member permissions

| Operation | Required member role |
| --- | --- |
| Read project settings, members, resource metadata | Any member (including `operator`) |
| Read endpoint list/detail, endpoint trees | `owner`/`admin`/`developer` — **not** every member |
| Authorizers, roles, project users, authz model read/write | Editors (`owner`/`admin`/`developer`) |
| Edit scripts/workflows/resources/endpoints | Editors |
| Publish; project settings and membership changes | `owner` or `admin` (still bounded by member-elevation limits) |

Instance-user/SSO administration checks the **platform role**, not the
project role. A visible menu item ≠ an authorized request: an Operator
reads project metadata but `GET /projects/demo/trees` answers `403`; a
Developer edits endpoints but cannot publish. Removing membership kills
that project's management access even if a PAT still exists.

## Project end-user administration

- Two entrances: console/API editors use `/projects/{slug}/users`;
  project-admin apps use `/p/{slug}/_users`. Neither is the platform
  `/users`. Commands: [CLI project users](../cli/user.md) and
  [delegated user management](../cli/p-user.md).
- Creation JSON: `identity` required; optional/null `password` **or**
  `password_hash` (never both), `display_name`, `email`, `phone`, `role`,
  `meta`. Imported hashes accept Argon2 PHC or bcrypt — **no** arbitrary
  hashes; absence of credentials does not mean a usable password; `role`
  must reference an existing project role. Lists accept `q`/`limit`/
  `offset` and return `{items,total,limit,offset}`.
- Editor `PATCH /projects/{slug}/users/{identity}`: omitted profile
  fields keep; explicit null clears `display_name`/`email`/`phone`;
  providing `meta` **replaces wholesale**, never deep-merges. Delegated
  `PUT /p/{slug}/_users/{identity}/meta` takes `{meta,merge}`: `merge`
  defaults to true for a **shallow** top-level merge, false replaces.
  Password replacement must choose exactly one of `password`/
  `password_hash`; activation/admin toggles take `{"is_active":false}` /
  `{"is_admin":true}`; user self-service password change is
  `POST /p/{slug}/auth/password`.
- Delegated `_users` requires project-admin rights in the current project
  user: it manages **local password** identities only (refusing
  `jwt:`/`oidc:`/`social:`); it cannot grant the admin role; it cannot
  delete/deactivate itself or change its own role. The endpoint's
  `project_users_grant` can bound script-side user operations — it
  **never** turns the caller into a platform editor. Delegated writes are
  audited; adding `is_admin` to an ordinary login request grants nothing.

## Rotation and offboarding checklist

1. Inventory separately: management sessions/PATs, project members, end
   users/API keys, IdP clients, authorizer upstream secrets, resource
   credentials.
2. On leakage revoke PATs/keys — **not just rename**: create replacements
   → update consumers → verify → revoke the old. Created secrets usually
   display once and lists cannot recover them.
3. Remove the collaborator membership and **separately** deactivate their
   project user — the shared email propagates nothing.
4. On project-password leakage change the password: the project session
   epoch invalidates old login tokens plus related refresh/code/MFA
   state. Revoking only the API key erases **no** already-exchanged JWTs.
5. Explicitly revoke platform refresh sessions/overview readers; local
   CLI logout is no server revocation; delete `project_token` and
   credential copies in CI/deployments separately.
6. Rotate upstream/resource secrets per their reference pages; back up
   the instance encryption key/secret backend safely — swapping the key
   without re-encryption makes existing secrets unreadable.
7. Verify both allow and deny cases; **never** copy tokens into logs or
   tickets during audits.

Never hand resource secrets to scripts, and never put them in URL query
parameters, repo YAML or screenshots; the platform applies secrets
server-side. Console settings and deployment-level parameters:
[instance settings](../instance/settings.md).

## Failures and verification

Management errors are usually `{"error":"<code>","message":"<detail>"}`:
`401` = missing/invalid/expired credentials; `403` can also be a wrong
identity plane, missing membership, insufficient role or PAT project-scope
mismatch; `404` = missing project/object. Check `whoami`, the current
project and membership first — **never** "fix" editor permissions by
making a published endpoint anonymous.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/{dto.rs,middleware_auth.rs,handlers/auth.rs,handlers/project_users.rs,handlers/project_user_admin.rs}`,
`crates/viat-core/src/types/project.rs`,
`crates/viat-cli/src/commands/auth.rs`. Examples are source-checked and
unexecuted; no accounts, SSO providers or remote cleanup tasks were
performed for this page.
