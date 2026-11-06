---
title: "Mobile push resource"
description: "JPush, FCM HTTP v1 and APNs token transports, including platform event senders and script .send in stable 1.1.0. Acceptance is not handset delivery. Encrypted APNs widget overview snapshots from the unreleased branch are not stable functionality."
doc_id: resource.push
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.push]
---

# Mobile push resource

JPush, FCM HTTP v1 and APNs token transports, including platform event senders and script .send in stable 1.1.0. Acceptance is not handset delivery. Encrypted APNs widget overview snapshots from the unreleased branch are not stable functionality.

Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).

## Prerequisites and permissions

Set up provider app and registered test device in the matching environment. JPush needs app key/master secret; FCM project/RSA service-account JSON; APNs bundle/topic and EC .p8 key plus key/team IDs. Permit HTTPS (APNs HTTP/2). Real sends/device actions require opt-in; use a stub by default.

## Complete configuration fields

Required describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.

### `plain`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `plain.apns_production` | boolean | no; may be conditional | `false` | — | JPush APNs distribution environment switch, false by default. |
| `plain.app_key` | string | no; may be conditional | `""` | — | JPush public app key, paired with master_secret. |
| `plain.base_url` | string / null | no; may be conditional | `null` | — | Configured upstream base/transport override; not a per-call destination. |
| `plain.bundle_id` | string | no; may be conditional | `""` | — | APNs app bundle/topic identifier. |
| `plain.environment` | string / null | no; may be conditional | `null` | — | APNs sandbox or production, deliberately no implicit environment. |
| `plain.project_id` | string | no; may be conditional | `""` | — | FCM Firebase project identifier, not a Viat project UUID. |
| `plain.provider` | PushProvider | yes | — | — | Wire protocol/provider selector; conditional requirements follow below. |

#### `PushProvider`

Allowed shape/values: `"jpush" / "fcm" / "apns"`.

### `secret`

| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |
| --- | --- | --- | --- | --- | --- |
| `secret.key_id` | string | no; may be conditional | `""` | — | Crypto envelope/JWT key label, or APNs signing-key identifier for push. |
| `secret.master_secret` | string | no; may be conditional | `""` | — | JPush private half. |
| `secret.p8_key` | string | no; may be conditional | `""` | — | APNs EC signing-key PEM. |
| `secret.service_account` | string | no; may be conditional | `""` | — | FCM complete service-account JSON encoded as one encrypted string. |
| `secret.team_id` | string | no; may be conditional | `""` | — | APNs Apple developer team identifier. |

## Runtime rules, defaults and limits

Supply provider jpush/fcm/apns in create plain. JPush requires app_key/master_secret; apns_production defaults false, distribution iOS needs true. FCM needs project_id and service_account as one JSON string with client_email/private_key/token_uri; RSA PEM parsed on save. APNs needs bundle_id, environment exactly sandbox/production and p8_key/key_id/team_id; EC PEM parsed on save. Unused provider fields cannot replace required ones. base_url override: HTTPS, HTTP only loopback; host required, no userinfo/query/fragment, outbound policy enforced. Only use approved compatible stubs/endpoints.



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
  "kind": "push",
  "plain": {
    "provider": "jpush",
    "app_key": "fixture-app-key",
    "apns_production": false,
    "base_url": "https://push-stub.example.test"
  },
  "secret": {
    "master_secret": "fixture-master-secret-not-a-credential"
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

Python send(registration_ids,content,title="",extras=None); TypeScript send(registration_ids,content,{title,extras}). Broker accepts 1–10000 IDs per call (stale SDK comments say 1000), batching provider requests. IDs: 1–256 visible ASCII bytes, no whitespace. Nonblank content ≤2000 Unicode characters, title ≤128; extras ≤20 string pairs, keys ≤64 bytes, values ≤256 characters. Provider byte limits still apply: APNs JSON/extras total ≤4096 bytes. Returns {accepted:n,delivery:"accepted-by-provider"}; partial acceptance matters. The script supplies IDs/owns user-device mapping, not automatic project-wide discovery.

Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.

### Python

```python
# @resource demo
from viat import ctx

def main():
    return ctx.resources.demo.send(["fixture-rid-1"], "Fixture notification", title="Reference", extras={"case": "fixture"})
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  return await ctx.resources.demo.send(["fixture-rid-1"], "Fixture notification", { title: "Reference", extras: { case: "fixture" } });
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
        ctx.resource("demo").call("push_send", json!({"registration_ids":["fixture-rid-1"],"content":"Fixture notification","title":"Reference","extras":{"case":"fixture"}}))
    });
}
```

Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.

### Expected result

An approved JPush-compatible stub accepts synthetic fixture-rid-1 and returns accepted:1/delivery:"accepted-by-provider". No delivery assertion or send execution is made here.

## Test behavior and side effects

Provider validation without handset notifications: JPush validation endpoint; FCM validate_only with dummy token (may obtain OAuth token); APNs invalid-test-token probe. Real outbound/auth events, not schema-only. A validation pass does not establish real token/environment compatibility.

Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.

## Common failures and recovery

resource.push.empty_app_key/empty_master_secret/empty_project_id/empty_service_account/empty_bundle_id/empty_p8_key/empty_key_id/empty_team_id: complete provider fields. bad_service_account_json/key or bad_p8_key: fix material; bad_environment: exact sandbox/production; bad_url/outbound_denied: approved base. Re-register invalid tokens; uncertain timeout can follow acceptance, so blind retry duplicates sends.

Management errors normally use {error,message}. DTO resource.&lt;kind&gt;.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.

## Production pitfalls and cleanup

Choose environment deliberately, minimize sensitive text/extras, retire invalid tokens and deduplicate sends. Credentials stay platform-side. Removing this resource does not retract notifications/revoke vendor keys; disable callers/events then revoke separately. Do not promise 1.1.0 background widget snapshots.

General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.

## Related resources and maintenance evidence

- [HTTP API resource](http_api.md)
- [Config resource](config.md)
- [Secret resource](secret.md)
- [Resource overview](index.md)

Pinned contract: `contracts/1.1.0/resources.json` → `resource.push`。

Reviewed implementation (product-repository-relative paths): viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
