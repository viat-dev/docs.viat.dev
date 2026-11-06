---
title: "CLI: authz"
description: "Complete Viat 1.1.0 authz grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.authz
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.authz.rule.list","cli.authz.rule.set-origin"]
---

# CLI: authz

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat authz rule list](#viat-authz-rule-list)
- [viat authz rule set-origin](#viat-authz-rule-set-origin)

## viat authz rule list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authz rule list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `origin`: `--origin` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Only `platform` or only `delegated` rules |
| `ty`: `--type` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Only rules on this type |

Clap argument groups (literal metadata): `{"arguments":["json","origin","ty"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads server authorization rules; optional --origin must be platform/delegated and --type filters a model type. Not project roles or endpoint authentication settings.

**Actual output and exit.** Text: rule ID, origin, effect, type.action and expression; --json emits filtered rule array. No matches is successful. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authz rule list --origin platform --json
```

**Failure handling, verification and cleanup.** Invalid origin fails locally. Use IDs here for handover; no policy mutation/cleanup. A read’s model version is not a guarantee for a later push.

## viat authz rule set-origin

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authz rule set-origin [OPTIONS] --origin <ORIGIN> [IDS]...
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `dry_run`: `--dry-run` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: List what would change, change nothing |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `ids`: `<IDS> (#1)` | `String`, 1..∞, `Append` | no; conditional requirements below; no explicit Clap default | — | — |
| `not_in_file`: `--not-in-file` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `origin`: `--origin` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: `delegated` (a business screen owns it; push leaves it alone) or `platform` (the repo owns it; push mirrors it) |

Clap argument groups (literal metadata): `{"arguments":["dry_run","ids","not_in_file","origin"],"id":"SetOrigin","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Choose explicit rule IDs OR --not-in-file, never both/neither. --not-in-file requires CWD viat.yaml with authz section and --origin delegated; selects platform rules absent by content. --dry-run lists changes. Real run PUTs rules one by one; already-matching rows skipped.

**Actual output and exit.** Text lists would-set/set/nothing-to-change. Failure reports previously changed rows and remainder; partial writes persist. A current checkout’s recorded model version is advanced after successful handover; stale checkouts stay stale. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authz rule set-origin 00000000-0000-4000-8000-000000000001 --origin delegated --dry-run
```

**Failure handling, verification and cleanup.** Inspect dry-run before handing ownership away: future push mirrors only platform-owned rules. To undo, explicitly set the same IDs back to previous origin. After partial failure list/reconcile, then rerun remaining work; no all-rules transaction.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/authz.rs`
- `crates/viat-cli/src/repo/model_guard.rs`
- `crates/viat-api/src/handlers/authz_console.rs`
