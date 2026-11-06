---
title: "GraphQL upstream resource"
description: "Calls an existing remote GraphQL HTTP endpoint and returns its data object, raising on GraphQL errors even with HTTP 200. This kind is not Viat’s database viat_gql engine; that engine belongs to postgresql/mysql/sqlite resources."
doc_id: resource.graphql
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.graphql]
---

# GraphQL upstream resource

Calls an existing remote GraphQL HTTP endpoint and returns its data object, raising on GraphQL errors even with HTTP 200. This kind is not Viat’s database viat_gql engine; that engine belongs to postgresql/mysql/sqlite resources.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Provision an upstream schema/account and network/proxy access from API nodes. For caller_token, a synchronous caller must bring a usable credential. viat_identity requires the project IdP and a verified project user plus an upstream JWT verifier.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.auth_type` | GraphQlAuthType | no; may be conditional | `"token"` | — | Authentication selector, not an authorization grant. |
| `plain.endpoint` | string | yes | — | — | Configured service endpoint; exact base-vs-operation and normalization rules depend on kind. |
| `plain.headers` | map<string, string> | no; may be conditional | `{}` | — | Every-query string headers; literal values are readable/exportable. |
| `plain.identity_ttl_secs` | integer / null | no; may be conditional | `null` | minimum: 0; format: "uint32"; 0–4294967295 | Minted identity-token lifetime: runtime default 60 seconds, maximum 3600. |
| `plain.proxy` | string / null | no; may be conditional | `null` | — | Optional proxy URL; broker helpers apply it on the platform. Do not embed passwords in plain. |

#### `GraphQlAuthType`

Allowed shape/values: `"token" / "caller_token" / "viat_identity"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.auth_token` | string / null | no; may be conditional | `null` | — | Optional stored bearer used in token auth mode. |

## Runtime rules, defaults and limits

endpoint is an absolute HTTP(S) operation URL, not a base to append /graphql automatically. auth_type defaults token: optional secret.auth_token is sent as Bearer; absent/empty means no Authorization header. caller_token and viat_identity follow HTTP’s fail-closed caller rules. identity_ttl_secs defaults 60, max 3600 at minting. headers is plaintext; put whole-value "$secret:header_secret" references there, not raw credentials or string interpolation. proxy is applied by the platform. DTO validates URLs and reference targets, not the remote query/schema.



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
  "kind": "graphql",
  "plain": {
    "endpoint": "https://graphql-stub.example.test/graphql",
    "auth_type": "token",
    "headers": {}
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

Python query(query,variables=None,operation=None); TypeScript query(query,variables={},operation=null). operation selects operationName for multi-operation documents. Result is data, not {data,errors}. Any nonempty errors array rejects rather than silently returning partial data. A mutation is a real side effect and is not automatically retried.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.query("query { __typename }")
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.query("query { __typename }");
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
        ctx.resource("demo").call("graphql", json!({"query":"query { __typename }","variables":{}}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

A fixture responding {"data":{"__typename":"Query"}} yields {"__typename":"Query"}. If it instead includes nonempty errors, the helper raises even if data is present.

## Test behavior and side effects

POSTs {__typename} with configured headers and stored bearer and checks HTTP/JSON/GraphQL errors. It does not synthesize a caller_token/viat_identity principal, so do not use Test as proof of per-caller authorization. The POST is an outbound request but a query, not an intentional mutation.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.graphql.bad_url/empty_endpoint/bad_proxy_url identify input issues; HTTP 401/403 requires upstream auth repair; GraphQL errors may mean query validation, row policy or field permissions. resource.config.unknown_secret/not_a_secret requires correcting referenced header secrets. Treat a partial-data rejection as failed work, not success to persist.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Use GraphQL variables for untrusted values, bound list sizes, and avoid retrying mutations without idempotency. Resource removal does not remove upstream data or revoke its token.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [HTTP API resource](http_api.md)
- [PostgreSQL resource](postgresql.md)
- [Secret resource](secret.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.graphql`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
