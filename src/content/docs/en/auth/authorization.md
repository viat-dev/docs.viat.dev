---
title: "Authorization model, gates and row scopes"
description: "Types, attributes, rule AST, subject sources, tenancy and delegated rule ownership."
doc_id: auth.authorization
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# Authorization model, gates and row scopes

Authentication does not grant business access. Viat evaluates a project authorization model: resource **types**, object **attributes**, **actions**, declared subject facts and permit/forbid **rules**. The old permission-string catalog is retired; nonempty `permissions`/`required_permissions` is not a supported replacement for rules.

## Who administers the model

Console/platform credential: project editor (`owner`, `admin`, `developer`) on `/projects/{slug}/authz`. Project credential: project administrator on `/p/{slug}/_authz`. The latter does not confer platform membership. Both share model validation, but rule ownership differs. `GET` of the base returns `{types,rules,subject_attrs,version}`; each type entry is `{type,attrs,actions}`. `GET .../lint` reports model coverage/dependency findings, not proof every business decision is correct.

Logical type/attribute/action/subject names are 1–64 bytes using ASCII letters/digits and `_ - . :`; they are URL path segments. Physical table/column identifiers have separate identifier validation. Do not use slashes/spaces in logical names.

## Model-management inputs

The following suffixes apply to either base unless stated. All snippets are **source-derived, unexecuted**; use disposable project `demo`, never production user attributes for experimentation.

| Method and suffix | Complete body / update behavior |
| --- | --- |
| `POST /types` | `{name,cross_tenant?}`; boolean defaults false |
| `GET /types`, `GET /types/{name}` | Types and type detail |
| `POST /types/{name}/rename` | `{name}`; supported rename preserves references rather than delete/recreate |
| `PUT /types/{name}/tenancy` | `{tenant_attr?,tenant_subject?,tenant_bypass?}`; replacement of tenancy designation; omit/null removes designation/bypass override, not patch-preserve |
| `POST /types/{name}/attrs` | `{name,kind,column_name?,rel_table?,rel_local_fk?,rel_ref_col?,rel_col?,is_set?}`; `kind` = `local` or `rel`, `is_set` defaults false |
| `POST /types/{name}/actions` | `{name}` |
| `POST /subject-attrs` | `{name,source,from_key?,ty,is_set?}`; `is_set` defaults false |
| `PUT /subject-attrs/{name}/tenant_bypass` | `{tenant_bypass:predicate-or-null}`; omitted/null clears dimension default |
| `POST /rules` | `{type,action,effect,expr,descr?}`; `effect` = `permit` or `forbid`; optional/null description |
| `DELETE /rules/{id}` | Removes the selected rule, subject to ownership checks |
| `DELETE /types/{name}`, `/types/{name}/attrs/{attr}`, `/types/{name}/actions/{action}`, `/subject-attrs/{name}` | Reference/dependency guards can refuse deletion; remove/migrate dependents first |

`local` attributes name a `column_name`. `rel` attributes name all of `rel_table`, `rel_local_fk`, `rel_ref_col`, `rel_col`: a parent hop through a local FK, compiled as a correlated existence predicate, not a caller-written SQL fragment. Declare `is_set` according to the modeled value; it changes valid membership operators. Creates do not provide generic partial update of every attribute; migrate references deliberately.

Example sequence (JSON bodies for `POST` under `/projects/demo/authz`):

```json
{"name":"role","source":"role","ty":"text"}
```

```json
{"name":"report","cross_tenant":true}
```

Then `POST /types/report/actions` with `{"name":"read"}` and `POST /rules`:

```json
{"type":"report","action":"read","effect":"permit","expr":{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},"descr":"Fixture readers may read reports"}
```

Create subjects/types/actions before rules that reference them. The `cross_tenant:true` example is deliberately not a tenant-isolation recipe; use the next section before deploying multi-tenant data.

## Subject attributes

`ty` is `text`, `int`, `uuid`. `is_set:false` declares a scalar, true a set. Facts are sourced from the verified principal, not request input:

| `source` | `from_key` / value |
| --- | --- |
| `claim` | Verified external-token claim key |
| `meta` | Project-user metadata key |
| `role` | Current project business role; no key needed |
| `identity` | Project identity string; no key needed |
| `user_id` | Project-user UUID; use `ty:uuid`; no key needed |
| `admin` | Effective project-admin state as text `"true"`/`"false"`, not JSON boolean; no key needed |
| `const` | Constant encoded in `from_key` |

Missing/ill-typed facts are not a wildcard; the assembled subject omits unavailable values. Anonymous/system contexts do not magically acquire an end-user metadata object. `system:scheduler` is a built-in role for scheduled execution; author rules for that actual context rather than assuming the creator's privileges.

A metadata-derived tenant is only trustworthy if users cannot edit that security-sensitive metadata through an application route. A correct rule over attacker-writable `meta.school_id` is not isolation. A project user/role `is_admin` controls administration surfaces; business data access still needs explicit policy, including any intended tenant bypass.

## Rule JSON grammar

`expr` is an externally tagged AST, not a string expression, Cedar program or SQL:

```json
{"all":[{"subj_only":{"subj":"role","op":"eq","lit":"reader"}},{"obj":{"attr":"owner","op":"eq","subj":"uid"}}]}
```

