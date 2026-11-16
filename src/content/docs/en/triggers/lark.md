---
title: "Lark international bots"
description: "Provider prerequisites, complete creation examples, capability limits and recovery."
doc_id: triggers.lark
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Lark international bots

Prepare on the Lark side first: use a **self-built Lark app** with bot
capability, long-connection event reception, the message event subscription
your use case needs (`im.message.receive_v1`), message-read/send
permissions, and the intended tenant/user/chat visibility — enabled and
published on the provider side before you test.

The easiest trap is **account provenance**:

- The app_id/app_secret must belong to the **international deployment** — a
  domestic Feishu account is not a substitute.
- The platform enum is `lark`; the default API base is
  `https://open.larksuite.com`, **not** open.feishu.cn.

Transport mechanics (implementation shared with Feishu):

- HTTP bootstrap → authenticated protobuf/binary WebSocket frames with plain
  JSON event bodies. Store apps and configuring an Encrypt Key for this
  long-connection path are **not** supported alternatives.
- The shared `VIAT_IM_FEISHU_HOSTS` allowlist covers both platforms — do not
  widen it just to make an arbitrary URL pass.
- Direct and group chats are supported; `require_mention` is meaningful
  here too; `meta.bot_open_id` must point at **this bot**, or "@ any bot"
  cannot be distinguished.
- Replies and `viat.im_send` use REST, never the event socket; provider
  permissions/rate limits/quotas still apply — **an accepted API call is not
  a read human**.
- Bootstrap/connect/REST deadlines and fragment boundaries match Feishu:
  5-second reassembly, at most 64 fragments/256 in-flight payloads.

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

{"name":"assistant","platform":"lark","enabled":false,"credentials":{"app_id":"<app-id>","app_secret":"<app-secret>"},"meta":{},"groups":[]}
```

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"assistant","platform":"lark","enabled":false,"account":"assistant","chat_type":"any","require_mention":false,"target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":4,"identity_mode":"off"}
```

Account response projection:
`{"name":"assistant","platform":"lark","enabled":false,"resource":null,"has_inline_credentials":true,"meta":{},"groups":[],"peer_identity":null,"status":"ok","status_message":null}`
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
`lark` CLI or MCP connector tool.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/im/connector/feishu.rs`,
`im/dispatch.rs`, `handlers/im.rs`; `crates/viat-core/src/types/im.rs`;
`crates/viat-cli/src/repo/im.rs`. No provider configuration, permissions or
real delivery were executed for this page.
