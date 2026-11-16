---
title: "Authorization model, gates and row scopes"
description: "Types, attributes, rule AST, subject sources, tenancy and delegated rule ownership."
doc_id: auth.authorization
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Authorization model, gates and row scopes

Authentication answers "who"; authorization answers "may they" — keep them
apart. Viat evaluates a project authorization model built from resource
**types**, object **attributes**, **actions**, declared subject facts and
permit/forbid **rules**. The old permission-string catalog is retired:
nonempty `permissions`/`required_permissions` is **not** a replacement for
rules.

## Who manages the model

- Console/platform credentials use `/projects/{slug}/authz` and require a
  project editor (`owner`/`admin`/`developer`).
- Project credentials use `/p/{slug}/_authz` and require project-admin
  rights — which grant **no** platform membership. The two entrances share
  model validation but differ in rule ownership.
- The base-path `GET` returns `{types,rules,subject_attrs,version}` with
  each type as `{type,attrs,actions}`; `GET .../lint` checks coverage and
  dependency problems — it **proves no** business decision correct.

Naming: type/attr/action/subject logical names are 1–64 bytes of ASCII
alphanumerics plus `_ - . :` (they ride in URL path segments); physical
table/column names validate separately; never put slashes or spaces in
logical names.

## Model management inputs

Unless stated otherwise the suffixes below work on both base paths. All
examples are **source-derived and unexecuted**; work only in an isolated
project, never with production user attributes.

| Method and suffix | Full request body / update rule |
| --- | --- |
| `POST /types` | `{name,cross_tenant?}`, boolean defaulting false |
| `GET /types`, `GET /types/{name}` | Type list and detail |
| `POST /types/{name}/rename` | `{name}`; a reference-preserving rename, not delete-recreate |
| `PUT /types/{name}/tenancy` | `{tenant_attr?,tenant_subject?,tenant_bypass?}`; replaces the tenancy designation — omitted/null **removes** the designation/bypass override, it is not a partial keep |
| `POST /types/{name}/attrs` | `{name,kind,column_name?,rel_table?,rel_local_fk?,rel_ref_col?,rel_col?,is_set?}`; `kind` is `local`/`rel`, `is_set` defaults false |
| `POST /types/{name}/actions` | `{name}` |
| `POST /subject-attrs` | `{name,source,from_key?,ty,is_set?}`; `is_set` defaults false |
| `PUT /subject-attrs/{name}/tenant_bypass` | `{tenant_bypass:predicate-or-null}`; omitted/null clears the dimension default |
| `POST /rules` | `{type,action,effect,expr,descr?}`; `effect` is `permit`/`forbid`; the description is optional |
| `DELETE /rules/{id}` | Deletes the rule, bounded by ownership checks |
| `DELETE /types/{name}`, `/types/{name}/attrs/{attr}`, `/types/{name}/actions/{action}`, `/subject-attrs/{name}` | Dependency guards may refuse; migrate/remove references first |

Attribute semantics: `local` sets `column_name`; `rel` must set
`rel_table`, `rel_local_fk`, `rel_ref_col`, `rel_col` — a local-FK hop to
a parent table compiled into a related-existence predicate, **not** an
arbitrary SQL fragment. `is_set` must match the modeled value and affects
legal membership operations. There is no per-attribute partial update —
migrate references deliberately.

Creation-order example (POST to the corresponding paths under
`/projects/demo/authz`):

```json
{"name":"role","source":"role","ty":"text"}
```

```json
{"name":"report","cross_tenant":true}
```

Then `{"name":"read"}` to `/types/report/actions`, and to `/rules`:

```json
{"type":"report","action":"read","effect":"permit","expr":{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},"descr":"Fixture readers may read reports"}
```

Order: subject, type, action — then rules referencing them. The example's
`cross_tenant:true` is **not** a tenancy recipe; multi-tenant launches
require the isolation configuration below.

## Subject attributes

`ty` is `text`/`int`/`uuid`; `is_set:false` is scalar, true a set. Facts
come from the **verified principal**, never plain request input:

| `source` | `from_key`/value |
| --- | --- |
| `claim` | Key of a verified external-token claim |
| `meta` | Key of project-user metadata |
| `role` | Current project business role (no key) |
| `identity` | Project identity string (no key) |
| `user_id` | Project user UUID, use `ty:uuid` (no key) |
| `admin` | Effective project-admin state; the text `"true"`/`"false"`, **not** a JSON boolean (no key) |
| `const` | Constant encoded in `from_key` |

- Missing/ill-typed values are **not** wildcards: subject assembly omits
  unavailable values; anonymous/system contexts never automatically carry
  end-user metadata.
- `system:scheduler` is the built-in role for scheduled execution — write
  rules against the **actual execution context**, never inheriting the
  creator's permissions by default.
- **Metadata tenancy is trustworthy only when users cannot freely edit the
  security metadata**: a rule over an attacker-writable `meta.school_id`
  is not isolation however correct its syntax.
- User/role `is_admin` gates management entry only; business-data access
  still needs explicit rules, including intended cross-tenant bypasses.

## Rule JSON syntax

`expr` is an externally tagged AST — not a string expression, Cedar
program or SQL:

```json
{"all":[{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},{"obj":{"attr":"owner","op":"eq","subj":"uid"}}]}
```

Supported nodes:

