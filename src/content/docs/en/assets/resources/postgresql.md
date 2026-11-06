---
title: "PostgreSQL resource"
description: "Connect to a project-owned PostgreSQL database for SQL, transactions, database GraphQL, CRUD and optional business-data auditing. This is not access to Viat’s own platform database. Use a narrowly privileged application role, not a superuser."
doc_id: resource.postgresql
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.postgresql]
---

# PostgreSQL resource

Connect to a project-owned PostgreSQL database for SQL, transactions, database GraphQL, CRUD and optional business-data auditing. This is not access to Viat’s own platform database. Use a narrowly privileged application role, not a superuser.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Provision the database and role first; allow network access from every API node. Grant CONNECT, schema USAGE and the table/sequence privileges needed by your operations. Audit installation additionally needs privileges to create its trail table/functions and table triggers; resource Test does not install them.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.audit` | AuditConfig / null | no; may be conditional | `null` | — | PostgreSQL-only business audit declaration; saving can install DDL. |
| `plain.authz_tables` | map<string, AuthzTableBinding> | no; may be conditional | `{}` | — | Exposed table → authorization type or {type,actions}; bound engines deny unbound tables. |
| `plain.database` | string | yes | — | — | Target business database, not the platform database. |
| `plain.graphql_overlay` | string / null | no; may be conditional | `null` | — | TOML overlay for the database GraphQL engine, not a GraphQL request. |
| `plain.graphql_schemas` | array&lt;string&gt; | no; may be conditional | `[]` | — | Ordered PostgreSQL schemas; empty means public, later schemas get prefixes. |
| `plain.host` | string | yes | — | — | Server hostname/IP, not a URL or credential. |
| `plain.port` | integer | yes | — | minimum: 0; format: "uint16"; 0–65535 | TCP port. Explicitly supply it where required; TLS does not infer a port. |
| `plain.ssl` | boolean | no; may be conditional | `false` | — | Stored TLS preference; see the version-specific runtime limitations below. |

#### `AuditConfig`

Unknown keys are rejected.

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `AuditConfig.lock_down` | boolean | no; may be conditional | `true` | — | Try to revoke trail UPDATE/DELETE from resource role, default true. |
| `AuditConfig.schema` | string / null | no; may be conditional | `"public"` | — | Schema for audit table/functions, runtime default public. |
| `AuditConfig.table` | string / null | no; may be conditional | `"viat_audit"` | — | Audit trail or metadata table name; runtime defaults documented below. |
| `AuditConfig.tables` | array&lt;AuditTable&gt; | no; may be conditional | `[]` | — | Audited table names or full per-table declarations. |
| `AuditConfig.unattributed` | AuditUnattributed / null | no; may be conditional | `"deployment (reject by default)"` | — | Policy for unattributed writes: reject/record; absent uses deployment default reject. |

#### `AuditTable`

Actual input is a table-name string or the object below. The exported schema exposes a normalized structure; its three required fields are not all required on writes.

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `AuditTable.ignore_columns` | array&lt;string&gt; | no; may be conditional | `[]` | — | Suppress these columns only from update field rows, default []. |
| `AuditTable.name` | string | yes | — | — | Audited table name, optionally schema-qualified; bare means public. |
| `AuditTable.reason_required` | boolean | no; may be conditional | `false` | — | Refuse writes without an audit reason, default false. |

#### `AuditUnattributed`

Allowed shape/values: `"reject" / "record"`.

#### `AuthzTableBinding`

Allowed shape/values: `string / AuthzTableMapping`.

A string is the authorization-type shorthand; an object uses AuthzTableMapping below. Map keys are exposed table names, not arbitrary database-qualified names.

#### `AuthzTableMapping`

Unknown keys are rejected.

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `AuthzTableMapping.actions` | map<string, string> | no; may be conditional | `{}` | — | Implied read/create/update/delete → model action name; omitted entries retain their own name. |
| `AuthzTableMapping.type` | string | yes | — | — | Authorization-model type name in the long-form table binding. |

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.password` | string | yes | — | — | Account password/app password, never a plaintext config setting. |
| `secret.user` | string | yes | — | — | Database login, encrypted with the secret half. |

## Runtime rules, defaults and limits

