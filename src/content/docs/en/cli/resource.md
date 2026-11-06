---
title: "CLI: resource"
description: "Complete Viat 1.1.0 resource grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.resource
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.resource.create","cli.resource.delete","cli.resource.edit","cli.resource.list","cli.resource.refresh","cli.resource.set-field","cli.resource.set-secret","cli.resource.show","cli.resource.test"]
---

# CLI: resource

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat resource create](#viat-resource-create)
- [viat resource delete](#viat-resource-delete)
- [viat resource edit](#viat-resource-edit)
- [viat resource list](#viat-resource-list)
- [viat resource refresh](#viat-resource-refresh)
- [viat resource set-field](#viat-resource-set-field)
- [viat resource set-secret](#viat-resource-set-secret)
- [viat resource show](#viat-resource-show)
- [viat resource test](#viat-resource-test)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

```json
{"name":"demo_config","kind":"config","plain":{"data":{"enabled":true}},"secret":{}}
```

Save as demo-resource.yaml (JSON is valid YAML). The set-secret example needs a separate secret-kind demo_secret: {"name":"demo_secret","kind":"secret","plain":{},"secret":{"value":"demo-only"}}. demo_db is your own provisioned isolated database; these examples do not create it.

## viat resource create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Create demo-resource.yaml with {"name":"demo_config","kind":"config","plain":{"data":{"enabled":true}},"secret":{}}. JSON is valid YAML; this fixture needs no provider.

```text
Usage: viat resource create --file <FILE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

Clap argument groups (literal metadata): `{"arguments":["file"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads --file as YAML/JSON and POSTs the resulting object: name, optional folder, kind, complete plain and secret. No repo placeholder stripping here. Config example needs plain.data, not a top-level data key.

**Actual output and exit.** stdout: created &lt;name&gt;; 0 after save. Kind validation and, for PostgreSQL audit configuration, DDL installation can occur on save. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource create --file demo-resource.yaml
```

**Failure handling, verification and cleanup.** Malformed YAML, reserved system name, duplicate identity or missing kind-specific credentials fails. Verify resource show; delete demo_config when unused. Do not expect a failed later step to undo an upstream schema change.

## viat resource delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource delete <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** DELETEs the resource definition; does not mean delete its upstream database/bucket. Runtime consumers can break immediately.

**Actual output and exit.** stdout: deleted &lt;name&gt;; 0 after successful DELETE. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource delete demo_config
```

**Failure handling, verification and cleanup.** 409 resource_in_use names endpoint bindings to rebind/delete first. Inventory scripts and saved configuration, then remove only a disposable resource; recreation needs original credentials, which show/pull never recover.

## viat resource edit

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource edit --file <FILE> <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `file`: `--file` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["file","name"],"id":"Edit","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Full PUT replacement, not a merge: supply kind, complete plain and all secrets that must remain. Direct YAML is not the pull/push placeholder format.

**Actual output and exit.** stdout: updated &lt;name&gt;; immediate resource changes can affect runtime calls without endpoint publish. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource edit demo_config --file demo-resource.yaml
```

**Failure handling, verification and cleanup.** Never reconstruct secrets from show masks. For one-field rotation use set-secret; for plain use set-field. Back up original full settings securely before replace, then show/test as appropriate; restore with a complete trusted file.

## viat resource list

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists all resource folders in the selected project. Does not connect to upstream services.

**Actual output and exit.** Text: qualified path, kind and plain JSON; --json emits public rows (secret summaries, never secret values). Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource list --json
```

**Failure handling, verification and cleanup.** Plain may contain sensitive non-secret settings: handle captured output carefully. Verify names here before edits; no cleanup.

## viat resource refresh

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource refresh <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Refresh","multiple":true,"required":false}`

**Inputs, behavior and side effects.** POST /schema/refresh invalidates schema caches across instances for reread on next use; no migration/DDL is run.

**Actual output and exit.** stdout: refreshed &lt;name&gt;: every instance re-reads the schema on its next use. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource refresh demo_db
```

**Failure handling, verification and cleanup.** After DDL, also republish CRUD endpoints whose resolved columns were frozen. Unsupported kind/missing resource fails; use show first. Cache invalidation needs no undo and cannot repair schema itself.

## viat resource set-field

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource set-field [OPTIONS] <NAME> <FIELD>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `field`: `<FIELD> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `file`: `--file` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Read the new value from a file (for multi-line values like an overlay document) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Parse the value as JSON instead of storing it as a string |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `value`: `--value` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: file; help: The new value, as a string |

Clap argument groups (literal metadata): `{"arguments":["field","file","json","name","value"],"id":"SetField","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Requires exactly one of --value or --file at runtime. Default stores a string; --json parses JSON (it is NOT output-format mode). Reads plain, changes one key, PATCHes the whole plain object, then checks returned field presence. --json --value null removes a set optional field.

**Actual output and exit.** stdout: set or removed &lt;name&gt;.&lt;field&gt;. Unknown/dropped fields fail after the write attempt; normalization may change the value. Removing PostgreSQL audit drops triggers but retains its trail table. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource set-field demo_config data --json --value '{"enabled":false}'
```

**Failure handling, verification and cleanup.** Use resource show to inspect before/after and preserve the old field for rollback; concurrent edits can be overwritten because plain is read-modify-write. Wrong JSON/type fails; do not retry on the assumption that no write happened.

## viat resource set-secret

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. An existing secret-kind resource demo_secret. Example shell: printf %s demo-only | viat resource set-secret demo_secret value. The argv manifest stores only the CLI tokens; stdin is separate.

```text
Usage: viat resource set-secret <NAME> <FIELD>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `field`: `<FIELD> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help (see a summary with '-h') |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["field","name"],"id":"SetSecret","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GETs the existing kind, validates field against its declared secret names, then reads stdin. Refuses terminal input, empty input and unknown fields; strips trailing CR/LF. PATCH overlays only this secret field.

**Actual output and exit.** stdout: set &lt;name&gt;.&lt;field&gt;; never echoes the secret or length. Existing unrelated fields remain. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource set-secret demo_secret value
```

**Failure handling, verification and cleanup.** Use a protected file or printf pipe, not argv. It cannot create a missing resource. Verify with a deliberately authorized connectivity check; old secret is not recoverable, so retain a secure rollback credential until rotation is confirmed.

## viat resource show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource show [OPTIONS] <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","name"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Resolves a folder-qualified resource, then reads public data only.

**Actual output and exit.** Text: name (kind) and pretty plain; --json also exposes public metadata/secret mask, not credentials. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource show demo_config --json
```

**Failure handling, verification and cleanup.** Missing/ambiguous reference fails: copy the qualified name from resource list. A *** mask is not a value to feed edit. No mutation or cleanup.

## viat resource test

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat resource test <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `name`: `<NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["name"],"id":"Test","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Calls the platform’s kind-specific connectivity/key probe; can contact real providers. http_api GETs base_url with its credentials: transport errors/5xx fail, but 401/404/405 can pass (reachability, not authorization). Database/broker/mail/cloud handshakes authenticate; crypto_key tests local cryptography.

**Actual output and exit.** stdout ok or fail: &lt;error&gt;; false ok exits 1. Passing schema warnings go to stderr and leave exit 0; invalid authz_tables bindings can fail. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat resource test demo_config
```

**Failure handling, verification and cleanup.** Do not run without upstream opt-in. Check credentials/schema and warnings, not just exit 0. No provider rollback is promised; this is not a script run or a notification delivery guarantee.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/resource.rs`
- `crates/viat-cli/src/repo/resources.rs`
- `crates/viat-api/src/handlers/resources.rs`
