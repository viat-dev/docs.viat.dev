---
title: "HTTP endpoints and dispatch"
description: "Create, bind, publish and operate HTTP script, workflow and proxy endpoints."
doc_id: triggers.http
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# HTTP endpoints and dispatch

Clients call `/p/<slug>/<path>`; management lives at
`/projects/<slug>/endpoints` — the two are not interchangeable. Branches
organize paths; an ordinary leaf binds one script/workflow and one HTTP
method; [CRUD](crud.md), [inbound WebSocket](websocket-endpoints.md) and
proxy mounts are distinct target kinds.

Three permission layers — keep them apart:

- Create/edit: project content-edit rights.
- Publish: project publish rights.
- Actual calls: decided solely by the **published** authorizers and gates — a
  console access token/PAT is not automatically an endpoint credential.

> [!NOTE]
> All examples here are source-derived, use synthetic data and are
> **unexecuted**; work in an isolated project.

## Create, read, call

First create the script `echo` (repo `scripts/echo.py`) and `viat push`:

```python
def main(name: str = "world"):
    return {"hello": name}
```

```http
POST /projects/demo/endpoints
Authorization: Bearer <console-token>
Content-Type: application/json

{"segment":"hello","method":"GET","script_name":"echo","allowed_authorizers":["public"],"overrides":{"query_params":{"name":{"type":"string","default":"world"}},"strict":true}}
```

Replace `public` with your project's actual public authorizer name — do not
guess. Creation returns an endpoint view (projection with unrelated optional
fields omitted):

```json
{"id":"00000000-0000-4000-8000-000000000001","tree_id":"00000000-0000-4000-8000-000000000002","parent_id":null,"segment":"hello","method":"GET","script_name":"echo","workflow_name":null,"path":"/hello","allowed_authorizers":["public"],"authz_gates":null,"override_authorizers":false,"override_permissions":false,"published_snapshot_id":null,"draft_dirty":false,"status":"unpublished","overrides":{"query_params":{"name":{"type":"string","default":"world"}},"strict":true}}
```

Then: read `GET /projects/demo/endpoints/<id>` with the returned id; publish
with `POST …/endpoints/<id>/publish` (body `{`); `GET /p/demo/hello?name=Ada`
should answer `{"hello":"Ada"}`. Keep the publish response and actually call
the public route — **never trust only the editor test**. Publish gates and
outputs: [snapshots](../publishing/snapshots.md).

## Creation fields

| Field | Meaning and default |
| --- | --- |
| `tree_id` | Optional UUID; omitted/null uses the default tree. |
| `parent_id` | Optional UUID within the chosen project/tree; omitted/null creates a root node. |
| `segment` | Required path segment; `:name` declares a path parameter; reserved paths and conflicts are server-checked. |
| `method` | `GET`/`POST`/`PUT`/`PATCH`/`DELETE`; omitted/null usually creates a branch, special targets differ. |
| `script_name`, `workflow_name` | Optional `folder/name`, mutually exclusive and exclusive vs proxy/CRUD/WS bindings; the target must exist. |
| `proxy_resource_name` | Optional `http_api` resource; proxy mounts set no method. |
| `proxy_strip_prefix` | Defaults to `true`. |
| `proxy_upstreams` | Optional "path-parameter value → fully qualified http_api resource" map; the whole mounted path must have exactly one path parameter; unmapped values use the default upstream. |
| `crud_resource_name`, `crud_config` | PostgreSQL CRUD binding, see [CRUD](crud.md). |
| `ws_config` | Inbound WebSocket binding, see [WebSocket endpoints](websocket-endpoints.md). |
| `allowed_authorizers` | Authorizer names; omitted/null inherits; the nearest declaration **replaces** ancestor lists — no accumulation. |
| `authz_gates` | `{type,action}` list; omitted/null inherits; **accumulates** down the tree until `override_permissions` cuts it off. |
| `override_authorizers`, `override_permissions` | Default `false`; set explicitly to bound inheritance. |
| `required_permissions` | Retired: non-empty rejected, empty no-op; use gates. |
| `overrides` | The contract object below; omitted/null means no override layer; `{}` is an explicitly present one. |
| `path_override` | Optional full leaf path; not for branches. |

Update semantics:

- `PUT …/endpoints/<id>/info` is a **partial update**: omitted keeps; explicit
  null clears `method`, `script_name`, `workflow_name`, `overrides`,
  `path_override` — binding constraints still apply; `segment:null` does
  **not** clear the segment; `crud_config`/`ws_config` replace wholesale on
  their targets, null/omitted is not a clear.
- Permissions go through `PUT …/<id>/auth`: `authz_gates` omitted keeps, null
  restores inheritance, an array declares; the other auth fields are **not**
  a generic merge patch — omitting authorizers restores inheritance and
  omitting an override boolean turns it false; read current values first.
