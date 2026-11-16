---
title: "Multi-factor authentication"
description: "Platform and project TOTP enrollment, login tickets, recovery codes and administrator reset."
doc_id: auth.mfa
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Multi-factor authentication

Viat provides TOTP authenticators and one-use recovery codes for
**password** entrances. Platform and project users keep separate factors,
policies and tickets. Boundaries first:

- OIDC/social login relies on the upstream identity's assurance — Viat
  **never** adds a password second-factor challenge to every bearer
  request; API keys, PATs and refresh operations are not interactive TOTP
  logins.
- MFA is **not** an authorization-rule grant.

## Policy and prerequisites

Use HTTPS, an account with a password, a trusted authenticator, correct
server/device clocks and safe offline recovery-code storage. **Never**
publish TOTP QR codes/secrets, recovery codes or MFA tickets; before
mandating a policy, keep another platform-Owner recovery channel.

- Platform `VIAT_MFA_REQUIRED`: default `off` (voluntary enrollment still
  works), `admins` (Owner/Admin) or `all`; `true` maps to all and `false`
  to off. It checks **platform roles**, not project membership. **Unknown
  strings parse as off** — use explicit values and verify the state.
- Project `mfa_policy` (`off`/`optional`/`required`, changed by the
  project Owner/Admin in settings): `off` ignores enrolled project
  factors and refuses self-service routes; `optional` asks enrolled
  password users; `required` forces unenrolled password users through
  enrollment. Switching back to off **does not delete** the secret.
- Platform SSO-only passwordless accounts report `available:false` — do
  not invent a local password to enroll.

## Password login is a two-step protocol

A correct password can still answer **401** instead of 200:

```json
{"error":"mfa_required","message":"...","mfa_ticket":"11111111-2222-4333-8444-555555555555","expires_at":"2026-11-06T12:05:00Z"}
```

It may also be `mfa_enrollment_required`. **This is a challenge, not a
wrong password.** Tickets live 300 seconds with at most five code
attempts, bound to account, purpose and identity plane, plus per-account
rate limiting. Use the ticket from your actual response — never the
illustration UUID; a login ticket is not a bearer and cannot impersonate
an enrollment ticket.

- An enrolled **platform** user calls `POST /auth/mfa/verify` (requires
  `mfa_ticket`, `code`); success returns the ordinary platform login
  response (access/refresh, identity, overview token).
- A **project** user calls `POST /p/{slug}/auth/mfa/verify` (same
  required keys); the native completion returns the project login/session
  result — **not** a platform account. Project-hosted login pages handle
  the navigation inside their form.

Source-derived, unexecuted platform request:

```sh
curl -sS "$BASE/auth/mfa/verify" -H 'Content-Type: application/json' \
  -d '{"mfa_ticket":"11111111-2222-4333-8444-555555555555","code":"REPLACE_WITH_CURRENT_CODE"}'
```

## Enrollment and self-service routes

| Action | Platform route | Project route |
| --- | --- | --- |
| Status | `GET /auth/mfa` | `GET /p/{slug}/auth/mfa` |
| Start enrollment | `POST /auth/mfa/totp/setup` | `POST /p/{slug}/auth/mfa/totp/setup` |
| Confirm | `POST /auth/mfa/totp/confirm` | `POST /p/{slug}/auth/mfa/totp/confirm` |
| Disable | `DELETE /auth/mfa` | `DELETE /p/{slug}/auth/mfa` |
| Replace recovery codes | `POST /auth/mfa/recovery-codes` | `POST /p/{slug}/auth/mfa/recovery-codes` |

Platform self-service requires an **interactive platform session** (no
PATs); project self-service requires a valid matching project
password-login identity with policy not off (no platform sessions, no
machine keys).

1. A logged-in platform setup sends `{"password":"..."}`; a project setup
   uses **`{"credential":"..."}`**. The forced-enrollment branch may also
   send `{mfa_ticket}` without a session — an enrollment ticket proves
   the password check just passed. Inapplicable optional
   ticket/password keys may be omitted/null.
