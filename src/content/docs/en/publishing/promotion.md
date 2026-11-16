---
title: "Promoting a project between environments"
description: "Move reviewed draft definitions with repo sync or packages, provision target secrets, test and publish deliberately."
doc_id: publishing.promotion
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.export", "cli.import", "cli.push", "cli.pull", "cli.publish.apply"]
---

# Promoting a project between environments

Moving a Viat project from one instance to another (dev → staging → production)
means: **move the reviewed draft definitions**, provision settings/secrets/data
on the target, then publish there.

Three facts shape everything below:

1. 1.1.0 has **no native promote command, no named-environment pipeline, and
   no API that copies an immutable endpoint snapshot to another instance**.
   "Promotion" is draft migration via repo sync or export/import.
2. Server release and CLI/client versions are independent; the target needs
   matching stable contracts and test-host versions.
3. An export is neither a snapshot-history archive nor a backup of upstream
   databases/files.

> [!WARNING]
> This recipe is source-derived and **not executed**: no project was created,
> no package extracted, no credentials moved, no tests/builds or
   network/provider calls performed. Obtain explicit approval before remote
   writes, migrations, tests with real resources, publishing or cleanup.

## Permissions and prerequisites

- **Source**: ordinary reads need a platform login and project membership; a
  complete export may additionally need editor-gated reads such as
  queue/WS-trigger objects — Operator-level export of everything is not
  guaranteed.
- **Target**: a platform login plus the ability to create a new project;
  changing existing assets needs content-edit rights, and project/auth
  high-privilege settings plus publishing need Owner/Admin. Import is
  multi-stage, not one remote atomic transaction.
- **Materials**: a fully reviewed checkout or a trusted viatpkg; known target
  slug/server/session, isolated staging resources, compatible
  schema/data/migrations, required language toolchains and external
  credential provisioning.
- **Locally**: a safe directory protecting the `.viat` session, packages,
  source/plain config and manual secrets; placeholder values in an export
  **are not credentials**.

## What travels and what does not

| Area | Behavior |
| --- | --- |
| scripts/workflows/endpoints/trees | Draft definitions; folder is identity. Active snapshot versions and revision history **do not travel**. |
| resources | Plain config and secret placeholders; reusable secrets **do not travel**, and source hostnames may not suit the target. |
| schedules/watches/queue_triggers/ws_triggers | Live config as the repo supports it; creation/enablement can start activity **before endpoints publish** — check enabled/root/broker/feed/default first. |
| IM | Syncs im/accounts resource accounts, im/triggers and supported groups; inline/QR accounts are skipped on pull and not deleted on push-missing — the target must knowingly reconfigure/re-scan; copied triggers may reference non-portable accounts. |
| Authorization/repo meta | Only what viat.yaml/repo can express, not every console setting or client identity; model versions and breaking changes have separate guards/approvals. |
| Run artifacts/data | **Excludes** business database rows, managed file bytes, execution history, user credentials, device registrations, provider bindings, external queued messages, arbitrary watch files, server deployment config — plan these separately. |
| Tests | A local checkout can carry tests/cassettes; do not assume export/import carries every non-repo fixture or server-saved case — verify explicitly on the target. |

`pull` reads remote **drafts**, not published content. If what you want is "the
currently live version", reconcile draft-vs-snapshot first — a successful
export can otherwise deploy unpublished work. For dependency review: ordinary
script `uses` can be reviewed as a frozen closure; workflow step uses
(including nested) stay live — see [snapshot boundaries](snapshots.md).

## Package path: export and import

Example syntax, unexecuted:

```sh
viat export source-demo --output source-demo.viatpkg
viat import source-demo.viatpkg --as staging-demo
```

**export** re-pulls the specified/selected source into a temporary staging,
packs a gzip-tar viatpkg and cleans up. `--output` defaults to
`./<slug>.viatpkg` and may overwrite an existing file; `--only` selects kinds
with the CLI's repeat/comma syntax — it is not a dependency solver. Keep the
package private even when it contains no secrets.

**import** requires FILE; optional `--as` (default: the package slug),
`--only`, `--prune` (default false) and `--update-resources` (default false).
A missing project is created, otherwise upsert; import **does not select the
project, does not publish, does not run database migrations**. Confirm
server/login first; the current selected project cannot stand in for `--as`.