Supported nodes:

- `{"all":[...]}`, `{"any":[...]}`, `{"not":<node>}`.
- `{"obj":{"attr":"owner","op":"eq","subj":"uid"}}` or the same leaf with `lit` instead of `subj`; exactly one RHS.
- `{"subj_only":{"subj":"role","op":"eq","lit":"reader"}}`.
- `{"is_null":{"attr":"deleted_at","negated":false}}`; false default means IS NULL, true IS NOT NULL. An omitted attribute is not a supplied JSON null.

Operators: `eq`, `in`, `lt`, `lte`, `gt`, `gte`, `like`, `ilike`. Literals are text or signed integer scalars, not booleans/objects. `in` is membership against a declared set (for subject-only presets, the literal is tested against the subject set); use `eq` for two scalars. Type/shape mismatches and unknown references are errors, not implicit coercion or “allow”. SQL `LIKE` wildcards apply to `like`/`ilike`.

Decision is deny-by-default: at least one permit must match; a matching forbid overrides permits. Missing required facts/attributes must not widen access. Do not use an empty or partial object to evade a forbid; failure to construct a safe scope is refused rather than run unscoped.

## Three enforcement surfaces

1. **Endpoint gates**: `authz_gates:[{type,action}]` checks subject-only permission before runtime. Gates accumulate from ancestors until `override_permissions`. A row-dependent permit is not proof the caller may enter a subject-only gate.
2. **Point checks**: `ctx.authz.check(type, action, attrs)` evaluates a particular supplied object. Supply the actual object's trusted attributes, not values copied unquestioned from request input. Code must act on the result before performing the operation.
3. **Row scopes**: CRUD `authz_type` and supported database resource `authz_tables` lower the same model to per-request predicates. `authz_tables` can bind `"reports":"report"` or `{"type":"report","actions":{"read":"list"}}`; remapping affects the implied action only. See the existing resource references for connection/overlay configuration. A direct arbitrary SQL statement is not automatically row-scoped merely because a model exists.

Project `scope_claims` are a separate declared identity-parameter list for `$claim.<name>` defaults/policies: `{name,type,source,from?}` with `type` = `uuid|text|int`, `source` = `meta|token`. They are not the same as authorization `subject_attrs`, nor OAuth scopes. Missing/ill-typed declared claims fail closed when referenced; undeclared claim references fail earlier validation. [Project settings](../projects/settings.md) defines update/reset rules.

## Tenant isolation and bypass

A type defaults `cross_tenant:false`, but isolation is injected only when **both** `tenant_attr` (a local object attr) and `tenant_subject` (declared caller tenant attr) are designated. A default-false flag alone does not discover your tenant column. Scalar subject uses equality; a set supports membership. Isolation adds a forbid against crossing tenants, so a broad permit cannot bypass it.

Dimension default: `PUT .../subject-attrs/schools/tenant_bypass`:

```json
{"tenant_bypass":{"subj":"role","op":"eq","lit":"admin"}}
```

Type designation, `PUT .../types/report/tenancy`:

```json
{"tenant_attr":"school","tenant_subject":"schools","tenant_bypass":false}
```

The bypass object is the **unwrapped** `{subj,op,lit}` form; only `eq`/`in` allowed. On a type, missing/null bypass inherits the dimension default; object overrides it; JSON false explicitly disables bypass for that type. On a subject dimension, null clears the default. A bypass only removes tenant isolation for matching callers; it is not itself a permit rule. `cross_tenant:true` intentionally omits tenant isolation; do not enable it to silence a denied multi-tenant test.

## Rule ownership and repo safety

Rules created through console/CLI model routes have `origin:platform`; `_authz` rules have `origin:delegated`. `viat pull` excludes delegated rules; `viat push` neither writes nor prunes them, and protects types/actions they depend on. Console deletion of delegated rules requires intentional ownership handover (`PUT /projects/{slug}/authz/rules/{id}/origin` with `{origin:"platform"}`), delegated deletion, or explicit forced deletion support; do not assume absence from YAML means obsolete. This is not a second policy engine: both rule origins participate in decisions.

[Repo-sync](../projects/repo-sync.md) describes version/deletion guards and `authz/migrations/` steps. A rollback of endpoint snapshots is not a rollback of live model/user metadata. Coordinate model changes and endpoint publish.

## Required negative verification

Use isolated users and verify: wrong role denied; same role in another tenant denied; missing tenant claim denied; null versus omitted object attr does not grant; matching forbid beats permit; forged request `role`/`is_admin` ignored; a valid authorizer absent from the published list denied; a Developer cannot change Owner/Admin-only project settings; delegated admin cannot turn itself into a platform editor. Inspect lint and audit after each change. Removing test objects may be blocked by references—delete test rules first, then actions/attributes/types and subject attrs after dependents are gone.

Validation was source-only; no policy runtime, database, provider, CLI or integration tests were run for these snippets. **Evidence:** `crates/viat-policy/src/lib.rs`, `crates/viat-core/src/types/authz.rs`, `crates/viat-api/src/{handlers/authz_admin.rs,handlers/authz_console.rs,authz_decision.rs}`, `crates/viat-db/src/endpoints.rs`, `crates/viat-cli/src/repo/viat_yaml.rs`.
