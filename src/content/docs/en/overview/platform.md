---
title: What Viat is
description: Understand Viat's endpoint-first model, deployment boundary, and the path from a script to a callable API.
doc_id: overview.platform
verified_release: '1.1.0'
channel: stable
---

# What Viat is

Viat is a self-hosted, endpoint-first API platform. You create a project, write a script or workflow, bind it to an HTTP path, and publish it. The platform receives the request, authenticates the caller, binds inputs, executes the target, and records the outcome. A script is not automatically an API: publishing an endpoint is the step that makes its contract available to callers.

This handbook's stable baseline is **server and CLI 1.1.0**. The native app has an independent **0.1** version line. A source checkout, a client build, and a released server image are different artifacts. Unreleased encrypted APNs widget snapshots are not part of this stable baseline.

## Before you begin

Choose which job you are doing:

| Job | Prerequisite and permission | Start here |
| --- | --- | --- |
| Install an instance | Docker host, persistent storage, secrets, valid activation code, permission to operate the host | [Docker Compose installation](../installation/docker-compose.md) |
| Join an existing instance | Its URL and a platform account; project membership for project work | [Platform users](../instance/platform-users.md) |
| Build an API | Project `developer` to edit; project `owner` or `admin` to publish | [Your first endpoint](../getting-started/first-endpoint.md) |
| Connect a Mac or iOS app | An appropriate signed client artifact and network access to the instance | [Clients](../installation/clients.md) |

Do not deploy the repository's development Compose stack as a customer installer. It supplies test dependencies; the deployment stack must also run the server, provide `DATABASE_URL` and `VIAT_MASTER_KEY`, and set a production `VIAT_JWT_SECRET`.

## The operating model

1. **Instance:** one deployment, with a PostgreSQL platform database, authentication configuration, an activation state, and one or more server processes.
2. **Project:** a collaboration and API namespace. A project slug appears in public paths such as `/p/hello-lab/hello`.
3. **Assets:** scripts, workflows, resources, authorizers, and endpoint trees belong to a project.
4. **Endpoint draft:** a path, HTTP method, execution target, inputs, and authentication/authorization settings that can be edited without immediately changing the published API.
5. **Published snapshot:** the version dispatch serves. A request does not simply execute the newest editable endpoint row.
6. **Execution:** the request or triggered run and its logs, distinct from the act of editing or publishing.

Read [Core concepts](concepts.md) before designing shared authentication or rollback procedures.

## What happens to a request

For an example request `POST /p/hello-lab/hello`:

1. Viat selects the project's **published** route and checks the method.
2. The route's allowed authorizers identify the caller. Authorization gates decide whether that caller may proceed.
3. Path/query/body values become target inputs according to the endpoint's contract.
4. A script, workflow, proxy, CRUD target, or WebSocket target follows its own execution path.
5. Viat returns the result and records execution information. Rejected HTTP requests also have execution records; a refusal is not proof that a script ran.

A JSON-returning Python function can therefore become an HTTP service without writing a separate HTTP server. This does not remove responsibility for schema design, authorization, upstream failures, or idempotency of business writes.

## Where credentials and data live

The platform database is **PostgreSQL**. A `sqlite` resource is an application data connection, not an alternative platform database or a standalone desktop mode.

Resource connection credentials are held and applied by the platform when it performs a resource operation. Do not design scripts around obtaining raw database passwords, private keys, or upstream authentication headers. Secret-valued resources/configuration have their own explicit semantics; do not place credentials in non-secret `plain` configuration or log them. Back up the master key separately from the database: losing the key can make encrypted resource credentials unusable.

In 1.1.0, some legacy script resource projections can still carry connection credentials. This version-specific limitation is explained in [Concepts](concepts.md) and the per-kind resource references; management-API redaction is not proof that every script view is credential-free.

Your scripts are executable code. Worker-account separation, timeouts, and container limits are useful safeguards, not a promise of hostile-tenant isolation. Give authors and upstream service accounts only the privileges they need.

## A safe first verification

On an instance you are authorized to use, read the process liveness route:

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
```

Expected body:

```json
{"status":"ok"}
```

This proves that HTTP is serving, **not** that the deployment is activated, the database is ready, or your project exists. After signing in, `viat version` reports CLI and server versions; follow the complete login procedure in [Your first endpoint](../getting-started/first-endpoint.md).

## Limits and common wrong turns

- **`403 license_required`:** the process can be healthy while protected product routes are locked. Follow [Activation](../instance/activation.md), not a restart loop.
- **An empty project list:** platform access is not project membership. Ask a project Owner/Admin to enroll the account.
- **A successful draft test but an old HTTP response:** publish the endpoint after editing. Ordinary `uses:` dependencies are frozen at publish; explicitly `(live)` dependencies and draft tests have different behavior.
- **An upstream connection failure:** verify the resource and the server's network path. Your laptop reaching an intranet service does not prove that the container can.
- **A client widget with an old timestamp:** cached status is not a live monitoring connection; the OS controls refresh timing.

The feature map in [Capabilities](capabilities.md) helps choose a surface. For a disposable first API, use the isolated project in [Your first endpoint](../getting-started/first-endpoint.md), then unpublish and remove its endpoint and script. Do not experiment by overwriting another project's routes.

## Verification basis

Stable server/CLI artifacts: `1.1.0` (`fd340879`); contract source: `03751a67`. Key implementation references: `crates/viat-api/src/handlers/dispatch.rs`, `crates/viat-api/src/registry.rs`, `crates/viat-core/src/types/snapshot.rs`, and `crates/viat-api/src/handlers/health.rs`.
