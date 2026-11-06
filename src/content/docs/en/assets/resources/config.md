---
title: "Config resource"
description: "A version-controllable JSON document in plaintext plain.data, optionally validated by a restricted JSON Schema. Use it for non-secret settings; it is not an encrypted generic object. Secret leaves are explicit references to secret resources."
doc_id: resource.config
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.config]
---

# Config resource

A version-controllable JSON document in plaintext plain.data, optionally validated by a restricted JSON Schema. Use it for non-secret settings; it is not an encrypted generic object. Secret leaves are explicit references to secret resources.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Create referenced secret-kind resources before this resource. Decide which settings should travel through pull/push/import and which top-level plain fields should remain server-managed with $keep.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.data` | JSON | no; may be conditional | `null` | — | The actual config document; create/PUT requires non-null data here. |
| `plain.schema` | JSON | no; may be conditional | no explicit default; see rules | — | Restricted JSON Schema for config data; not the resource-kind schema. |

### `secret`

Empty object `{}`; this half declares no fields.

## Runtime rules, defaults and limits

On create/full PUT, plain.data must be present and non-null; {plain:{batch:10}} is wrong and fails resource.config.empty_data. Any non-null JSON value is allowed without schema; an object is the normal form. schema is optional; when present its root must declare type:object. Both the schema and data are checked on every write. default is a form annotation, not a promise that missing data will be populated.

Supported root keys: type/properties/required/additionalProperties/title/description/$schema. Property common keys: type/title/description/default/enum. String adds minLength/maxLength/pattern/format (format is annotation-only); integer/number adds minimum/maximum; array adds items/minItems/maxItems; object adds properties/required/additionalProperties (boolean only). Types are string/integer/number/boolean/array/object; arrays need a supported items schema. Unsupported $ref, combinators and other keywords are rejected rather than partly enforced.

Use exactly {"$secret":"token"} as a leaf, including inside arrays. Extra siblings or a non-string target are invalid. It is not interpolation and does not recursively turn arbitrary strings into secrets. Resolution validates target kind and folder identity; CRUD/pull keep references, while scripts consuming config receive the resolved value. Schema validation treats references as secret placeholders rather than requiring an object where a string belongs. Resolved data is sensitive even though the stored document is portable.

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

The stored document is plaintext; referenced secret values intentionally reach consuming scripts after hydration. This is not brokered credential isolation. Restrict scripts/dependencies and never return the whole resolved document.

## Minimal configuration: management API / CLI file

This create-request JSON is also valid YAML for `resource.yaml` and the real CLI command below. Domains/credentials are fixtures; replace them and satisfy prerequisites before real use. Never commit a file containing actual secrets.

```json
{
  "name": "demo",
  "folder": "",
  "kind": "config",
  "plain": {
    "data": {
      "batch": 10,
      "enabled": true
    },
    "schema": {
      "type": "object",
      "properties": {
        "batch": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "enabled": {
          "type": "boolean"
        }
      },
      "required": [
        "batch",
        "enabled"
      ],
      "additionalProperties": false
    }
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

Python exposes the document itself as a dict (demo["batch"]), TypeScript as demo.batch or demo["batch"]. There is no demo.data wrapper, no demo.value and no config write helper. Rust meta() sees the raw projected {kind:"config",data:…} envelope; read its data explicitly. Update through PATCH/PUT/repo push, not by mutating a worker object.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return {"batch": ctx.resources.demo["batch"], "enabled": ctx.resources.demo["enabled"]}
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return { batch: ctx.resources.demo.batch, enabled: ctx.resources.demo.enabled };
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
        Ok(json!({"batch": ctx.resource("demo").meta()["data"]["batch"], "enabled": ctx.resource("demo").meta()["data"]["enabled"]}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

The example returns {batch:10,enabled:true}. Setting batch to 0 fails schema validation at save rather than later in the script. secret is {} and carries no credential fields.

## Test behavior and side effects

Reports ok:false, “config resources have no connection to test”. Save-time schema/reference validation is the verification surface; a consumer test checks the resolved shape.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.config.empty_data: nest the document under plain.data; bad_schema: remove unsupported keywords/fix types; invalid: fix the reported data path; bad_secret_ref: use exactly the reference object. unknown_secret/not_a_secret: create a secret target in the resolved folder. A PATCH supplying plain is replacement, so sending only plain.schema can reset data to null: include the complete data.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Never store literal passwords in plain.data; it is returned and exported. $keep works only at the top level (plain.data:"$keep" keeps the whole existing document); nested "$keep" is ordinary application data. Before deleting, migrate readers and referenced secrets deliberately; deletion does not remove any external service settings.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [Secret resource](secret.md)
- [HTTP API resource](http_api.md)
- [Cloud API resource](cloud_api.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.config`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
