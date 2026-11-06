---
title: "Instance and account settings"
description: "Console settings, deployment-only configuration, platform SSO and account security administration."
doc_id: instance.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Instance and account settings

Instance administration is not one writable settings object. The console separates activation, platform users, identity providers, account security/sessions and instance observations. Process configuration is owned by deployment environment, not by a fictional `PUT /settings` API. [Project settings](../projects/settings.md) affect one project; platform roles affect instance administration.

## Settings map and permissions

| Surface | Actual route / authority | Persistence/effect |
| --- | --- | --- |
| Activation | `GET /license`, `POST /license/activate`; see [activation](activation.md) | Valid official-image-compatible activation; not vendor issuance |
| Platform users | `/users`, `/users/invite`, `/users/{email}/role`; see [platform users](platform-users.md) | Platform accounts/roles, not project end users |
| Platform OIDC | `/admin/oidc-providers`; **platform Owner** | Provider registration, encrypted secret and login policy |
| Account security | `/auth/mfa`, `/auth/password`; interactive session where required | Current account password/factor; see [MFA](../auth/mfa.md) |
| Sessions and PATs | `/auth/sessions`, `/auth/tokens` | Separate refresh sessions and persistent management tokens |
| Instances | `GET /admin/instances`; platform Owner/Admin | Read-only live-node inventory, no restart/upgrade action |
| Worker observations | `/admin/pool/stats`, `/admin/pool/stats/cluster`; platform administration | Operational views, not durable configuration replacement |

Platform `owner`, `admin`, `developer`, `operator` are the actual role literals. A project's Owner is not automatically an instance Owner. Platform Owner does not bypass explicit project membership. Even a project member cannot universally read endpoints/trees: those reads require editor membership. [Management identities](../auth/management.md) has the complete plane distinction.

## Deployment-only configuration

Use the deployment's environment/secret mechanism for `DATABASE_URL`, `VIAT_PUBLIC_URL`, token/encryption keys, registration/MFA policy, runtime limits, retention, storage and network trust. The console is not an environment-file editor. Changing process knobs may require controlled restart/redeployment; it does not rewrite previously stored secrets or delete historic payloads by implication. Keep original encryption material available during migrations/restores.

`VIAT_PUBLIC_URL` must be the stable externally understood URL, including an intentional deployment prefix, when enabling project IdP and registering callbacks. Do not use an arbitrary caller Host header as the identity issuer. A private network/CA needs actual trusted connectivity from every participating verifier/provider; accepting a string config does not test that trust. Do not disable TLS verification to make login “work”.

Use the existing [configuration reference](../configuration/overview.md) for exact environment defaults and restart behavior rather than guessing new settings routes. Activation, public registration, MFA and upstream identity are independent prerequisites; an activated instance is not necessarily open for self-registration.

## Platform OIDC provider reference

These routes sign **platform accounts** into the console/CLI. They are not project `oauth_oidc` authorizers or delegated Chinese-platform apps. Owner-only `GET/POST /admin/oidc-providers`; `GET/PATCH/DELETE .../{name}`.

Create fields:

| Field | Default / validation |
| --- | --- |
| `name` | Required; `^[a-z][a-z0-9_-]{0,62}$`; stable route identifier |
| `display_name` | Required string; human login-button name |
| `issuer` | Required URL; HTTPS except localhost/127.0.0.1 HTTP; creation eagerly fetches discovery |
| `client_id` | Required provider client identifier |
| `client_secret` | Optional/null/empty = no client secret; nonempty encrypted at rest |
| `scopes` | Optional/null **space-separated string**, default `openid profile email`; must include openid (case-insensitive validation) |
| `audience` | Optional/null provider audience |
| `default_role` | Optional/null = platform `operator`; one of actual four roles |
| `trust_email_claim` | Optional/null = true; choose deliberately according to provider email assurance |

Source-derived **unexecuted** Owner request (will perform discovery if a real operator runs it):

