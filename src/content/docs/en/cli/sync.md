---
title: "CLI: push / pull / export / import"
description: "Complete Viat 1.1.0 push / pull / export / import grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.sync
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.export","cli.import","cli.pull","cli.push"]
---

# CLI: push / pull / export / import

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat export](#viat-export)
- [viat import](#viat-import)
- [viat pull](#viat-pull)
- [viat push](#viat-push)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

Repo layout: viat.yaml; scripts/&lt;folder&gt;/&lt;name&gt;.&lt;ext&gt;; YAML under workflows/resources/schedules/watches/queue_triggers/ws_triggers; im/accounts and im/triggers; endpoint node files under endpoints/&lt;tree&gt;/; crate/; migrations/&lt;resource&gt;/*.sql and authz/migrations/*.yaml (different migration systems). Folders are part of asset identity.

A resource secret’s string $secret is an export placeholder stripped by push, not a credential; {$secret: name} / "$secret:name" are resource references in supported positions, not the same construct. Top-level plain $keep preserves an existing server value only; it is not deep merge and cannot initialize a new resource.

Sync does not cover every console setting, credential or scanned chat binding. Only resource-credential chat accounts are syncable; row-secret/QR accounts are neither pulled nor deleted by push due to absence. Publish is separate from push, and SQL migrations are not run automatically.

## viat export

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat export [OPTIONS] [SLUG]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `only`: `--only` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | value delimiter: "," |
| `output`: `--output` / `-o` | `PathBuf`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `./<slug>.viatpkg` | — | help: Output path (defaults to `./<slug>.viatpkg`) |
| `slug`: `<SLUG> (#1)` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `current_project` | — | help: Project slug to export (defaults to the selected project) |

Clap argument groups (literal metadata): `{"arguments":["only","output","slug"],"id":"Export","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Freshly pulls selected/positional project into temporary staging, packs gzip tar .viatpkg, cleans staging. Runtime output default ./&lt;slug&gt;.viatpkg. Same --only kind selection and permissions as pull. Does not export credentials or select a different project.

**Actual output and exit.** Prints pull progress then exported project &lt;slug&gt; -> &lt;path&gt;; output file can overwrite an existing file. Not a server-wide backup or an upstream database/file-byte backup. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat export cli-demo --output demo.viatpkg
```

**Failure handling, verification and cleanup.** Full export needs editor-gated reads; bad destination/file access can fail after pulling. Keep bundle private because plain/source/config still travel. Remove demo.viatpkg when finished; restore missing credentials separately on import.

## viat import

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat import [OPTIONS] <FILE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `as_slug`: `--as` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Import under a different project slug than the bundle's own |
| `file`: `<FILE> (#1)` | `PathBuf`, 1, `Set` | yes; no explicit Clap default | — | help: Path to the `.viatpkg` bundle |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `only`: `--only` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | value delimiter: "," |
| `prune`: `--prune` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Mirror the bundle onto the server, deleting server-only items. Off by default (non-destructive upsert) |
| `update_resources`: `--update-resources` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Also update resources that already exist here and carry secrets. Off by default: a bundle's host/port are the source environment's |

Clap argument groups (literal metadata): `{"arguments":["as_slug","file","only","prune","update_resources"],"id":"Import","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Unpacks .viatpkg into temporary staging, reads viat.yaml, creates target project if absent, applies non-destructive upserts by default. --as changes target slug; current selection is not the destination override. --prune deliberately mirrors server-only items away. New secret-bearing resources are skipped; existing ones are entirely kept unless --update-resources, to avoid pointing target credentials at source hosts.

**Actual output and exit.** Prints imported project, pending publish, skipped-secret and kept-resource summaries; skipped/kept resources do not by themselves fail the command. No publish or DB migration. Does not change selected project. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat import demo.viatpkg --as cli-demo-copy
```

**Failure handling, verification and cleanup.** Existing target stages require their normal membership/editor/Owner-Admin settings permissions. Invalid archive/missing viat.yaml/stage errors exit 1 after any earlier remote writes; no batch rollback. Back up target first, inspect skipped resources, select destination explicitly for verification, provision credentials safely, diff then publish. Remove local demo bundle/staging leftovers only after inspection.

## viat pull

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). CWD must be the intended repo root, and selected project must match. Pull skips managed auth nodes/roles and non-rebuildable row-secret/QR chat accounts (with notice); their absence is not permission to delete them.

```text
Usage: viat pull [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `only`: `--only` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | value delimiter: "," |

Clap argument groups (literal metadata): `{"arguments":["json","only"],"id":"Pull","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Remote drafts → CWD files, not published snapshots. --only kinds match push, unknown kinds silently ignored. Writes/overwrites represented files; it is not a universal local-prune/reset operation (e.g. server-removed scripts can leave local files). Secret fields are $secret placeholders; existing top-level plain $keep markers are preserved when applicable.

**Actual output and exit.** Prints pulled items; --json appends {"ok":true}, not guaranteed to suppress stage text. Updates local authz model-version record. No remote content mutation besides ordinary login refresh. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat pull --only scripts,workflows
```

**Failure handling, verification and cleanup.** Full pull/export includes editor-gated role/authorizer/tree/model reads; a member can pull only permitted content stages. Back up uncommitted files first; failures can leave partial local output. Inspect diff and local stale files before pushing; do not push an incomplete checkout.

## viat push

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Run from the COMPLETE intended repo root with matching viat.yaml project.slug and selected project; session discovery does not find the repo root for you. Supported kinds: meta,resources,scripts,workflows,schedules,watches,queue_triggers,ws_triggers,chat,endpoints,crate. Built-in auth endpoints/roles and legacy system resource are skipped.

```text
Usage: viat push [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `force_authz`: `--force-authz` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Push even though the server's authorization model changed since this checkout last pulled or pushed — overwriting that change |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `only`: `--only` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | value delimiter: ","; help: Comma-separated kinds (e.g. scripts,endpoints), not individual files |
| `yes`: `--yes` / `-y` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Apply deletions from the authorization model or roles (types, attrs, actions, subject attrs, roles). Without it, a push that would delete any lists them and stops |

Clap argument groups (literal metadata): `{"arguments":["force_authz","json","only","yes"],"id":"Push","multiple":true,"required":false}`

**Inputs, behavior and side effects.** CWD repo → remote drafts. --only chooses kinds, not filenames; empty means all, unknown kinds silently do nothing. Mirror deletion is ALREADY ON for meta, schedules, watches, queue/ws triggers, syncable chat accounts/triggers and endpoint nodes; scripts/workflows/resources are never pruned by absence. No --prune flag exists on push.

**Actual output and exit.** Prints per-stage writes/deletions, pending-publish and excluded-drift summaries; --json appends {"ok":true} but stage/hint text can still precede it (not a clean single JSON stream). No DDL or publish. Changes apply stage-by-stage, not one global transaction. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat push --only scripts,workflows
```

**Failure handling, verification and cleanup.** Full metadata/settings changes can require project Owner/Admin; content-only stages need editor and some operational stages only membership. Refuses stale authz model before meta writes unless --force-authz; model/role deletions need --yes. These overrides are different and are not a general destructive-sync confirmation. Run diff and keep a complete backup before push; partial failure leaves prior stages applied. Pull/reconcile drafts, migrate DB explicitly, then publish intentionally.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/sync.rs`
- `crates/viat-cli/src/commands/bundle.rs`
- `crates/viat-cli/src/repo/{viat_yaml,resources,scripts,workflows,schedules,watches,queue_triggers,ws_triggers,im,endpoints,crate_files,model_guard,authz_steps}.rs`