Resource import is deliberately conservative:

- New resources needing secrets are **skipped and reported** — no credentials
  exist for them; provision target credentials safely, then re-evaluate the
  definitions.
- Existing resources with secrets are **kept whole** by default (not just the
  secret fields), so source host/ports cannot redirect target credentials.
- `--update-resources` explicitly allows updating their imported config but
  conjures no missing credentials; re-check target addresses before use.
- The skipped/kept summary **does not automatically fail the import** — a
  success can still lack dependencies or keep old values.
- `--prune` explicitly deletes remote-only items inside the expressed scope;
  the default is non-destructive upsert, unlike an ordinary mirror push.

Output is progress/imported project/pending publish/skipped secret/kept
resource — not a publish response; there is no dedicated `--json` success
shape. Earlier stages may already have written before a failure: check the
target's actual state before retrying; there is no unified undo token or
transactional cancel.

## Repo path and destruction boundaries

A checkout contains viat.yaml, scripts/workflows/resources,
`endpoints/<tree>/`, the trigger directories, IM, the crate and supported
migrations. Use a dedicated session/config per environment; confirm the
selected server/project before pull/project diff/push; session discovery
never changes your CWD. Do not pull into an unreviewed dirty directory and
expect all local work to survive.

An ordinary **push is not uniformly non-destructive**:

- scripts/workflows/resources usually upsert;
- endpoint/trigger/meta mirroring can delete remote items that are missing
  locally;
- authz model guards, migrations and system-asset exclusions follow their own
  rules;
- partial `--only`/checkout combinations are not automatically safe.

`$secret` export markers are stripped; `$keep` only preserves existing
top-level plain values; `$secret:` resource references in supported positions
are yet another mechanism — none of them conjures missing target secrets. Full
rules: [sync reference](../cli/sync.md).

Do not invent standalone watch/queue/WS/IM CLIs — repo/API is what exists.
Keep live trigger definitions at `enabled: false` until target resources,
DLQ/ack timeouts, watch roots and provider identities are verified; a
protected scanned account does not mean a copied trigger can be enabled
elsewhere safely.

## Test, publish, recover

1. Review the imported state/diff; provision target resources/secrets, refresh
   schemas, then run explicitly reviewed DB/authz migrations with supported
   commands. Migrations are separate from import/push — back up first and
   confirm rollback compatibility.
2. With authorized local DB/toolchain access, run the fake suite/endpoint
   fixtures; the server gate touches real resources, so isolate them first.
   Both acknowledgements being true inside a fixture does not prove the gate
   passed.
3. Explicitly select the **target** project before publishing;
   `viat publish plan --json` explains the dirty leaves and reserves nothing;
   read warnings one by one and do not copy the test-host's blanket
   exemptions.
4. After approval, `viat publish apply --require-tests --yes --json` runs the
   local script suite first, then the server gate; endpoint fixtures do not
   run automatically; "accepted pending/failed build" can still exit 0 —
   inspect env and the actually authorized routes.
5. Enable live triggers category by category; verify
   identity/input/order/retry/idempotency and downstream observability — a
   provider accepting a send is not a receipt.

Full publish fields and gate differences: [snapshots](snapshots.md). Being
able to read a project does not prove endpoint permissions end up right. On
import/push failure, compare the target's real rows before retrying; on bad
traffic, unpublish or [roll back](rollback.md) with approval — neither
**restores** overwritten resources/data/live modules or undoes effects a
trigger already produced. Retrying packages/publishes is not exactly-once
orchestration; deduplicate external actions with business keys.

## Cleanup

Pause schedules, disable watch/queue/WS/IM, and drain in-flight
tasks/connections/broker-unacked work; revoke invitations and test
credentials, unpublish one-off endpoints; then delete isolated projects/
config/data with authorization. Deleting local packages/directories cleans
nothing remote; keep audit and revision evidence; delete only your own
example packages/staging — never prune production for demo consistency.

## Verification basis

Contract source `03751a67`: `crates/viat-cli/src/commands/sync.rs` and the
export/import implementation,
`repo/{resources,endpoints,schedules,watches,queue_triggers,ws_triggers,im}.rs`;
`crates/viat-api/src/handlers/{publish,snapshots}.rs`. Real cross-instance
migration and provider reconnection were not verified in this task and remain
deployment acceptance work.
