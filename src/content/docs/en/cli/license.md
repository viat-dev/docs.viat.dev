---
title: "CLI: license"
description: "Complete Viat 1.1.0 license grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.license
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.license.activate","cli.license.show"]
---

# CLI: license

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat license activate](#viat-license-activate)
- [viat license show](#viat-license-show)

## viat license activate

**Prerequisites and permissions.** Platform Admin/Owner; project role does not grant this platform permission. Supply an actually valid customer code via a protected stdin source only after explicit activation authorization. argv syntax can be checked without a code; this example is not an issued code or a runnable successful activation fixture.

```text
Usage: viat license activate [OPTIONS] <CODE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `code`: `<CODE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["code","json"],"id":"Activate","multiple":true,"required":false}`

**Inputs, behavior and side effects.** POST /license/activate verifies a legitimate code against this official server image’s embedded verification key. CODE=- reads stdin and trims whitespace; no project needed. This is customer activation, not vendor key/code issuance.

**Actual output and exit.** Text: activated. then license status; --json emits status. Accepted code updates deployment activation state. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat license activate -
```

**Failure handling, verification and cleanup.** Empty/malformed/bad-signature/expired/incompatible codes fail. Do not invent or generate a vendor signing key. Obtain the correct valid code, verify license show afterward; no CLI deactivate/revoke exists. Never publish a real code.

## viat license show

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat license show [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GET /license reads deployment activation status without selecting a project; route remains accessible while deployment is unactivated.

**Actual output and exit.** Text status/customer/expiry/activation/license ID when present, or NOT ACTIVATED; --json raw status. An unactivated status is successful read (exit 0). Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat license show --json
```

**Failure handling, verification and cleanup.** A 403 license_required on other commands is not solved by project role changes. Obtain a valid code through your authorized supplier; no mutation/cleanup.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/license.rs`
- `crates/viat-api/src/handlers/license.rs`
