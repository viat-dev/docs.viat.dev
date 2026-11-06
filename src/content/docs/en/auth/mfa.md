---
title: "Multi-factor authentication"
description: "Platform and project TOTP enrollment, login tickets, recovery codes and administrator reset."
doc_id: auth.mfa
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Multi-factor authentication

Viat supports TOTP authenticators and one-use recovery codes for **password** doors. Platform and project users have separate factors, policies and tickets. Provider OIDC/social login relies on the upstream provider's assurance; Viat does not add a second password-factor challenge to every bearer request. API keys, PATs and refresh operations are not interactive TOTP logins. MFA is not an authorization-rule grant.

## Policies and prerequisites

Use HTTPS, a password-capable account, a trusted authenticator, correct server/device clocks and secure offline recovery-code storage. Never publish a TOTP QR/secret, recovery code or MFA ticket. Keep another platform Owner recovery path before enforcing policy.

- Platform `VIAT_MFA_REQUIRED`: `off` (default; enrollment still available), `admins` (Owner/Admin), `all`; true maps to all, false to off. It applies platform roles, not project membership roles. Unknown policy text parses off, so use the documented literal and verify status.
- Project `mfa_policy`: `off` default, `optional`, `required`; Owner/Admin changes it through project settings. `off` ignores enrolled project rows and refuses project self-service; `optional` asks enrolled password users; `required` forces unenrolled password users through enrollment. Changing to off does not prove secrets were erased.
- A platform account that has only external SSO and no password reports `available:false`; do not try to enroll by inventing a local password.

## Password login is a two-step protocol

Correct password can return **401**, not 200:

```json
{"error":"mfa_required","message":"...","mfa_ticket":"11111111-2222-4333-8444-555555555555","expires_at":"2026-11-06T12:05:00Z"}
```

The code may instead be `mfa_enrollment_required`. This is a challenge, not a rejected password. The ticket is valid for 300 seconds and at most five code attempts; it is scoped to account, purpose and identity plane. Per-account throttling also applies. Use the actual ticket from the response, never the illustrative UUID. A login ticket cannot be used as a bearer or as an enrollment ticket.

For enrolled platform users, `POST /auth/mfa/verify` takes required `mfa_ticket` and `code`; success returns the normal platform login response (access/refresh pair, identity and overview token). Project users use `POST /p/{slug}/auth/mfa/verify` with the same two required keys; native login completion returns its project login/session result, not a platform account. Hosted project login handles this navigation in its own forms.

Source-derived **unexecuted** platform request:

```sh
curl -sS "$BASE/auth/mfa/verify" -H 'Content-Type: application/json' \
  -d '{"mfa_ticket":"11111111-2222-4333-8444-555555555555","code":"REPLACE_WITH_CURRENT_CODE"}'
```

## Enrollment and self-service routes

| Action | Platform route | Project route |
| --- | --- | --- |
| Status | `GET /auth/mfa` | `GET /p/{slug}/auth/mfa` |
| Begin enrollment | `POST /auth/mfa/totp/setup` | `POST /p/{slug}/auth/mfa/totp/setup` |
| Confirm | `POST /auth/mfa/totp/confirm` | `POST /p/{slug}/auth/mfa/totp/confirm` |
| Disable | `DELETE /auth/mfa` | `DELETE /p/{slug}/auth/mfa` |
| Replace recovery set | `POST /auth/mfa/recovery-codes` | `POST /p/{slug}/auth/mfa/recovery-codes` |

Platform self-service requires an interactive platform session, not a PAT. Project self-service requires the appropriate active project password-login identity and non-off policy, not a platform session or machine key.

