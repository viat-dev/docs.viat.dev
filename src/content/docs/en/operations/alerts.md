---
title: Configure and operate alerts
description: Define project health rules, authorize destinations, test delivery safely and handle failures without false guarantees.
doc_id: operations.alerts
verified_release: '1.1.0'
channel: stable
---

# Configure and operate alerts

Alert rules observe a **project**, not one endpoint or one schedule. Project members can list rules; **Owner/Admin** publisher rights are required to create/replace, enable/disable, delete or send a test. Developer/Operator cannot edit destinations. Signed webhook URLs are credentials: non-publishers receive a redacted URL in list responses.

All examples are **unexecuted**. Rule evaluation and the test endpoint can send real HTTP requests, email, chat or push. Use a controlled test destination and get explicit approval before delivery tests; never test against an on-call rota by accident.

## Rule fields and semantics

| Field | Required/default/validation | Meaning |
| --- | --- | --- |
| `name` | Required nonblank string; project-local name | Used in API paths and message prefix. Rename through full replacement if needed. |
| `enabled` | Boolean, default true | Use explicit false while preparing a rule. |
| `kind` | `endpoint_errors` or `schedule_failures` | No arbitrary metric/query expression. |
| `threshold` | Required integer >=1 | Count, **not percentage**. |
| `window_secs` | Required >=60 for endpoint_errors; absent/null for schedule_failures | Rolling window for server errors; failure streak does not expire merely because time passed. |
| `channel_kind` | `webhook`, `email`, `chat`, `push` | Exactly one matching destination. |
| `webhook_url` | Required nonblank HTTP(S) URL for webhook | Extra destination fields must be absent/null, not empty strings. |
| `email_to` | Required comma-separated address list for email | Requires configured deployment SMTP; syntactic checks do not prove delivery. |
| `chat_account`, `chat_id` | Required existing same-project account name and nonblank recipient for chat | Platform constraints below. |
| `push_resource` | Required same-project `push` resource reference for push | Save resolves/qualifies reference; does not prove provider credentials/device audience. |

`endpoint_errors` counts production execution rows with status >=500 inside the window; it excludes test runs. It is not a latency/SLO-rate alert, nor monitoring of a server that cannot write any logs. `schedule_failures` counts consecutive failures among enabled schedules; only a successful run clears the streak, not running/skipped rows. Disabled schedules are excluded. The message names the worst offender; it is not one independent incident per schedule.

## Create disabled, verify, then enable

In a trusted editor prepare `alert.json` (no real destination here):

```json
{
  "name": "server-errors",
  "enabled": false,
  "kind": "endpoint_errors",
  "threshold": 5,
  "window_secs": 300,
  "channel_kind": "webhook",
  "webhook_url": "https://alerts.example.com/controlled-fixture"
}
```

```sh
curl --fail-with-body -X POST "$BASE/projects/$PROJECT/alerts" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @alert.json
curl --fail-with-body "$BASE/projects/$PROJECT/alerts" \
  -H "Authorization: Bearer $TOKEN"
```

`GET/POST /projects/PROJECT/alerts` list/create. `PUT /projects/PROJECT/alerts/NAME` replaces using the complete body; omitted fields use defaults/null, so do not treat PUT as a partial patch. `PATCH` at the same name accepts `{"enabled":true}` or false. `DELETE` removes the rule. Capture list output before changes but protect its destinations as secrets.

After explicit authorization, `POST /projects/PROJECT/alerts/NAME/test` sends a **real** test without changing the rule's firing state. HTTP **200** can still be `{"delivered":false,"error":"..."}`; require `delivered:true` and verify receipt at the controlled destination. Provider acceptance alone is not a guarantee a human saw it. Enable only after successful end-to-end validation, and disable/remove the fixture afterward.

## Evaluation, recovery and delivery failures

Evaluator default cadence is 60 seconds, after one initial interval. Rules have `ok`/`firing` state, `state_since`, `last_notified_at`, `last_error`. It sends on **state edges only**, including recovery—not a reminder every interval. A delivery failure still records the state transition; **there is no automatic per-interval resend of that unchanged edge**. Read last_error, repair the destination and explicitly test it; do not wait for a nonexistent retry loop.

A per-rule PostgreSQL advisory lock reduces concurrent edge sends across nodes. This is not an exactly-once delivery guarantee across network failures/database commits. Disabling a rule prevents future evaluation, not necessarily an already-in-flight provider call. A recovered rule can mean counts aged out or an offending schedule was disabled, not necessarily the underlying defect was fixed.

### Destination limits

- Webhook: HTTP(S) only; protect any signed URL and ensure egress/SSRF policy. Save-time URL parsing is not end-to-end reachability verification.
- Email: set [deployment SMTP](../configuration/integrations.md), valid sender/relay credentials and TLS. No relay causes save refusal (400); STARTTLS/implicit mode and port must agree.
- Chat: WeCom cannot receive an unsolicited alert on this connector and is refused at save. Weixin requires a recent recipient interaction permit, so it is not a reliable unconditional paging channel. Feishu/Lark/DingTalk still depend on account availability and recipient/platform permission.
- Push: needs a usable `push` resource and registered eligible devices. Stable support uses the actual provider/resource contract, not unreleased APNs widget snapshots. Provider success is acceptance, not device delivery/read confirmation.

## Operational escalation

Use an **external** monitor for process/DB/activation health and evaluator silence; an in-process alert cannot page reliably when the process/database/egress is down. Check [health probes](troubleshooting.md), last_error, SMTP/provider logs and whether the rule is enabled. Preserve failed-delivery evidence; after destination repair test deliberately and notify the incident owner through an independent channel. Do not toggle a production rule just to force an edge without understanding duplicate/recovery messages.
