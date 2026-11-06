---
title: Platform users and sign-in
description: Bootstrap an Owner, sign in safely, invite platform accounts, and distinguish platform administration from project membership.
doc_id: instance.platform-users
verified_release: '1.1.0'
channel: stable
---

# Platform users and sign-in

A **platform user** signs in to the console, CLI, or native app. This account is not a project end user. Its platform role governs instance administration; an independent membership role governs each project. A platform `operator` may legitimately be a project `owner`.

## Prerequisites and permission matrix

You need the instance's base URL and a platform account, or host access to bootstrap a new installation. The instance must be activated for user-directory and project-management routes; login and activation remain available while locked.

| Action | Required authority |
| --- | --- |
| Sign in / inspect your identity | Your platform credentials and any required MFA |
| List platform users | Platform `admin` or `owner` |
| Invite an account without a project | Platform `admin` or `owner` |
| Invite a new account into a project | That project's `admin` or `owner`; platform Admin is not required |
| Change a platform role | Platform `owner` only |
| Reset another account's MFA | Platform `owner` only |
| Add an existing user to a project | That project's `admin` or `owner` |

The literal role values are `owner`, `admin`, `developer`, and `operator`. Changing a platform role does not grant project membership or change project roles. Project callers managed with `viat p-user` are a separate identity plane.

## 1. Bootstrap the initial Owner

For a new deployment set both:

```dotenv
VIAT_DEFAULT_ADMIN_EMAIL=admin@example.com
VIAT_DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PRIVATE_PASSWORD
VIAT_ALLOW_REGISTRATION=false
```

Replace the email/password before use. These are server configuration values, not a command to register a user. Startup creates the missing account as platform `owner` and never overwrites an existing account. Supplying the email without a password skips the seed with a warning. Changing the environment password later is not a reset procedure.

The native server's registration default is `true`; the official image overrides it to **`false`**. When registration is disabled, public registration routes return `403`. The first account created on an empty platform receives `owner`; later ordinary accounts default to `operator`. Do not temporarily expose a fresh public registration page to race for the first Owner—use protected bootstrap configuration.

## 2. Sign in through the console

1. Open the actual instance URL, usually `/ui/` after the root redirect.
2. Enter the platform email/password, or select an OIDC provider configured by your operator.
3. If an authenticator is enrolled, enter a fresh TOTP or an unused recovery code. If the deployment requires enrollment, complete it before expecting a session.
4. If activation is required, a platform Owner/Admin follows [Activation](activation.md).
5. Check the account menu and project selector. An empty project list usually means missing membership, not a broken login.

The account menu's Security/session controls are the place to enroll MFA, manage recovery codes, change your password, and inspect/revoke sessions. Store recovery codes privately; they are shown once and are single-use. Do not assume an invitation's “temporary” password is automatically one-use or that a forced-change screen is guaranteed—change it as an explicit first task.

## 3. Sign in through the CLI

Use CLI `1.1.0`. Start in a dedicated private working directory that is not another project's checkout. The following prompts are **Bash** syntax:

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

For the local Compose installation, enter `http://127.0.0.1:8080` as the base URL. Include a reverse-proxy mount prefix when applicable, but do not append `/ui` or `/projects`. Expected output starts `logged in as <your-email>`; `whoami` prints that email. `viat version` prints the CLI release and, when available, the server release.

Both `--email` and `--password` are required for password login; omitting them does **not** prompt for them. The shell prompts above avoid literal passwords in shell history, but the CLI's password argument is briefly visible to local process inspection. Use a trusted workstation. The CLI prompts interactively for the second factor when needed; non-interactive use supplies `--totp CODE`. If it reports `mfa_enrollment_required`, enroll once in the console before retrying. Configured SSO instead uses `viat auth login --server URL --oidc NAME`, not password flags.

The session is saved in `.viat/config.yaml` and includes bearer/refresh credentials. Never commit or paste it. Normal lookup searches upward for a `.viat/config.yaml`; `VIAT_CONFIG_DIR` explicitly selects the config **directory itself**. A login for a different server avoids overwriting an ancestor's session, but deliberate directory separation remains the safest habit. Protect the directory and backups too.

## 4. Invite and enroll people deliberately

As a platform Admin/Owner, invite a platform account without granting project access:

```sh
viat user invite --email colleague@example.com --display-name "Colleague"
viat user ls --json
```

Use the real intended recipient address. Expected invitation output includes `invited: ...` and a generated `temp_password` **once**. Share it out of band, not in chat logs or a committed terminal transcript. This creates an account; it does not promise to send an email invitation. The account sees no project until enrolled.

If you are a project's Owner/Admin and want to create and enroll in one operation:

```sh
viat user invite --email teammate@example.com --project hello-lab --role developer
```

`--project` and `--role` must be supplied together. An existing email returns a conflict: use [project member add](../projects/create-and-collaborate.md), not a second invitation. Optional `--temp-password` sets an initial password of at least eight characters; it places a secret in arguments, so the generated-password flow is preferable for interactive administration.

## 5. Delegate platform authority

A platform Owner may promote an existing account:

```sh
viat user set-role colleague@example.com admin
viat user ls --json
```

This gives platform administration, **not** project Admin rights. Use the project member workflow for those. Only an Owner can change platform roles; the last platform Owner cannot be demoted. Establish a second trusted Owner and verify their sign-in before removing the only recovery path.

An Owner can reset lost MFA with `viat user reset-mfa colleague@example.com`. This clears the second factor and signs that account out everywhere; if the deployment policy requires MFA, the account must enroll again. It is an incident/recovery action, not a routine way to bypass MFA. A last-Owner lockout requires a separately controlled operator recovery process; do not distribute database-editing recovery commands to ordinary users.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Correct login, no projects | Ask a project's Owner/Admin for membership; platform role is independent |
| Invitation receives `403` | Without `--project`, platform Admin/Owner is needed; with it, target project Admin/Owner is needed |
| `--project`/`--role` validation error | Supply both, or neither |
| Existing email conflict | Add the existing account as a member rather than invite again |
| `401 mfa_required` | Complete the current challenge; use a fresh authenticator/recovery code |
| Every TOTP fails | Check clocks, correct instance's authenticator entry, and replay of an already used code |
| `429` | Respect `Retry-After`; repeated password attempts worsen throttling |
| Bootstrap password edit has no effect | Bootstrap never overwrites an existing user; change password through account controls |
| `403 license_required` | Activate with a platform Admin/Owner; user-directory access is not gate-exempt |

Default access-token lifetime is **3600 seconds** and refresh-session lifetime **2592000 seconds** (30 days), configurable by the operator. Refresh does not ask for TOTP again. Treat a stolen refresh credential as a session compromise, not just a one-hour problem.

## Sign out and remove access

`viat auth logout` clears local login credentials and current project in the resolved CLI config. In this release it is **local cleanup**, not a server-side revocation request; do not equate it with terminating a stolen session. Use the console's session controls to revoke server sessions, and revoke personal access tokens separately. The saved `project_token` is not cleared by this command in 1.1.0; logging out is not a complete credential wipe. When retiring a workstation, inspect the resolved configuration privately and remove remaining project credentials after revoking them through their issuing system.

Removing someone from a project is described in [Create and collaborate](../projects/create-and-collaborate.md). It blocks that project's management access on the next request but does not delete the platform account or their project content. Do not invent a `viat user delete` command: this CLI has no such command.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/{auth,users}.rs`, `crates/viat-db/src/users.rs`, `crates/viat-cli/src/{main,config}.rs`, `crates/viat-cli/src/commands/{auth,user}.rs`, and `Dockerfile`.
