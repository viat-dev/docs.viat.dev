---
title: What Viat is
description: Understand Viat's endpoint-first model, deployment boundary, and the path from a script to a callable API.
doc_id: overview.platform
verified_release: '1.1.0'
channel: stable
---

# What Viat is

Viat is a self-hosted, endpoint-first API platform. Your working loop is:
**create a project → write a script/workflow → bind it to an HTTP path →
publish**. The platform receives requests, identifies callers, binds inputs,
executes targets and records outcomes.

The core mechanism in one sentence: **a script is not automatically an API —
publishing the endpoint is the step that hands its contract to callers**;
from then on, external traffic reads an immutable published snapshot, not
your draft.

Version baseline: this handbook pins server/CLI **1.1.0**; the native client
is an independent **0.1** line. A source checkout, a client build and a
released server image are different artifacts; unreleased encrypted APNs
widget snapshots are not part of this stable baseline.

## Start from your task

| Task | Prerequisites and permissions | Start here |
| --- | --- | --- |
| Install an instance | Docker host, persistent storage, secrets, a valid activation code, host-ops rights | [Docker Compose install](../installation/docker-compose.md) |
| Join an existing instance | Instance URL, platform account; project work additionally needs membership | [Platform users](../instance/platform-users.md) |
| Build an API | Project `developer` to edit; `owner`/`admin` to publish | [First endpoint](../getting-started/first-endpoint.md) |
| Connect a Mac or iOS app | An applicable signed client artifact and device reachability | [Clients](../installation/clients.md) |

> [!WARNING]
> Do not treat the product repository's development Compose stack as a
> customer installer. It provides test dependencies only; a real deployment
> runs the server with `DATABASE_URL`, `VIAT_MASTER_KEY` and a production
> `VIAT_JWT_SECRET`.

## The working model

1. **Instance**: one deployment — a PostgreSQL platform database, auth
   configuration, activation state, and one or more server processes.
2. **Project**: the namespace for collaboration and APIs; the slug appears in
   public paths like `/p/hello-lab/hello`.
3. **Assets**: scripts, workflows, resources, authorizers and endpoint trees
   all belong to the project.
4. **Endpoint draft**: the editable path, method, target, inputs and
   auth/authz settings; editing never changes the published API immediately.
5. **Published snapshot**: the version dispatch actually serves — not "the
   latest endpoint row".
6. **Execution**: one request or trigger run with its logs — editing,
   publishing and executing are three different things.

Before designing shared authentication or rollback flows, read
[core concepts](concepts.md).

## How one request flows

Take `POST /p/hello-lab/hello`:

1. Viat selects the project's **published** route and checks the HTTP method.
2. The route's allowed authorizers identify the caller; authz gates decide
   whether to proceed.
3. Path, query and body bind to the target's inputs per the endpoint
   contract.
4. The target executes along its own path — script, workflow, proxy, CRUD or
   WebSocket.
5. Viat returns the result and records the execution — rejected requests get
   records too, so **a record does not mean your script ran**.

That is why a Python function returning JSON becomes an endpoint without you
writing an HTTP service — but input shape, authorization, upstream error
handling and idempotent business writes remain your responsibility.

## Where credentials and data live

- The platform database is **PostgreSQL**. A `sqlite` resource is an
  application data connection: not a replaceable platform database and not a
  standalone desktop-local mode.
- Resource connection credentials are stored by the platform and applied when
  the platform performs resource operations. Do not let scripts depend on
  fetching raw database passwords, private keys or upstream auth headers;
  secret-value resources and config each have explicit semantics — never put
  credentials into non-secret `plain` config or logs.
- **Back up the master key separately from the database**: losing it can make
  encrypted resource credentials unusable.
- Some legacy 1.1.0 script-resource projections still carry connection
  credentials (see [concepts](concepts.md) and each resource reference);
  management-API masking does not prove every script view is credential-free.
- Scripts are executable code: worker-account isolation, timeouts and
  container limits are useful protections, not a malicious-tenant isolation
  promise. Grant script authors and upstream service accounts only the
  permissions they need.

## A safe first check

Against an instance you are authorized to use, read the liveness probe:

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
```

Expected body:

```json
{"status":"ok"}
```

This proves HTTP is being served and **nothing more** — not activation,
database readiness, or any project's existence. After signing in, `viat
version` shows the CLI and server versions; full sign-in steps:
[first endpoint](../getting-started/first-endpoint.md).

## Limits and common traps

| Symptom | Reality and fix |
| --- | --- |
| `403 license_required` | The process can be healthy while protected routes stay locked; follow [activation](../instance/activation.md), do not restart repeatedly |
| Empty project list | A platform account ≠ a member; ask the project Owner/Admin to join you |
| Draft test passes, HTTP still returns old results | Changes need publishing; ordinary `uses:` dependencies freeze at publish, `(live)` ones and draft tests behave differently |
| Upstream connection failures | Check the network path from the resource and the **server**; your laptop reaching an intranet service says nothing about the container |
| Stale widget timestamps on the client | Cached state is not a live monitoring connection; refresh timing is OS-controlled |

The [capability map](capabilities.md) helps pick your entry point. For a
first experiment use the isolated project from
[first endpoint](../getting-started/first-endpoint.md) and unpublish/delete
afterwards; never overlay another project's routes.

## Verification basis

Stable server/CLI artifacts: `1.1.0` (`fd340879`); contract source:
`03751a67`. Primary implementation: `crates/viat-api/src/handlers/dispatch.rs`,
`crates/viat-api/src/registry.rs`, `crates/viat-core/src/types/snapshot.rs`,
`crates/viat-api/src/handlers/health.rs`.
