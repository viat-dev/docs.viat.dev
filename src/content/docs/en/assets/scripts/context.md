---
title: 'Script context and helper APIs'
description: 'Request, principal, arguments, resources and platform helpers.'
doc_id: script.context
verified_release: '1.1.0'
channel: stable
---

# Script context and helper APIs

Python imports `ctx` from `viat`; TypeScript imports it from `"viat"`. It is bound per request, even in a reused worker. Python `main` receives keyword arguments; TypeScript `main` receives one argument object (and may receive `ctx` as its second parameter). The argument map is not `ctx.request`: path/query/body fields have already been bound by the endpoint. Do not expect arbitrary JSON body keys to appear unless its binding accepts them.

```python
from viat import ctx

def main(name: str = "world"):
    ctx.logger.info("greet", who=name)
    return {"hello": name, "method": ctx.request.method,
            "admin": ctx.principal.is_admin}
```

A direct draft run with `{"name":"Ada"}` returns a body containing `hello: "Ada"`; `method` is null without an HTTP request. Identity depends on the authenticated run and must not be hard-coded in an assertion.

## Data fields

| Field | Shape and semantics |
| --- | --- |
| `ctx.project_id` | Current project ID. Never a caller-selected project capability. |
| `ctx.request.request_id`, `.ip` | Trace/request identifier and platform-resolved client address; IP may be null. |
| `.method`, `.path`, `.query` | HTTP method, **wire path** (not route pattern), raw query string without `?`; null when no HTTP request. Percent encoding is preserved. A schedule targeting an endpoint has method/path but no caller IP or headers. |
| `.headers` | Lowercase keys; fixed allowlist `x-request-id`, `x-forwarded-for`, `x-real-ip`, `accept`, `accept-language`, `content-type`, `user-agent`, `referer`, plus project `exposed_headers`. Never `authorization`, `cookie` or `x-viat-*`. These are untrusted input, not identity. |
| `.body`, `.body_base64` | Raw-body endpoint only: verbatim UTF-8 text, or base64 when not UTF-8. Otherwise null. Raw body does not populate arguments. |
| `.files` | Multipart upload handles: `{field, filename, content_type, size, path}`. Files are not body arguments. Paths expire after the run; store a handle through a storage resource to retain it. |
| `ctx.principal` | `user_id`, `identity`, `role`, `authorizer`, `claims`, `is_admin`. Fields can be null; do not infer authorization from missing values. No permission-string list. |
| `ctx.resources` | Declared resources, resolved at run start; Python attribute access (`getattr(ctx.resources, "folder/name")` for non-identifiers), TypeScript object/bracket access. Config values and intentional secret reads are different from authentication credentials. |
| `ctx.trigger` | WebSocket-trigger metadata `{trigger,event,route,message_id,connection_id}` or null. Not a universal trigger-history object. |

The platform decides trusted proxy handling before setting `.ip`. Reading a caller-written forwarding header directly is not a replacement. Multipart and raw-body behavior require endpoint configuration; they cannot be enabled by a script header. Multipart file handles cannot be deferred to an async run.

## Logging and progress

Python: `ctx.logger.debug/info/warn/error(message, **fields)`; TypeScript: `ctx.logger.info(message, fields)` and corresponding levels. `.sensitive(message, fields)` masks **field values**, not the message text: never put a credential in the message. Plain `print`/`console.log` is captured as output, not executed as a protocol frame. Avoid sensitive data even when a sink masks known secrets.

Python `ctx.progress(percent=50, message="halfway")`; TypeScript `ctx.progress(50, "halfway")` reports detached-run progress, not a return value. Progress on a synchronous run can be dropped. Prefer completion checks against the final run status, not 100% progress.

## Resource call input/output

Prefer broker helpers: the platform opens the connection and applies resource authentication. Do not extract credentials or reconstruct authentication headers. Some legacy connection-shaped projections differ; declaring a resource is not a guarantee that every field in every language is credential-free. Intentional `secret` reads and resolved `config` values are application data; treat their outputs as sensitive.

| Python call | TypeScript call | Result |
| --- | --- | --- |
| `ctx.resources.api.get("/health")` | `await ctx.resources.api.get("/health")` | Decoded JSON or text body; non-2xx raises a typed refusal. Python `raw=True` / TS `{raw:true}` returns bytes. |
| `api.post("/items", json={"name":"A"})` | `await api.post("/items", {json:{name:"A"}})` | Body; options can include query, headers and timeout. Resource's own policy still applies. |
| `db.query("SELECT :id AS id", {"id": 1})` | `await db.query("SELECT :id AS id", {id:1})` | `{rows:[...], affected:n}`; named parameters are bound. `.execute` is for writes. |
| `gql.query(document, variables, operation)` | `await gql.query(document, variables, operation)` | Upstream GraphQL `data`, not its envelope. |
| `model.chat(messages, max_tokens=100)` | `await model.chat(messages, {max_tokens:100})` | `{content,model,usage,tool_calls}`; no automatic tool execution. |
| `get_resource("token")` imported from `viat` | `await getResource("token")` imported from `viat` | Intentional secret value or null. |
| `set_resource("token", "new")` imported from `viat` | `await setResource("token", "new")` | Updates an existing declared `secret`; current run's resource snapshot is not a live mutable config view. |

There are **20 resource kinds** in this release, not just this table. Push `.send(...)` and AMQP `.publish(...)` exist; a successful send means provider/broker acceptance, not recipient delivery. Queue consumption is a trigger rather than an AMQP helper method. The [per-kind resource references](../resources/index.md) own their options, authorization gates and limits. Do not substitute a raw SDK call if you need broker auditing or resource policy.

## Authorization, cache and user administration

`ctx.authz.check(type, action, attrs)` returns a boolean (await in TypeScript). `require(...)` returns normally if allowed, otherwise raises `403 forbidden`. `attrs` is the object's attribute map, not a list of claimed permissions. Endpoint gates and row scopes remain independent of a script's own checks.

`ctx.cache.purge("GET /reports/:id")` returns the purge result (await in TS). Use a method, exactly one space, and a path with no query/fragment; this invalidates cached replies after a write, not stored business rows.

`ctx.project.users` and `.roles` administer the project's **end users**, not platform users. These operations require `ctx.principal.is_admin`; role-grant/escalation guards also apply. `users.get(identity)`, `.list(...)`, `.create(identity, ...)`, `.set_password(identity, password)`, `.set_role(identity, role)`, `.set_active(identity, active)`, `.set_meta(identity, meta)` operate on that project. TypeScript uses camelCase for compound helper names. User responses exclude passwords. Current-user social-identity reads and metadata provisioning are narrower, explicitly granted synchronous published-script operations, not generic admin bypasses; they are unavailable to workflows, tasks and direct tests.

## WebSocket and tasks

`ctx.ws` exposes `connection_id/event/route/reason` for the socket event, otherwise null. Python `send(id,data)` returns whether a known connection accepted the frame; `close(id,code=1000,reason="")` returns no value; `join(id,room)`/`leave(id,room)` return booleans; `broadcast(room,data,exclude=[])` returns addressed count; `members(room)` and `connections(user_id)` return lists. TypeScript methods are async. Close code is 1000 or 4000–4999. This is platform acceptance, not client receipt.

`ctx.tasks.enqueue/get/cancel` exists only in Python and TypeScript; see [Async tasks](async-tasks.md). Rust has its own SDK methods rather than a Python-shaped context; shell has environment variables and helpers; SQL, GraphQL, viat_gql and llm have no `ctx`. See each [language reference](python.md) and [runtime response handling](runtime.md).
