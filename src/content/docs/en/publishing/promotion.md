---
title: "Promoting a project between environments"
description: "Move reviewed draft definitions with repo sync or packages, provision target secrets, test and publish deliberately."
doc_id: publishing.promotion
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.export", "cli.import", "cli.push", "cli.pull", "cli.publish.apply"]
---

# Promoting a project between environments

Viat 1.1.0 has **no native promote command, named environment pipeline, or API that copies an immutable endpoint snapshot to another instance**. Promotion means moving reviewed **draft definitions** with repo sync or export/import, provisioning destination-only settings/secrets/data, then publishing there. Server release and CLI/client version are independent; use matching stable contracts and test-host versions. An export is neither a snapshot-history archive nor a backup of upstream databases/files.

This page is an operational recipe derived from source, **not executed**. No project was created, package extracted, credentials moved, tests/builds or network/provider calls performed. Obtain approval for remote writes, migration, tests with real resources, publishing and cleanup before running the corresponding steps.

## Permissions and prerequisites

- Source: platform login and project membership for ordinary reads; full exports can need editor-gated reads such as queue/WS-trigger definitions. Do not promise Operator can export every object.
- Destination: platform login, ability to create a project if new; content-edit rights for existing assets, Owner/Admin for owner-level project/auth settings and publication. Import is multi-stage, not an all-or-nothing remote transaction.
- A complete reviewed source checkout or trusted `.viatpkg`, an explicit destination slug/server/session, isolated staging resources, compatible schema/data/migrations, required language runtimes/toolchains and external credential provisioning.
- Secure local working directory. Protect `.viat` session tokens, packages, sources/plain resource config and any manually provisioned secrets. Export placeholders are **not credentials**.

## What travels and what does not

| Surface | Promotion behavior |
| --- | --- |
| scripts/workflows/endpoints/trees | Draft definitions; folder names are identity. Active snapshot versions/revision history are not transported. |
| resources | Public/plain config and secret placeholders, not reusable secret values. Source hostnames may be unsuitable at destination. |
| schedules/watches/queue_triggers/ws_triggers | Repo-backed live config; creating/enabling can start activity **before endpoint publication**. Review enabled flags, roots, broker/feed destinations and defaults first. |
| IM | `im/accounts` resource-backed accounts, `im/triggers` and groups in their supported shapes sync under chat. Inline/QR credential accounts are skipped by pull and protected from mirror deletion; re-provision/bind at destination with consent. A copied trigger may refer to a nonportable account. |
| authorization/repo metadata | Only fields represented by viat.yaml/repo model; not every console setting/client identity. Model version/destructive changes have their own guard/approval. |
| runtime artifacts/data | Not general upstream DB rows, managed-file bytes, execution history, end-user credentials, device registrations, provider bot binding, external queued messages, arbitrary local watch files or server deployment configuration. Plan separately. |
| tests | Local tests/cassettes can travel in your source checkout; do not assume export/import carries every local non-repo fixture or server saved regression case. Verify saved cases explicitly at destination. |

`pull` reads remote **drafts**, not published content. If the goal is “what is live now”, reconcile source draft-vs-snapshot first; otherwise a perfectly successful export can deploy unpublished work. Ordinary frozen script uses can be reviewed as a closure, while workflow step uses stay live including nested workflows; see [snapshot boundaries](snapshots.md).

## Package route: create and import

Syntax examples use synthetic names and are unexecuted:

```sh
viat export source-demo --output source-demo.viatpkg
viat import source-demo.viatpkg --as staging-demo
```

Export freshly pulls the selected/positional source into temporary staging, creates gzip-tar `.viatpkg`, cleans staging. `--output` default is `./<slug>.viatpkg`; existing file can be overwritten. `--only` selects supported kinds (repeat/comma-separated per CLI), not a dependency solver. Keep bundles private even without secrets.

Import accepts required package FILE, optional `--as <slug>` (otherwise bundle slug), `--only`, `--prune:false`, `--update-resources:false`. It creates missing project or upserts into existing one, **does not select it in your CLI**, and does **not publish or run DB migrations**. Confirm server/login before invocation; current selected project is not a replacement for `--as`.

Resource import is intentionally conservative:

