---
title: "Outbound WebSocket subscriptions"
description: "Connect to external JSON feeds with script routing, signed opens, heartbeats and optional acknowledgement."
doc_id: triggers.websocket-subscriptions
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Outbound WebSocket subscriptions

Viat is the **client**, dialing an external feed and running live **scripts only**. This is not an [inbound WebSocket endpoint](websocket-endpoints.md), workflow trigger or arbitrary binary SDK. Project content-edit rights are required for all config/status APIs. A configured URL/headers is a server egress capability; respect outbound private-network restrictions and keep credentials in secret references. No publish gate/snapshot applies.

## Complete creation example

Existing script `feeds/on_event` can be `def main(message): return {"received": True}`; it runs as `system:ws_trigger`, receives `message` but no HTTP `ctx.request`. Source-derived/unexecuted example:

```http
POST /projects/demo/ws-triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"orders","enabled":false,"config":{"url":"wss://feed.example.invalid/events","headers":{},"routes":{"$default":{"script":"feeds/on_event"}},"message_id_path":"$.id","ack":{"frame":{"type":"ack","id":"{{message_id}}"}},"heartbeat":{"frame":{"type":"ping","ts":"{{now_ms}}"},"every_secs":30},"idle_timeout_secs":120,"hold":"single","max_concurrent":1,"queue_capacity":1000,"on_overflow":"disconnect","log_messages":"errors"}}
```

Response includes `id,name,enabled,config,created_at,updated_at`; config echoes defaults and routes as `{script_id:"<uuid>",script:"feeds/on_event"}` (name null after deletion). Save returned id/name, then inspect status before enabling through a complete PUT. No feed was contacted here.

| Field | Default / constraints |
| --- | --- |
| `name` | Required 1–64 ASCII letters/digits/`_-.`. |
| `enabled` | API/repo true; explicit false stages safely. |
| `config.url` | Required ws:// or wss://, outbound guard checked. |
| `headers` | `{}`; valid header names/no control characters. Entire value `$secret:<name>` resolves a project secret server-side. Missing/non-secret references fail save. |
| `routes` | Required map to script/script_id, UUID wins. At least one message route. `$open` preconnect, `$default` fallback; named routes 1–128 ASCII alphanumeric/underscore/hyphen/dot/colon (no spaces or leading `$`). |
| `route_path` | Optional RFC9535 JSONPath; required with named message routes, otherwise every message uses default. |
| `message_id_path` | Optional JSONPath; required when ack configured. |
| `ack` | Optional `{frame:<JSON>}`; success-only frame. |
| `heartbeat` | Optional `{frame:<JSON>,every_secs:<positive integer>}`; application heartbeat, distinct from native ping/pong. |
| `idle_timeout_secs` | 120, >=5; any received frame resets liveness. Native ping interval is half this. |
| `hold` | single leased connection default; per_instance connects every instance. |
| `max_concurrent` | 1, range 1–64 per connection. |
| `queue_capacity` | 1000, range 1–100000. |
| `on_overflow` | disconnect default, or drop_oldest (discard/count oldest waiting message). |
| `log_messages` | errors default, or all; failures and open runs always logged. |

Unknown config/ack/heartbeat keys fail rather than silently defaulting. `PUT /projects/<slug>/ws-triggers/<name>` is full replacement with name/enabled/config, not patch. Omission resets optional config defaults, null clears optional JSONPath/ack/heartbeat but not required values/maps/non-nullable booleans. Route reads round-trip to writes. Reconciliation reconnects in roughly ten seconds; script edits also take effect through a fresh connection. No workflow route support, even when another trigger accepts workflows.

## Open script and message context

`$open` runs before each connect and may return `{url?,headers?,frames?}`: URL replaces configured URL, headers override same names, frames send immediately after connection. Computed URL is rechecked against outbound policy. Open inputs/outputs are not retained because they may contain credentials; execution success/failure is logged. Do not print secrets yourself. Save-time validation is not a live credential/feed compatibility test; URL validation also does not guarantee DNS-rebinding-proof transport.

Text JSON parses to its value, non-JSON text becomes a string. `route_path` selects a named route or `$default`; a value starting `$` cannot select `$open`. Binary frames are dropped/counted, not passed as bytes. Scripts see `ctx.trigger.{trigger,event,route,message_id,connection_id}`; event is open/message, connection_id changes at every reconnect. Return data is **not** automatically sent as an arbitrary socket reply; configured ack/heartbeat/open frames define this outbound protocol.

Templates replace only a whole JSON string exactly `{{message_id}}` or `{{now_ms}}`, retaining its type; `id={{message_id}}` is literal text, not interpolation. Use a script for computed signatures, not a guessed template language.

## Delivery, status and recovery

With ack, successful execution sends ack after success; failure/timeout/disconnect sends none. At-least-once **depends on the feed actually redelivering unacked messages**; deduplicate durable actions on message id. Unmatched messages with no default are dropped **and acked**, preventing infinite redelivery of intentionally ignored types. Without ack there is no replay/retry guarantee: messages during reconnect gaps are lost, failed runs are not locally retried. max_concurrent 1 preserves arrival execution order; greater values overlap and ack on completion. Overflow drop_oldest deliberately loses messages; disconnect relies on upstream replay. This is not a durable local queue.

`GET /projects/<slug>/ws-triggers` and `GET …/<name>` read config; `GET …/<name>/status` returns `{name,enabled,connections:[…]}` with per-instance connecting/connected/backoff/standby/stopped rows, timestamps/last_error and received/acked/failed/dropped counters. Counts reset with the task. Reconnect waits grow 2–60 seconds, reset after 30-second healthy connection. Execution log method is `WST:open` or `WST:message:<route>`, path `/_ws_trigger/<name>`, never the credential-bearing URL. URLs shown to operators redact userinfo/query, not a reason to put secrets in path components.

For opted-in testing use a local synthetic feed, exercise success ack, failure no-ack, overflow, reconnect and duplicate message id. Check last_error, egress policy, secret references, signer script and provider limits before retrying. Disable by full PUT preserving config; DELETE removes the trigger but does not undo running side effects or provider subscriptions already created by $open. Explicitly remove isolated provider-side subscription state with approval. Repo `ws_triggers/<name>.yaml` supports pull/push `--only ws_triggers`; API route maps use objects while repo routes use script strings. No standalone WS-trigger CLI/MCP tool exists.

Evidence: `crates/viat-core/src/types/ws_trigger.rs`; `crates/viat-api/src/handlers/ws_triggers.rs`, WebSocket-trigger connection/message implementation and flow tests; `crates/viat-cli/src/repo/ws_triggers.rs`. Examples not executed; no external feed compatibility is asserted.
