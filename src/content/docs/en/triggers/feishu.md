---
title: "Feishu long-connection bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.feishu
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Feishu long-connection bots

Create a **self-built app** in the correct Feishu tenant, enable its bot, configure long-connection event reception and grant/subscribe the message events your use case needs (including `im.message.receive_v1`). Store its app_id/app_secret, publish/enable it for the intended users/chats in the provider console. Store apps are not this long-connection mode. Provider permissions and visibility remain necessary even when the Viat account saves successfully.

Default API base is `https://open.feishu.cn`. Feishu and international Lark share a connector but are distinct platform values/accounts. Bootstrap uses HTTP then a provider-specific protobuf-over-binary-WebSocket protocol; a generic JSON WebSocket subscription cannot replace it. The long-connection event body is not encrypted: configuring an Encrypt Key for this path is not a supported substitute for its authenticated transport.

The connector receives direct and group messages; `require_mention:true` is meaningful. Set account `meta.bot_open_id` to the bot's real open id so mentions mean **this bot**, rather than any mentioned bot. Text and provider-specific raw events are normalized, not a promise that every media payload is downloaded. Replies and `viat.im_send` use provider REST delivery and its permission/rate limits; group visibility and API acceptance do not prove human receipt. Bootstrap/connect/REST have bounded timeouts; fragments have bounded assembly (5 seconds, 64 parts, 256 partial payloads), not an unbounded receive buffer.

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

{"name":"assistant","platform":"feishu","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"feishu","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection: `{"name":"assistant","platform":"feishu","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`, plus id/created_at/updated_at. It never returns credentials. Trigger response uses `account_id:"<uuid>"`, `target_kind:"script"`, `target_name:"chat/reply"` instead of the submitted account/target objects, plus the full shared fields and ids/timestamps. Save returned ids and read list/health before enabling; an ok status is not a live-service test.

## Verification, recovery and cleanup

For an opted-in isolated provider account, enable by PUT while preserving all fields, send one synthetic message, compare normalized text/sender identity, reply and ledger/execution logs, then test a rejected identity. Multiple triggers can match; replies may therefore duplicate unless routing is deliberate. Target timeout and external effects follow the [shared delivery contract](chat-accounts.md); no automatic exactly-once/replay guarantee. If health is degraded check egress, provider app visibility, credentials and competing connections. needs_reauth requires corrected credentials, not repeated message sends. Disable trigger/account, account for in-flight work, revoke test invitations/identity bindings, then delete isolated objects. Provider-side app/credential revocation is separate.

Console: Triggers → Chat, Accounts/Populations/Triggers. API: `/projects/<slug>/im/accounts`, `/im/triggers`, account `/health` and `/messages`. Repo: `im/accounts/assistant.yaml`, `im/triggers/assistant.yaml`, `viat pull/push --only chat`; inline accounts are not exported or mirror-deleted. There is no standalone `feishu` CLI command or MCP connector tool.

Evidence: `crates/viat-api/src/im/connector/feishu.rs`, `im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`; `crates/viat-cli/src/repo/im.rs`. Provider provisioning/permissions and actual delivery were not exercised for this page.
