---
title: "Weixin assistant: private chat through native iLink"
description: "A disabled-by-default, sender-authorized command handler with manual QR and reauthentication lifecycle."
doc_id: applications.weixin-assistant
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Private-chat Weixin assistant

The complete `examples/weixin-assistant/` module routes **native Tencent iLink private chat** to the real Python `wx_reply` handler. It supports fixed English/Chinese help and status commands, not group assistance, WeCom, official-account webhooks, media transcription, arbitrary conversations, device control or unsolicited messaging. `/status` reports only that this command handler answered, never physical/provider health.

**Verification status:** the coordinator's offline harness passed all **5 unit tests** against the deployed handler with an explicit fake context, not a fake successful provider binding. Real-server routing, QR scans, connector polling, account login, provider replies and reauthentication remain unverified. Full provider interaction cannot be validated offline; see [verification layers](../reference/validation.md).

## Prerequisites and consent

Use activated server/CLI **1.1.0**, server Python/uv, platform login and a new isolated project. Developer/Owner/Admin can edit scripts/resources and sender bindings; publishing optional HTTP endpoints needs Owner/Admin. Account/trigger/QR management currently requires project membership. Workstation Python 3 is sufficient for offline units.

A real run additionally needs provider eligibility/availability, server HTTPS access to permitted iLink hosts, a consenting human with the intended Weixin account, and an existing active **project end user** with usable login/MFA. The QR binds a bot account, **not** a project-user identity. Binding slots/takeover and provider policies may change; verify current rules before scanning. Rebinding may supersede an existing assistant's token. Do not promise permanent authentication or a lifetime reusable binding.

Read [native Weixin](../triggers/weixin.md), [chat identities](../triggers/chat-accounts.md) and [project-user auth](../auth/endpoints.md). No `viat weixin` command exists.

## Files, input and default output

- `project/scripts/wx_reply.py`: actual deployed handler; no network calls or secret reads.
- `project/resources/wx_settings.yaml`: account name, **empty** sender→user allowlist, message flag false.
- `project/im/triggers/wx_private.yaml`: native routing, pinned `wx-example` account, `chat_type:direct`, `identity_mode:required`, **enabled:false**, script target **`name:wx_reply`**.
- `manual/account-create.json`: actual account create payload with **enabled:false** and empty credentials, deliberately **outside repo-sync `im/accounts/`**. A QR/inline-secret account cannot be represented by a portable resource-backed account file.
- `project/workflows/wx_check.yaml` and `endpoints/weixin-assistant/weixin-check.post.yaml`: an inert diagnostic path, not a chat webhook. Endpoint target uses **`ref`**, denies all authorizers and stays unpublished. An HTTP caller cannot fabricate a trusted chat principal by sending a message JSON object.
- `fixtures/inbound.json`: normalized synthetic, **unbound** private-chat input, no context token, no usable account or sender binding. `fixtures/expected.json` records null for disabled/unbound runs and fixed reply texts for explicitly fake bound unit contexts.

The entire default settings resource is:

```json fixture=weixin-assistant/project/resources/wx_settings.yaml
{"name":"wx_settings","kind":"config","plain":{"data":{"account_name":"wx-example","messages_enabled":false,"sender_users":{}}},"secret":{}}
```

Default script output is **null**, which sends no automatic reply. No schedules exist. The trigger and manually created account are both disabled. Native required-identity prompts are a separate platform send path: once you enable routing, an **unbound** sender can receive a binding link even while `messages_enabled:false`. Do not enable routing unless that provider interaction is explicitly authorized.

## Apply the inert content

From the handbook root, manually and only in your own authorized isolated instance:

```sh
cd examples/weixin-assistant
python3 -I validate.py
cd project
viat project create weixin-assistant-example "Weixin assistant example"
viat project select weixin-assistant-example
viat project diff --only resources,scripts,workflows,endpoints
viat push --only resources,scripts,workflows,endpoints
viat workflow test wx_check --input '{}'
viat endpoint list --json
```

Expected workflow result: `{"reply":null}`. Record created names/IDs privately. This runs a real draft on the server if you execute it; the offline validator does not. Use another unused slug consistently in `viat.yaml` and commands if needed. The new tree prefix is `/weixin-assistant`, so the optional HTTP diagnostic path would be `/p/weixin-assistant-example/weixin-assistant/weixin-check`, but leave it unpublished and deny-all. No publish step is required for native chat: chat targets run **live drafts**.

Do not use all-kind push: minimal metadata omits authorizers/roles/scope claims and can prune seeded auth configuration. `--only` selects whole kinds, not names. Endpoint sync may prune nodes in visited trees; chat sync may prune other resource-backed accounts/triggers, even when their local files are absent. Use an isolated project and review diffs. There is no `push --prune` safety mode to add later.

