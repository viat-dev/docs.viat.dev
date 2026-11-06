---
title: "Project repository and synchronization"
description: "On-disk project files, actual push/pull deletion and replacement rules, model migrations and import differences."
doc_id: projects.repo-sync
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Project repository and synchronization

A repository describes remote **draft** assets, not published snapshots, all account state or a complete backup. `push` does not publish or run database migrations; `pull` does not pull the last published release. Read [CLI synchronization](../cli/sync.md) for exact flags and [CLI overview](../cli/overview.md) for session discovery. All commands/snippets here are **source-derived and unexecuted**; fixture names `demo`, `hello` refer to the disposable first-endpoint guide, and `cli-demo`/`demo.viatpkg` to the CLI examples.

## Prerequisites and permissions

Run from the intended repository root: credential discovery can walk ancestors for `.viat/config.yaml`, but asset sync uses **current working directory**, not the discovered config directory. Selected project and `viat.yaml.project.slug` must match. Verify server/project before writing. Keep a complete backup and review local modifications before pull.

Editor membership (`owner`, `admin`, `developer`) is needed for push/content and for full pull/export's endpoint/tree/role/authorizer/model reads. Operator membership does not authorize those reads. Metadata stages that change project name/scope claims require Owner/Admin even if content editing is allowed. A filtered sync does not grant additional permissions or make an incomplete checkout safe.

## File layout and identity

```text
viat.yaml
resources/<folder>/<name>.yaml
scripts/<folder>/<name>.<ext>
workflows/<folder>/<name>.yaml
endpoints/<tree>/<branch>/[id].get.yaml
schedules/<name>.yaml
watches/<name>.yaml
queue-triggers/<name>.yaml
ws_triggers/<name>.yaml
im/accounts/<name>.yaml
im/triggers/<name>.yaml
crate/Cargo.toml
crate/src/lib.rs
authz/migrations/<id>.yaml
migrations/<resource>/*.sql
```

`<folder>` is optional and part of resource/script/workflow identity: `scripts/reports/hello.py` is `reports/hello`, not root `hello`. Asset walks recurse, skip dot-directories and sort paths. Trigger collections are flat rather than folder-namespaced. **`queue-triggers` uses a hyphen on disk**; its `--only` selector is `queue_triggers`. The SQL migration directory is a separate `viat db migrate` system; authorization migrations are not SQL.

Script extensions: `.py` Python, `.ts` TypeScript, `.sql` SQL, `.sh` shell, `.graphql` GraphQL, `.vgql` viat_gql, `.prompt` llm, `.rs` Rust, `.yaml`/`.yml` binary manifest. Unknown extensions are skipped on push. Binary executable bytes are artifacts, not the manifest's repo source; pulling YAML does not back up a program artifact. Workflows read `.yaml` only and carry the definition verbatim. Use the actual `examples/hello-endpoint/hello.py` fixture as script content, not a separately maintained rewritten copy.

## `viat.yaml`: full metadata structure

Required `project:{slug,name}`. Optional lists default empty: `authorizers`, `roles`, `scope_claims`; optional/null `authz` means **unmanaged**, not an empty model. Old `permissions` and `roles[].permissions` are parsed only to refuse nonempty retired catalog data.

```yaml
project:
  slug: demo
  name: Demo
authorizers:
  - name: machine
    kind: api_key
    default_role: public
    config:
      token_ttl_hours: 1
roles:
  - name: reader
    is_admin: false
    description: Fixture reader
scope_claims:
  - name: tenant
    type: text
    source: meta
```

- `authorizers[]`: required `name`, `kind`; optional/null `default_role` leaves the server role unmanaged; optional/null `config` leaves config unmanaged. Supplied config is complete replacement, not a merge. Secrets are never pulled. Kind changes are reported/skipped, not delete/recreated; changing role/config in place preserves existing keys. First creation of secret-requiring OIDC/social authorizers needs separately provisioned server secrets rather than hoping an exported config contains them. Platform-created `chat` is not repo-owned.
- `roles[]`: required `name`; optional/null `is_admin` keeps existing flag, optional/null `description` keeps description; `""` clears description. Built-in `public`, `system:scheduler` are omitted from pull and not pruned by push.
- `scope_claims[]`: `{name,type,source,from?}`; full structure/validation in [settings](settings.md). Omitting the list defaults empty, so mirror push eventually removes server-only declarations; it is not “unmanaged” like omitted authz. Import adds without removal.
- `authz`: optional `subject_attrs`, `types`, `rules`, each defaults `[]`. An explicit empty managed object can prune a model. Delegated rules are not serialized or mirrored.

