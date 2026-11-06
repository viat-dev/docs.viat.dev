---
title: "Delegated platform applications"
description: "Provider-specific third-party app setup, callbacks, authorization storage, secret rotation and limits."
doc_id: auth.platform-apps
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Delegated platform applications

A platform app lets a project operate as a third-party service provider for customer-authorized accounts. It is **not** platform-console SSO, a chat account, or a generic resource. A first-party social login uses its own app credential; a delegated [social authorizer](authorizers.md) instead names `platform_app` and the authorized account `app_id`.

## Supported provider boundaries

| `config.provider` | Delegated social providers | Ticket / customer authorization |
| --- | --- | --- |
| `weixin_tp` | `weixin_mp`, `weixin_mini` | Component ticket; customer authorization link; account-specific message callback |
| `wecom_tp` | `wecom` | Suite ticket; installation link; corp-specific message callback |
| `alipay_isv` | `alipay`, `alipay_mini` | RSA-signed ISV gateway, merchant `app_auth_token`; no pushed platform ticket |
| `dingtalk_isv` | `dingtalk`, `dingtalk_app` | Suite ticket and corp authorization pushes; **no generated customer authorization URL** |
| `douyin_tp` | `douyin_mini` only | Third-party mini-program ticket, authorization link and rotating delegated credentials |
| `kuaishou_tp` | `kuaishou_mini` only | Provider-specific push scheme/key format, authorization link and rotating delegated credentials |

A Douyin/Kuaishou mini-program platform is not delegated web-login support. A WeChat component cannot stand in for `weixin_open`, and WeCom is not interchangeable with WeChat. Config validation checks these pairings. Support here does not promise every provider API, merchant payment feature, publishing workflow, app-market approval or arbitrary event-to-script automation.

## Prerequisites and management permissions

You need a registered/approved provider application with the applicable capabilities, HTTPS public callbacks reachable by that provider, stable public instance URL, and project editor membership (`owner`, `admin`, `developer`). This page does not perform or prove provider registration. For intranet deployments, do not assume a private callback becomes reachable merely because Viat accepted its URL.

Management routes:

| Route | Meaning |
| --- | --- |
| `GET/POST /projects/{slug}/platforms` | List/create apps |
| `GET/PUT/DELETE .../platforms/{name}` | Read/update/delete app |
| `GET .../platforms/{name}/authorizations` | List customer authorizations |
| `DELETE .../platforms/{name}/authorizations/{authorizer_ref}` | Delete local authorization and evict account-token cache |
| `POST .../platforms/{name}/authorize-url` | No request body; mint fresh customer URL where supported; returns `{url,redirect_uri}` |

These reads also require editor membership. They are not anonymous callback endpoints. Provider callbacks are public protocol routes with provider signature/encryption verification, not platform bearer management.

## Full create/update envelope

Create requires `{name,config,secret}`. `name` is the project-local app identifier; use a path-safe fixture name such as `fixture-component`. `config` must include `provider`, `app_id`; `app_id` nonblank <=128 bytes. Secret is required on creation even though its DTO field is optional. Provider cannot change on update; name is the route identifier, not an update field.

| Config field | Default / validation |
| --- | --- |
| `provider` | Required one of the six literals above |
| `app_id` | Required component appid/suite id/ISV application id |
| `alipay_public_key` | Alipay ISV required verification RSA public key; public PEM/base64 |
| `post_authorize_redirect_uri` | Omitted/null = Viat completion page; supplied URL must parse |
| `api_base`, `auth_base` | Provider defaults; optional test/egress origin overrides, HTTPS or loopback HTTP |
| `legacy_api_base` | DingTalk legacy tmp_auth_code gateway override; default `https://oapi.dingtalk.com`; same origin validation |

For WeChat/WeCom/DingTalk/Douyin/Kuaishou, secret needs nonblank `app_secret` (<=1024 bytes), `token` callback signature token (<=128 bytes), `encoding_aes_key`. Ordinary EncodingAESKey is 43-character provider material; **Kuaishou uses base64 of 32 bytes**, not that same text format. For Alipay use `app_private_key` (valid RSA PEM/base64) and config public key; no ticket/token/EncodingAESKey requirement. Never copy real callback tokens or private keys into examples.

Source-derived **unexecuted** request body for `POST /projects/demo/platforms`:

```json
{"name":"fixture-component","config":{"provider":"weixin_tp","app_id":"fixture-component-appid","post_authorize_redirect_uri":"https://app.example.invalid/authorized"},"secret":{"app_secret":"REPLACE_WITH_PROVIDER_SECRET","token":"REPLACE_WITH_CALLBACK_TOKEN","encoding_aes_key":"REPLACE_WITH_VALID_PROVIDER_AES_KEY"}}
```

