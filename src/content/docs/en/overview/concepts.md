---
title: Core concepts and boundaries
description: Tell apart instances, projects, identities, resources, endpoint drafts, published snapshots and run records.
doc_id: overview.concepts
verified_release: '1.1.0'
channel: stable
---

# Core concepts and boundaries

After this page you should never hesitate over three questions: which object
to edit, who is allowed to edit it, and what external callers actually see.
Understanding the model needs no account; following the read-only commands
needs a platform session and project membership (editing takes `developer` or
above, publishing takes `admin` or `owner`).

![How Viat's core objects relate](/diagrams/concepts.en.svg)

## Instances, projects and the endpoint tree

| Object | What it is | Example |
| --- | --- | --- |
| Instance | One server deployment: platform accounts, activation, config, the PostgreSQL platform database | `https://api.example.com` |
| Project | A namespace of assets and collaborators inside the instance, unique slug | `hello-lab` |
| Endpoint tree | The project's route organization: directory nodes group, callable leaf nodes carry an HTTP method and target | `POST /hello` |
| Script / workflow | Executable assets; workflows orchestrate execution targets and are not an endpoint directory | `hello` (Python) |
| Resource | A reusable connection or platform capability: databases, HTTP APIs, storage, mail, keys | `demo-db` |
| Call URL | The full address external callers use | `https://api.example.com/p/hello-lab/hello` |

Three easy confusions:

- Management routes use `/projects/<slug>`; external calls use `/p/<slug>`.
  They are not interchangeable.
- A reverse-proxy mount prefix belongs in the instance base URL; the CLI
  login server URL contains neither `/ui` nor `/p/<slug>`.
- One script can back several endpoints with different methods and access
  rules; a path segment does not have to equal the script name.

## Three identity planes, not one role table

| Plane | Who it represents | Access decided by |
| --- | --- | --- |
| Platform user | A person signing in to the console, CLI or native app | Platform role: `owner`, `admin`, `developer`, `operator` |
| Project collaborator | A platform user joined to a project | Separate member role: `owner`, `admin`, `developer`, `operator` |
| End user / machine caller | People or programs consuming a published project API | Project authorizers, end-user roles and attributes, the authz model |

- A platform `owner` does **not** automatically become a collaborator of every
  project; joining the project is what adds them.
- Changing a platform role never changes project membership; adding an end
  user grants no console access.
- Command mapping: `viat user` manages platform staff, `viat project member`
  manages collaborators, `viat p-user` / `viat role` / `viat authorizer`
  manage project caller identities. Full flows: [platform users](../instance/platform-users.md)
  and [creating projects together](../projects/create-and-collaborate.md).

## Resources and secrets

A resource splits into non-secret `plain` fields and encrypted `secret`
fields; ordinary management reads return masked digests only. `secret` /
`config` resources intentionally hand secret values to scripts — a different
contract from provider credentials.

> [!WARNING]
> In 1.1.0 some legacy database, cache, messaging and S3 resource projections
> still inject credential-bearing connection info into the worker. Treat the
> script and its dependency tree as able to see that credential: prefer the
> proxied helpers, never return or print the whole resource object; see each
> type's boundaries in the [resource reference](../assets/resources/index.md).

Do not confuse a PostgreSQL resource holding business tables with the
PostgreSQL **platform database**; a `sqlite` resource only reaches allowed
server files and never replaces platform persistence.

## Drafts, publishing and rollback

Editing an endpoint, its authentication or input contract changes the
**draft**; external traffic reads the **currently published snapshot**.
Publishing captures the route contract and target definitions; a test run is
not a publish. Run `viat publish plan` before `viat publish apply`.

How dependencies freeze at publish time depends on the target:

| Target | Dependency handling |
| --- | --- |
| Script endpoint (no `(live)` references) | Ordinary Python/TypeScript `uses:` imports frozen at publish |
| Workflow step script (1.1.0) | Main source frozen; `uses:` dependencies (nested steps included) resolve live before each run |
| `# uses: shared/util (live)` | Reads live source every run on a fresh worker |
| Draft test / directly scheduled | Resolves live; the frozen snapshot is not executed |
| Old snapshot without frozen data | Falls back to live resolution; republish after upgrading to freeze the graph |

So neither "all imports are live" nor "rollback restores dependencies" is
true in general. Resource credentials and upstream configuration are always
live state — rotating a credential is not deploying endpoint code.

> [!NOTE]
> A successful publish does not guarantee the runtime environment finished
> building: builds are synchronous by default, but
> `VIAT_PUBLISH_BUILD_BLOCK=0` lets a failed build still publish and
> `VIAT_PUBLISH_BUILD_ASYNC=1` moves builds to the background. Check the
> build result in `viat script env <name> --json` before declaring a publish
> healthy.

## Authentication is not authorization

- **Authorizers** answer "who is calling". When an endpoint inherits upward,
  the nearest explicitly declared authorizer list **replaces** the ancestor
  list; it does not merge.
- **Authz gates** (`authz_gates`, elements `{type, action}`) answer "may the
  identified caller use this route". Gates **accumulate** down the tree until
  `override_permissions` stops inheritance.
- The built-in `anonymous` authorizer is for routes that are deliberately
  public; console session tokens never swap for end-user tokens or API keys.

## Runs and evidence

A run record carries `request_id`, status, timing and similar metadata; line
logs are the target's captured output. A rejected request can still produce a
run record without starting a worker. Logs obey backend and retention
settings and are not a permanent backup.

After the login and project selection in [first endpoint](../getting-started/first-endpoint.md),
a read-only tour:

```sh
viat project list
viat endpoint list --json
viat publish plan --json
viat logs query --limit 10 --json
```

Expect in order: reachable projects, endpoint records, pending publish
changes, and a page containing `items` and `next_before`. Empty lists are
normal for a fresh project; none of these commands publishes or runs scripts.

## Spotting boundary misuse

| Symptom | Where to look |
| --- | --- |
| Platform admin sees no project | Join the account to the project; platform roles do not bypass membership |
| Developer edits but cannot publish | Needs project Owner/Admin, not just platform Admin |
| Valid end-user token gets `403` | Check the published authorizer list and all inherited gates |
| Draft response changed, call response did not | Publish; then verify instance, project and the active snapshot |
| Rollback did not restore upstream credentials | Credentials are live resource state, not snapshot content |
| Configured `sqlite`, server still wants PostgreSQL | A resource database and platform persistence are two layers |

When cleaning up experiments, unpublish routes first, then delete endpoints
and targets; removing a member never deletes project content. Concrete steps:
[first endpoint](../getting-started/first-endpoint.md).

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/{project,script,resource,snapshot}.rs`, `crates/viat-db/src/projects.rs`, `crates/viat-db/src/endpoints.rs`, `crates/viat-api/src/handlers/snapshots.rs`, `crates/viat-cli/src/main.rs`.