## Create the disabled QR account, then register the disabled trigger

`manual/account-create.json` is the exact full create body. From `project/`, a manual console-authenticated request is:

```sh
viat call --console --method POST /projects/weixin-assistant-example/im/accounts \
  --body '{"name":"wx-example","platform":"weixin","enabled":false,"credentials":{},"meta":{},"groups":["weixin-assistant-example"]}'
viat call --console /projects/weixin-assistant-example/im/accounts
viat project diff --only chat
viat push --only chat
viat call --console /projects/weixin-assistant-example/im/triggers
```

The account must exist **before** pushing the trigger that refers to it. Expect an actual returned UUID, `resource:null`, `has_inline_credentials:true`, `enabled:false`; empty credentials are **not ready/authenticated**. Trigger response flattens the target into `target_kind/target_name` and returns `account_id` rather than account name. Verify `enabled:false`, `chat_type:direct`, `identity_mode:required`, account UUID and `wx_reply` target. Stop on any unexpected deletion/change; do not resolve a name conflict by overwriting a real assistant.

## Manual QR start and poll

These operations contact the provider; obtain explicit permission before them. Use the console Accounts → Binding UI, or these registered API routes via console credentials:

```sh
viat call --console --method POST /projects/weixin-assistant-example/im/accounts/wx-example/bind/start --body '{}'
```

Response contains `qr_url` and sealed `poll_handle`. Render the QR URL privately, have the intended human scan and confirm, and pass **the returned handle unchanged** to:

```http
POST /projects/weixin-assistant-example/im/accounts/wx-example/bind/poll
Content-Type: application/json
Authorization: Bearer <platform-token>

{"poll_handle":"<actual-sealed-handle-from-start>"}
```

Poll until progress is confirmed or terminal; waiting/long-poll timeout is not authentication failure. Invalid/expired handle requires a new start. Confirmation returns `state:"confirmed"`, `already_bound` and `peer_identity`; provider credentials remain server-side. Do not save tokens, QR handles or QR screenshots to this repo/logs. The provider's internal polling ticket is not a QR image URL. Allowed QR/confirmation hosts are controlled by `VIAT_IM_WEIXIN_HOSTS`; do not bypass them. Keep account disabled until the authorized exercise, and confirm state through account list/health rather than guessing from a QR scan.

## Bind and authorize the actual sender

The trigger requires a platform-resolved active project-user binding. The handler then additionally requires:

1. `message.platform == "weixin"`, direct chat and the configured account name.
2. A non-null **trusted** `ctx.principal.user_id`, `ctx.principal.authorizer == "chat"` and matching `message.identity.user_id`.
3. The actual provider `message.sender_id` mapping to exactly that same UUID in server-owned `wx_settings.plain.data.sender_users`.
4. Text kind, text length <=256 characters, and `messages_enabled is True`.

Account `meta`, QR `peer_identity`, invitation claims, display names and raw user input are not substitutes. Bindings are keyed by `(project,weixin,sender_key)`, not by the bot account; a shared invitation can bind the wrong person. Do not invent an `identity_rule` to make synthetic sender IDs look valid.

Choose one real binding procedure:

- **Self-service:** after explicit permission for polling and the native binding prompt, enable the account in console while preserving its credentials and enable the trigger with its full existing policy (`identity_mode:required`, direct, pinned account). Keep application replies off. Have the intended person send one private text; the native dispatcher may send a **15-minute** project-login link. That person completes login/MFA as their own active project user. The platform persists the binding; it does not grant application permission automatically. Pause routing again while reviewing the result.
- **Admin-assisted:** an editor independently verifies the provider sender key and human's existing project-user identity, then `POST /projects/<slug>/im/identities` with `{platform:"weixin",sender_key:<verified-key>,user:<existing-user-identity>}`. The `user` field is the actual identity string, not a guessed UUID. Do not submit the synthetic fixture as a binding. Review `GET /projects/<slug>/im/identities?platform=weixin`; preserve the returned binding ID for owned cleanup.

After a consented inbound event, the account's `/messages` ledger can show `sender_id`; match it to the authenticated binding and actual user UUID (`viat p-user list --json`), not an unverified screenshot/name. Store only that verified mapping in `sender_users`; keep real personal identifiers out of committed fixtures. `viat push --only resources` updates the app policy without publishing. Only then, with separate consent for replies, set `messages_enabled:true`, and enable the account/trigger for the authorized session. Console trigger updates are full replacement: preserve all filters, target, inputs, concurrency and required identity fields. If using repo `enabled:true`, review `viat project diff --only chat` before pushing it. Default source remains disabled; don't commit an enabled operational copy.

## Assert private routing and safe replies

