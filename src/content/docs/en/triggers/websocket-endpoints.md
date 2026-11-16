---
title: "Inbound WebSocket endpoints"
description: "Publish script-routed sockets that clients connect to, including tickets and connection lifecycle."
doc_id: triggers.websocket-endpoints
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Inbound WebSocket endpoints

This is the direction where **clients connect to Viat**: a GET leaf upgrades
to a socket and routes messages to scripts. It is a different object from the
outward-dialing [WebSocket subscriptions](websocket-subscriptions.md).
Events (connect/message/disconnect) run **scripts only** — no workflow
targets. It suits low-rate turn-based interaction, not frame-synchronized
game loops, durable brokers or binary protocols.

Three sentences on permissions and model:

- Editing needs content-edit rights; publish/rollback needs publish rights;
  the handshake applies the **published** authorizers, gates and endpoint
  rate limits.
- The principal is established at connect time and re-checked periodically;
  events run under the runtime's resource permissions and timeouts — a
  socket never grants project-management powers.
- The console's Test opens the **real published socket**, not a draft test.

## Create, publish, connect

Source-derived, unexecuted. First create the script `game/echo`:
`def main(message): return message`.

```http
POST /projects/demo/endpoints
Authorization: Bearer <console-token>
Content-Type: application/json

{"segment":"play","ws_config":{"route_key":"type","routes":{"$default":{"script":"game/echo"}},"message_rate_limit":{"requests":20,"window_secs":10},"log_messages":"errors"},"allowed_authorizers":["password"]}
```

Creation returns the ordinary endpoint view: `method:"GET"`, `path:"/play"`,
`ws_config.routes.$default:{"script_id":"<uuid>","script":"game/echo"}`,
null script/workflow bindings, not yet published. Save the id and
`POST …/endpoints/<id>/publish {}`; a plain GET without upgrade answers
**426**.

Browsers cannot set an Authorization header on WebSocket, so exchange a
one-time ticket:

```http
POST /p/demo/_ws/ticket
Authorization: Bearer <endpoint-credential>

HTTP/1.1 200 OK
Content-Type: application/json

{"ticket":"<one-use-ticket>","expires_in":30}
```

Connect within 30 seconds via
`wss://api.example.invalid/p/demo/play?ticket=<ticket>`. Server/mini-program
clients can set the bearer directly in the handshake — **never put a
long-lived token in the URL**. Sending
`{"type":"echo","id":1,"text":"hello"}` hits `$default`, which replies with
one text frame echoing it.

## The full `ws_config`

| Field | Default and validation |
| --- | --- |
| `routes` | Required; a route → `{script}` or `{script_id}` map, UUID winning when both are present; scripts must belong to this project; lifecycle-only routing is invalid — at least one message route is required. |
| Route names | `$connect`, `$disconnect`, `$default`, or 1–64 lowercase ASCII letters/digits/underscores. |
| `route_key` | Default `"type"`; the string field of the message object used for routing. |
| `message_rate_limit` | Optional `{requests,window_secs,burst?}`, positive values, burst defaulting to requests; counted **per connection**; exceeding drops the message and returns an error frame. |
| `log_messages` | Default `errors`, optionally `all`; failures and lifecycle always log; errors mode keeps no successful-message logs or lines. |

`PUT …/endpoints/<id>/info {"ws_config":{…}}` **replaces wholesale** on a WS
target (omitted/null does not clear). Reads return id and current name (null
after the script is deleted — renaming loses no binding). Configuration,
route-script source and eligible dependencies freeze at publish per the
script snapshot rules; edits need a republish, and rollback restores the old
content, see [snapshots](../publishing/snapshots.md).

## Events and the push contract

`ctx.ws` carries `connection_id`, `event` (`connect|message|disconnect`) and
`route`, plus `reason` on disconnect:

- Message events receive `{message:<object>}`; lifecycle events carry no
  message.
- `$connect` may read the handshake `ctx.request`; returning ≥400 or throwing
  **refuses the upgrade** — the connection does not exist yet, so pushing to
  self is dropped.
- Inbound messages must be **JSON object** text frames; unknown routes go to
  `$default` or answer `unknown_route`. A non-null JSON return (or explicit
  response body) sends one frame; null sends nothing.
- Message-level errors usually **do not close the connection**; they answer
  an error frame:

```json
{"type":"error","error":"unknown_route","message":"…","id":1}
```

  Other codes: `bad_frame`, `rate_limited`, `overloaded` and runtime error
  codes.
- `$disconnect` runs after the current message completes and **cannot** reply
  to the already-closed socket; reasons include `client`, `server`, `idle`,
  `lifetime`, `revoked`, `overloaded`, `handshake_failed`, `instance_lost`.

Push APIs available to project scripts: `ctx.ws.send(id,data)`,
`close(id,1000|4000..4999,reason)`, `join(id,room)`, `leave`,
`broadcast(room,data,exclude=[…])`, `members(room)`,
`connections(user_id)` (await in TypeScript). A room is a 1–200 character
string within the project; other projects' connection ids are invisible to
it.

> [!WARNING]
> A successful `send` does **not** mean the client received it: pushes are
> at-most-once, cross-instance capable, and ordered within one script's
> calls; durable state must be recovered by your code after reconnect. Rooms
> are cleaned once disconnect handling finishes — the handler can still read
> the old membership while it runs.

## Ordering, limits and recovery

- **Ordering**: one connection runs messages serially in arrival order, with
  queue depth `VIAT_WS_QUEUE_DEPTH` defaulting to 32; overflow drops that
  message but keeps the connection. Different connections run concurrently —
  use database transactions/locks for shared state. There is no automatic
  retry or idempotency ledger; put business ids in your frames.
- **Limits**: default frame cap 64 KiB (`VIAT_WS_MAX_MESSAGE_BYTES`);
  10,000 connections per instance (`VIAT_WS_MAX_CONNECTIONS`, excess gets
  503 + `Retry-After`); maximum lifetime 86,400 seconds; identity re-checked
  every 300 seconds. Token expiry alone does not disconnect — but user
  deactivation, authorizer deletion, session revocation, role/admin changes
  and API-key expiry/revocation disconnect with **4401** at recheck.
- **Close codes**: ping every 30 seconds, two misses close with **1001**;
  binary frames get **1003**; lifetime/idle use 1001; slow readers close
  with **1008** after 256 pending frames or a blocked write; graceful
  restart uses **1012** (refusing new connections and running disconnect
  cleanup within a deadline). After an instance is unreachable for 90
  seconds, surviving instances run one disconnect for stranded connections;
  a recovered old instance closes its reclaimed connections and processes
  nothing twice.
- **Proxies and recovery**: reverse proxies must forward
  Upgrade/Connection with a long enough read timeout; use WSS and the client
  platform's socket-domain allowlists. Reconnecting produces a new
  connection id — **never** expect missed pushes to be replayed.
- **Verify and clean up**: [fixtures](../testing/fixtures.md) can verify
  handler decisions; real transport still needs explicitly authorized socket
  testing. Unpublishing stops new handshakes and revokes no past event side
  effects; close test sockets, clean rooms via those closes, then delete the
  isolated endpoint/scripts.

Repository side: `endpoints/play.get.yaml` uses
`target:{kind:websocket,routes:{…}}`, synced via `viat pull/push` and
published with the endpoint/project CLI.

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/websocket.rs`;
`crates/viat-api/src/handlers/endpoints.rs`, `handlers/snapshots.rs`, the
WebSocket dispatch/session modules and tests;
`crates/viat-cli/src/repo/endpoints.rs`. No transport or provider calls were
executed for this page.