- `PATCH …/<id>/move` takes `parent_id` (null/omitted moves to root);
  `DELETE …/<id>` can delete a **subtree**; platform-managed built-in auth
  nodes refuse destructive changes.

## Argument binding and coercion

The runtime receives a **flat parameter object**, not an HTTP request object:

- Undeclared path/query values are strings; JSON bodies keep JSON types.
- An empty body is legal; a non-empty ordinary body must be a JSON **object**
  (arrays, scalars and broken JSON are rejected).
- Merge order: required headers checked first → path → query (which
  **cannot** override path parameters) → body (which **can** override
  path/query); precedence follows the post-`as` parameter name; within one
  part, declared fields beat conflicting undeclared aliases.

> [!WARNING]
> When body pass-through is allowed, never treat a path value as an
> inviolable business identity — the body has higher precedence.

Declaration shape: `overrides.path_params`, `query_params`, `body_fields`
each map wire names to declarations. Every entry requires `type`
(`int|float|bool|string|json`); `required` defaults to false; optional
`default`, alias `as`, `nullable`.

- An optional without a default stays "absent" so the script's own default
  applies; defaults fill in by final parameter name after each part
  processes, so a same-named parameter from an earlier part already satisfies
  the existence check; `required` does not mean "must arrive from that
  specific part".
- Explicit null is not absence and never auto-replaces with a default. Body
  `nullable:true` admits null; false/omitted usually rejects scalar null;
  `json` accepts any JSON including null. `nullable:false` additionally
  states "deliberately different from a nullable script input" and affects
  publish lint. Path/query have no null representation.

String conversion: `int` parses signed 64-bit decimal; `float` parses finite
numbers; `bool` accepts case-insensitive `true/1/yes`/`false/0/no`; `string`
passes through; path/query `json` parses JSON text. Body strings coerce per
number/bool declarations; body `json` keeps strings; body numbers pass
through numeric conversion after which a valid JSON Schema may impose
stricter integer limits. Invalid, missing or unknown parameters return
`400 bad_request` before execution. `strict:false` passes undeclared
query/body through; `true` rejects them and requires every path parameter
declared at configuration time. Frozen effective-input-schema validation
activates only when an overrides object exists; omitting the layer entirely
keeps the older lenient dispatch.

## Full overrides fields

| Field | Default and constraints |
| --- | --- |
| `path_params`, `query_params`, `body_fields` | Default empty maps; declarations above. |
| `required_headers` | Default empty; case-insensitive **presence** check only — no value validation, no automatic script exposure. |
| `response_headers` | Default empty response-header map. |
| `response_transform` | Omitted/null: no transform; RFC 9535 JSONPath transforms JSON output before final response processing. |
| `rate_limit` | Omitted: unlimited. The optional `endpoint` and `subject` quotas each need positive `requests`/`window_secs` and optional positive `burst` (default = requests); **both buckets must pass**. `subject_key:identity` defaults to identity (anonymous degrades to IP); `ip` is always by IP. Without a shared backend, counting is instance-local; rejection is 429 with `Retry-After`. |
| `audit_reason` | Default `header.X-Viat-Reason`; also `body.<field>`, `none`. Whether a reason is mandatory is decided by the audit resource/table. |
| `raw_body` | Default false; exact bytes land in `ctx.request.body` (UTF-8) or `body_base64`, never in parameters; mutually exclusive with `body_fields`, multipart, cache. Webhook-verification headers additionally need project-settings exposure. |
| `multipart` | Omitted: off. `{max_file_bytes:0,max_files:0,fields:[]}`: 0 bytes uses the deployment cap, 0 files means one, empty fields accepts all text fields; files stream to disk as `ctx.request.files` handles; unlisted text fields are dropped. Per-file caps cannot exceed deployment storage limits. Exclusive with raw body, async, CRUD. |
| `run_async` | Default false; true always returns an async handle. Proxy, built-in auth, CRUD and WS do not support this mode. |
| `cache` | Omitted: off; GET script/workflow/CRUD only; `{ttl_secs,scope:"caller",vary_headers:[],ignore_params:[]}`; CRUD has no shared; exclusive with raw body, multipart, async, current-user grant. |
| `project_users_grant` | Optional `{roles:[]}`; the published script gains capabilities over users holding the listed **non-admin** roles only, never project admins; it does not grant the caller any role. |
| `current_user_grant` | Optional `{read_social_identity:false,provision_meta_keys:[]}`; uncached synchronous script endpoints only. Direct, test, library and queued executions lack this capability; the host verifies the current native-social/external-JWT identity and cannot name another user. |
| `strict` | Default false; true closes undeclared parameter ingress. |

## Responses, streams and the request lifecycle

- Plain return values emit JSON directly; an explicit `ViatResponse` controls
  status/headers/content type/body and may return managed files; script
  errors use the platform shape `{"error":"code","message":"detail"}`.
