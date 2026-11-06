---
title: "DingTalk Stream bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.dingtalk
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# DingTalk Stream bots

Create a bot/app configured for **Stream mode**, with AppKey/AppSecret, the required bot message capability and intended organization visibility. Use app_id=AppKey and app_secret=AppSecret. If RobotCode differs from AppKey, set account meta.robot_code. This is not an incoming webhook-only robot or a requirement to expose an inbound callback URL.

Default API base `https://api.dingtalk.com` obtains a single-use 90-second gateway ticket then opens WSS. Bot-message subscription is `/v1.0/im/bot/messages/get`. Direct messages and group messages mentioning the bot are received; require_mention does not add a meaningful filter. Normalized text also handles rich-text text fragments/audio transcription when the provider supplies them; raw remains provider-specific.

Every frame is acknowledged with messageId. EVENT claim failure can request LATER redelivery; success acknowledgement follows durable claim, not script success. Replies **cannot** be sent on the event socket: they POST to the short-lived sessionWebhook in the inbound reply handle. Do not persist and replay an expired webhook as a permanent destination. `viat.im_send` uses its supported out-of-band bot API path and provider constraints. REST calls have 15-second timeout, WSS connect 10 seconds, idle check 30 seconds / silence cutoff 95 seconds. Provider routine connection expiry reconnects; repeated bootstraps/auth failures need credential/permission investigation, not a new Viat trigger.

## Creation and responses

Read the [complete shared fields, update/clear semantics, permissions and identity contract](chat-accounts.md) first. Create script `chat/reply` before the trigger:

```python
def main(message):
    return "received: " + message["text"]
```

These source-derived examples are **unexecuted**; credentials are placeholders, no provider was contacted. Keep both objects disabled until permissions and the target are reviewed.

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

Account response projection: `{"name":"assistant","platform":"dingtalk","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`, plus id/created_at/updated_at. It never returns credentials. Trigger response uses `account_id:"<uuid>"`, `target_kind:"script"`, `target_name:"chat/reply"` instead of the submitted account/target objects, plus the full shared fields and ids/timestamps. Save returned ids and read list/health before enabling; an ok status is not a live-service test.

## Verification, recovery and cleanup

For an opted-in isolated provider account, enable by PUT while preserving all fields, send one synthetic message, compare normalized text/sender identity, reply and ledger/execution logs, then test a rejected identity. Multiple triggers can match; replies may therefore duplicate unless routing is deliberate. Target timeout and external effects follow the [shared delivery contract](chat-accounts.md); no automatic exactly-once/replay guarantee. If health is degraded check egress, provider app visibility, credentials and competing connections. needs_reauth requires corrected credentials, not repeated message sends. Disable trigger/account, account for in-flight work, revoke test invitations/identity bindings, then delete isolated objects. Provider-side app/credential revocation is separate.

Console: Triggers → Chat, Accounts/Populations/Triggers. API: `/projects/<slug>/im/accounts`, `/im/triggers`, account `/health` and `/messages`. Repo: `im/accounts/assistant.yaml`, `im/triggers/assistant.yaml`, `viat pull/push --only chat`; inline accounts are not exported or mirror-deleted. There is no standalone `dingtalk` CLI command or MCP connector tool.

Evidence: `crates/viat-api/src/im/connector/dingtalk.rs`, `im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`; `crates/viat-cli/src/repo/im.rs`. Provider provisioning/permissions and actual delivery were not exercised for this page.
