---
title: "Project settings reference"
description: "Complete project settings fields, replacement/reset rules, hooks, claims, logging and IdP effects."
doc_id: projects.settings
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Project settings reference

This is the complete reference for project settings: what each field may
contain, how replacement and reset work, and what actually changes for auth
hooks, scope claims, payload recording and the IdP.

Reading and changing:

- Any current member may `GET /projects/{slug}`.
- Changes go through `PUT /projects/{slug}` and require project
  `owner`/`admin`; `developer` and `operator` are denied, and a platform role
  never substitutes for membership.
- Creation and membership live in [create and collaborate](create-and-collaborate.md).

> [!NOTE]
> The console's project settings page shows General, Authentication, Identity
> Provider, Members and Devices. The General/auth forms need an explicit
> save — an unsaved form is not server state; the IdP has its own save and
> key lifecycle. Most settings are **API/console-only**: do not invent
> `viat project set` or assume a full MCP mapping. Repo sync carries only the
> project `name`, `scope_claims` and the separate authorizer/role/authz
> metadata — not everything on this page.

## All modifiable fields

Every PUT field is optional. Except for the timeout tri-state, JSON null on
an optional setting equals omission (keep); arrays/objects are **replaced
wholesale**, never deep-merged.

| Field | Initial/default | Validation, effects, reset |
| --- | --- | --- |
| `name` | required at create | Display-name string; omitted/null keeps it; slug never changes |
| `allow_registration` | false | Boolean; gates **native project-user** registration, not platform registration; false blocks new sign-ups and deletes no one |
| `default_timeout_secs` | null (omitted from responses when unset) | Positive i32 seconds; omitted keeps, null returns to the deployment default, a number sets it; 0/negative rejected |
| `record_payloads` | true | Boolean; false stops recording inputs/outputs of **new** runs and clears no old payloads |
| `redact_keys` | `[]` | **Complete list** of extra redaction keys; `[]` clears the project's additions, never the global credential masks |
| `exposed_headers` | `[]` | **Complete list** of extra caller headers scripts may read; `[]` clears additions, not the fixed safe list |
| `auth_hooks` | `{}` | **Complete** hook object; `{}` clears; omitting a stage inside the replacement clears that stage |
| `mfa_policy` | off | `off`/`optional`/`required`; project password MFA, not a platform policy |
| `idp_enabled` | false | Boolean; first enable needs a stable `VIAT_PUBLIC_URL` and generates the encrypted ES256 signing key first |
| `scope_claims` | `[]` | Complete claim list; `[]` clears; sources/types below |

Read-only fields: `id`, `slug`, `created_by`, `created_at`, `updated_at`. A
change returns the full project row; `auth_hooks`/`scope_claims` serialize
directly as object/array without SQL JSON wrappers.

### Timeouts and payload retention

Timeout precedence: script `# timeout:` → project default → deployment
`VIAT_DEFAULT_TIMEOUT_SECS`, with dispatch clamping to
`VIAT_MAX_TIMEOUT_SECS` — a large number here cannot break the ceiling.
Resetting is explicit:

```json
{"default_timeout_secs":null}
```

For sensitive data, prefer `record_payloads:false`. Redaction is best-effort
key masking and does not prove "safe to store secrets". Old payloads still
expire per the deployment retention: turning recording off neither speeds up
existing row deletion nor clears execution metadata/log lines.

`redact_keys` normalization: trimmed, empties dropped, each capped at 64
characters, sorted and deduplicated, at most 64 entries. Matching removes
`-`/`_` and lowercases (`patient_id` also masks `patient-id`, not
`patient_ids`). Global credential masks stay on; semantic recognition of
string contents or heterogeneous field names is not guaranteed.

### Caller headers you may expose

Names are trimmed/lowercased, empties dropped, deduplicated; must be valid
HTTP headers, at most 64. **Forbidden**: `authorization`, `cookie`,
`proxy-authorization`, `x-forwarded-authorization` and **every `x-viat-*`** —
even when a script asks. The list only supplements the platform's fixed safe
headers; it never turns a caller-asserted tenant header into a trusted
identity — security decisions use verified facts only.

### Authentication hooks

```json
{"auth_hooks":{"login":{"pre":"auth/check_login","post":"auth/login_audit"},"register":{"pre":"auth/check_invite"}}}
```

- `login` and `register` are optional, each with optional/null script paths
  `pre`/`post`. Replacement is wholesale: the example above **clears**
  `register.post` and any binding it omits.
- Before saving, every non-null path must resolve to an existing script
  (`folder/name` or a root name). An empty string is a path, not a reset;
  omitting or nulling within the pair is the reset.
