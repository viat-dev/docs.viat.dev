---
title: "CLI: project"
description: "Complete Viat 1.1.0 project grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.project
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.project.create","cli.project.diff","cli.project.folderize","cli.project.init","cli.project.list","cli.project.member.add","cli.project.member.ls","cli.project.member.rm","cli.project.member.set-role","cli.project.select"]
---

# CLI: project

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat project create](#viat-project-create)
- [viat project diff](#viat-project-diff)
- [viat project folderize](#viat-project-folderize)
- [viat project init](#viat-project-init)
- [viat project list](#viat-project-list)
- [viat project member add](#viat-project-member-add)
- [viat project member ls](#viat-project-member-ls)
- [viat project member rm](#viat-project-member-rm)
- [viat project member set-role](#viat-project-member-set-role)
- [viat project select](#viat-project-select)

## viat project create

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project create <SLUG> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name","slug"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** POST /projects creates a remote-only project and makes the creator Owner. Does not scaffold files or select it. Slug and display name are separate positional values.

**Actual output and exit.** stdout: created &lt;slug&gt;; 0 after successful response. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project create cli-demo 'CLI Demo'
```

**Failure handling, verification and cleanup.** Duplicate/invalid slug fails without creating another project. Verify project list; select explicitly. Delete an unwanted demo project through the console/API (there is no project delete CLI leaf).

## viat project diff

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project diff [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `exit_code`: `--exit-code` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Exit 1 if there are any differences (matches `git diff --exit-code`) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `only`: `--only` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | value delimiter: "," |

Clap argument groups (literal metadata): `{"arguments":["exit_code","json","only"],"id":"Diff","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Compares CWD repository content to remote drafts, not publish state or a push request plan. --only validates kinds; crate is not supported. Script/workflow/resource server-only items are informational because push does not delete them.

**Actual output and exit.** Text marks added/removed/changed/server-only; --json gives stages with added, removed, changed and server_only arrays. --exit-code exits 1 for real differences, not informational server_only; otherwise differences still exit 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project diff --only scripts,workflows --exit-code
```

**Failure handling, verification and cleanup.** Run from a complete repo root and select intended project. Unknown kind fails; read permissions for metadata may require editor. Resolve draft drift before push; no remote changes to undo.

## viat project folderize

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project folderize [OPTIONS] --prefix <PREFIXES>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `apply`: `--apply` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Actually apply the migration (single server-side transaction) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `prefixes`: `--prefix` | `String`, 1, `Append` | yes; no explicit Clap default | — | help: Prefix to split on (repeatable). `jzyx` moves `jzyx_util` to `jzyx/util` |

Clap argument groups (literal metadata): `{"arguments":["apply","json","prefixes"],"id":"Folderize","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Dry-run by default; --apply performs a server-side transactional prefix-to-folder rename with reference rewrites while preserving UUIDs. Repeated --prefix selects legacy prefixes. This requires project Owner/Admin.

**Actual output and exit.** Prints planned/applied moves and rewrites; --json returns plan/result. Published snapshots do not change until republish. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project folderize --prefix legacy --json
```

**Failure handling, verification and cleanup.** Collisions refuse instead of overwriting. Review dry-run, then apply and pull: local old filenames are stale. There is no inverse folderize option; retain a backup and explicitly rename/rewrite to undo.

## viat project init

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project init [OPTIONS] <SLUG>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `here`: `--here` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Scaffold in CWD instead of ./&lt;slug&gt;/. CWD must be empty (apart from .git/.idea/.claude) |
| `name`: `--name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `slug` | — | — |
| `server`: `--server` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `resolved config server_url` | — | help: Override server URL (otherwise uses the loaded config) |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["here","name","server","slug"],"id":"Init","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates the remote project and a local repo (default ./&lt;slug&gt;, --here uses CWD). Runtime --name defaults to slug. --here permits only .git/.idea/.claude/.vscode/.viat; otherwise refuses nonempty dirs. Writes .viat/config.yaml, viat.yaml and endpoints/scripts/workflows/schedules/watches/ws_triggers/resources directories. --server overrides destination, not login authority.

**Actual output and exit.** Prints remote creation, scaffold path and selected project. New repo config selects the project. No push or publish occurs. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project init cli-demo --name 'CLI Demo'
```

**Failure handling, verification and cleanup.** Not transactional across remote/filesystem: failures can leave a directory or created project. Inspect both before retrying; do not blindly delete a non-demo project. Remove disposable local scaffold and delete the remote demo through console/API when done.

## viat project list

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GET /projects lists only projects the caller can access; platform rank alone does not supply project membership.

**Actual output and exit.** Text shows slug, display name and * on selected project; --json emits the server list. Empty list is successful. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project list --json
```

**Failure handling, verification and cleanup.** Missing projects require membership, not repeated select attempts. No mutation or cleanup.

## viat project member add

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project member add [OPTIONS] --role <ROLE> <EMAIL>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `role`: `--role` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: Project role: owner&#124;admin&#124;developer&#124;operator |

Clap argument groups (literal metadata): `{"arguments":["email","json","role"],"id":"Add","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Adds an existing platform email with independent project owner/admin/developer/operator role. CLI normalizes role case. This does not invite an unregistered account.

**Actual output and exit.** Text: &lt;email&gt; added to &lt;slug&gt; as &lt;role&gt;; --json prints response. Membership is effective immediately. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project member add teammate@example.invalid --role developer
```

**Failure handling, verification and cleanup.** Unknown email fails: use user invite --project with --role for a new account. Verify member ls; member rm removes demo membership, subject to last-owner guard.

## viat project member ls

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project member ls [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"Ls","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GET selected project /members; project collaborators are platform accounts, not p-user rows.

**Actual output and exit.** Text: email, role, display name or (no members); --json preserves user_id and timestamps. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project member ls --json
```

**Failure handling, verification and cleanup.** 403 means no membership. Obtain access from a project Owner/Admin; read-only, no cleanup.

## viat project member rm

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project member rm [OPTIONS] <EMAIL>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["email","json"],"id":"Rm","multiple":true,"required":false}`

**Inputs, behavior and side effects.** DELETE membership by email, including self if another Owner remains. Removes that membership’s push-device registrations; rejoining does not restore registrations. Cannot remove the last Owner.

**Actual output and exit.** Text: &lt;email&gt; removed from &lt;slug&gt;; --json prints {ok:true}. Project access is lost immediately. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project member rm teammate@example.invalid
```

**Failure handling, verification and cleanup.** Last-owner refusal needs another Owner first. Re-add with original role to restore membership, and re-register devices separately. Platform account itself is not deleted.

## viat project member set-role

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project member set-role [OPTIONS] <EMAIL> <ROLE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `email`: `<EMAIL> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `role`: `<ROLE> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["email","json","role"],"id":"SetRole","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PUT member role by email. Project role is independent of platform user set-role. Cannot demote the last project Owner.

**Actual output and exit.** Text: &lt;email&gt; is now &lt;role&gt; in &lt;slug&gt;; --json prints response. Access changes immediately. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project member set-role teammate@example.invalid operator
```

**Failure handling, verification and cleanup.** Promote another Owner before demotion; invalid/nonmember email fails. Record original role and restore with set-role; verify member ls.

## viat project select

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat project select <SLUG>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["slug"],"id":"Select","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Checks slug against GET /projects, then saves current_project in the resolved local config. It does not cd, pull, scaffold, or mint a project token.

**Actual output and exit.** stdout: selected cli-demo; success 0. Local selection changes subsequent project-scoped commands. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat project select cli-demo
```

**Failure handling, verification and cleanup.** Unknown/inaccessible slug exits 1 and is not selected. Verify project list; select the previous slug to undo.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/project.rs`
- `crates/viat-cli/src/commands/diff.rs`
- `crates/viat-cli/src/repo/diff.rs`
- `crates/viat-api/src/handlers/projects.rs`
