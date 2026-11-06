---
title: Viat product handbook
description: Start with installation and a working endpoint, then consult Viat configuration, resources, scripts, workflows, triggers and operational references.
doc_id: handbook.index
verified_release: '1.1.0'
channel: stable
---

Viat organizes resource connections, scripts and workflows into callable interfaces and triggered tasks. This handbook serves operators, project developers, and automation using CLI/MCP. Prerequisites, permissions and failure boundaries are as important as the happy-path steps.

## Start with a verifiable outcome

| Your goal | Reading path |
| --- | --- |
| Decide whether Viat fits a task | [Platform positioning](overview/platform.md) → [Concepts and objects](overview/concepts.md) → [Capabilities and limits](overview/capabilities.md) |
| Set up an instance | [Docker Compose installation](installation/docker-compose.md) → [Activation prerequisites](instance/activation.md) → [Platform users](instance/platform-users.md) |
| Create a callable interface | [Projects and collaboration](projects/create-and-collaborate.md) → [Your first endpoint](getting-started/first-endpoint.md) |
| Use a bare binary or build from source | [Binary and source deployment](installation/binary-source.md) |
| Use the phone or Mac client | [Client installation and compatibility](installation/clients.md) |

Configuration, assets, triggers, CLI, MCP, operations and applications appear by subject in the sidebar. Unfinished material is not disguised as usable reference through empty placeholder pages; complete coverage remains a publication gate during reconstruction.

## Establish version and scope first

This edition uses **Server/CLI 1.1.0** as its baseline; native client versions are independent. Main, development branches and published images need not have identical capabilities. Preview features are labeled separately: unreleased encrypted APNs widget snapshots, for example, are not a 1.1.0 installation prerequisite.

Platform accounts manage Viat; project end users, API keys and authorizers govern calls to business interfaces. Creating an account, joining a project and granting business permissions are separate steps, not substitutes for one another.

## For LLMs and automation

Enter through [`llms.txt`](/llms.txt), then read the relevant versioned pages, parameter tables and complete examples. Each page's **Raw Markdown** link avoids HTML extraction. Structured contracts preserve actual commands, input schemas and provenance; they do not replace runtime behavior or authorization documentation.

Do not guess commands or blindly acknowledge publication warnings. Confirm the instance, project and identity, inspect existing state, then test, change and publish. Enable real external messages, model calls and device actions explicitly. Cleanup must affect only example objects you created.

## Online and offline documentation

Chinese and English pages share document IDs, contracts and example sources. The same content is also exported as a release-pinned offline book, preserving `/_docs/` for intranet deployments. The latest online page must not redefine an older deployment's behavior; use the matching edition and its verified limitations when they differ.
