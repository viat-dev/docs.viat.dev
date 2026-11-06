---
title: "Library resource"
description: "Call exported functions of a frozen Rust/binary script as the original caller. Not Python imports, npm packages or uses modules. Saving the library is its publish; editing source alone does not change its frozen build."
doc_id: resource.library
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.library]
---

# Library resource

Call exported functions of a frozen Rust/binary script as the original caller. Not Python imports, npm packages or uses modules. Saving the library is its publish; editing source alone does not change its frozen build.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Create a same-project rust/binary script that dispatches ctx.function and validates its own arguments/results; configure its resource declarations and build prerequisites. Rust needs no separate function-export manifest. A binary script must have its normal executable manifest/artifact. The library never acquires a different principal for the caller.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

Unknown keys are rejected.

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.script` | string | yes | — | — | Resource-folder-relative frozen Rust/binary export script reference. |

### `secret`

Empty object `{}`; this half declares no fields.

## Runtime rules, defaults and limits

script required/nonblank, bare or folder/name resolved from resource folder. Unknown plain keys rejected; secret {}. Save resolves the script, checks its language, builds where available and freezes source/artifact; save again to ship changes. Moves/copies re-anchor resolution. The host passes the function name to ctx.function, not a host-enforced function allow-list: the library must reject unknown names itself.

### Complete library fixture

Create a script with name scorer, folder fixtures, language rust, and the following content through the script editor/API before saving the resource. The function dispatcher is an application contract, not a separate resource schema.

```rust
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, args: Value| -> Result<Value, Error> {
        if ctx.function.as_deref() != Some("score") {
            return Err(Error::new("unknown_function"));
        }
        let features = args.get("features").and_then(Value::as_array)
            .ok_or_else(|| Error::new("features must be an array"))?;
        let mut sum = 0.0;
        for item in features {
            sum += item.as_f64().ok_or_else(|| Error::new("features must be numbers"))?;
        }
        Ok(json!({"score": sum}))
    });
}
```

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
  "kind": "library",
  "plain": {
    "script": "fixtures/scorer"
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

Python call(function,args=None,**kwargs), dictionary or kwargs not both; TypeScript call(function,args={}); Rust ctx.library(name).call(function,args). Arguments arrive as the run args object; a non-object is wrapped as {value:…}. The library itself validates arguments/results; no per-function schema is enforced by this resource. Return is the function result (response wrappers contribute body), not a stream. Typed failures propagate. Calls spend the caller’s remaining timeout, share its logs, nest at most four deep and reject cycles. Offline viat script test does not execute library calls. No Python import/shared-library ABI is implied.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.call("score", {"features": [1.0, 2.5]})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.call("score", { features: [1.0, 2.5] });
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
        ctx.library("demo").call("score", json!({"features":[1,2.5]}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

Create the fixture Rust script shown below as fixtures/scorer first. Its score dispatch accepts {features:number[]} and sums to {score:3.5}. Saving a missing script fails. The source is provided for an approved fixture run, not executed here.

## Test behavior and side effects

Checks that a frozen build exists, its source script still exists and the draft version equals the frozen version. A newer draft fails Test with a prompt to resave even though callers still run the old build. It does not invoke the library function; save can invoke the build toolchain.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.library.empty_script: select a script. resource.library.script_missing/script_language/build_failed: repair the rust/binary script then resave. Unknown-function/argument errors come from the library’s own validation: align with frozen implementation. Source fixes without resaving do not update calls.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Version contracts and deploy compatible callers before breaking changes. Keep nested resources least-privilege; calls retain original identity. Disable callers before deletion; source script and previous external writes remain.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [Config resource](config.md)
- [PostgreSQL resource](postgresql.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.library`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
