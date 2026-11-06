---
title: "Management authentication and identity planes"
description: "Platform sessions, project collaborators, end-user administration, secret handling and offboarding."
doc_id: auth.management
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Management authentication and identity planes

## Choose the correct identity

Viat has three separate identity planes. An email appearing in two planes does not join them.

| Plane | Account and credential | Authority |
| --- | --- | --- |
| Platform account | Console/CLI account; platform access JWT, refresh token or `vis_pat_` PAT | Instance role and explicit project memberships |
| Project collaborator | A platform account's membership in one project | Membership role `owner`, `admin`, `developer`, `operator` |
| Project end user | Row in that project's user store; password/social/OIDC/JWT/API-key identity | Project business role, `is_admin`, authorization rules |

Platform roles and collaborator roles use the same four literals, but are separate assignments. Being a platform Owner does **not** manufacture membership in every project. Creating a project enrolls its creator as that project's Owner. A project end user with `is_admin: true` is not a console administrator and cannot edit scripts through `/projects/...`.

Use [project collaboration](../projects/create-and-collaborate.md), [endpoint authentication](endpoints.md), [PATs](pats.md), and [authorization](authorization.md) for the corresponding planes. The management routes below are source-verified references, not a claim that Viat exports a complete management OpenAPI document. Project OpenAPI describes published project endpoints.

## Platform password session

Prerequisites: an activated deployment, HTTPS, and an existing platform account. Public registration depends on the deployment registration policy. `GET /auth/config` reports the policy; do not assume `/auth/register` is open.

Source-derived, **unexecuted** request examples; `BASE` is your instance URL and variables contain disposable credentials, not literal sample passwords.

```sh
curl -sS "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.invalid","password":"REPLACE_WITH_DISPOSABLE_PASSWORD"}'
```

`POST /auth/login` requires `email`, `password`. Successful JSON contains `access_token`, `refresh_token`, `refresh_expires_at`, `user_id`, `email`, and a one-time `overview_token`. Send `Authorization: Bearer $PLATFORM_ACCESS_TOKEN` on management requests. Password success may instead return `401 mfa_required` or `mfa_enrollment_required` plus `mfa_ticket`; finish [MFA](mfa.md) before expecting a session.

`POST /auth/register` takes `email`, `password`, optional/null `display_name`. This creates a **platform** account, not a project customer. See [platform users](../instance/platform-users.md) for bootstrap/invitation and role restrictions.

| Route | Input | Output and effect |
| --- | --- | --- |
| `GET /auth/whoami` | Platform bearer | Public account identity/role; not a password or token dump |
| `POST /auth/refresh` | `{"refresh_token":"$PLATFORM_REFRESH_TOKEN"}` | New access/refresh pair; same absolute refresh expiry; `overview_token` omitted |
| `POST /auth/logout` | Same refresh-token shape | `{"ok":true}` even if unknown; revokes that refresh row and, for an unrotated row, that login's overview reader |
| `POST /auth/logout-all` | Platform bearer | `{"ok":true,"revoked":N}`; revokes other refresh sessions, preserving current `sid` where present; removes all overview tokens |
| `GET /auth/sessions` | Platform bearer | Session inventory; use returned IDs, not token strings |
| `DELETE /auth/sessions/{id}` | Platform bearer | Revokes a session owned by the caller; not arbitrary users' sessions |
| `PUT /auth/password` | `old_password`, `new_password`, optional `code` | Password replacement and renewed login response; enrolled MFA requires a current authenticator/recovery code |

Refresh is a rotation, not a parallel-use token. Persist the newest pair atomically and serialize refresh attempts: replaying a rotated refresh token can revoke the account's refresh sessions and overview readers. A JWT already issued is not a promise of immediate revocation when its refresh row disappears; do not treat logout as erasing every bearer copy. Keep access TTLs bounded.

The `vso_` overview token can read only `GET /projects/{slug}/overview` for current memberships. It cannot edit, list arbitrary management collections or invoke project endpoints; it is not a PAT. Refresh does not re-show its secret. Logout behavior above is server behavior; CLI `viat auth logout` only clears local legacy/access/refresh fields and leaves `project_token` intact. Explicitly revoke server sessions and separately remove project credentials when offboarding.

## Actual collaborator permissions

