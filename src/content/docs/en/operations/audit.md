---
title: Control-plane, business-data and file-access audit
description: Distinguish audit stores, permissions, attribution, query/export routes and evidence-retention obligations.
doc_id: operations.audit
verified_release: '1.1.0'
channel: stable
---

# Control-plane, business-data and file-access audit

Audit is not one table or one permission. Choose the record that answers your question; ordinary execution logs are covered in [logs](logs.md). All example requests and database operations are **unexecuted**. Exports can contain identities, IP addresses and sensitive business values: restrict access and retention.

| Trail | Where and what | Read permission |
| --- | --- | --- |
| Control-plane | Platform PostgreSQL `audit_logs`: authenticated object/config mutations, method/path/status/actor/IP, not general body diffs | Project Owner/Admin for project trail; **platform Owner only** for deployment-wide `/admin/audit` |
| Business-data | A `postgresql` resource's own audit table/triggers: row changes, identity/reason/request linkage | Any project member through management routes; project data-plane callers need authz `audit` type `read` grant |
| File access | Platform file-read access records, separate from file mutations/business metadata | Governed by its management/access surfaces, not automatically public because a file link exists |

## Control-plane trail

The mutation layer covers POST/PUT/PATCH/DELETE under project, admin and user-management paths, including attributable refused attempts. It does **not** record every read, anonymous unauthenticated noise, `/auth` session events or ordinary `/p` data-plane calls. No generic body/diff archive is kept; special operations can attach an intentional summary. Therefore an audit row shows an attempted operation and response, not proof of every downstream semantic change or a tamper-proof complete activity recording.

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/audit" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=100'
curl --fail-with-body --get "$BASE/admin/audit" \
  -H "Authorization: Bearer $OWNER_TOKEN" --data-urlencode 'limit=100'
```

Filters: `actor` (email), `since` (RFC3339), `limit` (default 100, clamp 1..500), and paired `before`/`before_id`. Response is `{entries,next_before?,next_before_id?}`. Return **both** cursor fields together; a half cursor gives 400 and timestamp-only paging can miss rows. A 403 for `/admin/audit` is expected for Admin or a project Owner without platform Owner role. Project role and platform role are distinct.

## Business-data audit prerequisites

Only `postgresql` resources implement this trail; the complete resource audit-block fields are in the [PostgreSQL resource reference](../assets/resources/postgresql.md). The configured resource account needs privileges to install the audit schema/table/function and per-table triggers and query the trail. Audited tables need primary keys; names/ignored columns must pass validation. Saving an `audit` block or explicitly installing reconciles DDL in that business database—this is not merely a platform metadata edit.

Plan the change with database owners: snapshot/backup the target, inventory non-platform writers, choose `unattributed=reject` (default) or deliberately `record`, and decide each table's `reason_required`/ignored columns. Enabling reject can make existing external writes fail; do not discover this during a production import. Changing the global default later does not magically replace already-installed trigger behavior; reconcile the resource and verify.

The default request reason is the trimmed UTF-8 `X-Viat-Reason` header. Endpoint `overrides.audit_reason` can select `header.NAME`, `body.FIELD` (JSON string field), or `none`; a raw-body endpoint cannot extract a body field. For example, an approved fixture write can send `X-Viat-Reason: fixture validation`. Requiring a reason is a table policy, not a guarantee that every endpoint supplies one.

The platform supplies operator/request/reason context on supported writes; triggers enforce/record changes in the same transaction. A rollback does not become a committed audit event. Out-of-band writes without platform identity reject by default, or record as unattributed if explicitly configured. A database owner/superuser can bypass/alter triggers; this is not an independent immutable ledger against a privileged DBA.

### Query and export

```sh
curl --fail-with-body --get \
  "$BASE/projects/$PROJECT/resources/$RESOURCE/audit" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'table=public.samples' --data-urlencode 'limit=100'
```

Management query supports optional resource `folder` plus `table`, `record_id`, `operator`, `request_id`, `since`, `until`, `limit`, `before`; returns `{items,next_before,limit}`. Limit defaults 100, ceiling `VIAT_AUDIT_QUERY_MAX_ROWS` (1000). `before` is the returned `RFC3339,integer-id`. Export uses the same management path plus `/export`; use [CLI audit](../cli/audit.md) for a complete streaming export command and format.

The data-plane equivalents are `GET /p/PROJECT/_audit/RESOURCE` and `/_export` suffix. They use project authentication and authz type `audit`, action `read`, resource attributes `resource`/`table`. Declaring the type grants nobody access automatically; write an explicit policy. Query/export reads with the resource's database credentials, not the platform DB role.

An absent trail table can appear as an empty page, not necessarily 404; an existing PostgreSQL resource without configured audit can be queried against the default location (`public.viat_audit`). Empty result is not proof every write was audited. Non-PostgreSQL resources are refused.

## Errors, retention and evidence handling

- `400 audit_reason_required`: supply the required reason through the supported request/script interface; do not disable the trigger as a routine workaround.
- `403 audit_unattributed`: identity was not attached. Determine whether the writer is platform-mediated or an external import; choose an explicit attribution policy.
- DDL/primary-key/permission failure: stop rollout, restore correct target privileges/schema and reconcile; do not grant superuser to every script.
- Resource unreachable: management errors can be more verbose; public data-plane errors intentionally withhold database details. Inspect privileged logs, not public probing.

`VIAT_RETENTION_AUDIT_DAYS=365` governs platform control-plane rows, **not** the external business trail. File reads use `VIAT_RETENTION_FILE_ACCESS_DAYS=90`. Business audit lifecycle must be managed in the resource database, preserving required evidence and schema/trigger consistency. Include it in external database backups and isolated restore drills. PostgreSQL records and export files are not automatically WORM/signed evidence; use approved external immutable storage if required.

When exporting, record scope, time, filters and cursor completion, hash the completed artifact and store it with access controls. Avoid relying on a screenshot or a single page as a complete audit. Review [retention](retention.md) and [backup/restore](backup-restore.md) before purging or restoring evidence.
