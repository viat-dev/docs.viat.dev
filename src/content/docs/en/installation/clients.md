---
title: Install and connect clients
description: Install an available signed Apple client, expose its bundled CLI, and connect to an existing Viat instance without confusing artifact availability with source support.
doc_id: installation.clients
verified_release: '1.1.0'
channel: stable
---

# Install and connect clients

The native app's version is **0.1.0**, independent of **server/CLI
1.1.0**. This page covers the installation prerequisites and client
behavior represented by contract source `03751a67`. Locally producing a
DMG/IPA does **not** establish a public download channel, an App Store
listing or an open TestFlight invitation — obtain an authorized artifact
and its checksums through the distribution arrangement that actually
exists; this handbook cannot supply an unpublished download URL.

The official server image already bundles the browser console — creating
your first endpoint needs **no** native client.

## Requirements and access conditions

- A reachable instance URL and a **platform account** (not project
  end-user/API-key credentials); viewing project status needs project
  membership — platform Owners/Admins are **not** automatically in every
  project.
- Mac: **Apple Silicon, macOS 13.0+**, and the platform-appropriate
  signed, notarized DMG; this release pipeline promises **no**
  Intel/universal Mac artifact.
- iPhone/iPad: an appropriately signed **physical-device** distribution
  artifact; development/registered-device exports require the device to
  be authorized by the provisioning profile — not every iPhone installs
  a development IPA.
- The **device itself** must reach the instance; remote use needs
  trusted HTTPS certificates; normal project operations need an
  activated server.
- This page promises **no** stable native Windows/Linux distribution;
  Android development integration existing in source ≠ a documented
  public stable Android download.

## 1. Verify artifacts before installing

When the distributor provides a verified release directory, keep the
artifacts together with `SHA256SUMS` and `release.json`; `release.json`
records app/build versions, architecture, channel, source commit,
bundled CLI version and artifact digests — confirm they match your
expected platform and channel.

From the directory holding the manifest and files:

```sh
shasum -a 256 -c SHA256SUMS
```

Every listed artifact should read `OK`. Checksums detect byte mismatches
but **authenticate no distributor** — verify through the trusted
artifact channel; **never** disable Gatekeeper for unknown packages or
install profiles of unknown origin.

## 2. Install or upgrade on Mac

1. Mount the authorized DMG.
2. **First install**: drag `Viat.app` to `/Applications` — the location
   matters for the bundled refresh agent.
3. **Upgrade**: quit the existing Viat GUI first, then run the DMG's
   `Install or Upgrade.command`; **never** overwrite a running
   app/Widget directly. The explicit installer needs Python 3.
4. Open `/Applications/Viat.app` through the normal macOS verification
   flow. Release artifacts should be signed and notarized; if refused,
   investigate — **never** blanket-bypass system security.

The upgrader: verifies the replacement package → refuses to kill a
running GUI → stops only the installed Widget's exact executables →
replaces and registers the whole app bundle. If the old Widget cannot
quit, the existing installation stays untouched; a failed replacement
attempts to restore the old app, and a failed restore reports the
backup location. Merely mounting the DMG installs nothing and kills no
process.

App and Widget need macOS 13+; the in-place instance switch uses
`Button(intent:)` requiring **macOS 14+** — earlier supported systems
get the open-the-app fallback. Installing the app **guarantees no**
fixed background-refresh cadence.

### Enable the bundled CLI

After installing the app:

```sh
bash "/Applications/Viat.app/Contents/Resources/install-cli.sh"
export PATH="$HOME/.local/bin:$PATH"
command -v viat
viat --version
```

- The tool creates `viat`, `viat-test-host` and `viat-endpoint-test-host`
  symlinks in `~/.local/bin` and modifies **no** shell configuration;
  add the directory to your regular `PATH` config for persistence.
  Existing files are refused by default — explicit `--force` replaces;
  directories are never replaced; `VIAT_CLI_INSTALL_DIR` selects another
  target.
- A matching artifact reports `viat 1.1.0` — **not** the app's `0.1.0`.
  The links point inside the installed app: moving/removing the app
  affects the commands. Local Python/TypeScript tests still need
  separate `uv`/`bun`; the bundled CLI carries no full local-test
  prerequisites.

## 3. Install iOS through the actual distribution channel

