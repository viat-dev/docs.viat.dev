---
title: "CLI: publish"
description: "Complete Viat 1.1.0 publish grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.publish
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.publish.apply","cli.publish.history","cli.publish.plan","cli.publish.rollback","cli.publish.show"]
---

# CLI: publish

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat publish apply](#viat-publish-apply)
- [viat publish history](#viat-publish-history)
- [viat publish plan](#viat-publish-plan)
- [viat publish rollback](#viat-publish-rollback)
- [viat publish show](#viat-publish-show)

## viat publish apply

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat publish apply [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `acknowledge_test_failures`: `--acknowledge-test-failures` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Publish even if enabled test cases (the server regression gate) fail |
| `acknowledge_warnings`: `--acknowledge-warnings` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Publish even if the server reports warnings (parameter declarations that disagree with the script, …) — they are recorded on the revision. Without it any warning refuses the whole batch |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `require_tests`: `--require-tests` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Run the project's offline tests (`viat script test`) first and refuse to publish if any fail |
| `yes`: `--yes` / `-y` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["acknowledge_test_failures","acknowledge_warnings","json","require_tests","yes"],"id":"Apply","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Publishes all dirty endpoints atomically as one revision. Prompts unless --yes or --json; declining prints Aborted and exits 0. --require-tests runs local script test first. Enabled server regression cases run against real resources; warnings/test failures block the whole batch unless corresponding --acknowledge-* is given.

**Actual output and exit.** Text lists snapshots/build results or Nothing to publish. --json prints raw response/refusal body, exit 1 for non-2xx. Build failures/pending reported inside an accepted publish response do not themselves cause CLI nonzero; routes can be live while installs fail/run. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat publish apply --yes
```

**Failure handling, verification and cleanup.** Fix failing cases/warnings rather than automatically acknowledging them. Inspect history/show, build/env and authorized smoke requests. publish rollback restores the head revision’s snapshots, not resources, schema or test side effects.

## viat publish history

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat publish history [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `limit`: `--limit` | `u32`, 1, `Set` | no; conditional requirements below; `20` | — | — |
| `offset`: `--offset` | `u32`, 1, `Set` | no; conditional requirements below; `0` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","limit","offset"],"id":"History","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists project publish revisions with limit/offset; server clamps limit to 1–100 and offset to at least 0.

**Actual output and exit.** Text revision summary or --json object with total, limit, offset, revisions. Defaults 20 and 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat publish history --limit 20 --offset 0 --json
```

**Failure handling, verification and cleanup.** This read needs membership, unlike endpoint history which needs publisher. Paginate for older revisions; no mutation/cleanup.

## viat publish plan

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat publish plan [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"Plan","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists project-wide publishable dirty leaves and draft-vs-active summaries. Server also heals stale dependency-closure dirty markers; this does not activate routes.

**Actual output and exit.** Text shows target/version/status/diff; --json returns plan with publishable_count. Empty plan exits 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat publish plan --json
```

**Failure handling, verification and cleanup.** Plan is not a reservation: concurrent edits may change apply. Read-only to callers apart from internal marker repair; no rollback needed. Review real test/build side effects before apply.

## viat publish rollback

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat publish rollback [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `yes`: `--yes` / `-y` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","yes"],"id":"Rollback","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Rolls back the latest project publish revision, including endpoints previously unpublished. Does not accept an arbitrary revision parameter. Prompts unless --yes/--json; decline exits 0.

**Actual output and exit.** Text prints restored snapshot/unpublished per endpoint; --json gives response. No revision in prompted mode prints Nothing to roll back and exits 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat publish rollback --yes
```

**Failure handling, verification and cleanup.** Inspect history/show before action and verify after. External databases/resources and current drafts are not rolled back. To restore a newer change, inspect draft then publish; do not assume repeated rollback toggles safely.

## viat publish show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat publish show [OPTIONS] <REVISION_ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `revision_id`: `<REVISION_ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","revision_id"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads one project revision by full UUID or unambiguous prefix; not an endpoint snapshot ID.

**Actual output and exit.** Text gives before/after snapshot changes; --json returns revision details. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat publish show 00000000-0000-4000-8000-000000000001 --json
```

**Failure handling, verification and cleanup.** Missing/ambiguous prefix fails: use full ID from history. Reading does not roll back or publish; no cleanup.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/publish.rs`
- `crates/viat-api/src/handlers/publish.rs`
- `crates/viat-api/src/handlers/snapshots.rs`
