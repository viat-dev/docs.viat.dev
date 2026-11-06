---
title: Native client operations
description: Connect instances, inspect projects and logs, rotate resource credentials, configure the assistant and manage phone notifications.
doc_id: clients.mobile
verified_release: '1.1.0'
channel: stable
---

# Native client operations

The native client is an operational companion, not a local Viat server or a replacement for every console editor. This page describes the **0.1 client line with server 1.1.0**. Its Home, Assistant and Settings screens are shared by the Mac and phone shells; native storage, notification registration and Widget behavior differ by platform. Current screen labels quoted below are English.

Obtain a correctly signed artifact through your deployment's approved distribution channel; [client installation](../installation/clients.md) explains platform prerequisites. A public App Store/TestFlight/DMG download channel is not established by this handbook. A development IPA does not authorize installation on arbitrary iPhones.

## Connect the correct instance and identity

You need network access from the device to the instance, a valid platform account, an activated deployment and project membership. A project end-user token is not a platform login. A phone outside the intranet cannot reach a private instance simply because its Mac can.

1. Open the instance picker or **Settings → Instances**, and add the deployment.
2. Enter its base URL, including an operator-configured proxy prefix but not `/ui/` or `/p/<slug>`. Use HTTPS for remote deployments; do not embed a password or bearer in the URL.
3. Save, select the instance, and sign in using the offered password/MFA or configured SSO flow. Complete required MFA enrollment in the supported login flow rather than trying to bypass it.
4. Select an accessible project in Home or **Settings → Project**. This is one app-wide project selection, not two independent settings.
5. Confirm the instance label, deployment URL and project before approving any write.

| Instance field | Rules and effect |
| --- | --- |
| Name | Optional; whitespace trimmed. Empty uses a host-derived label; an explicit name is limited to 32 characters. Renaming is not changing the server or minting a new login. |
| Base URL | Required valid `http`/`https` URL with a host. Outer whitespace and trailing `/` are removed. Save does not prove reachability, certificate trust, activation or successful login. |
| Active instance | Determines foreground requests and assistant context. Sessions/project selections are instance-scoped. |
| Selected project | Determines overview, live logs, resource rotation and notification settings. Membership and each API's role checks still apply. |

Do not put a different deployment behind an existing saved URL merely to reuse credentials. When repointing or removing an instance, expect local session/context cleanup and sign in to the new identity explicitly. A failed secure-store cleanup is an error to resolve, not permission to proceed with an uncertain identity.

## Home: overview and live evidence

The overview defaults to **24h**; available windows are `1h`, `24h`, `7d`, `30d`. Use Refresh for a new sample and read its timestamp. Home presents traffic, failing endpoints, schedules, executions and runs. Selecting a different instance/project/window invalidates old responses so an earlier slow request should not populate the new view.

Live logs use a separate stream. Starting it produces live events, not a historical export. The screen retains at most **200** displayed lines; changing project or leaving Home stops that stream. Use [CLI logs](../cli/logs.md) for historical filtering/export workflows. A server-side refusal may have an execution record even when no script ran.

A server `unauthorized` result returns the app to sign-in rather than leaving a nominally logged-in screen. A network error alone is not proof that the account was revoked. Check [Widget behavior](widgets.md) separately: cached Widget numbers are not the same as an open Home connection.

## Rotate a resource credential

**Settings → Project → Resources** is deliberately narrower than the console's full resource editor. It lists qualified resource names, kinds and declared secret-field names; it does not display their stored secret values or edit arbitrary `plain` fields. Project Owner/Admin/Developer permission is required for the PATCH; a visible row does not imply permission to change it.

1. Select the project and resource, including its folder-qualified name.
2. Enter only fields you intend to replace. Untouched fields are **omitted** and preserved by the server.
3. A field you type into and then clear is sent as `""`. That is an intentional clear, **not** omission; per-kind validation can reject an invalid credential combination.
4. Save, then validate the resource using an appropriately authorized [resource-specific procedure](../assets/resources/index.md). A successful save is not an upstream connection test.
5. Retire the old credential at its issuer only after dependent use and rollback requirements have been considered.

Cancel closes the draft without sending the PATCH. Do not paste a provider secret into the assistant or a diagnostic log. This management view's redaction does not remove the [1.1 script-projection limitations](../overview/concepts.md).

## Assistant configuration and approval

The assistant is an **interactive client capability**, not the server's scheduled workflow engine. Its provider configuration and keys are app-local, shared across saved instances; provider keys occupy separate provider slots. They are not automatically the project's `llm` resource credentials.