Use only the channel matching your signed artifact. The release tooling
distinguishes:

| Export | Meaning |
| --- | --- |
| `app-store-connect` | Artifacts for App Store Connect/TestFlight submission; generating the IPA **uploads/publishes nothing** |
| `release-testing` | Registered-device distribution, **not** a TestFlight invitation |
| `debugging` | Development-signed physical builds using the matching development profile and authorized devices |

App and Widget need compatible, unexpired profiles and signing
identities; registered-device distribution requires a shared authorized
device set. **Never** publish device identifiers, personal signing
identities, profiles or certificates in issue reports; on install
refusals, have the artifact maintainer check profile coverage.

This stable manual does **not** advertise the pinned iOS release helper
as an out-of-the-box development-build recipe: later fixes are not in
the contract baseline. Installing a verified artifact ≠ rebuilding and
re-signing one. The development simulator is also not signed
physical-device testing — simulator sessions live in memory and prove
**no** Keychain persistence or push delivery.

## 4. Add an instance and sign in

1. On the login page open the instance switcher and add/edit a named
   instance by its **base URL** (e.g. `https://api.example.com`);
   include any deployment mount prefix but **never** `/ui/` or
   `/p/<slug>`.
2. For remote instances, confirm the device can connect and trusts the
   URL — `localhost` on the phone means the **phone itself**, not the
   server or the Mac.
3. Sign in with platform email/password or an operations-configured
   platform SSO provider.
4. Complete MFA when enabled; if enrollment is required first, follow
   the console security/enrollment prompt — **do not** retry passwords
   in a loop.
5. Pick a project you belong to — Home's instance/project title and
   Settings → Project share the same selection.
6. Refresh Home for recent requests and runs — **an empty result is not
   a read failure**; zero traffic must not render as a connection error.

Each instance keeps its own session and project selection. Switching
instances stops old log subscriptions and clears bound-identity
assistant context; editing an instance URL **clears old credentials and
projects first** — never silently sending old credentials to another
server; the last instance can be edited but not deleted.

## Status and Widget expectations

- The client supports project overviews, recent runs, logs and selected
  operations (credential rotation) — it is **not** the console's full
  editor set. The cached Widget keeps the data's **original update
  time**; switching the selected instance fetches nothing new; the
  stable Apple-platform reader uses per-login, read-only `vso_` tokens
  for project overviews. Actual refresh timing follows OS timelines and
  background budgets.
- A device outside the instance network **cannot** be assumed to read
  private APIs. The **unreleased encrypted APNs overview snapshot is
  not a stable solution** — this installation flow includes no direct
  APNs cryptography configuration; a signed IPA with a valid profile
  still **proves no** physical-device push delivery.

## Troubleshooting and cleanup

| Problem | Check |
| --- | --- |
| Mac tool refuses to replace files | Inspect the existing commands; use `--force` only for deliberate overwrites |
| Mac upgrade refuses | Quit the GUI; handle the specific Widget/backup error — never overwrite a running bundle |
| iOS install fails | Distribution method, device authorization, profile expiry, app/Widget signature compatibility |
| Signed in but no projects | Instance, account and project membership |
| `401` / MFA refusal | Re-authenticate or enroll; for TOTP check phone and server clocks |
| `403 license_required` | A platform Admin/Owner must [activate the instance](../instance/activation.md) |
| Stale Widget timestamps | Device network, selected instance/project, session and system scheduling — do not infer zero traffic |
| Secure-storage/Widget cache errors | Report the specific operation; an unreadable store is not an empty account store |

Sign out before handling a shared device. Removing an instance clears
local credentials and associated selections/caches; the app **verifies
credential cleanup** before mutating the instance registry; already
rendered system Widget images may persist until the OS redraws.
Deleting the Mac app deletes **no** server, project or platform account
and cannot be assumed to wipe Keychain items. When uninstalling the
bundled tooling, remove only the CLI symlinks you created — never
unrelated commands.

## Verification basis

Contract source `03751a67`: `client/README.md`, `client/package.json`,
`client/src-tauri/tauri.conf.json`,
`client/scripts/{install-bundled-cli.sh,release_client.py,embed-macos-widget.sh}`,
`crates/viat-client`. Whether artifacts are publicly released is a
distribution fact, not inferable from code capability.
