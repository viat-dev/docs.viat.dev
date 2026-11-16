---
title: Widgets and overview freshness
description: Understand the stable HTTP overview reader, displayed metrics, refresh timing, intranet limits and credential cleanup.
doc_id: clients.widgets
verified_release: '1.1.0'
channel: stable
---

# Widgets and overview freshness

A Viat Widget displays a compact **platform/project operational
overview** — not an arbitrary application dashboard, not a lab-job
viewer, not an always-running monitoring agent, and not a channel for
executing scripts. This page covers the stable **0.1 client /
server 1.1.0** HTTP-reader path.

> [!WARNING]
> **The encrypted APNs overview snapshot is not part of this stable
> baseline.** Ordinary APNs alert notifications exist, but receiving an
> alert does not deliver the unreleased snapshot capability; there is
> **no** "API/push" widget data-source selector to find in the stable
> client.

## Prerequisites and first setup

1. Install the correctly signed app and embedded Widget extension per
   [client installation](../installation/clients.md); on the Mac use
   the **installed** app, not a copy run from a mounted DMG.
2. Open Viat, add the instance, sign in as a platform user and select a
   project you belong to.
3. Let Home successfully load the overview and verify instance/project/
   timestamps **before** adding the system Widget.
4. Add Viat through the OS Widget UI; if an instance picker appears,
   choose the target saved instance — the project comes from that
   instance's in-app selection, **not** an independent custom
   business-query editor.
5. Compare the Widget's and Home's labels, time windows and timestamps:
   cached values can be older than the current screen.

The device and the Widget process must reach the instance over
HTTP(S). Intranet deployments need an authorized network/VPN path —
**never** open an unauthenticated public endpoint just to refresh a
Widget.

## What each field means

| Field | Meaning and limits |
| --- | --- |
| Instance/project labels | The selected saved instance and project; a label change is **not** a new server sample. Names shorten for display. |
| Window | Background reads are fixed at `24h`; foreground Home offers other windows — **never** compare numbers across different windows as one measurement. |
| Requests | Requests counted by the server overview in the window — not business tasks or successful workflow steps. |
| Server errors | Server-error count; the compact payload **deliberately omits** client-error counts. |
| p95 latency | Milliseconds; missing with no requests — a dash is **not** measured zero latency. |
| Failing endpoints | The **count** of the server's failing-endpoint list — not every endpoint that ever failed. |
| Failing schedules | Enabled schedules with non-zero consecutive failures — not total historical failures. |
| Updated time | Sample receipt time, recorded as Unix time and shown as a local relative time; redrawing the cache alone **cannot** advance it. |

With external-cluster business tasks still running, the platform
overview can be perfectly healthy — build a separately authenticated
status API/page for those; **the Widget overview token cannot call**
that business interface.

## Refresh is a scheduled request, not a guarantee

- An Apple Widget requests its next timeline after **15 minutes**, with
  actual timing decided by WidgetKit: background limits, network,
  battery and system policy can all defer it. The reader uses the
  restricted overview credential against
  `GET /projects/{slug}/overview?window=24h`.
- Apple caps network requests at **10 seconds**, but timeline delivery
  waits at most **4 seconds**: whichever shorter deadline hits first,
  the callback returns the cache and **discards the late result** — that
  keeps slow intranet requests from monopolizing the Widget and **does
  not** make the cache live.
- The signed Mac app adds a background-refresh helper/LaunchAgent on a
  **900-second** period; install location and system background-item
  permissions both matter. **Never** register extra ad-hoc refresh
  loops to mask stale data — fix installation, permissions and the
  device-to-server connectivity instead. Android uses its own native
  scheduling; Apple WidgetKit deadlines are **not** Android
  service-level guarantees.
- The refresh cadence is **no availability SLA**: a visible Widget, a
  signed-in app or a once-successful sample proves nothing about current
  reachability — **check the timestamp before acting**.

## Credential boundaries

- A console login issues an **opaque `vso_` overview token** for that
  login. The Widget reader uses this narrowly scoped read-only
  credential, **never** the ordinary access/refresh pair. The server
  permits it only on the **project overview route**, still requiring
  that login's user to belong to the target project; it **cannot**
  list all projects, run scripts, modify resources or call arbitrary
  business APIs.
- The display catalog carries no credentials; the Apple reader's
  separate descriptor holds the token inside the app-shared group (the
  extension cannot use the app's normal credential paths). **Never**
  copy, publish or attach that file to support requests — least
  privilege does not make the token a non-secret.

Read outcomes are deliberately distinguished:

| Outcome | Reader action | User recovery |
| --- | --- | --- |
| Successful valid overview | Accept the new sample | Verify project, window and time |
| `401` | Delete that reader entry | Reopen the app, sign in again for a fresh login |
| `403` | Keep the reader identity, clear the selected-project pointer | Restore membership or select another accessible project in the app |
| Network/timeout/5xx/429 or invalid response | Fall back to cache | Restore network/service health and await the next refresh; **never** reset credentials to mask an outage |

Server-side logout/revocation invalidates that login's reader
credential. The CLI's `auth logout` is a different operation: in 1.1.0
it clears only **local** CLI state and revokes no server session — it
says nothing about retiring the phone Widget's login.

## Troubleshooting without exposing Widget tokens

With an authorized CLI platform session, using a real project slug:

```sh
viat call --console --method GET '/projects/hello-lab/overview?window=24h'
```

The command prints the HTTP status first, then the overview body; check
`project_slug`, `window` and the `traffic` object. This is a
**management-session diagnostic** — not a validation of the Widget's
independent `vso_` token. Query only projects you are entitled to read,
substituting `hello-lab` as needed.

| Symptom | Where to look |
| --- | --- |
| Fine on-site Wi-Fi, stale after leaving | The phone/Widget lacks a route to the intranet; the stable mode **cannot** fetch new overviews via APNs alone |
| p95 shows a dash | The window may have no requests — never substitute zero latency |
| Numbers plausible but timestamp stale | Likely cache fallback or deferred system refresh — not a new response |
| Wrong project after permission changes | Reopen the app, verify instance/membership and reselect |
| Mac Widget missing or never updates | Check the signed embedded extension, `/Applications` install and background-item permissions; reinstall via the upgrade flow — never overwrite a running extension |
| Alert arrived but overview stale | Alert delivery and HTTP overview refresh are **different paths** |

## Retiring Widgets or accounts

Removing the Widget from the desktop **does not revoke** server
sessions. Retiring an account/device: sign out in the app → remove the
instance as needed → revoke leaked sessions via the platform session
controls. Native cache/reader cleanup prevents **future** authorized
reads; images the system already rendered may persist until redrawn.

**Never** hand-edit caches to forge fresh timestamps. On device
compromise, rotate/revoke credentials at the actual issuer — deleting
the local catalog is not remediation.

## Verification basis

Source `03751a67`:
`client/src-tauri/src/{widget,widget_reader,widget_refresh,instances}.rs`,
`client/src-tauri/gen/apple/ViatWidget/ViatWidget.swift`,
`client/scripts/widget-refresh.plist` and the server overview/auth
handlers. Native timing and system scheduling need device acceptance;
this page records source-verified limits, promises no refresh cadence,
and re-ran no device tests.
