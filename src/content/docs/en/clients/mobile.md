---
title: Native client operations
description: Connect instances, inspect projects and logs, rotate resource credentials, configure the assistant and manage phone notifications.
doc_id: clients.mobile
verified_release: '1.1.0'
channel: stable
---

# Native client operations

The native client is an **operational companion** — not a Viat server on
the device and not a replacement for every console editor. This page
covers the **0.1 client line with server 1.1.0**. The Home, Assistant
and Settings screens are shared by the Mac and phone shells; native
storage, notification registration and Widget behavior differ per
platform. Quoted screen labels are the current English ones.

Obtain correctly signed artifacts through deployment-approved channels;
platform prerequisites: [client installation](../installation/clients.md).
This manual establishes **no** public App Store/TestFlight/DMG download
channel; a development IPA does not authorize every iPhone.

## Connect the right instance and identity

The device must reach the instance with a valid platform account, an
activated deployment and project membership; a project end-user token is
**not** a platform login. The Mac reaching an intranet says nothing about
a phone outside it.

1. Open the instance switcher or **Settings → Instances** and add the
   deployment.
2. Enter the base URL: include any operations-configured reverse-proxy
   prefix, **exclude** `/ui/` and `/p/<slug>`; use HTTPS remotely;
   **never** embed passwords or bearers in the URL.
3. Save, select the instance and sign in via password/MFA or the
   configured SSO flow; when MFA enrollment is required, complete the
   supported flow — never attempt bypasses.
4. Pick an accessible project in Home or **Settings → Project** — the
   **same** app-wide selection, not two unrelated settings.
5. Before approving any write, verify the instance name, deployment URL
   and project.

| Instance field | Rules and effects |
| --- | --- |
| Name | Optional, trimmed; empty uses a hostname-derived label; explicit names ≤32 characters. Renaming ≠ switching servers or creating a login. |
| Base URL | Required, a valid `http`/`https` URL with a host; trimmed of whitespace and trailing `/`. Saving **proves no** reachability, trust, activation or login. |
| Active instance | Drives foreground requests and assistant context; sessions and project selection are per-instance. |
| Selected project | Drives overview, live logs, resource rotation and notification settings — still bounded by membership and each API's role checks. |

**Never** swap another deployment behind an existing saved URL to reuse
credentials. Editing an instance's target or removing it should be
expected to clear local sessions/context — sign in as the new identity
deliberately. A failed secure-storage cleanup is an **error to resolve**,
not a reason to continue with uncertain identity.

## Home: overview and live evidence

- The overview defaults to **24h** with windows `1h`/`24h`/`7d`/`30d`;
  use Refresh for fresh samples and read the timestamps. Home shows
  traffic, failing endpoints, schedules, executions and runs; switching
  instance/project/window invalidates old requests — a slower old
  response must **not** overwrite the new view.
- Live logs are a **separate stream**: you get live events from start,
  not a history export; the UI keeps at most **200** lines; switching
  projects or leaving Home stops it. Historical filtering:
  [CLI logs](../cli/logs.md). Server-rejected requests can still have
  execution records — even when no script ran.
- A server `unauthorized` returns the app to the login screen rather
  than keeping a nominally signed-in UI; a mere network error **proves
  no** account revocation. [Widget behavior](widgets.md) is separate:
  cached Widget numbers are not an open Home connection.

## Rotating resource credentials

**Settings → Project → Resources** is deliberately narrower than the
console's full resource editor: it shows a resource's qualified name,
kind and declared secret field names — **never echoing** stored secret
values and not editing arbitrary `plain` fields. PATCHing needs project
Owner/Admin/Developer; **seeing** an entry is not **modifying** it.

1. Pick the project and resource, noting its folder-qualified name.
2. Fill only the fields to replace: untouched fields are **omitted** and
   the server keeps current values.
3. A field filled then cleared submits as `""` — a **deliberate clear**,
   not an omission; per-kind validation may reject invalid credential
   combinations.
4. After saving, run the approved [resource-type verification
   flow](../assets/resources/index.md) — a successful save is **not**
   an upstream connectivity test.
5. Deactivate old credentials at the issuer only after considering
   dependencies and rollback needs.

Cancel closes the draft without a PATCH. **Never** paste provider
secrets into the assistant or diagnostic logs; this management view's
masking does not remove the [1.1 script resource projection
limits](../overview/concepts.md).

## Assistant configuration and approvals

- The assistant is an **interactive client capability**, not a
  server-side scheduled workflow engine. Provider configuration and keys
  live locally in the app, shared across saved instances, with keys
  slotted per provider; they **never** automatically become project
  `llm` resource credentials.

