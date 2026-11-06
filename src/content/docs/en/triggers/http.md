---
title: "HTTP endpoints and dispatch"
description: "Create, bind, publish and operate HTTP script, workflow and proxy endpoints."
doc_id: triggers.http
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# HTTP endpoints and dispatch

A client calls `/p/<slug>/<path>`. Management uses `/projects/<slug>/endpoints`; a console access token/PAT is not automatically an endpoint credential. Endpoint creation/editing requires a project role with content-edit rights; publishing requires publish rights. Caller access is independently determined by the **published** authorizers and authorization gates. Branches organize paths; ordinary leaves bind one script or workflow and one HTTP method. [CRUD](crud.md), [inbound WebSocket](websocket-endpoints.md) and proxy mounts are distinct target kinds.

All examples below are source-derived and **unexecuted**, using synthetic data. They are instructions for an isolated project, not evidence of a live deployment.

## Create and read

First create a script named `echo` with this source (for example `scripts/echo.py` in a repo, then `viat push`).

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

Use the project's actual public authorizer name, not a guessed one. The creation response is the endpoint view, for example (projection; unrelated optional fields omitted):

```json
{"id":"00000000-0000-4000-8000-000000000001","tree_id":"00000000-0000-4000-8000-000000000002","parent_id":null,"segment":"hello","method":"GET","script_name":"echo","workflow_name":null,"path":"/hello","allowed_authorizers":["public"],"authz_gates":null,"override_authorizers":false,"override_permissions":false,"published_snapshot_id":null,"draft_dirty":false,"status":"unpublished","overrides":{"query_params":{"name":{"type":"string","default":"world"}},"strict":true}}
```

Read the saved id with `GET /projects/demo/endpoints/<id>`. Publish using `POST …/endpoints/<id>/publish` with `{}`; then `GET /p/demo/hello?name=Ada` produces `{"hello":"Ada"}`. Record the publish response and check the public route, not only the editor test. See [snapshots](../publishing/snapshots.md) for gates and output.

## Creation fields

