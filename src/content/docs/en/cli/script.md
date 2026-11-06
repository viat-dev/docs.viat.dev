---
title: "CLI: script"
description: "Complete Viat 1.1.0 script grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.script
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.script.build","cli.script.compile","cli.script.create","cli.script.delete","cli.script.env","cli.script.list","cli.script.logs","cli.script.run","cli.script.show","cli.script.test","cli.script.update","cli.script.upload"]
---

# CLI: script

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat script build](#viat-script-build)
- [viat script compile](#viat-script-compile)
- [viat script create](#viat-script-create)
- [viat script delete](#viat-script-delete)
- [viat script env](#viat-script-env)
- [viat script list](#viat-script-list)
- [viat script logs](#viat-script-logs)
- [viat script run](#viat-script-run)
- [viat script show](#viat-script-show)
- [viat script test](#viat-script-test)
- [viat script update](#viat-script-update)
- [viat script upload](#viat-script-upload)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

```python
# demo.py (also scripts/demo_echo.py in a repo checkout)
def main():
    return {"ok": True}
```

Create demo_echo with script create before show/update/run examples. Rust/binary examples additionally require your own matching SDK/executable, not this Python fixture; do not upload text as an executable. Offline tests need actual assertions under tests/; an empty suite is not coverage.

## viat script build

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script build [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `wait`: `--wait` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Poll until the install finishes instead of returning immediately |

Clap argument groups (literal metadata): `{"arguments":["name","wait"],"id":"Build","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Builds saved draft without publishing. Python/TypeScript warms dependency environment, reusing a single install; --wait polls. Rust compiles immediately; --wait is irrelevant. Binary reports manifest targets and locally held artifacts rather than compiling.

**Actual output and exit.** Text reports environment/build; without --wait an install can still be running at exit 0. --wait exits 1 on failed install/timeout. Rust failure prints source diagnostics and rendered rustc output, exits 1. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script build demo_echo --wait
```

**Failure handling, verification and cleanup.** Requires a server with build capability/toolchain/package access; can install/download dependencies, so opt in explicitly. Retry with build after fixing dependencies, verify env on each node. Cached artifacts/environments are not removed by a CLI undo.

## viat script compile

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script compile [OPTIONS] [NAME]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `all`: `--all` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Every rust script in the project, one after another — before switching traffic to a release that retired the artifacts. Skips those the deployment already has; exits 1 if any failed |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: all; help: Folder half of the script's identity, when the bare name is ambiguous |
| `force`: `--force` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Build even when the deployment already has this artifact |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help (see a summary with '-h') |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: all |
| `push`: `--push` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Upload the binary to the deployment's artifact store |
| `sdk_path`: `--sdk-path` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `VIAT_RUST_SDK_PATH, otherwise error` | — | help: The `viat` SDK crate the deployment was built with. Defaults to $VIAT_RUST_SDK_PATH |

Clap argument groups (literal metadata): `{"arguments":["all","folder","force","name","push","sdk_path"],"id":"Compile","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Local Rust-only compilation from server-provided exact crate and artifact key. Supply one name OR --all (published frozen programs, not drafts). --push uploads; default does not. --force bypasses already-present skip; SDK digest must match, from --sdk-path or VIAT_RUST_SDK_PATH.

**Actual output and exit.** Prints compilation/artifact/upload progress. --all continues across programs, reports failures and exits 1 if any failed. Existing artifact may yield a successful skip. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script compile demo_rust --sdk-path ./viat-sdk
```

**Failure handling, verification and cleanup.** Needs local cargo/rustup, matching SDK and server OS/architecture; compilation may fetch crates. Upload additionally needs server artifact-upload enablement; changed artifact key refuses. Retain source/build diagnostics; remove disposable local build output if desired, not shared caches blindly.

## viat script create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Write demo.py containing def main(): return {"ok": True} (put return on an indented line). No resources are used; server needs Python/uv to execute it later.

```text
Usage: viat script create --name <NAME> --language <LANGUAGE> --file <FILE>
```

**Command aliases:** `viat script new`

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `language`: `--language` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["file","language","name"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads UTF-8 --file and creates a draft. --name may be folder/name; --language is validated server-side. new is an alias. Creation does not publish or execute. Accepted languages: python, typescript, sql, graphql, shell, llm, viat_gql, rust, binary.

**Actual output and exit.** stdout: created &lt;name&gt; (v&lt;version&gt;). Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script create --name demo_echo --language python --file demo.py
```

**Failure handling, verification and cleanup.** Missing file/invalid language/duplicate name fails. Verify script show; delete the demo script after removing dependent fixtures/endpoints.

## viat script delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes a saved script draft; does not undo earlier executions or business-resource writes. Published dependency handling is separate from deleting the draft.

**Actual output and exit.** stdout: deleted &lt;name&gt;; 0 after successful DELETE. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script delete demo_echo
```

**Failure handling, verification and cleanup.** Inventory endpoint/workflow/schedule dependencies and save source first. Verify list and publish plan; recreate from saved source if needed. Do not assume deletion is a safe way to withdraw one published route: use endpoint unpublish for that.

## viat script env

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script env [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `probe`: `--probe` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Ask the package cache instead of reporting what is recorded |

Clap argument groups (literal metadata): `{"arguments":["json","name","probe"],"id":"Env","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GETs dependency-environment state on the answering instance; --probe checks its package cache rather than merely recorded state. Does not install or run the script. Plain reads require membership; --probe forks a probing process and additionally requires project Owner/Admin/Developer.

**Actual output and exit.** Text describes key, packages, state (ready/building/failed/not built), installer error and optional probe; --json returns raw state. A reported failed environment is information, not necessarily a CLI nonzero exit. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script env demo_echo --json
```

**Failure handling, verification and cleanup.** Query each node in a fleet; one response is not cluster readiness. Use script build to retry installation explicitly. Read/probe needs no undo.

## viat script list

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists current draft scripts across folders, not published snapshots.

**Actual output and exit.** Text: qualified path, language, v&lt;version&gt;; --json emits public script list. Empty list succeeds. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script list --json
```

**Failure handling, verification and cleanup.** Use qualified names to avoid ambiguity. Read-only; no cleanup.

## viat script logs

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script logs <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Logs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Resolves script first, then merges one page of endpoint-dispatch executions and draft test runs, newest first. Workflow-step executions belong to the workflow and are absent here.

**Actual output and exit.** stdout pretty {items:[...]}, or a no-executions explanation; stderr warns when either source reaches 50 rows. No --json flag: nonempty output is already JSON. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script logs demo_echo
```

**Failure handling, verification and cleanup.** For older runs or workflow steps use logs query/show and paginate. Missing script fails rather than returning a deceptive empty list. No remote mutation/cleanup.

## viat script run

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script run [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `args`: `--args` / `--input` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `{}` | — | help: JSON object of inputs. `--input` is accepted too — the workflow commands spell it that way, and the two were confused constantly |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `record`: `--record` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Record this run's http/graphql/cloud calls as cassettes under this directory (one `<resource>.yaml` each), for `viat script test` |

Clap argument groups (literal metadata): `{"arguments":["args","name","record"],"id":"Run","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Runs the live draft with JSON --args (runtime default {}). --input is an alias. Real resource calls and writes can occur; not offline. --record writes returned http/graphql/cloud cassettes after success.

**Actual output and exit.** Success prints pretty output on stdout and captured stderr on stderr; ok=false prints error and exits 1. Explicit ViatResponse/stream results have output=None: successful CLI output can be null, not an HTTP failure. Shell stdout is logs, not the result. The draft API does not return the full HTTP response envelope. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script run demo_echo --args '{}'
```

**Failure handling, verification and cleanup.** Review external side effects before running. Confirm request via logs; use a published/scratch endpoint to verify HTTP status/headers. Cassettes omit request credentials but can retain sensitive response bodies: review/delete generated files; CLI cannot undo external writes.

## viat script show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads saved draft source, including its version and dedicated-worker settings.

**Actual output and exit.** Text includes # name (language, vN), content, dedicated and dedicated_count; --json returns full public object. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script show demo_echo --json
```

**Failure handling, verification and cleanup.** 404/ambiguous name: select the right project and qualify folder. Source may contain accidental hard-coded secrets; protect captures. No mutation/cleanup.

## viat script test

**Prerequisites and permissions.** No existing platform login or selected project required; local filesystem/process access and the command-specific prerequisites below still apply. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script test [OPTIONS] [TARGETS]...
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Emit a machine-readable JSON summary (for CI) |
| `targets`: `<TARGETS> (#1)` | `String`, 1..∞, `Append` | no; conditional requirements below; no explicit Clap default ; runtime: `tests/; Rust discovery scripts/ when no explicit targets` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","targets"],"id":"Test","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Runs local Python pytest via uv, TypeScript via bun test, and discovered Rust in-file tests. Default discovery uses tests/ and scripts/ for Rust. Uses matching-version viat-test-host with fake resources, not the signed-in server. User test code itself is not a network sandbox.

**Actual output and exit.** Streams runner output; --json captures a machine report with runner diagnostics on stderr. Propagates the aggregated nonzero test status. Missing prerequisites fail; no tests can print no tests found without proving coverage. When no tests at all are discovered it explicitly exits 0 (no tests found), unlike endpoint test which fails on an empty fixture set. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script test --json
```

**Failure handling, verification and cleanup.** Install uv/bun/cargo only for tested languages plus matching host (VIAT_TEST_HOST_BIN override). TypeScript temporarily injects node_modules/viat and cleans it afterward. Inspect fixtures for external calls; remove generated local reports after review.

## viat script update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script update [OPTIONS] <NAME>
```

**Command aliases:** `viat script edit`

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `dedicated`: `--dedicated` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `dedicated_count`: `--dedicated-count` | `i32`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `file`: `--file` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `no_dedicated`: `--no-dedicated` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | conflict IDs: dedicated |

Clap argument groups (literal metadata): `{"arguments":["dedicated","dedicated_count","file","name","no_dedicated"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Partial PATCH; requires at least one of --file/--dedicated/--no-dedicated/--dedicated-count before loading config. edit aliases update. Only supplied fields change; saved draft advances, not published snapshot.

**Actual output and exit.** stdout: updated &lt;name&gt; → vN plus pending-endpoint hint when present. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script update demo_echo --file demo.py
```

**Failure handling, verification and cleanup.** Conflicting dedicated flags/invalid count/file fail. Save old source/settings, verify show, then intentionally publish; restore saved draft and republish to undo a shipped change.

## viat script upload

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat script upload [OPTIONS] --binary <BINARY> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `binary`: `--binary` | `PathBuf`, 1, `Set` | yes; no explicit Clap default | — | help: The executable |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Folder half of the script's identity, when the bare name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `target`: `--target` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `CLI machine OS/architecture` | — | help: `<os>/<arch>` it was built for; defaults to this machine's |

Clap argument groups (literal metadata): `{"arguments":["binary","folder","name","target"],"id":"Upload","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Binary-language only: reads nonempty executable, uploads bytes with update_manifest=1, then server records digest as a new draft revision. --target defaults to current CLI machine OS/arch, not remote detection; --folder disambiguates.

**Actual output and exit.** Prints byte count, target, digest, manifest revision change or unchanged, and pending endpoint list. Does not publish. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat script upload demo_binary --binary ./demo-worker --target linux/x86_64
```

**Failure handling, verification and cleanup.** Requires server upload enabled, compatible executable format and a binary manifest script. Wrong language/empty file/unsupported target fails. Inspect script show/build, publish intentionally; restore previous manifest and artifact for rollback (bytes are not retrieved by show).

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/script.rs`
- `crates/viat-api/src/handlers/scripts.rs`
- `crates/viat-api/src/handlers/rust_artifact.rs`
