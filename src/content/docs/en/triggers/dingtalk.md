---
title: "DingTalk Stream bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.dingtalk
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# DingTalk Stream bots

What to prepare and expect before wiring a DingTalk bot into Viat. On the
provider side first: create a bot/app in **Stream mode** in the DingTalk
console with AppKey/AppSecret, the bot message capability and the intended
organization visibility. Field mapping: `app_id` = AppKey, `app_secret` =
AppSecret; when RobotCode differs, set the account's `meta.robot_code`. This
is not a webhook-only robot, and it **never requires** exposing an inbound
callback URL.

Transport mechanics:

- The default API base `https://api.dingtalk.com` issues a single-use
  90-second gateway ticket, then WSS connects; the bot-message subscription
  is `/v1.0/im/bot/messages/get`.
- It receives **direct messages** and **group messages mentioning the bot**;
  `require_mention` adds no meaningful filter.
- Normalized `text` also covers provider-supplied rich-text fragments and
  audio transcriptions; `raw` stays in the platform's own shape.
- Each frame is acknowledged by messageId; a failed EVENT claim can request
  redelivery via LATER. **A successful ack means the claim persisted, not
  that the script succeeded.**
- Replies **never** ride the event socket — POST to the short-lived
  sessionWebhook in the inbound `reply_handle`; an expired webhook is not a
  permanent address. `viat.im_send` uses the supported proactive bot API
  under provider limits.
- Timeouts: REST 15 seconds; WSS connect 10 seconds; idle checked every 30
  seconds with a 95-second silence disconnect. Routine provider connection
  expiry reconnects automatically; **repeated bootstrap/auth failures mean
  credential/permission problems — not another trigger.**

## Create and respond

Read the [full shared contract for fields, updates/clearing, permissions and
identity](chat-accounts.md) first. Create the script `chat/reply` before the
trigger:

```python
def main(message):
    return "received: " + message["text"]
```

Everything below is a **source-derived, unexecuted** example with placeholder
credentials; no provider was accessed. Keep it disabled until permissions and
targets are reviewed.

```http
POST /projects/demo/im/accounts
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"dingtalk","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"dingtalk","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection:
`{"name":"assistant","platform":"dingtalk","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
(plus id/created_at/updated_at; credentials never return). The trigger
response substitutes `account_id:"<uuid>"`, `target_kind:"script"`,
`target_name:"chat/reply"` for the submitted account/target objects, plus
the shared full fields and id/timestamps. Save the id and read the
list/health before enabling — **status ok is not a passed online test**.

## Verify, recover, clean up

- Verify: enable via a PUT keeping every field, only against an explicitly
  authorized isolated provider account; send one synthetic message and check
  normalized text/sender, the reply, ledger and execution logs, then verify
  identity refusals. Multiple triggers can match at once — bad routing
  **replies repeatedly**.
- Delivery semantics follow the [shared delivery contract](chat-accounts.md):
  no automatic exactly-once or replay guarantee.
- Failures: for `degraded` check egress, visibility scope, credentials and
  competing connections; for `needs_reauth` update the correct credentials —
  **do not keep sending messages**.
- Cleanup: disable trigger/account and drain in-flight work → revoke test
  invites/identity bindings → delete the isolated objects; provider
  app/credential revocation is handled separately.

Entry points: console **Triggers → Chat** (Accounts/Populations/Triggers);
APIs `/projects/<slug>/im/accounts`, `/im/triggers` plus per-account
`/health`, `/messages`; repo `im/accounts/assistant.yaml`,
`im/triggers/assistant.yaml`, `viat pull/push --only chat` (inline accounts
are neither exported nor deleted by mirroring). There is no standalone
`dingtalk` CLI or MCP connector tool.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/im/connector/dingtalk.rs`,
`im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`;
`crates/viat-cli/src/repo/im.rs`. No provider configuration, permissions or
real delivery were executed for this page.
