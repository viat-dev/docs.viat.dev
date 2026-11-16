---
title: Activate and renew an instance
description: Apply a valid activation code matching the official image, read the status and handle failures; vendor key generation is out of scope.
doc_id: instance.activation
verified_release: '1.1.0'
channel: stable
---

# Activate and renew an instance

An official Viat deployment boots, but protected product routes stay locked
until a valid activation code is submitted. This page assumes you **already
hold a valid code matching the official image's built-in verifying key**; it
invents no purchase/issuance URL, describes no vendor key generation, and
never presents a self-signed code as a customer activation path.

After signing in, the console routes an unactivated deployment straight to
the activation page:

![Activation page of an unactivated instance](/screenshots/en/activation.png)

## Prerequisites and permissions

- A running instance with the PostgreSQL platform database and required
  secrets configured; fresh installs start at
  [Docker Compose](../installation/docker-compose.md).
- A valid, unexpired code for this server build. Verification is offline
  against the key compiled into the server; codes signed by any other key are
  rejected.
- Applying a code needs a **platform `admin` or `owner`** session; project
  Owner is not enough. Any authenticated platform user can read the status.
- Correct server time — an authentically signed code can still be expired by
  the server's clock.

Unattended initialization can bootstrap the first platform Owner via
`VIAT_DEFAULT_ADMIN_EMAIL` and `VIAT_DEFAULT_ADMIN_PASSWORD`; both are
required, existing accounts are never overwritten, and public registration
stays off.

## What stays reachable while locked

The activation gate exempts: the root redirect, console static content
(`/ui` and below), platform authentication (`/auth`), activation endpoints
(`/license`), the built-in handbook (`/_docs`), `/healthz`, `/readyz`,
`/metrics` and `/version`.

**Exemption is not anonymous authorization**: `GET /license` and `GET /version`
still require a platform login, and a `200` from `/healthz` only proves the
process lives — it is not a license check. Most project/product routes
answer:

```json
{"error":"license_required","message":"license_required: this deployment has not been activated; an administrator must submit an activation code"}
```

with HTTP status `403`. Background execution obeys the same gate; a live
process does not mean locked schedules keep running.

## Submitting the code

Pick one of the three ways — the effect is identical, and renewing is just
submitting the new code the same way.

:::tabs id=activate

::tab Console

1. Open the instance's `/ui/` and sign in as a platform Admin/Owner; an
   unactivated deployment lands on the activation page automatically.
2. Paste the complete code into the input and submit.
3. On success the page shows status, customer and expiry, and normal project
   navigation returns.
4. If other server processes stay locked briefly, retry after the ~**15
   second** database re-check window — the code lives in the shared platform
   database, not in a browser.

![License status page of an activated instance](/screenshots/en/license.png)

::tab CLI

Complete the sign-in from [platform users](platform-users.md) first; no
project selection needed.

Read the status:

```sh
viat license show
viat license show --json
```

An unactivated instance returns the minimal shape:

```json
{"activated":false,"expired":false}
```

With a code installed you get `activated: true` plus `expired`, `license_id`,
`customer`, `issued_at`, `expires_at`, `activated_at`. **`activated: true`
alone is not enough**: an installed-but-expired code still reports
`activated: true` alongside `expired: true`; `expires_at: null` means no
expiry date.

To keep the code out of argument lists and shell history, store it in a
protected file and submit via stdin:

```sh
chmod 600 activation-code.txt
viat license activate - --json < activation-code.txt
viat license show --json
```

`-` is the literal positional meaning "read the code from stdin" — it is not
an omitted argument. The CLI trims whitespace and rejects empty input
locally; success shows `activated: true`, `expired: false`. Treat printed
identifiers as private.

::tab Automatic activation at startup

Set `VIAT_LICENSE_CODE` in a protected server environment (for Compose, the
private `.env`) and recreate only the app service:

```sh
docker compose up -d viat
```

Verify via the console or `viat license show --json`. Startup handling
deliberately never destroys existing state:

- Unset/empty: nothing changes.
- Malformed, wrong signature, unsupported or expired: logged and ignored;
  startup continues.
- No usable installed code: the provided valid code is installed.
- Valid code already installed: replaced only when the environment value is
  **strictly longer-lived** (a permanent code outranks a dated one); an old
  `.env` never reverts a later renewal.

All replicas can share one environment variable and database; the manual
endpoint installs any valid submitted code, so compare validity windows
before replacing a longer-lived code.

:::

## Handling failures

| Symptom / message cause | Meaning and action |
| --- | --- |
| `no activation code supplied` | CLI stdin/file was empty; check the protected input file |
| `invalid_code: ... malformed` | Input truncated or malformed; recopy the complete code |
| `invalid_code: ... signature does not verify` | Code does not match the image's compiled key; confirm the artifact/code pair with your distributor |
| `unsupported_code: ...` | The code's format/version is newer than this server supports; use a compatible server/code pair |
| `expired_code: ...` | Expired; check the server clock and use a current renewal code |
| HTTP `401` | Sign in as a platform account; endpoint credentials are not enough |
| HTTP `403` when submitting | Check the platform Admin/Owner role; project roles do not apply |
| Startup succeeded but still locked | An invalid environment code is ignored; check status and server logs |
| Other nodes briefly locked | Check the shared database and wait out the re-check window; investigate if it persists |

The equivalent management operation is `POST /license/activate` with
`{"code":"..."}` as a platform Admin/Owner; rejections are HTTP `400` with the
plain `error: "bad_request"` and the reason in `message` — not a new
top-level error value.

> [!WARNING]
> Never "fix" signature failures by swapping the server's verifying key,
> generating vendor keys customer-side or weakening the gate — that changes
> the trust model instead of activating an official deployment.

## Verification and cleanup

After `activated: true` and `expired: false`, open a project you actually
joined — post-activation project permission denials are a separate class of
problem. Keep the original code in protected storage; remove any temporary
plaintext input file per your host's secret policy (deletion is not secure
erasure on SSDs and backed-up filesystems).

Activation persists with the platform database. Backup restores and master
key management remain separate operations; activation is not a backup
mechanism and creates no project memberships. Never publish the code,
customer name or license identifiers in screenshots or support posts.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/license.rs` (`open_path`,
`adopt_env_code`, re-check interval), `crates/viat-api/src/handlers/license.rs`
(permissions, status and errors), `crates/viat-cli/src/commands/license.rs`
(stdin and output).
