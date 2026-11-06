---
title: "CLI: auth"
description: "Complete Viat 1.1.0 auth grammar, per-command permissions, outputs, effects and recovery."
doc_id: cli.auth
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.auth.login","cli.auth.logout","cli.auth.token.create","cli.auth.token.list","cli.auth.token.revoke","cli.auth.whoami"]
---

# CLI: auth

Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.

- [viat auth login](#viat-auth-login)
- [viat auth logout](#viat-auth-logout)
- [viat auth token create](#viat-auth-token-create)
- [viat auth token list](#viat-auth-token-list)
- [viat auth token revoke](#viat-auth-token-revoke)
- [viat auth whoami](#viat-auth-whoami)

## viat auth login

**Prerequisites and permissions.** No existing platform login or selected project required; local filesystem/process access and the command-specific prerequisites below still apply. An existing platform account on an isolated instance. The literal dummy password only illustrates syntax; it is not a working shipped credential. OIDC also requires a configured platform OIDC provider and browser access.

```text
Usage: viat auth login [OPTIONS] --server <SERVER>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `email`: `--email` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: oidc |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `oidc`: `--oidc` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: email, password; help: Use OIDC SSO with the named platform provider |
| `password`: `--password` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: oidc |
| `server`: `--server` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |
| `totp`: `--totp` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | conflict IDs: oidc; help: Second-factor code for an account with two-factor authentication. Prompted for on the terminal when omitted; needed on the command line only when stdin is not a terminal |

Clap argument groups (literal metadata): `{"arguments":["email","oidc","password","server","totp"],"id":"Login","multiple":true,"required":false}`

**Inputs, behavior and side effects.** Password mode needs --email AND --password at runtime; --oidc selects browser login instead. Password MFA accepts --totp or prompts, at most five attempts on one ticket. Enrollment-required must be completed in the console. OIDC prints a browser URL and polls every 2s for up to 5 minutes.

**Actual output and exit.** stdout: logged in as &lt;email&gt;. Saves access/refresh tokens to the resolved .viat/config.yaml; does not select a project. Same-server ancestor sessions are reused; different-server login creates a CWD session unless VIAT_CONFIG_DIR is explicit. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat auth login --server http://127.0.0.1:28080 --email operator@example.invalid --password demo-only-not-a-real-password
```

**Failure handling, verification and cleanup.** Invalid credentials/MFA, expired browser flow, or enrollment requirement exit 1. Check server URL and enroll in the console rather than repeatedly retrying credentials (rate limits apply). Use auth logout for local clearing; protect config.yaml and avoid real passwords in shell history.

## viat auth logout

**Prerequisites and permissions.** No existing platform login or selected project required; local filesystem/process access and the command-specific prerequisites below still apply. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat auth logout
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

**Inputs, behavior and side effects.** Clears legacy token, access/refresh tokens, refresh expiry and current_project in the resolved config. This implementation makes no server revocation call and leaves server_url and project_token untouched.

**Actual output and exit.** stdout: logged out; 0 if config save succeeds, even without a live server. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat auth logout
```

**Failure handling, verification and cleanup.** Save failure exits 1; fix filesystem permissions. For actual session/PAT revocation use the appropriate server account controls; remove a residual project_token from protected local config if it must not remain. Re-login and select the project to resume.

## viat auth token create

**Prerequisites and permissions.** A platform login session, not a personal access token (PAT); no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat auth token create [OPTIONS] --name <NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |
| `name`: `--name` | `String`, 1, `Set` | yes; no explicit Clap default | — | help: Human label, max 64 chars, unique per user |
| `project`: `--project` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default | — | help: Restrict to a single project |
| `ttl`: `--ttl` | `String`, 1, `Set` | no; conditional requirements below; no explicit Clap default ; runtime: `30d; never → no expiry` | — | help: Expiry duration, e.g. 30d, 12h, 7d, never. Default 30d |

Clap argument groups (literal metadata): `{"arguments":["json","name","project","ttl"],"id":"Create","multiple":true,"required":false}`

**Inputs, behavior and side effects.** POST /auth/tokens; --project restricts scope, omission means all projects the user can access. Runtime --ttl default is 30d; humantime durations such as 12h work; --ttl never sends zero for no expiry. Durations are truncated to whole seconds: avoid subsecond durations that become zero/no expiry. The account still supplies the authority: a PAT is not a role grant. Name must be 1–64 bytes and unique per account; project scoping requires membership in that project.

**Actual output and exit.** Text prints metadata AND the one-time Secret; --json prints the response including secret. Capture securely; success exits 0. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat auth token create --name demo-ci --ttl 12h
```

**Failure handling, verification and cleanup.** Bad TTL/name/scope or PAT-authenticated attempts fail. If output is lost, revoke this token by ID and mint another; auth token list cannot recover the secret.

## viat auth token list

**Prerequisites and permissions.** A platform login session, not a personal access token (PAT); no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat auth token list [OPTIONS]
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `json`: `--json` | `bool`, 0, `SetTrue` | no; conditional requirements below; `false` | — | — |

Clap argument groups (literal metadata): `{"arguments":["json"],"id":"List","multiple":true,"required":false}`

**Inputs, behavior and side effects.** GET /auth/tokens for the current platform account, not other accounts or api_key authorizers.

**Actual output and exit.** Table: name, project, prefix, created, expiry, last-used and status; --json returns the items object. No secret. Text status is best-effort (its expired comparison is not a reliable current-time expiry check); use expiry timestamps. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat auth token list --json
```

**Failure handling, verification and cleanup.** PAT authentication is refused; use a login session. Read-only apart from normal refresh persistence; no cleanup.

## viat auth token revoke

**Prerequisites and permissions.** A platform login session, not a personal access token (PAT); no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat auth token revoke <ID_OR_NAME>
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |
| `id_or_name`: `<ID_OR_NAME> (#1)` | `String`, 1, `Set` | yes; no explicit Clap default | — | — |

Clap argument groups (literal metadata): `{"arguments":["id_or_name"],"id":"Revoke","multiple":true,"required":false}`

**Inputs, behavior and side effects.** UUID is used directly; other strings are resolved among non-revoked token names. Zero matches or multiple matching names refuse instead of choosing arbitrarily. DELETE /auth/tokens/{id}.

**Actual output and exit.** stdout: Revoked token: &lt;id-or-name&gt;; success 0. Secret stops authorizing; revocation is not local logout. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat auth token revoke 00000000-0000-4000-8000-000000000001
```

**Failure handling, verification and cleanup.** For ambiguous names, list and supply an ID. Revocation cannot be undone: create a replacement and update consumers. Verify with auth token list --json.

## viat auth whoami

**Prerequisites and permissions.** A configured server and platform login; no selected project required. Use the synthetic names below only in your isolated demo project; replace identifiers with values returned by its list/create commands.

```text
Usage: viat auth whoami
```

**Command aliases:** none.

| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |
| --- | --- | --- | --- | --- |
| `help`: `--help` / `-h` | `String`, 0, `Help` | no; conditional requirements below; no explicit Clap default | — | help: Print help |

**Inputs, behavior and side effects.** GET /auth/whoami with the console credential; does not report a project end-user identity.

**Actual output and exit.** stdout contains the signed-in email only; 0 on success. Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).

**Synthetic invocation (syntax validation only; not executed).**

```sh
viat auth whoami
```

**Failure handling, verification and cleanup.** Expired unrefreshable login exits 1: log in again, then repeat. No project changes or cleanup.

## Implementation evidence

Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.

- `crates/viat-cli/src/commands/auth.rs`
- `crates/viat-cli/src/commands/auth_token.rs`
- `crates/viat-api/src/handlers/auth_tokens.rs`
