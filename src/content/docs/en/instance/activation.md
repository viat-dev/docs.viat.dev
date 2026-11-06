---
title: Activate or renew an instance
description: Apply a valid code to the matching official image, inspect activation state, and diagnose failures without generating vendor keys.
doc_id: instance.activation
verified_release: '1.1.0'
channel: stable
---

# Activate or renew an instance

An official Viat deployment starts but keeps protected product routes locked until it has a valid activation code. This page assumes you **already have a valid code matching the official image's verification key**. It does not invent a purchasing/issuance URL, describe vendor signing-key generation, or treat a self-generated code as customer activation.

## Prerequisites and permissions

- A running instance with its PostgreSQL database and required server secrets configured. Use [Docker Compose](../installation/docker-compose.md) for a new installation.
- A valid, unexpired activation code for this server build. Verification is offline against the public key compiled into the server; a code signed by another key will not work.
- A **platform `admin` or `owner`** session to apply a code. Project ownership alone is insufficient. Any authenticated platform user may read status.
- Correct server time. An authentic code can still be expired according to the server clock.

For unattended initialization, `VIAT_DEFAULT_ADMIN_EMAIL` and `VIAT_DEFAULT_ADMIN_PASSWORD` seed the first platform Owner. Both are needed; an existing account is not overwritten. You do not need to turn public registration on just to create an administrator.

## What remains reachable while locked

The activation gate exempts the root redirect, console bundle (`/ui` and descendants), platform authentication (`/auth` and descendants), license endpoints (`/license` and descendants), embedded book (`/_docs` and descendants), `/healthz`, `/readyz`, `/metrics`, and `/version`.

**Gate exemption is not anonymous authorization.** `GET /license` and `/version` still require a platform login, and other routes retain their own authentication/configuration. `GET /healthz` can return `200` on an unactivated or expired instance; it is a liveness probe, not a license check. Most project/product routes return:

```json
{"error":"license_required","message":"license_required: this deployment has not been activated; an administrator must submit an activation code"}
```

The HTTP status is `403`. Expired-state messages describe expiration instead. Background execution paths also enforce activation; leaving the process alive does not mean locked schedules continue running.

## Option A: use the console

1. Open the instance's `/ui/` and sign in with a platform Admin/Owner account.
2. On the activation page, paste the valid code exactly as supplied.
3. Submit it. Success installs the code and exposes its status/customer/expiry information; normal project navigation becomes available.
4. If another server process still appears locked, allow up to approximately **15 seconds** for a locked node's database recheck, then retry. The code is stored in the shared platform database, not in one browser.

Do not publish the code or customer/license identifiers in screenshots or support posts.

## Option B: use the CLI

Use a matching CLI, and complete the login procedure in [Platform users](platform-users.md) first. No project needs to be selected.

Read status:

```sh
viat license show
viat license show --json
```

A never-activated instance returns exactly this minimal JSON shape:

```json
{"activated":false,"expired":false}
```

An installed code returns `activated: true` plus `expired`, `license_id`, `customer`, `issued_at`, `expires_at`, and `activated_at`. `expires_at: null` means no expiry date; `activated: true` alone is **not** sufficient—an installed expired code is still reported as activated with `expired: true`.

To keep the code out of command arguments and shell history, place it in a protected file you received/prepared privately, then use stdin:

```sh
chmod 600 activation-code.txt
viat license activate - --json < activation-code.txt
viat license show --json
```

`-` is a literal positional argument meaning “read code from stdin,” not an omitted argument. The CLI trims whitespace and refuses an empty input locally. Expected successful state is `activated: true` and `expired: false`; the non-JSON command also prints `activated.` and a status summary. Treat displayed identifiers as private.

The equivalent management operation is `POST /license/activate` with JSON `{"code":"..."}` using a platform Admin/Owner credential. Specific code refusals are HTTP `400` with the normal `error: "bad_request"`; their reason appears in `message`, not as a new top-level error value.

## Option C: activate at startup

Set `VIAT_LICENSE_CODE` in the protected server environment. For the [Compose example](../installation/docker-compose.md), edit the private `.env` and recreate only the app service:

```sh
docker compose up -d viat
```

Verify through the console or `viat license show --json`; a successful container start alone does not prove the code was accepted. Startup handling is deliberately non-destructive:

- Unset/blank value: no change.
- Malformed, incorrectly signed, unsupported, or expired value: log and ignore; startup still proceeds.
- No usable stored code: install a valid supplied code.
- A valid code is already stored: replace it only when the environment code lasts **strictly longer**. A permanent code outranks a dated code; an old `.env` must not undo a later renewal.

All replicas may use the same environment value and shared database. These startup rules differ from an explicit activation request: the manual endpoint installs the submitted valid code, so check its expiry before deliberately replacing a longer code.

## Renewal and failure handling

Renewal uses the same UI, CLI command, or startup variable with a newly supplied valid code. No network activation service or local vendor private key is required. Removing the environment variable does not erase a code already stored in the platform database.

| Symptom / message reason | Meaning and next action |
| --- | --- |
| `no activation code supplied` | CLI stdin/file is empty; check the protected input file |
| `invalid_code: ... malformed` | Truncated or incorrectly formatted input; re-copy the complete supplied code |
| `invalid_code: ... signature does not verify` | Code does not match the image's compiled verification key; confirm artifact/code pairing with your distributor |
| `unsupported_code: ...` | Authentic code format/version is newer than the server understands; use a compatible server/code pair |
| `expired_code: ...` | Code has expired; check server time and use a current valid renewal |
| HTTP `401` | Sign in with a platform account; a public endpoint credential is not enough |
| HTTP `403` applying a code | Check platform Admin/Owner role, not project role |
| Startup succeeds but still locked | Invalid environment codes are ignored; read status and restricted server logs |
| A peer remains locked briefly | Check shared database and allow the locked-node recheck interval; inspect errors if it persists |

Do not “fix” signature failure by replacing the server's verification key, generating customer-side vendor keys, or weakening the gate. Those change the trust model rather than activating the official deployment.

## Verification and cleanup

Confirm `activated: true`, `expired: false`, then open a project you actually belong to. A project permission refusal after activation is a separate access issue. Keep the original code in your protected configuration/records; if you created a temporary plaintext input file, remove it according to your host's secret-handling policy. Deleting a file is not guaranteed secure erasure on SSDs or backed-up filesystems.

Activation state is persisted with the platform database. Backups/restores and master-key management still need their own operational plan; activation is not a backup mechanism and does not create project memberships.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/license.rs` (`open_path`, `adopt_env_code`, reload interval), `crates/viat-api/src/handlers/license.rs` (permissions, status/errors), and `crates/viat-cli/src/commands/license.rs` (stdin and output).
