---
title: Create a project and collaborate
description: Create a project, choose it in the CLI, grant independent project roles, and safely transfer or remove membership.
doc_id: projects.create-and-collaborate
verified_release: '1.1.0'
channel: stable
---

# Create a project and collaborate

A project is the namespace for endpoints and their assets, and the boundary for collaborator access. A platform account without membership does not see the project—even if it has a high platform role. This procedure creates a project and enrolls collaborators without confusing them with project end users.

## Prerequisites and permissions

- An activated instance and CLI `1.1.0`, or access to its browser console.
- A platform login; see [Platform users](../instance/platform-users.md). The creation handler accepts an authenticated platform user and makes the creator the project's **Owner**. It does not require a platform Admin role.
- To manage an existing project's members: project `owner` or `admin`.
- Intended collaborators' platform email addresses. Existing accounts are added as members; new accounts are invited.

| Project role | Typical permitted work |
| --- | --- |
| `owner` | Project content, publish, settings, and membership; cannot remove/demote the last Owner |
| `admin` | Content management, publish, project settings, and membership |
| `developer` | Create/edit content; no publish or member management |
| `operator` | View the project and logs; no content edits |

These are **membership roles**, independent of each person's platform `owner`/`admin`/`developer`/`operator` role. Business API callers use project authorizers and end-user roles, not this table.

## 1. Choose a stable slug

A project slug is **1–64 characters**, using only lowercase ASCII letters, digits, and hyphens. It must be unique within the instance. `hello-lab` is valid; spaces, underscores, uppercase letters, and non-ASCII text are not valid slug characters. The display name is separate and can be human-readable text.

The slug becomes part of `/p/hello-lab/...` and management URLs. Choose it before distributing client URLs; this procedure does not provide a slug-rename operation.

## 2. Create and select a remote-only project

From your signed-in private CLI directory:

```sh
viat auth whoami
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project list
viat project member ls --json
```

Use an unused slug, and use that same slug consistently below. Expected creation output is `created hello-lab`, followed by `selected hello-lab`; the project list marks the selected entry with `*`. The member list contains the creator with project role `owner`.

Creation also seeds a root-mounted `default` endpoint tree, built-in roles including `public` and `system:scheduler`, an `anonymous` authorizer, and native login/register endpoints. Project end-user registration defaults to **disabled** (`allow_registration: false`), separately from platform signup. Built-in auth endpoints do not mean public self-registration is enabled, and do not require handing scripts a platform-database resource.

Creating remotely does not create a local repo scaffold, and selecting a project does not pull assets or publish anything. Project-scoped commands use the saved selection; check it before making changes.

### Alternative: create and scaffold together

If your goal is a new version-controlled project, use this **instead of** the previous create command:

```sh
viat project init hello-lab --name "Hello Lab"
cd hello-lab
```

`init` creates the remote project, a local `hello-lab/` directory, `viat.yaml`, `.viat/config.yaml`, and sibling asset directories (`endpoints`, `scripts`, `workflows`, `schedules`, `watches`, `ws_triggers`, `resources`). It selects the project in that local configuration. The target directory must not already exist. `--here` scaffolds in an appropriately empty current directory; do not run it over unrelated files.

The config contains session credentials. Ensure `.viat/` is ignored and privately protected before initializing version control. `init` is not a fully atomic remote/local operation: a later local failure can leave the remote project already created. Check `viat project list` before blindly rerunning a failed initialization.

## 3. Add an existing platform account

As project Owner/Admin:

```sh
viat project select hello-lab
viat project member add colleague@example.com --role developer
viat project member ls --json
```

Replace the example email with the intended existing account. Verify that the new row has `role: "developer"`. A project Operator may read the member list but cannot perform this write. Platform Admin alone is not enough if the account lacks target-project authority.

In the console, open the project, then **Settings → Members**, choose add existing account, enter the email and role, and save. Every member can see the list; management controls are for project Owner/Admin.

## 4. Invite a new account directly into the project

For an address that does not yet have a platform account:

```sh
viat user invite --email teammate@example.com --display-name "Teammate" --project hello-lab --role operator
```

`--project` and `--role` are a pair. This path requires project Owner/Admin, even if the inviter is only a platform Operator. It creates a platform account and a project membership; it does not create a project end user. Without `--project`, inviting requires platform Admin/Owner and creates no membership.

The generated initial password appears once as `temp_password`; share it through an approved out-of-band channel. This is account creation, not guaranteed email delivery. Ask the recipient to sign in, change the initial password, and confirm the project appears. Do not include the generated secret in screenshots or issue reports.

## 5. Change roles or hand over ownership

```sh
viat project member set-role colleague@example.com admin
viat project member ls --json
```

`set-role` takes the email and role as **positional arguments**, unlike `member add`, which uses `--role`. This changes only the selected project's membership.

For an ownership handover, first promote a trusted existing member to `owner`, verify that they can sign in and administer the project, then demote/remove the previous Owner if desired. The server refuses demoting or removing the **last Owner**. Self-removal is allowed only when another Owner remains. Do not attempt to work around this safety rule by deleting membership rows manually.

## 6. Remove access

```sh
viat project member rm teammate@example.com
viat project member ls --json
```

Verify the email is absent. Every project-scoped request rechecks membership, so the removed user's session, scoped PAT, and `vso_` overview reader stop granting that project's access on the next request. Their project push-device registrations are deleted with the membership; rejoining requires device re-registration.

Removal does not delete their platform account, scripts, or upstream service credentials. It is not a rollback of changes they previously published. Review separate PATs/credentials and business API identities if offboarding also requires those to be revoked.

## Repo-sync boundaries and safe collaboration

Membership is deliberately **not** carried by `viat push`/`pull`. A checkout does not grant someone collaborator access. Project settings also have console/API-only fields; do not assume every setting lives in `viat.yaml`.

Before using repo sync on an existing shared project, pull into a controlled checkout and inspect `viat project diff`. `push` mirrors managed content and can remove server-side objects absent locally; it is not a safe way to publish one experimental file from an incomplete directory. Publication is separate from syncing/editing. Use [Your first endpoint](../getting-started/first-endpoint.md) for a remote-command workflow that avoids that ambiguity.

## Failure handling and cleanup

| Problem | Remedy |
| --- | --- |
| `slug already taken` | Choose another slug or select the intended existing project; do not keep trying to recreate it |
| Invalid slug | Use 1–64 lowercase ASCII letters/digits/hyphens |
| `project not found or not accessible` | Check instance, email, and membership; `select` validates against the visible list |
| Member add cannot find user | Invite a new account with `--project --role`, or correct the email |
| Invitation says email exists | Use `project member add` for the existing account |
| Membership write returns `403` | Check selected project's Owner/Admin role |
| `last_owner` in a refusal message | Promote another Owner first; this is a deliberate safety check |
| User sees project but cannot publish | Their project role may be `developer`/`operator`; platform role is not the deciding role |

For a tutorial, clean up its created endpoints/scripts as shown in [Your first endpoint](../getting-started/first-endpoint.md), remove disposable collaborator memberships while keeping an Owner, and clear local session credentials when finished. This CLI does not expose a `project delete` command; do not invent one or directly remove platform database rows as a cleanup shortcut.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/projects.rs`, `crates/viat-db/src/{projects,default_auth}.rs`, migrations `0054_project_auth_endpoints.sql` and `0061_project_default_timeout.sql`, `crates/viat-cli/src/main.rs`, and `crates/viat-cli/src/commands/project.rs`.