- New secret-bearing resources without secrets are skipped and reported; fill destination credentials safely, then re-evaluate definitions.
- Existing secret-bearing resources are kept **entirely** by default, not just their secret fields, so source host/port cannot silently redirect destination credentials.
- `--update-resources` opts into changing their imported settings; it does not magically obtain missing credentials. Review resulting destination addresses before use.
- Skipped/kept-resource summaries do **not** automatically make import exit nonzero. A green import can still leave dependencies missing or old.
- `--prune` explicitly deletes represented remote-only items; default import is non-destructive upsert. It is not equivalent to ordinary mirror push.

Output is progress/imported-project/pending-publish/skipped-secret/kept-resource summaries, **not** a publish result. Import has no dedicated `--json` success shape. Failure may occur after earlier remote writes; inspect completed stages and current state before retrying. There is no single undo token or transactional cancellation for a partially applied import.

## Repo route and destructive boundaries

A source checkout includes `viat.yaml`, scripts/workflows/resources, `endpoints/<tree>/`, schedules/watches/queue_triggers/ws_triggers, IM directories, crate sources and supported migrations. Use dedicated per-environment session/config directories and verify selected project/server before `viat pull`, `viat project diff` or `viat push`. Session discovery does not change CWD. Never pull into an unreviewed dirty working tree expecting it to preserve all local work.

Ordinary push is not uniformly non-destructive: scripts/workflows/resources normally upsert, while endpoint/trigger/meta mirrors can delete missing remote config; authz migrations/model guards and system-asset exclusions add their own rules. A partial `--only`/partial checkout is not automatically safe. `$secret` export marker is stripped, `$keep` is top-level preservation of an existing plain value, and supported `$secret:` resource references are a different mechanism; none supplies a missing destination credential. See [complete sync reference](../cli/sync.md).

Do not invent standalone commands for watch/queue/WS/IM trigger kinds: repo sync/API is their supported automation surface. Keep enabled false in **live trigger** definitions until target resources, broker DLQ/ack timeouts, watch roots and provider identities are verified. Scanned account protection does not make its copied trigger safe to enable elsewhere.

## Test, publish and recover

1. Review imported state/diff, fill missing destination resources and credentials, refresh schema, apply explicitly reviewed DB/authz migrations using their supported commands. Migration execution is separate from import/push; back up data and check compatibility with rollback targets.
2. Run local fake-resource suites/endpoint fixtures only after opting into the necessary local DB/toolchain actions. Confirm real-resource saved cases are isolated before invoking the server gate. Offline fixture publishing acknowledges warnings/test failures internally and is not proof gates passed.
3. Select the **destination** project explicitly before publication. `viat publish plan --json` describes dirty leaves, not a reservation. Review every warning; do not copy blanket acknowledgements from test-host setup.
4. With publish approval, `viat publish apply --require-tests --yes --json` adds the local script suite, then applies remote gates. It does not automatically run endpoint fixtures; accepted pending/failed build results can still exit 0. Inspect build/env and actual authorized public routes.
5. Enable live triggers deliberately, one class at a time; verify identity, inputs, order/retry/idempotency expectations and downstream observations. A provider-accepted send is not a receipt.

Publish response/API fields and gate differences are fully specified in [snapshots](snapshots.md). A read-only project state call is not evidence that endpoint callers have correct permissions. If import/push fails, compare actual destination rows before retrying. If traffic is wrong, unpublish or [rollback](rollback.md) with approval, noting rollback cannot restore overwritten resources/data/live modules or recall trigger effects. Retrying a package import/publish is not exactly-once orchestration; duplicate external effects need business keys.

For cleanup pause live schedules/disable watches/queues/WS/IM, account for in-flight tasks/connections/unacked broker deliveries, revoke invitations/test credentials, unpublish disposable endpoints, then delete isolated project/config/data only with approval. Deleting a package/local directory does not clean a remote environment. Retain audit/revision evidence and remove only your synthetic local bundle/staging artifacts; do not prune production to make a demo checkout match.

Evidence: `crates/viat-cli/src/commands/sync.rs` and export/import implementation, `repo/{resources,endpoints,schedules,watches,queue_triggers,ws_triggers,im}.rs`; `crates/viat-api/src/handlers/{publish,snapshots}.rs`. This task did not validate a real cross-instance migration or provider reconnect; those remain deployment acceptance work.