Within `authz`:

| List | Full item shape |
| --- | --- |
| `subject_attrs` | `name`, `source`, optional `from_key`, `ty`, `is_set:false` default, optional `tenant_bypass` |
| `types` | `name`, `cross_tenant:false` default, optional `tenant_attr`, `tenant_subject`, `tenant_bypass`; `attrs:[]`, `actions:[]` defaults |
| `types[].attrs` | `name`, `kind`; optional `column_name`, `rel_table`, `rel_local_fk`, `rel_ref_col`, `rel_col`; `is_set:false` default |
| `types[].actions` | String action names |
| `rules` | `type`, `action`, `effect`, `expr` AST; rules keyed by content, not exported server ID |

Example model stanza (append to the fixture metadata only after review):

```yaml
authz:
  subject_attrs:
    - name: role
      source: role
      ty: text
  types:
    - name: report
      cross_tenant: true
      actions: [read]
  rules:
    - type: report
      action: read
      effect: permit
      expr:
        subj_only: {subj: role, op: eq, lit: reader}
```

See [authorization](../auth/authorization.md) for complete AST/tenant semantics. This cross-tenant fixture is not production isolation. No connection secret belongs in `viat.yaml`.

## Resources, secrets and environment-specific values

Resource file fields: required `name`, `kind`, `plain`; optional `secret`; `allowed_authorizers` defaults `[]`. Parent directories supply folder identity; file basename is not a substitute for body `name`. Existing resource references own each kind's complete plain/secret schema; do not transplant credentials from this page.

Pull writes **string `$secret`** placeholders in secret fields; legacy YAML `!secret` markers are still accepted on push. Both are stripped from submitted secret fields, preserving existing secrets. They are not actual credentials. `$secret:<name>` or `{$secret:name}` resource references in supported config positions are a different feature.

Top-level `plain` value `$keep` preserves that field on an existing server resource; it is not a recursive merge/reset and cannot create a missing value. Pull preserves existing applicable `$keep` choices. Resource push uses PATCH for existing resources, not wholesale replacement of the entire server object; provided fields follow the resource API's own patch rules. Resources are **never deleted just because files are absent**. `system`/platform-managed resources are skipped, not a platform DB credential export.

On normal push, a new resource with unresolved `$secret`/`!secret` or `$keep` fails. Provision it on the target with secure values first, then use placeholders. Resources of kind `secret` go before dependent config resources; `library` resources are saved last so they freeze the just-pushed script version, not its predecessor.

## Endpoint files and unsupported round trips

Each tree is a directory; branches are directories; `:id` becomes `[id]`; leaves are `<segment>.<method-lowercase>.yaml`. Body `method` and filename must agree. Endpoint target uses `ref`, unlike trigger targets' `name`:

```yaml
method: GET
target: {kind: script, ref: hello}
allowed_authorizers: null
authz_gates: []
override_authorizers: false
override_permissions: false
```

Targets: `{kind:script,ref}`, `{kind:workflow,ref}`, `{kind:crud,ref,config}`, or `{kind:websocket,routes:{message_type:script_path},route_key?,message_rate_limit?,log_messages?}`. WebSocket defaults `route_key:type`, `log_messages:errors`. Changing target kind/binding can require deliberate deletion/recreation; endpoint replacement is not an atomic resource rename.

`allowed_authorizers` omitted/null inherits; `[]` denies all, names replace ancestors. `authz_gates` omitted/null in repo means unmanaged (push omits the gate field); `[]` declares no local gates but retains ancestors unless `override_permissions:true`. Both override booleans default false. `overrides` omitted/null is unmanaged; explicit `{}` clears overrides. A nonempty retired `required_permissions` is refused. See [endpoint authentication](../auth/endpoints.md) for the **different API tri-state** (API gate null explicitly inherits).

