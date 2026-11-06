---
title: "CLI: user"
description: "Complete Viat 1.1.0 user grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.user
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.user.authorizer.create","cli.user.authorizer.delete","cli.user.authorizer.list","cli.user.authorizer.show","cli.user.authorizer.update","cli.user.invite","cli.user.ls","cli.user.reset-mfa","cli.user.role.create","cli.user.role.delete","cli.user.role.list","cli.user.role.set-admin","cli.user.role.show","cli.user.set-role"]
---

# CLI: user

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat user authorizer create](#viat-user-authorizer-create)
- [viat user authorizer delete](#viat-user-authorizer-delete)
- [viat user authorizer list](#viat-user-authorizer-list)
- [viat user authorizer show](#viat-user-authorizer-show)
- [viat user authorizer update](#viat-user-authorizer-update)
- [viat user invite](#viat-user-invite)
- [viat user ls](#viat-user-ls)
- [viat user reset-mfa](#viat-user-reset-mfa)
- [viat user role create](#viat-user-role-create)
- [viat user role delete](#viat-user-role-delete)
- [viat user role list](#viat-user-role-list)
- [viat user role set-admin](#viat-user-role-set-admin)
- [viat user role show](#viat-user-role-show)
- [viat user set-role](#viat-user-set-role)

## viat user authorizer create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user authorizer create [OPTIONS] --name <NAME> --kind <KIND>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `default_role`: `--default-role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `kind`: `--kind` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["default_role","kind","name"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat authorizer create. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Creates name/kind/default_role with config={}. This leaf has no config/secret input, so jwt/oauth_oidc/social kinds needing config cannot be fully configured here; use console/API or supported repo declarations. anonymous/password/api_key can use optional defaults.

**Actual output and exit.** stdout: created authorizer &lt;name&gt; (&lt;kind&gt;). No user, key or token is minted. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user authorizer create --name demo_password --kind password
```

**Failure handling, verification and cleanup.** Bad kind/default role or required config fails. Verify show; delete demo authorizer only after unbinding endpoints and reviewing cascading API-key loss.

## viat user authorizer delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user authorizer delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat authorizer delete. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Deletes the project authorizer; api_key keys belong to it and cascade. Endpoint authentication depending on it can break.

**Actual output and exit.** stdout: deleted &lt;name&gt;; success 0. This is not token revoke for a single key. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user authorizer delete demo_password
```

**Failure handling, verification and cleanup.** Inventory bindings/keys first. Deleted key secrets/provider secrets cannot be recovered from pull/show; recreate config and distribute replacement keys explicitly. Verify absence via list.

## viat user authorizer list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user authorizer list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat authorizer list. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Lists the selected project’s authorizers, not platform login providers; read is editor-gated.

**Actual output and exit.** Text: name, kind, default-role UUID or -; --json gives public rows/config, never stored provider secrets. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user authorizer list --json
```

**Failure handling, verification and cleanup.** No rows is success. Default-role UUIDs are not role names: use role list/show to resolve. No changes/cleanup.

## viat user authorizer show

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user authorizer show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat authorizer show. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Reads one project authorizer’s public definition.

**Actual output and exit.** Text: name, kind, default-role UUID or -; --json also shows public configuration. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user authorizer show demo_password --json
```

**Failure handling, verification and cleanup.** Unknown name fails. Save public config before changes but keep original provider secret separately; show cannot recover it. Reading needs no cleanup.

## viat user authorizer update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user authorizer update [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `clear_default_role`: `--clear-default-role` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Remove the default role |
| `default_role`: `--default-role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: clear_default_role; help: The role every caller this authorizer admits gets |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["clear_default_role","default_role","name"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat authorizer update. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Requires --default-role or --clear-default-role; PUT sends only default_role (empty string clears), preserving kind/config/provider secret. Cannot change kind or configure OIDC/JWT here.

**Actual output and exit.** stdout: updated authorizer &lt;name&gt; (&lt;kind&gt;): default_role &lt;role-or-none&gt;. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user authorizer update demo_password --clear-default-role
```

**Failure handling, verification and cleanup.** No flag/unknown role fails. Record previous role name and restore with update; clear explicitly rather than omitting. Verify show, and review effects on newly resolved client identities.

## viat user invite

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user invite [OPTIONS] --email <EMAIL>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `display_name`: `--display-name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `email`: `--email` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help (see a summary with '-h') |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `project`: `--project` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Optional: also enroll the new user in this project |
| `role`: `--role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Required iff --project given. owner&#124;admin&#124;developer&#124;operator |
| `temp_password`: `--temp-password` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Pre-set the initial password (>= 8 chars). If omitted, the server generates one and returns it once |

Clap argument groups (literal metadata): `{"arguments":["display_name","email","json","project","role","temp_password"],"id":"Invite","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates a new platform account. Without --project requires platform Admin/Owner; with --project AND --role requires Owner/Admin membership in that named project, not platform rank. Both flags must appear together. Does not send an email invitation: share generated credential out of band.

**Actual output and exit.** Text: invited email (UUID), optional one-time temp_password and project enrollment. --json contains user and generated temp_password when applicable. User-supplied password is not reprinted; minimum 8 characters. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user invite --email teammate@example.invalid --project cli-demo --role developer
```

**Failure handling, verification and cleanup.** Existing email/invalid role/missing pair fails. Protect output and transfer securely; verification via user ls (if allowed) and project member ls. Removing demo membership does not delete platform account; account cleanup is console/API work, no user delete CLI.

## viat user ls

**Prerequisites and permissions.** Platform Admin/Owner; project role does not grant this platform permission. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user ls [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"Ls","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GET /users lists the platform user directory, not project end users or project members. Requires platform Admin/Owner even without project selection.

**Actual output and exit.** Text: email, platform role, display name; --json returns public rows/id/timestamps. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user ls --json
```

**Failure handling, verification and cleanup.** Project Owner alone can receive 403. Ask platform Owner for access; no user changes, protect personal-data captures.

## viat user reset-mfa

**Prerequisites and permissions.** Platform Owner; platform Admin and project Owner alone are insufficient. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user reset-mfa [OPTIONS] <EMAIL>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help (see a summary with '-h') |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["email","json"],"id":"ResetMfa","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Requires a platform login SESSION as well as platform Owner (PAT is refused). Clears target platform MFA and revokes its sessions, including sessions when no factor was present. Project p-user reset-mfa is separate.

**Actual output and exit.** Text says cleared/no factor and number of sessions signed out; --json preserves had_mfa/sessions_revoked. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user reset-mfa teammate@example.invalid --json
```

**Failure handling, verification and cleanup.** Verify the person out of band first. Cannot restore old factor/recovery codes: user must re-enroll in console and sign in again; operator policy may force enrollment.

## viat user role create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user role create [OPTIONS] --name <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Every user in this role administers the project (the delegated `/p/<slug>/_users` surface and `ctx.project.*`) |
| `description`: `--description` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["admin","description","name"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat role create. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Creates a non-built-in project role; --admin grants project-end-user administration to everyone assigned this role, not a platform login role. Default admin=false.

**Actual output and exit.** stdout: created role &lt;name&gt;, with (admin) tag when true. Does not assign users. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user role create --name demo_role --description 'Synthetic demo role'
```

**Failure handling, verification and cleanup.** Duplicate/reserved name fails. Verify role show; unassign demo users before delete. Preserve description via repo/console/API because no role update-description CLI exists.

## viat user role delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user role delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat role delete. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Deletes a non-built-in project role. This affects user role membership and authorization, not platform accounts.

**Actual output and exit.** stdout: deleted &lt;name&gt;. Built-in deletion is refused by the API. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user role delete demo_role
```

**Failure handling, verification and cleanup.** Inventory assigned users and rules, then remove only a demo role. Verify role list; recreating the name does not guarantee old UUID/assignments/rules are restored.

## viat user role list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user role list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat role list. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Lists project end-user roles, not platform/project collaborator role assignments.

**Actual output and exit.** Text: role name with builtin/admin tags; --json returns role rows. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user role list --json
```

**Failure handling, verification and cleanup.** Requires editor even for reads. Built-in roles are platform-managed and omitted from repo sync; no mutation/cleanup.

## viat user role set-admin

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user role set-admin --admin <ADMIN> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 1, `Set` | yes; no explicit Clap default | `{"aliases":[],"help":null,"hidden":false,"name":"false"}` / `{"aliases":[],"help":null,"hidden":false,"name":"true"}` | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["admin","name"],"id":"SetAdmin","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat role set-admin. Despite the user prefix, it still uses the selected PROJECT and the same permissions. PUTs boolean --admin true|false on a project role; all users in it gain/lose role-derived project administration. Built-in roles cannot be modified.

**Actual output and exit.** stdout: role &lt;name&gt; admin=&lt;bool&gt;. The account’s own is_admin may still grant access even when role admin=false. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user role set-admin demo_role --admin false
```

**Failure handling, verification and cleanup.** Inspect assignments before elevation. Verify role show and relevant users; restore original boolean to undo. Do not mistake this for user set-role or project member set-role.

## viat user role show

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user role show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exact dispatch alias of viat role show. Despite the user prefix, it still uses the selected PROJECT and the same permissions. Reads a project end-user role; roles carry admin flag/description, not a permission-string list. Authorization rules define data access.

**Actual output and exit.** Text: # name with builtin/admin tags; --json returns full public row. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user role show demo_role --json
```

**Failure handling, verification and cleanup.** Unknown role fails. Use JSON for description/id; no mutation/cleanup.

## viat user set-role

**Prerequisites and permissions.** Platform Owner; platform Admin and project Owner alone are insufficient. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat user set-role [OPTIONS] <EMAIL> <ROLE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help (see a summary with '-h') |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `role`: `<ROLE> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["email","json","role"],"id":"SetRole","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Sets PLATFORM owner/admin/developer/operator role by email. Normalizes role case; independent from project member set-role and project end-user role commands. Last platform Owner cannot be demoted.

**Actual output and exit.** Text: &lt;email&gt; is now &lt;role&gt;; --json public account response. Takes effect on platform administration access. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat user set-role teammate@example.invalid operator
```

**Failure handling, verification and cleanup.** Promote another Owner before last-owner demotion. Record old role, verify user ls, restore original role to undo. Do not use platform elevation merely to fix project membership.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/main.rs:1246–1273,1502–1527`
- `crates/viat-cli/src/commands/user.rs`
- `crates/viat-cli/src/commands/role.rs`
- `crates/viat-cli/src/commands/authorizer.rs`
- `crates/viat-api/src/handlers/users.rs`
