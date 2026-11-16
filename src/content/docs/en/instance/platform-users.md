---
title: Platform users and sign-in
description: Bootstrap an Owner, sign in safely, invite platform accounts, and distinguish platform administration from project membership.
doc_id: instance.platform-users
verified_release: '1.1.0'
channel: stable
---

# Platform users and sign-in

A **platform user** signs in to the console, CLI or native app — and is
**not** a project end user. The platform role governs instance
administration; each project is governed by its own membership role. A
platform `operator` can perfectly well be a project's `owner`.

## Prerequisites and the permission matrix

You need the instance base URL and a platform account; bootstrapping a
fresh install additionally needs host access. User-directory and
project-management routes require an activated instance — signing in and
activating still work while locked.

| Action | Required |
| --- | --- |
| Sign in / view own identity | Own credentials plus any required MFA |
| List platform users | Platform `admin` or `owner` |
| Invite an account without project access | Platform `admin` or `owner` |
| Invite a new account into a project | That project's `admin`/`owner`; **no** platform Admin needed |
| Change platform roles | Platform `owner` only |
| Reset another account's MFA | Platform `owner` only |
| Add an existing account to a project | That project's `admin`/`owner` |

Role literals: `owner`, `admin`, `developer`, `operator`. Changing a
platform role grants **no** project membership and changes no project
role; project callers managed via `viat p-user` are a different identity
plane.

## 1. Bootstrap the initial Owner

Set these together on a fresh deployment:

```dotenv
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PRIVATE_PASSWORD
VIAT_ALLOW_REGISTRATION=false
```

Replace the email and password before use. Essentials:

- This is **server configuration**, not a user-registration command.
  Startup creates the missing account as platform `owner` and **never
  overwrites** an existing one; an email without a password skips
  bootstrap with a warning; later changing the environment password is
  **not** a reset mechanism.
- Native server registration defaults to `true`; the official image
  overrides it to **`false`**, after which the public registration route
  answers `403`. The first account created on an empty platform becomes
  `owner`; subsequent ordinary accounts default to `operator`. **Never**
  briefly expose public registration to race for the first Owner — use
  the protected bootstrap configuration.

## 2. Sign in on the console

1. Open the instance URL (the root usually redirects to `/ui/`).
2. Enter the platform email/password, or pick an operations-configured
   OIDC provider.
3. With an enrolled authenticator, enter a fresh TOTP or an unused
   recovery code; if the deployment requires enrollment first, complete
   it before expecting a session.
4. When activation is needed, a platform Owner/Admin follows
   [activation](activation.md).
5. Check the account menu and project picker — an empty project list
   usually means **missing membership**, not a failed login.

The account menu's security/session controls handle MFA enrollment,
recovery-code management, own-password changes and session viewing/
revocation. Recovery codes display once and are single-use — store them
privately. **Never** assume an invitation's "temporary" password is
automatically one-time or that a forced password-change page appears;
treat changing the initial password as an explicit first task.

## 3. Sign in on the CLI