- **Pre-hooks** run before the platform touches the project user: they may
  reject with `{error:...}` or merge-rewrite inputs with `{args:{...}}`; a
  configured pre-hook failure is never silently skipped.
- **Post-hooks** run after commit/issuance: they may add `{response:{...}}`
  and can never overwrite reserved identity/token fields; failures are logged
  and do not roll back a successful registration/login.
- Hooks are ordinary scripts: they may use project resources and have their
  own logs, but never touch the platform database. Hook bindings and their
  shared modules are **live configuration**, not endpoint-rollback content.

### Scope claims

```json
{"scope_claims":[{"name":"school_id","type":"uuid","source":"meta"},{"name":"tenant","type":"text","source":"token","from":"org"}]}
```

Each entry requires `name`, `type`, `source`; optional/null `from` names the
source key, defaulting to `name` itself.

- `name`: 1–64 ASCII `[A-Za-z0-9_]`, unique, no surrounding whitespace;
  reserved values `principal`, `user_id`, `project_id`, `role`,
  `authorizer`, `identity`.
- `type`: `uuid`, `text`, `int`.
- `source`: `meta` (local/social/key user profile) or `token` (a verified
  external-token claim) — **never** the request JSON.

Type rules: uuid must parse; text takes non-empty strings or numbers
coercible to text; int takes whole JSON numbers or parseable integer strings,
not floats. Missing/malformed values never enter resolved claims — policies
and defaults referencing them refuse rather than widen. A CRUD default's
`$claim.<name>` must be declared before publishing. This is a different
concept from [authz subject attributes](../auth/authorization.md) or OAuth
scopes.

> [!WARNING]
> Changing source/tenant claims affects **live** data access; always test
> cross-tenant refusals after a change.

## Request recipes

Source-derived, unexecuted partial change:

```sh
curl -sS -X PUT "$BASE/projects/demo" \
  -H "Authorization: Bearer $PLATFORM_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Demo","record_payloads":false,"redact_keys":["patient_id"],"exposed_headers":["x-trace-id"],"mfa_policy":"optional"}'
```

This keeps timeout, hooks, registration, IdP and scope claims untouched.
Resetting the additions takes an explicit:

```json
{"default_timeout_secs":null,"auth_hooks":{},"redact_keys":[],"exposed_headers":[],"scope_claims":[]}
```

Never fire a blanket reset: clearing claims/hooks can remove business safety
checks. To reset a single hook, send the **complete object that keeps the
other bindings**; `auth_hooks:null` does **not** clear the hooks.

## IdP and MFA effects

- First enable requires `VIAT_PUBLIC_URL`; any key generation/encryption/
  storage failure keeps it off. Disabling hides discovery/JWKS and later
  reverts to HS256, but **keeps the key** — locally issued tokens verify until
  expiry; re-enabling reuses it. Owner/Admin manage signing keys and OAuth
  clients separately, see [endpoint OAuth](../auth/endpoints.md); this is not
  external platform SSO.
- MFA: `off` ignores/hides the project factor; `optional` asks enrolled
  users; `required` forces password users to enroll. Upstream SSO/social and
  API keys are separate entrances. Before turning `required` on for a project
  with existing users, read [MFA](../auth/mfa.md) and keep a recovery path.
- Devices are separate registration objects, not a settings sub-field.

## Verification, failures, rollback

After saving: read the project back, refresh the console, and spot-check by
intent — new registrations allowed/denied, the timeout ceiling, MFA on login,
redaction of new payloads, safe-header exposure, refusals on missing/wrong-
tenant claims. A successful read-back proves nothing about provider TLS, hook
side effects or policy correctness.

Settings apply live in general; endpoint auth/bindings still need publishing,
and **an endpoint snapshot rollback never restores project settings**.

| HTTP | Meaning |
| --- | --- |
| `403` | Not a member, or not project Owner/Admin |
| `400` | Non-positive timeout, nonexistent hook script, forbidden header/bad claim, enabling IdP without a public URL, … |
| `404` | Project not found |

Fix by submitting complete fields; never route around via anonymous access.
Save the old full values before a wholesale replacement and restore by intent
— there is no factory-reset route.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/{dto.rs,handlers/projects.rs}`,
`crates/viat-core/src/types/project.rs`, `crates/viat-db/src/projects.rs`, the
field migrations, `web/src/pages/projects/ProjectSettingsPage.tsx`,
`crates/viat-cli/src/repo/viat_yaml.rs`. [CLI project](../cli/project.md) and
[repo sync](repo-sync.md) cover the narrower command surface. No API, hook,
MFA, database or provider operations were executed.
