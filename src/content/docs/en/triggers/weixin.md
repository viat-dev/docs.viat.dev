---
title: "Personal WeChat through native iLink"
description: "QR binding, durable polling cursor, reply permits and reauthentication for private chat."
doc_id: triggers.weixin
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Personal WeChat through native iLink

The native connector is Tencent **iLink**, not a browser bridge, a WeCom bot, an official-account webhook, or a generic WebSocket subscription. It uses HTTPS long polling and QR-issued credentials. **Private chat is the established capability; native group chat is not established.** The normalizer recognizes a `group_id` if present in a payload, but that parsing test does not establish that the provider delivers supported group traffic. Do not advertise group assistance or choose group-only routing on this basis. `require_mention` has no meaningful native-WeChat filter.

Read [chat account/trigger fields, permissions, identity and delivery](chat-accounts.md). Provider binding availability and policy can change; no live account/QR was used for this page. In particular, older prose about permanent single-bot binding is not a guarantee we can establish from a parser: obtain informed consent about slot/takeover restrictions and verify current provider policy before a real scan. Rebinding can supersede an old token and affect an existing assistant.

## Create, QR, poll, route

Source-derived/unexecuted example, existing `chat/reply` script:

```python
def main(message):
    return "received: " + message["text"]
```

```http
POST /projects/demo/im/accounts
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"personal","platform":"weixin","enabled":false,"credentials":{},"meta":{},"groups":["test"]}
```

AccountPublic returns `id,name,platform,enabled,resource:null,has_inline_credentials:true,meta,groups,peer_identity,status,status_message,created_at,updated_at`; empty stored credentials before binding are not proof of authentication. No bot_token is returned. Start and poll **server-mediated binding**, not a provider API from your browser:

```http
POST /projects/demo/im/accounts/personal/bind/start
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

Response `{ "qr_url":"<renderable-QR-url>","poll_handle":"<sealed-handle>" }`. Render qr_url; the provider's internal `qrcode` polling ticket is not the image URL. Hand the poll_handle back unchanged:

```http
POST /projects/demo/im/accounts/personal/bind/poll
Authorization: Bearer <console-token>
Content-Type: application/json

{"poll_handle":"<sealed-handle>"}
```

Poll progress until confirmed/terminal status; waiting or a long-poll timeout is not failed authentication. An expired/invalid handle needs a new start. Confirmation stores credentials on the server; it must not expose token/uin/base URL secrets to the browser. Use the current account response/health to confirm ready and intended enabled state before sending anything. QR host redirects/confirmation base URL are validated against `VIAT_IM_WEIXIN_HOSTS` (default weixin.qq.com suffix), including values preserved into later polls.

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"personal-reply","platform":"weixin","enabled":false,"account":"personal","chat_type":"direct","target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":1,"identity_mode":"off"}
```

TriggerPublic returns `account_id:"<account-uuid>"`, `target_kind:"script"`, `target_name:"chat/reply"`, ids/timestamps and all normalized trigger defaults listed in the shared page. To fan in a fleet, omit account and optionally filter `account_groups`; this is not a separate connector type. Enable using full-form updates that preserve intended filters/identity policy. Account/trigger API writes require membership; self-service invitation creation requires editor rights.

## Polling, cursor and reply context

Default base is `https://ilinkai.weixin.qq.com`. `getupdates` holds around 35 seconds; client timeout is 40 seconds, with a 500ms repoll floor; ordinary send/QR API requests use bounded timeouts (15 seconds except long-poll paths). Empty timeout simply repolls. The provider's `get_updates_buf` cursor is persisted only after each batch is claimed durably. A crash can replay a batch, and the dedup ledger absorbs ordinary duplicates; cursor advance is not proof that every script/reply succeeded. Dedup prefers provider message_id, then seq, then deterministic sender/time/text digest.

Only user-originated finished messages are candidates, not echoes of the bot's own output. Text concatenates text items; image-only input has empty text, so a keyword may not match. Normalized kind can identify media, but this does not promise a media download/OCR/voice pipeline. Fields reach `message.raw` as provider data.

**Sending requires `context_token` from the recipient's inbound message.** It is a conversation reply permit, not an app-wide capability to message arbitrary users. Automatic replies and supported `viat.im_send` calls must respect the stored context and provider's conversation window. A schedule cannot manufacture a new permit for a silent recipient. Do not persist reply handles as permanent credentials or leak them into public logs. A provider-accepted send is not a read receipt.

`errcode:-14` is terminal stale/replaced bot_token: the account moves to `needs_reauth`, polling stops, and there is no refresh-token loop. Have the intended human scan again, then verify the server saved the replacement and status cleared. Repeated enable toggles, reconnects or retrying sends cannot repair revoked authentication. Transient network errors instead use the shared 2–60 second reconnect backoff.

## Human identity, invitations and cleanup

QR binds a **bot account**, not a project-user principal. `message.account.meta` can carry invitation assertions; sender→project-user identity is separate `identity_mode` and `(project,weixin,sender_key)` binding. Use required mode for actions that must have an authenticated project user; optional unbound messages run without such identity. A per-person invitation must be minted after authenticating that person, with short TTL/max_uses 1; whoever scans a shared invitation gets its asserted meta. See [shared identity/binding details](chat-accounts.md).

Console Accounts → Binding handles QR/poll; self-service links use `/im/bind-links` and configured public binding base. `GET …/im/accounts/personal/health` and `/messages` show connection and processing; inspect failed/stranded runs before explicit business replay. No generic reliable message replay is promised. Disable test trigger/account, revoke invitation links and project-user bindings, account for in-flight effects, then delete only isolated config. Deleting Viat config is not provider-side unbinding/credential revocation. Inline/QR accounts are skipped by `viat pull` and protected from mirror deletion by `push`; resource-backed accounts and `im/triggers/*.yaml` sync under `--only chat`. No `viat weixin` command exists.

Evidence: `crates/viat-api/src/im/connector/weixin.rs` (dedup/text/group classification/stale-token tests), `im/dispatch.rs`, `handlers/{im,im_bind,im_identities}.rs`; `crates/viat-cli/src/repo/im.rs`. Examples unexecuted; QR policy, account availability, group delivery, provider quotas and real-message recovery remain validation gaps, not inferred capabilities.
