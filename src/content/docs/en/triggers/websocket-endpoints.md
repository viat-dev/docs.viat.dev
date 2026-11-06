---
title: "Inbound WebSocket endpoints"
description: "Publish script-routed sockets that clients connect to, including tickets and connection lifecycle."
doc_id: triggers.websocket-endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Inbound WebSocket endpoints

Here **clients connect to Viat**. [WebSocket subscriptions](websocket-subscriptions.md) dial outward and are a different object. A GET leaf upgrades to a socket and runs **scripts only**, not workflows, on connect/message/disconnect. It suits low-rate turn-based interaction, not a frame-synchronization game loop, durable broker or binary protocol.

Content-edit rights manage the endpoint; publish rights publish/rollback it. The handshake enforces the published authorizers, gates and endpoint rate limit. Principal identity is fixed at connect and periodically revalidated. Each event uses ordinary runtime resource permissions and timeout budgets; a connected socket does not grant generic project-administration capabilities.

## Create, publish, connect

Source-derived/unexecuted example: create `game/echo` first, with `def main(message): return message`.

```http
POST /projects/demo/endpoints
Authorization: Bearer <console-token>
Content-Type: application/json

{"segment":"play","ws_config":{"route_key":"type","routes":{"$default":{"script":"game/echo"}},"message_rate_limit":{"requests":20,"window_secs":10},"log_messages":"errors"},"allowed_authorizers":["password"]}
```

Creation returns the normal endpoint view with `method:"GET"`, `path:"/play"`, `ws_config.routes.$default:{"script_id":"<uuid>","script":"game/echo"}`, null ordinary script/workflow bindings, and unpublished status. Read back the endpoint id and publish `POST …/endpoints/<id>/publish {}`. A non-upgrade GET returns **426**.

Browsers cannot set Authorization on `WebSocket`; exchange a credential for a one-use ticket:

```http
POST /p/demo/_ws/ticket
Authorization: Bearer <endpoint-credential>

HTTP/1.1 200 OK
Content-Type: application/json

{"ticket":"<one-use-ticket>","expires_in":30}
```

Connect within 30 seconds to `wss://api.example.invalid/p/demo/play?ticket=<ticket>`. Server-side/mini-program clients may instead set `Authorization: Bearer …` in the handshake. Never put the long-lived bearer in the URL. Send `{"type":"echo","id":1,"text":"hello"}`; `$default` receives and returns that object as one text frame. Console Test opens a **real published socket**, not an unpublished draft.

## Complete `ws_config`

| Field | Default / validation |
| --- | --- |
| `routes` | Required route → `{script}` or `{script_id}` map; UUID wins when both are supplied. Every script must be in the project. At least one message route, not only lifecycle routes. |
| Route names | `$connect`, `$disconnect`, `$default`, or 1–64 lowercase ASCII letters/digits/underscore. |
| `route_key` | `"type"`; incoming object field containing a string route name. |
| `message_rate_limit` | Optional `{requests,window_secs,burst?}`, positive values, burst defaults to requests; per connection. Over limit drops that message and sends an error. |
| `log_messages` | `errors` default or `all`. Failures/lifecycle runs always logged; successful message logs and their lines omitted in errors mode. |

`PUT …/endpoints/<id>/info {"ws_config":{…}}` replaces the whole config on a WebSocket target; absent/null does not clear it. Reads return script ids plus current names (null name if deleted); ids preserve bindings across renames. Config, route script source and eligible dependencies freeze on publish using script snapshot rules; edits need republishing. Rollback restores old route/script content. See [snapshots](../publishing/snapshots.md).

## Event and push contract

`ctx.ws` carries `connection_id`, `event` (`connect|message|disconnect`), `route`, and disconnect `reason`. Message args are `{message:<object>}`; lifecycle events have no message argument. `$connect` sees handshake `ctx.request`; returning status >=400 or raising refuses upgrade. A push to itself during `$connect` is dropped because it is not open yet. Message input must be a JSON object text frame; unknown route uses `$default` or sends `unknown_route`. Return non-null JSON (or explicit response body) to reply; null sends no frame. Errors do not normally close the connection:

```json
{"type":"error","error":"unknown_route","message":"…","id":1}
```

Other frame codes include `bad_frame`, `rate_limited`, `overloaded` and ordinary runtime error codes. `$disconnect` runs after the current message finishes and cannot reply to the closed socket. Reasons include `client`, `server`, `idle`, `lifetime`, `revoked`, `overloaded`, `handshake_failed`, `instance_lost`.

Project scripts can `ctx.ws.send(id,data)`, `close(id,1000|4000..4999,reason)`, `join(id,room)`, `leave`, `broadcast(room,data,exclude=[…])`, `members(room)`, `connections(user_id)`; TypeScript awaits them. Rooms are project-local 1–200-character strings. IDs from other projects are unknown. Send acceptance is **not client receipt**. Push is at-most-once, cross-instance, ordered from one script; reconnect must recover durable state. Rooms are cleaned after disconnect handling, allowing that handler to inspect prior membership.

## Ordering, limits and recovery

One connection executes messages serially in arrival order, queue depth `VIAT_WS_QUEUE_DEPTH` default 32. Overflow refuses a message but leaves the socket open. Different connections execute concurrently: use database transactions/locks for shared state. No automatic message retry or idempotency ledger exists; put business ids in frames.

Defaults: max frame 64 KiB (`VIAT_WS_MAX_MESSAGE_BYTES`), per-instance connections 10000 (`VIAT_WS_MAX_CONNECTIONS`, excess 503 + Retry-After), lifetime 86400 seconds, revalidation every 300 seconds. Token expiry alone does not close a connection; user deactivation, authorizer removal, session revocation, role/admin changes or API-key expiry/revocation can close it at revalidation (**4401**). The server pings every 30 seconds; two silent intervals close **1001**. Binary frames close **1003**; lifetime/idle close 1001; slow readers may close **1008** (256 queued outbound frames or blocked writes). Graceful restart uses **1012**, refuses new connections and allows bounded disconnect cleanup. After a dead instance's heartbeat is absent for 90 seconds a survivor runs stranded disconnect cleanup once; a recovered old holder closes reaped sockets without repeating it.

Proxy/load balancer must forward Upgrade/Connection and allow sufficiently long read timeouts; use WSS and the client platform's domain allowlist. Reconnect creates a new id; recover state from durable storage, never rely on delivery during a gap. Verify with [fixtures](../testing/fixtures.md) for handler decisions and an explicitly authorized real socket test for transport. Unpublish to stop new handshakes; do not assume it cancels all existing event side effects. Close test sockets, remove rooms through closure, then remove isolated endpoints/scripts.

Repo: `endpoints/play.get.yaml` with `target:{kind:websocket,routes:{…}}`; sync using `viat pull/push`, publish through endpoint/project CLI. Source evidence: `crates/viat-core/src/types/websocket.rs`; `crates/viat-api/src/handlers/endpoints.rs`, `handlers/snapshots.rs`, WebSocket dispatch/session modules and tests; `crates/viat-cli/src/repo/endpoints.rs`. No transport/provider calls were executed for this page.
