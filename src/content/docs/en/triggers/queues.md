---
title: "RabbitMQ queue triggers"
description: "Complete AMQP trigger configuration, acknowledgement mapping, ordering and recovery."
doc_id: triggers.queues
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# RabbitMQ queue triggers

A queue trigger consumes an existing RabbitMQ queue through a project
**amqp** resource and runs a live script/workflow per delivery. There is no
publish step, no endpoint target and no RocketMQ/MQTT connector — those need
explicit adapters.

Three boundaries to start with:

- Every management/read/fire-history API requires project **content-edit
  rights** — unlike the membership-only schedule/watch APIs.
- Broker topology, routing, durability, DLX/DLQ, delivery limits and consumer
  timeout belong to broker operations; **saving a trigger neither creates
  nor tests the queue**.
- Executions run as the queue-trigger system principal, not the HTTP caller;
  resource authorization and target timeouts still apply.

## Full create and response

Source-derived, unexecuted. First create the amqp resource `mq`, the broker
queue `demo.incoming` and the script `ingest`:

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

The name rides in the **path**, not the body. Create/update returns the row
(list/detail additionally carry recent_fires):

```json
{"id":"00000000-0000-4000-8000-000000000001","project_id":"00000000-0000-4000-8000-000000000002","name":"incoming","enabled":false,"resource":"mq","queue":"demo.incoming","max_concurrent_runs":1,"ack_deadline_override":false,"target_kind":"script","target_name":"ingest","inputs":{},"created_at":"2026-11-06T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}
```

| Field | Default/limits |
| --- | --- |
| `resource` | Required; a project amqp resource name, folder allowed; credentials stay platform-side. |
| `queue` | Non-blank, ≤255 bytes, no control characters; **passive** consumption — the broker owns declarations. |
| `max_concurrent_runs` | Default 1; integer 1–16; doubles as the broker prefetch. |
| `ack_deadline_override` | Default false; bypasses the save-time timeout safety check and **never modifies the broker**. |
| `target` | An existing `{kind:script\|workflow,name:"folder/name"}`. |
| `inputs` | Default null; object constants merged at runtime. Prefer `{}` — kept message/message_meta names override same-named constants. |
| `enabled` | API/repo and full-PUT default **true**, but **the console creates paused (false)**; staged API creation must send false explicitly. |
| `expected_updated_at` | Optional/null: unconditional update; a PUT should echo the returned timestamp with fractional seconds; a mismatch answers 409 and applies **no field**; not needed on create. |

`PUT …/queue-triggers/<name>` fully replaces: omitted optionals revert to
defaults, required fields cannot be null. For an emergency pause use
`POST …/<name>/enabled {"enabled":false}` instead of a stale full form. The
console saves with expected_updated_at; on conflict, reopen the current data
and merge deliberately — never blindly drop the precondition. Changes
reconcile within ~10 seconds; execution-config changes restart the consumer,
while in-flight deliveries keep their startup configuration.

## Ack deadline and real deliveries

Save-time rejections: missing/wrong-typed resource, missing target, invalid
queue/concurrency, or a deployment where
`VIAT_MAX_ASYNC_TIMEOUT_SECS` (default 1800) exceeds
`VIAT_QUEUE_ACK_DEADLINE_SECS` (default 1500) — unless override is true.

> [!WARNING]
> An all-defaults deployment may therefore be **unable to save** a new
> trigger. Raise the deadline or lower the runtime ceiling per the broker's
> real consumer_timeout, or verify the broker and override deliberately. A
> still-running long task can still get redelivered — **the override does not
> prevent duplicates**.

Script parameters: `message` (JSON-parsed; non-JSON arrives as
`{"raw_body_b64":"…"}`), `message_meta`
(`message_id,routing_key,redelivered`), plus constants. **There is no
deduplication ledger**: delivery is at-least-once, and business logic must be
idempotent even with a message_id.

| Run outcome | Broker action |
| --- | --- |
| Success | ack. |
| Script rejection / client-error classification | nack, requeue=false; dead-letters via a configured DLX, otherwise possibly dropped. |
| Timeout, overload, transport/internal/server failure | nack, requeue=true; the broker's redelivery policy bounds the poison loop — Viat has no generic retry count/backoff. |
| Project missing, target deleted/unresolvable | **ack with a logged config error** (avoiding infinite requeue); fixing the config revives no already-acked message. |

A side effect succeeding but the ack failing/disconnecting still allows
redelivery; fire history is observability, not broker truth. Never claim a
rejected message is preserved without a DLQ; an explicit HTTP-style response
does not replace the runner's error classification — use the rejection/error
APIs properly.

## Ordering, backpressure, operations, cleanup

- The concurrency semaphore and `basic_qos` prefetch share the limit: 1 means
  one consumer processing sequentially; for a global order across multiple
  Viat instances/other consumers, configure
  **`x-single-active-consumer:true`** on the broker — "concurrency 1" alone
  is not a cross-consumer total order. Above 1, completions can reorder;
  requeue/reconnect can reorder arrivals even when serial — the broker
  arbitrates, not a Viat claim ledger.
- Observability: `GET /projects/<slug>/queue-triggers`, `GET …/<name>` and
  `GET …/<name>/fires`. A fire carries
  `id,trigger_id,execution_id,message_id,routing_key,redelivered,outcome,detail,fired_at`
  with outcome ack/dlq/requeue. Read them **together with** broker
  ready/unacked counts, dead-letter routing and runtime logs. Connection
  errors reconnect with backoff; missing permissions/queues are fixed at the
  broker, not by recreating triggers.
- Tooling: there is no standalone queue-trigger CLI; the repo supports
  `queue_triggers/<name>.yaml` and `viat pull/push --only queue_triggers`.
  Mirroring deletes remote items missing locally — diff first.
- Verify and clean up: exercise success/rejection/timeout/redelivery only on
  an authorized isolated queue/DLQ; pause first, drain in-flight/unacked
  work, then `DELETE` the trigger — which **never** deletes or empties the
  broker queue, redelivers acked messages or undoes writes. Manual DLQ
  replay needs separate authorization and business deduplication;
  cancelling/pausing is not a transaction rollback.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/queue_triggers.rs`
and `queue_trigger.rs`; `crates/viat-core/src/types/queue_trigger.rs`;
`crates/viat-cli/src/repo/queue_triggers.rs`; the console queue editor and
its tests. Examples are source-derived and unexecuted; no broker/network
calls were made.
