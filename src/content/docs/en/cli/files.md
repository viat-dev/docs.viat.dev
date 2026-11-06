---
title: "CLI: files"
description: "Complete Viat 1.1.0 files grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.files
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.files.get","cli.files.list","cli.files.put","cli.files.rm"]
---

# CLI: files

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat files get](#viat-files-get)
- [viat files list](#viat-files-list)
- [viat files put](#viat-files-put)
- [viat files rm](#viat-files-rm)

## Synthetic fixtures and execution boundary

These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.

demo.txt contains synthetic text only. demo_storage must already have managed storage, metadata PostgreSQL and local/S3 bytes configured; the CLI does not provision storage/buckets/databases for you. Replace file UUIDs with actual files list/put values.

## viat files get

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat files get [OPTIONS] <STORAGE> <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The file's id |
| `info`: `--info` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Print the row instead of downloading |
| `out`: `--out` | `PathBuf`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `sanitized stored name, fallback file` | — | help: Write the bytes here (default: the file's own name in the current directory). `-` for stdout |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The `storage` resource |

Clap argument groups (literal metadata): `{"arguments":["folder","id","info","out","storage"],"id":"GetArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Fetches metadata first. --info prints row JSON only; otherwise downloads bytes. Default local destination is a sanitized basename from stored name; --out - writes raw stdout. --info does not mean download.

**Actual output and exit.** Download stdout is raw bytes only when --out -; file mode writes path/size notice on stderr. It can overwrite the chosen local file. --info emits pretty JSON on stdout. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat files get demo_storage 00000000-0000-4000-8000-000000000001 --info
```

**Failure handling, verification and cleanup.** Missing/deleted file or unavailable byte store fails. Use --info first and explicit safe --out to avoid accidental overwrite; check bytes/content type, delete disposable download locally. No remote mutation.

## viat files list

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat files list [OPTIONS] <STORAGE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The previous page's cursor (a `viat files list` run printed it) — keyset pagination for tables larger than one page |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The resource's folder ('' = project root); needed only when the name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Emit the raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `server 100, clamped 1–1000` | — | help: Max rows (default 100; the server caps it at 1000) |
| `owner_id`: `--owner-id` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: …and its id |
| `owner_type`: `--owner-type` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Files of one business object: its type… |
| `prefix`: `--prefix` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Keys under this prefix |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The `storage` resource |

Clap argument groups (literal metadata): `{"arguments":["before","folder","json","limit","owner_id","owner_type","prefix","storage"],"id":"ListArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Lists managed-file metadata from a storage resource, with optional owner/prefix filters and cursor. Console membership authorizes read; data-plane file authz rules are a separate boundary.

**Actual output and exit.** Text: UUID, size, owner, uploaded, key plus next cursor; --json response includes page metadata. Default server page size is applied when --limit is absent. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat files list demo_storage --limit 10 --json
```

**Failure handling, verification and cleanup.** Requires configured metadata PostgreSQL and byte backend; bad storage/folder/cursor fails. Copy actual UUID for get/rm. No file bytes changed; protect output.

## viat files put

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Existing isolated storage resource demo_storage, including its metadata PostgreSQL and local/S3 byte backend, plus demo.txt containing synthetic text. This cannot succeed without actual provisioned storage.

```text
Usage: viat files put [OPTIONS] <STORAGE> <FILE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `content_type`: `--content-type` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `server guesses from stored name` | — | help: The content type (default: guessed from the name by the server) |
| `file`: `<FILE> (#2)` | `PathBuf`, 1, `Set` | yes; no explicit Clap default | — | help: The local file to store |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `key`: `--key` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `<new UUID>/<name>` | — | help: The key (default: `<id>/<name>`); refused when a live file has it |
| `name`: `--name` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `local file basename` | — | help: The stored name (default: the local file's) |
| `owner_id`: `--owner-id` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `owner_type`: `--owner-type` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `reason`: `--reason` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The reason, for a metadata table whose audit block requires one |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The `storage` resource |

Clap argument groups (literal metadata): `{"arguments":["content_type","file","folder","json","key","name","owner_id","owner_type","reason","storage"],"id":"PutArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads a local file and uploads as console account; optional key/name/content-type/owner/reason. Default key is generated id/name; key collision is refused, not replace. No script receives storage credentials.

**Actual output and exit.** Text gives new UUID/key/size; --json metadata row. Writes byte store plus metadata/audit; real storage effects occur immediately. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat files put demo_storage demo.txt --reason 'synthetic demo upload' --json
```

**Failure handling, verification and cleanup.** 409 file_exists, 413 file_too_large, 415 file_type_not_allowed or required audit reason can fail. Verify files get --info with returned UUID. Cleanup files rm with required reason; do not merely delete your local source.

## viat files rm

**Prerequisites and permissions.** Platform login, selected project, and effective project Owner/Admin/Developer. Operator cannot use this command, including its read-only form. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat files rm [OPTIONS] <STORAGE> <ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id`: `<ID> (#2)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The file's id |
| `reason`: `--reason` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The reason, on the audit trail (required by a `reason_required` table) |
| `storage`: `<STORAGE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The `storage` resource |

Clap argument groups (literal metadata): `{"arguments":["folder","id","reason","storage"],"id":"RmArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Soft-deletes metadata (row remains marked deleted) and deletes bytes, as console identity. --reason is required if metadata audit policy requires it.

**Actual output and exit.** stdout: deleted &lt;UUID&gt;. Not a reversible move to trash and not deletion of the local upload source. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat files rm demo_storage 00000000-0000-4000-8000-000000000001 --reason 'remove synthetic demo'
```

**Failure handling, verification and cleanup.** Bad UUID/missing file/reason/backend failure can fail. Verify list excludes it; retain source/backups before deletion. Re-upload is a new file identity and does not undelete old row/restore grants automatically.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/files.rs`
- `crates/viat-api/src/handlers/files.rs`
