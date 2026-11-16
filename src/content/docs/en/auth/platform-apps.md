---
title: "Delegated platform applications"
description: "Provider-specific third-party app setup, callbacks, authorization storage, secret rotation and limits."
doc_id: auth.platform-apps
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Delegated platform applications

A platform app lets a project operate as a **third-party service
provider** over customer-authorized accounts. It is not platform-console
SSO, not a chat account, not a generic resource. A first-party social
login uses its own app credentials; a **delegated**
[social authorizer](authorizers.md) instead references `platform_app`
plus the authorized account's `app_id`.

## Provider support boundaries

| `config.provider` | Delegatable social providers | Tickets/customer authorization |
| --- | --- | --- |
| `weixin_tp` | `weixin_mp`, `weixin_mini` | Component ticket, customer authorization links, account message callbacks |
| `wecom_tp` | `wecom` | Suite ticket, installation links, enterprise message callbacks |
| `alipay_isv` | `alipay`, `alipay_mini` | RSA-signed ISV gateway, merchant `app_auth_token`; **no** platform-push ticket |
| `dingtalk_isv` | `dingtalk`, `dingtalk_app` | Suite ticket and enterprise authorization pushes; **generates no customer authorization URL** |
| `douyin_tp` | `douyin_mini` only | Third-party mini-program ticket, authorization links, rotating delegated credentials |
| `kuaishou_tp` | `kuaishou_mini` only | Provider-specific push/key formats, authorization links, rotating delegated credentials |

A Douyin/Kuaishou **mini-program** platform is not delegated web-login
support; a WeChat component cannot proxy `weixin_open`; WeCom does not
interchange with WeChat — configuration validates compatibility. This
support **promises neither** the provider's full API, merchant payment
features, release flows, marketplace review, nor arbitrary
event-to-script capability.

## Prerequisites and management permissions

You need: a registered/reviewed provider app with the required
capability, an HTTPS public callback the **provider can reach**, a stable
instance public URL, and project editor membership
(`owner`/`admin`/`developer`). This page performs or proves no provider
registration; on an intranet deployment, "Viat accepts the URL" **does
not** mean the provider can reach it.

| Management route | Purpose |
| --- | --- |
| `GET/POST /projects/{slug}/platforms` | List/create |
| `GET/PUT/DELETE .../platforms/{name}` | Read/update/delete |
| `GET .../platforms/{name}/authorizations` | Customer authorization inventory |
| `DELETE .../platforms/{name}/authorizations/{authorizer_ref}` | Delete the local authorization and clear the account token cache |
| `POST .../platforms/{name}/authorize-url` | No body; generates a fresh customer link when supported, returning `{url,redirect_uri}` |

**Reads require editors too**; these are not anonymous callback
interfaces. Provider callbacks are public protocol routes with
signature/encryption checks — not platform bearer management routes.

## Full create/update shape

- Creation requires `{name,config,secret}`: `name` is the project-local
  app identifier (a path-safe name like `fixture-component`);
  `config` must carry `provider` and `app_id` (non-empty, ≤128 bytes);
  **although the DTO marks secret optional, creation requires it**.
  Updates cannot change the provider; `name` is a path identifier, not
  an updatable field.

| config field | Default/validation |
| --- | --- |
| `provider` | Required, one of the six values above |
| `app_id` | Required; the component appid / suite id / ISV app ID |
| `alipay_public_key` | Required Alipay-ISV verification RSA public key (PEM/base64) |
| `post_authorize_redirect_uri` | Omitted/null = the Viat completion page; otherwise a parseable URL |
| `api_base`, `auth_base` | Provider defaults; test/egress overrides must be HTTPS or loopback HTTP |
| `legacy_api_base` | DingTalk's legacy tmp_auth_code gateway, default `https://oapi.dingtalk.com`, same-origin validation |

Secrets: WeChat/WeCom/DingTalk/Douyin/Kuaishou require non-empty
`app_secret` (≤1024 bytes), the callback-signing `token` (≤128 bytes) and
`encoding_aes_key` — usually the provider's 43-character material, but
**Kuaishou uses 32-byte base64**, not the same text format. Alipay uses
a valid RSA PEM/base64 `app_private_key` plus the config public key and
**requires no** ticket/token/AESKey. **Never** copy real callback tokens
or private keys into examples.

Source-derived, unexecuted `POST /projects/demo/platforms` body:

```json
{"name":"fixture-component","config":{"provider":"weixin_tp","app_id":"fixture-component-appid","post_authorize_redirect_uri":"https://app.example.invalid/authorized"},"secret":{"app_secret":"REPLACE_WITH_PROVIDER_SECRET","token":"REPLACE_WITH_CALLBACK_TOKEN","encoding_aes_key":"REPLACE_WITH_VALID_PROVIDER_AES_KEY"}}
```

