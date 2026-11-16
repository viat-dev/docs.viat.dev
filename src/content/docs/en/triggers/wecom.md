---
title: "WeCom intelligent bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.wecom
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# WeCom intelligent bots

Wire the bot using its **API mode / long-connection** credentials
(`app_id` is the bot id, `app_secret` its secret) — not an incoming
group-webhook URL and not an ordinary enterprise-app callback configuration.
The outbound WSS defaults to `wss://openws.work.weixin.qq.com`: the
deployment needs that egress and the bot must be enabled in the provider
console. Direct messages and @-mention group messages are supported;
`require_mention` cannot narrow messages that only arrived because of the
mention.

Four key facts about connections and replies:

- **One live connection is allowed per bot.** Viat coordinates its own
  instances by lease, but an unrelated SDK using the same credentials can
  still kick it — stop that second client instead of letting both reconnect
  endlessly.
- The connector pings every 30 seconds, treats two missed acknowledgements
  as broken, and distinguishes a provider takeover from a transient network
  failure.
- **Replies come from the triggered script's return value; `viat.im_send`
  is not supported for WeCom.** A reply is a connection frame tied to the
  inbound req_id, not a generic chat_id send.
- While a long script runs, the platform starts a placeholder stream at
  about 1.5 seconds to meet the provider's first-reply deadline — it neither
  means the result is ready nor shortens the script timeout. This is not an
  arbitrary proactive alert channel, and a return value cannot recover a
  connection already lost.

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

{"name":"assistant","platform":"wecom","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"wecom","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection:
`{"name":"assistant","platform":"wecom","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
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
  competing connections (external SDK takeovers included); for
  `needs_reauth` update the correct credentials — **do not keep sending
  messages**.
- Cleanup: disable trigger/account and drain in-flight work → revoke test
  invites/identity bindings → delete the isolated objects; provider
  app/credential revocation is handled separately.

Entry points: console **Triggers → Chat** (Accounts/Populations/Triggers);
APIs `/projects/<slug>/im/accounts`, `/im/triggers` plus per-account
`/health`, `/messages`; repo `im/accounts/assistant.yaml`,
`im/triggers/assistant.yaml`, `viat pull/push --only chat` (inline accounts
are neither exported nor deleted by mirroring). There is no standalone
`wecom` CLI or MCP connector tool.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/im/connector/wecom.rs`,
`im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`;
`crates/viat-cli/src/repo/im.rs`. No provider configuration, permissions or
real delivery were executed for this page.
