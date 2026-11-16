---
title: "Personal WeChat through native iLink"
description: "QR binding, durable polling cursor, reply permits and reauthentication for private chat."
doc_id: triggers.weixin
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Personal WeChat through native iLink

The native connector is Tencent **iLink**: HTTPS long polling plus
QR-issued credentials. It is not a browser bridge, a WeCom bot, an
official-account webhook, or a generic WebSocket subscription.

Boundaries first:

- **Private chat is the established capability; native group chat is not.**
  The normalizer recognizes a `group_id` when present, but a parsing test
  does not establish that the provider delivers group traffic — never
  advertise group assistance or choose group-only routing on that basis.
- `require_mention` is not a meaningful native-WeChat filter.
- Read the [shared account/trigger fields, permissions, identity and
  delivery contract](chat-accounts.md). Provider binding availability and
  policy can change; no live account or QR scan was used for this page.
  Older prose about "permanent single-bot binding" is not something a parser
  can guarantee — before a real scan, get informed consent about
  slot/takeover restrictions and verify current policy; rebinding can
  supersede an old token and affect an existing assistant.

## Create, scan, poll, route

Source-derived, unexecuted. First the script `chat/reply`:

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

AccountPublic returns
`id,name,platform,enabled,resource:null,has_inline_credentials:true,meta,groups,peer_identity,status,status_message,created_at,updated_at`.
Empty credentials saved before scanning **do not mean authenticated**, and
the bot_token never returns.

Scanning goes through the **server intermediary** — never the browser
directly to the provider:

```http
POST /projects/demo/im/accounts/personal/bind/start
Authorization: Bearer <console-token>
Content-Type: application/json

{}
```

The answer is `{ "qr_url":"<renderable-QR-url>","poll_handle":"<sealed-handle>" }`.
Render `qr_url`; the provider's internal qrcode is the polling ticket,
**not** the image address. Return `poll_handle` verbatim:

```http
POST /projects/demo/im/accounts/personal/bind/poll
Authorization: Bearer <console-token>
Content-Type: application/json

{"poll_handle":"<sealed-handle>"}
```

Poll until confirmed or a terminal state; wait/long-poll timeouts are **not**
authentication failures. An expired/invalid handle means start over. After
confirmation the credentials live server-side — token/uin/secret-bearing
base URLs never reach the browser. Before sending, read the account/health
and confirm readiness plus enabled. QR redirect/confirmation base URLs are
validated against `VIAT_IM_WEIXIN_HOSTS` (default: the weixin.qq.com domain
suffix), and later saved/polled values obey the same constraint.

```http
POST /projects/demo/im/triggers
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"personal-reply","platform":"weixin","enabled":false,"account":"personal","chat_type":"direct","target":{"kind":"script","name":"chat/reply"},"inputs":{},"params":{},"params_strict":false,"max_concurrent_runs":1,"identity_mode":"off"}
```

TriggerPublic returns `account_id:"<account-uuid>"`,
`target_kind:"script"`, `target_name:"chat/reply"`, id/timestamps and the
normalized defaults from the shared page. Omitting `account` (optionally
narrowed by `account_groups`) funnels multiple accounts — **that is not a
different connector**. Update with the full form, keeping filter/identity
policy; account/trigger writes need membership, and self-service invite
creation needs editor rights.

## Polling, cursor and reply context

- Default base `https://ilinkai.weixin.qq.com`; getupdates typically hangs
  ~35 seconds with a 40-second client timeout and a 500ms minimum interval;
  ordinary send/QR APIs are bounded (15 seconds, long-poll excepted). An
  empty timeout just means poll again.
- The `get_updates_buf` cursor is saved **only after the batch's persistent
  claim**; a crash can redeliver a batch, with duplicates usually absorbed
  by the dedup ledger. **Cursor advancement does not mean the script or the
  reply succeeded.** Dedup prefers message_id, then seq, then a
  deterministic sender/time/text digest.
- Only **completed messages sent by humans** are processed; the bot's own
  replies never become input. `text` concatenates text items — an
  image-only message has empty text and may miss a keyword; `kind` flags
  media without promising download/OCR/voice processing; raw fields live in
  `message.raw`.

> [!WARNING]
> **Sending requires the context_token of the peer's inbound message** — a
> conversational reply permit, not a license to message arbitrary users.
> Auto-replies and the supported `viat.im_send` must respect the stored
> context and the provider's window; a schedule cannot manufacture a new
> permit for a silent user. Never store `reply_handle` as a permanent
> credential or leak it into public logs; an accepted send is not a read
> receipt.

**`errcode:-14`** means the bot_token is stale/replaced and is a **terminal
state**: the account enters `needs_reauth` and stops polling — there is no
refresh-token loop. Remedy: have the right person rescan and confirm the
replacement credentials saved and the state cleared. Toggling `enabled`,
reconnecting or resending never repairs a revoked authorization; transient
network errors recover via the shared 2–60 second backoff.

## Human identity, invites and cleanup

- The QR binds a **bot account**; it creates no project-user principal.
  `message.account.meta` may carry invitation assertions; the
  sender→project-user mapping goes through `identity_mode` and the
  `(project,weixin,sender_key)` binding. Actions requiring an authenticated
  user should use `required`; under `optional`, unbound messages simply lack
  that identity.
- Per-person invitations must be short-lived single-use links issued
  **after** authenticating that person; anyone holding a shared invite
  acquires its meta assertions — see the [shared binding notes](chat-accounts.md).
- The console's **Accounts → Binding** handles QR/poll; self-service links
  use `/im/bind-links` with the configured public base.
  `GET …/im/accounts/personal/health` and `/messages` show connection and
  processing; check failed/stranded runs before any business replay — there
  is **no** generic reliable message-replay guarantee.
- Cleanup: disable test triggers/accounts → revoke invites and project
  identity bindings → handle in-flight effects → delete the isolated
  config. **Deleting Viat configuration is not provider unbinding or
  credential revocation.** Inline/QR accounts are skipped on pull and not
  deleted on push; resource accounts and `im/triggers/*.yaml` sync with
  `--only chat`; there is no `viat weixin` command.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/im/connector/weixin.rs`
(dedup/text/group parsing/stale-token tests), `im/dispatch.rs`,
`handlers/{im,im_bind,im_identities}.rs`; `crates/viat-cli/src/repo/im.rs`.
Examples unexecuted; scan policy, account availability, group delivery,
provider quotas and real-world recovery remain verification gaps and must
not be inferred as supported capabilities.
