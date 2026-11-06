---
title: "CLI: role"
description: "Complete Viat 1.1.0 role grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.role
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.role.create","cli.role.delete","cli.role.list","cli.role.set-admin","cli.role.show"]
---

# CLI: role

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat role create](#viat-role-create)
- [viat role delete](#viat-role-delete)
- [viat role list](#viat-role-list)
- [viat role set-admin](#viat-role-set-admin)
- [viat role show](#viat-role-show)

## viat role create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat role create [OPTIONS] --name <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Every user in this role administers the project (the delegated `/p/<slug>/_users` surface and `ctx.project.*`) |
| `description`: `--description` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["admin","description","name"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates a non-built-in project role; --admin grants project-end-user administration to everyone assigned this role, not a platform login role. Default admin=false.

**Actual output and exit.** stdout: created role &lt;name&gt;, with (admin) tag when true. Does not assign users. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat role create --name demo_role --description 'Synthetic demo role'
```

**Failure handling, verification and cleanup.** Duplicate/reserved name fails. Verify role show; unassign demo users before delete. Preserve description via repo/console/API because no role update-description CLI exists.

## viat role delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat role delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes a non-built-in project role. This affects user role membership and authorization, not platform accounts.

**Actual output and exit.** stdout: deleted &lt;name&gt;. Built-in deletion is refused by the API. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat role delete demo_role
```

**Failure handling, verification and cleanup.** Inventory assigned users and rules, then remove only a demo role. Verify role list; recreating the name does not guarantee old UUID/assignments/rules are restored.

## viat role list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat role list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists project end-user roles, not platform/project collaborator role assignments.

**Actual output and exit.** Text: role name with builtin/admin tags; --json returns role rows. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat role list --json
```

**Failure handling, verification and cleanup.** Requires editor even for reads. Built-in roles are platform-managed and omitted from repo sync; no mutation/cleanup.

## viat role set-admin

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat role set-admin --admin <ADMIN> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 1, `Set` | yes; no explicit Clap default | `{"aliases":[],"help":null,"hidden":false,"name":"false"}` / `{"aliases":[],"help":null,"hidden":false,"name":"true"}` | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["admin","name"],"id":"SetAdmin","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PUTs boolean --admin true|false on a project role; all users in it gain/lose role-derived project administration. Built-in roles cannot be modified.

**Actual output and exit.** stdout: role &lt;name&gt; admin=&lt;bool&gt;. The account’s own is_admin may still grant access even when role admin=false. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat role set-admin demo_role --admin false
```

**Failure handling, verification and cleanup.** Inspect assignments before elevation. Verify role show and relevant users; restore original boolean to undo. Do not mistake this for user set-role or project member set-role.

## viat role show

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat role show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads a project end-user role; roles carry admin flag/description, not a permission-string list. Authorization rules define data access.

**Actual output and exit.** Text: # name with builtin/admin tags; --json returns full public row. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat role show demo_role --json
```

**Failure handling, verification and cleanup.** Unknown role fails. Use JSON for description/id; no mutation/cleanup.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/role.rs`
- `crates/viat-api/src/handlers/roles.rs`
