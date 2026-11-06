---
title: "Chat accounts, routing and identity"
description: "Shared complete account/trigger contract, sender binding, delivery and repo synchronization."
doc_id: triggers.chat-accounts
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Chat accounts, routing and identity

This is the shared contract for [WeCom](wecom.md), [WeChat](weixin.md), [Feishu](feishu.md), [Lark](lark.md) and [DingTalk](dingtalk.md). Read it together with the platform page: their transports and send capabilities are not interchangeable. Accounts hold credentials/connections; triggers select messages and bind them to existing **script/workflow** targets. No endpoint targets. Configuration and target drafts are live; no publish step. This subsystem does not add native HomeAssistant, MQTT or Slurm connectors.

All API examples are source-derived/unexecuted. Real QR scans, chat sends and provider calls require explicit opt-in. Account/trigger CRUD and account QR APIs currently require a **project member**. Minting/revoking self-service links requires content-edit rights; listing links/uses requires membership. Sender identity create/delete requires Owner/Admin/Developer project rights; listing requires membership. These are management credentials, separate from the end-user identities a message can resolve to.

## Complete account contract

`POST /projects/<slug>/im/accounts` creates; `GET …/im/accounts` lists; `PUT|DELETE …/im/accounts/<name>` updates/deletes. Account fields:

| Field | Create / update |
| --- | --- |
| `name` | Required nonblank string; PUT can rename the account addressed by the old name. |
| `platform` | Required `wecom|weixin|feishu|lark|dingtalk`; preserve it when editing credentials. |
| `enabled` | Default true, including PUT; preserve false explicitly when editing a paused account. |
| `resource` | Name of a credential resource, mutually exclusive with credentials. |
| `credentials` | Inline JSON, encrypted at rest, never serialized back. Exactly one of resource/credentials is required on creation; WeChat starts with `{}` before QR. On update both omitted/null preserve the current credential source. Supplying one switches source; there is no plaintext secret-read API. |
| `meta` | Creation default `{}`; update omission/null preserves, `{}` clears metadata. Carried in message.account.meta; provider-specific bot_open_id/robot_code are interpreted by their connector. |
| `groups` | Default `[]`; update omission/null preserves, `[]` clears. Account populations, not provider chat rooms. |
| `peer_identity` | Optional platform-side human identity; unique per platform deployment-wide. Omission/null on update preserves, not clears. A duplicate is 409 rather than a silent binding takeover. |

Credential JSON for static platforms uses `app_id`, `app_secret`; optional `base_url` is confined by platform host allowlists. Put credentials in the resource's secret portion or the encrypted inline field, not in meta/repo prose. Returned AccountPublic has **all** `id,name,platform,enabled,resource,has_inline_credentials,meta,groups,peer_identity,status,status_message,created_at,updated_at`; resource/peer/status_message can be null. Status is `ok|degraded|needs_reauth`, not proof of message delivery. `GET …/<name>/health` reports connection/lease health, `GET …/<name>/messages` returns recent processing ledger. Default ceilings: 500 accounts/project, 2000 total, 200 served/instance, configurable by operator; reaching a cap is not solved by retrying account creation.

## Complete trigger contract

`POST /projects/<slug>/im/triggers`; `GET …/im/triggers`; `PUT|DELETE …/im/triggers/<name>`. Create/update use the same full-form fields:

| Field | Default / conditions |
| --- | --- |
| `name`, `platform`, `target` | Required name, platform enum above, existing `{kind:script|workflow,name:"folder/name"}`. |
| `enabled` | true. |
| `account` | Omitted/null matches every enabled platform account in this project; a name pins one and must match platform. |
| `account_groups` | `[]` means no population restriction; nonempty narrows account fan-in by population membership. |
| `chat_type` | `any`; also `direct`, `group`. A filter cannot create unsupported platform traffic. |
| `keyword` | Omitted/null matches all; otherwise case-insensitive substring of normalized text. Media-only text may be empty. |
| `require_mention` | false; meaningful only for Feishu/Lark, since WeCom/DingTalk group arrival already implies mention, and native WeChat group support is not established. |
| `inputs` | Defaults null; execution merges object constants, otherwise no constants. Prefer explicit `{}`. |
| `params` | `{}`: argument name → `{from:<dotted path>,required:false,default?:<JSON>}`; paths address the envelope, e.g. message.text/message.raw.priority. Missing/null leaves use default if present; missing required without default fails; missing optional remains absent. No HTTP type-coercion declaration here. |
| `params_strict` | false: include message as well as declared params. true omits message; constants still merge. Declared values override same-named constants. |
| `max_concurrent_runs` | 4; connection-time concurrency bound per account, changes apply on reconnect. It is not a global per-trigger ordering guarantee. |
| `identity_mode` | off; optional or required described below. |
| `identity_key` | Omitted/null uses message.sender_id; dotted envelope path. |
| `identity_rule` | Optional template, must contain `{key}`. |
| `identity_prompt` | Optional unbound reply, must contain `{url}`. Identity fields must be blank/absent when identity_mode is off. |

PUT is **full replacement** for trigger policy: omitted optional values reset to their defaults; use `[]`, `{}`, null and explicit false as appropriate, not a guessed merge patch. Account update has the special preservation semantics above. A message can match multiple triggers and run each once; fan-in is not first-match-only.

