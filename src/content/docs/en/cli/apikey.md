---
title: "CLI: apikey"
description: "Complete Viat 1.1.0 apikey grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.apikey
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.apikey.create","cli.apikey.list","cli.apikey.revoke"]
---

# CLI: apikey

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat apikey create](#viat-apikey-create)
- [viat apikey list](#viat-apikey-list)
- [viat apikey revoke](#viat-apikey-revoke)

## viat apikey create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat apikey create [OPTIONS] --user <USER> --name <NAME> <AUTHORIZER>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `authorizer`: `<AUTHORIZER> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `expires`: `--expires` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `user`: `--user` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["authorizer","expires","name","user"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Looks up the exact project-user identity (--user) then mints a key under an api_key authorizer. --expires is an absolute server timestamp, not a humantime TTL. Not a platform PAT.

**Actual output and exit.** stdout: only the full one-time vsk_<key_id>.&lt;secret&gt; line; stderr: row UUID/key_id/last4 summary. Secret cannot be read back. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat apikey create demo_keys --user demo_user --name demo-client
```

**Failure handling, verification and cleanup.** Missing identity/wrong authorizer/invalid expiry fails. Capture securely, do not paste into docs; list then revoke by row UUID to clean up. Lost output requires revoke and remint.

## viat apikey list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat apikey list <AUTHORIZER>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `authorizer`: `<AUTHORIZER> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

Clap argument groups (literal metadata): `{"arguments":["authorizer"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists API-key metadata for this api_key authorizer, not the account’s PATs.

**Actual output and exit.** Text columns include UUID, short key_id, name, last4, revoked/active, created. No secret and no --json option. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat apikey list demo_keys
```

**Failure handling, verification and cleanup.** Wrong authorizer kind fails. Copy the first UUID column for revoke, not the short key_id. Read-only; no cleanup.

## viat apikey revoke

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat apikey revoke <AUTHORIZER> <KEY_ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `authorizer`: `<AUTHORIZER> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `key_id`: `<KEY_ID> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["authorizer","key_id"],"id":"Revoke","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Revokes one API-key row under the given authorizer. The positional key_id name is misleading: it must be the row UUID, not the 12-character key_id in the token.

**Actual output and exit.** stdout: revoked api_key id=&lt;UUID&gt; at=&lt;time&gt;. Future authorization with this key is denied. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat apikey revoke demo_keys 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Use apikey list to get UUID. No un-revoke CLI: mint a replacement and update consumers; verify list revoked timestamp/status.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/apikey.rs`
- `crates/viat-api/src/handlers/api_keys.rs`
