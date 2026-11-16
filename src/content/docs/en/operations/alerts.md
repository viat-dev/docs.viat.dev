---
title: Configure and operate alerts
description: Define project health rules, authorize destinations, test delivery safely and handle failures without false guarantees.
doc_id: operations.alerts
verified_release: '1.1.0'
channel: stable
---

# Configure and operate alerts

Alert rules observe a **whole project**, not one endpoint or schedule.
Permissions and boundaries:

- Members may list; creating/replacing, enable/disable, deleting and test
  sends require **Owner/Admin** publisher rights — Developer/Operator cannot
  edit delivery targets.
- Signed webhook URLs are credentials: non-publishers receive a redacted
  URL in list responses.
- **All examples are unexecuted**; evaluation and test endpoints can really
  send HTTP, mail, chat or push — use controlled targets only, get explicit
  approval before delivery tests, and never hit a real on-call channel.

## Fields and semantics

| Field | Required, default, validation | Meaning |
| --- | --- | --- |
| `name` | Required non-blank, project-scoped | Used in API paths and message prefixes; renaming means full replacement. |
| `enabled` | boolean, default true | Explicitly false while preparing a rule. |
| `kind` | `endpoint_errors` / `schedule_failures` | **No** arbitrary metric-query expressions. |
| `threshold` | Required integer ≥1 | A **count**, not a percentage. |
| `window_secs` | Required ≥60 for endpoint_errors; must be absent/null for schedule_failures | Rolling window of server errors; **consecutive failures never expire by time alone**. |
| `channel_kind` | `webhook`/`email`/`chat`/`push` | Exactly one destination group. |
| `webhook_url` | Required for webhook, non-empty HTTP(S) URL | The other destination fields must be missing/null — empty strings conflict too. |
| `email_to` | Required for email, comma-separated addresses | Deployment SMTP must be configured; syntax checks prove no delivery. |
| `chat_account`, `chat_id` | Required for chat: an existing project account name + non-blank recipient | Platform limits below. |
| `push_resource` | Required for push, a project push-resource reference | Resolved and pinned at save — proving nothing about credential/device validity. |

What the two kinds count:

- `endpoint_errors`: **production** execution rows with status ≥500 inside the
  window (tests excluded). Not a latency/SLO error rate, and blind to
  services that cannot log at all.
- `schedule_failures`: **consecutive** failures of enabled schedules; only a
  successful finish breaks the chain — running/skipped is not recovery, and
  disabled schedules stop counting. Messages report the most severe schedule,
  not one event per schedule.

## Create disabled, verify, then enable

Prepare `alert.json` in a trusted editor (not a real deliverable target
here):

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

- `GET/POST /projects/PROJECT/alerts` lists/creates.
- `PUT /projects/PROJECT/alerts/NAME` **replaces with a full body** — absent
  fields revert to defaults/null; it is not a partial patch; the same path's
  `PATCH` accepts only `{"enabled":true|false}`; `DELETE` removes the rule.
- Saving the list before changes is a fine recovery record — treat its
  destinations as secrets.

After explicit approval, `POST /projects/PROJECT/alerts/NAME/test`
**really sends** without changing firing state. HTTP **200** can still be
`{"delivered":false,"error":"..."}` — **you must read `delivered`** and
confirm receipt at the controlled target; provider acceptance is not a human
reading it. Enable only after end-to-end verification, then disable/delete
the test fixture.

## Evaluation, recovery and send failures

- Default period is 60 seconds; the first evaluation waits a **full period**.
  Rule state carries `ok`/`firing`, `state_since`, `last_notified_at`,
  `last_error`.
- Sending happens only on **state edges** (recovery included) — not a
  per-period reminder. A failed send still records the transition and is
  **never** auto-resent every minute for the same unchanged edge: read
  `last_error`, fix the target, and test deliberately instead of waiting for
  a retry loop that does not exist.
- One PostgreSQL advisory lock per rule reduces duplicate cross-node edge
  sends; it is **not** exactly-once under network/database commit failures.
  Disabling stops future evaluation but does not necessarily abort an
  in-flight provider request.
- "Recovery" can merely mean the window's errors aged out or the failing
  schedule was disabled — **it does not prove the root cause is fixed**.

### Destination limits

| Channel | Limits |
| --- | --- |
| Webhook | HTTP(S) only; protect the signed URL; check egress/SSRF policy — a valid URL at save time proves no reachability. |
| Email | Requires [deployment SMTP](../configuration/integrations.md), sender, relay permissions and TLS; saving without a relay answers 400; the port must match STARTTLS/implicit mode. |
| Chat | WeCom under this connector **cannot** receive alerts proactively without inbound context (save refuses); WeChat depends on the recipient's recent interaction permit and is no unconditional paging channel; Feishu/Lark/DingTalk depend on account availability and recipient/platform permissions. |
| Push | Needs a valid push resource plus enrolled, eligible devices; stable capability follows the actual provider/resource protocol and excludes unreleased APNs widget snapshots; provider success means accepted, **not** delivered or read. |

## Handling operational escalations

Use **external** monitoring to catch silent failures of the process,
database, activation or evaluator — with the process/database/egress down,
the process's own alerting cannot save you. Investigate: health probes (see
[troubleshooting](troubleshooting.md)) → `last_error` → SMTP/provider logs
→ enabled state. Keep evidence of failed deliveries; after fixing, test with
approval and notify the incident owner through an independent channel.
**Never** flip a production rule just to manufacture an edge — that only
produces misleading recoveries and duplicate messages.
