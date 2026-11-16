---
title: Versions, provenance and compatibility
description: Distinguish released server/CLI artifacts, independently versioned clients, inspected source and unreleased features.
doc_id: reference.versions
verified_release: '1.1.0'
channel: stable
---

# Versions, provenance and compatibility

A version string, a Git revision and a built artifact answer **different
questions**. Check every applicable identity before using a command,
changing a deployment or interpreting a sample response — never a
single version string.

## This manual's baselines

| Surface | Baseline | What it tells you |
| --- | --- | --- |
| Server and CLI | `1.1.0`, release source `fd340879076a87c2662c454788178eecb05d0036` | The **released** product behavior stable pages target |
| Verified main source | `03751a679ed0205505ab9fae5207a66189c47a18` | The source the documentation contracts were verified against (including later release tooling); main is **not** another released server image |
| Native client | `0.1.0`, an independent version line | The app's marketing version — **not** a claim that the server or bundled CLI is 0.1.0; build number, architecture and distribution channel matter too |
| Documentation | `contracts/manifest.json` | Manual version, verified/release sources, contract digests, dirty/candidate state and publication readiness |
| APNs Widget snapshot | Unreleased preview work outside server 1.1.0 | **Cannot** be a stable installation prerequisite or a promised stable intranet refresh path |

Until coverage and acceptance gates pass, the new manual remains a
**reconstruction preview**. A page marked `channel: stable` describes
released capability — it **does not mean** the whole new manual is
formally released. Likewise, `source_dirty: true` and
`review_status: candidate` are **never** flipped to clean-and-reviewed
merely to pass a deployment check.

## Checking installed components

```sh
viat --version
viat version
```

- `--version` inspects only the local binary; `version` additionally
  reads the signed-in server's authenticated `/version`. Local success
  **proves no** server network/auth validity. The server response
  shape:

```json
{"version":"1.1.0"}
```

  An illustration of the target release — **not** a guarantee the
  currently selected instance runs it. `/healthz` deliberately exposes
  no version: probe success **infers no** release identity. Exact
  output and error behavior: [CLI general commands](../cli/utilities.md).
- Native artifacts should be kept together with their release metadata
  and digests; verify the app version, build number,
  architecture/channel and bundled CLI version. iOS development-device,
  registered-device and App Store Connect artifacts have different
  signature/installation requirements — **renaming a file changes no
  distribution channel**.

## Compatibility rules

- Use the manual version matching the **running server**, not merely
  the newest website pages.
- The local test-host protocol requires the CLI, `viat-test-host` and
  `viat-endpoint-test-host` to **match each other**; installing the CLI
  alone installs no Python, Bun or Rust build toolchain.
- Resource schemas describe structure and **do not cover** every
  conditional API rule; current source supporting a kind does not mean
  an older running server does.
- Management API/console types and project endpoint OpenAPI are
  **different contracts**; the generated endpoint OpenAPI does not
  describe the whole management API.
- A checkout whose Cargo version still reads 1.1.0 may already contain
  unreleased changes — verify commits and artifact provenance before
  relying on new behavior.
- An endpoint snapshot pins endpoint/target state and **pins no**
  external dependencies or credentials; workflow-step `uses:` keeps its
  live-resolution exception, see [core concepts](../overview/concepts.md).
- Rebuilding or rolling back an endpoint **rolls back no** database
  migrations, external systems, resource credentials or shared live
  dependencies.

## Updating contracts and documentation

Maintainers export contracts from a deliberately chosen product
checkout, import as candidate → review diffs → synchronize both
languages → rerun the examples. Resources, language inventories, CLI
leaf commands and MCP tools have coverage checks — but checks
**replace neither** behavioral review nor provider/device acceptance.

Every page's raw Markdown carries the same version/channel information;
the stable LLM index excludes preview-capability pages. The offline book
is generated from the same Markdown; before replacing the product's
bundled book it must be pinned to accepted documentation artifacts —
**never** fetched from the newest website at startup.

## When versions disagree

| Symptom | Action |
| --- | --- |
| CLI newer than the server | Read the **server's** matching manual and verify the commands/APIs you need; assume no backward compatibility of new fields |
| Local test host reports another version | Swap in the CLI-matching host — never bypass the handshake |
| Native app works but a feature is missing | Verify platform, build/channel and server capability; the app's marketing version is insufficient |
| main has a feature, release artifacts do not | Keep it **preview** until matching artifacts actually ship |
| Documentation build succeeds but the release check fails | Inspect coverage/evidence gaps; a successful preview is no reason to mark the manifest ready |

This page records provenance and **performs no upgrades**. Before a
real upgrade, back up deployment state and verify recovery per the
[installation instructions](../installation/docker-compose.md).
**Never** change DNS, release artifacts or replace a running server
merely because a documentation example mentions a newer commit.