In **Settings → Assistant**:

| Setting | Behavior |
| --- | --- |
| Provider | `anthropic` or `openai` (OpenAI-compatible chat/completions). This selects the protocol, not proof that any vendor/model is compatible. |
| Model | Trimmed string. The compatible-provider path requires a nonempty model before asking; the Anthropic path uses its bundled client default when empty. Choose a model available to your own account. |
| API base URL | Used by the compatible-provider path, which requires it before asking. Whitespace/trailing `/` are trimmed. Configure the API root expected by that provider; no network test happens merely by saving. |
| API key | Per-provider secret; blank/whitespace-only saves are refused. A new value replaces that provider's saved key. Remove deletes that provider's stored key, not the provider account or a key at the issuer. |

Save provider settings and the selected provider's key separately. A displayed “key saved” is not validation of its scope, quota or model access. A compatible provider with an empty model/base URL returns `incomplete_config` on an actual request. Provider requests may incur charges and transmit prompt/tool-result data; keep sensitive material out unless that processing is approved.

The assistant proposes **write_script**, **test_run** and **publish** actions through an approval card. Inspect its instance URL, project, source diff or arguments. Approve executes against the server; Decline does not authorize that proposal. A test run can have real resource side effects. Publish applies **all pending project changes**, not only a script mentioned in chat; server warnings require separate acknowledgement. Changing account/instance/project/provider invalidates stale assistant context rather than transferring old approval to a new target.

Do not treat the confirmation UI as authorization to run arbitrary future actions or as a replacement for server permissions. Read-only tool results can still contain private project data and influence the model; an instruction in returned content is not an operator approval.

## Phone notification registration

**Settings → Project → Push notifications** binds this handset to a selected project push resource. This is ordinary alert/run notification delivery, **not encrypted Widget overview snapshots**.

| Native build | Registration source | Required matching resource |
| --- | --- | --- |
| iOS | APNs device token; valid provisioning and notification entitlement/permission | `push` with APNs configuration matching the build's environment/topic |
| Android source build | JPush SDK registration ID | Matching JPush push resource and app setup |
| Mac desktop | No phone registration SDK | Phone push registration is unsupported |

A project must already have a suitable resource. An empty registration ID is a retryable `not_ready` state while the native token arrives, not a fabricated success. Provisioning or APNs registration errors require correcting the native build/account setup. Enabling registers this handset; it does not demonstrate provider acceptance or device delivery. Never select an unrelated provider resource just because it appears in the list.

Disable before retiring a binding; sign-out attempts account-specific cleanup. Project switching is not permission to send a test notification. Actual message delivery and external-provider cleanup require deliberate opt-in; see [Push resources](../assets/resources/push.md).

## Storage, failures and cleanup

**Settings → About** shows the deployment and storage self-check. Native credential storage failures must not be confused with a server password failure. Follow the reported store state; do not claim sessions will survive restart when storage is degraded or ephemeral. Do not copy raw secure-store contents into support reports.

| Symptom | Verify and recover |
| --- | --- |
| No projects | Confirm the instance and platform identity, then membership; create/manage projects in the console or CLI. |
| Overview unavailable | Verify device-side DNS/network/TLS, activation, membership and the selected project. Do not replace missing data with zero. |
| Resource save forbidden | Check effective project role and field-specific validation; listing a resource is not editing permission. |
| Assistant has no usable provider | Save provider/model/root/key as appropriate, then verify account access without disclosing the key. |
| Write card targets an unexpected project | Decline; correct instance/project selection and request a new proposal. |
| Push says unknown/not ready | Distinguish state-load failure from pending native registration; inspect the exact error and matching provider. |

For a shared or retired device, disable applicable notification bindings, sign out of each account and remove saved instances as intended. Review app-local provider keys separately. Uninstalling an app is not guaranteed to revoke server sessions, delete Keychain material, remove project assets or revoke provider credentials. Previously rendered Widget images can remain until the OS redraws them.

## Verification basis

Pinned source `03751a67`: `client/src/{App,home/Home,settings/ProjectSettings,settings/AssistantSettings,settings/AboutSettings,write/WriteConfirmModal}.tsx`, `client/src-tauri/src/{instances,lib,push}.rs`, `crates/viat-client/src/resources.rs`, `packages/frontend-core/src/index.ts`. These operations were source-reviewed for the handbook; this page is not a claim of fresh device/provider acceptance.
