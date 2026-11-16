---
title: HTTP API surfaces and request conventions
description: Choose the correct management or caller API, address assets precisely, interpret responses and export published endpoint OpenAPI.
doc_id: api.overview
verified_release: '1.1.0'
channel: stable
---

# HTTP API surfaces and request conventions

Viat has two HTTP surfaces: the **management API** for platform/project
administration and the **caller API** for published application
interfaces — their identities are **not interchangeable**. The CLI and
console use management APIs; `viat call` without `--console` targets
the caller API.

Paths below are relative to the instance base URL (including any
operations-configured reverse-proxy/base-path prefix); **never** append
`/ui` to the API base address. Use HTTPS beyond trusted local fixtures;
credentials never belong in URLs, source code or shared transcripts.

## Choose the correct surface

| Surface | Representative paths | Authentication and meaning |
| --- | --- | --- |
| Process probes | `/healthz`, `/readyz` | Deliberately unauthenticated and exempt from the activation gate; process health **proves neither** valid activation nor runnable scripts |
| Platform login/sessions | `/auth/login`, `/auth/refresh`, `/auth/sessions` | Platform accounts with their session/MFA rules — **not** project end-user login |
| Platform administration | `/users`, `/license`, `/admin/...` | Route-specific platform role/session rules |
| Project administration | `/projects/{slug}/...` | Platform authentication + membership + the operation's effective project role/PAT limits |
| Published business routes | `/p/{slug}/{path}` | The **published endpoint's** authorizers/gates — management login is **not** automatic |
| Built-in project identity/file/run routes | `/p/{slug}/auth/...`, `/_token`, `/_files/...`, `/_runs/...` | Each with its own protocol and permissions; these names are platform-**reserved paths** |
| Overview reads | `/projects/{slug}/overview` | Ordinary management access, or the per-login narrowly scoped `vso_` reader — authorizing **no** neighboring management routes |

Per-surface contracts: [management authentication](../auth/management.md),
[endpoint authentication](../auth/endpoints.md),
[HTTP endpoints](../triggers/http.md) and
[error handling](../reference/errors.md). **Never** infer required roles
merely from "a GET succeeded".

## Management calls without copying tokens

After the [platform login](../getting-started/first-endpoint.md), use
the CLI's refreshable session:

```sh
viat call --console --method GET /version
viat call --console --method GET /projects
```

- The command prints status first, then the body — **not pure JSON**.
  `/version` returns an object like `{"version":"1.1.0"}`; `/projects`
  returns the projects visible to that platform identity. These reads
  publish and execute nothing. A project-scoped PAT is **not
  guaranteed** access to global `/projects` — use its known project and
  permitted routes.
- **Only when deliberately creating a temporary project under an unused
  slug**:

```sh
viat call --console --method POST /projects --body '{"slug":"api-docs-lab","name":"API Docs Lab"}'
```

  `slug` and `name` are both required strings; the response is the
  created project representation (including server-generated
  identity/state), not just the submission; an existing slug conflicts.
  Check the response and the [project rules](../projects/create-and-collaborate.md)
  before continuing. This example is source-checked — unlike the
  separately executed first-endpoint flow, this specific call is not a
  recorded executed response.
- Direct HTTP clients: supply proper credentials in
  `Authorization: Bearer ...` and the matching `Content-Type` on
  JSON-expecting routes. The platform access/refresh pair has
  **rotation semantics** — consumed refresh credentials cannot replay,
  and a failed session is never silently swapped for another account.
  Full lifecycle: the authentication references.

## Names, folders, methods and payloads

| Concern | Rule |
| --- | --- |
| Project identity | `{slug}` is the project slug — **not** a display name or UUID |
| Asset identity | Folder-contained scripts/resources/workflows use the bare `{name}` plus `?folder=...` on management routes; the CLI's `shared/lookup` is a convenience qualified name, **not** something that must become multiple URL path segments |
| Encoding | Percent-encode dynamic path segments and query values separately; **never** concatenate resource names containing `?`/`#` into URLs |
| Endpoint identity | Management actions use node UUIDs; calls use the published method/path — **not** that UUID |
| Create/update | POST/PUT/PATCH semantics vary per object — **never** assume PUT always replaces or PATCH is always JSON Merge Patch; read each feature's field table |
| Omitted/null/empty | Can mean keep, inherit, clear or reject; an empty array can be a **deliberate policy choice** |
| Secrets | Ordinary resource representations return digests/masks with **no** secret recovery; **never** submit a returned mask as a new secret |
| Pagination | No universal envelope: execution queries use `items`/`next_before`; other arrays, truncations and cursors differ |
| Tests | Test routes can execute current code or touch resources — the word "Test" **guarantees no** dry-run |

For example, reading a folder-qualified script explicitly:

```sh
viat call --console --method GET '/projects/hello-lab/scripts/lookup?folder=shared'
```

This needs a real project/script and read permission on that route.
Spelling matters too: scripts use `/{name}/test-run` while workflows use
`/{name}/test_run` — **never** unify hyphens and underscores by guess.

## Feature and API index

