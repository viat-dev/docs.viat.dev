---
title: HTTP API surfaces and request conventions
description: Choose the correct management or caller API, address assets precisely, interpret responses and export published endpoint OpenAPI.
doc_id: api.overview
verified_release: '1.1.0'
channel: stable
---

# HTTP API surfaces and request conventions

Viat has a **management API** for platform/project administration and a **caller API** for published application interfaces. They do not accept interchangeable identities. The CLI and console use management APIs; `viat call` without `--console` targets the caller API.

Paths below are relative to your instance base URL, including an operator-configured reverse-proxy/base-path prefix. Do not add `/ui` to the API base. Use HTTPS outside a trusted local fixture and keep credentials out of URLs, source files and shared transcripts.

## Select the right surface

| Surface | Representative path | Authentication and meaning |
| --- | --- | --- |
| Process probes | `/healthz`, `/readyz` | Deliberately unauthenticated and activation-exempt. A healthy process is not proof of license validity or runnable scripts. |
| Platform login/session | `/auth/login`, `/auth/refresh`, `/auth/sessions` | Platform account and the operation's session/MFA rules; not project end-user login. |
| Platform administration | `/users`, `/license`, `/admin/...` | Route-specific platform role/session rules. |
| Project management | `/projects/{slug}/...` | Platform authentication plus membership and the operation's effective project role/PAT constraints. |
| Published application route | `/p/{slug}/{path}` | The **published endpoint** authorizers/gates, not an automatic management login. |
| Built-in project identity/file/run routes | `/p/{slug}/auth/...`, `/_token`, `/_files/...`, `/_runs/...` beneath the project prefix | Separate documented caller protocols and permissions; these names are reserved platform paths. |
| Overview reader | `/projects/{slug}/overview` | Normal management access or the narrowly scoped per-login `vso_` reader. That token does not authorize adjacent management routes. |

[Management authentication](../auth/management.md), [endpoint authentication](../auth/endpoints.md), [HTTP endpoints](../triggers/http.md) and [error handling](../reference/errors.md) define the respective contracts. Do not infer a route's role merely because its HTTP method is GET.

## Make a management call without copying tokens

After completing [platform login](../getting-started/first-endpoint.md), use the CLI's ordinary refresh-aware session:

```sh
viat call --console --method GET /version
viat call --console --method GET /projects
```

The command prints status then body, rather than only JSON. `/version` returns a JSON object such as `{"version":"1.1.0"}`; `/projects` returns the projects visible to the platform identity. These reads do not publish or execute scripts. A project-confined PAT cannot be assumed to authorize global `/projects`; use its known project and permitted routes instead.

An explicit project-create request, **only when you intend to create a disposable project with an unused slug**, is:

```sh
viat call --console --method POST /projects --body '{"slug":"api-docs-lab","name":"API Docs Lab"}'
```

Both `slug` and `name` are required strings. The response is the created project representation, including server-generated identity/state, not just the submitted object. Existing slugs conflict. Inspect the response and [project rules](../projects/create-and-collaborate.md) before continuing. This example is source-derived; unlike the independently tested first-endpoint walkthrough, this exact invocation is not an executed response record.

For a direct HTTP client, provide the appropriate bearer in `Authorization: Bearer ...` and JSON `Content-Type` when the route expects JSON. The platform access/refresh pair has rotation semantics; do not replay a consumed refresh credential or silently replace a failed session with an unrelated account. The full lifecycle is in the authentication reference.

## Names, folders, methods and payloads

| Concern | Rule |
| --- | --- |
| Project identity | `{slug}` is the project slug, not its display name or UUID. |
| Asset identity | A script/resource/workflow in a folder uses its bare `{name}` plus `?folder=...` on the relevant management route. CLI qualified names such as `shared/lookup` are a convenience, not necessarily literal path segments. |
| Encoding | Percent-encode each dynamic path segment and query value. Do not concatenate a resource name containing `?`/`#` into an unescaped URL. |
| Endpoint identity | Management actions use the endpoint node UUID. Caller requests use the published method/path, not that UUID. |
| Create/update | POST, PUT and PATCH semantics vary by object. Do not assume PUT always means replace or PATCH always means JSON Merge Patch; use the feature's field table. |
| Omitted/null/empty | These may mean preserve, inherit, clear or reject depending on the field. Empty arrays can be explicit policy choices. |
| Secrets | Ordinary resource representations return summaries/redaction, not secret recovery. Do not send returned mask placeholders back as new secrets. |
| Pagination | There is no universal envelope. Execution queries have `items`/`next_before`; other lists, capped results and cursors differ. |
| Tests | A test route may execute current code or contact a resource. The word test does not make it a dry-run. |

For example, a qualified script read addresses the folder explicitly:

```sh
viat call --console --method GET '/projects/hello-lab/scripts/lookup?folder=shared'
```

It requires that project/script and the route's read permission. The exact case-sensitive path spellings also matter: scripts use `/{name}/test-run`, while workflows use `/{name}/test_run`. Do not normalize hyphens/underscores by guesswork.

