---
title: "CLI: tree"
description: "Complete Viat 1.1.0 tree grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.tree
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.tree.create","cli.tree.delete","cli.tree.list","cli.tree.show","cli.tree.update"]
---

# CLI: tree

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat tree create](#viat-tree-create)
- [viat tree delete](#viat-tree-delete)
- [viat tree list](#viat-tree-list)
- [viat tree show](#viat-tree-show)
- [viat tree update](#viat-tree-update)

## viat tree create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat tree create --name <NAME> --path <PATH_OVERRIDE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `path_override`: `--path` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name","path_override"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates a tree with required --name and --path override; --path is a URL prefix, not local folder. Server validates uniqueness/path shape.

**Actual output and exit.** stdout lines: id, name, path_override. No endpoint execution or automatic publish. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat tree create --name demo_tree --path /demo
```

**Failure handling, verification and cleanup.** Duplicate/invalid path fails. Verify tree show; delete empty demo tree when done, after inspecting its endpoint descendants.

## viat tree delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat tree delete <ID_OR_NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id_or_name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Resolves UUID/name and deletes the tree, potentially cascading its endpoint subtree. Treat as destructive routing change, not deletion of an empty local directory.

**Actual output and exit.** stdout: deleted &lt;name&gt; (&lt;UUID&gt;); handles empty DELETE response. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat tree delete demo_tree
```

**Failure handling, verification and cleanup.** Inspect children and back up endpoint repo first; any currently published node causes 409 conflict refusal: unpublish deliberately first. Verify list; recreation and republishing are explicit and old IDs need not survive.

## viat tree list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat tree list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists endpoint tree containers; an editor is required even for this read.

**Actual output and exit.** Text shows id, name and path_override; --json returns list. Root override is displayed distinctly. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat tree list --json
```

**Failure handling, verification and cleanup.** Do not confuse trees with filesystem directories or script folders. No mutation/cleanup; use IDs/names here for tree show/update.

## viat tree show

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat tree show [OPTIONS] <ID_OR_NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id_or_name","json"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Accepts UUID or exact tree name; names are resolved by listing current project trees.

**Actual output and exit.** Text: id, name, path_override; --json returns raw tree object. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat tree show demo_tree --json
```

**Failure handling, verification and cleanup.** Unknown name/UUID fails rather than creating a tree. Save original name/path before edits; reading needs no cleanup.

## viat tree update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat tree update [OPTIONS] <ID_OR_NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `name`: `--name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `path`: `--path` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id_or_name","name","path"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PATCHes provided --name and/or --path after resolving UUID/name; absent fields remain unchanged. Renaming the tree is not moving script/resource folders.

**Actual output and exit.** stdout: id, name, path_override. Review endpoint draft paths and publish state after path changes. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat tree update demo_tree --name demo_tree_renamed
```

**Failure handling, verification and cleanup.** Name/path collisions refuse; keep original values and restore via update. Verify tree show plus endpoint list; changes to served snapshots require the appropriate publish operation.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/tree.rs`
- `crates/viat-api/src/handlers/trees.rs`
- `crates/viat-db/src/endpoint_trees.rs`
