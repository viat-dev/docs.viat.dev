---
title: "Project repository and sync"
description: "On-disk files, real push/pull deletion and replacement semantics, model migrations and import differences."
doc_id: projects.repo-sync
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Project repository and sync

The repository (this directory tree on disk) describes the remote **drafts**.
Three boundaries up front:

- `push` syncs drafts only: it does not publish and runs no database
  migrations.
- `pull` fetches drafts, not "the last published version".
- The repository is not a full backup: account state, publish snapshots and
  secrets are not in it.

Exact parameters: [CLI sync](../cli/sync.md); session discovery:
[CLI overview](../cli/overview.md). Commands/snippets here are
**source-derived and unexecuted**; `demo`/`hello` come from the isolated
first-endpoint guide, `cli-demo`/`demo.viatpkg` from the CLI examples.

## Prerequisites and permissions

Run from the intended repository root: credential discovery may walk up to a
`.viat/config.yaml`, but asset sync uses the **current working directory**,
not the directory the config was found in. The current project must match
`viat.yaml.project.slug`. Verify server/project before writing; back up the
full directory and review local modifications before pulling.

- Push/content changes/full pull/export reads of endpoints, trees, roles,
  authorizers and the model need an editor role (`owner`/`admin`/
  `developer`) — Operator lacks these reads.
- Changing project name/scope claims and similar metadata additionally needs
  Owner/Admin: content-edit rights do not imply settings rights.
- Filtered sync (`--only`) raises no permissions and never makes a partial
  repository safe.

## Layout and identity

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

- `<folder>` is optional but part of resource/script/workflow **identity**:
  `scripts/reports/hello.py` is `reports/hello`, not a root-level `hello`.
- Assets are walked recursively, dot directories skipped, sorted by path;
  trigger collections are flat directories.
- **On disk it's `queue-triggers` with a hyphen**; the `--only` selector is
  `queue_triggers`.
- SQL migrations run via the separate `viat db migrate`; authz model
  migrations are not SQL (below).

Script extensions: `.py` Python, `.ts` TypeScript, `.sql` SQL, `.sh` shell,
`.graphql` GraphQL, `.vgql` viat_gql, `.prompt` llm, `.rs` Rust,
`.yaml`/`.yml` binary manifest; unknown extensions are skipped on push. A
binary program's bytes are an artifact, not in the manifest — pulling the YAML
is not a backup of the program. Workflows read `.yaml` only and carry the
definition verbatim. Script examples use the real
`examples/hello-endpoint/hello.py`; do not maintain divergent copies.

## Full `viat.yaml` metadata

`project:{slug,name}` is required. `authorizers`, `roles`, `scope_claims` are
optional with empty-list defaults; an omitted/null `authz` means **not
managing the model**, not an empty model. The legacy `permissions` and
`roles[].permissions` are parsed only so non-empty retired data can be
rejected.

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

- `authorizers[]`: `name` and `kind` required; omitted/null `default_role`
  does not manage the server-side default role; omitted/null `config` does
  not manage config, and providing it is a **full replacement**. Secrets are
  never pulled. A kind change is reported and skipped, not delete-recreated;
  in-place role/config edits keep existing keys. First-time creation of
  secret-requiring OIDC/social authorizers needs server-side secret setup —
  never expect them in an export. Platform-created `chat` is not
  repo-managed.
- `roles[]`: `name` required; omitted/null `is_admin` keeps the server flag,
  omitted/null `description` keeps it and `""` clears it. Built-in `public`
  and `system:scheduler` are neither exported nor pruned.
- `scope_claims[]`: `{name,type,source,from?}`, full validation in
  [settings](settings.md). The omitted list defaults to empty, so a **mirroring
  push eventually removes server-only claims** — this cannot be read as "not
  managing" the way an omitted authz can. Default import only adds.
- `authz` `subject_attrs`/`types`/`rules` are optional, defaulting to `[]`;
  an explicitly empty object prunes the model. Delegated rules are neither
  serialized nor mirrored.

Full `authz` structure:

