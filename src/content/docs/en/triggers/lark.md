---
title: "Lark international bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.lark
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Lark international bots

Use a **self-built Lark app** with bot capability, long-connection event reception, appropriate message event subscription (`im.message.receive_v1`), message-read/send permissions and intended tenant/user/chat visibility. The app_id/app_secret must belong to the international deployment, not a domestic Feishu account. Enable/publish the app on the provider side before testing.

The platform enum is `lark`; default API base is `https://open.larksuite.com`, not open.feishu.cn. Implementation is shared with Feishu (HTTP bootstrap, authenticated protobuf/binary WebSocket frames, plain JSON event bodies). Store apps and configuring Encrypt Key for the long-connection event path are not supported alternatives. The shared `VIAT_IM_FEISHU_HOSTS` allowlist covers Feishu/Lark endpoints; do not widen it merely to make an arbitrary URL pass.

Direct and group messages are supported; require_mention applies here too. Set meta.bot_open_id so it selects this bot rather than any bot mention. Replies and `viat.im_send` use REST, not the event socket. Provider permission/rate/quota limits apply; delivery acceptance is not a read receipt. The connector's bounded bootstrap/connect/REST and fragment assembly behavior is the same as Feishu (5-second fragment window, max 64 parts / 256 partial payloads).

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

{"name":"assistant","platform":"lark","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"lark","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection: `{"name":"assistant","platform":"lark","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`, plus id/created_at/updated_at. It never returns credentials. Trigger response uses `account_id:"<uuid>"`, `target_kind:"script"`, `target_name:"chat/reply"` instead of the submitted account/target objects, plus the full shared fields and ids/timestamps. Save returned ids and read list/health before enabling; an ok status is not a live-service test.

## Verification, recovery and cleanup

For an opted-in isolated provider account, enable by PUT while preserving all fields, send one synthetic message, compare normalized text/sender identity, reply and ledger/execution logs, then test a rejected identity. Multiple triggers can match; replies may therefore duplicate unless routing is deliberate. Target timeout and external effects follow the [shared delivery contract](chat-accounts.md); no automatic exactly-once/replay guarantee. If health is degraded check egress, provider app visibility, credentials and competing connections. needs_reauth requires corrected credentials, not repeated message sends. Disable trigger/account, account for in-flight work, revoke test invitations/identity bindings, then delete isolated objects. Provider-side app/credential revocation is separate.

Console: Triggers → Chat, Accounts/Populations/Triggers. API: `/projects/<slug>/im/accounts`, `/im/triggers`, account `/health` and `/messages`. Repo: `im/accounts/assistant.yaml`, `im/triggers/assistant.yaml`, `viat pull/push --only chat`; inline accounts are not exported or mirror-deleted. There is no standalone `lark` CLI command or MCP connector tool.

Evidence: `crates/viat-api/src/im/connector/feishu.rs`, `im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`; `crates/viat-cli/src/repo/im.rs`. Provider provisioning/permissions and actual delivery were not exercised for this page.
