---
title: "Project settings reference"
description: "Complete project settings fields, replacement/reset rules, hooks, claims, logging and IdP effects."
doc_id: projects.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Project settings reference

Read with `GET /projects/{slug}` as any current member. Change with `PUT /projects/{slug}` as project `owner`/`admin`; `developer` and `operator` are denied. Platform role alone does not replace project membership. This reference covers settings only; creation/members belong to [create and collaborate](create-and-collaborate.md).

The console Project Settings page has General, Authentication, Identity Provider, Members and Devices areas. General/auth forms save on explicit submission; an unsaved form is not server state. IdP actions have their own save/key lifecycle. Most settings are **API/console-only**: do not invent `viat project set` commands or assume MCP mirrors them. Repo-sync carries only project `name`, `scope_claims` and its separate authorizer/role/authz metadata, not every setting below.

## Complete mutable fields

All fields optional for PUT. Except the timeout tri-state, JSON null behaves like omission (preserve) for optional settings. Arrays/objects, when provided, replace their entire stored field; they do not deep merge.

| Field | Initial/default state | Validation, effect and reset |
| --- | --- | --- |
| `name` | Required on creation | String display name; omission/null keeps; slug is not renamed |
| `allow_registration` | false | Boolean; gates native project-end-user signup, not platform registration; false closes new signup, not existing users |
| `default_timeout_secs` | null / absent in serialized project when unset | Positive i32 seconds; omit preserves, null resets to deployment default, number sets; 0/negative rejected |
| `record_payloads` | true | Boolean; false stops storing **new** execution inputs/outputs, does not erase old payloads |
| `redact_keys` | `[]` | Whole extra redaction-key list; `[]` clears project additions, never global credential masking |
| `exposed_headers` | `[]` | Whole list of extra caller header names readable by scripts; `[]` clears extras, not fixed platform allowlist |
| `auth_hooks` | `{}` | Whole hook object; `{}` clears all bindings; omitted phases within replacement clear those phases |
| `mfa_policy` | `off` | `off`, `optional`, `required`; project password MFA, not platform policy |
| `idp_enabled` | false | Boolean; first enable requires stable `VIAT_PUBLIC_URL` and creates encrypted ES256 signing key before enabling |
| `scope_claims` | `[]` | Whole declared claim list; `[]` clears; source/type rules below |

Read-only project fields also include `id`, `slug`, `created_by`, `created_at`, `updated_at`. Settings update returns the full Project row. `auth_hooks`/`scope_claims` serialize directly as object/array, not SQL JSON wrappers.

### Timeouts and payload retention

Timeout precedence: script `# timeout:` → project default → deployment `VIAT_DEFAULT_TIMEOUT_SECS`; dispatch caps the result at `VIAT_MAX_TIMEOUT_SECS`. A large project timeout is not permission to exceed that cap. Reset is explicit:

```json
{"default_timeout_secs":null}
```

`record_payloads:false` is the strongest choice for sensitive payloads; redaction is a best-effort key-based protection, not a justification for storing secrets. Stored payloads also follow deployment retention; turning recording off does not accelerate deletion of existing rows or remove execution metadata/log lines.

`redact_keys` processing trims strings, drops empty values, truncates each to 64 characters, sorts/deduplicates, keeps at most 64. Matching removes `-`/`_` and lowercases the whole key (`patient_id` also masks `patient-id`, not `patient_ids`). Global credential masking remains active. Do not assume string contents or differently named fields are semantically detected.

### Exposed caller headers

Names are trimmed/lowercased, empty entries dropped, deduplicated; valid HTTP header names only, maximum 64 unique names. Refused: `authorization`, `cookie`, `proxy-authorization`, `x-forwarded-authorization`, **all `x-viat-*`**. They cannot be exposed even if a script asks. This list is additive to the fixed safe request headers. It does not grant trust to a caller-provided tenant header; use verified identity facts for security.

### Auth hooks

```json
{"auth_hooks":{"login":{"pre":"auth/check_login","post":"auth/login_audit"},"register":{"pre":"auth/check_invite"}}}
```

Nested fields: `login`, `register` each optional; each has optional/null script path `pre`, `post`. Whole-object replacement means the example clears `register.post` and any omitted bindings. Every non-null path must resolve an existing script (`folder/name` or root name) before save. Empty string is a path, not a reset; omit or use null in the hook pair to clear.

