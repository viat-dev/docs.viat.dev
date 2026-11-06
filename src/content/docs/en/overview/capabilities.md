---
title: Capabilities and supported surfaces
description: Choose the right Viat capability and understand stable runtime, client, permission, and deployment limits.
doc_id: overview.capabilities
verified_release: '1.1.0'
channel: stable
---

# Capabilities and supported surfaces

This is a decision guide for **server/CLI 1.1.0**, not a promise that every surface exposes every server operation. You need an activated instance for protected product routes. Project membership controls visibility; project `developer` can edit content, while project `owner`/`admin` can publish and manage collaborators. Platform administration is a separate permission plane.

## Pick a capability by outcome

| Desired outcome | Capability | What must already exist / important limit |
| --- | --- | --- |
| Answer an HTTP request with code | Script endpoint | Script, method/path, published snapshot; edits are drafts until publish |
| Coordinate several operations | Workflow endpoint or direct workflow run | Valid workflow and referenced targets; steps can cause real external writes |
| Forward to an upstream HTTP service | Proxy target | Configured upstream resource and route; credentials stay platform-side |
| Expose application tables as REST | `crud` target | Suitable database resource and CRUD configuration; write scope and authorization need deliberate design |
| Maintain a bidirectional connection | WebSocket target | Published routes and compatible client; browser clients use the supported ticket flow rather than putting bearer tokens in URLs |
| Run later or without holding HTTP open | Schedules and async runs | Activated server and suitable budgets; accepting a run is not proof of completion |
| React to files, queues, chat, or WebSocket feeds | Configured trigger | Source connectivity and explicit trigger configuration; not every resource automatically starts a consumer |
| Diagnose a request | Execution records, captured output, live log tail | Project visibility and configured log retention/backend |
| Work from version control | CLI `pull`, `diff`, `push` | A selected project and controlled local checkout; `push` is not a harmless file upload |
| Expose management to an agent | `viat mcp` | Authenticated CLI context; **46 tools**, not the obsolete six-tool README count |

For a complete minimal HTTP flow, use [Your first endpoint](../getting-started/first-endpoint.md). For the object/permission boundaries, use [Core concepts](concepts.md).

## Execution languages

The stable `ScriptLanguage` wire values are:

| Value | Role and prerequisite |
| --- | --- |
| `python` | Python function executed with `uv`-managed runtime; interpreter/dependency availability matters |
| `typescript` | TypeScript executed with `bun`; npm dependencies must build successfully |
| `sql` | Platform-executed SQL against a declared database resource |
| `shell` | Fresh shell process; the published image includes Bash and `jq` |
| `graphql` | GraphQL operation against the corresponding resource |
| `viat_gql` | Platform GraphQL layer over a supported database resource |
| `llm` | Prompt-style target using a configured model resource; provider access can incur charges |
| `rust` | Compiled worker program; compilation requires the build toolchain/SDK or an externally supplied artifact |
| `binary` | Externally built worker-protocol executable with a manifest and uploaded artifact; not an arbitrary executable with no protocol |

The normal image contains the **CLI** and interpreters but not the Rust compilation toolchain. The `1.1.0-build` image adds the pinned Rust toolchain and SDK. A slim node can run appropriate prepared artifacts; it cannot be treated as a Rust build node simply because `viat` is on its `PATH`.

A script timeout defaults through script header → project default → deployment default (`30` seconds), then the deployment's ceiling applies. The default synchronous ceiling is `300` seconds; background runs have a separate default ceiling of `1800` seconds. Raising a script header alone cannot bypass the deployment's ceiling.

## Resource families

Stable resource kinds include:

- Databases/data: `postgresql`, `mysql`, `sqlserver`, `sqlite`, `mongodb`, `redis`.
- Requests and computation: `http_api`, `graphql`, `llm`, `cloud_api`, `library`.
- Files/messages: `s3`, `storage`, `amqp`, `smtp`, `imap`, `push`.
- Configuration/security: `config`, `secret`, `crypto_key`.

A resource kind is a platform capability, not a claim of identical APIs across providers. For example, SQL Server authentication and each cloud API's actions have provider-specific limits. `sqlite` is a server-side resource file under configured roots, never the platform database. A `push` resource in this stable baseline is not evidence that unreleased direct APNs encrypted snapshot delivery is available.

Resources can point at real databases, send mail, publish messages, or invoke paid providers. A connection test or draft execution is not necessarily side-effect-free. Use isolated fixtures and explicit approval before exercising production integrations. Do not place real credentials in examples or commit resource secrets.

## Which interface should you use?

| Surface | Best fit | Boundary |
| --- | --- | --- |
| Browser console at `/ui/` | Full authoring and configuration, project members, publish review | Browser must reach the server; controls depend on membership/role |
| `viat` CLI | Script/endpoint operations, repo sync, logs, targeted management | Some settings require console/API; local `.viat/config.yaml` contains credentials |
| Management API | Automation against `/projects/...`, `/users`, `/license`, etc. | Platform session/PAT and operation-specific permissions, not a public project API key |
| Published API | Your application clients calling `/p/<slug>/...` | Endpoint's published authorizers and gates |
| Native client 0.1 | Multi-instance sign-in, project status, recent runs/logs and selected operations | Independent artifact/version; not a replacement for every console editor |
| MCP | Agent access to the CLI-backed management tool catalog | Same server-side permissions; tool availability does not grant rights |

See [Clients](../installation/clients.md) for Apple installation and CLI exposure. There is no stable native Windows/Linux release promise here; development code is not a distribution commitment.

## Verify availability without running business code

After [login and project selection](../getting-started/first-endpoint.md):

```sh
viat --version
viat version
viat script list --json
viat resource list --json
viat endpoint list --json
```

`viat --version` reports the local binary; `viat version` adds the authenticated server release if available. The list commands return current project assets, including empty arrays for unused kinds. They do not publish endpoints or execute business targets. Consult `viat <command> --help` for actual local flags: `script create` takes `--name --language --file`, while `resource create` takes **`--file`**, not guessed inline `--kind`/`--name` flags.

## Failure handling and non-goals

- **An operation is absent from a client:** use the console/API if supported there; do not invent a CLI command.
- **Build output says failure after publication:** publication defaults do not block on every build failure. Fix the environment, rebuild, and verify the endpoint before calling the deployment healthy.
- **A trigger does not fire:** verify activation, source configuration, connectivity, enabled state, and target permissions. Creating a resource alone does not configure a trigger.
- **Widget data is stale:** check its original update timestamp and network reachability. OS scheduling is not a real-time SLA; no unreleased APNs snapshot setup is required or promised here.
- **Logs are missing after retention:** logs are not a permanent audit backup. Review retention before relying on historical data.

For cleanup, delete only assets you deliberately created, stop/disable their triggers first, and revoke external credentials through the system that issued them. Deleting a Viat resource is not a promise to delete upstream business data or revoke a provider's credential.

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/{script,resource}.rs`, `crates/viat-cli/src/main.rs`, `docs/mcp.md`, `docs/scripting.md`, `Dockerfile`, and `client/README.md`. Server/CLI artifact baseline `fd340879`; native client version remains independent.