1. Setup from a signed-in platform session takes `{"password":"..."}`. Project setup uses **`{"credential":"..."}`**. Alternatively, forced-enrollment setup uses `{mfa_ticket}` without a completed session; the enrollment ticket already represents a password check. Optional ticket/password keys may be omitted/null when not applicable.
2. Setup returns exactly `{secret,otpauth_uri,issuer,account}`. `secret` is base32; `otpauth_uri` can be imported by an authenticator. This is pending enrollment, not enforced MFA. Starting again can replace an unconfirmed secret.
3. Confirm takes required `code`, optional/null `mfa_ticket`. Platform confirm returns `{recovery_codes,session?}`; `session` is included when enrollment was the login's missing step, omitted for an already signed-in enrollment. Project confirm similarly completes the corresponding project login door; it is not a platform session.
4. Save recovery codes once in offline secure storage before dismissing the result. The server retains hashes; status cannot recover the strings.
5. Verify status and a fresh login, including the challenge branch. Do not keep retrying a spent TOTP step; replay protection rejects reuse.

Status shared fields: `enabled`, `pending`, nullable `confirmed_at`, `recovery_codes_remaining`, nullable `last_used_step`. Platform adds `required`, `available`; project adds `policy`, `required`. A replay watermark ahead of the current time step can indicate clock rollback or restored state, not a mistyped code. Check server time and restore history before resetting accounts.

Disable/replace recovery set requires reauthentication: platform `{password,code}`, project **`{credential,code}`**, both required. `code` can be a current TOTP or unused recovery code. Disable returns `{ok:true}` and removes factor/recovery state. It is allowed even when policy requires MFA, so users can move authenticators; next password login will require enrollment again. Recovery replacement returns `{recovery_codes:[...]}` and immediately invalidates the previous set.

## Loss, reset and sessions

Lost authenticator but have a recovery code: use one at the login's verify step, then disable/re-enroll or regenerate the recovery set after reauthentication. Recovery codes are consumed once, not reusable spare passwords. Do not send them to an administrator in chat.

Lost both: verify the person's identity out of band, then use the correct administration plane:

- Platform `DELETE /users/{email}/mfa`: **platform Owner and session only**; an Owner PAT is rejected. Returns `{ok,had_mfa,sessions_revoked}`; clears factor and revokes platform refresh sessions and overview readers. It does not say all PATs were revoked.
- Project `DELETE /projects/{slug}/users/{identity}/mfa`: project editor (`owner`, `admin`, `developer`). Returns `{ok,had_mfa}`. It clears project MFA, but does **not** revoke project login/refresh sessions or bump the password epoch in this handler. If compromise rather than simple loss is possible, separately deactivate the user/change password and review keys/sessions; do not rely on the old “stateless project tokens” comment as a session-revocation guarantee.

Password changes are separate: platform `PUT /auth/password` uses `{old_password,new_password,code?}`; project `POST /p/{slug}/auth/password` uses `{current,new,code?}`. Existing MFA requires code when applicable. Removing a factor is not changing the password.

## Failure handling and verification

Expired/exhausted/wrong-purpose ticket or wrong factor can yield `401`; unavailable/policy-off and malformed requests fail rather than creating a factor; throttling returns `429`/`Retry-After`. Restart from password login after an expired ticket. For pending enrollment attempt exhaustion, repeat legitimate setup rather than brute-force confirm. Never log ticket/code/secret bodies during diagnosis.

Negative checks: a project ticket must fail at platform verify and another project's verify; a PAT must fail platform setup/reset; a machine key must not change a password; an old recovery set must fail after regeneration; unenrolled required-policy login must not get a normal session before confirmation. Use disposable accounts and restore their intended MFA policy afterward; administrator resets affect real account security and require explicit operator approval.

The console Account Security page implements password → setup → confirm → one-time recovery display; Sessions is a separate inventory. This reference did not execute authenticator enrollment, real SSO, provider calls or account resets.

**Evidence:** `crates/viat-api/src/{mfa_engine.rs,handlers/mfa.rs,handlers/project_mfa.rs,handlers/users.rs,handlers/project_users.rs,auth_native.rs}`, `web/src/pages/settings/{SecurityPage.tsx,EnrolForm.tsx,RecoveryCodes.tsx,SessionsPage.tsx}`. The project-reset/session discrepancy above is derived from the actual handler, not archived plans.
