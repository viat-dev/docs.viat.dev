---
title: "CLI: audit"
description: "Complete Viat 1.1.0 audit grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.audit
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.audit.export","cli.audit.query"]
---

# CLI: audit

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat audit export](#viat-audit-export)
- [viat audit query](#viat-audit-query)

## viat audit export

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat audit export [OPTIONS] <RESOURCE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The resource's folder ('' = project root); needed only when the name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `operator`: `--operator` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Who: an identity, user id, email, or a kind (`unattributed`, `system`, `console`) |
| `out`: `--out` | `PathBuf`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Write here instead of stdout |
| `record`: `--record` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: One record, by its primary key as text |
| `request`: `--request` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The request whose writes to show (UUID) |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The `postgresql` resource whose trail to read |
| `since`: `--since` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Lower-bound timestamp (RFC3339, inclusive) |
| `table`: `--table` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: A table (`samples` or `lab.samples`) |
| `until`: `--until` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Upper-bound timestamp (RFC3339, exclusive) |

Clap argument groups (literal metadata): `{"arguments":["folder","operator","record","request","resource","since","table","until"],"id":"Filters","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Exports every matching resource business-audit row as CSV; same filters as query except no page-size/before inputs. Contacts the resource DB through the server.

**Actual output and exit.** UTF-8 BOM CSV on stdout, or --out writes a local file and stderr reports path/row count. Not JSON; large exports can be substantial. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat audit export demo_db --out demo-audit.csv
```

**Failure handling, verification and cleanup.** Invalid resource/filter/DB connectivity or local file write fails. Narrow time/table filters and securely store or delete demo-audit.csv; export does not remove server trail rows.

## viat audit query

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat audit query [OPTIONS] <RESOURCE>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Pagination cursor from the previous page's "next page" hint |
| `folder`: `--folder` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The resource's folder ('' = project root); needed only when the name is ambiguous |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Emit the raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `server 100, clamped by configured maximum` | — | help: Max rows (default 100; the server caps it) |
| `operator`: `--operator` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Who: an identity, user id, email, or a kind (`unattributed`, `system`, `console`) |
| `record`: `--record` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: One record, by its primary key as text |
| `request`: `--request` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: The request whose writes to show (UUID) |
| `resource`: `<RESOURCE> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: The `postgresql` resource whose trail to read |
| `since`: `--since` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Lower-bound timestamp (RFC3339, inclusive) |
| `table`: `--table` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: A table (`samples` or `lab.samples`) |
| `until`: `--until` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Upper-bound timestamp (RFC3339, exclusive) |

Clap argument groups (literal metadata): `{"arguments":["folder","operator","record","request","resource","since","table","until"],"id":"Filters","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Reads a PostgreSQL resource’s BUSINESS-DATA audit trail with resource credentials on the platform. Not control-plane /projects/:slug/audit. --record is record_id; --operator matches identity/user ID/email/kind.

**Actual output and exit.** Text groups transactions and changed-field rows, then next-page --before; --json returns items/next_before/limit. Default server limit 100, clamped by deployment cap. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat audit query demo_db --limit 10 --json
```

**Failure handling, verification and cleanup.** Needs reachable PostgreSQL resource and installed/retained trail; a missing trail can be empty, not necessarily 404. Bad cursor/time or non-PostgreSQL fails. No writes/cleanup; output contains personal/business data.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/audit.rs`
- `crates/viat-api/src/handlers/audit_trail.rs`