System login/register nodes are omitted and protected. Proxy mounts are not representable: pull warns/skips, push preserves server proxy nodes. A WebSocket binding to a deleted script cannot serialize and is skipped/protected until repaired in the console. Branch directories do not encode every branch-level contract/auth field; pull is not a lossless dump of arbitrary tree state. Removing a branch can cascade descendants, so inspect before mirror push.

## Trigger-file reference

Shared ordinary trigger target: `{kind:script,name:<qualified path>}` or `{kind:workflow,name:<qualified path>}`. Only schedules additionally support `{kind:endpoint,method,path}`. Target assets/resources must already exist.

| File | Full top-level fields and defaults |
| --- | --- |
| `schedules/*.yaml` | Required `name`, `trigger`, `target`; `inputs` defaults null, `enabled:true`, `on_overlap:skip` (`skip|queue|parallel`), optional `queue_cap` (only queue), `max_attempts:1`, `retry_backoff_secs:60`, `catch_up:true` |
| `watches/*.yaml` | Required `name`, `source`, `target`; `on:[created,modified]`, `filter:{}`, `timing:{}`, `inputs:null`, `enabled:true` |
| `queue-triggers/*.yaml` | Required `name`, `resource` (AMQP), `queue`, `target`; `max_concurrent_runs:1`, `ack_deadline_override:false`, `inputs:{}`, `enabled:true` |
| `ws_triggers/*.yaml` | Required `name`, `config`; `enabled:true`; config routes map message type to script path, not server script IDs |
| `im/accounts/*.yaml` | Required `name`, `platform`, `resource`; `enabled:true`, `groups:[]`, `meta:null`; no credentials field |
| `im/triggers/*.yaml` | Required `name`, `platform`, `target`; `enabled:true`, optional `account`, `account_groups:[]`, `chat_type:any`, optional `keyword`, `require_mention:false`, `inputs:null`, `max_concurrent_runs` default 4, `identity_mode:off`, optional `identity_key`, `identity_rule`, `identity_prompt` |

Schedule trigger variants: `{kind:cron,cron,timezone?}` (IANA timezone); `{kind:interval,every_secs}`; `{kind:once,at}` RFC3339. Watches `source:{path,recursive:true,max_depth?}` uses **server absolute path** allowed by `VIAT_WATCH_ROOTS`; filter optional include/exclude lists and min/max size; timing defaults `settle_secs:5`, `reconcile_secs:300`, `max_fires_per_tick:50`, `max_concurrent_runs:4`, `max_entries:20000`. WS config defaults: `idle_timeout_secs:120`, `hold:single`, `max_concurrent:1`, `queue_capacity:1000`, `on_overflow:disconnect`, `log_messages:errors`; server validates full nested config. An omitted IM account fans in across accounts of that platform; it is not automatically “the current account”.

```yaml
name: fixture-interval
trigger: {kind: interval, every_secs: 3600}
target: {kind: script, name: hello}
inputs: {name: Reader}
enabled: false
```

This schedule is deliberately disabled; creating/enabling a trigger can run code without another manual HTTP call. Only resource-backed chat accounts round-trip. Row-secret/QR-bound accounts are left server-side and not removed just because absent. Account credentials stay in resources, not `im/` YAML.

## Actual push ordering and deletion scope

`viat push` is already mirror-mode for the stages that support pruning; there is **no `push --prune`**. Stages run sequentially, not in one transaction:

1. Metadata/version guards and pending authz steps; roles → authorizers → model; add/widen scope claims.
2. Non-library resources, secrets before dependent config resources.
3. Scope-claim removals after resource reconciliation.
4. Scripts, then workflows.
5. Schedules → watches → queue triggers → WS triggers → chat accounts then chat triggers.
6. Endpoints, then project crate, then library resources.

Model additions create subjects/types/attrs/actions before rules; pruning reverses dependencies (rules before attrs/actions/types/subjects). Guarded dependencies/delegated ownership may cause reported skips, not a guarantee everything now equals the file. Metadata authorizers/roles may be pruned subject to built-in/reference guards. Scripts/workflows/resources only upsert; deleting their file does **not** delete server assets.

