---
title: "CLI: testcase"
description: "Complete Viat 1.1.0 testcase grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.testcase
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.testcase.create","cli.testcase.delete","cli.testcase.disable","cli.testcase.enable","cli.testcase.list","cli.testcase.run","cli.testcase.show","cli.testcase.update"]
---

# CLI: testcase

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat testcase create](#viat-testcase-create)
- [viat testcase delete](#viat-testcase-delete)
- [viat testcase disable](#viat-testcase-disable)
- [viat testcase enable](#viat-testcase-enable)
- [viat testcase list](#viat-testcase-list)
- [viat testcase run](#viat-testcase-run)
- [viat testcase show](#viat-testcase-show)
- [viat testcase update](#viat-testcase-update)

## viat testcase create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase create [OPTIONS] --expected <EXPECTED> <TARGET> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `args`: `--args` | `String`, 1, `Set` | no; conditional requirements below; `{}` | — | help: Arguments to send, as a JSON object |
| `expected`: `--expected` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: Expected output, as JSON |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `kind`: `--kind` | `String`, 1, `Set` | no; conditional requirements below; `script` | — | help: Target kind: script &#124; workflow |
| `match`: `--match` | `String`, 1, `Set` | no; conditional requirements below; `subset` | — | help: Match mode: subset (expected keys must appear) or exact |
| `name`: `<NAME> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: A name for this case, unique per target |
| `target`: `<TARGET> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: Target name (folder-qualified) |

Clap argument groups (literal metadata): `{"arguments":["args","expected","json","kind","match","name","target"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Stores target/name/args/expected and subset or exact matching. --args must be an object; expected is JSON, not a file path. Enabled cases gate future publish apply and run the live target, not offline fakes. Saving does not run the target now.

**Actual output and exit.** Text: created test case &lt;name&gt; (UUID); --json prints created case. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase create demo_echo demo_ok --expected '{"ok":true}' --json
```

**Failure handling, verification and cleanup.** Bad JSON/match, duplicate case or invalid target fails. Save returned UUID, show it, then explicitly opt in to testcase run. Cleanup testcase delete &lt;id&gt;; disabling retains data but stops the gate.

## viat testcase delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase delete [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id","json"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Removes one saved regression case and therefore its future publish gate; does not delete the target or run history.

**Actual output and exit.** Text: deleted test case &lt;id&gt;; --json emits server response. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase delete 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Keep show output for rollback; missing ID fails. Verify list; recreate with original args/expected/match and restore enabled state (new UUID).

## viat testcase disable

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase disable [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id","json"],"id":"Disable","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Disables this saved case as a publish regression gate. Does not run it and does not remove expected/args.

**Actual output and exit.** Text: disabled test case &lt;id&gt;; --json emits updated row. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase disable 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Missing UUID fails. Verify testcase show; enable reverses the toggle. A disabled guard can let a bad publish through; record why it is disabled.

## viat testcase enable

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase enable [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id","json"],"id":"Enable","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Enables this saved case as a publish regression gate. Does not run it and does not remove expected/args.

**Actual output and exit.** Text: enabled test case &lt;id&gt;; --json emits updated row. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase enable 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Missing UUID fails. Verify testcase show; disable reverses the toggle. Future publish can now execute this live target, so review its effects first.

## viat testcase list

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase list [OPTIONS] <TARGET>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `kind`: `--kind` | `String`, 1, `Set` | no; conditional requirements below; `script` | — | help: Target kind: script &#124; workflow |
| `target`: `<TARGET> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: Target name (folder-qualified, e.g. `lab/ingress`) |

Clap argument groups (literal metadata): `{"arguments":["json","kind","target"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists saved regression cases for one folder-qualified script/workflow target; --kind defaults to script.

**Actual output and exit.** Text shows count, on/off, case name, UUID and match mode; --json emits array. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase list demo_echo --json
```

**Failure handling, verification and cleanup.** These reads do not execute the target or validate current output. Missing case/invalid kind fails. No remote mutation; treat captured args/output as potentially sensitive.

## viat testcase run

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase run [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id","json"],"id":"Run","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Runs the case now against live draft target and real resources; this is not script test or endpoint test.

**Actual output and exit.** Text PASS/FAIL/ERROR/SKIPPED plus mismatch paths; --json emits outcome. Only outcome passed exits 0; skipped, failed, errored or any other outcome exits 1. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase run 00000000-0000-4000-8000-000000000001 --json
```

**Failure handling, verification and cleanup.** Inspect mismatch vs runtime error before updating expected. Re-running can repeat business writes; no automatic undo. Use isolated resource fixtures and clean their data with explicit opt-in.

## viat testcase show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase show [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id","json"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads a saved regression case by UUID, including exact stored args and expected output.

**Actual output and exit.** Text shows name, target, enabled, match, args and expected; --json emits object. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase show 00000000-0000-4000-8000-000000000001 --json
```

**Failure handling, verification and cleanup.** These reads do not execute the target or validate current output. Missing case/invalid kind fails. No remote mutation; treat captured args/output as potentially sensitive.

## viat testcase update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat testcase update [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `args`: `--args` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: New arguments, as a JSON object |
| `expected`: `--expected` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: New expected output, as JSON |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `match`: `--match` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: New match mode: subset &#124; exact |
| `name`: `--name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: New name (unique per target) |

Clap argument groups (literal metadata): `{"arguments":["args","expected","id","json","match","name"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Partial PUT sends only supplied --name/--args/--expected/--match. At least one is required. Does not change target binding or run it.

**Actual output and exit.** Text: updated test case &lt;id&gt;; --json returns updated object. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat testcase update 00000000-0000-4000-8000-000000000001 --expected '{"ok":true}'
```

**Failure handling, verification and cleanup.** Invalid JSON/match/no flags fails; preserve previous expected/args so a mistaken change does not weaken the gate. Verify show; restore those values with update to undo.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/test_case.rs`
- `crates/viat-api/src/handlers/test_cases.rs`
