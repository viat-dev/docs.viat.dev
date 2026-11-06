---
title: "CLI: schedule"
description: "Complete Viat 1.1.0 schedule grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.schedule
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.schedule.create","cli.schedule.delete","cli.schedule.list","cli.schedule.pause","cli.schedule.resume","cli.schedule.show","cli.schedule.trigger","cli.schedule.update"]
---

# CLI: schedule

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat schedule create](#viat-schedule-create)
- [viat schedule delete](#viat-schedule-delete)
- [viat schedule list](#viat-schedule-list)
- [viat schedule pause](#viat-schedule-pause)
- [viat schedule resume](#viat-schedule-resume)
- [viat schedule show](#viat-schedule-show)
- [viat schedule trigger](#viat-schedule-trigger)
- [viat schedule update](#viat-schedule-update)

## viat schedule create

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule create [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `cron`: `--cron` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: every_secs |
| `disabled`: `--disabled` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `every_secs`: `--every-secs` | `i64`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: cron |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `inputs`: `--inputs` | `String`, 1, `Set` | no; conditional requirements below; `{}` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `script`: `--script` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: workflow |
| `workflow`: `--workflow` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: script |

Clap argument groups (literal metadata): `{"arguments":["cron","disabled","every_secs","inputs","name","script","workflow"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates a schedule: exactly one --cron/--every-secs AND exactly one --script/--workflow are required at runtime. --inputs must be a JSON object. Defaults enabled=true and inputs={}; --disabled saves paused. No per-schedule timezone/retry/endpoint-target flags are exposed here.

**Actual output and exit.** stdout: created &lt;name&gt;. An enabled schedule can subsequently execute real target side effects; saving is not a draft/publish flow. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule create demo_tick --every-secs 3600 --script demo_echo --disabled
```

**Failure handling, verification and cleanup.** Invalid trigger, missing target, nonobject inputs or target absence fails. Unlike content editing, these API mutations require only membership in this version. Verify schedule show; pause/delete demo_tick when done. For update preserve the entire previous trigger/target/inputs/enabled state before replacement.

## viat schedule delete

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes scheduling configuration, not previously emitted executions or target scripts/workflows.

**Actual output and exit.** stdout: deleted &lt;name&gt;; DELETE handles the server’s empty 204 response. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule delete demo_tick
```

**Failure handling, verification and cleanup.** Missing name fails. Verify list; recreate from saved full schedule if required. Deletion cannot recall a running job.

## viat schedule list

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads saved operational schedules, not repo YAML or publish snapshots.

**Actual output and exit.** Text: name, active/paused, trigger, target, next_due; --json returns rows. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule list --json
```

**Failure handling, verification and cleanup.** No selected project/permission causes failure. Empty list is success, not scheduler health proof. Read-only; no cleanup.

## viat schedule pause

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule pause <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Pause","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Disables future automatic scheduling; does not cancel an already-running execution.

**Actual output and exit.** stdout: paused &lt;name&gt;; server returns changed row. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule pause demo_tick
```

**Failure handling, verification and cleanup.** Missing schedule fails. Verify show status paused; resume restores scheduling but recomputes next_due rather than old due time.

## viat schedule resume

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule resume <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Resume","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Enables the schedule and recomputes cron/interval next_due relative to now, using the stored zone. CLI cannot create once schedules, whose API resume semantics differ.

**Actual output and exit.** stdout: resumed &lt;name&gt; (next_due now: &lt;timestamp&gt;). Automatic real executions may follow. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule resume demo_tick
```

**Failure handling, verification and cleanup.** Check show next_due and inputs before resuming. Pause again to stop future runs; past/in-flight side effects are not reversed.

## viat schedule show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads one schedule including inputs, enabled state and execution pointers.

**Actual output and exit.** Text: name, status, trigger, target, inputs, next_due, last_fired, last_run; --json gives full object. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule show demo_tick --json
```

**Failure handling, verification and cleanup.** 404 is not a paused schedule: check list. Follow last_run into execution logs to verify effects, not just next_due. No mutation/cleanup.

## viat schedule trigger

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule trigger <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Trigger","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Fires the saved target once manually, separately from the schedule’s future due time; can execute real effects even when used for diagnostics.

**Actual output and exit.** stdout contains the bare request_id only. Exit 0 reports accepted trigger response, not necessarily eventual runtime success. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule trigger demo_tick
```

**Failure handling, verification and cleanup.** Use logs show <request_id> to inspect completion before retrying. Do not retry blindly after connection loss; repeated triggers can duplicate mutations. No automatic undo.

## viat schedule update

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat schedule update [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `cron`: `--cron` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: every_secs |
| `disabled`: `--disabled` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `every_secs`: `--every-secs` | `i64`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: cron |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `inputs`: `--inputs` | `String`, 1, `Set` | no; conditional requirements below; `{}` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `script`: `--script` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: workflow |
| `workflow`: `--workflow` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: script |

Clap argument groups (literal metadata): `{"arguments":["cron","disabled","every_secs","inputs","name","script","workflow"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Full PUT upsert, not a partial patch: exactly one --cron/--every-secs AND exactly one --script/--workflow are required at runtime. --inputs must be a JSON object. Defaults enabled=true and inputs={}; --disabled saves paused. No per-schedule timezone/retry/endpoint-target flags are exposed here.

**Actual output and exit.** stdout: updated &lt;name&gt;. An enabled schedule can subsequently execute real target side effects; saving is not a draft/publish flow. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat schedule update demo_tick --every-secs 3600 --script demo_echo --disabled
```

**Failure handling, verification and cleanup.** Invalid trigger, missing target, nonobject inputs or target absence fails. Unlike content editing, these API mutations require only membership in this version. Verify schedule show; pause/delete demo_tick when done. For update preserve the entire previous trigger/target/inputs/enabled state before replacement.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/schedule.rs`
- `crates/viat-api/src/handlers/schedules.rs`
