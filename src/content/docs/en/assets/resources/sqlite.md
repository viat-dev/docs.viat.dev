---
title: "SQLite resource"
description: "A server SQLite file opened by the platform, not Viat’s platform DB or a browser database. SQL/transactions/viat_gql/CRUD work on one node or replicated read-only data, not multi-node shared writes."
doc_id: resource.sqlite
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.sqlite]
---

# SQLite resource

A server SQLite file opened by the platform, not Viat’s platform DB or a browser database. SQL/transactions/viat_gql/CRUD work on one node or replicated read-only data, not multi-node shared writes.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Operator must configure VIAT_SQLITE_ROOTS and mount suitable files for the server account. Without roots save fails. Separate storage roots; network filesystems do not solve SQLite locking.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.authz_tables` | map<string, AuthzTableBinding> | no; may be conditional | `{}` | — | Exposed table → authorization type or {type,actions}; bound engines deny unbound tables. |
| `plain.create_if_missing` | boolean | no; may be conditional | no explicit default; see rules | — | Create an empty SQLite file at first connect when writable; ignored when read_only. |
| `plain.graphql_overlay` | string / null | no; may be conditional | no explicit default; see rules | — | TOML overlay for the database GraphQL engine, not a GraphQL request. |
| `plain.path` | string | yes | — | — | Absolute server-only SQLite file under VIAT_SQLITE_ROOTS; never the platform DB. |
| `plain.read_only` | boolean | no; may be conditional | no explicit default; see rules | — | SQLite-enforced read-only opening. |

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

Empty object `{}`; this half declares no fields.

## Runtime rules, defaults and limits

path required absolute under an allowed root, checked at save and through symlinks on open; never injected. read_only false by default, enforced by SQLite when true. create_if_missing false catches typos; true can create an empty file on Test/publish/run when writable. With read_only:true the create flag is ignored rather than creating a missing file. audit rejected. graphql_overlay/authz_tables work as PostgreSQL/MySQL, no multi-schema list. A canonical file claimed by another project is rejected; same-project resources can share. Save-time claim is not a cross-project concurrent-creation lock.



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

Provider credential/private material is applied by the platform’s broker operation, not handed to the script helper. Do not use removed r.secret/r.auth_headers patterns. Plain literal headers/config remain visible: use references in supported positions.

## Minimal configuration: management API / CLI file

This create-request JSON is also valid YAML for `resource.yaml` and the real CLI command below. Domains/credentials are fixtures; replace them and satisfy prerequisites before real use. Never commit a file containing actual secrets.

```json
{
  "name": "demo",
  "folder": "",
  "kind": "sqlite",
  "plain": {
    "path": "/allowed-fixture-root/reference.db",
    "read_only": true,
    "create_if_missing": false
  },
  "secret": {}
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

Equivalent API: `POST /projects/{slug}/resources`, relative to the instance management API root, with the body above. Expect the saved public resource and masked summary, not echoed secrets; an existing fixture name conflicts with 409. For repo sync omit folder and put it in `resources/demo.yaml`; `viat push` synchronizes complete plain and non-placeholder secret fields. Saving does not prove every remote operation works.

## SDK operations and examples

Python/TypeScript query/execute/transaction/graphql use named :parameters, one statement per call. Stored types return integer/real numbers, strings, blob base64; BOOLEAN often 0/1 and JSON text. tx.graphql is scope-aware, raw query/execute are not. Foreign keys/case-sensitive LIKE enforced. ATTACH DATABASE and VACUUM INTO denied; plain writable VACUUM allowed. No injected path/url/direct-driver method.

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

Replace the illustrated server-only fixture path with an approved file under operator roots. Query returns answer=42; read_only:true refuses later writes. This is not an actual local-machine path.

## Test behavior and side effects

Opens the runtime pool and queries sqlite_schema; create_if_missing:true can create a file. Missing/invalid DB fails otherwise. Then performs GraphQL diagnostics.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.sqlite.path_claimed: select correct project/file. Path/root/symlink failures require operator mount/root repair, not arbitrary directory access. database is locked: shorten transactions (write waits about 5s). Read-only errors require an intentionally writable resource. audit_unsupported_kind: remove audit.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Writable transactions use BEGIN IMMEDIATE, holding the write lock throughout. Use tx inside the block, not outer resource writes that wait on your own lock. Same paths on multiple nodes are different DBs. Use SQLite-aware backups; resource deletion does not remove the file.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [PostgreSQL resource](postgresql.md)
- [MySQL resource](mysql.md)
- [Managed storage resource](storage.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.sqlite`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