```sh
curl -sS "$BASE/admin/oidc-providers" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-sso","display_name":"Fixture SSO","issuer":"https://identity.example.invalid","client_id":"fixture-console","client_secret":"REPLACE_WITH_PROVIDER_SECRET","scopes":"openid profile email","default_role":"operator","trust_email_claim":false}'
```

Public provider picker is `GET /auth/oidc/providers`; browser start/callback are `GET /auth/oidc/{name}/start` and `/callback`. Register the exact callback at the provider. `POST /auth/oidc/exchange` completes the one-time Viat handoff, and CLI uses its own `POST /auth/oidc/{name}/cli-init` / `GET .../cli-poll` path. Prefer [CLI login](../cli/auth.md) rather than hand-building internal handoff codes. Provider secrets are never exposed in public picker/detail responses. `trust_email_claim` influences identity linking; never enable it for an untrusted issuer merely to merge matching email strings.

PATCH fields: optional `display_name`, `issuer`, `client_id`, `scopes`, `default_role`, `trust_email_claim`; omitted/null leaves unchanged. Updating issuer revalidates/discovers it. `client_secret` is written as a nested Option in the DTO: **actual deserialization treats explicit JSON null like omission** (no double-option deserializer), despite comments saying null clears. Use a nonempty string to replace and `""` to clear. `audience` has the same null/omit limitation; an explicit null is not a reliable reset operation in this release. Do not copy project-settings null-reset rules to this endpoint. Provider `name` is fixed.

Changing/deleting a provider is not offboarding its already-created platform accounts, PATs or project memberships. Inventory and revoke those independently; verify an alternate Owner login before removing the only SSO path. No real provider registration, discovery/SSO, code exchange or identity linking was tested for this page.

## Instance inventory and version verification

`GET /admin/instances` returns an array of `{id,hostname,version,started_at,last_heartbeat_at}` for currently alive nodes, ordered by start time. `version` may be null for old/unreported versions; it is not proof a node upgraded. The console polls at 15-second intervals and flags mixed versions. This is a heartbeat window, not historical inventory or a readiness proof under load. A missing node may be stopped/stale/unreachable; investigate service and database health rather than deleting a row to repair it.

Source-derived **unexecuted** read:

```sh
curl -sS "$BASE/admin/instances" -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN"
```

Compare every intended serving node's version with the deployed stable release and the separately versioned clients. The endpoint cannot roll out an image, edit configuration, restart a worker or prove TLS/device/provider interoperability.

## Account secrets and safe change procedure

1. Establish a second Owner recovery method and backup configuration/encrypted-data keys before changing issuer, registration or MFA policy.
2. Update one surface at a time. Check `whoami`, real membership, factor status and a newly established session; an existing cached console session can conceal broken future login.
3. For compromise, revoke PATs separately from sessions; local CLI logout is local-only and leaves project token state. Project customer identities are separate again.
4. Redact screenshots, logs and configuration exports. Resource secrets are platform-side; never send them to scripts as a workaround.
5. Revert the intended deployment config/provider config if needed; do not assume endpoint rollback restores instance settings. Audit state-changing administration.

Expect `401` invalid credential, `403` incorrect platform role, `400` provider validation/discovery failure, and `404` missing provider. Operator access to instance topology should be denied even if project operations are allowed. A Developer PAT must not become an Owner by setting `default_role` on an inaccessible route.

No tests/builds/installations, environment changes, network calls, provider actions or cleanup were executed. **Evidence:** `crates/viat-api/src/{dto.rs,handlers/admin_oidc_providers.rs,handlers/platform_oidc.rs,handlers/admin_instances.rs,middleware_auth.rs}`, `web/src/pages/settings/{InstancesPage.tsx,SecurityPage.tsx,SessionsPage.tsx}`, `web/src/pages/projects/ProjectSettingsPage.tsx`. The OIDC null-reset mismatch is an implementation discrepancy, not an invented supported operation.
