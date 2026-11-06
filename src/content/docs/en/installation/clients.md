---
title: Install and connect clients
description: Install an available signed Apple client, expose its bundled CLI, and connect to an existing Viat instance without confusing artifact availability with source support.
doc_id: installation.clients
verified_release: '1.1.0'
channel: stable
---

# Install and connect clients

The native app's version is **0.1.0**, independent of **server/CLI 1.1.0**. This page describes installation prerequisites and the client behavior represented by contract source `03751a67`. Locally produced DMG/IPA artifacts do **not** establish a public download channel, an App Store listing, or an open TestFlight invitation. Obtain an authorized artifact and its checksums through the distribution arrangement actually available to you; this handbook cannot supply a download URL that has not been published.

The browser console already comes with the official server image. You do not need a native client to create your first endpoint.

## Requirements and access

- A reachable instance URL and a **platform account**, not a project end-user/API-key credential.
- Project membership to see project status. A platform Owner/Admin is not automatically a member of all projects.
- For Mac: **Apple Silicon, macOS 13.0 or later**, and the signed/notarized DMG intended for that platform. Intel/universal Mac artifacts are not promised by this release path.
- For iPhone/iPad: an appropriately signed **device** distribution. Development and registered-device exports require the device to be authorized by the provisioning profiles. An arbitrary iPhone cannot install a development IPA merely because it has the file.
- Network reachability from the **device**, trusted HTTPS certificates for remote use, and an activated server for normal project operations.

No native Windows/Linux stable release is promised here. Android development integration exists in source, but a development build is not a documented public stable Android download.

## 1. Check the artifact before installation

Keep the artifact, `SHA256SUMS`, and `release.json` together when your distributor provides the verified release directory. `release.json` records app/build version, architecture, channel, source commit, bundled CLI version, and artifact digest. Confirm that it matches the platform and channel you intended.

In the directory containing the manifest and named files:

```sh
shasum -a 256 -c SHA256SUMS
```

Expected outcome: each listed artifact verifies as `OK`. A checksum detects mismatched bytes; it does not by itself authenticate a distributor. Verify through your trusted artifact channel, and do not disable Gatekeeper or install an unexplained profile to work around an unknown package.

## 2. Install or upgrade on Mac

1. Mount the authorized DMG.
2. For a **first installation**, drag `Viat.app` to `/Applications`. The installed location matters to the bundled refresh agent.
3. For an **upgrade**, quit the existing Viat GUI first. Run the DMG's `Install or Upgrade.command` instead of dragging over a live app/widget. This explicit installer requires Python 3.
4. Open `/Applications/Viat.app` and allow the normal macOS verification flow. A release artifact is signed/notarized; a refusal deserves investigation rather than a blanket security bypass.

The upgrade helper verifies the replacement, refuses to terminate a running GUI, stops only the exact installed widget executable, replaces the bundle, and registers it. If the old widget cannot exit, it leaves the app unchanged. A failed swap attempts to restore the old app and reports a preserved backup if restoration itself fails. Merely mounting the DMG does not install anything or kill processes.

The app and widget require macOS 13+. In-place Widget cycling uses `Button(intent:)` on **macOS 14+**; earlier supported systems use an open-app fallback. Installing the app is not a guarantee of a fixed background-refresh interval.

### Expose the bundled CLI

After installing the app:

```sh
bash "/Applications/Viat.app/Contents/Resources/install-cli.sh"
export PATH="$HOME/.local/bin:$PATH"
command -v viat
viat --version
```

The helper creates symlinks for `viat`, `viat-test-host`, and `viat-endpoint-test-host` in `~/.local/bin`; it does not modify shell profiles. Add that directory to your shell's normal `PATH` setup if you want persistence across terminals. Existing files are refused unless you deliberately use `--force`; directories are never replaced. `VIAT_CLI_INSTALL_DIR` can select another destination directory.

For the matching artifact, expect `viat 1.1.0`, not the app's `0.1.0`. The links point into the installed app, so moving/removing it affects the commands. Local Python/TypeScript tests still need separately installed `uv`/`bun`; the bundled CLI does not bundle every local test prerequisite.

## 3. Install on iOS through the actual distribution channel