| List | Structure |
| --- | --- |
| `subject_attrs` | `name`, `source`, optional `from_key`, `ty`, default `is_set:false`, optional `tenant_bypass` |
| `types` | `name`, default `cross_tenant:false`, optional `tenant_attr`/`tenant_subject`/`tenant_bypass`, defaults `attrs:[]`/`actions:[]` |
| `types[].attrs` | `name`, `kind`; optional `column_name`, `rel_table`, `rel_local_fk`, `rel_ref_col`, `rel_col`; default `is_set:false` |
| `types[].actions` | action-name strings |
| `rules` | `type`, `action`, `effect`, `expr` AST; matched by content, server IDs not exported |

A model fragment to attach to isolated metadata only after review:

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

Full AST/tenant semantics: [authorization](../auth/authorization.md). This
cross-tenant fixture is not a production isolation scheme; connection secrets
never belong in `viat.yaml`.

## Resources, secrets and environment values

- Resource files require `name`, `kind`, `plain`; optional `secret`;
  `allowed_authorizers` defaults to `[]`. The parent directory supplies the
  folder; the filename cannot replace the body's `name`. Each kind's full
  plain/secret schema belongs to the [resource reference](../assets/resources/index.md)
  — this page carries no credentials.
- pull writes the **string `$secret`** placeholder; the old YAML `!secret` is
  still accepted on push. Both are stripped from secret fields before
  committing and preserve existing server secrets — they are not
  credentials. `$secret:<name>` / `{$secret:name}` resource references in
  supported positions are a different feature.
- The top-level `plain` field `$keep` preserves existing server values: not a
  recursive merge, not a reset, and it cannot initialize a value that does
  not exist; pull retains applicable `$keep` choices. Existing resources
  update via PATCH (not whole-object replacement), following the resource
  API's patch rules.
- **Resources are never deleted for a missing file**; `system`/platform
  resources are skipped and platform database credentials are never exported.
- In a normal push, a new resource still carrying `$secret`/`!secret` or
  `$keep` fails: create it safely on the target first, then keep the
  placeholder. `secret` kinds precede config resources depending on them;
  `library` saves last, freezing the just-pushed script version rather than
  an older one.

## Endpoint files and what cannot round-trip losslessly

One directory per tree, branches as directories, `:id` as `[id]`, leaf files
`<segment>.<lowercase-method>.yaml`; the body's method must match the
filename. Endpoint targets use `ref` while triggers use `name`:

```yaml
method: GET
target: {kind: script, ref: hello}
allowed_authorizers: null
authz_gates: []
override_authorizers: false
override_permissions: false
```

A target may be `{kind:script,ref}`, `{kind:workflow,ref}`,
`{kind:crud,ref,config}`, or
`{kind:websocket,routes:{message_type:script_path},route_key?,message_rate_limit?,log_messages?}`;
WebSocket defaults to `route_key:type` and `log_messages:errors`. **Changing
target type/binding may need a deliberate delete-and-recreate** — it is not an
atomic rename.

- `allowed_authorizers`: omitted/null inherits, `[]` rejects everyone, named
  entries replace ancestors.
- Repo `authz_gates`: omitted/null means unmanaged (push sends nothing);
  `[]` declares no local gates but still inherits ancestors unless
  `override_permissions:true`. Both overrides default false. `overrides`
  omitted/null is unmanaged, explicit `{}` clears; non-empty legacy
  `required_permissions` is rejected. [Endpoint auth](../auth/endpoints.md)
  describes the **different API tri-state** where a null gate is an explicit
  "inherit".
- System login/register leaves are never pulled and stay protected; proxy
  mounts cannot be represented — pull warns and skips, push keeps the
  server-side proxy; a WebSocket referencing a deleted script cannot be
  serialized and is skipped/protected until fixed in the console.
- Branch directories do not encode every branch contract/auth field: **pull
  is not a lossless dump of arbitrary tree state**; deleting a branch can
  cascade to descendants — always review before mirroring.

## Trigger file reference

Ordinary trigger targets are `{kind:script,name:<qualified-path>}` or
`{kind:workflow,name:<qualified-path>}`; schedules additionally accept
`{kind:endpoint,method,path}`. Referenced assets/resources must already
exist.

