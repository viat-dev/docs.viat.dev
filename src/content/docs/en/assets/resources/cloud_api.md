---
title: "Cloud API resource"
description: "Signed action calls for exactly two protocols: aliyun_rpc_v1 and tencent_tc3. This is not an all-cloud adapter: AWS SigV4, Aliyun ACS3 and arbitrary vendor signing are unsupported here. A resource pins a product endpoint; scripts cannot redirect its credential to another host."
doc_id: resource.cloud_api
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.cloud_api]
---

# Cloud API resource

Signed action calls for exactly two protocols: aliyun_rpc_v1 and tencent_tc3. This is not an all-cloud adapter: AWS SigV4, Aliyun ACS3 and arbitrary vendor signing are unsupported here. A resource pins a product endpoint; scripts cannot redirect its credential to another host.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Provision a least-privilege RAM/CAM sub-account for the needed product actions. Match provider, endpoint and API version to the product protocol and allow API-node outbound access. Rotate STS material before expiry.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.api_version` | string | yes | — | — | Cloud product API version; per-call override supported. |
| `plain.endpoint` | string | yes | — | — | Configured service endpoint; exact base-vs-operation and normalization rules depend on kind. |
| `plain.provider` | CloudProvider | yes | — | — | Wire protocol/provider selector; conditional requirements follow below. |
| `plain.proxy` | string / null | no; may be conditional | `null` | — | Optional proxy URL; broker helpers apply it on the platform. Do not embed passwords in plain. |
| `plain.region` | string / null | no; may be conditional | `null` | — | Signing/operation region; provider rules may require it. |
| `plain.service` | string / null | no; may be conditional | `null` | — | TC3 signing service, otherwise inferred from endpoint hostname. |

#### `CloudProvider`

Allowed shape/values: `"aliyun_rpc_v1" / "tencent_tc3"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.access_key_id` | SecretField | no; may be conditional | `""` | — | Cloud credential identifier, literal or a secret-resource reference. |
| `secret.access_key_secret` | SecretField | no; may be conditional | `""` | — | Cloud signing secret, literal or a secret-resource reference. |
| `secret.security_token` | SecretField / null | no; may be conditional | `null` | — | Optional cloud STS token, literal or secret-resource reference. |

#### `SecretField`

Allowed shape/values: `string / map<string, string>`.

A literal string, or an object with only a string `$secret` key (for example `{"$secret":"cloud_key"}`). The map schema does not authorize arbitrary multi-key objects: runtime validates exact references and secret-kind targets.

## Runtime rules, defaults and limits

endpoint must be HTTP(S) and pass the outbound guard; api_version must be nonblank. tencent_tc3 requires region; service defaults to the endpoint hostname’s first label. aliyun_rpc_v1 ignores dedicated region: put RegionId in action params when the product needs it. access_key_id/access_key_secret accept strings or exactly {"$secret":"name"}; optional STS security_token has the same shape. References must already target secret resources. Empty structural defaults do not imply anonymous signed calls work. proxy is applied by the platform.

RPC v1 sends form-encoded signed POST to / using HMAC-SHA1; TC3 sends signed JSON with action headers using HMAC-SHA256. Non-string params are JSON-serialized into the flat string map; the helper does not invent a product’s dotted list parameters. Per-call api_version override is supported; endpoint/provider override is not.

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
  "kind": "cloud_api",
  "plain": {
    "provider": "aliyun_rpc_v1",
    "endpoint": "https://cloud-stub.example.test",
    "api_version": "2015-11-23"
  },
  "secret": {
    "access_key_id": "fixture-access",
    "access_key_secret": "fixture-secret-not-a-credential"
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

Python action(name,params=None,api_version=None,check=True); TypeScript action(name,params={}, {apiVersion,check}). Returns vendor JSON (Tencent Response unwrapped). check:true turns vendor error codes into failures even on HTTP 200; use check:false only for a known business payload whose Code is not an error. No generic get/post, automatic retries or credential renewal.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.action("DescribeRegions", {})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.action("DescribeRegions", {});
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
        ctx.resource("demo").call("cloud", json!({"action":"DescribeRegions","params":{},"check":true}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

The fixture must implement the chosen signing protocol and return deterministic JSON for DescribeRegions. Not every real cloud product implements that action; this is a provider stub example, not a business operation to execute on a mail/SMS service.

## Test behavior and side effects

Sends a signed DescribeRegions probe. Signature-class rejection fails; other results, including unknown action, can pass. This is a limited signature/reachability signal, not proof of action permissions or service health. It makes a real request but does not deliberately choose a mail/SMS mutation.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.cloud_api.bad_endpoint/empty_api_version/region_required/bad_proxy_url: fix input. Signature errors: check account pair, region/service/version, clock skew and STS expiry. Vendor action-denied/invalid-action errors require policy/protocol correction, not broader credentials. Resolve missing references before signing.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Keep per-product resources and rotate temporary credentials out of band. Redact sensitive business params/responses even though signing keys remain platform-side. Removing this resource does not cancel accepted cloud work or revoke keys; migrate callers then revoke separately.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [Secret resource](secret.md)
- [Config resource](config.md)
- [HTTP API resource](http_api.md)
- [S3 resource](s3.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.cloud_api`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