Schedules/watches/queue-trigger stages skip when their directory is absent, but an existing empty directory mirrors away server items. WS triggers and syncable IM accounts/triggers can prune even when their directories are absent; never use a partial checkout with an all-kind push. Endpoint pruning occurs in the visited tree/parent walks; missing leaf/branch there is deletion, protected exceptions above survive. An entirely unvisited server tree is not a promise of global tree deletion. `crate/` absent is unmanaged, present empty clears managed server crate in mirror mode; only allowed source paths are sent (`Cargo.toml`, lock/build/toolchain files, `src/` excluding `src/bin/`, Rust test/bench/example files); hidden/target/unsupported notes are skipped.

## Pull is overwrite, not universal local cleanup

Pull writes current remote drafts over represented local paths, replaces `viat.yaml`, and records authz version. It does not generally delete stale local scripts/workflows/resources/triggers/endpoints: a server-deleted file may remain and be resurrected by a later push. **Crate is an exception:** pull removes pushable local crate files absent remotely, preserving unsupported notes/build outputs. Do not assume every collection has this pruning behavior.

`--only` chooses kinds: `meta,resources,scripts,workflows,schedules,watches,queue_triggers,ws_triggers,chat,endpoints,crate`. It is not a filename filter. Unknown selector text can be silently excluded; spell carefully. Filtered push reports excluded drift and pending publish; `--json` can follow human stage output and is not a guaranteed clean single-JSON stream.

## Authz migration files and push guards

`authz/migrations/<id>.yaml` (also `.yml`) is a nonempty operation list, sorted by filename stem ID; checksum protects applied text. Example unexecuted rename step:

```yaml
- rename_type: {from: report, to: document}
- rename_action: {type: document, from: read, to: view}
```

Supported operations: `rename_type:{from,to}`, `rename_attr:{type,from,to}`, `rename_action:{type,from,to}`, `rename_subject_attr:{from,to}`, `set_origin:{origin,where:in_file|not_in_file}`, `delete_type:{name,cascade:false}`. Keep final `viat.yaml` consistent. Applied IDs/checksums are not editable history; create a new step for correction. Pending steps run before model mirroring, after projecting their result for deletion guards.

`--force-authz` overrides “server model changed since this checkout last saw it”; `--yes` approves model/role deletions (types/attrs/actions/subject attrs/roles), **not** every destructive sync. Platform-rule-only deletions are ordinary mirror behavior. Version record is local `.viat/authz-versions.json`, keyed by server/project/canonical checkout; pull/push update it. A partial failed push may already advance the model version and be recorded; it is not a rollback guarantee. Missing `authz` leaves model unmanaged; explicit empty authz is different.

## Export/import differences and recovery

`viat export` freshly pulls into staging then packs gzip tar `.viatpkg`; it is not an archive of arbitrary CWD files and not a database/file-byte/key backup. `viat import demo.viatpkg --as cli-demo-copy` creates a missing target project, otherwise updates it; it does not change current selection. Default import upserts without pruning, adds scope claims, unions crate files and does not apply checkout model guards/migration steps. `--prune` explicitly selects supported mirror removals; `--update-resources` opts into updating existing secret-bearing resources whose connections otherwise remain entirely unchanged. New resources with missing secret placeholders are skipped with a summary (not normal push's hard failure). Reprovision secrets on the target; skipped/kept items do not prove deploy completeness.

Before push: inspect a complete checkout, selected server/project, diff, stale files, delegated rules and destructive categories. After push: read per-stage/skipped/pending-publish output, run intended DB migration separately, inspect [publish plan](../cli/publish.md), then explicitly publish. Failure halfway leaves earlier remote writes/local pull writes applied. Restore from deliberate backup/reconcile; endpoint rollback cannot undo all live settings/model/trigger changes. Clean disposable bundles locally only after inspection; remote deletion/revocation is a separate approved operation. No project DELETE route is registered in this release; do not invent a project-delete cleanup command.

No CLI/network/trigger/migration/provider operation or test was run for this reference. **Evidence:** `crates/viat-cli/src/commands/{sync.rs,bundle.rs}`, `crates/viat-cli/src/repo/{viat_yaml.rs,resources.rs,endpoints.rs,schedules.rs,watches.rs,queue_triggers.rs,ws_triggers.rs,im.rs,crate_files.rs,authz_steps.rs,model_guard.rs}`, API DTO/permission implementations. Older comments say `!secret`, blanket mirror, and even no project GET; actual code uses `$secret`, collection-specific pruning, and `GET /projects/{slug}`. This page follows code, not those comments.