## Feature-to-API index

These are route families, **not** a claim that every listed prefix supports every CRUD method. Follow the owning reference for complete bodies, responses, conditional fields, errors, permissions and side effects.

| Capability | Management route family | Owning reference |
| --- | --- | --- |
| Project settings/members | `/projects/{slug}`, `/members`, `/members/{email}` | [Settings](../projects/settings.md), [collaboration](../projects/create-and-collaborate.md) |
| Resource configuration/Test/schema | `/projects/{slug}/resources`, `/{name}`, `/{name}/test`, `/{name}/schema/refresh` | [20 resource references](../assets/resources/index.md) |
| Database migrations | `.../resources/{name}/migrations` | [CLI database operations](../cli/db.md) |
| Managed files and business audit | `.../resources/{name}/files`, `.../audit`, `.../audit/export` | [Storage](../assets/resources/storage.md), [audit](../operations/audit.md) |
| Scripts, environments, artifacts | `/projects/{slug}/scripts`, `/{name}/env`, `/build`, `/artifact`, `/binary` | [Script context](../assets/scripts/context.md), [runtime](../assets/scripts/runtime.md), [CLI scripts](../cli/script.md) |
| Workflows | `/projects/{slug}/workflows`, `/{name}/validate`, `/{name}/test_run` | [Workflow reference](../assets/workflows/overview.md) |
| Endpoint/tree contracts | `/projects/{slug}/endpoints`, `/trees` | [HTTP](../triggers/http.md), [CRUD](../triggers/crud.md), [inbound WebSocket](../triggers/websocket-endpoints.md) |
| Publication | `.../endpoints/{id}/publish`, `/unpublish`; `/projects/{slug}/publish/plan`, `/apply`, `/rollback`, `/history` | [Snapshots](../publishing/snapshots.md), [rollback](../publishing/rollback.md) |
| Schedules | `/projects/{slug}/schedules`, `/{name}/pause`, `/resume`, `/trigger`, `/runs` | [Schedules](../triggers/schedules.md) |
| Filesystem, RabbitMQ, outbound WebSocket | `/projects/{slug}/watches`, `/queue-triggers`, `/ws-triggers` | [Watches](../triggers/watches.md), [queues](../triggers/queues.md), [WS subscriptions](../triggers/websocket-subscriptions.md) |
| Chat accounts/identity/triggers | `/projects/{slug}/im/accounts`, `/identities`, `/bind-links`, `/triggers` | [Personal WeChat](../triggers/weixin.md) and other provider pages |
| Authorization model | `/projects/{slug}/authz`, `/types`, `/rules`, `/subject-attrs`, `/lint` | [Authorization](../auth/authorization.md) |
| Observability | `/projects/{slug}/overview`, `/executions`, `/async-runs`, `/audit` | [Runs](../operations/runs.md), [logs](../operations/logs.md), [audit](../operations/audit.md) |
| Published project OpenAPI | `/projects/{slug}/openapi.json` | Section below |

Within a cell, a short suffix is relative to the family immediately preceding it, not a global route. An API capability does not imply a corresponding CLI command or MCP tool; the [CLI](../cli/overview.md) and [MCP](../mcp/overview.md) inventories are explicit.

## Export the published application's OpenAPI

An authenticated project member can request:

```sh
viat call --console --method GET /projects/hello-lab/openapi.json
```

The document uses **OpenAPI 3.1.0** and is built from **active published snapshots**, plus authorizer metadata. Its `servers` entry points to the instance base path plus `/p/{slug}`. Draft edits do not automatically change the public contract represented by active snapshots. The generated `info.version` is not the running server release identifier; use `/version` for that.

This export describes the project's published caller interfaces, **not a complete management API specification**. It is intentionally a member-authenticated management route, not a public `/p/{slug}/_openapi.json` route. Do not invent the latter. A member can review and share a sanitized contract with an integrator; the document itself does not grant a caller credential or waive authz gates. Inspect descriptions for streaming, async, proxy/CRUD and schema limitations before assuming a client generator can encode every runtime rule.

## Verification and safe cleanup

For integrations, start with reads, record actual object IDs, then perform only explicitly intended mutations in an isolated namespace. Verify both response status and operation-specific fields. Publication does not imply all builds are ready; async acceptance does not imply completion; resource Test can return HTTP 200 with `ok: false`. [Errors and result boundaries](../reference/errors.md) provides the shared decision rules.

Remove only objects created by the integration after stopping their triggers and resolving dependencies. Exported API contracts/logs may expose private routes or data even without secrets; store them privately and remove disposable copies deliberately. This page does not execute its management examples or authorize production cleanup.

## Verification basis

Pinned source `03751a67`: API route assembly in `crates/viat-api/src/lib.rs`, `dto.rs`, owning handlers, `handlers/openapi.rs`/`openapi.rs`, and CLI `commands/{endpoint,script}.rs`. Resource/language/CLI/MCP contracts are pinned separately; they are not passed off as a full generated management OpenAPI.
