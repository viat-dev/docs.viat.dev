---
title: Core concepts and boundaries
description: Distinguish instances, projects, identities, resources, endpoint drafts, published snapshots, and executions.
doc_id: overview.concepts
verified_release: '1.1.0'
channel: stable
---

# Core concepts and boundaries

Use this page to decide **which object to change** and **which permission controls it**. You need no account to read the model. To inspect a real project, you need a platform session and membership; changing content needs project `developer` or above, and publishing needs project `admin` or `owner`.

## Instance, project, and endpoint tree

An **instance** is a server deployment. It owns platform accounts, activation, server configuration, and the PostgreSQL platform database. Multiple server processes may share that database; creating another project is not creating another server.

A **project** owns its API assets and collaborator memberships. Its slug is unique within the instance. The public prefix is `/p/<slug>`; management routes use `/projects/<slug>`. A project slug is not a bearer credential.

An **endpoint tree** organizes a project's routes. New projects have a `default` tree at the root mount. Directory nodes organize descendants; callable leaves have a method and target. A path segment is not necessarily a script name. The same script can back multiple endpoints with different methods or access rules.

Example:

| Object | Example | Meaning |
| --- | --- | --- |
| Instance base URL | `https://api.example.com` | Deployment to connect to; replace with your own URL |
| Project slug | `hello-lab` | Project namespace |
| Script asset | `hello` | Reusable executable definition |
| Endpoint | `POST /hello` | Published HTTP contract inside the project |
| Caller URL | `https://api.example.com/p/hello-lab/hello` | Complete public request URL |

A reverse-proxy mount prefix belongs in the instance base URL too. Do not add `/ui` or `/p/<slug>` to a CLI login's server URL.

## Three identity planes, not one role list

| Plane | Who it represents | How access is decided |
| --- | --- | --- |
| Platform user | A person signing in to the console, CLI, or native app | Platform role: `owner`, `admin`, `developer`, `operator` |
| Project collaborator | A platform user enrolled in one project | Independent membership role: `owner`, `admin`, `developer`, `operator` |
| Project end user / machine caller | A consumer of published project APIs | Project authorizer, end-user role/attributes, and authorization model |

A platform `operator` can be a project `owner`. A platform `owner` is not automatically a collaborator in every project. Changing a platform user's role does not change their membership role, and adding an end user does not give console access.

`viat user` manages platform people; `viat project member` manages collaborators; `viat p-user`, `viat role`, and `viat authorizer` operate on a project's caller identities. See [Platform users](../instance/platform-users.md) and [Create and collaborate](../projects/create-and-collaborate.md) for complete procedures.

## Script, workflow, resource

A **script** is a named executable asset with a language and version. A **workflow** coordinates targets and control flow; it is not a folder of endpoints. Testing a draft invokes current definitions and can have real side effects—it is not automatically an offline simulation.

A **resource** holds a reusable connection or platform-managed capability: a database, HTTP API, storage, mail service, cryptographic key, and so on. Resource configuration separates non-secret `plain` data from secret fields. Ordinary management reads redact secret values, and brokered operations apply credentials on the platform side.

That is **not a universal credential-free script-view guarantee in 1.1.0**: some legacy database, cache, messaging and S3 projections still contain credential-bearing fields. Prefer brokered helpers, never return/log resource objects, and read the per-kind [resource reference](../assets/resources/index.md). Intentionally secret-valued `secret`/`config` resources have a separate contract from provider authentication credentials.

Do not confuse a PostgreSQL resource that stores your business tables with the PostgreSQL **platform database**. Likewise, a `sqlite` resource accesses an approved server-side file; it does not replace the platform database.

## Draft, publication, and rollback

Editing an endpoint's target, authentication, or input contract changes a **draft**. Public dispatch serves an **active published snapshot**. Publication captures the route contract and target definition; a test run is not publication. Review `viat publish plan` before `viat publish apply`.

Dependency handling is important:

- A published **script endpoint** captures ordinary Python/TypeScript `uses:` imports when its dependency graph has no `(live)` reference.
- Workflow-step scripts are an exception in 1.1.0: their main sources are baked at publish, but their `uses:` dependencies—including nested workflow steps—are resolved live before each workflow run.
- A directive such as `# uses: shared/util (live)` resolves live source at each run and uses a fresh worker rather than the warm-pool path.
- Draft tests and direct schedule targets resolve dependencies live because they do not execute an endpoint's frozen snapshot.
- Old snapshots without frozen dependency data also fall back to live resolution. Republish when upgrading an old endpoint to an explicitly frozen dependency graph.

Thus, do not promise that “every import is live” or that “every dependency is rolled back.” The endpoint snapshot and the dependency mode determine the result. Resource credentials and upstream configuration remain live: credential rotation is not an endpoint-code deployment.

Publication is not guaranteed to mean successful runtime preparation under every deployment setting. Defaults build synchronously, but `VIAT_PUBLISH_BUILD_BLOCK=0` permits publication despite a failed dependency build; `VIAT_PUBLISH_BUILD_ASYNC=1` permits background builds. Review build results before calling a release healthy.

## Authentication versus authorization

An **authorizer** answers who the caller is. An endpoint's nearest declared authorizer list **replaces** ancestor lists. It is not a union of every parent's accepted credential type.

An **authorization gate** (`authz_gates`, a list of `{type, action}`) answers whether the identified caller may call the route. Gates **accumulate** up the tree until `override_permissions` stops inheritance. They are evaluated against the subject, before a business object exists. Object/row permissions belong to the authorization model and the relevant operation as well.

The built-in `anonymous` authorizer makes explicitly public routes possible; it is not a substitute for checking permissions on confidential business data. A console login token is not interchangeable with a project end-user token or API key.

## Execution and evidence

An execution record carries a `request_id`, status, timing, and other metadata. Line logs are the target's captured output. Endpoint refusals can create execution records without launching a worker. Logs may be persisted through a configured backend and retention policy; do not assume they are permanent backups.

After the login/project-selection procedure in [Your first endpoint](../getting-started/first-endpoint.md), inspect without editing:

```sh
viat project list
viat endpoint list --json
viat publish plan --json
viat logs query --limit 10 --json
```

Expected results are accessible projects, editable endpoint records, pending publication work, and an execution page with `items` and `next_before`. An empty list is valid for a new project. None of these commands publishes or runs a script.

## Diagnose a boundary mistake

| Symptom | Check |
| --- | --- |
| Platform Admin sees no projects | Enroll that account in the project; platform role does not bypass membership |
| Developer edits successfully but cannot publish | Ask a project Owner/Admin, not merely a platform Admin |
| Valid end-user token gets `403` | Check the published authorizer list and all inherited gates |
| Draft response changed, caller response did not | Publish; inspect the selected instance/project and active snapshot |
| Rollback did not revert an upstream credential | Credentials are live resource state, not snapshot contents |
| `sqlite` was configured but server still needs PostgreSQL | Resource databases and platform persistence are separate |

For cleanup, unpublish a disposable route before deleting its endpoint and target. Removing a project member does not delete their project content, and clearing a CLI session does not delete the project. Use the task-specific cleanup in [Your first endpoint](../getting-started/first-endpoint.md).

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/{project,script,resource,snapshot}.rs`, `crates/viat-db/src/projects.rs`, `crates/viat-db/src/endpoints.rs`, `crates/viat-api/src/handlers/snapshots.rs`, and `crates/viat-cli/src/main.rs`.