`port` is required: no implicit 5432. `ssl` defaults false in the stored contract, but 1.1.0 PostgreSQL runtime SQL/GraphQL pools and Test do not apply the field to PgConnectOptions. They use the driver’s default TLS negotiation; do not rely on this switch to require TLS or verify the peer. Enforce transport requirements at deployment/database level and verify the negotiated connection independently. `graphql_schemas: []` means `["public"]`; save rejects blank names, surrounding whitespace and duplicates; schema existence/engine compatibility is checked at introspection. The first owns bare table names; later schemas use prefixes (audit.orders → audit_orders). This does not change raw SQL search_path. `graphql_overlay` is TOML: syntax is checked on save, relation/table semantics during engine construction. Nonempty removed `graphql_scope` is rejected; use `authz_tables`.

`authz_tables` maps exposed table names to an authorization type string or `{ "type": "record", "actions": {"read":"list"} }`. Implied keys are read/create/update/delete; omitted mappings retain that action name. Types and explicitly remapped target actions must exist; omitted same-name actions are not checked at save and may be absent (for example a type intentionally lacking delete). Once any table is bound, unbound tables are denied on the GraphQL/CRUD policy surface. Raw `.query`/`.execute` are intentionally unscoped and require your own tenant checks. Test checks bindings against the actual schema and may return `schema_warnings`.

`audit` is PostgreSQL-only. Each `audit.tables` entry is `"public.orders"` (bare `orders` means public) or `{name, reason_required:false, ignore_columns:[]}`. Ignored columns suppress only update field rows, not insert/delete snapshots. `unattributed` is reject/record; absent uses the deployment setting (default reject). Trail table/schema default to viat_audit/public; `lock_down` defaults true. Save reconciles actual DDL with the resource credential: an audited table must exist and have a usable primary key. Keep a reason on writes to reason_required tables; a failure refuses the write, not just the log.

## Permissions, identity and save semantics

Management API requires platform authentication and project membership. List/show require membership; create, PUT, PATCH, Test, refresh, copy and delete require an effective project Owner/Admin/Developer role; the lower-privilege operator role cannot write. Management access grants neither upstream privileges nor runtime s3/file/row-policy access. MCP exposes only its actual listed tools; a resource schema is not a full MCP CRUD interface.

- Create: `POST /projects/{slug}/resources`, body `{name,folder?,kind,plain,secret}`. name is 1–64 bytes without /; system is reserved. Omitted/empty folder means root; otherwise [A-Za-z0-9_-]+ segments, at most 8 levels/255 bytes, no leading/trailing/repeated /.
- Identity is project-local `(folder,name)`, not a global bare name. Duplicate names may exist in different folders. Use `/resources/{name}?folder=team` to locate detail routes explicitly; CLI uses `team/name`. Script bare names resolve own folder, root, then globally unique name; qualify cross-folder references, using Python `getattr(ctx.resources, "team/name")` or TypeScript `ctx.resources["team/name"]`, not a property chain.
- PUT fully replaces: resend correct kind, complete plain and all secret values to retain; show masks cannot recover them. PATCH fixes kind; omitted plain preserves it, supplied plain replaces the entire document (not a deep merge); secret overlays only supplied fields, retaining omitted fields. Folder moves recheck references at the new anchor.
- Clear an optional secret by explicit null (only nullable fields) or empty string (only fields allowing empty). Required/conditionally required fields cannot be cleared. To clear optional plain fields, send complete plain without them so defaults/absence take effect. Null is not universal and *** is never an old-secret value.
- `$keep` is a PATCH/repo sentinel only at **top-level plain fields**, retaining an existing server value even for numeric/boolean fields. It cannot initialize a new resource or missing field. Nested `$keep` is not a deep-merge instruction.
- Repo file `resources/<folder>/<name>.yaml` carries folder through its path, with a bare name inside. `viat pull` writes string `$secret` placeholders for secret fields; `viat push` removes them (also accepts legacy !secret tags) and PATCHes existing resources, never using markers as credentials. Safely supply real required secrets before creating a new resource; a placeholder cannot create credentials. Top-level allowed_authorizers is repo access-sync metadata, not something to insert into plain arbitrarily.