Response TriggerPublic uses `account_id` (nullable UUID), **not** the submitted account name, and `target_kind,target_name`, **not** nested target; other returned fields are `id,name,enabled,platform,account_groups,chat_type,keyword,require_mention,inputs,params,params_strict,max_concurrent_runs,identity_mode,identity_key,identity_rule,identity_prompt,created_at,updated_at`.

## Input, output and shared identity

Default args are constants plus `message:{platform,account:{id,name,meta},chat_type,chat_id,sender_id,kind,text,mentioned,raw,reply_handle}`. `kind` is text/image/voice/file/video/event; raw/media fields are provider-specific, not automatically downloaded/transcribed in all connectors. `reply_handle` is sensitive routing capability, not a durable universal destination. With identity_mode off, no message.identity is added and run principal is system:im. optional adds a bound project-user object or null; required blocks an unbound sender. Bound runs carry that active user's principal into authorization/resource identity forwarding, without granting permission merely because binding succeeded.

Bindings key `(project,platform,sender_key)` independently of the particular bot account. Lookup existing binding **before** trying identity_rule; a rule renders an existing active project-user identity and persists the binding. `identity_rule:"jwt:corp:{key}"` is only safe when the provider key and IdP subject genuinely align. It does not create a user or prove an arbitrary metadata claim. Manual binding:

```http
POST /projects/demo/im/identities
Content-Type: application/json

{"platform":"feishu","sender_key":"synthetic-open-id","user":"alice"}
```

Response includes `id,platform,sender_key,project_user_id,identity,display_name,bound_via:"admin",bound_at`. List with optional `?user=alice&platform=feishu`, remove `DELETE …/im/identities/<id>`. Under required mode an unbound direct sender may receive a signed **15-minute** project-login binding link; the page under `/p/<slug>/_chat/bind` requires the project's own credentials and login pre-hook. A group gets a request to DM instead, never a sender binding link exposed to all members. Disabled users are not treated as valid bound users. Account populations, peer_identity, invitation meta and project-user identity bindings are distinct mechanisms; none automatically grants another's trust.

Return text/JSON appropriate to the provider to reply; a null output sends no automatic reply. [WeCom](wecom.md) replies over its held connection, the others have their documented sending constraints. A successful script or accepted provider API response is not proof the human read the message.

## Delivery, health and recovery

One leased instance holds each account connection. Messages claim a dedup ledger before acknowledging/persisting cursor; each matching trigger has its own message identity. This suppresses ordinary redelivery, **not exactly-once external side effects**. Connector acknowledgement may occur after durable claim but before target success, so it is not RabbitMQ's success→ack contract. No generic auto-retry of every failed script or replay API is promised. Stranded old work is retired as failed (one-hour threshold); the ledger is not a complete replay payload archive. Use a business id and separate durable outbox/work table when losing/repeating an action is unacceptable.

Transient connection failures back off 2–60 seconds; a healthy session resets delay. Revoked/misconfigured credentials stop in needs_reauth, requiring a human fix. Updating credentials clears that stuck state; toggling enabled alone is not credential repair. Concurrency is per account, no strict global order; edits to scripts are live, and connection-level settings take effect on reconnect. Runtime timeout does not undo resource writes or provider sends. Disabling/removing a trigger/account stops new routing/connections after reconciliation, not atomic cancellation of in-flight side effects. Inspect health, ledger and execution logs, repair credentials/target, then deliberately retry business work after checking prior effects.

## Self-service account invitation and repo lifecycle

Native WeChat QR account provisioning is separate from sender→project-user binding. An editor may mint `POST …/im/bind-links` with `{platform:"weixin",label?,ttl_hours:24,max_uses:50,groups:[],meta?:{…}}`. TTL must be positive and is capped by deployment default maximum 168h; max_uses clamps 1–configured ceiling (default 500). meta must be an object <=4096 encoded bytes. Response `{id,url,expires_at,max_uses}` shows URL **once**. Requires `VIAT_IM_BIND_BASE_URL`; page prefix defaults `/ui`, proxy IP throttling requires trusted proxy configuration. The URL is an unauthenticated account-creation capability. A per-person identity assertion needs a short, one-use link issued **after your system authenticates them**; invitation meta outranks self-typed display name. List/revoke links and inspect uses before cleanup. Revocation prevents future use, not messages from accounts already created.

Repo sync supports **chat**, not invented standalone chat CLI commands: `im/accounts/<name>.yaml` and `im/triggers/<name>.yaml`, `viat pull/push --only chat`. Resource-backed accounts and triggers mirror normally; inline/QR credential accounts are skipped on pull and protected from mirror deletion on push. Triggers can therefore reference accounts that are not portable. Missing resource-backed accounts/triggers locally can delete remote ones; diff first. Disable isolated triggers/accounts, revoke invitation links, remove test identity bindings and only then delete test configuration. Removing local files does not revoke provider credentials or undo external messages.

Evidence: `crates/viat-api/src/handlers/{im,im_bind,im_identities}.rs`, `im/{mod,dispatch}.rs`, `im/connector/*`; `crates/viat-core/src/types/im.rs`; `crates/viat-cli/src/repo/im.rs`. No live provider behavior was checked in this documentation task.
