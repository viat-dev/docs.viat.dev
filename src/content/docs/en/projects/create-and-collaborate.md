---
title: Create a project and collaborate
description: Create a project, choose it in the CLI, grant independent project roles, and safely transfer or remove membership.
doc_id: projects.create-and-collaborate
verified_release: '1.1.0'
channel: stable
---

# Create a project and collaborate

After this page you have: a fresh project (with its default endpoint tree and
built-in authorizers), a few collaborators with clear roles, and a safe
procedure for transferring or removing access.

The model in one sentence: **a project is the namespace for endpoints and
assets and the boundary for collaborator access**. A platform account without
membership does not see the project, however high its platform role; project
roles and platform roles are independent; business API callers use project
authorizers and never appear in this table.

## Prerequisites

- An activated instance; CLI `1.1.0` or the browser console.
- A platform login ([platform users](../instance/platform-users.md)).
  Creating a project needs no platform Admin: any authenticated platform user
  may create one and automatically becomes its **Owner**.
- Managing an existing project's members takes that project's `owner` or
  `admin`.
- Collaborators' platform email addresses: existing accounts join directly,
  new ones come in via invitation.

| Project role | Typical permitted work |
| --- | --- |
| `owner` | Content, publish, settings, membership; the last Owner cannot be removed or demoted |
| `admin` | Content management, publish, project settings, membership |
| `developer` | Create/edit content; no publish or member management |
| `operator` | View the project and logs; no content edits |

## 1. Choose a stable slug

Slug rules: **1–64 characters**, lowercase ASCII letters, digits and hyphens
only, unique per instance. `hello-lab` is valid; spaces, underscores, uppercase
and non-ASCII are not. The display name is separate and may be any
human-friendly text.

The slug lands in `/p/hello-lab/...` and management URLs, and **there is no
rename operation** — settle the name before giving it to clients.

## 2. Create the remote project and select it

From a private, signed-in CLI directory:

```sh
viat auth whoami
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project list
viat project member ls --json
```

Expect in order: `created hello-lab` → `selected hello-lab` → the list marking
the current project with `*` → the creator listed at role `owner`.

Creation also initializes: the root-mounted `default` endpoint tree, built-in
roles such as `public` and `system:scheduler`, the `anonymous` authorizer, and
native login/register endpoints. End-user registration defaults to **off**
(`allow_registration: false`), independent of platform registration; having
built-in auth endpoints does not mean open self-registration, and scripts never
need access to the platform database.

Remote creation produces no local repository scaffold, and selecting a project
pulls or publishes nothing; subsequent project commands use the saved
selection — verify it before changing things.

### Alternative: create plus a local scaffold

When the goal is a new version-controlled project, use this **instead of** the
`create` above:

```sh
viat project init hello-lab --name "Hello Lab"
cd hello-lab
```

`init` creates the remote project plus a local `hello-lab/` directory
(`viat.yaml`, `.viat/config.yaml` and the `endpoints`/`scripts`/`workflows`/
`schedules`/`watches`/`ws_triggers`/`resources` asset folders) and selects the
project in that local config. The target directory must not exist; `--here`
initializes in a suitable empty current directory without touching unrelated
files.

> [!WARNING]
> The config holds session credentials: ignore `.viat/` in version control and
> tighten its permissions before committing. `init` is not a fully atomic
> remote/local transaction — a later local failure can leave the remote
> project created; check `viat project list` before rerunning.

## 3. Add an existing platform account

:::tabs id=member-add

::tab Console

Open the target project, go to **Settings → Members**, choose to add an
existing account, fill in the email and role, and save. Every member can see
the list; the management controls are project Owner/Admin only.

::tab CLI

A project Owner/Admin runs:

```sh
viat project select hello-lab
viat project member add colleague@example.com --role developer
viat project member ls --json
```

Substitute the intended existing account's email and confirm the new row shows
`role: "developer"`.

:::

A project Operator can read the member list but not write it; a platform
Admin without membership in the target project is equally unable to perform
this.

## 4. Invite a new account straight into the project

For an email without a platform account yet:

```sh
viat user invite --email teammate@example.com --display-name "Teammate" --project hello-lab --role operator
```

`--project` and `--role` come as a pair: even a platform Operator may use this
path as long as they are the project's Owner/Admin. It creates the platform
account and the membership together, and creates **no** project end user. An
invitation without `--project` requires platform Admin/Owner and creates no
membership.

> [!WARNING]
> The initial password appears exactly once as `temp_password`; hand it over
> through an approved out-of-band channel — this is account creation, not an
> email guarantee. Have the recipient sign in, change the password and confirm
> the project is visible. Never put generated secrets into screenshots or
> issue reports.

## 5. Change roles or transfer ownership

```sh
viat project member set-role colleague@example.com admin
viat project member ls --json
```

`set-role` takes email and role as **positional arguments** — unlike
`member add` with its `--role`; it changes only this project's membership
role.

Safe ownership transfer order: promote a trusted member to `owner` → verify
they really can sign in and manage the project → then demote/remove the
previous Owner. The server refuses to demote or remove the **last Owner**;
self-removal is allowed only while another Owner exists. Never bypass the
protection by deleting membership rows directly.

## 6. Remove access

```sh
viat project member rm teammate@example.com
viat project member ls --json
```

Confirm the email is gone from the list. Every project request re-checks
membership live, so the removed user's sessions, project-scoped PATs and
`vso_` overview readers lose project access from the **next request**; their
project push-device registrations are deleted with the membership and must be
re-registered if they rejoin.

Removal deletes no platform account, script or upstream service credential,
and rolls back none of their published changes — if an offboarding flow also
needs PAT/service-credential/business-API identity revocation, handle each
separately.

## Repository-sync boundaries

Membership is deliberately **not** carried by `viat push`/`pull`: obtaining a
working copy grants no collaborator access. Project settings also include
console/API-only fields — do not assume everything lives in `viat.yaml`.

Before enabling repo sync on a shared project, pull into a controlled working
copy and review `viat project diff`. `push` mirrors and can remove
server-side objects missing locally; publishing a single experimental file
from a partial directory is not safe. Publishing, syncing and editing are
independent operations; the remote-command flow in
[first endpoint](../getting-started/first-endpoint.md) avoids this ambiguity.

## Failure handling

| Problem | Action |
| --- | --- |
| `slug already taken` | Pick another slug or use the intended existing project; do not keep recreating |
| Invalid slug | Use 1–64 lowercase ASCII letters, digits or hyphens |
| `project not found or not accessible` | Verify instance, email and membership; `select` validates against the visible list |
| Adding a member fails to find the user | Invite via `--project --role`, or fix the email |
| Invitation says the email exists | Use `project member add` for existing accounts |
| Member write returns `403` | Check your Owner/Admin role in this project |
| Refusal message contains `last_owner` | Promote another Owner first — this is a deliberate safety check |
| Can view but cannot publish | The project role is `developer`/`operator`; platform roles are irrelevant here |

## Cleanup

At the end of a tutorial: clean up the created endpoints/scripts per
[first endpoint](../getting-started/first-endpoint.md); remove temporary
collaborators while keeping at least one Owner; clear local session
credentials afterwards. The CLI has no `project delete` command — do not
invent one, and do not shortcut by deleting platform database rows.

## Verification basis

Contract source `03751a67`: `crates/viat-api/src/handlers/projects.rs`,
`crates/viat-db/src/{projects,default_auth}.rs`, migrations
`0054_project_auth_endpoints.sql` and `0061_project_default_timeout.sql`,
`crates/viat-cli/src/main.rs`, `crates/viat-cli/src/commands/project.rs`.
