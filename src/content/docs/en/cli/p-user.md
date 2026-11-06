---
title: "CLI: p-user"
description: "Complete Viat 1.1.0 p-user grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.p-user
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.p-user.activate","cli.p-user.assign-role","cli.p-user.create","cli.p-user.deactivate","cli.p-user.delete","cli.p-user.import","cli.p-user.list","cli.p-user.reset-mfa","cli.p-user.set-admin","cli.p-user.set-password","cli.p-user.update"]
---

# CLI: p-user

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat p-user activate](#viat-p-user-activate)
- [viat p-user assign-role](#viat-p-user-assign-role)
- [viat p-user create](#viat-p-user-create)
- [viat p-user deactivate](#viat-p-user-deactivate)
- [viat p-user delete](#viat-p-user-delete)
- [viat p-user import](#viat-p-user-import)
- [viat p-user list](#viat-p-user-list)
- [viat p-user reset-mfa](#viat-p-user-reset-mfa)
- [viat p-user set-admin](#viat-p-user-set-admin)
- [viat p-user set-password](#viat-p-user-set-password)
- [viat p-user update](#viat-p-user-update)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

```json
[{"identity":"demo_import_user","display_name":"Imported Demo"}]
```

Save as demo-users.json. Create demo_role with role create --name demo_role first. demo_user is a separate demo end user, not a platform-login email. The passwordless row illustrates migration shape; set credentials before password login.

## viat p-user activate

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user activate <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["identity"],"id":"Activate","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Enables an existing project end-user’s active flag. Not license activation, platform login or project membership.

**Actual output and exit.** stdout: &lt;identity&gt; is_active=true. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user activate demo_user
```

**Failure handling, verification and cleanup.** Missing identity fails; verify p-user list. deactivate reverses the flag but cannot reverse past/in-flight business effects.

## viat p-user assign-role

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user assign-role [OPTIONS] <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `role`: `--role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["identity","role"],"id":"AssignRole","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PUTs a role name on an existing identity; omitting --role explicitly assigns null (unassigns), not leaves unchanged.

**Actual output and exit.** stdout: assigned role -> &lt;identity&gt; (now role_id=&lt;UUID-or-&gt;). Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user assign-role demo_user --role demo_role
```

**Failure handling, verification and cleanup.** Missing user/role fails. Save original role, verify list, restore that role to undo; unassigning does not clear the user’s own admin flag.

## viat p-user create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user create [OPTIONS] --identity <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `display_name`: `--display-name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `--identity` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `password`: `--password` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: password_hash |
| `password_hash`: `--password-hash` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Instead of `--password`: an argon2 (`$argon2id$…`) or bcrypt (`$2a$`/`$2b$`/`$2y$`) hash from the system being migrated from |
| `role`: `--role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["display_name","identity","password","password_hash","role"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates a project end-user identity, optional display-name/role and either plaintext password or imported argon2/bcrypt hash (not both). This is not platform collaborator enrollment.

**Actual output and exit.** stdout: created project user &lt;identity&gt;. Does not print password/hash or log in the new user. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user create --identity demo_user --display-name 'Demo User' --role demo_role
```

**Failure handling, verification and cleanup.** Duplicate identity, malformed hash or too-short password (minimum 8 characters) fails. Avoid real credentials in argv; import via protected file for bulk migration. Verify p-user list; delete demo_user for cleanup.

## viat p-user deactivate

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user deactivate <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["identity"],"id":"Deactivate","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Disables an existing project end-user’s active flag. Not license activation, platform login or project membership.

**Actual output and exit.** stdout: &lt;identity&gt; is_active=false. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user deactivate demo_user
```

**Failure handling, verification and cleanup.** Missing identity fails; verify p-user list. activate reverses the flag but cannot reverse past/in-flight business effects.

## viat p-user delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user delete <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["identity"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes the project end-user identity; not a platform user or collaborator membership. Associated authorization/credential references can be affected.

**Actual output and exit.** stdout: deleted &lt;identity&gt;; success 0. Does not undo their earlier business-data writes. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user delete demo_user
```

**Failure handling, verification and cleanup.** Inventory dependencies first and remove only disposable users. Verify p-user list; recreating an identity does not restore old UUID, MFA, keys or grants automatically.

## viat p-user import

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Write demo-users.json as [{"identity":"demo_import_user","display_name":"Imported Demo"}]. This synthetic row has no password and cannot be used as a password-login credential until one is set.

```text
Usage: viat p-user import --file <FILE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `PathBuf`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

Clap argument groups (literal metadata): `{"arguments":["file"],"id":"Import","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads JSON array or JSON Lines; each row identity plus optional password/password_hash/display_name/email/phone/role/meta. Unknown fields are rejected per row. One POST per valid row; continues after failures, no batch transaction.

**Actual output and exit.** stdout: ok/FAILED #row plus &lt;N&gt; created, &lt;N&gt; failed. Any failed row exits 1 after reporting all rows; prior successes remain. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user import --file demo-users.json
```

**Failure handling, verification and cleanup.** Keep the input file protected. Reconcile successes before retrying to avoid duplicate-identity failures; delete only created demo identities when cleaning up.

## viat p-user list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads one page with limit=500, including source/email. CLI has no paging/search flags; --json is still that same page, not all pages.

**Actual output and exit.** Text: identity, source, role_id, display/email/phone and inactive tag, plus truncation hint. --json preserves page object/total. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user list --json
```

**Failure handling, verification and cleanup.** Use console/API ?q=&offset=&limit= for remaining rows. Personal data requires protected captures; no mutation/cleanup.

## viat p-user reset-mfa

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user reset-mfa <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["identity"],"id":"ResetMfa","multiple":true,"required":false}`

**Inputs, behavior and side effects.** DELETEs the end-user’s second factor as operator recovery; does not reset the platform account’s MFA.

**Actual output and exit.** stdout reports cleared or had no two-factor authentication. The account may have to enroll again under project policy. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user reset-mfa demo_user
```

**Failure handling, verification and cleanup.** Confirm the person’s identity out of band first. Missing user fails; this is not reversible by CLI. User enrolls a new factor and recovery codes; verify the next authorized login follows project policy.

## viat p-user set-admin

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user set-admin --admin <ADMIN> <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `admin`: `--admin` | `bool`, 1, `Set` | yes; no explicit Clap default | `{"aliases":[],"help":null,"hidden":false,"name":"false"}` / `{"aliases":[],"help":null,"hidden":false,"name":"true"}` | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["admin","identity"],"id":"SetAdmin","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Sets the individual end-user’s is_admin using --admin true|false. Their assigned role can independently confer admin, so setting false alone is not full demotion if the role remains admin.

**Actual output and exit.** stdout: user &lt;identity&gt; admin=&lt;bool&gt;. Changes project-end-user administration, not platform privileges. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user set-admin demo_user --admin false
```

**Failure handling, verification and cleanup.** Missing identity/invalid boolean fails. Check both own flag and role; restore old boolean if needed and verify through public user data.

## viat p-user set-password

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user set-password [OPTIONS] <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `password`: `--password` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: password_hash |
| `password_hash`: `--password-hash` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["identity","password","password_hash"],"id":"SetPassword","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Replaces the local end-user password with exactly one of --password or --password-hash. Imported hash supports argon2/bcrypt; plaintext must meet the 8-character floor.

**Actual output and exit.** stdout: password set for &lt;identity&gt;. Does not expose previous password/hash. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user set-password demo_user --password demo-only-password
```

**Failure handling, verification and cleanup.** Missing/both credential flags or bad hash fails. Use synthetic password only in this example; real argv is visible to process listings/history. Verify through an authorized isolated login; restore a securely held credential if needed, never infer old value from output.

## viat p-user update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat p-user update [OPTIONS] <IDENTITY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `display_name`: `--display-name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `email`: `--email` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `identity`: `<IDENTITY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `meta`: `--meta` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: A JSON object, replacing the stored meta whole |
| `phone`: `--phone` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["display_name","email","identity","meta","phone"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PATCHes provided display-name/email/phone/meta; meta is parsed JSON. Omitted fields remain; empty profile strings have API clearing/validation semantics, not a blanket null flag.

**Actual output and exit.** stdout: updated &lt;identity&gt; display_name=... email=... phone=.... Does not change credentials or role. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat p-user update demo_user --display-name 'Demo Renamed' --meta '{"demo":true}'
```

**Failure handling, verification and cleanup.** Bad JSON/email/phone fails. Phone validation allows common number punctuation and 5–20 digits; email shape is checked. Save previous profile and restore provided fields; verify list/API.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/project_user.rs`
- `crates/viat-api/src/handlers/project_users.rs`