| File | Full top-level fields/defaults |
| --- | --- |
| `schedules/*.yaml` | Required `name`, `trigger`, `target`; defaults `inputs:null`, `enabled:true`, `on_overlap:skip` (`skip\|queue\|parallel`), optional `queue_cap` (queue only), `max_attempts:1`, `retry_backoff_secs:60`, `catch_up:true` |
| `watches/*.yaml` | Required `name`, `source`, `target`; defaults `on:[created,modified]`, `filter:{}`, `timing:{}`, `inputs:null`, `enabled:true` |
| `queue-triggers/*.yaml` | Required `name`, `resource` (AMQP), `queue`, `target`; defaults `max_concurrent_runs:1`, `ack_deadline_override:false`, `inputs:{}`, `enabled:true` |
| `ws_triggers/*.yaml` | Required `name`, `config`; `enabled:true`; config routes map message types to script paths, not server IDs |
| `im/accounts/*.yaml` | Required `name`, `platform`, `resource`; defaults `enabled:true`, `groups:[]`, `meta:null`; no credentials field |
| `im/triggers/*.yaml` | Required `name`, `platform`, `target`; defaults `enabled:true`, optional `account`, `account_groups:[]`, `chat_type:any`, optional `keyword`, `require_mention:false`, `inputs:null`, `max_concurrent_runs:4`, `identity_mode:off`, optional `identity_key`/`identity_rule`/`identity_prompt` |

- Schedule triggers: `{kind:cron,cron,timezone?}` (IANA timezone),
  `{kind:interval,every_secs}`, `{kind:once,at}` (RFC3339).
- Watch `source:{path,recursive:true,max_depth?}`: path is a **server-side
  absolute path** that must sit inside `VIAT_WATCH_ROOTS`; filter supports
  include/exclude lists and min/max size; timing defaults
  `settle_secs:5`, `reconcile_secs:300`, `max_fires_per_tick:50`,
  `max_concurrent_runs:4`, `max_entries:20000`.
- WS config defaults: `idle_timeout_secs:120`, `hold:single`,
  `max_concurrent:1`, `queue_capacity:1000`, `on_overflow:disconnect`,
  `log_messages:errors`; the server validates the full nested config.
- An omitted IM account means the platform's multiple accounts funnel in —
  not an automatic "current account" selection.

```yaml
name: fixture-interval
trigger: {kind: interval, every_secs: 3600}
target: {kind: script, name: hello}
inputs: {name: Reader}
enabled: false
```

> [!WARNING]
> The example is deliberately `enabled: false`: creating/enabling a trigger
> can execute code without any further HTTP call. Only resource-credential
> chat accounts round-trip; row-secret/QR-bound accounts stay on the server —
> their absence does not mean they are deletable. Account secrets belong to
> resources, not to the `im/` YAML.

## Real push order and deletion scope

`viat push` is already **mirroring** for the prunable stages — there is no
`push --prune`. Stages run serially, not in one transaction:

1. Metadata/version guards and pending authz steps; roles → authorizers →
   model, adding/extending scope claims.
2. Non-library resources, secrets before dependent config.
3. Scope-claim removal after resource reconciliation.
4. Scripts, then workflows.
5. schedules → watches → queue → WS → chat accounts, then chat triggers.
6. Endpoints, the project crate, and finally library resources.

Model additions order subjects/types/attrs/actions before rules; pruning runs
in reverse dependency order (rules before attrs/actions/types/subjects).
Reference protection and delegated ownership can report skips — final full
equality is not guaranteed. Metadata authorizers/roles prune but respect
built-ins/reference protection. **Scripts, workflows and resources only
upsert: deleting a file never deletes the server asset.**

Missing schedule/watch/queue directories skip, but an **existing empty
directory mirror-deletes** server entries; WS triggers and syncable IM
accounts/triggers can prune even without a directory — never full-push from a
partial checkout. Endpoint pruning happens within the visited trees/parents:
missing leaves/branches there delete (protected items stay); do not infer
global deletion of unvisited server trees. A missing `crate/` means
unmanaged; an existing but empty one mirror-clears the server's manageable
crate. The crate sends allowlisted paths only (Cargo/lock/build/toolchain,
`src/` without `src/bin/`, Rust test/bench/example), skipping hidden/target/
unsupported files.

