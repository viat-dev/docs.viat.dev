---
title: "HTTP API resource"
description: "A fixed upstream base URL plus authentication and headers, used by script HTTP helpers and proxy endpoints. Requests are made by the platform; it is not an arbitrary credentialed URL fetcher. Use graphql for GraphQL error handling and cloud_api for action signing."
doc_id: resource.http_api
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.http_api]
---

# HTTP API resource

A fixed upstream base URL plus authentication and headers, used by script HTTP helpers and proxy endpoints. Requests are made by the platform; it is not an arbitrary credentialed URL fetcher. Use graphql for GraphQL error handling and cloud_api for action signing.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Allow outbound access from API nodes (and any configured proxy). Provision a least-privilege upstream identity. Identity assertions require the project identity provider and an upstream verifier trusting the project JWKS, correct issuer/audience and expiry; enabling a checkbox alone does not authorize an upstream user.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.auth_type` | HttpAuthType | yes | — | — | Authentication selector, not an authorization grant. |
| `plain.base_url` | string | yes | — | — | Configured upstream base/transport override; not a per-call destination. |
| `plain.custom_headers` | map<string, string> | no; may be conditional | `{}` | — | Every-request string headers; use whole-value $secret: references for credentials. |
| `plain.identity_assert` | boolean | no; may be conditional | `false` | — | Proxy-only signed X-Viat-Identity assertion. |
| `plain.identity_forward_token` | boolean | no; may be conditional | `false` | — | Proxy-only forwarding of the original external token. |
| `plain.identity_ttl_secs` | integer / null | no; may be conditional | `null` | minimum: 0; format: "uint32"; 0–4294967295 | Minted identity-token lifetime: runtime default 60 seconds, maximum 3600. |
| `plain.proxy` | string / null | no; may be conditional | `null` | — | Optional proxy URL; broker helpers apply it on the platform. Do not embed passwords in plain. |

#### `HttpAuthType`

Allowed shape/values: `"none" / "bearer" / "basic" / "header_key" / "caller_token" / "viat_identity"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.header_name` | string / null | no; may be conditional | `null` | — | Credential header name for header_key, stored in the secret half. |
| `secret.password` | string / null | no; may be conditional | `null` | — | Account password/app password, never a plaintext config setting. |
| `secret.token` | string / null | no; may be conditional | `null` | — | Bearer/header-key token selected by auth_type. |
| `secret.username` | string / null | no; may be conditional | `null` | — | Account name; optional/anonymous rules differ by kind. |

## Runtime rules, defaults and limits

base_url and proxy must pass the deployment outbound URL guard. `auth_type` is required: none; bearer uses secret.token; basic uses secret.username/password; header_key uses secret.header_name/token. These optional secret fields are not made required by the DTO: a missing or empty credential emits no corresponding auth header, so save is not proof of authenticated access. caller_token borrows the original caller credential and fails for runs without it. viat_identity mints a bearer for a verified project-user principal and fails for system principals or a disabled IdP. `identity_ttl_secs` has runtime default 60 and maximum 3600.

`identity_assert` and `identity_forward_token` are proxy-only. The first attaches a platform-signed X-Viat-Identity after stripping inbound spoofed assertions. The second forwards only an original external JWT as X-Forwarded-Authorization, never a Viat session/API key. They do not change a script helper call. `custom_headers` is plaintext/exportable; use an entire value `"$secret:vendor_key"` for a credential header, with the full header value in that secret. `Bearer $secret:vendor_key` is invalid interpolation. The referenced secret must exist before save.

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
  "kind": "http_api",
  "plain": {
    "base_url": "https://api.example.test/v1",
    "auth_type": "none",
    "custom_headers": {
      "Accept": "application/json"
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

Python: request(method,path,query=None,headers=None,json=None,body=None,timeout=None,raw=False), and get/post/put/patch/delete/head. TypeScript uses request(method,path,opts) and the same verbs; opts has query/headers/json/body/timeout/raw. JSON responses decode to values, text to strings, raw to bytes/Uint8Array. A 4xx/5xx raises ViatError(upstream_error) with the upstream status and bounded response detail. The helper does one request: implement pagination and safe retries explicitly. Use relative paths under the configured origin; credential application stays platform-side.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.get("/health", query={"verbose": "false"})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.get("/health", { query: { verbose: "false" } });
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
        ctx.resource("demo").call("http", json!({"method":"GET","path":"/health"}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

Against a fixture that serves GET /v1/health as application/json {"ok":true}, both helpers return {"ok":true}; the name is not a real public service.

## Test behavior and side effects

Sends a real GET to base_url, with stored headers/auth and proxy, timeout 5s. Only transport failures and 5xx fail; 401/404/405 may still yield ok:true. caller_token/viat_identity have no caller in Test and are probed without run-dependent auth. Choose a harmless base URL: GET can have upstream side effects.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

`upstream_error`: inspect status, then fix upstream auth/path or rate limits; do not blindly retry mutations. Outbound-denied messages require operator approval of the destination, not disabling verification. `resource.config.unknown_secret`/`not_a_secret`: create a secret-kind target in the correct folder. Runs without caller credentials must use a service-auth resource instead of caller_token.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Do not put credentials in base_url, proxy userinfo or literal custom headers: plain is readable/exportable. Do not log reflected upstream bodies. Deleting the resource does not revoke the upstream credential; remove proxy/script references and revoke the identity separately.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [GraphQL upstream resource](graphql.md)
- [Cloud API resource](cloud_api.md)
- [Secret resource](secret.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.http_api`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