Use CLI `1.1.0` starting from a dedicated private working directory
(never inside another project's working copy). Prompts below use
**Bash** syntax:

```bash
mkdir viat-session
cd viat-session
umask 077
read -r -p 'Instance base URL: ' VIAT_SERVER
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat auth whoami
viat version
```

- A local Compose install's base URL is `http://127.0.0.1:8080`; with a
  reverse-proxy mount prefix include it, but **never** append `/ui` or
  `/projects`. Expected: output starting `logged in as <your-email>`;
  `whoami` printing the same email; `viat version` showing the CLI
  version plus the server's when available.
- Password sign-in requires both `--email` and `--password` — omitting
  them **never** prompts; `read -s` keeps the password out of history,
  but the argument is briefly visible to local processes — use a trusted
  workstation. Second-factor is prompted interactively; non-interactive
  use takes `--totp CODE`; on `mfa_enrollment_required`, enroll once in
  the console first. With SSO configured use
  `viat auth login --server URL --oidc NAME` and **never** mix in
  password flags.
- The session lives in `.viat/config.yaml` (bearer/refresh credentials):
  never commit or paste it; discovery walks upward for
  `.viat/config.yaml`; `VIAT_CONFIG_DIR` names the config **directory
  itself**. Logins against different servers avoid overwriting ancestor
  sessions, but separate directories are safest; protect the directory
  and its backups.

## 4. Invite and join members deliberately

A platform Admin/Owner can invite an account without granting project
access:

```sh
viat user invite --email colleague@example.com --display-name "Colleague"
viat user ls --json
```

- Substitute the real intended recipient. The invitation output carries
  `invited: ...` and the **once-shown** `temp_password` — deliver it
  out-of-band, never into chat logs or committed transcripts. The
  operation creates the account and **promises no** invitation email;
  before joining a project the account sees none.
- A project Owner/Admin creating-and-joining in one step:

```sh
viat user invite --email teammate@example.com --project hello-lab --role developer
```

  `--project` and `--role` must be supplied together. An existing email
  conflicts — use [adding project members](../projects/create-and-collaborate.md)
  instead of re-inviting. The optional `--temp-password` presets a ≥8-
  character initial password but puts the secret into an argument; the
  generated-password flow suits interactive administration better.

## 5. Delegate platform authority

- A platform Owner promotes an existing account:

```sh
viat user set-role colleague@example.com admin
viat user ls --json
```

  This grants **platform** administrative rights, not project Admin —
  project authority goes through project membership. Only Owners change
  platform roles; **the last platform Owner cannot be demoted**; before
  removing your only recovery channel, establish a second trusted Owner
  and verify their sign-in.
- Owners may run `viat user reset-mfa colleague@example.com` for lost
  MFA: it clears the second factor and signs the account out of all
  sessions; under a required policy the account must re-enroll. This is
  **incident recovery**, not a routine bypass. A locked-out last Owner
  needs a controlled operations recovery procedure — never distribute
  direct database-editing recovery commands to ordinary users.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Signed in but no projects | Ask the project Owner/Admin to add membership; platform roles are separate |
| Invitation gets `403` | Without `--project` needs platform Admin/Owner; with it, the target project's Admin/Owner |
| `--project`/`--role` validation error | Provide both or neither |
| Existing-email conflict | Add the existing account as a member; do not re-invite |
| `401 mfa_required` | Complete the challenge: a fresh authenticator code or unused recovery code |
| Every TOTP fails | Clock skew, the right instance's authenticator entry, reuse of a consumed code |
| `429` | Honor `Retry-After`; hammering passwords deepens the limit |
| Changing the bootstrap password does nothing | Bootstrap never overwrites existing users; change it via account controls |
| `403 license_required` | A platform Admin/Owner activates; the user directory is not exempt from the gate |

Default access-token lifetime is **3600 seconds** and refresh sessions
**2592000 seconds** (30 days), operator-adjustable; refresh **never**
re-asks TOTP. A stolen refresh credential is a **session compromise**,
not a one-hour risk.

## Sign-out and removing access

- `viat auth logout` clears the resolved CLI config's local login
  credentials and current project. In this release it is **local
  cleanup**, not a server-side revocation — it cannot terminate a stolen
  session; revoke server sessions via the console's session management
  and PATs separately. The command **does not** clear a saved
  `project_token`: logging out ≠ fully erasing credentials. When
  retiring a workstation, privately inspect the config files actually
  used and remove residual project credentials after revoking them at
  the issuing system.
- Removing project membership:
  [creating projects together](../projects/create-and-collaborate.md) —
  management access to that project dies on the next request while the
  platform account and project content are **not** deleted. **Never**
  invent `viat user delete` — this CLI has no such command.

## Verification basis

Contract source `03751a67`:
`crates/viat-api/src/handlers/{auth,users}.rs`, `crates/viat-db/src/users.rs`,
`crates/viat-cli/src/{main,config}.rs`,
`crates/viat-cli/src/commands/{auth,user}.rs`, `Dockerfile`.
