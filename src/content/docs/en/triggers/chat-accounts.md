---
title: "Chat accounts, routing and identity"
description: "Shared complete account/trigger contract, sender binding, delivery and repo synchronization."
doc_id: triggers.chat-accounts
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Chat accounts, routing and identity

This page is the **shared contract** for the five chat platforms — read it
together with each platform page: [WeCom](wecom.md), [WeChat](weixin.md),
[Feishu](feishu.md), [Lark](lark.md), [DingTalk](dingtalk.md). Their
transports and send capabilities are not interchangeable.

The model in one sentence: **accounts** hold credentials/connections;
**triggers** select messages and bind them to existing script/workflow
targets (no endpoint targets). Configuration and target drafts are live and
there is **no publish step**. No native HomeAssistant/MQTT/Slurm connectors
exist here.

Permission layers:

| Action | Requires |
| --- | --- |
| Account/trigger CRUD, account QR APIs | Project membership |
| Create/revoke self-service bind links | Content-edit rights |
| View links/usage records | Project membership |
| Create/delete sender identity bindings | Project Owner/Admin/Developer |
| View identity bindings | Project membership |

> [!NOTE]
> All API examples are source-derived and unexecuted; real QR scans, sends
> and provider calls need explicit authorization. Administrative
> credentials and the end-user identity parsed from messages are different
> things.

## The full account contract

`POST /projects/<slug>/im/accounts` creates, `GET …/im/accounts` lists,
`PUT|DELETE …/im/accounts/<name>` updates/deletes.

| Field | Create/update |
| --- | --- |
| `name` | Required, non-blank; a PUT may rename the account named by the old path. |
| `platform` | Required `wecom\|weixin\|feishu\|lark\|dingtalk`; unchanged when editing credentials. |
| `enabled` | Default true (PUTs included); editing a paused account must explicitly keep false. |
| `resource` | Credential resource name; mutually exclusive with credentials. |
| `credentials` | Inline JSON, encrypted at rest, never echoed. Exactly one of resource/credentials at create (`{}` before a WeChat QR scan); on update, omitting both keeps the current source and sending one switches it. No plaintext-read API exists. |
| `meta` | `{}` at create; omitted/null keeps on update, `{}` clears; delivered as `message.account.meta`; bot_open_id/robot_code are read by the respective connector. |
| `groups` | Default `[]`; omitted/null keeps, `[]` clears. This is the account **population**, not provider group chats. |
| `peer_identity` | Optional platform-side personal identity, unique per platform across the instance; omitted/null keeps on update and never clears; conflicts answer 409 — no silent binding hijacking. |

Static platform credentials use `app_id`/`app_secret` with an optional
`base_url` constrained by the platform host allowlist; credentials live in
the resource's secret section or the encrypted inline field — **never in
meta or repo prose**.

AccountPublic fields:
`id,name,platform,enabled,resource,has_inline_credentials,meta,groups,peer_identity,status,status_message,created_at,updated_at`
(resource/peer/status_message nullable). `status` is
`ok|degraded|needs_reauth` — it **does not prove message delivery**.
`GET …/<name>/health` reads connections/lease; `GET …/<name>/messages`
reads the processing ledger. Default caps: 500 per project, 2000 total, 200
accounts served per instance (operator-configured) — exceeding them is not
solved by recreating accounts.

## The full trigger contract

`POST /projects/<slug>/im/triggers`, `GET …/im/triggers`,
`PUT|DELETE …/im/triggers/<name>`; create and update share the full form.

| Field | Default/condition |
| --- | --- |
| `name`, `platform`, `target` | Required: name, platform enum, an existing `{kind:script\|workflow,name:"folder/name"}`. |
| `enabled` | true. |
| `account` | Omitted/null funnels **all** of the project's enabled accounts on that platform; a name pins one account whose platform must match. |
| `account_groups` | `[]` imposes no population restriction; non-empty narrows by account population membership. |
| `chat_type` | Default any; direct/group otherwise; a filter cannot create traffic the platform lacks. |
| `keyword` | Omitted/null matches everything; otherwise a case-insensitive substring over normalized text (media-only messages may have empty text). |
| `require_mention` | false; meaningful for Feishu/Lark only; WeCom/DingTalk group messages already arrive only via @; native WeChat group support is unestablished. |
| `inputs` | Default null; only object constants merge — prefer `{}`. |
| `params` | Default `{}`; "param → `{from:<dotted-path>,required:false,default?:<JSON>}`" such as `message.text`/`message.raw.priority`. Missing/null leaves use `default` when present; required-without-default fails; optional-missing stays absent. **No HTTP-style type declarations here.** |
| `params_strict` | false passes message plus declared params; true omits message (constants still merge); declared values override same-named constants. |
| `max_concurrent_runs` | 4; read at connection establishment, bounded per account, changes apply on reconnect; **not** a global per-trigger ordering guarantee. |
| `identity_mode` | Default off; also optional/required (below). |
| `identity_key` | Omitted/null uses `message.sender_id`; a dotted envelope path. |
| `identity_rule` | Optional template; must contain `{key}`. |
| `identity_prompt` | Optional unbound reply; must contain `{url}`. With mode off, all identity fields must be blank/omitted. |

The trigger PUT is a **full replacement**: omitted optionals revert to
defaults; clearing is per-field via `[]`/`{}`/null/explicit false — not a
merge patch (the account update's keep semantics above is the separate
exception). One message can match several triggers and **runs once per
trigger** — first-match-wins is not a thing here.