Placeholders intentionally do not constitute a valid registration/cryptographic key. Submit provider-issued values only in an approved live setup, not this documentation exercise.

Update `PUT .../{name}`: omitted/null `config` keeps it, supplied config **replaces the whole object**; omitted/null secret keeps it. Supplied secret merges nonblank fields over stored fields; blank strings keep old values. Thus rotating `app_secret` does not blank the callback token/AES key. There is no “blank means erase secret” operation. Update evicts cached app tokens so old credentials are not reused. Changing provider requires a different app, not a partial secret patch.

## Callback URLs and ordering

App responses return `id`, `name`, `provider`, `config`, `uses_ticket`, `has_ticket`, nullable `ticket_at`, `callback_url`, nullable `message_callback_url`, `has_authorize_url`, nullable `authorized_url`, `created_at`, `updated_at`. They do not expose secret blobs or ticket strings. **Copy the returned URLs**, preserving deployment base prefixes and escaped names:

- Provider push/verification: `BASE/p/demo/_platform/fixture-component/callback` (GET/POST).
- WeChat account message callback: same root `/callback/$APPID$`.
- WeCom corp message callback: same root `/callback/$CORPID$`.
- Customer return where supported: same root `/authorized` (GET).

1. Create the app with matching provider credentials. Register its returned callback and provider-specific account callback template in the provider console.
2. Complete provider callback verification. Ticket-based providers need a real pushed ticket; `has_ticket:false` means waiting, not a working authorization flow. Alipay `uses_ticket:false` is normal.
3. For providers with `has_authorize_url:true`, request a **fresh** authorization URL and send the customer there. Preauthorization codes expire; don't permanently publish a generated link. DingTalk instead authorizes via app market/in-app activation/provider-console deployment QR and sends the result as a push; its authorize-url call fails with a diagnostic.
4. Customer return/push stores account authorization and encrypted credential, or marks revocation. Signed state checks protect the applicable public return flows; do not manufacture return query parameters.
5. Inspect authorizations and only then create a compatible social authorizer with `{provider,app_id:<authorized account>,platform_app:<name>}`. This authorizer still needs a role and published endpoint admission.
6. Perform an opt-in real login using provider-issued code; static config/`has_ticket` is not proof customer SSO works.

Authorization list items: `id`, `authorizer_ref`, `kind`, nullable `display_name`, `scopes` array, `meta` object, `status` (`active`/`revoked`), `authorized_at`, nullable `revoked_at`, `updated_at`. Credentials and encrypted credential bytes are omitted. An active row reflects authorization state held by Viat, not a guarantee every provider scope or downstream request will succeed.

## Secrets, revocation and offboarding

Delegated customer refresh/authorization material stays platform-side. Douyin/Kuaishou rotating single-use refresh credentials cannot be copied to two independent refreshers safely. Do not pollute logs with full upstream payloads. Social Alipay mini-program phone collection can still need the mini-program's own AES key even when ISV credentials supply gateway access.

Provider revocation events mark local authorizations revoked and invalidate their use. Deleting a local authorization is local cleanup, **not a provider-side customer deauthorization request**. Deleting an app is blocked (`409 platform.in_use` detail) while social authorizers still reference it; repoint/delete those deliberately first. App deletion removes local state and caches; it does not cancel the upstream app registration or customer contract.

Rotate nonblank secret fields in place, validate callback verification and fresh delegated login, then retire upstream old material in the provider-approved order. Callback-token/AES rotation may require coordinated provider changes; a temporarily mismatched push configuration is not fixed by disabling verification. For offboarding, disable dependent login entry points, revoke/deauthorize at the provider as required, delete local authorization/app dependencies, and separately remove project users/roles if intended.

## Failure handling and validation limits

Check family mismatch, app ID, key encoding, stable callback origin, provider scopes, first ticket, active customer authorization and provider network/trust before retrying. Invalid config = `400`, duplicate name = conflict, missing app = `404`, noneditor = `403`; signature/decryption failures must not be treated as accepted pushes. A callback HTTP acknowledgement is not proof an end user has successfully logged in or a message reached a script.

No provider registration, authorization, notification, ticket injection, SSO, network call or remote cleanup was executed. Verification here is source inspection only. **Evidence:** `crates/viat-api/src/platform/{mod.rs,handlers.rs,weixin_tp.rs,wecom_tp.rs,alipay_isv.rs,dingtalk_isv.rs,douyin_tp.rs,kuaishou_tp.rs}`, `crates/viat-api/src/{social/mod.rs,handlers/authorizers.rs,lib.rs}`. [Authorizers](authorizers.md) owns the complete social config; existing resource pages own resource credentials.
