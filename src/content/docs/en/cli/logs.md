---
title: "CLI: logs"
description: "Complete Viat 1.1.0 logs grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.logs
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.logs.query","cli.logs.search","cli.logs.show","cli.logs.tail"]
---

# CLI: logs

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat logs query](#viat-logs-query)
- [viat logs search](#viat-logs-search)
- [viat logs show](#viat-logs-show)
- [viat logs tail](#viat-logs-tail)

## viat logs query

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat logs query [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Pagination cursor from previous --json output |
| `endpoint`: `--endpoint` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Filter to a single endpoint node id (UUID) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Emit raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `server 50, clamped 1–200` | — | help: Max rows to return (default 50) |
| `path_eq`: `--path-eq` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Exact-string filter on request path column |
| `request`: `--request` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Filter to a single request_id (UUID) |
| `since`: `--since` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Lower-bound timestamp (RFC3339, inclusive) |
| `status_max`: `--status-max` | `i16`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: HTTP status <= this |
| `status_min`: `--status-min` | `i16`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: HTTP status >= this (e.g. 400 for errors only) |
| `until`: `--until` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Upper-bound timestamp (RFC3339, exclusive) |

Clap argument groups (literal metadata): `{"arguments":["before","endpoint","json","limit","path_eq","request","since","status_max","status_min","until"],"id":"QueryArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Queries execution metadata for selected project; filters include endpoint UUID, request UUID, status range, UTC/RFC3339 time range and exact path. --before uses returned cursor. Does not query arbitrary business tables.

**Actual output and exit.** Text rows include time/request/status/duration/path and next-page hint; --json returns paged response. Empty matches exit 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat logs query --limit 10 --json
```

**Failure handling, verification and cleanup.** Bad UUID/time/cursor/range fails. Use returned cursor unchanged and preserve filters while paging. Read-only; protect identity/payload-related metadata in captures.

## viat logs search

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat logs search [OPTIONS] <QUERY>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `before`: `--before` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Pagination cursor from a previous run's "next page" hint |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Emit raw JSON response |
| `limit`: `--limit` | `i64`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `server 50, clamped 1–200` | — | help: Max rows to return (default 50, max 200) |
| `query`: `<QUERY> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: Substring to search for in log line content (case-insensitive, min 3 chars) |
| `since`: `--since` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Lower-bound timestamp (RFC3339, inclusive) |
| `stream`: `--stream` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Restrict to a single stream: stdout &#124; stderr &#124; structured |
| `until`: `--until` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Upper-bound timestamp (RFC3339, inclusive) |

Clap argument groups (literal metadata): `{"arguments":["before","json","limit","query","since","stream","until"],"id":"SearchArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Substring-searches log line content (minimum 3 characters); --stream optionally stdout/stderr/structured. Available only with PostgreSQL log backend, not all log sinks.

**Actual output and exit.** Text: matching request/time/stream/content plus page cursor; --json returns search page. No matches exits 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat logs search demo --limit 10 --json
```

**Failure handling, verification and cleanup.** Short query/unsupported backend/bad time fails. Narrow time range, paginate via --before; this does not search workflow outputs unless they were logged as lines. No mutation/cleanup.

## viat logs show

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat logs show [OPTIONS] <REQUEST_ID>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `request_id`: `<REQUEST_ID> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["json","request_id"],"id":"Show","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Fetches one execution by request_id plus line logs; not the internal execution_log_id or endpoint UUID.

**Actual output and exit.** Text: request/time/method/path/status/duration/error and lines; --json preserves full detail. No line logs is not proof execution did not run. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat logs show 00000000-0000-4000-8000-000000000001 --json
```

**Failure handling, verification and cleanup.** 404: use request ID from query/run, correct project and retention window. Reads can expose sensitive logged business data; no execution/cleanup.

## viat logs tail

**Prerequisites and permissions.** Platform login, selected project, and membership in that project (including Operator). Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat logs tail [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `endpoint`: `--endpoint` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Filter to a single endpoint node id (UUID) |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | help: Emit each event as one JSON line (newline-delimited) |

Clap argument groups (literal metadata): `{"arguments":["endpoint","json"],"id":"TailArgs","multiple":true,"required":false}`

**Inputs, behavior and side effects.** SSE streams new project execution and line events, no initial backfill, excludes test runs. Other nodes appear when runs finish via ~2s DB polling; line output across nodes needs PostgreSQL log backend.

**Actual output and exit.** Text formats events; --json prints event data lines (not one JSON array). Reconnect notices/errors go to stderr; stops with error after five consecutive failures. Runs until interrupted otherwise. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat logs tail --json
```

**Failure handling, verification and cleanup.** Ctrl-C stops only the local reader (signal exit status is not the 0/1 command convention). No replay on reconnect: query/show gaps separately. This does not cancel running scripts and needs no remote cleanup.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/logs.rs`
- `crates/viat-api/src/handlers/logs.rs`
- `crates/viat-db/src/logs.rs`
