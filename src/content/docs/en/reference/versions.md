---
title: Versions, provenance and compatibility
description: Distinguish released server/CLI artifacts, independently versioned clients, inspected source and unreleased features.
doc_id: reference.versions
verified_release: '1.1.0'
channel: stable
---

# Versions, provenance and compatibility

A version string, a Git revision and a built artifact answer different questions. Check all applicable identities before using a command, changing a deployment or interpreting a sample response.

## This edition's baseline

| Surface | Baseline | What it establishes |
| --- | --- | --- |
| Server and CLI | `1.1.0`, release source `fd340879076a87c2662c454788178eecb05d0036` | Published product behavior targeted by stable pages. |
| Inspected main source | `03751a679ed0205505ab9fae5207a66189c47a18` | The source inspected for the documentation contract, including subsequent release-tooling work. Main is not a new published server image. |
| Native client | `0.1.0`, independent version line | App marketing version; not a declaration that its server or bundled CLI is version 0.1.0. Build number, architecture and distribution channel also matter. |
| Documentation | `contracts/manifest.json` | Edition, inspected/released source, contract digests, dirty/candidate state and publication readiness. |
| APNs Widget snapshots | Unreleased preview work, not server 1.1.0 | Must not be used as a stable installation prerequisite or promised intranet refresh path. |

The documentation reconstruction remains a **preview** until its coverage and acceptance gates pass. A page marked `channel: stable` describes released capabilities; that flag does not claim the entire new handbook is already a complete published release. Likewise, `source_dirty: true` and `review_status: candidate` must not be rewritten as a clean reviewed export merely to pass a deployment check.

## Check the installed components

```sh
viat --version
viat version
```

`--version` is local. `version` also attempts to read the signed-in server's authenticated `/version` response. A local success does not establish server connectivity or authentication. The server response is shaped as:

```json
{"version":"1.1.0"}
```

This is an illustrative response for the target release, not a guarantee that your selected instance runs it. `/healthz` deliberately does not expose a version; do not use a successful probe to infer release identity. See [CLI utilities](../cli/utilities.md) for exact output/error behavior.

For a native artifact, retain the supplied release metadata and digest together with the DMG/IPA. Check the app version, build number, architecture/channel and bundled CLI version. An iOS device-development artifact, registered-device distribution and App Store Connect artifact have different signing/install requirements; renaming the file cannot change its channel.

## Compatibility rules

- Use the matching documentation edition for the running server, not whichever website page is newest.
- CLI, `viat-test-host` and `viat-endpoint-test-host` must match for local test-host protocols. Installing the CLI alone does not install Python, Bun or a Rust build toolchain.
- Resource schemas describe shape, not every conditional API rule. A type accepted in current source is not evidence that an older running server supports it.
- Management API/console types and project-endpoint OpenAPI are different contracts. Generated endpoint OpenAPI does not document the whole management API.
- A source checkout with Cargo version 1.1.0 can contain unpublished changes. Verify its commit and artifact provenance before treating new behavior as available.
- A published endpoint snapshot freezes endpoint/target state, not every external dependency or credential. Workflow-step `uses:` resolution has a live dependency exception; read [Concepts](../overview/concepts.md).
- Rebuilding or rolling back an endpoint does not roll back database migrations, external systems, resource credentials or shared live dependencies.

## Updating contracts and documentation

Maintainers export contracts from an explicitly chosen product checkout, import them as candidate inputs, review changes, update both languages and rerun examples. Resources, language inventory, CLI leaves and MCP tools have coverage checks; the checks do not replace behavioral review or provider/device acceptance.

The raw Markdown link on each page carries the same version/channel metadata. Stable LLM indexes exclude preview-capability pages. The offline book is generated from the same Markdown and must be pinned to an accepted documentation artifact before replacing a shipped product book. It is not a live fetch from the latest website.

## When versions disagree

| Observation | Action |
| --- | --- |
| CLI is newer than server | Consult that server's edition and verify each needed command/API; do not assume backwards compatibility for new fields. |
| A local test host reports another version | Replace it with the CLI's matching host; do not bypass the handshake. |
| Native app works but a feature is missing | Check platform, build/channel and server capability; app marketing version alone is insufficient. |
| Main contains a feature absent from the release | Keep it preview-only until a matching artifact ships. |
| Docs build succeeds but release check fails | Read missing coverage/evidence; a successful preview is not authorization to mark the manifest ready. |

This page records provenance, not an upgrade execution. Follow [installation](../installation/docker-compose.md), back up deployment state and validate a restore before a real upgrade. Do not alter DNS, publish an artifact or replace a running service solely because a documentation example mentions a newer revision.