With the real authorized binding and reply opt-in, `/help` and `帮助` return fixed help; `/status` and `状态` return fixed handler-availability text. Unknown commands return a short bilingual refusal, not an echo of the message. Image-only/oversized/other-platform/group/other-account/unlisted-sender inputs return null. Native groups are **not an established capability**: a parser recognizing `group_id` does not prove supported group delivery, and `require_mention` does not create it.

The handler does not expose `raw`, `reply_handle`, QR tokens or context permits and has no LLM/tool/action path. `validate.py` loads the actual deployed `wx_reply.py`, shared config and synthetic inbound fixture; it explicitly creates a **test-only** fake principal/binding in memory to cover enabled replies and all authorization denials. No synthetic valid binding is deployed or claimed. A pass does not prove real identity injection, provider normalization, polling or sending.

Manual inspection routes:

```sh
viat call --console /projects/weixin-assistant-example/im/accounts/wx-example/health
viat call --console /projects/weixin-assistant-example/im/accounts/wx-example/messages
```

Read account status, dedup/message outcome and execution logs together. `ok`, successful handler output or provider acceptance is not recipient delivery/read confirmation. Test absence of permission as well as success; required-mode denial may produce the native binding prompt, while an already bound but app-unlisted sender receives no handler reply.

## Poll cursor, context_token and `-14` recovery

Native iLink long-polls HTTPS `getupdates` (around 35 seconds; client timeout 40 seconds), repolls empty timeout, and persists `get_updates_buf` after durable batch claim. Replayed batches are ordinarily deduplicated; durable claim/cursor advance is not proof every script/reply succeeded. Chat routing is not exactly-once external execution or a generic replay queue.

Replies require the recipient's inbound **`context_token`** conversation permit. The native connector/dispatcher retain it and use it for the handler's returned text; the application does not mint it, store it as a permanent credential or send to arbitrary peers. The fixture intentionally has no valid permit. A scheduled job cannot create permission to message a silent recipient. A successful unit return is therefore **not** a successful provider send test.

Provider `errcode:-14` means stale/replaced bot token: account becomes `needs_reauth` and polling stops. Do not loop refreshes, retry sends or toggle enabled expecting repair. Pause the trigger, have the intended human restart QR binding, inspect confirmed credentials/status and verify `/health` before an explicitly approved resume. Treat handle expiry separately from bot credential revocation; transient transport errors use reconnect backoff (2–60 seconds). Never promise permanent auth, automatic token refresh or guaranteed recovery of all failed messages. Inspect existing effects before any manual business replay.

## Cleanup only owned registered objects

Set `messages_enabled:false`, restore the local trigger to `enabled:false`, and disable the owned account/trigger in the console with full preserved policy. Wait for reconciliation and account for in-flight replies; disabling is not instantaneous cancellation. Revoke only invitations you actually minted (none are required by this module). After inspecting recorded ownership:

```sh
viat call --console --method DELETE /projects/weixin-assistant-example/im/triggers/wx_private
viat call --console --method DELETE /projects/weixin-assistant-example/im/accounts/wx-example
viat endpoint delete CHECK_ENDPOINT_ID
viat workflow delete wx_check
viat script delete wx_reply
viat resource delete wx_settings
```

`CHECK_ENDPOINT_ID` is the recorded owned diagnostic leaf; if someone explicitly published it, unpublish it first. Delete the **owned** sender binding with `DELETE /projects/weixin-assistant-example/im/identities/<recorded-binding-id>` only after ensuring no other bot relies on that project-wide binding. Remove a disposable user only if you created it. Delete the `weixin-assistant` tree only if newly created and now empty (`viat tree delete weixin-assistant`).

Deleting config does not unbind/revoke the provider credential or erase sent messages; handle provider-side revocation under current provider policy. QR/inline accounts are skipped on pull and protected from absence-based push deletion, so deleting local files is **not** cleanup. Chat triggers are mirrored and can be pruned: do not use a partial checkout/blanket prune to remove them. There is no registered project DELETE route in 1.1.0; the empty project can remain.

## Evidence and remaining manual requirements

Pinned product evidence: `crates/viat-cli/src/repo/{im,endpoints}.rs`, `crates/viat-api/src/im/{dispatch,connector/weixin}.rs`, `handlers/{im,im_identities}.rs`, registered routes in `crates/viat-api/src/lib.rs` and Python principal/resource projection. [Repo sync](../projects/repo-sync.md) owns mirror semantics.

Still required: real eligible provider account, current binding policy/consent, approved hosts, actual QR/poll confirmation, project-user login/binding, verified sender mapping, fresh context permit, real private routing/reply observation and a manual revoked-token reauth exercise if authorized. Offline fixtures deliberately make no provider/group/permanent-auth integration claims.