Pre-hook runs before the platform touches project users; it may reject with `{error:...}` or return `{args:{...}}` merged over original arguments. A configured pre-hook that fails cannot be silently skipped. Post-hook runs after commit/token issuance, may add `{response:{...}}`, and cannot override reserved identity/token response fields. Its failure is logged but does not roll back a successful signup/login. Hooks are ordinary scripts using project resources and their own run logs, not platform DB access. Bindings and shared modules are live configuration, not endpoint rollback payloads.

### Scope claims

```json
{"scope_claims":[{"name":"school_id","type":"uuid","source":"meta"},{"name":"tenant","type":"text","source":"token","from":"org"}]}
```

Each item requires `name`, `type`, `source`; optional/null `from` selects the source key, absent uses `name`. `name` is 1–64 ASCII `[A-Za-z0-9_]`, unique, no surrounding spaces; reserved: `principal`, `user_id`, `project_id`, `role`, `authorizer`, `identity`. `type` = `uuid`, `text`, `int`; `source` = `meta` (user row metadata for local/social/key users) or `token` (verified external token claims), not request JSON.

UUID must parse. Text accepts nonempty string or number converted to text. Int accepts whole JSON integer or parseable integer string, not a float. Missing/wrong-shaped values are omitted from resolved claims, and a policy/default referencing them refuses rather than widening. `$claim.<name>` in CRUD defaults must be declared before publish. These claims differ from [authorization subject attrs](../auth/authorization.md) and OAuth scopes. Changing a source/tenant claim can affect live data access; test negative cross-tenant cases.

## Request recipes

Source-derived **unexecuted** partial update (fixture metadata only):

```sh
curl -sS -X PUT "$BASE/projects/demo" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Demo","record_payloads":false,"redact_keys":["patient_id"],"exposed_headers":["x-trace-id"],"mfa_policy":"optional"}'
```

This leaves timeout, hooks, registration, IdP and scope claims unchanged. Reset project additions explicitly:

```json
{"default_timeout_secs":null,"auth_hooks":{},"redact_keys":[],"exposed_headers":[],"scope_claims":[]}
```

Do not send this reset blindly: clearing scope claims/hooks can remove business security checks. For an individual hook reset, send the full desired remaining hook object. `auth_hooks:null` does **not** clear all hooks.

## IdP and MFA effects

First enable IdP needs `VIAT_PUBLIC_URL`; failure to generate/encrypt/store a key leaves mode disabled. Disable stops discovery/JWKS and changes future minting back to HS256, but retains keys and accepts already-issued local tokens until their expiry. Re-enable reuses existing key material. Owner/Admin manages signing keys and OAuth clients separately; see [endpoint OAuth](../auth/endpoints.md). It does not configure external platform SSO.

MFA `off` hides/ignores project end-user factors; optional asks enrolled users, required forces enrollment for password login. Upstream SSO/social and API keys are separate doors. Read [MFA](../auth/mfa.md) before switching a populated project to required and keep recovery access. Devices are separate registration objects, not a field to embed in a settings update.

## Verification, failure handling and rollback

Read back the returned Project and reload the console after saving. Check new registration refusal/acceptance, timeout cap behavior, a newly established MFA login, redacted new payloads, exposed safe headers and missing/wrong-tenant claims. Readback alone cannot prove provider TLS, hook side effects or policy correctness. Settings changes generally take effect live; endpoint authentication/bindings still require publish. Endpoint snapshot rollback does not restore project settings.

`403`: missing membership or not Owner/Admin. `400`: nonpositive timeout, absent hook script, prohibited header/invalid claim or enabling IdP without public URL. Unknown project `404`. Validation failure should be fixed in the complete submitted field, not bypassed with anonymous access. Preserve previous complete settings before replacements and restore intentionally; no generic reset-to-factory route exists.

No API requests, hook runs, MFA enrollment or database/provider actions were executed. **Evidence:** `crates/viat-api/src/{dto.rs,handlers/projects.rs}`, `crates/viat-core/src/types/project.rs`, `crates/viat-db/src/projects.rs`, project-field migrations, `web/src/pages/projects/ProjectSettingsPage.tsx`, `crates/viat-cli/src/repo/viat_yaml.rs`. [CLI project](../cli/project.md) and [repo-sync](repo-sync.md) cover the narrower supported command surfaces.
