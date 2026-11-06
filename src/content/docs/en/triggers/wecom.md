---
title: "WeCom intelligent bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.wecom
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# WeCom intelligent bots

Use the bot's **API mode / long connection** credentials (`app_id` is bot id, `app_secret` is its secret), not an incoming group-webhook URL or an ordinary enterprise app callback configuration. Outbound WSS defaults to `wss://openws.work.weixin.qq.com`; the deployment needs egress and the bot enabled in the provider console. Direct messages and group messages that @-mention the bot are supported; require_mention cannot narrow messages that already arrived because of mention.

One live connection is allowed per bot. Viat coordinates its instances by lease, but an unrelated SDK using the same credentials can still kick it; stop that second client rather than continuously reconnecting both. The connector pings every 30 seconds, considers two missed acknowledgements broken, and distinguishes a provider takeover from a transient network failure.

**Return the reply from the triggered script. `viat.im_send` is not supported for WeCom.** Replies are connection frames tied to the inbound req_id, not generic chat_id sends. The platform starts a placeholder stream around 1.5 seconds while a long script runs to meet the provider's first-reply deadline; this does not shorten the script's own timeout or mean a result is ready. It is not an out-of-band alert channel or an unlimited proactive messaging API. A return value cannot recover a connection already lost.

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

{"name":"assistant","platform":"wecom","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"wecom","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection: `{"name":"assistant","platform":"wecom","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`, plus id/created_at/updated_at. It never returns credentials. Trigger response uses `account_id:"<uuid>"`, `target_kind:"script"`, `target_name:"chat/reply"` instead of the submitted account/target objects, plus the full shared fields and ids/timestamps. Save returned ids and read list/health before enabling; an ok status is not a live-service test.

## Verification, recovery and cleanup

For an opted-in isolated provider account, enable by PUT while preserving all fields, send one synthetic message, compare normalized text/sender identity, reply and ledger/execution logs, then test a rejected identity. Multiple triggers can match; replies may therefore duplicate unless routing is deliberate. Target timeout and external effects follow the [shared delivery contract](chat-accounts.md); no automatic exactly-once/replay guarantee. If health is degraded check egress, provider app visibility, credentials and competing connections. needs_reauth requires corrected credentials, not repeated message sends. Disable trigger/account, account for in-flight work, revoke test invitations/identity bindings, then delete isolated objects. Provider-side app/credential revocation is separate.

Console: Triggers → Chat, Accounts/Populations/Triggers. API: `/projects/<slug>/im/accounts`, `/im/triggers`, account `/health` and `/messages`. Repo: `im/accounts/assistant.yaml`, `im/triggers/assistant.yaml`, `viat pull/push --only chat`; inline accounts are not exported or mirror-deleted. There is no standalone `wecom` CLI command or MCP connector tool.

Evidence: `crates/viat-api/src/im/connector/wecom.rs`, `im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`; `crates/viat-cli/src/repo/im.rs`. Provider provisioning/permissions and actual delivery were not exercised for this page.