## pull overwrites; it is not a general local cleanup

pull writes remote drafts to the corresponding local paths, replaces
`viat.yaml` and records the authz version. It **deletes nothing** in general
— stale local scripts/workflows/resources/triggers/endpoints can survive and
revive on the next push. **The crate is the exception**: pull deletes
pushable crate files missing remotely (keeping unsupported files/build
outputs) — do not generalize that to other collections.

`--only` selects kinds: `meta,resources,scripts,workflows,schedules,watches,
queue_triggers,ws_triggers,chat,endpoints,crate` — a category selector, not a
file filter; unknown strings may be silently excluded, so spell carefully. A
filtered push reports unpushed drift and pending publications; `--json` may
follow human-readable stage output and is not guaranteed to be one pure JSON
stream.

## Authz migrations and push protection

`authz/migrations/<id>.yaml` (`.yml` accepted) is a non-empty operation list,
ordered by file-stem ID, with checksums pinning applied text. Unexecuted
rename example:

```yaml
- rename_type: {from: report, to: document}
- rename_action: {type: document, from: read, to: view}
```

Supported operations: `rename_type:{from,to}`, `rename_attr:{type,from,to}`,
`rename_action:{type,from,to}`, `rename_subject_attr:{from,to}`,
`set_origin:{origin,where:in_file|not_in_file}`,
`delete_type:{name,cascade:false}`. The final `viat.yaml` must agree; applied
IDs/checksums are immutable history — corrections always use a new step.
Pending steps run before the model mirror, and deletion guards evaluate
against their predicted result.

`--force-authz` overrides the "server model changed since this checkout last
saw it" refusal; `--yes` approves type/attr/action/subject/role deletions —
**not** a blanket confirmation of every destructive sync; deleting only
platform rules is ordinary mirroring. Versions live in local
`.viat/authz-versions.json`, keyed by server/project/canonical checkout path
and updated by pull/push; a partially failed push may already have advanced
the model version — rollback is not guaranteed. Once more: omitted authz is
"unmanaged", explicit empty authz is "prune" — they differ.

## Export/import differences and recovery

`viat export` pulls into staging and packs a gzip-tar `.viatpkg`: not an
arbitrary-CWD file archive and not a database/file-byte/key backup.
`viat import demo.viatpkg --as cli-demo-copy` creates a missing target
project or updates it, and does not change the current selection.

- Default import is a **non-pruning upsert**: adds scope claims only, merges
  the crate, and runs none of the checkout's model guards/migration steps.
- `--prune` explicitly enables supported mirror deletions;
  `--update-resources` is what updates existing secret-bearing resources
  otherwise kept whole by default — preventing source connections from
  overriding the target environment.
- New resources lacking secrets are **skipped and summarized** (unlike the
  hard failure of a normal push). Provision target secrets separately; the
  skipped/kept summary does not prove a complete deployment.

Before push: verify the full checkout, server/project, diff, stale files,
delegated rules and destructive categories. After push: review the
per-stage/skipped/pending-publish output, run intended DB migrations
separately, inspect the [publish plan](../cli/publish.md) and publish
deliberately. A mid-flight failure keeps earlier writes (remote and local
pull) — restore/reconcile from backups; endpoint rollback does not undo
live settings/model/trigger changes. Delete an isolated bundle locally only
after review; remote deletion/revocation needs separate approval — assume no
project-level DELETE route exists.

## Verification basis

Contract source `03751a67`: `crates/viat-cli/src/commands/{sync.rs,bundle.rs}`,
`crates/viat-cli/src/repo/{viat_yaml.rs,resources.rs,endpoints.rs,schedules.rs,watches.rs,queue_triggers.rs,ws_triggers.rs,im.rs,crate_files.rs,authz_steps.rs,model_guard.rs}`,
API DTO and permission implementations. Old comments still say `!secret`,
generic "mirroring", and even lack a project GET; reality is `$secret`,
per-collection pruning and `GET /projects/{slug}` — this page follows the
code, not those comments. No CLI, network, trigger, migration, provider or
test execution happened here.