- `{"all":[...]}`, `{"any":[...]}`, `{"not":<node>}`.
- `{"obj":{"attr":"owner","op":"eq","subj":"uid"}}` (`subj` may become
  `lit`; exactly one right operand).
- `{"subj_only":{"subj":"role","op":"eq","lit":"reader"}}`.
- `{"is_null":{"attr":"deleted_at","negated":false}}` — false (default)
  is IS NULL, true IS NOT NULL; **an omitted attribute is not an explicit
  JSON null**.

Operators: `eq`, `in`, `lt`, `lte`, `gt`, `gte`, `like`, `ilike` (SQL
LIKE wildcards). Literals are text or signed integers — booleans/objects
rejected. `in` tests membership in a declared set (subject-only checks
whether the literal is in the subject set); two scalars use `eq`.
Type/shape errors and unknown references are errors — **never** implicit
conversion or pass-through.

Decision semantics: **deny by default**; at least one matching permit is
required, and a matching forbid overrides permits. Missing facts/attributes
never widen access; empty/malformed objects cannot dodge a forbid; when no
safe row scope can be constructed, execution **refuses** rather than
degrading to an unscoped query.

## Three enforcement surfaces

1. **Endpoint gates**: `authz_gates:[{type,action}]` run a
   **subject-only** check before execution; they accumulate along
   ancestors until `override_permissions`. A permit depending on row
   attributes proves nothing at a subject-only gate.
2. **Single-object check**: `ctx.authz.check(type, action, attrs)` judges
   the supplied object — pass the object's **real, trusted** attributes,
   never the request body wholesale; your code must handle the result
   before acting.
3. **Row scopes**: CRUD `authz_type` and the supported database resources'
   `authz_tables` lower the same model into per-request predicates. Write
   `"reports":"report"` or
   `{"type":"report","actions":{"read":"list"}}` (the action mapping only
   renames the implied action); join/overlay configuration lives in each
   resource reference. **A model existing does not automatically protect
   arbitrary direct SQL.**

Project `scope_claims` are a different system: identity-parameter
declarations `{name,type,source,from?}` (`type` `uuid|text|int`, `source`
`meta|token`) feeding `$claim.<name>` defaults/policies. They are **not**
authorization `subject_attrs` and not OAuth scopes; references to
missing/ill-typed claims fail closed, and undeclared claims fail earlier
validation. Update/reset semantics: [project settings](../projects/settings.md).

## Tenancy isolation and bypass

- Types default to `cross_tenant:false`, but isolation is injected **only
  when both `tenant_attr` (a local object attribute) and `tenant_subject`
  (a declared subject tenancy attribute) are set**; the default alone
  recognizes no tenant column. Scalar subjects compare by equality; sets
  support membership. Isolation adds a cross-tenant forbid that broad
  permits cannot override.

Dimension default (`PUT .../subject-attrs/schools/tenant_bypass`):

```json
{"tenant_bypass":{"subj":"role","op":"eq","lit":"admin"}}
```

Type designation (`PUT .../types/report/tenancy`):

```json
{"tenant_attr":"school","tenant_subject":"schools","tenant_bypass":false}
```

- A bypass is `{subj,op,lit}` with **no extra AST wrapper**, allowing only
  `eq`/`in`. Omitted/null on a type inherits the dimension default; the
  object overrides the default; JSON `false` explicitly forbids bypass on
  that type; null on the subject dimension clears the default.
- **A bypass only removes tenancy isolation for matching callers — it is
  itself no permit**; `cross_tenant:true` explicitly disables isolation —
  never use it to "fix" multi-tenant denial tests.

## Rule ownership and repository safety

- Console/CLI model APIs create `origin:platform`; `_authz` creates
  `origin:delegated`.
- `viat pull` **does not export** delegated rules; `viat push` neither
  writes nor prunes them and protects their dependent types/actions.
  Deleting a delegated rule from the console requires an explicit handover
  (`PUT /projects/{slug}/authz/rules/{id}/origin` with
  `{origin:"platform"}`), deletion on the delegated side, or an explicit
  force-delete path — **absence from YAML does not mean stale**.
- This is not a second policy engine: both origins participate in
  decisions.

[Repository sync](../projects/repo-sync.md) covers versioning/deletion
guards and `authz/migrations/`. Endpoint snapshot rollback does **not**
roll back the live model or user metadata — coordinate model changes with
publishing.

## Mandatory denial validation

With isolated users verify: wrong role denied; same role cross-tenant
denied; missing tenant claim denied; null and omitted object attributes do
not accidentally pass; forbid overrides permit; forged request
`role`/`is_admin` is ineffective; a valid authorizer absent from the
published list is still denied; a Developer cannot change Owner/Admin-only
settings; a delegated admin cannot become a platform editor. After each
change, check lint and audit. Cleanup can be reference-blocked: delete
test rules first, then actions/attrs/types/subject attributes once
unblocked.

## Verification basis

Contract source `03751a67`: `crates/viat-policy/src/lib.rs`,
`crates/viat-core/src/types/authz.rs`,
`crates/viat-api/src/{handlers/authz_admin.rs,handlers/authz_console.rs,authz_decision.rs}`,
`crates/viat-db/src/endpoints.rs`, `crates/viat-cli/src/repo/viat_yaml.rs`.
This page is source-verified only; no policy runtime, database, provider,
CLI or integration tests were run.
