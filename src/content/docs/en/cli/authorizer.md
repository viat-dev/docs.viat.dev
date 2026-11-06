---
title: "CLI: authorizer"
description: "Complete Viat 1.1.0 authorizer grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.authorizer
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.authorizer.create","cli.authorizer.delete","cli.authorizer.list","cli.authorizer.show","cli.authorizer.update"]
---

# CLI: authorizer

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat authorizer create](#viat-authorizer-create)
- [viat authorizer delete](#viat-authorizer-delete)
- [viat authorizer list](#viat-authorizer-list)
- [viat authorizer show](#viat-authorizer-show)
- [viat authorizer update](#viat-authorizer-update)

## viat authorizer create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authorizer create [OPTIONS] --name <NAME> --kind <KIND>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `default_role`: `--default-role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `kind`: `--kind` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["default_role","kind","name"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates name/kind/default_role with config={}. This leaf has no config/secret input, so jwt/oauth_oidc/social kinds needing config cannot be fully configured here; use console/API or supported repo declarations. anonymous/password/api_key can use optional defaults.

**Actual output and exit.** stdout: created authorizer &lt;name&gt; (&lt;kind&gt;). No user, key or token is minted. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authorizer create --name demo_password --kind password
```

**Failure handling, verification and cleanup.** Bad kind/default role or required config fails. Verify show; delete demo authorizer only after unbinding endpoints and reviewing cascading API-key loss.

## viat authorizer delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authorizer delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes the project authorizer; api_key keys belong to it and cascade. Endpoint authentication depending on it can break.

**Actual output and exit.** stdout: deleted &lt;name&gt;; success 0. This is not token revoke for a single key. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authorizer delete demo_password
```

**Failure handling, verification and cleanup.** Inventory bindings/keys first. Deleted key secrets/provider secrets cannot be recovered from pull/show; recreate config and distribute replacement keys explicitly. Verify absence via list.

## viat authorizer list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authorizer list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists the selected project’s authorizers, not platform login providers; read is editor-gated.

**Actual output and exit.** Text: name, kind, default-role UUID or -; --json gives public rows/config, never stored provider secrets. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authorizer list --json
```

**Failure handling, verification and cleanup.** No rows is success. Default-role UUIDs are not role names: use role list/show to resolve. No changes/cleanup.

## viat authorizer show

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authorizer show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads one project authorizer’s public definition.

**Actual output and exit.** Text: name, kind, default-role UUID or -; --json also shows public configuration. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authorizer show demo_password --json
```

**Failure handling, verification and cleanup.** Unknown name fails. Save public config before changes but keep original provider secret separately; show cannot recover it. Reading needs no cleanup.

## viat authorizer update

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat authorizer update [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `clear_default_role`: `--clear-default-role` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Remove the default role |
| `default_role`: `--default-role` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: clear_default_role; help: The role every caller this authorizer admits gets |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["clear_default_role","default_role","name"],"id":"Update","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Requires --default-role or --clear-default-role; PUT sends only default_role (empty string clears), preserving kind/config/provider secret. Cannot change kind or configure OIDC/JWT here.

**Actual output and exit.** stdout: updated authorizer &lt;name&gt; (&lt;kind&gt;): default_role &lt;role-or-none&gt;. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat authorizer update demo_password --clear-default-role
```

**Failure handling, verification and cleanup.** No flag/unknown role fails. Record previous role name and restore with update; clear explicitly rather than omitting. Verify show, and review effects on newly resolved client identities.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/authorizer.rs`
- `crates/viat-api/src/handlers/authorizers.rs`