2. Setup returns exactly `{secret,otpauth_uri,issuer,account}`: `secret`
   is base32 and `otpauth_uri` imports into authenticators. This state is
   only **pending** — an unconfirmed secret can be regenerated.
3. Confirm requires `code` with optional/null `mfa_ticket`. The platform
   answers `{recovery_codes,session?}` — `session` appears only when
   enrollment was the login's missing step; logged-in enrollment omits
   it. A project confirm completes that project's login entrance and
   returns **no** platform session.
4. Before dismissing the display, store the **once-shown** recovery codes
   offline; the server keeps hashes only and status endpoints recover no
   strings.
5. Verify the status and log in again to exercise the challenge branch;
   never reuse a consumed TOTP time step — replay protection rejects it.

Shared status fields: `enabled`, `pending`, nullable `confirmed_at`,
`recovery_codes_remaining`, nullable `last_used_step`; the platform adds
`required`/`available`, the project adds `policy`/`required`. A replay
watermark above the current step suggests clock rollback/restored state
rather than user error — check server time and recovery records first.

Disabling/replacing recovery codes re-authenticates: platform
`{password,code}`, project **`{credential,code}`**, both required; `code`
may be the current TOTP or an unused recovery code. Disable answers
`{ok:true}` and clears factor/codes — allowed even under a required
policy (device changes), with re-enrollment demanded at the next password
login. Recovery-code replacement answers `{recovery_codes:[...]}` and
**immediately invalidates** the old set.

## Loss, reset and sessions

- Lost authenticator with recovery codes: use one at the login verify
  step, then re-authenticate to disable/re-enroll or regenerate codes.
  Recovery codes are **single-use**, not reusable spare passwords — never
  send them to an administrator.
- Both lost: confirm identity out-of-band first, then use the **correct
  management plane**:

| Plane | Action | Rights and effect |
| --- | --- | --- |
| Platform | `DELETE /users/{email}/mfa` | **Platform Owner with an interactive session only** (an Owner PAT does not work); answers `{ok,had_mfa,sessions_revoked}`, clears the factor and revokes platform refresh sessions and overview readers — **not** a statement that every PAT is revoked |
| Project | `DELETE /projects/{slug}/users/{identity}/mfa` | Project editors (`owner`/`admin`/`developer`); answers `{ok,had_mfa}`; clears project MFA but this handler revokes **no** project login/refresh sessions and bumps no password epoch — on suspected compromise, deactivate the user/change the password and inventory keys/sessions; never promise session revocation based on the old "project tokens are stateless" comments |

Password change is a different operation: platform
`PUT /auth/password` with `{old_password,new_password,code?}`; project
`POST /p/{slug}/auth/password` with `{current,new,code?}`; enrolled MFA
requires `code` where applicable. **Removing the factor is not changing
the password.**

## Failure handling and verification

- Expired/exhausted/wrong-purpose tickets or wrong factors answer `401`;
  unavailable/policy-off and malformed requests fail rather than create
  factors; rate limiting is `429`/`Retry-After`. Ticket expired → restart
  from the password login; pending attempts exhausted → a fresh lawful
  setup, **never brute-force confirms**. Do not log ticket/code/secret
  request bodies while troubleshooting.
- Denial checks: a project ticket must not verify on the platform or
  another project; a PAT must not drive platform setup/reset; a machine
  key must not change passwords; old recovery codes must fail after
  regeneration; under a required policy an unenrolled login must not
  obtain a session before confirm. Use isolated accounts and restore the
  intended policy; administrator resets of real accounts need the
  operator's explicit approval.
- The console's account-security page implements password → setup →
  confirm → the one-time recovery-code display; the session inventory is
  a separate page. This page executed no authenticator enrollment, real
  SSO, provider calls or account resets.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/{mfa_engine.rs,handlers/mfa.rs,handlers/project_mfa.rs,handlers/users.rs,handlers/project_users.rs,auth_native.rs}`,
`web/src/pages/settings/{SecurityPage.tsx,EnrolForm.tsx,RecoveryCodes.tsx,SessionsPage.tsx}`.
The project reset/session differences above come from the actual
handlers, not from old plans.
