---
title: "Instance and account settings"
description: "Console settings, deployment-only configuration, platform SSO and account security administration."
doc_id: instance.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Instance and account settings

Instance administration is **not** one writable settings object: the
console separates activation, platform users, identity providers,
account security/sessions and instance observations; process
configuration comes from the deployment environment — there is **no**
invented `PUT /settings`. [Project settings](../projects/settings.md)
affect a single project; platform roles govern instance administration.

## Settings map and permissions

| Surface | Actual routes/permissions | Persistence and effect |
| --- | --- | --- |
| Activation | `GET /license`, `POST /license/activate`; see [activation](activation.md) | Needs a valid code matching the official image — not vendor issuance |
| Platform users | `/users`, `/users/invite`, `/users/{email}/role`; see [platform users](platform-users.md) | Platform accounts/roles, **not** project end users |
| Platform OIDC | `/admin/oidc-providers`, **platform Owner** | Provider registration, encrypted secrets, login policy |
| Account security | `/auth/mfa`, `/auth/password` (interactive session when applicable) | The current account's password/factors; see [MFA](../auth/mfa.md) |
| Sessions and PATs | `/auth/sessions`, `/auth/tokens` | Separate refresh sessions and long-lived management tokens |
| Instances | `GET /admin/instances`, platform Owner/Admin | A **read-only** live-node inventory — no restart/upgrade |
| Pool observations | `/admin/pool/stats`, `/admin/pool/stats/cluster`, platform-admin rights | Runtime observation, **not** persistent configuration |

Real platform roles: `owner`/`admin`/`developer`/`operator`. A project
Owner is not automatically an instance Owner; a platform Owner bypasses
no explicit project membership; ordinary project members may not read
endpoints/trees either — those reads require editors. Full boundaries:
[management identity](../auth/management.md).

## Deployment-only configuration

- `DATABASE_URL`, `VIAT_PUBLIC_URL`, token/encryption keys,
  registration/MFA policy, runtime limits, retention, storage and
  network trust are managed through the deployment environment/secret
  mechanisms. **The console is not an environment-file editor**; process
  parameters may need controlled restart/redeployment, never implicitly
  re-encrypting existing secrets or deleting historical payloads;
  preserve original encryption material across migration/restore.
- Enabling the project IdP or registering callbacks requires
  `VIAT_PUBLIC_URL` to be a stable external URL (including the
  deliberate deployment prefix) — arbitrary request **Host** headers must
  not become the identity issuer. Private networks/CAs need every
  verifying party/provider actually trusting and reaching them:
  accepting a string configuration is **not** connectivity validation.
  Never "fix" login by disabling TLS verification.
- Defaults and restart rules: the [configuration reference](../configuration/overview.md);
  **never** guess new settings routes. Activation, public registration,
  MFA and upstream identity are independent prerequisites — successful
  activation does not enable self-service registration.

## Platform OIDC providers

These routes serve **platform-account** console/CLI login — not a
project's `oauth_oidc` authorizer and not the delegated domestic
platform apps. Owner-only `GET/POST /admin/oidc-providers`;
`GET/PATCH/DELETE .../{name}`.

| Creation field | Default/validation |
| --- | --- |
| `name` | Required, `^[a-z][a-z0-9_-]{0,62}$`, a stable route identifier |
| `display_name` | Required string; the login-button name |
| `issuer` | Required URL; HTTPS or localhost/127.0.0.1 HTTP; **creation actively fetches discovery** |
| `client_id` | Required provider client identifier |
| `client_secret` | Optional/null/empty = no secret; non-empty stored encrypted |
| `scopes` | Optional/null as a **space-separated string**; default `openid profile email`; validation requires openid (case-insensitive) |
| `audience` | Optional/null provider audience |
| `default_role` | Optional/null defaulting to platform `operator`; one of the four real roles |
| `trust_email_claim` | Optional/null defaulting true; decide explicitly per the provider's email guarantees |

Source-derived, unexecuted Owner request (a real run fetches discovery):

