---
title: "CLI: endpoint"
description: "Complete Viat 1.1.0 endpoint grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.endpoint
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.endpoint.create","cli.endpoint.delete","cli.endpoint.history","cli.endpoint.list","cli.endpoint.publish","cli.endpoint.purge-cache","cli.endpoint.rollback","cli.endpoint.show","cli.endpoint.test","cli.endpoint.unpublish","cli.endpoint.update-auth","cli.endpoint.update-info"]
---

# CLI: endpoint

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat endpoint create](#viat-endpoint-create)
- [viat endpoint delete](#viat-endpoint-delete)
- [viat endpoint history](#viat-endpoint-history)
- [viat endpoint list](#viat-endpoint-list)
- [viat endpoint publish](#viat-endpoint-publish)
- [viat endpoint purge-cache](#viat-endpoint-purge-cache)
- [viat endpoint rollback](#viat-endpoint-rollback)
- [viat endpoint show](#viat-endpoint-show)
- [viat endpoint test](#viat-endpoint-test)
- [viat endpoint unpublish](#viat-endpoint-unpublish)
- [viat endpoint update-auth](#viat-endpoint-update-auth)
- [viat endpoint update-info](#viat-endpoint-update-info)

## viat endpoint create

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint create [OPTIONS] --segment <SEGMENT>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `authorizers`: `--authorizers` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `method`: `--method` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `override_authorizers`: `--override-authorizers` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `override_permissions`: `--override-permissions` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `parent`: `--parent` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `script`: `--script` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `segment`: `--segment` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `tree`: `--tree` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `workflow`: `--workflow` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: script |

Clap argument groups (literal metadata): `{"arguments":["authorizers","method","override_authorizers","override_permissions","parent","script","segment","tree","workflow"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Creates a draft branch or leaf with --segment, optional parent/tree, method and script/workflow binding. --tree resolves UUID/name. --authorizers repeats one name per flag; commas are not split by this command. It cannot express CRUD/proxy/authz-gate configuration through this leaf; use repo/console API instead.

**Actual output and exit.** stdout: created &lt;method-or-DIR&gt; &lt;path&gt;, then id: &lt;UUID&gt;. No published route is activated. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint create --segment demo --method GET --script demo_echo
```

**Failure handling, verification and cleanup.** Reserved platform paths, invalid parent/segment/target combinations and missing tree fail. Verify list/show and publish intentionally. Delete the disposable leaf by returned ID to clean up.

## viat endpoint delete

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint delete <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id"],"id":"Delete","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Deletes a node; branch deletion cascades descendants and can remove their active routes. Not merely an unpublish operation. Built-in auth nodes are protected.

**Actual output and exit.** stdout: deleted &lt;id&gt;; 0 after successful DELETE. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint delete 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Back up repo/definitions and inspect descendants first. Verify endpoint list and routing; recreation requires new nodes and deliberate publish, not a simple rollback of this deletion.

## viat endpoint history

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint history <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id"],"id":"History","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads snapshot history for one endpoint. Unlike project publish history, this read requires publisher rights.

**Actual output and exit.** Text rows: vN, method (or *), path and script/workflow@version when present. No --json option. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint history 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Missing/nonleaf UUID fails. Use this to verify publish/rollback versions; no mutations or cleanup.

## viat endpoint list

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists draft endpoint nodes, not a runtime request. Text is a narrowed view; use --json for IDs and publish-status metadata.

**Actual output and exit.** Text: method/DIR, path, script binding, authorizer names/inherit and type.action gates/inherit (not UUIDs). --json gives full list. This read requires editor, unlike script list. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint list --json
```

**Failure handling, verification and cleanup.** Missing access fails even if other project reads work. Use returned UUIDs in endpoint commands; no mutation or cleanup.

## viat endpoint publish

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint publish [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `acknowledge_test_failures`: `--acknowledge-test-failures` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Publish even if enabled test cases (the server regression gate) fail |
| `acknowledge_warnings`: `--acknowledge-warnings` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Publish even if the server reports warnings (they are recorded on the revision); without it a warning refuses the publish |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["acknowledge_test_failures","acknowledge_warnings","id"],"id":"Publish","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Publishes this leaf’s draft snapshot and builds dependencies. Warning/regression refusals are overridden only by respective --acknowledge-* flags; no confirmation prompt. Changes served routing.

**Actual output and exit.** Prints published METHOD path as vN, build ok/FAILED and optional environment-pending note. A successful publish response containing failed builds is still CLI exit 0: inspect lines, not only exit code. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint publish 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Warnings/tests refuse with HTTP errors; fix or explicitly acknowledge after review. Test cases can call real resources. Verify history and an authorized route request; rollback restores prior snapshot but does not undo external test/build effects.

## viat endpoint purge-cache

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint purge-cache <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id"],"id":"PurgeCache","multiple":true,"required":false}`

**Inputs, behavior and side effects.** POSTs cache/purge to invalidate this endpoint’s cached responses on all instances; does not delete the endpoint or change its cache configuration.

**Actual output and exit.** stdout: purged the cached responses of &lt;id&gt;. Subsequent matching GETs can hit runtime again. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint purge-cache 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Requires existing endpoint and publisher, not just editor. Verify with authorized requests/cache telemetry; no inverse cache-fill operation and no undo for runtime effects triggered afterward.

## viat endpoint rollback

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint rollback <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id"],"id":"Rollback","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Restores the preceding endpoint snapshot, not an arbitrary version argument. Does not restore current draft or rewind external databases.

**Actual output and exit.** stdout: rolled back to vN (&lt;snapshot-id&gt;); immediately changes served route content. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint rollback 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** No earlier snapshot/nonleaf/missing endpoint fails. Read history before and after; a later publish uses the current draft, so inspect it before reapplying.

## viat endpoint show

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint show [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["id","json"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads a draft node by UUID and its effective configuration; UUID is not a route path or script name.

**Actual output and exit.** Default text is pretty JSON of the narrowed EndpointView (id,parent,segment,method,script,path,authorizers,gates,override flags); --json emits the raw full server object, including additional target/publish fields. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint show 00000000-0000-4000-8000-000000000001 --json
```

**Failure handling, verification and cleanup.** Wrong project or nonexistent UUID fails. Capture before edits; show is not proof that current callers serve the draft. No cleanup.

## viat endpoint test

**Prerequisites and permissions.** A selected project slug in the resolved CLI config and a local repo root are REQUIRED, but no usable platform session/server is needed; execution uses the scratch host and dedicated PostgreSQL base URL. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint test [DIR]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `dir`: `<DIR> (#1)` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `endpoint_tests/` | — | help: Directory of `*.yaml` fixtures (default: `endpoint_tests/`) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

Clap argument groups (literal metadata): `{"arguments":["dir"],"id":"Test","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Runs endpoint fixtures (default endpoint_tests/) through a scratch instance’s real dispatch with fake resources. Seeds/pushes/publishes this local repo in the scratch server. Requires a dedicated base PostgreSQL URL in VIAT_ENDPOINT_TEST_DB and matching viat-endpoint-test-host. Not the signed-in server.

**Actual output and exit.** Text: ok/FAIL per fixture then N passed, N failed. Any failed fixture exits 1. Missing directory or zero discovered YAML/YML fixtures is an error (not an empty green run). Host version is checked before dispatch; scratch publish explicitly acknowledges warnings and saved regression-case failures. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint test endpoint_tests
```

**Failure handling, verification and cleanup.** Creates then drops a scratch database; use an isolated PostgreSQL account allowed to create/drop databases, never production. Check host diagnostics if startup/cleanup fails; remove only the named scratch DB after confirming no process uses it. Test code itself still needs review for external calls.

## viat endpoint unpublish

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin; Developer/Operator cannot publish. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint unpublish <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id"],"id":"Unpublish","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Removes this leaf’s active snapshot from routing but keeps draft/history.

**Actual output and exit.** stdout: unpublished &lt;id&gt;; changes live availability. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint unpublish 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** Nonleaf/protected/missing endpoint fails. Verify history/show; publish intentionally to restore service (current draft may differ from the removed snapshot).

## viat endpoint update-auth

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint update-auth [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `authorizers`: `--authorizers` | `String`, 1, `Append` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `override_authorizers`: `--override-authorizers` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `override_permissions`: `--override-permissions` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["authorizers","id","override_authorizers","override_permissions"],"id":"UpdateAuth","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PUTs draft allowed_authorizers plus override flags. Nearest declared authorizer list replaces ancestors; authz gates accumulate until override_permissions stops the walk. This command has no retired permissions flag and does not expose editing gates. Omitted override booleans are sent false. Omitting --authorizers sends null and RESETS the local list to inherit; it does not preserve it. Repeat --authorizers for multiple names (no comma splitting). Existing authz_gates are preserved because this CLI does not send that field.

**Actual output and exit.** stdout: updated auth for &lt;path&gt;. Runtime snapshot stays unchanged until publish; children may inherit a changed draft. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint update-auth 00000000-0000-4000-8000-000000000001 --authorizers demo_password
```

**Failure handling, verification and cleanup.** Unknown authorizer/built-in protected node fails. Inspect old effective auth first and preserve configuration; restore auth, then republish affected endpoints if the change shipped.

## viat endpoint update-info

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat endpoint update-info [OPTIONS] <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `clear_method`: `--clear-method` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `clear_script`: `--clear-script` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `method`: `--method` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `script`: `--script` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `segment`: `--segment` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["clear_method","clear_script","id","method","script","segment"],"id":"UpdateInfo","multiple":true,"required":false}`

**Inputs, behavior and side effects.** PUT sends only provided segment/method/script keys; --clear-method and --clear-script send explicit null. It cannot rebind every target kind (no workflow/resource replacement flag here).

**Actual output and exit.** stdout: updated info for &lt;path&gt;; modifies draft identity/binding, not active snapshot. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat endpoint update-info 00000000-0000-4000-8000-000000000001 --segment demo-renamed
```

**Failure handling, verification and cleanup.** Clear flags are NOT parser conflicts: when a value and its clear flag are both supplied, clear wins. Invalid resulting branch/leaf states can still fail server validation. Save show output, verify the resulting node, publish intentionally; restore previous fields and publish to undo served changes.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/endpoint.rs`
- `crates/viat-cli/src/commands/endpoint_test.rs`
- `crates/viat-api/src/handlers/endpoints.rs`
- `crates/viat-api/src/handlers/snapshots.rs`
