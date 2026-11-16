---
title: "Feishu long-connection bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.feishu
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Feishu long-connection bots

Prepare on the Feishu side first: create a **self-built app** in the correct
Feishu tenant, enable its bot, choose **long-connection** event reception,
grant and subscribe the message events your use case needs (including
`im.message.receive_v1`), then publish/enable it for the intended
users/chats in the provider console. Store the app_id/app_secret. Store
(marketplace) apps are not this long-connection mode — and **a successfully
saved Viat account replaces neither provider permissions nor visibility
configuration**.

Transport mechanics:

- Default API base `https://open.feishu.cn`. Feishu and international Lark
  share one connector but remain distinct platform values/accounts.
- Bootstrap is HTTP, followed by the provider's **protobuf-over-binary
  WebSocket protocol** — a generic JSON WebSocket subscription cannot
  replace it.
- The long-connection event body is unencrypted; configuring an Encrypt Key
  for this path is not a supported substitute for its authenticated
  transport.
- Direct and group messages are received, and `require_mention: true` is
  meaningful here. Set the account's `meta.bot_open_id` to the bot's real
  open id to distinguish "@ this bot" from "@ any bot".
- `text`/`raw` are normalized; automatic download of every media type is not
  promised. Replies and `viat.im_send` use the provider REST APIs under
  permission/rate limits — **group visibility and an accepted API call do
  not mean a human received it**.
- Bootstrap/connect/REST all have deadlines; fragment reassembly caps at 5
  seconds, 64 fragments and 256 in-flight payloads — not an unbounded
  buffer.

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

{"name":"assistant","platform":"feishu","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"feishu","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection:
`{"name":"assistant","platform":"feishu","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
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
`feishu` CLI or MCP connector tool.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/im/connector/feishu.rs`,
`im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`;
`crates/viat-cli/src/repo/im.rs`. No provider configuration, permissions or
real delivery were executed for this page.