```sh
curl -sS "$BASE/admin/oidc-providers" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fixture-sso","display_name":"Fixture SSO","issuer":"https://identity.example.invalid","client_id":"fixture-console","client_secret":"REPLACE_WITH_PROVIDER_SECRET","scopes":"openid profile email","default_role":"operator","trust_email_claim":false}'
```

- Public selector `GET /auth/oidc/providers`; browser start/callback are
  `GET /auth/oidc/{name}/start` and `/callback` — register the **exact**
  callback with the provider. `POST /auth/oidc/exchange` completes the
  one-time Viat handover; the CLI uses its own
  `POST /auth/oidc/{name}/cli-init` and `GET .../cli-poll`. Prefer the
  [CLI login](../cli/auth.md) and **never** hand-assemble internal
  handover codes. Public selectors/details expose no provider secrets.
  `trust_email_claim` affects identity linking — **never** trust an
  untrusted issuer just to merge same-email accounts.
- PATCH accepts optional `display_name`/`issuer`/`client_id`/`scopes`/
  `default_role`/`trust_email_claim` with omitted/null keeping; issuer
  changes re-validate and re-fetch discovery. The DTO's `client_secret`
  is a nested Option, but **actual deserialization treats explicit null
  as omitted** (no double-option customization), despite comments
  claiming null clears; non-empty strings replace and `""` clears;
  `audience` has the same null/omit limitation — explicit null is **not**
  a reliable reset in this version. **Never** apply project-settings
  null-reset rules to this interface; the provider `name` is immutable.
- Changing/deleting a provider **does not** automatically sign out
  created platform accounts, PATs or project memberships — inventory and
  revoke them separately; before deleting the only SSO, verify another
  Owner can sign in. This page tested no real registration,
  discovery/SSO, code exchange or identity linking.

## Instance inventory and version checks

- `GET /admin/instances` returns the live-node array
  `{id,hostname,version,started_at,last_heartbeat_at}` sorted by start
  time. Old/unreported versions may be null — **not** proof of
  successful upgrade. The console refreshes every 15 seconds and flags
  mixed versions. This is a **heartbeat window**, not a historical
  asset inventory or a readiness proof under load. A missing node can be
  stopped/expired/unreachable — investigate the service and database;
  **never "fix" by deleting rows**.

Source-derived, unexecuted read:

```sh
curl -sS "$BASE/admin/instances" -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN"
```

- Reconcile every expected node's version against the deployed stable
  release; clients version separately. The endpoint pushes no images,
  changes no configuration, restarts no workers, and proves no
  TLS/device/provider interoperability.

## Account secrets and security change steps

1. Before changing issuers, registration or MFA policy, prepare a second
   Owner recovery path and back up configuration/encryption data keys.
2. Change one surface at a time; check `whoami`, real membership, factor
   state and a **freshly created** session — cached logins can mask
   broken subsequent logins.
3. On leakage revoke PATs and sessions **separately**; CLI logout is
   local-only and keeps the project token; project customer identities
   are independent yet again.
4. Redact screenshots/logs/exported configuration; resource secrets stay
   platform-side and must never ship to scripts as patches.
5. Roll back the **actual deployment/provider configuration** — never
   assume endpoint rollback restores instance settings. Management
   actions land in audit.

Error shapes: invalid credentials `401`, wrong platform role `403`,
provider validation/discovery failure `400`, missing provider `404`.
Even with project operation rights, an Operator must **not** see instance
topology; a Developer's PAT cannot self-grant Owner through a
`default_role` on an inaccessible route.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/{dto.rs,handlers/admin_oidc_providers.rs,handlers/platform_oidc.rs,handlers/admin_instances.rs,middleware_auth.rs}`,
`web/src/pages/settings/{InstancesPage.tsx,SecurityPage.tsx,SessionsPage.tsx}`,
`web/src/pages/projects/ProjectSettingsPage.tsx`. The OIDC null-reset
differences come from the implementation, not invented supported
operations. No tests/builds/installs, environment changes, networking,
provider operations or cleanup were executed.
