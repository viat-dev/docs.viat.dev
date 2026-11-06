---
title: "CLI: workflow"
description: "Complete Viat 1.1.0 workflow grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.workflow
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.workflow.create","cli.workflow.delete","cli.workflow.list","cli.workflow.show","cli.workflow.test","cli.workflow.update"]
---

# CLI: workflow

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat workflow create](#viat-workflow-create)
- [viat workflow delete](#viat-workflow-delete)
- [viat workflow list](#viat-workflow-list)
- [viat workflow show](#viat-workflow-show)
- [viat workflow test](#viat-workflow-test)
- [viat workflow update](#viat-workflow-update)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

```yaml
# demo-workflow.yaml
inputs: {}
steps:
  - id: echo
    script: demo_echo
outputs:
  result: "$echo.output"
```

demo_echo uses the resource-free Python fixture on the script page. Create the script first, then workflow create before test. Editing/testing addresses drafts, not published snapshots.

## viat workflow create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Write demo-workflow.yaml using the synthetic fixture in this page and create demo_echo first. No provider is used by that script.

```text
Usage: viat workflow create --file <FILE> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `PathBuf`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["file","name"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads raw YAML --file and POSTs name/folder/definition. Names may be folder-qualified. Creates a draft only, no run/publish.

**Actual output and exit.** stdout: created &lt;name&gt; (vN). Server validates the workflow definition and referenced structure. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat workflow create demo_flow --file demo-workflow.yaml
```

**Failure handling, verification and cleanup.** Invalid YAML/definition or duplicate name fails. Verify workflow show; delete demo_flow when no longer referenced.

## viat workflow delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat workflow delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes saved workflow draft. Does not undo runs or their resource side effects.

**Actual output and exit.** stdout: deleted &lt;name&gt;; 0 after successful DELETE. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat workflow delete demo_flow
```

**Failure handling, verification and cleanup.** Remove dependent schedules/endpoints deliberately first and keep YAML. Confirm absence with list; recreation requires the saved definition, not old run logs.

## viat workflow list

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat workflow list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists current workflow drafts across folders.

**Actual output and exit.** Text: qualified name and vN; --json emits server list; empty list succeeds. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat workflow list --json
```

**Failure handling, verification and cleanup.** Use qualified references from this list. No execution/mutation or cleanup.

## viat workflow show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat workflow show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads one draft, not the snapshot served by published endpoints.

**Actual output and exit.** Text prints # name (vN) and YAML definition; --json returns public workflow object. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat workflow show demo_flow --json
```

**Failure handling, verification and cleanup.** Missing/ambiguous name fails; qualify folder. Save this definition before update/delete if rollback is needed; reading itself needs no cleanup.

## viat workflow test

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat workflow test [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `input`: `--input` / `--args` | `String`, 1, `Set` | no; conditional requirements below; `{}` | — | help: JSON object of inputs. `--args` is accepted too — the script commands spell it that way, and the two were confused constantly |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["input","name"],"id":"Test","multiple":true,"required":false}`

**Inputs, behavior and side effects.** POSTs live unpublished definition to /test_run using --input JSON (default {}, alias --args). Runs real resources and may mutate them.

**Actual output and exit.** Per-attempt step statuses go to stderr. Only when user_error is null AND no step_runs row has status failed does stdout print outputs and exit 0. ANY failed attempt row exits 1, even when a retry later succeeded or the runtime recovered the overall result. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat workflow test demo_flow --input '{}'
```

**Failure handling, verification and cleanup.** On failure prints request_id, user_error and failed-step errors to stderr, not success outputs. Inspect logs with that ID before deciding to rerun; repeating can duplicate writes. No automatic resource rollback.

## viat workflow update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat workflow update --file <FILE> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `PathBuf`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["file","name"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PATCHes the whole definition from --file, creating a new draft version. Published endpoints stay on old snapshots until publish.

**Actual output and exit.** stdout: updated &lt;name&gt; → vN and any pending-endpoint hint. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat workflow update demo_flow --file demo-workflow.yaml
```

**Failure handling, verification and cleanup.** Definition validation failures exit 1. Preserve previous YAML, verify show, test only with opt-in to real effects; restore previous definition to undo draft changes.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/workflow.rs:150–216`
- `crates/viat-api/src/handlers/workflows.rs`
