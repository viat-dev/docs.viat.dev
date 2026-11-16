---
title: "Outbound WebSocket subscriptions"
description: "Connect to external JSON feeds with script routing, signed opens, heartbeats and optional acknowledgement."
doc_id: triggers.websocket-subscriptions
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Outbound WebSocket subscriptions

In this direction **Viat is the client**: it dials an external feed and
routes incoming JSON messages to live **scripts**. It is not an
[inbound WebSocket endpoint](websocket-endpoints.md), not a workflow
trigger, and not an arbitrary binary SDK.

Boundaries:

- Every config/status API requires project **content-edit rights**.
- URL/headers are a **server egress capability**: respect private-network
  egress restrictions and keep credentials in secret references.
- There is no publish step and no snapshot — configuration is live; save-time
  validation is not a real-feed compatibility test, and URL validation does
  not guarantee the transport is fully immune to DNS rebinding.

## Full creation example

First create the script `feeds/on_event`
(`def main(message): return {"received": True}`); it runs as
system:ws_trigger, receives `message`, and has no HTTP `ctx.request`.
Source-derived, unexecuted:

```http
POST /projects/demo/ws-triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"orders","enabled":false,"config":{"url":"wss://feed.example.invalid/events","headers":{},"routes":{"$default":{"script":"feeds/on_event"}},"message_id_path":"$.id","ack":{"frame":{"type":"ack","id":"{{message_id}}"}},"heartbeat":{"frame":{"type":"ping","ts":"{{now_ms}}"},"every_secs":30},"idle_timeout_secs":120,"hold":"single","max_concurrent":1,"queue_capacity":1000,"on_overflow":"disconnect","log_messages":"errors"}}
```

The response carries `id,name,enabled,config,created_at,updated_at`; config
echoes defaults, routes appear as
`{script_id:"<uuid>",script:"feeds/on_event"}` (name null after script
deletion). Save the id/name and read status before enabling. This page
connected to no feed.

| Field | Default/limits |
| --- | --- |
| `name` | Required; 1–64 ASCII letters/digits/`_-.`. |
| `enabled` | API/repo default true; explicit false enables staged creation. |
| `config.url` | Required; ws:// or wss://; checked against egress policy at save. |
| `headers` | `{}`; valid header names without control characters; a full value `$secret:<name>` resolves server-side — missing or non-secret targets **fail the save**. |
| `routes` | Required; script/script_id map (UUID wins), at least one message route; `$open` runs before connecting, `$default` is the fallback; ordinary route names are 1–128 ASCII letters/digits/underscore/hyphen/dot/colon, no spaces, no leading `$`. |
| `route_path` | Optional RFC9535 JSONPath; **required when named message routes exist** — otherwise everything goes to default. |
| `message_id_path` | Optional JSONPath; **required when `ack` is configured**. |
| `ack` | Optional `{frame:<JSON>}`; sent after successful execution. |
| `heartbeat` | Optional `{frame:<JSON>,every_secs:<positive>}`; an application-layer heartbeat, distinct from native ping/pong. |
| `idle_timeout_secs` | Default 120 (≥5); any received frame refreshes liveness; the native ping interval is half of it. |
| `hold` | Default `single` (lease-based single connection); `per_instance` connects once per instance. |
| `max_concurrent` | Default 1; 1–64 per connection. |
| `queue_capacity` | Default 1000; 1–100000. |
| `on_overflow` | Default `disconnect`; or `drop_oldest` (drops and counts the oldest waiting messages). |
| `log_messages` | Default `errors`, optionally `all`; failures and opens always log. |

Unknown config/ack/heartbeat fields are **rejected**, never silently
defaulted. `PUT /projects/<slug>/ws-triggers/<name>` fully replaces
name/enabled/config — not a patch: omission restores optional defaults; null
clears optional JSONPath/ack/heartbeat but never required values/maps/
booleans; routes as read can be written back verbatim. Reconciliation
reconnects within ~10 seconds, and script edits also take effect over new
connections. **Other triggers supporting workflows does not mean this one
does.**

## The open script and message context

- `$open` runs before each connection and may return
  `{url?,headers?,frames?}`: replace the URL, override same-named headers,
  and send frames immediately after connecting. A computed URL is still
  checked against the egress policy.
- Open inputs/outputs are **not retained** (they may contain credentials);
  only execution success/failure is logged — never print secrets yourself.
- Text frames: JSON parses to values, non-JSON text arrives as a string;
  `route_path` picks the named route or default; a message value starting
  with `$` **cannot** select open. Binary frames are dropped and counted,
  never reaching the script.
- `ctx.trigger` carries `trigger/event/route/message_id/connection_id`;
  event is open/message; every reconnect is a new connection_id.
- A script's return value is **never** auto-sent as a socket reply — the
  outbound protocol is defined by ack/heartbeat/open frames.
- Templates replace only the whole strings `{{message_id}}` and `{{now_ms}}`
  preserving types; `id={{message_id}}` is literal text. Compute signatures
  in script code — there is **no** further template language to invent.

## Delivery, status and recovery

- With ack configured: acknowledgement happens **after successful
  execution**; failures/timeouts/disconnects do not ack. At-least-once
  depends on the feed actually redelivering unacknowledged messages —
  durable actions still deduplicate by message id.
- Messages matching no route with no default are **dropped and acked**,
  preventing deliberately ignored types from looping forever.
- Without ack there is no replay/retry guarantee at all: messages in a
  disconnect gap are lost and failures never retry locally.
- At concurrency 1, execution follows arrival order; above that, completion
  acks immediately. `drop_oldest` **deliberately loses data**;
  `disconnect` relies on upstream replay — neither is a durable local queue.

Observability: `GET /projects/<slug>/ws-triggers` and `GET …/<name>` read
config; `GET …/<name>/status` returns `{name,enabled,connections:[…]}` —
per instance connecting/connected/backoff/standby/stopped, timing/
last_error, and received/acked/failed/dropped counters (reset when the task
is rebuilt). Reconnect backoff is 2–60 seconds, reset after 30 healthy
seconds. Execution logs use method `WST:open` or `WST:message:<route>` with
path `/_ws_trigger/<name>`; credential-bearing URLs are never logged — the
display strips userinfo/query, which does not license putting secrets in
the path.

Verify against a **local synthetic feed**, covering: successful ack, failure
without ack, overflow, reconnect, duplicate ids. Before retrying, check
last_error → egress policy → secrets → the signing script → provider
limits. Cleanup: full PUT keeping config but disabled; `DELETE` revokes no
in-flight side effects and no provider subscription `$open` already
established — provider-side cleanup needs separate authorization. The repo
file `ws_triggers/<name>.yaml` supports pull/push
(`--only ws_triggers`); note API routes are objects while repo routes are
script strings, and there is no standalone WS-trigger CLI/MCP.

## Verification basis

Contract source `03751a67`: `crates/viat-core/src/types/ws_trigger.rs`;
`crates/viat-api/src/handlers/ws_triggers.rs`, the WS-trigger
connection/message implementation and flow tests;
`crates/viat-cli/src/repo/ws_triggers.rs`. Examples unexecuted; no external
feed compatibility is claimed.