| Field | Meaning and default |
| --- | --- |
| `tree_id` | Optional UUID; omitted/null selects the default tree. |
| `parent_id` | Optional UUID in the selected project/tree; omitted/null creates a root. |
| `segment` | Required path segment; `:name` declares a path parameter. Server validates reserved paths and collisions. |
| `method` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`; absent/null creates a branch unless another target kind supplies its own semantics. |
| `script_name`, `workflow_name` | Optional qualified `folder/name`; mutually exclusive with each other and proxy/CRUD/WS bindings. Target must exist. |
| `proxy_resource_name` | Optional `http_api` resource; a proxy mount must have no method. |
| `proxy_strip_prefix` | Boolean, default `true`. |
| `proxy_upstreams` | Optional value → qualified `http_api` resource map; requires exactly one path parameter across the mount path. Unmapped values use the default upstream. |
| `crud_resource_name`, `crud_config` | PostgreSQL CRUD binding; see [CRUD](crud.md). |
| `ws_config` | Inbound WebSocket binding; see [WebSocket endpoints](websocket-endpoints.md). |
| `allowed_authorizers` | List of authorizer names; absent/null inherits. The nearest declaration replaces ancestors rather than accumulating. |
| `authz_gates` | List of `{type,action}`; absent/null inherits. Gates accumulate up the tree until `override_permissions` stops the walk. |
| `override_authorizers`, `override_permissions` | Default `false`; explicitly control inheritance boundaries. |
| `required_permissions` | Retired: nonempty lists are rejected, an empty list is a no-op. Use gates. |
| `overrides` | Optional contract/dispatch object, detailed below; absent/null means no endpoint overrides. `{}` is an explicitly present override layer. |
| `path_override` | Optional full leaf path; invalid on branches. |

`PUT …/endpoints/<id>/info` is partial: absent fields keep their values; explicit null clears `method`, `script_name`, `workflow_name`, `overrides`, `path_override`, subject to binding invariants. `segment:null` does not clear the segment. `crud_config` and `ws_config` replace entire objects on matching target kinds; null/omission is not a clearing operation. Auth is a separate `PUT …/<id>/auth`: `authz_gates` absent preserves, null inherits, array declares. Other auth fields are not a generic merge patch: omitted authorizers become inheritance and omitted override booleans become false. Read before changing auth. `PATCH …/<id>/move` takes `parent_id` (null/omitted reroots); deletion uses `DELETE …/<id>` and can remove a subtree. System-managed auth nodes reject destructive edits.

## Argument binding and coercion

The runtime receives one flat argument object, not an HTTP request object. Unconfigured path/query values are strings; JSON body fields retain JSON types. Empty body is accepted; a nonempty ordinary body must be a JSON **object**, not an array, scalar or malformed JSON. Header presence is checked first. Binding order is path → query (cannot overwrite a path argument) → body (**can overwrite path/query**). Precedence uses the final argument name after `as` renaming. Declared fields win over undeclared fields colliding with their alias within a section. Do not treat a path value as unchangeable business identity if body passthrough can shadow it.

`overrides.path_params`, `query_params`, `body_fields` are wire-name → declaration maps. Each declaration has required `type` (`int|float|bool|string|json`), `required:false`, optional `default`, optional `as` argument name, optional `nullable`. Missing optional fields with no default stay absent; a script default may then apply. Defaults fill missing argument names after each section, so an argument already supplied in an earlier section satisfies that presence check. `required` is not an independent requirement to send the field in that exact section. Explicit null is not a missing/defaulted field. `nullable:true` passes body null through; false/absent ordinarily refuses null for scalar types; `json` accepts any JSON value including null. Setting `nullable:false` also acknowledges the deliberate mismatch with a nullable script input for publish lint. Path/query have no nullable spelling.

String conversion: `int` parses signed 64-bit decimal; `float` parses a finite number; `bool` accepts case-insensitive `true/1/yes` or `false/0/no`; `string` stays literal; path/query `json` parses JSON text. Body string values are converted for numeric/bool declarations, while body `json` leaves a string as a string. Body numbers pass numeric coercion, then effective JSON Schema may impose a stricter integer constraint. Invalid/missing/unknown input returns `400 bad_request` before execution. `strict:false` passes undeclared query/body keys; `true` rejects them and requires every path parameter to be declared at configuration time. Effective frozen input-schema validation applies when an overrides object is present; absent overrides retain loose legacy dispatch.

## Complete overrides surface

| Field | Default / constraints |
| --- | --- |
| `path_params`, `query_params`, `body_fields` | Empty maps; field declarations above. |
| `required_headers` | Empty list; presence check is case-insensitive, not a value/schema check. Does not itself expose headers to scripts. |
| `response_headers` | Empty map of response header values. |
| `response_transform` | Absent/null is identity; RFC 9535 JSONPath transforms JSON output before final response handling. |
| `rate_limit` | Absent is unlimited. Optional `endpoint` and `subject` quotas each require positive `requests`, `window_secs`; optional positive `burst` defaults to requests. Both buckets must admit. `subject_key:identity` defaults to caller identity, anonymous falls back to IP; `ip` always uses IP. Limits are instance-local unless the deployment uses its shared backend; rejection is 429 with `Retry-After`. |
| `audit_reason` | Default `header.X-Viat-Reason`; also `body.<field>` or `none`. Required reasons are determined by the audited resource/table. |
| `raw_body` | `false`; exact body bytes appear as `ctx.request.body` text or `body_base64` for non-UTF-8, not arguments. Excludes `body_fields`, multipart and cache. Use for webhook signatures; expose required signature headers in project settings. |
| `multipart` | Absent is off. `{max_file_bytes:0,max_files:0,fields:[]}`: zero bytes uses deployment maximum, zero files means one, empty fields accepts all text fields. File parts spool to `ctx.request.files`; unlisted text fields are dropped. Per-file limit cannot exceed deployment storage ceiling. Excludes raw body, async and CRUD. |
| `run_async` | `false`; always return an async handle when true. Not supported for proxy/native-auth/CRUD/WS targets. |
| `cache` | Absent is off; GET script/workflow/CRUD only; `{ttl_secs,scope:"caller",vary_headers:[],ignore_params:[]}`. CRUD cannot use shared scope. Excludes raw body, multipart, async and current-user grants. |
| `project_users_grant` | Optional `{roles:[]}`; published script capability limited to listed non-admin roles, never project administrators. Not a role grant for the caller. |
| `current_user_grant` | Optional `{read_social_identity:false,provision_meta_keys:[]}`; uncached synchronous script endpoint only. No grant in direct/test/library/queued executions. Host validates the current native-social/external-JWT identity; cannot name another user. |
| `strict` | `false`; closed argument contract when true. |

## Responses, streaming and request lifetime

An ordinary return value is JSON. An explicit `ViatResponse` controls status, headers, content type and body (including managed-file responses); a script error uses the platform error shape `{"error":"code","message":"detail"}`. Endpoint response headers/transforms apply at dispatch, not to a direct script test. An explicit-response **draft script test** can report `output:null`: that is not proof the HTTP response body is null. Saved cases compare the explicit response's body separately.

Streaming scripts return chunked streaming output; Python/TypeScript generator paths and language-specific APIs are described in the scripting references. A response cannot change its already-sent HTTP status after the stream starts. Proxy streaming and file responses are not replayable buffered JSON. Client disconnect/timeout does not undo already committed resource writes. Use business transactions and durable work records; never retry a mutating request solely because its response was lost.

Ordinary buffered requests are capped at **2 MiB** before runtime. Multipart has its own streaming/spooling ceilings; proxy mounts forward streaming bodies rather than applying this JSON limit. Runtime timeout is the resolved script/workflow budget under deployment ceilings, not a configurable per-request unlimited timeout. A proxy/load-balancer timeout can be shorter than a still-running script.

## Async, idempotency and cache

`X-Viat-Async:true` or `run_async:true` requests an async script/workflow run. `X-Viat-Delay` seconds or `X-Viat-Run-At` time queues delayed work (mutually exclusive, up to 30 days; `X-Viat-Tz` interprets local times). A 202 response carries `run_id`, `run_token`, `poll_path` (and queued timing metadata where applicable). Poll `GET <poll_path>` with `X-Viat-Run-Token:<run_token>`. Treat the token as a single-run read capability. Keep it out of logs. Async result storage cannot represent every streaming/file/explicit response shape; do not promise identical synchronous HTTP rendering. Console cancellation is `POST /projects/<slug>/async-runs/<id>/cancel`; cancellation is best effort, can report `not_cancellable`, `already_finished`, or `owner_unreachable`, and cannot roll back completed side effects. Multipart requests reject async/delay and idempotency headers. Native-auth/CRUD requests do not become background runs; delayed requests to unsupported targets are refused.

For authenticated synchronous `POST|PUT|PATCH|DELETE`, `Idempotency-Key` (max 255 bytes) scopes replay to project, method, concrete path and caller. The fingerprint covers query/body; reusing a key for a different request conflicts. A concurrent in-flight request returns conflict rather than executing again; completed replay includes the replay marker. Anonymous callers are refused for eligible keyed requests. GET/test/proxy paths are not this contract. Success and client-error buffered responses may be retained; server errors, streaming/file responses and bodies over **256 KiB** are not retained. This is best-effort retry protection, not exactly-once business execution: DB claim/storage failure and stale claim reclamation can permit another run. Use a business uniqueness key for irreversible effects.

GET response cache keys include published snapshot/generation, bound arguments (except `ignore_params`), configured varied headers and, by default, caller identity/role/claims. `shared` explicitly asserts caller-independent output. Authentication, authorization, rate checks and binding still run on hits. Only eligible buffered successful responses are stored; inspect `X-Viat-Cache`. External database writes do not automatically invalidate answers: purge with `POST …/endpoints/<id>/cache/purge` or `ctx.cache.purge("GET /path")`. Publish/rollback makes old answers unreachable. Do not cache user administration or caller-sensitive output as shared.

## Proxy mounts and cleanup

A proxy binds an `http_api` resource and no method, forwarding every method under its prefix. Strip-prefix defaults true. Normal published authorizers/gates/rate limits/logging still apply, but no script argument binding, async queue, response cache or platform idempotent replay is inserted. Resource credentials are applied server-side; incoming platform authorization, cookies and hop-by-hop headers are filtered. Optional identity assertion is configured on the upstream resource. Upstream resource settings remain live: editing them can affect an existing published mount without republishing. Upstream response bodies stream; upgrade to WebSocket is not this proxy's supported tunnel. Its transport timeout and outbound network policy come from the HTTP resource/platform, not a script timeout annotation. Never expose an arbitrary caller-selected destination.

Verify malformed input, forbidden callers, allowed callers and timeout/retry behavior in an isolated endpoint fixture. Inspect refusal **and** runtime logs. To stop new calls unpublish the leaf (`POST …/<id>/unpublish`); editing/deleting a script is not a safe substitute. Delete the isolated endpoint/script only after pending async work and external effects are accounted for. Repo entry points are `endpoints/*.get.yaml` (and other methods), `viat push`, `viat endpoint publish`, `viat call`; see the [CLI](../cli/endpoint.md) and [endpoint tests](../testing/endpoint-tests.md).

## Maintenance evidence

Source: `crates/viat-api/src/dto.rs`, `handlers/endpoints.rs`, `handlers/dispatch.rs`, `handlers/proxy.rs`, `handlers/async_runs.rs`, `idempotency.rs`, `endpoint_cache.rs`; `crates/viat-core/src/types/endpoint.rs`; `crates/viat-runtime/src/override_coerce.rs`. Examples were derived from these paths, not executed. Provider/proxy/load behavior requires separate opt-in verification.