These are route families, **not** a promise that every prefix supports
every CRUD method; full requests/responses, conditional fields, errors,
permissions and side effects live in the owning reference pages.

| Capability | Management route family | Owning reference |
| --- | --- | --- |
| Project settings/members | `/projects/{slug}`, `/members`, `/members/{email}` | [Settings](../projects/settings.md), [collaboration](../projects/create-and-collaborate.md) |
| Resource config/Test/schema | `/projects/{slug}/resources`, `/{name}`, `/{name}/test`, `/{name}/schema/refresh` | [20 resource kinds](../assets/resources/index.md) |
| Database migrations | `.../resources/{name}/migrations` | [CLI database operations](../cli/db.md) |
| Managed files and business audit | `.../resources/{name}/files`, `.../audit`, `.../audit/export` | [Storage](../assets/resources/storage.md), [audit](../operations/audit.md) |
| Scripts, environments, artifacts | `/projects/{slug}/scripts`, `/{name}/env`, `/build`, `/artifact`, `/binary` | [Script context](../assets/scripts/context.md), [runtime](../assets/scripts/runtime.md), [CLI scripts](../cli/script.md) |
| Workflows | `/projects/{slug}/workflows`, `/{name}/validate`, `/{name}/test_run` | [Workflows](../assets/workflows/overview.md) |
| Endpoint/tree contracts | `/projects/{slug}/endpoints`, `/trees` | [HTTP](../triggers/http.md), [CRUD](../triggers/crud.md), [inbound WebSocket](../triggers/websocket-endpoints.md) |
| Publishing | `.../endpoints/{id}/publish`, `/unpublish`; `/projects/{slug}/publish/plan`, `/apply`, `/rollback`, `/history` | [Snapshots](../publishing/snapshots.md), [rollback](../publishing/rollback.md) |
| Schedules | `/projects/{slug}/schedules`, `/{name}/pause`, `/resume`, `/trigger`, `/runs` | [Schedules](../triggers/schedules.md) |
| Filesystem, RabbitMQ, outbound WebSocket | `/projects/{slug}/watches`, `/queue-triggers`, `/ws-triggers` | [Watches](../triggers/watches.md), [queues](../triggers/queues.md), [WS subscriptions](../triggers/websocket-subscriptions.md) |
| Chat accounts/identities/triggers | `/projects/{slug}/im/accounts`, `/identities`, `/bind-links`, `/triggers` | [Personal WeChat](../triggers/weixin.md) and the other provider pages |
| Authorization model | `/projects/{slug}/authz`, `/types`, `/rules`, `/subject-attrs`, `/lint` | [Authorization](../auth/authorization.md) |
| Observability | `/projects/{slug}/overview`, `/executions`, `/async-runs`, `/audit` | [Runs](../operations/runs.md), [logs](../operations/logs.md), [audit](../operations/audit.md) |
| Published project OpenAPI | `/projects/{slug}/openapi.json` | Next section |

Short suffixes within a cell are relative to the adjacent route family,
**not** global routes. An API capability existing **does not imply** a
matching CLI command or MCP tool; [CLI](../cli/overview.md) and
[MCP](../mcp/overview.md) have explicit inventories.

## Exporting the published application's OpenAPI

An authenticated project member can request:

```sh
viat call --console --method GET /projects/hello-lab/openapi.json
```

- The document is **OpenAPI 3.1.0**, built from the **current active
  published snapshot** and authorizer metadata; `servers` points at the
  instance base path plus `/p/{slug}`. Draft edits **do not**
  automatically change the public contract the active snapshot
  represents. The generated `info.version` is **not** the running
  server release — check that with `/version`.
- The export describes the project's **published calling interface**,
  **not** a complete management-API specification. It deliberately sits
  on a member-authenticated management route rather than a public
  `/p/{slug}/_openapi.json` — **never** invent the latter. Members may
  review and hand integration partners a redacted contract; the document
  itself issues no calling credentials and exempts no authz gates.
  Before using client generators, read the streaming/async/proxy/CRUD
  and schema limitations — **never** assume the generator encoded every
  runtime rule.

## Verification and safe cleanup

- Integrations should read and record **actual object IDs** first, then
  perform only intended modifications inside isolated namespaces while
  checking status and operation-specific result fields. Published ≠ all
  builds ready; async accepted ≠ completed; a resource Test can answer
  HTTP 200 with `ok: false` — general interpretation:
  [errors and outcome boundaries](../reference/errors.md).
- After stopping related triggers and resolving dependencies, remove
  only objects **the integration itself created**. Exported API
  contracts/logs, even without secrets, can expose private routes or
  data — store privately and explicitly clean temporary copies. This
  page executes no management examples and authorizes no production
  cleanup.

## Verification basis

Pinned source `03751a67`: route assembly in `crates/viat-api/src/lib.rs`,
`dto.rs`, the handlers, `handlers/openapi.rs`/`openapi.rs`, and the CLI
`commands/{endpoint,script}.rs`. Resource/language/CLI/MCP contracts are
pinned separately and never masquerade as a fully generated management
OpenAPI.
