---
title: Control-plane, business-data and file-access audit
description: Distinguish audit stores, permissions, attribution, query/export routes and evidence-retention obligations.
doc_id: operations.audit
verified_release: '1.1.0'
channel: stable
---

# Control-plane, business-data and file-access audit

Audit is not one table or one permission — decide which question you are
answering, then pick the right entry point. Ordinary execution logs:
[logs](logs.md). All example requests/database operations are
**unexecuted**; exports can contain identities, IPs and sensitive business
values — restrict access and retention.

| Audit | Store and content | Read access |
| --- | --- | --- |
| Control-plane | Platform PostgreSQL `audit_logs`: attributed configuration/object changes — method, path, status, actor, IP; **not** a generic body diff | Project Owner/Admin for the project scope; instance-wide `/admin/audit` is **platform Owner only** |
| Business data | The postgresql resource's own audit tables/triggers: row changes, identity, reason, request correlation | Management routes for any project member; data-plane calls need authz audit-type read authorization |
| File access | Platform file-read records, independent of file modification/business metadata | Authorized per its management/access interface — holding a file link discloses nothing |

## Control-plane audit

Coverage: POST/PUT/PATCH/DELETE on project, admin and user-management paths,
including attributable **rejected attempts**. **Not** recorded: every read,
anonymous noise without identity, `/auth` session events, ordinary `/p`
data-plane requests. No generic request bodies/diffs are stored (individual
operations may attach deliberately designed summaries) — so a record proves
"this operation and its response", not every downstream semantic change, and
it is not a tamper-proof recording of all activity.

```sh
curl --fail-with-body --get "$BASE/projects/$PROJECT/audit" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode 'limit=100'
curl --fail-with-body --get "$BASE/admin/audit" \
  -H "Authorization: Bearer $OWNER_TOKEN" --data-urlencode 'limit=100'
```

Filters: `actor` email, `since` RFC3339, `limit` (default 100, range
1..500) and the paired `before`/`before_id`. The answer is
`{entries,next_before?,next_before_id?}`; paging must pass **both cursors
back together** — one missing answers 400, and time-only paging drops rows.
A 403 for an Admin or non-platform-Owner project Owner on `/admin/audit` is
expected: platform and project roles are independent.

## Business-data audit prerequisites

- Only `postgresql` resources qualify; the full audit-block fields:
  [PostgreSQL resource](../assets/resources/postgresql.md).
- The resource's database role must be able to install the audit
  schema/tables/functions and per-table triggers, and to query the audit
  tables. Audited tables need primary keys; names/ignored columns must
  validate.
- **Saving an audit block or explicitly installing runs DDL in the business
  database** — it is not a platform-metadata-only change.
- Plan with the business-database owner: backup targets → inventory every
  non-platform writer → choose the default `unattributed=reject` or an
  explicit `record` → decide per-table `reason_required`/ignored columns.
  Enabling reject can break pre-existing external imports — **do not
  discover that after go-live**. Changing the global default later rewrites
  no existing triggers: coordinate with the resource and verify.
- Attribution: the default reason is the trimmed UTF-8 `X-Viat-Reason`
  header; the endpoint's `overrides.audit_reason` may pick `header.NAME`,
  `body.FIELD` (a JSON string field) or `none`; raw-body endpoints cannot
  extract body fields. Approved fixture writes may send
  `X-Viat-Reason: fixture validation`. **Whether a reason is mandatory is a
  per-table policy** — no endpoint is guaranteed to supply one.
- Write-path semantics: the platform attaches operator/request/reason on
  supported write paths, and triggers enforce/record within the **same
  transaction** — a rolled-back transaction leaves no committed audit
  event. External writes without platform identity are rejected by default
  and recordable as unattributed only with explicit configuration. A
  database owner/superuser can still bypass or alter triggers: **this is
  not an immutable ledger independent of privileged DBAs**.

### Query and export

```sh
curl --fail-with-body --get \
  "$BASE/projects/$PROJECT/resources/$RESOURCE/audit" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'table=public.samples' --data-urlencode 'limit=100'
```

- Management query: optional resource `folder`, filters
  `table/record_id/operator/request_id/since/until/limit/before`; returns
  `{items,next_before,limit}`; default 100 capped by
  `VIAT_AUDIT_QUERY_MAX_ROWS` (1000); `before` is the returned
  `RFC3339,integer-id`. Export = the same management path plus `/export`;
  full streaming export commands/formats: [CLI audit](../cli/audit.md).
- Data plane: `GET /p/PROJECT/_audit/RESOURCE` with the `/_export` suffix —
  project authentication plus the authz `audit` type's `read` action
  (attributes `resource`/`table`). **Declaring the type grants nobody
  anything** — write explicit rules. Queries/exports use the resource
  database's credentials, not the platform account.
- Edges: a missing audit table can return an **empty page instead of 404**;
  an existing PostgreSQL resource without audit configured is still queryable
  at the default `public.viat_audit` location — so **an empty result proves
  no such thing as "every write was audited"**. Non-PostgreSQL resources are
  refused.

## Errors, retention and evidence

| Symptom | Action |
| --- | --- |
| `400 audit_reason_required` | Supply the reason through a supported request/script interface; never delete triggers as a routine bypass |
| `403 audit_unattributed` | No attached identity — determine whether the write came from the platform or an external import, then decide policy explicitly |
| DDL/primary-key/permission failure | Stop the rollout, fix target permissions/schema and coordinate; do not hand every script superuser |
| Resource unreachable | Management errors are verbose; the public data plane **deliberately** hides database details — read the internal logs you are entitled to, not public probing |

Retention: `VIAT_RETENTION_AUDIT_DAYS=365` covers only the platform
control plane; file access uses `VIAT_RETENTION_FILE_ACCESS_DAYS=90`;
**business-audit lifecycle is managed on the resource database** — keep the
evidence consistent with triggers/schema and include it in business-database
backups and isolated recovery. PostgreSQL rows/export files do not
automatically become WORM/signed evidence; compliance needs approved
external immutable storage.

When exporting: record the scope, time, filters and whether cursors ran to
completion; hash the full file and store it access-restricted. **A
screenshot or one page of data is not an audit.** Before cleanup/restore,
read [retention](retention.md) and [backup-restore](backup-restore.md).