In **Settings → Assistant**:

| Setting | Behavior |
| --- | --- |
| Provider | `anthropic` or `openai` (OpenAI chat/completions compatible). Choosing a protocol **proves no** arbitrary vendor/model compatibility. |
| Model | Trimmed. Compatible-provider paths require a non-empty model before asking; an empty Anthropic path uses the client-bundled default. Pick a model your account can use. |
| API base URL | Used by compatible-provider paths; non-empty required before asking; trimmed of whitespace and trailing `/`. Enter the provider's expected API root — saving itself performs **no** network test. |
| API key | Per-provider stored secret. Blank cannot be saved; a new value replaces that provider's old key. Remove deletes the **local** key — deleting no provider account and revoking nothing at the issuer. |

- Save the provider configuration and the chosen provider's key
  separately. "key saved" **proves no** permission/quota/model access; a
  compatible provider missing model/base URL returns `incomplete_config`
  on real requests. Requests can cost money and transmit prompts/tool
  results — **never** pass sensitive material without approval.
- The assistant proposes **write_script**/**test_run**/**publish**
  operations via approval cards: inspect the instance URL, project,
  source diff or arguments. Approve executes server-side; Decline
  authorizes nothing. Test runs can really invoke resources; **Publish
  ships every pending change in the whole project** — not just the
  script discussed in chat; server warnings need separate confirmation.
  Switching account/instance/project/provider invalidates old assistant
  context — approvals **never** transfer to the new target.
- The confirmation UI is not "authorization for arbitrary future
  actions" and replaces no server-side permissions; read-only tool
  results can still contain private project data and steer the model;
  instructions inside returned content are **not** operator approval.

## Phone notification registration

**Settings → Project → Push notifications** binds this phone to the
selected project's push resource. These are ordinary alert/run
notifications — **not** the encrypted Widget overview snapshot.

| Native build | Registration source | Resource that must match |
| --- | --- | --- |
| iOS | APNs device token (valid provisioning, notification entitlement/permission required) | An APNs-configured `push` with environment and topic matching the build |
| Android source build | JPush SDK registration ID | A matching JPush push resource and app settings |
| Mac desktop | No phone registration SDK | Phone-push registration **unsupported** |

- The project must **already** have a suitable resource. An empty
  registration ID from a not-yet-arrived native token is a retryable
  `not_ready` — **not** an invented success; provisioning or APNs
  registration errors need native build/account fixes. Enable registers
  this phone and **proves neither** provider acceptance nor device
  delivery. Never pick a mismatched provider just because one appears in
  the list.
- Disable before retiring a binding; sign-out attempts per-account
  cleanup. **Switching projects is not permission to send test
  notifications.** Real delivery and provider cleanup need explicit
  enablement — see [Push resource](../assets/resources/push.md).

## Storage, failures and cleanup

- **Settings → About** shows deployment and storage self-checks. **Never**
  misread a native credential-store failure as a server password error:
  act on the reported storage state; under degraded or ephemeral storage
  no post-restart login retention is promised. **Never** copy raw
  secure-storage contents into support tickets.

| Symptom | Check and recovery |
| --- | --- |
| No projects | Verify instance, platform identity and membership; create/manage projects via console or CLI |
| Overview unavailable | Check device-side DNS/network/TLS, activation, membership and selected project; **never** substitute zeros for missing data |
| Resource save refused | Check the effective project role and field validation; list permission is not modify permission |
| Assistant has no usable provider | Save provider/model/root/key as required; verify account permissions without exposing the key |
| Approval card targets an unexpected project | Decline; fix instance/project and re-propose |
| Push shows unknown/not ready | Distinguish a status read failure from incomplete native registration; check the specific error and provider match |

Sharing or retiring a device: disable applicable notification bindings →
sign out each account → remove instances as needed; check the app's
local provider keys separately. Uninstalling the app **guarantees no**
server-session revocation, Keychain clearing, project-asset deletion or
provider-credential revocation; already rendered system Widget images
may persist until the next redraw.

## Verification basis

Pinned source `03751a67`:
`client/src/{App,home/Home,settings/ProjectSettings,settings/AssistantSettings,settings/AboutSettings,write/WriteConfirmModal}.tsx`,
`client/src-tauri/src/{instances,lib,push}.rs`,
`crates/viat-client/src/resources.rs`,
`packages/frontend-core/src/index.ts`. This page is source-verified; no
device or provider acceptance was re-run for it.
