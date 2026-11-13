---
title: "Migration and release reliability fixes (preview)"
description: "Unreleased fixes for sealed bundle imports, legacy widget recovery, and Mac notarization uploads."
doc_id: operations.migration-reliability-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

This page describes fixes in development. **It does not describe shipped 1.3.0 behavior or change the stable handbook's version guarantees.** Before use, confirm that the CLI, client, and release scripts contain these fixes. The released reference must be updated with the next contract bundle. For the current stable boundaries, see [CLI sync](../cli/sync.md), [widgets](../clients/widgets.md), and [client installation](../installation/clients.md).

## Sealed bundle migration

Secret export still requires the applicable source-project permissions. Import still requires the destination's project creation, editing, and authorizer-management permissions. These fixes grant no additional access and do not make import an all-or-nothing transaction.

- Legitimate optional secret `null` values are preserved. For example, ordinary S3 long-lived credentials have no `session_token`, and HTTP Bearer authentication does not require a username or password. These values no longer cause an entire new resource to be skipped incorrectly.
- Absent secret fields still count as missing. The secret fields of `cloud_api` also preserve valid `{"$secret":"name"}` references. Other invalid value shapes are rejected rather than guessed or printed. Required fields remain subject to server-side resource-kind validation.
- Existing destination OIDC and social authorizers are preserved by default, including both configuration and credentials. This avoids combining the source `client_id` with the destination `client_secret`. Current configuration cannot prove that no credentials remain: delegated Alipay authorizers can retain an AES key after phone collection is disabled, so they also receive this protection.
- The new import option `--update-authorizers` defaults to off. It separately authorizes replacing these existing authorizers and requires complete usable credentials for the source configuration in the sealed bundle, updated together with configuration. If the source configuration legitimately requires no credentials of its own, no nonexistent secret is demanded. Credential rotation must not be skipped just because visible configuration is unchanged. Missing required credentials never authorize a configuration-only replacement.
- `--update-resources` continues to control resources only; its scope does not expand to authorizers. Ordinary repository `push` does not adopt this import-preservation policy.
- `--only meta --with-secrets` can carry just metadata and the selected authorizers' secrets. When no resources are included, a missing `resources/` directory is an empty set. A scripts-only export does not carry unrelated objects' credentials.
- Scoped exports include a `bundle_only` list in `viat.yaml`. When meta was not selected, this file carries only the project slug/name needed for import and the scope marker, without reading other metadata. The updated importer uses this scope by default; an explicit `--only` must be a subset, otherwise it is refused before reading a key or making remote changes. `--as` preserves the marker, and `--prune` cannot remove objects of kinds outside the export scope.
- Older bundles without a scope marker retain their previous import semantics. **Use an updated CLI containing this fix to import scoped bundles.** Older CLIs do not understand the marker and cannot be relied upon to protect objects outside that scope.
- The marker limits synchronization stages only. It does not change the project-wide behavior of `--publish`, provide partial publishing, or guarantee transactions across assets.

### Concurrent edits and output

Sealed export checks object IDs and update timestamps before and after reading configuration and credentials, for the resources and authorizers actually included in the bundle. Updates, deletions, same-name replacements, or missing required revision information cause export to refuse successful packaging and request a retry. It does not emit a supposedly successful bundle pairing different configuration and credential revisions. This conservative consistency check is not a full-project database snapshot and does not guarantee transactional consistency across other assets.

The one-time key is printed only after the archive has been written successfully, as the final stdout line. Pass the key to import on stdin, not in command-line arguments, logs, tickets, or repositories. An archive failure is not a successful export. Store the archive and key separately, and remove unneeded copies after isolated verification.

### Verification and recovery

Use an isolated destination to verify ordinary S3 credentials, HTTP Bearer credentials, and a same-name OIDC authorizer. Exercise default preservation and explicit replacement separately. Inspect the import summary for preserved or missing objects before publishing; completion alone does not mean that every credential migrated. If export reports an object change, wait for the update to finish and export again rather than bypassing revision checks.

## Legacy widget recovery

When a pre-upgrade local binding has no `bundle/environment`, automatic maintenance requests a new subscription using the current App's bundle identifier and build environment instead of submitting empty values. A matching deployment-level APNs profile is still required; this fix does not create or guess Apple credentials.

A failed first creation preserves the old binding's retry intent so later foreground maintenance can retry. Recovery does not depend on that instance currently being selected. The old binding is replaced only after a new subscription matching the current identity is saved successfully. Logout, explicit disable, and isolation for known identity mismatches are not relaxed.

The APNs profiles page distinguishes network/server read failures from a successful empty response and offers a refresh action. Do not recreate or rotate credentials merely because a read failed.

## Mac notarization upload budget

`MAC_NOTARY_UPLOAD_TIMEOUT` controls only the Mac notarization ZIP/DMG upload subprocess, in seconds, with a default of `1800`. It must be a positive finite number. Empty, zero, negative, nonnumeric, NaN, and Infinity values are rejected. Ordinary query and preflight commands retain their 120-second budget.

On a slow connection, increase this environment variable before starting or resuming a release. It is not part of signed artifact identity, so changing this timeout alone does not require rebuilding artifacts. It is not an Apple processing deadline or a guarantee that the whole release batch has completed.

An upload timeout can still leave the submission ID unknown. Preserve the checkpoint and reconcile Apple's submission history first. Ordinary resume does not blindly upload again, and `--resubmit-unknown` still requires explicit operator authorization. A query timeout with a known ID preserves that ID. Do not recover by writing a success manifest manually or modifying a signed App.

## Verification boundary

Regression checks use local stubs, isolated data, and fake publishers, not real Apple uploads, signing credentials, or production migrations. This page is not evidence that those remote operations succeeded. The stable contract bundle and official release documentation must still be updated when these fixes ship.