The `$secret` placeholder differs from a credential reference: `{"$secret":"name"}` names another secret resource in supported config/cloud positions; HTTP/GraphQL string headers use the entire `"$secret:name"` value. These are not plaintext credentials. Save/read/export retain references; use resolves them. Targets resolve relative to the consuming resource folder and must already exist with kind secret. No substring interpolation.

Public responses contain resource identifiers, kind, folder, plain and a secret summary, never secret values. Summary *** denotes declared fields, not proof every optional credential is populated. Plain is readable/exportable; secret uses the deployment encrypted backend. Published script/dependency code follows snapshot rules: uses is frozen unless (live), not blanket live on every run. Resource projection, broker operations and explicit live secret IO are different boundaries.

## Script secret boundary

**1.1.0 compatibility/security limitation:** this kind’s active runtime projection still injects a credential-bearing connection URL into the worker, even though the recommended operations below are brokered and do not need it. Treat the script and its dependency tree as trusted with that credential. Do not log/return the resource or extract a URL into application code; prefer the brokered helpers and least-privilege upstream credentials. Encryption at rest and CRUD masking do not remove this worker exposure.

## Minimal configuration: management API / CLI file

This create-request JSON is also valid YAML for `resource.yaml` and the real CLI command below. Domains/credentials are fixtures; replace them and satisfy prerequisites before real use. Never commit a file containing actual secrets.

```json
{
  "name": "demo",
  "folder": "",
  "kind": "postgresql",
  "plain": {
    "host": "postgres.example.test",
    "port": 5432,
    "database": "demo",
    "ssl": true
  },
  "secret": {
    "user": "demo_reader",
    "password": "fixture-password-not-a-credential"
  }
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

Equivalent API: `POST /projects/{slug}/resources`, relative to the instance management API root, with the body above. Expect the saved public resource and masked summary, not echoed secrets; an existing fixture name conflicts with 409. For repo sync omit folder and put it in `resources/demo.yaml`; `viat push` synchronizes complete plain and non-placeholder secret fields. Saving does not prove every remote operation works.

## SDK operations and examples

Python/TypeScript: `query(sql, params={})` → `{rows, affected}`; `execute` → affected count (discards RETURNING rows); `graphql(document, variables={})` → data object; `transaction()` (Python context manager) / `transaction(async tx => …)` (TypeScript callback). tx offers query/execute/graphql and `set_reason`; reason is PostgreSQL-specific. Parameters use `:name`, missing values bind NULL, and arrays/objects bind JSON text, not native PostgreSQL arrays. Use query for RETURNING. A failed statement poisons and rolls back the whole brokered transaction even if caught.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.query("SELECT :n AS answer", {"n": 42})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.query("SELECT :n AS answer", { n: 42 });
}
```

### Rust

The verified Rust surface uses generic `ctx.resource(name).call(op,req)` (library uses `ctx.library`), not invented Python-shaped methods. This shows the corresponding protocol operation and returns its raw result, which can differ from the composite example above.

```rust
// @resource demo
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, _args: Value| -> Result<Value, Error> {
        ctx.resource("demo").call("sql_query", json!({"sql":"SELECT :n AS answer","params":{"n":42}}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

With a reachable fixture database, the example returns rows containing answer = 42 and an affected count. PostgreSQL exact numeric/decimal values may be strings. No application table is required.

## Test behavior and side effects

Opens one connection, runs SELECT 1 and closes it; then performs best-effort GraphQL diagnostics. Save with audit, unlike Test, can install or reconcile tables/functions/triggers.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

`audit_reason_required`: supply the request/block audit reason before retrying. `audit_unsupported_kind` belongs to other SQL kinds, not this one. A message beginning graphql_overlay/graphql_schemas identifies invalid syntax/list configuration. Unknown authorization types or explicitly remapped target actions fail save; missing implicit actions are not save-checked. A wrong table binding fails Test. A connection error requires checking DNS, port, grants and TLS separately.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Keep transactions short and parameterize values, not identifiers. After DDL run `viat resource refresh demo` so every node rebuilds its cached schema on next use. Back up business data and the trail separately from Viat. Deleting this resource does not drop the database or audit evidence; it does remove authorization rules naming its audit resource.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [MySQL resource](mysql.md)
- [SQLite resource](sqlite.md)
- [SQL Server resource](sqlserver.md)
- [Managed storage resource](storage.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.postgresql`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