Use only the distribution channel supplied with your signed artifact. The release tooling distinguishes:

| Export method | Meaning |
| --- | --- |
| `app-store-connect` | Artifact intended for App Store Connect/TestFlight submission; producing the IPA does **not** upload or publish it |
| `release-testing` | Registered-device distribution, not a TestFlight invitation |
| `debugging` | Development-signed device build with matching development profiles and authorized devices |

The app and widget need compatible, unexpired profiles and signing identities; registered-device distributions need a shared authorized device set. Do not publish device identifiers, personal signing identities, profiles, or certificates in issue reports. Ask the artifact maintainer to verify profile coverage when installation is refused.

This stable handbook does not advertise the pinned iOS release helper as a turnkey developer build recipe: later fixes to that helper were not merged into the contract baseline. Installing an already verified artifact and building/signing a new artifact are different tasks. A development simulator is not a signed physical-device test; its sessions are memory-backed and do not prove Keychain persistence or push delivery.

## 4. Add the instance and sign in

1. Open the instance switcher on the login screen and add/edit a named instance using its **base URL**, for example `https://api.example.com`. Include a deployment mount prefix if there is one; omit `/ui/` and `/p/<slug>`.
2. For remote instances, verify that the device can reach and trust that URL. `localhost` on a phone means the phone, not your server or Mac.
3. Sign in with the platform email/password, or choose a platform SSO provider actually configured by your operator.
4. Complete MFA if enrolled. If mandatory enrollment is required, use the console's security/enrollment flow as directed; do not retry the password endlessly.
5. Select a project you belong to. The Home instance/project header and Settings → Project share the same selection.
6. Refresh Home and inspect recent requests/runs. Empty results are different from a failed fetch; no traffic should not be presented as a connection error.

Each instance keeps a separate session and project choice. Switching instances stops the old log tail and clears identity-bound assistant context. Editing an instance URL clears the old credentials/project first rather than silently forwarding them to a different server. The last instance can be edited but not deleted.

## Status and Widget expectations

The client supports project overview, recent runs, logs, and selected operations such as credential rotation. It is not every console editor in native form. A cached Widget retains the data's original update timestamp; cycling an instance selection does not itself fetch fresh data. On Apple platforms the stable reader can fetch project overview with a per-login, read-only `vso_` token. OS timelines/background budgets control when refresh actually happens.

A device outside the instance's network cannot be assumed to read its private API. **Unreleased encrypted APNs overview snapshots are not a stable workaround**, and no direct APNs crypto setup is part of these installation instructions. A signed IPA and valid profiles also do not prove real-device push delivery.

## Troubleshooting and cleanup

| Problem | Check |
| --- | --- |
| Mac helper refuses to replace a file | Inspect the existing command first; use `--force` only when intentional |
| Mac upgrade refuses | Quit the GUI; follow its precise widget/backup error rather than overwriting a running bundle |
| iOS installation fails | Distribution method, device authorization, profile expiry, app/widget signing compatibility |
| Login succeeds but projects are empty | Correct instance/account and project membership |
| `401` / MFA refusal | Re-authenticate or complete enrollment; check phone/server clocks for TOTP |
| `403 license_required` | A platform Admin/Owner must [activate the instance](../instance/activation.md) |
| Old Widget timestamp | Device network, selected instance/project, session, and OS scheduling—not invented zero traffic |
| Secure-store or Widget-cache error | Report the exact operation; unreadable storage must not be treated as an empty account store |

Sign out before disposing of a shared device. Removing an instance clears its local credentials and related selection/cache state; the app verifies credential cleanup before changing the registry. An already-rendered system Widget image may remain until the OS redraws. Removing the Mac app does not delete the server, projects, or platform account, and should not be assumed to erase Keychain entries. Remove only the CLI symlinks you created if uninstalling the bundled tools; do not delete unrelated commands.

## Verification basis

Contract source `03751a67`: `client/README.md`, `client/package.json`, `client/src-tauri/tauri.conf.json`, `client/scripts/{install-bundled-cli.sh,release_client.py,embed-macos-widget.sh}`, and `crates/viat-client`. Artifact publication availability remains a distribution question, not an inferred code capability.
