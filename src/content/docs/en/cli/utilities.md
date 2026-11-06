---
title: "CLI: version / call / mcp"
description: "Complete Viat 1.1.0 version / call / mcp grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.utilities
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.call","cli.mcp","cli.version"]
---

# CLI: version / call / mcp

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat call](#viat-call)
- [viat mcp](#viat-mcp)
- [viat version](#viat-version)

## viat call

**Prerequisites and permissions.** Plain mode needs configured server and selected project; endpoint authorizers decide whether a project token is needed. Console mode needs platform login and the requested route’s own role. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat call [OPTIONS] <PATH>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `body`: `--body` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | — |
| `console`: `--console` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `method`: `--method` | `String`, 1, `Set` | no; conditional requirements below; `GET` | — | — |
| `path`: `<PATH> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["body","console","method","path"],"id":"Call","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Default calls {server}/p/{selected-project}{path} with optional project_token, NOT access_token; absent token may still call public routes. Plain mode bypasses proxies and supports GET/POST/PUT/PATCH/DELETE only. --console instead calls an absolute console path with login refresh/proxy settings and that route’s own permission check; selected project not needed for console mode. --body is sent as JSON content-type string, not validated JSON.

**Actual output and exit.** stdout: HTTP status line then raw body. Non-2xx prints these first then exits 1. Valid HTTP error responses are not parsed as successful business results. Streaming is not a live event renderer: response text is collected. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat call --console /auth/whoami
```

**Failure handling, verification and cleanup.** This can mutate ANY allowed route; inspect method/path/body before opt-in. Login does not mint project_token automatically. For 401 distinguish console session from runtime authorizers; do not copy a PAT into public examples. Verify effects via route-specific reads and reverse them explicitly; no generic undo/retry safety.

## viat mcp

**Prerequisites and permissions.** Configured server URL and platform JWT/PAT strings; no existing validated session or selected project required at startup. Every later tool enforces its own account/project role. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat mcp
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

**Inputs, behavior and side effects.** Starts stdio JSON-RPC server, not a one-shot tool invocation. VIAT_SERVER/VIAT_TOKEN/VIAT_PROJECT override discovered config. Server URL and token strings required at startup; project can be provided by individual tool. Credentials are validated at tool-call time. Client always bypasses HTTP proxies; do not assume CLI refresh-on-401 applies to this separate MCP client.

**Actual output and exit.** stdout contains protocol frames only; diagnostics on stderr. Lives until client/stdio closes; startup config/protocol errors return nonzero. A running process or successful tools/list does not prove server activation/access. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat mcp
```

**Failure handling, verification and cleanup.** Launch from an MCP host with controlled config/PAT scope; later write/trigger/call tools can cause real effects under the token owner’s project roles. Stop the host process to end transport, revoke disposable PAT separately; stopping does not revoke credentials or undo tool calls.

## viat version

**Prerequisites and permissions.** No existing platform login or selected project required; local filesystem/process access and the command-specific prerequisites below still apply. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat version
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

**Inputs, behavior and side effects.** Prints the CLI release first. If configuration contains a server and login, also tries authenticated GET /version; this is distinct from viat --version, which never asks the server.

**Actual output and exit.** stdout: viat 1.1.0 (cli), optionally a server line or an unavailable/not-signed-in explanation. Minor-version mismatch warns on stderr. Server lookup failure still exits 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat version
```

**Failure handling, verification and cleanup.** Compare CLI/server minor versions before sync. Nothing to undo; the authenticated request may refresh the local session.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/auth.rs:277–324`
- `crates/viat-cli/src/commands/endpoint.rs:325–380`
- `crates/viat-cli/src/commands/mcp.rs`
- `crates/viat-mcp/src/{config,http,lib}.rs`