TriggerPublic returns `account_id` (nullable UUID), not the submitted
account name, and `target_kind,target_name` instead of a nested target; the
remaining fields are
`id,name,enabled,platform,account_groups,chat_type,keyword,require_mention,inputs,params,params_strict,max_concurrent_runs,identity_mode,identity_key,identity_rule,identity_prompt,created_at,updated_at`.

## Input, output and shared identity

Default parameters = constants plus `message:{platform,
account:{id,name,meta},chat_type,chat_id,sender_id,kind,text,mentioned,
raw,reply_handle}`:

- `kind` is text/image/voice/file/video/event; `raw` and media fields vary
  by platform — no connector is guaranteed to download or transcribe.
- `reply_handle` is a sensitive routing capability, **not** a permanent
  universal target.
- `identity_mode: off` adds no `message.identity` and runs as system:im;
  `optional` adds the bound user object or null; `required` blocks unbound
  senders. After binding, authorization and resource identity forwarding use
  the **active project user's** principal — the binding itself grants no
  permissions.

The shared binding key is `(project,platform,sender_key)`, independent of
any bot account. Flow: look for an existing binding → try the
`identity_rule`; a template matching an existing active project-user
identity persists the binding. `identity_rule:"jwt:corp:{key}"` is usable
only when the provider key truly equals the IdP subject — it creates no
user and proves no arbitrary meta. Manual binding:

```http
POST /projects/demo/im/identities
Content-Type: application/json

{"platform":"feishu","sender_key":"synthetic-open-id","user":"alice"}
```

The answer carries
`id,platform,sender_key,project_user_id,identity,display_name,bound_via:"admin",bound_at`;
view with `?user=alice&platform=feishu` and remove via
`DELETE …/im/identities/<id>`.

Under `required`, an unbound **direct-chat** user receives a signed
**15-minute** project login link; the `/p/<slug>/_chat/bind` page demands
project credentials and runs the login pre-hook. Group chats only suggest
moving to a direct chat — sender bind links are never leaked to the whole
group. Deactivated users are not valid bindings. Account populations,
`peer_identity`, invitation meta and project-user identity bindings are
**four different mechanisms** that never automatically trust each other.

Returning platform-appropriate text/JSON auto-replies; null sends nothing;
WeCom replies over the connection while other platforms have their own send
constraints. **A successful script or an accepted provider API call proves
nothing about a human reading it.**

## Delivery, health and recovery

- One lease-holding instance holds each account's connection; the claim
  dedup ledger is written first, then ack/cursor persistence; each matching
  trigger has its own message identity. Duplicate delivery is usually
  suppressed, but **exactly-once external effects are not guaranteed**.
- Provider acks can land **after the persistent claim but before script
  success** — unlike RabbitMQ's success→ack order. Script failures are not
  automatically retried, there is no generic replay API, and stranded old
  work is marked failed after a one-hour threshold; the ledger is not a
  full payload replay archive. **Critical business flows need their own
  durable outbox/work table and business ids.**
- Transient disconnects back off 2–60 seconds and reset on healthy
  sessions; revocation/config errors park at `needs_reauth` for human
  repair — updating credentials clears it, while toggling `enabled` does
  not.
- Concurrency is per account with no global strict ordering; script edits
  apply live while connection-level settings need a reconnect. Timeouts
  roll back no writes or sent messages; disabling/deleting waits for
  reconciliation to stop new routing/connections and **does not atomically
  cancel** in-flight effects.
- Investigation order: health → ledger → execution logs → fix target/
  credentials → confirm existing side effects before retrying business.

## Self-service invites and the repo lifecycle

- Native WeChat QR establishes a **bot account**, distinct from
  sender→project-user binding.
- Content editors may `POST …/im/bind-links` with
  `{platform:"weixin",label?,ttl_hours:24,max_uses:50,groups:[],meta?:{…}}`:
  TTL must be positive under the deployment cap (default 168h); max_uses
  clamps to 1–configured max (default 500); meta must be an object encoded
  within 4096 bytes. The answer `{id,url,expires_at,max_uses}` shows the
  **URL exactly once**.
- Requires `VIAT_IM_BIND_BASE_URL`; the page prefix defaults to `/ui`;
  proxy IP rate limiting needs trusted-proxy configuration.

> [!WARNING]
> A bind URL is an **unauthenticated account-creation capability**:
  per-person identity assertions must come as short-lived single-use links
  issued by an authenticated person's business system; invitation meta
  wins over a self-entered display_name. Review/revoke links and usage
  before cleanup; revocation blocks future use only and **stops no already
  created account**.

The repo supports the **chat** collection with no standalone chat CLI:
`im/accounts/<name>.yaml`, `im/triggers/<name>.yaml`,
`viat pull/push --only chat`. Resource-credential accounts and triggers
mirror normally; **inline/QR accounts are skipped on pull and not deleted
when missing on push** — triggers referencing them are therefore not fully
portable. Locally missing resource accounts/triggers delete their remote
counterparts, so diff first. Cleanup order: disable test triggers/accounts
→ revoke invitations → remove test identity bindings → delete the isolated
config; deleting local files revokes no provider credentials or external
messages.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/handlers/{im,im_bind,im_identities}.rs`,
`im/{mod,dispatch}.rs`, `im/connector/*`; `crates/viat-core/src/types/im.rs`;
`crates/viat-cli/src/repo/im.rs`. Real provider behavior was not verified in
this task.
