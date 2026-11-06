---
title: "RabbitMQ queue triggers"
description: "Complete AMQP trigger configuration, acknowledgement mapping, ordering and recovery."
doc_id: triggers.queues
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# RabbitMQ queue triggers

A queue trigger consumes an existing RabbitMQ queue through a project **amqp** resource and runs a live script/workflow per delivery. No endpoint targets, RocketMQ/MQTT connector or publish step. Every queue-trigger management/read/fire-history API requires project **content-edit rights**, unlike the membership-only schedule/watch APIs. Broker topology, publish routing, durability, DLX/DLQ, delivery limits and consumer timeout are operator responsibilities; saving a trigger does not create or test the queue.

## Complete creation and response

Source-derived/unexecuted example; first create amqp resource `mq`, existing broker queue `demo.incoming`, and `ingest` script:

```python
def main(message, message_meta):
    return {"accepted": True, "message_id": message_meta["message_id"]}
```

```http
POST /projects/demo/queue-triggers/incoming
Authorization: Bearer <console-token>
Content-Type: application/json

{"resource":"mq","queue":"demo.incoming","max_concurrent_runs":1,"ack_deadline_override":false,"target":{"kind":"script","name":"ingest"},"inputs":{},"enabled":false}
```

The name is in the **path**, not a required body field. Create/update return the row; list/show additionally expose recent_fires. Row example:

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"incoming","enabled":false,"resource":"mq","queue":"demo.incoming","max_concurrent_runs":1,"ack_deadline_override":false,"target_kind":"script","target_name":"ingest","inputs":{},"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| Field | Default / constraints |
| --- | --- |
| `resource` | Required project amqp resource, qualified name allowed; credentials stay platform-side. |
| `queue` | Required, nonblank, <=255 bytes, no control characters; passively consumed, broker owns declaration. |
| `max_concurrent_runs` | 1; integer 1–16, also broker prefetch. |
| `ack_deadline_override` | false; explicitly bypasses save-time timeout safety check, not a broker timeout change. |
| `target` | Existing `{kind:script|workflow,name:"folder/name"}`. |
| `inputs` | Defaults null; runtime merges object constants. Prefer explicit `{}`. Reserved message/message_meta overwrite constants. |
| `enabled` | API/repo default **true**, including full PUT. **Console new form defaults paused/false**. Send false through API to stage safely. |
| `expected_updated_at` | Optional/null unconditional update; PUT precondition uses exact returned timestamp including fractional seconds. Mismatch is 409 with no fields applied. Not needed on create. |

`PUT …/queue-triggers/<name>` replaces all config, resets omitted optional fields to defaults; required fields cannot be null. Use `POST …/<name>/enabled {"enabled":false}` for a narrow emergency pause, avoiding stale full-form overwrite. The console includes expected_updated_at when saving; on conflict reopen current data and intentionally merge, never blindly drop the precondition. Edits/enabled changes reconcile in about ten seconds and execution config changes restart the consumer; already running deliveries retain their start configuration.

## Ack deadline and actual delivery contract

Save rejects resource missing/wrong kind, nonexistent target, invalid queue/concurrency, or deployment `VIAT_MAX_ASYNC_TIMEOUT_SECS` (default 1800) exceeding `VIAT_QUEUE_ACK_DEADLINE_SECS` (default 1500), unless override true. Thus untouched deployment defaults can **refuse** a new trigger: raise ack deadline to match the real broker consumer_timeout, lower runtime ceiling, or explicitly override after verifying broker settings. Otherwise a long execution may be redelivered while it is still running. Override does not prevent duplicates.

Args are `message` (JSON-decoded body; non-JSON becomes `{raw_body_b64:"…"}`), `message_meta:{message_id,routing_key,redelivered}`, plus constants. Runs use the queue-trigger system principal, not an HTTP caller. Resource authorization and target timeout still apply. There is **no dedup ledger**: delivery is at-least-once and scripts must tolerate duplicates, even with message_id present.

| Run outcome | Broker action |
| --- | --- |
| Success | ack. |
| Script refusal/client-error classification | nack with requeue false: dead-letter if broker DLX is configured, otherwise message can be discarded. |
| Timeout, overload, transport/internal/server failure | nack with requeue true. Broker delivery policy bounds poison loops; Viat does not provide a universal retry count/backoff. |
| Missing project/deleted or unresolvable target | ack with recorded config-error reason, avoiding an endless requeue storm. Repair config does not resurrect this acknowledged delivery. |

Broker acknowledgement failure/connection loss can redeliver after the side effect succeeded. Fire history is observability, not authoritative broker state. Do not claim that absence of DLQ always retains refused messages. A script's explicit HTTP-like response is not a substitute for understanding the runner's error classification; use refusal/error APIs intentionally.

## Ordering, backpressure, operations and cleanup

The concurrency semaphore and basic_qos prefetch share the configured limit. At 1, one consumer handles messages one-at-a-time. With several Viat instances/other consumers, configure **x-single-active-consumer:true** on the broker queue if global ordered handling matters; concurrency 1 alone is not a cross-consumer total order. Above 1 completion order can differ. Requeue/reconnect can alter arrival order even in a serial flow. The broker arbitrates consumers, not a Viat claim ledger.

`GET /projects/<slug>/queue-triggers`, `GET …/<name>`, `GET …/<name>/fires` show config and delivery history. Each fire has `id,trigger_id,execution_id,message_id,routing_key,redelivered,outcome,detail,fired_at`, outcome ack/dlq/requeue. Check broker unacked/ready counts, dead-letter routing and runtime logs together. Connectivity failures back off/reconnect; missing broker permissions/queue are operator repairs, not reasons to repeatedly recreate the trigger.

No standalone queue-trigger CLI commands: `queue_triggers/<name>.yaml` and `viat pull/push --only queue_triggers` are supported. Mirror push can remove remote triggers absent locally, so review diff. Test only with an explicitly authorized isolated queue/DLQ: success, refusal, timeout and redelivery. Pause before cleanup, account for in-flight/unacked work, then DELETE the trigger. This does not delete/purge broker queues, requeue acknowledged messages or undo external writes. Manual DLQ replay needs separate approval and business deduplication; cancellation/pause is not transactional rollback.

Evidence: `crates/viat-api/src/handlers/queue_triggers.rs`, `queue_trigger.rs`; `crates/viat-core/src/types/queue_trigger.rs`; `crates/viat-cli/src/repo/queue_triggers.rs`; console queue trigger editor/tests. Examples source-derived/unexecuted, no broker/network call performed.