The placeholders are deliberately not valid registered/crypto keys;
submit provider material only inside an approved real configuration.

`PUT .../{name}` updates: omitted/null `config` keeps, an object
**replaces wholesale**; omitted/null secret keeps; a provided secret
**merges non-empty values field by field** with blanks keeping the old
value — so rotating `app_secret` never clears the neighboring callback
token/AES key. There is **no** "blank erases the secret" operation.
Updates clear the app token cache to stop stale credential reuse.
Changing provider = creating another app, not a partial secret patch.

## Callback URLs and configuration order

The app response carries `id`, `name`, `provider`, `config`,
`uses_ticket`, `has_ticket`, nullable `ticket_at`, `callback_url`,
nullable `message_callback_url`, `has_authorize_url`, nullable
`authorized_url`, `created_at`, `updated_at` — exposing **neither** the
secret blob nor ticket strings. **Copy the URLs from the response**
(keeping the deployment prefix and name escaping):

- Provider push/verification:
  `BASE/p/demo/_platform/fixture-component/callback` (GET/POST).
- WeChat account messages: same root `/callback/$APPID$`.
- WeCom messages: same root `/callback/$CORPID$`.
- Supported customer return page: same root `/authorized` (GET).

Configuration order:

1. Create the app with matching provider credentials and register the
   returned callbacks (and applicable account templates) in the provider
   console.
2. Complete callback verification. Ticket-based providers need **real
   pushed tickets**: `has_ticket:false` means waiting, not
   authorization-ready; Alipay's `uses_ticket:false` is normal.
3. When `has_authorize_url:true`, request a **fresh** authorization link
   for the customer — pre-authorization codes expire, so never publish
   generated links permanently. DingTalk authorizes via marketplace/
   in-app deployment/console QR codes with results arriving as pushes;
   calling authorize-url returns a diagnostic error.
4. Customer returns/pushes store the account authorization and encrypted
   credentials, or mark revocation; supported return flows carry signed
   state — **never** forge the return query parameters.
5. After reviewing the authorization inventory, create the compatible
   social authorizer
   `{provider,app_id:<authorized-account>,platform_app:<name>}` — which
   still needs roles and published endpoint admission.
6. Only with explicit approval, test logins with **real provider
   codes**; static configuration/`has_ticket` proves no working SSO.

Authorization entries carry `id`, `authorizer_ref`, `kind`, nullable
`display_name`, a `scopes` array, a `meta` object, `status`
(`active`/`revoked`), `authorized_at`, nullable `revoked_at`,
`updated_at` — never credentials or ciphertext bytes. `active` reflects
the authorization state Viat stored and **guarantees neither** each
provider scope nor downstream request success.

## Secrets, revocation and exit

- Customer-delegated refresh/authorization material stays platform-side;
  Douyin/Kuaishou's single-use rotating refresh credentials **cannot** be
  safely duplicated to two independent refreshers; never log full
  upstream payloads. Even via the ISV gateway, an Alipay mini-program may
  still need its own AES key for phone collection.
- Provider revocation events mark the local authorization revoked and
  block use; deleting the local authorization is **local cleanup only**,
  not a request for the provider to un-authorize the customer.
- While any social authorizer references the app, deletion is blocked
  (`409` with `platform.in_use` details) — migrate/remove references
  deliberately first. Deleting the app clears local state/caches and
  **cancels no** upstream registration or customer contract.
- Rotation: rotate non-empty secret fields in place → verify callbacks
  and new delegated logins → retire old material in the provider's
  approved order. Callback token/AES rotation may need two-sided
  coordination — temporary mismatch is **never** fixed by disabling
  verification.
- Exit: disable dependent login entrances → revoke authorizations at the
  provider as needed → clean local authorizations/dependencies; removing
  project users/roles is a separate operation.

## Failure and verification limits

Before retrying check in order: platform family → app ID → key encoding
→ stable callback origin → provider scopes → first ticket → customer
active authorization → network/trust. Bad config `400`, name conflicts,
missing app `404`, non-editor `403`; signature/decryption failures are
**not** accepted pushes. An HTTP callback acknowledgement is **not**
proof of a successful user login or a message reaching a script.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/platform/{mod.rs,handlers.rs,weixin_tp.rs,wecom_tp.rs,alipay_isv.rs,dingtalk_isv.rs,douyin_tp.rs,kuaishou_tp.rs}`,
`crates/viat-api/src/{social/mod.rs,handlers/authorizers.rs,lib.rs}`.
No provider registration, authorization, notification, ticket injection,
SSO, network or remote cleanup was executed; this page is source-checked
only. Full social configuration belongs to
[authorizers](authorizers.md); resource credentials stay with their
resource pages.