- Endpoint response headers/transforms execute at dispatch and **do not
  apply** to direct script tests; a draft test of an explicit response can
  show `output:null` while the real HTTP body is not null; saved cases
  compare the explicit response body separately.
- Streaming scripts emit chunked streams (Python/TypeScript generators in
  the script reference); **once the HTTP status is sent, later stream errors
  cannot change it**; proxied streams and files are not replayable buffered
  JSON.
- Client disconnect/timeout never rolls back committed resource writes: use
  business transactions and durable work records; never retry a mutating
  request merely because the response was lost.
- Ordinary buffered requests cap at **2 MiB** before running; multipart uses
  separate streaming/spill limits; proxied streaming bypasses this JSON cap.
  Run timeouts resolve from script/workflow budgets and deployment ceilings —
  there is no request-level "infinite timeout"; a proxy or load balancer can
  time out before a still-running script does.

## Async, idempotency and caching

**Async**: `X-Viat-Async:true` or `run_async:true` starts an async
script/workflow. `X-Viat-Delay` (seconds) or `X-Viat-Run-At` delays queuing
(mutually exclusive, up to 30 days out); `X-Viat-Tz` interprets local times.
The 202 answer carries `run_id`, `run_token`, `poll_path`; poll
`GET <poll_path>` with `X-Viat-Run-Token:<run_token>` — that token is a
single-run read capability, never log it. Async result storage cannot fully
express all streams, files and explicit HTTP responses and is not guaranteed
identical to synchronous rendering. Console cancellation:
`POST /projects/<slug>/async-runs/<id>/cancel`; best-effort cancellation may
answer `not_cancellable`/`already_finished`/`owner_unreachable` and never
undoes existing side effects. Multipart rejects async/delay and idempotency
headers; built-in auth/CRUD never go to the background; requesting delay on
an unsupported target is rejected.

**Idempotency**: authenticated synchronous `POST|PUT|PATCH|DELETE` may send
an `Idempotency-Key` of at most 255 bytes, isolated by project, method,
exact path and caller. The fingerprint covers query/body; the same key with
a different request conflicts; concurrent in-flight requests conflict rather
than re-execute; completed replays carry a replay marker. Anonymous eligible
keyed requests are rejected; GET, tests and proxies are outside this
guarantee. Successful and client-error buffered responses can be stored;
server errors, streams/files and responses over **256 KiB** are not.

> [!WARNING]
> Idempotency is best-effort retry protection, not business exactly-once:
> DB claim/save failures and stale-claim reclamation can re-execute.
> Irreversible actions still need business unique keys.

**Caching**: a GET cache key includes the publish snapshot/generation, bound
parameters (minus `ignore_params`), configured vary headers, and by default
the caller's identity/roles/claims. `shared` explicitly asserts the result is
caller-independent; a hit still runs authentication, authorization, rate
limiting and parameter binding. Only applicable successful buffered
responses are stored; inspect `X-Viat-Cache`. External DB writes do not
invalidate caches — call `POST …/endpoints/<id>/cache/purge` or
`ctx.cache.purge("GET /path")`; publishing/rolling back makes old answers
unreachable. User-management or caller-sensitive outputs must not configure
shared.

## Proxy and cleanup

A proxy binds an `http_api` resource and sets no method: it forwards **all**
methods under the prefix and strips the mount prefix by default. Published
authorizers/gates/rate limits/logs still apply, but script parameter binding,
background queues, response caching and platform idempotent replay are not
inserted. Resource credentials apply platform-side; inbound platform
authorization, cookies and hop-by-hop headers are filtered; optional identity
assertion is configured on the upstream resource. Resource settings stay
live — editing them immediately affects published mounts. Responses stream
through; **this HTTP proxy is not a WebSocket upgrade tunnel**. Transport
timeouts/outbound policy come from the HTTP resource and deployment, not
from script timeout annotations; callers must never choose arbitrary
upstream addresses.

Wrap-up: in an isolated fixture verify bad input, unauthorized callers,
legitimate callers and timeout/retry, checking rejection and execution logs
separately. To stop new calls, `POST …/<id>/unpublish` — **not** editing or
deleting the script. Before cleaning isolated endpoints/scripts, check
queued jobs and external side effects. Repo entry points are
`endpoints/*.get.yaml`-style method files, `viat push`,
`viat endpoint publish`, `viat call` — see [CLI](../cli/endpoint.md) and
[endpoint tests](../testing/endpoint-tests.md).

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/dto.rs`,
`handlers/endpoints.rs`, `handlers/dispatch.rs`, `handlers/proxy.rs`,
`handlers/async_runs.rs`, `idempotency.rs`, `endpoint_cache.rs`;
`crates/viat-core/src/types/endpoint.rs`;
`crates/viat-runtime/src/override_coerce.rs`. Examples are source-derived
and unexecuted; providers, proxies and load-balancer behavior need separate
authorized verification.