| Operation | Required project membership |
| --- | --- |
| Read project settings, members, resource metadata | Any member, including `operator` |
| Read endpoint lists/details and trees | `owner`, `admin`, `developer` — **not** every member |
| Authorizers, roles, project-user management, authorization-model reads/writes | Editor: `owner`, `admin`, `developer` |
| Edit scripts/workflows/resources/endpoints | Editor |
| Publish; project settings and membership changes | `owner` or `admin` (membership role escalation rules still apply) |

Instance-level user/SSO administration uses the caller's **platform** role, not these project roles. Do not infer permission from a console navigation item. For example, an Operator can read a project's metadata yet receive `403` on `GET /projects/demo/trees`; a Developer can edit an endpoint but cannot publish it. Removing project membership takes away management access even if a PAT still exists.

## Project end-user administration

Console/API editors use `/projects/{slug}/users`; project-admin applications use `/p/{slug}/_users`. These are not platform `/users`. [CLI project users](../cli/user.md) and [delegated users](../cli/p-user.md) document the separate commands.

Create JSON fields: required `identity`; optional/null `password` **or** `password_hash` (never both), `display_name`, `email`, `phone`, `role`, `meta`. Imported hashes are supported Argon2 PHC or bcrypt credentials, not arbitrary hashes. Empty/missing credentials do not imply a usable password. `role` names an existing project role. List returns `{items,total,limit,offset}` and accepts `q`, `limit`, `offset`.

For editor `PATCH /projects/{slug}/users/{identity}`, omitted profile fields preserve values, explicit `null` clears `display_name`/`email`/`phone`, and a supplied `meta` replaces the stored metadata object rather than deep-merging it. Delegated `PUT /p/{slug}/_users/{identity}/meta` takes `{meta,merge}`; `merge` defaults true and shallow-merges top-level keys; false replaces. Dedicated password replacement takes exactly one of `password`/`password_hash`; active/admin controls take `{"is_active":false}` / `{"is_admin":true}`. A user's own password change uses the distinct `POST /p/{slug}/auth/password` flow.

The delegated `_users` surface requires a project user that administers the project. It manages local password identities, rejects `jwt:`/`oidc:`/`social:` identities, cannot assign an admin role, and refuses self-delete, self-deactivation and self-role change. Endpoint `project_users_grant` can authorize scoped script-side user operations; it does not turn the caller into a platform editor. Delegated mutations are audited. A caller-supplied `is_admin` field on a normal login is not a privilege grant.

## Rotation and offboarding checklist

1. Inventory management sessions/PATs, project memberships, end-user accounts/API keys, IdP clients, authorizer provider secrets and resource credentials separately.
2. Revoke the compromised PAT/key, do not merely rename it. Mint the replacement, update consumers, verify, then revoke the old one. Creation secrets are generally shown once; list calls cannot recover them.
3. Remove collaborator membership and, separately, deactivate the person's project end-user row. A shared email does not propagate either operation.
4. For a compromised project password, replace it: the project session epoch invalidates old login tokens and associated refresh/code/MFA state. Revoking an API key alone does not retroactively erase every previously exchanged JWT.
5. Revoke platform refresh sessions/overview readers explicitly. Local CLI logout is not server revocation. Remove local `project_token` and deployment/CI secret copies independently.
6. Rotate upstream provider/resource secrets using their own reference. Back up the deployment's encryption key/secret backend securely; changing it without re-encryption can make stored secrets unreadable.
7. Recheck both allowed and denied operations; review audit records without copying tokens into logs or tickets.

Never send resource secrets to scripts or place credentials in URL query parameters, repository YAML or screenshots. Secrets are applied platform-side. For UI settings and deployment-only knobs see [instance settings](../instance/settings.md).

## Failures and verification

Management errors normally use `{"error":"<code>","message":"<detail>"}`. `401` means the credential is absent/invalid/expired; `403` also covers wrong identity plane, missing membership, insufficient role or scoped-PAT mismatch. `404` may indicate the selected project/object does not exist. Confirm `whoami`, selected project and membership before changing credentials. Never “fix” a denied editor operation by making a published endpoint anonymous.

**Evidence:** `crates/viat-api/src/{dto.rs,middleware_auth.rs,handlers/auth.rs,handlers/project_users.rs,handlers/project_user_admin.rs}`, `crates/viat-core/src/types/project.rs`, `crates/viat-cli/src/commands/auth.rs`. Examples were inspected, not executed; no account, SSO provider or remote cleanup was created by this reference.
