---
title: Capabilities and supported surfaces
description: Choose the right Viat capability and understand stable runtime, client, permission, and deployment limits.
doc_id: overview.capabilities
verified_release: '1.1.0'
channel: stable
---

# Capabilities and supported surfaces

This page helps you pick the right capability and surface on **server/CLI
1.1.0**. Three premises run through everything:

- Protected product routes need an activated instance.
- Project membership controls visibility: project `developer` edits; project
  `owner`/`admin` publishes and manages collaborators.
- Platform administration is a separate permission plane, independent of
  project roles.

The page never promises that every surface exposes every server operation.

## Choose a capability by goal

| Goal | Capability | Prerequisites / key limits |
| --- | --- | --- |
| Answer HTTP with code | Script endpoint | Script, method+path, published snapshot; edits are drafts until published |
| Orchestrate several operations | Workflow endpoint or direct workflow run | Valid workflow with referenced targets; steps can really write upstream |
| Forward to an upstream HTTP service | Proxy target | Configured upstream resource and route; credentials stay platform-side |
| Expose business tables as REST | `crud` target | Suitable database resource and CRUD config; design write scope and authz deliberately |
| Hold a bidirectional connection | WebSocket target | Published route and compatible client; browsers use the supported ticket flow — never put a bearer token in the URL |
| Run on a schedule / off the HTTP path | Schedules and async runs | Activated server and suitable budgets; **accepting a job ≠ completing it** |
| React to files, queues, chat or WS feeds | Configured triggers | Source connection and explicit trigger config; resources do not auto-start consumers |
| Investigate a request | Run records, captured output, live logs | Project visibility; bounded by log backend and retention |
| Collaborate via version control | CLI `pull`/`diff`/`push` | Selected project, controlled working copy; `push` is not a harmless upload |
| Give an agent management powers | `viat mcp` | Authenticated CLI context; **46 tools**, not the six an old README claimed |

Full minimal HTTP flow: [first endpoint](../getting-started/first-endpoint.md);
object and permission boundaries: [core concepts](concepts.md).

## Execution languages

Stable `ScriptLanguage` protocol values:

| Value | Purpose and prerequisites |
| --- | --- |
| `python` | Python functions with `uv`-managed environments; interpreter and dependencies must be available |
| `typescript` | TypeScript executed by `bun`; npm dependencies must build |
| `sql` | SQL executed by the platform against a declared database resource |
| `shell` | Fresh shell process per run; release images include Bash and `jq` |
| `graphql` | GraphQL operations against the matching resource |
| `viat_gql` | The platform GraphQL layer over supported database resources |
| `llm` | Prompt target using a configured model resource; provider access can cost money |
| `rust` | Compiled worker programs; compilation needs the build toolchain and SDK, or externally provided artifacts |
| `binary` | Externally built programs implementing the worker protocol; manifest and uploaded artifact required — not arbitrary protocol-free executables |

Image layering: ordinary images include the **CLI** and interpreters but **no**
Rust toolchain; `1.1.0-build` adds pinned Rust toolchain and SDK. Slim nodes
run prepared matching artifacts, but a `viat` on `PATH` does not make a node a
Rust build node.

Script timeouts take, in order: script header → project default → deployment
default (`30`s), then clamp to the deployment ceiling. Synchronous calls cap
at `300`s by default; background runs use a separate `1800`s ceiling.
**Enlarging the header does not bypass the ceiling.**

## Resource families

- Data and databases: `postgresql`, `mysql`, `sqlserver`, `sqlite`,
  `mongodb`, `redis`.
- Requests and compute: `http_api`, `graphql`, `llm`, `cloud_api`,
  `library`.
- Files and messaging: `s3`, `storage`, `amqp`, `smtp`, `imap`, `push`.
- Configuration and security: `config`, `secret`, `crypto_key`.

A resource kind represents a platform capability, not provider API parity —
SQL Server auth and each cloud API's actions have their own limits. `sqlite`
is a server-side resource file under the configured root and **never** the
platform database. The existence of `push` in this baseline does not make the
unreleased direct APNs encrypted-snapshot delivery available.

> [!WARNING]
> Resources can touch real databases, send mail, publish messages or call
> paid providers — connection tests and draft runs are not guaranteed
> side-effect free. Use isolated samples and explicit approval for production
> integrations; keep real credentials out of examples and never commit
> resource secrets.

## Which surface to use

| Surface | Good for | Boundary |
| --- | --- | --- |
| `/ui/` browser console | Full authoring and configuration, membership, publish review | Browser must reach the server; controls depend on membership and roles |
| `viat` CLI | Script/endpoint work, repo sync, logs, selected admin tasks | Some settings are console/API-only; local `.viat/config.yaml` holds credentials |
| Management API | Automating `/projects/...`, `/users`, `/license`, … | Platform session/PAT with operational permissions — not project API keys |
| Published API | Application clients calling `/p/<slug>/...` | Follows the endpoint's published authorizers and gates |
| Native client 0.1 | Multi-instance sign-in, project status, recent runs/logs, some operations | Independent artifacts and versions; not a full console replacement |
| MCP | Agents using the CLI-backed management tool catalog | Still bounded by server permissions; **having a tool is not having permission** |

Apple installation and CLI exposure: [clients](../installation/clients.md).
This page promises no stable native Windows/Linux distribution — development
code existing is not a shipping commitment.

## Check availability without running business code

After [sign-in and project selection](../getting-started/first-endpoint.md):

```sh
viat --version
viat version
viat script list --json
viat resource list --json
viat endpoint list --json
```

`viat --version` reports the local binary; `viat version` additionally reads
the authenticated server version. The list commands return the current
project's assets (empty arrays when unused) and never publish or execute
anything. Verify flags with `viat <command> --help` — e.g. `script create`
takes `--name --language --file`, and `resource create` takes **`--file`**
with no inline `--kind`/`--name` arguments; do not guess.

## Failure handling and non-goals

| Symptom | Action |
| --- | --- |
| A client lacks an operation | Use the console/API surface that supports it; never invent CLI commands |
| Build failures after publishing | Default publishing is not blocked per build failure; fix the environment, rebuild and verify the endpoint before judging deployment health |
| A trigger never fires | Check activation, source config, connectivity, enabled state and target permissions; creating a resource alone configures no trigger |
| Stale widget | Check the original update time and connectivity; OS scheduling has no real-time SLA; this baseline has no unreleased APNs snapshot config |
| Logs gone past retention | Logs are not a permanent audit backup; confirm retention before relying on history |

When cleaning up, delete only assets you deliberately created: disable the
involved triggers first, then revoke external credentials through their
issuing systems — **deleting a Viat resource deletes no upstream business
data and revokes no provider credentials**.

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/{script,resource}.rs`,
`crates/viat-cli/src/main.rs`, `docs/mcp.md`, `docs/scripting.md`,
`Dockerfile`, `client/README.md`. Server/CLI artifact baseline `fd340879`;
the native client is versioned independently.
