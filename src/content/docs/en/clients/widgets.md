---
title: Widgets and overview freshness
description: Understand the stable HTTP overview reader, displayed metrics, refresh timing, intranet limits and credential cleanup.
doc_id: clients.widgets
verified_release: '1.1.0'
channel: stable
---

# Widgets and overview freshness

A Viat Widget displays a small **platform/project operational overview**. It is not an arbitrary application dashboard, a lab-job viewer, a monitoring agent that runs continuously, or a channel for executing scripts. This page covers the stable **0.1 client / server 1.1.0** HTTP-reader path.

**Encrypted APNs overview snapshots are not part of this stable baseline.** Ordinary APNs alert notifications already exist, but receiving an alert does not implement the unreleased snapshot feature. Do not look for an API-versus-push Widget source selector in the stable client.

## Prerequisites and first setup

1. Install the correctly signed app and embedded Widget extension using [client installation](../installation/clients.md). On Mac, use the installed application rather than running an arbitrary copy from a mounted DMG.
2. Open Viat, add an instance, sign in as a platform user, and select a project you belong to.
3. Open Home and successfully load an overview. Verify its instance/project and timestamp before adding the OS Widget.
4. Add the Viat Widget through the operating system's Widget UI. Where an instance selector is offered, choose the intended saved instance. The project comes from that instance's app selection; it is not an independent custom business-query editor.
5. Compare the Widget's label, time window and timestamp with Home. A cached value may be older than the current screen.

The device or Widget process must be able to reach the instance over HTTP(S). If the instance is intranet-only, provide an authorized network/VPN path. Do not expose an unauthenticated public endpoint merely to make a Widget refresh.

## What the fields mean

| Field | Meaning and limits |
| --- | --- |
| Instance/project label | The selected saved instance and project. A label change is not a fresh server sample. Project/instance labels are shortened for display. |
| Window | Background readers use `24h`. Foreground Home supports other windows; do not compare unlike windows as if they were the same measurement. |
| Requests | Requests counted by the server overview in that window, not the number of business jobs or successful workflow steps. |
| Server errors | Server-side error count; the compact payload intentionally does not carry client-error counts. |
| p95 latency | Milliseconds; absent when there were no requests. A dash is not a measured zero. |
| Failing endpoints | Number on the server's failing-endpoint list, not every endpoint that ever failed. |
| Failing schedules | Enabled schedules with a nonzero consecutive-failure streak, not a count of all historical failures. |
| Updated time | Unix-time sample receipt represented locally as relative time. It must not advance merely because cached content is redrawn. |

A business job can remain running in an external cluster while the platform overview is healthy. Implement a separately authenticated job-status API/page for that use case; a Widget overview token cannot call it.

## Refresh is scheduled, not guaranteed

The Apple Widget requests a next timeline after **15 minutes**. WidgetKit decides when it actually runs; background restrictions, network state, power and OS policy can delay it. The reader requests `GET /projects/{slug}/overview?window=24h` using its scoped overview credential.

The Apple network request has a **10-second cap**, while timeline delivery waits at most **4 seconds**. If the shorter deadline wins, the callback returns cached content and drops the late result. This prevents a slow intranet request from holding the Widget indefinitely; it does not mean the cache is live.

On Mac, the signed app's refresh helper/LaunchAgent also requests periodic background refresh (configured at **900 seconds**). Installation location and operating-system background-item permission matter. Do not register multiple ad-hoc refresh loops to compensate for stale data: first diagnose app installation, permissions and the actual device-to-server connection. Android has separate native scheduling; Apple WidgetKit timings are not an Android service-level promise.

No refresh cadence is an uptime SLA. A visible Widget, successful app login or old successful sample is not proof that the instance is currently reachable. Read the timestamp before acting.

## Credential boundary

A console login issues an opaque `vso_` overview token for that login. The Widget reader uses this narrow, read-only credential rather than the normal access/refresh token pair. Its server route is **only** the project overview route, and access still requires that login's user to belong to the requested project. It cannot list all projects, run scripts, modify resources or call arbitrary business APIs.

The display catalog is credential-free. The Apple reader descriptor is separate and contains the token inside the app's shared group, which is needed because the extension cannot use the app's ordinary credential access path. Do not copy, publish or attach this file to support requests. Least privilege does not make the token non-secret.

Reader outcomes are intentionally different:

| Outcome | Reader action | User recovery |
| --- | --- | --- |
| Successful valid overview | Accept the new sample | Check its project/window/time. |
| `401` | Remove that reader entry | Open the app and sign in again for a new valid login. |
| `403` | Keep the reader identity but clear its selected project pointer | Restore membership or select a different accessible project in the app. |
| Network/timeout/5xx/429 or invalid response | Use cached fallback | Restore connectivity/service health and wait for a later refresh; do not reset credentials simply to hide an outage. |

The server login's logout/revocation invalidates its reader credential. CLI `auth logout` is a different operation: in 1.1.0 it is local CLI cleanup and does not revoke server sessions. Do not assume using it retires a phone's Widget login.

## Diagnose without exposing the Widget token

Using an already authorized CLI platform session and your actual project slug:

```sh
viat call --console --method GET '/projects/hello-lab/overview?window=24h'
```

The command prints an HTTP status followed by the overview body. Inspect `project_slug`, `window` and the `traffic` object. This is a management-session diagnostic, **not** a test that the Widget's separate `vso_` token is still valid. Perform it only against a project you are authorized to inspect; replace `hello-lab` if necessary.

| Symptom | Check |
| --- | --- |
| App works on Wi-Fi, Widget stale away from the site | The phone/Widget has no route to the intranet. Stable mode cannot receive fresh overview samples through APNs alone. |
| Dash instead of p95 | The window may contain no requests; do not substitute zero latency. |
| Correct numbers with an old timestamp | Cached fallback or delayed OS refresh, not a fresh response. |
| Wrong project after access changes | Reopen the app, inspect instance/project membership and make a fresh selection. |
| Mac Widget not available or never updates | Verify the signed embedded extension, `/Applications` installation and background-item permission; reinstall via the documented upgrade path rather than overwriting a running extension. |
| Alerts arrive but overview is stale | Alert delivery and HTTP overview refresh are separate paths. |

## Retiring a Widget or account

Removing a Widget from the home screen is not server-session revocation. For a retired account/device, sign out in the app, remove the saved instance as appropriate and revoke compromised sessions through platform session controls. Native cache/reader cleanup prevents further authorized reads, but an image already rendered by the OS can remain until it redraws.

Do not hand-edit cache files to manufacture a recent timestamp. For a compromised device, rotate/revoke credentials at their actual issuer; removing a local catalog is not sufficient.

## Verification basis

Source `03751a67`: `client/src-tauri/src/{widget,widget_reader,widget_refresh,instances}.rs`, `client/src-tauri/gen/apple/ViatWidget/ViatWidget.swift`, `client/scripts/widget-refresh.plist`, and the server overview/auth handlers. Native timing and OS scheduling require device acceptance; this page records source-reviewed limits, not a guaranteed refresh interval or a new live-device test.
