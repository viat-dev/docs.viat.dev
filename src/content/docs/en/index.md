---
title: Viat handbook
description: Start with installation and your first endpoint, then read configuration, resources, scripts, workflows, triggers and operations references.
doc_id: handbook.index
verified_release: '1.1.0'
channel: stable
---

# Viat handbook

Viat turns **resource connections, scripts and workflows** into callable HTTP
endpoints and triggerable scheduled jobs: write a function in the console or
CLI, bind a route, publish once — and it is a live API with authentication,
logs and versioning.

![Project list in the console](/screenshots/en/projects.png)

The screenshot above comes from a local demo instance: after signing in you
land on the project list, and entering a project gives you its scripts,
endpoints and publications. To go from install to a working endpoint in about
ten minutes, start with the first path below.

## Choose a path by goal

| Your goal | Reading path |
| --- | --- |
| Publish a first HTTP endpoint fast | [Docker Compose install](installation/docker-compose.md) → [Activate the instance](instance/activation.md) → [First endpoint](getting-started/first-endpoint.md) |
| Decide whether Viat fits the task | [Platform positioning](overview/platform.md) → [Core concepts](overview/concepts.md) → [Capabilities and limits](overview/capabilities.md) |
| Connect databases, APIs or models from scripts | [Resources overview](assets/resources/index.md) → [Scripts](assets/scripts/python.md) → [Workflows](assets/workflows/overview.md) |
| Run tasks on schedules or events | [Schedules](triggers/schedules.md) → [HTTP triggers](triggers/http.md) → [Queue triggers](triggers/queues.md) |
| Use the mobile or Mac client | [Client installation](installation/clients.md) |
| Automate everything by CLI or MCP | [CLI overview](cli/overview.md) → [MCP overview](mcp/overview.md) |

Configuration, assets, triggers, operations and worked applications appear in
the sidebar by topic. Unfinished content is never disguised as a usable
reference by empty placeholder pages; full coverage remains a release gate
during reconstruction.

## Three concepts to settle first

1. **Platform accounts and project roles are different things.** Platform
   accounts sign in to the console and CLI; per-project
   `owner`/`admin`/`developer` roles decide which projects you may edit and
   publish. See [core concepts](overview/concepts.md).
2. **Editing a draft is not publishing.** External callers always hit the
   **published snapshot**; changes go live only after you publish again.
3. **Server and client versions are independent.** This handbook pins
   server/CLI **1.1.0**; the native client is versioned separately. Preview
   features are marked as such — unreleased capabilities are never stated as
   installation prerequisites.

> [!NOTE]
> For LLMs and automation tools: start from [`llms.txt`](/llms.txt); every
> page carries a **Raw Markdown** link, so you never need to parse site HTML.
> Confirm the instance, project and identity before acting; never guess
> commands or blindly accept publish warnings.

## This site and the offline book

The Chinese and English pages here share document IDs, contracts and example
sources. The same content is exported as a version-pinned offline book that
keeps the `/_docs/` deployment path for intranets. The newest online page
never overrides what an older deployment actually does; on any difference,
trust the reference and verified limits of your deployed version.
